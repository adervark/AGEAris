---
id: T025
title: "Say on the project page that STATE.md is behind, or kept by hand"
status: done
owner: adervark @b/cc5901e7 2026-11-03 — stateBehind and the project-page note
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

- [x] `stateBehind` in `lib/brief.mjs` with `lib/history.mjs`.
- [x] The note in `public/cockpit.js`; tests in `tests/brief.test.mjs` and `tests/cockpit-ui.test.mjs`.

## Decision rules — fixed in advance

- `agent-fan-out` is a spend: at most one worker subagent per task at a
  time, opened with `AA/ckpt.sh open T025 --agent …` and a `doing` line
  before it is spawned. A worker that fails twice stops the fan-out; the
  task goes back to its owner's session.
- `data-migration`: tests write only to temporary repositories. Nothing here
  touches `.agearis-data` or any tracked repository on this machine.
- `push`: none.
- Done means every Acceptance line in the plan's section for T025 holds, and
  `npm test` and `npm run check` pass on the commit.

## Handoff — state at last stop

*Kept true while claimed, not written on the way out (rule 8).*

- **Last touched:** 2026-11-03, adervark @b/cc5901e7 (done)
- **In flight:** nothing
- **On disk:** committed in a21c63a and 2c3ee30
- **Resume with:** nothing; closed
- **Next decision:** none

## Verify

After two claims on a board.sh board the note names both; a NOW-only edit keeps it; `board.sh --write` plus a commit clears it. On a hand-kept board an unrelated STATE.md commit keeps T077 listed.

## Result

Every Acceptance line in plan §5 T025 holds:

- **A `board.sh` board** (`tests/task-actions.test.mjs`, real repositories).
  After AGE Aris claims T004 and T012, the note names both. A commit that
  edits only the NOW block leaves them listed. A commit adding board.sh's
  header line clears them, and a later Block makes T004 behind again.
- **A hand-kept board.** An unrelated STATE.md commit leaves T004 listed,
  and so does a line naming `T0040`, which is a different id. A line naming
  T004 clears it.
- **An AGE Aris project** never carries `stateBehind`. A change made by hand
  in the repository is not reported either.
- **On the page** (`npm run e2e`): after the keyboard claim on the hand-kept
  test board, the project page says "STATE.md is kept by hand here; its
  lines for T001 and T004 predate their changes in AGE Aris, as far as the
  commits show."

How it works (`lib/brief.mjs`):
- `uiChanges` takes each task's newest `via: ui` change from the ledger.
- One `git log -p` of STATE.md, capped at 200 commits, and one `rev-list`
  give the exact first-parent order. Both are read once per HEAD.
- `stateBehind` is pure. A first version ordered commits by committer time,
  and the tests caught it: a change in the same second as a regeneration
  read as covered. Order now comes from the first-parent line, and time is
  used only beyond 20,000 commits.

`npm test` passed 596/596, and `npm run check` is clean.

**Spend:** none.

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
