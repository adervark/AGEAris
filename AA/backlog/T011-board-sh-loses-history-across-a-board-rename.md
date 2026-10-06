---
id: T011
title: "board.sh loses the history from before a board rename"
status: open
owner: —
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

- [ ] The older names in both pathspecs of the template and of `AA/board.sh`.
- [ ] The review's scenario: a `deaddrop/` board with six days of dated
  commits, migrated in one commit; `board.sh --all` against a never-migrated twin.
- [ ] The global copy, only after the repository's copy passes.

## Decision rules — fixed in advance

- Pass: the migrated board's output equals the never-migrated twin's.
- `global-config` is a spend: a `doing` line before the global copy changes,
  and it changes only after the repository's copy passes.

## Handoff — state at last stop

*Kept true while claimed, not written on the way out (rule 8).*

- **Last touched:** 2026-10-07, adervark @k/ff713831 (registered, never claimed)
- **In flight:** nothing
- **On disk:** nothing yet
- **Resume with:** run the scenario on the template as it is, then fix
- **Next decision:** none

## Verify

The two `board.sh --all` transcripts, compared.

## Result

*(on completion: the outcome against the decision rules above, a pointer to the
entry in the log, and the digest from `AA/ckpt.sh close T011` — then
retire the trail with `--delete`)*

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
