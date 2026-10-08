---
id: T030
title: "An aging WIP chart: what is not moving"
status: open
owner: —
# type: one word; tasks of one type are timed together; `bug` counts as defect work
type: feature
# blockedReason: while blocked, one line saying what unblocks it; cleared on unblock
blockedReason: ""
depends: [T029]
created: 2026-10-08
---

# T030 — An aging WIP chart: what is not moving

## Goal

The Flow tab shows every task in progress or blocked as a dot by column and age, over bands at the 50th, 70th, 85th and 95th percentiles of finished cycle times, with stale agent claims marked: the Daily Scrum's "what is not moving?" at a glance.

## Context

- Chosen by the operator 2026-10-08 from `docs/plans/visualisation.md` (T029),
  the first slice: aging WIP, the cycle-time scatterplot, the forecast.
- Charts are inline SVG like `seriesChart` (`public/cockpit.js`): no library,
  no inline styles (CSP), colour by class. Each dot opens its task, by mouse
  and by keyboard.

## Steps

- [ ] Chart data from `projectMetrics`: every WIP task's age, column, level and staleness; the percentile bands.
- [ ] The chart, with a one-line meaning and an accessible label; dots open the task.
- [ ] Tests: the data matches `aging` and `cycle_time_p85`; the markup is clean.

## Decision rules — fixed in advance

- Pass: every WIP task with a start is a dot; its level agrees with the `aging` metric; the 85th band edge equals `cycle_time_p85`'s value; tests and `npm run check` pass; a screenshot of the sample project is read.
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
