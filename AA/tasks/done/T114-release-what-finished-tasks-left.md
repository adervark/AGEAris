---
id: T114
title: "Release what finished tasks left: AGEIS's 110 GB and this repository's landed worktree"
status: done
owner: adervark @b/cc5901e7 2026-11-03 — done
# type: one word; tasks of one type are timed together; `bug` counts as defect work
type: chore
# blockedReason: while blocked, one line saying what unblocks it; cleared on unblock
blockedReason: ""
depends: [T111]
created: 2026-11-03
---

# T114 — Release what finished tasks left

## Goal

Every task already in `done/` holds nothing on disk, in AGEIS and in this
repository. The files their Results cite are kept in git first.

## Context

- T110's inventory: in AGEIS, 110.1 GB of `scratch/` belongs to done tasks,
  plus 18 landed worktrees and 17 merged branches. In this repository there
  are T023's landed worktree and `feature/agent-pipeline`.
- Operator, 2026-11-03: "I want the task environment files deleted once it
  is finished."

## Steps

- [x] A dry run of `ckpt.sh release` for every done task, kept in the trail.
- [x] Keep each Result's cited files that are small enough, then release.
- [x] Measure the space freed; log it in PROGRESS.md.

## Decision rules — fixed in advance

- `data-migration` (anything in a tracked repository) is the spend, on the
  operator's word above. Each repository's release is preceded by a `doing`.
- Only done tasks. Not released:
  - T113, T105 and T057, which are in progress;
  - the 31.6 GB of unowned folders (`lock`, `demo`, `sp500-*`, …);
  - the unlanded branch `worktree-agent-a8fe233b604fa1d1e`, which is
    tagged `archive/T123-L` instead.
- What is kept, as amended by the operator on 2026-11-03 ("keep only task
  documentation and visuals and metrics"; big ones "Archive outside git"):
  the kept kinds (`keep_kinds`), every file a task's own file cites, and its
  `keeps:` line. Up to 1 MB each they are committed to
  `AA/evidence/T###/<folder>/…`; bigger ones, and any that look like they
  hold a secret, are copied to `~/Archive/AGEIS/T###/<folder>/…` and checked
  by sha256, and their size and sha256 are committed in
  `AA/evidence/T###/RELEASED.tsv`.
- A folder an open task cites stays whole (T084, T087, T097, T108, T123 on
  2026-11-03), and so does anything a release names as KEPT.
- In AGEIS the evidence commit goes to its current branch, authored as its
  own git identity, and nothing is pushed.

## Handoff — state at last stop

*Kept true while claimed, not written on the way out (rule 8).*

- **Last touched:** 2026-11-03, adervark @b/cc5901e7
- **In flight:** nothing
- **On disk:** nothing; the archive is `~/Archive/AGEIS/`
- **Resume with:** nothing; done
- **Next decision:** none

## Result

**Done.** Every task in AGEIS's `done/` now holds nothing on disk that a
release may delete (`board.sh --litter`: "Finished tasks hold nothing on
disk"). The same holds in this repository.

- **AGEIS, 93 GB freed.** The disk went from 441 GB used (61%) to 347 GB
  (48%). 44 done tasks were released in 41 commits to AGEIS `main`
  (0dddc76..b0c17ba), each touching only `AA/evidence/`, authored as
  `adervark`, none pushed.
  - Kept in git: 4,583 files, 201 MB, in `AGEIS/AA/evidence/`.
  - Archived: 118 files, 5.0 GB, in `~/Archive/AGEIS/`, each checked by
    sha256 and listed in its task's `RELEASED.tsv`.
  - Removed: 8 landed subagent worktrees and the branches merged into
    `main`.
- **Held, as the rules say:**
  - `scratch/t084`, `t087`, `t097`, `t108` and `t123` stay whole, because
    open tasks T126, T117, T098, T115 and T124 cite them. With `t123` stay
    its seven worktrees and branches.
  - `.claude/worktrees/agent-aef99ba1ed9ba14da` stays: its
    `cpp/tests/t123_char.inc` (3.3 KB) was never committed anywhere.
  - T113 (48 GB, stopped mid-act 7 days ago), T105, T057 and the 31.6 GB of
    unowned folders were not touched.
- **T123-L:** tagged `archive/T123-L` at 4157dd0, which holds its 14 commits
  not on `main`. The worktree's three kept files were committed to
  `AA/evidence/T123/agent-a8fe233b604fa1d1e/`, then the worktree and its
  branch were removed.
- **This repository:** T023's subagent worktree (4 MB) was removed after
  its one commit proved byte-identical to 4bae6ce. Its branch and the
  merged `feature/agent-pipeline` were deleted.
- **Dry runs:** both are in the trail's `doing` entries: 39 tasks; 4,547
  files (188 MB) to git, 118 (4.93 GB) to the archive. They matched the
  run.
- Two logs, `t092/pull.log` and `t092/vec/progress.log`, were committed with
  CRLF line ends normalised by git; their bytes in git differ from the
  originals by line ends only.

Logged in PROGRESS.md.

Run digest:
- **cc5901e7** (session @b/cc5901e7): AGE Aris's three released; AGEIS's 44 done tasks released, T123-L tagged · cost data-migration in AGEIS, approved by the operator · left: none

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
