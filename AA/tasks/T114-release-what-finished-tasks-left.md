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
- **In flight:** nothing. AGE Aris's three are released (trail of run
  cc5901e7); AGEIS waits on T111's third review round
- **On disk:** the AGEIS dry run: 39 tasks; 4,528 files (188 MB) to git,
  116 (4.9 GB) to the archive, 103.3 GB of folders deleted
- **Resume with:** T111's `ckpt.sh release --dry-run` per done task
- **Next decision:** none

## Result

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
