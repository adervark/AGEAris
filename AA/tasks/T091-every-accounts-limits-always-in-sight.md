---
id: T091
title: "Every account's limits in sight on every page, kept fresh"
status: claimed
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

- [ ] A limits strip under the top bar on every page: one cell per
      account, every window it has (session, weekly, and the Opus and
      Sonnet weeklies when the plan has them), the percent used and when it
      resets; an account that cannot be read says why, with its last good
      reading. The most-left account is marked. It opens the tab.
- [ ] The page reads `/api/limits` when it loads and every minute while it
      is visible; the Account limits tab shares the same reading.
- [ ] Narrow screens: the strip wraps, with no sideways scroll.
- [ ] README.

## Decision rules — fixed in advance

- No spend in `AA.yml` applies.
- Done means: on every page and at phone width, every account and every
  window is on screen; the numbers match `/aa limits`; no outbound read more
  often than the server's 5-minute hold, whatever the page does; `npm test`
  and `npm run check` pass, and the board is current.

## Handoff — state at last stop

*Kept true while claimed, not written on the way out (rule 8).*

- **Last touched:** 2026-10-22, claimed; building the strip in `public/app.js`
- **In flight:** nothing
- **On disk:** nothing uncommitted

## Verify

Open any page: every account's windows are in the strip, and match
`/aa limits`. Leave it open past 5 minutes: the reading's time moves on.

## Result

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
