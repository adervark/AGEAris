---
id: T101
title: "Design: research as a tree that is searched and pruned: declared axes, proposed links, bounded ends"
status: open
owner: —
# type: one word; tasks of one type are timed together; `bug` counts as defect work
type: design
# blockedReason: while blocked, one line saying what unblocks it; cleared on unblock
blockedReason: ""
depends: []
created: 2026-10-29
---

# T101 — Design: research as a tree that is searched and pruned: declared axes, proposed links, bounded ends

## Goal

A design, in `docs/plans/research-tree.md`, for structuring research topics
as one tree across tracks and repositories, searched by proximity and pruned
by bounded ends, each mechanism judged on the record before any of it is
built.

## Context

- 2026-10-29, the operator: structure research topics "into a high
  dimensional tree", then "use proximal search to produce research marking
  each route a end if the research effort further down that node will prove
  to be futile". Of three readings, the operator chose both halves together:
  - **the skeleton is declared**: each node has coordinates on declared axes
    (project, track, object or measurand, method, instrument, status), and the
    tree is whichever axis it branches on first;
  - **links are proposed**: nearness in an embedding proposes cross-links
    between nodes, across tracks and repositories, which a reconciler or the
    operator accepts or rejects. Never truth on its own: research-runs §4
    rejected identity guessed from prose (option H, "Members" grouped six
    unrelated counts), and principle 4 is "declared, not scanned".
- **Proximal search** proposes the next nodes from the frontier: facet cells
  no question has touched (an object with no question on it), and semantic
  neighbours of live nodes. It also shows, beside a new question, any end
  near it and why that end died.
- **An end is a declared bound, not a proof.** Futility cannot be proven,
  only bounded. Each track already names a number to beat, the incumbent; an
  end says a subtree cannot beat it, because:
  - its optimistic bound is at or below the incumbent;
  - the instrument's step is wider than the gap it must read; or
  - the track that consumes the result cannot show the gain.

  An end carries its bound, how the bound was got, and what reopens it. It is
  decided before the spend it saves (principle 7). The ledger already has
  `dead-end` and `reopen` decisions (research-runs §5.2); the likely additions
  are `bound`, `incumbent` and `reopens_if`.
- The record, where each half would have mattered:
  - **an end not marked**: RSNA's T118 registered a submission to read an arm
    at w = 0.20, though an earlier arm at that weight had moved the score
    0.000, with a ±0.001 band on a three-decimal leaderboard (research-runs
    §2);
  - **a node never searched**: RSNA's `--layer-decay` and `--warmup-frac`
    were wired, and the recipe never passed them until round 2 compared a
    public recipe with ours (T043:61; RESEARCH-0902b:60; lane 10:27);
  - **ends already written by hand**: AGEIS's `dormant` status ("the last
    result says why more work would not pay yet",
    `~/Code/AGEIS/docs/research/README.md`), and its T092, where a better
    signal S did not move link-prediction's ranking;
  - **a bound computed before a round**: research-runs v2.8 put its best case
    on H1 at 11 of 13, H1's bar exactly. Recall over four rounds ran 2/12,
    7/12, 4/13, 5/10, and the operator then accepted v2.8 as it stands (D14).
  - **a tree with one parent per node**: in AGEIS every research task belongs
    to exactly one track, yet its tracks feed each other: representation
    supplies signal S, which link-prediction ranks with, and T125's survey
    is filed under one while the other decides whether it matters.
- Research-runs stage 1 (T077 onward) is the ledger this extends. Whether S1a's
  schema waits for the end fields is the operator's call, not this task's.

## Steps

- [ ] The axes: which are declared, where each lives (task frontmatter, the
      ledger's `object` lines, `AA.yml`), and how a node in another
      repository is addressed.
- [ ] The end: its fields, the three kinds of bound, the reopen condition,
      and the check that refuses an end with no bound and no reason.
- [ ] Proximal search: the frontier, the empty facet cells, the semantic
      proposals, and how a proposal becomes a node or is rejected.
- [ ] Each case in the record above judged by principle 9: would the
      mechanism have changed a decision, and when? Cite the record.
- [ ] Write it to `docs/plans/research-tree.md`, mechanisms that would have
      changed no decision included, marked as such.

## Decision rules — fixed in advance

- No spend: reading this repository, `~/Code/AGEIS` and `~/Code/RSNA`; no
  subagents.
- Running an embedding model on the record is not part of this task. If the
  design needs that number, it registers a measure task with its own rules.
- A mechanism that would have changed no decision on the record is not
  proposed for the first build (principle 9).
- Done means the design is written, each case in the record is judged with
  its evidence, and the operator has it. Nothing is built here, and T077's
  file is not edited.

## Handoff — state at last stop

*Kept true while claimed, not written on the way out (rule 8).*

- **Last touched:** 2026-10-29, registered

## Verify

For T118 the design names the end that would have fired and the bound behind
it; for the unused flags, the empty facet cell that would have shown them; for
AGEIS's T092, the consuming track's bound. Each cites the record.

## Result

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
