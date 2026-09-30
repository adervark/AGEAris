# The checkpoint format, and why it is shaped this way

One task, one file: `deaddrop/checkpoints/T###.jsonl`. **One JSON object per
line, append-only.** Nothing already written is ever edited — a correction is
another line. Every line carries `ts` (UTC), `run`, `kind`, and (except the
header) `next`, so the newest line is always the resume point.

A **run** is one worker on one task. Its id says who it was:

| run id | who |
|---|---|
| `e857a8c8` | the session whose id starts with those 8 characters |
| `e857a8c8.a4f2` | a subagent that session spawned |

| kind | when | fields |
|---|---|---|
| `open` | header, written by `ckpt.sh open` | `operator`, `profile`, `session` (full id), `agent`, `model`, `brief`, `budget`, `may_touch` |
| `did` | after anything the next runner would otherwise pay for again | `what`, `where` |
| `doing` | **before** anything expensive or irreversible | `act`, `tell`, `cost` |
| `blocked` | what stopped the run | `what`, `unblocks` |
| `end` | whenever a run stops, for any reason | `changed`, `cost`, `left` |

```json
{"ts":"2026-09-11T04:45:04Z","run":"e857a8c8","kind":"open","operator":"ade","profile":"k","session":"e857a8c8-03a8-491f-8bbc-d9582ffd1d82","agent":"session","model":"opus-5","brief":"train arm d fold 0","budget":"2 GPU-h","may_touch":"outputs/armd/"}
{"ts":"2026-09-11T04:52:10Z","run":"e857a8c8","kind":"doing","act":"fold 0, ~2 h GPU","tell":"outputs/armd/last.ckpt exists","cost":"2 GPU-h","next":"bash scripts/run_folds.sh --arm d --resume"}
{"ts":"2026-09-11T06:52:44Z","run":"e857a8c8","kind":"did","what":"fold 0 reached epoch 5 of 8","where":"outputs/armd/last.ckpt","next":"resume at epoch 5"}
{"ts":"2026-09-11T06:53:10Z","run":"e857a8c8.a4f2","kind":"blocked","what":"card busy with T038","unblocks":"T038 finishes, ~40 min","next":"re-check nvidia-smi, then resume"}
{"ts":"2026-09-11T07:10:00Z","run":"e857a8c8","kind":"end","changed":"fold 0 partial","cost":"1.2 GPU-h","left":"do NOT restart from epoch 0","next":"run_folds.sh --arm d --resume"}
```

`deaddrop/ckpt.sh` writes these, but **the format is the contract and the script
is only the fast path**. A line appended by hand is equally valid:

```sh
jq -cn --arg ts "$(date -u +%FT%TZ)" --arg run "$RUN" --arg kind did \
   --arg what "…" --arg next "…" \
   '{ts:$ts,run:$run,kind:$kind} + ($ARGS.named|del(.ts,.run,.kind))' \
   >> deaddrop/checkpoints/T042.jsonl
```

**An entry earns its line only if the next runner would otherwise pay for it
again** — compute, money, wall-clock, or the same wrong turn. No reasoning, no
commentary, no file listings.

---

## Why it is shaped this way

Written down so it does not get re-litigated, and so the reasons can be checked
when they stop holding.

**One file per task, not one per run.** The first cut gave every run its own
file, to keep the convention's one-writer-per-file rule. Measured instead: ten
concurrent processes appending 400 short lines each to one file on ext4 produced
4000 lines, zero torn, zero lost. Appends commute; only *rewrites* need an
exclusive writer. So the per-run layout was buying isolation that was not needed,
and charging 5–20× the files, a lock, and a run-number allocator for it.

**Run ids encode provenance instead of counting.** `<session8>[.<4 hex>]` needs
no allocator, cannot collide between two sessions or two clones, and points
straight at the transcript. An ordinal (`R01`, `R02`) needed a filesystem lock,
capped out, and — worse — two clones could each take `R03` for a different run,
which a union merge would silently interleave into one nonsensical run.

**JSONL, not markdown.** The last line is the resume point with no parsing; one
`jq` pass answers questions across every task at once; diffs are pure additions;
and a fixed, small field set is what stops an entry becoming a transcript. The
cost — it is denser to read by eye — is paid by `ckpt.sh live` and `ckpt.sh
board`, which render it.

**Reads tolerate a broken line** (`jq -R 'fromjson? // empty'`). A live run's last
line can be half-written when you read it, and a plain slurp dies on the whole
file when that happens — measured: 4000 good records lost to one partial line.
Malformed lines are reported by `live` and located by `check`, never silently
dropped.

**Liveness is read from `ts`, not from commits.** Since we deliberately commit
only what cost something, commit age is not evidence of death. The trail's newest
entry is (RULES rule 4).

**The trail is deleted when the task closes, and only after it is committed.**
`close --delete` commits anything pending first — otherwise it would destroy the
uncommitted majority of the trail, which is the normal case. After that the
working tree holds only live tasks and `git log --diff-filter=D -p` holds
everything that ever happened.

**It does not record everything.** "Everything" is what the transcript already
is: complete, enormous, and unreadable in a hurry. The `open` line carries the
full session id and agent label, so the transcript is one path away when the full
story is genuinely needed. The checkpoint is the index plus the facts worth
keeping.
