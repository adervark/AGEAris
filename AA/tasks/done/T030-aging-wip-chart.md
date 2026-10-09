---
id: T030
title: "An aging WIP chart: what is not moving"
status: done
owner: adervark @k/adccab68 2026-10-08 — aging WIP chart and cycle-time scatterplot
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

- [x] Chart data from `projectMetrics`: every WIP task's age, column, level and staleness; the percentile bands.
- [x] The chart, with a one-line meaning and an accessible label; dots open the task.
- [x] Tests: the data matches `aging` and `cycle_time_p85`; the markup is clean.

## Decision rules — fixed in advance

- Pass: every WIP task with a start is a dot; its level agrees with the `aging` metric; the 85th band edge equals `cycle_time_p85`'s value; tests and `npm run check` pass; a screenshot of the sample project is read.
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

**Done.** The Flow tab draws an aging WIP chart (`public/charts.js`,
`agingChart`) from `charts.aging` in `projectMetrics` (`lib/metrics.mjs`). It
has two columns, In progress and Blocked, with height as days since claimed.
Zones and lines sit at the 50th, 70th, 85th and 95th percentiles of the
project's finished cycle times, and a dot's colour is its level from the
`aging` metric. A dashed ring marks a stale agent claim. Each dot is
focusable SVG with the role of a button, opening the task on click, Enter or
Space.

Against the decision rules:

- On the sample, every WIP task with a start is a dot (dots + unstarted =
  `wip`). The tasks past the service level are exactly the `aging` metric's
  items; the rings are exactly the stale claims; the 85th line equals
  `cycle_time_p85`. All asserted in `tests/sample.test.mjs`.
- Markup: no inline style, one dot per task, each opening its own task
  (`tests/cockpit-ui.test.mjs`).
- Screenshots of the sample read at 1280 and 390 px. No page overflow and no
  console errors. Enter on a focused dot opens the drawer. Chart text is at
  least 12.8 px on a phone, where the chart scrolls inside its frame.
- Found on the way: the server serves `public/` from an allowlist, so a new
  module 404s and the page never loads. A test now walks the page's imports
  from `app.js` and requires each to be served.
- `npm test` 491 of 491 and `npm run check` pass. No spend.
- Log: PROGRESS.md, 2026-10-08 — T030 and T031.

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
