#!/usr/bin/env node
// T084: does a regrouping put each correction's two sides in one unit? For
// each of the twelve, whether some group or check holds a fact from its
// earlier clauses and one from its correcting clauses. The clauses are T082's
// grade key (docs/plans/evidence/t082/r0c/grade.mjs, fixed in 0a58ad3 before
// any reconciler reported), copied here unchanged.
//
//   node reach.mjs <ledger.jsonl> <groups-dir> <key.json>
//
// <groups-dir> holds R1..R3.jsonl from groups.mjs, and <key.json> its view map.

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const [ledgerPath, dir, keyPath] = process.argv.slice(2);
if (!keyPath) { console.error('usage: node reach.mjs <ledger> <groups-dir> <key.json>'); process.exit(2); }
const rd = (p) => readFileSync(p, 'utf8').split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l));
const ledger = rd(ledgerPath).filter((x) => x.kind === 'fact');
const v2f = JSON.parse(readFileSync(keyPath, 'utf8')).view;
const factsAt = (c) => ledger.filter((f) => f.at === c).map((f) => f.id);

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

const units = [];
for (const f of readdirSync(dir).filter((n) => /^R\d+\.jsonl$/.test(n)).sort()) {
  for (const u of rd(join(dir, f))) {
    const ids = u.group ? u.facts.map((x) => v2f[x.id]) : [v2f[u.conclusion.id], ...u.premises.map((p) => v2f[p.id])];
    units.push({ at: `${f.slice(0, 2)} ${u.group ? 'group ' + u.group : 'check ' + u.check}`, via: u.via || [], ids, lines: ids.length });
  }
}
const out = {};
for (const [c, [e, x]] of Object.entries(C)) {
  const E = new Set(e.flatMap(factsAt)), X = new Set(x.flatMap(factsAt));
  const together = units.filter((u) => u.ids.some((i) => E.has(i)) && u.ids.some((i) => X.has(i)));
  out[c] = together.length ? together.map((u) => `${u.at} (${u.lines} facts${u.via.length ? ', via ' + u.via.slice(0, 2).join(' ') : ''})`) : (E.size && X.size ? 'never in one unit' : 'a side has no fact');
}
console.log(JSON.stringify({ units: units.length, lines: units.reduce((a, u) => a + u.lines, 0), meet: out }, null, 1));
