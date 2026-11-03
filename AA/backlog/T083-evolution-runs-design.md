---
id: T083
title: "Evolution runs: an AlphaEvolve-style search, judged by an evaluator pinned in the task file"
status: open
owner: —
# type: one word; tasks of one type are timed together; `bug` counts as defect work
type: design
# blockedReason: while blocked, one line saying what unblocks it; cleared on unblock
blockedReason: ""
depends: []
created: 2026-10-17
---

# T083 — Evolution runs: an AlphaEvolve-style search, judged by an evaluator pinned in the task file

## Goal

A design, in `docs/plans/evolution-runs.md`, for a run that improves one
artifact by search: an engine proposes candidates, a fixed evaluator scores
them, the best are kept. AGE Aris shows the run and lets the operator audit
it; it does not run it. Nothing is built until the operator accepts the design.

## Context

- Registered from the operator's AlphaEvolve teardown (2026-10-17). The point
  of that conversation: there is no improvement without a selection signal,
  and the signal is worth only what its independence from the generator is.
  The AI Scientist failed by grading its own work; AlphaEvolve works because
  a program it cannot edit does the grading.
- AlphaEvolve's loop: sample parents and inspirations from a program database
  (MAP-Elites grid plus islands), build a prompt with their code and scores,
  have an LLM ensemble write diffs to marked `EVOLVE-BLOCK`s, score them
  through a cascade (cheap tests prune before the expensive one), store, repeat
  asynchronously. Humans choose the problem, write the evaluator and the
  baseline. Known failures: it exploits a weak evaluator, overfits the cases it
  is scored on, and needs thousands of evaluations on hard problems.
- Engines to plug in rather than build: OpenEvolve (closest to AlphaEvolve),
  ShinkaEvolve (Sakana; beat AlphaEvolve's circle packing in under 150
  evaluations, self-reported), CodeEvolve (self-reported 6 of 9 against both).
  AlphaEvolve itself is on Google Cloud; reports disagree on whether access is
  general (July 2026) or restricted preview.
- Much of it already exists under AA's names: an evaluator fixed before the
  search is rule 5; lineage is git; surviving a dead worker is rule 6; the
  budget is a `spend`; `npm test` then `npm run check` then a grade is a
  cascade. Missing: a score per candidate, a lineage view, a held-out set kept
  apart from the tuning set, and a hash proving the evaluator did not change.
- **Hard constraint:** AGE Aris never runs a repository's scripts (CLAUDE.md).
  The loop lives in an agent skill or CLI; AGE Aris reads what it left.
- T082 is one generation of this by hand: v2.4 scored 2 of 12, v2.5 is the
  mutation, R0c the evaluation. Its evaluator costs about 10 Opus subagents and
  two of its reconcilers died at the usage limit (c8f9d51), so it is far too
  dear to search with. T081's rounds are its natural held-out set.

## Steps

- [ ] Read the AlphaEvolve paper (Novikov et al., 2025) and the ShinkaEvolve
      paper first-hand; the Context above is from secondary sources and memory.
- [ ] Define the run's record: what the task file pins (artifact, evaluator
      and its hash, metric and direction, tuning and held-out sets, budget),
      and what each candidate leaves (a checkpoint entry: parent, diff, scores).
- [ ] Define the page: score over generations, lineage, held-out scores apart
      from tuning scores, spend against budget, evaluator integrity.
- [ ] Pick the first evaluator to dogfood on, cheap and deterministic. Check
      whether the orient corpus (T055, 82 cases) or the 300-repository fixture
      (T054) scores cleanly; neither has been checked.
- [ ] Say how evaluator gaming and overfitting are caught.

## Decision rules — fixed in advance

- No spend: design only. Running any engine, even once, is `agent-fan-out`
  and needs its own decision rules and the operator's go.
- No new npm dependency and no script run by AGE Aris; a design that needs
  either is rejected.
- Done means the operator accepts the design, or rejects it, which is a result
  too.

## Handoff — state at last stop

*Kept true while claimed, not written on the way out (rule 8).*

- **Last touched:** 2026-10-17, registered
- **In flight:** nothing
- **On disk:** nothing
- **Resume with:** the Steps above
- **Next decision:** none

## Verify

The design names, for each AlphaEvolve failure (evaluator gaming,
overfitting, cost), the record or check that would show it on the page.

## Result

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
