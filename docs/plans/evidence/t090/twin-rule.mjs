#!/usr/bin/env node
// T090: v2.8 item 3, measured for free on T086's group canaries. A group
// twin's figure must not be one another fact in its group states: rounded to
// the precision that fact writes, it must differ from that fact's figure, in
// whatever unit. (It already differs from the real figure beyond its
// rounding, as v2.7 requires.) A relative bound was tried first and dropped:
// 10% re-picked 6 of 10, among them 0.941 → 0.869, a large step for a score.
// A one-digit figure elsewhere in the group is passed over, as v2.7 passes
// it over for checks: "1 of 4" would otherwise forbid 0.869.
// Reports which of T086's ten twins the rule would have made the parent
// re-pick, and whether each was caught. Run from this folder:
//
//   node twin-rule.mjs > twin-rule.json

import { readFileSync } from 'node:fs';

const H1 = new URL('../t086/', import.meta.url);
const rd = (p) => readFileSync(new URL(p, H1), 'utf8').split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l));
const recKey = JSON.parse(readFileSync(new URL('rec-key.json', H1), 'utf8'));
const ledger = new Map(rd('ledger.jsonl').map((f) => [f.id, f]));
// Each figure with the number of decimals it is written to.
const figures = (text) => (String(text).match(/\d+(?:\.\d+)?/g) || []).map((t) => ({ n: Number(t), places: t.includes('.') ? t.length - t.indexOf('.') - 1 : 0, digits: t.replace('.', '').replace(/^0+/, '').length }));
const states = (other, figure) => other.digits > 1 && other.n === Number(figure.n.toFixed(other.places));

const twins = recKey.canaries.filter((c) => c.type === 'group').map((c) => {
  const group = rd(`rec/R${c.reconciler}.jsonl`).find((u) => u.group === c.unit);
  const twin = group.facts.find((f) => f.id === c.twinView);
  const real = ledger.get(c.real);
  const figure = figures(twin.value)[0];
  const givenBy = group.facts.filter((f) => f.id !== c.twinView && f.id !== c.realView && figures(f.value).some((other) => states(other, figure))).map((f) => `${f.key} = ${f.value}`.slice(0, 120));
  const caught = rd(`rec/out-R${c.reconciler}.jsonl`).some((o) => o.group === c.unit && ['conflict', 'superseded'].includes(o.finding) && o.facts.includes(c.twinView));
  return { reconciler: c.reconciler, group: c.unit, size: group.facts.length, real: real.value, twin: twin.value, caught, givenBy, repick: givenBy.length > 0 };
});

console.log(JSON.stringify({
  twins: twins.length,
  repick: twins.filter((t) => t.repick).length,
  repickCaught: twins.filter((t) => t.repick && t.caught).length,
  repickMissed: twins.filter((t) => t.repick && !t.caught).length,
  keptMissed: twins.filter((t) => !t.repick && !t.caught).length,
  detail: twins,
}, null, 1));
