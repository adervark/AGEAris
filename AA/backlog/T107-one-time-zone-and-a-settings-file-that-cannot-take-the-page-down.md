---
id: T107
title: "One time zone for dates, and a `settings.json` that cannot take the page down"
status: open
owner: —
# type: one word; tasks of one type are timed together; `bug` counts as defect work
type: bug
# blockedReason: while blocked, one line saying what unblocks it; cleared on unblock
blockedReason: ""
depends: []
created: 2026-11-03
---

# T107 — One time zone for dates, and a `settings.json` that cannot take the page down

## Goal

Today, overdue and due dates come from one time zone (`settings.timezone`) everywhere, and a bad `settings.json` falls back with a visible warning instead of a 500.

## Context

- `lib/workspace.mjs` takes today from `toISOString().slice(0, 10)` (UTC), while the metrics use `settings.timezone`. The browser side is not checked yet.
- A time zone that is not IANA makes `cleanSettings` `fail(500, …)`, so Home and Flow go down. `GET /api/settings` exists, with no way to change the file from the page.
- Found in an outside analysis, partly checked 2026-11-03.

## Steps

- [ ] Check the browser's dates.
- [ ] Use one zone throughout; fall back on a bad file and say so on the page.

## Decision rules — fixed in advance

- `data-migration`: tests write only to temporary repositories and folders.
- `push`: none.
- Done means a test at 23:30 outside UTC agrees between card and signal, a broken `settings.json` still serves Home with a warning, and the tests pass.

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
