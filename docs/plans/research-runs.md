# Research runs, aggregated: one line of thought, in the operator's sight

**Status: draft v2.2** (2026-10-13, T073). Nothing here is built.

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
3. **Seven new checks** (§5.5), each with its incident on record:
   - `conflict`: two live facts on one key disagree;
   - `unreconciled`: two facts from different lanes or tasks share a
     referent, a definition, a flag, a file or a submission, whatever their
     labels, and nobody has said whether they agree (lanes 10 and 11, 10
     against 12, linked through `src/tta.py#unmatched`);
   - `decision-on-conflict`: a decision rests on a fact in an open conflict;
   - `asked-before`: a new question is about a settled key, and does not say
     it reopens it (round 0921 re-asked SSL pretraining);
   - `measured-again`: a spend re-measures a settled key without asking for a
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
| **I. G, plus load-bearing facts declared against object keys by the same one writer, one row per key, and checks for conflict and redundancy** | **Chosen as stage 1.** |

## 5. Stage 1: the design to build now

### 5.1 The line

```
track      AA/tracks/<slug>.md      the standing question, the number to beat, its status, its objects
 └─ question  T072/Q2               what is asked, its rule, the keys it is about; committed before any lane opens
     ├─ lanes                        prose reports, tracked, each ending in a facts table
     ├─ fact      T072/F7            one load-bearing fact, against a key: written as each report lands
     ├─ conflict  (computed)         two live facts on one key disagree; closed by a resolve line or a ruling
     ├─ verdict   T072/V2            written at synthesis: verdict, mark, value, where, the facts it cites, basis
     ├─ decision  T072/D1            the claimant's: adopt · reject · park · follow-up · settle · dead end · reopen
     └─ ruling    (task file)        the operator's, through a task action: park · drop · accept a warning
          └─ question  T067/Q1       the next step of the line
```

### 5.2 The ledger

`AA/findings/T###.jsonl`, one per research task:

- **one writer**: the claimant's session, the owner of the task. A
  subagent's work reaches the ledger through the claimant, which is the only
  way DeepSeek's lane can reach it at all;
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
| `object` | when a thing is first named | `name` (`arms`, `public-lb`, `train.py/--layer-decay`); `anchor` (`path#symbol@commit`, a submission id, or a URL); `kind` (`config`, `set`, `flag`, `artifact`, `instrument`, `other`) |
| `question` | before the first lane opens, committed | `id` (`Q1`); `ask` (≤ 480 B); `about` (the keys it asks about, and `refs`: the definitions, files, flags or identifiers it concerns); `rule`: `answers` (what counts), `marks` (the accepted set) and optionally `instrument`, `reads` (the key it measures) and `band`; `from` (what raised it); `reopens` or `reproduces` (a settled fact or verdict, with why) |
| `fact` | as each lane report lands | `id` (`F1`); `key` (`<object>/<attribute>`, for display); `value` (text: a number is a decimal string, a set is a sorted list); `unit`; `mark`; `where` (`path#heading`, tracked); `src` (a list; required unless the mark is INFERRED); `refs` (identifiers it is about, each found in a cited line); `from` (the lane, its run and model); `says` (≤ 240 B) |
| `same` | for each linked pair of facts | `facts` (ids); `via` (the shared referent); `finding` (`agree`, `conflict` or `unrelated`); `why` (≤ 240 B). `agree` with different keys joins the keys |
| `resolve` | to close a conflict | `facts` (the ids in conflict); `stands` (the id that stands, or none); `why` (≤ 240 B). The others are superseded, never deleted |
| `verdict` | at synthesis, one per question | `id` (`V1`); `q`; `verdict` (`answers`, `rejects`, `none-found` or `unresolved`); `mark`; `value` (text; a number is a decimal string); `where` (`path#heading`, tracked); `cites` (fact ids); `src` (a list); `basis` (the lanes, models, methods and sources it rests on); `says` (≤ 240 B) |
| `decision` | when an answer is acted on | `id` (`D1`); `q`; `do` (`adopt`, `reject`, `park`, `follow-up`, `settle`, `dead-end` or `reopen`); `cites` (verdict ids); `task`; `why` (≤ 240 B); `supersedes` |
| `retract` | whenever a line was wrong | `id` (the line it corrects); `why`; `by` (its replacement) |

- **Ids** are global as `T072/Q1`, and may drop the prefix inside their own
  ledger.
- **Identity is computed, not chosen.** Two facts are linked when they share a
  referent:
  - the same enclosing definition of a cited `path:line`, found by a linear
    scan up to the nearest `def`, `class` or `function` line, or the file when
    there is none;
  - the same submission id, artifact hash or URL;
  - a shared entry in `refs`, which is grounded because it must appear in a
    cited line.

  Keys and objects stay as the track's vocabulary, which the brief prints with
  every settled fact, for display and for exact same-key comparison. A wrong
  key costs a label, never a missed link.
- **Which facts:** the load-bearing ones, those a verdict, a decision or a
  spend rests on. Typically 5 to 15 a lane, not R0's 254 claims.
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

Eleven checks in two groups. Each is held to an incident on record, where it
must fire, and a counterfactual from the record, where it must stay silent.

**Conflicts and redundancy**, the point of the design:

| Code | Fires when | Incident: must fire | Counterfactual: must stay silent |
|---|---|---|---|
| `conflict` | two live facts on one key, or on keys a `same` line joined, disagree beyond the key's band; across every ledger on the board; until a `resolve` line or a ruling | round 2 measured `train.py/--layer-decay` "never once passed" (RESEARCH-0902b:60); round 3's lane 10 found it passed once (lane 10:27) | the same two facts once a `resolve` names lane 10's as standing; two CV reads inside the key's band |
| `unreconciled` | two live facts from different lanes or tasks share a referent, and no `same` line covers the pair, once its task has a decision; also when a reconcile pass misses a canary | lane 10 §3.4: "the ten `fold?` members record `mirror=0.0 rotate=0.0`" (`src/tta.py:116`) against lane 11 §2.6: "the other 12 (`armb0`×2, `fold0-4`×2) carry `0.0`" (`src/tta.py:110`), linked by `src/tta.py#unmatched` and by `refs` `mirror` and `rotate` | the synthesis's catch written as a `same` line with `finding: conflict`, which opens a `conflict`, then a `resolve` with 12 standing |
| `decision-on-conflict` | a decision, or a verdict, cites a fact in an open conflict | a fixture: round 3's pool decision (T051) citing lane 10's count before §8.3 | the same decision after the `resolve` |
| `asked-before` | at registration, a question shares a key or a referent with a settled fact or verdict on the board, and declares neither `reopens` nor `reproduces` | round 0921's lane 3, on SSL pretraining, which T047's lane 12 had settled NO on price | the same question with `reopens: T047/V…` and a reason, such as new RadImageNet evidence |
| `measured-again` | a spend's question `reads` a key, or the configuration or submission behind it, that already has a settled fact, and does not ask for a reproduction | a fixture from the record: a second leaderboard read of an unchanged configuration | the same read registered with `reproduces` |
| `copy-drift` | a tracked document quotes a fact as `<value> (T047/F7)`, and the value differs from the fact's; or a live document quotes a superseded fact | AGEIS T106: the hand-written page inverted T080's verdict; RSNA T108's Result read "Not run" while two submissions had been spent | the quote that matches; a dated record quoting a fact that was later superseded |
| `instrument-unresolved` | a question's `band` is not wider than its instrument's `step`; and, as a note, a settled fact on its `reads` key lies inside the band | T118: ±0.001 on a leaderboard with a step of 0.001 (T118:76, 178–181); the note shows T106's 0.000 at the same weight (T118:25–26) | a structurally distinct configuration read at ±0.007 (T118:78) |

`copy-drift` reads only the declared marker: the token before `(T###/F#)`,
found by a linear scan with nothing that can backtrack. Prose that quotes a
number without its id is not checked, so the rule for writers is the one
`record_guard.py` arrived at: quote a fact with its id, or link to it.

**Bookkeeping**, from v2.1:

| Code | Fires when | Incident: must fire | Counterfactual: must stay silent |
|---|---|---|---|
| `uncovered` | a question has no `answers`, `rejects` or `none-found` verdict, and no `park` or `drop`, once its task has a decision or is closed; killed tasks are skipped | RSNA T047: the efficiency half, open when round 3 decided | the same question once lane 11b's `none-found` lands (`5313b79`) |
| `where-missing`, `out-of-sight` | a verdict's `where` section is absent or empty at the verdict's commit; or its `where` or a `src` path is untracked at that commit and is neither a dated record nor regenerable by its `cmd:` | lane 12's rows 3 and 4; RSNA's round 0921, never committed | a file moved after the line was written (T093); a source in `outputs/` that carries its command |
| `registered-late` | a question's line is not in a strict ancestor of the commit of its verdict, or of the first commit of a report section the verdict cites | lane 13, which ran with no brief | lanes 9–12, briefed in T047's claim before their reports |
| `decision-waiting` | a question has a verdict and no decision or ruling | a fixture; it is the operator's queue, not an alarm | the same question with a ruling |

- **The precision floor.** On every real round, each warning is marked real
  or false by hand. A check under 90% is demoted to a note on the page until
  it is fixed.
- **What no check can see**, said plainly:
  - **Two facts about one thing that cite nothing in common.** Linking needs a
    shared definition, identifier or artifact. A fact with no source is
    INFERRED, and an INFERRED fact cannot carry a decision alone
    (`decision-on-conflict` treats an unsupported INFERRED citation as open).
    The blind reader (§7, r4) counts what still gets through, and S0 measures
    it before any code.
  - **A question nobody asked**, like the unused flags. Every track carries a
    standing question: "what do we already have, and what have we never
    examined?" Its page lists registered objects with no fact on them, so
    what is known to exist but has never been looked at is in sight.
  - **A result nobody wrote down.** That needs a reconciliation against the
    outside record, which stays in the repository's own scripts, as RSNA's
    `reconcile_kaggle.py` does.

### 5.6 A round, step by step

1. **Register.** The claimant writes the questions, their rules and the keys
   they are about, and commits them before any lane opens. `asked-before` and
   `instrument-unresolved` run here, before anything is spent.
2. **Brief.** `AA/research.sh brief T072` prints:
   - the questions;
   - the track's objects and keys, with every settled fact on each;
   - the computed settled list and dead ends;
   - the facts table each report ends with;
   - rule 6 verbatim;
   - where reports go.
3. **Lanes** write prose reports into a tracked folder, in any harness and on
   any model, as RSNA's do, ending with the facts table. The operator watches
   the round in AGE Aris: the questions, each lane's trail state, its report's
   headings, and the conflicts as they appear.
4. **Collect.** As each report lands, the claimant writes its facts into the
   ledger with `research.sh fact`, choosing keys from the vocabulary, or
   adding an object. A lane with no table is transcribed from its prose.
   Conflicts and repeats show up then, mid-round, not at the end.
5. **Reconcile.** `research.sh reconcile T072` lists every linked pair of
   facts from different lanes, with the canaries mixed in, unmarked. The
   claimant, or a reconciler subagent, writes a `same` line for each. A pass
   that misses a canary is rejected and rerun. Each conflict is resolved, or
   left open for the operator.
6. **Synthesise.** The claimant writes a verdict per question, citing the
   section that argues it and the facts it rests on, then the decisions.
   `research.sh --check` comes back clean, or the synthesis answers each
   warning. No decision may cite a fact in an open conflict.
7. **Show.** `research.sh --write` regenerates the page and its JSON, and a
   `find:` commit carries the ledger and the page together.
8. **Rule.** The operator reads the open conflicts and the waiting decisions,
   in AGE Aris or on the page, and rules through a task action.

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
- **Agents** get `research.sh fact`, `same`, `resolve` and `conflicts`. Each
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
- **R0b, the round 3 replay with facts.** One session, no subagents, RSNA read
  through `git show` only. It writes round 3's load-bearing facts by hand
  under a procedure fixed before the reports are read: the object vocabulary
  comes from T047's brief alone. Pass: `unreconciled` fires on `arms`
  (10 against 12), `conflict` fires on round 2's "never passed" against lane
  10's "passed once", and the conflict checks stay above the 90% floor.
- **S0, a simulation of linking.** `lib/fabricate.mjs` builds a repository
  with source files and a short round of lane reports. It plants five
  conflicts, two of them reachable only by inference, as 10 against 12, and
  two deliberately described in different words. It also plants three
  repeats of settled facts and two drifted copies. An agent that has not seen
  the plant writes the facts as claimant. Pass:
  - every planted conflict is linked by a shared referent, and marked
    `conflict` by the reconcile pass;
  - every repeat is found;
  - at most 1 false warning per 50 facts.

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
| The reconciler waves linked pairs through as `unrelated` | Canaries in every pass; a missed canary rejects the pass |
| A common referent, such as `src/train.py#main`, links everything | Facts resolve to the narrowest enclosing definition; a referent linking more than 12 pairs in a round is reported, and its pairs are grouped for one review |
| Facts are transcribed carelessly, or only the convenient ones | A verdict must cite the facts it rests on; a lane's facts table is in its report, beside its ledger lines, for the blind reader to compare |
| Bands make every number agree, or nothing agree | A key's band is registered on the track before its facts land, and a band no wider than the instrument's step fires `instrument-unresolved` |
| Transcription becomes the bottleneck | Facts are load-bearing only, 5 to 15 a lane; lanes writing their own lines is stage 2, built on evidence |
| Research text steers an agent, or breaks the page | ORIENT.md's `data` rules; escaped markers; linear parsing |
| The ledger's quotes leak competition research | This branch is not pushed before RSNA closes on 2026-10-22 without the operator's word (STATE.md) |

## 9. Phases, each one task

| # | Task | depends | Done when |
|---|---|---|---|
| R0 | Replay of round 3 | — | **Done: T074.** Graded by the Critic (§2) |
| T072 | **Team-scale research, on a hand-written ledger** (D5), facts and objects included | — | its ledger and track page are written by hand in this format; (o1) and precision are measured |
| R0b | **Round 3 replayed with facts**, by hand (§7) | — | `unreconciled` and `conflict` fire on their incidents, above the floor; or the design is revised |
| S0 | **The one-writer simulation** (§7) | — | its pass bar is met; or the keying rules are revised before S1b |
| S1a | **The contract and the corpus**: `AA/findings/_SCHEMA.md`, `docs/RESEARCH.md`, and `tests/research/`, with an incident and a counterfactual per check | R0b | the operator has reviewed the cases |
| S1b | **`AA/research.sh` here**: `brief`, `fact`, `same`, `resolve`, `conflicts`, `--check`, `--write`, the JSON summary, the eleven checks | S1a, S0 | it passes the corpus; T072's hand-written page and the generated one agree |
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
round of each reviewer when the Critic rejects. The Critic's second round
died with no report, and reruns on v2.2.

**Open:** none. R0b and S0 decide whether the keying holds before any code is
written.

## ADR

- **Decision:**
  - A decision-grain ledger per research task, with one writer.
  - Questions with their rules are committed before any lane opens. Verdicts
    carry where they are argued, their sources and their basis, then come the
    decisions.
  - Load-bearing facts are written by one writer as each report lands, each
    citing its source. Identity is computed from shared referents (the cited
    definition, identifiers grounded in the cited lines, submissions,
    artifacts), never from labels. The page holds one row per key, so a
    repeat is a second support, not a second row.
  - Every reconcile pass carries canaries, and a pass that misses one is
    rejected.
  - Conflicts are computed, shown first, and resolved by a line or a ruling.
    No decision may rest on an open one.
  - The operator's rulings are task actions in the task file.
  - A generated track page shows coverage first, then conflicts.
  - Eleven checks, seven of them for conflict and redundancy, each with an
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
  - it adds no write a lane can skip: a facts table sits in the report it
    already writes, and one writer keys every fact;
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
