---
id: T122
title: "A task an agent closes with git is released by AGE Aris too"
status: claimed
owner: adervark @k/5a99efba 2026-11-03 — AGE Aris sweeps done tasks on tracked boards
# type: one word; tasks of one type are timed together; `bug` counts as defect work
type: feature
# blockedReason: while blocked, one line saying what unblocks it; cleared on unblock
blockedReason: ""
depends: [T121]
created: 2026-11-03
---

# T122 — A task an agent closes with git is released by AGE Aris too

## Goal

AGE Aris's release covers tasks that reach `done/` without its Done button, so
a board can drop its own copy of the release, as the operator wants for AGEIS.

## Context

- T121 releases only on a Done taken in AGE Aris. Agents mostly close tasks by
  moving the file with git, and those never pass through it.
- So AGEIS's own copy (`f8b0f90`) cannot go yet: without it, `scratch/` there
  would refill. That copy also lacks T121's fixes to `ckpt.sh` (symlinks under
  `AA/evidence`, `scratch:` naming `.git`, an invalid `scratch:` not stopping).
- Deleting with no operator action goes past what the operator chose in T121
  ("marking a task done in AGE Aris also releases it"), and past AGENTS.md's
  exception, so the operator decides first.

- Operator's choice, 2026-11-03: "AGE Aris sweeps": it notices done tasks on
  boards with task actions on and releases them by itself.

## Steps

- [x] The sweep, with failing tests first, on temporary repositories.
- [x] The project page and the API say what it did and what is stuck.
- [x] AGENTS.md's exception, the README, the switch's wording.
- [x] Show the operator what the first real sweep would delete, read-only.

- [ ] On the operator's word: restart the server, and take AGEIS's own copy out.

## Decision rules — fixed in advance

- `data-migration` (anything in a tracked repository): tests on temporary
  repositories only. The first real sweep, which a server restart starts, and
  any AGEIS commit removing its copy, wait for the operator's word on the list.
- `push`: none. `global-config`: none.
- `agent-fan-out`: one read-only review of this diff and of T121's fixes, which
  were not reviewed again. Nothing else.
- It sweeps only a board with task actions on, whose `AA.yml` names `scratch:`,
  and only a task whose move to `done/` is committed and over an hour old, so a
  closing agent is left to finish. Switching actions off stops it.
- Every release leaves a record, and whatever stays or refuses shows on the
  project page. A task that stays is not retried for 24 hours.
- Done means tests show a task moved to `done/` by git released; a fresh or
  uncommitted one, a board with actions off, and one with no `scratch:` left
  alone; `npm test`, `npm run e2e` and `npm run check` pass.

## Handoff — state at last stop

*Kept true while claimed, not written on the way out (rule 8).*

- **Last touched:** 2026-11-03, adervark @k/5a99efba
- **In flight:** nothing; the code is committed, and the running server has the old code
- **On disk:** nothing
- **Resume with:** the operator's word, then a restart (`/aa` does it, and that
  starts the sweep) and AGEIS's commit
- **Next decision:** go live, or a further review first; the redesign has had none

## Verify

## Result

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*

- 2026-11-03: the one review allowed reproduced 3 critical, 4 high and 5 medium
  findings, some of them in T121's fixes. Blanking repository config did not
  converge, so the hardened release was redesigned: no git command that can read
  a filter or hook, a repository whose own config names a filter refused, and
  worktrees left to a terminal. The decision rule said an hour from the commit;
  that date is the agent's to write, so the hour now runs from when AGE Aris
  first sees the task, which is stricter.
- Each of 23 protections, removed alone on a temporary copy, failed its test
  (two tests were strengthened to get there). The redesign itself has had no
  independent review.
