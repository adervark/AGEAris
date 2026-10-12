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
| `open` | header, written by `ckpt.sh open` | `operator`, `profile`, `session` (full id), `agent`, `model`, `brief`, `budget`, `may_touch`; `boot`, `pid`, `pstart`: the process the run lives in (below) |
| `did` | after anything the next runner would otherwise pay for again | `what`, `where` |
| `doing` | **before** anything expensive or irreversible | `act`, `tell`, `cost`; `until` when the act may run silent for long |
| `blocked` | what stopped the run | `what`, `unblocks` |
| `end` | whenever a run stops, for any reason | `changed`, `cost`, `left` |

```json
{"ts":"2026-09-11T04:45:04Z","run":"e857a8c8","kind":"open","operator":"ade","profile":"k","session":"e857a8c8-03a8-491f-8bbc-d9582ffd1d82","boot":"5c2e1a0e-8d4b-4c38-9b0f-2f6a1d3e7b91","pid":48213,"pstart":"Fri Sep 11 04:41:57 2026","agent":"session","model":"opus-5","brief":"train arm d fold 0","budget":"2 GPU-h","may_touch":"outputs/armd/"}
{"ts":"2026-09-11T04:52:10Z","run":"e857a8c8","kind":"doing","act":"fold 0, ~2 h GPU","tell":"outputs/armd/last.ckpt exists","cost":"2 GPU-h","until":"2026-09-11T07:22:10Z","next":"bash scripts/run_folds.sh --arm d --resume"}
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
- **Group by run *within one file*.** Run ids are session-derived, so one
  session on two tasks has the same id in both trails. A run's newest entry is
  its last line in the file.
- **Every run that has not ended is running or closed.** Never "maybe": the
  first of these that applies decides, and a reader says which one did
  (`ckpt.sh live` prints it):

  1. **`end`.** Its newest entry is an `end`: closed.
  2. **`until`.** Its newest entry is a `doing` whose `until` is still ahead:
     running, whatever its process. A reader counts `until` at most
     `stale_hours` past its line's `ts`, so it can never hold a task longer
     than rule 4 allows.
  3. **Its process.** It names a process (below), and `boot` is this
     machine's boot id now: running if a process with that `pid` is alive and
     started at `pstart`, closed if not. A crash, a closed terminal and a
     reboot read as closed at once; an open session reads as running, however
     quiet.
  4. **The clock.** Otherwise, because the process ran on another machine or
     none was named: running if its newest entry is within `live_minutes`
     (`AA.yml`, 30 when unset, always below `stale_hours`), closed if not.

  The process is the failsafe. It is the only one of the four that knows a
  session stopped without saying so. The clock is the weakest, and is used
  only where no process can be checked.
- **A `doing` with `until` is an act that may run silent.** `until` is the
  latest UTC time the act may still be running without another line. An act
  that writes nothing for long (a training run, a migration, a long build)
  sets it: `ckpt.sh log T042 doing … --for 2h`, or `--until <time>`. It
  matters most where the process cannot be checked, and for an act that runs
  apart from its session. Do not repeat the act before `until` unless its
  `tell` shows it has stopped. If it runs over, append another `doing` with a
  later `until` before the first lapses. Lengthen `stale_hours` where single
  acts legitimately run for days.
- **A `doing` is in flight while its run is running.** Keep off it unless the
  run is yours.
- **A `doing` whose run is closed stopped mid-act.** The act itself may still
  be running on its own (a detached job), so check its `tell` before anything
  else. If the act is running, keep off. If it has stopped, append the reaping
  `end` for that run (`ckpt.sh log T042 end --run <ID> …`, rule 2's
  exception), then resume. If you cannot tell, stop and ask.

## The process

A run names the process it lives in, so a reader on the same machine can tell
a running session from a closed one:

| field | what |
|---|---|
| `boot` | the machine's boot id: `/proc/sys/kernel/random/boot_id` on Linux, `sysctl -n kern.bootsessionuuid` on macOS. It changes at every boot, so it names a machine and a boot and nothing more. |
| `pid` | the session's process, a whole number: `AA_SESSION_PID` if the harness sets it, else `CLAUDE_PID` (Claude Code sets it), else the nearest `claude`, `codex` or `gemini` process above the shell |
| `pstart` | when that process started, as `TZ=UTC LC_ALL=C ps -o lstart= -p <pid>` prints it with its spaces collapsed: `Fri Sep 11 04:41:57 2026`. A pid used again by a later process has another start. |

`ckpt.sh open` writes all three, or none of them when one cannot be found;
readers then go by the clock. A run that continues in a new process (a resumed
session) names it again on its next entry, and the newest entry that names a
process is the one that counts. A reaping `end` never names one: it belongs to
the run it closes. A subagent lives in its parent's process, so its run names
the parent's.

## Retiring a trail

When the task closes, the trail is summarised into the task's Result, committed,
and then removed from the tree (`ckpt.sh close <ID> --delete`, which refuses
while any run lacks an `end`). Git keeps it:

```sh
git log --diff-filter=D -p -- AA/checkpoints/T042.jsonl
```

Why each of these choices was made: [WHY.md](../WHY.md) § *How the trail is
shaped*.
