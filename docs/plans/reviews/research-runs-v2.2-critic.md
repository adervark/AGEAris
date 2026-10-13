# Critic review of `docs/plans/research-runs.md` v2.2 (ef09fae)

*T073, run `b8438f28.d930` (an Opus subagent), 2026-10-13.*

**This report is partial.** It arrived in three pieces:
- The first message was cut off partway through blocking issue 3.
- A resend delivered part 1 of 3, verbatim: the verdict and blocking issues 1 and 2.
- Parts 2 and 3 were never delivered. A safety classifier stopped the subagent while it sent part 2, and it declined to try again.

What follows is:
- part 1, verbatim;
- blocking issue 3 as far as the first message reached;
- the subagent's own one-line summary of the rest, from the trail (`AA/checkpoints/T073.jsonl`, its `did` and `end`).

Anything else the full report said is lost. A fresh Critic run is the only way to recover it.

---

**VERDICT: REVISE** (`docs/plans/research-runs.md` v2.2, `ef09fae`)

*Run `b8438f28.d930`. I did not read the Architect's review. "(checked)" means I read the cited lines myself, at the commit given.*

**Does it answer the operator?** In part. Linking by referent is the right idea, and it does put more pairs in front of a reader. But both incidents that §5.5 uses to prove it fail as written. Every route to a conflict still ends in a judgement by the person who transcribed the facts: which facts to write, which lines they cite, and what the linked pairs mean. The canaries meant to audit that judgement can be spotted by the person they audit. So for the operator's question 4, the answer is yes: it still hinges on one person's care.

## Blocking

**1. The 10-vs-12 link joins two true facts.**
- Lane 10 §3.4 (`lane10-capability-audit.md:360`) and lane 11 §2.6 (`lane11-inference-and-efficiency.md:299-300`) do not conflict (checked). The ten `fold?` members are among the twelve.
- The wrong claim is lane 10 §3.3: dropping the ten "unlocks three TTA views" (`:350-351`). It is an inference that cites only §3.4, with no code line. The synthesis says exactly this (`RESEARCH-0902c-round-3.md:503-509`, at `e4e356c`; checked).
- So the pair linked through `src/tta.py#unmatched` is one that a correct reconciler marks `agree`. The false statement belongs to the class §5.5 calls unlinkable.
- The refs `mirror` and `rotate` appear on neither cited line (checked). `tta.py:110` is a docstring line and `:116` reads `if any(not float(a.get(flag, 0) or 0) ...`. Grounding would reject both refs.
- *Fix:*
  - An INFERRED fact must cite its premises (`claim:` ids). It inherits their referents and links like any other fact.
  - Rewrite the incident as lane 10:350 against lane 11:300.

**2. The round-2 conflict links only by label.**
- Round 2's "never once passed" (`RESEARCH-0902b-round-2.md:60`) cites nothing (checked).
- Lane 10's "passed once" (`lane10:27`) cites `outputs/t025/run_arm.sh:13`, which is untracked at `e4e356c` (checked: `git ls-tree` returns nothing).
- `conflict` fires on "one key". That leaves the transcriber's choice of key.
- Round 2 belongs to T043. That is outside R0b's round-3 scope, and the plan still has no backfill (my N7).
- Lines also move:
  - Lane 10 cites `train.py:812` for `--layer-decay` (`lane10:97`).
  - At `e4e356c` that line is blank, inside `run` (checked). The nearest `def` above it is the nested `def mk` at 606, so a naive scan resolves it to `train.py#mk`.
  - The flag moved to `:1020` in `f896e38`, eleven minutes before lane 10 was first committed (checked).
  - In round 3's five lane reports, 0 of 106 `path:line` citations carry a commit (checked).
- *Fix:*
  - The facts table cites `path:line@commit` or `path#symbol`.
  - `research.sh fact` refuses a cited line that is blank or lacks its refs, and names the definition where the ref is found.
  - A negative fact ("never passed") cites its search, as `cmd:` with `git grep` and its hash, so it links through the ref.
  - Either backfill the specific settled facts that R0b needs, or drop that pass criterion.

**3. The canaries are gameable and test the wrong class.** *(As far as the first message reached.)*
- One writer transcribes and reconciles, so it knows every real fact. Any fact it did not write is a canary.
- Canaries "built from the corpus" come from another project and repeat from round to round.
- They are value disagreements. The conflicts on record were reached by inference (finding 1).
- The pass condition checks only recall on canaries. A reconciler can mark the canaries `conflict` and wave the real pairs through.
- *Fix:*
  - The reconciler is a separate subagent that did not transcribe.
  - `research.sh` makes canaries during the round from the round's own facts: the same definition and refs with a changed value, and set-inclusion contradictions like finding 1.
  - Canary ids continue the ledger's sequence, and canaries stay outside the ledger until the pass is graded.
  - Every `why` st… *(cut off here)*

---

## The rest, from the trail only

`did`: "Critic r2 on v2.2: REVISE. 10-vs-12 link joins two true facts (the wrong claim is lane 10's unsourced inference, lane10:350); round-2 conflict links only by key; canaries gameable by the one writer; rulings refused mid-round (RUN_LIVE)"

`end`, under `left`: "v2.3: INFERRED facts cite premises; commit-pinned cites; separate reconciler with in-round canaries; rulings vs RUN_LIVE; cut measured-again, re-scope copy-drift"

Recovered from these two lines:
- a fourth blocking issue: the operator's rulings would be refused while a round is in flight, because a task action is refused while a checkpoint run on the task is live (`RUN_LIVE`, AGENTS.md);
- two recommendations: cut `measured-again`, and narrow the scope of `copy-drift`.

Their reasoning was not delivered.
