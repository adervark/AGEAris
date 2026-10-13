---
id: T073
title: "Research runs, aggregated: one line of thought, in the operator's sight"
status: claimed
owner: adervark @v/b8438f28 2026-10-13 — design v1: research and simulation runs, aggregated
# type: one word; tasks of one type are timed together; `bug` counts as defect work
type: design
# blockedReason: while blocked, one line saying what unblocks it; cleared on unblock
blockedReason: ""
depends: []
created: 2026-10-13
---

# T073 — Research runs, aggregated: one line of thought, in the operator's sight

## Goal

An approved design for how agents run research, simulations and experiments,
and how their runs are aggregated into one structured line of thought the
operator can see: question → runs → claims with evidence → verdict → decision →
next question. It says where each piece lives, the contract agents write and
read, the checks AGE Aris makes, how a run is simulated before anything is
spent, and the phases, each one task.

## Context

- 2026-10-13, the operator: "devise a agent first research and simulation
  strategy for aggregatig research runs". While it was being drafted: "we mix up
  shit and keeping it away from my eyes without a properly structured line of
  thought brings terrible inefficiencies and lost alpha".
- The evidence is read from three repositories and changes nothing in them:
  RSNA's research rounds (its T038, T043, T047), its scattered artifacts (T093)
  and its instrument that could not see its arm (T118); AGEIS's hand-written
  research tracks (its T106).
- [`docs/plans/agent-brain.md`](../../docs/plans/agent-brain.md): the contract,
  corpus and two-door approach this design reuses.
- T072, the team-scale research, is the first research task it would apply to.

## Steps

- [x] Draft v1: [`docs/plans/research-runs.md`](../../docs/plans/research-runs.md).
- [ ] Review: one Architect, then one Critic, on the operator's go.
- [ ] The operator's decisions; v2.
- [ ] Register the phases as tasks.

## Decision rules — fixed in advance

- Spend: `agent-fan-out`, only on the operator's go. One Architect and one
  Critic review, one after the other, and at most one more round of each if
  the Critic rejects. Nothing beyond that without asking the operator.
- No code changes, no pushes, no `data-migration`, no `global-config`. Other
  repositories are read only. Nothing in RSNA is touched before its competition
  closes (entry deadline 2026-10-15, close 2026-10-22).
- Done means: the Critic approves, or the operator accepts the design with the
  open objections listed; the operator has answered its decisions; the phases
  are registered.
- Killed if the operator changes direction. The draft stays in `done/` as a
  result.

## Handoff — state at last stop

*Kept true while claimed, not written on the way out (rule 8).*

- **Last touched:** 2026-10-13, adervark @v/b8438f28: v1 committed; D1–D4 decided; review approved
- **In flight:** the review of v1, Architect first and then Critic, each a subagent run on this trail. The trail's newest `doing` says which.
- **On disk:** `docs/plans/research-runs.md` v1; review reports land in `docs/plans/reviews/` as they finish
- **Resume with:** `AA/ckpt.sh live T073`; if a review run stopped mid-act, check its report file first
- **Next decision:** none until both reviews are in; then v2 answers them

## Result

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*

- 2026-10-13: the operator decided D1–D4, each as recommended. The ledger and
  track pages go to every AA repository through `aa-init`. R0 runs now, by one
  session with no subagents, as T074. T072 waits for R1b. The review was
  approved to run.
