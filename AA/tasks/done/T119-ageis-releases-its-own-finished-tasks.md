---
id: T119
title: "AGEIS releases its own finished tasks: rule 13 in its board"
status: done
owner: adervark @b/cc5901e7 2026-11-03 — done
# type: one word; tasks of one type are timed together; `bug` counts as defect work
type: chore
# blockedReason: while blocked, one line saying what unblocks it; cleared on unblock
blockedReason: ""
depends: [T111, T114]
created: 2026-11-03
---

# T119 — AGEIS releases its own finished tasks

## Goal

In AGEIS, `AA/ckpt.sh close T### --delete` on a done task releases its
environment (rule 13), as it does here, so `scratch/` stops refilling after
T114's one-time cleanup.

## Context

- T114 ran this repository's `ckpt.sh release` against AGEIS from outside.
  AGEIS's own `AA/ckpt.sh` is the 217-line copy from before T111, with no
  `release`, and AGEIS has no `AA/AA.yml`, so it has no `archive:` either.
- AGEIS's board is the older form: `WORKFLOW.md`, a hand-kept `STATE.md`, no
  `board.sh`. That stays; only the trail script and the release settings
  change.
- Operator, 2026-11-03, on a side agent's note saying so: "fix this".

## Steps

- [x] AGEIS's `AA/ckpt.sh` becomes the template's (a superset: the trail
      format and the commands it already had are unchanged).
- [x] AGEIS gains `AA/AA.yml` with the release keys only: `trunk: main`,
      `scratch`, `keep_kinds`, `keep_max_kb`, `keep_task_mb`,
      `archive: ~/Archive/AGEIS`, and its own `stale_hours`.
- [x] Rule 13 in AGEIS's `WORKFLOW.md`, and the release in its parts table.
- [x] Check in AGEIS: `live`, `check`, a `release --dry-run` on a released
      task, on a held one (T123), and `--list`.

## Decision rules — fixed in advance

- `data-migration` (anything in a tracked repository) is the spend; the
  AGEIS commit is preceded by a `doing`.
- Only `AA/ckpt.sh`, `AA/AA.yml` and `AA/WORKFLOW.md` change in AGEIS, in one
  commit naming only those paths. The other session's uncommitted files there
  are not touched. No push.
- If the new script's `live` or `check` disagrees with the old one's on
  AGEIS's trails, stop and keep the old script.

## Handoff

Done. Nothing in flight.

## Result

AGEIS commit `f8b0f90` on `main` (not pushed) changes only `AA/ckpt.sh`,
`AA/AA.yml` and `AA/WORKFLOW.md`. From now on `ckpt.sh close T### --delete`
in AGEIS releases a done task's `scratch/`, and `ckpt.sh release T###` works
there on its own; the archive is `~/Archive/AGEIS`.

- **Trails read the same.** On AGEIS's four trails (T057, T058, T105,
  T113) the new `check` and the old one agree: 141 records, 0 unparseable.
  `live` lists the same runs. One difference, and it is a correction: the
  old script listed T113's 7-day-old `doing` as in flight; the new one
  calls it stopped mid-act, since its process is gone.
- **Dry runs in AGEIS.** T092: nothing left. T123: its six session worktrees
  stay (their branches are checked out). T087: kept whole, because open
  T117 cites it. T113: refused, not in `done/`. Every dry run also names the
  subagent worktree holding the uncommitted `cpp/tests/t123_char.inc`,
  which stays until someone commits or removes it.
- **End to end**, on a temporary repository with AGEIS's board files and an
  archive in the scratchpad: `close --delete` committed the trail, kept the
  cited `run.py` and `notes.md` in `AA/evidence/T900/`, archived a 2 MB CSV
  with its sha256 in `RELEASED.tsv`, and deleted the 7 MB folder with its
  build.
- AGEIS's board otherwise stays the older form (`WORKFLOW.md`, a hand-kept
  `STATE.md`, no `board.sh`), so it has no `--litter` list; `release
  --dry-run` is the check there.
- Filed T120: the installed `aa-init` skill in all five profiles is the
  2026-09-30 copy, without `release`, so a board scaffolded today still
  lacks rule 13.

Run digest:
- **cc5901e7** (session @b/cc5901e7): AGEIS f8b0f90; T120 filed · cost no spend beyond the AGEIS commit · left: —
