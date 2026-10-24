---
id: T057
title: "`Cockpit.orient` and `GET /api/orient`"
status: claimed
owner: adervark @default/906416cf 2026-10-24 — Cockpit.orient and the endpoint, test-first against the corpus
# type: one word; tasks of one type are timed together; `bug` counts as defect work
type: feature
# blockedReason: while blocked, one line saying what unblocks it; cleared on unblock
blockedReason: ""
depends: [T055]
created: 2026-10-10
---

# T057 — `Cockpit.orient` and `GET /api/orient`

## Goal

The server answers `aa.orient/1` for one tracked repository, `task=` included, and passes every corpus case.

## Context

- From T052, the agent's brain design: [`docs/plans/agent-brain.md`](../../docs/plans/agent-brain.md). §5.1–5.4, and option E: it extends `lib/brief.mjs` and reuses its key discipline (`:404-407`), `_policyOf` and `_liveTrails`.

## Steps

- [x] ~~Add the `depends` read and the `ready` test to the ledger, and bump
      `SCHEMA`.~~ Not taken: orient does not read the ledger (see Notes).
- [x] Add `Cockpit.orient`, the live overlay and the endpoint:
      `lib/orient.mjs`, `Cockpit.orient`, `GET /api/orient`.
- [x] Run the corpus: `tests/orient-server.test.mjs`, 82 of 82 byte for byte.

## Decision rules — fixed in advance

- No spend applies. The server reads; it writes nothing in a tracked repository.
- Done means: every corpus case passes, including server-only ones; `npm test` and `npm run check` pass.

## Handoff — state at last stop

*Kept true while claimed, not written on the way out (rule 8).*

- **Last touched:** 2026-10-24, built and committed; awaiting an independent review
- **In flight:** nothing
- **On disk:** `lib/orient.mjs`, `Cockpit.orient` and `_gatesOf` in
  `lib/brief.mjs`, `GET /api/orient` in `server.mjs`,
  `tests/orient-server.test.mjs` (the corpus, 82/82 byte for byte, and a
  structured-field fuzz), an endpoint test at the end of `tests/server.test.mjs`.
  `npm test` 557/557, `npm run check` clean.
- **Resume with:** the review's findings, then close
- **Next decision:** none

## Result

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*

- 2026-10-24, adervark: **orient is its own engine, not a ledger view.**
  ORIENT.md §12 lists where the ledger and `brief.mjs` drift from the
  contract: history read `--first-parent -m`, the layout from the working
  tree, `boardPolicy`'s parse, only WIP tasks' trails, a 64 KB trail window.
  Bending the ledger to the contract would change what every other page
  shows. So `lib/orient.mjs` reads git and the working tree as §2 says, on
  each call, and the ledger is untouched. What this costs: no cache yet. On
  this repository (95 tasks, ~1,000 commits) a call takes about 230 ms. P2a
  (T060) adds the cache, keyed as §2's inputs are.
