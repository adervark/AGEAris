---
id: T055
title: "The orient contract and its scenario corpus"
status: open
owner: —
# type: one word; tasks of one type are timed together; `bug` counts as defect work
type: design
# blockedReason: while blocked, one line saying what unblocks it; cleared on unblock
blockedReason: ""
depends: []
created: 2026-10-10
---

# T055 — The orient contract and its scenario corpus

## Goal

`docs/ORIENT.md` defines `aa.orient/1`, and `tests/orient/` holds every scenario with its expected answer, reviewed by the operator.

## Context

- From T052, the agent's brain design: [`docs/plans/agent-brain.md`](../../docs/plans/agent-brain.md). §5.1–5.4 and §8 of the design, and **every item in §11**, which the third Critic pass made a condition of approval.

## Steps

- [ ] Write `docs/ORIENT.md`: definitions, the precedence table, provenance, serialization, budget, versioning, with every §11 fix applied.
- [ ] Write the corpus: every fixture named in §5.2, every case in §8, and the §11 fixtures, marking server-only cases.
- [ ] Ask the operator the §11 open question, and review the cases with them.

## Decision rules — fixed in advance

- No spend applies.
- Done means: every §5.2 fixture, every §8 case and every §11 item is in the contract or the corpus; the serialization rules are pinned; the operator has reviewed the cases.

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
