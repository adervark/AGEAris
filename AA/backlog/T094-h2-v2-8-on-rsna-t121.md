---
id: T094
title: "H2: research-runs v2.8 on RSNA T121, the held-out round"
status: open
owner: —
# type: one word; tasks of one type are timed together; `bug` counts as defect work
type: research
# blockedReason: while blocked, one line saying what unblocks it; cleared on unblock
blockedReason: ""
depends: [T090]
created: 2026-10-22
---

# T094 — H2: research-runs v2.8 on RSNA T121, the held-out round

## Goal

Decide v2.8 (`docs/plans/research-runs.md`, Changes since v2.7) on a round
it was not drawn from: RSNA's T121, under T086's procedure with v2.8's
units, brief and twin rule.

## Context

- The operator accepted v2.8 to be tested and chose T121 (2026-10-22, §10
  D12, D13). v2.8's best case on H1 was exactly the bar, in-sample
  (`docs/plans/evidence/t090/measurements.md`).
- T121 ran 2026-09-21 to 2026-09-28; its commit subjects name corrections
  ("a cost table that was wrong by 3x", "rule 4's 97% refuted at 75%").

## Steps

- [ ] The operator approves the decision rules below, as drafted or
      changed.
- [ ] Free: the cut, the key, the viability gate; v2.8's edit and cue units
      in the linker, the checker and the grade; the briefs, checked against
      the key.
- [ ] The operator's go, then the round.
- [ ] The grade, and the operator's decision.

## Decision rules — fixed in advance

*Drafted 2026-10-22, before any spend, after the operator chose T121; for
the operator's approval.*

- **The round:** RSNA's T121, its committed record from `2e7ffc6`
  (2026-09-21) to `3c8fcaa` (2026-09-28): the commits whose message names
  T121, less trail-only commits (`ckpt:`). That is T121's task file at every
  commit that changed it, its trail at `3c8fcaa`, PROGRESS.md's T121
  sections, and the code and scripts those commits touched, each cut at the
  commits it was written. T132's and T133's files, which share two commits,
  are out; so is anything after `3c8fcaa`, and T112 and T118.
- **The key:** every correction T121's own record states, meaning a
  committed sentence that a later committed sentence corrects or
  supersedes, within the round. The parent finds them by reading the whole
  record and searching it, and pins each in full, as T086's was: every
  clause carrying the earlier claim or the correction, and one sentence on
  what a `why` must state. Committed before any subagent runs and never
  shown to one.
- **The viability gate (free, before any spend):** reach on the pinned key,
  under v2.8: a correction is in reach when its two sides are in committed
  sentences and the pipeline can bring them together, by a group, a check,
  an edit unit or a cue unit. H2 spends only if at least 8 are in reach;
  otherwise it stops and the operator chooses again.
- **Procedure:** v2.8 in full. The cut, transcribers by document group, the
  blind auditor, citation closure, linking with edit and cue units, three
  reconcilers. Canaries follow v2.7 items 1 and 2 and v2.8 item 4; the
  parent writes each check canary's refutation into the canary key first.
  Every brief starts from `docs/plans/evidence/t087/` and, for the
  reconciler, `t090/brief-reconciler.md`, takes its examples from neither
  round 3, T112 nor T121, and shows 0 hits against this key. RSNA is read
  only with `git show`, `git grep` and `git log`, under
  `GIT_OPTIONAL_LOCKS=0`.
- **Spend:** `agent-fan-out`, at most 10 Opus subagent first passes: up to
  6 transcribers, 1 auditor and 3 reconcilers, sized from the cut. It
  starts only on the operator's go, given after the gate passes and the
  inputs are committed. Each may be rerun once, if it dies or misses a
  canary; a rerun after a death resumes from its lines. Nothing beyond that
  without the operator. Before the go, the parent checks every account's
  limits (`/aa limits`) and runs from the one with the most left.
- **What no subagent may read:** this key or this file, the grade, AGE
  Aris's `docs/plans/`, `AA/tasks/` and `PROGRESS.md`, or RSNA's tasks
  after T121.
- **Pass, and v2.8 is accepted:** all of these hold.
  - **Recall:** at least 80% of the corrections in reach are caught. A
    catch is a `conflict` or `superseded` line on an earlier and a
    correcting fact, in a group, an edit or a cue unit; a `contradicted`
    check on an earlier fact; or `search-flipped` on one, each with a `why`
    the parent judges states the correction.
  - Every canary is caught, the auditor's and the reconcilers', after at
    most one rerun each.
  - `conflict`, `superseded` and `contradicted` lines are each at least 90%
    real, marked by hand, on a seeded sample of 60 where a kind has more.
- **Otherwise:** each miss is listed with its §5.5 gap, and the operator
  decides between revising the design and accepting v2.7 or v2.8 as it
  stands.

## Handoff — state at last stop

*Kept true while claimed, not written on the way out (rule 8).*

- **Last touched:** 2026-10-22, registered with drafted rules

## Verify

`node grade.mjs > grade.json` on the committed key and outputs, and the
grade's `why` judgements in `grade.md`.

## Result

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
