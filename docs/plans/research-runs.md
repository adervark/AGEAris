# Research runs, aggregated: one line of thought, in the operator's sight

**Status: draft v2.1** (2026-10-13, T073). Nothing here is built.

- v1 (f9ecde8) was written after reading how RSNA, AGEIS and this repository
  do research.
- R0, a replay of RSNA's round 3, ran as T074. It came back partial.
- An Architect reviewed v1: sound, with required changes R1–R9.
- A Critic reviewed v1 independently: revise, with blocking issues B1–B6
  (`docs/plans/reviews/`).
- v2 (7bfc107) answered the Architect and R0. v2.1 answers the Critic, and
  adopts its "cheapest version" as **stage 1**. Everything else waits as
  **stage 2**, behind evidence.
- The Critic's second round reviews v2.1 (T073's decision rules).

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
| `--layer-decay` and `--warmup-frac` were wired, and our recipe had never passed them, until round 2 compared a public recipe with ours. Round 3 found they had run once, on a dead arm. | T043:61; T047 lane 10 | a question never asked |
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

## 3. Principles

1. **One line of thought, in sight.** Each question, its verdict and its
   decision sit in one ledger that git tracks. The views are generated from
   it, and the operator rules on it where they see it.
2. **Silence is not health.** The page shows coverage before warnings, so a
   missing verdict shows as a gap.
3. **Files in git are the truth; every view is derived.**
4. **Declared, not scanned.** Checks read lines someone wrote on purpose,
   never prose (RSNA's guards; R0).
5. **One write per fact.** The ledger replaces hand copies; it is not a ninth
   one. The page and the STATE.md line are generated, and PROGRESS.md cites
   the verdict's id.
6. **What counts is decided before the run.** The question's line is in a
   strict ancestor of every commit that answers it.
7. **Precision first.** A check that cries wolf gets switched off (WHY.md),
   so each one carries an incident it must catch, a counterfactual it must not,
   and a floor.
8. **Build the next piece when the record shows it would have changed a
   decision.**
9. **Agent-first, operator-visible.** One command and one JSON summary for
   agents; one page and one queue for the operator.
10. **Research text is untrusted.** ORIENT.md's `data` rules apply.

## 4. Options considered

| Option | Verdict |
|---|---|
| A. Better prose conventions | Rejected. That is today: AGEIS's verifier found 14 errors, and RSNA left a round uncommitted. |
| B. Hand-written track pages | Rejected as the store, because copies drift. Kept as the shape of the generated page. |
| C. A research database in AGE Aris | Rejected. It is a second truth outside git. |
| D. Claims as trail entries | Rejected. Trails are retired at close. |
| E. Claim-grain ledgers written by every lane (v1, v2) | **Deferred to stage 2.** Lanes skip second files (R0's 67 unmarked of 254), and DeepSeek cannot write one at all. |
| F. Claims fenced inside the reports | Rejected. Prose is edited, and parsing Markdown fences identically in two doors is a large surface. |
| **G. A decision-grain ledger with one writer, generated pages, and rulings as task actions** | **Chosen as stage 1.** |

## 5. Stage 1: the design to build now

### 5.1 The line

```
track      AA/tracks/<slug>.md      the standing question, the number to beat, its status
 └─ question  T072/Q2               what is asked, and its rule; committed before any lane opens
     ├─ lanes                        prose reports, tracked; their runs are on the task's trail
     ├─ verdict   T072/V2            written at synthesis: verdict, mark, value, where, src, basis
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
| `question` | before the first lane opens, committed | `id` (`Q1`); `ask` (≤ 480 B); `rule`: `answers` (what counts), `marks` (the accepted set) and optionally `instrument` and `band`; `from` (what raised it); `same-as`; `reopens` |
| `verdict` | at synthesis, one per question | `id` (`V1`); `q`; `verdict` (`answers`, `rejects`, `none-found` or `unresolved`); `mark`; `value` (text; a number is a decimal string); `where` (`path#heading`, tracked); `src` (a list); `basis` (the lanes, models, methods and sources it rests on); `says` (≤ 240 B) |
| `decision` | when an answer is acted on | `id` (`D1`); `q`; `do` (`adopt`, `reject`, `park`, `follow-up`, `settle`, `dead-end` or `reopen`); `cites` (verdict ids); `task`; `why` (≤ 240 B); `supersedes` |
| `retract` | whenever a line was wrong | `id` (the line it corrects); `why`; `by` (its replacement) |

- **Ids** are global as `T072/Q1`, and may drop the prefix inside their own
  ledger.
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
  `reopen` and `accept-warning <code>`. The reason after the dash is
  required.
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
  1. **Coverage**: questions, verdicts, decisions; the task's lanes (from its
     trail) and whether each one's report is tracked.
  2. **Decisions waiting on you.**
  3. **Warnings**, with accepted ones shown beside their reasons.
  4. **Open questions**, with their rules.
  5. **Answered**: verdict, mark, value, where it is argued, its sources, and
     its basis. Verdicts about the same thing sit side by side, which is how
     lane 10's error would have shown (N5).
  6. **Settled, do not reopen**, and **Dead ends**, with why each died. This
     is the computed "do not redo".
  7. **The ledger**, task by task.
- **A JSON summary** sits beside it (`<slug>.json`), for AGE Aris and for
  agents.
- `--check` compares structure only: questions, verdicts, decisions, rulings
  and the settled set. No clock, and no uncommitted lines (WHY.md: "It cried
  wolf").
- STATE.md gets one line per active track, rendered by `board.sh` through
  `research.sh`, outside any table.
- Region markers are escaped wherever ledger text is rendered (N6).

### 5.5 The four checks

| Code | Fires when | Incident: must fire | Counterfactual: must stay silent |
|---|---|---|---|
| `uncovered` | a question has no `answers`, `rejects` or `none-found` verdict, and no `park` or `drop`, once its task has a decision or is closed; killed tasks are skipped | RSNA T047: the efficiency half, open when round 3 decided | the same question once lane 11b's `none-found` lands (`5313b79`) |
| `where-missing`, `out-of-sight` | a verdict's `where` section is absent or empty at the verdict's commit; or its `where` or a `src` path is untracked at that commit and is neither a dated record nor regenerable by its `cmd:` | lane 12's rows 3 and 4; RSNA's round 0921, never committed | a file moved after the line was written (T093); a source in `outputs/` that carries its command |
| `registered-late` | a question's line is not in a strict ancestor of the commit of its verdict, or of the first commit of a report section the verdict cites | lane 13, which ran with no brief | lanes 9–12, briefed in T047's claim before their reports |
| `decision-waiting` | a question has a verdict and no decision or ruling | a fixture; it is the operator's queue, not an alarm | the same question with a ruling |

- **The precision floor.** On every real round, each warning is marked real
  or false by hand. A check under 90% is demoted to a note on the page until
  it is fixed.
- **What no check can see:** a question nobody asked, like the unused flags,
  and a result nobody wrote down. The first gets a standing question on every
  track: "what do we already have, and what have we never examined?" The
  second needs a reconciliation against the outside record, which stays in
  the repository's own scripts, as RSNA's `reconcile_kaggle.py` does.

### 5.6 A round, step by step

1. **Register.** The claimant writes the questions and their rules, and
   commits them before any lane opens.
2. **Brief.** `AA/research.sh brief T072` prints:
   - the questions;
   - the computed settled list and dead ends;
   - rule 6 verbatim;
   - where reports go.
3. **Lanes** write prose reports into a tracked folder, in any harness and on
   any model, as RSNA's do. The operator watches the round in AGE Aris: the
   questions, each lane's trail state, and its report's headings as they
   land.
4. **Synthesise.** The claimant writes a verdict per question, citing the
   section that argues it, then the decisions. `research.sh --check` comes
   back clean, or the synthesis answers each warning.
5. **Show.** `research.sh --write` regenerates the page and its JSON, and a
   `find:` commit carries the ledger and the page together.
6. **Rule.** The operator reads the waiting decisions, in AGE Aris or on the
   page, and rules through a task action.

Experiments use the same lines. A spend's question carries its instrument and
band. The result's verdict is MEASURED, with the command and its output's
hash. The narrative still goes to the log (rule 9), and the log entry cites
the verdict's id instead of copying it.

### 5.7 Simulation, in stage 1

- **A simulation is a lane.** Its report argues; its verdict is SIMULATED.
  RSNA's split-risk simulation (round 1, lane 3) and T118's resolution
  question are the shape.
- **The cheapest instrument goes first.** A question whose answer will be
  bought with a spend names its instrument and band before the spend.
  Checking that the band is resolvable is stage 2.
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
- **Needs you** gains `decision-waiting`, the top 12 with a count, until T062
  brings the general cap.
- **RULES.md stays as it is.** The format lives in `AA/findings/_SCHEMA.md`.

## 6. Stage 2: built only when the record asks for it

Each piece below is designed in v2 (7bfc107, §5). Each is built only when T072
or the T112/T118 replay shows it would have changed a decision:

- claim-grain ledgers written by lanes, with REPRODUCED by re-execution. Only
  a tracked script at a pinned commit may be re-run (N6);
- subjects, and `contradiction` on the quantities the track's head registers;
- spend lines, and the experiment checks:
  - `instrument-unresolved`, with an explicit `resolved_by` and the
    instrument's step;
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
| Stage 2 never comes, and contradictions stay found by hand | The page sets verdicts on the same thing side by side; stage 2 is built on evidence, not by date |
| Research text steers an agent, or breaks the page | ORIENT.md's `data` rules; escaped markers; linear parsing |
| The ledger's quotes leak competition research | This branch is not pushed before RSNA closes on 2026-10-22 without the operator's word (STATE.md) |

## 9. Phases, each one task

| # | Task | depends | Done when |
|---|---|---|---|
| R0 | Replay of round 3 | — | **Done: T074.** Graded by the Critic (§2) |
| T072 | **Team-scale research, on a hand-written ledger** (D5) | — | its ledger and track page are written by hand in this format; (o1) and precision are measured |
| S1a | **The contract and the corpus**: `AA/findings/_SCHEMA.md`, `docs/RESEARCH.md`, and `tests/research/`, with an incident and a counterfactual per check | — | the operator has reviewed the cases |
| S1b | **`AA/research.sh` here**: `brief`, `--check`, `--write`, the JSON summary, the four checks | S1a | it passes the corpus; T072's hand-written page and the generated one agree |
| S1c | **In sight**: AGE Aris shows track pages, the round in progress, and `decision-waiting`; the operator's ruling as a task action | S1b | e2e passes; the operator rules on a question in AGE Aris |
| S1d | **The template**: `research.sh` and the schema in `aa-init` | S1b, T004, T072's measures | a fresh repository writes an empty track page |
| R-T118 | **Replay RSNA's T112 and T118**, the rounds that spent, after RSNA closes | S1b | each stage 2 piece is marked: would it have changed a decision? |

## 10. Decisions for the operator

**Decided 2026-10-13. Each followed the recommendation:**

- **D1:** a findings ledger per task, and generated track pages. v2.1 keeps
  this. What changes is the grain: one writer, deciding per question.
- **D2:** every AA repository, through `aa-init`. v2.1 keeps this as the
  destination, reached after T072's measures (N4).
- **D3:** R0 runs now, by one session with no subagents (T074).
- **D4:** T072 waits for R1b, then runs as the first dogfood. **D5 below
  would replace it.**

The review was approved to run the same day. T073's rules allow one more
round of each reviewer when the Critic rejects.

**Open:**

- **D5. Run T072 now, on a hand-written ledger.**
  - Both reviewers recommend it (S4, N2). Stage 1's format needs no tooling
    to be written by hand. T066 and T067 stop waiting on tools, and T072
    becomes stage 1's first real test.
  - The claim-race simulation moves to T067.
  - The alternative is to keep D4.
- **D6. Build stage 1 first, and stage 2 only on evidence.**
  - Recommended: yes. It follows the Critic's cheapest version and RSNA's own
    lessons.
  - The alternative is v2's full design, built in order.

## ADR

- **Decision:**
  - A decision-grain ledger per research task, with one writer.
  - Questions with their rules are committed before any lane opens. Verdicts
    carry where they are argued, their sources and their basis, then come the
    decisions.
  - The operator's rulings are task actions in the task file.
  - A generated track page shows coverage first, and verdicts on the same
    thing side by side.
  - Four checks, each with an incident, a counterfactual and a precision
    floor.
  - One door, `AA/research.sh`. AGE Aris reads the files.
  - Stage 2 is built on evidence only.
- **Drivers:**
  - the operator: one structured line of thought, in sight;
  - RSNA's and AGEIS's records: facts unconnected, verdicts unargued,
    questions open at decision time, records drifting across eight hand
    writes, a round never committed;
  - agent-first.
- **Alternatives:** prose conventions; hand-written pages; a database; trail
  entries; claim-grain ledgers by every lane (deferred); claims fenced in
  reports. §4 gives the reasons.
- **Why chosen:**
  - it is the smallest structure that holds the line of thought together and
    puts it in front of the operator;
  - it adds no write a lane can skip;
  - every check is held to its incident and its counterfactual.
- **Consequences:**
  - a new AA folder and a schema;
  - a third vendored script;
  - a `## Decisions` section the readers parse;
  - a new task action;
  - a `tracks:` key.
- **Follow-ups:** the stage 2 pieces, each on evidence; a research pipeline
  for plain projects.
