---
id: T020
title: "A cockpit test fails when run in the early hours"
status: claimed
owner: adervark @v/2e8b687e 2026-10-07 — pinning the test clock
# type: one word; tasks of one type are timed together; `bug` counts as defect work
type: bug
# blockedReason: while blocked, one line saying what unblocks it; cleared on unblock
blockedReason: ""
depends: []
created: 2026-10-07
---

# T020 — A cockpit test fails when run in the early hours

## Goal

`tests/cockpit-ui.test.mjs` passes at any time of day, in any time zone.

## Context

- Found 2026-10-07 while building T019; it fails the same way without T019's
  changes, and passed at 2026-10-06T22:04Z.
- "the cockpit views render the sample project…" builds the sample with
  `now: Date.now()` and asks the brief for `previous-workday` with the real
  clock. At 2026-10-06T23:01Z (04:31 on 7 October in Asia/Calcutta, the
  machine's zone) the window ran from the start of 2026-10-06 and held 0
  finished tasks and 1 added. The test expects the expanded "finished" delta
  (`id="delta-finished"`), so it fails.
- Whether the sample has a finish in that window depends on the hour the test
  runs; the sample's simulated history presumably clusters its finishes in
  working hours.

## Steps

- [ ] Give the test a fixed clock (the sample and the Cockpit both take one),
  or assert on whichever delta the window holds.
- [ ] Run it at a few fixed instants, including 04:30 local.

## Decision rules — fixed in advance

- Pass: the test passes with the clock fixed at 00:30, 04:30, 12:00 and 23:30
  local, and `npm test` passes.
- No spend.

## Handoff — state at last stop

*Kept true while claimed, not written on the way out (rule 8).*

- **Last touched:** 2026-10-07, adervark @v/2e8b687e (claimed)
- **In flight:** the fix, in this session
- **On disk:** nothing yet
- **Resume with:** fix the clock in the test
- **Next decision:** none

## Verify

`npm test` at the four instants above.

## Result

*(on completion: the outcome against the decision rules above, a pointer to the
entry in the log, and the digest from `AA/ckpt.sh close T020` — then
retire the trail with `--delete`)*

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
