---
id: T006
title: "A stray AA/tasks/ folder switches a project's board"
status: claimed
owner: adervark @k/ff713831 2026-10-07 — making findBoard prefer a real board
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

- [ ] Failing tests for inputs (a), (b) and (c).
- [ ] `findBoard` prefers a folder that is a board: a `STATE.md`, a settings
  file, or a task file.
- [ ] A test that a completed `deaddrop/` → `AA/` move is still followed.

## Decision rules — fixed in advance

- Pass: (a), (b) and (c) read and write exactly as before e64f823, a
  finished move is followed, and `npm test` passes.
- No spend.

## Handoff — state at last stop

*Kept true while claimed, not written on the way out (rule 8).*

- **Last touched:** 2026-10-07, adervark @k/ff713831
- **In flight:** the fix, in this session
- **On disk:** nothing yet
- **Resume with:** write the failing tests first
- **Next decision:** none

## Verify

`npm test`; the three inputs above.

## Result

*(on completion: the outcome against the decision rules above, a pointer to the
entry in the log, and the digest from `AA/ckpt.sh close T006` — then
retire the trail with `--delete`)*

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
