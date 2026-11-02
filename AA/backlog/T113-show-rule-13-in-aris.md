---
id: T113
title: "Show rule 13 in AGE Aris: what finished tasks still hold, read-only"
status: open
owner: —
# type: one word; tasks of one type are timed together; `bug` counts as defect work
type: feature
# blockedReason: while blocked, one line saying what unblocks it; cleared on unblock
blockedReason: ""
depends: [T111]
created: 2026-11-03
---

# T113 — Show rule 13 in AGE Aris: what finished tasks still hold, read-only

## Goal

A tracked board's Method tab shows a check "environments released", and the project page a number: what its finished tasks still hold on disk, from the same scan as `AA/board.sh --litter`. AGE Aris reads sizes only; it never deletes or writes.

## Context

- `docs/plans/environments.md` S4 (T110); the release itself is T111.
- The hard constraint: AGE Aris writes to a tracked repository only through a task action.

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

Track a temporary repository whose done task holds a scratch folder: the check fails and names it; after `AA/ckpt.sh release`, it passes.

## Result

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
