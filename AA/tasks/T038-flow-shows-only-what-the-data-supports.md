---
id: T038
title: "The Flow tab shows only what the data supports: empty charts, oversized text, numbers that disagree"
status: claimed
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

- [ ] Chart text stays the page's size at any width.
- [ ] Axes span the data: a time axis starts at the board's first day, a
      value axis fits the values, in units that suit them (hours, not 0 days).
- [ ] A chart with nothing to show becomes one line saying what it needs.
- [ ] "Usually" and "usual week" say nothing rather than 0 when there are no
      earlier weeks.
- [ ] The Flow tab does not repeat the project's number tiles.
- [ ] DESIGN.md / docs/METRICS.md say so where they describe the charts.

## Decision rules — fixed in advance

- Pass: on the AGE Aris and AGEIS boards at 1440 and 3440 wide, no chart is
  an empty or near-empty frame, chart text is within 1px of the page's, no
  two numbers on the tab contradict each other, and the dots of the scatter
  spread over its height; the tests cover the new rules; the browser walk
  finds no problem; `npm test` and `npm run check` pass.
- No spend.

## Handoff — state at last stop

*Kept true while claimed, not written on the way out (rule 8).*

- **Last touched:** 2026-10-08, adervark @k/c1e9ef11 2026-10-08 (claimed)
- **In flight:** nothing
- **On disk:** nothing
- **Resume with:** the Steps
- **Next decision:** none

## Verify

Screenshots of both boards at both widths; the tests.

## Result

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
