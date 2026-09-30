---
description: Claim or reclaim a task — check the right to take it, verify the handoff, commit the claim before any work
---

# /reclaim [ID] [--release]

Target: `$ARGUMENTS`. Rules: `deaddrop/RULES.md`. **A claim is a commit and it
comes before the work.** Nothing here is optional because the commit is what
stops two agents doing one task.

With **no ID**, list what is claimable and stop — your own idle claims first
(rule 3 hands those straight back), then expired ones, then the ready backlog.
Do not pick for the user.

## 1. May you claim at all?

```sh
deaddrop/board.sh
```

**If WIP is over the limit, stop.** The next action is to finish or release
something, not to claim (rule 10). Say so and stop; do not claim anyway.

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

The operator is `git config user.name`. **A claim whose operator is yours is
yours**, whatever the profile or session id says — a plan switch or a crash is
not a handoff to a stranger.

If you are *not* taking an expired claim, still **release** it: set the owner to
`— (claim expired <date>; was <old owner>)`, make `status` describe what is
actually true, and move it back to `backlog/`. A board showing a live claim held
by a dead session is worse than an empty one.

## 3. Verify the handoff before you trust it

```sh
deaddrop/ckpt.sh last <ID>      # the trail: written while the work happened
```

Then read the task's `## Handoff`. **When they disagree about what is in
flight, the newest trail entry wins** — it is younger and it was written
*before* the act rather than after the fact.

Verify both against the machine. A session cut off by a plan limit stopped
without warning, so its handoff is **more** likely to be stale than one written
at a clean stop, not less. Check the process, check the paths, check the times.

**If something is in flight, find out whether it finished before you start
anything.** That is the whole reason the trail exists.

## 4. Claim it

The move **is** the commitment point, so it is the move that must be committed:

```sh
git mv deaddrop/backlog/<ID>-<slug>.md deaddrop/tasks/
```

Then in the frontmatter:

- `status: claimed`
- `owner: <operator> @<profile>/<session> <YYYY-MM-DD> — <what you are doing>`

Compute the owner line, do not guess it:

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

STATE.md's generated region is rendered, not written — do not hand-edit it
(rule 11). If the NOW block's *next action* is now wrong, rewrite that; it is
the one region that is yours.

## `--release`

The reverse, for a claim you are not taking: owner to
`— (claim expired <date>; was <old owner>)`, status to the truth, `git mv` back
to `backlog/`, commit `release <ID>: ...`, re-render the board. **Never silently
take a live claim**, and never edit another owner's file beyond this.
