---
id: T121
title: "Done in AGE Aris releases the task's environment, from AGE Aris's own copy"
status: done
owner: adervark @k/5a99efba 2026-11-03 — done
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

- [x] Failing tests on temporary repositories.
- [x] `lib/release.mjs` runs `skills/aa-init/template/ckpt.sh release` from
      the repository, hardened; `actOnTask` starts it after the commit,
      outside the write queue.
- [x] The result, the task and the drawer say what happened; a long release
      reports later.
- [x] AGENTS.md's constraint, the README, the switch's wording, capabilities.

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

## Handoff

Done. Nothing in flight. What is left is T122's choice.

## Verify

`node --test tests/task-actions.test.mjs`, and `npm test`, `npm run check`.

## Result

Commit `0891a64`. A Done taken in AGE Aris on a tracked board whose `AA.yml`
names `scratch:` now runs AGE Aris's own copy of `ckpt.sh release` from the
repository. No board needs a script of its own for this. The Done stands
whatever the release does; `release: { state, summary, lines, remedy }` comes
back on the action and on `GET /api/tasks/:id`, and `releases.jsonl` in the data
folder keeps a line for each.

- **Checks:** `npm test` 644 of 644 (20 new, `tests/done-release.test.mjs`),
  `npm run e2e` 32 of 32, `npm run check` clean.
- **Review:** the one review the decision rules allow reproduced 3 critical,
  2 high, 3 medium and 3 low findings, all before any commit. All were fixed.
  The fixes were not reviewed again. Instead each of 12 was removed in turn on
  a temporary copy, and its test failed each time. External diffs have no such
  test: the reviewer found the test passes without `--no-ext-diff`, so those
  flags are a precaution that nothing here proves.
- **Found while fixing:** an invalid `scratch:` did not stop `ckpt.sh` (its
  `die` ran in a subshell), and `redactEmails` was quadratic on long text.
- **Real board:** read-only `release --dry-run` on AGEIS with AGE Aris's copy,
  T092 and T123: nothing deleted, and everything open tasks and unlanded work
  hold was named as kept. No real board was released.
- **Limits:** only a Done taken in AGE Aris releases; agents closing by git do
  not pass through it (T122), so AGEIS's own copy stays. A filter added in the
  moment between AGE Aris listing filters and the script's git call is not
  blanked. The running server has the old code until it restarts.

Run digest:
- **5a99efba** (session @k/5a99efba): Done in AGE Aris releases the task; review findings fixed · cost one read-only review (agent-fan-out) · left: —

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*

- 2026-11-03, from T122: a second review broke some of this task's fixes, and the
  hardened release was redesigned there. Under AGE Aris a landed worktree now
  stays for a terminal, and a repository whose own config names a filter is
  refused. The Result above describes `0891a64`, not what runs now.
