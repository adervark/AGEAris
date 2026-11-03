---
id: T119
title: "AGEIS releases its own finished tasks: rule 13 in its board"
status: in-progress
owner: adervark @b/cc5901e7 2026-11-03 — upgrading AGEIS's ckpt.sh, AA.yml and WORKFLOW.md
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

- [ ] AGEIS's `AA/ckpt.sh` becomes the template's (a superset: the trail
      format and the commands it already had are unchanged).
- [ ] AGEIS gains `AA/AA.yml` with the release keys only: `trunk: main`,
      `scratch`, `keep_kinds`, `keep_max_kb`, `keep_task_mb`,
      `archive: ~/Archive/AGEIS`, and its own `stale_hours`.
- [ ] Rule 13 in AGEIS's `WORKFLOW.md`, and the release in its parts table.
- [ ] Check in AGEIS: `live`, `check`, a `release --dry-run` on a released
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

Claimed.

## Result
