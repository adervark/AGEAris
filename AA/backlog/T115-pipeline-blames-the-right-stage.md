---
id: T115
title: "Pipeline: a reviewer's FAIL and a person's send-back blame the stage that did the work"
status: open
owner: —
# type: one word; tasks of one type are timed together; `bug` counts as defect work
type: bug
# blockedReason: while blocked, one line saying what unblocks it; cleared on unblock
blockedReason: ""
depends: []
created: 2026-11-03
---

# T115 — Pipeline: a reviewer's FAIL and a person's send-back blame the stage that did the work

## Goal

A reviewer that catches a defect (`VERDICT: FAIL`, `goto:implement`) does not use up its own stage's `maxAttempts`, and a person who rejects at the review gate and sends the work back to Implement charges the rejection to the implementer, not the reviewer.

## Context

- `lib/pipeline.mjs:157` counts every failed attempt, a FAIL verdict too, in `state.failures[review]`, never reset on `stage_moved`; `_decide` (`:811`) then fails the run as "Review failed 3 times" when Implement failed review three times.
- `reject` (`:979`) emits `rejected` for the gate attempt, the reviewer's; `performanceStats` (`lib/router.mjs:41-65`) adds the rejection to the reviewer, and `sentBack` stays false, so the implementer keeps its success.
- Found by the operator's agy (Gemini) review of 2026-11-03, step 111, and checked against the code by T111's session.

## Steps

- [ ] A failing test that shows it.
- [ ] The fix, then the test passes; `npm test` and `npm run check` pass.

## Decision rules — fixed in advance

- No spend: code and tests on temporary data only.
- Done means the failing test above passes and nothing else changed behaviour.

## Handoff — state at last stop

*Kept true while claimed, not written on the way out (rule 8).*

- **Last touched:** —
- **In flight:** nothing
- **On disk:** nothing
- **Resume with:** the Steps above
- **Next decision:** none

## Verify

A run whose reviewer returns FAIL three times reaches Implement a fourth time, or fails naming Implement; the router's stats charge a send-back to the implementer.

## Result

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
