# T075: the answer key, the corrections RSNA's round 3 synthesis records

*Committed before the transcriber runs; the transcriber and the reconciler are
forbidden to read this file. Source: RSNA `docs/RESEARCH-0902c-round-3.md` at
`e4e356c`. The synthesis counts them itself at :642–643: "ten corrections to
what was already on the board (§8.1), and two corrections to the round-3 lane
reports themselves (§4's arithmetic slip, §8.3's contradiction)".*

| # | Earlier claim | Where it lived | Round 3's correction | From |
|---|---|---|---|---|
| C1 | `--layer-decay`/`--warmup-frac` were never once passed | R2 §2 screen S1; R1 §2 table; `PROGRESS.md:5857`; lane 6 :185, :219; `scripts/t042/run_recipe_fold0.sh:7` | passed once, `outputs/t025/run_arm.sh:12-13` | lane 10 §2.1 |
| C2 | S1 tests "the encoder runs 10× too hot" | R2 §2; T042's title | it cannot: `--layer-decay 0.6` puts 24 of 48 groups below 1e-6; T042 answers graded decay | lane 10 §3.5 |
| C3 | `budget_minutes = 1 + M·V` is an upper bound | `src/tta.py:324` docstring | optimistic by 24%; slope 1.329 min/unit; shape `1 + Σ_layouts(M·V)` | lane 11 §1.5 |
| C4 | the budget model under-predicts by 2× in practice | R2 lane 7 §3.4 | the 2× is the kernel's layout multiplier, not a modelling error | lane 11 §1.5 |
| C5 | the deployed rerun takes 1.5–4.4 h | R1, R2, the T047 brief | ~113 min, fitted | lane 11 §1.4 |
| C6 | the deployed kernel runs 2 TTA views | the T047 lane-11 brief | 3: `id, crop, bright` | lane 11 §1.1 |
| C7 | 336–384 px is part of our input gap | R1 §6; lane 5 §1.3 | killed: the band spans 224–392 px | lane 9 §6.1 |
| C8 | the ≥0.94 band may be public-LB overfit from submission spending | R1 §5 | falsified for the band as a population: 86 control teams at {0.936, 0.937} | lane 9 §2 |
| C9 | rank 776, 84 teams ≥0.94, 2,844 teams | R1 §1 | 804 / 88 / 2,889 | lane 9 §0, §1.2 |
| C10 | a fold is atomic because `train.py` has no `--resume` | `CLAUDE.md`; lane 12 §2.3; R1 §7 | superseded: `--resume` exists | synthesis (lane 12's own claim corrected) |
| C11 | `--slices 24` costs ~175 min | lane 11 §2.1 | 201 min on the lane's own model | synthesis §4 (:225) |
| C12 | dropping the ten `fold?` members unlocks three TTA views | lane 10 §3.3 | twelve members block the views; dropping ten does not unlock them | synthesis §8.3, from lane 11 §2.6 |

## How each is graded

- **Caught:** the ledger holds a fact for the earlier claim and one for the
  correction; the two are linked by a shared referent under v2.4's rules; the
  reconciler marks the pair `conflict`.
- **Otherwise, the furthest step reached is recorded:**
  - the earlier claim not transcribed;
  - the correction not transcribed;
  - transcribed but not linked;
  - linked but marked `agree` or `unrelated`.

  Each miss is tied to the §5.5 gap that let it through.
- Earlier claims that lived only outside research documents (code docstrings,
  `PROGRESS.md`, `CLAUDE.md`, task titles) count against stage 1 like any
  other. Stage 1 backfills research rounds, not every copy.
