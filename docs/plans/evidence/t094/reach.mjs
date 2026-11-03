#!/usr/bin/env node
// T094 H2: the viability gate, computed from the pinned key (H1's, t086/reach.mjs). Run from this
// folder after key.json is pinned:
//
//   node reach.mjs
//
// - every clause id the key pins exists in the cut;
// - a correction marked in reach has an earlier and a correcting clause in
//   different documents (a file at two commits is two documents here:
//   `<doc>` and `<doc>@<commit>`), so the pipeline can bring them together;
// - T094 spends only if at least 8 corrections are in reach.
// Exits 1 when an id is missing, a marked reach does not hold, or the gate
// fails.

import { readFileSync } from 'node:fs';

const clauses = new Map(readFileSync('cut/clauses.jsonl', 'utf8').split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l)).map((c) => [c.id, c]));
const key = JSON.parse(readFileSync('key.json', 'utf8')).corrections;
const GATE = 8;
let bad = 0;
const rows = [];
for (const [k, c] of Object.entries(key)) {
  for (const id of [...c.earlier, ...c.correction]) if (!clauses.has(id)) { console.log(`${k}: ${id} is not in the cut`); bad++; }
  const pairs = c.earlier.flatMap((e) => c.correction.filter((x) => x !== e && clauses.get(x)?.doc !== clauses.get(e)?.doc).map((x) => `${e} / ${x}`));
  const reach = pairs.length > 0;
  if (c.reach !== reach) { console.log(`${k}: marked reach ${c.reach}, computed ${reach}`); bad++; }
  rows.push({ k, reach, crossDocPairs: pairs.length, example: pairs[0] || c.reachWhy });
}
const n = rows.filter((r) => r.reach).length;
for (const r of rows) console.log(`${r.k}  ${r.reach ? 'in reach ' : 'out      '}  ${r.crossDocPairs} pairs  ${r.example}`);
console.log(JSON.stringify({ corrections: rows.length, inReach: n, gate: GATE, passes: n >= GATE && !bad }));
process.exit(n >= GATE && !bad ? 0 : 1);
