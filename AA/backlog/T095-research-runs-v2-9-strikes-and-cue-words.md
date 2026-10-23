---
id: T095
title: "Research-runs v2.9: struck clauses, CORRECTED and REFUTED, negated cues"
status: open
owner: —
# type: one word; tasks of one type are timed together; `bug` counts as defect work
type: design
# blockedReason: while blocked, one line saying what unblocks it; cleared on unblock
blockedReason: ""
depends: [T094]
created: 2026-10-24
---

# T095 — Research-runs v2.9: struck clauses, CORRECTED and REFUTED, negated cues

## Goal

Fix H2's three mechanical misses in v2.8's linker, each measured for free on
H1's and H2's material.

## Context

- H2 (T094) caught 5 of 10; the operator accepted v2.8 as it stands and
  registered these (2026-10-24, §10 D14;
  `docs/plans/evidence/t094/grade.md`, "The misses, by mechanism").
- 1. A clause struck through (`~~49.4 GB~~`) has the same words as the one
  it struck, so its likeness is 1 and no edit forms (K2).
- 2. "CORRECTED" and "REFUTED" are not cues (K1, K5's later side).
- 3. A cue fires on a negated word: "not withdrawn".

## Steps

- [ ] Each fix in `docs/plans/evidence/t094/groups.mjs`'s copy, measured on
      H1 and H2: what each adds, on the key and off it.
- [ ] The operator decides whether v2.9 needs a held-out round of its own.

## Decision rules — fixed in advance

- Writing and measuring v2.9 spends nothing. A held-out round is
  `agent-fan-out` and gets its own rules, approved first.

## Handoff — state at last stop

*Kept true while claimed, not written on the way out (rule 8).*

- **Last touched:** 2026-10-24, registered

## Verify

On H2's material, the fixed linker forms an edit for `T121@da77768#2` →
`T121#44` and a cue unit on T121#50, and none on "not withdrawn".

## Result

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
