# pkgwatch

**npm 包更新邮件通知器。** 关注任意 npm 包，验证一次邮箱，每当有新版本发布，第一时间收到邮件。

[English](./README.md)

![theme](https://img.shields.io/badge/theme-dark%20%2F%20light-4a8ad6) ![i18n](https://img.shields.io/badge/i18n-en%20%2F%20zh--CN-5fc39c) ![stack](https://img.shields.io/badge/stack-node%2022%20%C2%B7%20vite%20%C2%B7%20sqlite-8a8c92)

## 工作原理

```
npm registry 变更流                pkgwatch 服务端                你
─────────────────────              ──────────────────────        ──────────
replicate.npmjs.com/registry/  →   每 20 秒轮询，匹配被关注的  →   带版本
_changes?since=<seq>               包，经 registry.npmjs.org       对比的
                                     复核确认                       邮件
```

- **发现快** —— 轮询 npm registry 复制变更流，捕获新发布的包。
- **零误报** —— 每次命中都先向 `registry.npmjs.org/<包名>` 复核最新版本，确认变化后才发邮件。
- **仅限验证邮箱** —— 先收 6 位验证码完成验证；**添加订阅和查询订阅都需要**。验证通过会签发一个带签名的查询 token（HMAC，30 天有效），用于读取订阅和取消关注。
- **服务端去重** —— 相同邮箱重复订阅同一个包会被自动去重；批量提交中若有重复，会返回跳过的数量。
- **发布实时流** —— 界面直接展示变更流里最近的发布记录，你关注的包会高亮。

## 邮件通道

在 `.env` 中配置（参考 `.env.example`），按顺序生效：

1. **Resend**（默认）—— 设置 `RESEND_API_KEY`；`MAIL_FROM` 需为 Resend 账号内已验证的发件人。
2. **SMTP** —— 设置 `SMTP_HOST`（及 `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS`），走 nodemailer 发送。
3. **控制台** —— 都未设置时，验证码与通知打印到 stdout（开发模式）。

## 快速开始

需要 Node 22+（使用内置 `node:sqlite`，无需单独装数据库）。

```bash
npm install
npm run build    # 构建前端到 dist/
npm start        # API + 静态页面，监听 http://localhost:8787
```

打开 http://localhost:8787，输入邮箱 → 收验证码 → 添加包：输入包名，回车或空格添加为标签（自带 npm 搜索建议），批量提交。试试 `@cloudflare/vite-plugin`。

把 `.env.example` 复制为 `.env` 即可启用真实邮件（Resend 或 SMTP）。

| 环境变量 | 默认值 | 说明 |
| --- | --- | --- |
| `PORT` | `8787` | HTTP 端口 |
| `PKGWATCH_DB` | `./data/pkgwatch.db` | SQLite 文件路径 |
| `PKGWATCH_POLL_MS` | `20000` | 变更流轮询间隔（毫秒） |
| `RESEND_API_KEY` | — | Resend API 密钥（默认通道） |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` | — | SMTP 发信（无 Resend 密钥时使用） |
| `SMTP_SECURE` | 自动（465 端口为 `true`） | TLS |
| `MAIL_FROM` | `pkgwatch <onboarding@resend.dev>` | 发件人 |

## API

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/packages/:name` | 查询包的最新版本 |
| `GET` | `/api/search?q=` | npm 搜索建议（tag 输入用） |
| `POST` | `/api/verify/request` | `{email}` → 发送 6 位验证码 |
| `POST` | `/api/verify/confirm` | `{email, code}` → 完成验证，返回查询 `token` |
| `GET` | `/api/verified/:email` | 该邮箱是否已验证 |
| `POST` | `/api/subscribe` | `{email, packages: [...]}` 批量订阅，自动去重（需已验证邮箱） |
| `POST` | `/api/unsubscribe` | `{email, package, token}` 取消关注（需 token） |
| `GET` | `/api/subscriptions/:email` | 订阅列表 + 最近通知（**需** `Authorization: Bearer <token>`） |
| `GET` | `/api/firehose` | 变更流最近发布 |
| `GET` | `/api/status` | 监听器状态 |

## 界面

- **单一母题设计**：tag 芯片的胶囊形贯穿全页——hero 巨型胶囊、胶囊按钮与输入框、实时流满幅胶囊色带、文案里的胶囊圆点。
- **单表单控制台**：填邮箱、把包名堆成标签（回车 / 空格添加，退格删除，输入时实时 npm 搜索建议），一个按钮完成。首次提交先验证邮箱（6 位验证码）；已验证地址直接订阅。
- **Manage 标签页**：表单有两个胶囊 tab——**Add** 关注新包，**Manage** 查询某邮箱已关注的订阅。Manage 同样要求邮箱 + 6 位验证码校验（或复用上次验证签发的仍在有效期内的 token），验证后列出该邮箱全部订阅，每项可单独取消关注。
- **放大细节板**：六块放大的界面片段逐部分讲解产品（"每个细节，放大看。"）。
- **移动端优先**的响应式设计；窄屏下 hero 胶囊自动沉到文案下方。
- **深色 / 浅色主题**切换，跟随系统偏好，本地持久化。
- **中 / 英双语**切换，本地持久化。
- **动效**：交错入场（上浮 + 模糊到清晰）、chip 弹入、实时流光泽扫过、live 呼吸点；`prefers-reduced-motion` 下全部静态呈现。

## 项目结构

```
server/
  index.js    Express API + 静态服务
  db.js       node:sqlite —— 订阅、邮箱验证、通知记录
  mailer.js   nodemailer —— 验证码与更新邮件（双语 HTML）
  poller.js   变更流轮询器（seq 锚定 + 退避）
src/          Vite + 原生 JS SPA（tag 输入、i18n、主题、动效）
```

## 许可

MIT
