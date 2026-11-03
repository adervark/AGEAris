---
id: T104
title: "A cheap change check, or a push, instead of re-reading the workspace every 10 s"
status: open
owner: —
# type: one word; tasks of one type are timed together; `bug` counts as defect work
type: perf
# blockedReason: while blocked, one line saying what unblocks it; cleared on unblock
blockedReason: ""
depends: []
created: 2026-11-03
---

# T104 — A cheap change check, or a push, instead of re-reading the workspace every 10 s

## Goal

An idle tab costs next to nothing, and a commit made outside AGE Aris (board.sh, ckpt.sh, an agent's claim) shows sooner.

## Context

- `public/app.js` polls `/api/workspace` every 10 s (3 s on a live run), stringifies it to compare, and replaces `#main` on any change.
- `fingerprint` in `lib/history.mjs` already detects moved refs without running git.
- Found in an outside analysis, checked 2026-11-03.

## Steps

- [ ] Choose an ETag or `/api/pulse` from the fingerprint, or server-sent events, and write the choice here first.
- [ ] Implement it; keep a slow fallback poll.

## Decision rules — fixed in advance

- `data-migration`: tests write only to temporary repositories and folders.
- `push`: none.
- Done means an idle tab fetches no workspace payload while nothing changes, an outside commit shows within the stated time, and the tests pass.

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
