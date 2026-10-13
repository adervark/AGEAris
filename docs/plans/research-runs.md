# Research runs, aggregated: one line of thought, in the operator's sight

**Status: draft v2.5** (2026-10-13, T082). Nothing here is built. v2.4 was
accepted, then failed R0b (T075): 2 of 12. v2.5 answers it, and is accepted
again only on its re-grade, R0c (§7).

- v1 (f9ecde8) was written after reading how RSNA, AGEIS and this repository
  do research.
- R0, a replay of RSNA's round 3, ran as T074. It came back partial.
- An Architect reviewed v1: sound, with required changes R1–R9.
- A Critic reviewed v1 independently: revise, with blocking issues B1–B6
  (`docs/plans/reviews/`).
- v2 (7bfc107) answered the Architect and R0. v2.1 answers the Critic, and
  adopts its "cheapest version" as **stage 1**. Everything else waits as
  **stage 2**, behind evidence.
- The Critic's second round on v2.1 died at a session limit before it wrote
  anything. It reruns on v2.2.
- v2.2 answers the operator, who read that v2.1's first build would not flag
  conflicting findings: "i want this fixed fixing conflicted and redundant
  data is the point".
- The Critic's second round, on v2.2: REVISE. Its report arrived partial
  (`docs/plans/reviews/research-runs-v2.2-critic.md`). v2.3 answers every
  point that reached us.

- A third round, which the operator approved, reviewed v2.3: REVISE
  (`docs/plans/reviews/research-runs-v2.3-critic.md`, complete). v2.4 answers
  it.
- The operator accepted v2.4, to be tested on evidence. R0b (T075) replayed
  RSNA's round 3 with a fresh transcriber and a separate reconciler: recall 2
  of 12, precision 17 of 17 (`docs/plans/evidence/t075/grade.md`). v2.5
  answers it (T082), after the operator read: "Choosing which findings to
  write down is still done by one agent alone."

## Changes since v2.4

R0b showed the linking works and the transcription does not. Where both
facts were in the ledger with a shared referent, the conflict was caught
every time, with every conclusion resting on it, and one real defect the
synthesis missed. But 6 of the 12 corrections never reached the ledger, and
nothing could say so: what one agent judged "load-bearing" was the whole
record, and an omission left no trace. The operator asked for that fixed.
Every number below was measured on T075's material before this was written
(`docs/plans/evidence/t082/`).

1. **Nothing in a report goes unaccounted for** (the dominant gap: C7, C8,
   C12, and C4 once in scope).
   - `research.sh clauses` cuts every document a round reads into clauses
     (sentences, semicolon clauses, table cells, headings) by a linear scan,
     with ids pinned to the commit. No judgement goes into the cut.
   - **Every clause is disposed of**: by a `fact` whose `says` is found
     verbatim in it, or by a `skip` line with a reason from a closed list
     (`no-claim`, `repeat` of a fact, `quote` of another document). An
     undisposed clause fires `untranscribed`, and no verdict may be written on
     a question while its lanes' reports have one.
   - "Load-bearing" is gone. An omission is now a written `skip`, which
     someone else reads.
   - *Measured* (`sieve.mjs` on T075's eight documents): 2,515 clauses, 1,941
     of them carrying a digit, a sign or a claim word. T075's 232 facts
     covered 295 of those 1,941. The other 1,646 left no trace. Every
     earlier claim and correction clause that I could locate is among the
     1,941: lane 10's "unlocks three TTA views" (C12, `lane10#392`, line
     349), R1's "384 px only behind it" (C7, line 178), lane 9's "So — is the
     whole band public overfit?" (C8, line 123), R2 lane 7's "under-predicts
     by 2× in practice" (C4, line 331). Under v2.5 each one is a fact, or a
     skip that the auditor reads.
2. **A blind auditor reads every skip** (the operator's point).
   - It is a subagent that neither transcribed nor reconciles. It gets each
     document and its `skip` lines, not the facts, and writes an `audit` line
     per skip: `ok`, or `missed` with why. A `missed` clause is undisposed
     again until the claimant writes the fact or the operator rules.
   - **Canaries:** `research.sh audit` turns real facts' clauses into `skip
     no-claim` lines in the auditor's view, at least 3 or 2% of facts. Their
     text is real, so nothing gives them away. A pass that misses one is
     rerun once; a second miss goes to the operator. The canary rate is the
     auditor's measured recall on omissions.
   - So what gets written down is no longer one agent's choice: the cut is
     mechanical, every exclusion is a line, and a second agent, itself
     audited, reads every exclusion.
3. **The scope closes over citations** (C3, C4).
   - A section or definition cited by a fact in scope enters scope, and is
     cut and disposed of in turn. Lane 11's heading cites "lane 7 §3.4", so
     R2 lane 7 §3.4 enters (C4). Lane 11 cites `src/tta.py:324`, so
     `budget_minutes` enters, docstring included: "It is an **upper
     bound**" (C3, `tta.py:330` at `d9c7c6e`).
   - Code enters as its docstrings and comments, the code's own claims about
     itself, never as statements.
4. **Lane prompts are committed** before their lanes run (C6).
   - Lane 11 corrects "the brief": "Correction to the brief: the deployed
     config is 3 TTA views (id, crop, bright), not 2" (lane 11:37). No commit
     holds a brief that says 2: T047's file at `d9c7c6e`, `f896e38` and
     `e4e356c` has no "view" in its lane 11 section (checked). The claim
     lived in a prompt that was never committed. T075's grade put C6 among
     the documents the transcriber read, which was wrong.
   - `research.sh brief` writes each lane's prompt as its `question` line's
     `prompt`, committed, and `registered-late` fires on a lane whose prompt
     is not in an ancestor of its report.
5. **Quantities with no code referent are registered measurands** (C5, C9).
   - An `object` of kind `measurand` (the deployed rerun's runtime, our public
     rank, the team count), registered on the track before transcription. A
     fact about one cites `m:<name>`, which is a referent.
   - That is a writer's choice of identity, so it is made twice. The auditor,
     blind to the transcriber's choice, assigns every fact that has a unit
     and no code referent to a measurand or to none. A disagreement fires
     `measurand-disputed`, and the fact is linked under both. One label never
     decides identity; two independent assignments that agree do.
6. **Premises link to their conclusions, within one document too** (C11).
   - Each INFERRED fact is paired with each premise, and the reconciler
     marks whether the conclusion follows. Same-document facts that cite a
     referent themselves are paired as well.
   - *Measured*: on T075's ledger, lane 11's "66 → 132 units ⇒ ~175 min"
     (F178) is now paired with its premise, "T(u) ≈ 25.2 min + 1.329 min per
     forward unit" (F161). That premise gives 25.2 + 1.329 × 132 = 200.6
     min, the synthesis's 201. The pairs rise from 234 to 427: 103 premise
     pairs, 193 in one document (`relink/link-report.json`).
7. **Searches are re-run** (C10).
   - `search-flipped`: every `cmd:` source is re-run at the round's close
     and at each later round's base; a changed output hash fires on the fact.
   - *Measured*: `git grep -n -e --resume -- src` returns nothing at
     `d9c7c6e` and three lines of `train.py` at `e4e356c`. `f896e38` added
     `--resume` at 20:02 that day. It is reachable only when the negative
     claim was written as a search; T075's transcriber cited `AGENTS.md:46,
     49` instead (F203). The auditor marks a negative claim about code with
     no `cmd:` source as `missed`.
8. **Canaries stay in their domain.** A reconciler canary takes another real
   fact's plain decimal value, of the same unit and the same shape (sign, and
   digits before and after the point), and never from a fact that is itself
   twinned. A gold AUC of 0.9054 becomes 0.8793, and a rank of 265 becomes
   776. A unit alone is not a domain: without the shape rule, a gold AUC
   delta of −0.0053 became 0.8976. T075's multiplied 1.419 AUC is no longer
   possible. On T075's ledger only 4 facts can be twinned this way. R0c's
   larger ledger will have more.
9. **Noise.** v2.1's exclusion is back: `out-of-sight` is silent on sources
   under the track's `regenerable:` paths (`outputs/` for RSNA). On T075's
   ledger it fell from 39 to 2. Both remaining hits are inside `.venv`.

**What it costs.** At T075's rate, about 3.5 s a fact, disposing of 1,941
claim clauses is about 113 minutes for one transcriber. One transcriber per
document cuts that to the largest report: lane 9's 470 claim clauses, about
27 minutes. The auditor is what makes several writers safe. The auditor reads skips at about the
reconciler's rate, 1.8 s a line. Backfilling an earlier round by citation
closure is a one-time cost per track. Rounds 1 and 2's nine lane reports hold
6,156 clauses in all, and only the cited sections enter scope.

**What still slips through** is in §5.5: a claim the auditor also passes,
which the canary rate bounds but cannot rule out; and a negative claim
written without its search.

## Changes since v2.3

The round 3 Critic found that the second proof still failed, that the spec
pushed transcribers into citing the wrong lines, and that neither test could
fail on anything new. Each point was checked again at RSNA before this was
written. One of them was a false claim of mine in v2.3: the search at
`2b3d2a6` returns 29 lines, not only the flag's definition. I had filtered out
the Markdown hits and then described what was left as the whole search.
Scoped to `src`, it returns 3, all in `train.py`: the definition at `:812` and
an error message at `:273–274`.

1. **Untracked sources are citable, and seen** (blocking 1).
   - Lane 10's only source for "passed once" is `outputs/t025/run_arm.sh`.
     `outputs/*` is gitignored (`.gitignore:29` at `e4e356c`), so no commit
     holds it.
   - Such a source is now cited as `path:line@worktree#<sha256 of the file>`.
     `research.sh fact` reads it with `cat`, checks that each ref is on the
     line, and records the hash.
   - `out-of-sight` now fires on a fact's source, not only on a verdict's.
   - A `cmd:` search carries its pathspec, so its scope is stated.
   - Incident 2 now links through the ref `--layer-decay`. Round 2's search,
     scoped to tracked `src` and `scripts`, finds no launch. Lane 10's fact,
     grounded on line 13 of the untracked script, finds one. The pair shows
     what happened, and `out-of-sight` fires on the source.
   - The blind spot, said plainly: a repository search cannot see a launch
     from a gitignored file. That blind spot is this incident.
2. **A fact keeps its lane's mark, sourced or not** (blocking 2).
   - A MEASURED fact with no source is written with `src: []` and the warning
     `unsourced`. No decision may rest on it alone.
   - Every `path:line` source carries at least one ref, found on the cited
     line. So lane 11's citation of `tta.py:110`, a docstring's closing
     quotes, is refused, and the writer is told where the ref really is.
   - An INFERRED fact still needs premises. When the lane names none, the
     transcriber may supply them, and the line records
     `premises_by: transcriber`. The page shows those, and §5.5 counts them
     as a gap: identity chosen by a writer.
3. **The tests can fail on something new** (blocking 3).
   - R0b is graded on recall over every correction the round 3 synthesis
     records. The Critic counts twelve: §8.1's ten corrections to earlier
     rounds, §4's arithmetic slip, and §8.3. R0b counts them itself, first.
   - R0b backfills earlier rounds by the same fixed procedure, and is run by
     a fresh agent that is not given §5.5's or §7's incident text.
   - S0 plants a conflict with no shared referent, and an inference whose
     lane named no premises. It reports how many slip through, and no longer
     claims to catch them.
4. **`copy-drift` fires on its incident.** It now fires when a live, undated
   document quotes a superseded fact. A dated record that quoted the value
   before it was superseded stays silent.
5. **§5.5 names three more gaps:**
   - facts never transcribed;
   - premises chosen by the transcriber;
   - `asked-before` on an idea with no code referent, which links only by
     key.
6. **Cost is measured and capped.** R0b records minutes per transcribed fact,
   linked pairs per round, and reconciler tokens. After two failed reconcile
   passes, the round escalates to the operator instead of rerunning.
7. **Minor fixes:**
   - Canaries are written into the reconciler's view of the ledger, in the
     ledger's own id sequence. `research.sh` assigns every id, so the
     transcriber's and the canaries' ids cannot collide.
   - A ruling waits until no run on the task is live, the lanes' and the
     reconciler's included (`lib/workspace.mjs:1449–1465`).
   - AGE Aris shows the task file's rulings over a stale page.
   - A citation into Markdown resolves to its enclosing heading.
   - Stale text is corrected.
8. **Citations pin to the commit the lane started from**, which the brief
   prints and the report states. The commit that added the report section
   would be wrong: lanes 9–12 entered RSNA's history in the synthesis's own
   commit (`e4e356c`, 20:13), hours after they read the code. Only lane 13
   was committed earlier (`cd160f5`).
9. **Referents in one file.** A file referent, used only when a cited line has
   no enclosing definition or heading, links to every referent in that file.
   A referent that links more than 12 pairs in a round is grouped for one
   review (§8).

## Changes since v2.2

The Critic showed that v2.2's two proofs failed on the record. Each was checked
again here at RSNA `e4e356c` before this was written.

1. **The 10-vs-12 incident was the wrong pair.**
   - Lane 10 §3.4 ("the ten `fold?` members record `mirror=0.0 rotate=0.0`")
     and lane 11 §2.6 ("twelve carry `0.0`") are both true: the ten are among
     the twelve.
   - The false statement is lane 10 §3.3: dropping the ten "unlocks three TTA
     views" (lane 10:350–351). It is an inference that cites only "(§3.4)".
   - The synthesis says the same (RESEARCH-0902c:502–509).
   - So v2.2 linked a pair a correct reader marks `agree`, and could not
     reach the inference at all.

   **Fix:** an INFERRED fact must cite its premises (`premises`: fact ids). It
   inherits their referents and links like any other fact.
   - Lane 10 §3.3 rests on §3.4, which cites `src/tta.py:116`, so it inherits
     `src/tta.py#unmatched`.
   - It links to lane 11's "twelve carry `0.0`". The pair reads "drop ten
     and the views unlock" against "twelve block them": a conflict.
   - `research.sh fact` refuses an INFERRED fact with no premises.
2. **Refs must be on the cited line, and lines move.**
   - `mirror` and `rotate` are not on `src/tta.py:110` or `:116`.
   - Lane 10's `train.py:812` was a blank line by `e4e356c`, because the flag
     had moved to `:1020`.
   - None of the 106 `path:line` citations in round 3's reports pins a
     commit.

   **Fix:** every source is `path:line@commit` or `path#symbol@commit`, and
   `research.sh fact` checks it when the line is written:
   - it refuses a blank cited line, or a ref missing from it, and says where
     the ref is found instead;
   - it pins an unpinned citation to the commit that added the report section
     citing it, and shows that pin to the writer;
   - a definition is the nearest enclosing `def`, `class` or `function` at a
     lower indentation than the cited line, never merely the nearest one
     above it.
3. **Negative facts cite their search.**
   - Round 2's "never once passed" (RESEARCH-0902b:60) cited nothing, so only
     a label could link it.
   - **Fix:** a "never" or "none" fact cites the search as `cmd:`, for example
     `git grep -n -- --layer-decay <commit>` with its output's hash. The
     search's pattern is its ref, so it links to any fact about
     `--layer-decay`.
   - Rerun on the record, at round 2's commit `2b3d2a6`, the search finds only
     the flag's definition (`src/train.py:812`). Lane 10's "passed once" cites
     `outputs/t025/run_arm.sh:13`, a file git has never tracked.
   - So the linked pair shows the real story. "Never" was true of the
     repository and false of the machine, and `out-of-sight` fires on the
     source nobody could see.
4. **A separate reconciler, with canaries it cannot spot.** Under v2.2, the
   writer reconciled its own facts. It could tell a canary by the fact it
   never wrote, and pass by marking only the canaries.
   - The reconciler is now a separate subagent that did not transcribe.
   - `research.sh` makes the canaries during the round, from the round's own
     facts: the same referent and refs with a changed value, and set-inclusion
     contradictions shaped like lane 10 §3.3.
   - Canary ids continue the ledger's sequence, and canaries stay out of the
     ledger until the pass is graded.
   - Every `why` must quote the two lines it compared. The blind reader (§7,
     r4) re-reads a sample of the real pairs marked `agree` or `unrelated`, so
     marking only the canaries fails.
5. **Rulings while a round is live.** AGENTS.md refuses a task action while a
   checkpoint run on the task is live (`RUN_LIVE`), and v2.2 had the operator
   ruling mid-round. That constraint stands.
   - Conflicts show mid-round, read-only.
   - The claimant cannot decide on an open one (`decision-on-conflict`). When
     a conflict needs the operator, the claimant ends its run with `next`
     naming the conflicts, and the task waits.
   - The operator rules in AGE Aris, and the next session resumes from the
     ruling.
6. **Cut and narrowed**, as the Critic advised:
   - `measured-again` is cut. Its only incident was a fixture, and
     `asked-before` covers a question about a settled key before any spend.
   - `copy-drift` is narrowed to what it can check: a quote marked with a
     fact's id whose value differs. The AGEIS inverted verdict is no longer
     its incident. Generated pages remove that class, since nothing restates
     a verdict by hand.
   - Its real incident is lane 10:28, which names three records that copied
     "never": `PROGRESS.md:5857`, lane 6 §2.5 and
     `scripts/t042/run_recipe_fold0.sh:7`.

The Critic's report was cut off after point 4's first fixes, and parts 2 and 3
never arrived. Point 5 and the cuts are recovered from the trail's one-line
summary, and anything else that report said is unknown.

## Changes since v2.1

v2.1 put the line of thought in sight, but its four checks only kept the books.
It caught a question left open and a verdict with no section behind it. It
deferred the failures that cost RSNA most: two lanes disagreeing, a fact
measured again, one fact copied by hand into eight places, an instrument too
coarse for its band. v2.2 brings them into stage 1 on a single idea: **two
facts are about the same thing when they point at the same thing.** Identity
is computed from what a fact cites, the code definition, flag, file,
submission or artifact. It is not a label a writer chose, and it is not
guessed from prose.

A first draft of v2.2 linked facts by the object a writer filed them under. That
moved the old weakness instead of removing it: a conflict filed under two
labels would slip through, and 10 against 12 would have been caught only if
one person happened to label both facts alike. The operator called it out, and
it is fixed below. Lane 10 cites `src/tta.py:116` and lane 11 cites
`src/tta.py:110`. Both lines sit inside `def unmatched` (line 103 at
`e4e356c`), so the two facts are linked by the code they cite, whoever wrote
them and whatever they were labelled.

1. **Facts with referents** (§5.2). The claimant writes a `fact` line for each
   load-bearing fact as each lane report lands. Every fact that is MEASURED or
   READ cites its source, `path:line@commit`, a submission id or an artifact
   hash. Its `refs`, the identifiers it is about (`mirror`, `armb0`,
   `--layer-decay`), must each appear in the cited lines, so they are grounded
   in the source rather than chosen. `research.sh` resolves each `path:line`
   to its enclosing definition (`src/tta.py#unmatched`) by a linear scan. The
   key, `<object>/<attribute>`, is a display name and an exact-match shortcut.
   It is never what decides identity. Lanes end their reports with a short
   facts table, a table in the file they already write.
2. **One row per key** (§5.4). The page holds each key once, with every fact
   that supports it. A fact measured twice becomes one row with two supports,
   so redundant data collapses by construction.
3. **Seven new checks** (§5.5; v2.3 cuts `measured-again`, leaving six), each with its incident on record:
   - `conflict`: two live facts on one key disagree;
   - `unreconciled`: two facts from different lanes or tasks share a
     referent, a definition, a flag, a file or a submission, whatever their
     labels, and nobody has said whether they agree (lanes 10 and 11, 10
     against 12, linked through `src/tta.py#unmatched`);
   - `decision-on-conflict`: a decision rests on a fact in an open conflict;
   - `asked-before`: a new question is about a settled key, and does not say
     it reopens it (round 0921 re-asked SSL pretraining);
   - `measured-again` (cut in v2.3): a spend re-measures a settled key without asking for a
     reproduction;
   - `copy-drift`: a document quotes a fact by id with a different value (the
     eight hand writes; AGEIS's inverted verdict);
   - `instrument-unresolved`, moved up from stage 2: a band no wider than its
     instrument's step (T118).
4. **Conflicts are resolved, never left.** A `resolve` line or an operator
   ruling names the fact that stands and why. The other is superseded, and
   the page shows both.
5. **Canaries in every reconcile pass** (§5.6). `research.sh` plants known
   conflicting pairs, built from the corpus, among the linked pairs it hands
   the reconciler. A pass that does not mark every canary `conflict` is
   rejected, so each round measures the reconciler's attention, not just the
   tool's.
6. **A simulation proves it before code** (§7). Round 3 is replayed with facts
   written by hand (R0b), and a fabricated round with planted conflicts tests
   whether referents link them. Two of the planted conflicts are labelled
   differently on purpose.
7. **D5 and D6 are recorded** (§10). D6 now reads as the operator amended it.

What still cannot be caught is said plainly in §5.5: two facts about one thing
that cite nothing in common, a question nobody asked, and a result nobody wrote
down. The first is bounded: a fact with no source is INFERRED, and an INFERRED
fact cannot carry a decision alone.

## Changes since v2

The Critic's central point: v1 and v2 load the structure onto the lanes, claim
by claim, in a second file beside their reports, and RSNA's record suggests
lanes skip exactly that. RSNA's own tools say the same. `record_guard.py` was
written after two submissions of a capped allowance were spent and their
answers never collected. One result had to be written by hand in eight
places, and "every hand-written record had drifted". Prose scanning "produced
garbage" twice there, so its guards read declared markers. R0 scanned prose,
and 23 of its 26 warnings were false.

1. **Stage 1: one writer, at the grain of decisions** (B1, B2, B3, B6; the
   Critic's cheapest version).
   - The claimant registers the questions before any lane opens. At
     synthesis, the claimant writes one verdict line per question, and the
     decisions.
   - Lanes keep writing their prose reports, tracked, as RSNA's do. They have
     nothing new to skip.
   - Ids are sequential within a ledger and carry the task prefix
     (`T072/Q1`, `T072/V1`, `T072/D1`). With one writer they cannot collide.
   - Independence is declared on the verdict (`basis`: the lanes, models,
     methods and sources) and justified in the synthesis.
2. **The operator rules through a task action** (B5). A ruling is a line in
   the task file's `## Decisions` section, written by an AGE Aris task action.
   That is one task file in one commit, which AGENTS.md already allows. A
   ruling can park or drop a question, or accept a warning, and it always
   carries its reason, as RSNA's `claims-guard-ok` does.
3. **Four checks.** Each is tested on the real incident it answers, where it
   must fire, and on a counterfactual from the record, where it must stay
   silent (B1, B6):
   - `uncovered`;
   - `where-missing` and `out-of-sight`;
   - `registered-late`;
   - `decision-waiting`.

   Each must keep at least 90% precision on a real round, or it is demoted to
   a note on the page.
4. **One door first** (N3). `AA/research.sh` writes the track page and a JSON
   summary beside it. AGE Aris shows them by reading files, since it never
   runs a repository's scripts. The second door and orient's key wait for
   stage 2.
5. **Lessons taken from RSNA's own guards** (N1):
   - declared markers, never prose scanning;
   - precision first;
   - every suppression carries its reason;
   - dated records are records, not errors. A generated tree is excused only
     for what can be regenerated: a source in `outputs/` counts when its line
     carries the `cmd:` that rebuilds it. R0's `outputs/t028/run_density.sh`
     carried none. Lane 10 cites it as evidence, it was never tracked, and it
     is gone. So it stays a real defect: code kept in a generated tree, which
     is what RSNA's T093 describes.
6. **The operator's outcome is measured** (B6):
   - the minutes it takes to answer "where are we on X?" from the page;
   - decisions that bound before the operator saw them;
   - defects a named blind reader finds that the checks missed;
   - (r1) and (r5) are dropped until there is a baseline.
7. **Stage 2 waits on evidence.** Claim-grain ledgers, subjects,
   `contradiction`, reproduction by re-execution, the experiment checks, the
   second door and orient's key are built only when T072, or the replay of
   RSNA's T112 and T118 after 2026-10-22, shows one of them would have
   changed a decision.
8. **Safety** (N6):
   - a reproduction runs only a tracked script at a pinned commit;
   - region markers inside rendered text are escaped;
   - `path:line@commit` is parsed without backtracking.
9. **Integration and inventory** (N5). A standing question on every track
   asks what we already have, and the page puts every verdict about the same
   thing side by side.
10. **R0 is re-graded** against the Critic. `uncovered` flagged 4 questions
    and was right once. The choice that decided the catch was pinned after
    the headings were seen. And the round R0 replayed spent nothing.
11. **D5 and D6** go to the operator: run T072 now on a hand-written ledger,
    and build stage 1 first.
12. **T118's catch, corrected.** v2 said an assertion caught the rename, and
    the Critic's B1 took that from it. T118 records otherwise: the defect was
    found by reading, while the task was being built, and the assertion was
    strengthened as its fix. A person caught it, not a check.

Earlier changes are in the history of this file: v2 at 7bfc107, v1 at f9ecde8.

## 1. What the operator asked for

- "Devise a agent first research and simulation strategy for aggregatig
  research runs."
- While v1 was being drafted: "we mix up shit and keeping it away from my eyes
  without a properly structured line of thought brings terrible inefficiencies
  and lost alpha."

Read together:

- Agents do the research, the simulations and the experiments. Each of them is
  a *run*.
- The runs of one inquiry aggregate into **one line of thought**: question →
  runs → verdict with evidence → decision → the next question.
- The operator sees that line whole, in one place, while it grows, and rules
  on it from there.
- An agent reads and writes the same line through files and one command.

## 2. Where it stands, measured

Read on 2026-10-13. Three repositories have arrived at the same need on their
own.

### RSNA: rounds of agent lanes

A Kaggle competition that closes on 2026-10-22. Research runs as **rounds**,
each made of parallel agent **lanes** and one **synthesis**:

- 9 dated research folders under `docs/research/`, holding 65 Markdown files.
  60 are tracked. **The newest round, 0921, with four lanes and its
  synthesis, has never been committed.**
- Round 1 (its T038) had six lane reports, lane 0 written by the orchestrator.
  Round 2 (T043) had three. Round 3 (T047) had four briefed lanes and one
  unbriefed. Each round had a synthesis.
- DeepSeek researches too, through `scripts/ds_research.sh`. It has no Bash,
  may edit only the untracked `.omc/research/`, and that boundary "must not
  widen" (its T088).

The method is good. Most of it is done by hand:

- evidence marks: READ, MEASURED and INFERRED, with REPRODUCED added in round 3
  (T047 rule 1);
- a lever is ranked only with an instrument; without one it is ranked last,
  never dropped (rule 2);
- a null lane is a result (rule 4);
- the orchestrator re-checks the claims a decision hinges on (T038);
- round 3's brief carries a hand-written "already answered, do not redo"
  table.

Some of it is mechanised:

- `scripts/claims_guard.py` fails when a live document cites a path that does
  not exist. It excludes dated records and generated trees, and any
  suppression must state its reason;
- `scripts/record_guard.py` checks that the results records agree with one
  another. Two submissions had been spent with their answers never collected,
  because one fact had to be written by hand into eight places;
- `scripts/reconcile_kaggle.py` notices "a submission nobody wrote down",
  which no offline check can.

What the record shows:

| What happened | Where | The failure |
|---|---|---|
| Lane 10 said dropping the ten `fold?` members would unlock three TTA views. Lane 11 measured twelve members carrying `mirror=0 rotate=0`. The synthesis caught it by setting the two side by side. | synthesis §8.3, at `e4e356c` | facts nobody connected, reached by inference |
| Rows 3 and 4 of lane 12's verdict table have no section behind them. | T047, Result §4 | a verdict with no reasoning |
| Lane 11's efficiency half was not written by the synthesis. It came 90 minutes later, as lane 11b, a null. | T047, Result §3; `5313b79` | a question left open at the decision |
| `--layer-decay` and `--warmup-frac` were wired, and our recipe had never passed them, until round 2 compared a public recipe with ours. Round 3 found they had run once, on a dead arm. | T043:61; RESEARCH-0902b:60; lane 10:27 | a question never asked, then two facts in conflict |
| Round 0921's lane 3 researched SSL pretraining again. Round 3's lane 12 had already rejected it on price. Lane 3 cites lane 12 and reaches the same NO. | 0921 lane 3:20,51 (never committed) | research repeated |
| A submission was registered to read an arm at w = 0.20, though an earlier arm at that weight had moved the score 0.000. Its band, ±0.001, sat on a three-decimal leaderboard. | T118 | an instrument that could not resolve its question |
| After a rename, a configuration key matched no arm. The obvious edit would have scored an unchanged blend, and the record would have gained "a result for a configuration that never executed". It was found by reading, while T118 was being built. As the fix, `assert_every_arm_is_reachable` now checks both directions. | T118 | nearly, a result for a configuration that did not run |
| Two submissions were spent and their answers never collected. | `record_guard.py` | one fact, eight hand writes |
| Review notes sat in `.omc/research/`, "invisible to every other profile and session". A whole round, 0921, was never committed. | T093; the working tree | out of sight |

### AGEIS: research tracks, written by hand

Its T106 gives each **track** one page: the question and the track's status;
the number to beat; a ledger of verdicts, negative ones included; what is
settled; the dead ends; the open questions; and the decisions waiting on the
operator.

The pages are written by hand from PROGRESS.md and task Results. Its verifier
checked about 150 numbers, dates, intervals and verdicts. It found no wrong
numbers and 14 framing errors, among them an inverted verdict (T080) and a
gain that "did not clear 0" (T084). It also found runs committed but in
neither of the project's logs (T105).

### AGE Aris

It reads tasks, transitions and trails. It sees none of a research task's
questions, verdicts or decisions. Its own research line is T072.

### The replay (R0, T074), as the Critic graded it

RSNA's round 3 was recast from prose into a ledger by a script, under a
procedure fixed before any lane report was read. Its evidence is in
`docs/plans/evidence/t074/`.

- **Two misses, which stand.**
  - Lane 10's contradiction was an inference across two questions.
  - Lane 12's rows pointed nowhere.
- **One catch that does not discriminate.**
  - `uncovered` fired on 4 questions and was right once.
  - The choice that decided it, that a document's title is not a section,
    was pinned after the headings were seen.
- **23 of 26 warnings were false.** That is what scanning prose gives, as
  RSNA's own guards had found.
- **It did not test the riskiest assumption**, that lanes keep a ledger as
  they go. The round it replayed spent nothing.

### The diagnosis

The method exists. RSNA mechanised it where a fact must agree with itself
(paths, records), and left it to readers where a line of thought must hold
together: is every question answered, is every verdict argued somewhere, was
it asked before it was answered, and has anyone decided? Those checks are the
gap. And every place a result is written by hand is a place it drifts.

Underneath all of these, the costliest failures are about identity: deciding
that two statements are about the same thing. Facts nobody connected, a
question asked again, a copy that drifted, a band set without the instrument's
step beside it. Prose cannot settle identity: RSNA's scanners "cannot tell ...
which of three numbers on a line belongs to which of two paths". A declared key
settles it, which is how `claims_guard.py` reaches "no false positives by
construction".

## 3. Principles

1. **One line of thought, in sight.** Each question, its verdict and its
   decision sit in one ledger that git tracks. The views are generated from
   it, and the operator rules on it where they see it.
2. **Silence is not health.** The page shows coverage before warnings, so a
   missing verdict shows as a gap.
3. **Files in git are the truth; every view is derived.**
4. **Declared, not scanned.** Checks read lines someone wrote on purpose,
   never prose (RSNA's guards; R0).
5. **One write per fact, one row per key.** The ledger replaces hand copies;
   it is not a ninth one. The page and the STATE.md line are generated.
   PROGRESS.md and Results quote a fact with its id, and `copy-drift` holds
   the quote to the fact.
6. **Conflicts are resolved, never left.** No decision rests on a fact in an
   open conflict, and a resolution names what stands and why.
7. **What counts is decided before the run.** The question's line is in a
   strict ancestor of every commit that answers it.
8. **Precision first.** A check that cries wolf gets switched off (WHY.md),
   so each one carries an incident it must catch, a counterfactual it must not,
   and a floor.
9. **Build the next piece when the record shows it would have changed a
   decision.**
10. **Agent-first, operator-visible.** One command and one JSON summary for
   agents; one page and one queue for the operator.
11. **Research text is untrusted.** ORIENT.md's `data` rules apply.

## 4. Options considered

| Option | Verdict |
|---|---|
| A. Better prose conventions | Rejected. That is today: AGEIS's verifier found 14 errors, and RSNA left a round uncommitted. |
| B. Hand-written track pages | Rejected as the store, because copies drift. Kept as the shape of the generated page. |
| C. A research database in AGE Aris | Rejected. It is a second truth outside git. |
| D. Claims as trail entries | Rejected. Trails are retired at close. |
| E. Claim-grain ledgers written by every lane (v1, v2) | **Deferred to stage 2.** Lanes skip second files (R0's 67 unmarked of 254), and DeepSeek cannot write one at all. |
| F. Claims fenced inside the reports | Rejected. Prose is edited, and parsing Markdown fences identically in two doors is a large surface. |
| G. A decision-grain ledger with one writer, generated pages, and rulings as task actions (v2.1) | Kept, but alone it only keeps the books: it leaves conflicts and repeats to the reader. |
| H. Subjects inferred from noun phrases (R0's `about`) | Rejected. "Members" grouped six unrelated counts; identity guessed from prose is noise. |
| **I. G, plus every claim in a report written as a fact or written off, an auditor over every write-off, identity by shared referent, and checks for conflict and redundancy** | **Chosen as stage 1.** v2.4 had load-bearing facts only, by one writer; R0b showed what that misses (v2.5). |

## 5. Stage 1: the design to build now

### 5.1 The line

```
track      AA/tracks/<slug>.md      the standing question, the number to beat, its status, its objects
 └─ question  T072/Q2               what is asked, its rule, the keys it is about; committed before any lane opens
     ├─ lanes                        prose reports, tracked, each ending in a facts table
     ├─ fact      T072/F7            one claim, quoted from its clause: every clause is a fact or a skip
     ├─ skip      (clauses)          a clause written off, with a reason; the auditor reads every one
     ├─ conflict  (computed)         two live facts on one key disagree; closed by a resolve line or a ruling
     ├─ verdict   T072/V2            written at synthesis: verdict, mark, value, where, the facts it cites, basis
     ├─ decision  T072/D1            the claimant's: adopt · reject · park · follow-up · settle · dead end · reopen
     └─ ruling    (task file)        the operator's, through a task action: park · drop · accept a warning
          └─ question  T067/Q1       the next step of the line
```

### 5.2 The ledger

`AA/findings/T###.jsonl`, one per research task:

- **writers**: the claimant's session, the owner of the task, writes every
  line except `same` and `audit`, through transcriber subagents when a round
  is large, one per document. A lane's work reaches the ledger through the
  claimant, which is the only way DeepSeek's lane can reach it at all. The
  reconciler, a separate subagent, writes only `same` lines; the auditor,
  another, writes only `audit` lines. Neither may have transcribed.
  `research.sh` assigns every id;
- one JSON object per line, append-only. A line is never edited, and the file
  is never retired;
- `.gitattributes` gives the file `merge=union`, and never
  `linguist-generated`, so its diffs stay in sight;
- commits that touch only ledgers start `find: ` and skip hooks (WHY.md: "It
  blocked the trail");
- an unparseable line is skipped and reported.

Every line carries `ts`, `run` and `kind`:

| kind | When | Fields |
|---|---|---|
| `object` | when a thing is first named; a measurand before transcription | `name` (`arms`, `public-lb`, `train.py/--layer-decay`, `rerun-runtime`); `anchor` (`path#symbol@commit`, a submission id, or a URL); `kind` (`config`, `set`, `flag`, `artifact`, `instrument`, `measurand`, `other`); for a measurand, `means` (≤ 240 B: what is measured, on what, by which instrument) |
| `question` | before the first lane opens, committed | `id` (`Q1`); `ask` (≤ 480 B); `prompt` (the lane's prompt, verbatim, when a lane is briefed from it); `about` (the keys it asks about, and `refs`: the definitions, files, flags or identifiers it concerns); `rule`: `answers` (what counts), `marks` (the accepted set) and optionally `instrument`, `reads` (the key it measures) and `band`; `from` (what raised it); `reopens` or `reproduces` (a settled fact or verdict, with why) |
| `fact` | as each lane report lands | `id` (`F1`); `key` (`<object>/<attribute>`, for display); `value` (text: a number is a decimal string, a set is a sorted list); `unit`; `mark`; `where` (`path#heading`, tracked); `at` (the clause it was transcribed from, `<doc>#<n>@commit`); `src` (a list of `path:line@commit`, `path#symbol@commit`, `path:line@worktree#sha256` for an untracked file, `cmd:` with its pathspec, `m:<measurand>`, a submission id or an artifact hash; may be empty, which warns `unsourced`); `premises` (fact ids; required when the mark is INFERRED); `premises_by` (`lane` or `transcriber`); `refs` (identifiers it is about; at least one per `path:line` source, found on that line); `from` (the lane, its run and model); `says` (≤ 240 B, verbatim from the clause at `at`, which `research.sh fact` checks, with `value` found in it) |
| `skip` | as each report lands | `clauses` (clause ids or a range); `why`: `no-claim`, `repeat` (with the fact it repeats, which gains a support), or `quote` (with the clause or fact it quotes) |
| `audit` | for every skip, written by the auditor | `clause`; `finding` (`ok` or `missed`); `why` (≤ 240 B); `measurand` for each fact with a unit and no code referent (`m:<name>` or `none`), assigned without seeing the transcriber's; `run` (the auditor's, which transcribed nothing) |
| `same` | for each linked pair of facts, written by the reconciler | `facts` (ids); `via` (the shared referent); `finding` (`agree`, `conflict` or `unrelated`; for a premise pair, `follows` or `does-not-follow`); `why` (≤ 240 B, quoting the two lines compared); `run` (the reconciler's, which must not be the transcriber's). `agree` with different keys joins the keys |
| `resolve` | to close a conflict | `facts` (the ids in conflict); `stands` (the id that stands, or none); `why` (≤ 240 B). The others are superseded, never deleted |
| `verdict` | at synthesis, one per question | `id` (`V1`); `q`; `verdict` (`answers`, `rejects`, `none-found` or `unresolved`); `mark`; `value` (text; a number is a decimal string); `where` (`path#heading`, tracked); `cites` (fact ids); `src` (a list); `basis` (the lanes, models, methods and sources it rests on); `says` (≤ 240 B) |
| `decision` | when an answer is acted on | `id` (`D1`); `q`; `do` (`adopt`, `reject`, `park`, `follow-up`, `settle`, `dead-end` or `reopen`); `cites` (verdict ids); `task`; `why` (≤ 240 B); `supersedes` |
| `retract` | whenever a line was wrong | `id` (the line it corrects); `why`; `by` (its replacement) |

- **Ids** are global as `T072/Q1`, and may drop the prefix inside their own
  ledger.
- **Identity is computed, not chosen.** Two facts are linked when they share a
  referent:
  - the same enclosing definition of a cited `path:line`: the nearest `def`,
    `class` or `function` line above it at a lower indentation, found by a
    linear scan. In Markdown, it is the enclosing heading. With neither, it is
    the file, which links to every referent in that file;
  - an unpinned citation is pinned to the commit the lane started from, which
    the brief prints and the report states;
  - an INFERRED fact's referents are its premises' referents, so an
    inference links through what it rests on;
  - a `cmd:` search's pattern;
  - a measurand, `m:<name>`, when the transcriber's and the auditor's
    assignments agree; when they differ, the fact links under both and
    `measurand-disputed` fires;
  - the same submission id, artifact hash or URL;
  - a shared entry in `refs`, which is grounded because it must appear in a
    cited line.

  Facts link across documents on any shared referent, and within one
  document on referents they cite themselves. Every INFERRED fact is also
  paired with each of its premises.

  Keys and objects stay as the track's vocabulary, which the brief prints with
  every settled fact, for display and for exact same-key comparison. A wrong
  key costs a label, never a missed link.
- **Which facts:** all of them. `research.sh clauses` cuts every document in
  scope into clauses by a linear scan: sentences, semicolon clauses, table
  cells and headings, outside fenced code. Every clause is disposed of by a
  fact quoting it or by a `skip`. R0b's transcriber, told to write the
  load-bearing facts, wrote 232 and covered 295 of 1,941 clauses that carry a
  claim; four of the corrections it missed were in the other 1,646.
- **Scope:** the round's lane reports, the syntheses it builds on, its lanes'
  prompts, and, closed over citations, every section or definition a fact in
  scope cites. Code enters as its docstrings and comments.
- **Values compare** as decimal strings scaled to integers, sets as sorted
  lists, and text exactly. Two numbers on one key agree within the key's
  `band` when the track registers one, and must match exactly when it does
  not.
- **An instrument** is an object whose `step` (its resolution, such as the
  public leaderboard's 0.001) and, if known, `sd` are facts like any other.
- **Marks:** REPRODUCED, MEASURED, SIMULATED, READ, INFERRED.
- **Verdicts:** `none-found` is RSNA's null lane. `unresolved` is honest, but
  it does not cover a question.
- **Sources** are one of:
  - a URL, unverified;
  - `path:line@commit`, checked offline;
  - `cmd:` with the command and the hash of its output;
  - `claim:` with another line's id.
- **A number** is a decimal string, `-?[0-9]+(\.[0-9]+)?`. jq and Node print
  floating-point numbers differently, and both compute 0.941 − 0.940 as
  0.0010000000000000009 (Architect R6).

### 5.3 The operator's rulings

A ruling is one line in the task file's `## Decisions` section:

```
## Decisions

- 2026-10-14 T072/Q3 park — not answerable before the hub design
- 2026-10-14 T072/Q2 accept-warning registered-late — asked aloud before the lanes, written after
```

- **Written** by an AGE Aris task action, or by hand. It is the operator's
  action on one task file, in one commit, under AGENTS.md's write rules. A
  task in `done/` can still take a ruling, which fixes B5: a closed task's
  ledger takes no more lines, but its task file does.
- **The words** are `adopt`, `reject`, `park`, `drop`, `settle`, `dead-end`,
  `reopen`, `accept-warning <code>`, and `stands` for a conflict
  (`- 2026-10-14 T047/F7 stands over T047/F3 — lane 11 measured; lane 10
  inferred`). The reason after the dash is required.
- **Parsed** line by line, linearly, with nothing that can backtrack. The text
  is untrusted.
- **Precedence:** a ruling outranks a claimant's decision on the same
  question, and the page shows both.

### 5.4 The page

`AA/tracks/<slug>.md`, in the folder named by `tracks:` in `AA.yml` (default
`AA/tracks`), since AGEIS keeps its pages elsewhere. A research task names its
track with `track: <slug>`.

- **The hand-written head**, between `<!-- AA:now -->` markers: the question,
  why it matters, the number to beat, and the status.
- **The generated region**, rendered by `AA/research.sh --write`, top down:
  1. **Coverage**: questions, verdicts, decisions, facts; the task's lanes
     (from its trail) and whether each one's report is tracked.
  2. **Conflicts**: each open one with its facts side by side (value, mark,
     lane, model, where), then the linked pairs waiting to be reconciled. Resolved
     conflicts stay listed below, with what stood and why.
  3. **Decisions waiting on you.**
  4. **Warnings**, with accepted ones shown beside their reasons.
  5. **Open questions**, with their rules.
  6. **Facts by object**, one row per key: the live value, its mark, and every
     fact that supports it. A fact measured twice is one row with two
     supports, which is how redundant data collapses. Superseded facts are
     struck through, with the resolution that ended them.
  7. **Answered**: verdict, mark, value, where it is argued, the facts it
     cites, and its basis.
  8. **Settled, do not reopen**, and **Dead ends**, with why each died. This
     is the computed "do not redo".
  9. **The ledger**, task by task.
- **A JSON summary** sits beside it (`<slug>.json`), for AGE Aris and for
  agents.
- `--check` compares structure only: questions, facts, conflicts, verdicts,
  decisions, rulings and the settled set. No clock, and no uncommitted lines (WHY.md: "It cried
  wolf").
- STATE.md gets one line per active track, rendered by `board.sh` through
  `research.sh`, outside any table.
- Region markers are escaped wherever ledger text is rendered (N6).

### 5.5 The checks

Fourteen checks in two groups. Each is held to an incident on record, where it
must fire, and a counterfactual from the record, where it must stay silent.

**Conflicts and redundancy**, the point of the design:

| Code | Fires when | Incident: must fire | Counterfactual: must stay silent |
|---|---|---|---|
| `conflict` | two live facts on one key, or a pair the reconciler marked `conflict`, disagree beyond the key's band; across every ledger on the board; until a `resolve` line or a ruling | round 2's "never once passed" (RESEARCH-0902b:60), recast as `cmd: git grep -n -- --layer-decay 2b3d2a6 -- src scripts` (no launch), against lane 10's "passed once" (lane 10:27), grounded on `outputs/t025/run_arm.sh:13@worktree#…`; linked through the ref `--layer-decay` | the same pair once a `resolve` lets lane 10's stand and scopes the search to tracked files; two CV reads inside the key's band |
| `unsourced` | a fact other than INFERRED has an empty `src`; a decision whose only support is unsourced facts | lane 11 §2.6, "MEASURED from the checkpoint args", with no path (lane 11:299) | the same fact citing the checkpoint-args dump it was read from |
| `unreconciled` | two live facts from different lanes or tasks share a referent, and no `same` line from a reconciler that did not transcribe covers the pair, once its task has a decision; also when a pass misses a canary | lane 10 §3.3, INFERRED: dropping the ten `fold?` members "unlocks three TTA views" (lane 10:350–351), whose premise §3.4 cites `src/tta.py:116`, against lane 11 §2.6: twelve members carry `0.0` (lane 11:299–300). Linked by the inherited `src/tta.py#unmatched` | the synthesis's catch (RESEARCH-0902c:502–509) written as a `same` line with `finding: conflict`, then a `resolve` with lane 11 standing |
| `decision-on-conflict` | a decision, or a verdict, cites a fact in an open conflict | a fixture: round 3's pool decision (T051) citing lane 10's count before §8.3 | the same decision after the `resolve` |
| `asked-before` | at registration, a question shares a key or a referent with a settled fact or verdict on the board, and declares neither `reopens` nor `reproduces` | round 0921's lane 3, on SSL pretraining, which T047's lane 12 had settled NO on price | the same question with `reopens: T047/V…` and a reason, such as new RadImageNet evidence |
| `copy-drift` | a tracked document quotes a fact as `<value> (T047/F7)` with a different value; or a live, undated document quotes a superseded fact | lane 10:28: `scripts/t042/run_recipe_fold0.sh:7`, a live script, still said "never" once that fact was superseded; as a fixture, quoting its id | `PROGRESS.md:5857` and lane 6 §2.5, dated records that quoted "never" before it was superseded |
| `instrument-unresolved` | a question's `band` is not wider than its instrument's `step`; and, as a note, a settled fact on its `reads` key lies inside the band | T118: ±0.001 on a leaderboard with a step of 0.001 (T118:76, 178–181); the note shows T106's 0.000 at the same weight (T118:25–26) | a structurally distinct configuration read at ±0.007 (T118:78) |
| `untranscribed` | a clause in scope has no fact quoting it and no skip; or its skip was audited `missed`, and no fact or ruling answers that; no verdict may be written on the lanes' questions while one is open | lane 10:349, "or drop the ten `fold?` members, which frees the slot **and** unlocks three TTA views (§3.4)" (`lane10#392`), which R0b's ledger neither wrote nor skipped | the same clause written as an INFERRED fact with §3.4's facts as premises |
| `measurand-disputed` | the transcriber and the auditor assign a fact with a unit and no code referent to different measurands, or one of them assigns none | a fixture: the T047 brief's "bracketed 1.5–4.4 h" (T047:48–49) put on `m:rerun-runtime` by one and on none by the other | both put it on `m:rerun-runtime`, where it links to lane 11's "~113 min" |
| `search-flipped` | a `cmd:` source, re-run at the round's close or at a later round's base, gives a different output; the hash covers each match's file and text, not its line number | "`train.py` has no `--resume`" as `cmd: git grep -e --resume -- src`: no output at `d9c7c6e`, three `train.py` lines at `e4e356c`, added by `f896e38` | `git grep -e --layer-decay -- src`, the same output at `2b3d2a6`, `d9c7c6e` and `e4e356c` although the definition moved from `:812` to `:1020` (checked) |

`copy-drift` reads only the declared marker: the token before `(T###/F#)`,
found by a linear scan with nothing that can backtrack. Prose that quotes a
number without its id is not checked, so the rule for writers is the one
`record_guard.py` arrived at: quote a fact with its id, or link to it.

**Bookkeeping**, from v2.1:

| Code | Fires when | Incident: must fire | Counterfactual: must stay silent |
|---|---|---|---|
| `uncovered` | a question has no `answers`, `rejects` or `none-found` verdict, and no `park` or `drop`, once its task has a decision or is closed; killed tasks are skipped | RSNA T047: the efficiency half, open when round 3 decided | the same question once lane 11b's `none-found` lands (`5313b79`) |
| `where-missing`, `out-of-sight` | a verdict's `where` section is absent or empty at the verdict's commit; or a verdict's `where`, or a verdict's or fact's `src` path, is untracked at that commit and is neither a dated record, nor regenerable by its `cmd:`, nor under the track's `regenerable:` paths | lane 12's rows 3 and 4; RSNA's round 0921, never committed | a file moved after the line was written (T093); a source in `outputs/` that carries its command |
| `registered-late` | a question's line is not in a strict ancestor of the commit of its verdict, or of the first commit of a report section the verdict cites | lane 13, which ran with no brief | lanes 9–12, briefed in T047's claim before their reports |
| `decision-waiting` | a question has a verdict and no decision or ruling | a fixture; it is the operator's queue, not an alarm | the same question with a ruling |

- **The precision floor.** On every real round, each warning is marked real
  or false by hand. A check under 90% is demoted to a note on the page until
  it is fixed.
- **What no check can see**, said plainly:
  - **Two facts about one thing that share no referent**, even through their
    premises: a lane's bare assertion, written with `src: []`, about nothing
    registered as a measurand. It warns `unsourced`, links to nothing, and
    no decision may rest on it alone. A runtime or a rank links through its
    measurand now; a quantity nobody registered still does not. The
    blind reader (§7, r4) counts what still gets through, and S0 plants one
    to count how often it slips.
  - **A claim skipped, and the skip passed by the auditor.** Every clause is
    written down or written off, and every write-off is read by an auditor
    that did not write it. The auditor can still be wrong. Its canary rate
    bounds how often, per round, and the page shows every `ok` it gave.
  - **A claim in a prompt, a chat or a head**, never committed. Lane prompts
    are committed now (`question.prompt`); what was said aloud is not. R0b's
    C6 lived in an uncommitted prompt.
  - **A negative claim about code written without its search.** It cannot
    flip. The auditor marks such a fact `missed`; that is its judgement, not
    a check.
  - **A clause cut wrongly.** The cutter is a linear scan. A sentence it
    splits, or two it joins, changes what one quote covers, not what is
    disposed of.
  - **Premises chosen by the transcriber**, when the lane named none. That is
    identity chosen by a writer again. Such lines carry
    `premises_by: transcriber`, the page shows them, and S0 counts how often
    they are wrong. R0b had 43 of 232.
  - **A launch from a gitignored file**, which no repository search can see.
    Only a fact grounded on the file itself, `@worktree#sha256`, reaches it.
  - **`asked-before` on an idea with no code referent**, such as SSL
    pretraining. It links only by key, which is a label.
  - **A reconciler that marks a real conflict `agree`**, with a plausible
    `why`. Canaries catch a careless pass, not a wrong judgement on a hard
    pair. The blind reader's sample is the check, and the operator sees every
    `agree` on the page.
  - **A question nobody asked**, like the unused flags. Every track carries a
    standing question: "what do we already have, and what have we never
    examined?" Its page lists registered objects with no fact on them, so
    what is known to exist but has never been looked at is in sight.
  - **A result nobody wrote down.** That needs a reconciliation against the
    outside record, which stays in the repository's own scripts, as RSNA's
    `reconcile_kaggle.py` does.

### 5.6 A round, step by step

1. **Register.** The brief's commit is the round's base. The claimant writes the questions, their rules and the keys
   they are about, and commits them before any lane opens. `asked-before` and
   `instrument-unresolved` run here, before anything is spent.
2. **Brief.** `AA/research.sh brief T072` prints:
   - the questions;
   - the base commit, which each report states and unpinned citations pin to;
   - the track's objects, measurands and keys, with every settled fact on
     each;
   - each lane's prompt, which the brief commits as the question's `prompt`
     before the lane opens;
   - the computed settled list and dead ends;
   - the facts table each report ends with;
   - rule 6 verbatim;
   - where reports go.
3. **Lanes** write prose reports into a tracked folder, in any harness and on
   any model, as RSNA's do, ending with the facts table. The operator watches
   the round in AGE Aris: the questions, each lane's trail state, its report's
   headings, and the conflicts as they appear.
4. **Collect.** As each report lands, `research.sh clauses` cuts it, and the
   claimant, or one transcriber per document, disposes of every clause: a
   fact with `research.sh fact`, which pins and checks every citation, finds
   the quote in its clause and the value in the quote, and refuses an
   inference without premises; or a `skip`. Cited sections and definitions
   enter scope as they are cited, and are cut in turn. The facts table a
   lane ends with is read like any other part of its report. Linked pairs and
   repeats show up then, mid-round, not at the end.
5. **Audit.** An auditor subagent that transcribed nothing runs `research.sh
   audit T072`. It gets each document and its skips, with canaries among
   them, but not the facts. It writes an `audit` line per skip, and assigns
   every fact with a unit and no code referent to a measurand or to none. A
   `missed` clause goes back to the claimant. A pass that misses a canary is
   rerun once; a second miss goes to the operator.
6. **Reconcile.** A reconciler subagent that neither transcribed nor
   audited runs `research.sh reconcile T072`. It gets every linked pair and
   every premise pair, with canaries made from this round's facts mixed in,
   unmarked: they
   sit in its view of the ledger, in the ledger's own id sequence, and each
   carries another real value of its unit. It writes a `same` line for each,
   quoting the two lines it compared. Every `cmd:` source is re-run at the
   round's head for `search-flipped`. A pass that
   misses a canary is rejected and rerun once. A second failure escalates to
   the operator. The claimant resolves each conflict, or leaves it for the
   operator.
7. **Synthesise.** The claimant writes a verdict per question, citing the
   section that argues it and the facts it rests on, then the decisions.
   `research.sh --check` comes back clean, or the synthesis answers each
   warning. No decision may cite a fact in an open conflict.
8. **Show.** `research.sh --write` regenerates the page and its JSON, and a
   `find:` commit carries the ledger and the page together.
9. **Rule.** The operator sees conflicts as they appear, read-only while the
   round runs. A task action is refused while any run on the task is live,
   lanes, auditor and reconciler included (AGENTS.md; `lib/workspace.mjs:1449–1465`).
   So when a conflict needs the operator, the round's runs end, the
   claimant's last with `next` naming the conflict. The operator rules in AGE
   Aris, which shows the task file's rulings over the page until the page is
   regenerated. The next session resumes from the ruling.

Experiments use the same lines. A spend's question carries its instrument and
band. The result's verdict is MEASURED, with the command and its output's
hash. The narrative still goes to the log (rule 9), and the log entry cites
the verdict's id instead of copying it.

### 5.7 Simulation, in stage 1

- **A simulation is a lane.** Its report argues; its verdict is SIMULATED.
  RSNA's split-risk simulation (round 1, lane 3) and T118's resolution
  question are the shape.
- **The cheapest instrument goes first.** A question whose answer will be
  bought with a spend names its instrument, the key it reads and its band
  before the spend. `instrument-unresolved` checks the band against the
  instrument's step, and shows any settled fact already inside it.
- **T067's question**, claim races between machines, is a simulation. It runs
  on real clones made from fabricated repositories (`git clone` of a
  `lib/fabricate.mjs` repository), and it belongs to T067.

### 5.8 Doors and constraints

- `AA/research.sh` (bash and jq) is the only implementation in stage 1. It
  ships here first; its copy in the `aa-init` template waits for T004. Other
  repositories adopt it only after T072's measures (N4).
- **AGE Aris reads files**: the page, its JSON, the trails and the report
  headings. It never runs a repository's scripts. Its one write is the
  operator's ruling, a task action.
- **Needs you** gains open conflicts first, then `decision-waiting`, the top
  12 of each with a count, until T062 brings the general cap.
- **Agents** get `research.sh clauses`, `fact`, `skip`, `audit`, `same`,
  `resolve` and `conflicts`. Each
  validates the line before appending it, and `conflicts` prints the open
  ones as JSON.
- **RULES.md stays as it is.** The format lives in `AA/findings/_SCHEMA.md`.

## 6. Stage 2: built only when the record asks for it

Each piece below is designed in v2 (7bfc107, §5). Each is built only when T072
or the T112/T118 replay shows it would have changed a decision:

- claim-grain ledgers written by lanes, with REPRODUCED by re-execution. Only
  a tracked script at a pinned commit may be re-run (N6);
- lanes writing their own fact lines, if the transcription by one writer
  proves the bottleneck;
- spend lines, and the remaining experiment checks:
  - `config-mismatch`;
  - `arm-equals-control`, the general form of RSNA's
    `assert_every_arm_is_reachable`, where a repository emits the hashes of
    its resolved configurations;
  - `verdict-mismatch`, against `reads` thresholds;
- the second door (`lib/research.mjs`, `GET /api/research`) with byte
  conformance, and orient's `research` key;
- L2: agents writing ledgers for planted rounds, in two harnesses.

## 7. How it is verified

- **The corpus.** Every check fires on its incident fixture and stays silent
  on its counterfactual (§5.5). The fixtures are rebuilt with
  `lib/fabricate.mjs` from the record.
- **Precision.** On T072, and on every later round, each warning is marked
  real or false by hand, against the 90% floor.
- **R0b, the round 3 replay with facts, under v2.4: done (T075).** Recall 2
  of 12, precision 17 of 17, and one defect the synthesis missed. Six
  corrections were never transcribed, two had no referent, one sat within a
  document, and one came from a code commit. 13.4 minutes for 232 facts and
  7.3 for 240 pairs (`docs/plans/evidence/t075/grade.md`).
- **R0c, the same replay under v2.5.** The same twelve corrections and the
  same answer key (`docs/plans/evidence/t075/corrections.md`), which no
  subagent reads. RSNA is read through `git show`, plus `cat` for untracked
  files, and nothing in it is written.
  - **Procedure, fixed before any subagent runs:**
    - `sieve.mjs` cuts the eight documents R0b read, at R0b's commits, into
      clauses, and the cut is committed first;
    - fresh transcribers, at most 600 clauses each, dispose of every clause,
      as a fact quoting it or as a skip; citations close the scope, and the
      cited sections and definitions are cut and disposed of in a second
      pass;
    - the track's measurands are registered from the questions and the
      settled record before transcription, by the parent, and listed in the
      corrections file's commit;
    - an auditor that transcribed nothing reads every skip, with canaries,
      and assigns measurands blind;
    - a reconciler that did neither marks every linked and premise pair,
      with in-domain canaries;
    - every `cmd:` source is re-run at `e4e356c`.
  - **Reach:** C6 is out of reach in a replay, because RSNA's lane prompts
    were never committed. So 11 is the most R0c can catch.
  - **Pass:** at least 10 of 12, with the conflict checks above the 90%
    floor, the auditor catching every canary, and every miss tied to a §5.5
    gap.
  - **Recorded:** clauses, facts and skips per document; minutes and tokens
    per subagent; skips audited `missed`; measurand disputes; pairs by kind.
- **S0, a simulation of linking.** `lib/fabricate.mjs` builds a repository
  with source files and a short round of lane reports. It plants five
  conflicts: two reachable only through an inference's premises, as lane 10
  §3.3, one through a negative search, and two described in different words.
  It also plants two shapes the design says it cannot catch: a conflict with
  no shared referent, and an inference whose lane named no premises. And it
  plants three repeats of settled facts and two drifted copies. One
  agent that has not seen the plant writes the facts as claimant; a second
  reconciles. Pass:
  - every planted conflict is linked by a shared referent, and marked
    `conflict` by the reconciler;
  - every repeat is found;
  - at most 1 false warning per 50 facts;
  - the two uncatchable plants are reported: how many slipped, not a pass or
    fail.

  The plant is committed before the agent runs, so the grading is against it.
- **The operator's outcome:**
  - **(o1)** the minutes the operator needs to answer "where are we on X?" from
    the page. The operator times a baseline on today's material, then the same
    question on T072's page. Target: under 2 minutes, and below the baseline;
  - **(o2)** decisions that bound before the operator saw them: an `adopt` or
    `reject` committed before any page showed its verdict waiting. Target: 0
    on questions whose rule names the operator as the one who decides.
- **(r4)** defects that reach a synthesis unflagged, counted by a named blind
  reader: a Critic subagent that reads the synthesis without the checks'
  output.
- **(r6)** research documents that exist only in a working tree. Baseline:
  RSNA, 5 of 65 on 2026-10-13. Target: 0 in a repository that uses stage 1.
- **(r7)** decisions committed while a fact they cite was in an open conflict.
  Target: 0.
- **(r8)** questions asked again without `reopens` or `reproduces`. Baseline:
  RSNA's round 0921, at least 1 of 4 lanes. Target: 0.
- **The pre-mortem's signals**, from the Critic:
  - the share of `unresolved` verdicts;
  - warnings left open on closed tasks;
  - whether stage 1 is in use two weeks after its contract lands.

## 8. Risks

| Risk | Mitigation |
|---|---|
| The claimant writes verdicts carelessly at synthesis | `where-missing` holds each verdict to a tracked section with a body; the blind reader counts what slips through |
| A ninth write | The ledger replaces hand copies: the page and STATE.md line are generated, and the log cites ids |
| Warnings become wallpaper | The precision floor demotes a check; rulings close warnings with reasons |
| Two facts about one thing are labelled differently | Labels do not decide identity; shared referents do (§5.2), and S0 plants differently labelled conflicts on purpose |
| The reconciler waves linked pairs through as `unrelated` | A reconciler that did not transcribe; canaries made from the round's own facts, in the ledger's id sequence within the reconciler's view; every `why` quotes both lines; the blind reader samples real `agree` and `unrelated` marks |
| A ruling is needed while the round runs | Conflicts are visible read-only; the claimant ends its run to wait on the operator; no decision binds on an open conflict meanwhile |
| A common referent, such as `src/train.py#main`, links everything | Facts resolve to the narrowest enclosing definition; a referent linking more than 12 pairs in a round is reported, and its pairs are grouped for one review |
| Facts are transcribed carelessly, or only the convenient ones | Every clause is a fact or a written skip (`untranscribed`); an auditor that wrote none of them reads every skip, and canaries drawn from real facts measure it |
| The auditor waves skips through | Its canaries are real claims presented as skips, so they read like any other; a missed canary reruns the pass, and the page shows every `ok` |
| Bands make every number agree, or nothing agree | A key's band is registered on the track before its facts land, and a band no wider than the instrument's step fires `instrument-unresolved` |
| Transcription becomes the bottleneck | One transcriber per document, at most 600 clauses each: about 27 minutes of wall-clock time for round 3's eight documents, set by lane 9, and measured in R0c; skips are written as ranges; lanes writing their own lines is stage 2, built on evidence |
| Research text steers an agent, or breaks the page | ORIENT.md's `data` rules; escaped markers; linear parsing |
| The ledger's quotes leak competition research | This branch is not pushed before RSNA closes on 2026-10-22 without the operator's word (STATE.md) |

## 9. Phases, each one task

| # | Task | depends | Done when |
|---|---|---|---|
| R0 | Replay of round 3 | — | **Done: T074.** Graded by the Critic (§2) |
| T072 | **Team-scale research, on a hand-written ledger** (D5), facts and objects included | — | its ledger and track page are written by hand in this format; (o1) and precision are measured |
| R0b | **Round 3 replayed with facts**, by a fresh agent and a separate reconciler (§7) | — | **Done: T075.** 2 of 12; the design was revised to v2.5 (T082) |
| R0c | **Round 3 replayed under v2.5**: every clause disposed of, an auditor, measurands, premise pairs (§7) | T082 | at least 10 of 12; or the misses are listed and the operator decides |
| S0 | **The one-writer simulation** (§7) | — | its pass bar is met; or the keying rules are revised before S1b |
| S1a | **The contract and the corpus**: `AA/findings/_SCHEMA.md`, `docs/RESEARCH.md`, and `tests/research/`, with an incident and a counterfactual per check | R0c | the operator has reviewed the cases |
| S1b | **`AA/research.sh` here**: `brief`, `clauses`, `fact`, `skip`, `audit`, `same`, `resolve`, `conflicts`, `--check`, `--write`, the JSON summary, the fourteen checks | S1a, S0 | it passes the corpus; T072's hand-written page and the generated one agree |
| S1c | **In sight**: AGE Aris shows track pages, the round in progress, open conflicts and `decision-waiting` in Needs you; the operator's rulings, `stands` included, as task actions | S1b | e2e passes; the operator resolves a conflict in AGE Aris |
| S1d | **The template**: `research.sh` and the schema in `aa-init` | S1b, T004, T072's measures | a fresh repository writes an empty track page |
| R-T118 | **Replay RSNA's T112 and T118**, the rounds that spent, after RSNA closes | S1b | each stage 2 piece is marked: would it have changed a decision? |

## 10. Decisions for the operator

**Decided 2026-10-13. Each followed the recommendation:**

- **D1:** a findings ledger per task, and generated track pages. v2.1 keeps
  this. What changes is the grain: one writer, deciding per question.
- **D2:** every AA repository, through `aa-init`. v2.1 keeps this as the
  destination, reached after T072's measures (N4).
- **D3:** R0 runs now, by one session with no subagents (T074).
- **D4:** T072 waits for R1b, then runs as the first dogfood. Replaced by D5.
- **D5:** T072 runs now, on a hand-written ledger, as stage 1's first real
  test. The claim-race simulation moves to T067.
- **D6:** stage 1 first, and stage 2 only on evidence. The operator then
  amended it, after reading that v2.1's stage 1 would not flag conflicting
  findings: "i want this fixed fixing conflicted and redundant data is the
  point". So stage 1 now carries facts, conflicts and redundancy (v2.2).

The review was approved to run the same day. T073's rules allow one more
round of each reviewer when the Critic rejects. The Critic's second round on
v2.1 died with no report. Its rerun on v2.2 arrived partial. The operator then
approved a third round, on v2.3, which arrived complete.

**Open:** none. R0b failed v2.4 at 2 of 12. R0c and S0 decide whether v2.5
holds before any code is written.

## ADR

- **Decision:**
  - A decision-grain ledger per research task, with one writer.
  - Questions with their rules are committed before any lane opens. Verdicts
    carry where they are argued, their sources and their basis, then come the
    decisions.
  - Every clause of every report in scope is written as a fact or written
    off as a skip, as each report lands. Each fact quotes its clause and cites
    a pinned source, a `cmd:` search, a measurand, or, for an inference, its
    premises. An auditor that wrote none of it reads every skip, with
    canaries made from real facts. Identity is computed from shared referents (the cited
    definition, identifiers on the cited lines, search patterns, premises,
    submissions, artifacts), never from labels. The page holds one row per
    key, so a repeat is a second support, not a second row.
  - A reconciler that did not transcribe marks every linked pair. Canaries
    made from the round's own facts are mixed in, and a pass that misses one
    is rejected.
  - A ruling waits until no run on the task is live (AGENTS.md); no decision
    binds on an open conflict meanwhile.
  - Conflicts are computed, shown first, and resolved by a line or a ruling.
    No decision may rest on an open one.
  - The operator's rulings are task actions in the task file.
  - A generated track page shows coverage first, then conflicts.
  - Fourteen checks, ten of them for conflict, redundancy and coverage, each with an
    incident, a counterfactual and a precision floor.
  - One door, `AA/research.sh`. AGE Aris reads the files.
  - Stage 2 is built on evidence only.
- **Drivers:**
  - the operator: one structured line of thought, in sight; and "fixing
    conflicted and redundant data is the point";
  - RSNA's and AGEIS's records: facts unconnected, verdicts unargued,
    questions open at decision time, records drifting across eight hand
    writes, a round never committed, a lane spent re-asking a settled
    question;
  - agent-first.
- **Alternatives:** prose conventions; hand-written pages; a database; trail
  entries; claim-grain ledgers by every lane (deferred); claims fenced in
  reports; subjects guessed from noun phrases. §4 gives the reasons.
- **Why chosen:**
  - it is the smallest structure that holds the line of thought together and
    puts it in front of the operator;
  - it adds no write a lane can skip, and no omission nobody sees: every
    clause of a report is disposed of in writing, and the write-offs are
    audited;
  - identity is declared once, so conflicts and repeats are computed, not
    guessed;
  - every check is held to its incident and its counterfactual.
- **Consequences:**
  - a new AA folder and a schema;
  - a third vendored script;
  - a `## Decisions` section the readers parse;
  - two new task actions, a ruling and a conflict's `stands`;
  - a `tracks:` key.
- **Follow-ups:** the stage 2 pieces, each on evidence; a research pipeline
  for plain projects.
