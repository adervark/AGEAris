---
id: T040
title: "Aris under the logo, centred"
status: done
owner: adervark @k/c1e9ef11 2026-10-09 — Aris under the logo, centred
# type: one word; tasks of one type are timed together; `bug` counts as defect work
type: design
# blockedReason: while blocked, one line saying what unblocks it; cleared on unblock
blockedReason: ""
depends: [T039]
created: 2026-10-09
---

# T040 — Aris under the logo, centred

## Goal

The sidebar's wordmark under the logo reads "Aris", centred under it.

## Context

- 2026-10-09 the operator asked: "just show Aris under the logo and center
  it". The link's accessible name stays "AGE Aris: Home".

## Steps

- [x] The wordmark says "Aris" and is centred under the logo.
- [x] DESIGN.md says so.

## Decision rules — fixed in advance

- Pass: the sidebar shows "Aris" centred under the logo at desktop width and
  in the phone menu; the browser walk finds no problem; `npm test` and
  `npm run check` pass.
- No spend.

## Handoff — state at last stop

*Kept true while claimed, not written on the way out (rule 8).*

- **Last touched:** 2026-10-09, adervark @k/c1e9ef11 (done)
- **In flight:** nothing
- **On disk:** nothing
- **Resume with:** nothing
- **Next decision:** none

## Verify

A screenshot of the sidebar.

## Result

Pass. The wordmark reads "Aris" in chrome, centred under the logo
(`.brand` centres its items). The link's accessible name stays "AGE Aris:
Home", and the page title and breadcrumbs keep the full name.

- `npm test` passed 505 of 505, and `npm run check` passed. The browser walk
  found 0 problems in 102 page views. The sidebar was checked by eye at 2×.

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
