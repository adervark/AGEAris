---
id: T114
title: "Release what finished tasks left: AGEIS's 110 GB and this repository's landed worktree"
status: claimed
owner: adervark @b/cc5901e7 2026-11-03 — run T111's release over every done task, AGEIS first
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

- [ ] A dry run of `ckpt.sh release` for every done task, kept in the trail.
- [ ] Keep each Result's cited files that are small enough, then release.
- [ ] Measure the space freed; log it in PROGRESS.md.

## Decision rules — fixed in advance

- `data-migration` (anything in a tracked repository) is the spend, on the
  operator's word above. Each repository's release is preceded by a `doing`.
- Only done tasks. Not released:
  - T113, T105 and T057, which are in progress;
  - the 31.6 GB of unowned folders (`lock`, `demo`, `sp500-*`, …);
  - the unlanded branch `worktree-agent-a8fe233b604fa1d1e`, which is
    tagged `archive/T123-L` instead.
- A cited file over `keep_max_kb` is not committed. Its path, size and
  sha256 go in this Result before it is deleted.
- In AGEIS the evidence commit goes to its current branch, authored as its
  own git identity, and nothing is pushed.

## Handoff — state at last stop

*Kept true while claimed, not written on the way out (rule 8).*

- **Last touched:** 2026-11-03, adervark @b/cc5901e7
- **In flight:** nothing; waits on T111
- **On disk:** nothing yet
- **Resume with:** T111's `ckpt.sh release --dry-run` per done task
- **Next decision:** none

## Result

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
