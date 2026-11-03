---
id: T096
title: "The ledger dates a merged branch's work by its merge: AGEIS's flow is wrong"
status: open
owner: —
# type: one word; tasks of one type are timed together; `bug` counts as defect work
type: bug
# blockedReason: while blocked, one line saying what unblocks it; cleared on unblock
blockedReason: ""
depends: []
created: 2026-10-25
---

# T096 — The ledger dates a merged branch's work by its merge: AGEIS's flow is wrong

## Goal

A tracked repository whose board work came in through merges shows each
claim and delivery when it was made, on the branch it was made on.

## Context

- Found by T053 on 2026-10-25. `buildLedger` (`lib/history.mjs`) walks
  first-parent history from HEAD. AGEIS did its board work on
  `deaddrop-migration` from 2026-09-04, merged it into `main` three times, and
  has had `main` checked out since 2026-10-22. `main`'s first-parent line
  holds none of that work.
- Measured on AGEIS at `4f793d1`: the ledger reads 70 commits. 106 cycles
  end, but 78 have no start, because a task claimed and finished on the branch
  goes from backlog to done in one merge. 69 deliveries fall on three merge
  days: 43 on 2026-10-13, 17 on 2026-10-01, 9 on 2026-10-22. So AGEIS's
  throughput, cycle time and forecast are wrong.
- `lib/lost.mjs` already walks the whole history from HEAD (`--full-history
  --parents --diff-merges=first-parent`, each commit replayed from its first
  parent) and finds 103 claims at their own commits.
- METRICS.md § Time defines ledger time as committer time clamped along
  first-parent history, so the fix changes a stated rule.

## Steps

- [ ] Choose the walk: the whole history, as lost.mjs walks it, or the parent
      that carries the board. Decide what clamped time means on that walk.
- [ ] Rebuild AGEIS's ledger and compare it with its `AA/tasks/done/` and with
      lost.mjs's claims.
- [ ] Update METRICS.md § Time and § Differences from board.sh.

## Decision rules — fixed in advance

- No spend applies. The ledger reads the tracked repositories and writes
  nothing in them.
- Done means: on AGEIS each delivered task's cycle starts at the commit that
  claimed it and ends at the one that delivered it, wherever that commit is;
  the ledgers of this repository and RSNA, which have no merges, are
  unchanged; `npm test` passes.

## Handoff — state at last stop

*Kept true while claimed, not written on the way out (rule 8).*

- **Last touched:** 2026-10-25, registered by adervark @default/a29cee11
- **In flight:** nothing
- **On disk:** nothing
- **Resume with:** the Steps above
- **Next decision:** the walk

## Verify

AGEIS's finishes per day match the dates of the commits that moved each task
to `done/`, and none is excluded for having no start unless it never entered
WIP.

## Result

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
