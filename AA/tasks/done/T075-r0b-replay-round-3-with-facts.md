---
id: T075
title: "R0b: replay RSNA's round 3 with facts, graded on every correction its synthesis records"
status: done
owner: adervark @b/b8438f28 2026-10-13 — R0b: round 3 replayed with facts, graded on every correction
# type: one word; tasks of one type are timed together; `bug` counts as defect work
type: measure
# blockedReason: while blocked, one line saying what unblocks it; cleared on unblock
blockedReason: ""
depends: []
created: 2026-10-13
---

# T075 — R0b: replay RSNA's round 3 with facts, graded on every correction its synthesis records

## Goal

Measure whether stage 1's linking catches what RSNA's round 3 synthesis corrected by hand. A fresh agent, not given the design's incident text, transcribes the round's load-bearing facts, and a separate reconciler marks the linked pairs. The result is recall over every correction the synthesis records, with each miss tied to a gap the design names, plus the costs.

## Context

- [`docs/plans/research-runs.md`](../../../docs/plans/research-runs.md) v2.4, §7 (R0b) and §5.2–§5.5: the ledger format and the checks.
- RSNA round 3: `docs/research/0902c/` and `docs/RESEARCH-0902c-round-3.md`, at `e4e356c`. The Critic counts twelve corrections: §8.1's ten, §4's arithmetic slip, §8.3.
- R0 was T074. Its weakness, a script transcribing prose under rules pinned after the headings were seen, is what this replay avoids.
- Registered by T073 when the operator accepted v2.4 (2026-10-13).

## Steps

- [x] Count the corrections in the synthesis, and commit the list before any lane report is read.
- [x] Fix the procedure in this file: what makes a fact load-bearing, how citations are pinned, how premises are named. Commit it.
- [x] One fresh agent transcribes; a separate subagent reconciles. Ledger and costs go to `docs/plans/evidence/t075/`.
- [x] Grade recall per correction; tie each miss to a §5.5 gap; mark each warning real or false.

## Procedure — fixed before the transcriber runs

- **The answer key** is `docs/plans/evidence/t075/corrections.md`: the 12
  corrections, by the synthesis's own count (:642–643). It is committed first.
  The two subagents are forbidden to read it, the round 3 synthesis, T047's
  Result, or anything in AGE Aris's `docs/plans/`, `AA/tasks/`, `PROGRESS.md`
  or reviews.
- **The transcriber** is a fresh Opus subagent. It reads RSNA through
  `git show`, plus `cat` for untracked files.
  - Round 3's five lane reports at `e4e356c`.
  - The settled record before round 3, at `d9c7c6e` (T047's claim, which is
    the lanes' base commit):
    - R1's synthesis, `docs/RESEARCH-0902-road-to-0960.md`;
    - R2's synthesis, `docs/RESEARCH-0902b-round-2.md`;
    - T047's brief, `pm/tasks/T047-research-round-3.md`.
  - An earlier lane report only when a fact it transcribes cites one.
  - It writes load-bearing facts, those a verdict, decision, ranking or spend
    rests on, in v2.4's `fact` format: `src` pinned to `d9c7c6e` for round 3
    and to the document's own commit for earlier rounds; at least one ref per
    `path:line`, found on that line; `@worktree#sha256` for untracked files;
    an empty `src` with the lane's own mark when nothing is cited; and
    `premises` for every INFERRED fact, with `premises_by`.
  - It also writes one `question` line per T047 lane brief.
  - Output: it writes `docs/plans/evidence/t075/ledger.jsonl` and no other
    file. Amended before it ran: subagent replies are truncated in transit,
    as both Critic reports were.
- **Linking** is computed by `docs/plans/evidence/t075/link.mjs`, written by
  the parent and standing in for `research.sh`. It applies v2.4 §5.2's
  referents exactly: indentation-aware enclosing definition, enclosing
  Markdown heading, file, worktree hash, `cmd:` pattern, refs, inherited
  premises. A pair links when its two facts come from different lanes or
  documents. The script also makes 6 canaries from the ledger's own facts:
  the same referents and refs with a changed value, and two set-inclusion
  contradictions.
- **The reconciler** is a second fresh Opus subagent, which did not
  transcribe. It gets the linked pairs with the canaries mixed in, unmarked,
  and writes a `same` line per pair, quoting both lines, to
  `docs/plans/evidence/t075/same.jsonl` and no other file. If it misses a
  canary, it reruns once. A second miss is recorded and ends the run.
- **Grading** is by the parent, against the key, exactly as written there.
  Every warning is marked real or false.
- **Recorded:** facts per lane, minutes per fact, linked pairs, canaries
  caught, `premises_by: transcriber` count, and the subagents' tokens where
  the harness reports them.

## Decision rules — fixed in advance

- Spend: `agent-fan-out`, at most two Opus subagents, a transcriber and a reconciler, with one rerun of the reconciler if it misses a canary. Nothing beyond that without the operator.
- RSNA is read only: `git show`, `git grep` and `git log` with `GIT_OPTIONAL_LOCKS=0`, plus `cat` for untracked files. Nothing in RSNA is written. The evidence quotes competition research, so nothing is pushed before 2026-10-22.
- Done means recall, the misses with their gaps, precision per check and the costs are in the Result and PROGRESS.md. A recall below 10 of 12, or a conflict check under 90% precision, sends T073's design back for revision before T077.

## Handoff — state at last stop

*Kept true while claimed, not written on the way out (rule 8).*

- **Last touched:** 2026-10-13, adervark @b/b8438f28: done; graded
- **In flight:** nothing
- **On disk:** nothing
- **Resume with:** nothing here; T082 revises the design
- **Next decision:** none

## Verify

Every correction in the committed list has a row: caught, or missed with its gap.

## Result

**Recall: 2 of 12.** That is below the 10 of 12 bar, so by the rule above
T073's design goes back for revision before T077. The revision is T082. The
full grading is in `docs/plans/evidence/t075/grade.md`.

- **Caught:**
  - C1, the flags "never passed", which round 3 found passed once;
  - C2, the claim that S1 tests "encoder too hot".

  Each linked through `ref:--layer-decay` and was marked `conflict`, along with
  every conclusion resting on it.
- **Missed:**
  - 6 never transcribed. 4 of them sat in documents the transcriber read
    (C6, C7, C8, and C12, the 10-vs-12 inference itself). 2 lived outside the
    scope (C3, C4).
  - 2 transcribed but never linked, because runtime and leaderboard numbers
    have no code referent (C5, C9).
  - 1 inside one document (C11).
  - 1 with no lane source, a correction from a later code commit (C10).
- **Precision:** 17 of 17 real conflicts. Among them is one real defect the
  round 3 synthesis never recorded: lane 10's "~+30 min" for a third layout
  pass misreads the kernel's "~67 min … x ~2".
- **Canaries:** 6 of 6 caught, but not blind. Two had AUCs above 1.
- **Costs:**
  - the transcriber: 13.4 min for 232 facts, about 3.5 s a fact;
  - the reconciler: 7.3 min for 240 pairs;
  - one referent, `--layer-decay`, links 80 pairs;
  - 39 `out-of-sight` warnings on `outputs/` logs.

**What it means:** linking and reconciling work. What fails is upstream:
which facts get written, and quantities that point at no code. Transcription
is cheap enough, at about 13 minutes a round, to be much broader.

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
