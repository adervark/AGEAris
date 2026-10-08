---
id: T014
title: "A paragraph past MAX_INLINE drops hard breaks for a span it never renders"
status: done
owner: adervark @k/adccab68 2026-10-08 — code spans as CommonMark finds them; hard breaks in long paragraphs
# type: one word; tasks of one type are timed together; `bug` counts as defect work
type: bug
# blockedReason: while blocked, one line saying what unblocks it; cleared on unblock
blockedReason: ""
depends: []
created: 2026-10-07
---

# T014 — A paragraph past MAX_INLINE drops hard breaks for a span it never renders

## Goal

A paragraph too long to read as one stretch keeps the hard breaks of every
line, because read line by line no code span crosses a line end.

## Context

- Severity low, from 1ea4641 and kept by 479b6e7: found by T001's review of
  479b6e7 (defect 3).
- `public/markdown.js:110-120`: the joined pass finds a span from a backtick on
  one line to a backtick lines later and cancels the breaks between; the
  stretch is then over `MAX_INLINE` and is read line by line, where that span
  does not exist.
- Input: ``'don`t  \n' + 'x'.repeat(2100) + '  \n' + 'x'.repeat(2100) + '  \nwon`t'``.
  Actual: no `<br>` and no `<code>`. Expected: three `<br>`.

## Steps

- [x] A failing test with the input.
- [x] Keep each line's break when a stretch over `MAX_INLINE` is read line by
  line.

## Decision rules — fixed in advance

- No regex with nested or end-anchored quantifiers; the 4 MB inputs of T002
  still render in well under a second.
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

**Done.** A paragraph's stretches are now lists of its lines. A stretch over
`MAX_INLINE` is read line by line, and then every hard line keeps its break
(and loses its trailing backslash), because read that way no span crosses a
line end.

Against the decision rules:

- Test: the task's input gives three `<br>` and no `<code>`; before, none of
  either. `tests/markdown.test.mjs` passes.
- No new regex. The 4 MB inputs (timings in T015's Result) stay well under a
  second; 4 MB of 100-character hard lines renders in 121 ms (136 ms before).
- `npm test` 483 of 483 and `npm run check` pass. No spend.
- Log: PROGRESS.md, 2026-10-08 — T014 and T015.

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
