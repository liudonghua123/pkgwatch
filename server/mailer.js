// pkgwatch — mail transport (nodemailer, SMTP optional)
'use strict';
const nodemailer = require('nodemailer');

// Without SMTP env vars the transport logs to console (dev mode).
const smtp = process.env.SMTP_HOST
  ? {
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true' || Number(process.env.SMTP_PORT) === 465,
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    }
  : null;

const transporter = nodemailer.createTransport(smtp || { jsonTransport: true });

const FROM = process.env.MAIL_FROM || 'pkgwatch <no-reply@pkgwatch.dev>';
const isConsoleMode = !smtp;

function send(to, subject, html, text) {
  if (isConsoleMode) {
    console.log(`[mail:console] to=${to} subject="${subject}"`);
    return transporter.sendMail({ from: FROM, to, subject, html, text }).then((info) => info);
  }
  return transporter.sendMail({ from: FROM, to, subject, html, text });
}

function verificationEmail(code, ttlMinutes) {
  const t = (zh) => zh; // emails are bilingual by design
  const subject = t('pkgwatch 邮箱验证码 / Your verification code');
  const text = [
    `验证码 / Code: ${code}`,
    `${ttlMinutes} 分钟内有效 / valid for ${ttlMinutes} minutes`,
    `如果不是你本人操作，请忽略此邮件 / If you did not request this, ignore this email.`,
  ].join('\n');
  const html = `<!doctype html><html><body style="margin:0;padding:32px;background:#171719;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
  <div style="max-width:420px;margin:0 auto;background:#212023;border-radius:12px;padding:32px;color:#fff">
    <div style="font-size:13px;letter-spacing:.12em;color:#8a8c92;font-weight:600">PKGWATCH</div>
    <h1 style="font-size:20px;margin:16px 0 8px">邮箱验证 / Verify your email</h1>
    <p style="font-size:14px;color:#8a8c92;margin:0 0 24px">使用以下验证码完成订阅 / Use this code to finish subscribing:</p>
    <div style="font-size:34px;font-weight:700;letter-spacing:.28em;font-variant-numeric:tabular-nums;background:#171719;border-radius:8px;padding:18px;text-align:center">${code}</div>
    <p style="font-size:12px;color:#8a8c92;margin:24px 0 0">${ttlMinutes} 分钟内有效 / valid for ${ttlMinutes} minutes. 如果不是你本人操作，请忽略 / If you didn't request this, just ignore it.</p>
  </div></body></html>`;
  return { subject, html, text };
}

function updateEmail(pkg, fromVersion, toVersion) {
  const subject = `↗ ${pkg}@${toVersion} 已发布 / published`;
  const text = [
    `${pkg} 有新版本 / new version available`,
    `  ${fromVersion || '—'}  →  ${toVersion}`,
    ``,
    `npm: https://www.npmjs.com/package/${pkg}`,
    `diff: https://diff.intrinsic.com/${pkg}/${fromVersion || '0.0.0'}/${toVersion}`,
    ``,
    `— pkgwatch`,
  ].join('\n');
  const html = `<!doctype html><html><body style="margin:0;padding:32px;background:#171719;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
  <div style="max-width:420px;margin:0 auto;background:#212023;border-radius:12px;padding:32px;color:#fff">
    <div style="font-size:13px;letter-spacing:.12em;color:#8a8c92;font-weight:600">PKGWATCH</div>
    <h1 style="font-size:20px;margin:16px 0 8px;font-family:ui-monospace,Menlo,Consolas,monospace">${pkg}</h1>
    <p style="font-size:14px;color:#8a8c92;margin:0 0 20px">新版本发布 / new version published:</p>
    <div style="display:flex;align-items:center;gap:12px;background:#171719;border-radius:8px;padding:18px;font-family:ui-monospace,Menlo,Consolas,monospace">
      <span style="font-size:15px;color:#8a8c92;text-decoration:line-through">${fromVersion || '—'}</span>
      <span style="color:#44a282;font-size:15px">→</span>
      <span style="font-size:17px;font-weight:700;color:#5fc39c">${toVersion}</span>
    </div>
    <p style="margin:24px 0 0;font-size:14px">
      <a href="https://www.npmjs.com/package/${pkg}" style="color:#4a8ad6">npmjs.com/package/${pkg}</a>
    </p>
  </div></body></html>`;
  return { subject, html, text };
}

module.exports = { send, verificationEmail, updateEmail, isConsoleMode };
