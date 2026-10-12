---
id: T067
title: "Design: claims that count across machines"
status: open
owner: —
# type: one word; tasks of one type are timed together; `bug` counts as defect work
type: design
# blockedReason: while blocked, one line saying what unblocks it; cleared on unblock
blockedReason: ""
depends: []
created: 2026-10-10
---

# T067 — Design: claims that count across machines

## Goal

A decided design for claim races between machines: fetch and rebase, where a conflict on the task file means the race is lost and a clean rebase means push again. It is a per-board `AA.yml` key, never a fork of RULES.md.

## Context

- From T052, the agent's brain design: [`docs/plans/agent-brain.md`](../../docs/plans/agent-brain.md). §6 of the brain design. v1's D1 was taken out; the reviews corrected its push semantics. Note that `push` is a spend here.

## Steps

- [ ] Draft; review; decide with the operator.

## Decision rules — fixed in advance

- `agent-fan-out` for reviews: at most 2 review subagents.
- Done means: the operator has decided, and the decision is recorded.

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
