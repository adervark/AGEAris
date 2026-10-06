---
id: T005
title: "A dollar pattern in a task title corrupts the task file on every edit"
status: claimed
owner: adervark @k/ff713831 2026-10-07 — fixing dollar patterns in edits
# type: one word; tasks of one type are timed together; `bug` counts as defect work
type: bug
# blockedReason: while blocked, one line saying what unblocks it; cleared on unblock
blockedReason: ""
depends: []
created: 2026-10-07
---

# T005 — A dollar pattern in a task title corrupts the task file on every edit

## Goal

A title, owner, assignee or blocked reason holding `$&`, `$'`, `` $` `` or
`$1` is written exactly as typed, however many times the task is edited.

## Context

- Severity high, older than e64f823: found by T001's review of e64f823 (P1).
- `lib/workspace.mjs:277`, in `updateFrontmatter`:
  ``header.replace(pattern, `${key}: ${rendered}`)``; and `:1159`, the heading:
  ``parsed.body.replace(/^# T\d{3,} — .*$/m, `# ${localId} — ${title}`)``. The
  frontmatter path also reaches `owner:` (it holds the title, via `ownerFor`),
  `assignee:` and `blockedReason:`. `lib/fabricate.mjs:422` repeats the heading
  replacement (tests and the sample only).
- Input: create a task titled `Pay $& later`, then change its status. Actual:
  the title becomes `Pay title: "Pay title: "Pay $& later" later" later`, the
  file is renamed to `T001-pay-title-pay-title-pay-later-later-later.md`, and
  each further edit grows it again. Expected: `Pay $& later`.
- e64f823 fixed the same pattern in `STATE.md` only; its test creates the task
  but never edits it.

## Steps

- [ ] A failing test: create a task with each pattern in its title, edit it
  twice (status, then priority), and compare the title, the heading and the
  file name.
- [ ] Replacement functions in the three places.
- [ ] Check every other `.replace(` whose replacement is built from user text.

## Decision rules — fixed in advance

- Pass: the test passes and no `.replace(` with a string replacement built
  from user text is left in `lib/`.
- No spend.

## Handoff — state at last stop

*Kept true while claimed, not written on the way out (rule 8).*

- **Last touched:** 2026-10-07, adervark @k/ff713831
- **In flight:** the fix, in this session
- **On disk:** nothing yet
- **Resume with:** write the failing test first
- **Next decision:** none

## Verify

`npm test`; the repro above keeps the title after two edits.

## Result

*(on completion: the outcome against the decision rules above, a pointer to the
entry in the log, and the digest from `AA/ckpt.sh close T005` — then
retire the trail with `--delete`)*

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
