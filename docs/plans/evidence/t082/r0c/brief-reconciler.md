# R0c reconciler — brief

You are **reconciler {K}** of a research round's written record. Other agents
transcribed eight research documents, and the sections they cite, into a
ledger of *facts*: each one a quoted claim (`says`), with a `key`, a `value`,
sometimes a `unit`, and a `mark` (READ, MEASURED, REPRODUCED, INFERRED, ...).
A linker then grouped facts that are about the same thing. You transcribed
nothing and audited nothing. Your job is to find where the record disagrees
with itself, and where an inference does not follow from what it rests on.

Your run id is **{RUN}**. Work in `/home/ade/Code/AGEAris` (call it `$AA`);
`$R0C` is `$AA/docs/plans/evidence/t082/r0c`.

## Checkpoint rule (binding, verbatim from the project's rules)

> 6. **Checkpoint before you spend, not after.** Open a run, write `doing`
> *before* the act, `did` after it, `end` whenever you stop for any reason.
> Every entry carries `next`. Commit the entries that cost something; let the
> rest ride. A trail-only commit's subject starts `ckpt: `. The format is
> [`checkpoints/_SCHEMA.md`](checkpoints/_SCHEMA.md).

Your run is already open. Log with, from `$AA`:

    AA/ckpt.sh log T082 doing --run {RUN} --what "..." --next "..."
    AA/ckpt.sh log T082 did   --run {RUN} --what "..." --next "..."
    AA/ckpt.sh log T082 end   --run {RUN} --left "..." --next "..."

Write a `doing` before you start, a `did` after every 100 or so units
("done N of {NUNITS}"), and an `end` when you stop for any reason. Do **not**
commit anything; the parent does. Your output file is the deliverable:
append to it as you go, never only at the end. If you find the file already
has lines when you start, a run before you died: keep them, and carry on
from the first unit without a line.

## What you may read — and nothing else

- `$R0C/rec/R{K}.jsonl` — your view: {NGROUPS} groups and {NCHECKS} checks,
  one per line. Read it in slices (for example 20 lines at a time with
  `sed -n`); it is too large to hold at once.
- `$R0C/check-reconcile.mjs` — run it; you need not read it.
- The documents behind the facts, if a fact's `says` is too short to judge,
  in the read-only repository `/home/ade/Code/RSNA`, **only** with
  `GIT_OPTIONAL_LOCKS=0 git -C /home/ade/Code/RSNA grep|show|log ...`. Never
  write, check out, fetch or run anything there. Most units need no lookup.

You may **not** read anything else under `$AA` — the ledgers, the keys, the
audit, the other reconcilers' files, any earlier pass such as `rec/out-R1-pass1.jsonl`, `docs/plans/`, `AA/tasks/`,
`PROGRESS.md` — nor the round 3 synthesis in RSNA. They would tell you the
answers, and then your judgement measures nothing.

## Groups

A group line is `{"group":n,"via":[...],"facts":[...]}`. `via` is what links
its facts: a code definition or file (`def:src/train.py#build_parser`), a
Markdown section, a registered measurand (`m:deployed-kernel-runtime`), a
shared identifier (`ref:--layer-decay`), a search. Every fact shows its view
id (`V123`), its document, key, value, unit, mark and quote. Facts come from
at least two documents.

Look for **conflicts**: two facts that cannot both be true as written — a
different value for the same quantity of the same thing under the same
conditions, opposite states ("wired" / "never read"), incompatible counts,
a bound the other figure breaks. A later document correcting an earlier one
is still a conflict: write it, and say it is a correction. Not conflicts:
facts about different attributes of the thing `via` names; different
conditions, dates or subsets, stated as such; one figure inside the other's
range; rounding; an estimate beside a measurement that it brackets. Large
groups are mostly unrelated facts sharing a file; scan them by key and
value for the few that speak of the same quantity.

For each conflicting pair, append:

    {"kind":"same","group":12,"facts":["V88","V1403"],"finding":"conflict","why":"V88 says the cap is 9 h; V1403 says 20 min, same rule page","run":"{RUN}"}

For a group with no conflict, append one line:

    {"kind":"ok","group":12,"why":"7 facts, 3 quantities, all consistent","run":"{RUN}"}

## Checks

A check line is `{"check":n,"conclusion":{...},"premises":[...]}`: an
INFERRED fact and the facts it says it rests on. Decide whether the
conclusion **follows** from those premises as written: recompute any
arithmetic (rates, sums, ratios, differences) and check any number the
conclusion states against what the premises give, within the rounding the
text uses. A qualitative conclusion follows when the premises, taken
together, support it without a step the premises do not contain. It does
**not** follow when a number disagrees with what the premises give, when it
needs a premise that is not there, or when it says more than they do.

    {"kind":"same","check":40,"finding":"does-not-follow","why":"25.2 + 1.329 × 132 = 200.6 min, not ~175","run":"{RUN}"}
    {"kind":"same","check":41,"finding":"follows","why":"0.936 − 0.926 = 0.010 as stated","run":"{RUN}"}

Each `why` is at most 240 bytes: quote or name the two values you compared.

Some units are known to be wrong, placed among the rest without any mark.
Nothing distinguishes them but their content, so read every one with the
same care.

## Done means

    cd $AA && node $R0C/check-reconcile.mjs $R0C/rec/R{K}.jsonl $R0C/rec/out-R{K}.jsonl

exits 0. Your output file is **`$R0C/rec/out-R{K}.jsonl`**. Fix anything
the checker reports and run it again. Then log `did` with the counts it
prints and the minutes you took, then `end` with `--left "nothing" --next
"parent grades"`.

Your final reply: the checker's summary line, minutes taken, and the
conflicts and does-not-follow findings you are most sure of (at most ten,
one line each). Nothing else.
