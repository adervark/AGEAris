---
id: T052
title: "The agent's brain: a design that orients any agent, on any repo, at team scale"
status: in_progress
owner: adervark @v/8cd02255 2026-10-10 — independent architect and critic review of docs/plans/agent-brain.md, then revise
# type: one word; tasks of one type are timed together; `bug` counts as defect work
type: design
# blockedReason: while blocked, one line saying what unblocks it; cleared on unblock
blockedReason: ""
depends: []
created: 2026-10-10
---

# T052 — The agent's brain: a design that orients any agent, on any repo, at team scale

## Goal

An approved design for making AGE Aris an agent's brain, in
`docs/plans/agent-brain.md`, ready to be split into build tasks. Orienting
comes first, at a scale of hundreds of repositories worked by a team.

## Context

- 2026-10-10, the operator: "More than anything Aris must be optimised for
  agent interaction", and "I want to make this the Aris an agent's brain". It
  is "flustering under scale". What they see: too much to read, and agents
  get lost.
- Interview answers: orient first; hundreds of repositories; a team; repo
  first, with the server adding to it.
- Measured that day: `/api/workspace` returns 316 KB for 3 repositories in
  90 ms. Cold ledger builds take 53–122 ms per repository, and ledgers are
  kept in memory only. The numbers are in §2 of the design.
- The same day, a plain AGE Aris project (an empty RSNA) could not be removed
  through any path, so its folder was removed by hand. P4 of the design covers
  that gap.

## Steps

- [x] Interview and draft v1 (`docs/plans/agent-brain.md`).
- [ ] Architect review of the v1 snapshot.
- [ ] Critic review of the same snapshot, independent of the Architect's.
- [ ] Revise to v2 with a changelog. The operator answers D1–D3.
- [ ] On approval, register P0–P5 as backlog tasks.

## Decision rules — fixed in advance

- Spend: `agent-fan-out`. That is two review subagents, one Architect and one
  Critic, run one after the other, and at most one more round of each if the
  Critic rejects. Nothing beyond that without asking the operator.
- No code changes, no pushes, no `data-migration`, no `global-config`.
- Done means: the Critic approves the design, or the operator accepts it with
  the open objections listed, and the operator has answered D1–D3.
- Killed if the operator changes direction. The draft stays in `done/` as a
  result.

## Handoff

- Now: v1 drafted, uncommitted until this claim. Next: the Architect review,
  then the Critic review, of v1 as committed with this claim.

## Notes

## Result
