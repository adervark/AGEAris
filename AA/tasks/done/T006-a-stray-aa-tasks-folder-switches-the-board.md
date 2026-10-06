---
id: T006
title: "A stray AA/tasks/ folder switches a project's board"
status: done
owner: adervark @v/2e8b687e 2026-10-07 — findBoard prefers a board in use (was: adervark @k/ff713831 2026-10-07)
# type: one word; tasks of one type are timed together; `bug` counts as defect work
type: bug
# blockedReason: while blocked, one line saying what unblocks it; cleared on unblock
blockedReason: ""
depends: []
created: 2026-10-07
---

# T006 — A stray AA/tasks/ folder switches a project's board

## Goal

An `AA/` folder that is not yet a board (empty, or with no `STATE.md`,
settings file or task file) never outranks a working `deaddrop/` or `pm/` board.
A finished move, where the old folder is gone, is still followed.

## Context

- Severity medium, a regression from e64f823: found by T001's review (finding 1).
- `findBoard` (`lib/workspace.mjs:424`) returns the first of `AA`, `deaddrop`,
  `pm` that holds a real `tasks/` folder, empty or not. It is used for own
  projects (`:655`), tracked repositories (`:662`) and linking (`:980`); a new
  task's id comes from the found board (`:1067`).
- Input (a): an own project made before the rename (board in `deaddrop/`),
  then `mkdir -p AA/tasks`. Actual: `read()` throws `ENOENT … AA/backlog`, which
  is the whole workspace read, so no project loads; `createTask` fails the same
  way. Reproduced 2026-10-07.
- Input (b): the same with `AA/backlog` and `AA/tasks/done` too. Actual: the
  project's `deaddrop/` tasks vanish from the board, and `createTask` commits
  `AA/backlog/T003-….md` and a new `AA/STATE.md` although T003 already exists
  under `deaddrop/`.
- Input (c): a tracked `deaddrop/` repository plus an empty, untracked
  `AA/tasks/`. Actual: an empty board, WIP limit 0 and `stale_hours` 24
  instead of the settings file's values, and a Method view naming `AA/AA.yml`,
  while the brief still counts the `deaddrop/` tasks.

## Steps

- [x] Failing tests for inputs (a), (b) and (c).
- [x] `findBoard` prefers a folder that is a board: a `STATE.md`, a settings
  file, or a task file.
- [x] A test that a completed `deaddrop/` → `AA/` move is still followed.

## Decision rules — fixed in advance

- Pass: (a), (b) and (c) read and write exactly as before e64f823, a
  finished move is followed, and `npm test` passes.
- No spend.

## Handoff — state at last stop

*Kept true while claimed, not written on the way out (rule 8).*

- **Last touched:** 2026-10-07, adervark @v/2e8b687e
- **In flight:** nothing; done
- **On disk:** committed with this task's move to `done/`
- **Resume with:** nothing to resume
- **Next decision:** none

## Verify

`npm test`; the three inputs above.

## Result

Pass, against the decision rules.

- `findBoard` (`lib/workspace.mjs`) takes the first of `AA/`, `deaddrop/` and
  `pm/` that is in use: it has a real `STATE.md`, its settings file, or a task
  file in `tasks/`, `backlog/` or `tasks/done/`. A bare `tasks/` folder is taken
  only when no folder is in use, so a repository with nothing else reads as
  before.
- (a) and (b): an own `deaddrop/` project with a stray `AA/tasks/` (and,
  for (b), `AA/backlog/` and `AA/tasks/done/`) reads its tasks, numbers the
  next one T002, writes it to `deaddrop/backlog/`, and commits nothing under
  `AA/`. Before the fix, (a) threw `ENOENT … AA/backlog`.
- (c): a tracked `deaddrop/` board with an empty, untracked `AA/tasks/`, made
  before or after linking, keeps board `deaddrop`, WIP limit 4,
  `stale_hours` 12, its 8 tasks and `deaddrop/deaddrop.yml` in the Method
  view. Before the fix: `AA`, 0, and the defaults.
- A committed `git mv deaddrop AA` is followed: board `AA`, the same 8 tasks,
  `AA/AA.yml`.
- `npm test`: 369 of 369 pass; `npm run check` passes. No spend, so no trail;
  no independent review was run.
- Log: `PROGRESS.md`, 2026-10-07 — T005 and T006.

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
