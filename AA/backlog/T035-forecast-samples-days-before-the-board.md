---
id: T035
title: "The forecast samples days from before the board existed"
status: backlog
owner: ""
# type: one word; tasks of one type are timed together; `bug` counts as defect work
type: bug
# blockedReason: while blocked, one line saying what unblocks it; cleared on unblock
blockedReason: ""
depends: [T032]
created: 2026-10-08
---

# T035 — The forecast samples days from before the board existed

## Goal

The forecast draws only from days when the board could have finished work.

## Context

- Found 2026-10-08 while screenshotting T034 on AGE Aris's own board. The
  Flow tab says "From 41 days of throughput, Fri, Aug 28 to Wed, Oct 7: 7
  finished", then "85% by Fri, Dec 25" for 5 open tasks, and "possibly none"
  in the next 14 days. On the same page, throughput is 29 in the last 7 days.
- The repository's first commit is 2026-10-01 and its board's is 2026-10-07.
  `forecastChart` in `lib/metrics.mjs` samples every day of
  `throughput_series` (42 days less today), so more than 30 days from before
  the project existed are sampled as days that finished nothing.
- The project health check already knows the first commit (rule H5,
  `ctx.view.commits[0]`).

## Steps

- [ ] The sampled days start no earlier than the board's first commit.
- [ ] The basis line names the days actually sampled.
- [ ] With fewer than 5 finishes in those days the forecast stays `thin`.
- [ ] A test with a board that begins inside the window.

## Decision rules — fixed in advance

- Pass: a board younger than the window is forecast from its own days only,
  shown by a test that fails before the fix; boards older than the window
  forecast exactly as before; `npm test` and `npm run check` pass.
- No spend.

## Handoff — state at last stop

*Kept true while claimed, not written on the way out (rule 8).*

- **Last touched:** 2026-10-08
- **In flight:** nothing
- **On disk:** nothing
- **Resume with:** the Steps
- **Next decision:** none

## Verify

`npm test`; AGE Aris's own Flow tab.

## Result

*(placeholder)*

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
