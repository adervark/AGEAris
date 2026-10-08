---
id: T033
title: "Chart defects found on real boards: a yearless date, a thin forecast, repeated ticks, stacked dots"
status: done
owner: adervark @k/adccab68 2026-10-08 — fix what the real-board regression check found
# type: one word; tasks of one type are timed together; `bug` counts as defect work
type: bug
# blockedReason: while blocked, one line saying what unblocks it; cleared on unblock
blockedReason: ""
depends: [T030, T031, T032]
created: 2026-10-08
---

# T033 — Chart defects found on real boards

## Goal

The Flow charts read correctly on every real board, not only the sample.

## Context

- 2026-10-08, the operator asked for a test and regression check before
  pushing T030–T032. All suites pass and nothing regressed. But the charts on
  the real boards (tracked read-only from a scratch data folder) show four
  defects:
  1. Gem4A's forecast reads "50% by Thu, Sep 30": that is 30 Sep 2027, and
     the year is not shown.
  2. Gem4A's forecast is drawn from 1 finished task in 41 days, and says
     "85%: 0 or more". Every other flow metric refuses below 5 (MIN_SAMPLE).
  3. Gem4A's cycle-time axis repeats a date ("Oct 6, Oct 6") on a short span.
  4. RSNA's aging chart stacks 31 dots on top of each other (seven fixed
     offsets).
  5. Found while fixing 4: when a crowd of dots has no room left in its row,
     the beeswarm moved some below the zero line, so a cycle time read as
     negative.

## Steps

- [x] A date outside this year shows its year.
- [x] Below MIN_SAMPLE finishes the forecast says the history is too thin
      instead of answering.
- [x] Date ticks are never repeated.
- [x] Dots that would overlap move sideways until they do not (a beeswarm).
- [x] No dot is moved outside the plot.
- [x] Tests for each; the regression walk again.

## Decision rules — fixed in advance

- Pass: each defect has a test that fails before the fix; the 72-view walk is
  clean again; the real repositories are unchanged; `npm test` and
  `npm run check` pass.
- No spend.

## Handoff — state at last stop

*Kept true while claimed, not written on the way out (rule 8).*

- **Last touched:** 2026-10-08, adervark @k/adccab68 (done)
- **In flight:** nothing
- **On disk:** nothing
- **Resume with:** nothing
- **Next decision:** none

## Verify

`npm test`; the regression walk over the sample and five real boards.

## Result

Pass. Five defects fixed, each with a test in `tests/charts.test.mjs` (and one
forecast case in `tests/metrics.test.mjs`).

- **Yearless date:** `dateWords` adds the year when it is not this year.
  Gem4A's forecast now reads "Thu, Sep 30, 2027".
- **Thin forecast:** below 5 finished tasks (MIN_SAMPLE, the same as every
  flow measure) the forecast has status `thin` and says "Too little history
  to forecast from: 1 task finished in the last 41 days, and a forecast needs
  5." A count of 0 reads "possibly none", never "0 or more". The existing
  metrics test for a slow team now uses 5 finishes in 41 days.
- **Repeated ticks:** date ticks are deduplicated; Gem4A shows Oct 6, Oct 7,
  Oct 8.
- **Stacked dots:** `swarm()` moves a dot sideways, in steps of one diameter
  plus 2 px, until it overlaps nothing. Only a full row tries the rows above
  and below. The order is fixed by the input, so the same data draws the same
  picture. RSNA's 31 aging dots are all visible.
- **Below zero:** the beeswarm never puts a row outside the plot.

Fail before the fix:
- Five of the six new tests fail on the code at 33e1d62. To load the test
  file there, the old `dateWords` had to be exported and a stub `swarm`
  added; neither changes what the old code draws.
- The zero-line test passes at 33e1d62, because the defect came in with the
  beeswarm. It fails on the fixed code with the bounds check removed.

After:
- `npm test` passed 498 of 498, and `npm run check` passed.
- The browser walk over the sample, AGEIS, AGEION, RSNA, Gem4A and an AGE Aris
  clone, at 1280 and 390 px: 72 page views, 0 with a problem. Each Flow tab
  shows its 3 charts, and the keyboard opens a dot's task.
- AGEIS, AGEION, RSNA and Gem4A have the same HEAD and status as before.

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
