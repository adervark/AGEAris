---
id: T007
title: "A board moved in one commit follows the wrong file when an id is duplicated"
status: done
owner: adervark @k/adccab68 2026-10-08 — fix the ledger across a board move
# type: one word; tasks of one type are timed together; `bug` counts as defect work
type: bug
# blockedReason: while blocked, one line saying what unblocks it; cleared on unblock
blockedReason: ""
depends: []
created: 2026-10-07
---

# T007 — A board moved in one commit follows the wrong file when an id is duplicated

## Goal

When a task's file moves in a commit that also writes another file with the
same id, the ledger follows the file at the same place under the new folder
name. RSNA's T120 keeps its own title and owner across its move to `AA/`.

## Context

- Severity high: found by T001's review of e64f823 (finding 2). The mechanism
  is older (a `pm/` → `deaddrop/` move does the same), but the rename to AA
  makes it happen on real data.
- `lib/history.mjs:365-367`: when the task's current file is deleted, the
  ledger follows `writes[0]`, the first new path in git's sorted output.
- Input: T001 done in `deaddrop/tasks/done/T001-review.md`; a later commit adds
  `T001-accumulate.md` with the same id; then `git mv deaddrop AA` in one
  commit. Actual: at the move, title and owner transitions to the second file's
  values. Expected: no field transitions at the move. Reproduced 2026-10-07.
- RSNA: `AA/tasks/done/` holds two files each for T081, T098 and T120. Its
  move is committed (38c58e5), so AGE Aris reads T120 as "Accumulate, then
  save: …" with owner `adervark @b/e59f85a4` until this is fixed. Nothing is
  lost: the ledger is rebuilt from git, so a fix corrects the reading.

## Steps

- [x] A failing test in `tests/history.test.mjs` with the minimal repository.
- [x] Follow the write at the same path under the new folder name, then the
  same file name, before falling back to `writes[0]`.
- [x] Read RSNA's T120 before and after the fix.

## Decision rules — fixed in advance

- Pass: the test passes; RSNA's T120 keeps the title "Check T119
  series-safe windows for regressions" and its owner with no field transitions
  at 38c58e5; T081 and T098 are unchanged; `npm test` passes.
- No spend: RSNA is only read.

## Handoff — state at last stop

*Kept true while claimed, not written on the way out (rule 8).*

- **Last touched:** 2026-10-08, adervark @k/adccab68 (done)
- **In flight:** nothing
- **On disk:** nothing
- **Resume with:** nothing
- **Next decision:** none

## Verify

`npm test`; the ledger of RSNA read before and after, T120 compared.

## Result

**Done.** When a task's file is deleted in a commit that writes others with
its id, the ledger follows the write at the same place under the board's new
folder name, then one with the same file name, and only then git's first
(`lib/history.mjs`, `movedTo`). Test: `tracked board: a board moved in one
commit follows each file to its own new path, even with a duplicated id
(T007)`, which failed before the fix.

Against the decision rules:

- RSNA read with `buildLedger(…, BOARD_PATHS)` before and after (RSNA only
  read). Before: T120 read "Accumulate, then save: …", owner
  `adervark @b/e59f85a4`, with title and owner transitions at 38c58e5. After:
  "Check T119 series-safe windows for regressions", owner
  `adervark @codex/01a0b8d7 2026-09-21`, no transitions at 38c58e5. T081 and
  T098 identical before and after.
- `npm test` 476 of 476 and `npm run check` pass. No spend; no trail opened.
- Log: PROGRESS.md, 2026-10-08 — T007 and T012.

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
