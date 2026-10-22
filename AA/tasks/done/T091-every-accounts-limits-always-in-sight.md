---
id: T091
title: "Every account's limits in sight on every page, kept fresh"
status: done
owner: adervark @default/1f16c0d5 2026-10-22 — a limits strip on every page, refreshed every minute
# type: one word; tasks of one type are timed together; `bug` counts as defect work
type: feature
# blockedReason: while blocked, one line saying what unblocks it; cleared on unblock
blockedReason: ""
depends: [T089]
created: 2026-10-22
---

# T091 — Every account's limits in sight on every page, kept fresh

## Goal

Every Claude account's limits, all of them, are on screen on every page of
AGE Aris, and they keep themselves current without a click.

## Context

- T089 put them on the Agents page's Account limits tab, read when the tab
  opens or on Read again. The operator (2026-10-22): "I want all accounts
  all limits visible at all times", with the page refreshing itself.
- The server holds each reading for 5 minutes, because the endpoint answers
  429 to a few quick reads in a row. That stays.

## Steps

- [x] A limits strip under the top bar on every page: one cell per
      account, every window it has (session, weekly, and the Opus and
      Sonnet weeklies when the plan has them), the percent used and when it
      resets; an account that cannot be read says why, with its last good
      reading. The most-left account is marked. It opens the tab.
- [x] The page reads `/api/limits` when it loads and every minute while it
      is visible; the Account limits tab shares the same reading.
- [x] Narrow screens: the strip wraps, with no sideways scroll.
- [x] README.

## Decision rules — fixed in advance

- No spend in `AA.yml` applies.
- Done means: on every page and at phone width, every account and every
  window is on screen; the numbers match `/aa limits`; no outbound read more
  often than the server's 5-minute hold, whatever the page does; `npm test`
  and `npm run check` pass, and the board is current.

## Handoff — state at last stop

*Kept true while claimed, not written on the way out (rule 8).*

- **Last touched:** 2026-10-22: the strip, the minute poll and README
  committed. Screenshots on Home and Projects (scrolled), wide and phone:
  4 accounts, 6 windows (`v` expired, no reading yet), pinned under the
  top bar, no console errors, no sideways scroll; 97 px tall at 390 px.
  A grid that aligned the phone rows wrapped each account to two lines
  and was dropped.
- **Closed** 2026-10-22 18:18Z: a page left open 5.5 minutes asked 6
  times; each account's reading moved on 5 minutes after the last.
- **In flight:** nothing
- **On disk:** nothing uncommitted

## Verify

Open any page: every account's windows are in the strip, and match
`/aa limits`. Leave it open past 5 minutes: the reading's time moves on.

## Result

**Done (2026-10-22), `af3ec0b`.** A strip under the top bar, on every page,
shows every Claude account with every window it has: percent used, the
reset, the most-left account, and why one cannot be read.

- The page reads `/api/limits` on load and each minute while visible. Left
  open 5.5 minutes, it asked 6 times; each account's reading moved on 5
  minutes after the last (18:12:30Z → 18:17:31Z), and the strip with it
  (`default` 15% → 17%). The server's hold keeps Anthropic at one read per
  account per 5 minutes.
- Wide and phone, Home and Projects scrolled: pinned under the top bar, no
  console errors, no sideways scroll, 57 px tall wide and 97 px at 390 px.
- `npm test` 550 of 550, `npm run check` clean. No new test: the
  read-rate guarantee is the server's, tested in T089.

**Spend:** none.

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
