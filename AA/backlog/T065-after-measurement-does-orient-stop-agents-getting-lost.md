---
id: T065
title: "After-measurement: does orient stop agents getting lost?"
status: open
owner: —
# type: one word; tasks of one type are timed together; `bug` counts as defect work
type: measure
# blockedReason: while blocked, one line saying what unblocks it; cleared on unblock
blockedReason: ""
depends: [T053, T058]
created: 2026-10-10
---

# T065 — After-measurement: does orient stop agents getting lost?

## Goal

28 days after T058, the lost-agent measures are taken again against T053's baseline, and D3's "then replace" is decided on them.

## Context

- From T052, the agent's brain design: [`docs/plans/agent-brain.md`](../../docs/plans/agent-brain.md). §8's targets: no (b) and no (c) among new claims; (a) at or below half its baseline per 100 runs (0 stays 0); (d)'s median no worse.

## Steps

- [ ] Wait until 28 days after T058 is done.
- [ ] Measure; record in PROGRESS.md.
- [ ] If the targets are met, make `board.sh --orient` AGENTS.md's step 1, here and in the template.

## Decision rules — fixed in advance

- Syncing the installed plugin or the `aa-init` template under `~/.claude` is `global-config`: a trail entry first.
- Done means: the numbers are recorded, and the replacement is made if the targets are met, or not made with the reason stated.

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
