# Critic review of `docs/plans/research-runs.md` v1 (eb7f7eb)

*T073, run `b8438f28.15f2` (an Opus subagent), 2026-10-13. Saved verbatim
from its final message, with its HTML escapes undone. The trail holds its
`did` and `end`.*

**VERDICT: REVISE** (`docs/plans/research-runs.md` v1, eb7f7eb).

Do not start R1 on v1's contract. Cut it down to the decision-grain version below, fix B1–B6, and replay a round that spent first.

*Independence: I saw only the Architect's one-line summary in the trail, never its report.*

**Does it answer the operator?** The shape does: question → claims → verdict → decision, kept in git, with generated views. But v1 loads that structure onto the lanes, claim by claim, in a second file beside their reports, and RSNA's record suggests lanes skip exactly this. Under T047's rule 1 ("an unmarked number is a defect"), 67 of the 254 claims T074 extracted carried no mark, and 7 carried a verdict word. The likely product is a clean page over gaps. The lost alpha on record came from questions nobody asked and facts nobody connected. v1 has no mechanism for either, and it credits both to checks that cannot fire.

## Blocking issues

**B1. Four of §2's seven failures cannot be caught by the checks credited with them, and a fifth check cannot be decided.** This contradicts the ADR's "every check answers a failure on record".
- `unbacked` checks decisions. T047's two verdicts with no section behind them "were not carried" (Result 4), so no decision cites them.
- `contradiction` works within one question. The 10-vs-12 count set lane 10 §3.3 against lane 11 §2.6, which answered different asks (synthesis §8.3).
- `orphan-answer` is credited with the wired flags. Nobody knew of them until round 2, and that finding went straight to T042 (T043 Result 2). No answer ever sat waiting.
- `artifact-mismatch` is credited with T118. A dry run of the defective configuration yields the defective artifact (§5.6), so the hashes match. What caught T118 was a domain invariant, `assert_every_arm_is_reachable`.
- `instrument-unresolved` needs a claim that "shows the instrument can resolve that band", and no field marks one (§5.2).

*Fix:* every check gets an incident fixture on which it fires, and a counterfactual from the corrected record on which it stays silent. Drop or re-scope the checks that fail.

**B2. Independence is defined by process lineage, which contradicts both the method and orient.**
- §5.4 calls two runs independent when their roots differ. Yet §5.5 step 4 counts "the orchestrator" as another family, and the orchestrator is the lanes' root.
- A second session on the same task gets `wait` from orient (`agent-brain.md:374`).
- RSNA's DeepSeek lane has no Bash and may edit only `.omc/research/**` (`ds_research.sh:4,145,209`), and T088 rule 3 says that boundary "must not widen". The lane cannot append to a ledger, and if the orchestrator transcribes for it, its claims join the orchestrator's family.
- So `single-family` fires on every hinge question.

*Fix:* declare independence on the claim (model, method, source), have the synthesis justify it, and drop `single-family`.

**B3. Claim ids are not global.** §5.2 makes them `<run>/<n>`, while §5.1 says "every id below is global". One session on two tasks has the same run id in both (`_SCHEMA.md:55-57`), and this session owns T073 and T074. So `unbacked`, `retracted-cited` and retracts across ledgers can resolve to another task's claim. *Fix:* `T###/<run>/<n>`.

**B4. Permanent evidence rests on retired data, and the committed page makes itself stale.**
- `registered-late`, `instrument-unresolved` and the different-model test read the trail's `doing` and `open` lines. Trails are deleted at close, while ledgers never are. So those verdicts change when a task closes, and (r2) cannot be counted from the working tree after L3.
- §5.3 commits "uncommitted" marks and the clock-driven `orphan-answer` into a region that `--check` must find current. The page is stale in the very commit that carries it. That is WHY.md's "It cried wolf", which `board.sh` escapes only through `structural()`.
- v1 says "committed after", but T074 implemented strict ancestry, and its lane-13 catch depends on that stricter reading.

*Fix:* make the ledger self-sufficient, with a `spend` line carrying `q` and with `model` on each claim. Commit only committed lines, and no clock fields. Order lines by strict ancestry.

**B5. The operator sees "decisions waiting on you" but cannot decide there.**
- The claimant writes decisions (§5.1), and AGE Aris never writes a ledger (§5.7). AGENTS.md lets an operator action change one task file only.
- Once a task closes, nobody may append to its ledger (§5.2).
- No decision clears `uncovered`, so those warnings are permanent.
- The obvious UI, appending a decision line, would break a hard constraint. As written, v1 breaks none.

*Fix:* operator rulings become task actions, as a `## Decisions` line in the task file that the readers parse. `park` and `drop` clear `uncovered`. Every suppression carries its reason, as RSNA's `claims-guard-ok` does.

**B6. §7 can be met without solving the operator's problem.**
- (r2) reads the optional `q`, and (r3) the optional `artifact`, so both reach 0 by omission.
- (r4) needs an independent reader, and none is named.
- (r5) has no baseline; PROGRESS records it as "not measurable".
- (r1), counted by exact text, is 0 and stays 0.
- L1's pass counts recall only; a check that fires everywhere passes.
- Nothing measures the operator's outcome.

*Fix:*
- a precision floor and a counterfactual for each check;
- `q` mandatory on a costed research `doing`, with an `unlinked-spend` warning;
- a named blind reader for (r4);
- no (r1) or (r5) until a baseline exists;
- two operator measures: minutes to answer "where are we on X?" from the page, and decisions that bound before the operator saw them.

## R0: a fair test?

**Sound:** the procedure was fixed before reading, and the bias was declared. The commit was pinned, the run is reproducible, and the false positives are listed. Both misses are design-level, and they stand.

**Weak:**
- A script transcribed finished prose, so the riskiest assumption, that lanes keep the ledger as they go, was never tested.
- The one catch does not discriminate.
  - Under the fallback rule, every second question (L9.Q2, L11.Q2, L13.Q2) got 0 claims, and all three fired. `uncovered`'s precision was 1 in 4.
  - The choice that decided it, "H1 is the title", was pinned after the headings were seen, by a session that knew the target.
- 23 of 26 warnings were false.
- Only 6 of 12 checks ran, and none of them guards a spend.
- The bar was replicating what the synthesis had already caught by hand. The costly failures, T118's spend and the unused flags, were not replayed.

Net: two certain misses, and one catch the design supports but the replay cannot tell from noise.

T074's list for v2 points the right way, with two corrections:
- If `verdict` is required, a placeholder `unresolved` clears `uncovered`. Only `answers`, `rejects` or `null` should cover a question.
- No registry in a brief would have foreseen "the members blocking `tta.unmatched`". Make subjects a convergence view at synthesis, not an alarm.

**Keep:**
- `uncovered`, redefined;
- `where-missing`;
- out-of-sight on both `where` and `src` (4 of 22 sources);
- `source-missing`;
- `registered-late`, strict;
- `retracted-cited`.

**Change:**
- `unbacked` moves to claim level: the reasoning section must exist and have a body.
- `instrument-unresolved` gets an explicit link.

**Drop or defer:**
- `contradiction`, except on the track head's registered quantities;
- `single-family`;
- `artifact-mismatch`;
- `reopened-settled`;
- `orphan-answer`'s timer.

**Next replay:** RSNA T112/T118, after 10-22.

## Non-blocking

- **N1. Prior art missed.** §2 says every part is done by hand, but RSNA's `claims_guard.py` and `record_guard.py` mechanise path and record checks. Their docstrings' lessons apply here: declared markers, precision first, reasoned suppressions, and "eight writes" of one fact. v1 adds a ninth write (§5.8) and checks only the ledger (§8), so drift goes unseen.
- **N2. D4 parks the brain's team half.** T066 and T067 depend on T072, which waits on R1b, which waits on T004, still unstarted. T072's `depends: []` hides this.
- **N3. Two doors before orient has any.** Orient's runners aren't built, and ORIENT §7 allows only whole numbers. Ship one door, and carry decimals as strings.
- **N4. D2 comes before the evidence.** It vendors a third script while RSNA's `AA/ckpt.sh` is still modified and uncommitted (STATE.md, T016). Start here.
- **N5. The alpha came from integration and inventory.** §8.3: "Nobody put them together". T123: "the head already exists, in code we vendor". v1 has no view by object, and no standing question of what we already have.
- **N6. Security.** Another family re-runs `cmd:` sources (§5.5 step 4), and a lane steered by the web can plant one.
  - Allow only tracked scripts at a pinned commit.
  - Escape region markers.
  - Parse `path:line@commit` without backtracking (§5.4 names only `reopened-settled`).
- **N7. Unspecified:**
  - `merge=union` for `AA/findings/` (AGEIS sets `*.jsonl -diff`);
  - a backfill, without which "do not redo" starts empty;
  - a derived "number to beat";
  - real clones for the race simulation, which `fabricate.mjs` can't make.

## Pre-mortem

1. **Back-filled ledgers.** Claims are written at synthesis to pass `--check`, and the page restates the synthesis. *Earliest signal:* in T072, the share of claim lines that `git blame` puts in the synthesis commit, and the share of `unresolved` verdicts.
2. **Warnings as wallpaper.** Imprecise warnings that cannot be closed fill Needs you, so a real `instrument-unresolved` before a spend gets ignored. *Signal:* first-round precision under 50% (R0's was about 12%), or open warnings on closed tasks rising.
3. **Green measures, alpha still lost.** (r2), (r3), (r4) and (r6) read 0 by omission, while R1's chain delays the operator's view and T066/T067. *Signal:* the next "it already existed" synthesis arrives with no check fired, or R1b is not done two weeks after R1a.

## The cheapest version that still answers the operator

1. **A decision-grain ledger with one writer.** The claimant commits `question` lines with their rules before the first lane opens. At synthesis it adds `decision` lines and one `verdict` line per question, holding the verdict, mark, value as text, `where` (a tracked report section) and `src`. Lanes keep writing tracked prose reports, as RSNA's do, so they have nothing new to skip.
2. **Four checks,** each with an incident fixture and a counterfactual: `uncovered`, `where`/`src` missing or out of sight, `registered-late`, and `decision-waiting`.
3. **`research.sh brief`** prints the computed settled list and the dead ends.
4. **One door.** `research.sh` renders the committed track page, and AGE Aris shows it, reading files only. Waiting decisions go to Needs you, and the operator rules through a task action. During a round, the operator sees the questions, each lane's trail state, and report headings as they land.
5. **Run T072 now,** on a hand-written ledger, so T066 and T067 stop waiting on R1b. Build claim-grain ledgers, families, `contradiction` and the spend checks only when T072 and the T118 replay show one would have changed a decision.
