---
id: T064
title: "LLM smoke test: agents follow orient in two harnesses"
status: open
owner: —
# type: one word; tasks of one type are timed together; `bug` counts as defect work
type: test
# blockedReason: while blocked, one line saying what unblocks it; cleared on unblock
blockedReason: ""
depends: [T056, T058]
created: 2026-10-10
---

# T064 — LLM smoke test: agents follow orient in two harnesses

## Goal

Claude Code and Codex CLI each run 3 scenarios (dead `doing`, WIP at limit, a ready claim) 10 times, and each scenario passes at least 9 of 10.

## Context

- From T052, the agent's brain design: [`docs/plans/agent-brain.md`](../../docs/plans/agent-brain.md). §8, the LLM smoke test.

## Steps

- [ ] Write the scenarios on fabricated repositories.
- [ ] Run them; record the results in PROGRESS.md.

## Decision rules — fixed in advance

- `agent-fan-out`: at most 60 agent runs, which is 2 harnesses × 3 scenarios × 10, with a trail entry before each batch. Nothing beyond that without asking the operator.
- Done means: each scenario passes at least 9 of 10 in each harness, or the failures are recorded with their cause.

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
