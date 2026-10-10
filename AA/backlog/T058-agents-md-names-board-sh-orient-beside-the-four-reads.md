---
id: T058
title: "AGENTS.md names `board.sh --orient` beside the four reads"
status: open
owner: —
# type: one word; tasks of one type are timed together; `bug` counts as defect work
type: docs
# blockedReason: while blocked, one line saying what unblocks it; cleared on unblock
blockedReason: ""
depends: [T056]
created: 2026-10-10
---

# T058 — AGENTS.md names `board.sh --orient` beside the four reads

## Goal

The bootstrap here and in the `aa-init` template names `AA/board.sh --orient`, and the four reads stay (D3: beside, then replace).

## Context

- From T052, the agent's brain design: [`docs/plans/agent-brain.md`](../../docs/plans/agent-brain.md). §9 P1d and D3.

## Steps

- [ ] Edit `AGENTS.md` here and `skills/aa-init/template/AGENTS.md`.

## Decision rules — fixed in advance

- Syncing the installed plugin or the `aa-init` template under `~/.claude` is `global-config`: a trail entry first.
- Done means: both bootstraps name it, the four reads are unchanged, and `npm test` passes.

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
