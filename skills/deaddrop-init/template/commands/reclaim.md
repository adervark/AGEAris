---
description: Claim or reclaim a task — check the right to take it, verify the handoff, commit the claim before any work
---

# /reclaim [ID] [--release]

Target: `$ARGUMENTS`. Rules 1–5 and 8 in `deaddrop/RULES.md`. **A claim is a
commit and it comes before the work** — the commit is what stops two agents
doing one task.

With **no ID**, list what is claimable and stop — your own idle claims first,
then expired ones, then the ready backlog. Do not pick for the user.

## 1. May you claim at all?

```sh
deaddrop/board.sh
```

**If WIP is over the limit, stop and say so** (rule 10). Do not claim anyway.

A task marked **⚑** has no decision rule registered. If it will spend anything
named in `deaddrop.yml`, it is not ready — write the rule first, in its own
commit, then claim (rule 5).

## 2. May you claim *this* one?

Read the board's mark for it:

| | what it means | what you may do |
|---|---|---|
| in **BACKLOG** | nobody has committed to it | claim it |
| **↩** | your own idle claim | take it back **immediately**, no staleness wait (rule 3) |
| **⊘** | no sign of life past `stale_hours` from anyone but the owner | reclaim it (rule 4) |
| claimed, no mark | somebody is working | **do not take it.** Say who and stop |

If you are *not* taking an expired claim, still `--release` it (below). A board
showing a live claim held by a dead session is worse than an empty one.

## 3. Verify the handoff before you trust it

```sh
deaddrop/ckpt.sh last <ID>      # the trail: written while the work happened
```

Then read the task's `## Handoff`. Where they disagree, the trail wins (rule 8).
Verify both against the machine — the process, the paths, the times. A handoff
from a session a limit cut off is the likeliest to be stale (WHY § plan
switches).

**If something is in flight, find out whether it finished before you start
anything.** That is the whole reason the trail exists.

## 4. Claim it

```sh
git mv deaddrop/backlog/<ID>-<slug>.md deaddrop/tasks/
```

Then in the frontmatter set `status: claimed` and the owner line (rule 1).
Compute it, do not guess it:

```sh
printf '%s @%s/%s %s\n' \
  "$(git config user.name)" \
  "$(basename "${CLAUDE_CONFIG_DIR:-$HOME/.claude}" | sed 's/^\.claude-\?//; s/^$/default/')" \
  "${CLAUDE_CODE_SESSION_ID:0:8}" \
  "$(date -u +%F)"
```

When you are taking over your own displaced claim, keep the old one inline:
`— continued from @b/fcc6f897`.

Commit immediately, **before any work**:

```
claim <ID>: <one line>
continue <ID>: @b/fcc6f897 -> @k/91af95ef, profile switch     # rule 3
reclaim <ID>: expired <date>, was <old owner>                 # rule 4
```

**If the commit conflicts, someone else got there first.** Stop and re-read the
board.

## 5. Refresh the board

```sh
deaddrop/board.sh --write
```

If the NOW block's *next action* is now wrong, rewrite that too; it is the one
region that is yours (rule 11).

## `--release`

For a claim you are not taking: owner to
`— (claim expired <date>; was <old owner>)`, `status` to what is actually true,
`git mv` back to `backlog/`, commit `release <ID>: ...`, re-render the board.
**Never silently take a live claim**, and never edit another owner's file beyond
this.
