---
id: T068
title: "Deprecate or archive a project, either kind, and restore it"
status: open
owner: —
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

- [ ] `project.json` gains an optional `lifecycle`: `{state, since, reason, successor}`. When absent, the project is active. The field is documented in README "Storage and behavior".
- [ ] `PATCH /api/projects/:id {version, lifecycle, confirm}` on both kinds. Deprecating or archiving first answers CONFIRM with what it means; restoring needs no confirmation.
- [ ] Refusals while deprecated or archived: task actions, new tasks, task edits, project edits other than `lifecycle` (code `PROJECT_INACTIVE`).
- [ ] Aggregates: Needs you and the cross-project rollups leave out deprecated and archived projects. Every view and aggregate leaves out archived ones, apart from the project's own read-only pages.
- [ ] Reads say it: `/api/projects`, orient and the capabilities manifest carry `lifecycle`, so an agent sees a project is deprecated and where its successor is.
- [ ] UI:
  - Deprecate, Archive and Restore in the project header, with the confirmation.
  - A badge, the reason and a successor link on a deprecated project.
  - The Archived section.
- [ ] Tests on temporary folders: both kinds, each transition, each refusal, the aggregates, restore bringing back the switch.

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

- **Last touched:** 2026-10-25, widened
- **In flight:** nothing
- **On disk:** nothing
- **Resume with:** the Steps above
- **Next decision:** none

## Result

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
