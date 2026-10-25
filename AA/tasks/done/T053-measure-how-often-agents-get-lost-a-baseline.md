---
id: T053
title: "Measure how often agents get lost: a baseline"
status: done
owner: adervark @k/6bab66ff 2026-10-25 — the second review pass, re-checking 5ece75a — continued from @default/a29cee11
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
- [x] An independent review of `lib/lost.mjs` against `docs/METRICS.md` § The lost-agent measures.

## Decision rules — fixed in advance

- No spend applies. It reads the tracked repositories and writes nothing in them.
- Done means: all four measures run on the three repositories, the baseline is in PROGRESS.md, and the tests pass.
- Added 2026-10-25, before any review was spawned: the review is `agent-fan-out`. One Opus reviewer per pass, opened on T053's trail with a `doing` line first; a second pass only to re-check fixes. A finding counts only with a concrete input that goes wrong. A finding that changes a number is fixed, re-measured and corrected in PROGRESS.md. If the usage limit cuts a review off, stop and say where in the Handoff.

## Handoff — state at last stop

*Kept true while claimed, not written on the way out (rule 8).*

- **Last touched:** 2026-10-25, done
- **In flight:** nothing
- **On disk:** `lib/lost.mjs` and `tests/lost.test.mjs` (12 tests); the
  readings in `docs/METRICS.md` § The lost-agent measures; the baseline in
  PROGRESS.md and `docs/plans/evidence/t053/baseline.json`.
- **Resume with:** nothing; delivered
- **Next decision:** none

## Result

- Measures (a)–(d) are in `lib/lost.mjs`, read as `docs/METRICS.md` § The
  lost-agent measures pins them. The baseline on AGE Aris, AGEIS and RSNA,
  at `--as-of 2026-10-25T07:40:00Z`, is in PROGRESS.md (2026-10-25) and
  `docs/plans/evidence/t053/baseline.json`.
- Two Opus review passes:
  - The first (run `a29cee11.3776`) found 8 findings and 3 test gaps, fixed
    in `5ece75a`.
  - The second (run `6bab66ff.4df8`) found all of those hold, and 5 more,
    all low, fixed in `06e7ed5`. Two of them concern merges: one judged
    holds in topological order, one picked the owner's stint by its stay.
    One is fix 7's settings fallback, and two are test gaps.
  - Each fix has a test that the mutant reverting it fails. The second
    pass's fixes were not reviewed again; the decision rule allows two
    passes.
- Neither pass moved a number in PROGRESS.md. After the second,
  `baseline.json` re-measures identical on all three repositories, AGE Aris
  read from a clone at `1afc8e4`.
- Not checked by either pass: trails over 256 KiB (read from their tail),
  working-tree trails over 1 MiB, `--since` together with the trail cut,
  rebased histories, and two live processes of one session, which (b)
  cannot see by design.
- `npm test` 577 of 577; `npm run check` clean.
- Run digest:
  - **6bab66ff.4df8** (reviewer @k/6bab66ff): nothing in the repository ·
    about 25 min, one Opus pass.
  - **a29cee11.3776** (reviewer @default/a29cee11): nothing in the
    repository · about 20 min, one Opus pass.

**Spend:** `agent-fan-out`, two Opus review passes: about 20 min and about
255k tokens on `default`, about 25 min on `k`.

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
