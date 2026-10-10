---
id: T063
title: "Capabilities: what an agent may do, and how"
status: open
owner: —
# type: one word; tasks of one type are timed together; `bug` counts as defect work
type: feature
# blockedReason: while blocked, one line saying what unblocks it; cleared on unblock
blockedReason: ""
depends: []
created: 2026-10-10
---

# T063 — Capabilities: what an agent may do, and how

## Goal

`GET /api/capabilities` and `board.sh --capabilities` list every action with its class (`agent-git`, `agent-read`, `operator-only`, `ui-only`), how to do it, its inputs and what it refuses.

## Context

- From T052, the agent's brain design: [`docs/plans/agent-brain.md`](../../docs/plans/agent-brain.md). §5.6. The 2026-10-10 incident: the operator could not find how to remove a repository, and nothing told an agent the endpoint existed.

## Steps

- [ ] Write the manifest.
- [ ] Parity test: every `data-action` in `public/` has an entry, and no `operator-only` entry is offered to agents.

## Decision rules — fixed in advance

- No spend applies.
- Done means: the parity test passes, and `npm test` and `npm run check` pass.

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
