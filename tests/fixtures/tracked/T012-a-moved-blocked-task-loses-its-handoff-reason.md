---
id: T012
title: "A blocked task loses its Handoff reason when its file moves"
status: open
owner: —
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

- [ ] A failing test.
- [ ] The ledger records where each task's file is after every move, without a
  transition the metrics or the changes feed would count; `_bodiesOf` reads it.

## Decision rules — fixed in advance

- Pass: the test passes; every other metric and brief test is unchanged
  (`ctx.lastCommit` still names the task's last real change).
- No spend.

## Handoff — state at last stop

*Kept true while claimed, not written on the way out (rule 8).*

- **Last touched:** 2026-10-07, adervark @k/ff713831 (registered, never claimed)
- **In flight:** nothing
- **On disk:** nothing yet
- **Resume with:** write the failing test first
- **Next decision:** none

## Verify

`npm test`; the input above before and after.

## Result

*(on completion: the outcome against the decision rules above, a pointer to the
entry in the log, and the digest from `AA/ckpt.sh close T012` — then
retire the trail with `--delete`)*

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
