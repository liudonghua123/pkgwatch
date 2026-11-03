# pkgwatch

**Email notifications for npm package updates.** Watch any package, verify your email once, and get an email the moment a new version ships.

[中文文档](./README.zh-CN.md)

![theme](https://img.shields.io/badge/theme-dark%20%2F%20light-4a8ad6) ![i18n](https://img.shields.io/badge/i18n-en%20%2F%20zh--CN-5fc39c) ![stack](https://img.shields.io/badge/stack-node%2022%20%C2%B7%20vite%20%C2%B7%20sqlite-8a8c92)

## How it works

```
npm registry changes feed          pkgwatch server                you
─────────────────────────          ───────────────────────        ───────────
replicate.npmjs.com/registry/  →   poll every 20s, match      →   email
_changes?since=<seq>               watched packages, confirm      with the
                                     via registry.npmjs.org       version diff
```

- **Fast discovery** — polls the npm registry replication changes feed for new publishes.
- **Zero false positives** — every hit is confirmed against `registry.npmjs.org/<pkg>` before an email is sent.
- **Verified emails only** — a 6-digit code lands in your inbox; both subscribing **and** viewing your subscriptions require it. Verification issues a signed query token (HMAC, 30 days) that authorizes reads and unsubscribes for that mailbox.
- **Server-side dedup** — subscribing to the same package twice with the same email is a no-op; batch submissions with duplicates report how many were skipped.
- **Live firehose** — the UI shows the latest publishes straight from the feed, with your watched packages highlighted.

## Mail transport

Configured in `.env` (see `.env.example`). First match wins:

1. **Resend** (default) — set `RESEND_API_KEY`; `MAIL_FROM` needs a sender verified in your Resend account.
2. **SMTP** — set `SMTP_HOST` (plus `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS`); sent via nodemailer.
3. **Console** — neither set: codes and alerts are printed to stdout (dev mode).

## Quick start

Requires Node 22+ (uses the built-in `node:sqlite`).

```bash
npm install
npm run build     # build the frontend into dist/
npm start         # API + static frontend on http://localhost:8787
```

Open http://localhost:8787, enter your email, verify the 6-digit code, then add packages — type a name, press Enter or space to add it as a tag (with npm search suggestions), and submit the batch. Try `@cloudflare/vite-plugin`.

Copy `.env.example` to `.env` to enable real mail (Resend or SMTP).

| Env var | Default | Purpose |
| --- | --- | --- |
| `PORT` | `8787` | HTTP port |
| `PKGWATCH_DB` | `./data/pkgwatch.db` | SQLite file |
| `PKGWATCH_POLL_MS` | `20000` | Changes-feed poll interval |
| `RESEND_API_KEY` | — | Resend API key (default transport) |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` | — | SMTP transport (used when no Resend key) |
| `SMTP_SECURE` | auto (`true` on 465) | TLS |
| `MAIL_FROM` | `pkgwatch <onboarding@resend.dev>` | From address |

## API

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/packages/:name` | Look up a package's latest version |
| `GET` | `/api/search?q=` | npm search suggestions for the tag input |
| `POST` | `/api/verify/request` | `{email}` → send 6-digit code |
| `POST` | `/api/verify/confirm` | `{email, code}` → mark verified, returns query `token` |
| `GET` | `/api/verified/:email` | Is this email verified? |
| `POST` | `/api/subscribe` | `{email, packages: [...]}` batch, deduplicated (requires verified email) |
| `POST` | `/api/unsubscribe` | `{email, package, token}` (token required) |
| `GET` | `/api/subscriptions/:email` | Subscriptions + recent notifications (**requires** `Authorization: Bearer <token>`) |
| `GET` | `/api/firehose` | Recent publishes from the changes feed |
| `GET` | `/api/status` | Watcher status |

## UI

- **One-motif design**: the capsule shape of a tag chip is the motif everywhere — a giant capsule rising from the hero, capsule buttons and inputs, a full-bleed capsule band for the live feed, capsule bullets in the copy.
- **Single-form console**: enter your email, stack packages as tags (Enter / space adds a chip, Backspace removes the last one, npm search suggestions while typing), press one button. First submission verifies the email with a 6-digit code; verified addresses subscribe straight away.
- **Manage tab**: the form has two capsule tabs — **Add** watches packages, **Manage** lists what a mailbox already watches. Manage asks for the same email + 6-digit code proof (or reuses the still-valid token from a previous verification), then shows every subscription with a per-item unsubscribe button.
- **Close-ups board**: six enlarged UI fragments explain the product part by part ("Every part, up close.").
- **Mobile-first** responsive layout; the hero capsule drops below the copy on narrow screens.
- **Dark / light theme** toggle, follows system preference, persisted.
- **English / 中文** toggle, persisted.
- **Motion**: staggered rise-and-resolve entrances, chip pop-ins, a sheen sweep on the live feed, pulse on the live dot; `prefers-reduced-motion` renders everything static.

## Project layout

```
server/
  index.js    Express API + static serving
  db.js       node:sqlite — subscriptions, verifications, notifications
  mailer.js   nodemailer — verification + update emails (bilingual HTML)
  poller.js   changes-feed poller with seq pinning and backoff
src/          Vite + vanilla JS SPA (tag input, i18n, themes, motion)
```

## License

MIT
