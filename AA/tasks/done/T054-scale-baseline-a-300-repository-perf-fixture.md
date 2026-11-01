---
id: T054
title: "Scale baseline: a 300-repository perf fixture"
status: done
owner: adervark @b/9ba3e0ed 2026-11-01 — the 300-repository fixture and today's numbers against §5.5
# type: one word; tasks of one type are timed together; `bug` counts as defect work
type: measure
# blockedReason: while blocked, one line saying what unblocks it; cleared on unblock
blockedReason: ""
depends: []
created: 2026-10-10
---

# T054 — Scale baseline: a 300-repository perf fixture

## Goal

`npm run perf` covers 300 repositories, and today's misses against the §5.5 targets are measured, not guessed.

## Context

- From T052, the agent's brain design: [`docs/plans/agent-brain.md`](../../docs/plans/agent-brain.md). §5.5 (the targets and the fixture) and §9 P0b. Also check that the 316 KB `/api/workspace` payload is delivered history, not WIP (`WHY.md`, Scale).

## Steps

- [x] Build the fixture with `lib/fabricate.mjs`: 300 repositories of about 200 commits, plus 3 of 5,000. Build it once, into a cache outside the repository, in under 5 minutes.
- [x] Extend `tests/perf/` with the §5.5 targets as budgets.
- [x] Record today's numbers and misses in PROGRESS.md.

## Decision rules — fixed in advance

- No spend applies. The fixture lives outside the repository and outside `.agearis-data`.
- Done means: `npm run perf` runs the 300-repository case, today's numbers are recorded, and the split of the payload into history and WIP is stated.

## Handoff — state at last stop

*Kept true while claimed, not written on the way out (rule 8).*

- **Last touched:** 2026-11-01, adervark @b/9ba3e0ed, delivered
- **In flight:** nothing
- **On disk:** everything is committed (`3ce977d`)
- **Resume with:** nothing; each miss belongs to the task its `todo` names
- **Next decision:** none

## Result

- **Done.** `npm run perf` runs the 300-repository case:
  `tests/perf/scale.perf.mjs` on `tests/perf/scale-fixture.mjs`'s 303
  repositories (76,396 commits, built in 8.3 s into `~/.cache/agearis/perf/`).
  Today's numbers are in PROGRESS.md, 2026-11-01, over three runs and a
  fifth after the last edits.
- **Met:** one-repo orient on 200 commits, p95 74–112 ms, and every answer
  within its budget (the largest is 1,424 B of 8,192).
- **Missed.** Each is a `todo` naming its owner, so the suite stays green and
  the miss stays in sight:
  - orient on 5,000 commits, 203–260 ms: T102, registered here;
  - the restart: 8.5–10.3 s cold, with no cache to warm (T060);
  - `/api/workspace`, 20.7 MB (T061);
  - Home at 1.29 MB, memory at 597–669 MB, and `all=1` not built (T062);
  - `board.sh --orient` is not built, so it is skipped (T056).
- **The payload is history:** 92% on the fixture and 80% on the live data
  (462 KB); WIP is 2.3% and 7%. Of the brief's 1.2 MB, the per-project lines
  are 1 MB and Needs-you 212 KB, noted on T062.
- Not reviewed by a second agent. No spend was budgeted for a review.
- Run 9ba3e0ed (session @b/9ba3e0ed): the fixture and the targets committed
  (3ce977d), the baseline in PROGRESS.md, T102 registered · cost none ·
  left: nothing.

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
