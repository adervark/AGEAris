---
id: T026
title: "Tracked task actions: the review's remaining low findings"
status: open
owner: —
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

- [ ] Ask the operator about Claim over an own agent's hold.
- [ ] Put the checks in §4's order, or amend §4 where the code's order is the better one, and test the overlaps.
- [ ] Cap the AA.yml read under the lock.
- [ ] The missing tests above.

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

- **Last touched:** 2026-10-08, adervark @v/b384188f (registered, never claimed)
- **In flight:** nothing
- **On disk:** nothing yet
- **Resume with:** the Context above, then T023's Result
- **Next decision:** Claim over an own agent's hold (operator)

## Verify

A test per overlapping pair asserts which code wins and an unchanged repository; the stderr test finds no `@` address in the line.

## Result

*(on completion: the outcome against the decision rules above, a pointer to the
entry in the log, and the digest from `AA/ckpt.sh close T026` — then
retire the trail with `--delete`)*

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
