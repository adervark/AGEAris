---
id: T002
title: "Bold or a link that contains inline code shows raw markers"
status: done
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

- [x] A failing test in `tests/markdown.test.mjs` for each case.
- [x] Fix it, keeping text inside code literal: no emphasis within a span.

## Decision rules — fixed in advance

- No regex with nested or end-anchored quantifiers. A 4 MB adversarial input
  renders in well under a second, measured before and after and logged in
  `PROGRESS.md`.
- Across AGEIS's 87 task files, the blocks that show raw markers must not rise
  above 114, the count on 2026-10-07; every block whose output changes is read.
- No spend.

## Handoff — state at last stop

*Kept true while claimed, not written on the way out (rule 8).*

- **Last touched:** 2026-10-08, adervark @k/adccab68 (done)
- **In flight:** nothing
- **On disk:** nothing
- **Resume with:** nothing
- **Next decision:** none

## Verify

`npm test`; the AGEIS comparison run before and after, with the counts in `PROGRESS.md`.

## Result

**Done.** `inline()` stands each code span in the text as a private-use mark
(U+E000, its index, U+E001) while emphasis and links are read, then puts the
spans back. So bold, emphasis and link labels can hold code, and nothing
inside a span is read as markup. A link whose target holds a span is no link.
Text that already holds U+E000 keeps the old reading, so a mark cannot be
forged. The span's backticks are trimmed by hand (no `` `+$ ``).

Against the decision rules:

- No new regex with nested or end-anchored quantifiers. The 4 MB adversarial
  input (`**`x`** [`y` z](…) _a_ ```` repeated, 4,180,000 chars) renders in
  21 ms before and 21 ms after.
- AGEIS: blocks showing raw `**`, `__`, `~~` or `](` (code excluded) fell
  from 101 to 7, across 97 task files and 2,366 blocks. The task file's 114
  was counted on 87 files by a method not recorded, so this count is mine,
  applied before and after. The 7 left are other cases: bold past
  `MAX_INLINE`, or bold that opens and never closes.
- Every changed block was read by machine and sampled by hand. On AGEIS,
  AGEION, RSNA and Gem4A, 595 blocks changed. In all 595, the visible text
  is the old text less its emphasis markers and link syntax, and the code
  text is byte-identical in all 275 files. Samples read: `<strong>… <code>ckpt:</code></strong>`,
  `<em>(done in T068: … <code>cpp/tests/test_contracts.cpp</code> …)</em>`.
- `npm test` 481 of 481 and `npm run check` pass. No spend.
- Log: PROGRESS.md, 2026-10-08 — T002 and T009.

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
