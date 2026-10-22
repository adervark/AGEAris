---
id: T086
title: "H1: research-runs v2.6 replayed on a round it was not built from"
status: claimed
owner: adervark @default/4279585a 2026-10-22 — H1 on RSNA T112: the free work first (cut, key, reach gate, briefs), then the go
# type: one word; tasks of one type are timed together; `bug` counts as defect work
type: measure
# blockedReason: while blocked, one line saying what unblocks it; cleared on unblock
blockedReason: ""
depends: [T085, T087]
created: 2026-10-21
---

# T086 — H1: research-runs v2.6 replayed on a round it was not built from

## Goal

Accept or reject v2.6 of
[`docs/plans/research-runs.md`](../../docs/plans/research-runs.md) on a
research round that none of its incidents and none of its briefs' examples
came from (§7, H1; §10, D9).

## Context

- Every replay so far (R0b, R0c, R0d) used RSNA's round 3. The design's §5.5
  incidents come from it, and so did R0c's brief examples. A pass there is
  in-sample (v2.6 item 7).
- The operator chooses the round. RSNA's T112 is a candidate. T118 is not:
  it supplies `instrument-unresolved`'s incident.
- The procedure is R0c's in full: the cut, transcribers, the blind auditor,
  linking, three reconcilers. About 13 subagent runs. A key of its own is
  pinned before any subagent runs.
- R0d (T085) checks v2.6's mechanics first, so a mechanics failure is not
  bought at this price. R0d did not pass (one canary of 33). The operator
  let that stand, so v2.6 is revised first (T087). T086 runs under v2.7:
  its reconciler brief and checker start from
  `docs/plans/evidence/t087/`, and its check canaries follow v2.7 item 1.

## Steps

- [x] The operator chooses the round: **RSNA T112**, "The 4090's first day"
      (2026-10-22).
- [x] Write the decision rules here: the round, its key, the bar, the spend.
- [x] The operator approves these rules (2026-10-22). Then claim.
- [x] **Free, before any subagent runs** (`docs/plans/evidence/t086/`, README
      first):
  - the record cut: 1,315 clauses over 20 documents;
  - the key pinned and committed: 20 corrections, 13 in reach;
  - the gate passed, 13 against 8 (`reach.mjs`);
  - the briefs written from v2.7's templates. `brief-check.mjs` finds 0
    hits against this key in the nine files subagents get.
- [x] The operator's go (2026-10-22).
- [ ] Register, transcribe, audit, link, reconcile, grade.

## Decision rules — fixed in advance

*Drafted 2026-10-22, before any spend, after the operator chose T112, and
approved by the operator as drafted the same day.*

- **The round:** RSNA's T112, its committed record from `3ed78d4`
  (2026-09-18) to `fc0d19e` (2026-09-21). That is the task file at every
  commit that changed it, its checkpoints, PROGRESS.md's T112 sections, and
  the scripts and code its commits touched, each cut at the commits it was
  written. Nothing after `fc0d19e` is in scope. T118 and later tasks are
  out: T118 supplies one of v2.7's incidents.
- **The key:** every correction T112's own record states, meaning a
  committed sentence that a later committed sentence corrects or
  supersedes, within the round.
  - The parent finds them by reading the whole record and searching it,
    and pins each in full, as R0d's key was. That covers every clause
    carrying the earlier claim or the correction, and one sentence on what
    a `why` must state.
  - The key is committed before any subagent runs and is never shown to
    one.
- **The viability gate (free, before any spend):** reach is measured on the
  pinned key.
  - A correction is in reach when its earlier claim and its correction are
    in committed sentences, and the pipeline can bring them together. That
    means different documents (`groups.mjs` skips same-document pairs), one
    file at two commits, or a premise check.
  - T086 spends only if at least 8 corrections are in reach. Otherwise it
    stops, and the operator chooses again. T112 is one author's task file
    in the main, and its self-corrections may sit in one document.
- **Procedure:** v2.7 in full.
  - The cut, transcribers by document group, the blind auditor, citation
    closure, linking and three reconcilers.
  - Canaries follow v2.7 items 1 and 2. The parent writes each check
    canary's refutation into the canary key first.
  - Every brief starts from `docs/plans/evidence/t087/`, takes its examples
    from neither round 3 nor T112, and shows 0 hits against this key.
  - RSNA is read only with `git show`, `git grep` and `git log`, under
    `GIT_OPTIONAL_LOCKS=0`.
- **Spend:** `agent-fan-out`, at most 10 Opus subagent first passes: up to
  6 transcribers, 1 auditor and 3 reconcilers, sized from the cut. It
  starts only on the operator's go, given after the gate passes and the
  inputs are committed.
  - Each may be rerun once, if it dies or misses a canary. A rerun after a
    death resumes from its lines.
  - Nothing beyond that without the operator.
- **What no subagent may read:** this key or this file, the grade, AGE
  Aris's `docs/plans/`, `AA/tasks/` and `PROGRESS.md`, or RSNA's later
  tasks.
- **Pass, and v2.7 is accepted:** all of these hold.
  - **Recall:** at least 80% of the corrections in reach are caught, by
    R0d's rule. A catch is a `conflict` or `superseded` line on an earlier
    and a correcting fact, a `contradicted` check on an earlier fact, or
    `search-flipped` on one, each with a `why` the parent judges states the
    correction.
  - Every canary is caught, the auditor's and the reconcilers', after at
    most one rerun each.
  - `conflict`, `superseded` and `contradicted` lines are each at least
    90% real. They are marked by hand, on a seeded sample of 60 where a
    kind has more than 60.
- **Otherwise:** each miss is listed with its §5.5 gap, and the operator
  decides between revising the design and accepting it as it stands.

## Handoff — state at last stop

*Kept true while claimed, not written on the way out (rule 8).*

- **Last touched:** 2026-10-22, adervark @default/4279585a: the spend is
  under way on the operator's go.
  - The registrar is done: 122 measurands, committed at `02ed6a5`.
- **In flight:** transcribers G1, G2 and G3 (runs `4279585a.2f32`, `.bf5b`
  and `.f127`), writing `docs/plans/evidence/t086/ledger-G*.jsonl`.
- **Agents used:** 4 of the 10 allowed first passes.
- **Resume with:** `AA/ckpt.sh live T086`. A transcriber that died is rerun
  once, resuming from its lines.
  - When all three are clean (`t082/r0c/check.mjs`), run `t082/r0c/closure.mjs`
    to `cut/GC.jsonl`, then the closure transcriber.
  - Then `audit-view.mjs`, with `--exclude key.json`, then the auditor.
- **Next decision:** none until the grade, unless a stage fails twice.

## Verify

The grade covers every correction in the round's key, each with the unit
that caught it or the furthest step it reached.

## Result

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
