---
id: T025
title: "Say on the project page that STATE.md is behind, or kept by hand"
status: open
owner: —
# type: one word; tasks of one type are timed together; `bug` counts as defect work
type: feature
# blockedReason: while blocked, one line saying what unblocks it; cleared on unblock
blockedReason: ""
depends: [T023]
created: 2026-10-07
---

# T025 — Say on the project page that STATE.md is behind, or kept by hand

## Goal

The project page names the tasks whose AGE Aris changes STATE.md has not caught up with, on generated and hand-kept boards alike, as far as the commits show.

## Context

- The plan: [docs/plans/task-control.md](../../docs/plans/task-control.md)
  (v3.1). Approved by the operator 2026-10-07 after Planner, Architect and
  Critic consensus; Q1–Q3 decided as recorded in its §10.
- Plan §1 B (STATE.md is never written; operator's Q2), §5 T025.
- Needs T023.

## Steps

- [ ] `stateBehind` in `lib/brief.mjs` with `lib/history.mjs`.
- [ ] The note in `public/cockpit.js`; tests in `tests/brief.test.mjs` and `tests/cockpit-ui.test.mjs`.

## Decision rules — fixed in advance

- `agent-fan-out` is a spend: at most one worker subagent per task at a
  time, opened with `AA/ckpt.sh open T025 --agent …` and a `doing` line
  before it is spawned. A worker that fails twice stops the fan-out; the
  task goes back to its owner's session.
- `data-migration`: tests write only to temporary repositories. Nothing here
  touches `.agesight-data` or any tracked repository on this machine.
- `push`: none.
- Done means every Acceptance line in the plan's section for T025 holds, and
  `npm test` and `npm run check` pass on the commit.

## Handoff — state at last stop

*Kept true while claimed, not written on the way out (rule 8).*

- **Last touched:** 2026-10-07, adervark @k/578f7ba9 (registered, never claimed)
- **In flight:** nothing
- **On disk:** nothing yet
- **Resume with:** read the plan's section for T025
- **Next decision:** none

## Verify

After two claims on a board.sh board the note names both; a NOW-only edit keeps it; `board.sh --write` plus a commit clears it. On a hand-kept board an unrelated STATE.md commit keeps T077 listed.

## Result

*(on completion: the outcome against the decision rules above, a pointer to the
entry in the log, and the digest from `AA/ckpt.sh close T025` — then
retire the trail with `--delete`)*

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
