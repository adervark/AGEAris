# The rules

Normative and complete: an agent that reads only this page works correctly.
The reasons are in [WHY.md](WHY.md); a rule marked *(WHY § …)* has an incident
behind it, worth reading before you argue with it.

**A *spend* is anything this project cannot undo or would pay for twice.**
What counts is listed in [`deaddrop.yml`](deaddrop.yml) — that file, and only
that file, is where a discipline differs. Everything on this page is the same
everywhere.

## Claiming

1. **Claim before working, and the claim is a commit.** Move the file from
   `backlog/` to `tasks/`, set `status: claimed` and the owner line, commit.
   If the commit conflicts, someone else has it. The owner line is
   `<operator> @<profile>/<session> <YYYY-MM-DD> — <what you are doing>`, and
   the operator is `git config user.name`. *(A commitment nobody can see is
   not one.)*
2. **One owner per task.** Never edit a task file claimed by someone else, and
   never edit another run's trail. The single exception is the `end` that reaps
   a run which plainly died, and that is an append. Use `## Notes` to talk.
3. **The same operator is not a second agent.** If a claim's operator is yours,
   take it back immediately — no staleness wait — whatever the profile or
   session says. Keep the displaced line inline. *(WHY § plan switches.)*
4. **A claim goes stale after `stale_hours` with no sign of life.** Read the
   trail first; a run that wrote an entry is alive whether or not it committed.
   Fall back to commits **by anyone but you**, excluding `migrate:` and `ckpt:`
   sweeps. If you are not taking the work, still release it.
   *(WHY § the staleness clock — this rule has been broken twice, in the same way.)*

## Spending

5. **Decision rules before the spend, judged after.** A task that will spend
   carries its pass/fail criteria in the file *before* it can be claimed. That
   is the Definition of Ready, and `board.sh` marks a task without one `⚑`.
   They bind afterwards, including when the number lands one digit short.
6. **Checkpoint before you spend, not after.** Open a run, write `doing`
   *before* the act, `did` after it, `end` whenever you stop for any reason.
   Every entry carries `next`. Commit the entries that cost something; let the
   rest ride. A trail-only commit's subject starts `ckpt: `. The format is
   [`checkpoints/_SCHEMA.md`](checkpoints/_SCHEMA.md).
   *(WHY § what a dead run leaves behind.)*
7. **A subagent's brief carries rule 6 verbatim.** It knows only what its
   prompt says, it dies with its parent, and its report reaches one reader once.
   The trail is the deliverable.

## Stopping

8. **The handoff is the resume contract.** Keep `## Handoff` true *while* you
   are claimed, before anything that could outlive the session — not on the way
   out, because a limit or a crash gives no warning. If you did not verify
   something, say you did not. When the handoff and the trail disagree about
   what is in flight, the newest trail entry wins.
9. **Results land as they are measured**, in the file `deaddrop.yml` names as
   `log`, never at session end.

## The board

10. **Work in progress is limited** by `deaddrop.yml`. A breach is a stop
    condition: finish or release something before claiming. *(An unlimited
    board is a push queue with better manners.)*
11. **`STATE.md` below the NOW marker is generated.** Do not hand-edit it;
    `deaddrop/board.sh --write` regenerates it and `--check` fails when it is
    stale. History goes to the log and to `done/`.
    *(WHY § the board that ate itself — this is the rule the convention's own
    reference repo violated by 40×.)*
12. **New work gets the next id and a file in `backlog/`**, however small. If
    it is not a file, no agent will pick it up and the board cannot show it.

## Where things live

| | |
|---|---|
| `backlog/` | registered, **not** committed. No owner. Free to drop or reorder. |
| `tasks/` | past the commitment point. Counts against the WIP limit; its age is measured. |
| `tasks/done/` | delivered or killed. A decision not to do something is a result and is kept. |
| `checkpoints/T###.jsonl` | the live trail. Retired into the Result when the task closes; git keeps it. |

**The location is the state.** `status:` in the frontmatter adds detail within a
column; when the two disagree, the directory is right.

Moving a task to blocked: set `blockedReason:` to one line saying what
unblocks it.
