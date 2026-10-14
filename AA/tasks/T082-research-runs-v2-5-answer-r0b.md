---
id: T082
title: "Research-runs design v2.5: answer R0b's recall of 2 of 12"
status: claimed
owner: adervark @b/b8438f28 2026-10-13 — v2.5: transcription no longer one agent's choice
# type: one word; tasks of one type are timed together; `bug` counts as defect work
type: design
# blockedReason: while blocked, one line saying what unblocks it; cleared on unblock
blockedReason: ""
depends: []
created: 2026-10-13
---

# T082 — Research-runs design v2.5: answer R0b's recall of 2 of 12

## Goal

A revision of [`docs/plans/research-runs.md`](../../docs/plans/research-runs.md)
v2.4 that answers T075's result. Linking and reconciling worked: 17 of 17
precise, and they found a defect the hand-written synthesis missed. Recall was
2 of 12, because the failures were upstream of linking. Each fix below has to
be checked against T075's misses before the design is accepted again.

## Context

- T075's grading is in `docs/plans/evidence/t075/grade.md`, and its ledger,
  links and marks are beside it. Rerunning `link.mjs` on a revised ledger
  costs nothing.
- What to answer:
  1. **Facts never transcribed** (C6, C7, C8, C12), the dominant gap.
     "Load-bearing" was judged too narrowly. Transcription costs about 3.5 s a
     fact, so the candidate fix is to transcribe every claim that carries a
     number, a count, a state or a causal "so", options in lists included.
  2. **Quantities with no code referent** (C5, C9): runtimes and leaderboard
     figures. The candidate fix is registered quantities, named objects on the
     track (the deployed rerun's runtime, the public leaderboard), which
     facts about them cite as referents.
  3. **Scope** (C3, C4): claims in code docstrings and in earlier lanes cited
     only indirectly. The question is what the settled record includes.
  4. **Within one document** (C11): let same-document pairs on one key or
     registered quantity link.
  5. **Out of reach** (C10, a correction from a later code commit): say so in
     §5.5.
  6. **Canaries** must respect a value's domain. An AUC above 1 gives the
     canary away.
  7. **Noise:** restore the exclusion for regenerable `outputs/` from v2.1.
     There were 39 `out-of-sight` warnings in one round.

## Steps

- [x] Write v2.5. It answers the operator's note too: "Choosing which
      findings to write down is still done by one agent alone." Every clause
      is now a fact or a written skip, and a blind auditor reads every skip.
- [x] Measure what can be measured for free on T075's material
      (`docs/plans/evidence/t082/measurements.md`): the clause sieve, the
      re-link, the search flip, C6's source.
- [ ] R0c: re-grade T075's twelve on a ledger written under v2.5's rules
      (design §7). It needs subagents beyond this task's spend rule, so it
      waits for the operator.
- [ ] The operator accepts it, or sends it for review.

## Decision rules — fixed in advance

- Spend: at most one fresh transcriber and one reconciler, on the operator's
  go.
  - **Amended 2026-10-14 by the operator's go for R0c** ("Run R0c now"), after
    v2.5 made transcription exhaustive: `agent-fan-out`, at most 8 Opus
    subagents. They are a registrar, 4 transcribers, 1 for cited sections,
    1 auditor and 1 reconciler. Each may be rerun once if it misses a canary
    or dies; nothing beyond that without the operator.
  - **Amended 2026-10-14 by the operator** ("3 reconcilers (+2)"): review
    of 3,081+ facts is ~10,000 fact lines grouped by referent. So there are
    3 reconcilers, 10 subagents in all: one for the 110 cross-document
    groups, two splitting the 995 premise checks. Same-document groups are
    recorded as unreviewed.
- Accepted only when the re-grade reaches at least 10 of 12, or the operator
  accepts a lower figure with the misses listed.

## R0c procedure — fixed before any subagent runs

- **Key:** T075's `corrections.md`, unchanged. No subagent may read it, the
  round 3 synthesis, T047's Result, T075's or T082's evidence, AGE Aris's
  `docs/plans/`, `AA/tasks/`, `PROGRESS.md`, or the reviews.
- **RSNA** is read only: `git show`, `git grep` and `git log` with
  `GIT_OPTIONAL_LOCKS=0`, plus `cat` for untracked files.
- **The cut:** `sieve.mjs` at R0b's commits, over R0b's eight documents,
  committed before the transcribers run, in four groups of at most 700
  clauses:
  - G1: R1, R2 and lane 13 (622);
  - G2: lane 9 and the T047 brief (656);
  - G3: lane 10 (639);
  - G4: lanes 11 and 12 (598).
- **Registrar** (subagent 1): reads only the T047 brief, R1 and R2 at
  `d9c7c6e`, and registers the track's measurands. It is told what a
  measurand is, not which ones to find. Its file is committed before the
  transcribers run.
- **Transcribers** (2–5), one per group, in parallel. Each disposes of every
  clause in its group, as a fact quoting it or as a skip. `check.mjs` must
  come back clean on its output, and it runs that check itself.
- **Cited sections** (6): `closure.mjs` cuts every Markdown section and code
  definition cited by a fact that lies outside the eight documents. This is
  one level deep. Code enters as its docstrings and comments only. One
  transcriber disposes of that cut.
- **Auditor** (7): reads every skip, with canaries among them: at least 3,
  or 2% of facts, made from real facts' clauses presented as `no-claim`
  skips. It assigns measurands blind. One rerun if it misses a canary.
- **Reconciler** (8): gets the linked facts grouped by shared referent, and
  every premise pair, with in-domain canaries. It writes a `same` line for
  each conflicting pair, and an `ok` line for each group it found clean. One
  rerun if it misses a canary.
- **`search-flipped`:** every `cmd:` source is re-run at `e4e356c`.
- **Grade:** by the parent, against the key, as T075 graded, plus each
  check's precision and the costs: clauses, facts and skips per group,
  minutes per subagent, `missed` skips, measurand disputes, and pairs by
  kind.

## Handoff — state at last stop

*Kept true while claimed, not written on the way out (rule 8).*

- **Last touched:** 2026-10-14, adervark @b/b8438f28: stopped at a usage
  limit, between steps
- **In flight:** nothing. Registrar, G1–G4 and GC are done and committed, all
  clean: 4,033 facts, 391 skips.
- **On disk:** `r0c/audit/` (skips.jsonl: 664 lines, 81 canaries;
  assign.jsonl: 245 items) and `r0c/audit-key.json`, committed. The auditor
  brief is in the session scratchpad (`brief-auditor.md`; fill in {RUN},
  {NSKIPS}=664, {NITEMS}=245).
- **Resume with:** open an auditor run and start it; then `merge.mjs` with
  audit.jsonl, `../link.mjs`, grouped review by 3 reconcilers (format still
  to write: groups, not pairs), re-run `cmd:` sources at e4e356c, and grade.
- **Next decision:** none; the operator approved 3 reconcilers.
- **Known gaps:** the committed cut dropped table cells of ≤2 characters.
  Pairwise linking gave 36,545 pairs on 3,081 facts, so review must be by
  group.

## Verify

The re-grade table in `docs/plans/evidence/` covers all twelve.

## Result

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
