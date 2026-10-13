---
id: T073
title: "Research runs, aggregated: one line of thought, in the operator's sight"
status: done
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
- [`docs/plans/agent-brain.md`](../../../docs/plans/agent-brain.md): the contract,
  corpus and two-door approach this design reuses.
- T072, the team-scale research, is the first research task it would apply to.

## Steps

- [x] Draft v1: [`docs/plans/research-runs.md`](../../../docs/plans/research-runs.md).
- [x] The operator's decisions D1–D4; R0 run as T074.
- [x] Review, round 1: the Architect (sound, with required changes), then the
  Critic (revise). Both are in [`docs/plans/reviews/`](../../../docs/plans/reviews/).
- [x] v2 answers the Architect and R0. v2.1 answers the Critic: its cheaper
  design is stage 1, and stage 2 waits on evidence.
- [x] The operator's decisions D5 and D6; D6 amended: conflicts and redundancy in stage 1.
- [x] v2.2: facts keyed by object, one row per key, seven checks for conflict and redundancy.
- [x] Review, round 2: the Critic on v2.2: REVISE, report partial (parts 2–3 never delivered).
- [x] v2.3 answers it: premises for inferences, pinned citations, searches for negatives, a separate reconciler, rulings after the run ends.
- [x] Review, round 3 (approved by the operator): the Critic on v2.3: REVISE, complete.
- [x] v2.4 answers it: untracked sources by hash, `unsourced` marks, refs required, R0b graded on every correction, S0 plants the uncatchable, costs capped.
- [x] The operator accepted v2.4, with its open objections listed (Result).
- [x] Register the phases as tasks: T075–T081.

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

- **Last touched:** 2026-10-13, adervark @b/b8438f28: done; the operator accepted v2.4
- **In flight:** nothing
- **On disk:** `docs/plans/research-runs.md` v2.4; reviews in `docs/plans/reviews/` (v1 architect, v1 critic, v2.2 critic partial, v2.3 critic)
- **Resume with:** nothing here; T075 (R0b) is next
- **Next decision:** none

## Result

**Done 2026-10-13: the operator accepted v2.4** of
[`docs/plans/research-runs.md`](../../../docs/plans/research-runs.md), with
the open objections below.

The design:
- One ledger per research task. Load-bearing facts are written as each lane
  report lands, each citing a pinned source, a scoped search, or, for an
  inference, its premises.
- Identity is computed from shared referents, never from labels: the cited
  definition, identifiers on the cited line, search patterns, premises,
  submissions, artifacts.
- A separate reconciler marks every linked pair, against canaries made from
  the round's own facts.
- Eleven checks, seven of them for conflicting and repeated data. No decision
  rests on an open conflict, and the operator rules through task actions once
  no run is live.

How it got there:
- v1 → Architect: sound, with required changes R1–R9.
- R0 (T074): partial, 1 of 3 defects caught, and that catch was later
  re-graded as noise.
- Critic, round 1: revise. v2.1 cut the design to its cheapest version.
- The operator amended D6: "fixing conflicted and redundant data is the
  point". v2.2 added facts and conflict checks.
- The operator caught that v2.2 still linked facts by a writer's label. It
  was fixed the same hour.
- Critic, round 2: revise. The report arrived partial, and v2.3 answered what
  arrived.
- Critic, round 3: revise. v2.4 answered it in full, including one false claim
  of mine about a search (29 lines, not 1).
- Reviews are in `docs/plans/reviews/`.

**Open objections, carried into the phases:**
- Linking is untested on evidence. T075 (R0b) grades recall over every
  correction RSNA's round 3 synthesis records. T076 (S0) counts what the
  design admits it cannot catch.
- §5.5's named gaps:
  - a bare assertion that shares no referent;
  - facts never transcribed;
  - premises chosen by the transcriber;
  - launches from gitignored files outside a fact's own source;
  - `asked-before` on ideas with no code referent;
  - a reconciler's wrong `agree`;
  - a question nobody asked;
  - a result nobody wrote down.
- Cost is unmeasured until R0b records it.
- Parts 2–3 of the round 2 Critic's report were never delivered. The round 3
  Critic re-reviewed in full, so whatever they held was either raised again
  or not.

Phases registered:
- T075: R0b;
- T076: S0;
- T077: S1a, after T075;
- T078: S1b, after T077 and T076;
- T079: S1c;
- T080: S1d, after T004 and T072;
- T081: the T112/T118 replay, after 2026-10-22.

T072 runs now on a hand-written ledger (D5).

Run digest:
- **b8438f28** (session): the design, v1 to v2.4, and the reviews saved.
- **b8438f28.2982** (architect): SOUND WITH REQUIRED CHANGES, R1–R9.
- **b8438f28.15f2** (critic, round 1): REVISE, B1–B6.
- **b8438f28.e3d5** (critic, round 2 on v2.1): died at a session limit, no report.
- **b8438f28.d930** (critic, round 2 on v2.2): REVISE, partial report.
- **b8438f28.072e** (critic, round 3 on v2.3): REVISE, complete.
- Cost: five Opus review subagents.

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
- 2026-10-13: the operator decided D5 and D6 as recommended: T072 runs now on
  a hand-written ledger, and stage 1 is built first. The Critic's second round
  on v2.1 died at a session limit with no report. The operator then read that
  v2.1's stage 1 would not flag conflicting findings, and amended D6: "i want
  this fixed fixing conflicted and redundant data is the point". v2.2 answers
  that.
- 2026-10-13: the operator approved a third review round, one fresh Critic on
  v2.3, beyond the rules' two rounds.
