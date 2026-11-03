---
id: T099
title: "Bring the installed /aa up to date with skills/aa"
status: open
owner: —
# type: one word; tasks of one type are timed together; `bug` counts as defect work
type: chore
# blockedReason: while blocked, one line saying what unblocks it; cleared on unblock
blockedReason: ""
depends: []
created: 2026-10-25
---

# T099 — Bring the installed /aa up to date with skills/aa

## Goal

`~/.claude/skills/aa` matches `skills/aa` again, as T045 and T093 left it.

## Context

- On 2026-10-25, T097 changed `token()` in `skills/aa/aa.sh`. While
  `~/.agesight-data` was being moved, `/aa` read the token from the new
  folder before the server had moved it there.
- T097 declared no spend, so the installed copy was left as it was.
- Nothing breaks meanwhile: the installed copy's unsigned polls reach no
  server, because AGE Aris moves the folder before it listens. But the next
  change to `skills/aa` would widen the gap.

## Steps

- [ ] Copy `skills/aa/` over `~/.claude/skills/aa/` (the spend).
- [ ] Check that `diff -r skills/aa ~/.claude/skills/aa` is empty and that
      `/aa` still prints the board.

## Decision rules — fixed in advance

- Spend: `global-config`. `~/.claude/skills/aa/` is replaced by the
  repository's copy, the method T018, T045 and T093 used. Nothing else under
  `~/.claude` changes.
- Done when `diff -r skills/aa ~/.claude/skills/aa` is empty.

## Handoff — state at last stop

*Kept true while claimed, not written on the way out (rule 8).*

- **Last touched:** 2026-10-25, registered by adervark @default/a29cee11
- **In flight:** nothing
- **On disk:** nothing
- **Resume with:** the Steps above
- **Next decision:** none

## Verify

`diff -r skills/aa ~/.claude/skills/aa` prints nothing.

## Result

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
