# Critic review of `docs/plans/research-runs.md` v2.3 (c43a9c1)

*T073, run `b8438f28.072e` (an Opus subagent), 2026-10-13. A third round, which the operator approved. The report is saved verbatim. It arrived in three messages: the first was cut off by the notification's length limit, and the rest came in two parts on request. The trail holds its `did` and `end`.*

**VERDICT: REVISE** (`docs/plans/research-runs.md` v2.3, `c43a9c1`)

*Critic, round 3, run `b8438f28.072e`. I did not read the Architect's review. "(checked)" means I read the cited lines myself. All RSNA reads went through `git show`/`git grep` at the commit given, plus `cat` of one untracked file.*

**Does it answer the operator?** Mostly. Incident 1 now links the right pair: lane 10 §3.3 names its premise "(§3.4)" (lane10:351, checked), and that premise sits inside `def unmatched` (tta.py:103–118 at `e4e356c`, checked). Separate reconcilers and the RUN_LIVE wait are sound. But the second proof still fails on the record, a gap in the spec pushes transcribers to cite lines that do not support their claims, and neither test can fail on anything new. The operator's fourth point is not closed yet.

## Blocking

**1. Incident 2 cannot link under the plan's own rules.**
- Lane 10's "passed once" cites only `outputs/t025/run_arm.sh:12-13`, `dinov3_fold0.log` and `dinov3_fold0.pt` (lane10:181–196, checked).
- `outputs/*` is gitignored (RSNA `.gitignore:34`, checked), so no commit contains these files. A `path:line@commit` cannot be pinned or checked against them (plan:52–57), and R0b reads RSNA "through `git show` only" (plan:716–718). That leaves `--layer-decay` with no grounded line. The link falls back to the key, which is a label again.
- Line 13 does contain the flag on disk (checked with `cat`), so the fact is true. The pinning model simply cannot see it.
- `out-of-sight` is defined on a *verdict's* `where`/`src` (plan:591). R0b requires it to fire on a *fact's* source (plan:727).
- The plan says `git grep -n -- --layer-decay` at `2b3d2a6` "finds only the flag's definition" (plan:68–70). That is false. It returns 29 lines, including the round-2 claim itself (`docs/RESEARCH-0902b-round-2.md:60`) and `PROGRESS.md:5857`. Scoped to `src`, it returns three: `train.py:273`, `:274` and `:812` (checked).
- *Fix:*
  - Define an untracked source as `path:line@worktree#sha256`, read with `cat`, which fires `out-of-sight` on the fact.
  - Extend `out-of-sight` to fact sources.
  - Let R0b `cat` untracked files.
  - A `cmd:` carries its pathspec.
  - Say plainly that a repository grep cannot see gitignored launches. That blind spot is this incident.

**2. Unsourced measurements cannot be written, and the spec contradicts itself.**
- A fact's `src` is required unless it is INFERRED, and an INFERRED fact with no premises is refused (plan:44, 462, 636).
- §5.5 says a bare assertion "can still be written as INFERRED" (plan:600–603).
- Both measured facts in incident 1 lack a source for their values:
  - lane 11 says "MEASURED from the checkpoint args" and cites no path (lane11:299);
  - lane 10 §3.4 cites only the line holding the `any()` check (lane10:358–360).
- `refs` is optional. Lane 11 cites `tta.py:110`, which at `e4e356c` is a docstring's closing `"""` (checked). With no refs, the check accepts that wrong line.
- So the tool rewards citing whatever code line the lane mentioned, whether or not it is the real source.
- *Fix:*
  - Keep the lane's mark, with `src: []` flagged `unsourced`. That is a warning, and no decision may rest on such a fact alone.
  - Require at least one ref on every `path:line` source.

**3. Neither test can fail on anything new.**
- R0b passes on exactly the two incidents v2.3 was rewritten around, with the one backfill that pass needs (plan:720–727).
- The synthesis records ten corrections to earlier rounds (§8.1, RESEARCH-0902c:453–463) and two inside round 3: §4's arithmetic slip (:225) and §8.3 (:642–643, checked). R0b grades none of the other ten-plus.
- §5.5 says S0 "measures" the class that cannot be linked (plan:604–605). Yet S0 plants only shapes that can be linked (plan:731–733).
- *Fix:*
  - Grade R0b on recall over all twelve corrections, backfilling earlier rounds by the fixed procedure. Run it with a fresh agent that is not given the incident text in §5.5 and §7.
  - In S0, plant one conflict with no shared referent and one inference whose premises the lane did not name. Report how many slip through.

## Required, not blocking

1. **`copy-drift` cannot fire on its own incident.**
   - Facts are never edited (plan:449–450), so a quote of the superseded "never" fact still matches that fact's value.
   - The three records were written before the correction, which is the counterfactual's own class (plan:578).
   - *Fix:* fire when a live, undated document quotes a superseded fact.
2. **§5.5 omits three gaps:**
   - facts never transcribed. Whether a fact is load-bearing is judged as reports land, before any verdict exists. §3.3 was one clause in a list of options (lane10:347–351);
   - premises the transcriber chooses when the lane names none. That is identity chosen by the writer again;
   - `asked-before` on an idea with no code referent, such as SSL pretraining, which links only by key.
3. **Cost is unmeasured.**
   - There are no figures for minutes per transcribed fact, linked pairs per round, or reconciler tokens.
   - A pass that misses a canary is rerun with no cap (plan:642–643).
   - *Fix:* R0b records those figures, and after two failed passes the round escalates to the operator.

## Minor

- **Canaries can be told apart.**
  - Their ids are absent from the ledger the reconciler can read, and `same` validates ids (plan:81–82, 685–686). §8 claims they are "indistinguishable by id" (plan:771).
  - Canary ids also collide with the ids the claimant assigns while still transcribing.
  - §5.2 still says "one writer" (plan:445).
- **Rulings wait for every run, not just the claimant's.**
  - Step 8 has only the claimant end its run (plan:651–655).
  - The code refuses while *any* run on the task is live (`lib/workspace.mjs:1449–1452`) and asks for confirmation on runs that never ended (:1458–1465). Lanes and the reconciler log runs on the task, so a ruling waits for the whole round. The ADR has this right (plan:834).
  - `WIP_LIMIT` applies only to `start` (:1470–1483), so it does not block rulings (checked).
- After a ruling, the page still shows the conflict open until an agent runs `--write`. AGE Aris should show the task file's rulings over the page.
- Every citation into a Markdown source resolves to the whole file, and `PROGRESS.md` runs to about 6,000 lines. Use the enclosing heading as the referent.
- Stale text:
  - the v2.2 list still names `measured-again` (plan:153);
  - §10 says the round-2 Critic "died with no report" (plan:812–813).

## Fixes 1–6 against the record

| Fix | Works? |
|---|---|
| 1. Premises | Yes, for §3.3 (checked) |
| 2. Pinning | Catches `train.py:812` going blank. Misses the docstring line (blocking 2) |
| 3. Negative search | No (blocking 1) |
| 4. Reconciler | The separate run works. The canaries leak (minor) |
| 5. RUN_LIVE | The ADR is right. Step 8 says too little |
| 6. Cuts | Cutting `measured-again` is fine. `copy-drift` now misses its incident |

## AGENTS.md hard constraints

All kept (checked against AGENTS.md:35–64):
- one task file per ruling;
- no script runs and no writes to `STATE.md` from AGE Aris;
- parsing that cannot backtrack.

Skipping hooks on `find:` commits follows the `ckpt:` precedent (WHY.md:195–197). `npm run check` only checks syntax.

## Does §5.5 say plainly what slips through?

Partly. It is honest about the reconciler's judgement. It omits the three gaps in required change 2, and it wrongly claims S0 measures the unlinkable class.

**Mode:** thorough, then adversarial after blocking 1. That mode turned up blocking 2 and the `copy-drift` gap. The realist check kept 1–3 as blocking: each one makes a §7 pass criterion either unreachable or unable to fail.

**Open questions:**
- Does RSNA ever commit lane reports before the synthesis? If not, "the commit that added the section" is the synthesis commit, hours after the code was read (`f896e38` landed eleven minutes before lane 10's first commit).
- Does a file referent link to a function referent in the same file?

(End of report. The `did` and `end` trail lines for run b8438f28.072e are already logged.)
