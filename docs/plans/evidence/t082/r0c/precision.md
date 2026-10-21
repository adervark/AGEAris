# T082 R0c: precision, marked by hand

*Marked by the parent on 2026-10-21, after the grade's numbers were known.
The units are listed by `precision.mjs` (`precision-units.txt`); reconcilers 1
and 2 are read at pass 1. RSNA was read with `git show` and `git grep` only.*

**Real** means the two facts cannot both be true of one thing as written, or
one states its correction of the other (the brief: "a later document
correcting an earlier one is still a conflict"), or a figure disagrees with
the other's arithmetic. **False** means both hold as written. **Ambiguous**
means it turns on a reading the text leaves open.

## Conflicts: 49 unique pairs (74 lines), 44 real, 4 ambiguous, 1 false

Strictly 44 of 49 (89.8%), and 48 of 49 (98.0%) if the ambiguous four are
real. The floor is 90%.

| | Pair | Mark | Why |
|---|---|---|---|
| P1 | V1937/V3634 | real | C1: lane 6 "never once passed" against lane 10 |
| P2 | V1937/V3349 | real | C1 |
| P3 | V2746/V2997 | real | lane 12's summary prices in-domain SSL at 32–107 GPU-h; its own bill (:280) has 114–455 h for the published objectives and 2.8–11.4 h for truncated runs. No row gives 32–107 |
| P4 | V1378/V3273 | real | lane 9 corrects lane 5's "breadth" half |
| P5 | V1410/V1541 | real | C7 in substance: lane 5's 336–384 px against lane 9 §6.1's "Do not spend on it" |
| P6 | V333/V701 | real | R1: 11 submissions ever spent; lanes 9 and 13: 16 to date. No date difference stated |
| P7 | V1765/V2053 | real | C1 |
| P8 | V2545/V2631 | real | C11 in substance: ≈1.36 min a unit gives ≈203 min, not ~175 |
| P9 | V1765/V3349 | real | C1 |
| P10 | V2488/V2631 | real | C11 in substance: 25.2 + 1.329 × 132 = 200.6 min |
| P11 | V2488/V2651 | real | C11's slip at 384 px: 151.5 min, not ~126 |
| P12 | V2488/V2652 | real | the slip the other way at 448 px: 197 min, not ~221 (1.96 × 113 scales the intercept too) |
| P13 | V3019/V4050 | ambiguous | "~20 h" for five folds lies between 2.7 h a fold (13.5) and 4.9 (24.5): an estimate |
| P14 | V2514/V3823 | real | C4 |
| P15 | V88/V492 | real | R2 re-measured our FOV at 105–220 mm against R1's 130–320 mm |
| P16 | V89/V322 | ambiguous | 30 of 160 mm is 19% of each axis, 9% of each edge; "per side" reads either way |
| P17 | V243/V377 | real | R1's "optimistic end" for the mm crop is +0.005; its own table's is +0.008 |
| P18 | V56/V3242 | real | lane 3's +0.012 "larger than the entire remaining gap to the top 20" against R1's +0.020 (R1:25 has the top-20 cutoff at 0.937 before and 0.946 now) |
| P19 | V217/V4050 | real | a Kaggle fold at 4.9 h (R1) and the T4 at 2.7 h a fold (ROADMAP), both at `d9c7c6e`, no condition stated |
| P20 | V217/V3019 | ambiguous | as P13 |
| P21 | V266/V379 | real | R1's optimistic end for the diversity arm is +0.005; its table's is +0.006 |
| P22 | V2492/V3822 | real | lane 7's "measured ~134 min" against lane 11's "still not measured" |
| P23 | V2631/V2700 | real | C11 in substance, against lane 11's own +88 |
| P24 | V2651/V2708 | real | P11's slip, against lane 11's own +39 |
| P25 | V2476/V2652 | real | P12's slip, against the fit |
| P26 | V59/V430 | real | R2 corrects R1: "not two to four points behind" |
| P27 | V422/V1347 | ambiguous | R2: the forum's single-model figures are unverified; lane 9: the posters' board positions corroborate their scores. Whether "single model" is corroborated is left open |
| P28 | V1772/V1774 | real | C1, stated by lane 10 itself: "all say never" against "passed once" |
| P29 | V1205/V1231 | real | lane 9 gives the nested-config sd as ≈0.0003 and as 0.0028 |
| P30 | V434/V3926 | real | the Raptor's gold-58 at 0.9054 (R2) and 0.9167 (lane 7); R2 calls the figures irreconcilable |
| P31 | V92/V491 | real | R2's measured 2.1× scale spread against R1's 1.39× |
| P32 | V382/V652 | real | R2 revises R1's expectation openly; T075 marked the same pair real (#94) |
| P33 | V252/V378 | real | the recipe: +0.005 summed, +0.010 in the table |
| P34 | V242/V377 | real | as P17, from the clause's other fact |
| P35 | V235/V376 | real | the second sequence family: +0.010 summed, +0.015 in the table |
| P36 | V2512/V3822 | real | C4: lane 11 reads lane 7's "measured" 134 min as the kernel's prediction |
| P37 | V2500/V3820 | real | C3 in substance |
| P38 | V122/V3130 | real | R1 reproduced the 2.5D packing collapse; the `tta.py` docstring at `6d10943` says the channels are one slice repeated, the bug T039 fixed |
| P39 | V2168/V2512 | real | lane 10's "~67 min for two passes" against lane 11's "67 × 2 layout passes": T075's #30 again |
| P40 | V1624/V2543 | real | C5's consequence: lane 9's "unused ~5 h" against lane 11's "at least 427 min unused" |
| P41 | V2545/V2958 | real | lane 12's "~132 passes" against lane 11's 66 forward units: C4's 2× again |
| P42 | V1228/V1229 | real | 0.0028 × √(2 ln 7) = 0.0055, not 0.0057 (that is N = 8) |
| P43 | V1772/V3341 | real | C1 |
| P44 | V1772/V3634 | real | C1 |
| P45 | V2145/V3130 | **false** | lane 10 describes `apply_view` after T039 (`53b985e`); the docstring is from `6d10943`, before it. Facts carry no commit, so the reconciler could not tell |
| P46 | V1231/V3249 | real | lane 9's "nested-config sd 0.0028" against lane 3's 0.0001–0.0003; 0.0028 is lane 3's structurally-distinct low end |
| P47 | V3249/V3250 | real | at sd 0.0001–0.0003 a +0.001 step is 3.3–10 sd, not 5–10 |
| P48 | V1503/V3310 | real | OOF-AUC vs Sonnet: 4,349 studies (lane 9) against 3,749 (lane 3:453). 4,349 is the Opus rows' n. **The round 3 synthesis carries 4,349 (RESEARCH-0902c:381)** |
| P49 | V2511/V3823 | real | C4 |

## Does not follow: a sample of 20 of 105

All 20 apply the brief's rule correctly. Only 5 point at a defect in the
research, plus one ambiguous. The other 14 name a premise the ledger lacks:
an estimate with no derivation, or a premise the lane gave elsewhere. As a
detector of defects, that is 5 to 6 of 20, far under the floor.

| | Check | Mark | Why |
|---|---|---|---|
| D1 | R3 1156 | missing premise | "one fold, ~5 lines" is an estimate |
| D2 | R3 1023 | missing premise | only our side is given; this is the line the mechanical grade credits to C7 |
| D3 | R1 88 | missing premise | an estimate |
| D4 | R2 127 | **defect** | 0.940 is about rank 85 on the same board (84 teams ≥0.94), not "top 50" |
| D5 | R1 91 | missing premise | an estimate |
| D6 | R2 286 | missing premise | the rules text that separates the tracks is not among the premises |
| D7 | R3 391 | missing premise | |
| D8 | R1 923 | missing premise | the kernel's runtime is not a premise |
| D9 | R3 70 | missing premise | an estimate |
| D10 | R1 84 | missing premise | an estimate |
| D11 | R3 597 | missing premise | |
| D12 | R3 83 | missing premise | an estimate |
| D13 | R3 1018 | **defect** | 3.3–10 sd, not 5–10 (P47) |
| D14 | R1 77 | missing premise | a rank needs the other levers |
| D15 | R1 777 | **defect** | the 448 px slip (P12) |
| D16 | R1 79 | missing premise | an estimate |
| D17 | R1 71 | missing premise | |
| D18 | R3 605 | **defect** | C12 |
| D19 | R2 1016 | **defect** | the gap from 0.926 is +0.020 (P18) |
| D20 | R3 28 | ambiguous | "the riders moved the overfit point" has no comparison run among its premises; the lane may have one elsewhere |
