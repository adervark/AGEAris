---
id: T014
title: "A paragraph past MAX_INLINE drops hard breaks for a span it never renders"
status: claimed
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

- [ ] A failing test with the input.
- [ ] Keep each line's break when a stretch over `MAX_INLINE` is read line by
  line.

## Decision rules — fixed in advance

- No regex with nested or end-anchored quantifiers; the 4 MB inputs of T002
  still render in well under a second.
- No spend.

## Handoff — state at last stop

*Kept true while claimed, not written on the way out (rule 8).*

- **Last touched:** 2026-10-08, adervark @k/adccab68 (claimed)
- **In flight:** nothing
- **On disk:** nothing yet
- **Resume with:** write the failing test first
- **Next decision:** none

## Verify

`npm test`.

## Result

*(on completion: the outcome against the decision rules above, a pointer to the
entry in the log, and the digest from `AA/ckpt.sh close T014` — then
retire the trail with `--delete`)*

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
