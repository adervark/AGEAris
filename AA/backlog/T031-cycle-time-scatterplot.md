---
id: T031
title: "A cycle-time scatterplot with the service level"
status: open
owner: —
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

- [ ] Chart data from `projectMetrics`: the cycle sample with finish dates; the percentiles; what was left out.
- [ ] The chart, with a one-line meaning; dots open the task.
- [ ] Tests.

## Decision rules — fixed in advance

- Pass: the dots are exactly `cycle_time_p85`'s items; the 50th and 85th lines equal `cycle_time_p50` and `cycle_time_p85`; left-out tasks are counted on the chart; tests and `npm run check` pass; a screenshot is read.
- No spend.

## Handoff — state at last stop

*Kept true while claimed, not written on the way out (rule 8).*

- **Last touched:** 2026-10-08, adervark @k/adccab68 (registered)
- **In flight:** nothing
- **On disk:** nothing yet
- **Resume with:** the Steps
- **Next decision:** none

## Verify

`npm test`; the chart seen in headless Chrome on the sample project.

## Result

*(placeholder)*

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
