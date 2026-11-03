---
id: T123
title: "A tracked repository's git config can hang AGE Aris's synchronous reads"
status: open
owner: —
# type: one word; tasks of one type are timed together; `bug` counts as defect work
type: bug
# blockedReason: while blocked, one line saying what unblocks it; cleared on unblock
blockedReason: ""
depends: [T122]
created: 2026-11-03
---

# T123 — A tracked repository's git config can hang AGE Aris's synchronous reads

## Goal

No tracked repository's files can hang the server: synchronous `git` calls in `lib/workspace.mjs` have a time limit.

## Context

- From T122's review: `[include] path=<fifo>` in a repository's config hangs `git()` forever, since `spawnSync` is called with no timeout. Reads already did this; T122's sweep now reaches them unattended.
- The sweep's own git calls have limits; `_project`'s `gitValue` does not.

## Steps

- [ ] A failing test on a temporary repository.
- [ ] The fix, then the test passes; `npm test` and `npm run check` pass.

## Decision rules — fixed in advance

- `data-migration`: tests write only to temporary repositories and folders.
- `push`: none.
- Done means the failing test above passes and nothing else changed behaviour.

## Handoff — state at last stop

*Kept true while claimed, not written on the way out (rule 8).*

- **Last touched:** 2026-11-03, adervark @k/5a99efba (registered, never claimed)
- **In flight:** nothing
- **On disk:** nothing
- **Resume with:** the Steps above
- **Next decision:** none

## Verify

## Result

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
