---
id: T012
title: "A blocked task loses its Handoff reason when its file moves"
status: done
owner: adervark @k/adccab68 2026-10-08 — fix the ledger across a board move
# type: one word; tasks of one type are timed together; `bug` counts as defect work
type: bug
# blockedReason: while blocked, one line saying what unblocks it; cleared on unblock
blockedReason: ""
depends: []
created: 2026-10-07
---

# T012 — A blocked task loses its Handoff reason when its file moves

## Goal

A blocked task whose reason is only its Handoff's **Next decision** line
keeps that reason after its file is renamed or its board folder moves.

## Context

- Severity low, older than e64f823 (a `pm/` → `deaddrop/` move or a slug rename
  does it too): found by T001's review of e64f823 (finding 4).
- `_bodiesOf` (`lib/brief.mjs:351`) reads each blocked task's file at the path
  of its last transition. A move that changes nothing else emits no transition
  (`lib/history.mjs:408-412`), so the old path is read, finds nothing, and
  `blockedReasonOf` falls through to "No reason given".
- Input: `deaddrop/tasks/T001-licence.md`, blocked, `blockedReason: ""`, no
  trail, Handoff `- **Next decision:** ask legal whether the dataset licence
  allows redistribution`; then `git mv deaddrop AA` in one commit. Actual:
  "No reason given" (source `none`). Expected: the Handoff line (source
  `handoff`). Reproduced 2026-10-07.
- None of the four real repositories is affected today (their reasons come from
  `blockedReason:` or a checkpoint).

## Steps

- [x] A failing test.
- [x] The ledger records where each task's file is after every move, without a
  transition the metrics or the changes feed would count; `_bodiesOf` reads it.

## Decision rules — fixed in advance

- Pass: the test passes; every other metric and brief test is unchanged
  (`ctx.lastCommit` still names the task's last real change).
- No spend.

## Handoff — state at last stop

*Kept true while claimed, not written on the way out (rule 8).*

- **Last touched:** 2026-10-08, adervark @k/adccab68 (done)
- **In flight:** nothing
- **On disk:** nothing
- **Resume with:** nothing
- **Next decision:** none

## Verify

`npm test`; the input above before and after.

## Result

**Done.** Each commit in the ledger now carries `moves`: every task whose
file changed path in it, recorded whether or not anything else changed. They
are not transitions, so no metric and no changes feed counts them.
`taskPaths(view)` (`lib/history.mjs`) gives each task's newest path from its
transitions and moves, and `_bodiesOf` reads the Handoff there.

Against the decision rules:

- Tests: `taskPaths knows where a task file is after a move that changes
  nothing else (T012)` (history: `deaddrop/` → `AA/` in one commit, and a past
  view still reads the old path), and `a blocked task keeps its Handoff reason
  after its file is renamed…` (brief, end to end). The second reads
  "No reason given" / `none` without the fix, and the Handoff line / `handoff`
  with it.
- Every other test unchanged: `npm test` 476 of 476, `npm run check` passes.
  `ctx.lastCommit` is untouched, since moves are not transitions.
- No spend; no trail opened.
- Log: PROGRESS.md, 2026-10-08 — T007 and T012.

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
