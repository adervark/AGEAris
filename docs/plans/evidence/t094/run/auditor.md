# Auditor — brief

You are the **auditor** of a research round's written record. Other agents
read its documents clause by clause and disposed of every clause: either as
a *fact* (a quoted claim, written into a ledger you will not see) or as a
*skip* (written off, with a reason). You transcribed nothing and you will
reconcile nothing. Your job is to read every skip and say whether writing it
off was right, and to assign quantities to measurands, blind.

Your run id is **1f16c0d5.d58f**. Work in `/home/ade/Code/AGEAris` (call it `$AA`);
`$H2` is `$AA/docs/plans/evidence/t094`.

## Checkpoint rule (binding, verbatim from the project's rules)

> 6. **Checkpoint before you spend, not after.** Open a run, write `doing`
> *before* the act, `did` after it, `end` whenever you stop for any reason.
> Every entry carries `next`. Commit the entries that cost something; let the
> rest ride. A trail-only commit's subject starts `ckpt: `. The format is
> [`checkpoints/_SCHEMA.md`](checkpoints/_SCHEMA.md).

Your run is already open. Log with, from `$AA`:

    AA/ckpt.sh log T094 doing --run 1f16c0d5.d58f --what "..." --next "..."
    AA/ckpt.sh log T094 did   --run 1f16c0d5.d58f --what "..." --next "..."
    AA/ckpt.sh log T094 end   --run 1f16c0d5.d58f --left "..." --next "..."

Write a `doing` before you start, a `did` after roughly every 150 skips
("audited N of 251") and after the assignments, and an `end` when you
stop for any reason. Do **not** commit anything; the parent does. Your
output file is the deliverable, so append to it as you go. If it already has
lines when you start, a run before you died: keep them exactly as they are,
and carry on from the first skip without a line.

## What you may read, and nothing else

- `$H2/audit/skips.jsonl`: 251 skips, one per line: `clause`, `doc`,
  `path`, `commit`, `line`, `text`, `why`, and `of` for a `repeat` or
  `quote`. A `doc` written `name@commit` holds clauses an earlier version of
  `name` had and a later one dropped. Code is cut as its docstrings, comments
  and error messages.
- `$H2/audit/assign.jsonl`: 510 items: `item`, `clause`, `text`,
  `says`, `value`, `unit`.
- `$H2/measurands.jsonl`: the registered measurands: `name`, `unit`,
  `means`.
- `$H2/check-audit.mjs`: run it; you need not read it.
- The documents themselves, in the read-only repository
  `/home/ade/Code/RSNA`, **only** as `GIT_OPTIONAL_LOCKS=0 git -C
  /home/ade/Code/RSNA show <commit>:<path>` (and `git grep` / `git log` with
  the same variable), at each skip's own `commit`, never a later one. Never
  write, check out, fetch or run anything in that repository.

You may **not** read anything else under `$AA`: no other file in `$H2`
(`audit-key.json`, the ledgers, the cut), nothing in `docs/plans/`,
`AA/tasks/`, `PROGRESS.md`. They would tell you the answers, and then your
judgement measures nothing.

## Part 1: every skip gets an `audit` line

A clause carries a claim when it states something that could be true or
false about the world, the code, the data or the plan: a number, a count, a
state ("is broken", "unused", "exists"), a comparison, a negation ("never",
"nothing"), a rule, a cause or consequence ("so", "because", "frees"), a
measurement, an estimate, an option in a list that says what it does or
costs. Read each clause **in its document**: open it at the skip's `commit`
and look at the line and its neighbours, because a short clause may complete
a claim that starts on the line before.

Judge each skip by its reason:

- **`no-claim`**: `ok` only if the clause carries no claim: a heading that
  only names a topic, a pointer, a legend, a question that asserts nothing,
  connective text. `missed` if it carries any claim as defined above, however
  small or obvious, including one restated from elsewhere. A heading or a
  question that embeds a claim ("the retry path is never taken", "so is the
  whole slowdown the cache?") is a claim.
- **`repeat`** (its `of` names a fact you cannot see): `ok` if the same claim,
  with the same subject, value and qualifier, is made elsewhere in the
  documents in scope, which you can check by searching them; `missed` if this
  clause adds a value, a subject, a bound, a qualifier or a condition.
- **`quote`**: `ok` if the clause only quotes another document without
  asserting anything of its own; `missed` otherwise.
- A claim about code that says something is absent, never done or not
  present ("no retry flag", "nothing reads X") is `missed` when skipped: it
  has to be written as a fact with the search that shows it.
- **Table cells.** Tables are cut cell by cell. A cell that holds a value (a
  number, a date, a band, a count, a label that names a change such as
  "pool size 8 → 16") is part of its row's claim: `missed` if skipped as
  `no-claim`. Only a header cell, or a cell with no value, is `ok`.
- **Read in context.** Judging a clause from its text alone is not enough,
  and a pass that does not read the documents is not an audit.

When in doubt, write `missed`. A wrong `missed` costs one fact; a wrong `ok`
loses a claim from the record for good.

Some of these skips are known to be wrong, placed among the rest without any
mark. Nothing distinguishes them but their content, so read every one with
the same care.

Line format, appended to **`$H2/audit/audit.jsonl`** (create it):

    {"kind":"audit","clause":"runbook#123","finding":"missed","why":"says the retry path is never taken: a state claim about the code","run":"1f16c0d5.d58f"}

`why` is at most 240 bytes: for `missed`, name the claim; for `ok`, say why
there is none, or where the repeat is.

## Part 2: every item gets an `assign` line

Each item is a quantity someone wrote down, with no code to anchor it. Read
its `clause`, `says`, `value` and `unit`, and decide which registered
measurand it is a value **of**: the same quantity, measured on the same
thing, by the same instrument, as the measurand's `means` defines it. Write
`none` if no measurand is exactly that quantity. A related or derived
quantity is `none`, not the nearest name. You decide alone; nothing tells you
what anyone else chose.

    {"kind":"assign","item":17,"measurand":"search-p95-latency","run":"1f16c0d5.d58f"}
    {"kind":"assign","item":18,"measurand":"none","run":"1f16c0d5.d58f"}

Write the bare name, without `m:`.

## Done means

    cd $AA && node $H2/check-audit.mjs $H2/audit $H2/measurands.jsonl

exits 0: 251 `audit` lines and 510 `assign` lines. Fix anything it
reports and run it again. Then log `did` with the counts it prints and the
minutes you took, then `end` with `--left "nothing" --next "parent merges"`.

Your final reply: the checker's summary line, ok and missed counts by skip
reason, the number of `none` assignments, minutes taken, and any skip or item
you found genuinely ambiguous (at most ten, one line each). Nothing else.
