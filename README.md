# pkgwatch

**Email notifications for npm package updates.** Watch any package, verify your email once, and get an email the moment a new version ships.

> npm 包更新邮件通知。关注任意 npm 包，验证一次邮箱，新版本发布即刻邮件通知。

![screens](https://img.shields.io/badge/theme-dark%20%2F%20light-4a8ad6) ![i18n](https://img.shields.io/badge/i18n-en%20%2F%20zh--CN-5fc39c) ![stack](https://img.shields.io/badge/stack-node%2022%20%C2%B7%20vite%20%C2%B7%20sqlite-8a8c92)

## How it works

```
npm registry changes feed          pkgwatch server                you
─────────────────────────          ───────────────────────        ───────────
replicate.npmjs.com/registry/  →   poll every 20s, match      →   email
_changes?since=<seq>               watched packages, confirm      with the
                                   via registry.npmjs.org         version diff
```

- **Fast discovery** — polls the npm registry replication changes feed for new publishes.
- **Zero false positives** — every hit is confirmed against `registry.npmjs.org/<pkg>` before an email is sent.
- **Verified emails only** — a 6-digit code lands in your inbox; subscriptions require a verified address.
- **Live firehose** — the UI shows recent publishes straight from the feed, with your watched packages highlighted.

## Quick start

Requires Node 22+ (uses the built-in `node:sqlite`).

```bash
npm install
npm run build     # build the frontend into dist/
npm start         # API + static frontend on http://localhost:8787
```

Open http://localhost:8787, enter your email, verify the 6-digit code, add a package (try `@cloudflare/vite-plugin`).

Without SMTP settings, emails are logged to the console (`mail: console mode`). To send real mail:

```bash
SMTP_HOST=smtp.example.com \
SMTP_PORT=587 \
SMTP_USER=you@example.com \
SMTP_PASS=secret \
MAIL_FROM="pkgwatch <no-reply@example.com>" \
npm start
```

| Env var | Default | Purpose |
| --- | --- | --- |
| `PORT` | `8787` | HTTP port |
| `PKGWATCH_DB` | `./data/pkgwatch.db` | SQLite file |
| `PKGWATCH_POLL_MS` | `20000` | Changes-feed poll interval |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` | — | SMTP transport (omit for console mode) |
| `SMTP_SECURE` | auto (`true` on 465) | TLS |
| `MAIL_FROM` | `pkgwatch <no-reply@pkgwatch.dev>` | From address |

## API

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/packages/:name` | Look up a package's latest version |
| `POST` | `/api/verify/request` | `{email}` → send 6-digit code |
| `POST` | `/api/verify/confirm` | `{email, code}` → mark verified |
| `POST` | `/api/subscribe` | `{email, package}` (requires verified email) |
| `POST` | `/api/unsubscribe` | `{email, package}` |
| `GET` | `/api/subscriptions/:email` | Subscriptions + recent notifications |
| `GET` | `/api/firehose` | Recent publishes from the changes feed |
| `GET` | `/api/status` | Watcher status |

## Project layout

```
server/
  index.js    Express API + static serving
  db.js       node:sqlite — subscriptions, verifications, notifications
  mailer.js   nodemailer — verification + update emails (bilingual HTML)
  poller.js   changes-feed poller with seq pinning and backoff
src/          Vite + vanilla JS SPA (mobile-first, dark/light, en/zh)
```

## pkgwatch（中文说明）

**npm 包更新邮件通知器。** 关注任意 npm 包，验证一次邮箱，每当有新版本发布，第一时间收到邮件。

### 工作原理

- 服务端每 20 秒轮询 npm registry 的复制变更流（`replicate.npmjs.com/registry/_changes`），发现新发布的包；
- 每次命中都会先向 `registry.npmjs.org/<包名>` 复核最新版本，确认变化后才发邮件，零误报；
- 订阅前必须完成邮箱验证（6 位数字验证码，15 分钟有效）；
- 界面上的"发布实时流"直接来自变更流，你关注的包会高亮显示。

### 快速开始

需要 Node 22+（使用内置 `node:sqlite`，无需单独装数据库）。

```bash
npm install
npm run build    # 构建前端到 dist/
npm start        # API + 静态页面，监听 http://localhost:8787
```

打开 http://localhost:8787，输入邮箱 → 收验证码 → 添加包名（试试 `@cloudflare/vite-plugin`）。

未配置 SMTP 时邮件打印到控制台（"邮件：控制台模式"）。发真实邮件请设置环境变量：

```bash
SMTP_HOST=smtp.example.com SMTP_PORT=587 SMTP_USER=you@example.com SMTP_PASS=secret npm start
```

### 功能

- 📱 **移动端优先**的响应式设计，cool 的 data-terminal 风格界面
- 🌗 **深色 / 浅色主题**切换，跟随系统偏好
- 🌐 **中英双语**（i18n），一键切换
- ✉️ 验证码邮箱验证 + 双语 HTML 通知邮件（含版本对比与 npm 链接）
- 🔍 输入包名即显示最新版本与发布时间预览

### 设计说明

界面基于 data-terminal 设计方向：深色终端风格、数据使用等宽字体（JetBrains Mono）、 Public Sans 正文、单一强调色、1px 焦点线。包名与版本号是代码标识符，因此使用等宽字体是有意的设计决策。

## License

MIT
