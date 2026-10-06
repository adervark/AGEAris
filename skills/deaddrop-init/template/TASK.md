---
id: {{T###}}
title: "{{title}}"
status: open
owner: —
# type: one word; tasks of one type are timed together; `bug` counts as defect work
type: {{type, or delete the line for untyped}}
# blockedReason: while blocked, one line saying what unblocks it; cleared on unblock
blockedReason: ""
depends: []
created: {{DATE}}
---

# {{T###}} — {{title}}

## Goal

{{What done looks like, in one or two sentences.}}

## Context

{{Links to what an agent needs. Point, do not duplicate.}}

## Steps

- [ ] {{...}}

## Decision rules — fixed in advance

{{Pass, fail and stop criteria — required before claiming if this task will
spend anything named in deaddrop.yml (rule 5).}}

*(While this is empty the board marks the task ⚑.)*

## Handoff — state at last stop

*Kept true while claimed, not written on the way out (rule 8).*

- **Last touched:** {{DATE, operator @profile/session}}
- **In flight:** {{what is running and where, or "nothing"}}
- **On disk:** {{what is already paid for — the next runner must not redo it}}
- **Resume with:** {{the exact command, or the decision that comes first}}
- **Next decision:** {{what the resuming session has to choose, if anything}}

## Verify

{{How to check the work without trusting the worker.}}

## Result

*(on completion: the outcome against the decision rules above, a pointer to the
entry in the log, and the digest from `deaddrop/ckpt.sh close {{T###}}` — then
retire the trail with `--delete`)*

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
