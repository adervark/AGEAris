# R0d reconciler — brief

You are **reconciler {K}** of a research round's written record. Other agents
transcribed a set of research documents, and the sections and code they cite,
into a ledger of *facts*: each one a quoted claim (`says`), with a `key`, a
`value`, sometimes a `unit`, and a `mark` (READ, MEASURED, REPRODUCED,
INFERRED, ...). A linker then grouped facts that are about the same thing.
You transcribed nothing and audited nothing. Your job is to find where the
record disagrees with itself, where a later reading replaces an earlier one,
and where an inference does not follow from what it rests on.

Your run id is **{RUN}**. Work in `/home/ade/Code/AGEAris` (call it `$AA`);
`$R0D` is `$AA/docs/plans/evidence/t085`.

## Checkpoint rule (binding, verbatim from the project's rules)

> 6. **Checkpoint before you spend, not after.** Open a run, write `doing`
> *before* the act, `did` after it, `end` whenever you stop for any reason.
> Every entry carries `next`. Commit the entries that cost something; let the
> rest ride. A trail-only commit's subject starts `ckpt: `. The format is
> [`checkpoints/_SCHEMA.md`](checkpoints/_SCHEMA.md).

Your run is already open. Log with, from `$AA`:

    AA/ckpt.sh log T085 doing --run {RUN} --what "..." --next "..."
    AA/ckpt.sh log T085 did   --run {RUN} --what "..." --next "..."
    AA/ckpt.sh log T085 end   --run {RUN} --left "..." --next "..."

Write a `doing` before you start, a `did` after every 100 or so units
("done N of {NUNITS}"), and an `end` when you stop for any reason. Do **not**
commit anything; the parent does. Your output file is the deliverable: append
to it as you go, never only at the end. If you find the file already has
lines when you start, a run before you died: keep them, and carry on from the
first unit without a line.

## What you may read, and nothing else

- `$R0D/rec/R{K}.jsonl`: your view, {NGROUPS} groups and {NCHECKS} checks,
  one per line. Read it in slices (for example 20 lines at a time with
  `sed -n`); it is too large to hold at once.
- `$R0D/check-reconcile.mjs`: run it; you need not read it.
- The documents behind the facts, when a fact's `says` is too short to
  judge, in the read-only repository `/home/ade/Code/RSNA`, **only** with
  `GIT_OPTIONAL_LOCKS=0 git -C /home/ade/Code/RSNA ...`, and only at a commit
  your view shows:
  - `git show <commit>:<path>` and `git grep <pattern> <commit> -- <path>`;
  - `git log <commit> -- <path>`, which reads backwards from that commit.

  Never read a commit later than the one a fact shows, never read
  `docs/RESEARCH-0902c-round-3.md` (add `':!docs/RESEARCH-0902c-round-3.md'`
  to every `git grep`), and never write, check out, fetch or run anything
  there. Most units need no lookup.

You may **not** read anything else under `$AA`: the ledger, the keys, any
other file in `$R0D` or in `docs/plans/`, the other reconcilers' files,
`AA/tasks/`, `PROGRESS.md`. They would tell you the answers, and then your
judgement measures nothing.

## Facts

Every fact shows its view id (`V123`), its document, the commit its document
was read at with that commit's time, its key, value, unit, mark and quote.
The commit times order the readings: a fact at a later commit was recorded
later. One file read at two commits can say two things because the file
changed in between; that is not a disagreement unless the later commit still
says the earlier thing.

## Groups

A group line is `{"group":n,"via":[...],"facts":[...]}`. `via` is what links
its facts: a code definition or file (`def:src/app.py#load`), a Markdown
section, a registered measurand (`m:queue-depth`), a shared identifier
(`ref:--batch-size`), a search. Facts come from at least two documents.
Large groups are mostly unrelated facts that share a file; scan them by key
and value for the few that speak of the same quantity.

Mark each pair that speaks of the same quantity of the same thing and
disagrees, in one of two ways.

- **`conflict`**: the two cannot both be true as written. A different value
  for the same quantity under the same conditions, opposite states ("wired"
  / "never read"), incompatible counts, a limit the other figure breaks. A
  later document correcting an earlier one is a conflict when the earlier
  one was wrong: write it, and say it is a correction.
- **`superseded`**: the earlier fact was right as of its date or its
  evidence, and a later one replaces it as the quantity's current value.
  Two shapes:
  - a later reading of a quantity that moves, such as a count, a rank or a
    queue as of a date;
  - a sharper figure inside an earlier one's range, such as a measurement
    or a fit that lands inside an earlier bracket or estimate.

  Name the replaced fact first.

Not findings: facts about different attributes of the thing `via` names;
different conditions, dates or subsets, stated as such, when neither
replaces the other; rounding.

    {"kind":"same","group":12,"facts":["V88","V1403"],"finding":"conflict","why":"V88: the cache holds 40 entries; V1403: 64 entries, same config file at the same commit","run":"{RUN}"}
    {"kind":"same","group":31,"facts":["V210","V977"],"finding":"superseded","why":"V210: 1,212 open tickets on 03-04; V977: 1,305 on 03-06, a later count of a moving quantity","run":"{RUN}"}
    {"kind":"same","group":45,"facts":["V502","V1810"],"finding":"superseded","why":"V502 bracketed the build at 6 to 15 min; V1810 measured 9.1 min inside it, which replaces the bracket","run":"{RUN}"}

For a group with nothing to mark, append one line:

    {"kind":"ok","group":12,"why":"7 facts, 3 quantities, all consistent","run":"{RUN}"}

## Checks

A check line is `{"check":n,"conclusion":{...},"premises":[...]}`: an
INFERRED fact and the facts it says it rests on. Recompute any arithmetic
(rates, sums, ratios, differences, midpoints) and set any number the
conclusion states against what the premises give, within the rounding the
text uses. Then mark it one of three ways.

- **`follows`**: the premises, taken together, give the conclusion, with no
  step they do not contain.
- **`contradicted`**: the premises give another number or another state than
  the conclusion says. Name both values.
- **`unsupported`**: the conclusion needs a premise that is not there, or
  says more than the premises do: a cost, a gain or a rate with no
  derivation, or an input the premises never state. Name what is missing.

  Use it only when nothing in the premises refutes the conclusion; when they
  do, it is `contradicted`.

    {"kind":"same","check":41,"finding":"follows","why":"0.71 − 0.66 = 0.05 as stated","run":"{RUN}"}
    {"kind":"same","check":40,"finding":"contradicted","why":"3 regions × 14 nodes = 42 nodes, not ~30","run":"{RUN}"}
    {"kind":"same","check":42,"finding":"unsupported","why":"~2 days of work: no premise estimates the work","run":"{RUN}"}

Each `why` is at most 240 bytes: quote or name the values you compared.

Some units are known to be wrong, placed among the rest without any mark.
Nothing tells them apart but their content, so read every one with the same
care.

## Done means

    cd $AA && node $R0D/check-reconcile.mjs $R0D/rec/R{K}.jsonl $R0D/rec/out-R{K}.jsonl

exits 0. Your output file is **`$R0D/rec/out-R{K}.jsonl`**. Fix anything the
checker reports and run it again. Then log `did` with the counts it prints
and the minutes you took, then `end` with `--left "nothing" --next "parent
grades"`.

Your final reply: the checker's summary line, minutes taken, and the
findings you are most sure of (at most ten, one line each). Nothing else.
