---
id: T024
title: "The card menu, the keyboard map, and drag through the action registry"
status: open
owner: —
# type: one word; tasks of one type are timed together; `bug` counts as defect work
type: feature
# blockedReason: while blocked, one line saying what unblocks it; cleared on unblock
blockedReason: ""
depends: [T023]
created: 2026-10-07
---

# T024 — The card menu, the keyboard map, and drag through the action registry

## Goal

Every task action is reachable from a card's "⋯" menu, from the keyboard (c b u d r p a, `.`), and by drag, with the same refusals; the card has no nested interactive elements.

## Context

- The plan: [docs/plans/task-control.md](../../docs/plans/task-control.md)
  (v3.1). Approved by the operator 2026-10-07 after Planner, Architect and
  Critic consensus; Q1–Q3 decided as recorded in its §10.
- Plan §1 D, §5 T024.
- Needs T023.

## Steps

- [ ] `taskCard` and `taskRow` with the menu; the keyboard map; drag through `performAction`.
- [ ] `refreshPaused` and `focusSelector` updates; styles; DESIGN.md paragraph.

## Decision rules — fixed in advance

- `agent-fan-out` is a spend: at most one worker subagent per task at a
  time, opened with `AA/ckpt.sh open T024 --agent …` and a `doing` line
  before it is spawned. A worker that fails twice stops the fan-out; the
  task goes back to its owner's session.
- `data-migration`: tests write only to temporary repositories. Nothing here
  touches `.agesight-data` or any tracked repository on this machine.
- `push`: none.
- Done means every Acceptance line in the plan's section for T024 holds, and
  `npm test` and `npm run check` pass on the commit.

## Handoff — state at last stop

*Kept true while claimed, not written on the way out (rule 8).*

- **Last touched:** 2026-10-07, adervark @k/578f7ba9 (registered, never claimed)
- **In flight:** nothing
- **On disk:** nothing yet
- **Resume with:** read the plan's section for T024
- **Next decision:** none

## Verify

Keyboard only: Tab to a backlog card on a tracked board, press `c`, and it is In progress with focus on it; no sideways scroll at 390 px; `npm run e2e` passes.

## Result

*(on completion: the outcome against the decision rules above, a pointer to the
entry in the log, and the digest from `AA/ckpt.sh close T024` — then
retire the trail with `--delete`)*

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
