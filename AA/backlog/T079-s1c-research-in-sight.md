---
id: T079
title: "S1c: research in sight: track pages, conflicts in Needs you, rulings as task actions"
status: open
owner: —
# type: one word; tasks of one type are timed together; `bug` counts as defect work
type: feature
# blockedReason: while blocked, one line saying what unblocks it; cleared on unblock
blockedReason: ""
depends: [T078]
created: 2026-10-13
---

# T079 — S1c: research in sight: track pages, conflicts in Needs you, rulings as task actions

## Goal

AGE Aris shows track pages and the round in progress, puts open conflicts and waiting decisions in Needs you, and lets the operator rule, `stands` included, as a task action on the task file.

## Context

- [`docs/plans/research-runs.md`](../../docs/plans/research-runs.md) v2.4, §5.3, §5.6 step 8 and §5.8.
- Task actions follow AGENTS.md's write rules, `RUN_LIVE` included.
- Registered by T073 when the operator accepted v2.4 (2026-10-13).

## Steps

- [ ] Read the track page, its JSON and the task file's rulings.
- [ ] Needs you: open conflicts first, then waiting decisions.
- [ ] The ruling action.

## Decision rules — fixed in advance

- No spend. Tests act only on temporary repositories.
- Done means e2e passes and the operator resolves a conflict in AGE Aris.

## Handoff — state at last stop

*Kept true while claimed, not written on the way out (rule 8).*

- **Last touched:** 2026-10-13, registered
- **In flight:** nothing
- **On disk:** nothing
- **Resume with:** the Steps above
- **Next decision:** none

## Verify

e2e covers a ruling and its refusal while a run is live.

## Result

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
