---
id: T010
title: "A paragraph indented less than a list item's content keeps the list's hold"
status: open
owner: —
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

- [ ] Failing tests for the four inputs and the U+00A0 line.
- [ ] Record the content column of the list's last top-level item; reset the
  hold when a non-blank line outside a paragraph is indented less than it.

## Decision rules — fixed in advance

- Pass: the four inputs match markdown-it, the existing tests pass, and
  every AGEIS task-file block whose output changes is read.
- No spend.

## Handoff — state at last stop

*Kept true while claimed, not written on the way out (rule 8).*

- **Last touched:** 2026-10-07, adervark @k/ff713831 (registered, never claimed)
- **In flight:** nothing
- **On disk:** nothing yet
- **Resume with:** write the failing tests first
- **Next decision:** none

## Verify

`npm test`; the four inputs through `renderMarkdown()`.

## Result

*(on completion: the outcome against the decision rules above, a pointer to the
entry in the log, and the digest from `AA/ckpt.sh close T010` — then
retire the trail with `--delete`)*

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
