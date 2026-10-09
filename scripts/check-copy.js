#!/usr/bin/env node
/**
 * Copy guard: keeps AI-slop punctuation out of user-visible frontend code.
 *
 * Flags:
 *   1. Spaced em-dashes  " — "  in frontend/src (house style: use " - " or " · ").
 *   2. Standalone em-dash placeholders  '—'  in JSX source.
 *
 * Deliberately NOT flagged: unspaced em-dashes inside regex character classes
 * (e.g. /([a-z])—([0-9])/) - resume date-range parsing depends on those.
 *
 * Run: pnpm run check:copy   (exit 1 = findings, 0 = clean)
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SCAN_DIR = path.join(ROOT, 'frontend', 'src');
const EXTENSIONS = new Set(['.jsx', '.js', '.ts', '.tsx']);

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist') continue;
      walk(full, files);
    } else if (EXTENSIONS.has(path.extname(entry.name))) {
      files.push(full);
    }
  }
  return files;
}

const findings = [];
for (const file of walk(SCAN_DIR)) {
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  lines.forEach((line, index) => {
    const rel = path.relative(ROOT, file);
    if (line.includes(' — ')) {
      findings.push(`${rel}:${index + 1}: spaced em-dash (use " - " or " · "): ${line.trim().slice(0, 100)}`);
    }
    if (/'—'|"—"/.test(line)) {
      findings.push(`${rel}:${index + 1}: standalone em-dash placeholder (use '-' or '·'): ${line.trim().slice(0, 100)}`);
    }
  });
}

if (findings.length) {
  console.error(`copy guard: ${findings.length} finding(s)`);
  for (const finding of findings) console.error('  ' + finding);
  process.exit(1);
}
console.log('copy guard: clean (no em-dash slop in frontend/src)');
