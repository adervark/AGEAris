---
id: T007
title: "A board moved in one commit follows the wrong file when an id is duplicated"
status: claimed
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

- [ ] A failing test in `tests/history.test.mjs` with the minimal repository.
- [ ] Follow the write at the same path under the new folder name, then the
  same file name, before falling back to `writes[0]`.
- [ ] Read RSNA's T120 before and after the fix.

## Decision rules — fixed in advance

- Pass: the test passes; RSNA's T120 keeps the title "Check T119
  series-safe windows for regressions" and its owner with no field transitions
  at 38c58e5; T081 and T098 are unchanged; `npm test` passes.
- No spend: RSNA is only read.

## Handoff — state at last stop

*Kept true while claimed, not written on the way out (rule 8).*

- **Last touched:** 2026-10-08, adervark @k/adccab68 (claimed)
- **In flight:** nothing
- **On disk:** nothing yet
- **Resume with:** write the failing test first
- **Next decision:** none

## Verify

`npm test`; the ledger of RSNA read before and after, T120 compared.

## Result

*(on completion: the outcome against the decision rules above, a pointer to the
entry in the log, and the digest from `AA/ckpt.sh close T007` — then
retire the trail with `--delete`)*

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
