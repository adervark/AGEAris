---
id: T071
title: "AGE Aris reads a run as running or closed, as ckpt.sh does"
status: open
owner: —
# type: one word; tasks of one type are timed together; `bug` counts as defect work
type: feature
# blockedReason: while blocked, one line saying what unblocks it; cleared on unblock
blockedReason: ""
depends: [T070]
created: 2026-10-11
---

# T071 — AGE Aris reads a run as running or closed, as ckpt.sh does

## Goal

The server decides running or closed by the same four rules as
`ckpt.sh live`. A task action refuses on a running run, not on any run that
wrote within `stale_hours`. The Working page, the drawer and the Method view
say running or closed, and why.

## Context

- T070 (2026-10-11) put the decision in `AA/checkpoints/_SCHEMA.md`
  ("Running or closed") and in `ckpt.sh`, at the operator's request: a clear
  decision with a failsafe. The server still counts a run as live when it has
  not ended and wrote within `stale_hours` (`readTrail`,
  `lib/tracked.mjs:451`). README's list of refusals says the same.
- One meaning, one home. T057 (`Cockpit.orient`) needs the same function, so
  it is written once in `lib/` and shared.
- Metric 30, stale claims (`lib/metrics.mjs:148`), is to count a running run
  as a sign of life (design v2.4).

## Steps

- [ ] A run-state function in `lib/` with the four rules and an injectable
      process view (the boot id, and `ps`).
- [ ] Task actions: the refusal on a live run uses it, and names the run, the
      evidence and the line that reaps it.
- [ ] The Working page and the drawer show running or closed and why. The
      Method view adds `live_minutes`.
- [ ] README's refusals, `docs/METRICS.md`'s stale claims, and metric 30
      follow.
- [ ] Tests: every case in `tests/fixtures/board/ckpt-process.sh`, read by the
      Node function, gives what `ckpt.sh` gives.

## Decision rules — fixed in advance

- No spend applies. Tests act only on temporary repositories.
- Done means:
  - the Node reader and `ckpt.sh` give the same state and evidence on every
    case of `ckpt-process.sh`;
  - a task action refuses on a running run and allows a closed one;
  - `npm test`, `npm run check` and the e2e pass.

## Handoff — state at last stop

*Kept true while claimed, not written on the way out (rule 8).*

- **Last touched:** 2026-10-11, registered
- **In flight:** nothing
- **On disk:** nothing
- **Resume with:** the Steps above
- **Next decision:** none

## Result

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
