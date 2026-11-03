// pkgwatch — frontend app (one-motif redesign)
import { makeT } from './i18n.js';
import './style.css';

// ---------- state ----------

const state = {
  lang: localStorage.getItem('pw-lang') || (navigator.language?.startsWith('zh') ? 'zh' : 'en'),
  email: localStorage.getItem('pw-email') || '',
  token: localStorage.getItem('pw-token') || '',
  verified: false,
  mode: 'add', // 'add' watches packages; 'manage' views/unwatches them
  codeSentTo: '',
  codeMode: false, // the console is showing the code step
  tags: [],
  searchResults: [],
  searchOpen: false,
  subs: [],
  notifs: [],
  firehose: [],
  firehoseExpanded: false, // show all publishes or just the top 10
  watched: [],
  mailMode: 'console',
  seq: null,
  busy: false,
};

const T = () => {
  const fn = makeT(state.lang);
  return new Proxy(fn, { get: (target, prop) => target(prop) });
};
const $app = document.getElementById('app');

const api = {
  async get(url, token) {
    const r = await fetch(url, token ? { headers: { authorization: `Bearer ${token}` } } : undefined);
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

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const PKG_RE = /^(?:@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

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

// ---------- icons ----------

const icon = {
  // the motif: a tag chip (stadium with a dot)
  chip: `<svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true"><rect x="1" y="7" width="28" height="16" rx="8" fill="var(--accent)"/><circle cx="10.5" cy="15" r="3.4" fill="var(--accent-ink)"/><circle cx="19.5" cy="15" r="3.4" fill="var(--accent-ink)"/></svg>`,
  sun: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5 5l1.6 1.6M17.4 17.4L19 19M19 5l-1.6 1.6M6.6 17.4L5 19"/></svg>`,
  moon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 13.5A8.5 8.5 0 0 1 10.5 4 7.5 7.5 0 1 0 20 13.5z"/></svg>`,
};

// ---------- skeleton ----------

function render() {
  const t = T();
  const dark = document.documentElement.dataset.theme !== 'light';
  document.title = state.lang === 'zh' ? 'pkgwatch — npm 更新邮件通知' : 'pkgwatch — npm update email notifier';
  $app.innerHTML = `
  <div class="bg-motifs" aria-hidden="true">
    <span class="bg-motif a"></span>
    <span class="bg-motif b"></span>
    <span class="bg-motif c"></span>
    <span class="bg-glow" id="bgGlow"></span>
  </div>
  <div class="shell">

    <header class="topbar">
      <a class="brand" href="/">${icon.chip}<span>pkgwatch</span></a>
      <nav class="topnav">
        <a href="#console">${t.navLive}</a>
        <a href="#how">${t.navHow}</a>
      </nav>
      <button class="iconbtn" id="langBtn" aria-label="${state.lang === 'zh' ? 'Switch to English' : '切换到中文'}">${t.langToggle}</button>
      <button class="iconbtn" id="themeBtn" aria-label="${dark ? t.themeLight : t.themeDark}">${dark ? icon.sun : icon.moon}</button>
    </header>

    <main>
      <!-- ============ HERO: the motif at enormous scale ============ -->
      <section class="hero" id="top">
        <div class="hero-motif" aria-hidden="true">
          <span class="motif-chip" data-ui>
            <span class="mc-dot"></span><span class="mc-text"><code>@cloudflare/vite-plugin</code></span>
          </span>
        </div>
        <div class="hero-copy">
          <h1>${t.heroTitle}</h1>
          <p class="sub">${t.heroSub}</p>
        </div>
        <a class="btn primary hero-cta" href="#console">${t.consoleTitle}</a>
      </section>

      <!-- ============ FIREHOSE band: the motif at full width ============ -->
      <section class="firehose" id="live" aria-label="${t.liveNow}">
        <div class="fh-head">
          <span class="dot" aria-hidden="true"></span>
          <h2>${t.liveNow}</h2>
          <p>${t.liveSub}</p>
        </div>
        <div class="ticker" id="ticker" data-ui></div>
        <button type="button" class="fh-more" id="fhMore" hidden></button>
      </section>

      <!-- ============ CONSOLE: the live thing ============ -->
      <section class="console-zone" id="console">
        <form class="console" id="subscribeForm" data-ui novalidate>
          <h2 class="console-title">${t.consoleTitle}</h2>
          <div class="mode-tabs" role="tablist" data-ui>
            <button type="button" class="mode-tab ${state.mode === 'add' ? 'on' : ''}" data-mode="add" role="tab" aria-selected="${state.mode === 'add'}">${t.tabAdd}</button>
            <button type="button" class="mode-tab ${state.mode === 'manage' ? 'on' : ''}" data-mode="manage" role="tab" aria-selected="${state.mode === 'manage'}">${t.tabManage}</button>
          </div>
          <div class="c-field" data-m="up">
            <label for="email">${state.mode === 'manage' ? t.emailLabelManage : t.emailLabel}</label>
            <input type="email" id="email" name="email" placeholder="${t.emailPlaceholder}" autocomplete="email" value="${esc(state.mode === 'manage' ? '' : state.email)}" />
          </div>
          <div class="c-field code-field" data-m="up" ${state.codeMode ? '' : 'hidden'}>
            <label for="code">${t.codeLabel}</label>
            <div class="code-row">
              <input type="text" id="code" name="code" placeholder="${t.codePlaceholder}" inputmode="numeric" maxlength="6" autocomplete="one-time-code" />
              <button type="button" class="linklike" id="resendBtn">${t.resend}</button>
            </div>
            <p class="hint" id="codeHint">${t.codeSentTo.replace('{email}', esc(state.codeSentTo))}</p>
          </div>
          ${state.mode === 'add' ? `
          <div class="c-field" data-m="up">
            <label for="pkgInput">${t.pkgLabel}</label>
            <div class="tagbox" id="tagbox">
              ${state.tags.map((tag, i) => `
                <span class="tag" data-tag="${esc(tag)}">${esc(tag)}
                  <button type="button" class="tag-x" data-tag-x="${i}" aria-label="remove ${esc(tag)}">×</button>
                </span>`).join('')}
              <input type="text" id="pkgInput" placeholder="${state.tags.length ? '' : t.pkgPlaceholder}" autocomplete="off" spellcheck="false" aria-describedby="pkgHint" />
            </div>
            <p class="hint" id="pkgHint">${t.pkgHint}</p>
          </div>
          <div class="search-pop" id="searchPop" hidden></div>
          <button class="btn primary c-submit" id="addBtn" type="submit">${t.watchBtnEmpty}</button>
          ` : `
          <p class="manage-hint">${t.manageHint}</p>
          <button class="btn primary c-submit" id="manageBtn" type="submit">${t.manageBtn}</button>
          `}
        </form>

        <div class="panel">
          <div class="panel-half">
            <h3>${t.subsTitle}</h3>
            <span class="count" id="subsCount"></span>
            <div class="sub-list" id="subList"></div>
          </div>
          <div class="panel-half">
            <h3>${t.notifTitle}</h3>
            <div class="notif-list" id="notifList"></div>
          </div>
        </div>
      </section>

      <!-- ============ CLOSE-UPS BOARD ============ -->
      <section class="board-zone">
        <div class="board" aria-label="${t.boardTitle}">
          <div class="tile t-head" data-m="card">
            <h2>${t.boardTitle}</h2>
          </div>
          <div class="tile t-tag" data-m="card" data-ui>
            <div class="zoom" aria-hidden="true">
              <span class="tag demo"><code>react</code><span class="tag-x" aria-hidden="true">×</span></span>
              <span class="tag demo"><code>vite</code></span>
            </div>
            <div class="t-cap"><h3>${t.boardTag}</h3><p>${t.boardTagBody}</p></div>
          </div>
          <div class="tile t-verify" data-m="card" data-ui>
            <div class="zoom" aria-hidden="true"><span class="code-caps"><code>4</code><code>8</code><code>2</code><code>9</code><code>1</code><code>7</code></span></div>
            <div class="t-cap"><h3>${t.boardVerify}</h3><p>${t.boardVerifyBody}</p></div>
          </div>
          <div class="tile t-alert" data-m="card" data-ui>
            <div class="zoom" aria-hidden="true">
              <div class="mail-demo"><span class="mail-line"><code>vite → 5.4.11</code></span></div>
            </div>
            <div class="t-cap"><h3>${t.boardAlert}</h3><p>${t.boardAlertBody}</p></div>
          </div>
          <div class="tile t-batch" data-m="card" data-ui>
            <div class="zoom" aria-hidden="true"><span class="tag demo"><code>esbuild</code></span><span class="tag demo"><code>rollup</code></span><span class="tag demo"><code>+18</code></span></div>
            <div class="t-cap"><h3>${t.boardBatch}</h3><p>${t.boardBatchBody}</p></div>
          </div>
          <div class="tile t-live" data-m="card" data-ui>
            <div class="zoom" aria-hidden="true"><span class="seq"><code>seq 141732352</code></span></div>
            <div class="t-cap"><h3>${t.boardLive}</h3><p>${t.boardLiveBody}</p></div>
          </div>
          <div class="tile t-mail" data-m="card" data-ui>
            <div class="zoom" aria-hidden="true">
              <div class="mail-demo"><span class="mail-line"><code>express@4.21.2</code></span></div>
            </div>
            <div class="t-cap"><h3>${t.boardMail}</h3><p>${t.boardMailBody}</p></div>
          </div>
        </div>
      </section>

      <!-- ============ HOW ============ -->
      <section class="how" id="how">
        <h2>${t.howTitle}</h2>
        <ol class="how-list">
          <li data-m="up">${t.how1}</li>
          <li data-m="up">${t.how2}</li>
          <li data-m="up">${t.how3}</li>
        </ol>
      </section>

      <div class="status-strip" id="statusStrip"></div>
    </main>

    <footer>
      <div class="inner">
        <p>${t.footerNote}</p>
        <div class="foot-row">
          <a href="https://github.com/liudonghua123/pkgwatch" rel="noopener">${t.footerSrc}</a>
          <span class="src">replicate.npmjs.com · registry.npmjs.org</span>
        </div>
      </div>
    </footer>
    <div class="toasts" aria-live="polite"></div>
  </div>`;

  renderTicker();
  renderSubs();
  renderNotifs();
  renderStatus();
  syncSubmitLabel();
  initMotion();
  initParallax();
}

// ---------- console form helpers ----------

function submitLabel(t) {
  if (state.mode === 'manage') {
    if (state.busy) return t.manageBusy;
    if (state.codeMode) return t.verify;
    return t.manageBtn;
  }
  if (state.busy) return state.codeMode ? t.verifying : t.adding;
  if (state.codeMode) return t.verify;
  const n = state.tags.length;
  if (n === 0) return t.watchBtnEmpty;
  const key = n === 1 ? 'watchBtnOne' : 'watchBtnPlural';
  return t[key].replace('{n}', n);
}

function syncSubmitLabel() {
  const label = submitLabel(T());
  for (const btn of $app.querySelectorAll('#addBtn, #manageBtn')) {
    btn.textContent = label;
  }
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
        <span class="si-name">${esc(r.name)}</span>
        <span class="si-ver">v${esc(r.version)}</span>
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

// re-render just the tagbox (keeps the email input untouched)
function renderTagbox() {
  const box = $app.querySelector('#tagbox');
  if (!box) return;
  const t = T();
  box.innerHTML = `
    ${state.tags.map((tag, i) => `
      <span class="tag" data-tag="${esc(tag)}"><code>${esc(tag)}</code>
        <button type="button" class="tag-x" data-tag-x="${i}" aria-label="remove ${esc(tag)}">×</button>
      </span>`).join('')}
    <input type="text" id="pkgInput" placeholder="${state.tags.length ? '' : t.pkgPlaceholder}" autocomplete="off" spellcheck="false" aria-describedby="pkgHint" />`;
  syncSubmitLabel();
}

// ---------- ticker / lists ----------

const FIREHOSE_TOP = 10; // collapsed view: latest 10 publishes

function renderTicker() {
  const el = $app.querySelector('#ticker');
  if (!el) return;
  const latest = state.firehose.slice(-40).reverse();
  const names = state.firehoseExpanded ? latest : latest.slice(0, FIREHOSE_TOP);
  const moreBtn = $app.querySelector('#fhMore');
  if (moreBtn) {
    if (latest.length > FIREHOSE_TOP) {
      moreBtn.hidden = false;
      const t = T();
      moreBtn.textContent = state.firehoseExpanded ? t.showLess : t.showAll.replace('{n}', latest.length);
      moreBtn.setAttribute('aria-expanded', String(state.firehoseExpanded));
    } else {
      moreBtn.hidden = true;
    }
  }
  if (names.length === 0) {
    el.innerHTML = `<span class="chip" style="opacity:.5">…</span>`;
    return;
  }
  el.innerHTML = names
    .map((n) => `<span class="chip${state.watched.includes(n) || state.subs.some((s) => s.package === n) ? ' watched' : ''}"><code>${esc(n)}</code></span>`)
    .join('');
}

function renderSubs() {
  const el = $app.querySelector('#subList');
  if (!el) return;
  const t = T();
  const count = $app.querySelector('#subsCount');
  if (count) {
    count.textContent =
      state.email && state.verified
        ? (state.subs.length === 1 ? t.subsCount : t.subsCountPlural).replace('{n}', state.subs.length).replace('{email}', state.email)
        : '';
  }
  if (!state.email || !state.verified || state.subs.length === 0) {
    el.innerHTML = `
      <div class="empty">
        <div class="big">${t.emptySubsTitle}</div>
        ${t.emptySubsBody.replace('{example}', '<code>@cloudflare/vite-plugin</code>')}
      </div>`;
    return;
  }
  el.innerHTML = state.subs
    .map(
      (s) => `
      <div class="sub-item">
        <div class="si-main">
          <div class="pkg"><code>${esc(s.package)}</code></div>
          <div class="meta">${t.watchedSince.replace('{ago}', (s.created_at || '').slice(0, 10))}</div>
        </div>
        <span class="version" title="latest ${esc(s.version || '')}">v${esc(s.version || '—')}</span>
        <button class="unwatch" data-unwatch="${esc(s.package)}">${t.unwatch}</button>
      </div>`
    )
    .join('');
}

function renderNotifs() {
  const el = $app.querySelector('#notifList');
  if (!el) return;
  const t = T();
  if (state.notifs.length === 0) {
    el.innerHTML = `<div class="empty">${t.notifEmpty}</div>`;
    return;
  }
  el.innerHTML = state.notifs
    .map(
      (n) => `
      <div class="notif">
        <span class="pkg"><code>${esc(n.package)}</code></span>
        <span class="from"><code>v${esc(n.from_version || '—')}</code></span>
        <span class="arrow" aria-hidden="true">→</span>
        <span class="to"><code>v${esc(n.to_version)}</code></span>
        <span class="when">${ago(Date.parse(n.sent_at), state.lang)}</span>
      </div>`
    )
    .join('');
}

function renderStatus() {
  const el = $app.querySelector('#statusStrip');
  if (!el) return;
  const t = T();
  const seq = state.seq != null ? t.statusRunning.replace('{seq}', state.seq) : '…';
  el.innerHTML = `
    <span><span class="k">${t.statusTitle}</span> ${seq}</span>
    <span>${t.statusWatched.replace('{n}', state.watched.length)}</span>
    <span>${state.mailMode === 'console' ? t.statusMailConsole : t.statusMailSmtp}</span>`;
}

// ---------- data refresh ----------

async function refreshFirehose() {
  try {
    const d = await api.get('/api/firehose');
    const prevFirst = state.firehose[0];
    state.firehose = d.publishes.map((p) => p.id);
    renderTicker();
    if (prevFirst && state.firehose[0] !== prevFirst) animateNewChips();
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
    const d = await api.get(`/api/subscriptions/${encodeURIComponent(state.email)}`, state.token);
    state.verified = d.verified;
    state.subs = d.subscriptions || [];
    state.notifs = d.notifications || [];
    renderSubs();
    renderNotifs();
  } catch (err) {
    if (err?.status === 401) {
      // token missing/expired: the mailbox must be re-verified to view it
      state.verified = false;
      state.token = '';
      localStorage.removeItem('pw-token');
      renderSubs();
      renderNotifs();
    }
    /* offline or unauthorized */
  }
}

async function bootstrap() {
  render();
  if (state.email) {
    try {
      const d = await api.get(`/api/verified/${encodeURIComponent(state.email)}`);
      state.verified = !!d.verified;
      if (state.verified && state.token) await refreshAccount();
    } catch { /* offline */ }
  }
  refreshFirehose();
  refreshStatus();
  setInterval(refreshFirehose, 15_000);
  setInterval(refreshStatus, 30_000);
  setInterval(refreshAccount, 30_000);
}

// ---------- motion ----------

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

let scrollObserver = null;

function initMotion() {
  $app.querySelectorAll('[data-m]').forEach((el, i) => {
    if (!el.style.getPropertyValue('--d')) el.style.setProperty('--d', `${(i % 6 * 0.07).toFixed(2)}s`);
  });
  // ticker chips pop in, staggered
  $app.querySelectorAll('.ticker .chip').forEach((chip, i) => {
    chip.style.setProperty('--d', `${Math.min(i * 0.04, 0.7).toFixed(2)}s`);
  });
  if (reducedMotion.matches || !('IntersectionObserver' in window)) {
    $app.querySelectorAll('[data-m]').forEach((el) => el.classList.add('arrived'));
    return;
  }
  // scroll-driven entrances: each element arrives when it enters the viewport
  scrollObserver?.disconnect();
  scrollObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('arrived');
          scrollObserver.unobserve(entry.target);
        }
      }
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.08 }
  );
  $app.querySelectorAll('[data-m]').forEach((el) => scrollObserver.observe(el));
}

// a fresh publish lands on the ticker: the leading chips re-enter
function animateNewChips() {
  if (reducedMotion.matches) return;
  const chips = $app.querySelectorAll('.ticker .chip');
  chips.forEach((chip, i) => {
    if (i > 5) return;
    chip.classList.remove('enter');
    void chip.offsetWidth; // restart the animation
    chip.classList.add('enter');
  });
}

// stagger rows that appear after a re-render
function animateRows(containerSel, rowSel) {
  if (reducedMotion.matches) return;
  const box = $app.querySelector(containerSel);
  if (!box) return;
  box.querySelectorAll(rowSel).forEach((row, i) => {
    row.classList.add('enter');
    row.style.setProperty('--d', `${Math.min(i * 0.06, 0.5).toFixed(2)}s`);
  });
}

// hero parallax: the giant capsule drifts as the page scrolls
function initParallax() {
  const chip = $app.querySelector('.hero-motif .motif-chip');
  if (reducedMotion.matches) return;
  const glow = $app.querySelector('#bgGlow');
  let ticking = false;
  window.addEventListener(
    'scroll',
    () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = Math.min(window.scrollY, 900);
        if (chip) chip.style.transform = `rotate(-8deg) translateY(${(-y * 0.08).toFixed(1)}px) translateZ(0)`;
        // the background glow follows the reading position
        const max = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
        const p = Math.min(window.scrollY / max, 1);
        if (glow) glow.style.top = `${20 + p * 130}vh`;
        ticking = false;
      });
    },
    { passive: true }
  );
}

// ---------- events ----------

let searchTimer = null;

$app.addEventListener('input', (e) => {
  if (e.target.id !== 'pkgInput') return;
  clearTimeout(searchTimer);
  const q = e.target.value.trim();
  if (q.length < 2) {
    state.searchOpen = false;
    renderSearchPop();
    return;
  }
  searchTimer = setTimeout(async () => {
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
});

$app.addEventListener('keydown', (e) => {
  if (e.target.id !== 'pkgInput') return;
  if (e.key === 'Enter' || e.key === ' ' || e.key === ',') {
    e.preventDefault();
    const val = e.target.value;
    if (!val.trim()) return;
    const res = addTag(val);
    e.target.value = '';
    state.searchOpen = false;
    renderSearchPop();
    renderTagbox();
    $app.querySelector('#pkgInput')?.focus();
    if (res !== true) toast(T().errInvalidPkg, true);
    return;
  }
  if (e.key === 'Backspace' && !e.target.value) {
    state.tags.pop();
    renderTagbox();
    $app.querySelector('#pkgInput')?.focus();
  }
  if (e.key === 'Escape') {
    state.searchOpen = false;
    renderSearchPop();
  }
});

$app.addEventListener('click', async (e) => {
  const t = T();
  const pick = e.target.closest('[data-pick]');
  if (pick) {
    addTag(pick.dataset.pick);
    state.searchOpen = false;
    renderSearchPop();
    renderTagbox();
    $app.querySelector('#pkgInput')?.focus();
    return;
  }
  if (!e.target.closest('#tagbox') && !e.target.closest('#searchPop') && state.searchOpen) {
    state.searchOpen = false;
    renderSearchPop();
  }
  const tagX = e.target.closest('[data-tag-x]');
  if (tagX && !tagX.classList.contains('demo')) {
    state.tags.splice(Number(tagX.dataset.tagX), 1);
    renderTagbox();
    $app.querySelector('#pkgInput')?.focus();
    return;
  }
  const modeTab = e.target.closest('[data-mode]');
  if (modeTab) {
    const next = modeTab.dataset.mode;
    if (next !== state.mode) {
      state.mode = next;
      state.codeMode = false;
      state.codeSentTo = '';
      render();
      $app.querySelector('#email')?.focus();
    }
    return;
  }
  const unwatchBtn = e.target.closest('[data-unwatch]');
  if (unwatchBtn) {
    if (!state.token) return toast(t.errUnverified, true);
    unwatchBtn.disabled = true;
    try {
      await api.post('/api/unsubscribe', { email: state.email, package: unwatchBtn.dataset.unwatch, token: state.token });
      await refreshAccount();
    } catch (err) {
      unwatchBtn.disabled = false;
      if (err?.status === 401) {
        state.token = '';
        localStorage.removeItem('pw-token');
        toast(t.errUnverified, true);
      } else {
        toast(t.errNetwork, true);
      }
    }
    return;
  }
  if (e.target.closest('#fhMore')) {
    state.firehoseExpanded = !state.firehoseExpanded;
    renderTicker();
    $app.querySelectorAll('.ticker .chip').forEach((chip, i) => {
      chip.style.setProperty('--d', `${Math.min(i * 0.04, 0.7).toFixed(2)}s`);
    });
    return;
  }
  if (e.target.closest('#themeBtn')) {
    const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
    document.documentElement.dataset.theme = next;
    localStorage.setItem('pw-theme', next);
    render();
    return;
  }
  if (e.target.closest('#langBtn')) {
    state.lang = state.lang === 'zh' ? 'en' : 'zh';
    localStorage.setItem('pw-lang', state.lang);
    render();
    return;
  }
  if (e.target.closest('#resendBtn')) {
    const btn = e.target.closest('#resendBtn');
    btn.disabled = true;
    try {
      await api.post('/api/verify/request', { email: state.codeSentTo });
      toast(t.codeSentTo.replace('{email}', state.codeSentTo));
    } catch {
      toast(t.errSendFailed, true);
    }
    setTimeout(() => { btn.disabled = false; }, 5000);
  }
});

$app.addEventListener('submit', async (e) => {
  e.preventDefault();
  const t = T();
  const form = e.target;
  if (form.id !== 'subscribeForm') return;
  const emailInput = form.querySelector('#email');
  const codeInput = form.querySelector('#code');

  // phase 2: confirm the code
  if (state.codeMode) {
    const code = codeInput?.value.trim();
    if (!code || code.length !== 6) return toast(t.errBadCode, true);
    state.busy = true;
    syncSubmitLabel();
    try {
      const d = await api.post('/api/verify/confirm', { email: state.email, code });
      localStorage.setItem('pw-email', state.email);
      if (d.token) {
        state.token = d.token;
        localStorage.setItem('pw-token', d.token);
      }
      state.verified = true;
      state.codeMode = false;
      const field = form.querySelector('.code-field');
      if (field) field.hidden = true;
      syncSubmitLabel();
      refreshStatus();
      toast(`${t.verifiedBadge} · ${state.email}`);
      if (state.mode === 'manage') {
        // the point of manage mode: show this mailbox's subscriptions
        await refreshAccount();
        state.busy = false;
        syncSubmitLabel();
        return;
      }
      await refreshAccount();
      // the pending tags from the verification submit can now be subscribed
      if (state.tags.length > 0 && state.verified) {
        try {
          await api.post('/api/subscribe', { email: state.email, packages: state.tags });
          state.tags = [];
          renderTagbox();
          await refreshAccount();
          refreshStatus();
          refreshFirehose();
        } catch { /* the user can resubmit */ }
      }
    } catch (err) {
      const reason = err.body?.reason;
      toast(reason === 'too_many_attempts' ? t.errTooMany : t.errBadCode, true);
    }
    state.busy = false;
    syncSubmitLabel();
    return;
  }

  // manage mode phase 1: verify the mailbox, then show its subscriptions
  if (state.mode === 'manage') {
    const email = emailInput?.value.trim().toLowerCase();
    if (!email || !EMAIL_RE.test(email)) return toast(t.errInvalidEmail, true);
    // already holding a token for this mailbox? read straight away
    if (state.token && email === state.email) {
      state.email = email;
      state.verified = true;
      await refreshAccount();
      return;
    }
    state.busy = true;
    syncSubmitLabel();
    try {
      await api.post('/api/verify/request', { email });
      state.email = email;
      state.codeSentTo = email;
      state.codeMode = true;
      state.busy = false;
      const field = form.querySelector('.code-field');
      if (field) {
        field.hidden = false;
        const hint = field.querySelector('#codeHint');
        if (hint) hint.textContent = t.codeSentTo.replace('{email}', email);
      }
      syncSubmitLabel();
      animateRows('#subscribeForm', '.code-field');
      form.querySelector('#code')?.focus();
    } catch {
      state.busy = false;
      syncSubmitLabel();
      toast(t.errSendFailed, true);
    }
    return;
  }

  // phase 1 (add mode): validate, then either send a code or subscribe directly
  const email = emailInput?.value.trim().toLowerCase();
  if (!email || !EMAIL_RE.test(email)) return toast(t.errInvalidEmail, true);
  if (state.tags.length === 0) return toast(t.errInvalidPkg, true);

  // already verified with this address -> subscribe straight away
  if (state.verified && email === state.email) {
    state.busy = true;
    syncSubmitLabel();
    try {
      const d = await api.post('/api/subscribe', { email: state.email, packages: state.tags });
      state.busy = false;
      state.tags = [];
      renderTagbox();
      await refreshAccount();
      refreshStatus();
      refreshFirehose();
      if (d.duplicatesSkipped > 0) toast(t.dupesSkipped.replace('{n}', d.duplicatesSkipped));
      else toast(t.subscribed.replace('{n}', d.added.length));
    } catch (err) {
      state.busy = false;
      syncSubmitLabel();
      const reason = err.body?.error;
      toast(
        reason === 'package not found' ? `${t.errPkgNotFound}: ${err.body?.package || ''}`
        : reason === 'invalid package name' ? `${t.errInvalidPkg}: ${err.body?.package || ''}`
        : reason === 'email not verified' ? t.errUnverified
        : t.errNetwork,
        true
      );
    }
    return;
  }

  // verified before, but this browser has no query token for the address:
  // a code is needed again to bind the mailbox to this session
  if (email === state.email && state.verified && !state.token) {
    // fall through to the code flow below (tokens are only issued there)
  }

  // not verified: stash the tags, send a code
  state.busy = true;
  syncSubmitLabel();
  try {
    await api.post('/api/verify/request', { email });
    state.email = email;
    state.codeSentTo = email;
    state.codeMode = true;
    state.busy = false;
    const field = form.querySelector('.code-field');
    if (field) {
      field.hidden = false;
      const hint = field.querySelector('#codeHint');
      if (hint) hint.textContent = t.codeSentTo.replace('{email}', email);
    }
    syncSubmitLabel();
    animateRows('#subscribeForm', '.code-field');
    form.querySelector('#code')?.focus();
  } catch {
    state.busy = false;
    syncSubmitLabel();
    toast(t.errSendFailed, true);
  }
});

bootstrap();
