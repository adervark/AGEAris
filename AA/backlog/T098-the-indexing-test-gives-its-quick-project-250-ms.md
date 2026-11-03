---
id: T098
title: "The indexing test gives its quick project 250 ms, which load can outlast"
status: open
owner: —
# type: one word; tasks of one type are timed together; `bug` counts as defect work
type: bug
# blockedReason: while blocked, one line saying what unblocks it; cleared on unblock
blockedReason: ""
depends: []
created: 2026-10-25
---

# T098 — The indexing test gives its quick project 250 ms, which load can outlast

## Goal

The test "a project still indexing does not hold up the brief or the rest of
the API" (`tests/server.test.mjs`) passes however loaded the machine is.

## Context

- Found by T053 on 2026-10-25, after T097. One default `npm test` failed it,
  574 of 575. The failing run overlapped a restart of AGE Aris, which then
  indexed every tracked project. The next run passed, 575 of 575.
- The test leaves `buildWaitMs` at the app's 250 ms.
  - Its Quick project must build within that time to read `ready`.
  - Its Slow project starts `git log` 2 s late.
  - Under load, Quick read `building` (`server.test.mjs:675`).
- A sixth test races the same way (T068, 2026-10-25): "the Flow charts draw
  what the metrics count" (`tests/sample.test.mjs:95`). Its Cockpit keeps the
  default 250 ms, and `projectMetrics` answered without `charts`. That was
  582 of 583, while a browser check's server was indexing beside it. It passed
  3 of 3 runs alone. It needs only the long wait, as T097 gave the others.
- T097 gave the tests that read a ready brief a 60 s wait. This test needs a
  wait at both ends: long enough for Quick to build, short enough that Slow is
  still building.

## Steps

- [ ] Give the test a wait that Quick's build cannot outlast, and a Slow
      delay well beyond it (for example 2 s and 10 s). Bound the brief's
      time by the delay, not by 1.5 s.
- [ ] Give `tests/sample.test.mjs:95`'s Cockpit `buildWaitMs: 60_000`.
- [ ] Run both tests ten times with a full `npm test` running beside them.

## Decision rules — fixed in advance

- No spend applies.
- Done means all three of these hold:
  - the test still fails when the brief waits for the slow ledger;
  - it passes ten runs under load;
  - the app's 250 ms default is unchanged.

## Handoff — state at last stop

*Kept true while claimed, not written on the way out (rule 8).*

- **Last touched:** 2026-10-25, registered by adervark @default/a29cee11
- **In flight:** nothing
- **On disk:** nothing
- **Resume with:** the Steps above
- **Next decision:** none

## Verify

`for i in $(seq 10); do node --test --test-name-pattern 'still indexing' tests/server.test.mjs || break; done`,
with `npm test` running in another shell.

## Result

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
