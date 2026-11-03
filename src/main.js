// pkgwatch — frontend app
import { makeT } from './i18n.js';
import './style.css';

// ---------- state ----------

const state = {
  lang: localStorage.getItem('pw-lang') || (navigator.language?.startsWith('zh') ? 'zh' : 'en'),
  step: 'email', // email | code | package
  email: localStorage.getItem('pw-email') || '',
  codeSentTo: '',
  pkgPreview: null, // {name, version, publishedAt} | {name, error}
  subs: [],
  notifs: [],
  firehose: [],
  watched: [],
  mailMode: 'console',
  seq: null,
  busy: false,
};

const t = () => {
  const fn = makeT(state.lang);
  // supports both t('key') and t.key
  return new Proxy(fn, { get: (target, prop) => target(prop) });
};
const $app = document.getElementById('app');

const api = {
  async get(url) {
    const r = await fetch(url);
    if (!r.ok) throw Object.assign(new Error('http'), { status: r.status, body: await r.json().catch(() => ({})) });
    return r.json();
  },
  async post(url, body) {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error('http'), { status: r.status, body: data });
    return data;
  },
};

function toast(msg, isError = false) {
  const box = $app.querySelector('.toasts');
  if (!box) return;
  const el = document.createElement('div');
  el.className = 'toast' + (isError ? ' error' : '');
  el.textContent = msg;
  box.appendChild(el);
  setTimeout(() => el.remove(), 3800);
}

function ago(ts, lang) {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60_000);
  if (m < 1) return lang === 'zh' ? '刚刚' : 'just now';
  if (m < 60) return lang === 'zh' ? `${m} 分钟前` : `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return lang === 'zh' ? `${h} 小时前` : `${h}h ago`;
  const d = Math.floor(h / 24);
  return lang === 'zh' ? `${d} 天前` : `${d}d ago`;
}

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// ---------- svg icons ----------

const icon = {
  logo: `<svg width="26" height="26" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="7" fill="var(--raised-2)"/><path d="M8 22V10h4.5c2.6 0 4.3 1.6 4.3 4s-1.7 4-4.3 4H11v4H8zm3-6.5h1.3c.9 0 1.5-.5 1.5-1.5s-.6-1.5-1.5-1.5H11v3z" fill="var(--text)"/><path d="M19 22V10h3v9.5h4V22h-7z" fill="var(--positive-bright)"/></svg>`,
  sun: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5 5l1.6 1.6M17.4 17.4L19 19M19 5l-1.6 1.6M6.6 17.4L5 19"/></svg>`,
  moon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 13.5A8.5 8.5 0 0 1 10.5 4 7.5 7.5 0 1 0 20 13.5z"/></svg>`,
};

// ---------- renderers ----------

function render() {
  const T = t();
  const dark = document.documentElement.dataset.theme !== 'light';
  document.title = state.lang === 'zh' ? 'pkgwatch — npm 更新邮件通知' : 'pkgwatch — npm update email notifier';
  $app.innerHTML = `
  <div class="shell">
    <header class="topbar">
      <div class="brand">${icon.logo}<span>pkgwatch</span><span class="tagline">${T.tagline}</span></div>
      <div class="topbar-spacer"></div>
      <button class="iconbtn" id="langBtn" aria-label="${state.lang === 'zh' ? 'Switch to English' : '切换到中文'}">${T.langToggle}</button>
      <button class="iconbtn" id="themeBtn" aria-label="${dark ? T.themeLight : T.themeDark}">${dark ? icon.sun : icon.moon}</button>
    </header>

    <main>
      <section class="hero">
        <h1>${T.heroTitle}</h1>
        <p class="sub">${T.heroSub}</p>
      </section>

      <section class="firehose" aria-label="${T.liveNow}">
        <div class="firehose-head">
          <span class="dot" aria-hidden="true"></span>
          <span class="title">${T.liveNow}</span>
          <span class="sub">${T.liveSub}</span>
        </div>
        <div class="ticker" id="ticker"></div>
      </section>

      <div class="cols">
        <div>
          <form class="card" id="subscribeForm" novalidate></form>
          <div class="card">
            <div class="subs-head">
              <h2 class="card-title" style="margin:0">${T.subsTitle}</h2>
              <span class="card-sub" style="margin:0" id="subsCount"></span>
            </div>
            <div class="sub-list" id="subList"></div>
          </div>
        </div>
        <div>
          <div class="card">
            <h2 class="card-title">${T.notifTitle}</h2>
            <div class="notif-list" id="notifList"></div>
          </div>
        </div>
      </div>

      <div class="status-strip" id="statusStrip"></div>
    </main>

    <footer>
      <div class="inner">
        <span>${T.footerNote}</span>
        <span class="mono">replicate.npmjs.com · registry.npmjs.org</span>
      </div>
    </footer>
    <div class="toasts" aria-live="polite"></div>
  </div>`;

  renderForm();
  renderTicker();
  renderSubs();
  renderNotifs();
  renderStatus();
}

function renderForm() {
  const T = t();
  const form = $app.querySelector('#subscribeForm');
  if (!form) return;
  let inner = `<h2 class="card-title">${T.subscribeTitle}</h2>`;

  if (state.step === 'email') {
    inner += `
      <div class="field">
        <label for="email">${T.step1Label}</label>
        <div class="row">
          <input type="email" id="email" name="email" placeholder="${T.emailPlaceholder}" autocomplete="email" value="${esc(state.email)}" />
          <button class="btn primary" type="submit" id="sendBtn">${state.busy ? T.sending : T.sendCode}</button>
        </div>
      </div>`;
  } else if (state.step === 'code') {
    inner += `
      <div class="field">
        <label for="code">${T.step2Label}</label>
        <div class="row">
          <input type="text" id="code" name="code" class="mono-input" placeholder="${T.codePlaceholder}" inputmode="numeric" maxlength="6" autocomplete="one-time-code" />
          <button class="btn primary" type="submit" id="verifyBtn">${state.busy ? T.verifying : T.verify}</button>
        </div>
        <p class="hint">${T.codeSentTo.replace('{email}', esc(state.codeSentTo))} · <button type="button" class="unwatch" id="resendBtn" style="display:inline">${T.resend}</button></p>
      </div>`;
  } else {
    inner += `
      <div class="field">
        <label for="pkg">${T.step3Label} <span class="pill positive" style="margin-left:6px">✓ ${T.verifiedBadge} · ${esc(state.email)}</span></label><!-- taste-skill-ignore: checkmark is a status glyph, not emoji UI -->
        <div class="row">
          <input type="text" id="pkg" name="package" class="mono-input" style="letter-spacing:0" placeholder="${T.pkgPlaceholder}" spellcheck="false" autocomplete="off" />
          <button class="btn primary" type="submit" id="addBtn">${state.busy ? T.adding : T.addPackage}</button>
        </div>
        <div id="pkgPreview"></div>
      </div>`;
  }
  form.innerHTML = inner;
}

function renderPkgPreview() {
  const box = $app.querySelector('#pkgPreview');
  if (!box) return;
  const T = t();
  const p = state.pkgPreview;
  if (!p) {
    box.innerHTML = '';
    return;
  }
  if (p.error) {
    box.innerHTML = `<div class="preview error">${p.error === 'notfound' ? T.pkgNotFound : T.errInvalidPkg}</div>`;
    return;
  }
  const when = p.publishedAt ? ago(Date.parse(p.publishedAt), state.lang) : '';
  box.innerHTML = `
    <div class="preview">
      <span class="name mono">${esc(p.name)}</span>
      <span class="ver mono"> ${T.latestVersion.replace('{version}', esc(p.version || '?'))}</span>
      ${when ? `<span class="when"> · ${T.publishedAgo.replace('{ago}', when)}</span>` : ''}
    </div>`;
}

function renderTicker() {
  const el = $app.querySelector('#ticker');
  if (!el) return;
  const names = state.firehose.slice(-30).reverse();
  if (names.length === 0) {
    el.innerHTML = `<span class="chip" style="opacity:.5">…</span>`;
    return;
  }
  el.innerHTML = names
    .map((n) => `<span class="chip mono${state.watched.includes(n) || state.subs.some((s) => s.package === n) ? ' watched' : ''}">${esc(n)}</span>`)
    .join('');
}

function renderSubs() {
  const el = $app.querySelector('#subList');
  if (!el) return;
  const T = t();
  const count = $app.querySelector('#subsCount');
  if (count) {
    count.textContent = state.email && state.verifiedEmail
      ? (state.subs.length === 1 ? T.subsCount : T.subsCountPlural).replace('{n}', state.subs.length).replace('{email}', state.email)
      : '';
  }
  if (!state.email || !state.verifiedEmail || state.subs.length === 0) {
    el.innerHTML = `
      <div class="empty">
        <div class="big">${T.emptySubsTitle}</div>
        ${T.emptySubsBody.replace('{example}', '<span class="mono">@cloudflare/vite-plugin</span>')}
      </div>`;
    return;
  }
  el.innerHTML = state.subs
    .map(
      (s) => `
      <div class="sub-item">
        <div style="min-width:0">
          <div class="pkg mono">${esc(s.package)}</div>
          <div class="meta">${T.watchedSince.replace('{ago}', (s.created_at || '').slice(0, 10))}</div>
        </div>
        <div class="spacer"></div>
        <span class="version mono" title="${T.latestVersion.replace('{version}', esc(s.version || ''))}">v${esc(s.version || '—')}</span>
        <button class="unwatch" data-unwatch="${esc(s.package)}">${T.unwatch}</button>
      </div>`
    )
    .join('');
}

function renderNotifs() {
  const el = $app.querySelector('#notifList');
  if (!el) return;
  const T = t();
  if (state.notifs.length === 0) {
    el.innerHTML = `<div class="empty" style="padding:18px">${T.notifEmpty}</div>`;
    return;
  }
  el.innerHTML = state.notifs
    .map(
      (n) => `
      <div class="notif">
        <span class="pkg mono">${esc(n.package)}</span>
        <span class="from mono">${esc(n.from_version || '—')}</span>
        <span class="arrow">→</span>
        <span class="to mono">${esc(n.to_version)}</span>
        <span class="when">${ago(Date.parse(n.sent_at), state.lang)}</span>
      </div>`
    )
    .join('');
}

function renderStatus() {
  const el = $app.querySelector('#statusStrip');
  if (!el) return;
  const T = t();
  const seq = state.seq != null ? T.statusRunning.replace('{seq}', state.seq) : '…';
  el.innerHTML = `
    <span><span class="k">${T.statusTitle}</span> ${seq}</span>
    <span>${T.statusWatched.replace('{n}', state.watched.length)}</span>
    <span>${state.mailMode === 'console' ? T.statusMailConsole : T.statusMailSmtp}</span>`;
}

// ---------- data refresh ----------

async function refreshFirehose() {
  try {
    const d = await api.get('/api/firehose');
    state.firehose = d.publishes.map((p) => p.id);
    renderTicker();
  } catch { /* server offline */ }
}

async function refreshStatus() {
  try {
    const d = await api.get('/api/status');
    state.watched = d.watched || [];
    state.mailMode = d.mailMode;
    state.seq = d.watcher?.since ?? null;
    renderStatus();
    renderTicker();
  } catch { /* offline */ }
}

async function refreshAccount() {
  if (!state.email) return;
  try {
    const d = await api.get(`/api/subscriptions/${encodeURIComponent(state.email)}`);
    state.verifiedEmail = d.verified;
    state.subs = d.subscriptions || [];
    state.notifs = d.notifications || [];
    renderSubs();
    renderNotifs();
  } catch { /* offline */ }
}

// bootstrap: if saved email is verified, jump straight to package step
async function bootstrap() {
  render();
  if (state.email) {
    try {
      const d = await api.get('/api/emails');
      if ((d.emails || []).some((e) => e.email === state.email)) {
        state.verifiedEmail = true;
        state.step = 'package';
        renderForm();
        await refreshAccount();
      }
    } catch { /* offline */ }
  }
  refreshFirehose();
  refreshStatus();
  setInterval(refreshFirehose, 15_000);
  setInterval(refreshStatus, 30_000);
  setInterval(refreshAccount, 30_000);
}

// ---------- events ----------

let previewTimer = null;

$app.addEventListener('input', (e) => {
  if (e.target.id !== 'pkg') return;
  clearTimeout(previewTimer);
  const name = e.target.value.trim();
  if (!name) {
    state.pkgPreview = null;
    renderPkgPreview();
    return;
  }
  previewTimer = setTimeout(async () => {
    try {
      const d = await api.get(`/api/packages/${encodeURIComponent(name).replace('%40', '@')}`);
      state.pkgPreview = d;
    } catch (err) {
      state.pkgPreview = { name, error: err.status === 404 ? 'notfound' : 'invalid' };
    }
    renderPkgPreview();
  }, 550);
});

$app.addEventListener('click', async (e) => {
  const T = t();
  // theme toggle
  if (e.target.closest('#themeBtn')) {
    const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
    document.documentElement.dataset.theme = next;
    localStorage.setItem('pw-theme', next);
    render();
    return;
  }
  // language toggle
  if (e.target.closest('#langBtn')) {
    state.lang = state.lang === 'zh' ? 'en' : 'zh';
    localStorage.setItem('pw-lang', state.lang);
    render();
    return;
  }
  // resend code
  if (e.target.closest('#resendBtn')) {
    const btn = e.target.closest('#resendBtn');
    btn.disabled = true;
    try {
      await api.post('/api/verify/request', { email: state.codeSentTo });
      toast(T.codeSentTo.replace('{email}', state.codeSentTo));
    } catch {
      toast(T.errSendFailed, true);
    }
    setTimeout(() => { btn.disabled = false; }, 5000);
    return;
  }
  // unwatch
  const unwatchBtn = e.target.closest('[data-unwatch]');
  if (unwatchBtn) {
    const pkg = unwatchBtn.dataset.unwatch;
    try {
      await api.post('/api/unsubscribe', { email: state.email, package: pkg });
      await refreshAccount();
      refreshStatus();
    } catch {
      toast(T.errNetwork, true);
    }
  }
});

$app.addEventListener('submit', async (e) => {
  e.preventDefault();
  const T = t();
  const form = e.target;

  // step 1: request code
  if (form.querySelector('#sendBtn') && e.submitter?.id !== 'resendBtn') {
    const email = form.querySelector('#email')?.value.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      toast(T.errInvalidEmail, true);
      return;
    }
    state.busy = true;
    renderForm();
    try {
      await api.post('/api/verify/request', { email });
      state.email = email;
      state.codeSentTo = email;
      state.step = 'code';
      state.busy = false;
      renderForm();
      form.querySelector('#code')?.focus();
    } catch {
      state.busy = false;
      renderForm();
      toast(T.errSendFailed, true);
    }
    return;
  }

  // step 2: confirm code
  if (form.querySelector('#verifyBtn')) {
    const code = form.querySelector('#code')?.value.trim();
    if (!code || code.length !== 6) {
      toast(T.errBadCode, true);
      return;
    }
    state.busy = true;
    renderForm();
    try {
      await api.post('/api/verify/confirm', { email: state.email, code });
      localStorage.setItem('pw-email', state.email);
      state.verifiedEmail = true;
      state.step = 'package';
      state.busy = false;
      renderForm();
      await refreshAccount();
      refreshStatus();
    } catch (err) {
      state.busy = false;
      renderForm();
      const reason = err.body?.reason;
      toast(reason === 'too_many_attempts' ? T.errTooMany : T.errBadCode, true);
    }
    return;
  }

  // step 3: subscribe
  if (form.querySelector('#addBtn')) {
    const pkg = form.querySelector('#pkg')?.value.trim();
    if (!pkg) return;
    state.busy = true;
    renderForm();
    try {
      await api.post('/api/subscribe', { email: state.email, package: pkg });
      state.busy = false;
      state.pkgPreview = null;
      renderForm();
      await refreshAccount();
      refreshStatus();
      refreshFirehose();
    } catch (err) {
      state.busy = false;
      renderForm();
      const reason = err.body?.error;
      toast(
        reason === 'package not found' ? T.errPkgNotFound
        : reason === 'invalid package name' ? T.errInvalidPkg
        : reason === 'email not verified' ? T.errUnverified
        : T.errNetwork,
        true
      );
    }
  }
});

bootstrap();
