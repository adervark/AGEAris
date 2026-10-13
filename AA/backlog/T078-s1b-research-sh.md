---
id: T078
title: "S1b: AGE Aris research.sh: brief, fact, same, resolve, conflicts, check and write"
status: open
owner: —
# type: one word; tasks of one type are timed together; `bug` counts as defect work
type: feature
# blockedReason: while blocked, one line saying what unblocks it; cleared on unblock
blockedReason: ""
depends: [T077, T076]
created: 2026-10-13
---

# T078 — S1b: AGE Aris research.sh: brief, fact, same, resolve, conflicts, check and write

## Goal

`AA/research.sh` (bash and jq) implements stage 1 in this repository: the commands, the eleven checks, the generated track page and its JSON summary.

## Context

- [`docs/plans/research-runs.md`](../../docs/plans/research-runs.md) v2.4, §5.4–§5.8 and §9 (S1b).
- Parsing never backtracks on untrusted text (AGENTS.md).
- Registered by T073 when the operator accepted v2.4 (2026-10-13).

## Steps

- [ ] The commands and the checks.
- [ ] The track page and the JSON summary.
- [ ] Pass the corpus; compare with T072's hand-written page.

## Decision rules — fixed in advance

- No spend. `npm test` and `npm run check` pass before every commit.
- Done means the corpus passes and T072's hand-written page and the generated one agree.

## Handoff — state at last stop

*Kept true while claimed, not written on the way out (rule 8).*

- **Last touched:** 2026-10-13, registered
- **In flight:** nothing
- **On disk:** nothing
- **Resume with:** the Steps above
- **Next decision:** none

## Verify

The corpus passes.

## Result

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
