---
id: T082
title: "Research-runs design v2.5: answer R0b's recall of 2 of 12"
status: open
owner: —
# type: one word; tasks of one type are timed together; `bug` counts as defect work
type: design
# blockedReason: while blocked, one line saying what unblocks it; cleared on unblock
blockedReason: ""
depends: []
created: 2026-10-13
---

# T082 — Research-runs design v2.5: answer R0b's recall of 2 of 12

## Goal

A revision of [`docs/plans/research-runs.md`](../../docs/plans/research-runs.md)
v2.4 that answers T075's result. Linking and reconciling worked: 17 of 17
precise, and they found a defect the hand-written synthesis missed. Recall was
2 of 12, because the failures were upstream of linking. Each fix below has to
be checked against T075's misses before the design is accepted again.

## Context

- T075's grading is in `docs/plans/evidence/t075/grade.md`, and its ledger,
  links and marks are beside it. Rerunning `link.mjs` on a revised ledger
  costs nothing.
- What to answer:
  1. **Facts never transcribed** (C6, C7, C8, C12), the dominant gap.
     "Load-bearing" was judged too narrowly. Transcription costs about 3.5 s a
     fact, so the candidate fix is to transcribe every claim that carries a
     number, a count, a state or a causal "so", options in lists included.
  2. **Quantities with no code referent** (C5, C9): runtimes and leaderboard
     figures. The candidate fix is registered quantities, named objects on the
     track (the deployed rerun's runtime, the public leaderboard), which
     facts about them cite as referents.
  3. **Scope** (C3, C4): claims in code docstrings and in earlier lanes cited
     only indirectly. The question is what the settled record includes.
  4. **Within one document** (C11): let same-document pairs on one key or
     registered quantity link.
  5. **Out of reach** (C10, a correction from a later code commit): say so in
     §5.5.
  6. **Canaries** must respect a value's domain. An AUC above 1 gives the
     canary away.
  7. **Noise:** restore the exclusion for regenerable `outputs/` from v2.1.
     There were 39 `out-of-sight` warnings in one round.

## Steps

- [ ] Write v2.5.
- [ ] Re-grade T075's twelve on a ledger written under v2.5's rules. A fresh
      transcriber is a spend; re-linking the existing ledger is not.
- [ ] The operator accepts it, or sends it for review.

## Decision rules — fixed in advance

- Spend: at most one fresh transcriber and one reconciler, on the operator's
  go.
- Accepted only when the re-grade reaches at least 10 of 12, or the operator
  accepts a lower figure with the misses listed.

## Handoff — state at last stop

*Kept true while claimed, not written on the way out (rule 8).*

- **Last touched:** 2026-10-13, registered by T075
- **In flight:** nothing
- **On disk:** nothing
- **Resume with:** the Goal's seven points
- **Next decision:** none

## Verify

The re-grade table in `docs/plans/evidence/` covers all twelve.

## Result

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
