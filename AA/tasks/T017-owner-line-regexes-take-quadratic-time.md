---
id: T017
title: "Two owner-line regexes take quadratic time on a long line"
status: claimed
owner: adervark @v/2e8b687e 2026-10-07 — making owner parsing linear
# type: one word; tasks of one type are timed together; `bug` counts as defect work
type: bug
# blockedReason: while blocked, one line saying what unblocks it; cleared on unblock
blockedReason: ""
depends: []
created: 2026-10-07
---

# T017 — Two owner-line regexes take quadratic time on a long line

## Goal

Reading an `owner:` line takes time proportional to its length, so a tracked
repository's task file cannot stall the server.

## Context

- Severity high, older than this board: found 2026-10-07 while answering
  "any problems I should know about" after T005 and T006. It breaks the hard
  constraint on task text (no end-anchored quantifiers).
- `parseOwner` (`lib/workspace.mjs:336`) strips the operator with four
  replacements shaped `/ +@.*$/`; `ownerNote` (`:352`) reads the note with
  `/\s(?:—|--)\s*(.*)$/`. Both run on tracked task files (up to 256 KB) and,
  through `lib/history.mjs`, on every past version of the line.
- Inputs: `'x' + ' '.repeat(n) + 'y'` through `parseOwner`: 170 ms at
  n = 10,000, 707 ms at 20,000, 2,839 ms at 40,000. `' —'.repeat(n / 2) +
  ' '` through `ownerNote`: 225 ms at 20,000, 871 ms at 40,000.
- The `@profile/session` pattern and the other end-anchored patterns in
  `lib/` are linear on these inputs (measured).

## Steps

- [ ] A timing test for both inputs at n = 80,000.
- [ ] Cut the operator at the first single space followed by `@`, `—`, `--`
  or a date, then trim; take the note as everything after the first
  whitespace-then-dash, trimmed.
- [ ] Compare old and new on every owner line in the real boards' history.

## Decision rules — fixed in advance

- Pass: both inputs at n = 80,000 run in under 100 ms; the old and new
  functions agree on every `owner:` value in the history of this repository,
  AGEION, AGEIS, Gem4A and RSNA, except values holding a line terminator
  (listed in the Result); `npm test` passes.
- No spend.

## Handoff — state at last stop

*Kept true while claimed, not written on the way out (rule 8).*

- **Last touched:** 2026-10-07, adervark @v/2e8b687e (claimed)
- **In flight:** the fix, in this session
- **On disk:** nothing yet
- **Resume with:** the timing test
- **Next decision:** none

## Verify

`npm test`; the two inputs above; the comparison over real owner lines.

## Result

*(on completion: the outcome against the decision rules above, a pointer to the
entry in the log, and the digest from `AA/ckpt.sh close T017` — then
retire the trail with `--delete`)*

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
