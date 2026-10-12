---
id: T052
title: "The agent's brain: a design that orients any agent, on any repo, at team scale"
status: done
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
  through any path, so its folder was removed by hand. v2 moves that gap to its
  own task (§6 of the design).

## Steps

- [x] Interview and draft v1 (`docs/plans/agent-brain.md`).
- [x] Architect review of the v1 snapshot: sound, with required changes R1–R10.
- [x] Critic review of the same snapshot, independent of the Architect's: revise, B1–B9.
- [x] Revise to v2 with a changelog ("Changes since v1" in the design).
- [x] The operator answered D1–D4, each following the recommendation. Critic round 2 on v2.1: revise, six blocking issues, answered in v2.2. Critic round 3 on the diff: approve.
- [x] Registered T053–T068: the phases P0a–P6, plus the hub design, claims across machines, and archiving a plain project.

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

- Done. Nothing in flight. The next work is in the backlog: T053, T054,
  T055 and T063 can start at once. T055 must apply the design's §11.

## Notes

- 2026-10-10: both reviews found one root fault in v1. It modelled
  committed state, while AA keeps live state in uncommitted trail lines.
  v2's repo door became `board.sh --orient` (bash/jq) and its server door
  extends `lib/brief.mjs`. Both are held to one scenario corpus.
- The decision rules above say D1–D3. v2 added D4, the same-operator
  live-run case the Critic raised. The rules are left as written (rule 5).
  The operator answers D4 as well.

## Result

**Approved:** `docs/plans/agent-brain.md` v2.2.
- Agents orient through one ranked, budgeted answer, `aa.orient/1`. Each
  field states where it came from.
- It is served by `AA/board.sh --orient` in every AA repository, and by
  `Cockpit.orient` in AGE Aris. One scenario corpus binds both.
- It is built from a cached committed part and a live working-tree overlay.

**Reviews:**
- Architect: sound, with required changes R1–R10.
- Critic on v1: revise, B1–B9. The root fault was modelling only committed
  state, while AA keeps live state in uncommitted trail lines.
- Critic on v2.1: revise, six blocking issues: liveness undefined, run
  families, the WIP count, gates, the budget, and phase dependencies.
- Critic on the v2.2 diff: approve, with N1–N7 must-fix in P1a (§11).

**Decisions:** the operator decided D1–D4 on 2026-10-10, each as recommended.

**Cost:** 4 review subagents of the 4 budgeted.

**Registered:** T053–T068.

**Open for the operator:**
- An optional expected-end field on `doing`.
- `own-task-live-elsewhere`.

Both are carried in T055.

Trail digest:
- **8cd02255** (session @v/8cd02255): design approved (v2.2), 16 tasks
  registered T053-T068 · cost 4 review subagents of 4 · left: nothing in
  flight; P1a (T055) carries the §11 must-fix list
