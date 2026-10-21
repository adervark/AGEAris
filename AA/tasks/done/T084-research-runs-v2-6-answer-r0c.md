---
id: T084
title: "Research-runs design v2.6: answer R0c's 7 of 12"
status: done
owner: adervark @v/2bb43cf0 2026-10-21 — v2.6: free measurements on R0c's material, then the design
# type: one word; tasks of one type are timed together; `bug` counts as defect work
type: design
# blockedReason: while blocked, one line saying what unblocks it; cleared on unblock
blockedReason: ""
depends: []
created: 2026-10-21
---

# T084 — Research-runs design v2.6: answer R0c's 7 of 12

## Goal

A revision of [`docs/plans/research-runs.md`](../../docs/plans/research-runs.md)
v2.5 that answers T082's result. R0c recalled 7 of 12
(`docs/plans/evidence/t082/r0c/grade.md`). Transcription now reaches every
earlier claim that was committed. The losses have moved downstream: to what
a reconciler may call a correction, to links the transcriber did not write,
and to the measurement itself. Each change is checked for free on R0c's
material where it can be, before any new replay.

## Context

- R0c's grade, precision marks and costs are in
  `docs/plans/evidence/t082/r0c/` (`grade.md` first). Rerunning `link.mjs`,
  `groups.mjs` and `grade.mjs` on its ledger costs nothing.
- What to answer:
  1. **Supersession** (C5, C9): a sharper reading inside an earlier bracket
     (113 min inside 1.5–4.4 h), or a later dated reading of a moving
     quantity (rank 776, then 804). The reconcilers called both consistent,
     as their brief told them to. v2.5 has no place for a correction that
     does not contradict.
  2. **Refs left to the transcriber** (C2): both sides name `--layer-decay`
     in their quotes, with empty `refs`, so they never met. The candidate is
     refs taken mechanically from every quote, by a linear scan.
  3. **Canaries that replace real units:** 27 check canaries each took a real
     check out of review, C11's among them. Canaries go beside real units,
     and a check canary's premises must determine its value. Reconciler 2's
     missed canary had no count in its premise.
  4. **Premise checks that mix two kinds:** of 20 sampled `does-not-follow`
     findings, 5 name a defect in the research and 14 a premise the ledger
     lacks. Split the two, and mark estimates as estimates.
  5. **Code facts without a commit** (`precision.md` P45): a docstring from
     before T039, against lane 10's reading of the code after it.
  6. **The grade key:** pin every clause that carries an earlier claim or its
     correction. Credit a catch only when its `why` states the correction.
- Already out of reach, and said so in §5.5: C6 and C8, claims in a prompt
  or a head.

## Steps

- [x] Measure for free on R0c's material (`docs/plans/evidence/t084/measurements.md`):
  - **refs from quotes:** re-link and re-group. Do C2's sides share a unit,
    and what does the review load become?
  - **supersession:** a mechanical candidate rule over each measurand's
    cross-document readings. Are C5's and C9's pairs among the candidates,
    and how many candidates are there?
  - **canaries:** how many checks have premises that determine their
    conclusion's value?
- [x] Write v2.6 (`docs/plans/research-runs.md`, "Changes since v2.5"):
  - §5.2: refs, commits and ESTIMATED;
  - §5.5: `superseded` and the two premise kinds;
  - the reconciler's brief, and where canaries go;
  - §7: R0c's result, and the next replay's procedure and key;
  - §8–§10.
- [x] The operator accepts it, or sends it for review. Accepted on
      2026-10-21, to be tested on R0d, which is T085 with its own spend
      rule.

## Decision rules — fixed in advance

- No spend: design and free measurements only, and no subagent. A replay is
  `agent-fan-out`, and needs its own task and the operator's go.
- A change is kept only if its free measurement, where there is one, shows
  that it reaches its miss:
  - **refs from quotes:** C2's two sides share a unit. If the review load
    (fact lines in groups, 4,848 in R0c) grows by more than a quarter, the
    rule is narrowed before it is kept.
  - **supersession:** C5's and C9's pairs are among the candidates. If there
    are more than 300 candidate pairs, a mechanical list is too noisy, and
    supersession becomes a reconciler mark only.
- Done means the operator accepts v2.6, or rejects it, which is a result
  too.

## Handoff — state at last stop

*Kept true while claimed, not written on the way out (rule 8).*

- **Last touched:** 2026-10-21, adervark @v/2bb43cf0: closed, accepted to
  be tested on R0d (T085)
- **Done:** the free measurements (`docs/plans/evidence/t084/`):
  - quote refs are kept: C2's sides meet, and the load grows 17.1%;
  - supersession has 2,933 candidates, over the 300 allowed, so it is a
    reconciler mark only;
  - 70 of 1,220 checks can carry a fair canary;
  - code was cut at two commits, and no fact carries its commit.
- **Also done:** v2.6 is written into `docs/plans/research-runs.md`:
  "Changes since v2.5", §5.2, §5.5, §5.6, §7 (R0c done, R0d planned), §8,
  §9 and §10.
- **In flight:** nothing.
- **Resume with:** nothing; R0d continues in T085.
- **Next decision:** none here. D8, R0d's go, is T085's.

## Verify

v2.6 names a change for each of R0c's misses within reach (C2, C5, C9) and
each flaw in its measurement (canaries, key). Each change comes with the
free measurement that checks it, or says there is none.

## Result

**Accepted on 2026-10-21, to be tested on R0d (T085).** v2.6 is in
`docs/plans/research-runs.md` ("Changes since v2.5"). It was measured for
free on R0c's material first (`docs/plans/evidence/t084/measurements.md`).

The operator's rulings:
- no Critic round before R0d;
- C8 is out of reach, so R0d's bar is 9 of 12 (D7);
- R0d's go (D8) is still open.

What v2.6 changes, and what was measured:
- **Refs from quotes** are kept. C2's two sides meet, and the review load
  grows 17.1%, under the quarter allowed.
- **Supersession** is a reconciler mark. A mechanical rule raised 2,933
  candidates, over the 300 allowed, though C5's and C9's pairs were among
  them.
- **Canaries** sit beside real units, and only eligible checks are twinned:
  70 of 1,220.
- **Premise checks** are `follows`, `contradicted` or `unsupported`, and
  ESTIMATED marks a judgement with no derivation.
- **Facts carry their commit** into the reconciler's view.
- **The grade's key** pins every clause, and a catch must state the
  correction.

R0c's grade got a correction on C2's unit; its count stays 7.

**Spend:** none. One session (`2bb43cf0`), no subagents.

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
