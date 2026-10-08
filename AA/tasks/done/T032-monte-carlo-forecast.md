---
id: T032
title: "A forecast from throughput: when, and how many"
status: done
owner: adervark @k/adccab68 2026-10-08 — the Monte Carlo forecast
# type: one word; tasks of one type are timed together; `bug` counts as defect work
type: feature
# blockedReason: while blocked, one line saying what unblocks it; cleared on unblock
blockedReason: ""
depends: [T029]
created: 2026-10-08
---

# T032 — A forecast from throughput: when, and how many

## Goal

The Flow tab answers "when will the backlog be done?" and "how many by a date?" as probabilities from the project's own daily throughput, with no estimates, reproducibly.

## Context

- Chosen by the operator 2026-10-08 from `docs/plans/visualisation.md` (T029),
  the first slice: aging WIP, the cycle-time scatterplot, the forecast.
- Charts are inline SVG like `seriesChart` (`public/cockpit.js`): no library,
  no inline styles (CSP), colour by class. Each dot opens its task, by mouse
  and by keyboard.

## Steps

- [x] A seeded Monte Carlo over the recent daily throughput: days to finish N (the backlog by default), and items done by a date.
- [x] The forecast with its 50th and 85th percentile answers, its basis named, and Explain.
- [x] Tests: deterministic for one ledger and asOf; sane on zero throughput.

## Decision rules — fixed in advance

- Pass: the same ledger and asOf give the same numbers; with zero recent throughput it says no forecast instead of a date; tests and `npm run check` pass; a screenshot is read.
- No spend.

## Handoff — state at last stop

*Kept true while claimed, not written on the way out (rule 8).*

- **Last touched:** 2026-10-08, adervark @k/adccab68 (done)
- **In flight:** nothing
- **On disk:** nothing
- **Resume with:** nothing
- **Next decision:** none

## Verify

`npm test`; the chart seen in headless Chrome on the sample project.

## Result

**Done.** The Flow tab opens with a forecast (`forecastChart`) from
`charts.forecast`. `forecast()` in `lib/metrics.mjs` is pure and exported:
10,000 simulated runs in which each day finishes as many tasks as a random
past whole day did, over the last 41 whole days (today is still going, so it
is left out). It answers two questions in sentences, each at 50/85/95%:

- when the open tasks (backlog and WIP) will be done;
- how many will finish in the next 14 days.

Under the answers is the spread of simulated finish days, with the
percentiles marked. The basis is named, with a link to Explain the throughput
it samples.

Against the decision rules:

- Reproducible: the generator is seeded from the history, the local date and
  the open count. The same ledger and day give the same numbers (tested), and
  the live API gave identical dates a minute apart. It was first seeded by the
  instant, and the 95% date moved a day between refreshes; seeding by the day
  fixed that.
- Exact on a steady history: one finish a day and 5 open gives 5 days at
  every percentile, and 14 in 14 days.
- With zero recent throughput it says there is no pace to forecast from,
  instead of giving a date. With nothing open it says so. A result past 365
  days is "not within 365 days", not a date.
- The sample's answers match its pace: 28 finished in 41 days and 14 open
  gives a median of about 20 days.
- Screenshots read at 1280 and 390 px; no console errors.
- `npm test` 492 of 492 and `npm run check` pass. No spend.
- Not done: the plan's "project header" placement and an Explain entry of its
  own. The forecast's input is explainable through `throughput_series`.
- Log: PROGRESS.md, 2026-10-08 — T032.

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
