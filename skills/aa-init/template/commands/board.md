---
description: Reconcile the board against the task files and the machine, and name the next action
---

# /board — read the board, then check what a script cannot

Read-only. Change nothing, claim nothing, commit nothing. End with **one**
recommended next action and the rule that judges it.

## 1. Let the script do the mechanical half

```sh
AA/board.sh --all       # columns, WIP, marks, flow metrics, POLICY AND DRIFT
AA/board.sh --check     # is STATE.md's generated region stale?
AA/ckpt.sh live         # what was in flight when the last run stopped?
```

Everything the board prints is measured from the task files, the trails and git.
**Do not redo any of it by hand**; your reading is not a measurement.

## 2. Check the four things the script cannot

The script reads files. These need judgement or a machine:

1. **Handoffs against reality.** For every task in IN PROGRESS, read its
   `## Handoff`. Does "In flight" match `ps` / the trail / what is actually
   running? Do the paths under "On disk" exist? Does "Resume with" still name a
   command that works? A handoff claiming *nothing in flight* while a process
   runs costs the next session more than an empty one (rule 8).
2. **Blocked tasks whose gate has cleared.** Each names exactly what unblocks
   it. Go and look — the blocker is often gone and nobody noticed.
3. **⚙ in flight with no live process.** A `doing` nothing closed means either
   work is still running or a run died without saying so. Check, then either
   leave it or reap it (`/checkpoint`, rule 2).
4. **The NOW block.** Is the standing still true? Is the next action still the
   next action? It is the one hand-written region, so it is the one that rots.

## 3. Report

Findings first, grouped by what they cost. Then, on its own:

```
NEXT: <one action> — <the rule that says so>
```

If WIP is over the limit, the next action is to **finish or release something**,
never to claim (rule 10). If a task is ⚙ with a dead process, that outranks
everything: somebody is about to pay for it twice.

## Discipline

- **Report, do not fix.** A status is the owner's to write; `/reclaim` is the
  route. The exception is your own damage, which you repair and say so.
- **Cite, do not assert.** "I looked" is not a citation. Name the file, the
  line, the command you ran.
- **Check your own findings before publishing them.** A false finding against
  another session's work is worse than a missed one — it gets acted on.
