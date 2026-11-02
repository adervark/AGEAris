---
id: T100
title: "The task-actions e2e fails 9 of 24, before T068 as after"
status: done
owner: adervark @b/cc5901e7 2026-11-03 — find what broke the task-actions e2e and fix it
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

- [x] Find the commit that broke them (`git bisect` over the e2e run).
- [x] Fix the page or the test, whichever is wrong.
- [x] `npm run e2e` passes, twice.

## Decision rules — fixed in advance

- No spend applies. The e2e runs on temporary folders only.
- Done means `npm run e2e` passes in full, twice in a row.

## Handoff — state at last stop

*Kept true while claimed, not written on the way out (rule 8).*

- **Last touched:** 2026-11-03, adervark @b/cc5901e7 (done)
- **In flight:** nothing
- **On disk:** committed in 3f2b298
- **Resume with:** nothing; closed
- **Next decision:** none

## Result

- No bisect was needed. T044 (`0e9bfbb`, 2026-10-09) broke all 9:
  - Its flow strip draws each in-progress task as a 12 px dot carrying the
    card's own `data-action="open-task"` and `data-id`, earlier in the page.
    The tests' `[data-action="open-task"][data-id=…]` found the dot. Tasks
    of the same age stack, so a click on T002's dot opened T005, and a drag
    dispatched on a dot started nothing.
  - It also rewrote the committed toast to `Claimed T001: abc1234 on main,
    not pushed.`, and the three tracked-board tests still waited for
    `Claimed T001 · abc1234 on main · not pushed`.
- The test was wrong on both counts: it now targets the board's card or row
  (`BOARD_ITEM`) and reads the current toast.
- The page had the same clash: focus going back to a replaced card, and the
  card an input-asking action focuses, used the first match, the dot. Both
  now go to the card or row (`taskOpener` in `public/app.js`), and
  `focusSelector` keeps the card's class.
- `npm run e2e` passed 27 of 27 twice in a row on `3f2b298` (both e2e files,
  about 8 s each; the failing run took 255 s on its 30 s timeouts).
  `npm test` passed 587 of 587, and `npm run check` is clean. Logged in
  PROGRESS.md, 2026-11-03.

**Spend:** none.

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
