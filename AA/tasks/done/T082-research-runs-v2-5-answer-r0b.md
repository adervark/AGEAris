---
id: T082
title: "Research-runs design v2.5: answer R0b's recall of 2 of 12"
status: done
owner: adervark @v/2bb43cf0 2026-10-21 — R0c: the grade, on what the reconcilers left (reclaimed, rule 3; was adervark @v/1cd08a13 2026-10-17 — R0c: the auditor, then merge, link, 3 reconcilers and the grade)
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
- [x] R0c: re-grade T075's twelve on a ledger written under v2.5's rules
      (design §7), on the operator's go. **7 of 12**, by the rule and by
      hand (`docs/plans/evidence/t082/r0c/grade.md`).
- [x] The operator accepts it, or sends it for review. Sent back for a
      v2.6 on 2026-10-21 (T084).

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
  - **Amended 2026-10-17 by the operator** ("Balanced mix"): with the
    closure ledger merged there are 286 groups (4,848 fact lines) and 1,220
    premise checks (4,681 lines), not 110 and 995. The 3 reconcilers each
    take a third of both, about 3,190 lines each (`r0c/groups.mjs`). The
    spend is unchanged.
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

- **Last touched:** 2026-10-21, adervark @v/2bb43cf0: closed, sent back
  for a v2.6 (T084).
- **Done:** the auditor's rerun caught 81 of 81 canaries and flagged 170
  of 583 real skips `missed` (pass 1: 74 of 81, 19). Merged
  (`r0c/merged/`), linked (`r0c/link/link-counts.json`; the pairs are
  regenerable, not committed), grouped (`r0c/rec/`, key `rec-key.json`),
  searches re-run (`r0c/searchflip.json`). Graded (`r0c/grade.md`,
  `grade.json`, `precision.md`): recall 7 of 12, by the rule and by hand;
  canaries 31 of 33; conflict precision 44 of 49 strictly, 48 with the
  ambiguous; a defect the synthesis carried (4,349 against 3,749). Logged in
  PROGRESS.md.
- **In flight:** nothing. Reconcilers 1 and 2 are graded at pass 1 (10 of
  11 canaries each). Their reruns died at the usage limit on 2026-10-16
  and stay dead: finishing them cannot change the recall (`grade.md`).
- **Resume with:** the operator's decision below. On a v2.6, revise
  `docs/plans/research-runs.md` from `grade.md`'s candidates. On
  acceptance, write the Result and close.
- **Next decision:** the operator's. 7 of 12 is below the rule's 10, so
  either the operator accepts 7 with the misses listed, or v2.5 goes back
  for a v2.6. `grade.md` names the candidates: supersession, refs from
  quotes, canaries beside real units, premise checks that say which kind,
  commits on code facts, and a full key.
- **Known gaps:** the committed cut dropped table cells of ≤2 characters.
  Pairwise linking gave 36,545 pairs on 3,081 facts, so review must be by
  group.

## Verify

The re-grade table in `docs/plans/evidence/` covers all twelve.

## Result

**Recall: 7 of 12**, both by the rule fixed in `grade.mjs` and by hand. That
is below the bar of 10. On 2026-10-21 the operator sent v2.5 back for a v2.6
("Revise to v2.6"), which is T084. The grading is in
`docs/plans/evidence/t082/r0c/grade.md`.

- **Caught, by hand:** C1, C3, C4, C7, C10, C11 and C12.
  - The rule credits C2 in place of C11. C2's only credit is "a premise is
    missing".
  - All three reconcilers found C11, on facts the key left out.
- **Out of reach:** C6 and C8, never committed as claims.
- **Missed within reach:**
  - C5 and C9 are supersession, which v2.5 has no place for;
  - C2's two sides got no refs.
- **The measurement's own flaws:** 27 check canaries replaced the real checks
  they copied, C11's among them. The key pinned one clause per correction.
- **Precision:**
  - conflicts: 44 of 49 strictly, 48 with the ambiguous;
  - `does-not-follow`: 5 of a sample of 20 name a defect in the research.
- **A defect the synthesis carried:** OOF-AUC vs Sonnet on 4,349 studies,
  where lane 3 measured 3,749.
- **Spend:** 13 subagent runs, about 145 minutes:
  - the registrar (2.7 min);
  - transcribers G1–G4 and the cited sections (13.4, 14.9, 14.0, 11.8 and
    16.3 min);
  - the auditor and its rerun (10.0, 10.9);
  - reconcilers 1–3 (13.9, 15.1, 16.1);
  - reconcilers 1 and 2's reruns, which died at the usage limit and were
    left dead, because they could not change the recall.

  Sessions `b8438f28` (registrar, transcribers), `1cd08a13` (auditor,
  reconcilers) and `2bb43cf0` (the grade). The trail is retired; git keeps
  it.

**What it means:** v2.5's exhaustive transcription worked: every earlier
claim in a commit was written down. What now fails is what may count as a
correction, and a link the writer left out. The measurement must also stop
removing the units it tests.

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*

- 2026-10-21, adervark @v/2bb43cf0 (T085): **the Result's hand reading
  overstates R0c.** Its own briefs primed three of its catches, with
  examples drawn from round 3:
  - C11's correction is the reconciler brief's example;
  - C12's earlier claim is the transcriber brief's worked example;
  - C10's negative claim is named in the transcriber and auditor briefs.

  The catches no brief prompted are 4 of 12: C1, C3, C4 and C7. The
  mechanical count stays 7. See the correction in
  `docs/plans/evidence/t082/r0c/grade.md`.
