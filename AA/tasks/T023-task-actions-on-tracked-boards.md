---
id: T023
title: "Task actions on tracked AA boards, end to end; the read-only rule lifted"
status: claimed
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

- [ ] `actOnTask`, `WorkspaceError` `code`/`remedy`, `holder`, `actions`, `taskActions` switch, `recoverInflight` in `init()`.
- [ ] `POST /api/tasks/:id/actions`, `AGESIGHT_TRACKED_WRITES`, one-line stderr refusals.
- [ ] The drawer action bar on tracked tasks, the confirmation dialog, the switch with its disclosure.
- [ ] Every read-only string and the rule in AGENTS.md, DESIGN.md, README.md, skills/aa/SKILL.md.

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

- **Last touched:** 2026-10-08, adervark @v/b384188f (took the claim back after session 578f7ba9 and its worker died mid-UI; worker run reaped on the trail)
- **In flight:** an independent review run (`b384188f.3177`) of the uncommitted diff
- **On disk:** worktree `.claude/worktrees/agent-a16813091227f8118`, uncommitted: workspace actOnTask and switch, server route, drawer action bar on tracked tasks, CONFIRM dialog, header switch, every read-only string and the §2 rule in AGENTS/DESIGN/README/skills, tests (unit, server, e2e 5 tracked scenarios). `npm test` 470/470, `npm run check` ok, `npm run e2e` 24/24, acceptance grep prints the four permitted lines — all verified 2026-10-08 in that worktree
- **Resume with:** read the review findings (or re-run a review if lost), fix the confirmed ones, re-run the three suites, commit the worktree's diff onto `feature/pm-cockpit` as one commit, record the e2e run in PROGRESS.md
- **Next decision:** none

## Verify

The line-break-insensitive check in plan §5 T023 prints exactly the four lines it names; each §4 code has a test asserting status, code and an unchanged repository.

## Result

*(on completion: the outcome against the decision rules above, a pointer to the
entry in the log, and the digest from `AA/ckpt.sh close T023` — then
retire the trail with `--delete`)*

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
