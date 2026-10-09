---
id: T047
title: "The sign-in page sends you to a terminal that /aa never opened"
status: open
owner: —
# type: one word; tasks of one type are timed together; `bug` counts as defect work
type: bug
# blockedReason: while blocked, one line saying what unblocks it; cleared on unblock
blockedReason: ""
depends: [T045]
created: 2026-10-09
---

# T047 — The sign-in page sends you to a terminal that /aa never opened

## Goal

A browser that lands on the sign-in banner is told a way in that exists
however AGE Aris was started.

## Context

- 2026-10-09: the banner (`public/app.js`, "Sign in to AGE Aris") says to open
  the link "printed in the terminal where AGE Aris is running (npm start)".
  When `/aa` started the server it runs detached, and that output goes to
  `~/.local/state/agearis/server.log`; there is no terminal to look in.
- Since T045, running `/aa` again prints a link that signs in.

## Steps

- [ ] The banner names `/aa` and the log, as well as `npm start`.

## Decision rules — fixed in advance

- No spend in `AA.yml` applies.
- Done means: the banner's text names a way in for a server started by `/aa`,
  and `npm test` and `npm run check` pass.

## Handoff — state at last stop

*Kept true while claimed, not written on the way out (rule 8).*

- **Last touched:** 2026-10-09, registered
- **In flight:** nothing
- **On disk:** nothing
- **Resume with:** the Steps above
- **Next decision:** none

## Verify

A fresh browser on `http://127.0.0.1:4310/` shows the banner with the new text.

## Result

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
