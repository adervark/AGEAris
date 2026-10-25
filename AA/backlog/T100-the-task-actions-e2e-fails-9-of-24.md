---
id: T100
title: "The task-actions e2e fails 9 of 24, before T068 as after"
status: open
owner: —
# type: one word; tasks of one type are timed together; `bug` counts as defect work
type: bug
# blockedReason: while blocked, one line saying what unblocks it; cleared on unblock
blockedReason: ""
depends: []
created: 2026-10-25
---

# T100 — The task-actions e2e fails 9 of 24, before T068 as after

## Goal

`node --test tests/e2e/task-actions.e2e.mjs` passes 24 of 24 again.

## Context

- Found by T068 on 2026-10-25. `npm run e2e` is outside `npm test`, so
  nothing ran it, and the file has not changed since T049 (`e6ca6f2`,
  2026-10-09).
- The same 9 fail at `63d17d8`, the last commit before T068's code:
  - Block (two tests), Unblock and Done.
  - Two drags.
  - Claim/Block/Done on a board with backlog/, Claim without backlog/, and
    the release with a run that never ended.
- Errors seen: `#task-dialog[open] #task-form[data-task=…:T002]` never
  appears (`task-actions.e2e.mjs:232`), and a 30 s wait at `:500`. The
  drawer, or the order of the tests' fixtures, has likely moved under them.

## Steps

- [ ] Find the commit that broke them (`git bisect` over the e2e run).
- [ ] Fix the page or the test, whichever is wrong.
- [ ] `npm run e2e` passes, twice.

## Decision rules — fixed in advance

- No spend applies. The e2e runs on temporary folders only.
- Done means `npm run e2e` passes in full, twice in a row.

## Handoff — state at last stop

*Kept true while claimed, not written on the way out (rule 8).*

- **Last touched:** 2026-10-25, registered
- **In flight:** nothing
- **On disk:** nothing
- **Resume with:** the Steps above
- **Next decision:** none

## Result

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
