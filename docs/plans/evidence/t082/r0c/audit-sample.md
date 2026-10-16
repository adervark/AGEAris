# R0c: how good are the auditor's `missed` flags?

*Parent's judgement, 2026-10-17, on a seeded sample (seed 17) of 25 of the
153 real skips that the rerun flagged `missed` and pass 1 passed `ok`.*

| Pass | Canaries caught | Real skips flagged `missed` | Minutes |
|---|---|---|---|
| 1 (`audit-1.jsonl`) | 74 of 81 | 19 of 583 | 9 |
| rerun (`audit.jsonl`) | 81 of 81 | 170 of 583 | 10 |

The two passes agree on 17 flags. The rerun's brief added a rule for table
cells, written after pass 1 passed six canaries that were value cells: "a
cell that holds a value … is part of its row's claim". That rule matches the
canaries' form, so **the rerun's 81 of 81 overstates its recall on
omissions**: part of it was taught by pass 1's misses.

## The sample: 25 flags only the rerun raised

| Judgement | n | Clauses |
|---|---|---|
| A claim worth a fact | 5 | `lane10#453` (a layer-decay value, 0.85), `lane11#128` (OOF rho over 4,349 studies), `lane9#74` (the snapshot time, 09-01 18:44Z), `lane13#117` (a submission id), `lane9#36` (0.001 resolution, MEASURED) |
| Arguable: an evidence mark, a date, or a fragment that completes the line before | 8 | `lane13#30`, `lane11#142`, `lane6…§183#5`, `lane6…§174#5`, `lane9#355`, `lane9#285`, `lane11#64`, `lane11#10` |
| Over-called: a row key that only names its subject (a flag, an env var, a plane, a task link) or a title | 12 | `lane10#146`, `#150`, `#165`, `#262`, `#297`, `#303`, `#531`, `lane12#300`, `#312`, `R2#176`, `lane11#1`, `lane9#540` |

So about 1 in 5 of the rerun's extra flags is a clear miss, and about half
are noise from the table-cell rule. Under v2.5 every `missed` flag goes back
to the claimant, so at this rate the rerun costs about 150 needless facts on
one round to recover about 30.

## What it says about the design

- Canaries drawn from "clauses with a digit, written only as facts" include
  table row keys whose claim sits in the next cell. They test whether the
  auditor reads a value cell as part of its row, a question the brief must
  settle before the pass, not a property of the auditor.
- A canary rate is a recall measure only while the brief does not change in
  response to which canaries were missed.
