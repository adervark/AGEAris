#!/usr/bin/env node
// T086 H1: what the auditor sees, and the key it never sees. R0c's
// (t082/r0c/audit-view.mjs), except that no canary is drawn from a clause the
// round's key pins (`--exclude key.json`).
//
//   node audit-view.mjs <out-dir> <audit-key.json> <cut.jsonl>... -- <ledger.jsonl>... [--exclude key.json]
//
// Writes <out-dir>/skips.jsonl: every clause the transcribers skipped, with
// its document, line, text and the skip's reason, and the canaries mixed in.
// A canary is a clause the transcribers wrote as a fact, presented as a
// `no-claim` skip. Its text is real, so nothing marks it out. There are
// max(3, 2% of facts) of them, drawn with a fixed seed from clauses that
// carry a digit and were written only as facts.
//
// Writes <out-dir>/assign.jsonl: every fact with a unit and no code
// referent (no `path:line`, `path#symbol` or `cmd:` source), shown as its
// clause, quote, value and unit only. The transcriber's key, sources and
// measurand are withheld, so the auditor assigns a measurand blind.
//
// The key maps canaries and items back to facts.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const argv = process.argv.slice(2);
const sep = argv.indexOf('--');
const [outDir, keyPath, ...cuts] = argv.slice(0, sep);
const tail = argv.slice(sep + 1), ex = tail.indexOf('--exclude');
const ledgers = ex < 0 ? tail : tail.slice(0, ex);
const pinned = new Set(ex < 0 ? [] : Object.values(JSON.parse(readFileSync(tail[ex + 1], 'utf8')).corrections).flatMap((k) => [...k.earlier, ...k.correction]));
if (sep < 0 || !ledgers.length) { console.error('usage: node audit-view.mjs <out-dir> <key.json> <cut>... -- <ledger>...'); process.exit(2); }

const jsonl = (p) => readFileSync(p, 'utf8').split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l));
const clauses = cuts.flatMap(jsonl);
const byId = new Map(clauses.map((c) => [c.id, c]));
const lines = ledgers.flatMap(jsonl);
const facts = lines.filter((o) => o.kind === 'fact');

function expand(ref) {
  const hash = ref.lastIndexOf('#'), dash = ref.indexOf('-', hash);
  if (hash < 0 || dash < 0) return [ref];
  const doc = ref.slice(0, hash), a = Number(ref.slice(hash + 1, dash)), b = Number(ref.slice(dash + 1));
  if (!Number.isInteger(a) || !Number.isInteger(b) || b < a) return [ref];
  return Array.from({ length: b - a + 1 }, (_, i) => `${doc}#${a + i}`);
}
const skipped = new Map();
for (const o of lines) if (o.kind === 'skip') for (const c of [].concat(o.clauses || []).flatMap(expand)) skipped.set(c, { why: o.why, of: o.of });
const asFact = new Set(facts.map((f) => f.at));

let seed = 86;
const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const pool = [...asFact].filter((c) => !skipped.has(c) && !pinned.has(c) && byId.has(c) && /[0-9]/.test(byId.get(c).text));
const k = Math.max(3, Math.ceil(facts.length * 0.02));
const canaries = new Set();
while (canaries.size < Math.min(k, pool.length)) canaries.add(pool[Math.floor(rnd() * pool.length)]);

const view = [];
for (const c of clauses) {
  if (skipped.has(c.id)) view.push({ clause: c.id, doc: c.doc, path: c.path, commit: c.commit, line: c.line, text: c.text, why: skipped.get(c.id).why, of: skipped.get(c.id).of });
  else if (canaries.has(c.id)) view.push({ clause: c.id, doc: c.doc, path: c.path, commit: c.commit, line: c.line, text: c.text, why: 'no-claim' });
}

const code = (s) => typeof s === 'string' && !s.startsWith('m:') && !s.startsWith('url:') && !s.startsWith('submission:') &&
  (s.startsWith('cmd:') || (s.includes('@') && (s.includes(':') || s.includes('#'))));
const items = [];
const itemKey = [];
for (const f of facts) {
  if (!f.unit || (f.src || []).some(code)) continue;
  const c = byId.get(f.at);
  items.push({ item: items.length + 1, clause: f.at, text: c ? c.text : '', says: f.says, value: f.value, unit: f.unit });
  itemKey.push({ item: items.length, fact: f.id, transcriber: (f.src || []).filter((s) => typeof s === 'string' && s.startsWith('m:')).map((s) => s.slice(2)) });
}

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'skips.jsonl'), view.map((v) => JSON.stringify(v)).join('\n') + '\n');
writeFileSync(join(outDir, 'assign.jsonl'), items.map((v) => JSON.stringify(v)).join('\n') + '\n');
writeFileSync(keyPath, JSON.stringify({ canaries: [...canaries], items: itemKey }, null, 1) + '\n');
console.log(JSON.stringify({ skippedClauses: skipped.size, canaries: canaries.size, view: view.length, assignItems: items.length }));
