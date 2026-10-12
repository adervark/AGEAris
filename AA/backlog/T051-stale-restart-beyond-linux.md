---
id: T051
title: "/aa restarts a server older than its code only on Linux"
status: open
owner: —
# type: one word; tasks of one type are timed together; `bug` counts as defect work
type: bug
# blockedReason: while blocked, one line saying what unblocks it; cleared on unblock
blockedReason: ""
depends: [T027, T050]
created: 2026-10-09
---

# T051 — /aa restarts a server older than its code only on Linux

## Goal

After an update, `/aa` restarts the AGE Aris it started on macOS and Windows
too, as it does on Linux, so the new page never meets the old server.

## Context

- 2026-10-09, the T050 review: `stale_pid` in `skills/aa/aa.sh` needs `ss` and
  `/proc`, which macOS and Windows lack, so it leaves the server alone there.
  After a plugin update the old server keeps serving the new page, the failure
  T027 fixed on Linux.
- macOS: `lsof -ti tcp:<port> -sTCP:LISTEN` gives the listener, `lsof -p <pid>
  -d cwd -Fn` its folder, `ps -o lstart=` its start time. Windows: `netstat
  -ano` and PowerShell's `Get-Process`.

## Steps

- [ ] Find the listener, its folder, command and start time on macOS and in Git Bash.
- [ ] Tests on stubbed tools; anything it cannot tell still leaves the server alone.

## Decision rules — fixed in advance

- No spend in `AA.yml` applies, apart from syncing the installed `/aa`
  (`global-config`, a trail entry first).
- Done means: with stubbed macOS and Git Bash tools, `/aa` restarts a stale
  server it started and leaves any other alone; Linux behaves as before;
  `npm test` and `npm run check` pass. It is not called tested on macOS or
  Windows until it has run there.

## Handoff — state at last stop

*Kept true while claimed, not written on the way out (rule 8).*

- **Last touched:** 2026-10-09, registered
- **In flight:** nothing
- **On disk:** nothing
- **Resume with:** the Steps above
- **Next decision:** none

## Verify

`node --test tests/aa-script.test.mjs`.

## Result

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
