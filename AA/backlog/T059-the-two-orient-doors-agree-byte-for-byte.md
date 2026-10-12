---
id: T059
title: "The two orient doors agree, byte for byte"
status: open
owner: —
# type: one word; tasks of one type are timed together; `bug` counts as defect work
type: test
# blockedReason: while blocked, one line saying what unblocks it; cleared on unblock
blockedReason: ""
depends: [T056, T057]
created: 2026-10-10
---

# T059 — The two orient doors agree, byte for byte

## Goal

A conformance test in `npm test` runs both doors on every shared corpus case and compares their answers byte for byte, except `repo.door` and `remote`.

## Context

- From T052, the agent's brain design: [`docs/plans/agent-brain.md`](../../docs/plans/agent-brain.md). §9 P1e, and §7's risk that two doors disagree.

## Steps

- [ ] Write `tests/orient/conformance.test.mjs` with a pinned clock, branch and working tree.

## Decision rules — fixed in advance

- No spend applies.
- Done means: the test is in `npm test` and passes.

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
