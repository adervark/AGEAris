# Research runs, aggregated: one line of thought, in the operator's sight

**Status: draft v1, under review** (2026-10-13, T073). Nothing here is built.
It was written on `feature/pm-cockpit` at 6856c59, after reading how three
repositories on this machine already do research: RSNA, AGEIS and this one.
Nothing in them was changed. The operator decided D1–D4 the same day (§10),
and approved the review: one Architect, then one Critic. R0, the replay, runs
as T074.

## 1. What the operator asked for

- "Devise a agent first research and simulation strategy for aggregatig
  research runs."
- While it was being drafted: "we mix up shit and keeping it away from my eyes
  without a properly structured line of thought brings terrible inefficiencies
  and lost alpha."

Read together:

- Agents do the research, the simulations and the experiments. Each of them is
  a *run*.
- The runs of one inquiry aggregate into **one line of thought**: question →
  runs → claims with evidence → verdict → decision → the next question.
- The operator sees that line whole, in one place, while it grows.
- An agent reads and writes the same line through files and commands, with no
  interface in between.

## 2. Where it stands, measured

Read on 2026-10-13. Three repositories have arrived at the same need on their
own.

### RSNA: rounds of agent lanes, checked by hand

A Kaggle competition that closes on 2026-10-22. Research runs as **rounds**,
each made of parallel agent **lanes** and one **synthesis**:

- 9 dated research folders and 65 Markdown files under `docs/research/`,
  including 13 syntheses;
- round 1 (its T038): five Opus lanes and one synthesis; round 2 (T043): three
  lanes; round 3 (T047): four briefed lanes, one unbriefed, and one synthesis;
- a second model as a researcher, DeepSeek, through `scripts/ds_research.sh`,
  which writes its deliverable to `.omc/research/<slug>.md` (T088).

Its method is good, and every part of it is done by hand:

- every number carries an evidence mark: READ, MEASURED, REPRODUCED or INFERRED
  (T043; T047 rule 1);
- a lever enters the ranking only with the instrument that would resolve it
  (T047 rule 2);
- a lane that finds nothing reports a null, and the null is a result (T047
  rule 4);
- lanes write as they go, so a killed lane leaves partial evidence (T047);
- the orchestrator re-checks the claims a decision hinges on (T038);
- each new round's brief carries a hand-written table of what is "already
  answered, do not redo" (T047).

What that has cost, from its own records:

| What happened | Where | The failure |
|---|---|---|
| Two lanes disagreed on a count, 10 against 12. The synthesis caught it by reading both. | T047, Result §6 | a contradiction between runs |
| Two verdicts in a lane's table had no section behind them. | T047, Result §4 | a verdict with no evidence |
| A briefed half of a lane, the efficiency track, was never written. | T047, Result §3 | a question nobody answered |
| Training flags that were wired and correct (`--layer-decay`, `--warmup-frac`) were believed never passed, worth a plausible +0.005 to +0.010 for no code. It was found by accident, by diffing a foreign recipe. Round 3 then found one pass, on a dead arm. | T047, lane 10's brief and Result §2 | a finding no run acted on: **lost alpha** |
| A submission was registered to read an arm at w = 0.20, though an earlier arm at the same weight had moved the score 0.000. Whether the instrument could see such an arm at all had not been measured. | T118 | a spend on an instrument that may not answer its question |
| After a rename, a configuration key matched no arm, so the obvious edit would have recorded a result for a configuration that never executed. It was caught while T118 was being built. | T118 | a result for a run that did not happen |
| Run logs, plans, syntheses, reviews and ledgers sat in five places each. Review notes in `.omc/research/` were untracked, "invisible to every other profile and session". | T093 | scattered, and out of sight |

### AGEIS: research tracks, written by hand

Its T106 groups research into **tracks**. Each track has one page with:

- the question and the track's status;
- the number to beat;
- a ledger of verdicts, negative ones included;
- what is settled, and the dead ends;
- the open questions, ranked;
- the decisions waiting on the operator.

The pages are hand-written. Their numbers are copied from PROGRESS.md, and a
verifier pass checks the copies. This is the kind of hand-maintained board
this convention already learned not to keep (RULES.md rule 11; WHY.md, "the
board that ate itself").

### AGE Aris

- It reads tasks, their transitions and the trails. A research task's real
  output, its questions, claims, verdicts and decisions, is invisible to it.
- Its own research line is one task, T072: a single reading pass, with no
  lanes and no simulation.
- It already has what this design needs:
  - the contract-and-corpus method (`docs/ORIENT.md`, `tests/orient/`);
  - the fabricator (`lib/fabricate.mjs`) and the sample project
    (`lib/sample.mjs`);
  - Home's Needs-you ranking (`lib/brief.mjs`).

### The diagnosis

The method exists, but it lives in people's heads and in prose. Every check is
done by a reader. Every view is maintained by hand, and the record is spread
over many places. The line of thought is real, but it has no structure. So
neither an agent nor the operator can see it whole, and what falls between two
documents is lost.

## 3. Principles

1. **One line of thought, in sight.** Every run answers named questions. Every
   finding lands in one tracked ledger, and every view is generated from it.
   Nothing that a decision rests on lives only in scratch, in a transcript or
   in a narrative document.
2. **Files in git are the truth; every view is derived.** As with orient, there
   is no research database. The same commits and the same working tree give
   the same page.
3. **Claims aggregate; documents explain.** A claim is small, structured,
   sourced and marked. Reports and syntheses stay prose, written for people,
   and claims point into them.
4. **What counts is decided before the run.** A question carries its rule:
   what answers it, the weakest evidence accepted, the instrument and the band.
   The rule is committed before any result, so git proves the order. This is
   rule 5, applied to research.
5. **Simulate before you spend.** The cheapest instrument that can resolve a
   question runs first. A spend on an instrument nobody has shown can resolve
   its question is flagged before it happens.
6. **Nulls, corrections and dead ends are results.** They are kept beside what
   they correct. Nothing is dropped, and nothing settled is reopened silently.
7. **Agent-first and operator-visible, through one contract.** Agents write and
   read the line through a command and an API, with JSON in and out. The
   operator sees the same line as one page, and the decisions waiting on them
   in Needs you. The full evidence is one level down.
8. **Research text is untrusted.** Web pages and model output reach other
   agents as quoted data with provenance, never as instructions, under
   ORIENT.md's rules.

## 4. Options considered

| Option | What it is | Verdict |
|---|---|---|
| A. Better prose conventions | RSNA's and AGEIS's practice, written down and followed more carefully | Rejected. This is the situation today: every check stays manual, and nothing aggregates across tasks or repositories. |
| B. Hand-written track pages everywhere | AGEIS's T106, adopted by every repository | Rejected as the store, because copies drift (rule 11). Its page is kept as the shape of the generated view. |
| C. A research database in AGE Aris | claims stored by the server | Rejected. It is a second source of truth outside git. AGE Aris may not write to tracked repositories, and an agent without the server would lose it. |
| D. Claims as a new kind of trail entry | `claim` lines in `AA/checkpoints/T###.jsonl` | Rejected. A trail is retired when its task closes (`_SCHEMA.md`, "Retiring a trail"), and knowledge must outlive its task. The trail records what is in flight; findings record what is known. |
| E. A findings ledger per task, and track pages with a generated region | `AA/findings/T###.jsonl` plus `AA/tracks/<slug>.md`, checked by two doors held to one corpus | **Chosen.** |

## 5. The design

### 5.1 The line, as objects

```
track       AA/tracks/<slug>.md       the standing question, the number to beat, its status
 └─ question    T072.Q2               what is asked, and what will count as its answer
     ├─ run        b8438f28.c1d2      a lane, a simulation, a measurement or an experiment (an AA run)
     │   └─ claim     b8438f28.c1d2/1 one finding: its mark, source, value ± band and verdict
     ├─ retract                       a correction, kept beside the claim it corrects
     └─ decision                      adopt · reject · park · follow-up T### · settle · dead end · reopen
          └─ question  T067.Q1        the next step of the line
```

| Object | Lives in | Written by | When |
|---|---|---|---|
| Track | `AA/tracks/<slug>.md`: a hand-written head and a generated region | the operator or a claimant (head); `research.sh --write` (region) | when the inquiry starts; regenerated on every change |
| Question | a `question` line in its task's ledger | the task's claimant | before any run answers it, committed |
| Run | the task's trail, as today | `ckpt.sh open` | as it starts |
| Claim, retract | lines in the task's ledger | any run of the task | as soon as it is found |
| Decision | a `decision` line in the task's ledger | the task's claimant, in the synthesis | when the answer is acted on |

A research task names its track with `track: <slug>` in its frontmatter. The
key is AGEIS's own, kept as it is. A question raised by one task may be
answered by claims in another task's ledger, because every id below is
global.

### 5.2 The findings ledger

`AA/findings/T###.jsonl`, one file per research task:

- one JSON object per line, append-only. A line is never edited, and the file
  is never retired;
- written only by the task's own runs: its owner's session and subagents
  (rule 2);
- each line is one `write()` under 4 KB, so parallel lanes on one machine
  append without interleaving;
- commits that touch only ledgers start `find: `, so the project's history can
  leave them out, as it does `ckpt: `;
- read like trails: an unparseable line is skipped and reported, and never
  fails the file.

Every line carries `ts`, `run` and `kind`. The kinds:

| kind | Written | Fields |
|---|---|---|
| `question` | by the claimant, before any run answers it | `id` (`Q1`, global `T072.Q1`); `ask`; `rule`: `answers` (what counts), `mark` (the weakest mark accepted), `instrument`, `band`, `unit`, `artifact` (the hash a result must carry), `independent` (how many run families must agree); `from` (the claim or question that raised it); `reopens` |
| `claim` | by any run of the task, as it goes | `id` (`<run>/<n>`); `q`; `mark`; `src`; `says`; `value`, `band`, `unit`; `artifact`; `verdict` (`answers`, `rejects`, `unresolved` or `null`); `where` (the report section or log entry that holds the reasoning) |
| `retract` | by any run of the task | `id` (the claim it corrects); `why`; `by` (the replacing claim, if any) |
| `decision` | by the claimant, in the synthesis | `q`; `do` (`adopt`, `reject`, `park`, `follow-up`, `settle`, `dead-end` or `reopen`); `cites` (claim ids); `task` (a follow-up's id); `why` |

**Marks.** These are RSNA's four, plus two:

- READ: a source says so;
- MEASURED: observed on the real system or data;
- REPRODUCED: an independent run re-ran a recorded measurement and got the
  same result within the band;
- SIMULATED (new): measured on a model of the system, such as synthetic data, a
  fabricated repository or a power calculation;
- INFERRED: reasoned, not observed;
- NULL (new): looked, found nothing.

A question's rule names the weakest mark it accepts.

**Sources.** `src` is one of:

- a URL. There is no network, so it is reported as unverified;
- `path:line@commit`, which can be checked offline;
- `cmd:` plus the command that was run, with `artifact`, the sha256 of what it
  produced;
- `claim:` plus the id of another claim, which is how an INFERRED chain is
  written.

An illustration only. Its findings are placeholders, and its script does not
exist:

```json
{"ts":"2026-10-14T09:00:00Z","run":"b8438f28","kind":"question","id":"Q2","ask":"When two machines claim one task, does the loser's fetch-and-rebase stop on the task file?","rule":{"answers":"yes or no, for each race shape","mark":"SIMULATED","independent":1}}
{"ts":"2026-10-14T10:20:00Z","run":"b8438f28.c1d2","kind":"claim","id":"b8438f28.c1d2/1","q":"Q2","mark":"SIMULATED","src":"cmd:node sim/claim-race.mjs --seeds 200","artifact":"sha256:…","says":"…","verdict":"answers","where":"docs/plans/team-scale.md#claim-races"}
{"ts":"2026-10-14T11:00:00Z","run":"b8438f28","kind":"decision","q":"Q2","do":"follow-up","task":"T067","cites":["b8438f28.c1d2/1"],"why":"…"}
```

### 5.3 Tracks: the page the operator reads

`AA/tracks/<slug>.md`, one per standing line of inquiry. It is built the way
STATE.md is:

- **A hand-written head**, between `<!-- AA:now -->` markers: the track's
  question, why it matters, the number to beat, and its status (`active`,
  `dormant` or `settled`).
- **A generated region**, between `<!-- AA:generated -->` markers. It is
  rendered by `AA/research.sh --write`, and `--check` exits 1 when it is stale
  (rule 11's discipline). It reads top down as the line of thought:
  1. **Decisions waiting on you**: questions whose answers are in and that have
     no decision yet;
  2. **Warnings** (§5.4);
  3. **Open questions, ranked**, each with its instrument and the cheapest run
     that could answer it;
  4. **Answered**: the verdict, the best claim with its mark and source, and how
     many independent run families agree;
  5. **Settled, do not reopen**, and **Dead ends**, each with why it died;
  6. **The ledger**: each task, what it asked, its verdicts, where its evidence
     is, and what it cost.

STATE.md's generated region gains one line per active track: open questions,
decisions waiting, warnings.

**It is live.** `research.sh` and AGE Aris read the working tree, as orient
does. A lane's claims show on the page as the lane writes them, before any
commit and long before the synthesis. Uncommitted lines are marked as such.

AGEIS's pages become this same page, generated. AGEIS adopts it in its own
session, as a `migrate:` commit there; nothing is changed from here.

### 5.4 The checks

Every check is mechanical: no model reads anything. Each has a code, and each
comes from a failure on record (§2). A check is advice, never a block. Git
stays the lock, as it does for orient.

| Code | Fires when | What it would have caught |
|---|---|---|
| `uncovered` | a question of a closed task has no claim with a verdict, and no NULL | RSNA T047: the efficiency half never written |
| `unbacked` | a decision cites no claim, or cites a claim that does not exist | RSNA T047: two verdicts with no section behind them |
| `retracted-cited` | a decision cites a retracted claim | a correction that never reached the decision |
| `contradiction` | two live claims on one question disagree: their verdicts differ, or their values (same unit) are further apart than the question's band | RSNA T047: lanes 10 and 11, 10 against 12 |
| `registered-late` | a question's rule was committed after a claim that answers it, or after a costed `doing` on it | RSNA T118's discipline: bands fixed before any score exists |
| `instrument-unresolved` | a costed `doing` names a question whose rule has a band, and no MEASURED or SIMULATED claim shows the instrument can resolve that band | RSNA T118 |
| `artifact-mismatch` | a result's `artifact` differs from the one its question registered | RSNA T118: a result for a configuration that never executed |
| `single-family` | an answer meets its mark, but fewer independent run families agree than its rule asks | RSNA T038: the orchestrator's re-checks |
| `source-missing` | a `path:line@commit` source names a file absent at that commit, or a line out of range | an invented citation |
| `where-untracked` | a claim's `where` is not tracked in git at HEAD | RSNA T093: notes in `.omc/`, out of sight |
| `reopened-settled` | a question repeats a settled one, by normalised text or by link, without `reopens` | RSNA T047: the hand-written "do not redo" table |
| `orphan-answer` | a question has had its answer for longer than `decide_days` (`AA.yml`, default 7) with no decision | RSNA: wired flags left unused, lost alpha |

- **Families.** Two runs are independent when their root run ids differ. This
  is orient's family rule (agent-brain §5.2): a subagent agreeing with its
  parent is not corroboration. A rule may also ask for different models, which
  the trail's `open` line names.
- **Linking a spend to its question.** The trail gains one optional field, `q`
  on a `doing`: the question the spend answers. `instrument-unresolved` reads
  it.
- **The order of lines** comes from git (`git blame` on an append-only file
  gives each line's commit), not from the self-reported `ts`.
- **Comparing questions** for `reopened-settled` uses linear normalisation
  only: case, whitespace and punctuation. Research text is untrusted, so no
  regex that can backtrack runs on it (AGENTS.md).

### 5.5 Runs: how agents do research

Each step is a command, and each output is a file in sight:

1. **Register.** The claimant writes the task's questions with their rules
   (`AA/research.sh q T072 --ask … --mark SIMULATED --band …`) and commits
   them before any lane starts. Git now proves the rule came first.
2. **Brief.** `AA/research.sh brief T072 --lane races --q Q2,Q3` prints a
   lane's brief: its questions and rules, the track's settled list and dead
   ends (the "do not redo" table, computed), rule 6 verbatim, the ledger's
   format, the budget and the stop rule. Nobody writes that table by hand
   again.
3. **Run the lanes.** Each lane is a run of the task (`ckpt.sh open T072
   --agent races`), in any harness and on any model. It appends claims as it
   finds them, and writes its report into the repository's research folder,
   tracked. A killed lane leaves its claims behind.
4. **Cross-check.** Every claim a decision will hinge on is reproduced by a run
   from another family, such as the orchestrator or another model. Otherwise
   the question's rule says why one family is enough.
5. **Synthesise.** One agent writes the synthesis and appends `decision` lines
   that cite claims. `research.sh --check` comes back clean, or the synthesis
   names each warning and says why it stands.
6. **Show.** `research.sh --write` regenerates the track page, and the commit
   carries it. The operator sees the decisions waiting: on the track page, in
   AGE Aris, and in Needs you.

**Experiments are runs of the same kind.** Their question carries the
instrument, the band and the artifact. Their `doing` names the question, and
their result is a MEASURED claim carrying the artifact's hash. Rule 9 still
puts the narrative in the log, and the claim lands in the same commit and
cites that entry.

**Lanes differ on purpose.** They differ by angle, as RSNA's do: rules,
literature, a code audit, measurement, labels, other people's public work.
On the questions a decision hinges on, they also differ by model; RSNA already
runs DeepSeek beside Claude.

**A round stops by its rules.** The decision rules fix the number of lanes and
the model tiers in advance (rule 5). A round ends when its questions are
covered or its budget is spent. A round in which every lane found a lever is
treated as suspect (RSNA T047 rule 4), so the synthesis says how many lanes
came back null.

### 5.6 Simulation

Simulation does two jobs here.

**A. Inside a line, as an instrument.** A `simulate` run measures a model of
the system rather than the system itself: synthetic data, a power calculation,
a dry run on a tiny input, or a fabricated repository. Its claims are
SIMULATED. Two uses become part of the method:

- **Can the instrument answer?** Before a spend on a question with a band, a
  SIMULATED or MEASURED claim shows that the instrument can separate the
  rule's outcomes at that band. Without one, `instrument-unresolved` fires.
  This is RSNA's T118 question, and its round 1 lane 3's split-risk
  simulation, made routine.
- **Does the configuration run as registered?** A dry run on a tiny input
  produces the artifact hash that the real result must carry later. This is
  RSNA T118's defect, caught before the spend instead of while building.

AGE Aris checks that these claims exist, come first and link up. The
arithmetic stays in the repository's own scripts, and AGE Aris never judges a
domain's mathematics.

For AGE Aris's own research, T067's question (claim races between machines)
can be answered by simulation, more decisively than by reading: fabricated
clones from `lib/fabricate.mjs`, with scripted agents racing to claim. That is
a simulate lane for T072.

**B. Rehearsing the research process itself**, to prove the aggregation before
anything is spent on it. Each rung is cheaper than the next and runs before
it:

| Rung | What | Spend | It proves |
|---|---|---|---|
| L0 corpus | fabricated repositories with scripted ledgers: every check, firing and not firing; the budget; serialization | none; part of `npm test` | the checks are right, in both doors, byte for byte |
| L1 replay | RSNA's round 3 (its T047: five lanes, one synthesis) recast as a ledger by an agent, in a scratch copy, never in RSNA | `agent-fan-out`, small (D3) | the model fits real research: the checks flag what RSNA's synthesis caught by hand |
| L2 planted truth | LLM lanes on fabricated research questions whose answers are planted, with decoys, in fabricated repositories, in two harnesses | `agent-fan-out`, capped as T064 caps it | agents keep the contract: marks right, no invented sources, settled questions not redone, nulls reported |
| L3 dogfood | T072 run on it; then one real round in AGEIS or Gem4A | each repository's own | the measures in §7 move |

L1's pass is fixed now. The checks must flag the three defects that RSNA's
synthesis found by hand (§2: the contradiction, the unbacked verdicts, the
unwritten half). Every other warning is listed, marked real or false.

### 5.7 The doors

| Door | For | Needs | Scope |
|---|---|---|---|
| `AA/research.sh`: `q`, `claim`, `retract`, `decide`, `brief`, `--check`, `--write`, `--json` | any agent in a clone, in any harness | bash, jq and git: what AA already needs | this repository |
| `GET /api/research?project=&track=&q=` and `all=1`, answering `aa.research/1` | agents and scripts beside AGE Aris | the server and its token | one repository, or all |
| AGE Aris: a Research tab per project, a view across projects, and Needs-you items | the operator | a browser | every tracked repository |
| `aa.orient/1`, an added field: `research` warnings on the caller's held tasks | every agent, at start | either orient door | this repository |

- `research.sh` is a third vendored script beside `board.sh` and `ckpt.sh`. It
  ships through the `aa-init` template, which needs T004 first.
- `aa.research/1` reuses ORIENT.md's serialization, provenance and budget
  rules. Its structured fields carry only ids, enums, numbers and times. Text
  goes under `data`, cleaned, capped and tagged with its file and author, and a
  harness that shows `data` to a model says it is quoted. Adding a field to
  `aa.orient/1` keeps that schema at version 1 (agent-brain §5.3).
- AGE Aris only reads. It never writes a ledger or a track page in a tracked
  repository; AGENTS.md's write rule stands.
- Needs you gains two reasons, `decision-waiting` and `research-warning`,
  capped like the others (agent-brain §5.5).
- The sample project gains a research track with simulated history
  (`lib/sample.mjs`). Every check can then be seen on Home without a real
  repository.

### 5.8 What does not change

- **RULES.md stays as it is.** The ledger's format lives in
  `AA/findings/_SCHEMA.md`, as the trail's does, and the checks show where it
  is not followed. A rule is proposed only if L3's measures call for one.
- **Rule 9 stands.** Results land in the log as they are measured. The claim
  line lands in the same commit and cites the log entry.
- **Trails keep their job.** The trail records what is in flight and findings
  record what is known. The only trail change is the optional `q` on a
  `doing`.

## 6. Out of scope here, each its own task if wanted

- **Recognising that two questions mean the same thing.** That is an agent's
  job at brief time, helped by the settled list. The mechanical check catches
  only exact repeats and explicit links.
- **Computing bands.** A repository's scripts do the statistics. AGE Aris
  checks that a band was registered first and that a resolution claim exists.
- **A research pipeline for plain projects**: fan-out lanes routed by the
  scoreboard, a synthesis stage and a reproduce stage (docs/PIPELINE.md).
  After L3.
- **Fetching or archiving web sources.** There is no network, so a URL source
  stays unverified.
- **Rewriting past research in RSNA or AGEIS.** That is for each repository's
  own session.

## 7. How it is verified

- **The corpus (L0).** Every check has fixtures that make it fire and not
  fire. Both doors must give the same bytes.
- **L1's pass**, fixed in §5.6.
- **L2's targets**, fixed now:
  - evidence marks are right on at least 9 claims in 10;
  - no invented `path:line` sources (`source-missing` stays at 0);
  - no settled question is redone when the brief lists it;
  - every planted null is reported as a null.
- **The lost-alpha measures.** They are counted on L1 as the baseline, and
  again after L3:
  - (r1) questions answered before and asked again, per round;
  - (r2) spends flagged `instrument-unresolved`;
  - (r3) results flagged `artifact-mismatch`;
  - (r4) contradictions, unbacked decisions and uncovered questions that
    reached a synthesis without being flagged;
  - (r5) days from an answer to its decision, and the number of
    `orphan-answer`s;
  - (r6) claims whose `where` is out of sight (`where-untracked`).

  Targets: (r2), (r3), (r4) and (r6) at 0 on new rounds, and (r5)'s median
  lower than the baseline.

## 8. Risks

| Risk | Mitigation |
|---|---|
| The log and the ledger drift apart | They land in the same commit. The claim cites the log entry, and the checks read only the ledger. |
| Structure slows exploration down | Only what a decision cites must be a claim. Reports stay free prose, and a NULL is one line. |
| Agents mark or cite wrongly | `source-missing` is checked offline, decisive claims are reproduced by another family, and L2 measures the rate before rollout |
| Research text steers an agent | ORIENT.md's `data` discipline: caps, stripping and provenance |
| Parallel appends interleave | One write per line, under 4 KB; one file per task; one owner per task |
| "Track" is read as "tracked repository" | The interface always says "research track", and the module is `lib/research.mjs` |
| Agent usage competes with RSNA's final week | L1 is small, or waits until RSNA closes on 2026-10-22 (D3) |
| bash and jq get a check subtly wrong | The corpus binds both doors, as it does for orient |

## 9. Phases, each one task

| # | Task | depends | Done when |
|---|---|---|---|
| R0 | **Replay (L1):** RSNA's round 3 recast as a draft ledger in scratch, with a throwaway checker | — | §5.6's pass is met or its miss explained; the baseline measures are in PROGRESS.md |
| R1a | **The contract and the corpus:** `docs/RESEARCH.md` (the ledger, `aa.research/1`, the checks, serialization reused from ORIENT.md) and `tests/research/` | R0 | every check has fixtures; the operator has reviewed the cases |
| R1b | **`AA/research.sh`**, here and in the `aa-init` template, with `_SCHEMA.md` and `decide_days` | R1a, T004 | it passes every corpus case, and this repository's track pages generate |
| R1c | **`lib/research.mjs` and `GET /api/research`**, one repository and `all=1` | R1a | it passes every corpus case |
| R1d | **Conformance:** both doors on every case, byte for byte | R1b, R1c | the test is in `npm test` and passes |
| R2 | **In sight:** the Research tab, the view across projects, Needs-you reasons, STATE.md's track lines and the sample track | R1c | e2e passes; each track reads as one line of thought |
| R3 | **Orient:** `research` warnings in `aa.orient/1` | R1d, T059 | corpus cases added; both doors pass |
| R4 | **Planted truth (L2)**, in two harnesses | R1b | §7's L2 targets are measured and recorded |
| R5 | **Dogfood (L3):** T072 on it (as D4 decides), then one round in AGEIS or Gem4A, through their own sessions | R1b | the lost-alpha measures are taken against R0's baseline |

R0 needs nothing built and runs first. The operator sees track pages in the
repository after R1b, and in AGE Aris after R2.

## 10. Decisions for the operator

**Decided 2026-10-13 by the operator. Each followed the recommendation:**

- **D1:** a findings ledger per task, and track pages with a generated region.
- **D2:** every AA repository, through `aa-init`.
- **D3:** R0 runs now, by one session with no subagents (T074).
- **D4:** T072 waits for R1b, then runs as the first dogfood.

The review of v1, one Architect and then one Critic, was approved to run the
same day.

The decisions as they were put:

- **D1. The shape:** a findings ledger per task (`AA/findings/T###.jsonl`,
  never retired) and track pages with a generated region (`AA/tracks/`).
  - Recommended: yes. The alternatives are §4's B (hand-written pages) and A
    (prose only).
- **D2. Scope:** every AA repository through `aa-init`, or this repository
  alone first.
  - Recommended: every repository. Three of them already reached the same need
    on their own, and each adopts it in its own session.
- **D3. When R0, the RSNA replay, runs.**
  - Recommended: now, by one session with no subagents. Its target is small
    and fixed (three known defects), and it gates everything after it.
  - The alternatives are now with up to 6 lanes, or after RSNA closes on
    2026-10-22, so its final week keeps the shared usage limit.
- **D4. T072.**
  - Recommended: it waits for R1b, then runs as the first dogfood, as lanes
    plus a simulate lane on claim races, with its decision rules amended
    before it is claimed. Nothing waits on T067 or T066 in the meantime.
  - The alternative is to run it now as written, a single reading pass outside
    the ledger.

## ADR

- **Decision:** research, simulation and experiment runs write their findings
  to an append-only ledger per task (`AA/findings/T###.jsonl`). Each ledger
  holds questions with rules committed first, marked and sourced claims,
  retractions and decisions. Track pages (`AA/tracks/`) and `aa.research/1`
  are generated from the ledgers, and twelve mechanical checks are run on
  them. Two doors serve this, `AA/research.sh` and AGE Aris, held to one
  corpus. A simulation ladder proves the design before anything is spent on
  it.
- **Drivers:**
  - the operator: one structured line of thought, in sight;
  - lost alpha, on RSNA's own records (§2);
  - hand-maintained views drift (rule 11);
  - agent-first.
- **Alternatives considered:** prose conventions; hand-written track pages; a
  database in AGE Aris; claims inside trails. §4 gives the reasons.
- **Why chosen:**
  - it turns three repositories' hand-run method into files and checks;
  - it keeps git as the truth;
  - it reuses orient's contract, corpus and serialization;
  - every check answers a failure on record.
- **Consequences:**
  - a third vendored script;
  - a new AA folder, and a schema to version;
  - one optional trail field;
  - a Research tab;
  - the sample project grows a research track.
- **Follow-ups:**
  - a research pipeline for plain projects;
  - recognising when two questions mean the same thing;
  - a rule in RULES.md, if L3's measures call for one.
