---
id: T002
title: "Bold or a link that contains inline code shows raw markers"
status: claimed
owner: adervark @k/adccab68 2026-10-08 — inline code inside bold and links; linear-time block patterns
# type: one word; tasks of one type are timed together; `bug` counts as defect work
type: bug
# blockedReason: while blocked, one line saying what unblocks it; cleared on unblock
blockedReason: ""
depends: []
created: 2026-10-07
---

# T002 — Bold or a link that contains inline code shows raw markers

## Goal

`**see `x`**` and `[the `y` docs](https://example.com)` render as bold text and
as a link with the code inside, wherever task text is shown.

## Context

- `inline()` in `public/markdown.js` cuts code spans out before it reads
  emphasis and links, so a span inside either leaves the `**` or the brackets
  raw. Seen in AGEIS's task files during the 2026-10-07 browser pass (0d55ec9).
- The comments in `public/markdown.js` explain `MAX_INLINE` and why no pattern
  may backtrack.

## Steps

- [ ] A failing test in `tests/markdown.test.mjs` for each case.
- [ ] Fix it, keeping text inside code literal: no emphasis within a span.

## Decision rules — fixed in advance

- No regex with nested or end-anchored quantifiers. A 4 MB adversarial input
  renders in well under a second, measured before and after and logged in
  `PROGRESS.md`.
- Across AGEIS's 87 task files, the blocks that show raw markers must not rise
  above 114, the count on 2026-10-07; every block whose output changes is read.
- No spend.

## Handoff — state at last stop

*Kept true while claimed, not written on the way out (rule 8).*

- **Last touched:** 2026-10-08, adervark @k/adccab68 (claimed)
- **In flight:** nothing
- **On disk:** nothing yet
- **Resume with:** write the failing tests first
- **Next decision:** none

## Verify

`npm test`; the AGEIS comparison run before and after, with the counts in `PROGRESS.md`.

## Result

*(on completion: the outcome against the decision rules above, a pointer to the
entry in the log, and the digest from `AA/ckpt.sh close T002` — then
retire the trail with `--delete`)*

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
