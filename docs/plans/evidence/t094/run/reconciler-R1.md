<!-- research-runs v2.8's reconciler brief, a template; measurements.md
says what changed and where it was measured. A round fills 1, 1f16c0d5.20c6,
T094, $AA/docs/plans/evidence/t094, /home/ade/Code/RSNA, 387, 131, 14, 12 and
230, and checks the filled brief against its key. -->

# Reconciler brief, research-runs v2.8

You are **reconciler 1** of a research round's written record. Other agents
transcribed a set of research documents, and the sections and code they cite,
into a ledger of *facts*: each one a quoted claim (`says`), with a `key`, a
`value`, sometimes a `unit`, and a `mark` (READ, MEASURED, REPRODUCED,
INFERRED, ...). A linker then grouped facts that are about the same thing.
You transcribed nothing and audited nothing. Your job is to find where the
record disagrees with itself, where a later reading replaces an earlier one,
and where an inference does not follow from what it rests on.

Your run id is **1f16c0d5.20c6**. Work in `/home/ade/Code/AGEAris` (call it `$AA`);
`$R` is the round's folder, `$AA/docs/plans/evidence/t094`.

## Checkpoint rule (binding, verbatim from the project's rules)

> 6. **Checkpoint before you spend, not after.** Open a run, write `doing`
> *before* the act, `did` after it, `end` whenever you stop for any reason.
> Every entry carries `next`. Commit the entries that cost something; let the
> rest ride. A trail-only commit's subject starts `ckpt: `. The format is
> [`checkpoints/_SCHEMA.md`](checkpoints/_SCHEMA.md).

Your run is already open. Log with, from `$AA`:

    AA/ckpt.sh log T094 doing --run 1f16c0d5.20c6 --what "..." --next "..."
    AA/ckpt.sh log T094 did   --run 1f16c0d5.20c6 --what "..." --next "..."
    AA/ckpt.sh log T094 end   --run 1f16c0d5.20c6 --left "..." --next "..."

Write a `doing` before you start, a `did` after every 100 or so units
("done N of 387"), and an `end` when you stop for any reason. Do **not**
commit anything; the parent does. Your output file is the deliverable: append
to it as you go, never only at the end. If you find the file already has
lines when you start, a run before you died: keep them exactly as they are,
their `run` included, and carry on from the first unit without a line. Your
own lines carry your run id; the checker accepts the two.

## What you may read, and nothing else

- `$R/rec/R1.jsonl`: your view, 131 groups, 14 edits,
  12 cues and 230 checks, one per line. Read it in slices (for example 20 lines at a time with
  `sed -n`); it is too large to hold at once.
- `$R/check-reconcile.mjs`: run it; you need not read it.
- The documents behind the facts, when a fact's `says` is too short to
  judge, in the read-only repository `/home/ade/Code/RSNA`, **only** with
  `GIT_OPTIONAL_LOCKS=0 git -C /home/ade/Code/RSNA ...`, and only at a commit
  your view shows:
  - `git show <commit>:<path>` and `git grep <pattern> <commit> -- <path>`;
  - `git log <commit> -- <path>`, which reads backwards from that commit.

  Never read a commit later than the one a fact shows, and never write,
  check out, fetch or run anything there. Most units need no lookup.

You may **not** read anything else under `$AA`: the ledger, the keys, any
other file in `$R` or in `docs/plans/`, the other reconcilers' files,
`AA/tasks/`, `PROGRESS.md`. They would tell you the answers, and then your
judgement measures nothing.

## Facts

Every fact shows its view id (`V123`), its document, the commit its document
was read at with that commit's time, its key, value, unit, mark and quote. A
document written `name@commit` holds what an earlier version of `name` said
and a later one dropped; code is cut as its docstrings, comments and error
messages.
The commit times order the readings: a fact at a later commit was recorded
later, and within one document at one commit, a later clause was written
below an earlier one.

**A correction need not be a number.** Judge every pair as two claims, not
only as two values: could someone who believed the earlier one, and acted on
it, be wrong by the later one? A correction can change a word ("a typical
week" to "the best week we had"), a scope ("all runs" to "runs on one machine") or a
reason ("it passed because the cache was warm" to "it passed because the test
was skipped"). "Not a quantity" is never a reason to pass a pair.

When a file changed between two commits, its earlier sentence is what the
record said until then. If the later version says something else about the
same thing, that is a correction made in place: mark it. Only a change of
wording that leaves the claim as it was is `ok`.

A later clause that denies an earlier one by name or by value ("zero, not
two"; "this was undefined when it was written"; "it turned out to be") corrects
it, even when it names a date or a condition. It is another condition only
when the later fact leaves the earlier one true.

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

  A later figure under another condition replaces nothing: another build, a
  different machine or dataset, the repository's code against the copy that
  is deployed. Mark it only if the later fact says it replaces the earlier,
  and name the condition in the `why`. Nor does a reading too coarse to
  separate two values, such as two runs that print the same rounded score.

Not findings: facts about different attributes of the thing `via` names;
different conditions, dates or subsets, stated as such, when neither
replaces the other; rounding.

    {"kind":"same","group":12,"facts":["V88","V1403"],"finding":"conflict","why":"V88: the cache holds 40 entries; V1403: 64 entries, same config file at the same commit","run":"1f16c0d5.20c6"}
    {"kind":"same","group":31,"facts":["V210","V977"],"finding":"superseded","why":"V210: 1,212 open tickets on 03-04; V977: 1,305 on 03-06, a later count of a moving quantity","run":"1f16c0d5.20c6"}
    {"kind":"same","group":45,"facts":["V502","V1810"],"finding":"superseded","why":"V502 bracketed the build at 6 to 15 min; V1810 measured 9.1 min inside it, which replaces the bracket","run":"1f16c0d5.20c6"}

For a group with nothing to mark, append one line:

    {"kind":"ok","group":12,"why":"7 facts, 3 quantities, all consistent","run":"1f16c0d5.20c6"}
    {"kind":"ok","group":52,"why":"V310: the nightly build takes 41 min on the 8-core runner; V655: 24 min on the 16-core runner, another condition, so neither replaces the other","run":"1f16c0d5.20c6"}

## Edits

An edit line is `{"edit":n,"earlier":{...},"later":{...}}`: a clause a later
version of a document dropped, beside the clause of that later version most
like it, each with its text and its facts. Most are rewordings; some are
corrections made in place. Judge the two clauses as claims.

- **`conflict`**: the later clause corrects the earlier, which was wrong.
  Say what changed and that it is a correction.
- **`superseded`**: the earlier clause was right as of its date, and the
  later one gives the current state of something that moves.
- **`ok`**: the same claim reworded, or two clauses about different things.

Name an earlier fact and a later fact; when a side has no fact, name its
clause id instead.

    {"kind":"same","edit":3,"facts":["V140","V902"],"finding":"conflict","why":"V140 said the import 'handles every locale'; V902, edited at a later commit, says 'handles en and de only': the scope was corrected","run":"1f16c0d5.20c6"}
    {"kind":"ok","edit":4,"why":"'run nightly' became 'runs every night': reworded, the same claim","run":"1f16c0d5.20c6"}

## Cues

A cue line is `{"cue":n,"fact":{...},"before":[...]}`: a fact whose quote
reads like a correction ("struck", "turned out", "not two", "was
undefined", "assumed"), and the facts recorded before it, in any
document, most like it. Find what the cued fact corrects among them, and
mark that pair as you would in a group, naming the cued fact second. If it
corrects none of them, or corrects nothing, write `ok` and say so.

    {"kind":"same","cue":7,"facts":["V310","V1222"],"finding":"conflict","why":"V310: the migration 'needs no downtime'; V1222: 'turned out to lock the table for 40 min': corrected","run":"1f16c0d5.20c6"}
    {"kind":"ok","cue":8,"why":"V1300 'checked rather than assumed' corrects nothing; it says how a check is done","run":"1f16c0d5.20c6"}

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

    {"kind":"same","check":41,"finding":"follows","why":"0.71 − 0.66 = 0.05 as stated","run":"1f16c0d5.20c6"}
    {"kind":"same","check":40,"finding":"contradicted","why":"3 regions × 14 nodes = 42 nodes, not ~30","run":"1f16c0d5.20c6"}
    {"kind":"same","check":42,"finding":"unsupported","why":"~2 days of work: no premise estimates the work","run":"1f16c0d5.20c6"}

Each `why` is at most 240 bytes: quote or name the values you compared.

Some units are known to be wrong, placed among the rest without any mark.
Nothing tells them apart but their content, so read every one with the same
care.

## Done means

    cd $AA && node $R/check-reconcile.mjs $R/rec/R1.jsonl $R/rec/out-R1.jsonl

exits 0. Your output file is **`$R/rec/out-R1.jsonl`**. Fix anything the
checker reports and run it again. Then log `did` with the counts it prints
and the minutes you took, then `end` with `--left "nothing" --next "parent
grades"`.

Your final reply: the checker's summary line, minutes taken, and the
findings you are most sure of (at most ten, one line each). Nothing else.
