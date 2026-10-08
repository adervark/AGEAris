---
id: T033
title: "Chart defects found on real boards: a yearless date, a thin forecast, repeated ticks, stacked dots"
status: claimed
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

## Steps

- [ ] A date outside this year shows its year.
- [ ] Below MIN_SAMPLE finishes the forecast says the history is too thin
      instead of answering.
- [ ] Date ticks are never repeated.
- [ ] Dots that would overlap move sideways until they do not (a beeswarm).
- [ ] Tests for each; the regression walk again.

## Decision rules — fixed in advance

- Pass: each defect has a test that fails before the fix; the 72-view walk is
  clean again; the real repositories are unchanged; `npm test` and
  `npm run check` pass.
- No spend.

## Handoff — state at last stop

*Kept true while claimed, not written on the way out (rule 8).*

- **Last touched:** 2026-10-08, adervark @k/adccab68 (claimed)
- **In flight:** the four fixes
- **On disk:** nothing yet
- **Resume with:** the Steps
- **Next decision:** whether to push (the operator's)

## Verify

`npm test`; the regression walk over the sample and five real boards.

## Result

*(placeholder)*

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
