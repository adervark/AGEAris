---
id: T026
title: "Tracked task actions: the review's remaining low findings"
status: done
owner: adervark @k/adccab68 2026-10-08 — ckpt.sh check's exit; the task-action review's last findings
# type: one word; tasks of one type are timed together; `bug` counts as defect work
type: bug
# blockedReason: while blocked, one line saying what unblocks it; cleared on unblock
blockedReason: ""
depends: [T023]
created: 2026-10-08
---

# T026 — Tracked task actions: the review's remaining low findings

## Goal

The refusals on a tracked board come in §4's order, Claim on a task the operator's own agent holds does what the operator decides, and the tests cover the overlaps.

## Context

- The independent review of T023 (its Result, run `b384188f.3177`). Its HIGH
  and MEDIUM findings and two LOWs were fixed in 4bae6ce; these were not.
- The plan: [docs/plans/task-control.md](../../docs/plans/task-control.md) §4.
- **Order.** `lib/workspace.mjs` `_actOnTrackedTask`: a legacy board with the
  switch off answers LEGACY_BOARD, though §4 puts ACTIONS_OFF first.
  NOT_FOUND, BAD_INPUT and NOT_ALLOWED come before WRONG_BRANCH, GIT_BUSY and
  NO_IDENTITY. In `lib/tracked.mjs` (around `:875`), NOT_COMMITTED and the
  not-a-regular-file DIRTY_FILE come before DUPLICATE_ID … STALE. Each
  refusal still changes nothing.
- **Claim over an own agent's hold.** §4 says the owner line is kept except on
  Release; its Claim row writes a new one, and the code does that. A claimed
  task is rarely in the queue, so this is rare. **Needs the operator's
  decision** before any change.
- **AA.yml read under the lock** (`head.read`) has no size cap;
  `readBoardConfig` caps at 64 KB.
- **Test gaps:** overlapping refusals (HELD_BY_OTHER with RUN_LIVE, WIP_LIMIT
  with STALE, CONFIRM with NOT_ALLOWED); DIRTY_FILE staged-only and "target
  exists" at action level; GIT_BUSY on a detached HEAD at action level; email
  redaction in the server's `tracked action …` stderr line.

## Steps

- [x] Ask the operator about Claim over an own agent's hold.
- [x] Put the checks in §4's order, or amend §4 where the code's order is the better one, and test the overlaps.
- [x] Cap the AA.yml read under the lock.
- [x] The missing tests above.

## Decision rules — fixed in advance

- `agent-fan-out` is a spend: at most one worker subagent per task at a
  time, opened with `AA/ckpt.sh open T026 --agent …` and a `doing` line
  before it is spawned. A worker that fails twice stops the fan-out; the
  task goes back to its owner's session.
- `data-migration`: tests write only to temporary repositories. Nothing here
  touches `.agesight-data` or any tracked repository on this machine.
- `push`: none.
- Done means each item in Context is fixed, tested, or recorded as decided
  against, and `npm test` and `npm run check` pass on the commit.

## Handoff — state at last stop

*Kept true while claimed, not written on the way out (rule 8).*

- **Last touched:** 2026-10-08, adervark @k/adccab68 (done)
- **In flight:** nothing
- **On disk:** nothing
- **Resume with:** nothing
- **Next decision:** none

## Verify

A test per overlapping pair asserts which code wins and an unchanged repository; the stderr test finds no `@` address in the line.

## Result

**Done.** Each item in Context, in turn:

- **Order.** Fixed where §4 was right: the switch (`ACTIONS_OFF`) is now
  checked before the folder name (`LEGACY_BOARD`). Amended in §4 where the
  code's order is the better one:
  - `NOT_FOUND`, a missing `version` and a non-AA action are refused before
    the repository is read.
  - `NOT_COMMITTED` and a non-regular file in HEAD come right after
    `GIT_BUSY`, because every later check reads the file from HEAD.

  Tested, with each overlap refused in that order:
  - a `deaddrop/` board with the switch off is `ACTIONS_OFF`;
  - another operator's task with a live run is `HELD_BY_OTHER`;
  - an own agent's task asked to unblock while claimed is `CONFIRM`, not
    `NOT_ALLOWED`;
  - a claim at the WIP limit with a stale version is `WIP_LIMIT`.
- **Claim over an own agent's hold.** The operator decided (Notes): take it
  back. Claim writes the AGE Aris owner line and keeps the agent's after it
  (`; was …`), as AA rule 3 says. §4's Holders paragraph and Claim row, and
  README, say so. Tested; a claim on an unclaimed task names no one.
- **AA.yml under the lock.** `head.read` takes `max`; the WIP limit's read
  uses `BOARD_CONFIG_MAX` (64 KB), the cap `readBoardConfig` has. Tested: a
  75 KB `AA.yml` with a limit of 1 does not refuse a claim, as everywhere else.
- **Test gaps.** All covered:
  - `DIRTY_FILE` for a change only in the index, and for a target that
    already exists;
  - `GIT_BUSY` on a detached HEAD;
  - email redaction in the server's stderr line (`Ops [email redacted]`).

  These four passed before too; they are coverage. The order, Claim and cap
  tests fail without the change.
- Also: `docs/PIPELINE.md` no longer says AGE Aris "only reads" a tracked
  repository (found in T028).
- No fan-out was used; tests write only to temporary repositories; no push.
  `npm test` 489 of 489 and `npm run check` pass.
- Log: PROGRESS.md, 2026-10-08 — T026.

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*

- 2026-10-08, the operator (asked by adervark @k/adccab68): Claim over an own
  agent's hold takes it back. It writes the AGE Aris owner line and keeps the
  agent's line after it (`; was …`), as AA rule 3 says; plan §4 is amended to match.
