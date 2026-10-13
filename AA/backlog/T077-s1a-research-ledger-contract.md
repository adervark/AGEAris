---
id: T077
title: "S1a: the research ledger's contract and its test corpus"
status: open
owner: —
# type: one word; tasks of one type are timed together; `bug` counts as defect work
type: design
# blockedReason: while blocked, one line saying what unblocks it; cleared on unblock
blockedReason: ""
depends: [T075]
created: 2026-10-13
---

# T077 — S1a: the research ledger's contract and its test corpus

## Goal

`AA/findings/_SCHEMA.md` and `docs/RESEARCH.md` state the ledger format and the eleven checks. `tests/research/` holds an incident fixture and a counterfactual for each check, rebuilt from the record with `lib/fabricate.mjs`.

## Context

- [`docs/plans/research-runs.md`](../../docs/plans/research-runs.md) v2.4, §5 and §9 (S1a).
- Registered by T073 when the operator accepted v2.4 (2026-10-13).

## Steps

- [ ] Write the schema and the guide.
- [ ] Build one incident and one counterfactual per check.
- [ ] The operator reviews the cases.

## Decision rules — fixed in advance

- No spend. Fixtures act only on temporary repositories.
- Done means the operator has reviewed the cases.

## Handoff — state at last stop

*Kept true while claimed, not written on the way out (rule 8).*

- **Last touched:** 2026-10-13, registered
- **In flight:** nothing
- **On disk:** nothing
- **Resume with:** the Steps above
- **Next decision:** none

## Verify

Each check has a fixture where it must fire and one where it must stay silent.

## Result

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
