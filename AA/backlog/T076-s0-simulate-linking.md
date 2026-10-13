---
id: T076
title: "S0: simulate linking on a fabricated round with planted conflicts"
status: open
owner: —
# type: one word; tasks of one type are timed together; `bug` counts as defect work
type: measure
# blockedReason: while blocked, one line saying what unblocks it; cleared on unblock
blockedReason: ""
depends: []
created: 2026-10-13
---

# T076 — S0: simulate linking on a fabricated round with planted conflicts

## Goal

Measure, before any code, whether facts written by one agent and reconciled by another link and catch planted conflicts, repeats and drifted copies. Two shapes the design says it cannot catch are planted too, and counted.

## Context

- [`docs/plans/research-runs.md`](../../docs/plans/research-runs.md) v2.4, §7 (S0).
- `lib/fabricate.mjs` builds the repository.
- Registered by T073 when the operator accepted v2.4 (2026-10-13).

## Steps

- [ ] Build the fabricated repository and its lane reports. Commit the plant, sealed from the agents, before they run: five linkable conflicts (two through premises, one through a negative search, two worded differently), two uncatchable shapes, three repeats, two drifted copies.
- [ ] One agent transcribes, a second reconciles, both by hand to the v2.4 format.
- [ ] Grade against the plant.

## Decision rules — fixed in advance

- Spend: `agent-fan-out`, at most two subagents, on a temporary repository only.
- Pass: every linkable conflict linked and marked `conflict`, every repeat found, at most 1 false warning per 50 facts. The two uncatchable plants are reported as counts.
- A failed pass revises the keying rules in T073's design before T078.

## Handoff — state at last stop

*Kept true while claimed, not written on the way out (rule 8).*

- **Last touched:** 2026-10-13, registered
- **In flight:** nothing
- **On disk:** nothing
- **Resume with:** the Steps above
- **Next decision:** none

## Verify

The grading table lists every plant, with what caught it or why it slipped.

## Result

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
