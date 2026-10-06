---
id: T005
title: "A dollar pattern in a task title corrupts the task file on every edit"
status: done
owner: adervark @v/2e8b687e 2026-10-07 — dollar patterns written as typed (was: adervark @k/ff713831 2026-10-07)
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

- [x] A failing test: create a task with each pattern in its title, edit it
  twice (status, then priority), and compare the title, the heading and the
  file name.
- [x] Replacement functions in the three places.
- [x] Check every other `.replace(` whose replacement is built from user text.

## Decision rules — fixed in advance

- Pass: the test passes and no `.replace(` with a string replacement built
  from user text is left in `lib/`.
- No spend.

## Handoff — state at last stop

*Kept true while claimed, not written on the way out (rule 8).*

- **Last touched:** 2026-10-07, adervark @v/2e8b687e
- **In flight:** nothing; done
- **On disk:** committed with this task's move to `done/`
- **Resume with:** nothing to resume
- **Next decision:** none

## Verify

`npm test`; the repro above keeps the title after two edits.

## Result

Pass, against the decision rules.

- `updateFrontmatter` and the heading replacement in `updateTask`
  (`lib/workspace.mjs`) and in `lib/fabricate.mjs` now pass replacement
  functions, so `$&`, `$'`, `` $` ``, `$1` and `$$` are written as typed.
- The new test gives a title, an assignee and a blocked reason each of those
  patterns, then edits the task four times (status, priority, blocked,
  priority). The title, heading, owner note, assignee, blocked reason and the
  file name `T001-pay-1-later.md` all come out as typed. Before the fix it
  failed: the title grew until the file was refused as too large.
- No other `.replace(` in `lib/`, `server.mjs`, `agents/` or `public/` builds a
  string replacement from user text. What remains are constant strings with
  intentional group references (`'$1 $2'`, `'\\$&'`), which are safe.
- `npm test`: 369 of 369 pass; `npm run check` passes. No spend, so no trail;
  no independent review was run (that would be an agent fan-out spend).
- Log: `PROGRESS.md`, 2026-10-07 — T005 and T006.

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
