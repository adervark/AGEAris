<!-- Recovered 2026-10-21 (T085) from session b8438f28's transcript on this machine: the template behind brief-G1..G4 and GC, which were never committed. Verbatim, placeholders unfilled. -->

You are **transcriber {G}** in a research-ledger experiment (task T082, run id `{RUN}`). Research reports have been cut, mechanically, into numbered clauses. Your job: **dispose of every clause in your group**, either as a `fact` (a claim, written down) or as a `skip` (written off, with a reason). Nothing may be left out silently. A separate auditor, who will not see your facts, reads every one of your skips; it is also tested on skips it should catch. So when in doubt, write a fact.

## Your group
`/home/ade/Code/AGEAris/docs/plans/evidence/t082/r0c/cut/{G}.jsonl`: {N} clauses, one JSON per line: `{"id":"lane10#392","doc":"lane10","path":"…","commit":"…","line":349,"kind":"para","text":"…"}`. Documents: {DOCS}.

The `text` is the clause with Markdown emphasis and code ticks removed. Read the whole document for context:
`GIT_OPTIONAL_LOCKS=0 git -C /home/ade/Code/RSNA show <commit>:<path>`.

## Reading rules
- RSNA (`/home/ade/Code/RSNA`) is **read only**: `git show`, `git grep`, `git log`, always with `GIT_OPTIONAL_LOCKS=0`, plus `cat` / `sha256sum` for untracked files under it. Never `git status`, never run its scripts, never write there.
- **Forbidden** (they hold the answer key or would bias you): `docs/RESEARCH-0902c-round-3.md` in RSNA; T047's `## Result`; anything in `/home/ade/Code/AGEAris/docs/plans/` except your own output file, the cut files `r0c/cut/*.jsonl`, `r0c/measurands.jsonl`, and the scripts `r0c/check.mjs` and `clauses.mjs`; `/home/ade/Code/AGEAris/AA/tasks/`, `PROGRESS.md`, any `reviews/` or `evidence/t075/` file. Other transcribers' ledgers are also off limits.
- Other code or documents in RSNA, read at the right commit, are fine when a clause cites them.

## What is a fact
Any clause that states something checkable: a number or count, a state ("was never passed", "is unused", "blocks T007"), a comparison, a cause or inference ("so", "⇒", "because", "which unlocks"), a ranking, a verdict, a correction, a recommendation with its reason. **A clause with several claims gives several facts**, each with the same `at` (a list of options gives one fact per option that makes a claim). Questions that frame a hypothesis ("is the whole band overfit?") are facts too, with mark `INFERRED` and the claim they pose as `value`, when the document goes on to test them.

One line per fact:
```
{"kind":"fact","id":"{G}-F1","at":"lane10#392","key":"<object>/<attribute>","value":"three TTA views","unit":"views","mark":"INFERRED","src":[],"premises":["lane10#410"],"premises_by":"lane","refs":["fold?"],"says":"unlocks three TTA views (§3.4)"}
```
- `id`: `{G}-F<n>`, numbered from 1.
- `at`: the clause id.
- `says`: **verbatim** from that clause's `text` (≤ 240 bytes); a fragment is fine.
- `value`: **verbatim** inside `says`: the number, set or state claimed.
- `key`: a readable label, `<object>/<attribute>`. It is for display only; it never decides anything.
- `mark`: the document's own mark when it gives one (REPRODUCED, MEASURED, SIMULATED, READ, INFERRED); otherwise the honest one: READ for something read off a source, INFERRED for a conclusion.
- `src`: what the claim cites, as a list. Forms:
  - `path:line@commit` for a tracked file. Pin round-3 lane citations (lanes 9–13, the T047 brief) to `d9c7c6e`, the lanes' base; pin R1's citations to `6d10943` and R2's to `2b3d2a6`. Each cited line must contain at least one of the fact's `refs`, so cite the line that actually holds the identifier; if the document cites a wrong line, cite the right one and add `"cite_fixed": true`.
  - `path:line@worktree#<sha256 of the file>` for an untracked file (e.g. under `outputs/`), read with `cat`.
  - `path#<heading text>@commit` for a section of a Markdown document; `path#<symbol>@commit` for a code definition.
  - `cmd:git grep -n -e <pattern> <commit> -- <pathspec>` for a **negative claim about code** ("never passed", "has no --resume"): cite the search that would show it. Always do this for negative claims about code.
  - `m:<name>` when the fact is about a measurand registered in `r0c/measurands.jsonl` (a runtime, a leaderboard figure, a count… not anchored in code). Add it alongside any other source.
  - `[]` when the document cites nothing. Keep the document's own mark.
- `refs`: identifiers the fact is about (flags, functions, members, files), each found on a cited `path:line`.
- `premises`: required for INFERRED: what the inference rests on, as fact ids of your ledger or **clause ids** of any group (`r0c/cut/*.jsonl` lists them all). `premises_by`: `lane` when the document names them, `transcriber` when you chose them.

## What is a skip
```
{"kind":"skip","clauses":["lane10#1","lane10#5-9"],"why":"no-claim"}
```
- `no-claim`: headings that carry no claim, method notes with nothing checkable, navigation, table headers. Ranges `doc#a-b` are fine for runs of them.
- `repeat`, with `"of":"{G}-F12"`: the clause restates, word for word in substance, a fact already in your ledger.
- `quote`, with `"of":"<clause id or path>"`: the clause only quotes another document **and nothing in this document relies on or disputes it**. If it does, write a fact.

## Check, until clean
```
cd /home/ade/Code/AGEAris && node docs/plans/evidence/t082/r0c/check.mjs docs/plans/evidence/t082/r0c/cut/{G}.jsonl docs/plans/evidence/t082/r0c/ledger-{G}.jsonl docs/plans/evidence/t082/r0c/measurands.jsonl /home/ade/Code/RSNA --prefix {G}
```
It must exit 0: every clause disposed of, every quote verbatim, every value in its quote, every cited line holding a ref. Run it as you go.

## Output
Write **only** `/home/ade/Code/AGEAris/docs/plans/evidence/t082/r0c/ledger-{G}.jsonl`. Append as you go, document section by section, so that partial work survives if you are cut off. Do not commit; do not `git add`.

## The trail — rule 6 of the board protocol, verbatim
> 6. **Checkpoint before you spend, not after.** Open a run, write `doing` *before* the act, `did` after it, `end` whenever you stop for any reason. Every entry carries `next`. Commit the entries that cost something; let the rest ride. A trail-only commit's subject starts `ckpt: `. The format is [`checkpoints/_SCHEMA.md`](checkpoints/_SCHEMA.md). *(WHY § what a dead run leaves behind.)*

Your run is already open. From `/home/ade/Code/AGEAris`:
- when about half done: `AA/ckpt.sh log T082 did --run {RUN} --what "{G}: <n> of {N} clauses disposed" --next "the rest of {G}"`
- when check.mjs exits 0: `AA/ckpt.sh log T082 did --run {RUN} --what "{G} clean: <facts> facts, <skips> skips, <minutes> min" --next "parent links"`
- then: `AA/ckpt.sh log T082 end --run {RUN} --left "<nothing, or what is unfinished>" --next "parent links"`
Do not pass `--commit`.

## Final message
At most 12 lines: facts, skips, minutes taken, check.mjs's final summary line, and anything you were unsure about. Do not paste the ledger.
