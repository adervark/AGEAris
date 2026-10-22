---
id: T090
title: "Research-runs design v2.8: catch a correction of a word, a scope or a reason"
status: in_progress
owner: adervark @default/1f16c0d5 2026-10-22 — write v2.8, measured free on T086
# type: one word; tasks of one type are timed together; `bug` counts as defect work
type: design
# blockedReason: while blocked, one line saying what unblocks it; cleared on unblock
blockedReason: ""
depends: [T086]
created: 2026-10-22
---

# T090 — Research-runs design v2.8: catch a correction of a word, a scope or a reason

## Goal

Revise [`docs/plans/research-runs.md`](../../docs/plans/research-runs.md) so
the reconcilers catch the corrections H1 missed: a claim corrected in words,
not in a figure. Then accept or reject v2.8 on a held-out round of its own.

## Context

- H1 (T086) caught 4 of 13 corrections on RSNA's T112, every one a figure
  or a count, and 0 of 9 of a word, a scope or a reason
  (`docs/plans/evidence/t086/grade.md`, "The misses, by §5.5's gaps").
- The operator accepted v2.7 as it stands and registered this revision
  (2026-10-22; §10, D11). It changes the reconciler's brief and the canary
  rule, not the ledger's format, so S1a (T077) goes ahead in parallel.
- The two candidate items, from the grade:
  1. A sentence edited between two commits of one document (`doc` and
     `doc@commit`) is judged as a claim, not only as a value. In 6 misses
     both sides reached a reconciler, which said `ok`; R1 wrote "not a
     quantity".
  2. A group twin takes a value outside the real one's rounding, and not
     one another fact in its group already gives (H1's unfair canary).
- The 3 misses whose sides never met in a unit (prose states with no shared
  referent) have no mechanical rule yet. Say so; do not promise one.
- T112 is now in-sample, and T118 supplies an incident. The held-out round
  is the operator's choice.

## Steps

- [x] Write v2.8: the two items, each measured for free on T086's material
      where it can be. Four items in the end: edit units, cue units, the
      brief's claim frame, the twin rule (`docs/plans/evidence/t090/`).
- [ ] The operator accepts v2.8 to be tested, and chooses the held-out
      round.
- [ ] Write the decision rules for the held-out spend, before any spend.

## Decision rules — fixed in advance

- Writing v2.8 spends nothing. The held-out round is `agent-fan-out` and
  gets its own decision rules, approved by the operator, before it runs,
  as T086's were.
- Done means the operator has accepted v2.8 to be tested, or dropped it.

## Handoff — state at last stop

*Kept true while claimed, not written on the way out (rule 8).*

- **Last touched:** 2026-10-22, v2.8 written
- **In flight:** nothing
- **On disk:** `docs/plans/evidence/t090/` (three measuring scripts, their
  outputs, the brief template, `measurements.md`); v2.8 in the design
  (Changes since v2.7, §5.5, §5.6, §10 D12–D13)
- **Resume with:** the operator's D12 and D13
- **Next decision:** D12, accept v2.8 to be tested or drop it; D13, the
  held-out round (T121 recommended)
- **Verify, by hand:** the brief's text decides each of the six in-group
  misses as a correction (`measurements.md`); `t086/brief-check.mjs` finds
  0 hits in the brief against T086's key

## Verify

The revised brief, run by hand on T086's six in-group misses, marks each
pair as a correction, and its checker shows 0 hits against T086's key.

## Result

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
