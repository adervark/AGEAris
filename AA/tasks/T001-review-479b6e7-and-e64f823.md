---
id: T001
title: "Review 479b6e7 and e64f823 independently"
status: claimed
owner: adervark @k/ff713831 2026-10-07 — one independent reviewer per commit
# type: one word; tasks of one type are timed together; `bug` counts as defect work
type: review
# blockedReason: while blocked, one line saying what unblocks it; cleared on unblock
blockedReason: ""
depends: []
created: 2026-10-07
---

# T001 — Review 479b6e7 and e64f823 independently

## Goal

A reviewer who wrote neither checks two commits on `feature/pm-cockpit` and
ranks what it finds by severity: 479b6e7 (code spans and kept line breaks in
task text) and e64f823 (the board renamed to AA, its older names still read).

## Context

- 479b6e7's review was cut off when the account hit its usage limit on
  2026-10-07.
- e64f823 touches `lib/workspace.mjs` (`BOARDS`, `configName`, `_renderState`),
  `lib/history.mjs` (the board paths) and the tests that keep `deaddrop/` and
  `pm/` boards readable.

## Steps

- [ ] Review 479b6e7 against `public/markdown.js` and `tests/markdown.test.mjs`.
- [ ] Review e64f823: a `deaddrop/` board, tracked or made by AGE Aris, must
  behave exactly as before.
- [ ] File each confirmed defect as its own `bug` task in `backlog/`.

## Decision rules — fixed in advance

- One review agent per commit at most (`agent-fan-out` is a spend). If the
  usage limit cuts a review off, stop, say where in the Handoff, and release
  the task rather than start over.
- A finding counts only with a concrete input that goes wrong. Style notes go
  under Notes, not into new tasks.
- Done when both commits have a verdict: no confirmed defect, or each one filed.

## Handoff — state at last stop

*Kept true while claimed, not written on the way out (rule 8).*

- **Last touched:** 2026-10-07, adervark @k/ff713831
- **In flight:** two reviewers, one per commit, logging to `AA/checkpoints/T001.jsonl`
- **On disk:** nothing yet
- **Resume with:** `git show 479b6e7` and `git show e64f823`, then one reviewer per commit
- **Next decision:** none until the findings are in

## Verify

Every finding names a file, a line and the input that fails; `npm test` passes.

## Result

*(on completion: the outcome against the decision rules above, a pointer to the
entry in the log, and the digest from `AA/ckpt.sh close T001` — then
retire the trail with `--delete`)*

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
