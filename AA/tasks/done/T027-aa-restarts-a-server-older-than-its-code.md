---
id: T027
title: "/aa restarts an AGE Aris server that is older than its code"
status: done
owner: adervark @v/b384188f 2026-10-08 — restart a stale server from aa.sh
# type: one word; tasks of one type are timed together; `bug` counts as defect work
type: bug
# blockedReason: while blocked, one line saying what unblocks it; cleared on unblock
blockedReason: ""
depends: []
created: 2026-10-08
---

# T027 — /aa restarts an AGE Aris server that is older than its code

## Goal

`/aa` never leaves the operator on a server whose code predates the checkout's `server.mjs` or `lib/`: it restarts it, and says so.

## Context

- 2026-10-08: the server started at 2026-10-07 13:52 kept serving after
  T021–T023 landed. `public/` is read per request, `server.mjs` and `lib/` once
  at start, so the new page met the old API: `POST /api/tasks/:id/actions`
  gave 404 and projects had no `actions`. To the operator, "Aris is not
  working". `aa.sh` starts the server only when nothing answers on the port.
- `skills/aa/aa.sh`; the installed copy is `~/.claude/skills/aa/` (a copy,
  not a link).

## Steps

- [x] In `aa.sh`, when AGE Aris answers, find the process listening on the port; if it is `node server.mjs` running from `$APP` and started before the newest change to `server.mjs` or `lib/*.mjs`, stop it and start it again as a fresh start does.
- [x] Anything it cannot determine (no `ss`, no `/proc`, another program, another checkout) leaves the server alone.
- [x] Sync the installed copy.

## Decision rules — fixed in advance

- No spend in `AA.yml` applies: no fan-out, no data migration, no push.
- It may stop only a process whose working directory is `$APP` and whose
  command is `node server.mjs`.
- Done means: with a fresh server, `/aa` leaves it running (same PID); after
  `touch lib/workspace.mjs`, `/aa` restarts it and the new one answers 200; and
  `npm test` and `npm run check` pass on the commit.

## Handoff — state at last stop

*Kept true while claimed, not written on the way out (rule 8).*

- **Last touched:** 2026-10-08, adervark @v/b384188f (done)
- **In flight:** nothing
- **On disk:** nothing
- **Resume with:** nothing
- **Next decision:** none

## Verify

Fresh server: `aa.sh` keeps its PID. After `touch lib/workspace.mjs`: `aa.sh` prints the restart, the PID changes, `/api/settings` answers 200.

## Result

**Done.** `aa.sh` finds the process listening on the port with `ss`. It
restarts that process only when it is `node server.mjs` running from `$APP` and
started (`ps -o etimes`) before the newest mtime of `server.mjs` or
`lib/*.mjs`, and it says so when it does. Anything it cannot tell leaves the
server alone. The installed copy in `~/.claude/skills/aa/` is synced; its
SKILL.md had also kept the old read-only line.

Against the decision rules:

- With a fresh server, `/aa` kept PID 1030703.
- After `touch lib/workspace.mjs`, `/aa` printed the restart. The new PID,
  1575909, runs from this checkout and `/api/settings` answers 200. A second
  run does not restart it again.
- `npm test` 473 of 473 and `npm run check` pass. No spend; no trail was opened.
- The process start time comes from `ps -o etimes`, not the mtime of
  `/proc/<pid>`, which procfs can set long after the process starts.
- Log: PROGRESS.md, 2026-10-08 — T027.

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
