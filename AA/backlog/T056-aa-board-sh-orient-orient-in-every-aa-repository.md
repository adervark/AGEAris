---
id: T056
title: "`AA/board.sh --orient`: orient in every AA repository"
status: open
owner: —
# type: one word; tasks of one type are timed together; `bug` counts as defect work
type: feature
# blockedReason: while blocked, one line saying what unblocks it; cleared on unblock
blockedReason: ""
depends: [T055, T004]
created: 2026-10-10
---

# T056 — `AA/board.sh --orient`: orient in every AA repository

## Goal

`AA/board.sh --orient` passes every corpus case not marked server-only, here and in the `aa-init` template, and `/aa orient` prints it.

## Context

- From T052, the agent's brain design: [`docs/plans/agent-brain.md`](../../docs/plans/agent-brain.md). §5.4 and D1 (the repo door is bash and jq). Also §11: align `board.sh:331`'s IN PROGRESS header with `:257` and `:350`. Add `live_minutes` to the template's `AA.yml`.

## Steps

- [ ] Implement `--orient`, `--json`, `--budget`, `--run`, `--task` and `--remote` in `AA/board.sh` and the template.
- [ ] Add `live_minutes` to `AA.yml` here and in the template.
- [ ] Wire `/aa orient` in `skills/aa`.

## Decision rules — fixed in advance

- Syncing the installed plugin or the `aa-init` template under `~/.claude` is `global-config`: a trail entry first. Rolling it out to other repositories is their own sessions' work.
- Done means: every shared corpus case passes; `npm test` and `npm run check` pass; the board's existing output is unchanged apart from the aligned header.

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
