---
id: T121
title: "Done in AGE Aris releases the task's environment, from AGE Aris's own copy"
status: claimed
owner: adervark @k/5a99efba 2026-11-03 — Done in AGE Aris runs rule 13's release
# type: one word; tasks of one type are timed together; `bug` counts as defect work
type: feature
# blockedReason: while blocked, one line saying what unblocks it; cleared on unblock
blockedReason: ""
depends: [T111, T119]
created: 2026-11-03
---

# T121 — Done in AGE Aris releases the task's environment

## Goal

Marking a task done in AGE Aris, on a tracked AA board, also releases its
environment (rule 13) with no separate step. The release is AGE Aris's own
copy of `ckpt.sh`, so a board needs no script of its own.

## Context

- Operator, 2026-11-03, on T119: "AGEAris should do that", "not AGEIS". Asked
  how far, they chose "Automatic on done": marking a task done in AGE Aris
  also releases it. On T119's AGEIS commit `f8b0f90`: keep it until AGE Aris
  ships the release.
- This widens AGENTS.md's hard constraint, on the operator's word. Today a
  task action is one commit of one task file, and T113 planned read-only.
- Only AGEIS has task actions on today.

## Steps

- [ ] Failing tests on temporary repositories.
- [ ] `lib/release.mjs` runs `skills/aa-init/template/ckpt.sh release` from
      the repository, hardened; `actOnTask` starts it after the commit,
      outside the write queue.
- [ ] The result, the task and the drawer say what happened; a long release
      reports later.
- [ ] AGENTS.md's constraint, the README, the switch's wording, capabilities.

## Decision rules — fixed in advance

- `data-migration`: tests act only on temporary repositories. No real board is
  released by this task.
- `push`: none. `global-config`: none.
- `agent-fan-out`: one read-only review of the diff, because this adds a
  deletion. Nothing else.
- A failed or refused release never undoes the Done, and is always reported.
- It runs only on a board whose `AA.yml` names `scratch:`: boards that have
  not taken up rule 13 have agents that were never told their scratch goes.
- The repository's own scripts are never run, and its hooks, filters, signing
  and external diffs do not run. A nested repository, whose own config AGE
  Aris would otherwise read, keeps its folder whole.
- Done means: a test shows Done releasing a scratch folder and committing the
  kept files; each refusal leaves the Done standing and is reported; a hook,
  a filter and the repository's own `ckpt.sh` are shown not to run; `npm test`
  and `npm run check` pass.

## Handoff — state at last stop

*Kept true while claimed, not written on the way out (rule 8).*

- **Last touched:** 2026-11-03, adervark @k/5a99efba
- **In flight:** nothing yet
- **On disk:** nothing yet
- **Resume with:** the Steps above
- **Next decision:** whether AGEIS's own copy can go; tasks its agents close
  by git never pass through AGE Aris's Done

## Verify

`node --test tests/task-actions.test.mjs`, and `npm test`, `npm run check`.

## Result

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
