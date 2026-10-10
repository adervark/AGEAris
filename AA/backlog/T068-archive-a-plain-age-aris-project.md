---
id: T068
title: "Archive a plain AGE Aris project"
status: open
owner: —
# type: one word; tasks of one type are timed together; `bug` counts as defect work
type: feature
# blockedReason: while blocked, one line saying what unblocks it; cleared on unblock
blockedReason: ""
depends: []
created: 2026-10-10
---

# T068 — Archive a plain AGE Aris project

## Goal

A plain AGE Aris project can be archived through the UI, the API and an agent, with the confirmation pattern task actions already use. Its git history is kept, never deleted.

## Context

- From T052, the agent's brain design: [`docs/plans/agent-brain.md`](../../docs/plans/agent-brain.md). 2026-10-10: a plain RSNA project could not be removed through any path, so its folder was removed by hand (a backup was kept). See §6 of `docs/plans/agent-brain.md`.

## Steps

- [ ] Archive endpoint and UI, with confirmation.
- [ ] Listed in the capabilities manifest (T063).

## Decision rules — fixed in advance

- `data-migration` on real data: a trail entry first. Tests use temporary folders only.
- Done means: archive and restore work, nothing is deleted, `npm test` and `npm run check` pass.

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
