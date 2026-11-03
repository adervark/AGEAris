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

- 2026-11-01, T054 (adervark @b/9ba3e0ed): the baseline is in PROGRESS.md.
  On the 303-repository fixture, the brief is 1,219 KB: its `projects` lines
  are 1,006 KB and `needsYou` only 212 KB, so a cap on Needs-you alone leaves
  Home near 1 MB. A warm brief takes 1.9–2.2 s at p95. Memory: 646–669 MB
  resident. `all=1` is not built; one orient per repository takes 24.5–27.9 s.
  Drop the `todo`s on the Home, `all=1` and memory subtests in
  `tests/perf/scale.perf.mjs`.
