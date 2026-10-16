#!/usr/bin/env node
// T082 R0c: the parent's grade. Run from this folder, after the reconcilers:
//
//   node grade.mjs > grade.json
//
// - Canaries: per reconciler, a group canary is caught by a `conflict` line
//   naming its twin; a check canary by `does-not-follow` on its check.
// - The twelve: each correction's earlier and correcting clauses are fixed
//   below, from T075's `corrections.md` and T082's `key-lines.md`, located
//   in the cut before any reconciler output was read. A correction is caught
//   when a reconciler marks `conflict` on a pair with one fact from each
//   side, or `does-not-follow` on a check whose conclusion is an earlier
//   fact, or when `search-flipped` fires on an earlier fact. Otherwise the
//   furthest step it reached is reported.

import { readFileSync } from 'node:fs';

const rd = (p) => readFileSync(p, 'utf8').split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l));
const ledger = rd('merged/ledger.jsonl');
const factsAt = (c) => ledger.filter((f) => f.at === c).map((f) => f.id);
const key = JSON.parse(readFileSync('rec-key.json', 'utf8'));
const v2f = key.view;
const flip = JSON.parse(readFileSync('searchflip.json', 'utf8'));
const flipped = new Set(flip.results.filter((r) => r.status === 'flipped').map((r) => r.fact));

const units = [], outs = [];
for (const k of [1, 2, 3]) {
  for (const u of rd(`rec/R${k}.jsonl`)) units.push({ k, type: u.group ? 'group' : 'check', n: u.group || u.check, ids: u.group ? u.facts.map((f) => v2f[f.id]) : [v2f[u.conclusion.id], ...u.premises.map((p) => v2f[p.id])], conclusion: u.check ? v2f[u.conclusion.id] : null });
  for (const o of rd(`rec/out-R${k}.jsonl`)) outs.push({ k, ...o, ids: (o.facts || []).map((v) => v2f[v]) });
}
const unitOf = (k, type, n) => units.find((u) => u.k === k && u.type === type && u.n === n);

// Canaries.
const canaries = key.canaries.map((c) => {
  const twin = c.twin;
  const hit = c.type === 'group'
    ? outs.find((o) => o.k === c.reconciler && o.group === c.unit && o.finding === 'conflict' && o.ids.includes(twin))
    : outs.find((o) => o.k === c.reconciler && o.check === c.unit && o.finding === 'does-not-follow');
  return { ...c, caught: !!hit, why: hit ? hit.why : (outs.find((o) => o.k === c.reconciler && (c.type === 'group' ? o.group : o.check) === c.unit) || {}).why };
});
const twins = new Set(key.canaries.map((c) => c.twin));

const C = {
  C1: [['R1#75', 'R2#45', 'T047brief#43', 'PROGRESS.md§5857#1', 'lane6-single-model-gap.md§185#1'], ['lane10#14', 'lane10#182', 'lane10#585']],
  C2: [['R2#41', 'R2#44', 'R2#174', 'lane6-single-model-gap.md§219#1', 'STATE.md§9#11'], ['lane10#16', 'lane10#478', 'lane10#570']],
  C3: [['tta.py§budget_minutes#4', 'lane7-public-members.md§330#1', 'lane11#71'], ['lane11#76', 'lane11#77']],
  C4: [['lane7-public-members.md§330#2', 'lane11#85'], ['lane11#86']],
  C5: [['T047brief#46', 'lane9#384'], ['lane11#65', 'lane11#67', 'lane11#69', 'lane11#119']],
  C6: [[], ['lane11#30']],
  C7: [['lane5-public-notebooks.md§88#1'], ['lane9#419', 'lane9#420']],
  C8: [['R1#125', 'lane9#11', 'lane9#100'], ['lane9#158', 'lane9#202', 'lane9#206']],
  C9: [['R1#27', 'T047brief#41', 'lane0-rules-and-leaderboard.md§81#1'], ['lane9#29', 'lane9#85', 'lane9#221']],
  C10: [['lane12#238', 'AGENTS.md§45#4', 'R1#235'], []],
  C11: [['lane11#187'], ['lane11#55']],
  C12: [['lane10#392'], ['lane11#223', 'tta.py§unmatched#1']],
};
const twelve = {};
for (const [c, [e, x]] of Object.entries(C)) {
  const E = new Set(e.flatMap(factsAt)), X = new Set(x.flatMap(factsAt));
  const conflicts = outs.filter((o) => o.finding === 'conflict' && o.ids.some((i) => E.has(i)) && o.ids.some((i) => X.has(i)));
  const dnf = outs.filter((o) => o.finding === 'does-not-follow' && E.has(unitOf(o.k, 'check', o.check).conclusion));
  const flips = [...E].filter((f) => flipped.has(f));
  const together = units.filter((u) => u.ids.some((i) => E.has(i)) && u.ids.some((i) => X.has(i)));
  const marked = together.map((u) => outs.filter((o) => o.k === u.k && (u.type === 'group' ? o.group : o.check) === u.n).map((o) => `R${u.k} ${u.type} ${u.n}: ${o.kind === 'ok' ? 'ok' : o.finding}`)).flat();
  const caughtBy = [...conflicts.map((o) => `R${o.k} group ${o.group} conflict ${o.ids.join('/')}: ${o.why}`), ...dnf.map((o) => `R${o.k} check ${o.check} does-not-follow: ${o.why}`), ...flips.map((f) => `search-flipped on ${f}`)];
  let step;
  if (caughtBy.length) step = 'caught';
  else if (!E.size) step = 'earlier claim in no commit: out of reach';
  else if (!X.size) step = 'correction not transcribed';
  else if (!together.length) step = 'transcribed, not in one group or check';
  else step = 'in one unit, not marked: ' + [...new Set(marked)].join('; ');
  twelve[c] = { earlier: [...E], correction: [...X], step, caughtBy };
}

const real = outs.filter((o) => !o.ids.some((i) => twins.has(i)));
const realDnf = outs.filter((o) => o.finding === 'does-not-follow' && !twins.has(unitOf(o.k, 'check', o.check).conclusion));
console.log(JSON.stringify({
  canaries: { caught: canaries.filter((c) => c.caught).length, of: canaries.length, byReconciler: [1, 2, 3].map((k) => `${canaries.filter((c) => c.reconciler === k && c.caught).length}/${canaries.filter((c) => c.reconciler === k).length}`), missed: canaries.filter((c) => !c.caught) },
  recall: { caught: Object.values(twelve).filter((t) => t.step === 'caught').length, of: 12 },
  twelve,
  findings: { conflict: real.filter((o) => o.finding === 'conflict').length, doesNotFollow: realDnf.length, ok: outs.filter((o) => o.kind === 'ok').length, follows: outs.filter((o) => o.finding === 'follows').length },
  searchFlipped: flip.summary,
}, null, 1));
