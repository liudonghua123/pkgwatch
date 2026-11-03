// pkgwatch — npm change feed poller (short-poll mode)
// The npm replication endpoint supports the normal `_changes` feed:
//   https://replicate.npmjs.com/registry/_changes?since=<seq>&limit=N
// We keep the last seq and poll for new publishes, filtering by watched packages.
// Every hit is confirmed against https://registry.npmjs.org/<pkg> before notifying.
'use strict';

const CHANGES_BASE = 'https://replicate.npmjs.com/registry/_changes';
const REGISTRY = 'https://registry.npmjs.org';

function fetchLatestWithTime(pkg) {
  return fetch(`${REGISTRY}/${encodeURIComponent(pkg).replace('%40', '@')}`)
    .then((r) => {
      if (!r.ok) throw new Error(`registry ${r.status}`);
      return r.json();
    })
    .then((doc) => {
      const latest = doc['dist-tags']?.latest ?? null;
      const publishedAt = latest && doc.time?.[latest] ? doc.time[latest] : null;
      return { version: latest, publishedAt };
    });
}

class ChangePoller {
  constructor({ onPackageChange, onError, onTick } = {}) {
    this.onPackageChange = onPackageChange || (() => {});
    this.onError = onError || console.warn;
    this.onTick = onTick || (() => {});
    this.watched = new Set();
    this.since = 'now';
    this.timer = null;
    this.running = false;
    this.intervalMs = Number(process.env.PKGWATCH_POLL_MS || 20_000);
    this.lastEventAt = null;
    this.firehose = []; // recent publish ids (ring buffer, newest last)
  }

  setWatched(pkgs) {
    this.watched = new Set(pkgs);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this._bootstrap();
  }

  stop() {
    this.running = false;
    if (this.timer) clearTimeout(this.timer);
  }

  stats() {
    return {
      running: this.running,
      watched: this.watched.size,
      since: this.since,
      intervalMs: this.intervalMs,
      lastEventAt: this.lastEventAt,
    };
  }

  recentPublishes(n = 40) {
    return this.firehose.slice(-n);
  }

  // pin the starting seq so the first poll only sees fresh publishes
  _bootstrap() {
    // (the replication endpoint rejects since=now with the normal feed,
    //  so we read the newest seq with a descending single-row query)
    fetch(`${CHANGES_BASE}?limit=1&descending=true`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`feed ${r.status}`))))
      .then((doc) => {
        this.since = doc.last_seq || 'now';
        this.onError(`changes feed pinned at seq ${this.since}`);
        this._schedule(0);
      })
      .catch((err) => {
        this.onError(`bootstrap failed (${err.message}), retrying`);
        this._schedule(10_000);
      });
  }

  _schedule(ms) {
    if (!this.running) return;
    this.timer = setTimeout(() => this._poll(), ms ?? this.intervalMs);
  }

  _poll() {
    if (!this.running) return;
    const url = `${CHANGES_BASE}?since=${encodeURIComponent(this.since)}&limit=1000`;
    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`feed ${r.status}`);
        return r.json();
      })
      .then((doc) => {
        const hits = [];
        for (const row of doc.results || []) {
          const id = row.id;
          if (id && this.watched.has(id)) hits.push(id);
        }
        if (doc.last_seq) this.since = doc.last_seq;
        this.lastEventAt = Date.now();
        for (const row of doc.results || []) {
          if (!row.id) continue;
          this.firehose.push({ id: row.id, seq: row.seq });
        }
        if (this.firehose.length > 60) this.firehose = this.firehose.slice(-60);
        this.onTick({ seen: doc.results?.length || 0, hits });
        for (const pkg of hits) this.onPackageChange(pkg);
        this._schedule();
      })
      .catch((err) => {
        this.onError(`poll failed: ${err.message}`);
        this._schedule(30_000); // backoff
      });
  }
}

module.exports = { ChangePoller, fetchLatestWithTime, REGISTRY };
