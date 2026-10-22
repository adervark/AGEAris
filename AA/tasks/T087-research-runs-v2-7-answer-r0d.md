---
id: T087
title: "Research-runs design v2.7: answer R0d's missed canary and its loose ends"
status: claimed
owner: adervark @default/4279585a 2026-10-22 — v2.7: canary eligibility, the checker's run ids, superseded under a changed condition, C3
# type: one word; tasks of one type are timed together; `bug` counts as defect work
type: design
# blockedReason: while blocked, one line saying what unblocks it; cleared on unblock
blockedReason: ""
depends: [T085]
created: 2026-10-22
---

# T087 — Research-runs design v2.7: answer R0d's missed canary and its loose ends

## Goal

Revise [`docs/plans/research-runs.md`](../../docs/plans/research-runs.md)
and its tools so that what R0d (T085) failed on, or nearly failed on, is
answered before the held-out round, T086. The operator ruled on 2026-10-22
that R0d's missed canary stands.

## Context

- R0d's grade: `docs/plans/evidence/t085/grade.md`. Its precision marks are
  in `precision.md`.
- What it left:
  - **Check canary 498** (R2) was missed. The planted 3× could be refuted
    only through a figure in no premise, arm C's bag of 36, or by reading
    the 1.85× cost ratio as the multiple. A rule for which checks may be
    twinned, as fair as v2.6's eligibility rule, would have excluded it.
  - **`check-reconcile.mjs`** refuses a file with two run ids. Each resumed
    rerun relabelled its dead run's lines to pass it, against the brief.
  - **`superseded`** passed by one unit (28 of 31). All three ambiguous
    units turn on whether a different condition counts as a replacement:
    deployed against current code, a public tie, another recipe. The brief
    does not say.
  - **C3** sat in a unit, and both reconcilers marked the neighbouring pair
    and not it. No §5.5 check fires on a pair a reconciler passes over.
- Round 3 is in-sample. Nothing here may be tested on it again as
  acceptance, only as a check of mechanics (§10, D9).

## Steps

- [x] A canary-eligibility rule: the premises must hold the figure that
      refutes the twin. Measured on R0d's 20 check canaries: it drops 9,
      498 among them (`docs/plans/evidence/t087/measurements.md` §1). It
      is a filter; the parent writes each refutation by hand.
- [x] `check-reconcile.mjs` accepts the dead run's ids on lines it kept,
      with a test (`docs/plans/evidence/t087/check-reconcile.test.mjs`, 6
      cases).
- [x] The reconciler brief says when a different condition is a
      replacement, with an example not drawn from round 3
      (`docs/plans/evidence/t087/brief-reconciler.md`).
- [x] §5.5 says plainly that a passed-over pair is not caught. Group
      canaries now go into each reconciler's largest groups, where R0d had
      none (measurements §2).
- [ ] The operator accepts v2.7; T086's brief inherits it.

## Decision rules — fixed in advance

- **Spend:** none. Free measurements on R0d's material only. A rerun of
  any reconciler is a new task with its own rules.
- **Done:** every step is checked, and the operator accepts the revision.

## Handoff — state at last stop

*Kept true while claimed, not written on the way out (rule 8).*

- **Last touched:** 2026-10-22, adervark @default/4279585a: v2.7 is
  written in `docs/plans/research-runs.md` ("Changes since v2.6", D10).
  Its measurements, brief, checker and test are in
  `docs/plans/evidence/t087/`.
- **In flight:** nothing.
- **On disk:** all committed.
- **Next decision, the operator's:** accept v2.7, or send it back.
- **Resume with:** the operator's answer. On acceptance, mark the design's
  status accepted, close T087, and T086 waits only on the choice of round.

## Verify

Each item above links to the change that answers it, and the free
measurement of the eligibility rule is in its evidence.

## Result

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
