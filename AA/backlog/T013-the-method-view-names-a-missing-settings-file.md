---
id: T013
title: "The Method view names a settings file the board does not have"
status: open
owner: —
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

- [ ] A failing test for a board without a settings file.
- [ ] `methodOf` sets `config` only when the file exists; `renderMethod` says
  "No settings file; the defaults apply" otherwise.

## Decision rules — fixed in advance

- Pass: the test passes, a board with the file still names it, and
  `npm test` passes.
- No spend.

## Handoff — state at last stop

*Kept true while claimed, not written on the way out (rule 8).*

- **Last touched:** 2026-10-07, adervark @k/ff713831 (registered, never claimed)
- **In flight:** nothing
- **On disk:** nothing yet
- **Resume with:** write the failing test first
- **Next decision:** none

## Verify

`npm test`; the Method view of a board without the file.

## Result

*(on completion: the outcome against the decision rules above, a pointer to the
entry in the log, and the digest from `AA/ckpt.sh close T013` — then
retire the trail with `--delete`)*

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
