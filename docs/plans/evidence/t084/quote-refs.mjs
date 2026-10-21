#!/usr/bin/env node
// T084: v2.6's refs from quotes, measured on R0c's ledger. Every fact's
// `says` is scanned for the identifiers it names, and each one found is added
// to the fact's `refs`. A quote is verbatim from its clause, so such a ref is
// grounded by the quote itself. Three classes, counted apart:
//
//   - flag:  `--` then a letter, then letters, digits and `-` (`--layer-decay`);
//   - path:  a token ending in a known extension, `:line` dropped
//            (`src/tta.py:116` gives `src/tta.py`);
//   - ident: a token with `_` between letters (`budget_minutes`), or a dotted
//            pair of identifiers of at least 3 characters each (`tta.unmatched`).
//
// A token is a maximal run of letters, digits and `_ . / -`. Linear scans
// only, nothing that can backtrack: the text is untrusted.
//
//   node quote-refs.mjs <ledger.jsonl> <out-ledger.jsonl> [flag,path,ident]
//
// Prints a report: refs added per class, facts gaining one, and the refs
// found most often.

import { readFileSync, writeFileSync } from 'node:fs';

const [inPath, outPath, classArg = 'flag,path,ident'] = process.argv.slice(2);
if (!outPath) { console.error('usage: node quote-refs.mjs <ledger> <out-ledger> [flag,path,ident]'); process.exit(2); }
const want = new Set(classArg.split(','));
const EXT = ['.py', '.sh', '.md', '.json', '.jsonl', '.csv', '.mjs', '.js', '.yml', '.yaml', '.txt', '.log', '.ipynb', '.toml'];

const isLower = (c) => c >= 'a' && c <= 'z';
const isLetter = (c) => c !== undefined && c.toLowerCase() !== c.toUpperCase();
const isDigit = (c) => c >= '0' && c <= '9';
const isTok = (c) => c !== undefined && (isLetter(c) || isDigit(c) || c === '_' || c === '.' || c === '/' || c === '-');

function found(s) {
  const out = [];
  // Flags.
  for (let i = 0; i + 2 < s.length; i++) {
    if (s[i] !== '-' || s[i + 1] !== '-' || (i > 0 && isTok(s[i - 1])) || !isLower(s[i + 2])) continue;
    let j = i + 2;
    while (j < s.length && (isLower(s[j]) || isDigit(s[j]) || s[j] === '-')) j++;
    let t = s.slice(i, j);
    while (t.endsWith('-')) t = t.slice(0, -1);
    if (t.length >= 4) out.push(['flag', t]);
    i = j - 1;
  }
  // Tokens: paths and identifiers.
  for (let i = 0; i < s.length; i++) {
    if (!isTok(s[i]) || (i > 0 && isTok(s[i - 1]))) continue;
    let j = i;
    while (j < s.length && isTok(s[j])) j++;
    let t = s.slice(i, j);
    i = j - 1;
    while (t.length && (t.endsWith('.') || t.endsWith('-') || t.endsWith('/'))) t = t.slice(0, -1);
    if (t.startsWith('-')) continue;
    const ext = EXT.find((e) => t.endsWith(e) && t.length > e.length);
    if (ext) { out.push(['path', t]); continue; }
    if (t.includes('/')) continue;
    const parts = t.split('.');
    const ident = (p) => p.length >= 3 && isLetter(p[0]) && [...p].every((c) => isLetter(c) || isDigit(c) || c === '_');
    if (parts.length === 2 && ident(parts[0]) && ident(parts[1])) { out.push(['ident', t]); continue; }
    if (parts.length === 1 && t.length >= 4) {
      const k = t.indexOf('_');
      if (k > 0 && k < t.length - 1 && isLetter(t[k - 1]) && isLetter(t[k + 1]) && [...t].every((c) => isLetter(c) || isDigit(c) || c === '_')) out.push(['ident', t]);
    }
  }
  return out;
}

const lines = readFileSync(inPath, 'utf8').split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l));
const added = { flag: 0, path: 0, ident: 0 }, gained = { flag: 0, path: 0, ident: 0 }, freq = new Map();
let factsGaining = 0;
const out = lines.map((x) => {
  if (x.kind !== 'fact') return x;
  const have = new Set(x.refs || []);
  const got = { flag: false, path: false, ident: false };
  for (const [cls, ref] of found(String(x.says || ''))) {
    if (!want.has(cls) || have.has(ref)) continue;
    have.add(ref); added[cls]++; got[cls] = true;
    freq.set(ref, (freq.get(ref) || 0) + 1);
  }
  for (const c of Object.keys(got)) if (got[c]) gained[c]++;
  if (Object.values(got).some(Boolean)) factsGaining++;
  return { ...x, refs: [...have] };
});
writeFileSync(outPath, out.map((x) => JSON.stringify(x)).join('\n') + '\n');
console.log(JSON.stringify({
  classes: [...want], facts: lines.filter((x) => x.kind === 'fact').length, factsGaining, refsAdded: added, factsGainingByClass: gained,
  top: [...freq].sort((a, b) => b[1] - a[1]).slice(0, 25).map(([r, n]) => `${r} ${n}`),
}, null, 1));
