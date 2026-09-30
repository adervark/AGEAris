# Why the rules are what they are

[RULES.md](RULES.md) is the protocol and is complete on its own. This file is
the argument: what each rule costs, what happened when it was absent, and what
the convention deliberately refuses to do. **Read it when you want to change a
rule, not before you work.**

Every section here was written after something went wrong. Where a date appears,
it is an incident that actually happened in a repo running this convention.

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

## What a dead run leaves behind *(rules 6, 7)*

The task file says what is being done and by whom. It cannot say what has
*already* been done, because the worker best placed to write that is the one
most likely to die without warning.

`## Handoff` is a **rewrite** — it holds the last state somebody had time to
write down. A checkpoint is an **append** — it holds the trail, written as the
work happens, so there is nothing left to do at the moment of death.

**`doing` is the mechanic everything else rests on.** Write it *before* the
act: what is about to run, and `tell` — how a stranger could tell whether it
happened. Then act. Then write `did`.

A run killed in between leaves a `doing` that nothing closed, and **that is the
most valuable line in the file.** It turns *nobody knows* into *this exact thing
was in flight, go and check it.* It is the only defence against the expensive
failure: a successor that re-runs the job, re-sends the submission, or re-buys
the thing, because the record said nothing.

An entry earns its line only if the next runner would otherwise **pay for it
again** — compute, money, wall-clock, or the same wrong turn. No reasoning, no
commentary, no file listings. A trail past a few hundred lines means somebody is
narrating rather than checkpointing.

### Why the trail is retired

`close <ID> --delete` commits the trail and removes it from the tree, after
printing a digest that goes into the Result. Nothing is lost —
`git log --diff-filter=D -p -- deaddrop/checkpoints/T042.jsonl` is the whole
thing, forever. **The working tree is the desk; git is the archive.** That is
why `checkpoints/` only ever holds live tasks, however long the project runs.

### Why the format is the contract

The script is only the fast path. A line appended by hand with `jq` — or by
anything that can write a line of JSON — is equally valid. Any harness that
cannot run bash can still participate. Do not add a rule that only the script
can satisfy.

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

Read the trail first regardless. Entries are deliberately not all committed, so
commit age alone buries live work.

---

## Plan switches, and who you are *(rule 3)*

Ownership follows the **operator** — the git identity — not the session and not
the account plan. A session id changes every restart; the plan changes when you
switch profiles; the person answerable does not.

```
owner: <operator> @<profile>/<session> <YYYY-MM-DD> — <what you are doing>
```

The profile and session are provenance only: they say which plan was paying and
which transcript to go and find. **Nothing about a claim's validity depends on
them.**

A plan limit does not negotiate, so you *will* change accounts mid-work. That is
not a handoff — it is the same operator on a different meter. Two ways back,
cheapest first:

1. **Resume the conversation.** Transcripts are shared across profiles.
   `claude --resume` in the same directory. Nothing on the board needs touching,
   because the claim was never invalid.
2. **Resume from the board**, when the transcript is gone or a headless worker
   was doing the work. Find the claim whose *operator* is yours, take it back
   under rule 3, and read the **trail before the handoff** — the trail was
   written while the work happened, the handoff only at the last moment somebody
   had one.

A session cut off by a limit stopped without warning, so **its handoff is more
likely to be stale than one written at a clean stop, not less.** Verify both
against the machine before believing either.

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
exactly one region is written by a human:

```markdown
<!-- deaddrop:now -->     the standing and the next action. Yours.
<!-- /deaddrop:now -->
<!-- deaddrop:generated -->   rendered. Do not edit.
```

`board.sh --write` replaces only the generated region. `board.sh --check` exits
non-zero when it is stale, so it belongs in CI or a pre-commit hook. **Now "one
screen" is a property of the renderer instead of a rule someone has to keep.**

The same repo machine-enforced its test-suite size down to an md5 of the ordered
check names, and hand-maintained its board. Put the gate where the drift is.

### Two traps the gate fell into immediately, both caught on the first test

**The gate cried wolf.** `--check` first compared the *whole* render. But ages
(`now` → `2h`), the timestamp, ⚙ from a live trail, ⊘ from an expiring claim and
every FLOW number are derived from the clock and move on their own — so the
board went "stale" minutes after every write, forever. **A gate that fires when
nothing happened gets switched off**, and switching it off brings back the
804-line drift it was added to stop. So the comparison is now *structural*:
which task is in which column, under what title, owned by whom. Those change
only when a file changes.

**The gate blocked the trail.** Installed as a pre-commit hook, `--check`
rejected `ckpt:` commits — because writing a trail entry changes the board's ⚙
mark, which made the board stale, which failed the hook. Rule 6 requires the
trail to reach git **before** the expensive act; a hook that blocks it fails at
exactly the moment the trail is for. Worse, it failed *quietly*: the line was
already on disk, so nothing looked wrong until `close --delete` refused to
retire a trail it could not commit. `ckpt.sh` now commits with `--no-verify`,
and that is load-bearing rather than a shortcut.

And two smaller ones of the same shape. The failure message said **"index
busy"** for every failure, including that hook rejection — a message naming the
wrong cause sends the next reader to the wrong place, so it now prints what git
actually said. And `close --delete` ended its commit with `|| true`, then
printed *"deleted. The trail is in git"* **whether or not the commit had
succeeded** — under the hook it had not, so the removal sat staged and rode
along with a later, unrelated commit. A script that asserts what it did not
check is the same defect as a check that passes for the wrong reason; it now
verifies the commit and says plainly when it could not.

---

## The method this implements

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
location is the state precisely so that the two cannot drift apart.

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
neither. Put `type:` in the frontmatter and the reference line is computed per
type once five of that type have been delivered.

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
- **No status field as the source of truth.** The directory is the column. A
  status that can disagree with the location will.

The **Definition of Done** is Scrum's one contribution worth keeping: it stops
"done" meaning four different things on one board.

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

---

## Finding the full story

A checkpoint records only what the next runner would pay for again. When you
need everything, the trail says where to look: the `open` line carries the full
session id and the agent label, and transcripts survive the account switch that
killed the run.

```sh
ls ~/.claude/projects/"$(pwd | tr / -)"/<session>.jsonl        # the session
ls ~/.claude/projects/"$(pwd | tr / -)"/<session>/subagents/   # its subagents
```

**The checkpoint is the index; the transcript is the archive of last resort.**
