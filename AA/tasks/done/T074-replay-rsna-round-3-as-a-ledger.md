---
id: T074
title: "Replay RSNA's research round 3 as a ledger: do the checks catch what its synthesis caught by hand?"
status: done
owner: adervark @v/b8438f28 2026-10-13 — R0: RSNA round 3 recast as a draft ledger, in scratch
# type: one word; tasks of one type are timed together; `bug` counts as defect work
type: measure
# blockedReason: while blocked, one line saying what unblocks it; cleared on unblock
blockedReason: ""
depends: []
created: 2026-10-13
---

# T074 — Replay RSNA's research round 3 as a ledger

## Goal

RSNA's research round 3 is recast as a draft findings ledger in scratch, and a
throwaway checker is run over it. The round is its T047: lanes 9–13 and the
synthesis, as they stood at RSNA `e4e356c`, the commit that closed it.

The pass is fixed in
[`docs/plans/research-runs.md`](../../docs/plans/research-runs.md) §5.6. The
checks must flag the three defects that RSNA's synthesis found by hand:

1. lanes 10 and 11 disagreed on a count, 10 against 12;
2. two verdicts in lane 12's table had no section behind them;
3. lane 11's efficiency half was never written.

Every other warning is listed and marked real or false. The baseline measures
(r1)–(r6) land in PROGRESS.md.

## Context

- R0 of T073's design (§5.6 L1, §7, §9). The operator's D3, 2026-10-13: now,
  one session, no subagents.
- RSNA is read at pinned commits through `git show`, and nothing in it is
  changed. Lane 11b, `lane11b-efficiency-track.md`, was added at `5313b79`,
  after the synthesis, so it is outside the replay.

## Steps

- [x] Fix the extraction procedure, below, before any lane report is read.
- [x] Extract the ledger from RSNA at `e4e356c` into this session's scratch.
- [x] Write the throwaway checker and run it.
- [x] Compare the warnings with the three known defects, and mark every other
      warning real or false.
- [x] Record the result and the baseline in PROGRESS.md, and give T073's v2
      what it found.

## Decision rules — fixed in advance

- **No spend:** one session, no subagents (D3). Nothing is written in RSNA.
  The ledger and the checker stay in scratch. Only the result, the baseline
  and the procedure land in this repository.
- **The bias, stated before extraction.** This session read T047's Result, so
  it knows the three defects. Extraction therefore follows the procedure
  below, as written. A defect counts as caught only when the procedure,
  applied as written, produces lines that make a check fire.
- **Pass:** all three defects flagged by v1's checks as written. **Partial:**
  some are flagged only by an extension under test (below), or not at all; the
  result says which. **Fail:** none is flagged. A partial or a fail goes to
  T073's v2 before anything is built.
- Done means the result and the baseline are in PROGRESS.md, and T073's v2 has
  the findings.

## The extraction procedure — fixed before reading any lane report

**Questions.** These are what the claimant would have registered before the
lanes started:

- Each lane brief in T047 (lanes 9–12) is split into its asks. An ask is
  every sentence that asks a question, or that names a target the lane is to
  investigate. Each ask becomes one `question` line, owned by its lane.
- Every question carries T047's own rules: every claim needs a mark (rule 1),
  and a lever needs an instrument (rule 2).
- Lane 13 had no brief. Its questions are taken from its report's own
  statement of what it asks, and they are dated at the report's commit.

**Claims.** Each lane report is read in order:

1. Each table row that gives a verdict, a finding or a number for a named
   item becomes one claim.
2. Each numbered or bulleted item under a heading that names a conclusion,
   verdict, finding, result or summary becomes one claim.
3. A claim's `q` is the lane's question that its section answers, matched by
   the section heading. If none matches, it is the lane's first question.
4. Its `mark` is the mark written in the row or its section, or empty.
5. Its `where` is the report's path and the heading the report itself names
   for it: the section the row points to if it points to one, else the
   nearest heading above.
6. Its `verdict` comes from the report's own word, through a fixed table:
   - LEVER → answers;
   - NULL, dead or null → null;
   - RESOLVED NEGATIVE → rejects;
   - PARKED, unresolved or untested → unresolved.
7. A `path:line` the report cites becomes `src`.
8. A stated count of a named object becomes `value`. Its `unit` is the
   object's noun as written.

**Decisions.** These come from the synthesis:

- Each ranked lever, carried verdict or registered task becomes one
  `decision` line.
- Its `cites` are the claims whose `where` matches a lane section the
  synthesis cites.
- A citation that matches no extracted claim is kept as written, and is not
  repaired.

**Extensions under test.** They are not in v1, and each is reported apart
from v1's checks:

- **`about`:** a claim with a count also gets the object's noun phrase,
  lowercased, with its digits removed. A `contradiction` is then also tested
  across questions, for claims with the same `about`.
- **`where-missing`:** a claim's `where` heading does not exist in its file.

**What runs.** The checks that apply to a round with no spend:

- `uncovered`, `unbacked`, `contradiction` (by question, and by `about`);
- `where-missing`, `source-missing` (each `path:line` at `e4e356c`);
- `registered-late`;
- `reopened-settled`, against T047's table of what rounds 1–2 had answered;
- `single-family`, reported as an observation.

`instrument-unresolved`, `artifact-mismatch` and `orphan-answer` need spends
or time, so they are not exercised, and the result says so.

## Handoff — state at last stop

*Kept true while claimed, not written on the way out (rule 8).*

- **Last touched:** 2026-10-13, adervark @v/b8438f28: done
- **In flight:** nothing
- **On disk:** `docs/plans/evidence/t074/`: the script, its ledger, its
  warnings and its summary
- **Resume with:** nothing; the findings are in T073's v2 input
- **Next decision:** none

## Result

**Partial: v1's checks catch 1 of the 3 defects.** By the rules above, a
partial goes to T073's v2 before anything is built. PROGRESS.md has the
numbers.

What ran:

- A Node script applied the procedure above to RSNA at `e4e356c`, through
  `git show`.
- It extracted 8 questions, 254 claims (lanes 9–13: 61, 87, 24, 52 and 30)
  and 34 decisions.
- It then ran `uncovered`, `unbacked`, `contradiction`, `source-missing`,
  `registered-late` and `reopened-settled`, plus the two extensions under
  test.
- Two choices were pinned after the headings were seen and before any content
  was read:
  - a document's H1 is its title, not a section;
  - a claim whose headings match no question falls to the lane's first
    question, in the brief's order.

  If the title counted as a section, lane 11's title would have hidden
  defect 3.

The three defects:

1. **Lanes 10 and 11, 10 against 12: missed.**
   - v1 keys `contradiction` on the question, and the two lanes answered
     different questions.
   - The `about` extension keys on the noun after a count. It grouped six
     unrelated counts of "members" (5, 10, 12, 14, 16, 22) from lanes 10, 11
     and 13, so it fires with or without the defect. It does not catch it.
   - For v2: a value needs a **subject** from a registry the brief hands to
     every lane. New subjects are listed at synthesis, so they can be merged
     there.
2. **Lane 12's two verdicts with no section behind them: missed.**
   - Its "Verdict up front" table has rows 1a to 6. Rows 3 (auxiliary heads on
     DICOM metadata) and 4 (mirror-consistency regularisation) point to no
     section, and the report goes from §2 to §5.
   - For v2: a claim with a verdict needs a `where` naming the section of its
     reasoning, not the summary that states it. `where-missing` fires when
     that section is absent or empty.
3. **Lane 11's efficiency half: caught by `uncovered`.**
   - No lane-11 section matched the efficiency question, so it got 0 claims.
   - In a real ledger, lanes name `q` themselves, and nobody wrote a claim on
     it.

Every other warning:

- **Real:**
  - `registered-late` on lane 13, which ran with no brief, as T047 records;
  - `source-missing` on `outputs/t028/run_density.sh:33`, cited by lane 10
    and gone from git and from disk;
  - 3 more `path:line` sources in untracked folders, still on disk.
- **False:**
  - 3 `uncovered`, on L9.Q2, L13.Q1 and L13.Q2. They come from matching
    headings to questions, and from RSNA's verdicts being written as prose:
    7 of 254 claims carry a verdict word;
  - 17 `unbacked`. 11 are rows of the synthesis whose evidence is in rounds
    1–2. 5 cite sections written as prose, which the procedure does not
    extract. 1 cites a round 2 lane;
  - 2 `contradiction-about`, both noise;
  - 1 `where-missing`, from a reference to another lane's §3.4.

Also found:

- 67 of 254 claims carry no evidence mark in their row or section. Most of
  them are rows that cite a `file:line`, which is READ evidence left
  unmarked.
- Under orient's family rule all five lanes are one family, yet RSNA counts
  "two lanes, independently" as corroboration. Research needs its own
  definition of independence.

To re-run:

- `node docs/plans/evidence/t074/replay.mjs`. By hand: apply the procedure above to RSNA `e4e356c`, with `T047` read from
  `pm/tasks/done/`.
- The script took the briefs' questions in the order listed in this task's
  procedure.


## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*

- 2026-10-13, the operator amended the rule that kept the script and ledger
  in scratch. They are committed as evidence in `docs/plans/evidence/t074/`.
  The script now reads RSNA through `git show` instead of copies, and its
  ledger came out the same, byte for byte. The files quote RSNA's research,
  so the branch is not pushed before RSNA closes on 2026-10-22 without the
  operator's word (STATE.md, Watch out for).
- 2026-10-13, re-graded by T073's Critic: the one catch cannot be told from
  noise (`uncovered` was right on 1 of 4 questions), and whether lanes keep a
  ledger as they go was never tested. PROGRESS.md, "T074 re-graded", has the
  detail.
