---
id: T061
title: "A slim `/api/workspace`: delivered history paged"
status: open
owner: —
# type: one word; tasks of one type are timed together; `bug` counts as defect work
type: feature
# blockedReason: while blocked, one line saying what unblocks it; cleared on unblock
blockedReason: ""
depends: [T054]
created: 2026-10-10
---

# T061 — A slim `/api/workspace`: delivered history paged

## Goal

`/api/workspace` stops sending delivered tasks and descriptions. Those are paged and fetched per task, and the UI follows.

## Context

- From T052, the agent's brain design: [`docs/plans/agent-brain.md`](../../docs/plans/agent-brain.md). §5.5 and §2. Delivered tasks with descriptions are 242 KB of today's 316 KB.

## Steps

- [ ] Change the endpoint and the page that reads it.
- [ ] e2e for the pages that showed delivered tasks.

## Decision rules — fixed in advance

- No spend applies.
- Done means: the payload is under 100 KB on T054's fixture, `npm test`, `npm run check` and e2e pass, and nothing a person could see before is lost.

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
