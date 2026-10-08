---
id: T021
title: "A tracked-write engine that commits one task file under git's lock"
status: done
owner: adervark @k/578f7ba9 2026-10-07 — tracked-write engine built
# type: one word; tasks of one type are timed together; `bug` counts as defect work
type: feature
# blockedReason: while blocked, one line saying what unblocks it; cleared on unblock
blockedReason: ""
depends: []
created: 2026-10-07
---

# T021 — A tracked-write engine that commits one task file under git's lock

## Goal

`lib/tracked.mjs` commits one task-file change to a tracked repository's pinned branch under `.git/index.lock`, with every outcome committed, unchanged, or reported as interrupted. Nothing reaches it from the API yet: the product still never writes to a tracked repository.

## Context

- The plan: [docs/plans/task-control.md](../../docs/plans/task-control.md)
  (v3.1). Approved by the operator 2026-10-07 after Planner, Architect and
  Critic consensus; Q1–Q3 decided as recorded in its §10.
- Plan §3 (the write protocol), §4 (`readTrail`, `setResult`), §5 T021, §7 pre-mortem 1, §8 unit and integration tests.
- Runs in parallel with T022; WIP limit 2.

## Steps

- [ ] `lib/workspace.mjs` `git()`: `input`, `timeout`, filtered `env` overrides; `boardPolicy` returns `blockedLimit`, `staleHours` defaults to 24.
- [ ] `lib/tracked.mjs` per plan §5 T021.
- [ ] `tests/tracked.test.mjs` with real-file fixtures and the seam, crash, recovery and timeout tests in §8.
- [ ] `package.json` `check` adds `lib/tracked.mjs`.

## Decision rules — fixed in advance

- `agent-fan-out` is a spend: at most one worker subagent per task at a
  time, opened with `AA/ckpt.sh open T021 --agent …` and a `doing` line
  before it is spawned. A worker that fails twice stops the fan-out; the
  task goes back to its owner's session.
- `data-migration`: tests write only to temporary repositories. Nothing here
  touches `.agesight-data` or any tracked repository on this machine.
- `push`: none.
- Done means every Acceptance line in the plan's section for T021 holds, and
  `npm test` and `npm run check` pass on the commit.

## Handoff — state at last stop

*Kept true while claimed, not written on the way out (rule 8).*

- **Last touched:** 2026-10-08, adervark @k/578f7ba9
- **In flight:** nothing; done
- **On disk:** committed as f8bd795, 552956f and 1de20b2, with this task's move to `done/`
- **Resume with:** nothing to resume; T023 wires the engine in
- **Next decision:** none

## Verify

`node --test tests/tracked.test.mjs` passes, including every seam test asserting exactly one of the two outcomes; `grep -n "never writes to a repository it tracks" AGENTS.md` still matches.

## Result

Pass, against the decision rules.

- **Built** (f8bd795) by a worker subagent in its own worktree: `lib/tracked.mjs`.
  It implements plan §3 steps 1–8:
  - the lock is taken with O_EXCL and carries a nonce;
  - the commit tree is built in a scratch index from HEAD;
  - the new real index is built from a copy;
  - `commit-tree`, a compare-and-swap `update-ref`, and the working-tree write
    with rename-aside plus `link()`;
  - the index is installed under the lock.

  Alongside it: the settle rule, idempotent `recoverInflight`,
  `probeRepository`, and the §4 helpers (`readTrail`, `setResult`,
  `editFrontmatter`, `ownerLine`, `commitSubject`). In `lib/workspace.mjs`,
  `git()` gained `input` and `timeout`, environment overrides are filtered, and
  `boardPolicy` returns `blockedLimit` with `staleHours` defaulting to 24.
- **A gap the worker found in the plan:** `update-index` runs a repository's
  clean filters on racily clean entries. Filter drivers are now blanked for
  every call made under the lock, and the test fails without that.
- **Independent review** (code-reviewer, opus):
  - **First verdict: REQUEST CHANGES.**
    - A symlinked `AA/tasks` let a claim write outside the repository; the
      reviewer reproduced it.
    - Two paths could leave a lock that nothing would remove.
    - The filter test could not fail.
    - Smaller items.

    All were fixed in 552956f.
  - **Second verdict: APPROVE.** Mutation checks showed the symlink, filter and
    replace-ref tests fail without their fixes. Four low findings remained,
    including a `TypeError` instead of `INTERRUPTED`; they were fixed in
    1de20b2.
  - **Owner's check:** the reviewer's repros now end `INTERRUPTED` and
    `UNSUPPORTED_REPO`, with nothing written outside the repository.
- **Every seam test** ends committed and consistent, or unchanged byte for
  byte. `INTERRUPTED` appears only on the paths the plan names.
- **Still read-only:** nothing in `server.mjs` or `lib/workspace.mjs` imports
  the engine, and the AGENTS.md rule is unchanged. T023 lifts it.
- **On `feature/pm-cockpit` at 1de20b2, with T022:**
  - `npm run check` passes;
  - `npm test` 445 of 445, including 62 tracked tests;
  - `npm run e2e` 19 of 19.
- **Spend:** `agent-fan-out`, six runs:
  - a worker (opus), cut off once by the usage limit and resumed from its
    trail;
  - two fix passes;
  - one review and two re-reviews (opus).

  Tests touched only temporary repositories. Nothing was pushed or migrated.
- **Run digest:**
  - 578f7ba9.85bd (worker): commits d44cd19, 8714afc and 6e97994, landed as
    f8bd795, 552956f and 1de20b2.
  - 578f7ba9.a2ca (reviewer): REQUEST CHANGES on d44cd19, then APPROVE on
    8714afc.
  - 578f7ba9: one misfiled `doing`, corrected.
- **Log:** `PROGRESS.md`, 2026-10-08 — T021.

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
