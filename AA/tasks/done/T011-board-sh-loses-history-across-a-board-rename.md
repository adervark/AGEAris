---
id: T011
title: "board.sh loses the history from before a board rename"
status: done
owner: adervark @k/adccab68 2026-10-08 — board.sh across a rename; Method view without a settings file
# type: one word; tasks of one type are timed together; `bug` counts as defect work
type: bug
# blockedReason: while blocked, one line saying what unblocks it; cleared on unblock
blockedReason: ""
depends: []
created: 2026-10-07
---

# T011 — board.sh loses the history from before a board rename

## Goal

After `git mv deaddrop AA` (or `pm` to `AA`), `board.sh --all` shows the same
ages, cycle times and flow efficiency as before the move.

## Context

- Severity medium: found by T001's review of e64f823 (finding 3).
- `skills/aa-init/template/board.sh:128` (`board_history`) and `:150`
  (`board_commits`) read only `AA/…` paths, and the move itself is skipped as a
  `migrate:` sweep, so nothing from before it is seen: ages show `?`, cycle
  time n=0, the flow-efficiency line disappears, and `--write` stores that.
- Copies: `AA/board.sh` here, and `~/.claude/skills/aa-init/template/board.sh`
  (it differs from the repository's copy; T004). Gem4A's copy got the same fix
  in its move (e26708e); AGEION, AGEIS and RSNA have no `board.sh`.
- AGE Aris itself reads the older names (`BOARD_PATHS`), so it and `board.sh`
  disagree after a move until this is fixed.
- Style note from the same review, fixed in the same commit: `board.sh:5` and
  `SKILL.md:21` lost 6 columns of alignment in the rename.

## Steps

- [x] The older names in both pathspecs of the template and of `AA/board.sh`.
- [x] The review's scenario: a `deaddrop/` board with six days of dated
  commits, migrated in one commit; `board.sh --all` against a never-migrated twin.
- [x] The global copy, only after the repository's copy passes.

## Decision rules — fixed in advance

- Pass: the migrated board's output equals the never-migrated twin's.
- `global-config` is a spend: a `doing` line before the global copy changes,
  and it changes only after the repository's copy passes.

## Handoff — state at last stop

*Kept true while claimed, not written on the way out (rule 8).*

- **Last touched:** 2026-10-08, adervark @k/adccab68 (done)
- **In flight:** nothing
- **On disk:** nothing
- **Resume with:** nothing
- **Next decision:** none

## Verify

The two `board.sh --all` transcripts, compared.

## Result

**Done.** Both `board.sh` pathspecs (`board_history`, `board_commits`) now
include the older folder names `deaddrop/` and `pm/`, so the history from
before a rename is read; the rename itself is a `migrate:` sweep and still is
not. The same change is in `AA/board.sh` and the template, which are identical.
The review's alignment nit is fixed too: `board.sh:5` and `SKILL.md:21`.

Against the decision rules:

- `tests/fixtures/board/board-rename.sh` is the review's scenario: a
  `deaddrop/` board with dated commits over six days, migrated in one commit,
  against a twin that was always `AA/`. The new test in
  `tests/task-actions.test.mjs` runs it. Before the fix the migrated board
  showed `?` ages and cycle time n=0 where the twin had 33d, 34d and n=1. After
  it, `board.sh --all` prints the same for both.
- Global copy: changed only after the repository's copy passed, with `doing`
  before and `did` after (run adccab68, trail 19fb924, retired 1c5b549).
  `~/.claude/skills/aa-init/template/board.sh` and `SKILL.md` match the
  repository's copies byte for byte. The other template files there still
  differ (T004).
- `npm test` 477 of 477 and `npm run check` pass.
- Log: PROGRESS.md, 2026-10-08 — T011 and T013.

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
