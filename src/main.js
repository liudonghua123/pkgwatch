// pkgwatch — frontend app
import { makeT } from './i18n.js';
import './style.css';

// ---------- state ----------

const state = {
  lang: localStorage.getItem('pw-lang') || (navigator.language?.startsWith('zh') ? 'zh' : 'en'),
  step: 'email', // email | code | package
  email: localStorage.getItem('pw-email') || '',
  codeSentTo: '',
  tags: [], // package names staged in the tag input
  searchResults: [],
  searchOpen: false,
  subs: [],
  notifs: [],
  firehose: [],
  watched: [],
  mailMode: 'console',
  seq: null,
  busy: false,
  verifiedEmail: false,
};

const t = () => {
  const fn = makeT(state.lang);
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
  setTimeout(() => {
    el.classList.add('bye');
    setTimeout(() => el.remove(), 350);
  }, 3800);
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

const PKG_RE = /^(?:@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/;

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
  initMotion();
}

// ---------- tag input form ----------

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
        <p class="hint">${T.codeSentTo.replace('{email}', esc(state.codeSentTo))} · <button type="button" class="unwatch inline" id="resendBtn">${T.resend}</button></p>
      </div>`;
  } else {
    const n = state.tags.length;
    const btnLabel = n === 0 ? T.watchBtn : (n === 1 ? T.addPackage : T.addPackagePlural).replace('{n}', n);
    inner += `
      <div class="field">
        <label for="pkgInput">${T.step3Label} <span class="pill positive" style="margin-left:6px">✓ ${T.verifiedBadge} · ${esc(state.email)}</span></label><!-- taste-skill-ignore: status glyph -->
        <div class="tagbox" id="tagbox">
          ${state.tags.map((tag, i) => `
            <span class="tag mono" data-tag="${esc(tag)}">${esc(tag)}
              <button type="button" class="tag-x" data-tag-x="${i}" aria-label="remove ${esc(tag)}">×</button>
            </span>`).join('')}
          <input type="text" id="pkgInput" placeholder="${state.tags.length ? '' : T.pkgPlaceholder}" autocomplete="off" spellcheck="false" />
        </div>
        <p class="hint">${T.pkgHint}</p>
        <div class="search-pop" id="searchPop" hidden></div>
        <div class="row" style="margin-top:12px">
          <button class="btn primary" type="submit" id="addBtn" ${n === 0 ? 'disabled' : ''}>${state.busy ? T.adding : btnLabel}</button>
        </div>
      </div>`;
  }
  form.innerHTML = inner;
}

function renderSearchPop() {
  const pop = $app.querySelector('#searchPop');
  if (!pop) return;
  if (!state.searchOpen || state.searchResults.length === 0) {
    pop.hidden = true;
    return;
  }
  pop.hidden = false;
  pop.innerHTML = state.searchResults
    .map(
      (r) => `
      <button type="button" class="search-item" data-pick="${esc(r.name)}">
        <span class="mono si-name">${esc(r.name)}</span>
        <span class="si-ver mono">v${esc(r.version)}</span>
        <span class="si-desc">${esc(r.description.slice(0, 64))}${r.description.length > 64 ? '…' : ''}</span>
      </button>`
    )
    .join('');
}

function addTag(raw) {
  const name = raw.trim();
  if (!name || !PKG_RE.test(name)) return false;
  if (state.tags.includes(name)) return 'dup';
  if (state.tags.length >= 20) return false;
  state.tags.push(name);
  return true;
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
        <span class="version mono" title="latest ${esc(s.version || '')}">v${esc(s.version || '—')}</span>
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

// ---------- motion (design-to-motion, website context) ----------

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

function initMotion() {
  if (reducedMotion.matches) {
    $app.querySelectorAll('[data-m]').forEach((el) => el.classList.add('arrived'));
    return;
  }
  // stagger the shells in reading order
  const order = ['.hero', '.firehose', '#subscribeForm', '#subscribeForm + .card', '.cols > div:nth-child(2) .card', '.status-strip', 'footer .inner'];
  order.forEach((sel, i) => {
    const el = $app.querySelector(sel);
    if (!el) return;
    el.setAttribute('data-m', 'card');
    el.style.setProperty('--d', `${(i * 0.09).toFixed(2)}s`);
  });
  requestAnimationFrame(() => requestAnimationFrame(() => $app.classList.add('arrived')));

  // ticker chips pop in, staggered
  $app.querySelectorAll('.ticker .chip').forEach((chip, i) => {
    chip.style.setProperty('--d', `${Math.min(i * 0.05, 0.8).toFixed(2)}s`);
  });

  // sheen sweep across the firehose card
  const fire = $app.querySelector('.firehose');
  if (fire && !fire.querySelector('.sheen')) {
    const s = document.createElement('span');
    s.className = 'sheen';
    fire.appendChild(s);
  }
}

// animate rows that appear after a re-render (subscriptions, notifications, form steps)
function animateRows(containerSel) {
  if (reducedMotion.matches) return;
  const box = $app.querySelector(containerSel);
  if (!box) return;
  box.querySelectorAll('.sub-item, .notif, .empty, .field').forEach((row, i) => {
    row.setAttribute('data-m', 'up');
    row.style.setProperty('--d', `${Math.min(i * 0.06, 0.5).toFixed(2)}s`);
    requestAnimationFrame(() => requestAnimationFrame(() => row.classList.add('arrived')));
  });
}

// ---------- events ----------

let searchTimer = null;

$app.addEventListener('input', (e) => {
  // npm search suggestions while typing in the tag input
  if (e.target.id === 'pkgInput') {
    clearTimeout(searchTimer);
    const q = e.target.value.trim();
    if (q.length < 2) {
      state.searchOpen = false;
      renderSearchPop();
      return;
    }
    searchTimer = setTimeout(async () => {
      // the tag may have been added while the request was in flight
      const input = $app.querySelector('#pkgInput');
      if (!input || !input.value.trim()) {
        state.searchOpen = false;
        renderSearchPop();
        return;
      }
      try {
        const d = await api.get(`/api/search?q=${encodeURIComponent(q)}`);
        state.searchResults = (d.results || []).filter((r) => !state.tags.includes(r.name));
        state.searchOpen = state.searchResults.length > 0;
        renderSearchPop();
      } catch { /* offline */ }
    }, 220);
  }
});

$app.addEventListener('keydown', (e) => {
  if (e.target.id !== 'pkgInput') return;

  if (e.key === 'Enter' || e.key === ' ' || e.key === ',') {
    e.preventDefault();
    const val = e.target.value;
    if (!val.trim()) return;
    addTag(val);
    e.target.value = '';
    state.searchOpen = false;
    renderForm();
    $app.querySelector('#pkgInput')?.focus();
    return;
  }
  if (e.key === 'Backspace' && !e.target.value) {
    state.tags.pop();
    renderForm();
    $app.querySelector('#pkgInput')?.focus();
  }
  if (e.key === 'Escape') {
    state.searchOpen = false;
    renderSearchPop();
  }
});

$app.addEventListener('click', async (e) => {
  const T = t();
  // pick a search suggestion
  const pick = e.target.closest('[data-pick]');
  if (pick) {
    addTag(pick.dataset.pick);
    state.searchOpen = false;
    renderForm();
    $app.querySelector('#pkgInput')?.focus();
    return;
  }
  // close the search popover on outside click
  if (!e.target.closest('#tagbox') && !e.target.closest('#searchPop')) {
    if (state.searchOpen) {
      state.searchOpen = false;
      renderSearchPop();
    }
  }
  // remove a tag
  const tagX = e.target.closest('[data-tag-x]');
  if (tagX) {
    state.tags.splice(Number(tagX.dataset.tagX), 1);
    renderForm();
    $app.querySelector('#pkgInput')?.focus();
    return;
  }
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
  if (form.querySelector('#sendBtn')) {
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
      animateRows('#subscribeForm');
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

  // step 3: batch subscribe with server-side dedup
  if (form.querySelector('#addBtn')) {
    if (state.tags.length === 0) return;
    state.busy = true;
    renderForm();
    try {
      const d = await api.post('/api/subscribe', { email: state.email, packages: state.tags });
      state.busy = false;
      state.tags = [];
      renderForm();
      await refreshAccount();
      refreshStatus();
      refreshFirehose();
      if (d.duplicatesSkipped > 0) toast(T.dupesSkipped.replace('{n}', d.duplicatesSkipped));
    } catch (err) {
      state.busy = false;
      renderForm();
      const reason = err.body?.error;
      toast(
        reason === 'package not found' ? `${T.errPkgNotFound}: ${err.body?.package || ''}`
        : reason === 'invalid package name' ? `${T.errInvalidPkg}: ${err.body?.package || ''}`
        : reason === 'email not verified' ? T.errUnverified
        : T.errNetwork,
        true
      );
    }
  }
});

bootstrap();
