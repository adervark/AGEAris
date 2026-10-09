---
id: T031
title: "A cycle-time scatterplot with the service level"
status: done
owner: adervark @k/adccab68 2026-10-08 — aging WIP chart and cycle-time scatterplot
# type: one word; tasks of one type are timed together; `bug` counts as defect work
type: feature
# blockedReason: while blocked, one line saying what unblocks it; cleared on unblock
blockedReason: ""
depends: [T029]
created: 2026-10-08
---

# T031 — A cycle-time scatterplot with the service level

## Goal

The Flow tab shows each task finished in the flow window as a dot by finish date and cycle time, with lines at the 50th, 85th and 95th percentiles, the 85th named as the service level: how long work takes here, and whether that is changing.

## Context

- Chosen by the operator 2026-10-08 from `docs/plans/visualisation.md` (T029),
  the first slice: aging WIP, the cycle-time scatterplot, the forecast.
- Charts are inline SVG like `seriesChart` (`public/cockpit.js`): no library,
  no inline styles (CSP), colour by class. Each dot opens its task, by mouse
  and by keyboard.

## Steps

- [x] Chart data from `projectMetrics`: the cycle sample with finish dates; the percentiles; what was left out.
- [x] The chart, with a one-line meaning; dots open the task.
- [x] Tests.

## Decision rules — fixed in advance

- Pass: the dots are exactly `cycle_time_p85`'s items; the 50th and 85th lines equal `cycle_time_p50` and `cycle_time_p85`; left-out tasks are counted on the chart; tests and `npm run check` pass; a screenshot is read.
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

**Done.** The Flow tab draws a cycle-time scatterplot (`cycleChart`) from
`charts.cycles`. Each task finished in the 90-day flow window with a known
start is a dot, placed by finish date and by days from claim to done. Lines
mark the 50th, 85th (the service level) and 95th percentiles, and dots above
the 85th line are amber. Left-out tasks are counted under the chart. The axis
starts a day before the first finish, so a young project is not squeezed.

Against the decision rules:

- The dots are exactly `cycle_time_p85`'s items. The 50th and 85th lines
  equal `cycle_time_p50` and `cycle_time_p85` to a tenth of a day, and the
  left-out count equals the metric's excluded list (`tests/sample.test.mjs`).
- Close labels (6.1 and 7 days) are pushed apart and keep their order;
  screenshots read at 1280 and 390 px.
- `npm test` 491 of 491 and `npm run check` pass. No spend.
- Log: PROGRESS.md, 2026-10-08 — T030 and T031.

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
