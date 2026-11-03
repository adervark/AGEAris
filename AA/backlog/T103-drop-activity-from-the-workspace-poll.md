---
id: T103
title: "Drop `activity` from `/api/workspace`, and read without the write lock"
status: open
owner: —
# type: one word; tasks of one type are timed together; `bug` counts as defect work
type: perf
# blockedReason: while blocked, one line saying what unblocks it; cleared on unblock
blockedReason: ""
depends: []
created: 2026-11-03
---

# T103 — Drop `activity` from `/api/workspace`, and read without the write lock

## Goal

`/api/workspace` no longer computes or sends `activity`, and its reads neither wait on the write mutex nor block the event loop on git.

## Context

- `Workspace._readUnlocked` runs a blocking `git log --max-count=200` per project to build `activity`. Nothing in `public/` reads it; the Activity page uses `/api/changes`.
- T054 measured 45,716 activity rows, 11.7 MB, 55% of `/api/workspace` on the 303-repository fixture (PROGRESS.md, 2026-11-01).
- `read`, `getTask` and `methodOf` queue behind `_serialize` and call `spawnSync` git through `_verifyProjectRepo`; `_verifyProjectRepoAsync` and `gitStream` exist.
- Found in an outside analysis, checked 2026-11-03. Do this before T061.

## Steps

- [ ] Confirm no API consumer reads `activity` (page, `/aa`, orient, capabilities); drop it.
- [ ] Make the read paths async and lock-free; keep writes serialized.
- [ ] Rerun `npm run perf` and log the payload and latency in PROGRESS.md.

## Decision rules — fixed in advance

- `data-migration`: tests write only to temporary repositories and folders.
- `push`: none.
- Done means `activity` is gone from the payload, `npm run perf` shows the drop against T054's baseline, and `npm test`, `npm run check` and `npm run e2e` pass.

## Handoff — state at last stop

*Kept true while claimed, not written on the way out (rule 8).*

- **Last touched:** 2026-11-03, adervark @b/cc5901e7 (registered, never claimed)
- **In flight:** nothing
- **On disk:** nothing yet
- **Resume with:** the Steps above
- **Next decision:** none

## Result

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*

- 2026-11-03, the agy (Gemini) review that proposed this task corrected
  itself: reads should not drop the lock entirely. `_updateTaskUnlocked`
  (`lib/workspace.mjs:1772-1776`) writes the moved file and awaits before
  removing the old one, in place, so a lock-free read can see both files or
  a half-written one. Use a readers-writer lock, and write own-project task
  files by temp file and rename. Four tests assert on `workspace.activity`:
  `tests/workspace.test.mjs:1171`, `tests/server.test.mjs:113`,
  `tests/perf/scale-fixture.mjs:232`, `tests/perf/scale.perf.mjs:170`.
