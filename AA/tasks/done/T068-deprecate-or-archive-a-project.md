---
id: T068
title: "Deprecate or archive a project, either kind, and restore it"
status: done
owner: adervark @k/6bab66ff 2026-10-25 — lifecycle in project.json, PATCH with confirmation, refusals, aggregates, UI
# type: one word; tasks of one type are timed together; `bug` counts as defect work
type: feature
# blockedReason: while blocked, one line saying what unblocks it; cleared on unblock
blockedReason: ""
depends: []
created: 2026-10-10
---

# T068 — Deprecate or archive a project, either kind, and restore it

## Goal

Any project, a tracked repository or a plain AGE Aris project, can be marked
deprecated or archived, and made active again. This works through the UI, the
API and an agent, with the confirmation pattern task actions already use.
Nothing is deleted, and a tracked repository is never touched.

## Context

- From T052, the agent's brain design: [`docs/plans/agent-brain.md`](../../docs/plans/agent-brain.md) §6. On 2026-10-10 a plain RSNA project could not be removed through any path, so its folder was removed by hand, with a backup kept.
- Widened 2026-10-25 at the operator's request: two levels, on both kinds of project (the operator's choice of the options offered).
  - **Deprecated:**
    - Still listed, with a badge, an optional reason and an optional successor project.
    - Out of Home's Needs you and the cross-project rollups.
    - Task actions and task writes refused. Still readable.
  - **Archived:**
    - In an Archived section of the Projects list, collapsed.
    - Read-only, and out of every aggregate.
  - **Restore** makes the project active again. A tracked repository's task-actions switch comes back as it was.
- The state lives in AGE Aris's own `project.json`: the data folder's for a tracked repository, the project's own git for a plain one. It is never written to the tracked repository (CLAUDE.md, hard constraints).
- *Stop tracking* (`DELETE /api/projects/:id`) stays as it is: a separate act that deletes AGE Aris's record only.

## Steps

- [x] `project.json` gains an optional `lifecycle`: `{state, since, reason, successor}`. When absent, the project is active. The field is documented in README "Storage and behavior".
- [x] `PATCH /api/projects/:id {version, lifecycle, confirm}` on both kinds. Deprecating or archiving first answers CONFIRM with what it means; restoring needs no confirmation.
- [x] Refusals while deprecated or archived: task actions, new tasks, task edits, project edits other than `lifecycle` (code `PROJECT_INACTIVE`).
- [x] Aggregates: Needs you and the cross-project rollups leave out deprecated and archived projects. Every view and aggregate leaves out archived ones, apart from the project's own read-only pages.
- [x] Reads say it: `/api/workspace`, `/api/brief` and the capabilities manifest carry `lifecycle`, so an agent sees a project is deprecated and where its successor is. (Changed 2026-10-25, before the work: orient is left alone. Its `aa.orient/1` contract is the repository's, shared with the `board.sh` door (T056, T059), and a project field does not belong in it.)
- [x] UI:
  - Deprecate, Archive and Restore in the project header, with the confirmation.
  - A badge, the reason and a successor link on a deprecated project.
  - The Archived section.
- [x] Tests on temporary folders: both kinds, each transition, each refusal, the aggregates, restore bringing back the switch.

## Decision rules — fixed in advance

- Writing it spends nothing. Tests act only on temporary folders and temporary repositories. Old `project.json` files are read unchanged, and no stored file is rewritten, so it is not a `data-migration`. Marking a real project is the operator's act in the UI.
- Done means:
  - All three states and every transition work on both kinds.
  - Nothing is deleted, and no file in a tracked repository changes.
  - `npm test` and `npm run check` pass.
  - The UI is seen working in a browser, screenshots under `docs/plans/evidence/t068/`.
- One Opus review pass, `agent-fan-out`, opened on T068's trail with a `doing` line first. A finding counts only with a concrete input that goes wrong.

## Handoff — state at last stop

*Kept true while claimed, not written on the way out (rule 8).*

- **Last touched:** 2026-10-25, done
- **In flight:** nothing
- **On disk:** `7a46df8` and `2198cfd`; `tests/lifecycle.test.mjs`, `tests/e2e/lifecycle.e2e.mjs`; screenshots in `docs/plans/evidence/t068/`.
- **Resume with:** nothing; delivered
- **Next decision:** none

## Result

- Any project, tracked or AGE Aris's own, can be deprecated, archived and
  restored: from its header, the Projects page's Archived list,
  `PATCH /api/projects/:id {version, lifecycle}`, and the capabilities
  manifest (`project-lifecycle`).
  - The state is `lifecycle` in AGE Aris's `project.json`. For a tracked
    repository that is the data folder's copy; the repository was checked
    unchanged, byte for byte.
  - An AGE Aris project's change is one commit. Nothing is deleted.
- Deprecating or archiving asks for a confirmation of what it means. The
  token covers the state, reason and successor. Restoring takes one click.
- While inactive, the project refuses every write with `PROJECT_INACTIVE`:
  task actions, new tasks, task edits, project edits, pipeline saves and new
  runs. Its reads still answer. A project with a run going cannot be made
  inactive (`RUNS_ACTIVE`).
- Deprecated: listed and badged, and out of Needs you, Decisions, the delta
  and Activity across projects. Archived: out of all of those, and the
  sidebar, All tasks and Working too.
- Orient is left alone (Steps, changed before the work): its contract is the
  repository's.
- One Opus review (run `6bab66ff.89e4`) found 7, 1 medium: a run going on an
  archived project kept taking decisions. All 7 are fixed in `2198cfd`, each
  with a test. Not reviewed again: the decision rule allows one pass.
- Of 33 single-guard mutants, every one fails a test. The 5 in `app.js`
  fail only `npm run e2e`'s `lifecycle.e2e.mjs`, which `npm test` does not
  run.
- `npm test` 587 of 587 (one earlier run failed 2, both T098's cold-build
  races); `npm run check` clean; `lifecycle.e2e.mjs` 3 of 3.
- Found on the way:
  - T098 widened: a sixth test, in `sample.test.mjs`, races the cold build.
  - T100 registered: `task-actions.e2e.mjs` fails 9 of 24, before T068 as
    after.
- Run digest:
  - **6bab66ff.89e4** (reviewer @k/6bab66ff): nothing in the repository ·
    about 40 min, one Opus pass. Left unchecked: the agent-pull attempt API
    on an archived project's run, the Agents page, and re-creating the
    sample while it is archived.

**Spend:** `agent-fan-out`, one Opus review pass on `k`, about 40 min.

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
