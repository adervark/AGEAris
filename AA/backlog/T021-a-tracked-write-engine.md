---
id: T021
title: "A tracked-write engine that commits one task file under git's lock"
status: open
owner: —
# type: one word; tasks of one type are timed together; `bug` counts as defect work
type: feature
# blockedReason: while blocked, one line saying what unblocks it; cleared on unblock
blockedReason: ""
depends: []
created: 2026-10-07
---

# T021 — A tracked-write engine that commits one task file under git's lock

## Goal

`lib/tracked.mjs` commits one task-file change to a tracked repository's pinned branch under `.git/index.lock`, with every outcome committed, unchanged, or reported as interrupted. Nothing reaches it from the API yet: the product still never writes to a tracked repository.

## Context

- The plan: [docs/plans/task-control.md](../../docs/plans/task-control.md)
  (v3.1). Approved by the operator 2026-10-07 after Planner, Architect and
  Critic consensus; Q1–Q3 decided as recorded in its §10.
- Plan §3 (the write protocol), §4 (`readTrail`, `setResult`), §5 T021, §7 pre-mortem 1, §8 unit and integration tests.
- Runs in parallel with T022; WIP limit 2.

## Steps

- [ ] `lib/workspace.mjs` `git()`: `input`, `timeout`, filtered `env` overrides; `boardPolicy` returns `blockedLimit`, `staleHours` defaults to 24.
- [ ] `lib/tracked.mjs` per plan §5 T021.
- [ ] `tests/tracked.test.mjs` with real-file fixtures and the seam, crash, recovery and timeout tests in §8.
- [ ] `package.json` `check` adds `lib/tracked.mjs`.

## Decision rules — fixed in advance

- `agent-fan-out` is a spend: at most one worker subagent per task at a
  time, opened with `AA/ckpt.sh open T021 --agent …` and a `doing` line
  before it is spawned. A worker that fails twice stops the fan-out; the
  task goes back to its owner's session.
- `data-migration`: tests write only to temporary repositories. Nothing here
  touches `.agesight-data` or any tracked repository on this machine.
- `push`: none.
- Done means every Acceptance line in the plan's section for T021 holds, and
  `npm test` and `npm run check` pass on the commit.

## Handoff — state at last stop

*Kept true while claimed, not written on the way out (rule 8).*

- **Last touched:** 2026-10-07, adervark @k/578f7ba9 (registered, never claimed)
- **In flight:** nothing
- **On disk:** nothing yet
- **Resume with:** read the plan's section for T021
- **Next decision:** none

## Verify

`node --test tests/tracked.test.mjs` passes, including every seam test asserting exactly one of the two outcomes; `grep -n "never writes to a repository it tracks" AGENTS.md` still matches.

## Result

*(on completion: the outcome against the decision rules above, a pointer to the
entry in the log, and the digest from `AA/ckpt.sh close T021` — then
retire the trail with `--delete`)*

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
