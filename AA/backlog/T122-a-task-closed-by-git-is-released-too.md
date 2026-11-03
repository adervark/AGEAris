---
id: T122
title: "A task an agent closes with git is released by AGE Aris too"
status: open
owner: —
# type: one word; tasks of one type are timed together; `bug` counts as defect work
type: feature
# blockedReason: while blocked, one line saying what unblocks it; cleared on unblock
blockedReason: ""
depends: [T121]
created: 2026-11-03
---

# T122 — A task an agent closes with git is released by AGE Aris too

## Goal

AGE Aris's release covers tasks that reach `done/` without its Done button, so
a board can drop its own copy of the release, as the operator wants for AGEIS.

## Context

- T121 releases only on a Done taken in AGE Aris. Agents mostly close tasks by
  moving the file with git, and those never pass through it.
- So AGEIS's own copy (`f8b0f90`) cannot go yet: without it, `scratch/` there
  would refill. That copy also lacks T121's fixes to `ckpt.sh` (symlinks under
  `AA/evidence`, `scratch:` naming `.git`, an invalid `scratch:` not stopping).
- Deleting with no operator action goes past what the operator chose in T121
  ("marking a task done in AGE Aris also releases it"), and past AGENTS.md's
  exception, so the operator decides first.

## Steps

- [ ] Operator's choice: AGE Aris sweeps done tasks by itself on tracked boards
      with actions on; or it lists them with one Release action to take; or
      AGEIS keeps its own copy and gets T121's fixes.
- [ ] Then the failing test, the change, and AGEIS's copy dealt with.

## Decision rules — fixed in advance

- `data-migration` (anything in a tracked repository): tests on temporary
  repositories only; AGEIS's commit only after the operator's choice.
- `push`: none.
- Done means a test shows a task moved to `done/` by git released as chosen,
  and `npm test` and `npm run check` pass.

## Handoff — state at last stop

*Kept true while claimed, not written on the way out (rule 8).*

- **Last touched:** 2026-11-03, adervark @k/5a99efba (registered, never claimed)
- **In flight:** nothing
- **On disk:** nothing
- **Resume with:** the Steps above
- **Next decision:** the operator's choice in Steps

## Verify

## Result

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
