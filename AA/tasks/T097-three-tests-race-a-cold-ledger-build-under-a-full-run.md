---
id: T097
title: "Three tests race a cold ledger build when the whole suite runs at once"
status: claimed
owner: adervark @default/a29cee11 2026-10-25 — the tests that race a cold build wait as server.test.mjs does; then five default npm test runs
# type: one word; tasks of one type are timed together; `bug` counts as defect work
type: bug
# blockedReason: while blocked, one line saying what unblocks it; cleared on unblock
blockedReason: ""
depends: []
created: 2026-10-25
---

# T097 — Three tests race a cold ledger build when the whole suite runs at once

## Goal

`npm test` passes at its default concurrency, every time.

## Context

- Found by T053 on 2026-10-25. `npm test` failed 3 of 565 on a clean export
  of `1afc8e4`, twice on the working tree, and passed 572 of 572 with
  `node --test --test-concurrency=4`. Each failing file passes run alone.
- Which three varies between runs, from: `tests/aa-script.test.mjs` "the old
  ~/.agesight-data is read until AGE Aris starts…" (no request carried the
  token); `tests/brief.test.mjs` "an idle project and a new one read grey…"
  (`health` is null); `tests/sample.test.mjs` "the sample project is a fixed,
  simulated history…" (state `building`, not `ready`);
  `tests/cockpit-ui.test.mjs` "the cockpit views render the sample
  project…".
- `Cockpit` waits `buildWaitMs`, 250 ms by default (`lib/brief.mjs`), for a
  cold ledger build, then answers `building`. With all files running at once,
  a cold build takes longer. `tests/server.test.mjs` passes
  `buildWaitMs: 60_000` for this; the brief and sample tests do not.

## Steps

- [ ] Give the tests that assert on a ready project a wait that load cannot
      outlast, as `server.test.mjs` does; find what the aa-script test waits
      on.
- [ ] Run `npm test` five times at its default concurrency.

## Decision rules — fixed in advance

- No spend applies.
- Done means: five default `npm test` runs in a row pass; no test loses what
  it checks; the 250 ms default for the app is unchanged.

## Handoff — state at last stop

*Kept true while claimed, not written on the way out (rule 8).*

- **Last touched:** 2026-10-25, claimed by adervark @default/a29cee11
- **In flight:** nothing
- **On disk:** nothing
- **Resume with:** the Steps above. T053's commit waits on this: its default `npm test` fails only these flakes.
- **Next decision:** none

## Verify

`for i in 1 2 3 4 5; do npm test || break; done` ends with five passes.

## Result

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
