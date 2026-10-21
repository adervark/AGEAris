#!/usr/bin/env node
// T084: how many supersession candidates would a mechanical rule raise? Over
// every group that links through a registered measurand (`m:`), a candidate is
// two facts from different documents whose readings differ. A reading is the
// numbers in a fact's value: a range `a–b` counts as its two ends, a thousands
// comma is dropped, hours and seconds become minutes, and a number right after
// `≥ ≤ < >` is a threshold, not a reading. Linear scans only.
//
//   node supersede.mjs <ledger.jsonl> <groups-dir> <key.json>
//
// Prints the candidate count, its spread over groups, and whether C5's and C9's
// pairs (T082's key) are among the candidates.

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const [ledgerPath, dir, keyPath] = process.argv.slice(2);
if (!keyPath) { console.error('usage: node supersede.mjs <ledger> <groups-dir> <key.json>'); process.exit(2); }
const rd = (p) => readFileSync(p, 'utf8').split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l));
const L = new Map(rd(ledgerPath).filter((x) => x.kind === 'fact').map((f) => [f.id, f]));
const v2f = JSON.parse(readFileSync(keyPath, 'utf8')).view;
const docOf = (f) => (f.from && f.from.doc) || '?';

const isDigit = (c) => c >= '0' && c <= '9';
const MIN = { h: 60, hour: 60, hours: 60, hr: 60, min: 1, mins: 1, minute: 1, minutes: 1, s: 1 / 60, sec: 1 / 60 };
function reading(f) {
  const v = `${f.value ?? ''}${f.unit ? ' ' + f.unit : ''}`;
  const nums = [];
  for (let i = 0; i < v.length; i++) {
    if (!isDigit(v[i])) continue;
    let j = i;
    while (j < v.length && (isDigit(v[j]) || (v[j] === ',' && isDigit(v[j + 1]) && isDigit(v[j + 2]) && isDigit(v[j + 3])) || (v[j] === '.' && isDigit(v[j + 1])))) j++;
    let k = i - 1;
    while (k >= 0 && v[k] === ' ') k--;
    const threshold = k >= 0 && '≥≤<>'.includes(v[k]);
    if (!threshold) nums.push({ n: Number(v.slice(i, j).split(',').join('')), end: j });
    i = j - 1;
  }
  if (!nums.length) return null;
  // A unit word after the last number scales time to minutes.
  let k = nums[nums.length - 1].end;
  while (k < v.length && v[k] === ' ') k++;
  let w = '';
  while (k < v.length && w.length < 8 && v[k] !== ' ' && v[k] !== ',' && v[k] !== ')') w += v[k++];
  const scale = MIN[w.toLowerCase()] || 1;
  return nums.map((x) => Math.round(x.n * scale * 1e6) / 1e6).sort((a, b) => a - b).join('/');
}

const C5 = [['F956', 'F1472'], ['F2469']];
const C9 = [['F22', 'F947', 'F3206', 'F943'], ['F1045']];
let candidates = 0, groups = 0, pairsSeen = 0;
const perGroup = [], hits = { C5: [], C9: [] };
for (const f of readdirSync(dir).filter((n) => /^R\d+\.jsonl$/.test(n)).sort()) {
  for (const u of rd(join(dir, f))) {
    if (!u.group || !u.via.some((x) => x.startsWith('m:'))) continue;
    groups++;
    const fs = u.facts.map((x) => L.get(v2f[x.id])).filter(Boolean);
    let n = 0;
    for (let a = 0; a < fs.length; a++) for (let b = a + 1; b < fs.length; b++) {
      if (docOf(fs[a]) === docOf(fs[b])) continue;
      pairsSeen++;
      const ra = reading(fs[a]), rb = reading(fs[b]);
      if (!ra || !rb || ra === rb) continue;
      n++;
      for (const [c, [e, x]] of Object.entries({ C5, C9 })) {
        if ((e.includes(fs[a].id) && x.includes(fs[b].id)) || (e.includes(fs[b].id) && x.includes(fs[a].id))) hits[c].push(`${fs[a].id} ${ra} / ${fs[b].id} ${rb} (${f.slice(0, 2)} group ${u.group})`);
      }
    }
    candidates += n;
    perGroup.push(n);
  }
}
perGroup.sort((a, b) => b - a);
console.log(JSON.stringify({ measurandGroups: groups, crossDocPairs: pairsSeen, candidates, largestGroups: perGroup.slice(0, 8), C5: hits.C5, C9: hits.C9 }, null, 1));
