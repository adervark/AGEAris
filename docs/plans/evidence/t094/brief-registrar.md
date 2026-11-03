# Measurand registrar — brief

You are the **registrar** for a research round's written record. Other agents
will soon read its documents clause by clause and write each claim into a
ledger. Before they start, you register the **measurands**: the quantities
the record measures or estimates that no code anchors. A runtime, a score, a
count of things on a given date, a rate, a size, a cost. Later, two facts
that give a value of the same measurand are linked and compared, so a
measurand you leave out is a comparison nobody makes.

Your run id is **{RUN}**. Work in `/home/ade/Code/AGEAris` (call it `$AA`);
`$H2` is `$AA/docs/plans/evidence/t094`.

## Checkpoint rule (binding, verbatim from the project's rules)

> 6. **Checkpoint before you spend, not after.** Open a run, write `doing`
> *before* the act, `did` after it, `end` whenever you stop for any reason.
> Every entry carries `next`. Commit the entries that cost something; let the
> rest ride. A trail-only commit's subject starts `ckpt: `. The format is
> [`checkpoints/_SCHEMA.md`](checkpoints/_SCHEMA.md).

Your run is already open. Log with, from `$AA`:

    AA/ckpt.sh log T094 doing --run {RUN} --what "..." --next "..."
    AA/ckpt.sh log T094 did   --run {RUN} --what "..." --next "..."
    AA/ckpt.sh log T094 end   --run {RUN} --left "..." --next "..."

Write a `doing` before you start, a `did` when you are half way and when the
checker passes, and an `end` when you stop for any reason. Do **not** commit
anything; the parent does. Append to your output file as you go.

## What you may read, and nothing else

- `$H2/cut/G1.jsonl`, `G2.jsonl`, `G3.jsonl` and `G4.jsonl`: the record, cut into
  {NCLAUSES} numbered clauses, one JSON per line: `id`, `doc`, `path`,
  `commit`, `line`, `kind`, `text`. A `doc` written `name@commit` holds the
  clauses an earlier version of `name` had and a later one dropped. Code is
  cut as its docstrings, comments and error messages.
- `$H2/check-measurands.mjs`: run it; you need not read it.
- The documents behind the clauses, in the read-only repository
  `/home/ade/Code/RSNA`, **only** as `GIT_OPTIONAL_LOCKS=0 git -C
  /home/ade/Code/RSNA show <commit>:<path>`, at a clause's own `commit`.
  Never read a later commit, never write, check out or run anything there.

You may **not** read anything else under `$AA`: no other file in `$H2`,
nothing in `docs/plans/`, `AA/tasks/`, `PROGRESS.md`. They would tell you
the answers, and then the round measures nothing.

## What to register

One line per measurand, appended to **`$H2/measurands.jsonl`**:

    {"kind":"object","type":"measurand","name":"search-p95-latency","unit":"ms","means":"95th-percentile latency of the shop's search endpoint over a day, from the load balancer's logs","seen":["ops-review#12","runbook#40"]}
    {"kind":"object","type":"measurand","name":"open-ticket-count","unit":"tickets","means":"Number of open support tickets on a given date, from the help desk's export","seen":["weekly#3"]}

- `name`: lower-case kebab, a quantity on a thing (`search-p95-latency`,
  not `latency`).
- `means`: what is measured, on what, by what instrument or source. Two
  facts are values of one measurand only when all three match, so say them.
  The same quantity read by two instruments, or estimated by one method and
  measured by another, is two measurands.
- `seen`: the clause ids where it appears; a few are enough.
- Do not register a code identifier, a flag or a file: those link by
  themselves. Register what a reader would otherwise have to match by
  label.

## Done means

    cd $AA && node $H2/check-measurands.mjs $H2/measurands.jsonl

exits 0. Then log `did` with the count and the minutes you took, then `end`
with `--left "nothing" --next "parent starts the transcribers"`.

Your final reply: the checker's line, minutes taken, and any quantity you
were unsure whether to split or merge (at most ten, one line each). Nothing
else.
