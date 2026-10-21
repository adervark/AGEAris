# T085: R0d graded

*Graded by the parent on 2026-10-21, adervark @default/4279585a, by the
decision rules in T085's file, fixed before the spend. `node grade.mjs >
grade.json` is the mechanical grade, run on the three complete outputs.
Precision is marked unit by unit in `precision.md`. The key is `key.json`,
pinned at `c4eca52` before any reconciler ran.*

## Verdict: not a pass. One mechanic fails: the canaries

| Rule | Result | |
|---|---|---|
| Every canary caught, after at most one rerun per reconciler | **32 of 33** | **fails** |
| `superseded` used, at least 90% real | 31 unique pairs, 28 real: **90.3%** | holds, by one unit |
| `contradicted` at least 90% real | 25 unique, 23 real: **92.0%** | holds |
| `conflict` at least 90% real | 43 unique pairs, 40 real: **93.0%** | holds |

By T085's rules the operator now decides whether v2.6 is revised before the
held-out round (T086).

## The runs

- The first three reconcilers died with their parent session, `2bb43cf0`,
  mid-pass. Each had finished all its groups. R1 had done 146 of 413 checks,
  R2 132 of 413 and R3 110 of 414. Their lines are committed as they were
  (`7359ccc`).
- Each was rerun once, the one rerun the rules allow after a death. Each
  resumed from its lines on disk (runs `4279585a.7921`, `.656b`, `.711b`).
  All three outputs are complete, and `check-reconcile.mjs` exits 0 on each.
- **Each rerun relabelled the dead run's lines with its own run id.** The
  checker refuses a file with two run ids, although the brief says to keep
  a dead run's lines. Only the `run` field changed, checked line by line
  against `7359ccc`, which keeps the original ids. That is a defect in the
  checker, not in the outputs.
- **The reruns were about twice as fast on checks.** Once their groups were
  done, the first passes did about 16 checks a minute, by the trail. The
  reruns did 267, 281 and 304 checks in 7–10 minutes, 28 to 38 a minute. The missed canary is in R2's rerun half. Of the two
  ambiguous `contradicted` units, one is from a dead run (R3 check 223) and
  one from a rerun (R3 check 1046). That is too few to show a difference in
  care.

## Canaries: 32 of 33

- R1 11 of 11, R2 10 of 11, R3 11 of 11.
- **R2 missed check canary 498.** The real conclusion is lane 12's "a card
  that is already throttling at 2×"; the twin says 3×. R2 marked it
  `unsupported`: "no premise says bag 72 is 3× armC's bag". R1, which holds
  the real check (219), marked it `follows`, citing "bag 72 (2× armC's 36)".
  The 36 is in none of the premises. So the `unsupported` exception does not
  apply, and by the rule the canary is missed.
- **Its fairness is arguable, and it is left to the operator.** The premises
  give the cost of bag 72 against arm C, 1.85×, and the VRAM, 4.25 against
  2.20 GiB, 1.93×. Neither gives the bag ratio. Read as a cost multiple, 3×
  is refuted. Read as a bag multiple, R2 is right that nothing states it.
  This canary was read for fairness before the run and kept. R2's one rerun
  went to its death, so the rules allow no further pass.

## Recall on the twelve: 8 by the rule, 7 by the reconcilers (in-sample, reported, decides nothing)

| # | Correction | By hand | The gap |
|---|---|---|---|
| C1 | flags "never passed" → passed once | **caught**: five conflicts of lane 6, PROGRESS.md and the T047 brief against lane 10's "passed once" (R1 group 14, R2 group 20); also R0c's `search-flipped` | — |
| C2 | S1 tests "encoder 10× too hot" → it cannot | **miss**. Lane 6's 10× and the S1 config sit with lane 10's "cannot express the hypothesis" (R1 groups 14 and 28, R3 group 51); the groups were marked consistent on the 10× figure. Four checks state the correction, as following from its own premises (R1 checks 1113 and 1155, R2 check 47, R3 check 712) | **not in §5.5**: the earlier claim spans two facts (the gap is 10×; S1 closes it), and no INFERRED fact joins them for a check to test |
| C3 | `budget_minutes` an upper bound → 24% optimistic | **miss**. Lane 7's "an explicit upper bound" and lane 11's "24 % optimistic … wrong in sign" are together in R2 group 62 and R3 group 3. Both reconcilers marked the neighbouring 2× pair there (C4) and not this one. R1 check 677 and R3 check 822 have the correction following from its premises. R0c caught it (R3 group 3) | a pair in a unit, not marked: **not in §5.5**; no check fires on a pair a reconciler passes over |
| C4 | under-predicts 2× → the layout multiplier | **caught**: four conflicts on lane 7's "measured ~134 min" and "2×" (R3 groups 126 and 186) | — |
| C5 | rerun 1.5–4.4 h → ~113 min | **caught**: `superseded`, "113 min … inside the bracket … replaces it" (R2 group 7, twice). R0c missed it | — (v2.6's `superseded` closes R0c's gap) |
| C6 | 2 TTA views → 3 | out of reach | a claim in a prompt, never committed (§5.5) |
| C7 | 336–384 px in our gap → killed | **caught**: "224 px and 392 px both reach ≥0.945 and our 320 px is inside" (R2 group 10) | — |
| C8 | ≥0.94 band is LB overfit → falsified | out of reach | a claim in a prompt or a head (§5.5, D7) |
| C9 | rank 776 / 84 / 2,844 → 804 / 88 / 2,889 | **caught**: seven `superseded` lines, all three figures (R1 group 108, R2 group 32, R3 group 110). R0c missed it | — (v2.6's `superseded` closes R0c's gap) |
| C10 | a fold is atomic → `--resume` exists | **caught by the rule only**: R0c's `search-flipped` on three facts, carried over. R1 check 621 contradicts the session count, not the missing `--resume` | R0c's transcriber and auditor briefs named "no --resume" |
| C11 | `--slices 24` ~175 min → 201 | **caught**: "25.2 + 175.4 = 200.6 min, not ~175 min (the intercept is dropped)" (R3 check 970) | — |
| C12 | dropping ten unlocks three views → twelve block them | **caught**: four conflicts, "dropping ten leaves the views refused" (R1 groups 80 and 88, R3 groups 3 and 18) | — |

- **By the rule: 8 of 12**, of the 10 in reach. R0c's was 7.
- **Caught by R0d's reconcilers: 7** (C1, C4, C5, C7, C9, C11, C12).
  R0d's brief carries no answer (`brief-check.mjs`), so none of the seven
  was prompted at the reconciler.
- **The ledger is R0c's, though, and so are its priming effects.** C12's
  earlier claim was the worked fact in R0c's transcriber brief. Leave C12
  out, and **6 of 12 rest on nothing any brief named**: C1, C4, C5, C7, C9
  and C11. R0c's figure was 4: C1, C3, C4 and C7.
- **Against R0c:** C5, C9 and C11 are gained, and C3 is lost.
  - C5 and C9 are the gap v2.6 added `superseded` for.
  - C11's correction was in R0c's reconciler brief and is not in R0d's. R0d
    still caught it.
  - C3 was in a unit both times. R0c marked the pair and R0d did not.
- Round 3 is in-sample: v2.6's §5.5 incidents are drawn from it. None of
  this bears on acceptance, which is T086's.

## What the operator decides

1. **The missed canary.** By the rule it fails the run. Either it stands
   and v2.6's mechanics are revised before T086, or the canary is ruled
   unfair, as R0c's check 158 was. Ruling it unfair means changing a rule
   after the result is known.
2. **The checker's run-id rule** has to change before T086, so a resumed
   output keeps its dead run's ids.
3. **`superseded` passes by one unit** (28 of 31; 27 would be 87%). Its
   three ambiguous units all come from one judgement: whether a different
   condition counts as a replacement (deployed against current code, a
   public tie, another recipe). The brief does not say.
