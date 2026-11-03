---
id: T106
title: "Edit `depends` on AGE Aris's own projects"
status: open
owner: —
# type: one word; tasks of one type are timed together; `bug` counts as defect work
type: feature
# blockedReason: while blocked, one line saying what unblocks it; cleared on unblock
blockedReason: ""
depends: []
created: 2026-11-03
---

# T106 — Edit `depends` on AGE Aris's own projects

## Goal

A task on an AGE Aris project can name what it builds on, from the drawer and the API, and the Threads view shows it.

## Context

- New task files are written with `depends: []` (`lib/workspace.mjs` renderTask). Tracked boards set `depends:` by hand, and Threads reads it.
- Not checked yet: whether `updateTask` and the frontmatter writer can take a list.
- Found in an outside analysis, partly checked 2026-11-03.

## Steps

- [ ] Check `updateTask` and the frontmatter writer.
- [ ] Add the field to the API, the drawer and capabilities.

## Decision rules — fixed in advance

- `data-migration`: tests write only to temporary repositories and folders.
- `push`: none.
- Done means a dependency set in the drawer survives a save and shows in Threads, and the tests pass.

## Handoff — state at last stop

*Kept true while claimed, not written on the way out (rule 8).*

- **Last touched:** 2026-11-03, adervark @b/cc5901e7 (registered, never claimed)
- **In flight:** nothing
- **On disk:** nothing yet
- **Resume with:** the Steps above
- **Next decision:** none

## Result

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
