---
id: T057
title: "`Cockpit.orient` and `GET /api/orient`"
status: done
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

- **Last touched:** 2026-10-24, done
- **In flight:** nothing
- **On disk:** `lib/orient.mjs`, `Cockpit.orient` and `_gatesOf` in
  `lib/brief.mjs`, `GET /api/orient` in `server.mjs`,
  `tests/orient-server.test.mjs` (the corpus, 82/82 byte for byte, and a
  structured-field fuzz), an endpoint test at the end of `tests/server.test.mjs`.
  `npm test` 565/565, `npm run check` clean.
- **Resume with:** nothing; delivered
- **Next decision:** none

## Result

- `GET /api/orient` answers `aa.orient/1` for a tracked repository through
  `Cockpit.orient` and `lib/orient.mjs` (`038ce53`, `c0cd455`, `8ea3b9a`,
  and the close). Every corpus case, the server-only `gate-waiting`
  included, matches byte for byte: 82 of 82 (`tests/orient-server.test.mjs`).
  The runner was shown to fail when a rule is broken.
- Beyond the corpus: a fuzz test (no repository text reaches a structured
  field), an endpoint test (answers, 400s, 404, 401, and the repository's
  HEAD, status and log unchanged), and one test per review finding that
  failed on the first cut.
- On this repository: `continue T057`, `state-stale` and `claim-unpushed`,
  all true; about 215 ms a call, uncached (T060 adds the cache).
- Review (opus), three passes: 13 findings, then 3 more from the fixes, all
  fixed with tests except (10), left to T059 with both doors in hand.
  Approved on the third pass. Two low leftovers, not fixed: a ref file
  holding garbage reads as an unborn branch (needs a corrupted ref); the
  per-pid `ps` retry is now one at a time.
- `npm test` 565 of 565, `npm run check` clean.

**Spend:** none.

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
- 2026-10-24, adervark: **the review (opus), and what changed.** 13
  findings; fixed: (1) the process view cached `ps` for the server's life, so
  an ended process stayed running: it now asks afresh each call, with one
  `ps` for every pid; (2) a failing `git log` or `ls-tree` read as an empty
  history or board, so a live claim read as expired: those reads now fail
  with a 500; (3) history was split on `\x1e`/`\x1f`, which a subject can
  hold, so a sweep could forge a sign of life: fields are now NUL-separated;
  (4) `remote=1` ran the repository's configured upload-pack, ssh command,
  credential helper or askpass: each is replaced; (5) `Cockpit.orient` now
  checks the project's own repository, as the ledger does; (6) a trail over
  1 MiB was read whole: it is now counted in chunks and its last MiB read;
  (7) every read of HEAD uses the one commit resolved first; (8)
  `--literal-pathspecs`; (9) an empty input is a 400; (11) run ids are
  checked by a scan; (12) `_gatesOf` skips a bad time, and files open with
  `O_NOFOLLOW`; (13) runs, signs of life and dependents are indexed once.
  Each of 1, 2, 3, 4 and 9 has a test in `tests/orient-server.test.mjs`
  that fails on the first cut. Not changed: (10) a line that closes one
  placeholder and opens another reads as the awk reads it, which ORIENT.md
  §3.1's wording does not quite say; the wording or a corpus case is P1e's
  (T059) to settle, with both doors in hand.
- 2026-10-24, adervark: **the re-check.** 1, 3, 5–9, 11–13 fixed; 10 left
  for T059 as agreed. Three more, fixed with a test each: the batched `ps`
  let one pid no process can have (`99999999999`, in any trail) make every
  process-decided run read as closed, so pids above 4194304 never reach
  `ps`, and a `ps` that complains is asked again one pid at a time; a HEAD
  naming a missing commit read as an unborn branch and an empty board, and
  is now a 500; `core.gitProxy`, multi-valued and not clearable from the
  command line, still ran for `git://`, which `remote=1` no longer allows.

