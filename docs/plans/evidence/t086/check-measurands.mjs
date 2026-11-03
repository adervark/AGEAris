#!/usr/bin/env node
// T086 H1: what the registrar's measurands.jsonl must satisfy, run by the
// registrar until it comes back clean.
//
//   node check-measurands.mjs <measurands.jsonl>
//
// Every line parses and is {"kind":"object","type":"measurand",...} with a
// unique lower-case kebab `name`, a `unit`, a `means` of at least 40 bytes
// that says what is measured, on what, by what, and a non-empty `seen` list
// of clause ids. Exits 1 while any problem remains.

import { readFileSync } from 'node:fs';

const [path] = process.argv.slice(2);
if (!path) { console.error('usage: node check-measurands.mjs <measurands.jsonl>'); process.exit(2); }
const problems = [], names = new Set();
const kebab = (s) => typeof s === 'string' && s.length > 0 && [...s].every((c) => (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || c === '-') && !s.startsWith('-') && !s.endsWith('-');
let n = 0;
for (const [i, l] of readFileSync(path, 'utf8').split('\n').entries()) {
  if (!l.trim()) continue;
  n++;
  let o; try { o = JSON.parse(l); } catch { problems.push(`line ${i + 1}: does not parse`); continue; }
  const at = `line ${i + 1}`;
  if (o.kind !== 'object' || o.type !== 'measurand') problems.push(`${at}: kind must be object and type measurand`);
  if (!kebab(o.name)) problems.push(`${at}: name must be lower-case kebab`);
  else if (names.has(o.name)) problems.push(`${at}: ${o.name} registered twice`);
  names.add(o.name);
  if (typeof o.unit !== 'string' || !o.unit.trim()) problems.push(`${at}: no unit`);
  if (typeof o.means !== 'string' || Buffer.byteLength(o.means) < 40) problems.push(`${at}: means must say what, on what, by what (40 bytes or more)`);
  if (!Array.isArray(o.seen) || !o.seen.length || !o.seen.every((s) => typeof s === 'string' && s.includes('#'))) problems.push(`${at}: seen must list the clause ids it was seen in`);
}
console.log(JSON.stringify({ measurands: n, problems: problems.length }));
for (const p of problems.slice(0, 40)) console.log(p);
process.exit(problems.length ? 1 : 0);
