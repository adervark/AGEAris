# Research runs, aggregated: one line of thought, in the operator's sight

**Status: draft v2** (2026-10-13, T073). Nothing here is built.

- v1 (f9ecde8) was written after reading how three repositories on this
  machine do research: RSNA, AGEIS and this one. Nothing in them was changed.
- The operator decided D1–D4 the same day (§10).
- R0, a replay of RSNA's round 3, ran as T074. It came back partial: v1's
  checks caught 1 of 3 defects.
- An Architect reviewed v1: sound, with required changes R1–R9
  (`docs/plans/reviews/research-runs-v1-architect.md`).
- v2 answers both. A Critic's review of v1 is running, and v2.1 will answer
  it.

## Changes since v1

v1 reused machinery built for work in flight to hold evidence, which must be
permanent and exact. Run families stood in for identity, the trail fed the
checks, and numbers were serialized as whole numbers only (Architect, root
cause). Most of what follows comes from that, or from R0.

1. **Independence means re-execution** (R1; R0). A REPRODUCED claim names the
   claim it reproduces, comes from a different run, and carries its own
   source and artifact. `unreproduced` replaces `single-family`, and claims
   record their model. In R0 all five lanes of a round were one family.
2. **Ids are global** (R2). They are `T###/Q1`, `T###/<run>/<n>` and
   `T###/<subject>`. Decisions on one question combine through `supersedes`,
   and `decision-conflict` catches the rest. Ledgers merge as a union of
   lines, and stay visible in diffs (S6).
3. **A ledger stands alone** (R3). Each costed `doing` also writes a `spend`
   line to the ledger. The checks read ledgers only, so retiring a trail
   cannot change a page.
4. **Each check is credited honestly** (R4; R0):
   - `contradiction` is keyed on registered **subjects** as well as
     questions;
   - `where-missing` is new, for lane 12's case;
   - `config` is split from `artifact`, and `arm-equals-control` is new, for
     T118;
   - `orphan-answer` is gone: it had no failure on record, and a warning
     driven by the clock cries wolf;
   - a contradiction reached by inference, like lane 10's, is not mechanical.
     The page shows every claim on a subject side by side, so the reader sees
     it.
5. **Every check is decidable** (R5):
   - accepted marks are a set;
   - the verdicts are words, never JSON null;
   - lateness is decided by commit ancestry;
   - reopening a question needs an explicit `same-as`;
   - `uncovered` fires at the first decision;
   - out-of-sight is judged at the commit that added the line.
6. **Numbers are decimal strings**, compared exactly (R6). jq 1.8.1 and Node
   print `1.0`, `0.10` and `1e-7` differently. In both, 0.941 − 0.940 is
   0.0010000000000000009, which would reverse T118's registered reading.
7. **The page avoids the gate's two traps** (R7; WHY.md):
   - `--check` compares structure only;
   - `find:` commits skip hooks;
   - `board.sh` renders the track lines itself, outside any table.
8. **Targets cannot be met by leaving fields out** (R8):
   - there are coverage targets;
   - (r1) is checked by hand on a sample;
   - L2 is graded against its planted truth;
   - false-positive ceilings are fixed now.

   The evidence gate moves from replaying prose (R0) to agents writing
   ledgers with planted defects (L2).
9. **Phases** (R9; S1):
   - `research.sh` ships here first, and only its template copy waits for
     T004;
   - the page's Needs-you items bring their own cap;
   - a round in another repository waits for L2;
   - the checks that need experiments come after L2.
10. **Verdicts are derived** where a rule has thresholds (S2). **The track
    folder is configurable** (S3). **Orient's key** is placed as S5 says.
11. **Silence is not health.** A lane that skips the ledger must not leave a
    page that looks clean (the Architect, item 1). The page shows coverage
    before warnings.
12. **§2's facts are corrected** against the Architect's citation check, and
    one finding is added: RSNA's newest round was never committed.
13. **D4 is put back to the operator** as D5 (S4).

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

- 9 dated research folders under `docs/research/`, holding 65 Markdown files.
  60 of them are tracked. **The newest round, 0921, with four lanes and its
  synthesis, has never been committed**; it exists in one working tree only;
- round 1 (its T038) had six lane reports: lane 0 by the orchestrator, five by
  Opus lanes. Round 2 (T043) had three lanes; round 3 (T047) four briefed lanes
  and one unbriefed. Each round had a synthesis;
- a second model researches too: DeepSeek, through `scripts/ds_research.sh`.
  It still writes to the untracked `.omc/research/<slug>.md` (T088;
  `ds_research.sh:85`).

Its method is good, and every part of it is done by hand:

- evidence marks: READ, MEASURED and INFERRED (T038, T043), with REPRODUCED
  added in round 3 (T047 rule 1);
- a lever is ranked only with the instrument that would resolve it, and one
  without an instrument is ranked last, never dropped (T047 rule 2);
- a lane that finds nothing reports a null, and the null is a result (T047
  rule 4);
- lanes write as they go (T047);
- the orchestrator, the lanes' parent session, re-checks the claims a decision
  hinges on (T038);
- round 3's brief carries a hand-written table of what is "already answered,
  do not redo" (T047).

What that has cost, from its own records:

| What happened | Where | The failure |
|---|---|---|
| Lane 10 said dropping the ten `fold?` members would unlock three TTA views. Lane 11 measured twelve members carrying `mirror=0 rotate=0`, so two blockers would remain. The synthesis caught it by setting the two side by side. | RSNA synthesis §8.3, at `e4e356c` | a contradiction reached by inference: lane 10 never stated a count |
| Rows 3 and 4 of lane 12's verdict table have no section behind them; the report goes from §2 to §5. | T047, Result §4 | a verdict with no reasoning |
| Lane 11's efficiency half was never written. | T047, Result §3 | a question nobody answered |
| `--layer-decay` and `--warmup-frac` were wired and unused until round 2 found them by diffing a foreign recipe. It registered T042 the same day. Round 3 then showed the claim "never passed" was itself false. | T043:61; T047 lane 10 §2.1 | a capability nobody examined: **a question never asked** |
| A submission was registered to read an arm at w = 0.20, though an earlier arm at that weight had moved the score 0.000. Its band, ±0.001, sat on a leaderboard that prints three decimals. | T118 | an instrument that could not resolve its question |
| After a rename, a configuration key matched no arm. The obvious edit would have recorded a result for a configuration that never executed. An assertion caught it while T118 was being built. | T118 | a result for a configuration that did not run |
| Run logs lay in five places (T093's map; its title says five for every kind). Review notes in `.omc/research/` were "invisible to every other profile and session". | T093 | out of sight |

### AGEIS: research tracks, written by hand

Its T106 groups research into **tracks**. Each track has one page with:

- the question and the track's status;
- the number to beat;
- a ledger of verdicts, negative ones included;
- what is settled, and the dead ends;
- the open questions, ranked;
- the decisions waiting on the operator.

The pages are written by hand, with numbers copied from PROGRESS.md and task
Results. Its verifier checked about 150 numbers, dates, intervals and verdicts.
It found 14 framing errors, among them an inverted verdict (T080) and a gain
that "did not clear 0" (T084). It also found runs committed but logged nowhere
(T105). This is the hand-maintained board the convention already learned not
to keep (RULES.md rule 11; WHY.md, "the board that ate itself").

### AGE Aris

- It reads tasks, transitions and trails. A research task's questions, claims,
  verdicts and decisions are invisible to it.
- Its own research line is one task, T072.
- It has the parts this design reuses:
  - the contract-and-corpus method (`docs/ORIENT.md`, `tests/orient/`);
  - the fabricator and the sample project (`lib/fabricate.mjs`,
    `lib/sample.mjs`);
  - Home's Needs-you ranking (`lib/brief.mjs`).

### The replay (R0, T074)

RSNA's round 3 was recast as a ledger by a script. The script applied a
procedure fixed before any lane report was read, and its evidence is in
`docs/plans/evidence/t074/`. **v1's checks caught 1 of the 3 defects** that
round 3's synthesis found by hand: the unwritten efficiency half.

It missed the other two:

- lanes 10 and 11 answered different questions, and v1 compared claims only
  within one question. Lane 10's error was an inference, not a stated count;
- lane 12's rows 3 and 4 pointed nowhere, and nothing in v1 needed them to.

It also measured a baseline:

- 4 of the 22 `path:line` sources the lanes cite are out of sight, and one of
  them is now gone from disk;
- 67 of 254 claims carry no evidence mark.

### The diagnosis

The method exists, but it lives in people's heads and in prose. Every check is
done by a reader. Every view is kept by hand, and the record is spread over
many places, some of them never committed. The line of thought is real, but it
has no structure. Neither an agent nor the operator can see it whole, and what
falls between two documents is lost.

## 3. Principles

1. **One line of thought, in sight.** Every run answers named questions. Every
   finding lands in a tracked ledger, and every view is generated from the
   ledgers. Nothing a decision rests on lives only in scratch, in a transcript
   or in a narrative document.
2. **Silence is not health.** The page shows coverage before warnings. An
   empty ledger reads as missing evidence, never as a clean bill.
3. **Files in git are the truth; every view is derived.** There is no research
   database. The same commits and the same working tree give the same page.
4. **Claims aggregate; documents explain.** A claim is small, structured,
   sourced and marked. Reports stay prose, written for people, and each claim
   names the section that argues it.
5. **What counts is decided before the run.** A question carries its rule, and
   the rule's commit is an ancestor of every claim and spend on it. This is
   rule 5, applied to research.
6. **Simulate before you spend.** The cheapest instrument that can resolve a
   question runs first. A spend on an instrument that cannot resolve its band
   is flagged before it happens.
7. **Nulls, corrections and dead ends are results.** They are kept beside what
   they correct, and nothing settled is reopened silently.
8. **Evidence is not work in flight.** Its ids, its idea of independence and
   its numbers are exact and permanent. None of them borrows from the trail.
9. **Agent-first and operator-visible, through one contract.** Agents write
   and read the line through a command and an API. The operator sees the same
   line as one page, and the decisions waiting on them in Needs you.
10. **Research text is untrusted.** It reaches other agents as quoted data
    with provenance, under ORIENT.md's rules.

## 4. Options considered

| Option | What it is | Verdict |
|---|---|---|
| A. Better prose conventions | RSNA's and AGEIS's practice, written down and followed more carefully | Rejected. This is today, and AGEIS's verifier still found 14 framing errors. |
| B. Hand-written track pages everywhere | AGEIS's T106 | Rejected as the store, because copies drift. Its page is kept as the shape of the generated view. |
| C. A research database in AGE Aris | claims stored by the server | Rejected. It is a second truth outside git; AGE Aris may not write to tracked repositories, and an agent without the server would lose it. |
| D. Claims as trail entries | `claim` lines in `AA/checkpoints/` | Rejected. A trail is retired at close, and knowledge must outlive its task. |
| F. Claims inside the reports | a fenced claim block closing the section that argues it (the Architect's antithesis) | Rejected. Prose is edited, so claims could change silently. Order would need `git blame` on prose. Parsing fences out of untrusted Markdown identically in jq and Node is a larger surface. **E takes two things from it:** a mandatory, checked `where`, and a brief that prints a ready claim command for each question. |
| E. A ledger per task, and generated track pages | `AA/findings/T###.jsonl` and `AA/tracks/<slug>.md`, checked by two doors held to one corpus | **Chosen.** |

## 5. The design

### 5.1 The line, as objects

```
track       AA/tracks/<slug>.md          the standing question, the number to beat, its status
 ├─ subject     T047/fold-blockers       a quantity or a set that claims state values about
 └─ question    T072/Q2                  what is asked, and what will count as its answer
     ├─ spend      (ledger line)         a costed act on the question, written with its `doing`
     ├─ claim      T072/b8438f28.c1d2/1  one finding: mark, verdict, source, where, value ± band
     │   └─ claim  (REPRODUCED)          the same measurement, run again by another run
     ├─ retract                          a correction, kept beside the claim it corrects
     └─ decision                         adopt · reject · park · follow-up · settle · dead end · reopen
          └─ question  T067/Q1           the next step of the line
```

| Object | Lives in | Written by | When |
|---|---|---|---|
| Track | `AA/tracks/<slug>.md`: a hand-written head, a generated region | the operator or a claimant (head); `research.sh --write` (region) | when the inquiry starts |
| Subject | a `subject` line in the ledger of the task that first needs it | that task's runs | before a claim states a value about it |
| Question | a `question` line in its task's ledger | the task's claimant | before any run answers it, committed |
| Spend | a `spend` line, written by `ckpt.sh log … doing --q` | the run that spends | before the act |
| Claim, retract | lines in the task's ledger | any run of the task | as soon as it is found |
| Decision | a `decision` line in the task's ledger | the task's claimant | when an answer is acted on |

- A research task names its track with `track: <slug>`, AGEIS's own key.
- **Ids are global.** A question is `T072/Q2`, a claim `T072/<run>/<n>`, a
  subject `T047/<name>`. Run ids repeat across tasks, because one session
  working on two tasks has one run id. So the task prefix is part of the id.
  Inside its own ledger, an id may drop the prefix.

### 5.2 The findings ledger

`AA/findings/T###.jsonl`, one per research task:

- one JSON object per line, append-only. A line is never edited, and the file
  is never retired;
- written only by the task's own runs (rule 2). Each line is one `write()`
  under 4 KB;
- `.gitattributes` gives it `merge=union`, as the trails have, and never
  `linguist-generated`, so its diffs stay in sight. A union merge is safe
  because ids cannot collide;
- commits that touch only ledgers start `find: ` and skip hooks, as `ckpt:`
  commits do (WHY.md);
- read like trails: an unparseable line is skipped and reported, and never
  fails the file.

Every line carries `ts`, `run` and `kind`. The kinds:

| kind | Written | Fields |
|---|---|---|
| `subject` | before a claim states a value about it | `id`; `what` (≤ 160 B); `unit`; `same-as` (when two names turn out to be one subject) |
| `question` | by the claimant, before any run answers it | `id`; `ask`; `rule`, below; `from` (what raised it); `same-as` (an explicit repeat) and `reopens` |
| `spend` | by `ckpt.sh log … doing --q`, with the `doing` | `q`; `cost`; `model`; `config` |
| `claim` | by any run of the task, as it goes | `id`; `q`; `mark`; `verdict`; `src`; `says`; `where`; `subject`, `value`, `band`, `unit`; `config`, `artifact`; `reproduces`; `model` |
| `retract` | by any run of the task | `id` (the claim it corrects); `why`; `by` (the replacing claim, if any) |
| `decision` | by the claimant | `q`; `do` (`adopt`, `reject`, `park`, `follow-up`, `settle`, `dead-end` or `reopen`); `cites` (claim ids); `task`; `why`; `supersedes` |

**A question's rule:**

- `answers`: what counts;
- `marks`: the set of accepted marks;
- `subject` and `unit`, when the answer is a value;
- `instrument`, `step` (the smallest difference it can show) and `band`;
- `resolved_by`: the claim showing the instrument resolves the band;
- `reads`: thresholds that decide the verdict from the value, such as
  `[{"at_least": "0.948", "verdict": "answers"}, {"at_most": "0.934", "verdict": "rejects"}]`;
- `config`: the hash of the resolved configuration a result must carry;
- `reproduce`: whether a decision on it needs a REPRODUCED claim.

**Marks** describe where a claim's evidence comes from:

- REPRODUCED: another run re-ran the recorded command, with its own source
  and artifact, and got the same within the band;
- MEASURED: observed on the real system or data;
- SIMULATED: measured on a model of the system, such as synthetic data, a
  fabricated repository or a power calculation;
- READ: a source says so;
- INFERRED: reasoned, not observed.

**Verdicts** are what a claim concludes:

- `answers`, `rejects` or `unresolved`;
- `none-found`: looked, found nothing. This is RSNA's null lane, named so it
  can never read as JSON null;
- `finding`: reports without deciding.

A claim with `answers`, `rejects` or `unresolved` must have a `where`.

**Sources** (`src`) are one of:

- a URL, which is unverified, because there is no network;
- `path:line@commit`, which is checked offline;
- `cmd:` with the command, plus the `artifact`, the sha256 of its output;
- `claim:` with another claim's id.

**Numbers** (`value`, `band`, `step` and thresholds) are decimal strings,
matching `-?[0-9]+(\.[0-9]+)?`. They are compared exactly, as integers scaled
to the longer fraction, and printed as written. Both doors therefore give the
same bytes and the same verdicts (R6).

An illustration only; its findings are placeholders, and its script does not
exist:

```json
{"ts":"2026-10-14T09:00:00Z","run":"b8438f28","kind":"question","id":"Q2","ask":"When two machines claim one task, does the loser's fetch-and-rebase stop on the task file?","rule":{"answers":"yes or no, for each race shape","marks":["SIMULATED","MEASURED"],"reproduce":true}}
{"ts":"2026-10-14T10:20:00Z","run":"b8438f28.c1d2","kind":"claim","id":"b8438f28.c1d2/1","q":"Q2","mark":"SIMULATED","verdict":"answers","src":"cmd:node sim/claim-race.mjs --seeds 200","artifact":"sha256:…","says":"…","where":"docs/plans/team-scale.md#claim-races","model":"opus"}
{"ts":"2026-10-14T10:50:00Z","run":"b8438f28.e9f0","kind":"claim","id":"b8438f28.e9f0/1","q":"Q2","mark":"REPRODUCED","verdict":"answers","reproduces":"b8438f28.c1d2/1","src":"cmd:node sim/claim-race.mjs --seeds 200","artifact":"sha256:…","says":"…","where":"docs/plans/team-scale.md#claim-races","model":"sonnet"}
{"ts":"2026-10-14T11:00:00Z","run":"b8438f28","kind":"decision","q":"Q2","do":"follow-up","task":"T067","cites":["b8438f28.c1d2/1","b8438f28.e9f0/1"],"why":"…"}
```

### 5.3 Tracks: the page the operator reads

`AA/tracks/<slug>.md`, one per standing line of inquiry. The folder is the
`tracks:` key in `AA.yml` (default `AA/tracks`), because AGEIS keeps its pages
in `docs/research/tracks/` and links them from many places (S3). The page is
built like STATE.md:

- **A hand-written head**, between `<!-- AA:now -->` markers: the track's
  question, why it matters, the number to beat and its status (`active`,
  `dormant` or `settled`).
- **A generated region**, rendered by `AA/research.sh --write`. It reads top
  down as the line of thought:
  1. **Coverage**: how many questions are open; how many claims, how many of
     them reproduced; how many lanes, and which wrote no ledger line. An empty
     ledger shows as a gap.
  2. **Decisions waiting on you**: answered questions with no decision, and
     for how long.
  3. **Warnings** (§5.4).
  4. **Facts, side by side**: for each subject, every claim's value with its
     lane, mark and section. This is how a contradiction reached by
     inference, like lane 10's, becomes visible.
  5. **Open questions, ranked**, each with its instrument and the cheapest
     run that could answer it.
  6. **Answered**: the verdict, the best claim, and whether it was
     reproduced.
  7. **Settled, do not reopen**, and **Dead ends**, each with why it died.
  8. **The ledger**: each task, what it asked, its verdicts, its evidence and
     its cost.
- **The gate does not cry wolf** (R7, WHY.md). `--check` compares structure
  only: questions, subjects, decisions and the settled set. Claims, warnings
  and ages change all through a round, and they are rendered but not checked.
- **It is live.** The doors read the working tree, so a lane's claims show up
  as it writes them, marked uncommitted until they land.
- **STATE.md gains one line per active track.** It shows open questions,
  decisions waiting and warnings. `board.sh` renders the line itself, by
  sourcing `research.sh` as it sources `ckpt.sh`, outside any table.
  `board.sh --write` owns the whole region, and orient reads table rows
  (R7).

### 5.4 The checks

Every check is mechanical: no model reads anything. Each has a code, and each
either names the failure on record it answers or is marked preventive. A check
is advice, never a block.

**The core**, built first. These need no experiment data:

| Code | Fires when | On record |
|---|---|---|
| `uncovered` | a question has no claim beyond `finding`s and no `none-found`, once its task has a decision or is closed. Killed tasks are skipped. | RSNA T047: lane 11's efficiency half. R0 caught it. |
| `where-missing` | a claim with `answers`, `rejects` or `unresolved` has no `where`, or its section is absent or empty at the claim's commit | RSNA T047: lane 12's rows 3 and 4. R0 missed it under v1. |
| `contradiction` | on one question, a live `answers` and a live `rejects`; or on one subject, two live values further apart than the band. Never against `none-found`. | preventive. Lane 10's case was an inference, and it shows under "Facts, side by side". |
| `unbacked` | a decision cites nothing, a claim that does not exist, or a retracted one | preventive |
| `registered-late` | a question's line is not in a strict ancestor of the commit of a claim or spend on it. A shared commit, an uncommitted question and incomparable branches all count. | RSNA T047: lane 13 ran with no brief. R0 caught it. |
| `out-of-sight` | a claim's `where`, or a `src` path, is untracked at the commit that added the line | RSNA: 4 of 22 sources (R0); round 0921 never committed |
| `source-missing` | a `path:line@commit` names a file absent at that commit, or a line out of range | RSNA: `outputs/t028/run_density.sh` (R0) |

**Experiments**, built after L2. These need spend lines, configurations and
thresholds:

| Code | Fires when | On record |
|---|---|---|
| `instrument-unresolved` | a spend names a question whose band ≤ its step, or whose `resolved_by` claim is missing, or is neither MEASURED nor SIMULATED | RSNA T118: ±0.001 on a three-decimal leaderboard |
| `config-mismatch` | a result's `config` differs from the one its question registered | RSNA T118's class |
| `arm-equals-control` | two arms of one experiment carry the same `config` | RSNA T118: an edit that matched no key left the arm identical to the control |
| `verdict-mismatch` | a question has `reads`, and a claim's verdict differs from the one its value derives | AGEIS T106: T080's inverted verdict |
| `unreproduced` | a decision cites a claim whose rule asks for reproduction, and no REPRODUCED claim from another run names it | RSNA T038's re-checks, made explicit |

**Across ledgers:**

| Code | Fires when | On record |
|---|---|---|
| `decision-conflict` | two live decisions on one question differ, and neither supersedes the other | preventive (R2) |
| `reopened-settled` | a question is `same-as` a settled one, or repeats it after normalisation, without `reopens` | preventive; round 3's hand-written table |

`subject-new` is not a warning. It lists the subjects first registered in a
round, so the synthesis can merge two names for one thing with `same-as`.

- **Normalising text**, for `reopened-settled`, folds case, whitespace and
  punctuation in one linear pass. Research text is untrusted, so no regex
  that can backtrack runs on it (AGENTS.md).
- **What no check can see.** A question never asked, like the training flags
  nobody examined for weeks, leaves no line to check. A track can carry a
  standing audit question (§5.5), but only a person or an agent can decide to
  ask.

### 5.5 Runs: how agents do research

Each step is a command, and each output is a file in sight:

1. **Register.** The claimant writes the task's questions and the subjects
   they touch, with their rules, and commits them before any lane starts.
   Commit ancestry now proves the rule came first.
2. **Brief.** `AA/research.sh brief T072 --lane races --q Q2,Q3` prints a
   lane's brief:
   - its questions, rules and subjects;
   - the track's settled list and dead ends;
   - rule 6 verbatim;
   - the format;
   - for each question, a ready `research.sh claim` command with `--q`
     filled. That cuts the double entry (from F).
3. **Run the lanes.** Each lane is a run of the task, in any harness and on
   any model. It writes a claim line as soon as it finds something. Each
   claim's `where` names the section that argues it, in a report tracked in
   the repository.
4. **Reproduce.** Where a rule asks for it, a different run re-executes the
   recorded command and writes a REPRODUCED claim with `reproduces`, and with
   its own source and artifact. Who runs it is not what makes it
   independent; the re-execution is.
5. **Synthesise.** One agent writes the synthesis and appends `decision` lines
   that cite claims. `research.sh --check` comes back clean, or the synthesis
   answers each warning.
6. **Show.** `research.sh --write` regenerates the page, and a `find:` commit
   carries it.

**Experiments are runs of the same kind.**

- Their question carries the instrument, step, band, `resolved_by`, `config`
  and `reads`.
- `ckpt.sh log … doing --q Q2` writes the trail's `doing` and the ledger's
  `spend` line together.
- A dry run produces the `config` hash: the hash of the resolved
  configuration, never of the output.
- The result carries both `config` and `artifact`.
- The narrative goes to the log (rule 9), in the same commit as the claim.

**Lanes differ on purpose**, by angle and, where a decision hinges on it, by
model.

**A standing audit question** can be registered on any track: "what in our own
system has never been examined?" RSNA's lane 10 asked it once and found the
correction about the flags.

**A round stops by its rules.** The decision rules fix the lanes and model
tiers in advance. The synthesis reports how many lanes came back
`none-found`, because a round in which every lane found a lever is suspect
(RSNA T047 rule 4).

### 5.6 Simulation

**A. Inside a line, as an instrument.** A `simulate` run measures a model of
the system. Its claims are SIMULATED.

- **Can the instrument answer?**
  - A band no larger than the instrument's step is unresolvable by
    construction. T118's ±0.001 on a leaderboard that prints three decimals
    was one.
  - Otherwise a SIMULATED or MEASURED claim, named by `resolved_by`, shows the
    band can be resolved. Without it, `instrument-unresolved` fires before the
    spend.
- **Does the configuration run as registered?** A dry run hashes the resolved
  configuration. `config-mismatch` and `arm-equals-control` then catch T118's
  case before a slot is spent.
- **AGE Aris checks presence, order and linkage only.** The arithmetic stays
  in the repository's own scripts.
- **T067's question** (claim races between machines) is answered best by
  simulation, with fabricated clones from `lib/fabricate.mjs`. That
  simulation belongs to T067 (S4).

**B. Rehearsing the research process itself.** Each rung is cheaper than the
next:

| Rung | What | Spend | It proves |
|---|---|---|---|
| L0 corpus | fabricated repositories with written ledgers: every check, firing and not; the budget; decimals; serialization | none; part of `npm test` | the checks are right, in both doors, byte for byte |
| L1 replay | **done (T074).** RSNA's round 3, recast from prose | done | v1 caught 1 of 3, and five changes followed. A replay of prose cannot test fields that lanes must write, so it is not repeated. |
| L2 planted truth, **the gate** | agents write ledgers for fabricated research rounds in two harnesses. Planted in them: an unwritten half, a verdict whose section is missing, two values on one subject outside the band, a band no larger than its step, and an arm equal to its control. | `agent-fan-out`, capped as T064 caps it | agents keep the contract, and the checks catch what is planted |
| L3 dogfood | a round here, then one round in another repository, through its own session | each repository's own | the measures in §7 move |

**L2's pass, fixed now:**

- every planted defect is flagged;
- at most 1 false warning per 50 claims;
- evidence marks are right on at least 9 claims in 10;
- no invented `path:line` source.

It is graded against the planted truth, never by the checks themselves (R8).

### 5.7 The doors

| Door | For | Needs | Scope |
|---|---|---|---|
| `AA/research.sh`: `subject`, `q`, `claim`, `retract`, `decide`, `brief`, `--check`, `--write`, `--json` | any agent in a clone, in any harness | bash, jq, git | this repository |
| `GET /api/research?project=&track=&q=` and `all=1`, answering `aa.research/1` | agents and scripts beside AGE Aris | the server and its token | one repository, or all |
| AGE Aris: a Research tab per project, a view across projects, and Needs-you items | the operator | a browser | every tracked repository |
| `aa.orient/1`, an added key, `research` | every agent, at start | either orient door | this repository |

- **`research.sh`** is a third vendored script beside `board.sh` and
  `ckpt.sh`. It ships here first (R1b). Only its copy in the `aa-init`
  template waits for T004.
- **`aa.research/1`** reuses ORIENT.md's serialization, provenance and budget
  rules, and adds decimal strings. Text goes under `data`, cleaned, capped and
  tagged with its file and author.
- **Orient's `research` key** (S5):
  - it is present only when not empty, placed after `warnings`, and cut
    before `take`;
  - the findings files join ORIENT §2's reads and its p95 budget;
  - adding a key keeps the schema at version 1.
- **AGE Aris only reads.** It never writes a ledger or a page in a tracked
  repository (AGENTS.md).
- **Needs you** gains `decision-waiting` and `research-warning`, with their
  own cap of the top 12 per reason and a count, until T062 lands (R9).
- **The sample project** gains a research track with simulated history.

### 5.8 What does not change

- **RULES.md stays as it is.** The format lives in `AA/findings/_SCHEMA.md`.
  A rule is proposed only if L3's measures call for one.
- **Rule 9 stands.** A result goes to the log, and its claim lands in the same
  commit.
- **Trails keep their job.** The only change is the optional `q` on a
  `doing`, which also writes the `spend` line.

## 6. Out of scope here, each its own task if wanted

- **Recognising that two questions mean the same thing.** That is an agent's
  job at brief time. The check catches only explicit and exact repeats.
- **Computing bands and steps.** A repository's scripts do it. AGE Aris
  checks they were registered first.
- **A research pipeline for plain projects**: fan-out lanes, a synthesis
  stage and a reproduce stage (docs/PIPELINE.md). It comes after L3.
- **Fetching web sources.** There is no network.
- **Rewriting past research in RSNA or AGEIS.** Their own sessions decide. For
  AGEIS, D2 first means moving it to the current template, which brings
  `board.sh`, `AA.yml` and `RULES.md` (S3).

## 7. How it is verified

- **L0, the corpus.** Every check fires and does not fire, decimals included,
  and both doors give the same bytes.
- **L2, the gate**, with its pass fixed in §5.6.
- **Coverage, so that leaving fields out cannot meet a target** (R8):
  - at least 95% of costed `doing`s carry `q`;
  - every question with a spend carries a band and a step;
  - every claim with `answers`, `rejects` or `unresolved` carries a `where`.
    `where-missing` enforces it.
- **The lost-alpha measures**, with R0 as the baseline where it applies:
  - (r1) questions asked again: by hand, on a sample of 20 questions per
    round, by a reviewer outside the round;
  - (r2) spends flagged `instrument-unresolved`;
  - (r3) results flagged `config-mismatch` or `arm-equals-control`;
  - (r4) defects that reach a synthesis unflagged. Baseline: 3 of 3;
  - (r5) the median age of decisions waiting, shown on the page;
  - (r6) out-of-sight evidence. Baseline: 4 of 22 sources.
- **Targets:** (r2), (r3), (r4) and (r6) at 0 on new rounds, with the coverage
  targets met; (r5) lower than at the first measurement.

## 8. Risks

| Risk | Mitigation |
|---|---|
| A lane skips the ledger, and a clean page reads as health | Coverage comes first on the page; `uncovered` fires at the first decision; lanes with no line are named |
| The log and the ledger drift apart | They land in the same commit, and the checks read only the ledger |
| Warnings flood a round | `--check` is structural; claims and ages are rendered, never gated |
| Agents mark or cite wrongly | `source-missing` and `out-of-sight` are checked offline, reproduction is by re-execution, and L2 measures the rates first |
| Numbers differ between doors | Decimal strings, compared as scaled integers |
| Ids collide | Ids carry the task prefix, and a union merge is safe |
| Research text steers an agent | ORIENT.md's `data` discipline |
| "Track" is read as "tracked repository" | The interface says "research track", and the module is `lib/research.mjs` |
| Agent usage competes with RSNA's final week | L2 runs after RSNA closes on 2026-10-22, unless the operator says otherwise |

## 9. Phases, each one task

| # | Task | depends | Done when |
|---|---|---|---|
| R0 | Replay (L1) | — | **Done: T074.** Partial; its evidence is in `docs/plans/evidence/t074/` |
| R1a | **The contract and corpus**: `docs/RESEARCH.md` (ledger, `aa.research/1`, core checks, decimals) and `tests/research/` | — | every core check has fixtures; the operator has reviewed the cases |
| R1b | **`AA/research.sh` here**, core checks, `--write` and `brief` | R1a | it passes the corpus, and this repository's track pages generate |
| R1c | **`lib/research.mjs` and `GET /api/research`** | R1a | it passes the corpus |
| R1d | **Conformance:** both doors, byte for byte | R1b, R1c | the test is in `npm test` and passes |
| R1e | **The template:** `research.sh`, `_SCHEMA.md` and `tracks:` in `aa-init` | R1b, T004 | a fresh `aa-init` repository generates an empty track page |
| R2 | **In sight:** the Research tab, the view across projects, Needs-you with its own cap, STATE.md's track lines, the sample track | R1c | e2e passes; each track reads as one line of thought |
| R3 | **Orient's `research` key** | R1d, T059 | corpus cases added; both doors pass |
| R4 | **L2, planted truth: the gate** | R1b | §5.6's pass is met |
| R5 | **Dogfood (L3)** here, then one round in another repository | R4 | the measures are taken against R0's baseline |
| R6 | **The experiment checks**: spend lines, `config`, `reads`, `step`, reproduction | R1d, R4 | their corpus cases pass in both doors |

R1a needs nothing, and can start as soon as the operator approves. The
operator sees generated track pages in this repository after R1b, and in AGE
Aris after R2.

## 10. Decisions for the operator

**Decided 2026-10-13 by the operator. Each followed the recommendation:**

- **D1:** a findings ledger per task, and track pages with a generated region.
- **D2:** every AA repository, through `aa-init`.
- **D3:** R0 runs now, by one session with no subagents (T074).
- **D4:** T072 waits for R1b, then runs as the first dogfood.

The review of v1, one Architect and then one Critic, was approved to run the
same day.

**Open:**

- **D5. Revisit D4?** The Architect's S4 says D4 buys little evidence. T072 is
  web reading only, with no spend and no subagents, so it exercises no
  instrument, configuration or band check. Meanwhile it holds up T066 and
  T067, which wait for it.
  - Recommended: T072 runs as written, with no wait for R1b. The claim-race
    simulation moves into T067. The first dogfood is R5, a round in this
    repository.
  - The alternative is to keep D4.

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
  - Recommended: now, by one session with no subagents.
  - The alternatives were now with up to 6 lanes, or after RSNA closes on
    2026-10-22.
- **D4. T072.**
  - Recommended: it waits for R1b, then runs as the first dogfood.
  - The alternative was to run it now as written.

## ADR

- **Decision:**
  - Research, simulation and experiment runs write an append-only ledger per
    task (`AA/findings/T###.jsonl`). It holds subjects, questions whose rules
    are committed first, spends, marked and sourced claims, retractions, and
    decisions.
  - Ids are global, numbers are decimal strings, and independence means
    re-execution.
  - Track pages (`AA/tracks/`) and `aa.research/1` are generated from the
    ledgers. They show coverage first and facts side by side.
  - Fourteen mechanical checks run on the ledgers: seven core, five for
    experiments, two across ledgers. Each names its failure on record or is
    marked preventive.
  - Two doors serve all this, `AA/research.sh` and AGE Aris, held to one
    corpus.
  - Agents writing ledgers for planted rounds (L2) gate the rollout.
- **Drivers:**
  - the operator: one structured line of thought, in sight;
  - lost alpha, on RSNA's and AGEIS's own records (§2);
  - hand-kept views drift;
  - agent-first.
- **Alternatives:**
  - prose conventions;
  - hand-written pages;
  - a database in AGE Aris;
  - claims in trails;
  - claims inside reports.

  §4 gives the reasons.
- **Why chosen:**
  - it turns a method three repositories already run by hand into files and
    checks;
  - it keeps git as the truth;
  - it reuses orient's contract, corpus and serialization;
  - the replay showed both what it catches and what it cannot.
- **Consequences:**
  - a third vendored script;
  - a new AA folder and a schema to version;
  - a `tracks:` key;
  - one optional trail field that also writes a ledger line;
  - a Research tab;
  - a research track in the sample project.
- **Follow-ups:**
  - a research pipeline for plain projects;
  - recognising when two questions mean the same thing;
  - a rule in RULES.md if L3 calls for one.
