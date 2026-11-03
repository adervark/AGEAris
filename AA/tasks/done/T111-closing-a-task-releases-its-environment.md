---
id: T111
title: "Closing a task releases its environment: ckpt.sh release, rule 13, board.sh warns about what is left"
status: done
owner: adervark @b/cc5901e7 2026-11-03 — done
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

- [x] `cmd_release` in `AA/ckpt.sh` and the template's copy; `close --delete` calls it.
- [x] `keeps:` in the task frontmatter; `scratch:` and `keep_max_kb:` in AA.yml.
- [x] Rule 13 in RULES.md, its reason in WHY.md, the TASK.md template.
- [x] `board.sh --litter`, and `--check` warns about it without failing.
- [x] Tests on temporary repositories only.

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
- **In flight:** nothing
- **On disk:** nothing
- **Resume with:** nothing; done
- **Next decision:** none

## Result

**Done, against the decision rules.** `AA/ckpt.sh release T###` deletes a
done task's scratch folders and loose files named for it, the worktrees in
them, its merged branches, and subagent worktrees that are landed, idle and
unused. `close --delete` runs it. Every refusal in the decision rules is a
test on temporary repositories: 28 in `tests/release.test.mjs`. `npm test`
624/624 and `npm run check` pass.

Amended by the operator on 2026-11-03: "keep only task documentation and
visuals and metrics", and bigger ones "Archive outside git". So a release
keeps the files of `keep_kinds`, every file the task's own file cites, and
its `keeps:` line. Up to `keep_max_kb` each they are committed to
`AA/evidence/T###/<folder>/`. Bigger ones, and any that look like they hold
a secret, are copied to the `archive:` folder, checked by sha256, and listed
in `RELEASED.tsv`. `keep_task_mb` caps what one task commits.

Never deleted: work not on the trunk by ancestry, tracked changes, a locked
worktree, a nested or bare repository with commits no remote has, untracked
work in a subagent worktree, a folder an open task cites, anything a process
uses, a run that is live or stopped mid-act, anything outside `scratch/`, a
symlink's target.

Three review rounds. My first review (beeefb3): REQUEST CHANGES, nine ways
it deleted protected work. The second (118376b): all nine closed, six new.
The operator's agy session (Gemini) reviewed it too, and six of its points
on this work were fixed in 547a541. The release over AGEIS then showed loose
files named for tasks were skipped (03ecca7), and that `--litter` listed a
subagent worktree the release holds (fixed with this Result).

Rule 13 is in `RULES.md`, its reason in `WHY.md`, and `keeps:` in the TASK
template. `scratch:`, `keep_kinds:`, `keep_max_kb:`, `keep_task_mb:`,
`archive:` and `trunk:` are in `AA.yml`. All of it is copied to the aa-init
template. Logged in PROGRESS.md.

Run digest:
- **cc5901e7.2dff** (reviewer @b/cc5901e7): ckpt.sh release + rule 13 + board.sh --litter/--check, 3 review rounds, 28 tests (beeefb3, 118376b, 547a541, 03ecca7, and the --litter hold) · cost 2 code-reviewer passes · left: none

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
