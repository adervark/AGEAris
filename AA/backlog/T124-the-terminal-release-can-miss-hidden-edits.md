---
id: T124
title: "`ckpt.sh release` from a terminal can miss edits a worktree hides"
status: open
owner: —
# type: one word; tasks of one type are timed together; `bug` counts as defect work
type: bug
# blockedReason: while blocked, one line saying what unblocks it; cleared on unblock
blockedReason: ""
depends: [T122]
created: 2026-11-03
---

# T124 — `ckpt.sh release` from a terminal can miss edits a worktree hides

## Goal

A worktree with `--skip-worktree` entries, or `core.worktree` in its `config.worktree`, keeps its folder when `ckpt.sh release` runs from a terminal.

## Context

- From T122's review: `git status` does not report those edits, so a landed worktree holding them was deleted.
- AGE Aris's own release leaves every worktree alone and is not affected; this is the terminal path only.

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
