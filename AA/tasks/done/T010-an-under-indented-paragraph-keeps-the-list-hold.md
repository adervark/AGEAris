---
id: T010
title: "A paragraph indented less than a list item's content keeps the list's hold"
status: done
owner: adervark @k/adccab68 2026-10-08 — the renderer's list items and list hold
# type: one word; tasks of one type are timed together; `bug` counts as defect work
type: bug
# blockedReason: while blocked, one line saying what unblocks it; cleared on unblock
blockedReason: ""
depends: []
created: 2026-10-07
---

# T010 — A paragraph indented less than a list item's content keeps the list's hold

## Goal

After a list, a paragraph indented less than the item's content column ends
the list, so a later 4-space block is code, as in CommonMark.

## Context

- Severity medium, a regression from 479b6e7: found by T001's review of
  479b6e7 (defect 2). 1ea4641 rendered all four inputs correctly.
- `public/markdown.js:128`: `afterList` is reset only by a line at the margin,
  so any indent keeps the hold. CommonMark's content column is the marker's
  indent, plus its width, plus the 1 to 4 spaces after it.
- Inputs, with markdown-it 3.0.0 (CommonMark) as the reference:
  `'- item\n\n text\n\n    code'`, `'1. Step\n\n  Para A\n\n    Para B'`,
  `'- item\n\n ---\n\n    code'` and `'-   item\n\n  text\n\n    code'` each
  render the last block as `<p>` instead of `<pre><code>`.
- A line starting with U+00A0 also keeps the hold (`\s` matches it);
  CommonMark counts it as no indent.
- The commit's own case, `'1. Step\n\n   Para A\n\n    Para B'` (3 spaces), is
  right and must stay right.

## Steps

- [x] Failing tests for the four inputs and the U+00A0 line.
- [x] Record the content column of the list's last top-level item; reset the
  hold when a non-blank line outside a paragraph is indented less than it.

## Decision rules — fixed in advance

- Pass: the four inputs match markdown-it, the existing tests pass, and
  every AGEIS task-file block whose output changes is read.
- No spend.

## Handoff — state at last stop

*Kept true while claimed, not written on the way out (rule 8).*

- **Last touched:** 2026-10-08, adervark @k/adccab68 (done)
- **In flight:** nothing
- **On disk:** nothing
- **Resume with:** nothing
- **Next decision:** none

## Verify

`npm test`; the four inputs through `renderMarkdown()`.

## Result

**Done.** After a list, the hold is the content column of its last top-level
item: the marker's indent, plus its width, plus the 1 to 4 spaces after it
(one if more). A non-blank line outside a paragraph that starts left of that
column ends the hold. Indentation counts spaces and tabs only (tab stops of 4),
so U+00A0 is not indentation.

Against the decision rules:

- The four inputs now end in `<pre><code>`, as markdown-it does. So does
  the U+00A0 line. The commit's own case (`'1. Step\n\n   Para A\n\n    Para B'`)
  still gives two paragraphs. All in `tests/markdown.test.mjs`, which passes.
  markdown-it itself was not run (no dependency here); the expected outputs
  are the ones the task file records from it.
- AGEIS: 307 task files on five boards rendered before and after. No AGEIS
  block changed; the only changed render is T017's (T008).
- `npm test` 479 of 479 and `npm run check` pass. No spend.
- Log: PROGRESS.md, 2026-10-08 — T008 and T010.

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
