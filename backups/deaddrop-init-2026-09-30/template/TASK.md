---
id: {{T###}}
title: "{{title}}"
status: open
owner: —
type: {{optional — a work item type: doc / analysis / run / review. Tasks of one
  type are timed together, so a 20-minute doc task never sets the reference line
  for a 5-day run. Delete this line where there is one kind of work.}}
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

{{REQUIRED before this task may be claimed, if it will spend anything named in
deaddrop.yml. What outcome means pass, fail, or stop — written before, judged
after, binding even when the number lands one digit short.}}

*(While this is empty the task is not ready to pull, and the board marks it ⚑.)*

## Handoff — state at last stop

*Kept true while claimed, before anything that could outlive the session — not
written on the way out. A limit or a crash gives no warning (rule 8). The
finer-grained trail is this task's checkpoints; when the two disagree about what
is in flight, the newest checkpoint entry wins.*

- **Last touched:** {{DATE, operator @profile/session}}
- **In flight:** {{what is running and where, or "nothing"}}
- **On disk:** {{what is already paid for — the next runner must not redo it}}
- **Resume with:** {{the exact command, or the decision that comes first}}
- **Next decision:** {{what the resuming session has to choose, if anything}}

## Verify

{{How to check the work without trusting the worker.}}

## Result

*(on completion: the outcome against the decision rules above, a pointer to the
entry in the log, and the run digest from `deaddrop/ckpt.sh close {{T###}}` —
then retire the trail with `--delete`; git keeps it)*
