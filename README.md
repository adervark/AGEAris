# AGESight

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
your workspace. Create your first project, or choose **Explore a sample
project** to create one with six weeks of simulated history (marked **Simulated
history** everywhere it appears).

## Today

**Today** is the first page, the view a project owner reads each morning:

- **Needs you**: runs waiting on a decision, then overdue work, agent claims that
  have gone quiet, due dates likely to slip, work far older than usual for its
  type, blocked work, and urgent work in progress with no owner. Each item appears
  once, under its most pressing reason.
- **Since your last visit**: what finished, started, was blocked or unblocked,
  added, dropped, reopened, or slipped. Each count expands into its tasks. The
  window can also be the previous working day, 24 hours, or 7 days. **Mark
  seen** starts the next window from now. Leaving Today after ten seconds also
  does this. The last visit is kept in this browser only.
- **Projects**: one line per project. Each shows its health (Green, Amber, Red, or
  grey when history is too thin), a sentence on what is wrong, and a few counts.

Every number is a button. It opens the **Explain** drawer with the definition,
formula, clock, sample size, settings, the items counted, what was left out and
why, and the commits or audit events each item comes from. The definitions are
in [docs/METRICS.md](docs/METRICS.md).

A project opens on its **Health** tab. The tab shows the health rules, flow
(throughput, cycle and lead time medians and 85th percentiles, work in
progress, blocked share), risk tables, load per person and per agent, and the
git history the numbers were computed from. **Board** and **List** are beside
it. **Changes** lists every status, field, and run change, newest first, and
can be filtered by kind and project. A task's drawer shows its history, with
each change's commit.

Timezone, working days, and the personal work-in-progress limit are read from
`<data dir>/settings.json` (`{"timezone": "Europe/London", "workdays": [1,2,3,4,5],
"personalWipLimit": 3}`). Ages and approval times skip non-working days.

The page refreshes every 10 seconds while visible; Today's brief every 30. Refreshing pauses while a
project or task editor is open, preserving the edit in progress. The refresh
button also loads changes immediately. The live indicator changes to
Reconnecting if the server becomes unavailable.

Open a project to use its Kanban board or task list. Drag a task to another
column, or open its details and choose a status. Use search and owner, priority,
or status filters to find work. The **Work** page spans the workspace. Old
`#overview`, `#tasks`, and `#activity` links open Today, Work, and Changes.

## Agent pipeline

Open a task and choose **Run with agents**. The task moves through stages,
Triage, Plan, Implement, Review, and Verify by default. For each stage AGESight
picks the agent with the best measured record for that kind of work. It stops
for your approval after Plan and Review. **Decisions** lists every run that is
waiting on you. From there you can approve, request changes, send work back to
an earlier stage, choose or exclude an agent, edit an output, take a stage
over, pause, cancel, or retry.

Every prompt, output, routing decision, and approval is written to a
hash-chained audit log in the project's repository and committed to git. The
run page verifies the chain and every stored artifact.

AGESight registers an offline **Rehearsal agent** on first start. If the
`claude` CLI is installed, it also registers Claude Haiku, Sonnet, and Opus.
In the Implement stage these run with `--dangerously-skip-permissions`: they
can run any command your account can, without asking. Every other stage is
text-only, and Implement starts only after you approve the plan. Agents can
also be any local command, or an external process that pulls work over the
API using the token in `.agesight-data/.api-token`. Stages, gates,
retry policy, routing, the audit format, and the API are described in
[the pipeline guide](docs/PIPELINE.md).

## Storage and behavior

The first version manages local project repositories under
`.agesight-data/projects/<project-id>/`. Each project contains:

```text
project.json                  project settings
deaddrop/STATE.md             a generated task table and preserved NOW notes
deaddrop/deaddrop.yml         work in progress policy
deaddrop/backlog/             unstarted Markdown tasks
deaddrop/tasks/               in progress and blocked tasks
deaddrop/tasks/done/          completed tasks
deaddrop/checkpoints/         agent checkpoint format
pipeline/pipeline.json        the project's stages (after the first edit)
pipeline/runs/R001/           one run: events.jsonl audit log, RUN.md, attempts/
.git/                         project history
```

Agents are registered in `.agesight-data/registry/agents.json`, a separate git
repository. Agents start in `.agesight-data/workdirs/` unless configured
otherwise. `.agesight-data/.api-token` holds the local API token.

The task's directory determines its state. Creating, editing, or moving work
records a commit in that project's repository. Nothing is automatically pushed
to a remote. Task and project saves reject stale versions rather than overwrite
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
public/                       dashboard, board, task editor, and styles
tests/                        integration tests
skills/deaddrop-init/          existing agent task-board integration
```

## Agent plugin

The existing `deaddrop-init` plugin remains available for scaffolding task boards
into other repositories. Its installation and protocol documentation are in
[the plugin guide](docs/PLUGIN.md).

## License

UNLICENSED. All rights reserved by the author.
