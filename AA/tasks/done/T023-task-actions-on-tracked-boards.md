---
id: T023
title: "Task actions on tracked AA boards, end to end; the read-only rule lifted"
status: done
owner: adervark @v/b384188f 2026-10-08 — finishing T023 after its session died (was @k/578f7ba9 2026-10-08 — wiring task actions into tracked AA boards)
# type: one word; tasks of one type are timed together; `bug` counts as defect work
type: feature
# blockedReason: while blocked, one line saying what unblocks it; cleared on unblock
blockedReason: ""
depends: [T021, T022]
created: 2026-10-07
---

# T023 — Task actions on tracked AA boards, end to end; the read-only rule lifted

## Goal

Claim, release, block, unblock and done work from AGE Aris on a tracked AA board, in both layouts, once the operator switches task actions on for that repository; the hard constraint is replaced by the plan's §2 rule in the same commit.

## Context

- The plan: [docs/plans/task-control.md](../../docs/plans/task-control.md)
  (v3.1). Approved by the operator 2026-10-07 after Planner, Architect and
  Critic consensus; Q1–Q3 decided as recorded in its §10.
- Plan §2 (the new rule), §4 (semantics and refusals), §5 T023 (including every read-only string to change), §8.
- Needs T021 and T022.

## Steps

- [x] `actOnTask`, `WorkspaceError` `code`/`remedy`, `holder`, `actions`, `taskActions` switch, `recoverInflight` in `init()`.
- [x] `POST /api/tasks/:id/actions`, `AGESIGHT_TRACKED_WRITES`, one-line stderr refusals.
- [x] The drawer action bar on tracked tasks, the confirmation dialog, the switch with its disclosure.
- [x] Every read-only string and the rule in AGENTS.md, DESIGN.md, README.md, skills/aa/SKILL.md.

## Decision rules — fixed in advance

- `agent-fan-out` is a spend: at most one worker subagent per task at a
  time, opened with `AA/ckpt.sh open T023 --agent …` and a `doing` line
  before it is spawned. A worker that fails twice stops the fan-out; the
  task goes back to its owner's session.
- `data-migration`: tests write only to temporary repositories. Nothing here
  touches `.agesight-data` or any tracked repository on this machine.
- `push`: none.
- Done means every Acceptance line in the plan's section for T023 holds, and
  `npm test` and `npm run check` pass on the commit.

## Handoff — state at last stop

*Kept true while claimed, not written on the way out (rule 8).*

- **Last touched:** 2026-10-08, adervark @v/b384188f (done, 4bae6ce)
- **In flight:** nothing
- **On disk:** nothing; the worker's worktree `.claude/worktrees/agent-a16813091227f8118` holds only what 4bae6ce carries
- **Resume with:** nothing; follow-ups are T024, T025 and T026
- **Next decision:** none

## Verify

The line-break-insensitive check in plan §5 T023 prints exactly the four lines it names; each §4 code has a test asserting status, code and an unchanged repository.

## Result

**Done, 4bae6ce.** Against the decision rules:

- Every Acceptance line in plan §5 T023 holds:
  - A claim through `/actions` on a temporary repository lands as specified in
    both layouts: moved with `backlog/`, in place without; `status: claimed`,
    the owner line, `AGESight-Via: ui`, the repository's identity, the pinned
    branch, and a clean index and working tree.
  - Every §4 code has a test that asserts the status, the code and an
    unchanged repository (`tests/task-actions.test.mjs`, confirmed by the
    review).
  - AGE Aris project actions through `/actions` produce the same file as the
    equivalent `PATCH`.
  - The line-break-insensitive grep prints exactly the four permitted lines.
  - `npm run e2e` 24 of 24, five of them on tracked boards; recorded in
    PROGRESS.md.
- `npm test` 473 of 473 and `npm run check` pass on 4bae6ce.
- `agent-fan-out`: two runs, one at a time. The worker died with its parent
  session, which is not a failure of the worker, so the fan-out did not stop;
  the owner session took the claim back (rule 3) and finished the work.
- `data-migration`: tests write only to temporary repositories. `push`: none.
- Independent review: REQUEST CHANGES. It found one HIGH, reproduced: a change
  built from the working tree's file before the lock could commit an edit
  discarded before the lock was taken. Now refused as DIRTY_FILE; the
  regression test fails without the fix. It also found one MEDIUM, reproduced:
  a symlinked trail broke the drawer and gave a 500. Now it needs a
  confirmation. Two LOWs were fixed: the confirm token is bound to its
  action, and the history walk runs only for an own agent's hold. The
  remaining LOWs are T026.
- Deviation recorded in README: Done leaves the checkpoint trail in place
  (`TRAIL_NOT_RETIRED`).
- Log: PROGRESS.md, 2026-10-08 — T023.

Run digest (`AA/ckpt.sh close T023`):

- **578f7ba9.0d2a** (executor-opus @k/578f7ba9): workspace actOnTask, server route, and part of the UI in worktree agent-a16813091227f8118, uncommitted · cost agent-fan-out: one opus run, died with its parent session at ~19:40Z · left: UI step unfinished; read-only strings and docs not done
- **b384188f** (session @v/b384188f): T023 landed as 4bae6ce · cost this session; one review run · left: review LOWs filed as T026
- **b384188f.3177** (code-reviewer-opus @v/b384188f): 1 HIGH, 1 MEDIUM, 6 LOW · cost agent-fan-out: one opus run

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
