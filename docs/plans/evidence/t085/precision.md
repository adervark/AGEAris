# T085: R0d's precision, marked by hand

*Marked by the parent on 2026-10-21, adervark @default/4279585a, on every
unit `grade.mjs` wrote to `precision-units.txt` (each kind under 60, so in
full). Ambiguous counts as not real (T085's rules). Where a mark needed the
source, it was read in RSNA with `git show` at the fact's commit; those are
marked "read".*

## Conflict: 40 of 43 real (93.0%)

| Unit | Mark | Why |
|---|---|---|
| C1–C3, C5, C6, C8–C10, C43 | real | "never (once) passed" against lane 10's "passed once" (`outputs/t025/run_arm.sh:13`): C1's correction |
| C4 | real | lane 12's verdict row prices SSL at 32–107 GPU-h; its own bill (§2.2) gives 114–228 h and 228–455 h at 400/s, and no row gives 32–107 (read) |
| C7 | real | R1's "two to four points behind the field" against R2's "level with one public model" |
| C11, C13 | real | a nested-ensemble sd of 0.0001–0.0003 against lane 9's "nested-config sd of 0.0028" |
| C12, C33 | real | lane 9 against itself: nested configs at sd ≈ 0.0003, then 0.0028 for the same nested configs |
| C14 | ambiguous | T4 ~2.7 h/fold (ROADMAP, T022's recipe) against "~20 h at T4 rates" for five folds: different recipes, and neither says which it prices (read) |
| C15 | real | lane 10: dropping the ten `fold?` members unlocks three views; lane 11: twelve members block them. C12's correction |
| C16–C19, C35, C37 | real | R1 §8 sums an "optimistic end" below the top of the same lever's band in §6 (or R2 §6) |
| C20 | real | lane 12's ~132 passes (22 × 3 × 2) against lane 11's 66 units, where layouts partition members |
| C21, C22, C39, C40, C42 | real | lane 7's "measured ~134 min" and "under-predicts by 2×" against lane 11's "67 × 2 layout passes, the kernel's own prediction". C4's correction |
| C23, C24 | real | lane 5's gap in breadth and 336–384 px against lane 9's "does not survive" |
| C25 | real | the board's "~20 min" runtime cap against 9 h |
| C26 | ambiguous | R2's "arm diversity, not member count" against lane 9's breadth half not surviving: arm diversity is not plainly the breadth lane 9 rejects |
| C27 | real | tta.py's ~1 min intercept from T009 against lane 11's "the intercept is the part that was wrong" |
| C28 | real | two MEASURED FOV ranges for our series, 130–320 mm and 105–220 mm |
| C29 | real | lane 10's "~67 min for two passes" against lane 11's 67 × 2 for the two passes |
| C30 | real | +0.012 called larger than the gap to the top 20; 0.946 − 0.926 = 0.020 |
| C31 | real | "most of the parameters at full LR" against the top 31% at full LR |
| C32 | real | 11 submissions ever spent, against lane 13's dated 14 by 08-30 |
| C34 | real | the 0.936 plateau at ranks ~100–500 against 200–500 in the same snapshot |
| C36 | real | 23 timm layer levels against 24 |
| C38 | ambiguous | five Kaggle folds at 24.5 h against lane 12's loose "~20 h at T4 rates": a rounding or a different rate, not settled |
| C41 | real | the OOF-AUC-vs-Sonnet instrument at n = 3,749 against "4,349 studies" |

## Superseded: 28 of 31 real (90.3%)

| Unit | Mark | Why |
|---|---|---|
| S1 | real | R1's realistic read 0.940–0.948, raised by R2 to 0.945–0.955 |
| S2–S6, S11–S13, S16, S17, S20, S21, S24–S29, S31 | real | 09-01 leaderboard counts, ranks and cutoffs, read again on 09-02. C9's correction (S2–S6, S11–S13, S28, S29) |
| S7, S8 | real | the bracketed 1.5–4.4 h, replaced by the fitted 113 min inside it. C5's correction |
| S9 | real | "the unused ~5 h", replaced by at least 427 min from the fitted runtime |
| S10 | real | T042 as R1 planned it, replaced by R2's registration as screen S1 |
| S14 | real | tta.py at `6d10943` transforms channel 0 once; T039 (`53b985e`, 01:55 on 09-02) changed it to all three, which lane 10 reads at `e4e356c` (read) |
| S15 | ambiguous | R1's "channel 0 only" is about the deployed kernel; lane 10's "all three channels" is about the current code. Different things, not a replacement |
| S18, S19 | real | a bag-72 fold bracketed at 4–6 h; T007's ~30.5 min/epoch × 8 ≈ 4.1 h inside it |
| S22 | real | lane 10's b2 `group_matcher` "untested", then "now verified" |
| S23 | ambiguous | the TTA fix bracketed at +0.000 to +0.003; a public tie the board "cannot tell apart" is no measurement of +0.000 |
| S30 | ambiguous | T4 ~2.7 h/fold (T022's recipe) against Kaggle 4.9 h/fold for the current one: a different condition, not plainly a replacement |

One more ambiguous unit would take `superseded` under 90%.

## Contradicted: 23 of 25 real (92.0%)

| Unit | Mark | Why |
|---|---|---|
| C1 | real | armc0's running_var 5.4617 is above both 5.4378 and 5.3229, outside their spread |
| C2 | real | the premises put the plateau at ranks 200–500, not ~100–500 |
| C3 | real | the premises price SSL at 11.4 h and 114–228 h; no premise gives 32–107 GPU-h (read) |
| C4 | real | 25.2 + 1.329 × 95 = 151.5 min, not ~126 |
| C5 | real | sessions up to 3.5 h make 11.4 h at least 4 sessions; seven holds only at 1.75 h (read) |
| C6, C17 | real | 0.82²³ ≈ 0.0104: the spread starts near 0.010 (a ~96× range), not 0.006 (170×) |
| C7 | real | 3,037 series left after T007, not ~1.4k |
| C8, C12, C18, C20 | real | an "optimistic end" below the top of its lever's band |
| C9 | real | 30 mm off a 160 mm field is 18.75% in total, ~9.4% per side |
| C10 | real | the team is at 0.924, we are at 0.926: not "exactly our score" |
| C11 | real | 25.2 + 1.329 × 129.4 = 197 min, not ~221 |
| C13, C16 | real | 1.973 × 0.0028 = 0.0055 and 1.973 × 0.0070 = 0.0138, not 0.0057 and 0.0143 |
| C14 | real | "the two agree" over 24 levels against 23 |
| C15 | ambiguous | 3.5 = 42 windows ÷ 12 slices; whether that is a "slot count" ratio the premises do not settle |
| C19 | real | 0.001 ÷ (0.0001–0.0003) = 3.3–10 sd, not 5–10 |
| C21 | real | 25.2 + 1.329 × 132 = 200.6 min, not ~175. C11's correction |
| C22 | real | a mean of 1.35e-4 under a 3e-4 maximum allows at most 45% at full LR, not "most" |
| C23 | ambiguous | the band answers "none may be quoted"; centring it on one figure is a judgement, not a contradiction |
| C24 | real | "two at a time at most" against bundling three into one arm |
| C25 | real | 3,037 ÷ 21,334 = 14.2%; 12.5% is the share of all series |
