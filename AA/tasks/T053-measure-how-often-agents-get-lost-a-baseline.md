---
id: T053
title: "Measure how often agents get lost: a baseline"
status: claimed
owner: adervark @default/a29cee11 2026-10-25 — measures (a)–(d) in lib/lost.mjs, then the baseline on the three repositories
# type: one word; tasks of one type are timed together; `bug` counts as defect work
type: measure
# blockedReason: while blocked, one line saying what unblocks it; cleared on unblock
blockedReason: ""
depends: []
created: 2026-10-10
---

# T053 — Measure how often agents get lost: a baseline

## Goal

Measures (a)–(d) of the lost-agent metric run on this repository, AGEIS and RSNA, with the baseline in PROGRESS.md.

## Context

- From T052, the agent's brain design: [`docs/plans/agent-brain.md`](../../docs/plans/agent-brain.md). §8 (the lost-agent metric) and §9 P0a. The operator's symptom is "agents get lost"; this is how it is counted before and after.

## Steps

- [x] Implement measures (a)–(d) in `lib/`, exactly as §8 defines them, run from ledgers and trails.
- [x] Run them on the three tracked repositories; record the numbers in PROGRESS.md.
- [x] Tests on fabricated repositories, one per measure.
- [ ] An independent review of `lib/lost.mjs` against `docs/METRICS.md` § The lost-agent measures.

## Decision rules — fixed in advance

- No spend applies. It reads the tracked repositories and writes nothing in them.
- Done means: all four measures run on the three repositories, the baseline is in PROGRESS.md, and the tests pass.
- Added 2026-10-25, before any review was spawned: the review is `agent-fan-out`. One Opus reviewer per pass, opened on T053's trail with a `doing` line first; a second pass only to re-check fixes. A finding counts only with a concrete input that goes wrong. A finding that changes a number is fixed, re-measured and corrected in PROGRESS.md. If the usage limit cuts a review off, stop and say where in the Handoff.

## Handoff — state at last stop

*Kept true while claimed, not written on the way out (rule 8).*

- **Last touched:** 2026-10-25, adervark @default/a29cee11
- **In flight:** nothing
- **On disk:** `lib/lost.mjs` and `tests/lost.test.mjs` (7 tests, passing); the readings pinned in `docs/METRICS.md` § The lost-agent measures; the baseline in PROGRESS.md and `docs/plans/evidence/t053/baseline.json`; T096 registered (the ledger and merged branches) and T097 (three tests that race a cold build under a full `npm test`).
- **Resume with:** the review step; re-run `node lib/lost.mjs --as-of 2026-10-25T07:40:00Z /home/ade/Code/AGEAris /home/ade/Code/AGEIS /home/ade/Code/RSNA` after any fix and compare it with the baseline.
- **Next decision:** none

## Result

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
