---
id: T053
title: "Measure how often agents get lost: a baseline"
status: open
owner: —
# type: one word; tasks of one type are timed together; `bug` counts as defect work
type: measure
# blockedReason: while blocked, one line saying what unblocks it; cleared on unblock
blockedReason: ""
depends: []
created: 2026-10-10
---

# T053 — Measure how often agents get lost: a baseline

## Goal

Measures (a)–(d) of the lost-agent metric run on this repository, AGEIS and RSNA, with the baseline in PROGRESS.md.

## Context

- From T052, the agent's brain design: [`docs/plans/agent-brain.md`](../../docs/plans/agent-brain.md). §8 (the lost-agent metric) and §9 P0a. The operator's symptom is "agents get lost"; this is how it is counted before and after.

## Steps

- [ ] Implement measures (a)–(d) in `lib/`, exactly as §8 defines them, run from ledgers and trails.
- [ ] Run them on the three tracked repositories; record the numbers in PROGRESS.md.
- [ ] Tests on fabricated repositories, one per measure.

## Decision rules — fixed in advance

- No spend applies. It reads the tracked repositories and writes nothing in them.
- Done means: all four measures run on the three repositories, the baseline is in PROGRESS.md, and the tests pass.

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
