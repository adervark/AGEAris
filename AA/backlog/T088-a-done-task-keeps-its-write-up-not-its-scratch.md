---
id: T088
title: "A done task keeps its write-up, not its scratch"
status: open
owner: —
# type: one word; tasks of one type are timed together; `bug` counts as defect work
type: feature
# blockedReason: while blocked, one line saying what unblocks it; cleared on unblock
blockedReason: ""
depends: []
created: 2026-10-22
---

# T088 — A done task keeps its write-up, not its scratch

## Goal

When a task in a tracked repository moves to `done/`, AGE Aris checks that its
write-up stands on its own, then makes removing the task's scratch folder one
operator command. What a finished task leaves behind is clear documentation,
not data.

## Context

- Measured on AGEIS, 2026-10-21. `scratch/` holds 181 GB on a 767 GB disk.
  - 51 copies of `ageis.db` take 104 GB. Task scripts copy the bench corpus
    before reading it, for example `python/cooc_unit_sweep.py:76` and
    `python/e2e/demo_e2e.py:331`.
  - 34 tasks marked done still hold about 98 GB of scratch. Nothing removes a
    folder when its task closes.
  - 84 CMake build trees and 34 source checkouts sit under `scratch/lock/`.
  - Only 28 GB is byte-identical. The rest is a distinct database per run, so
    deduplication alone does not fix it.
- **The write-ups are not self-contained yet.** 43 of AGEIS's 105 done tasks
  cite paths under `scratch/`. Some of those are shared inputs that later
  tasks read, including `scratch/sp500-years/ageis.db` (175 mentions),
  `scratch/sp500-years/company_map.json` (135) and
  `scratch/t087/universe.json` (88).
- **AGE Aris may not delete these itself.** AGENTS.md's hard constraint: in
  a tracked repository it changes one task file per operator action and
  "never touches … anything outside the board's task folders". So AGE Aris
  reports, checks and prints the removal command, and the operator runs it.
  Letting AGE Aris delete would mean amending that constraint, which is the
  operator's decision and is not part of this task. Every removal is a
  `data-migration` spend either way.
- How others keep this scalable:
  - Nextflow keeps intermediates in `work/`, publishes outputs elsewhere, and
    removes `work/` on success (`cleanup = true`, `nextflow clean`).
  - DVC and lakeFS share inputs read-only instead of copying them.
  - HPC scratch is purged by last access (TACC 10 days, Pawsey 21, NERSC 8
    weeks).
- The disk is ext4, so reflinks are not available. Read-only hardlinks are.
- **AGEIS's half belongs on AGEIS's board, not here.** That half covers
  opening the bench corpus read-only (`mode=ro`, or `immutable=1` since its
  sha256 is pinned), copying only for writes, and one ccache with worktrees
  under `scratch/lock/`. This task covers what AGE Aris does on close.

## Steps

- [ ] The operator approves the decision rules below. Then claim.
- [ ] **Free, read-only:** a `scratch report` for a tracked repository. Per
      done task it lists:
  - the scratch folder size;
  - the write-up's references into its own folder;
  - any files in that folder read by an open task or by another task's
    write-up.
- [ ] Run the report on AGEIS, and commit the result to PROGRESS.md.
- [ ] **Free:** a self-containment check. A write-up passes when it cites
      nothing inside its own scratch folder, and its Result states the
      numbers, the method and the commands to reproduce them.
- [ ] The close step, shown on the done task's page:
  - the shared inputs to move first, and the location the operator named;
  - the check's result;
  - once both are clear, the exact removal command, with the folder's size
    and file listing. The operator runs it; AGE Aris does not.
- [ ] A purge warning for scratch not accessed in 21 days. It warns and
      lists; it never deletes.
- [ ] The operator's go for the one-time pass over AGEIS's 34 done tasks.

## Decision rules — fixed in advance

*Drafted 2026-10-22, before any spend. They bind once the operator approves
them.*

- **Scope of a delete:** only `scratch/<task-id>/` of a task whose file is in
  `done/`. Never these:
  - `scratch/sp500-years/`;
  - `scratch/lock/`;
  - any other folder not named for a task;
  - a folder of an open task.
- **Nothing is deleted that anything still reads.** A file cited by an open
  task, or by another task's write-up, moves first. If it cannot move, the
  folder stays and the report says why.
- **A dry run comes first, every time.** It lists every path and the bytes it
  would free. The operator's go is given on that listing.
- **Spend:** `data-migration`, the one-time AGEIS pass of at most 34 folders
  and about 98 GB. After that, one folder per task close. Each folder is
  checkpointed `doing` before its removal and `did` after it.
- **Pass:** all of these hold.
  - Every done task in AGEIS passes the self-containment check, or is listed
    with what it is missing.
  - `scratch/` shrinks by at least 80 GB.
  - Every path cited by an open task still resolves after the pass.
  - The bench corpus sha256 is unchanged (`6629e1df…`).
- **Otherwise:** each failure is listed, and the operator decides whether to
  delete by hand or keep the folder.

## Handoff — state at last stop

*Kept true while claimed, not written on the way out (rule 8).*

- **Last touched:** 2026-10-22, registered at the operator's request
- **In flight:** nothing
- **On disk:** nothing
- **Resume with:** the operator's approval of the decision rules; then claim
- **Next decision:** where shared inputs live after they move out of a task
  folder, and the 80 GB bar

## Verify

After the pass, `du -sh scratch/` on AGEIS, and a check that every
`scratch/` path in open task files still resolves. The bench corpus sha256
matches.

## Result

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
