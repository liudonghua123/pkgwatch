// pkgwatch — data layer (node:sqlite)
'use strict';
const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const crypto = require('node:crypto');

const DB_PATH = process.env.PKGWATCH_DB || path.join(__dirname, '..', 'data', 'pkgwatch.db');

const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL;');

db.exec(`
CREATE TABLE IF NOT EXISTS subscriptions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  email       TEXT NOT NULL,
  package     TEXT NOT NULL,
  scope       TEXT,
  name        TEXT NOT NULL,
  version     TEXT,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (email, package)
);

CREATE TABLE IF NOT EXISTS email_verifications (
  email       TEXT PRIMARY KEY,
  code_hash   TEXT NOT NULL,
  attempts    INTEGER NOT NULL DEFAULT 0,
  expires_at  TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS verified_emails (
  email         TEXT PRIMARY KEY,
  verified_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS notifications (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  email       TEXT NOT NULL,
  package     TEXT NOT NULL,
  from_version TEXT,
  to_version  TEXT NOT NULL,
  sent_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_notifications_email_pkg ON notifications(email, package);
`);

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

// ---- email verification ----------------------------------------------------

function createVerification(email, code, ttlMinutes = 15) {
  db.prepare(
    `INSERT INTO email_verifications (email, code_hash, expires_at) VALUES (?, ?, ?)
     ON CONFLICT(email) DO UPDATE SET code_hash=excluded.code_hash, attempts=0,
       expires_at=excluded.expires_at, created_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')`
  ).run(email, sha256(code), new Date(Date.now() + ttlMinutes * 60_000).toISOString());
}

function checkVerification(email, code) {
  const row = db.prepare('SELECT * FROM email_verifications WHERE email = ?').get(email);
  if (!row) return { ok: false, reason: 'not_found' };
  if (new Date(row.expires_at).getTime() < Date.now()) return { ok: false, reason: 'expired' };
  if (row.attempts >= 5) return { ok: false, reason: 'too_many_attempts' };
  db.prepare('UPDATE email_verifications SET attempts = attempts + 1 WHERE email = ?').run(email);
  if (row.code_hash !== sha256(String(code).trim())) return { ok: false, reason: 'bad_code' };
  db.prepare('DELETE FROM email_verifications WHERE email = ?').run(email);
  db.prepare(
    `INSERT INTO verified_emails (email) VALUES (?) ON CONFLICT(email) DO NOTHING`
  ).run(email);
  return { ok: true };
}

const isVerifiedEmail = (email) =>
  !!db.prepare('SELECT 1 FROM verified_emails WHERE email = ?').get(email);

function verifiedEmailsList() {
  return db.prepare('SELECT email, verified_at FROM verified_emails ORDER BY verified_at DESC').all();
}

// ---- subscriptions ----------------------------------------------------------

function addSubscription(email, pkg) {
  const scope = pkg.startsWith('@') ? pkg.split('/')[0] : null;
  db.prepare(
    `INSERT INTO subscriptions (email, package, scope, name) VALUES (?, ?, ?, ?)
     ON CONFLICT(email, package) DO NOTHING`
  ).run(email, pkg, scope, pkg);
}

function removeSubscription(email, pkg) {
  db.prepare('DELETE FROM subscriptions WHERE email = ? AND package = ?').run(email, pkg);
}

function subscriptionsByEmail(email) {
  return db.prepare(
    'SELECT package, version, created_at FROM subscriptions WHERE email = ? ORDER BY package'
  ).all(email);
}

function allSubscriptions() {
  return db.prepare('SELECT email, package, version FROM subscriptions').all();
}

function watchedPackages() {
  return db.prepare('SELECT DISTINCT package FROM subscriptions').all().map((r) => r.package);
}

function updateVersion(pkg, version) {
  db.prepare('UPDATE subscriptions SET version = ? WHERE package = ?').run(version, pkg);
}

function markNotified(email, pkg, fromVersion, toVersion) {
  db.prepare(
    'INSERT INTO notifications (email, package, from_version, to_version) VALUES (?, ?, ?, ?)'
  ).run(email, pkg, fromVersion, toVersion);
}

function recentNotifications(email, limit = 20) {
  return db.prepare(
    `SELECT package, from_version, to_version, sent_at FROM notifications
     WHERE email = ? ORDER BY sent_at DESC LIMIT ?`
  ).all(email, limit);
}

module.exports = {
  db, sha256,
  createVerification, checkVerification, isVerifiedEmail, verifiedEmailsList,
  addSubscription, removeSubscription, subscriptionsByEmail, allSubscriptions,
  watchedPackages, updateVersion, markNotified, recentNotifications,
};
