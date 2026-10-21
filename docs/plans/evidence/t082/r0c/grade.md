# T082: R0c graded

*Graded by the parent on 2026-10-21, against T075's `corrections.md` and the
clauses fixed in `grade.mjs` before any reconciler reported (`0a58ad3`).
Reconcilers 1 and 2 are read at pass 1 (`rec/out-R{1,2}-pass1.jsonl`, 10 of
11 canaries each). Their reruns died at the usage limit after 38 and 23
lines, and reconciler 3 is complete. `node grade.mjs
rec/out-R1-pass1.jsonl rec/out-R2-pass1.jsonl rec/out-R3.jsonl > grade.json`
is the mechanical grade. Precision is marked in `precision.md`.*

## Recall: 7 of 12, by the rule and by hand

The two readings agree on the count but not on the members.

| # | Correction | Mechanical (`grade.json`) | By hand | The gap |
|---|---|---|---|---|
| C1 | flags "never passed" → passed once | caught | caught: PROGRESS.md against lane 10's "passed once" (R3 group 27), and `search-flipped` on four facts | — |
| C2 | S1 tests "encoder 10× too hot" → it cannot | caught | **miss**. The only credit is R3 check 1114, which says a premise is missing, not that S1 cannot test it. R2's S1 ("Screen S1, --layer-decay 0.6 …") and lane 10's "--layer-decay cannot express the hypothesis T042 is spending a fold on" both name the flag in their quotes, but were transcribed with empty `src` and `refs`, so no unit holds both | identity left to the transcriber: a referent named in a quote was not written as one |
| C3 | `budget_minutes` an upper bound → 24% optimistic | caught | caught: "an explicit upper bound" against "24 % optimistic on the slope" (R3 group 3) | — |
| C4 | under-predicts 2× → the layout multiplier | caught | caught: three conflicts on lane 7's "measured ~134 min" (R2 group 158) | — |
| C5 | rerun 1.5–4.4 h → ~113 min | miss | **miss**. Linked (R2 group 7, `m:deployed-kernel-runtime`) and marked consistent, because 113 min lies inside the bracket and the brief calls that agreement. Its consequence was flagged: lane 9's "unused ~5 h" against lane 11's "at least 427 min unused" (R3 group 11) | **not in §5.5**: no check for a reading that a sharper one supersedes |
| C6 | 2 TTA views → 3 | out of reach | out of reach | a claim in a prompt, never committed (§5.5) |
| C7 | 336–384 px in our gap → killed | caught | caught, on another pair: lane 5's 336–384 px against lane 9 §6.1's "Do not spend on it" (R1 group 9). The credited unit, R3 check 1023, only says a premise is missing | — |
| C8 | ≥0.94 band is LB overfit → falsified | miss | **out of reach**. The synthesis gives the earlier claim as "R1 §5's winner's-curse framing, *applied to the field*" (RESEARCH-0902c:464), and lane 9 calls it "the hypothesis the brief asked me to try to kill". No committed sentence states it. R1:142, on our own ~40 submissions, still holds ("still true for any individual team") | a claim in a prompt or a head (§5.5) |
| C9 | rank 776 / 84 / 2,844 → 804 / 88 / 2,889 | miss | **miss**. Linked (R1 group 29, R3 groups 8 and 46) and not marked. R3 wrote "rank 776 on 09-01 … and 804 on 09-02", and R1 wrote of 84 and 88 "lane9's dated 09-02 count" (group 94): dated readings, which the brief says are not conflicts | **not in §5.5**: no check for a later dated reading superseding an earlier one; `copy-drift` covers only copies quoted by id |
| C10 | a fold is atomic → `--resume` exists | caught | caught: `search-flipped` on three facts | — |
| C11 | `--slices 24` ~175 min → 201 | miss | **caught by all three reconcilers**: "~175 drops the 25.2 min intercept; 25.2 + 1.329 × 132 = 200.6" (R1 groups 26 and 44, R2 groups 7 and 18, R3 group 4). The grade's key named only the fit's clause (`lane11#55`) as the correction. The pairs use the fit's applications (`lane11#65`, `#113`, `#238`) | the grade key, not the design: correcting clauses were pinned one per correction |
| C12 | dropping ten unlocks three views → twelve block them | caught | caught: "unlocking three views also needs the other 12 to carry them" (R3 check 605) | — |

- **Reach:** 11 by the design's own count (§7: C6). By hand it is 10, with
  C8 out too. That reading was made after the output was known; it rests on
  the synthesis's own words.
- **Misses within reach, by hand:** C2, C5, C9.
  - C5 and C9 share one gap that v2.5 does not name: a correction that
    supersedes an earlier reading without contradicting it. The reconcilers
    applied the brief exactly. The design has no place to put these.
  - C2 is a linking failure that a mechanical rule would close: every
    `--flag`, path and identifier in a quote becomes a ref.
- **C11's own check was taken away from the reconcilers.** A check canary
  replaces a real check's conclusion, so the real unit is never shown. R2
  check 767 was the check of "~175 min". Its reconciler wrote, of the twin,
  "25.2 + 1.329 x 132 = 200.6 min, not ~427", the arithmetic that catches
  C11. All 27 check canaries removed a real check from review this way.

## Would finishing the dead reruns change it? No.

- C5's and C9's only units holding both sides were already re-marked by the
  reruns, the same way as pass 1 (R1 groups 29 and 94, R2 groups 7 and 10),
  or belong to reconciler 3, which is complete.
- C2 has no unit holding both sides. C6 and C8 have no committed claim.
- The checks the reruns never reached cannot add a real catch. Through
  `does-not-follow`, the mechanical rule could at most credit C8 (R1 check
  321, R2 check 299), whose conclusions are lane 9's own question and
  verdict.
- **Resuming them would buy only reconcilers 1 and 2's canary record.**

## Canaries: 31 of 33

- Reconciler 1 missed a group canary (group 112). It explained the twin away:
  "~215 (to 10-15) vs ~250 (to close) differ by 35 = 7 days × 5". That is a
  plausible story for a planted value.
- Reconciler 2 missed a check canary (check 158) whose premise gives no
  count, so "~25 lines" could not be refuted from it. The canary was not
  fair.
- Reconciler 2's pass 1 also printed one line of the round 3 synthesis
  through a broad `git grep` (`audit-sample.md`). The line bears on none of
  the twelve. Its marks on C5's, C9's and C11's groups were repeated by its
  rerun.

## Precision (`precision.md`)

- **Conflicts:** 49 unique pairs (74 lines): 44 real, 4 ambiguous, 1 false.
  That is 89.8% strictly and 98.0% with the ambiguous four. The floor is 90%.
  The false one is lane 10 on `apply_view` after T039 against the
  docstring from before it: facts carry no commit.
- **Does not follow:** a seeded sample of 20 of 105.
  - All 20 apply the brief's rule correctly.
  - 5 name a defect in the research, and 1 is ambiguous.
  - 14 name a premise the ledger lacks: an estimate with no derivation, or a
    premise given elsewhere.
  - As a detector of defects, that is about 1 in 4.

## Defects outside the twelve

Grep only, for whether the synthesis carries them; not read in full.

- **OOF-AUC vs Sonnet runs on 3,749 studies** (lane 3:453), not 4,349 (lane 9
  :391). **The round 3 synthesis's instrument table carries 4,349**
  (RESEARCH-0902c:381): a defect that reached a synthesis unflagged.
- Lane 11's 384 px and 448 px runtimes repeat C11's slip, in both
  directions: ~126 min should be 151.5, and ~221 should be 197. The synthesis
  quotes neither.
- Lane 9 calls 0.0028 "the nested-config sd". Lane 3 has 0.0001–0.0003, and
  0.0028 is the structurally-distinct low end, which is how the synthesis
  uses it. Lane 9's +0.0057 is also N = 8, not 7.
- Smaller ones:
  - R1's "optimistic ends" are not its own table's (four levers);
  - R1's "0.940–0.948 … top 20 to top 50": 0.940 is about rank 85;
  - lane 3's "5–10 sd" is 3.3–10;
  - R1's 11 submissions against lanes 9 and 13's 16, with no date stated;
  - ROADMAP's 2.7 h a T4 fold against R1's 4.9;
  - lane 12's 32–107 GPU-h, which matches no row of its own bill.
- T075's "~+30 min" misreading (lane 10 against lane 11) was found again.

## Costs

| | |
|---|---|
| Clauses | 2,515 in four groups (622, 656, 639, 598), and 716 in the closure cut |
| Facts and skips | G1 879 + 66, G2 861 + 71, G3 657 + 140, G4 684 + 77, cited sections 952 + 37: 4,033 facts, 391 skips |
| Minutes | registrar 2.7; transcribers 13.4, 14.9, 14.0, 11.8, 16.3 (cited sections); auditor 10.0 and rerun 10.9; reconcilers 13.9, 15.1, 16.1; two reruns died at the limit after about 4 and 2.5 |
| Wall clock | transcription about 36 min (four in parallel, then the cited sections); audit and reconciliation about 85 min |
| Runs | 13 subagent runs: 10 subagents and 3 reruns, within the amended rule |
| Audit | the rerun flagged 170 of 583 real skips `missed`; about 1 in 5 of its extra flags is a clear miss (`audit-sample.md`) |
| Review load | 286 groups (4,848 fact lines) and 1,220 checks (4,681 lines); 20,329 same-document pairs left unreviewed |
| Tokens | not reported by the harness |

## The verdict, by T082's rule

**7 of 12, below 10 of 12.** v2.5 is not accepted on the rule. The misses
are listed above. The operator accepts the figure, or sends v2.5 back.

What failed differs from R0b:
- R0b lost 6 of 12 before linking. R0c transcribed every earlier claim it
  could reach.
- The losses now sit in three places:
  - **supersession** (C5, C9), which v2.5 has no place for;
  - **refs left to the transcriber** (C2);
  - **two flaws in the measurement itself**: a key pinned one clause per
    correction (C11), and canaries that replace the units they test.

Candidate changes for a v2.6, none of them tested:
- `superseded`: a sharper or later reading of one measurand replaces the
  earlier as current. It is shown and ruled on, but it is not a conflict.
- Refs extracted mechanically from every quote.
- Canaries added beside real units. A check canary's premises must
  determine its value.
- Premise checks that tell "a premise is missing" from "the premises
  contradict it", with estimates marked as estimates.
- Facts from code carry their commit.
- The grade key pins every clause that carries a correction, as
  `key-lines.md` set out to.
