#!/usr/bin/env node
// T090: v2.8 item 1, measured for free on T086's cut. Pairs each clause an
// edit dropped (`<doc>@<commit>`) with the clause of a later version of the
// same document that is most like it, and reports which of T086's key
// corrections those pairs reach. Run from this folder:
//
//   node edit-pairs.mjs [threshold] > edit-pairs.json
//
// Likeness is the Dice coefficient over each clause's set of lower-cased
// words; a pair counts at or above the threshold (default 0.5) and below 1,
// since an identical clause was not edited. Reads ../t086 only.

import { readFileSync } from 'node:fs';

const H1 = new URL('../t086/', import.meta.url);
const rd = (p) => readFileSync(new URL(p, H1), 'utf8').split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l));
const threshold = Number(process.argv[2] ?? 0.5);
const clauses = rd('cut/clauses.jsonl');
const order = new Map(JSON.parse(readFileSync(new URL('cut/scope.json', H1), 'utf8')).commits.map((c, i) => [c, i]));
const key = JSON.parse(readFileSync(new URL('key.json', H1), 'utf8')).corrections;

const words = (text) => new Set(text.toLowerCase().match(/[a-z0-9]+(?:[.'][a-z0-9]+)*/g) || []);
const dice = (a, b) => {
  let shared = 0;
  for (const w of a) if (b.has(w)) shared++;
  return a.size + b.size ? (2 * shared) / (a.size + b.size) : 0;
};
const base = (c) => c.doc.split('@')[0];
const bag = new Map(clauses.map((c) => [c.id, words(c.text)]));

const dropped = clauses.filter((c) => c.doc.includes('@'));
const pairs = [];
for (const d of dropped) {
  const later = clauses.filter((c) => c !== d && base(c) === base(d) && order.get(c.commit) > order.get(d.commit));
  let best = null;
  for (const c of later) {
    const s = dice(bag.get(d.id), bag.get(c.id));
    if (!best || s > best.s) best = { c, s };
  }
  if (best && best.s >= threshold && best.s < 1) pairs.push({ earlier: d.id, later: best.c.id, likeness: Math.round(best.s * 100) / 100 });
}

// A key correction is reached when a pair joins one of its earlier clauses
// to one of its correcting clauses.
const reached = Object.entries(key).filter(([, k]) => k.reach).map(([id, k]) => {
  const pair = pairs.find((p) => k.earlier.includes(p.earlier) && k.correction.includes(p.later));
  return { key: id, reached: !!pair, pair: pair || null };
});
const onKey = pairs.filter((p) => Object.values(key).some((k) => k.earlier.includes(p.earlier) && k.correction.includes(p.later)));

console.log(JSON.stringify({
  threshold,
  dropped: dropped.length,
  pairs: pairs.length,
  pairsOnKey: onKey.length,
  reached: reached.filter((r) => r.reached).map((r) => r.key),
  notReached: reached.filter((r) => !r.reached).map((r) => r.key),
  detail: reached,
  all: pairs.map((p) => ({ ...p, earlierText: clauses.find((c) => c.id === p.earlier).text.slice(0, 160), laterText: clauses.find((c) => c.id === p.later).text.slice(0, 160) })),
}, null, 1));
