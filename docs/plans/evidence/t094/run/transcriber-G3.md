# Transcriber — brief

You are **transcriber G3** of a research round's written record (run id
`1f16c0d5.89bd`). The record has been cut, mechanically, into numbered clauses. Your
job: **dispose of every clause in your group**, either as a `fact` (a claim,
written down) or as a `skip` (written off, with a reason). Nothing may be left
out silently. A separate auditor, who will not see your facts, reads every
one of your skips, and is tested on skips it should catch. So when in doubt,
write a fact.

Work in `/home/ade/Code/AGEAris` (call it `$AA`); `$H2` is
`$AA/docs/plans/evidence/t094`.

## Your group

`$H2/cut/G3.jsonl`: 584 clauses, one JSON per line:
`{"id":"runbook#40","doc":"runbook","path":"docs/runbook.md","commit":"a1b2c3d","line":88,"kind":"para","text":"…"}`.
Documents: Makefile, build_t112_kernel.py, paired_vs_member.py, push_arm.py, _order.py.

- A `doc` written `name@commit` holds the clauses that version of `name` had
  and the next version dropped: what was edited out. Treat each as a claim of
  its own, made at that commit.
- Code is cut as its docstrings, comments and error messages: the code's own
  claims about itself.
- The `text` has Markdown emphasis and code ticks removed. Read the whole
  document for context: `GIT_OPTIONAL_LOCKS=0 git -C /home/ade/Code/RSNA show
  <commit>:<path>`, at the clause's own `commit`.

## Reading rules

- `/home/ade/Code/RSNA` is **read only**: `git show`, `git grep`, `git log`,
  always with `GIT_OPTIONAL_LOCKS=0`, and only at a commit a clause shows,
  never a later one. Never `git status`, never run its scripts, never write
  there.
- **Forbidden**, because they hold the answers or would bias you: every file
  under `$AA` except your own output file, `$H2/cut/G*.jsonl`,
  `$H2/measurands.jsonl`, `$AA/docs/plans/evidence/t082/r0c/check.mjs` and
  `$AA/docs/plans/evidence/t082/clauses.mjs`. That includes the rest of
  `$H2`, `docs/plans/`, `AA/tasks/` and `PROGRESS.md`. Other transcribers'
  ledgers are off limits too.
- Other code or documents in RSNA, read at the right commit, are fine when a
  clause cites them.

## What is a fact

Any clause that states something checkable: a number or count, a state ("is
never read", "is unused", "blocks the release"), a comparison, a cause or
inference ("so", "⇒", "because", "which frees"), a ranking, a verdict, a
correction, a recommendation with its reason. **A clause with several claims
gives several facts**, each with the same `at`. A question that frames a
hypothesis the document goes on to test is a fact too, mark `INFERRED`, with
the claim it poses as `value`.

One line per fact:

    {"kind":"fact","id":"G3-F1","at":"runbook#40","key":"search cache/size","value":"64 entries","unit":"entries","mark":"READ","src":["src/cache.py:12@a1b2c3d"],"premises":[],"refs":["CACHE_SIZE"],"says":"the cache now holds 64 entries"}
    {"kind":"fact","id":"G3-F2","at":"runbook#41","key":"search cache/hit rate gain","value":"about 9 points","unit":"%","mark":"INFERRED","src":[],"premises":["G3-F1","runbook#38"],"premises_by":"lane","refs":[],"says":"so the hit rate should rise by about 9 points"}

- `id`: `G3-F<n>`, numbered from 1.
- `at`: the clause id.
- `says`: **verbatim** from that clause's `text` (at most 240 bytes); a
  fragment is fine.
- `value`: **verbatim** inside `says`: the number, set or state claimed.
- `key`: a readable label, `<object>/<attribute>`. It is for display only and
  never decides anything.
- `mark`: the document's own mark when it gives one (REPRODUCED, MEASURED,
  SIMULATED, READ, INFERRED); otherwise the honest one: READ for something
  read off a source, INFERRED for a conclusion.
- `src`: what the claim cites, as a list:
  - `path:line@commit` for a tracked file, pinned to the clause's commit.
    The cited line must contain at least one of the fact's `refs`; if the
    document cites a wrong line, cite the right one and add
    `"cite_fixed": true`.
  - `path:line@worktree#<sha256>` for an untracked file read with `cat`.
  - `path#<heading text>@commit` for a section of a Markdown document;
    `path#<symbol>@commit` for a code definition.
  - `cmd:git grep -n -e <pattern> <commit> -- <pathspec>` for a **negative
    claim about code** ("is never called", "has no retry"): cite the search
    that would show it. Always do this for negative claims about code.
  - `m:<name>` when the fact is a value of a measurand registered in
    `$H2/measurands.jsonl`. Add it beside any other source.
  - `[]` when the document cites nothing.
- `refs`: identifiers the fact is about (flags, functions, files), each
  found on a cited `path:line`. Every flag, path or code identifier the
  quote names belongs here.
- `premises`: required for INFERRED: what the inference rests on, as fact ids
  of your ledger or **clause ids** of any group. `premises_by`: `lane` when
  the document names them, `transcriber` when you chose them.

## What is a skip

    {"kind":"skip","clauses":["runbook#1","runbook#5-9"],"why":"no-claim"}

- `no-claim`: headings that carry no claim, method notes with nothing
  checkable, navigation, table headers. Ranges `doc#a-b` are fine.
- `repeat`, with `"of":"G3-F12"`: the clause restates, in substance, a fact
  already in your ledger: same subject, same value, same qualifier.
- `quote`, with `"of":"<clause id or path>"`: the clause only quotes another
  document **and nothing here relies on or disputes it**. If it does, write a
  fact.

## Check, until clean

    cd $AA && node docs/plans/evidence/t082/r0c/check.mjs $H2/cut/G3.jsonl $H2/ledger-G3.jsonl $H2/measurands.jsonl /home/ade/Code/RSNA --prefix G3

It must exit 0: every clause disposed of, every quote verbatim, every value
in its quote, every cited line holding a ref. Run it as you go.

## Output

Write **only** `$H2/ledger-G3.jsonl`. Append as you go, document by
document, so that partial work survives if you are cut off. If the file
already has lines when you start, a run before you died: keep them, and
carry on from the first clause not yet disposed of. Do not commit and do not
`git add`.

## The trail: rule 6 of the board protocol, verbatim

> 6. **Checkpoint before you spend, not after.** Open a run, write `doing`
> *before* the act, `did` after it, `end` whenever you stop for any reason.
> Every entry carries `next`. Commit the entries that cost something; let the
> rest ride. A trail-only commit's subject starts `ckpt: `. The format is
> [`checkpoints/_SCHEMA.md`](checkpoints/_SCHEMA.md).

Your run is already open. From `$AA`:

- before you start: `AA/ckpt.sh log T094 doing --run 1f16c0d5.89bd --what "G3: transcribing 584 clauses" --next "dispose of every clause"`
- about half way: `AA/ckpt.sh log T094 did --run 1f16c0d5.89bd --what "G3: <n> of 584 clauses disposed" --next "the rest of G3"`
- when check.mjs exits 0: `AA/ckpt.sh log T094 did --run 1f16c0d5.89bd --what "G3 clean: <facts> facts, <skips> skips, <minutes> min" --next "parent merges"`
- then: `AA/ckpt.sh log T094 end --run 1f16c0d5.89bd --left "<nothing, or what is unfinished>" --next "parent merges"`

Do not pass `--commit`.

## Final message

At most 12 lines: facts, skips, minutes taken, check.mjs's final summary
line, and anything you were unsure about. Do not paste the ledger.
