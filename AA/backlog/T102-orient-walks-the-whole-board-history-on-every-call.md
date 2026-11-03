---
id: T102
title: "Orient walks the whole board history on every call: 260 ms on 5,000 commits"
status: open
owner: —
# type: one word; tasks of one type are timed together; `bug` counts as defect work
type: perf
# blockedReason: while blocked, one line saying what unblocks it; cleared on unblock
blockedReason: ""
depends: []
created: 2026-11-01
---

# T102 — Orient walks the whole board history on every call: 260 ms on 5,000 commits

## Goal

`GET /api/orient` on one repository, warm, answers within §5.5's p95 of
150 ms on T054's 5,000-commit repositories, as it already does on the
200-commit ones.

## Context

- Found by T054 on 2026-11-01 (`tests/perf/scale.perf.mjs`, the scale
  fixture). Warm p95: 112 ms on `small-001` (about 200 commits), 260 ms on
  `large-1` (about 5,000). On the live data the same day, AGE Aris's own
  repository answered in 285 ms.
- `lib/orient.mjs` `history()` runs `git log --no-merges --name-only` over
  every commit that touched the board's task folders and trails, on each
  call. Its cost grows with history, and nothing caches it.
- `docs/plans/agent-brain.md` §5.1 already splits the answer into a
  committed part, keyed by content (`ledgerSha`, the board tree's oid, …)
  and cacheable, and a live overlay read on every call. Only the overlay
  needs reading each time.
- T060 (P2a) puts the committed part on disk for restarts. This task is the
  warm path: hold it in memory under the same key, so T060 can persist what
  this builds.

## Steps

- [ ] Profile one warm call on `large-1`: confirm `history()` is the time,
      and what else grows with commits.
- [ ] Memoize the committed part under §5.1's key; the live overlay is still
      read on every call.
- [ ] Remove the `todo` on the large repository's orient subtest in
      `tests/perf/scale.perf.mjs`.

## Decision rules — fixed in advance

- No spend applies.
- Done means:
  - the large repository's warm orient p95 is under 150 ms with
    `AGEARIS_PERF_STRICT=1`;
  - the 82 corpus cases still pass;
  - an edit to `AA.yml`, `STATE.md` or a trail changes the next answer, and a
    commit outside the board does not rebuild the committed part. Each has a
    test.

## Handoff — state at last stop

*Kept true while claimed, not written on the way out (rule 8).*

- **Last touched:** 2026-11-01, registered by adervark @b/9ba3e0ed
- **In flight:** nothing
- **On disk:** nothing
- **Resume with:** the Steps above
- **Next decision:** none

## Result

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
