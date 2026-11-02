---
id: T110
title: "Environments a task leaves behind: measure them, and a structure that releases them"
status: claimed
owner: adervark @b/cc5901e7 2026-11-03 — the inventory across ~/Code and the design, docs/plans/environments.md
# type: one word; tasks of one type are timed together; `bug` counts as defect work
type: design
# blockedReason: while blocked, one line saying what unblocks it; cleared on unblock
blockedReason: ""
depends: []
created: 2026-11-03
---

# T110 — Environments a task leaves behind: measure them, and a structure that releases them

## Goal

A measured inventory of the worktrees, branches, scratch folders and copies
that tasks leave once they are done, and a design that names, keeps or
releases each, approved by the operator before anything is built or deleted.

## Context

- The operator's request, 2026-11-03: "the useless (once task complete) and
  redundant environments that tasks create and structures to mitigate them".
- The AA convention has no lifecycle for environments: RULES.md, AA.yml and
  the aa-init template never mention scratch folders or worktrees.

## Steps

- [x] Inventory every repository under ~/Code, read-only.
- [x] `docs/plans/environments.md`: causes, the structure, phases as tasks.
- [ ] The operator's decisions recorded in the plan.

## Decision rules — fixed in advance

- Read-only: nothing is deleted, moved or changed outside this repository's
  `docs/` and `AA/`. A cleanup in another repository is that repository's
  task, at the operator's word (`data-migration` there).
- No spend applies.
- Done means the plan is written with every number measured and dated, and
  the operator has approved it or said what to change.

## Handoff — state at last stop

*Kept true while claimed, not written on the way out (rule 8).*

- **Last touched:** 2026-11-03, adervark @b/cc5901e7
- **In flight:** nothing; the plan waits on the operator (Q1–Q4)
- **On disk:** docs/plans/environments.md, committed
- **Resume with:** the Steps above
- **Next decision:** the operator's approval of the plan

## Result

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
