# Architect review of `docs/plans/research-runs.md` v1 (eb7f7eb)

*T073, run `b8438f28.2982` (an Opus subagent), 2026-10-13. Saved verbatim
from its final message, with its HTML escapes undone. The trail holds its
`did` and `end`.*

**Verdict:** SOUND WITH REQUIRED CHANGES. Option E is the right architecture, but four of its twelve checks miss the failures they are credited with, several checks cannot be decided as written, and claim ids and run families break on this repository's own data.

**Root cause.** The design reuses machinery built to track work in flight for evidence that must be permanent and exact:
- run families and session-derived run ids, used as identity;
- the trail, used as input to the checks;
- whole-number serialization, used for values and bands.

R1, R2, R3 and R6 all follow from that.

**Item 1.** The track page reads top-down as the line the operator asked for, and JSONL behind two doors is a contract agents can use. What breaks first in real use:
1. **Double entry under a deadline.** Each finding goes into the report, the ledger and, for experiments, the log. A lane that skips the ledger leaves a clean page, and a clean page reads as "nothing wrong".
2. **Identity**, as soon as one session works on two research tasks or an orchestrator re-checks a lane.
3. **A flood of warnings**, during a round and again after the first file move.

## Required changes

**R1. Independence cannot be met, and §5.5 contradicts §5.4.**
- **Problem.** Only the owner's session and its subagents write a ledger (§5.2), and a family is a root run id (§5.4). So a whole round is one family. Yet §5.5 step 4 names "the orchestrator" as another family.
- **Evidence.** T038's re-checks (RSNA T038:45-50) are the practice `single-family` cites, and they were made by the lanes' parent. Nothing records a model either: `ckpt.sh` writes `model` only when it is passed (ckpt.sh:219-224), and neither `open` line on T073's trail has one.
- **Fix.** Independence means re-execution, not ancestry. A REPRODUCED claim carries `reproduces: <claim>`, comes from a different run, and has its own `cmd:` source and artifact. Record `model` at `open`, or drop that criterion.

**R2. Claim ids are not global, although §5.1 says they are.**
- **Problem.** A claim id is `<run>/<n>`, and "one session on two tasks has the same run id in both trails" (WHY.md:128).
- **Evidence.** This session owns both T073 and T074, so both ledgers would hold a `b8438f28/1`.
- **Fix.**
  - The global form is `T###/<run>/<n>`. An unqualified id resolves only within its own ledger.
  - Define how decisions on one question combine across ledgers, and add a `decision-conflict` check.
  - Give `AA/findings/*.jsonl` `merge=union`, as the trails have (aa-init SKILL.md:88). This is safe only once ids cannot collide (WHY.md:121-127).

**R3. The checks read the trail, which is deleted at close** (_SCHEMA.md:115-123).
- **Problem.** `registered-late` and `instrument-unresolved` read costed `doing`s and their `q`, and `single-family` reads the model from `open`.
- **Evidence.** So `ckpt.sh close --delete` changes the page's warnings in a commit that touches no ledger.
- **Fix.** Make the ledger self-contained. A `spend` line (run, `q`, cost, model) is written with each costed `doing`, and the checks read only ledgers, as §8 already requires against the log.

**R4. The "what it would have caught" column is wrong for four checks, so L1 cannot pass on v1 as written.**
- **Evidence.**
  - **`contradiction` is checked per question.** The 10 against 12 was lane 10 §3.3 against lane 11 §2.6 (RSNA synthesis §8.3 at `e4e356c`). Those lanes had different briefs, and the two numbers count different sets: ten `fold?` members, and twelve members with `mirror=0 rotate=0`.
  - **`unbacked` checks decisions.** Lane 12's two verdicts were claims whose §3 and §4 never existed. The synthesis left them out (§10 item 2), so no decision cites them.
  - **`artifact-mismatch`.** T118's renamed key would carry the same hash at registration and at the result; an assertion caught it (T118:55-67). And §5.2 makes `artifact` the hash of the output, which a dry run (§5.6) can never share with a real run.
  - **`orphan-answer`.** That finding was acted on: T043 registered T042 (T043:61).
- **Fix.**
  - Add `where-missing`: the `where` heading does not exist at the claim's commit.
  - Split `artifact` (the output) from `config` (the resolved configuration), and add `arm-equals-control`.
  - Adopt T074's `about` only if R0 shows it works.
  - Correct the column, and the ADR's claim that every check answers a failure on record.

**R5. Definitions that decide whether a check is mechanical.**
- **`instrument-unresolved`.** Nothing links a resolution claim to the question it serves. Add `rule.resolved_by` and `rule.step` (the instrument's quantum), and also fire when band ≤ step. T118's ±0.001 band on a three-decimal leaderboard was "unresolvable by construction" (T118:178-187).
- **Marks.** They need an order, because a rule names "the weakest accepted". NULL should be a verdict only, since `verdict: null` reads as JSON null.
- **`contradiction`.** It should fire on `answers` against `rejects`, or on values outside the band, never against a null. Null lanes are expected (T047 rule 4).
- **`registered-late`.** It should order by commit ancestry, not by time. A shared commit, an uncommitted question, or two branches that cannot be compared all count as late.
- **`reopened-settled` "by link".** This would flag every follow-up, because `from` is how a next question is raised (§5.1). Use an explicit `same-as` instead.
- **`uncovered`.** It should skip killed tasks, and fire at the first `decision`, not only at close.
- **`where-untracked`.** It misfires twice:
  - RSNA committed lanes 9–12 and the synthesis in one commit (`e4e356c`), so every `where` is untracked during a round;
  - files move afterwards (the synthesis has since left `docs/`; T093 moves more), and an append-only ledger cannot follow them.

  Evaluate it at the commit that added the line, and skip uncommitted lines.

**R6. Numbers need decimal semantics.**
- **Problem.** ORIENT §7 pins whole numbers only.
- **Evidence.**
  - Here, jq 1.8.1 prints `1E-7`, `1.0` and `0.10` where Node prints `1e-7`, `1` and `0.1`. The two doors cannot give the same bytes.
  - T118 read |0.941−0.940| ≤ 0.001 as "invisible" (T118:170-171). In IEEE doubles, both jq and Node compute 0.0010000000000000009 > 0.001. The two doors agree with each other, and both reverse the registered verdict.
- **Fix.** `value`, `band` and `step` are decimal strings under a linear grammar. They are compared as scaled integers and printed as written.

**R7. The generated pages repeat both of the gate's recorded traps** (WHY.md:189-197).
- **Evidence.**
  - §5.3's region holds `orphan-answer`, which changes with the clock, and "uncommitted" marks, which change with the working tree. `board.sh --check` is structural precisely to avoid this (board.sh:407-421).
  - Every claim makes the region stale, so a pre-commit `--check` would block `find:` commits, as it once blocked `ckpt:` commits.
  - `board.sh --write` replaces the whole STATE.md region (board.sh:392-405), so `research.sh` cannot add lines to it.
  - Orient's `state-stale` reads a table row with an empty first cell and a task id as a member of the column above it (ORIENT §5).
- **Fix.**
  - `--check` compares questions, decisions and the settled set only.
  - `find:` commits use `--no-verify`.
  - `board.sh` renders the track lines by sourcing `research.sh`, outside any table.

**R8. The §7 targets can be met by leaving fields out.**
- **Problem.**
  - (r2), (r3) and (r6) reach 0 whenever the optional `q`, `artifact` and `where` are not written.
  - (r1) is counted by `reopened-settled`, which sees exact repeats only.
  - L2 grades sources with `source-missing`, the very check under test.
  - L1 sets no limit on false positives.
- **Fix.**
  - Add coverage targets: the share of costed `doing`s with `q`, of numeric questions with a band, and of claims with `where`.
  - Check (r1) by hand on a sample.
  - Grade L2 against its planted truth.
  - Fix L1's false-positive ceiling now (rule 5).

**R9. Phase dependencies.**
- **Problem.** R2 caps Needs-you "like the others", but `lib/brief.mjs` has no cap: the cap is T062, which is open and depends on T057, T060 and T061. And §8 says L2 measures before rollout, yet R5 depends only on R1b.
- **Fix.** R2 depends on T062 or brings its own cap. R5's round in another repository depends on R4.

## Suggestions

- **S1. Show the operator something early.** Nothing is visible until R0, R1a and T004 are done. Have R0 render a draft track page from its scratch ledger. Ship R1b in this repository first; only its template part needs T004.
- **S2. Derive verdicts where a rule has thresholds**, as T118's reads do, and flag an asserted verdict that differs. AGEIS's verifier found an inverted verdict and a gain that "did not clear 0" (T106:80-83).
- **S3. Make the track folder configurable.**
  - AGEIS's pages live in `docs/research/tracks/`. STATE.md, WORKFLOW.md and PROGRESS.md link them, and `doc_check.py` checks them.
  - AGEIS has no `board.sh`, `AA.yml` or `RULES.md`, so for AGEIS, D2 first means migrating it to the current template.
- **S4. D4 buys little evidence.** T072 is web reading only, with no spend and no subagents. It exercises no instrument, artifact or band check, yet it holds up T066 and T067. The claim-race simulation belongs to T067.
- **S5. Orient's `research` key.** It should be present only when not empty, placed after `warnings`, and cut before `take`. Add the findings files to ORIENT §2's reads and to the p95 budget.
- **S6. Keep ledgers visible.** Give them `merge=union`, but never `linguist-generated`.

## Antithesis

**F: claims live inside the lane reports**, as one fenced `claim` block that closes the section arguing it. Questions and decisions stay in a ledger.

**The case for F:**
- `where` is the block's own heading, so lane 12's defect cannot even be written down.
- A claim cannot drift from its report, which removes §8's first risk.
- No two lanes ever share a file.
- RSNA's lanes already write marked findings section by section.

**It does not win:**
- Prose gets edited, so a claim could change silently, with no append-only history and no retraction kept beside it (principle 6).
- Proving order would need `git blame` on prose.
- Parsing fences out of untrusted Markdown identically in jq and Node is a larger surface than JSONL. ORIENT §7 already records how differently the two decode.
- DeepSeek still writes to untracked `.omc/research/` (ds_research.sh:85).

**What E should take from F:** a mandatory, checked `where` (R4), and a `brief` that prints the claim command for each section, which cuts the double entry.

## Citation check

| §2 fact | Verdict |
|---|---|
| 9 folders, 65 files, 13 syntheses | **Corrected:** only 60 of the files are tracked. The 0921 round is untracked, which is itself a live `where-untracked` case. |
| Round 1: five lanes | Six lane reports; the orchestrator wrote lane 0 (T038:36, :56). |
| Round 2: three lanes | Confirmed, plus a synthesis (T043:51). |
| Round 3: four briefed lanes, one unbriefed, and a synthesis | Confirmed (T047:37-54, :78-79). |
| DeepSeek writes to `.omc/research/` | Confirmed, and it still does (T088:37; ds_research.sh:85). |
| Four marks (T043) | **Corrected:** T038 and T043 use three; T047 rule 1 adds REPRODUCED. |
| A lever needs an instrument | Confirmed; a lever without one is ranked last, not excluded (T047:62-64). |
| Nulls count; lanes write as they go | Confirmed (T047:67-69, :140-141). |
| The orchestrator re-checks | Confirmed (T038:45-50); it is the lanes' parent (R1). |
| A "do not redo" table in each round | **Corrected:** only round 3 has one (T047:18-30). |
| 10 against 12 | Confirmed (T047:128-129), but the two numbers count different sets. |
| Verdicts with no section; the unwritten efficiency half | Confirmed (T047:121-122, :117-118). |
| The flags: "a finding no run acted on" | **Corrected:** T043 acted on it (→ T042, T043:61). The loss was a capability nobody examined, and the claim "never passed" turned out false (T047:109). |
| The w = 0.20 arm; the rename | Confirmed (T118:23-30, :32-60). An assertion caught the rename, not a hash. |
| "Five places each" | That is T093's title. Its own map shows five places for run logs only. The `.omc` quote is exact (T093:26). |
| AGEIS: pages, copied numbers, verifier, `track:` | Confirmed (T106:25-33, :40, :47-48). The copies also come from task Results. |
| T072 is one reading pass | Confirmed. |

*Read: /home/ade/Code/AGEAris (eb7f7eb), /home/ade/Code/RSNA (HEAD 2def134; round 3 at e4e356c), /home/ade/Code/AGEIS (bfd2333). Trail: `did` and `end` for run b8438f28.2982 appended to `/home/ade/Code/AGEAris/AA/checkpoints/T073.jsonl`, uncommitted.*
