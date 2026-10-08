---
id: T013
title: "The Method view names a settings file the board does not have"
status: done
owner: adervark @k/adccab68 2026-10-08 — board.sh across a rename; Method view without a settings file
# type: one word; tasks of one type are timed together; `bug` counts as defect work
type: bug
# blockedReason: while blocked, one line saying what unblocks it; cleared on unblock
blockedReason: ""
depends: []
created: 2026-10-07
---

# T013 — The Method view names a settings file the board does not have

## Goal

When a board has no settings file, the Method view says the defaults apply
instead of naming a file that is not there.

## Context

- Severity low (wrong information on screen): found by T001's review of
  e64f823 (finding 5). The wording before e64f823 had the same gap.
- `lib/workspace.mjs:864` sets `config` from the folder name whether or not
  the file exists; `public/cockpit.js:356` and `:367-368` show it as the source
  of the WIP limit and the stale threshold.
- Input: link AGEION, AGEIS or RSNA, whose boards have no settings file. Actual:
  "No limit is set. From AA/AA.yml" and "stale_hours in AA/AA.yml". Expected:
  no file named; the defaults said to apply. Gem4A has the file and must still
  name it.

## Steps

- [x] A failing test for a board without a settings file.
- [x] `methodOf` sets `config` only when the file exists; `renderMethod` says
  "No settings file; the defaults apply" otherwise.

## Decision rules — fixed in advance

- Pass: the test passes, a board with the file still names it, and
  `npm test` passes.
- No spend.

## Handoff — state at last stop

*Kept true while claimed, not written on the way out (rule 8).*

- **Last touched:** 2026-10-08, adervark @k/adccab68 (done)
- **In flight:** nothing
- **On disk:** nothing
- **Resume with:** nothing
- **Next decision:** none

## Verify

`npm test`; the Method view of a board without the file.

## Result

**Done.** `methodOf` sets `config` only when the board's settings file is
there (`''` otherwise). `renderMethod` then says "No settings file; the
defaults apply" for the WIP limit and the stale threshold, instead of naming a
file that does not exist.

Against the decision rules:

- Tests: a tracked `AA/` board without `AA.yml` gives `config: ''` (workspace
  test), and its Method view names no `.yml` and says the defaults apply twice
  (cockpit-ui test). Both fail without the fix. The `deaddrop/deaddrop.yml`
  board still names its file, and so does an own project's `AA/AA.yml`.
- `npm test` 477 of 477 and `npm run check` pass. No spend.
- Log: PROGRESS.md, 2026-10-08 — T011 and T013.

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
