#!/usr/bin/env node
// T087: a stricter rule for which checks may be twinned, measured for free on
// R0d's material. Run from this folder:
//
//   node canary-fair.mjs > canary-fair.json
//
// v2.6's rule (t085/groups.mjs `eligible`): some premise holds a number in the
// conclusion's unit. R0d's check canary 498 passed it on a 1.85x cost ratio,
// while the planted 3x could be refuted only through a bag size no premise
// held.
//
// v2.7's rule: the figure the twin replaces, the conclusion's one number, is
// given by the premises:
//   - direct: a premise states it;
//   - derived: one step on two premise figures gives it: a sum, a difference,
//     a product, a ratio or a midpoint, and for a conclusion in % a ratio or
//     difference read as a percentage. A one-digit figure ("~1 h", "2x") is
//     too easy to hit by chance, so it must be stated directly.
// Either within the conclusion's own rounding: half a unit of its last digit,
// and never more than 2% of it. A premise that is the conclusion itself
// (a check that lists its conclusion among its premises) does not count.
//
// It is a filter, not the judgement: the parent still writes, for each check
// it twins, the refutation from the premises alone (design v2.7, item 1).

import { readFileSync } from 'node:fs';

const T085 = '../t085';
const rd = (p) => readFileSync(p, 'utf8').split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l));
const facts = rd(`${T085}/ledger.jsonl`).filter((o) => o.kind === 'fact');
const byId = new Map(facts.map((f) => [f.id, f]));
const key = JSON.parse(readFileSync(`${T085}/rec-key.json`, 'utf8'));
const excluded = new Set(JSON.parse(readFileSync(`${T085}/canary-exclude.json`, 'utf8')).facts);

// R0c's number and unit rules, as t085/groups.mjs has them.
const UNITS = new Set(('min mins minutes h hours s sec ms px % × x GiB GB MB KB mm lines studies teams submissions ' +
  'members epochs folds slices series views units forwards checkpoints images rows labels days GPU-h').split(' '));
const isLetter = (c) => c !== undefined && c.toLowerCase() !== c.toUpperCase();
const isDigit = (c) => c >= '0' && c <= '9';
function numbers(v) {
  const out = [];
  for (let i = 0; i < v.length; i++) {
    if (!isDigit(v[i])) continue;
    let j = i, dot = false;
    while (j < v.length && (isDigit(v[j]) || (v[j] === '.' && !dot && j + 1 < v.length && isDigit(v[j + 1])))) { if (v[j] === '.') dot = true; j++; }
    const signed = i > 0 && (v[i - 1] === '-' || v[i - 1] === '+' || v[i - 1] === '−');
    const start = signed ? i - 1 : i;
    const ident = isLetter(v[i - 1]) || v[i - 1] === '§' || v[i - 1] === '#' || v[i - 1] === '.' || v[j] === '-' || v[j] === "'" || v[j] === '’' || isLetter(v[j]) && !UNITS.has(v[j]);
    let k = j; while (k < v.length && v[k] === ' ') k++;
    let word = ''; while (k < v.length && word.length < 8 && !' ,;:)/'.includes(v[k]) && !isDigit(v[k])) word += v[k++];
    if (word.endsWith('.')) word = word.slice(0, -1);
    out.push({ start, end: j, text: v.slice(start, j), num: Number(v.slice(i, j)) * (signed && v[i - 1] !== '+' ? -1 : 1), word, ident });
    i = j;
  }
  return out;
}
function slot(f) {
  if (typeof f.value !== 'string') return null;
  const ns = numbers(f.value);
  if (ns.length !== 1) return null;
  const n = ns[0], unit = f.unit || (UNITS.has(n.word) ? n.word : '');
  if (n.ident || !unit || !n.num || !String(f.says || '').includes(n.text)) return null;
  return { ...n, unit };
}
function units_(f) {
  const out = new Set();
  for (const n of numbers(`${f.value ?? ''} ${f.says ?? ''}`)) if (!n.ident && UNITS.has(n.word)) out.add(n.word);
  if (f.unit) out.add(f.unit);
  return out;
}
const v26 = (c, p) => { const s = slot(byId.get(c)); return !!s && p.some((x) => units_(byId.get(x)).has(s.unit)); };

// A premise's figures. A thousands comma joins digits ("3,037" is 3037), which
// numbers() alone would read as 3 and 037.
const figures = (f) => {
  const text = `${f.value ?? ''} ${f.says ?? ''}`;
  let joined = '';
  for (let i = 0; i < text.length; i++) if (!(text[i] === ',' && isDigit(text[i - 1]) && isDigit(text[i + 1]))) joined += text[i];
  return [...new Set(numbers(joined).filter((n) => !n.ident && n.num).map((n) => Math.abs(n.num)))];
};
const tolerance = (text) => {
  const d = (text.split('.')[1] || '').length;
  return (x) => Math.min(0.5 * 10 ** -d, Math.abs(x) * 0.02);
};
function v27(c, p) {
  const s = slot(byId.get(c));
  if (!s) return { ok: false, why: 'no slot' };
  const target = Math.abs(s.num), tol = tolerance(s.text.replace(/^[-+−]/, ''))(target);
  const near = (x) => Number.isFinite(x) && Math.abs(x - target) <= tol;
  const prem = p.filter((x) => x !== c).map((x) => ({ id: x, figs: figures(byId.get(x)) }));
  for (const q of prem) for (const a of q.figs) if (near(a)) return { ok: true, how: 'direct', figure: s.text, from: `${q.id}: ${a}` };
  if (s.text.replace(/^[-+−]/, '').replace('.', '').replace(/^0+/, '').length < 2) return { ok: false, why: `${s.text} ${s.unit}: a one-digit figure, not stated in a premise` };
  const all = prem.flatMap((q) => q.figs.map((a) => ({ id: q.id, a })));
  const pct = s.unit === '%';
  for (let i = 0; i < all.length; i++) for (let j = 0; j < all.length; j++) {
    if (i === j) continue;
    const { a } = all[i], b = all[j].a;
    const steps = [['+', a + b], ['-', a - b], ['×', a * b], ['/', a / b], ['mid', (a + b) / 2]];
    if (pct) steps.push(['/ as %', (100 * a) / b], ['- / as %', (100 * (a - b)) / b]);
    for (const [op, x] of steps) {
      if (near(x)) return { ok: true, how: 'derived', figure: s.text, from: `${all[i].id}: ${a} ${op} ${all[j].id}: ${b} = ${+x.toPrecision(6)}` };
    }
  }
  return { ok: false, why: `${s.text} ${s.unit}: not in the premises, nor one step from two of them` };
}

// R0d's 20 check canaries, as dealt.
const views = [1, 2, 3].map((k) => rd(`${T085}/rec/R${k}.jsonl`));
const canaries = key.canaries.filter((c) => c.type === 'check').map((c) => {
  const u = views[c.reconciler - 1].find((x) => x.check === c.unit);
  const premises = u.premises.map((x) => key.view[x.id]);
  const f = byId.get(c.real), t = u.conclusion;
  return { reconciler: c.reconciler, unit: c.unit, real: c.real, says: String(f.says).slice(0, 120), twin: String(t.value).slice(0, 80), v26: v26(c.real, premises), v27: v27(c.real, premises) };
});

// Every real check in R0d's views: how many each rule would let be twinned.
const real = views.flatMap((v) => v.filter((x) => x.check && !key.canaries.some((c) => c.twin === key.view[x.conclusion.id])))
  .map((x) => ({ c: key.view[x.conclusion.id], p: x.premises.map((y) => key.view[y.id]) }));
const free = (x) => !excluded.has(x.c) && !x.p.some((y) => excluded.has(y));
const pool = (rule) => real.filter((x) => rule(x.c, x.p) && free(x)).length;

console.log(JSON.stringify({
  checkCanaries: canaries.length,
  keptByV27: canaries.filter((c) => c.v27.ok).length,
  droppedByV27: canaries.filter((c) => !c.v27.ok).map((c) => `R${c.reconciler} check ${c.unit}`),
  realChecks: real.length,
  eligibleV26: pool(v26),
  eligibleV27: pool((c, p) => v27(c, p).ok),
  canaries,
}, null, 1));
