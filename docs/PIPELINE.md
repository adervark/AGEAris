# Agent pipeline

AGE Aris can carry a task through a sequence of stages, each done by an agent
or a person. You stay in control: gates stop for your approval, you can send
work back, take a stage over, reassign it, pause, cancel, or retry. Every step
is written to a hash-chained audit log and committed to the project's git
history.

## Using it

1. Open a task and choose **Run with agents**. The task moves to In progress.
2. Stages run on their own until one needs you. **Needs you** on Home
   lists every run that is waiting: a gate to approve, a stage assigned to a
   person, a stage with no available agent, work no pull agent has claimed, a
   failed run, or a run whose audit check failed. Expand a waiting gate to read
   the output and approve or request changes without leaving the list.
3. At a gate, read the output and choose **Approve**, or **Request changes**
   with feedback. You can send the work back to an earlier stage and choose
   which agent should redo it. You can also edit the output before approving;
   later stages receive your edited version.
4. When the last stage passes, the task moves to Done. If a stage exhausts its
   attempts, the run fails and the task moves to Blocked until you retry it or
   close it. A failed run leaves Decisions when you close it or start a newer
   run for the same task.

The board card of a task with an active run shows its current stage and a
**Needs you** marker when it is waiting on a decision.

A tracked repository (see the README) has no pipeline. AGE Aris only reads it,
so pipeline edits and runs there are refused with 409.

## Stages

Each project has its own pipeline, editable from the project page
(**Pipeline**). The default is:

| Stage | Role | Preferred tier | Gate | Verdict | On failure |
|---|---|---|---|---|---|
| Triage | triage | haiku | none | no | retry (2 attempts) |
| Plan | plan | opus | approve | no | retry (3 attempts) |
| Implement | implement | sonnet | none | no | retry (3 attempts) |
| Review | review | opus | approve | yes | go to Implement (3) |
| Verify | verify | sonnet | none | yes | go to Implement (2) |

Stage fields:

- `id`, `name`: identifier (lowercase, hyphens) and label.
- `role`: `triage`, `plan`, `implement`, `review`, or `verify`. Agents declare
  which roles they take.
- `tier`: the preferred model tier (`haiku`, `sonnet`, `opus`) used by routing.
- `executor`: `agent` (routed) or `human` (always waits for a person).
- `gate`: `approve` stops for a person after the stage succeeds; `none`
  continues automatically.
- `verdict`: when true, the agent must end with `VERDICT: PASS` or
  `VERDICT: FAIL`. A FAIL, or no verdict line at all, counts as a failed
  attempt.
- `maxAttempts` (1–10): failed attempts allowed before the run fails.
- `onFail`: `retry`, `stop`, or `goto:<earlier stage id>`.
- `pinnedAgent`: always use this agent for the stage.
- `instructions`: the stage's standing instructions to the agent.

A run copies the pipeline when it starts, so editing a pipeline never changes
runs already in progress.

## Agents and routing

Agents are registered once per workspace in `<data dir>/registry/agents.json`,
which is its own git repository. On first start AGE Aris registers a
**Rehearsal agent**, an offline stand-in that answers instantly. If the
`claude` CLI is on `PATH`, it also registers **Claude Haiku**, **Claude Sonnet**
and **Claude Opus** (`claude -p --model <tier>`) and leaves the rehearsal agent
disabled. The Claude agents add `--dangerously-skip-permissions` only when they
take the Implement role (see acting roles below).

Agent fields: `id`, `name`, `description`, `runner` (`command` or `pull`),
`command` (argument list, run without a shell), `actArgs` and `actRoles`
(arguments added only for stages in those roles), `cwd` (absolute path),
`roles`, `tier`, `enabled`, `maxConcurrent`, and `timeoutSec`.

For every stage, the router scores each enabled agent that takes the stage's
role, is not excluded, and has spare capacity:

```text
score = quality + exploration + tier fit + latency
quality      = (successes + 1) / (successes + failures + rejections + 2)
exploration  = 0.3 × sqrt(ln(role attempts + 1) / (agent attempts + 1))
tier fit     = −0.3 per tier below the stage's preferred tier,
               −0.05 per tier above it (cost)
latency      = −0.1 × min(1, mean duration / 10 minutes)
```

A success is an attempt that was approved, or that passed a stage without a
gate. Rejections by a person and failed attempts count against the agent for
that role. When a Review or Verify agent reports `VERDICT: FAIL` and the run
returns to an earlier stage, the reviewer is not charged. The latest accepted
attempt of the stage the run returns to has its success turned into a
rejection, so routing for Implement learns from what reviewers find. Ties go to the cheaper tier, then the agent id. The full scoreboard,
including why each agent was skipped, is stored with every dispatch and shown
on the run page. Agents with better results for a role win that role over time.
Agents with few attempts still get some work through the exploration term.

If no agent can take a stage, the run waits and shows the reason. Add or enable
an agent, or take the stage over yourself.

### Command runner

AGE Aris starts the command and sends the stage prompt on standard input.
Standard output becomes the stage output. A zero exit code means success.
Standard error is stored next to the output. AGE Aris stops the agent after
`timeoutSec`, together with any processes it started. The process receives
`AGESIGHT_RUN`, `AGESIGHT_TASK`, `AGESIGHT_STAGE`, `AGESIGHT_ATTEMPT`, and
`AGESIGHT_WORKDIR` in its environment. The exact argument list of every attempt
is recorded in the audit log.

Unless an agent sets `cwd`, it starts in a working folder for the run,
`<data dir>/workdirs/<project>-<run>/`, shared by the run's stages and kept
apart from the audit repository. To let an agent work on a codebase, set its
`cwd` to that repository.

**Acting roles.** An agent's `actArgs` are added only for stages whose role is
in its `actRoles`. The seeded Claude agents use this to add
`--dangerously-skip-permissions` for Implement only. Triage, Plan, Review, and
Verify then run text-only, and Implement runs only after you approve the plan.
With that flag the agent can run any command your user account can run,
without asking, anywhere on the machine, not only in its working folder. Task
text and earlier outputs reach it as input, so treat them as untrusted.
Approval gates control the workflow, not what an agent can do: an agent with
unrestricted permissions runs as you and could call the local API itself. For
real isolation, run such agents as another user or in a container.

If AGE Aris stops while an agent is running, the attempt is recorded as
interrupted on the next start and the stage's failure policy applies.

### Pull runner

A pull agent runs anywhere that can reach the local API. It polls for work,
holds a lease while working, and reports the result:

```sh
TOKEN=$(cat .agesight-data/.api-token)

# Claim the oldest queued attempt routed to this agent ({"work": null} if none)
curl -s -X POST http://127.0.0.1:4310/api/agents/my-agent/claim \
  -H "x-agesight-token: $TOKEN" -H 'content-type: application/json' -d '{}'

# Extend the lease (default 10 minutes) while working
curl -s -X POST http://127.0.0.1:4310/api/attempts/<attemptId>/heartbeat \
  -H "x-agesight-token: $TOKEN" -H 'content-type: application/json' -d '{"agentId":"my-agent"}'

# Report the result
curl -s -X POST http://127.0.0.1:4310/api/attempts/<attemptId>/complete \
  -H "x-agesight-token: $TOKEN" -H 'content-type: application/json' \
  -d '{"agentId":"my-agent","outcome":"succeeded","output":"..."}'
```

An expired lease returns the attempt to the queue and records the expiry. Only
attempts routed to pull agents can be claimed, renewed, or completed this way.
Work that no agent claims within a lease period appears in Decisions.

## Audit trail

Each run lives in the project repository:

```text
pipeline/pipeline.json                     the project's pipeline
pipeline/runs/R001/events.jsonl            hash-chained audit log
pipeline/runs/R001/RUN.md                  generated summary
pipeline/runs/R001/attempts/03-implement/
  prompt.md                                exactly what the agent received
  output.md                                exactly what it returned
  stderr.log                               command agents' standard error
  edited.md                                a person's edit, if any
```

Every event records its sequence number, time, actor (person, agent, or
system), type, data, and the hash of the previous event. The run's state is
computed only from these events. Routing choices, failure handling,
and stage moves are recorded as events, so the log explains why each step
happened. The events also record the SHA-256 of each prompt, output, standard
error log, and edit, and the exact command each agent ran.

Every change to a run is one git commit, for example
`Run R001 (T003): Plan approved by Ada; moved to Implement`. Its message ends
with the chain head, `Audit-Head: <hash>` and `Audit-Seq: <n>`.

Each time the run page loads, AGE Aris reads the log from disk and verifies the
chain. It compares the head with the one in memory and with the one in the
latest commit, and checks every artifact against its hash. Before it appends
an event or passes an earlier output to the next agent, it checks again. If
anything does not match, the run is locked and listed in Decisions with the
reason, and AGE Aris records nothing more for it.

The log is tamper-evident, not tamper-proof. It detects edits, deletions,
truncation, and recomputed hashes that git does not also reflect. Anyone who
can write to the data directory can also rewrite git history; git's reflog and
any remote you push to are the stronger record. The `actor` on an event names
who acted through AGE Aris. It is not a signature.

## API

All endpoints accept and return JSON on `127.0.0.1`. They check the Host and
Origin headers, require `Content-Type: application/json` for request bodies,
and require the workspace token. A browser receives the token as an HttpOnly,
SameSite=Strict cookie by opening the sign-in link printed at startup
(`/?token=…`). Scripts send it as the `X-AGESight-Token` header, read from
`<data dir>/.api-token` (mode 0600). Without the token the API answers 401. The
token keeps out other local users. It does not keep out processes running as
you, including agents, because they can read the file.

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/workspace` | Projects, tasks, activity, plus `runs` (summaries) and `agents` (with performance) |
| GET | `/api/brief` | Home: Needs you, the delta window (`window`, `since`, `sinceHeads`), project lines (with a 28-day `spark` and cycle-time KPIs), decision latency |
| GET | `/api/projects/:id/method` | A project's written method: `wipLimit`, `staleHours`, and the board's `WORKFLOW.md`, `RULES.md`, `AGENTS.md`, `WHY.md` (read-only, ≤ 256 KiB, no symlinks) |
| GET | `/api/tasks/:id` | One task, with `body`: the Markdown below its frontmatter |
| GET | `/api/projects/:id/metrics` | A project's health, metrics, series, and tables (`asOf` optional) |
| GET | `/api/explain/:metricId` | The full metric value behind a number (`projectId`, `asOf`, `taskKey` for `due_risk`) |
| GET | `/api/tasks/:id/history` | Every transition of a task, across reuses of its id, with commits |
| GET | `/api/changes` | The change feed (`projectId`, `kinds`, `since`, `limit` ≤ 500) |
| POST | `/api/projects/sample` | Create the sample project with simulated history |
| GET / PUT | `/api/projects/:id/pipeline` | Read or replace stages (`{stages, version}`) |
| GET / POST | `/api/runs` | List run summaries / start a run (`{taskId}`) |
| GET | `/api/runs/:runId` | Full run: attempts with prompt and output, events, audit result |
| GET | `/api/runs/:runId/audit` | Events and verification only |
| POST | `/api/runs/:runId/actions` | Human controls (below) |
| GET / POST | `/api/agents` | List agents with performance / register an agent |
| PATCH | `/api/agents/:id` | Update an agent (`version` required) |
| POST | `/api/agents/:id/claim` | Pull runner: claim work |
| POST | `/api/attempts/:attemptId/heartbeat` | Pull runner: extend lease |
| POST | `/api/attempts/:attemptId/complete` | Pull runner: report result |

Run ids are `<projectId>:R001`; attempt ids are `<runId>:<n>`. URL-encode both.

Actions take `{action, expectedSeq, ...}`. `expectedSeq` is the run's
`lastSeq`. A stale value returns 409, so a decision is never applied to a state
you have not seen. `comment` does not need it.

| Action | Fields | Effect |
|---|---|---|
| `approve` | `comment?` | Approve the waiting gate and continue |
| `reject` | `feedback`, `stageId?`, `pinAgent?`, `excludeAgent?` | Send back to this or an earlier stage, optionally choosing or excluding an agent |
| `edit` | `output` | Replace the waiting output; later stages see the edit |
| `submit` | `output` | Complete a stage assigned to a person |
| `takeover` | — | Stop the current attempt and assign the stage to a person |
| `route` | `stageId`, `pinAgent?`, `exclude?`, `restart?` | Change routing for a stage; `restart` re-routes the running attempt |
| `pause` / `resume` | — | Hold or release dispatching |
| `cancel` | `reason?` | Stop the run, or close a failed one |
| `retry` | `stageId?` | Restart a failed run from its stage, or an earlier one |
| `comment` | `text`, `stageId?` | Add a note to the audit trail |

Run statuses: `running`, `waiting` (no agent available), `awaiting_approval`,
`awaiting_input` (a person must submit), `failed`, `cancelled`, `completed`;
`paused` is a separate flag. Attempt statuses: `queued`, `running`,
`awaiting_input`, `succeeded`, `failed`, `awaiting_approval`, `approved`,
`rejected`, `cancelled`.
