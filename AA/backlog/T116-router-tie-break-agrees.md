---
id: T116
title: "Router: the scoreboard's order and the chosen agent agree on a tie"
status: open
owner: —
# type: one word; tasks of one type are timed together; `bug` counts as defect work
type: bug
# blockedReason: while blocked, one line saying what unblocks it; cleared on unblock
blockedReason: ""
depends: []
created: 2026-11-03
---

# T116 — Router: the scoreboard's order and the chosen agent agree on a tie

## Goal

On equal scores the scoreboard lists the chosen agent first. Today `ranked` breaks a tie by tier then id, and `scoreboard.sort` by id only, so the chosen agent can be the second row while its reason says "highest score".

## Context

- `lib/router.mjs:106-109`.
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

Two eligible agents with the same score and different tiers: `chosen` equals `scoreboard[0].agentId`.

## Result

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
