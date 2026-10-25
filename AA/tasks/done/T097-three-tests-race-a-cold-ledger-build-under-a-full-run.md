---
id: T097
title: "Three tests race a cold ledger build when the whole suite runs at once"
status: done
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

- [x] Give the tests that assert on a ready project a wait that load cannot
      outlast, as `server.test.mjs` does; find what the aa-script test waits
      on.
- [x] Run `npm test` five times at its default concurrency.

## Decision rules — fixed in advance

- No spend applies.
- Done means: five default `npm test` runs in a row pass; no test loses what
  it checks; the 250 ms default for the app is unchanged.

## Handoff — state at last stop

*Kept true while claimed, not written on the way out (rule 8).*

- **Last touched:** 2026-10-25, done
- **In flight:** nothing
- **On disk:** `buildWaitMs: 60_000` on the brief's Cockpit in
  `tests/brief.test.mjs`, `tests/sample.test.mjs` and
  `tests/cockpit-ui.test.mjs`; `token()` in `skills/aa/aa.sh`; the
  aa-script stub server starts 500 ms late.
- **Resume with:** nothing; delivered
- **Next decision:** none

## Verify

`for i in 1 2 3 4 5; do npm test || break; done` ends with five passes.

## Result

- Four tests failed only under a full default `npm test`, with all 24 files
  running at once, and on clean `1afc8e4` as well. Which ones failed changed
  from run to run.
- Three read a brief. A brief gives a cold ledger build 250 ms, then answers
  `building`. The three: the projects in `brief.test.mjs`, the sample
  project, and the cockpit views. Their Cockpits now wait 60 s, as
  `server.test.mjs`'s already did. The app's 250 ms is unchanged.
- The fourth, in `aa-script.test.mjs`, was a race in `/aa` itself.
  - While the server moved `~/.agesight-data` to `~/.agearis-data`,
    `start()` read the token from the new folder, so the polls before the
    move went out without it.
  - `token()` now reads the old path first. The move is a rename, then a
    link, so between them the token is at one path or the other at every
    moment.
  - The test's stand-in server now starts 500 ms late, as under load. The
    old `token()` fails the test every time; the new one passes it.
- Five default `npm test` runs in a row passed 572 of 572 each, on the
  working tree with T053's changes in it. The committed tree alone passes
  565 of 565. `npm run check` is clean.
- Not changed: the installed copy at `~/.claude/skills/aa/aa.sh`, which is
  now behind the repository's. Updating it is `global-config`, and T004
  decides copy or link. Its unsigned polls reach no server, because AGE Aris
  moves the folder before it listens.

**Spend:** none.

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
