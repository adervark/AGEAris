---
id: T109
title: "Warn when STATE.md's NOW block drifts from the board"
status: open
owner: —
# type: one word; tasks of one type are timed together; `bug` counts as defect work
type: feature
# blockedReason: while blocked, one line saying what unblocks it; cleared on unblock
blockedReason: ""
depends: []
created: 2026-11-03
---

# T109 — Warn when STATE.md's NOW block drifts from the board

## Goal

`board.sh` and orient say when the NOW block has grown past about 15 lines, or says nothing is in progress while WIP is above 0.

## Context

- On 2026-11-03 this repository's NOW said "In progress: nothing" above a generated WIP 2/2, and had grown to 55 lines, against the template's "three fields, rewritten in place". It was rewritten in a7c5607.
- Found in an outside analysis, checked 2026-11-03.

## Steps

- [ ] Add the advisory to `board.sh --check` (a warning, not a failure) and to orient.
- [ ] Same in the aa-init template (T004).

## Decision rules — fixed in advance

- `data-migration`: tests write only to temporary repositories and folders.
- `push`: none.
- Done means both cases warn in a test on a temporary repository, nothing fails because of them, and the tests pass.

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
