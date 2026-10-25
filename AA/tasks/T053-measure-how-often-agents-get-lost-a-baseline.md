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
- **On disk:**
  - `lib/lost.mjs` and `tests/lost.test.mjs` (10 tests, passing).
  - The readings, pinned in `docs/METRICS.md` § The lost-agent measures.
  - The baseline, in PROGRESS.md and `docs/plans/evidence/t053/baseline.json`.
  - The first review pass (run `a29cee11.3776`, ended): 8 findings and 3
    test gaps, fixed in the commit "T053: the review's findings". Re-measured:
    no PROGRESS.md number changes.
  - T096 registered; T097 done; T098 registered (a fifth test that races
    the cold build, seen once under load).
- **Resume with:** the second review pass, which only re-checks the fixes
  (decision rule). Open it on T053's trail with a `doing` line first, as the
  first pass was. It was not started on 2026-10-25: account `default` was at
  78% of its 5-hour window at 08:26Z, with the window resetting at 12:09Z.
  Accounts `k` and `v` were almost unused. After any further fix:
  - Re-run `node lib/lost.mjs --json --as-of 2026-10-25T07:40:00Z` on AGEIS
    and RSNA in place.
  - Re-run it on AGE Aris from a clone at `1afc8e4`, the baseline's HEAD.
  - Compare the output with `baseline.json`.
- **Next decision:** the operator's: which account runs the second pass, and
  when.

## Result

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
