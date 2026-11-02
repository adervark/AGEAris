---
id: T111
title: "Closing a task releases its environment: ckpt.sh release, rule 13, board.sh warns about what is left"
status: claimed
owner: adervark @b/cc5901e7 2026-11-03 — ckpt.sh release, wired into close, with rule 13 and the board's warnings
# type: one word; tasks of one type are timed together; `bug` counts as defect work
type: feature
# blockedReason: while blocked, one line saying what unblocks it; cleared on unblock
blockedReason: ""
depends: [T110]
created: 2026-11-03
---

# T111 — Closing a task releases its environment

## Goal

When a task is done, `AA/ckpt.sh release T###` deletes what it left: its
scratch folder, its landed worktrees and its merged branches. `close --delete`
runs it. The files the task said it keeps are moved to `AA/evidence/T###/`
and committed first. Anything not landed is never deleted, only named.

## Context

- The plan: `docs/plans/environments.md` (T110), approved 2026-11-03.
- Operator, 2026-11-03: "I want the task environment files deleted once it
  is finished."

## Steps

- [ ] `cmd_release` in `AA/ckpt.sh` and the template's copy; `close --delete` calls it.
- [ ] `keeps:` in the task frontmatter; `scratch:` and `keep_max_kb:` in AA.yml.
- [ ] Rule 13 in RULES.md, its reason in WHY.md, the TASK.md template.
- [ ] `board.sh --litter`, and `--check` warns about it without failing.
- [ ] Tests on temporary repositories only.

## Decision rules — fixed in advance

- `data-migration`: the tests delete only inside temporary repositories.
  Nothing on this machine outside them is deleted under T111; that is T114.
- Never deleted, whatever the flags: a worktree or branch with commits not
  on the main line, or with uncommitted changes to tracked files; anything
  outside the repository; the target of a symlink.
- Done means every one of those refusals is tested, a release of a fixture
  task frees its folder, worktree and branch and keeps its `keeps:` files in
  git, and `npm test` and `npm run check` pass.

## Handoff — state at last stop

*Kept true while claimed, not written on the way out (rule 8).*

- **Last touched:** 2026-11-03, adervark @b/cc5901e7
- **In flight:** writing cmd_release
- **On disk:** nothing yet
- **Resume with:** the Steps above
- **Next decision:** none

## Result

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
