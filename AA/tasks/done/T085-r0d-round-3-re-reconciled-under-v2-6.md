---
id: T085
title: "R0d: round 3 re-reconciled under v2.6, graded on the same twelve"
status: done
owner: adervark @v/2bb43cf0 2026-10-21 — R0d, a check of the mechanics: the view, the key and the brief, free; then the reconcilers (go given)
# type: one word; tasks of one type are timed together; `bug` counts as defect work
type: measure
# blockedReason: while blocked, one line saying what unblocks it; cleared on unblock
blockedReason: ""
depends: []
created: 2026-10-21
---

# T085 — R0d: round 3 re-reconciled under v2.6, graded on the same twelve

## Goal

Check the mechanics of v2.6 of
[`docs/plans/research-runs.md`](../../docs/plans/research-runs.md) (§7, R0d)
on RSNA's round 3: `superseded`, the three-way checks, and canaries beside
real units. R0c's ledger is put into v2.6's view and reconciled by three
fresh reconcilers. Recall on T075's twelve corrections is reported, with a
key pinned in full before any reconciler runs. Round 3 is in-sample, so
v2.6 is accepted or not on a held-out round (T086).

## Context

- v2.6 changes nothing upstream of linking except what can be computed. So
  R0d keeps R0c's 4,033 facts (`docs/plans/evidence/t082/r0c/merged/`) and
  spends only on reconcilers. R0c's `search-flipped` results carry over: the
  ledger and its commands are the same.
- What is under test:
  - `superseded` (C5, C9);
  - refs taken from quotes (C2);
  - canaries beside real units;
  - three-way premise checks;
  - commits in the view;
  - the full key.

  The free measurements are in `docs/plans/evidence/t084/measurements.md`.
- Reach: 10 of 12. C6 and C8 are in no committed sentence (design §10, D7).

## Steps

- [x] Build the view, for free, and commit it:
  - R0c's ledger, with refs from quotes. A bare file name resolves to its
    repository path when exactly one path matches.
  - Each fact's commit, restored from the cut.
  - Groups and checks regenerated. Canaries sit beside real units, only
    eligible checks are twinned, and a check canary goes to a different
    reconciler from its real check.
- [x] Pin the key in full and commit it before any reconciler runs. For each
      correction:
  - every clause in the cut that carries its earlier claim or its
    correction, found by searching the cut for its numbers and terms;
  - one sentence on what a `why` must state to count as catching it.
- [x] Write the reconciler's brief under v2.6, and its checker. Its examples
      are not drawn from round 3. Commit both.
- [x] Run three fresh reconcilers in parallel, on the operator's go (D8).
      All three died mid-pass with their session; each was rerun once,
      resuming.
- [x] Grade as R0c was graded, with the precision marked by hand:
      `docs/plans/evidence/t085/grade.md`.

## Decision rules — fixed in advance

*Rewritten 2026-10-21, before any spend, after the operator's D9: R0d checks
v2.6's mechanics. Round 3 is in-sample, so its recall is reported and decides
nothing (design §7, §10).*

- **Spend:** `agent-fan-out`, at most 3 Opus reconciler subagents. The
  operator gave the go (D8): once the view, the key, the brief and its
  checker are committed and the brief passes its check against the key.
  - Each may be rerun once, if it misses a canary or dies. A rerun after a
    death resumes from its lines on disk; a rerun after a missed canary is
    a fresh pass, to a new file.
  - Nothing beyond that without the operator.
- **What no subagent may read:**
  - T075's `corrections.md`, R0d's key, or the round 3 synthesis;
  - T047's Result;
  - T075's, T082's, T084's or T085's evidence beyond its own view, brief and
    checker;
  - AGE Aris's `docs/plans/`, `AA/tasks/`, `PROGRESS.md` or the reviews.
- **How RSNA is read:** only with `git show`, `git grep` and `git log`,
  under `GIT_OPTIONAL_LOCKS=0`.
- **A canary is caught:**
  - in a group, by a `conflict` or `superseded` line that names its twin;
  - in a check, by `contradicted`; or by `unsupported` when the reconciler
    that holds the real check also marked it `unsupported`.
- **Precision, by hand:** the parent marks every unique `conflict` pair,
  `superseded` pair and `contradicted` check real, false or ambiguous. A
  kind with more than 60 is marked on a seeded sample of 60. Ambiguous
  counts as not real.
- **Pass:** all four hold.
  - Every canary is caught, after at most one rerun per reconciler.
  - `superseded` is used, and at least 90% of its lines are real.
  - At least 90% of `contradicted` lines are real.
  - At least 90% of `conflict` lines are real.
- **Otherwise:** the failing mechanics are listed, and the operator decides
  whether v2.6 is revised before the held-out round (T086).
- **Reported beside the verdict, not graded:** recall on the twelve.
  - A catch is one of these, and the parent judges each against the key's
    sentence:
    - a `conflict` or `superseded` line on a pair with an earlier fact and
      a correcting fact, whose `why` states the correction;
    - a `contradicted` check whose conclusion is an earlier fact, whose
      `why` states the correction;
    - `search-flipped` on an earlier fact (R0c's, carried over).
  - Shown beside R0c's 7 by the rule and 4 unprompted, with each miss's
    §5.5 gap.

## Handoff — state at last stop

*Kept true while claimed, not written on the way out (rule 8).*

- **Last touched:** 2026-10-22, adervark @default/4279585a: closed on the
  operator's ruling; see Result.
- **In flight:** nothing.

## Verify

The grade covers all twelve. Each row gives the unit, the line that caught
the correction or the furthest step it reached, and its §5.5 gap.

## Result

**Not a pass (2026-10-21), and the operator let it stand (2026-10-22).**
The full grade is in `docs/plans/evidence/t085/grade.md`, and every
precision unit is marked in `precision.md`.

| Rule | Result |
|---|---|
| Every canary caught, after at most one rerun | **32 of 33: fails.** R2 missed check 498, and its one rerun went to its death |
| `superseded` used, at least 90% real | 28 of 31: 90.3%, by one unit |
| `contradicted` at least 90% real | 23 of 25: 92.0% |
| `conflict` at least 90% real | 40 of 43: 93.0% |

- **The operator's ruling:** the canary stands. v2.6 is revised before the
  held-out round (T087, then T086).
- **Recall on the twelve, in-sample:** 8 by the rule, against R0c's 7.
  - 7 were caught by R0d's reconcilers.
  - 6 rest on nothing any brief named (R0c: 4).
  - Against R0c, C5, C9 and C11 are gained, and C3 is lost.
- **What v2.6's revision has to answer** (T087):
  - `check-reconcile.mjs` refuses a resumed output that keeps its dead
    run's ids;
  - check canary 498: a planted number whose refutation needs a figure
    that is in no premise;
  - `superseded` under a different condition, which made all three
    ambiguous units;
  - C3's pair, which sat in a unit and was passed over.

**Spend:** six Opus reconciler runs, within the operator's go (D8) and its
one rerun each. Three first passes died with session `2bb43cf0`. Three
reruns (`4279585a.7921`, `.656b`, `.711b`) resumed from their lines,
`7359ccc`. The trail is retired; git keeps it:
- `2bb43cf0`: the session; died while the reconcilers ran;
- `2bb43cf0.89c7`, `.3914`, `.cd9d`: R1–R3, died mid-pass after all groups
  and 146, 132 and 110 checks;
- `4279585a`: the session; reaped the dead runs, ran the reruns, graded;
- `4279585a.7921`, `.656b`, `.711b`: R1–R3 reruns, complete, checker exit 0.

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
