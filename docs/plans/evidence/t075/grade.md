# T075: R0b graded

*Graded by the parent against `corrections.md`, committed before the
transcriber ran (db6338d). Ledger: 232 facts (`ledger.jsonl`). Links:
`link.mjs` gave 234 real pairs and 6 canaries (`link-report.json`,
`pairs.json`, `canary-key.json`). Marks: the reconciler's 240 `same` lines
(`same.jsonl`).*

## Recall: 2 of 12

| # | Correction | Outcome | The step it reached | The gap (v2.4 §5.5) |
|---|---|---|---|---|
| C1 | flags "never passed" → passed once | **caught** | R1, R2 and the brief each linked to lane 10's "passed once" through `ref:--layer-decay`; all marked `conflict` (pairs 140, 220, 231) | — |
| C2 | S1 tests "encoder too hot" → it cannot | **caught** | R2's S1 linked to lane 10 §3.5; marked `conflict` (156, 198, 218) | — |
| C3 | `budget_minutes` an upper bound → 24% optimistic | miss | the earlier claim was never transcribed | it lived in a code docstring, outside the research record |
| C4 | budget model under-predicts 2× → it is the layout multiplier | miss | the earlier claim was never transcribed | it lived in R2's lane 7, read only on demand, and no fact cited it |
| C5 | rerun 1.5–4.4 h → ~113 min | miss | both transcribed (F7, F117 against F161, F162), **not linked** | the brief's and lane 9's figures cite nothing; a runtime has no code referent |
| C6 | 2 TTA views → 3 | miss | the earlier claim was never transcribed | the brief's lane 11 section was not taken as load-bearing |
| C7 | 336–384 px in our gap → killed | miss | the earlier claim was never transcribed | R1 §6 was not taken as load-bearing |
| C8 | ≥0.94 band is LB overfit → falsified | miss | the earlier claim was never transcribed | R1 §5 was not taken as load-bearing |
| C9 | rank 776 / 84 / 2,844 → 804 / 88 / 2,889 | miss | both transcribed (F1, F4, F15, F16 against F92, F93, F96), **not linked** | leaderboard figures cite nothing in git; no shared referent |
| C10 | a fold is atomic → `--resume` exists | miss | the correction was never transcribed | it came from a code commit after the lanes ran (`f896e38`), not from a lane |
| C11 | `--slices 24` ~175 min → 201 | miss | both sides are in lane 11 | linking pairs only facts from different documents |
| C12 | dropping ten unlocks three views → twelve block them | miss | lane 10 §3.3's inference was never transcribed | a clause in a list of options; "facts never transcribed" |

**By gap:**
- 6 never transcribed:
  - 4 sat in documents the transcriber read (C6, C7, C8, C12);
  - 2 sat outside the scope (C3, C4).
- 2 transcribed but not linked, because the quantities have no referent (C5, C9).
- 1 within one document (C11).
- 1 with no lane source (C10).

## Precision

- **The reconciler marked 23 pairs `conflict`.** 6 were canaries. All 17 real ones are real:
  - 7 are C1 and its consequences: conclusions resting on "never passed".
  - 7 are C2 and its consequences.
  - #94 is R1's band against R2's: a revision R2 states openly.
  - **#30 and #235 are a real defect the round 3 synthesis did not record.**
    - Lane 10 §3.3 prices a third layout pass at "~+30 min", reading the kernel's "~67 min" as covering two passes.
    - The log line is "model predicts ~67 min for the hidden-test rerun x ~2 for the extra pass(es)" (`outputs/t039/v16_log/rsna-knee-submit.log`, entry 35). So two passes are predicted at ~134 min, and lane 11 §1.5 reads it that way.
    - The synthesis neither corrects nor carries the "+30".
- **Canaries:** 6 of 6 marked `conflict`. They were not blind, though. Two had values of 1.386 and 1.419, impossible for an AUC, and the reconciler said so. `link.mjs` multiplied values without respecting their domain.
- **Warnings:** 41 `unsourced`, 39 `out-of-sight`, 4 `source-missing`, all true by construction.
  - 39 `out-of-sight` on `outputs/` logs, in one round, is too many to read. v2.1's exclusion for regenerable outputs was lost in v2.2–v2.4.

## Costs

| | |
|---|---|
| Transcriber | 13.4 min for 4 questions and 232 facts: about 3.5 s a fact, about 29 facts a document |
| Linking | 234 real pairs. Hubs: `ref:--layer-decay` alone gave 80 |
| Reconciler | 7.3 min for 240 pairs: about 1.8 s a pair |
| Tokens | not reported by the harness |
| `premises_by: transcriber` | 43 of 232 facts |
| `src_by: transcriber` | 9 searches |
| Citations fixed by the transcriber | 10 |

## The verdict, by T075's rule

**Recall 2 of 12, below 10 of 12, so T073's design goes back for revision before T077.**

Linking and reconciling worked wherever both facts were in the ledger with a shared referent: 2 of 2 corrections, every consequence, plus one real defect the hand-written synthesis missed, at 17 of 17 precision.

The design fails upstream of linking:
- what gets transcribed (6 of 12);
- quantities with no code referent (2 of 12);
- two classes it cannot reach by construction (2 of 12).
