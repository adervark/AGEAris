---
id: T081
title: "Replay RSNA's T112 and T118, the rounds that spent, after RSNA closes"
status: open
owner: —
# type: one word; tasks of one type are timed together; `bug` counts as defect work
type: measure
# blockedReason: while blocked, one line saying what unblocks it; cleared on unblock
blockedReason: ""
depends: [T078]
created: 2026-10-13
---

# T081 — Replay RSNA's T112 and T118, the rounds that spent, after RSNA closes

## Goal

After RSNA closes on 2026-10-22, replay its T112 and T118 through stage 1, and mark each stage 2 piece: would it have changed a decision?

## Context

- [`docs/plans/research-runs.md`](../../docs/plans/research-runs.md) v2.4, §6 and §9 (R-T118).
- Registered by T073 when the operator accepted v2.4 (2026-10-13).

## Steps

- [ ] Replay both rounds through `research.sh`.
- [ ] Mark each stage 2 piece.

## Decision rules — fixed in advance

- Not before 2026-10-22. RSNA read only.
- Done means each stage 2 piece is marked, with the decision it would or would not have changed.

## Handoff — state at last stop

*Kept true while claimed, not written on the way out (rule 8).*

- **Last touched:** 2026-10-13, registered
- **In flight:** nothing
- **On disk:** nothing
- **Resume with:** the Steps above
- **Next decision:** none

## Verify

Each stage 2 piece has a verdict with its evidence.

## Result

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
