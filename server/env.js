// pkgwatch — minimal .env loader (no dependency)
// Loads the first .env found from the project root or cwd.
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const candidates = [
  path.join(__dirname, '..', '.env'),
  path.join(process.cwd(), '.env'),
];

for (const file of candidates) {
  try {
    const raw = fs.readFileSync(file, 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      // strip surrounding quotes
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = value;
    }
    break; // only the first existing file is loaded
  } catch {
    // file missing: try the next candidate
  }
}
