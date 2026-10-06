# The checkpoint format

One task, one file: `AA/checkpoints/T###.jsonl`. **One JSON object per
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

**An entry earns its line only if the next runner would otherwise pay for it
again** — compute, money, wall-clock, or the same wrong turn. No reasoning, no
commentary, no file listings. A trail past a few hundred lines means somebody is
narrating rather than checkpointing.

## Writing a line without the script

`AA/ckpt.sh` is the fast path; **the format is the contract.** A line
appended by hand is equally valid:

```sh
jq -cn --arg ts "$(date -u +%FT%TZ)" --arg run "$RUN" --arg kind did \
   --arg what "…" --arg next "…" \
   '{ts:$ts,run:$run,kind:$kind} + ($ARGS.named|del(.ts,.run,.kind))' \
   >> AA/checkpoints/T042.jsonl
```

Commit a trail-only change with a subject starting `ckpt: `, so the project's
own history stays `git log --invert-grep --grep='^ckpt: '`.

## Reading

- **Skip an unparseable line, and report it.** A live run's last line can be
  half-written when you read it. Never let one bad line fail the whole file,
  and never drop one silently (`ckpt.sh live` reports, `ckpt.sh check` locates).
- **A run is alive if its newest entry is recent**, whether or not anything was
  committed — entries are deliberately not all committed (rule 4).
- **A `doing` with nothing after it in the same run** is work that was in flight
  when the run stopped. Group by run *within one file*: run ids are
  session-derived, so one session on two tasks has the same id in both trails.

## Retiring a trail

When the task closes, the trail is summarised into the task's Result, committed,
and then removed from the tree (`ckpt.sh close <ID> --delete`, which refuses
while any run lacks an `end`). Git keeps it:

```sh
git log --diff-filter=D -p -- AA/checkpoints/T042.jsonl
```

Why each of these choices was made: [WHY.md](../WHY.md) § *How the trail is
shaped*.
