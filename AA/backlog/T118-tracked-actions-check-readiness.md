---
id: T118
title: "Tracked task actions refuse a claim with no decision rules or an unmet depends:"
status: open
owner: —
# type: one word; tasks of one type are timed together; `bug` counts as defect work
type: bug
# blockedReason: while blocked, one line saying what unblocks it; cleared on unblock
blockedReason: ""
depends: []
created: 2026-11-03
---

# T118 — Tracked task actions refuse a claim with no decision rules or an unmet depends:

## Goal

Claiming a tracked AA task from AGE Aris refuses, as `orient` does, when the task's decision rules are a placeholder (rule 5) or a task it depends on is not done.

## Context

- `Workspace._actOnTrackedTask`, `lib/workspace.mjs:1564-1619`; compare `lib/orient.mjs:827`.
- Found by the operator's agy (Gemini) review of 2026-11-03, step 111, and checked against the code by T111's session.

## Steps

- [ ] A failing test that shows it.
- [ ] The fix, then the test passes; `npm test` and `npm run check` pass.

## Decision rules — fixed in advance

- No spend: code and tests on temporary data only.
- Done means the failing test above passes and nothing else changed behaviour.

## Handoff — state at last stop

*Kept true while claimed, not written on the way out (rule 8).*

- **Last touched:** —
- **In flight:** nothing
- **On disk:** nothing
- **Resume with:** the Steps above
- **Next decision:** none

## Verify

On a temporary tracked board: claiming a task with `depends: [T001]` while T001 is open is refused with the same reason orient gives.

## Result

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
