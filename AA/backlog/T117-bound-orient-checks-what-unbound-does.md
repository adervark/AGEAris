---
id: T117
title: "orient with a task given checks what orient without one does"
status: open
owner: —
# type: one word; tasks of one type are timed together; `bug` counts as defect work
type: bug
# blockedReason: while blocked, one line saying what unblocks it; cleared on unblock
blockedReason: ""
depends: []
created: 2026-11-03
---

# T117 — orient with a task given checks what orient without one does

## Goal

`/api/orient?task=T###` returns `resume` for a run on T that stopped mid-act, whoever's session it was, and `wait` or `check-unblock` for a blocked task or one behind a gate, as an unbound call does. Today it only looks at the calling run, so it says `continue`.

## Context

- `lib/orient.mjs:837-846`: `own` matches `run.run === call.run` only; gates and the blocked column are not consulted. Unbound path: `:855-868`.
- Also `:764` and `:914`: `next` and WIP come from committed HEAD, with uncommitted claims only a warning.
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

A fixture where another closed run of the same operator stopped mid-act on T: the bound call says `resume` with `verify: tell`.

## Result

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
