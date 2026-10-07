---
id: T022
title: "Task actions in the drawer, on AGE Aris projects first"
status: done
owner: adervark @k/578f7ba9 2026-10-07 — drawer action bar built
# type: one word; tasks of one type are timed together; `bug` counts as defect work
type: feature
# blockedReason: while blocked, one line saying what unblocks it; cleared on unblock
blockedReason: ""
depends: []
created: 2026-10-07
---

# T022 — Task actions in the drawer, on AGE Aris projects first

## Goal

On an AGE Aris project, Start, Block, Done, Release, Priority and Assign each take one click (or one click and Enter) from the task drawer, through one action registry; nobody needs "Save changes" for them.

## Context

- The plan: [docs/plans/task-control.md](../../docs/plans/task-control.md)
  (v3.1). Approved by the operator 2026-10-07 after Planner, Architect and
  Critic consensus; Q1–Q3 decided as recorded in its §10.
- Plan §1 D and E, §5 T022, §6 (the restructuring and the need behind each piece).
- Runs in parallel with T021; WIP limit 2.

## Steps

- [ ] `public/actions.js`: `TASK_ACTIONS`, `availability`, `actionRequest`; pure, no DOM.
- [ ] `public/app.js`: `performAction`, the drawer action bar, one delegated `[data-action]` handler for `#main` and `#task-dialog`, `moveTask` through `performAction`, `api()` keeps `code` and `remedy`.
- [ ] `public/styles.css` from tokens; `tests/actions.test.mjs`; `tests/e2e/task-actions.e2e.mjs` behind `npm run e2e`.

## Decision rules — fixed in advance

- `agent-fan-out` is a spend: at most one worker subagent per task at a
  time, opened with `AA/ckpt.sh open T022 --agent …` and a `doing` line
  before it is spawned. A worker that fails twice stops the fan-out; the
  task goes back to its owner's session.
- `data-migration`: tests write only to temporary repositories. Nothing here
  touches `.agesight-data` or any tracked repository on this machine.
- `push`: none.
- Done means every Acceptance line in the plan's section for T022 holds, and
  `npm test` and `npm run check` pass on the commit.

## Handoff — state at last stop

*Kept true while claimed, not written on the way out (rule 8).*

- **Last touched:** 2026-10-08, adervark @k/578f7ba9
- **In flight:** nothing; done
- **On disk:** committed as 1858a92 and 4d78075, with this task's move to `done/`
- **Resume with:** nothing to resume
- **Next decision:** none

## Verify

`node --test tests/actions.test.mjs` passes; `npm run e2e` passes its drawer scenarios and the run is in PROGRESS.md; a tracked task still opens the read-only viewer.

## Result

Pass, against the decision rules.

- **Built** (1858a92, by a worker subagent in its own worktree):
  - `public/actions.js`, a pure registry: `TASK_ACTIONS`, `availability`,
    `actionRequest` and `actionFor`. Priority and Assign sit behind
    `CAPABILITIES`; they are off on AA boards with "AA is pull-based: claim it
    or leave it in the queue" (Q1).
  - `performAction` in `public/app.js`, the single entry point, with the
    drawer action bar: Start, Unblock, Block (with an optional reason), Done,
    Release, Reopen, Priority and Assign. Each takes one click, or one click
    and Enter, with no "Save changes".
  - One delegated handler serves `#main` and `#task-dialog`. A linked task now
    swaps the drawer in place, and a drag goes through `actionFor`.
  - `server.mjs` serves `actions.js`; there are no new routes.
- **Independent review** (code-reviewer, opus): APPROVE, with three medium
  findings. Fixed in 4d78075:
  - a refusal left the drawer stale, so every retry failed;
  - nothing guarded a second action in flight;
  - unsaved Priority and Owner edits were dropped after an action.

  Each fix has an e2e test that fails without it. The worker checked this by
  reverting each fix in turn.
- Tracked tasks still open the read-only viewer, with no action bar.
- On `feature/pm-cockpit` at 4d78075: `npm run check` passes, `npm test`
  passes 383 of 383, and `npm run e2e` passes 19 of 19.
- **Spend:** `agent-fan-out`, three runs:
  - a worker (sonnet), cut off once by the usage limit and resumed from its
    trail;
  - its fix pass;
  - one review (opus).

  Nothing was pushed or migrated.
- **Run digest:**
  - 578f7ba9.9b59 (worker): commits 3c8f9e0 and 4411895, landed as 1858a92
    and 4d78075.
  - 578f7ba9.e89a (reviewer): APPROVE on 3c8f9e0.
  - 578f7ba9: one misfiled `doing`, corrected.
- **Log:** `PROGRESS.md`, 2026-10-08 — T022.

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
