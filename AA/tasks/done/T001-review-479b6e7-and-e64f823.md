---
id: T001
title: "Review 479b6e7 and e64f823 independently"
status: done
owner: adervark @k/ff713831 2026-10-07 — one independent reviewer per commit
# type: one word; tasks of one type are timed together; `bug` counts as defect work
type: review
# blockedReason: while blocked, one line saying what unblocks it; cleared on unblock
blockedReason: ""
depends: []
created: 2026-10-07
---

# T001 — Review 479b6e7 and e64f823 independently

## Goal

A reviewer who wrote neither checks two commits on `feature/pm-cockpit` and
ranks what it finds by severity: 479b6e7 (code spans and kept line breaks in
task text) and e64f823 (the board renamed to AA, its older names still read).

## Context

- 479b6e7's review was cut off when the account hit its usage limit on
  2026-10-07.
- e64f823 touches `lib/workspace.mjs` (`BOARDS`, `configName`, `_renderState`),
  `lib/history.mjs` (the board paths) and the tests that keep `deaddrop/` and
  `pm/` boards readable.

## Steps

- [x] Review 479b6e7 against `public/markdown.js` and `tests/markdown.test.mjs`.
- [x] Review e64f823: a `deaddrop/` board, tracked or made by AGE Aris, must
  behave exactly as before.
- [x] File each confirmed defect as its own `bug` task in `backlog/`.

## Decision rules — fixed in advance

- One review agent per commit at most (`agent-fan-out` is a spend). If the
  usage limit cuts a review off, stop, say where in the Handoff, and release
  the task rather than start over.
- A finding counts only with a concrete input that goes wrong. Style notes go
  under Notes, not into new tasks.
- Done when both commits have a verdict: no confirmed defect, or each one filed.

## Handoff — state at last stop

*Kept true while claimed, not written on the way out (rule 8).*

- **Last touched:** 2026-10-07, adervark @k/ff713831
- **In flight:** nothing
- **On disk:** twelve bug tasks in `backlog/`, T005 to T016
- **Resume with:** nothing; closed
- **Next decision:** none

## Verify

Every finding names a file, a line and the input that fails; `npm test` passes.

## Result

Done, against the decision rules: one reviewer per commit (two code-reviewer
runs), and every finding came with an input that goes wrong. Before filing
them, I reproduced the most serious ones myself: T005, T006, T007 and T012.

- **479b6e7: comment.** The code-span pass agrees with `inline()` on the main
  path (600,000 generated paragraphs, no mismatch) and stays linear (4 MB of
  spans in 49 ms). It brings one regression, T010, and sits beside four older
  defects: T008 (a crash), T009 (quadratic patterns), T014 and T015.
- **e64f823: changes requested.** The four real `deaddrop/` boards read exactly
  as before, and own projects made before the rename keep writing to
  `deaddrop/`.
  - A regression: T006.
  - The rename hits them on real data: T007 (RSNA's T120), T011 and T012.
  - Wrong on screen: T013.
  - Older bugs found along the way: T005 (high) and T016.
- Twelve bug tasks, T005 to T016, are in `backlog/`. The log entry is in
  `PROGRESS.md` under 2026-10-07.

Digest:

- **ff713831** (session @k/ff713831): 12 bug tasks filed in AA/backlog: T005-T016; no code changed · cost ? · left: the fixes, as their own claimed tasks
- **ff713831.204c** (code-reviewer @k/ff713831): no repository files changed; only these AA/checkpoints/T001.jsonl lines added · cost ? · left: no fixes made (read-only review)
- **ff713831.ba0b** (code-reviewer @k/ff713831): nothing in the repository; experiments only in the session scratchpad · cost one reviewer pass · left: no fixes written (review only); expected outputs checked against markdown-it 3.0.0 in commonmark mode

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*

- Style, from the e64f823 review: the rename cost two column layouts 6
  columns of alignment, `skills/aa-init/SKILL.md:21` and the template's
  `board.sh:5`. They are fixed with T011.
- Open questions from the same review. None is a defect, because none has a
  reachable failing input:
  - `_renderState` writes `pm:` markers that its region pattern never finds
    again. That happens only if an own project's board is `pm/`, and AGE Aris
    never makes one.
  - For a tracked repository, `read().activity` comes from
    `git log -- <board>`, so it drops commits from before a rename. No view
    uses that list.
  - An unrelated `AA/` folder with `tasks/` in a tracked codebase would be
    read as a board, as a `pm/` folder was before.
- The full reports were written to the session's scratchpad, not to this
  repository; each bug task carries its own inputs.
