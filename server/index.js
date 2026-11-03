// pkgwatch — API server (Express)
'use strict';
const express = require('express');
const path = require('node:path');
const crypto = require('node:crypto');

const store = require('./db');
const mail = require('./mailer');
const { ChangePoller, fetchLatestWithTime } = require('./poller');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8787;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
// scoped (@scope/name) and classic package names
const PKG_RE = /^(?:@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/;
const CODE_TTL = 15;

// ---------- helpers ----------

function lookupPkg(name) {
  return fetchLatestWithTime(name).then((info) => ({
    name,
    version: info.version,
    publishedAt: info.publishedAt,
  }));
}

async function notifyPackage(pkg, knownVersion) {
  let info;
  try {
    info = await fetchLatestWithTime(pkg);
  } catch (err) {
    console.error(`[watch] ${pkg}: registry lookup failed:`, err.message);
    return;
  }
  if (!info.version) return;
  if (knownVersion && info.version === knownVersion) return; // no change

  const subs = store
    .allSubscriptions()
    .filter((s) => s.package === pkg);
  if (subs.length === 0) return;

  const { subject, html, text } = mail.updateEmail(pkg, knownVersion, info.version);
  let delivered = 0;
  for (const s of subs) {
    try {
      await mail.send(s.email, subject, html, text);
      store.markNotified(s.email, pkg, knownVersion, info.version);
      delivered++;
    } catch (err) {
      console.error(`[mail] ${s.email}:`, err.message);
    }
  }
  console.log(`[watch] ${pkg}: ${knownVersion || '—'} → ${info.version} (${delivered} mailed)`);
  store.updateVersion(pkg, info.version);
}

// ---------- watcher ----------

const poller = new ChangePoller({
  onPackageChange: (pkg) => {
    const known = store
      .allSubscriptions()
      .find((s) => s.package === pkg)?.version;
    notifyPackage(pkg, known).catch((e) => console.error('[watch]', e));
  },
  onError: (msg) => console.warn('[changes-feed]', msg),
});
poller.setWatched(store.watchedPackages());
poller.start();
setInterval(() => poller.setWatched(store.watchedPackages()), 30_000);

// ---------- query tokens ----------
// Viewing one email's subscriptions requires a token that only the person who
// controls that mailbox can obtain (it is issued after a code verification).

const QUERY_TTL_DAYS = 30;

const signQueryToken = (email) =>
  crypto
    .createHmac('sha256', store.querySecret())
    .update(`query:${email}`)
    .digest('hex')
    .slice(0, 40);

function issueQueryToken(email) {
  return `${Date.now().toString(36)}.${signQueryToken(email)}`;
}

function checkQueryToken(email, token) {
  if (!token) return false;
  const dot = token.indexOf('.');
  if (dot < 1) return false;
  const issued = parseInt(token.slice(0, dot), 36);
  if (!Number.isFinite(issued)) return false;
  if (Date.now() - issued > QUERY_TTL_DAYS * 86_400_000) return false; // expired
  const expected = signQueryToken(email);
  const got = token.slice(dot + 1);
  if (got.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(got), Buffer.from(expected));
}

// ---------- api ----------

const api = express.Router();

// check a package: exists? latest version? (scoped names contain '/')
api.get(/^\/packages\/(.+)$/, (req, res) => {
  const name = req.params[0];
  if (!PKG_RE.test(name)) return res.status(400).json({ error: 'invalid package name' });
  lookupPkg(name)
    .then((info) => res.json(info))
    .catch(() => res.status(404).json({ error: 'package not found' }));
});

// request a verification code
api.post('/verify/request', (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'invalid email' });
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  store.createVerification(email, code, CODE_TTL);
  const { subject, html, text } = mail.verificationEmail(code, CODE_TTL);
  mail
    .send(email, subject, html, text)
    .then(() => res.json({ ok: true, ttlMinutes: CODE_TTL }))
    .catch((err) => {
      console.error('[mail] verify:', err.message);
      res.status(500).json({ error: 'failed to send email' });
    });
});

// confirm a code -> marks the email verified, issues a query token
api.post('/verify/confirm', (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const code = String(req.body?.code || '').trim();
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'invalid email' });
  const result = store.checkVerification(email, code);
  if (!result.ok) {
    return res.status(400).json({ error: 'verification failed', reason: result.reason });
  }
  // token lets this browser read that mailbox's subscriptions for 30 days
  res.json({ ok: true, email, token: issueQueryToken(email), ttlDays: QUERY_TTL_DAYS });
});

// is this email already verified? (the UI uses it to pick the direct path)
api.get('/verified/:email', (req, res) => {
  const email = String(req.params.email).trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'invalid email' });
  res.json({ email, verified: store.isVerifiedEmail(email) });
});

// subscribe one or many packages (requires verified email).
// duplicate (email, package) pairs are deduplicated server-side.
api.post('/subscribe', async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const raw = req.body?.package ?? req.body?.packages;
  const list = Array.isArray(raw)
    ? raw.map((p) => String(p || '').trim()).filter(Boolean)
    : [String(raw || '').trim()];
  const packages = [...new Set(list)].slice(0, 20); // dedupe, cap batch size
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'invalid email' });
  if (packages.length === 0) return res.status(400).json({ error: 'invalid package name' });
  for (const pkg of packages) {
    if (!PKG_RE.test(pkg)) return res.status(400).json({ error: 'invalid package name', package: pkg });
  }
  if (!store.isVerifiedEmail(email)) {
    return res.status(403).json({ error: 'email not verified', reason: 'unverified' });
  }
  try {
    const added = [];
    const existing = [];
    for (const pkg of packages) {
      const info = await lookupPkg(pkg).catch(() => null);
      if (!info) {
        return res.status(404).json({ error: 'package not found', package: pkg });
      }
      const before = store.subscriptionsByEmail(email).some((s) => s.package === pkg);
      store.addSubscription(email, pkg);
      store.updateVersion(pkg, info.version);
      (before ? existing : added).push({ package: pkg, version: info.version });
    }
    res.json({ ok: true, added, existing, duplicatesSkipped: existing.length });
  } catch {
    res.status(500).json({ error: 'lookup failed' });
  }
});

// unsubscribe (requires the query token too)
api.post('/unsubscribe', (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const pkg = String(req.body?.package || '').trim();
  const token = String(req.body?.token || '');
  if (!checkQueryToken(email, token)) {
    return res.status(401).json({ error: 'verification required', reason: 'bad_token' });
  }
  store.removeSubscription(email, pkg);
  res.json({ ok: true });
});

// a viewer for one email's subscriptions + notifications.
// requires the query token issued at verification time.
api.get('/subscriptions/:email', (req, res) => {
  const email = String(req.params.email).trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'invalid email' });
  const auth = String(req.headers.authorization || '');
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : String(req.query.token || '');
  if (!checkQueryToken(email, token)) {
    return res.status(401).json({ error: 'verification required', reason: 'bad_token' });
  }
  res.json({
    email,
    verified: store.isVerifiedEmail(email),
    subscriptions: store.subscriptionsByEmail(email),
    notifications: store.recentNotifications(email),
  });
});

// watcher status (about panel)
api.get('/status', (_req, res) => {
  res.json({
    watcher: poller.stats(),
    mailMode: mail.mode,
    watched: store.watchedPackages(),
  });
});

// npm search suggestions for the tag input
api.get('/search', async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (q.length < 2) return res.json({ results: [] });
  try {
    const r = await fetch(
      `https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(q)}&size=6`
    );
    const data = await r.json();
    res.json({
      results: (data.objects || []).map((o) => ({
        name: o.package.name,
        description: o.package.description || '',
        version: o.package.version,
      })),
    });
  } catch {
    res.json({ results: [] });
  }
});

// recent publishes straight from the npm firehose (the live ticker)
api.get('/firehose', (_req, res) => {
  res.json({ publishes: poller.recentPublishes(40) });
});

app.use('/api', api);

// ---------- static frontend ----------

const distDir = path.join(__dirname, '..', 'dist');
app.use(express.static(distDir));
app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(path.join(distDir, 'index.html')));

app.listen(PORT, () => {
  console.log(`pkgwatch API on http://localhost:${PORT}`);
  console.log(`watching: ${store.watchedPackages().join(', ') || '(none)'}`);
  console.log(
    `mail mode: ${mail.mode}${mail.mode === 'resend' ? ` (from ${process.env.MAIL_FROM || 'default'})` : mail.mode === 'console' ? ' (set RESEND_API_KEY or SMTP_HOST to send real mail)' : ''}`
  );
});
