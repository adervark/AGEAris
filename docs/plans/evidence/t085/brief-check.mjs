#!/usr/bin/env node
// T085 R0d: the brief carries no answers (v2.6 item 7). Every file a
// reconciler is given is checked against R0d's key before any subagent runs:
//   - none of the key's terms, case-insensitively;
//   - none of its figures as a number token (thousands commas dropped);
//   - no key clause id;
//   - no six words in a row from a key clause, letters and digits only,
//     lower-cased.
// Linear scans only; no pattern can backtrack.
//
//   node brief-check.mjs <key.json> <r0c-dir> <file>...
//
// Prints each hit; exits 1 while any remain.

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const [keyPath, r0c, ...files] = process.argv.slice(2);
if (!files.length) { console.error('usage: node brief-check.mjs <key.json> <r0c-dir> <file>...'); process.exit(2); }
const key = JSON.parse(readFileSync(keyPath, 'utf8'));
const rd = (p) => readFileSync(p, 'utf8').split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l));
const clauses = new Map([
  ...readdirSync(join(r0c, 'cut')).filter((n) => n.endsWith('.jsonl')).flatMap((f) => rd(join(r0c, 'cut', f))),
  ...rd(join(r0c, 'closure-cut.jsonl')),
].map((c) => [c.id, c]));
const ids = Object.values(key.twelve).flatMap((k) => [...k.earlier, ...k.correction]);

const isDigit = (c) => c >= '0' && c <= '9';
const isWordChar = (c) => c !== undefined && (isDigit(c) || c.toLowerCase() !== c.toUpperCase());
function numberTokens(s) {
  const out = [];
  for (let i = 0; i < s.length; i++) {
    if (!isDigit(s[i]) || (i > 0 && (isDigit(s[i - 1]) || s[i - 1] === '.' || s[i - 1] === ','))) continue;
    let j = i;
    while (j < s.length && (isDigit(s[j]) || ((s[j] === '.' || s[j] === ',') && isDigit(s[j + 1])))) j++;
    let t = s.slice(i, j).split(',').join('');
    if (s[j] === 'e' && s[j + 1] === '-' && isDigit(s[j + 2])) { let k = j + 2; while (isDigit(s[k])) k++; t = s.slice(i, k); j = k; }
    out.push(t);
    i = j;
  }
  return out;
}
const words = (s) => {
  const out = [];
  let w = '';
  for (const c of s.toLowerCase()) { if (isWordChar(c)) w += c; else if (w) { out.push(w); w = ''; } }
  if (w) out.push(w);
  return out;
};
const shingles = new Map();
for (const id of ids) {
  const ws = words(clauses.get(id).text);
  for (let i = 0; i + 6 <= ws.length; i++) shingles.set(ws.slice(i, i + 6).join(' '), id);
}
const figures = new Set(key.briefCheck.figures.map((f) => f.split(',').join('')));

let hits = 0;
for (const f of files) {
  const text = readFileSync(f, 'utf8');
  const low = text.toLowerCase();
  for (const t of key.briefCheck.terms) if (low.includes(t.toLowerCase())) { hits++; console.log(`${f}: term "${t}"`); }
  for (const n of new Set(numberTokens(text))) if (figures.has(n)) { hits++; console.log(`${f}: figure ${n}`); }
  for (const id of ids) if (text.includes(id)) { hits++; console.log(`${f}: clause id ${id}`); }
  const ws = words(text);
  for (let i = 0; i + 6 <= ws.length; i++) { const s = ws.slice(i, i + 6).join(' '); if (shingles.has(s)) { hits++; console.log(`${f}: six words of ${shingles.get(s)}: "${s}"`); } }
}
console.log(JSON.stringify({ files: files.length, terms: key.briefCheck.terms.length, figures: figures.size, clauseIds: ids.length, shingles: shingles.size, hits }));
process.exit(hits ? 1 : 0);
