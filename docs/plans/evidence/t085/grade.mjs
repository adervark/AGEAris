#!/usr/bin/env node
// T085 R0d: the parent's mechanical grade, by T085's rules, committed before
// any reconciler ran. Run from this folder, after the reconcilers:
//
//   node grade.mjs [out-R1 out-R2 out-R3] > grade.json
//
// The output files default to rec/out-R{1,2,3}.jsonl.
//
// - Canaries: a group canary is caught by a `conflict` or `superseded` line
//   naming its twin; a check canary by `contradicted`, or by `unsupported`
//   when the reconciler holding the real check also marked it `unsupported`.
// - Findings by kind, canary units left out.
// - The twelve, by the rule: a `conflict` or `superseded` line on a pair with
//   one fact from each side of `key.json`, a `contradicted` check whose
//   conclusion is an earlier fact, or R0c's `search-flipped` on an earlier
//   fact (the ledger and its searches are R0c's). Whether a line's `why`
//   states the correction is judged by hand, in grade.md. Otherwise the
//   furthest step reached.
// - Precision: the unique `conflict` pairs, `superseded` pairs and
//   `contradicted` checks, each kind in full up to 60 and as a seeded sample
//   of 60 above that, written to precision-units.txt for marking by hand.

import { readFileSync, writeFileSync } from 'node:fs';

const rd = (p) => readFileSync(p, 'utf8').split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l));
const ledger = rd('ledger.jsonl');
const clauseOf = (f) => f.at.slice(0, f.at.lastIndexOf('@'));
const factsAt = new Map();
for (const f of ledger) { const c = clauseOf(f); if (!factsAt.has(c)) factsAt.set(c, []); factsAt.get(c).push(f.id); }
const recKey = JSON.parse(readFileSync('rec-key.json', 'utf8'));
const v2f = recKey.view;
const key = JSON.parse(readFileSync('key.json', 'utf8'));
const flip = JSON.parse(readFileSync('../t082/r0c/searchflip.json', 'utf8'));
const flipped = new Set(flip.results.filter((r) => r.status === 'flipped').map((r) => r.fact));
const byId = new Map(ledger.map((f) => [f.id, f]));

const units = [], outs = [];
for (const k of [1, 2, 3]) {
  for (const u of rd(`rec/R${k}.jsonl`)) units.push({ k, type: u.group ? 'group' : 'check', n: u.group || u.check, ids: u.group ? u.facts.map((f) => v2f[f.id]) : [v2f[u.conclusion.id], ...u.premises.map((p) => v2f[p.id])], conclusion: u.check ? v2f[u.conclusion.id] : null });
  for (const o of rd(process.argv[1 + k] || `rec/out-R${k}.jsonl`)) outs.push({ k, ...o, ids: (o.facts || []).map((v) => v2f[v]) });
}
const unitOf = (k, type, n) => units.find((u) => u.k === k && u.type === type && u.n === n);
const lineOf = (k, type, n) => outs.filter((o) => o.k === k && (type === 'group' ? o.group : o.check) === n);

// Canaries.
const twins = new Set(recKey.canaries.map((c) => c.twin));
const canaries = recKey.canaries.map((c) => {
  let hit;
  if (c.type === 'group') hit = lineOf(c.reconciler, 'group', c.unit).find((o) => (o.finding === 'conflict' || o.finding === 'superseded') && o.ids.includes(c.twin));
  else {
    const mine = lineOf(c.reconciler, 'check', c.unit)[0];
    const real = lineOf(c.realHolder, 'check', c.realUnit)[0];
    if (mine && (mine.finding === 'contradicted' || (mine.finding === 'unsupported' && real && real.finding === 'unsupported'))) hit = mine;
  }
  const line = c.type === 'group' ? lineOf(c.reconciler, 'group', c.unit).map((o) => `${o.kind === 'ok' ? 'ok' : o.finding}: ${o.why}`).join(' | ') : (lineOf(c.reconciler, 'check', c.unit)[0] || {}).why;
  return { ...c, caught: !!hit, line };
});
const isCanaryUnit = (o) => o.ids.some((i) => twins.has(i)) || (o.check !== undefined && twins.has(unitOf(o.k, 'check', o.check).conclusion));
const real = outs.filter((o) => !isCanaryUnit(o));

// The twelve.
const twelve = {};
for (const [c, k] of Object.entries(key.twelve)) {
  const E = new Set(k.earlier.flatMap((x) => factsAt.get(x) || [])), X = new Set(k.correction.flatMap((x) => factsAt.get(x) || []));
  const pairs = real.filter((o) => (o.finding === 'conflict' || o.finding === 'superseded') && o.ids.some((i) => E.has(i)) && o.ids.some((i) => X.has(i)));
  const contra = real.filter((o) => o.finding === 'contradicted' && E.has(unitOf(o.k, 'check', o.check).conclusion));
  const flips = [...E].filter((f) => flipped.has(f));
  const together = units.filter((u) => u.ids.some((i) => E.has(i)) && u.ids.some((i) => X.has(i)));
  const checksOnEarlier = units.filter((u) => u.type === 'check' && E.has(u.conclusion));
  const marked = [...together, ...checksOnEarlier].flatMap((u) => lineOf(u.k, u.type, u.n).map((o) => `R${u.k} ${u.type} ${u.n}: ${o.kind === 'ok' ? 'ok' : o.finding}`));
  const candidates = [
    ...pairs.map((o) => `R${o.k} group ${o.group} ${o.finding} ${o.ids.join('/')}: ${o.why}`),
    ...contra.map((o) => `R${o.k} check ${o.check} contradicted (${unitOf(o.k, 'check', o.check).conclusion}): ${o.why}`),
    ...flips.map((f) => `search-flipped on ${f} (R0c)`),
  ];
  let step;
  if (k.reach === false) step = 'out of reach';
  else if (candidates.length) step = 'candidate catch: judged by hand';
  else if (!E.size) step = 'earlier claim in no fact';
  else if (!X.size) step = 'correction in no fact';
  else if (!together.length && !checksOnEarlier.length) step = 'transcribed, not in one unit';
  else step = 'in a unit, not marked: ' + [...new Set(marked)].join('; ');
  twelve[c] = { earlier: [...E], correction: [...X], why: k.why, step, candidates };
}

// Precision units, for marking by hand.
let seed = 8509;
const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const sample = (xs) => { if (xs.length <= 60) return xs; const a = xs.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a.slice(0, 60); };
const uniq = (lines, keyOf) => { const m = new Map(); for (const o of lines) { const k = keyOf(o); if (!m.has(k)) m.set(k, []); m.get(k).push(o); } return [...m.entries()]; };
const pairKey = (o) => o.ids.slice().sort().join('/');
const kinds = {
  conflict: uniq(real.filter((o) => o.finding === 'conflict'), pairKey),
  superseded: uniq(real.filter((o) => o.finding === 'superseded'), (o) => o.ids.join('>')),
  contradicted: uniq(real.filter((o) => o.finding === 'contradicted'), (o) => unitOf(o.k, 'check', o.check).conclusion),
};
const fact = (id) => { const f = byId.get(id); return `${id} [${f.from.doc} ${clauseOf(f)}] ${f.key} = ${typeof f.value === 'string' ? f.value : JSON.stringify(f.value)} :: ${String(f.says || '').slice(0, 200)}`; };
const text = [];
const precision = {};
for (const [kind, list] of Object.entries(kinds)) {
  const picked = sample(list);
  precision[kind] = { unique: list.length, marked: picked.length };
  text.push(`## ${kind}: ${list.length} unique, ${picked.length} to mark`);
  picked.forEach(([k, os], i) => {
    const o = os[0];
    text.push(`\n### ${kind[0].toUpperCase()}${i + 1} (${os.map((x) => `R${x.k} ${x.group !== undefined ? 'group ' + x.group : 'check ' + x.check}`).join(', ')})`);
    if (o.check !== undefined) { const u = unitOf(o.k, 'check', o.check); text.push(`conclusion: ${fact(u.conclusion)}`); for (const p of u.ids.slice(1)) text.push(`  premise: ${fact(p)}`); }
    else for (const id of o.ids) text.push(`  ${fact(id)}`);
    for (const x of os) text.push(`  why (R${x.k}): ${x.why}`);
  });
  text.push('');
}
writeFileSync('precision-units.txt', text.join('\n') + '\n');

const count = (f) => real.filter((o) => o.finding === f || (f === 'ok' && o.kind === 'ok')).length;
console.log(JSON.stringify({
  canaries: { caught: canaries.filter((c) => c.caught).length, of: canaries.length, byReconciler: [1, 2, 3].map((k) => `${canaries.filter((c) => c.reconciler === k && c.caught).length}/${canaries.filter((c) => c.reconciler === k).length}`), missed: canaries.filter((c) => !c.caught) },
  findings: { ok: count('ok'), conflict: count('conflict'), superseded: count('superseded'), follows: count('follows'), contradicted: count('contradicted'), unsupported: count('unsupported') },
  precision,
  twelve,
}, null, 1));
