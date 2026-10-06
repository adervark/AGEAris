---
id: T017
title: "Two owner-line regexes take quadratic time on a long line"
status: done
owner: adervark @v/2e8b687e 2026-10-07 — owner parsing made linear
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

- [x] A timing test for both inputs at n = 80,000.
- [x] Cut the operator at the first single space followed by `@`, `—`, `--`
  or a date, then trim; take the note as everything after the first
  whitespace-then-dash, trimmed.
- [x] Compare old and new on every owner line in the real boards' history.

## Decision rules — fixed in advance

- Pass: both inputs at n = 80,000 run in under 100 ms; the old and new
  functions agree on every `owner:` value in the history of this repository,
  AGEION, AGEIS, Gem4A and RSNA, except values holding a line terminator
  (listed in the Result); `npm test` passes.
- No spend.

## Handoff — state at last stop

*Kept true while claimed, not written on the way out (rule 8).*

- **Last touched:** 2026-10-07, adervark @v/2e8b687e
- **In flight:** nothing; done
- **On disk:** committed with this task's move to `done/`
- **Resume with:** nothing to resume
- **Next decision:** none

## Verify

`npm test`; the two inputs above; the comparison over real owner lines.

## Result

Pass, against the decision rules.

- `parseOwner` cuts the operator at the first match of
  `/ (?:@|—|--|\d{4}-\d{2}-\d{2})/` and trims. `ownerNote` takes what follows
  the first `/\s(?:—|--)/`, trimmed. Neither pattern can backtrack. Both
  functions are in `lib/workspace.mjs`.
- At n = 80,000 all four timing inputs run in under 100 ms. Before the fix, the
  first one alone took 10.8 s.
- The old and new code agree on all 272 distinct `owner:` values in the history
  of AGE Aris, AGEION, AGEIS, Gem4A and RSNA. None of them holds a line
  terminator, so the one intended difference never arises on real data. That
  difference: the old patterns ignored a marker followed by `\r`, U+2028 or
  U+2029, and the new ones do not, which matches how `board.sh` reads the line.
- `npm test`: 371 of 371 pass; `npm run check` passes. No spend; no
  independent review.
- Log: `PROGRESS.md`, 2026-10-07 — T017.

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
