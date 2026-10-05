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
your workspace. Create your first project, or choose **Explore with a sample
project** to create an editable example.

## Main page

The Overview page is the monitoring surface:

- Task counts for backlog, in progress, blocked, and completed work.
- Project state, completion progress, and work in progress limits.
- A task monitor with owners, priorities, due dates, and state filters.
- Blocked and overdue tasks that need attention.
- Recent activity from each project's git history.

The page refreshes every 10 seconds while visible. Refreshing pauses while a
project or task editor is open, preserving the edit in progress. The refresh
button also loads changes immediately. The live indicator changes to
Reconnecting if the server becomes unavailable.

Open a project to use its Kanban board or task list. Drag a task to another
column, or open its details and choose a status. Use search and owner, priority,
or status filters to find work. The **All tasks** page spans the workspace.

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
progress limit. Unchanged saves add no commit. The Activity page shows the most
recent 200 commits per project; the full history remains in git.

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
