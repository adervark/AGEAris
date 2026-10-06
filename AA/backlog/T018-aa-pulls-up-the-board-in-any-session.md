---
id: T018
title: "/aa pulls up a project's board in any Claude Code session"
status: open
owner: —
# type: one word; tasks of one type are timed together; `bug` counts as defect work
type: feature
# blockedReason: while blocked, one line saying what unblocks it; cleared on unblock
blockedReason: ""
depends: []
created: 2026-10-07
---

# T018 — /aa pulls up a project's board in any Claude Code session

## Goal

In any project's session, on any profile, `/aa` prints that project's AA board
and the link to it in AGE Aris, starting AGE Aris if it is not running.
`/aa open` opens the link signed in.

## Context

- Asked for 2026-10-07: "get me a way to pull up AA in the project sessions";
  the operator chose "both" (print the board and give the AGE Aris link).
- `/board` exists in all five repos but is a full review, and its first step
  (`AA/board.sh`) fails in AGEION, AGEIS and RSNA, whose older boards have no
  `board.sh`, `backlog/` or `AA.yml`.
- `~/.claude-b`, `-k` and `-v` link their `skills/` to `~/.claude/skills`, so
  one skill folder reaches every profile. The data folder is
  `~/.agesight-data`; it tracks AGE Aris and AGEIS only.

## Steps

- [ ] `skills/aa/aa.sh`: find the board (`AA/`, `deaddrop/`, `pm/`). Print
  `board.sh`'s render where there is one; otherwise print `STATE.md` and the
  tasks in `tasks/`. Then the AGE Aris link, starting the server if needed.
  `--open` opens the sign-in link without printing the token. `--link` tracks
  the repository.
- [ ] `skills/aa/SKILL.md`: run the script and show its output as is.
- [ ] Try it on the five repos, and `--link` against a scratch data folder.
- [ ] Copy `skills/aa/` to `~/.claude/skills/aa/` (the spend).

## Decision rules — fixed in advance

- Pass: in each of the five repos the script prints a board in under 5 s
  (cold start of AGE Aris included) and leaves the repository exactly as it
  was (HEAD and `git status`). For AGE Aris and AGEIS it prints a link whose
  project the running server serves. For the other three it says how to
  track them. `--link` tracks a repository in a scratch data folder and writes
  nothing to it. `npm test` passes.
- Spend: global-config. Only `~/.claude/skills/aa/` is created; nothing else
  under `~/.claude*` changes. Undo: delete that folder.

## Handoff — state at last stop

*Kept true while claimed, not written on the way out (rule 8).*

- **Last touched:** 2026-10-07, adervark @v/2e8b687e (registered)
- **In flight:** nothing
- **On disk:** nothing yet
- **Resume with:** the script
- **Next decision:** none

## Verify

Run `/aa` in a session of each of the five repos.

## Result

*(on completion: the outcome against the decision rules above, a pointer to the
entry in the log, and the digest from `AA/ckpt.sh close T018` — then
retire the trail with `--delete`)*

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
