---
id: T029
title: "Research: what Scrum masters and flow coaches use to see the work"
status: done
owner: adervark @k/adccab68 2026-10-08 — research visualisations for AGE Aris
# type: one word; tasks of one type are timed together; `bug` counts as defect work
type: research
# blockedReason: while blocked, one line saying what unblocks it; cleared on unblock
blockedReason: ""
depends: []
created: 2026-10-08
---

# T029 — Research: what Scrum masters and flow coaches use to see the work

## Goal

A grounded list of the charts, metrics and numbers that Scrum masters and flow
coaches actually use, what each is for and how practitioners criticise it,
set against what AGE Aris shows today, ending in a ranked proposal the
operator can choose from. Nothing is built in this task.

## Context

- 2026-10-08, the operator: "we gotta add better visualising, you get
  opinions/ideas from the Scrum masters (the tools, metrics and numbers they
  use)".
- AGE Aris today (Flow tab): KPI tiles, two 6-week series charts (throughput
  and WIP per day), risk and load tables, the history behind each number.
- The product's position: the method is the product (flow: WIP, cycle time,
  service level, aging WIP). The AA convention deliberately has no sprints,
  estimates or velocity (`docs/PLUGIN.md`). Scrum's own charts must be weighed
  against that, not copied.

## Steps

- [x] Sources: Scrum Guide and Scrum.org's flow guidance, Kanban guides,
      Vacanti and ProKanban, practitioner discussion, and the tools (Jira,
      Azure DevOps, Linear, ActionableAgile, Nave).
- [x] For each visual: what question it answers, the data it needs, whether
      AGE Aris's git ledger can produce it, and the main criticism.
- [x] A ranked proposal in `docs/plans/visualisation.md`; new work goes to
      `backlog/` only once the operator chooses.

## Decision rules — fixed in advance

- No spend: web research and reading only; no subagents.
- Every claim about practice carries a source.
- Done means the proposal is written and the operator has it.

## Handoff — state at last stop

*Kept true while claimed, not written on the way out (rule 8).*

- **Last touched:** 2026-10-08, adervark @k/adccab68 (done)
- **In flight:** nothing
- **On disk:** nothing
- **Resume with:** nothing
- **Next decision:** none

## Verify

The proposal cites its sources; each proposed visual names its data in the ledger.

## Result

**Done.** The proposal is `docs/plans/visualisation.md`. It covers what
Scrum masters and flow coaches use, by Scrum event; what the tools ship; what
practitioners warn against; and how each chart fits AGE Aris's flow method
and git ledger. It ends in a ranked list of seven charts:

1. aging WIP;
2. cycle-time scatterplot;
3. Monte Carlo forecast;
4. CFD;
5. burnup by item count;
6. where a task's time went;
7. process behaviour chart.

It does not propose velocity, story points, burndown or sprint reports. The
suggested first slice is 1–3.

Against the decision rules:

- No spend: web searches and reading only; no subagents.
- Every claim about practice carries a source (21, listed in the plan). Its
  caveats are recorded there too: some sources are vendor blogs, Reddit
  threads could not be found by search, and Vacanti's books were not read
  directly.
- The operator has it (2026-10-08); new tasks are registered once the
  operator chooses.

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
