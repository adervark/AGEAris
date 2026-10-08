---
id: T009
title: "Four markdown patterns take quadratic time on one long line"
status: claimed
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

- [ ] A timing test for each input at n = 80,000.
- [ ] Count trailing `#` by hand; `([^]*)` without `$` in the heading and list
  patterns; trim the separator line and test each cell against `/^:?-+:?$/`.

## Decision rules — fixed in advance

- Pass: each input at n = 80,000 renders in under 100 ms, measured before and
  after and logged in `PROGRESS.md`; `tests/markdown.test.mjs` passes; across
  AGEIS's task files no rendered block changes.
- No spend.

## Handoff — state at last stop

*Kept true while claimed, not written on the way out (rule 8).*

- **Last touched:** 2026-10-08, adervark @k/adccab68 (claimed)
- **In flight:** nothing
- **On disk:** nothing yet
- **Resume with:** measure the five inputs, then write the timing test
- **Next decision:** none

## Verify

`npm test`; the timings in `PROGRESS.md`.

## Result

*(on completion: the outcome against the decision rules above, a pointer to the
entry in the log, and the digest from `AA/ckpt.sh close T009` — then
retire the trail with `--delete`)*

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
