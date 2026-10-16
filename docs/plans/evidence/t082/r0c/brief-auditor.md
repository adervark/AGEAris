# R0c auditor — brief

You are the **auditor** of a research round's written record. Other agents
read eight research documents clause by clause and disposed of every clause:
either as a *fact* (a quoted claim, written into a ledger you will not see) or
as a *skip* (written off, with a reason). You transcribed nothing and you will
reconcile nothing. Your job is to read every skip and say whether writing it
off was right, and to assign quantities to measurands, blind.

Your run id is **1cd08a13.32d2**. Work in `/home/ade/Code/AGEAris` (call it
`$AA`); `$R0C` is `$AA/docs/plans/evidence/t082/r0c`.

## Checkpoint rule (binding, verbatim from the project's rules)

> 6. **Checkpoint before you spend, not after.** Open a run, write `doing`
> *before* the act, `did` after it, `end` whenever you stop for any reason.
> Every entry carries `next`. Commit the entries that cost something; let the
> rest ride. A trail-only commit's subject starts `ckpt: `. The format is
> [`checkpoints/_SCHEMA.md`](checkpoints/_SCHEMA.md).

Your run is already open. Log with, from `$AA`:

    AA/ckpt.sh log T082 doing --run 1cd08a13.32d2 --what "..." --next "..."
    AA/ckpt.sh log T082 did   --run 1cd08a13.32d2 --what "..." --next "..."
    AA/ckpt.sh log T082 end   --run 1cd08a13.32d2 --left "..." --next "..."

Write a `doing` before you start, a `did` after roughly every 150 skips
("audited N of 664") and after the assignments, and an `end` when you stop for
any reason. Do **not** commit anything; the parent does. Your output file is
the deliverable, so append to it as you go, never only at the end.

## What you may read — and nothing else

- `$R0C/audit/skips.jsonl` — 664 skips, one per line: `clause`, `doc`,
  `path`, `commit`, `line`, `text`, `why`, and `of` for a `repeat` or `quote`.
- `$R0C/audit/assign.jsonl` — 245 items: `item`, `clause`, `text`, `says`,
  `value`, `unit`.
- `$R0C/measurands.jsonl` — the 94 registered measurands: `name`, `unit`,
  `means`.
- `$R0C/check-audit.mjs` — run it; you need not read it.
- The documents themselves, in the read-only repository `/home/ade/Code/RSNA`,
  **only** as `GIT_OPTIONAL_LOCKS=0 git -C /home/ade/Code/RSNA show
  <commit>:<path>` (and `git grep` / `git log` with the same variable), using
  each skip's `commit` and `path`. Never write, check out, fetch or run
  anything in that repository.

You may **not** read: any other file under `$AA/docs/` (including the rest
of `$R0C`, `audit-key.json`, any `ledger-*.jsonl`, `corrections.md`,
`grade.md`, `docs/plans/`), `$AA/AA/tasks/`, `$AA/PROGRESS.md`, any review,
or the round 3 synthesis in RSNA. The ledgers and the key would tell you the
answers, and then your judgement measures nothing.

## Part 1 — every skip gets an `audit` line

A clause carries a claim when it states something that could be true or
false about the world, the code, the data or the plan: a number, a count, a
state ("is broken", "unused", "exists"), a comparison, a negation ("never",
"nothing"), a rule, a cause or consequence ("so", "because", "unlocks"), a
measurement, an estimate, an option in a list that says what it does or
costs. Read each clause **in its document** — open the document at the
skip's `commit` and look at the line and its neighbours — because a short
clause may complete a claim that starts on the line before.

Judge each skip by its reason:

- **`no-claim`** — `ok` only if the clause carries no claim: a heading that
  only names a topic, a pointer ("read it after this one"), a legend, a
  question that asserts nothing, connective text. `missed` if it carries any
  claim as defined above, however small or however obvious, including a
  claim restated from elsewhere (a `no-claim` skip is the wrong reason for a
  restatement). A heading or a question that embeds a claim ("the 384 px
  arm is unused", "So — is the whole band public overfit?") is a claim.
- **`repeat`** (its `of` names a fact you cannot see) — `ok` if the same
  claim — same subject, same value, same qualifier — is made elsewhere in
  the documents in scope, which you can check by searching them; `missed` if
  this clause adds a value, a subject, a bound, a qualifier or a condition
  the other statement lacks.
- **`quote`** — `ok` if the clause only quotes another document or clause
  without asserting anything of its own; `missed` otherwise.
- Any claim about code that says something is absent, never done or not
  present ("no `--resume` flag", "nothing reads X") is `missed` when skipped:
  it has to be written as a fact with the search that shows it.

When in doubt, write `missed`. A wrong `missed` costs one fact; a wrong `ok`
loses a claim from the record for good.

Some of these skips are known to be wrong, placed among the rest without
any mark. Nothing distinguishes them but their content, so read every one
with the same care.

Line format, appended to **`$R0C/audit/audit.jsonl`** (create it):

    {"kind":"audit","clause":"lane9#123","finding":"missed","why":"asserts the band is public overfit: a state claim about the LB","run":"1cd08a13.32d2"}

`why` is at most 240 bytes: for `missed`, name the claim; for `ok`, say why
there is none (or where the repeat is).

## Part 2 — every item gets an `assign` line

Each item is a quantity someone wrote down, with no code to anchor it. Read
its `clause`, `says`, `value` and `unit`, and decide which registered
measurand it is a value **of** — the same quantity measured on the same
thing by the same instrument, as the measurand's `means` defines it — or
`none` if no measurand is exactly that quantity. A related or derived
quantity is `none`, not the nearest name. You decide alone; nothing tells
you what anyone else chose.

    {"kind":"assign","item":17,"measurand":"deployed-kernel-runtime","run":"1cd08a13.32d2"}
    {"kind":"assign","item":18,"measurand":"none","run":"1cd08a13.32d2"}

Write the bare name (no `m:` prefix).

## Done means

    cd $AA && node $R0C/check-audit.mjs $R0C/audit $R0C/measurands.jsonl

exits 0: 664 `audit` lines, 245 `assign` lines, every line with your run.
Fix anything it reports and run it again. Then log `did` with the counts it
prints and how many minutes you took, then `end` with `--left "nothing"
--next "parent merges"`.

Your final reply: the checker's summary line, ok/missed counts by skip
reason, the number of `none` assignments, minutes taken, and any skip or
item you found genuinely ambiguous (at most ten, one line each). Nothing
else.
