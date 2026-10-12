---
id: T062
title: "Portfolio orient, and Home's Needs-you capped"
status: open
owner: —
# type: one word; tasks of one type are timed together; `bug` counts as defect work
type: feature
# blockedReason: while blocked, one line saying what unblocks it; cleared on unblock
blockedReason: ""
depends: [T057, T060, T061]
created: 2026-10-10
---

# T062 — Portfolio orient, and Home's Needs-you capped

## Goal

`GET /api/orient?all=1` answers across 300 repositories within its budget, and Home's Needs-you shows the top 12 per reason, with counts.

## Context

- From T052, the agent's brain design: [`docs/plans/agent-brain.md`](../../docs/plans/agent-brain.md). §5.5 (`all=1`: aggregates plus the top 10).

## Steps

- [ ] Implement `all=1`.
- [ ] Cap Needs-you; keep deltas, decisions and health.

## Decision rules — fixed in advance

- No spend applies.
- Done means: the 300-repository targets in §5.5 are met, and Home and `/api/workspace` are each under 100 KB.

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
