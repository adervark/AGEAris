# The agent's brain: orient any agent, on any repo, at team scale

**Status: pending approval** (v1)
Drafted 2026-10-10 from `feature/pm-cockpit` at 3c69485, after an interview
with the operator. Nothing here is built yet. Once approved, each phase in §9
becomes a task on `AA/`.

## 1. What the operator asked for

- "More than anything Aris must be optimised for agent interaction."
- "I want to make this the Aris an agent's brain."
- It is "flustering under scale". What the operator sees: **too much to read**
  and **agents get lost**.
- Answers from the interview:
  - **Orient first.** When an agent starts, the brain tells it where things
    stand, what is in flight, what it may take, and what binds it.
    Remembering, coordinating and acting come later.
  - **Hundreds of repositories**, worked on by **a team**: several people and
    their agents.
  - The source of truth: the operator asked which would be better and accepted
    the recommendation, **repo first, with the server adding to it**. §3 gives
    the reasons.

## 2. Where it stands, measured

All numbers are from this machine on 2026-10-10: 3 tracked repositories,
about 300 task files, 1,862 commits.

| What | Measured | At 300 repos (linear) |
|---|---|---|
| `GET /api/workspace` | 90 ms, **316 KB**: 289 tasks with every description (242 KB), 235 activity rows (69 KB) | **~30 MB per call** |
| `GET /api/brief` | 5 ms warm, 46 KB | ~4 MB |
| Cold ledger build, `buildLedger` (`lib/history.mjs:251`) | 53–122 ms per repo; ledgers of 138–401 KB | ~30 s after every restart, ~100 MB |
| Ledger memo (`lib/history.mjs:672`) | in memory only | rebuilt from git on every start |
| Server RSS | 177 MB | — |

What follows from the numbers:

- **The strain is the shape of the answers, not their speed.** Every reader is
  sent everything, and delivered tasks are most of it. A person sees a wall of
  text. An agent burns its context on it, or goes back to reading files and
  never uses AGE Aris.
- **An agent's start costs four reads and judgment:** `AA/STATE.md`,
  `AA/RULES.md`, its task file, and `AA/ckpt.sh live` (AGENTS.md steps 1–4). Each
  harness redoes this, each a little differently. That is where they get lost.
- **Agents cannot do everything people can.** A plain AGE Aris project cannot be
  deleted at all (`lib/workspace.mjs:1231` refuses with 409, and the UI offers
  nothing). Stopping tracking works over HTTP, but nothing tells an agent the
  endpoint exists.

## 3. Principles

1. **Git is the truth; the brain is derived.** Everything the brain knows can
   be rebuilt from the repositories. It is an index and a judge, never a second
   database. Two brains that see the same commits give the same answer.
2. **Repo first.** An agent in a clone can orient with no server running. The
   server adds the cross-repo view and keeps the work warm. AA exists for the
   session that wakes up alone (`docs/PLUGIN.md`, "The problem"), and the brain
   must not break that.
3. **Answers are ranked and budgeted.** Every answer has a size limit, puts the
   most important thing first, and links one level down for the rest. This is
   the agent's version of "audit one level down".
4. **Work in proportion to what changed, not to what exists.** Nothing is
   rebuilt, re-sent or re-read because it exists, only because it moved.
5. **Every action has an agent path that can be found.** What a person can do
   on a page, an agent can do from a listed command or endpoint.

## 4. Options considered

**A. Repo-first digests, plus an optional team hub (chosen).** One pure
function turns one repository's AA board at one commit into a small digest. A
CLI runs it in a clone. AGE Aris runs the same function over every repository
it tracks, caches the results on disk keyed by commit, and merges them.
- For: principles 1–2 hold.
- For: one implementation serves two entry points.
- For: restart cost becomes a fingerprint check.
- For: a team hub is the same program reading mirrors.
- Against: without a server, an agent sees only its own repository.
- Against: the hub's freshness is bounded by how often it fetches.

**B. A central service as the authority.** Agents claim and check in through
an API with a database, and git becomes a mirror. Rejected:
- It makes a second source of truth.
- It breaks the AA rule that coordination happens "through files and commits
  rather than through a server, a daemon".
- It needs a server for every agent start.
- It breaks the CLAUDE.md constraint that AGE Aris writes only through the
  operator's task actions.

**C. A machine-readable `AA/STATE.json` committed to each repository.**
Readers would fetch one small file per repository. Rejected:
- A generated file that every claim regenerates becomes a merge-conflict hot
  spot when twenty agents share a repository. One file per task exists to avoid
  exactly that.
- It is stale between regenerations, which is rule 11's problem made worse.

## 5. The design

```
            repositories (truth; the AA protocol, unchanged)
                 │  git: task files, trails, history
                 ▼
   digest(repo, ledgerSha) ── pure, deterministic ── lib/orient.mjs
        │                         │
        ▼                         ▼
  aa orient (CLI, in a clone)   AGE Aris (local or team hub)
  no server, one repo            digest cache on disk + merge
                                   │
                    ┌──────────────┼───────────────┐
                    ▼              ▼               ▼
              GET /api/orient   Home / pages    capabilities
              (agents)          (people)        (what can be done, how)
```

### 5.1 The digest: one repository at one commit

`digest(dir, { ledgerSha })` returns a frozen object built from
`buildLedger` (`lib/history.mjs:251`) and the metric functions in
`lib/metrics.mjs`. **It never carries task bodies.** It holds:

- `repo`: name, branch, `headSha`, `ledgerSha`, board folder (`AA/`,
  `deaddrop/` or `pm/`).
- `policy`: the AA.yml values that bind an agent: the `spend` list, `wip`
  limits, `stale_hours`, `log`, `id_prefix`.
- `now`: the hand-written NOW block, cut to `MAX_INLINE`.
- `tasks`: frontmatter only, for backlog and work in progress. That means id,
  title, column, status, owner, priority, depends, blockedReason, `ready`
  (decision rules present when the task spends), and age. Delivered tasks
  appear only as counts.
- `runs`: per live task, its runs. For each run: alive or dead (the schema's
  reading rules), the newest `next`, and any `doing` with nothing after it.
- `flow`: WIP against the limit, throughput, cycle time at the 50th and 85th
  percentiles, and aging WIP. These are the numbers the board already shows,
  as `MetricValue`s.

The digest is keyed by `(repo identity, ledgerSha)`, which `resolveHeads`
already computes (`lib/history.mjs:85`). The key is the content, so a cached
digest is never wrong, only old.

### 5.2 `orient`: the answer an agent starts from

`orient(digests, { operator, repo?, budget })`, schema `aa.orient/1`:

```json
{
  "schema": "aa.orient/1",
  "asOf": "2026-10-10T07:20:00Z",
  "repo": { "name": "RSNA", "head": "a1b2c3d", "board": "AA/",
            "fresh": { "readAt": "…", "behindRemote": 0 } },
  "next": { "do": "resume", "task": "T061",
            "because": "your run e857a8c8 stopped during `doing`; do not restart fold 0",
            "then": "bash scripts/run_folds.sh --arm d --resume" },
  "you": [ { "task": "T061", "status": "in_progress", "handoffNext": "…", "lastEntry": "…" } ],
  "inFlight": [ { "task": "T058", "holder": "ana @w/91c2", "alive": true, "doing": "…" } ],
  "take": [ { "task": "T070", "title": "…", "priority": "high", "ready": true, "why": ["high", "unblocks T072"] } ],
  "rules": { "wip": { "used": 1, "limit": 2 }, "staleHours": 24,
             "spend": ["gpu-hour", "submission"], "notReady": ["T071"] },
  "now": "…",
  "warnings": [ "T055 claimed by bo @x/77aa, no sign of life for 31 h: pullable (rule 4)" ],
  "more": { "task": "aa task <id>", "trail": "aa trail <id>", "all": "aa orient --all" }
}
```

**`next` is computed from the rules, in this order.** The first rule that
applies wins:

1. You hold a task whose run stopped with a `doing` unanswered: **resume it**,
   and name what not to repeat. (Rules 3, 6, 8.)
2. WIP is over the limit: **finish or release** what you hold, else stop.
   (Rule 10.)
3. A claim has gone stale: **release it, or take it** if it is yours. (Rules 3,
   4.)
4. You hold a task in progress: **continue it**, using the handoff's next line.
5. A ready task is in the backlog: **claim the best one.** Order: priority,
   then whether it unblocks others, then age. A task that spends and has no
   decision rules is not ready. (Rules 5, 12.)
6. Nothing applies: **nothing to take**, and say why.

`next` is advice. **Git stays the lock:** a claim is still a commit, and a
conflicting commit or a rejected push is what decides a race (rule 1). The
brain gets an agent to the right attempt sooner.

**Budget.** `budget` is in bytes, default 8 KB (about 2,000 tokens). Sections
are cut from the end of each list, never mid-entry, and every cut adds a `more`
handle. The output is never larger than the budget.

**Task text is untrusted** (CLAUDE.md), and in a team it reaches every agent's
context. So:
- `next.do`, `next.because` and `warnings` are built **only from structured
  fields**: ids, states, counts and times. Task prose never becomes an
  instruction.
- Free text such as titles, the NOW block and a trail's `next` goes in fields
  named as data. It is cut to `MAX_INLINE` and never put into a sentence.
- Parsing uses no regex that can backtrack on task text.

### 5.3 Entry points: one function, three doors

| Door | For | Server needed | Scope |
|---|---|---|---|
| `aa orient [--json] [--budget N]` (the `aa` skill, Node 22) | any agent in a clone | no | this repository |
| `GET /api/orient?repo=&budget=` | agents and scripts beside AGE Aris | yes | one repository, or all with `--all` |
| Home and project pages | people | yes | the same ranked answer, rendered |

`aa orient` also works on boards with no AGE Aris anywhere: it reads git
through the same `lib/` modules the server uses. It runs none of the
repository's scripts.

**`GET /api/capabilities` and `aa capabilities`** list every action a person
can take on a page. For each: its command or endpoint, its inputs, and what it
refuses. This is how an agent finds out that stopping tracking exists. A UI
action missing from the list fails a test.

### 5.4 Scale: where the work goes

- **Restart is a check, not a rebuild.** Digests and ledgers are cached under
  `<data dir>/cache/<repo>/<ledgerSha>.json`. On start, AGE Aris compares
  fingerprints (`lib/history.mjs:60`) and reads the cache. It rebuilds only
  repositories that moved.
- **Ledgers extend incrementally.** When `ledgerSha` moves, `buildLedger`
  continues from the cached ledger over `old..new`, instead of replaying all
  of history. A rewrite such as a force-push falls back to a full build.
- **Memory holds digests; full ledgers are loaded on demand.** Explain, task
  history and charts load the ledger into an LRU with a size limit.
- **Payloads never grow with history.** `/api/workspace` stops sending
  delivered tasks and descriptions: those are paged, and fetched per task. Home
  is the portfolio `orient`, rendered.

Targets, measured by a 300-repository perf fixture built with
`lib/fabricate.mjs` (§8):

| | Target |
|---|---|
| `aa orient`, one repository, warm / cold at 5,000 commits | p95 < 300 ms / < 2 s |
| `GET /api/orient --all`, 300 repositories, warm | p95 < 1 s |
| Any `orient` output | ≤ its budget, always |
| Restart to everything fresh, 300 repositories, cache warm | < 10 s |
| Server memory, 300 repositories | < 300 MB |
| Home payload | < 100 KB, whatever the number of repositories |

### 5.5 Team: the hub

A team runs **AGE Aris in hub mode**: the same program, reading mirrors
instead of working clones.

- **Mirrors.** For each repository, a `--filter=blob:none` mirror. Only the
  blobs under the board folders are ever fetched.
- **Freshness.** A poll with jitter runs `git ls-remote` per repository, and
  the hub fetches only the ones whose refs moved. A webhook can trigger a poll
  sooner. Every `orient` reports `readAt`.
- **The hub only reads.** It fetches and never pushes. Task actions stay a
  local, operator-taken path. The CLAUDE.md write rules are unchanged.
- **Who sees what, in v1:** one hub per access boundary. The hub sees what its
  git credential can read, and everyone with a hub token sees all of it.
  Per-person visibility, which would mirror each person's repository
  permissions, is deferred. Decision D2 covers this.
- **Identity:** the operator is `git config user.name`, as now (rule 1). A hub
  token belongs to one person, and their agents use it.

**Claims across machines.** Today a claim is a local commit. Two people on two
machines can both claim T070, and nobody finds out until one of them pushes. At
team scale, a claim should count only once it has been pushed. A rejected push
then means somebody else has the task, just as a conflicting commit does
locally. `orient` warns about any claim of yours that has not been pushed. This
amends rule 1, in every repository that uses AA. Decision D1 covers this.

## 6. What stays out

- **Agents acting through AGE Aris** (claim, checkpoint and finish through the
  API). Agents keep acting through git and the board's scripts. Revisit once
  orient is in use.
- **Cross-repository memory** ("have we tried this before?"). The digest
  makes it possible later. It is not needed for orient.
- **Per-person access control on a hub.**
- **An MCP server.** The CLI works in every harness that can run a command. An
  MCP adapter over the same `orient` is a small later task (JSON-RPC over
  stdio, no dependency).

## 7. Risks

| Risk | Mitigation |
|---|---|
| An agent trusts a stale brain and spends twice | `orient` always reports `readAt` and `behindRemote`. Git stays the lock. Rule 6 trails stay the check before a spend. |
| Task text in a shared hub steers other people's agents | §5.2: instructions only from structured fields. Prose is labelled data and capped. A test plants injection text in a title and a trail and checks `next`. |
| The CLI and the server drift apart | One function in `lib/orient.mjs`. The CLI and `/api/orient` are tested to give byte-identical output for the same commits. |
| Cache corruption or a partial write | The cache is keyed by content, written to a temp file and renamed. An unreadable entry is rebuilt and reported, never trusted. |
| A force-push or history rewrite breaks incremental ledgers | If `old` is not an ancestor of `new`, do a full rebuild. Tested with `lib/fabricate.mjs` rebases. |
| Node is not on every agent's machine (Codex, plain shells) | `board.sh` and `ckpt.sh` keep working as now. `aa orient` says what is missing (T046's pattern). |
| The pushed-claim rule (D1) splits AA repositories into old and new | The rule applies only to boards with a remote, and is versioned in RULES.md through the `aa-init` template. Older boards keep the local-commit rule. |

## 8. How it is verified

- **Unit:**
  - `orient` precedence: one fixture per rule in §5.2, plus ties.
  - The budget is never exceeded, checked with property tests over random
    digests.
  - Untrusted text never reaches `next`.
  - The digest is deterministic: the same commits give the same bytes.
- **Integration:**
  - `aa orient` and `GET /api/orient` agree on fabricated repositories.
  - The cache survives a restart.
  - Incremental ledgers equal full ledgers after appends, merges and
    rebases.
- **Perf:** extend `tests/perf/brief.perf.mjs` (today 10 projects and 5,000
  commits) with a 300-repository fixture. The §5.4 targets are its budgets,
  under `AGEARIS_PERF_STRICT=1`.
- **End to end:**
  - A fresh agent session in a fabricated repository with a dead run must
    resume the run and not restart it.
  - In a repository over WIP, it must not claim.
  - Tested in Claude Code and in one other harness.
- **Parity:** a test fails when a UI `data-action` has no entry in
  `/api/capabilities`.

## 9. Phases, each a task on `AA/`

| # | Task | Done when |
|---|---|---|
| P0 | **Scale baseline.** A 300-repository perf fixture, with today's numbers recorded in PROGRESS.md. | The fixture runs in `npm run perf`. Today's misses against the §5.4 targets are measured, not guessed. |
| P1 | **The orient contract.** `docs/ORIENT.md` (schema `aa.orient/1`), `lib/orient.mjs` (digest and precedence), `aa orient` in the plugin. | The unit tests in §8 pass. An agent in this repository orients with one command and no server. |
| P2 | **The server keeps it warm.** Digest cache on disk, incremental ledgers, `GET /api/orient`, a slim `/api/workspace` with delivered tasks paged. | CLI and server outputs agree. The restart and payload targets in §5.4 pass on the P0 fixture. |
| P3 | **One ranked portfolio.** `orient --all`, and Home rendered from it. | 300 repositories fit one screen and one 8 KB answer, most urgent first. |
| P4 | **Agent paths for everything.** `/api/capabilities`, `aa capabilities`, deleting a plain project, and the parity test. | Every UI action is listed, and the parity test passes. |
| P5 | **Team hub.** Hub mode, mirrors, `ls-remote` freshness, per-person tokens, D1 if approved. | Two operators on two machines see the same `orient` within one poll interval, and a pushed claim race is reported to the loser. |

P0 comes first because the targets should be judged against measured numbers.
P1 is useful on its own, at any scale.

## 10. Decisions for the operator

- **D1. Should a claim count only once it is pushed, on boards with a remote?**
  Recommended: yes, for team boards. Without it, two people can work the same
  task for hours before anyone finds out.
- **D2. Hub visibility in v1:** one hub per access boundary, with everyone on
  it seeing everything. Or build per-person permissions before any hub ships?
  Recommended: one per boundary now, per person later.
- **D3. Does P1's `aa orient` replace AGENTS.md steps 1–4, or sit beside them?**
  Recommended: it replaces them as step 1, and the files stay as the fallback
  when Node is missing.

## ADR

- **Decision:** a deterministic per-repository digest and a rule-ordered,
  budgeted `orient` answer. It is computed from git, served by a CLI with no
  server, and by AGE Aris locally or as a read-only team hub.
- **Drivers:** agents get lost; there is too much to read; hundreds of
  repositories; a team.
- **Alternatives considered:** a central authority (B), and a committed
  `STATE.json` (C). §4 gives the reasons for rejecting them.
- **Why chosen:** it keeps git as the lock and AA serverless. It gives one
  implementation for every door, and its cost follows change rather than size.
- **Consequences:**
  - A new public contract, `aa.orient/1`, to version with care.
  - A cache directory in the data folder.
  - Rule 1 is amended for team boards if D1 is approved.
- **Follow-ups:** cross-repository memory, agents acting through AGE Aris,
  per-person hub visibility, and an MCP adapter.
