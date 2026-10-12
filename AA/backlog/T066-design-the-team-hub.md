---
id: T066
title: "Design the team hub"
status: open
owner: —
# type: one word; tasks of one type are timed together; `bug` counts as defect work
type: design
# blockedReason: while blocked, one line saying what unblocks it; cleared on unblock
blockedReason: ""
depends: [T062]
created: 2026-10-10
---

# T066 — Design the team hub

## Goal

An approved design for a shared AGE Aris that a team reads, covering network exposure, TLS, per-person auth, mirrors, the board ref per repository, and freshness.

## Context

- From T052, the agent's brain design: [`docs/plans/agent-brain.md`](../../docs/plans/agent-brain.md). D2 (register now). §5.7 of the brain design lists what the hub needs, and its constraint: a hub never emits `release` for someone else's claim.

## Steps

- [ ] Interview the operator; draft; review.

## Decision rules — fixed in advance

- `agent-fan-out` for reviews: at most 4 review subagents.
- Done means: the design is approved, or the operator decides against a hub.

## Handoff — state at last stop

*Kept true while claimed, not written on the way out (rule 8).*

- **Last touched:** 2026-10-10, registered
- **In flight:** nothing
- **On disk:** nothing
- **Resume with:** the Steps above
- **Next decision:** none

## Result

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
