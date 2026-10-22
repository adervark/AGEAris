# T087: v2.7 measured for free on R0d's material

*2026-10-22, adervark @default/4279585a. No subagent ran. Everything here
reads R0d's committed files in `../t085/`; nothing in them was changed.*

## 1. Which checks may be twinned (`canary-fair.mjs`)

    node canary-fair.mjs > canary-fair.json

v2.7's rule: the premises give the figure the twin replaces, within the
conclusion's rounding (half a unit of its last digit, at most 2%). A premise
states it, or one step on two premise figures gives it: a sum, difference,
product, ratio or midpoint, or for a % conclusion a ratio or difference
read as a percentage. A one-digit figure must be stated.

| | v2.6 | v2.7 |
|---|---|---|
| R0d's 20 check canaries kept | 20 | 11 |
| Real checks eligible, outside the key's facts | 31 | 22 |

The 9 dropped, with how each was caught in R0d:

| Canary | Why v2.7 drops it | In R0d |
|---|---|---|
| R2 check 498, "throttling at 2×" → 3× | one digit, not stated | **missed**: `unsupported`, "no premise says bag 72 is 3× armC's bag" |
| R3 check 463, "≤ 7 h" → 9 h | one digit, not stated | caught |
| R3 check 46, "+0.009" → +0.023 | one digit, not stated | caught |
| R1 check 587, "~1 h" → ~2 h | one digit, not stated | caught |
| R3 check 11, "~5 h" → ~1 h | one digit, not stated | caught |
| R1 check 31, "~2.7 min/pass" → ~1.0 | 27 min ÷ ten passes, and "ten" is a word | caught |
| R1 check 236, "~50 min" → ~27 | more than one step | caught |
| R2 check 16, "~19 % per side" → ~72 | more than one step | caught |
| R2 check 820, "16 %" → 24 % | not in the premises | caught |

- The rule drops the one unfair canary, and 8 that the reconcilers caught.
  It is conservative, and it leaves fewer checks to twin. Group canaries
  make up the count where checks run short.
- So it is a filter. The parent still writes each twinned check's
  refutation from its premises alone, before any reconciler runs. R0d's
  canaries were read for fairness by hand, and 498 passed that reading. A
  written sentence has to name which multiple 3× refutes, and that is where
  498 fails.

## 2. Where group canaries sat, and C3's groups

| | |
|---|---|
| R0d's groups | 344. Median 9 facts, 75th percentile 19, 90th 37, largest 327 |
| R0d's 13 group canaries | groups of 5 to 36 facts. None in the 29 groups of 40 or more |
| C3's pair | R2 group 62 (23 facts) and R3 group 3 (118 facts, third largest). Both reconcilers marked other pairs there and not this one |

Marks per thousand pairs, by group size:

| Facts in the group | Groups | Groups with a mark | Marks per 1,000 pairs |
|---|---|---|---|
| 2–4 | 93 | 2 | 9.90 |
| 5–9 | 79 | 11 | 9.83 |
| 10–19 | 89 | 18 | 4.09 |
| 20–39 | 54 | 20 | 1.61 |
| 40 or more | 29 | 19 | 0.39 |

A large group holds more unrelated pairs, so the fall alone does not show
lost attention. Canaries in each reconciler's largest decile will show it.

## 3. The checker keeps a dead run's lines (`check-reconcile.mjs`)

    node --test docs/plans/evidence/t087/check-reconcile.test.mjs

Six cases pass:
- one run;
- a dead run, then its rerun;
- a run that writes again after another took over, refused;
- a line with no run, refused;
- a unit written by both runs, refused;
- R0d's three outputs rebuilt with the dead runs' ids from `7359ccc`. R0d's
  own checker refuses these: "lines carry 2 different runs".

## 4. The brief carries no answers

    cd ../t085 && node brief-check.mjs key.json ../t082/r0c ../t087/brief-reconciler.md ../t087/check-reconcile.mjs ../t087/check-reconcile.test.mjs

0 hits against R0d's key. The new example, a nightly build on two runners,
is from no research round. T086 checks the brief against its own key before
it runs.
