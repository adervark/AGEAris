---
id: T015
title: "Code spans are not found as CommonMark finds them"
status: done
owner: adervark @k/adccab68 2026-10-08 — code spans as CommonMark finds them; hard breaks in long paragraphs
# type: one word; tasks of one type are timed together; `bug` counts as defect work
type: bug
# blockedReason: while blocked, one line saying what unblocks it; cleared on unblock
blockedReason: ""
depends: []
created: 2026-10-07
---

# T015 — Code spans are not found as CommonMark finds them

## Goal

A backtick run closes only on a run of the same length; an opener with none
stays literal text. A lone double backtick no longer vanishes.

## Context

- Severity low, older than 479b6e7: found by T001's review of 479b6e7
  (defect 4). Since 479b6e7 the same pattern also decides line breaks
  (`public/markdown.js:110`), so the fix must reach both.
- `public/markdown.js:42`: `` line.split(/(`+[^`]*?`+)/) `` closes at the next run
  of any length.
- Inputs (markdown-it 3.0.0 as the reference): "don", two backticks, "t stop"
  renders `<p>don<code></code>t stop</p>`, where both backticks should stay as
  text; and a span opened by two backticks closes at the next single one, so
  runs of different lengths pair up.
- Close to T002 (code inside bold or a link), which changes the same function.

## Steps

- [x] Failing tests for both inputs.
- [x] One left-to-right scan over backtick runs, shared by `:42` and `:110`.

## Decision rules — fixed in advance

- No regex with nested or end-anchored quantifiers; linear on the 4 MB inputs.
- No spend.

## Handoff — state at last stop

*Kept true while claimed, not written on the way out (rule 8).*

- **Last touched:** 2026-10-08, adervark @k/adccab68 (done)
- **In flight:** nothing
- **On disk:** nothing
- **Resume with:** nothing
- **Next decision:** none

## Verify

`npm test`.

## Result

**Done.** `codeSpans(text)` (`public/markdown.js`) finds spans as CommonMark
does. A backtick run opens one, the next run of the same length closes it, and
a run never closed is text. It is linear: one pass finds the runs, one pass
backwards links each to the next run of its length, and one forwards pairs
them. `inline()` and the paragraph's line breaks both use it, so they agree.

Against the decision rules:

- Tests: "don", two backticks, "t stop" stays text; two backticks around
  "a`b" are one span; an unclosed double run is text and does not hold a line
  break; runs of 1 and 2 no longer pair. All fail before and pass after.
- No regex at all in the scan. Timings, before → after: the 4 MB adversarial
  input 21 → 55 ms; 4 MB of lone backticks (``'a`'`` × 2,000,000, a million
  spans) 48 → 261 ms; 2,000 unmatched runs of growing length 3 → 6 ms. All
  linear; the cost is the span objects.
- Renders: no change on AGEIS, AGEION, RSNA or Gem4A. In this repository,
  T005's `` $` `` now renders as one span; before, it paired with the next
  backtick and broke the line.
- `npm test` 483 of 483 and `npm run check` pass. No spend.
- Log: PROGRESS.md, 2026-10-08 — T014 and T015.

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
