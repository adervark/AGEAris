---
id: T093
title: "Limits read each minute, the 5-hour window defined, /aa current"
status: done
owner: adervark @default/1f16c0d5 2026-10-22 — faster reads with back-off, 5-hour window, /aa installed
# type: one word; tasks of one type are timed together; `bug` counts as defect work
type: feature
# blockedReason: while blocked, one line saying what unblocks it; cleared on unblock
blockedReason: ""
depends: [T092]
created: 2026-10-22
---

# T093 — Limits read each minute, the 5-hour window defined, /aa current

## Goal

The limits are as near live as Anthropic allows, each account's 5-hour
window says when it began and ends, and the `/aa` the operator runs is this
repository's.

## Context

- The operator (2026-10-22), on T092's loose ends: "fix the loose ends", and
  "this gives me proper defined 5 hour limits I think".
- Readings were held 5 minutes, because the endpoint answered 429 to quick
  reads in a row. A 429 carries `retry-after`.
- `~/.claude/skills/aa` is a copy from 2026-10-09 without `limits`.

## Decision rules (written before the spend)

- Hold a reading 55 seconds, not 5 minutes (so a page asking every 30 seconds gets a fresh one each minute); a forced read 30 seconds. On a 429, read
  that account again only after its `retry-after` (5 minutes when it gives
  none), doubling on each 429 in a row up to 30 minutes; show the last good
  reading and when the next read is.
- AGE Aris names itself in the request; it does not pose as Claude Code to
  land in another rate-limit bucket.
- Spend: `global-config`, `~/.claude/skills/aa` replaced by the repository's
  `skills/aa`, on the operator's word above. The old copy is kept in the
  session scratchpad until the new one runs.

## Steps

- [x] `lib/limits.mjs`: 1-minute hold, 429 back-off with `retry-after`.
- [x] The 5-hour window: began, ends, time left, in the strip, the tab and
      `/aa limits`; "no window open" says one starts with the next message.
- [x] The page asks every 30 seconds.
- [x] Tests, README.
- [x] `/aa` installed from the repository; `/aa limits` runs.

## Result

- Readings are held 55 seconds, a forced read 30; the page asks every 30
  seconds, so each account is read fresh once a minute (`b5c61c0`). A 429 waits
  out its `retry-after` (5 minutes without one), doubling for each 429 in a
  row up to 30 minutes, and the account shows its last good reading and
  `nextReadAt`. Requests name AGE Aris (`User-Agent: agearis`); it does not
  pose as Claude Code for another rate-limit bucket.
- Each window carries `beganAt` beside `resetsAt`. The strip shows the 5-hour
  window's end and time left ("to 3:50 AM · 1h 58m"), the tab its span
  ("Window 10:50 PM–3:50 AM · resets in 1h 58m") and a week by date;
  `/aa limits` prints "27% · 2026-10-22 17:20Z – 22:20Z". With no window open
  it says the next message starts one.
- Live, 2026-10-22 20:14–20:22Z, two runs, 6 minutes in all: all four
  accounts read fresh each minute (20:19:37, 20:20:40, 20:21:40), no 429, no
  console errors, no sideways scroll wide or at 390 px.
- `~/.claude/skills/aa` replaced by the repository's `skills/aa`; `/aa
  limits` runs from it. The old copy is in the session scratchpad.
- `npm test` 554 of 554, `npm run check` clean. New test: the 429 back-off.

**Spend:** `global-config`, on the operator's word: `~/.claude/skills/aa`.

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
