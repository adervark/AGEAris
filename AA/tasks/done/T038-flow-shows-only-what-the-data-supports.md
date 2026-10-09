---
id: T038
title: "The Flow tab shows only what the data supports: empty charts, oversized text, numbers that disagree"
status: done
owner: adervark @k/c1e9ef11 2026-10-08 — flow shows only what the data supports
# type: one word; tasks of one type are timed together; `bug` counts as defect work
type: bug
# blockedReason: while blocked, one line saying what unblocks it; cleared on unblock
blockedReason: ""
depends: [T030, T031, T032, T033, T035]
created: 2026-10-08
---

# T038 — The Flow tab shows only what the data supports

## Goal

Every chart on the Flow tab says something true and readable, or is not
there. A young board shows a line saying what a chart needs, not an empty box.

## Context

- 2026-10-08 the operator called the charts bullshit. On the AGE Aris board
  at 3440 wide (two days of history, 32 tasks done, nothing open):
  - the cycle-time scatter's SVG text scales with its width, so its labels
    are about twice the page's text; its y axis runs 0–2 days while every
    dot sits near 0, so the dots pile up on one line;
  - throughput and WIP draw six weeks (Aug 28 – Oct 8) for two days of data:
    an empty strip with one bar at the edge;
  - aging WIP is a ~250px empty box that says nothing is in progress; the
    forecast is a box that says it cannot forecast;
  - the numbers disagree: "32 finished in 7 days; usually ~0 a week",
    "Usual week 0", cycle time "0.1 h" beside "85% · 0 days";
  - the project's number tiles appear twice on the Flow tab.
- The operator chose (2026-10-08): hide a chart until there is data for it,
  say in one line what it needs, scale axes to the data that exists, fix
  the text size and the contradictions.

## Steps

- [x] Chart text stays the page's size at any width.
- [x] Axes span the data: a time axis starts at the board's first day, a
      value axis fits the values, in units that suit them (hours, not 0 days).
- [x] A chart with nothing to show becomes one line saying what it needs.
- [x] "Usually" and "usual week" say nothing rather than 0 when there are no
      earlier weeks.
- [x] The Flow tab does not repeat the project's number tiles.
- [x] DESIGN.md / docs/METRICS.md say so where they describe the charts.

## Decision rules — fixed in advance

- Pass: on the AGE Aris and AGEIS boards at 1440 and 3440 wide, no chart is
  an empty or near-empty frame, chart text is within 1px of the page's, no
  two numbers on the tab contradict each other, and the dots of the scatter
  spread over its height; the tests cover the new rules; the browser walk
  finds no problem; `npm test` and `npm run check` pass.
- No spend.

## Handoff — state at last stop

*Kept true while claimed, not written on the way out (rule 8).*

- **Last touched:** 2026-10-09, adervark @k/c1e9ef11 (done)
- **In flight:** nothing
- **On disk:** nothing
- **Resume with:** nothing
- **Next decision:** none

## Verify

Screenshots of both boards at both widths; the tests.

## Result

Pass. Every chart on the Flow tab now draws something true and readable, or
is one line saying what it needs.

- **Text size:** a chart is drawn at the width it is shown at (`renderFlow`
  gets `#main`'s content width; a resize redraws), so its text is 12–13 px at
  any width. Measured: scale 1.000 on both boards at 1440 and 3440, and after
  shrinking from 3440 to 1440. Below 650 px a chart scrolls, as before.
- **Axes:** cycle times run from 1 min to 120 min on AGE Aris and from 0 to
  33 days on AGEIS, so time is on a log scale with ticks people think in
  (1 min … 90 days); the dots now spread over the plot's height. Chart data
  keeps 0.001 day (it was rounded to 0.1, so a 4-minute task read "0 days").
  Throughput and WIP per day start at the board's first day
  (`params.born`), not 42 days back.
- **Nothing to draw:** an empty aging chart, a forecast without enough
  history and a board younger than 7 days are each one line in one panel.
- **Contradictions:** the usual week is the weekly mean over the part of the
  4 weeks the board existed, and none (—) with less than a week of them:
  AGE Aris no longer says "usually ~0 a week" beside 33 finished. Durations
  read in minutes under an hour everywhere (`show()` and the charts share the
  words), so the tiles say "4 min" / "13 min" where the scatter said
  "0 days". The Aging WIP and Blocked tables give "21 min", not "0".
- **Duplicates:** the Flow tab no longer repeats throughput, WIP, cycle time
  and service level, which stand above every tab; its tiles fill the row.
- **Wide screens:** aging and cycle times sit side by side when both are
  drawn and the tab is at least 1500 px wide.
- Contracts kept: `slim()` and the kpi keys are unchanged; the usual week
  travels as its own `usualWeek` field. Tests changed where behaviour
  changed (`24 min`, not `0.4 h`; a board made today has a 1-day series) and
  5 were added (durations, the log scale, drawing width, one-line empties).
- `npm test` passed 505 of 505, and `npm run check` passed. The browser walk
  found 0 problems in 102 page views. Screenshots of both boards at 390,
  1440 and 3440 were checked by eye.

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
