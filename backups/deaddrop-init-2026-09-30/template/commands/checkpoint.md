---
description: Open, append to, review or retire a task's checkpoint trail — the record that survives a dead session
---

# /checkpoint [ID | open ID | did | doing | end | close ID]

Target: `$ARGUMENTS`. Rules: `deaddrop/RULES.md` rules 6 and 7. Format:
`deaddrop/checkpoints/_SCHEMA.md`.

**With no argument**, review: run `deaddrop/ckpt.sh live`, say what is in flight
and what died without an `end`, and name what has to be checked before anything
is spent. Change nothing.

## Why this exists

`## Handoff` is a **rewrite** — the last state somebody had time to write down.
A checkpoint is an **append** — written *as the work happens*, so there is
nothing left to do at the moment of death. A plan limit, a crash and a
discarded subagent give no warning.

**A run killed between a `doing` and its `did` leaves the most valuable line in
the file:** it turns *nobody knows* into *this exact thing was in flight, go and
check it.*

## The loop

```sh
RUN=$(deaddrop/ckpt.sh open <ID> --brief "what this run is for" --budget "2 gpu-hour")

# BEFORE anything expensive or irreversible — before, not after:
deaddrop/ckpt.sh log <ID> doing \
  --act  "what is about to run" \
  --tell "how a stranger could tell whether it happened" \
  --next "the literal command that resumes it" \
  --commit "<ID> launching ..."        # this one must survive the machine

# after it:
deaddrop/ckpt.sh log <ID> did --what "..." --where "path/on/disk" --next "..."

# whenever you stop, for ANY reason — finished, interrupted, told to halt:
deaddrop/ckpt.sh log <ID> end --changed "..." --cost "..." --left "..." --next "..."
```

**Every entry carries `--next`** — the literal command, or the decision that has
to come first. The newest line is the resume point; nobody should have to
reconstruct it.

An entry earns its line only if the next runner would otherwise **pay for it
again**. No reasoning, no commentary, no file listings. A trail past a few
hundred lines means somebody is narrating.

## What counts as expensive

Whatever `deaddrop.yml` lists under `spend:`. That list is the project's
definition and the only thing rules 5 and 6 key off.

## Spawning a subagent

A subagent dies with its parent and its report reaches one reader, once. **The
trail is the deliverable.** Open its run *before* the call:

```sh
CHILD=$(deaddrop/ckpt.sh open <ID> --agent "Explore" --brief "read the logs" --no-commit)
deaddrop/ckpt.sh log <ID> doing --act "spawning Explore as $CHILD" \
  --tell "$CHILD has entries" --next "read its end line before respawning"
```

Then put the contract in the brief verbatim, because it knows only what you
tell it:

```
You are run <CHILD> on <ID>. Log with:
  deaddrop/ckpt.sh log <ID> <did|doing|blocked|end> --run <CHILD> --key "value"...
A `doing` BEFORE anything expensive or irreversible, a `did` after it, an `end`
whenever you stop for any reason. Every entry carries --next. Do not pass
--commit; the parent commits the batch. Your final report may never be read —
the trail is the deliverable.
```

A fan-out is **one** commit by the parent, not one per child. A parent's `doing`
left open forever reads as "a subagent is still out there" to every session
after it.

## Reaping a dead run

No process, no `end`, nothing moving: write the `end` **for** it and say so in
the commit.

```sh
deaddrop/ckpt.sh log <ID> end --run <theirs> \
  --changed "unknown — reaped by <operator>, process gone" --next "..."
```

That is the **only** line you may ever add to someone else's run. Never rewrite
what they wrote; a correction is another line.

## Closing the task out

```sh
deaddrop/ckpt.sh close <ID>            # the digest — into the Result, then the log
deaddrop/ckpt.sh close <ID> --delete   # commits, then retires the trail
```

It refuses to delete while a run has no `end`. Nothing is lost:
`git log --diff-filter=D -p -- deaddrop/checkpoints/<ID>.jsonl` is the whole
trail, forever. **The working tree is the desk; git is the archive.**
