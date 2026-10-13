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
- [x] The operator's decisions D1–D4; R0 run as T074.
- [x] Review, round 1: the Architect (sound, with required changes), then the
  Critic (revise). Both are in [`docs/plans/reviews/`](../../docs/plans/reviews/).
- [x] v2 answers the Architect and R0. v2.1 answers the Critic: its cheaper
  design is stage 1, and stage 2 waits on evidence.
- [ ] Review, round 2: the Critic on v2.1.
- [ ] The operator's decisions D5 and D6.
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

- **Last touched:** 2026-10-13, adervark @v/b8438f28: v2.1 committed, answering the Critic (B1–B6, N1–N7). Its §2 was checked against RSNA and AGEIS again, and five lines were corrected.
- **In flight:** nothing yet. The Critic's second round, on v2.1, is next; when it runs, the trail's newest `doing` names it.
- **On disk:** `docs/plans/research-runs.md` v2.1; `docs/plans/reviews/research-runs-v1-architect.md` and `research-runs-v1-critic.md`
- **Resume with:** `AA/ckpt.sh live T073`. When the second round is in, save it as `docs/plans/reviews/research-runs-v2.1-critic.md`. Then answer it, or put D5 and D6 to the operator.
- **Next decision:** the operator's: D5 (run T072 now, on a hand-written ledger) and D6 (stage 1 first), once the Critic has read v2.1

## Result

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*

- 2026-10-13: the operator decided D1–D4, each as recommended. The ledger and
  track pages go to every AA repository through `aa-init`. R0 runs now, by one
  session with no subagents, as T074. T072 waits for R1b. The review was
  approved to run.
- 2026-10-13, T074 (R0) done: partial, 1 of 3 defects caught by v1's checks.
  v2 must answer it:
  - a contradiction is keyed on a registered subject, not on a question;
  - a verdict's `where` names its reasoning section, and that section must
    exist and have a body;
  - `q` and `verdict` are required on every claim;
  - research independence is not orient's run family;
  - sources get the out-of-sight check.

  Details are in T074's Result and in PROGRESS.md.
