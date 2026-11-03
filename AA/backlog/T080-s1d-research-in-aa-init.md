---
id: T080
title: "S1d: research.sh and its schema in the aa-init template"
status: open
owner: —
# type: one word; tasks of one type are timed together; `bug` counts as defect work
type: feature
# blockedReason: while blocked, one line saying what unblocks it; cleared on unblock
blockedReason: ""
depends: [T078, T004, T072]
created: 2026-10-13
---

# T080 — S1d: research.sh and its schema in the aa-init template

## Goal

Every AA repository gets `research.sh` and the ledger schema through `aa-init`, once T072's measures are in.

## Context

- [`docs/plans/research-runs.md`](../../docs/plans/research-runs.md) v2.4, §9 (S1d); D2.
- Registered by T073 when the operator accepted v2.4 (2026-10-13).

## Steps

- [ ] Vendor the script and schema into the template.
- [ ] A fresh repository writes an empty track page.

## Decision rules — fixed in advance

- No spend in other repositories; their own sessions adopt it.
- Done means a fresh repository writes an empty track page.

## Handoff — state at last stop

*Kept true while claimed, not written on the way out (rule 8).*

- **Last touched:** 2026-10-13, registered
- **In flight:** nothing
- **On disk:** nothing
- **Resume with:** the Steps above
- **Next decision:** none

## Verify

A fresh `aa-init` repository runs `research.sh --check` clean.

## Result

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
