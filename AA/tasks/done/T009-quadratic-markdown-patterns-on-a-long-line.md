---
id: T009
title: "Four markdown patterns take quadratic time on one long line"
status: done
owner: adervark @k/adccab68 2026-10-08 — inline code inside bold and links; linear-time block patterns
# type: one word; tasks of one type are timed together; `bug` counts as defect work
type: bug
# blockedReason: while blocked, one line saying what unblocks it; cleared on unblock
blockedReason: ""
depends: []
created: 2026-10-07
---

# T009 — Four markdown patterns take quadratic time on one long line

## Goal

Each input below renders in time proportional to its length, as a plain
paragraph does.

## Context

- Severity high (time on the browser's main thread), older than 479b6e7:
  found by T001's review of 479b6e7 (defect 5).
- `public/markdown.js:144` (`/#+$/`), `:138` (the heading's `\s+(.*)$`),
  `:45` (`LIST_ITEM`, the same shape), `:169` (the table separator).
- Inputs, at n = 40,000: `'# ' + '#'.repeat(n) + 'x'` 791 ms;
  `'# ' + ' '.repeat(n) + 'a\u2028b'` 972 ms; `'- ' + ' '.repeat(n) + 'a\u2028b'`
  980 ms; `'a|b\n' + ' '.repeat(n) + 'x|'` 943 ms; `'a|b\n|---' + ' '.repeat(n) + 'x|'`
  820 ms. Each doubles to four times the time when n doubles; a plain paragraph
  of the same size takes under 1 ms.

## Steps

- [x] A timing test for each input at n = 80,000.
- [x] Count trailing `#` by hand; `([^]*)` without `$` in the heading and list
  patterns; trim the separator line and test each cell against `/^:?-+:?$/`.

## Decision rules — fixed in advance

- Pass: each input at n = 80,000 renders in under 100 ms, measured before and
  after and logged in `PROGRESS.md`; `tests/markdown.test.mjs` passes; across
  AGEIS's task files no rendered block changes.
- No spend.

## Handoff — state at last stop

*Kept true while claimed, not written on the way out (rule 8).*

- **Last touched:** 2026-10-08, adervark @k/adccab68 (done)
- **In flight:** nothing
- **On disk:** nothing
- **Resume with:** nothing
- **Next decision:** none

## Verify

`npm test`; the timings in `PROGRESS.md`.

## Result

**Done.** The heading, list-item and task-box patterns end in `([^]*)`, with
no `.` and no `$`. The closing run of `#` and a code span's backticks are
counted by hand. The table separator is read cell by cell
(`tableSeparator`), not by a pattern.

Against the decision rules, at n = 80,000 (before → after, one run each):

- `'# ' + '#'.repeat(n) + 'x'`: 4,190 ms → 2 ms.
- `'# ' + ' '.repeat(n) + 'a\u2028b'`: 5,037 ms → 1 ms.
- `'- ' + ' '.repeat(n) + 'a\u2028b'`: 5,069 ms → 3 ms.
- The table line `a|b` over `' '.repeat(n) + 'x|'`: 4,954 ms → 1 ms.
- The table line `a|b` over `'|---' + ' '.repeat(n) + 'x|'`: 4,097 ms → 1 ms.
- `tests/markdown.test.mjs` has a timing test for each, plus the task box, at
  under 100 ms. It fails before the fix and passes after.
- With T002's change set aside, no rendered block changes on AGEIS, AGEION,
  RSNA or Gem4A.
- `npm test` 481 of 481 and `npm run check` pass. No spend.
- Log: PROGRESS.md, 2026-10-08 — T002 and T009.

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
