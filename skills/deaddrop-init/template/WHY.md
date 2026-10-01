# Why the rules are what they are

[RULES.md](RULES.md) is the protocol and is complete on its own. This file is
the argument: what each rule costs, what happened when it was absent, and what
the convention deliberately refuses to do. **Read it when you want to change a
rule, not before you work.** It holds no rules and no procedures — those live
in RULES.md and in the commands.

Where a date appears, it is an incident that actually happened in a repo running
this convention.

---

## The shape of the problem

Agents on one project never meet. A session dies mid-task; a headless worker
wakes with no history; a plan limit cuts you off and you return on another
account; a different harness picks up tomorrow. So they coordinate the way
people who cannot meet do: a fixed location both sides know, where one leaves
material and the next collects it. Hence the name.

**Git is the coordination medium.** A claim is a commit, a result is a commit,
and two agents on one task is a merge conflict by design. Nothing depends on a
lock server, a daemon, or two agents being awake at once.

---

## Plan switches, and who you are *(rules 1, 3)*

Ownership follows the **operator** — the git identity — not the session and not
the account plan. A session id changes every restart; the plan changes when you
switch profiles; the person answerable does not. The profile and session in the
owner line are provenance only: they say which plan was paying and which
transcript to go and find. **Nothing about a claim's validity depends on them.**

A plan limit does not negotiate, so you *will* change accounts mid-work. That is
not a handoff — it is the same operator on a different meter, which is why rule
3 skips the staleness wait. Two ways back, cheapest first:

1. **Resume the conversation.** Transcripts are shared across profiles.
   `claude --resume` in the same directory. Nothing on the board needs touching,
   because the claim was never invalid.
2. **Resume from the board**, when the transcript is gone or a headless worker
   was doing the work, via `/reclaim`.

A session cut off by a limit stopped without warning, so **its handoff is more
likely to be stale than one written at a clean stop, not less.** That is why the
trail outranks the handoff (rule 8): the trail was written while the work
happened, the handoff only at the last moment somebody had one.

---

## The staleness clock *(rule 4)*

**This rule has been got wrong twice, both times in the direction that erases
evidence.**

**2026-09-10.** Commit `21c327a` repaired two dead script pointers in a task
file and, in the same commit, reported that task as a stale claim. Because
`/reclaim` read the file's last commit date and nothing else, the repair
**reset the staleness clock it was measuring** — the commit erased the evidence
for its own finding. The rule now reads *"by anyone but you"*, and that clause
is the whole rule: under the old wording any edit to another session's file — a
banner, a typo, the `## Notes` line rule 2 explicitly invites — silently
laundered the claim.

**2026-09-11.** A directory rename swept every task file. Without `--follow`,
each file's history begins at the rename, so `git log -1` reported the sweep and
**all seventeen live claims read as touched today.**

```sh
git log --format='%ad  %s' --date=short --follow -- deaddrop/tasks/T0XX-*.md \
  | grep -vE '  (migrate|ckpt):' | head -3
```

`--follow` is not optional after a rename, and it is why the filtering happens
in `grep` rather than in git: **`--follow` takes one path and does not compose
with `--invert-grep`** — together they return nothing at all, which is worse
than a wrong date because it looks like an answer.

The trail is read first because entries are deliberately not all committed, so
commit age alone buries live work.

---

## What a dead run leaves behind *(rules 6, 7)*

The task file says what is being done and by whom. It cannot say what has
*already* been done, because the worker best placed to write that is the one
most likely to die without warning.

`## Handoff` is a **rewrite** — it holds the last state somebody had time to
write down. A checkpoint is an **append** — it holds the trail, written as the
work happens, so there is nothing left to do at the moment of death.

**`doing` is the mechanic everything else rests on.** Written *before* the act,
with `tell` — how a stranger could tell whether it happened — a run killed
between `doing` and `did` leaves a `doing` that nothing closed, and **that is
the most valuable line in the file.** It turns *nobody knows* into *this exact
thing was in flight, go and check it.* It is the only defence against the
expensive failure: a successor that re-runs the job, re-sends the submission, or
re-buys the thing, because the record said nothing.

A subagent is the extreme case (rule 7): it dies with its parent and its report
reaches one reader once, so everything it learned is bought twice unless it was
written down as it went.

### How the trail is shaped

The format itself is in [`checkpoints/_SCHEMA.md`](checkpoints/_SCHEMA.md).
These are the reasons, written down so they do not get re-litigated and can be
checked when they stop holding.

**One file per task, not one per run.** The first cut gave every run its own
file, to keep a one-writer-per-file rule. Measured instead: ten concurrent
processes appending 400 short lines each to one file on ext4 produced 4000
lines, zero torn, zero lost. Appends commute; only *rewrites* need an exclusive
writer. The per-run layout was buying isolation that was not needed, and
charging 5–20× the files, a lock, and a run-number allocator for it.

**Run ids encode provenance instead of counting.** `<session8>[.<4 hex>]` needs
no allocator, cannot collide between two sessions or two clones, and points
straight at the transcript. An ordinal (`R01`, `R02`) needed a filesystem lock,
capped out, and — worse — two clones could each take `R03` for a different run,
which a union merge would silently interleave into one nonsensical run. With
provenance ids that cannot happen, which is what makes `merge=union` on a
shared per-task trail correct rather than dangerous. The
price: one session on two tasks has the same run id in both trails. **2026-09-14:**
a reader that grouped every trail by run at once let a closed task's `end` hide
another task's live `doing`, and printed "none in flight" with a fold queued on
the card. Hence *group within one file*.

**JSONL, not markdown.** The last line is the resume point with no parsing; one
`jq` pass answers questions across every task at once; diffs are pure additions;
and a fixed, small field set is what stops an entry becoming a transcript. The
cost — it is denser to read by eye — is paid by `ckpt.sh live` and `board.sh`,
which render it.

**Reads tolerate a broken line.** A plain slurp dies on the whole file when the
last line is half-written — measured: 4000 good records lost to one partial
line.

**Liveness is read from `ts`, not from commits.** Since only what cost something
is committed, commit age is not evidence of death.

**The format is the contract; the script is the fast path.** Any harness that
cannot run bash can still take part by appending a line of JSON. So no rule may
be added that only the script can satisfy.

**The trail is retired on close, and only after it is committed.** Otherwise
`--delete` would destroy the uncommitted majority of the trail, which is the
normal case. After that the working tree holds only live tasks and git holds
everything that ever happened. **The working tree is the desk; git is the
archive.**

**It does not record everything.** "Everything" is what the transcript already
is: complete, enormous, and unreadable in a hurry. The `open` line carries the
full session id and agent label, so the transcript is one path away when the
full story is genuinely needed. The checkpoint is the index; the transcript is
the archive of last resort.

---

## The board that ate itself *(rule 11)*

The convention's own reference repo carried this rule:

> **STATE.md stays under one screen.** It is a board, not a log.

Its STATE.md reached **804 lines and 188 KB**, of which about twenty were
current. The file's own second line read *"everything below it is narrative and
may be stale"* — which is an admission, sitting in the first file every arriving
agent is told to read.

The rule was right and nothing enforced it, so it lost to a hundred small
appends each of which looked reasonable. **A hand-maintained board drifts; the
only question is how fast.**

So the board is generated. Everything on it is already derivable — claims from
the task files, staleness from git, what is in flight from the trails — and
exactly one region, NOW, is written by a human. `board.sh --check` exits
non-zero when the generated region is stale, so it belongs in CI or a pre-commit
hook. **Now "one screen" is a property of the renderer instead of a rule someone
has to keep.**

The same repo machine-enforced its test-suite size down to an md5 of the ordered
check names, and hand-maintained its board. Put the gate where the drift is.

The gate fell into two traps on its first test, and both shaped the code:

- **It cried wolf.** Ages, marks and flow numbers move with the clock, so
  comparing the whole render made the board "stale" minutes after every write.
  A gate that fires when nothing happened gets switched off, so `--check`
  compares structure only (`structural()` in `board.sh`).
- **It blocked the trail.** As a pre-commit hook it rejected `ckpt:` commits —
  at exactly the moment rule 6 needs them to land. `ckpt.sh` commits with
  `--no-verify`, which is load-bearing (`commit()` in `ckpt.sh`).

---

## The method this implements *(rules 5, 10)*

A **Kanban system** in the ordinary sense: a pull system with explicit states, a
limit on work in progress, and metrics taken from the work rather than from
anyone's opinion. The vocabulary is the method's so an argument about the board
can be settled by the method instead of by taste.

| Kanban's six core practices (Anderson) | here |
|---|---|
| 1. Visualise the work | `tasks/` *is* the work; `board.sh` draws it, one column per state |
| 2. Limit work in progress | the limit in `deaddrop.yml`; the board prints `WIP n/limit` and names the breach |
| 3. Manage flow | throughput, cycle time, work item age, flow efficiency — from git and the trails |
| 4. Make policies explicit | RULES.md, plus the limit, the DoR and the DoD, all checked by the board |
| 5. Implement feedback loops | `/board` is a service delivery review; `/reclaim` is replenishment |
| 6. Improve collaboratively, evolve experimentally | decision rules registered before, judged after (rule 5) |

**The commitment point is the move from `backlog/` to `tasks/`.** Before it, a
task is a queued option that costs nothing to drop or reorder. After it, it is
work in progress: it counts against the limit and its age is measured. The
location is the state precisely so that the two cannot drift apart — a status
field that can disagree with the directory will.

**Pull, never push.** Nothing is assigned. A worker takes the oldest item the
policy allows, which is why the board sorts work in progress oldest first: an
item's **age**, not its size, predicts a delivery that never arrives.

**The four flow metrics** (Vacanti) — WIP, work item age, cycle time, throughput
— plus **flow efficiency** (touch time ÷ elapsed), which is the one number a
normal board cannot produce: only the trail knows when anybody was actually
working.

**Little's Law** — average cycle time ≈ WIP ÷ throughput — is printed on every
board because it is the argument for the limit. Halving WIP halves the wait, and
it is the only lever that does not require working faster.

**Work item age is judged against this repo's own history**, not a borrowed
number: flagged `⚠` past the 85th percentile of the cycle times this project has
actually delivered. That is a signal to finish or split, not a lock — the claim
expiry is the lock, and it is a different mark.

**Work item types.** A twenty-minute documentation task and a five-day run do
not belong in one distribution, and an 85th percentile over both describes
neither. With `type:` in the frontmatter the reference line is computed per type
once five of that type have been delivered.

**Decision rules before the spend** (rule 5) are the Definition of Ready: a
result judged against a line drawn afterwards is a result that was always going
to pass. The **Definition of Done** is Scrum's one contribution worth keeping:
it stops "done" meaning four different things on one board.

### What this deliberately does not take

- **No sprints.** Work arrives when a limit resets or a machine frees up, not on
  a fortnightly boundary, and a boundary nobody can hold is a lie printed on the
  board. A WIP limit buys the same focus without a date to miss.
- **No estimates, points or velocity.** With measured cycle times a forecast
  comes from the distribution — *"85% of tasks like this delivered inside 16 h"* —
  which is cheaper and more honest than a guess. Velocity is throughput with
  ceremony.
- **No standup, no grooming.** The agents are asleep between commits. `board.sh`
  is the standup and it runs when somebody arrives.
- **No status field as the source of truth.** The directory is the column.

---

## Scale

Four properties keep this working at 5,000 tasks as well as at five, and none of
them requires anybody to tidy anything:

1. **Nothing hand-maintained grows with task count.** The board is rendered; the
   trails are retired on close; history goes to the log and to `done/`.
2. **One file per task**, so parallel agents conflict only when they genuinely
   collide on the same work.
3. **`backlog/` absorbs the long tail.** The board shows committed work in full
   and the backlog as a count, so a hundred registered ideas cost one line.
4. **The trail is append-only with `merge=union`**, so two clones writing to one
   task's trail merge without a conflict.

If the board is slow or unreadable, the cause is work in progress, not the tool.
That is the diagnosis Little's Law exists to make.
