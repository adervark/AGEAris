---
id: T086
title: "H1: research-runs v2.6 replayed on a round it was not built from"
status: open
owner: —
# type: one word; tasks of one type are timed together; `bug` counts as defect work
type: measure
# blockedReason: while blocked, one line saying what unblocks it; cleared on unblock
blockedReason: ""
depends: [T085, T087]
created: 2026-10-21
---

# T086 — H1: research-runs v2.6 replayed on a round it was not built from

## Goal

Accept or reject v2.6 of
[`docs/plans/research-runs.md`](../../docs/plans/research-runs.md) on a
research round that none of its incidents and none of its briefs' examples
came from (§7, H1; §10, D9).

## Context

- Every replay so far (R0b, R0c, R0d) used RSNA's round 3. The design's §5.5
  incidents come from it, and so did R0c's brief examples. A pass there is
  in-sample (v2.6 item 7).
- The operator chooses the round. RSNA's T112 is a candidate. T118 is not:
  it supplies `instrument-unresolved`'s incident.
- The procedure is R0c's in full: the cut, transcribers, the blind auditor,
  linking, three reconcilers. About 13 subagent runs. A key of its own is
  pinned before any subagent runs.
- R0d (T085) checks v2.6's mechanics first, so a mechanics failure is not
  bought at this price. R0d did not pass (one canary of 33). The operator
  let that stand, so v2.6 is revised first (T087). T086 runs under v2.7:
  its reconciler brief and checker start from
  `docs/plans/evidence/t087/`, and its check canaries follow v2.7 item 1.

## Steps

- [ ] The operator chooses the round.
- [ ] Write the decision rules here: the round, its key, the bar, the spend.
- [ ] Cut, transcribe, audit, link, reconcile, grade.

## Decision rules — fixed in advance

*(Not written yet. The round is chosen first; this task is not ready until
its rule is here, rule 5.)*

## Handoff — state at last stop

*Kept true while claimed, not written on the way out (rule 8).*

- **Last touched:** 2026-10-21, registered by T085 when the operator ruled
  D9
- **In flight:** nothing
- **On disk:** nothing
- **Resume with:** the operator's choice of round. v2.7 is accepted
  (T087, 2026-10-22)
- **Next decision:** which round

## Verify

The grade covers every correction in the round's key, each with the unit
that caught it or the furthest step it reached.

## Result

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
