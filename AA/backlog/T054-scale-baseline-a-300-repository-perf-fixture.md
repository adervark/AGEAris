---
id: T054
title: "Scale baseline: a 300-repository perf fixture"
status: open
owner: —
# type: one word; tasks of one type are timed together; `bug` counts as defect work
type: measure
# blockedReason: while blocked, one line saying what unblocks it; cleared on unblock
blockedReason: ""
depends: []
created: 2026-10-10
---

# T054 — Scale baseline: a 300-repository perf fixture

## Goal

`npm run perf` covers 300 repositories, and today's misses against the §5.5 targets are measured, not guessed.

## Context

- From T052, the agent's brain design: [`docs/plans/agent-brain.md`](../../docs/plans/agent-brain.md). §5.5 (the targets and the fixture) and §9 P0b. Also check that the 316 KB `/api/workspace` payload is delivered history, not WIP (`WHY.md`, Scale).

## Steps

- [ ] Build the fixture with `lib/fabricate.mjs`: 300 repositories of about 200 commits, plus 3 of 5,000. Build it once, into a cache outside the repository, in under 5 minutes.
- [ ] Extend `tests/perf/` with the §5.5 targets as budgets.
- [ ] Record today's numbers and misses in PROGRESS.md.

## Decision rules — fixed in advance

- No spend applies. The fixture lives outside the repository and outside `.agearis-data`.
- Done means: `npm run perf` runs the 300-repository case, today's numbers are recorded, and the split of the payload into history and WIP is stated.

## Handoff — state at last stop

*Kept true while claimed, not written on the way out (rule 8).*

- **Last touched:** 2026-10-10, registered
- **In flight:** nothing
- **On disk:** nothing
- **Resume with:** the Steps above
- **Next decision:** none

## Result

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
