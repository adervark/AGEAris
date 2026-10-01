---
description: Open, append to, review or retire a task's checkpoint trail — the record that survives a dead session
---

# /checkpoint [ID | open ID | did | doing | end | close ID]

Target: `$ARGUMENTS`. Rules 6 and 7 in `deaddrop/RULES.md`; the format, and what
earns a line, in `deaddrop/checkpoints/_SCHEMA.md`. Why a `doing` left open is
the most valuable line in the file: `deaddrop/WHY.md` § *What a dead run leaves
behind*.

**With no argument**, review: run `deaddrop/ckpt.sh live`, say what is in flight
and what died without an `end`, and name what has to be checked before anything
is spent. Change nothing.

## The loop

```sh
RUN=$(deaddrop/ckpt.sh open <ID> --brief "what this run is for" --budget "2 gpu-hour")

# BEFORE anything named under spend: in deaddrop.yml — before, not after:
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

`--next` is the literal command, or the decision that has to come first. The
newest line is the resume point; nobody should have to reconstruct it.

## Spawning a subagent

Open its run *before* the call:

```sh
CHILD=$(deaddrop/ckpt.sh open <ID> --agent "Explore" --brief "read the logs" --no-commit)
deaddrop/ckpt.sh log <ID> doing --act "spawning Explore as $CHILD" \
  --tell "$CHILD has entries" --next "read its end line before respawning"
```

Then put the contract in the brief verbatim (rule 7), because it knows only what
you tell it:

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

No process, no `end`, nothing moving: write the `end` **for** it (the one line
rule 2 lets you add to someone else's run) and say so in the commit.

```sh
deaddrop/ckpt.sh log <ID> end --run <theirs> \
  --changed "unknown — reaped by <operator>, process gone" --next "..."
```

## Closing the task out

```sh
deaddrop/ckpt.sh close <ID>            # the digest — into the Result, then the log
deaddrop/ckpt.sh close <ID> --delete   # commits, then retires the trail
```

It refuses to delete while a run has no `end`. The retired trail stays in git:
`git log --diff-filter=D -p -- deaddrop/checkpoints/<ID>.jsonl`.

## Finding the full story

The trail is the index, not the archive. The `open` line carries the full
session id and agent label; transcripts survive the account switch that killed
the run:

```sh
ls ~/.claude/projects/"$(pwd | tr / -)"/<session>.jsonl        # the session
ls ~/.claude/projects/"$(pwd | tr / -)"/<session>/subagents/   # its subagents
```
