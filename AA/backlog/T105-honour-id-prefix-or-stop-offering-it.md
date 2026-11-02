---
id: T105
title: "Honour `id_prefix` end to end, or stop offering it"
status: open
owner: —
# type: one word; tasks of one type are timed together; `bug` counts as defect work
type: bug
# blockedReason: while blocked, one line saying what unblocks it; cleared on unblock
blockedReason: ""
depends: []
created: 2026-11-03
---

# T105 — Honour `id_prefix` end to end, or stop offering it

## Goal

A board that sets `id_prefix` to anything but `T` works in AGE Aris, or the template and docs say the prefix is fixed.

## Context

- `AA/AA.yml` and the aa-init template offer `id_prefix` ("T001, CASE-001, CH-01").
- `T\d{3,}` is hard-coded in `lib/brief.mjs` (TASK_ID), `lib/history.mjs` (TASK_PATH, TRAIL_PATH), `lib/workspace.mjs` (TASK_FILE), `lib/tracked.mjs`, `lib/fabricate.mjs`, and `aa.sh`. A board with another prefix reads empty.
- Found in an outside analysis, checked 2026-11-03.

## Steps

- [ ] Decide: parameterize, or fix the prefix as `T` and say so. Record the choice here.
- [ ] Apply it to every reader, board.sh and the template; no backtracking regex on task text.

## Decision rules — fixed in advance

- `data-migration`: tests write only to temporary repositories and folders.
- `push`: none.
- Done means a board with the chosen behaviour reads correctly in a test on a temporary repository, and the tests pass.

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
