#!/usr/bin/env node
// T082 R0c: what the parent marks real or false by hand (precision.md).
//
//   node precision.mjs > precision-units.txt
//
// - P1…: every unique conflict pair the reconcilers wrote, canaries excluded,
//   both facts in full and the first why. A pair marked in several groups or
//   by several reconcilers is one pair.
// - D1…: 20 of the real does-not-follow findings, drawn with a fixed seed,
//   each check in full.
// Reconcilers 1 and 2 are read at pass 1; their reruns died part-way.

import { readFileSync } from 'node:fs';

const rd = (p) => readFileSync(p, 'utf8').split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l));
const key = JSON.parse(readFileSync('rec-key.json', 'utf8')), v2f = key.view;
const L = new Map(rd('merged/ledger.jsonl').map((f) => [f.id, f]));
const twins = new Set(key.canaries.map((c) => c.twinView));
const canaryChecks = new Set(key.canaries.filter((c) => c.type === 'check').map((c) => `${c.reconciler}:${c.unit}`));
const files = { 1: 'rec/out-R1-pass1.jsonl', 2: 'rec/out-R2-pass1.jsonl', 3: 'rec/out-R3.jsonl' };

const pairs = new Map(), dnf = [];
for (const k of [1, 2, 3]) {
  const view = new Map(rd(`rec/R${k}.jsonl`).filter((u) => u.check).map((u) => [u.check, u]));
  for (const o of rd(files[k])) {
    if (o.finding === 'conflict' && !o.facts.some((v) => twins.has(v))) {
      const p = [...o.facts].sort((a, b) => a.slice(1) - b.slice(1)).join('/');
      if (!pairs.has(p)) pairs.set(p, []);
      pairs.get(p).push({ at: `R${k}g${o.group}`, why: o.why });
    }
    if (o.finding === 'does-not-follow' && !canaryChecks.has(`${k}:${o.check}`)) dnf.push({ k, o, u: view.get(o.check) });
  }
}

const fact = (v) => { const f = L.get(v2f[v]); return `${v} ${f.at} [${f.mark}] ${f.key} = ${f.value}${f.unit ? ' ' + f.unit : ''} | "${String(f.says).slice(0, 220)}"`; };
const shown = (f) => `${f.id} [${f.mark}] ${f.key} = ${f.value} | "${String(f.says).slice(0, 200)}"`;

console.log(`conflict pairs: ${pairs.size} (${[...pairs.values()].flat().length} lines)`);
let n = 0;
for (const [p, ws] of pairs) {
  const [a, b] = p.split('/');
  console.log(`P${++n} ${p} (${ws.map((w) => w.at).join(' ')})\n  ${fact(a)}\n  ${fact(b)}\n  why: ${ws[0].why}`);
}

let seed = 20261021;
const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const pool = dnf.slice(), sample = [];
while (sample.length < 20 && pool.length) sample.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]);
console.log(`\ndoes-not-follow: ${dnf.length}, sample ${sample.length}`);
sample.forEach(({ k, o, u }, i) => console.log(`D${i + 1} R${k} check ${o.check}\n  C: ${shown(u.conclusion)}\n${u.premises.map((p) => '  P: ' + shown(p)).join('\n')}\n  why: ${o.why}`));
