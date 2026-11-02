---
id: T024
title: "The card menu, the keyboard map, and drag through the action registry"
status: done
owner: adervark @b/cc5901e7 2026-11-03 — the card menu, the keyboard map, and drag through performAction
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

- [x] `taskCard` and `taskRow` with the menu; the keyboard map; drag through `performAction`.
- [x] `refreshPaused` and `focusSelector` updates; styles; DESIGN.md paragraph.

## Decision rules — fixed in advance

- `agent-fan-out` is a spend: at most one worker subagent per task at a
  time, opened with `AA/ckpt.sh open T024 --agent …` and a `doing` line
  before it is spawned. A worker that fails twice stops the fan-out; the
  task goes back to its owner's session.
- `data-migration`: tests write only to temporary repositories. Nothing here
  touches `.agearis-data` or any tracked repository on this machine.
- `push`: none.
- Done means every Acceptance line in the plan's section for T024 holds, and
  `npm test` and `npm run check` pass on the commit.

## Handoff — state at last stop

*Kept true while claimed, not written on the way out (rule 8).*

- **Last touched:** 2026-11-03, adervark @b/cc5901e7 (done)
- **In flight:** nothing
- **On disk:** committed in a21c63a and 2c3ee30
- **Resume with:** nothing; closed
- **Next decision:** none

## Verify

Keyboard only: Tab to a backlog card on a tracked board, press `c`, and it is In progress with focus on it; no sideways scroll at 390 px; `npm run e2e` passes.

## Result

Every Acceptance line in plan §5 T024 holds, each checked by `npm run e2e`:

- **Keyboard only:** Tab to backlog T004 on a tracked board and press `c`.
  It is claimed in one commit, sits in In progress, and focus is on its card.
- **The menu:** "⋯" opens with Enter, Space and `.`, and also with a right
  click, the ContextMenu key or Shift+F10. Arrows, Home and End move in it,
  and Escape returns focus to its button.
- **The same refusals:** the menu, the keys and a drag go through
  `performAction`. While task actions are off, all three refuse with the same
  reason, and the card cannot be dragged (`canMove`).
- **No nested interactive elements:** the card is an `<article>` holding a
  stretched `.card-open` button and the `.card-menu` button side by side.
- **390 px:** no sideways scroll, with or without a menu open.
- **Tests:** `npm test` 596/596 and `npm run check` clean. `npm run e2e`
  passed 32/32 twice on `2c3ee30` and is recorded in PROGRESS.md, 2026-11-03.

The review ran as one `code-reviewer` subagent (run `cc5901e7.c17f`). Its
verdict was COMMENT, with no blocker, and all five findings are fixed in
`2c3ee30`:

- macOS Safari and Firefox lost a menu click to `focusout`.
- The drag image was empty.
- The menu could be clipped by the board.
- Chip tooltips sat under the open button.
- Escape also closed the sidebar.

Its smaller points are done too: Caps Lock keys work, `o` (Reopen) is in
DESIGN.md, and the menu has no non-item child.

Not done: the plan's note that DESIGN.md's text sketch shows "Tracked".

Run digest:
- **cc5901e7.c17f** (reviewer @b/cc5901e7): review returned, fixes made in the owner's session.

**Spend:** `agent-fan-out`, one reviewer subagent, opened and ended on the trail.

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
