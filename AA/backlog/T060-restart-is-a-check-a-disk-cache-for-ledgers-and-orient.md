---
id: T060
title: "Restart is a check: a disk cache for ledgers and orient"
status: open
owner: —
# type: one word; tasks of one type are timed together; `bug` counts as defect work
type: feature
# blockedReason: while blocked, one line saying what unblocks it; cleared on unblock
blockedReason: ""
depends: [T054, T057]
created: 2026-10-10
---

# T060 — Restart is a check: a disk cache for ledgers and orient

## Goal

After a restart, AGE Aris reads cached ledgers and committed parts and rebuilds only the repositories that moved.

## Context

- From T052, the agent's brain design: [`docs/plans/agent-brain.md`](../../docs/plans/agent-brain.md). §5.5: the cache path, temp file and rename, the newest two entries kept per project, and the key in §5.1.

## Steps

- [ ] Write the cache under `<data dir>/cache/<projectId>/`.
- [ ] Test the cache keys: an edit to `AA.yml`, `STATE.md` or a trail changes the answer, and an unrelated commit does not touch the committed part.

## Decision rules — fixed in advance

- `data-migration`: a new folder in `.agearis-data`, with a trail entry before it is first written on real data. Tests use temporary folders only.
- Done means: the §5.5 restart target is met on T054's fixture, and the cache-key tests pass.

## Handoff — state at last stop

*Kept true while claimed, not written on the way out (rule 8).*

- **Last touched:** 2026-10-10, registered
- **In flight:** nothing
- **On disk:** nothing
- **Resume with:** the Steps above
- **Next decision:** none

## Result

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
