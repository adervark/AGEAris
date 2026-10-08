---
id: T032
title: "A forecast from throughput: when, and how many"
status: claimed
owner: adervark @k/adccab68 2026-10-08 — the Monte Carlo forecast
# type: one word; tasks of one type are timed together; `bug` counts as defect work
type: feature
# blockedReason: while blocked, one line saying what unblocks it; cleared on unblock
blockedReason: ""
depends: [T029]
created: 2026-10-08
---

# T032 — A forecast from throughput: when, and how many

## Goal

The Flow tab answers "when will the backlog be done?" and "how many by a date?" as probabilities from the project's own daily throughput, with no estimates, reproducibly.

## Context

- Chosen by the operator 2026-10-08 from `docs/plans/visualisation.md` (T029),
  the first slice: aging WIP, the cycle-time scatterplot, the forecast.
- Charts are inline SVG like `seriesChart` (`public/cockpit.js`): no library,
  no inline styles (CSP), colour by class. Each dot opens its task, by mouse
  and by keyboard.

## Steps

- [ ] A seeded Monte Carlo over the recent daily throughput: days to finish N (the backlog by default), and items done by a date.
- [ ] The forecast with its 50th and 85th percentile answers, its basis named, and Explain.
- [ ] Tests: deterministic for one ledger and asOf; sane on zero throughput.

## Decision rules — fixed in advance

- Pass: the same ledger and asOf give the same numbers; with zero recent throughput it says no forecast instead of a date; tests and `npm run check` pass; a screenshot is read.
- No spend.

## Handoff — state at last stop

*Kept true while claimed, not written on the way out (rule 8).*

- **Last touched:** 2026-10-08, adervark @k/adccab68 (claimed)
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
