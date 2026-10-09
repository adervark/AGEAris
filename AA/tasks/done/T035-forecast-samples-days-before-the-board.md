---
id: T035
title: "The forecast samples days from before the board existed"
status: done
owner: adervark @k/adccab68 2026-10-08 — forecast from the board's own days
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

- [x] The sampled days start no earlier than the board's first commit.
- [x] The basis line names the days actually sampled.
- [x] With fewer than 5 finishes in those days the forecast stays `thin`.
- [x] Fewer than 5 whole days is `thin` too: one day sampled has no spread.
- [x] A test with a board that begins inside the window.

## Decision rules — fixed in advance

- Pass: a board younger than the window is forecast from its own days only,
  shown by a test that fails before the fix; boards older than the window
  forecast exactly as before; `npm test` and `npm run check` pass.
- No spend.

## Handoff — state at last stop

*Kept true while claimed, not written on the way out (rule 8).*

- **Last touched:** 2026-10-08, adervark @k/adccab68 (done)
- **In flight:** nothing
- **On disk:** nothing
- **Resume with:** nothing
- **Next decision:** none

## Verify

`npm test`; AGE Aris's own Flow tab.

## Result

Pass. The forecast samples only days from the board's first commit on, and
needs 5 whole days as well as 5 finishes.

- **The fix:** `forecastChart` in `lib/metrics.mjs` drops every day that
  ended before the board's first commit (`ctx.view.commits[0]`). The basis
  line names the days actually sampled.
- **Found while checking it:** AGE Aris's own board then had one whole day
  (Oct 7, 7 finishes). A forecast from one day has no spread, so it read
  "98 or more in 14 days" (7 × 14) and "by Fri, Oct 9" at 50, 85 and 95%
  alike. `forecast()` now returns `thin` with `short: 'days'` below 5 days,
  and says "the board has one whole day of work behind it, and a forecast
  needs 5". The axis label "1 days" now says "1 day", and a board born today
  says so in words.
- **Tests:** `tests/metrics.test.mjs` adds a board that begins on day 28. It
  failed before the fix (sampled from 2026-08-25) and now samples Sep 29 to
  Oct 4, 6 days. `tests/charts.test.mjs` adds the one-day and born-today
  cases. `npm test` passed 501 of 501, and `npm run check` passed.
- **Older boards are unchanged:** compared with the code at 99f4b82, the
  forecasts of the sample, AGEIS, AGEION and RSNA are identical. Only the two
  young boards changed: Gem4A now samples 8 days from Sep 30 and is still
  `thin`, and the AGE Aris clone samples 1 day and is now `thin`.
- **The browser walk:** 72 page views, 0 with a problem.
- **The other repositories:** AGEION, RSNA and Gem4A are unchanged. AGEIS
  gained commits from its own session (T092, 16:02 to 17:31); AGE Aris only
  read it.

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
