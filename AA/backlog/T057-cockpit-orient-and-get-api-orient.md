---
id: T057
title: "`Cockpit.orient` and `GET /api/orient`"
status: open
owner: —
# type: one word; tasks of one type are timed together; `bug` counts as defect work
type: feature
# blockedReason: while blocked, one line saying what unblocks it; cleared on unblock
blockedReason: ""
depends: [T055]
created: 2026-10-10
---

# T057 — `Cockpit.orient` and `GET /api/orient`

## Goal

The server answers `aa.orient/1` for one tracked repository, `task=` included, and passes every corpus case.

## Context

- From T052, the agent's brain design: [`docs/plans/agent-brain.md`](../../docs/plans/agent-brain.md). §5.1–5.4, and option E: it extends `lib/brief.mjs` and reuses its key discipline (`:404-407`), `_policyOf` and `_liveTrails`.

## Steps

- [ ] Add the `depends` read and the `ready` test to the ledger, and bump `SCHEMA`.
- [ ] Add `Cockpit.orient`, the live overlay and the endpoint.
- [ ] Run the corpus.

## Decision rules — fixed in advance

- No spend applies. The server reads; it writes nothing in a tracked repository.
- Done means: every corpus case passes, including server-only ones; `npm test` and `npm run check` pass.

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
