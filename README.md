# AGE Aris

A local project management application with a main dashboard for monitoring
project state and tasks. People use the web interface; tasks and history remain
available as Markdown files and git commits.

## Run the application

Requires **Node.js 22 or newer** and **git**. There are no npm dependencies to
install.

```sh
npm start
```

Open the sign-in link it prints, `http://127.0.0.1:4310/?token=…`. The browser
stays signed in for that data folder; the token keeps other local users out of
your workspace. Create your first project, track a repository whose agents
already keep an AA board (see
[Track an existing repository](#track-an-existing-repository)), or choose
**Explore a sample project** to create one with six weeks of simulated history
(marked **Simulated history** everywhere it appears).

## Home, projects, agents, activity

AGE Aris treats the way a project works as the product: work moves through
states, policies govern each move, and the method's checks say whether the work
follows them. Views use the method's own terms (WIP, cycle time, service level,
aging WIP, stale claim), and each one carries a line of plain meaning where it
appears.

**Home** is the first page, the view a project owner reads each morning:

- **Needs you**, grouped by what it breaks: decisions waiting on runs, overdue
  work, stale claims (agent claims with no commit or checkpoint within the
  stale threshold), dates at risk, aging WIP (in progress longer than the
  service level), blocked work, and urgent work in progress with no owner. Each
  item appears once, under its most pressing reason, with the holder's latest
  note. Checks with nothing to report fold into one "All clear" line.
- **Projects**: one card per project with its health in words (On track, Watch,
  Needs attention, or a grey label when history is too thin), the failing
  checks in one sentence, throughput against a usual week with a four-week
  sparkline, WIP, cycle time, service level, and agent sessions at work.
- **Since your last visit**: what finished, started, was blocked or unblocked,
  added, dropped, reopened, or slipped. Each count expands into its tasks. The
  window can also be the previous working day, 24 hours, or 7 days. **Mark
  seen** starts the next window from now. Leaving Home after ten seconds also
  does this. The last visit is kept in this browser only.

A project opens on its **Board** under a status line and four numbers:
throughput, WIP against its limit, cycle time, and service level. Cards carry
the same signal badges as Home (stale, aging, blocked, overdue) and the
holder's latest note. Done shows the newest ten of what finished this week and
says how many more there are; **Show all** expands it. **Threads** organises
tasks by what they build on, read from each task file's `depends:` line: a
thread is a task and everything filed under it. Threads with open work come
first, each showing its open tasks and the tasks they build on, with finished
steps folded. A long chain stays in one column and only a branch indents; a
task that needs more than one other task sits under the first and notes the
rest. An open task whose dependency is not done is marked **Waiting on** that
task, here, on its card, and in its drawer, which also lists what it builds on
and what builds on it. **List** groups tasks by state, one line each (on
narrower screens a task's signals sit under its title). **Flow** holds every
flow measure (throughput, usual week, WIP, cycle and lead time with their 85%
levels, blocked time, repeat slips), labeled charts, the risk and load tables,
and the git history the numbers were computed from. **Method** shows the
workflow and the policy behind each move, the health rules H2–H8 as named
method checks with the tasks that break each, the agent claim → checkpoint →
done protocol with its stale threshold, the pipeline's stages and gates (own
projects), and a tracked board's own `WORKFLOW.md`, `RULES.md`, `AGENTS.md`,
and `WHY.md`, rendered read-only.

Every number is a button. It opens the **Explain** drawer with the definition,
formula, clock, sample size, settings, the items counted, what was left out and
why, and the commits or audit events each item comes from. The definitions are
in [docs/METRICS.md](docs/METRICS.md).

A task opens in one drawer, whatever the page: its state, holder, signals, and
latest note; for a tracked repository, the task file as written; and its
timeline, with checkpoints folded and each change's commit. Tasks of your own
projects are edited there.

**Agents** lists the agent sessions holding work now, with what they hold,
their latest note, and whether their claim has gone stale. **Pipeline agents**
holds the agents the pipeline routes stages to and their record per role.
**Activity** shows one row per task per day (for example, Backlog → In
progress → Done); expanding a row lists each raw change with its commit. It
filters by kind and project. **All tasks** (from Projects) and search span the
workspace.

Timezone, working days, and the personal work-in-progress limit are read from
`<data dir>/settings.json` (`{"timezone": "Europe/London", "workdays": [1,2,3,4,5],
"personalWipLimit": 3}`). Ages and approval times skip non-working days.

The page refreshes every 10 seconds while visible; Home's brief every 30.
Refreshing pauses while a project or task editor is open, preserving the edit
in progress. The refresh button also loads changes immediately. The live
indicator changes to Reconnecting if the server becomes unavailable.

Drag a task to another column of one of your own projects, or open it and
choose a status. Use search (`/`) and owner, priority, or status filters to find
work. Old `#today`, `#overview`, `#tasks`, `#work`, `#changes`, and `#activity`
links open Home, All tasks, and Activity.

## Agent pipeline

Open a task and choose **Run with agents**. The task moves through stages,
Triage, Plan, Implement, Review, and Verify by default. For each stage AGE Aris
picks the agent with the best measured record for that kind of work. It stops
for your approval after Plan and Review. Home's **Needs you** lists every run that is
waiting on you. From there you can approve, request changes, send work back to
an earlier stage, choose or exclude an agent, edit an output, take a stage
over, pause, cancel, or retry.

Every prompt, output, routing decision, and approval is written to a
hash-chained audit log in the project's repository and committed to git. The
run page verifies the chain and every stored artifact.

AGE Aris registers an offline **Rehearsal agent** on first start. If the
`claude` CLI is installed, it also registers Claude Haiku, Sonnet, and Opus.
In the Implement stage these run with `--dangerously-skip-permissions`: they
can run any command your account can, without asking. Every other stage is
text-only, and Implement starts only after you approve the plan. Agents can
also be any local command, or an external process that pulls work over the
API using the token in `.agesight-data/.api-token`. Stages, gates,
retry policy, routing, the audit format, and the API are described in
[the pipeline guide](docs/PIPELINE.md).

## Track an existing repository

AGE Aris can watch a repository whose agents already keep an AA task board
(`AA/`, or `deaddrop/` or `pm/`, its older names). Choose **Track an existing
repository** and give the repository's folder. Home, health, changes, and each
task's history come from the board's files and the repository's git history.
Tasks change in the repository, where its agents work, and AGE Aris picks the
changes up. Nothing there changes from AGE Aris until you switch task actions
on for it (below).

- The folder must be the top of a git repository with a `.git` directory
  (worktrees and submodules cannot be tracked yet) and contain `AA/tasks/`,
  `deaddrop/tasks/` or `pm/tasks/`.
- Older boards without a `backlog/` folder are read as they are: a task in
  `tasks/` whose status is `open` or empty counts as backlog until it is
  claimed. Renaming the board folder, from `deaddrop/` to `AA/` say, keeps each
  task's history.
- The work in progress limit comes from the board's `AA.yml` (`deaddrop.yml` on
  an older board).
- Task files AGE Aris cannot read are listed on the project page instead of
  hiding the project.
- The full edit form, adding tasks, the pipeline, and agent runs are not
  available for a tracked repository. New tasks are added in the repository;
  AGE Aris acts on the tasks already there.
- **Stop tracking** removes AGE Aris's record of the repository and leaves the
  repository unchanged.

### Task actions on a tracked board

**Task actions** (claim, release, block, unblock, done) are off for every
tracked repository until you switch them on in its project header. The switch
shows what it means for that repository before you confirm:

- **The branch it pins.** Each action is one commit to the branch checked out
  when you switched on. While another branch is checked out, actions are
  refused; switching off and on again pins the current one.
- **Who commits.** Commits are authored as the repository's own git identity
  (`user.name`), carry the trailer `AGESight-Via: ui`, and are never pushed.
- **No hooks.** The commit is made with git plumbing under git's index lock:
  the repository's hooks, filters and signing do not run, and no script of the
  repository is run.
- **Other worktrees** do not see the commits until they merge.
- **STATE.md is left alone.** On a board with `board.sh`, run
  `AA/board.sh --write` after acting; on a board whose STATE.md is kept by hand,
  each commit names the board line that is now behind.

The choice is kept in AGE Aris's own `project.json`, in its data folder, never
in the repository. Starting AGE Aris with `AGESIGHT_TRACKED_WRITES=0` turns
task actions off for every tracked repository.

Each action changes one task file, its folder included, and nothing else in
the index or working tree. On a board with `backlog/`, claim moves the file
from `backlog/` to `tasks/` and release moves it back; on an older board
without one, both change the file in place. Done moves it to `tasks/done/` and,
when its `## Result` is still a placeholder, asks for one line to put there.
Only `status:`, `owner:`, `blockedReason:` and `## Result` are written; priority
and assignee do not exist on an AA board and stay disabled.

AGE Aris refuses an action, and changes nothing, when:

- task actions are off, or the board is in `deaddrop/` or `pm/` (rename it to
  `AA/` first);
- the repository is on another branch than the pinned one, or a merge, rebase
  or other operation is in progress, or git's index lock is held;
- git `user.name` is not set, or two task files claim the same id;
- another operator holds the task (AA rule 2);
- a checkpoint run on the task has not ended and wrote within `stale_hours`.
  The refusal names the run and the `AA/ckpt.sh log … end` line that reaps it
  if its session is gone;
- claiming would pass the WIP limit;
- the task file has uncommitted changes, is not committed yet, or changed
  while you acted.

Each refusal says what to do next, and AGE Aris also prints it to its own
stderr as one line. Some actions ask for a confirmation first, in one dialog
that lists every reason: a task held by one of your own agent sessions (with
its last sign of life), and runs that never ended or trail lines that do not
parse. A run that never ended is not reaped for you: the result names the
`AA/ckpt.sh` command to run.

**Done leaves the checkpoint trail in place.** AA's Done retires the trail
with `AA/ckpt.sh close <ID> --delete`; AGE Aris does not write trails or run
`ckpt.sh`, so a done on a task that has a trail reminds you to run that
command. This is a deliberate deviation from the board's Done.

**What agents in the repository see.** While AGE Aris commits (normally tens
of milliseconds, at most 3 seconds) git's index lock is held, so an agent's
`git commit` or `git add` can fail once with "index.lock exists"; `ckpt.sh`
retries, and a bare git command should be retried. If AGE Aris dies while
holding it, `.git/index.lock` reads `agesight <nonce>` and is safe to delete
when AGE Aris is not running. An action that was interrupted is named on the
project page, and actions there are refused until you have checked it and
removed the marker it names.

Repositories using reftable refs, a sparse checkout, a split index, or a
detached HEAD, and task folders where hard links fail, cannot have task
actions switched on.

Scripts can do the same with the `X-AGESight-Token` header:
`POST /api/projects/link` with `{"path": "/absolute/path", "name": "optional"}`
returns the project, and `DELETE /api/projects/<id>` stops tracking it.

## Storage and behavior

AGE Aris was first called AGESight. Names that are part of stored data or of
integrations keep that name so existing workspaces and scripts keep working:
the `AGESight-Via` commit trailer, the `X-AGESight-Token` API header, the
`.agesight-data` folder, the `AGESIGHT_*` environment variables, and the
`@agesight/web` claim on owner lines.

The first version manages local project repositories under
`.agesight-data/projects/<project-id>/`. Each project contains:

```text
project.json                  project settings
AA/STATE.md                   a generated task table and preserved NOW notes
AA/AA.yml                     work in progress policy
AA/backlog/                   unstarted Markdown tasks
AA/tasks/                     in progress and blocked tasks
AA/tasks/done/                completed tasks
AA/checkpoints/               agent checkpoint format
pipeline/pipeline.json        the project's stages (after the first edit)
pipeline/runs/R001/           one run: events.jsonl audit log, RUN.md, attempts/
.git/                         project history
```

A tracked repository's folder holds only `project.json`, which records the
repository's path, its board folder, and whether task actions are on and which
branch they pin. `.agesight-data/tracked-inflight/` holds a marker while a task
action on a tracked repository is being written, so an interrupted one is
settled, or named, when AGE Aris starts again.

Agents are registered in `.agesight-data/registry/agents.json`, a separate git
repository. Agents start in `.agesight-data/workdirs/` unless configured
otherwise. `.agesight-data/.api-token` holds the local API token.

The task's directory determines its state. Creating, editing, or moving work
records a commit in that project's repository; a task action on a tracked
repository records one commit there, on its pinned branch. Nothing is
automatically pushed to a remote. Task and project saves reject stale versions rather than overwrite
changes made since an editor opened. Blocked work counts toward the work in
progress limit. Unchanged saves add no commit. Every metric is computed from
that git history (first-parent, with commit times clamped so they never go
backwards) and from the runs' audit logs, so any number can be traced to the
commits behind it.

Project repositories are independent of the application's source repository.
The data directory is ignored by this repository's git configuration. Back up
that directory, including each project's `.git`, to retain work and history.

Choose another data directory or port when starting:

```sh
AGESIGHT_DATA_DIR=/path/to/workspace PORT=4400 npm start
```

The server listens on `127.0.0.1`. This release uses one local operator, with the
git identity configured on the machine. Named task owners are planning metadata;
agent claim ownership is recorded separately in the task frontmatter.

## Development

```sh
npm run check
npm test
```

Tests exercise persistence, state transitions, git history, work limits, stale
edits, validation, generated state preservation, HTTP requests, the audit
chain, agent routing, and pipeline runs end to end. Tests use local stand-in
agents and never call a model. HTTP tests
skip only if the environment prohibits listening on a local port.

The application uses Node's built-in HTTP server and a browser-native frontend.
The visual direction and scope are recorded in [DESIGN.md](DESIGN.md).

```text
server.mjs                    local HTTP server and API
lib/workspace.mjs             project/task persistence and policy
lib/pipeline.mjs              pipeline engine: runs, stages, runners, human actions
lib/router.mjs                performance-based agent routing
lib/agents.mjs                agent registry
lib/audit.mjs                 hash-chained audit log
agents/rehearsal-agent.mjs    offline stand-in agent
public/                       Home, board, Flow, Method, task drawer, and styles
tests/                        integration tests
skills/aa-init/               existing agent task-board integration
```

## Agent plugin

The existing `aa-init` plugin remains available for scaffolding task boards
into other repositories. Its installation and protocol documentation are in
[the plugin guide](docs/PLUGIN.md).

## License

UNLICENSED. All rights reserved by the author.
