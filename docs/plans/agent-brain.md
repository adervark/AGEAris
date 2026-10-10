# The agent's brain: orient any agent, on any repo, at team scale

**Status: pending approval** (v2.1: the operator's decisions D1–D4 recorded)
v1 was drafted 2026-10-10 from `feature/pm-cockpit` at 3c69485, after an
interview with the operator, and committed with the T052 claim (00a3f26). It
was reviewed by an Architect (sound, with required changes R1–R10) and by a
Critic (revise, blocking issues B1–B9), each separately. v2 answers both
reviews. Nothing here is built yet. Once approved, each phase in §9 becomes a
task on `AA/`.

## Changes since v1

Both reviews found the same root fault. v1 modelled only what is committed,
and AA deliberately keeps live state outside commits (`_SCHEMA.md`, "entries
are deliberately not all committed"; rule 4). Most of what follows comes from
that one fault.

1. **There are live and committed parts** (R1, B1). The answer is a cached
   *committed* part plus a *live* overlay, which is read on every call from
   the working-tree trails, `AA.yml`, `STATE.md` and the clock. Principle 1 now
   says "the same commits, the same trail files and the same `asOf`".
   `lib/brief.mjs:404-407` already keys its memo this way, so v2 reuses it.
2. **The precedence table is rewritten** (R2, B2). A live run on a task means
   nobody else acts on it. Claims are gated at the WIP limit, not over it, and
   per column. The newest trail entry wins over the handoff (rule 8). Runs and
   sessions are told apart. Unmet `depends` and missing decision rules exclude
   a task. Pipeline gates are respected. Your own work comes before tidying.
   §5.2 is now a table with a predicate, the rule it serves and a fixture for
   each row.
3. **Every field states where it came from** (R4, B3). `next` holds only ids,
   enums, counts and times. Free text lives under `data`, capped in bytes and
   cleaned. v1's own example broke this rule.
4. **The budget is defined** (R5, B3): a minimum, a set of fields that is never
   cut, `next` computed first, a byte cap per field, and `--all` as aggregates
   plus the top items.
5. **The repo door is `AA/board.sh --orient`**, not a new Node CLI (B7, the
   Architect's antithesis). It is already in every AA repository and is bash
   and jq. It reads the working tree and works in every harness, with or
   without Node or the plugin. The server door extends `lib/brief.mjs` rather
   than sitting beside it. One contract and one scenario corpus bind both
   doors. §4 now weighs five options.
6. **Correctness is the gate, not speed** (B8). The gate is a deterministic
   scenario corpus of fabricated repositories, each paired with its expected
   `next`, and both implementations must pass it. A *lost-agent* metric
   measures the operator's symptom, with a baseline before and a target after.
7. **Out of this design:**
   - The pushed-claim rule (v1's D1; R9, B5). It becomes its own design task,
     with the push semantics corrected.
   - Deleting a plain project (B6). It becomes its own task, as an archive with
     a confirmation.
   - Incremental ledgers (R7, B9). They are built only if P0 shows a miss.
8. **The team hub is a separate design**, because it changes the security
   model (R8, B9, D2): network exposure, TLS, per-person auth, mirrors, and the
   ref read per repository. The team works through git from P1 onward.
9. **No writes anywhere** (R6). `behindRemote` is gone. An opt-in
   `--remote` uses `git ls-remote`, which writes nothing. No door writes to a
   clone or its `.git`.
10. **Capabilities are classified** (B6): `agent-git`, `agent-read`,
    `operator-only` or `ui-only`. The parity test checks the class, so agents
    are never offered task actions, which are reserved to the operator.
11. **The phases are split into tasks of one claim each**, with explicit
    `depends:` (B9). P1 no longer waits on P0.
12. **Smaller corrections:**
    - The quote's source is `docs/PLUGIN.md:5` (N1).
    - Fabricate's `rebase` cannot test a rewrite, so the test uses `ff` to a
      diverged branch (§1 of the Architect's review).
    - `MAX_INLINE` is a client parser guard, not an output cap (B3).
    - The ledger has no `depends` and no decision-rules flag (B4), so §5.1 says
      where they come from.
    - Only the `T` id prefix is supported (S4).
    - `aa.orient/1` has a versioning policy (N11).

## 1. What the operator asked for

- "More than anything Aris must be optimised for agent interaction."
- "I want to make this the Aris an agent's brain."
- It is "flustering under scale". What the operator sees: **too much to read**
  and **agents get lost**.
- Interview, 2026-10-10:
  - **Orient first.** When an agent starts, the brain says where things stand,
    what is in flight, what it may take, and what binds it.
  - **Hundreds of repositories, a team.**
  - **Repo first, the server adds.** The operator asked which would be better
    and accepted the recommendation.

## 2. Where it stands, measured

Measured on 2026-10-10: 3 tracked repositories, about 290 task files, about
1,840 commits.

| What | Measured | At 300 repos (linear) |
|---|---|---|
| `GET /api/workspace` | 90 ms, **316 KB**: 289 tasks with every description (242 KB), 235 activity rows (69 KB) | ~30 MB per call |
| `GET /api/brief` | 5 ms warm, 46 KB | ~4 MB |
| Cold `buildLedger` (`lib/history.mjs:251`) | 46–131 ms per repo; ledgers of 137–566 KB | ~30 s per restart, ~100 MB |
| Ledger memo (`lib/history.mjs:672`) | in memory only (`:735-746`) | rebuilt on every start |

- **The strain is the shape of the answers.** Every reader gets everything, and
  delivered history is most of it. P0 confirms this (N12): `WHY.md` warns that
  a slow board usually means too much WIP, not a slow tool.
- **An agent's start is four reads and a judgment** (AGENTS.md steps 1–4),
  redone by each harness, a little differently each time.
- **The method is already executable twice:**
  - `AA/board.sh:280-346` computes WIP against the limit, ⚑ not ready, ⊘
    expired, ↩ your idle claim, and ⚙ in flight, from the working tree.
  - `lib/brief.mjs` `Cockpit.brief` (`:446`) ranks "Needs you" across projects
    (`NEEDS_ORDER`, `:33`), with live trails (`:307`) and policy (`:287`).
  - Neither gives an agent a next action.

## 3. Principles

1. **Git and the working tree are the truth; the brain is derived.** The same
   commits, the same trail files and the same `asOf` give the same answer. The
   brain never holds state of its own.
2. **Repo first.** An agent in a clone orients with no server, no Node and no
   plugin. The server adds the cross-repo view.
3. **Answers are ranked and budgeted.** The most important thing comes first,
   there is a size limit, and the rest is one level down.
4. **One contract, proven.** Every door implements `aa.orient/1` and passes
   one scenario corpus. Where an implementation already exists, it is
   extended, not duplicated.
5. **Every capability has a stated class.** An agent can find out what it may
   do, how, and what is reserved to the operator.

## 4. Options considered

| Option | What it is | Verdict |
|---|---|---|
| **A. Node CLI and server, one `lib/orient.mjs`** (v1) | `aa orient` in the plugin, and the server, both call one Node function | Rejected as the repo door. Agents without Node or the plugin (Codex, plain shells, any repo where only `aa-init` ran) stay on the four reads, which is the failure this design fixes. It also makes a third implementation of staleness. |
| **B. A central service as the authority** | Agents claim through an API; git mirrors it | Rejected. It is a second source of truth, it breaks "coordination through files and commits rather than through a server" (`docs/PLUGIN.md:5`), and it breaks the operator-only write constraint. |
| **C. A machine-readable state file** | committed `AA/STATE.json`, or an uncommitted one, or one stored in a git ref | Rejected. Committed, it is a conflict hot spot under many claimants. Uncommitted or in a ref, it is a cache that goes stale between regenerations, and it is not visible across machines unless pushed. A cache inside the doors gives the same benefit without a new artifact. |
| **D. `board.sh --orient`** | the vendored bash/jq board emits `aa.orient/1` | **Chosen as the repo door.** It is in every AA repo, works in every harness, reads the working tree so liveness is right by construction, and already computes the flags. Cost: a second implementation, bound by the corpus. |
| **E. Extend `lib/brief.mjs`** | the server's orient is a new read on `Cockpit`, reusing its key discipline, live trails and Needs-you ranking | **Chosen as the server door.** It reuses what is already correct and keeps Home's brief, so its deltas, decisions and health stay. |

**Chosen: D + E, bound by one contract (`docs/ORIENT.md`) and one corpus.**
This adds no new implementation of the method. It turns two existing ones into
doors and proves they agree, which also closes a drift that exists today
between `board.sh` and `lib/`.

## 5. The design

```
   working tree + git (truth: task files, trails, AA.yml, STATE.md, history)
          │                                   │
          ▼                                   ▼
  AA/board.sh --orient                AGE Aris: Cockpit.orient
  (bash+jq, in every AA repo,         committed part: cached by key
   no server, no Node)                live overlay: read every call
          │                                   │
          └──────── aa.orient/1 ──────────────┘
                        ▲
         docs/ORIENT.md + scenario corpus (tests/orient/)
         both doors must produce the expected answer
```

### 5.1 What an answer is built from

**Committed part** (cacheable). Its key is `(projectId, ledgerSha, oid of the
board folder's tree at HEAD, paths, backlogFolder, ledger SCHEMA, orient
version)`, following `lib/brief.mjs:404-407`. It holds:

- the tasks of backlog and WIP, as frontmatter;
- `depends`, read from frontmatter: the ledger lacks it (`history.mjs:30`), so
  the read is added there and `SCHEMA` is bumped;
- `ready`, meaning a `## Decision rules` section is present. That is
  `board.sh:294`'s test, read from the task head the ledger already fetches;
- flow numbers as `MetricValue`s;
- delivered tasks, as counts only.

**Live overlay** (read on every call):

- working-tree trails through `readTrail` (`lib/tracked.mjs:451`) or
  `ckpt.sh`. These give runs, alive or dead, the newest `next`, any `doing`
  with nothing after it, and malformed lines;
- the `AA.yml` policy, with both WIP limits;
- the NOW block and whether `STATE.md` is stale (`board.sh --check`);
- the `## Handoff` section of the tasks the caller holds;
- `asOf`.

**Not read:** task bodies beyond the head and the Handoff and Decision-rules
headings. There is no network unless `--remote` is given, and nothing is
written anywhere.

### 5.2 `next`: the precedence table

Input: `operator` (git user.name), `run` (the caller's run id, which carries
its session, and `parent.xxxx` for a subagent), and an optional `task` (a
subagent bound to its brief).

A task is **held by another run** if it has a live run that is not the
caller's, whoever owns that run. The same operator counts too: a second
session is not the same worker (rules 2, 6). Such a task is never the subject
of continue, resume or claim, and it appears under `inFlight`.

The first row that matches wins:

| # | Predicate | `next.do` | Rule | Fixture |
|---|---|---|---|---|
| 0 | `task` given (subagent bound to a brief) | `continue` that task, or `stop` if it is held by another run | 7 | `bound-subagent` |
| 1 | The caller holds T. No live run on T. T's newest run ended on `doing` | `resume` T: in flight when it stopped; read the trail before acting | 3, 6, 8 | `dead-doing` |
| 2 | The caller holds T. No live run. The newest entry is `blocked` | `check-unblock` T | 8 | `dead-blocked` |
| 3 | The caller holds T, in progress, not held by another run, and not waiting on a pipeline gate | `continue` T. The data is the newest trail `next`, else the Handoff | 3, 8 | `held-continue`, `trail-beats-handoff`, `idle-own-claim` |
| 4 | The caller holds T, but T waits on an operator decision gate | `wait` T | — | `gate-waiting` |
| 5 | In-progress WIP is at or over its limit, and an expired claim exists (⊘: no sign of life from anyone but its owner within `stale_hours`; local doors only) | `release` T, after reading its trail | 4, 10 | `wip-full-expired` |
| 6 | In-progress WIP is at or over its limit | `stop`: WIP is full | 10 | `wip-at-limit`, `wip-over` |
| 7 | A backlog task is ready, with every `depends` done and no claim | `claim` the first by priority, then how many it unblocks, then age | 1, 5, 12 | `claim-best`, `skip-unready`, `skip-unmet-depends` |
| 8 | Otherwise | `idle`, with reason codes (`empty-backlog`, `none-ready`, `all-blocked`) | — | `idle-*` |

How the table reads:

- **Your own work comes before tidying.** Rows 1–4 come before 5, so an agent
  with work is never sent to release someone else's claim. A release is a
  commit, so racing releases resolve in git.
- **Claims are gated *at* the limit** (row 6). That matches the refusal in
  `lib/workspace.mjs:1531`.
- **The blocked limit gates moving a task to blocked,** not claiming. It is
  reported under `rules.wip.blocked`.
- **`next` is advice; git is the lock.** A claim is still a commit, and a
  conflicting commit decides a race (rule 1).

**Warnings**, all structured:

- a malformed trail line;
- `STATE.md` is stale;
- an unpushed commit of yours touches a claim;
- on a board under `deaddrop/` or `pm/`, an older layout is in use.

### 5.3 The answer, and where each field comes from

```json
{
  "schema": "aa.orient/1",
  "asOf": "2026-10-10T07:20:00Z",
  "repo": { "name": "RSNA", "head": "a1b2c3d", "board": "AA/", "door": "board.sh" },
  "next": { "do": "resume", "task": "T061", "run": "e857a8c8", "since": "2026-10-10T05:02:11Z",
            "reasons": ["dead-doing"], "rule": [3, 6, 8] },
  "rules": { "wip": { "inProgress": [1, 2], "blocked": [0, 2] }, "staleHours": 24,
             "spend": ["gpu-hour", "submission"], "notReady": ["T071"] },
  "you": [ { "task": "T061", "status": "in_progress", "runs": 2, "lastKind": "doing" } ],
  "inFlight": [ { "task": "T058", "run": "91c2ab07", "kind": "doing", "since": "…" } ],
  "take": [ { "task": "T070", "priority": "high", "unblocks": 1, "ageDays": 3 } ],
  "warnings": [ { "code": "trail-malformed", "task": "T055", "line": 14 } ],
  "data": {
    "T061": { "title": "…", "trailNext": "…", "left": "…", "from": { "file": "AA/checkpoints/T061.jsonl", "author": "ana" } },
    "now": { "text": "…", "from": { "file": "AA/STATE.md" } }
  },
  "more": { "trail": "AA/ckpt.sh live T061", "task": "AA/tasks/T061-…md", "board": "AA/board.sh" },
  "cut": { "take": 7 }
}
```

- **Structured fields** are everything outside `data`: ids, enums, numbers,
  times and rule numbers. No byte of task text appears in them, and a test
  fuzzes this.
- **`data`** is free text taken from files: titles, trail `next` and `left`,
  the NOW block, and the Handoff. Each value is:
  - stripped of control characters, newlines and bidirectional characters;
  - capped in bytes: title 160 B, trail `next` and `left` 240 B each,
    Handoff 480 B, NOW 1 KB;
  - tagged with the file it came from and, where known, the commit author.

  A harness or skill that shows `data` to a model says it is quoted from
  repository files.
- **Budget:**
  - `--budget` is in bytes. The default is 8 KB and the minimum 2 KB.
  - `next`, `rules`, `inFlight` and `warnings` are never cut. They are
    computed before any truncation and capped by count: 20 runs, 20 warnings,
    each with a `more` count.
  - `take`, `you` and `data` are cut from their ends, whole entries only. Each
    cut is counted in `cut`.
  - The output is never larger than the budget. A property test over random
    states proves it.
- **Versioning:**
  - Adding a field is `aa.orient/1`.
  - Removing a field, renaming one, or changing a meaning is
    `aa.orient/2`, and both doors print the version they emit.
  - Consumers are the skills, AGENTS.md and the server's Home.

### 5.4 The doors

| Door | For | Needs | Scope |
|---|---|---|---|
| `AA/board.sh --orient [--json] [--budget N] [--run ID] [--task T] [--remote]` | any agent in a clone, any harness | bash, jq, git: what AA already needs | this repository, working tree included |
| `/aa orient` (the plugin skill) | Claude Code users | the plugin | runs the door above and prints it |
| `GET /api/orient?project=&budget=&run=` | agents and scripts beside AGE Aris | the server, the API token | one tracked repository, or `all=1` |

- `--remote` runs `git ls-remote` against the upstream and reports
  `remote: { moved: yes|no|unknown, checkedAt }`. It writes nothing.
- The server reads its own tracked clone. An agent in a linked worktree on
  another branch can therefore get a different answer from the two doors, and
  `repo.head` shows why. The conformance tests pin the clock, the branch and
  the working tree.

### 5.5 Scale

- **Restart is a check, not a rebuild.** The committed part, and the ledger it
  came from, are cached at `<data dir>/cache/<projectId>/<key-hash>.json`. Each
  is written to a temp file and renamed. An unreadable entry is rebuilt and
  reported. Only the newest two entries per project are kept.
- **Payloads stop growing with history.** `/api/workspace` drops delivered
  tasks and descriptions: they are paged, and fetched per task. Home's
  Needs-you shows the top 12 per reason with counts. Its deltas and decisions
  stay.
- **`all=1` holds aggregates plus the top items:** per-repo counts in one line
  each, cut to the budget, and the top 10 `next`s across repositories ranked by
  row number then urgency. Every repository not shown is counted.
- **Incremental ledgers wait.** They are built only if P0 shows a cold rebuild
  misses the targets with the disk cache in place. If built, they must check
  first-parent ancestry and persist `buildLedger`'s replay state
  (`history.mjs:279-288`).

Targets, as perf budgets under `AGEARIS_PERF_STRICT=1`:

| | Target |
|---|---|
| `board.sh --orient`, a 5,000-commit repo | p95 < 1 s |
| `GET /api/orient`, one repo, warm | p95 < 150 ms |
| `GET /api/orient?all=1`, 300 repos, warm | p95 < 1 s |
| Any answer | ≤ its budget, always |
| Restart to fresh, 300 repos, cache warm | < 10 s |
| Server memory, 300 repos | < 300 MB |
| `/api/workspace` and Home payloads | < 100 KB, whatever the number of repos |

**The fixture:** 300 repositories of about 200 commits each, plus 3 of 5,000,
made with `lib/fabricate.mjs`. It is built once into a cache folder outside
the repository, with a build budget under 5 minutes.

### 5.6 Capabilities

`GET /api/capabilities` and `board.sh --capabilities` list what can be done.
Each entry carries:

- `id`;
- a `class`: `agent-git` (a board or git command), `agent-read` (a read
  endpoint), `operator-only` (task actions, switching them on, stop
  tracking), or `ui-only` (layout, filters);
- `how`: the command or endpoint;
- `inputs`;
- `refuses`.

A test fails when a `data-action` in `public/` has no entry. An
`operator-only` entry is never presented to an agent as something it can do.

### 5.7 The team, without a hub

A team works from P1 onward, through git, as AA intends:

- Each person's agents orient from their own clones with `board.sh --orient`.
- Each person's AGE Aris gives the cross-repo view over their own clones.
- Claim races resolve in git.

What a team lacks until the hub design:

- One shared view. That view needs network exposure, TLS, per-person auth,
  mirrors (`fingerprint` assumes `.git` is a directory, `history.mjs:61`), a
  board ref per repository, and batched blob prefetch.
- Claims that count across machines before they are pushed.

Both are separate designs (§10).

## 6. Out of scope here, each its own task

- **Claims across machines** (v1's D1). Corrected semantics: fetch and rebase;
  a conflict on the task file means the race is lost; a clean rebase means
  push again. This would be a per-board `AA.yml` key, never a fork of
  RULES.md. Note that `push` is a spend in this repository.
- **The team hub design** (§5.7).
- **Archiving a plain AGE Aris project**, with the existing confirmation
  pattern. It is never a delete of its git history.
- **Agents acting through AGE Aris, memory across repositories, and an MCP
  adapter.**
- **Id prefixes other than `T`.** AGE Aris assumes `T\d{3,}` throughout
  (`history.mjs:23-24`, `workspace.mjs:399`), and orient does the same.

## 7. Risks

| Risk | Mitigation | Test |
|---|---|---|
| Wrong advice, and an agent double-spends | The precedence table, a live run excluding the task, and git staying the lock | The corpus, with rows 0–8 and the B2 cases |
| The two doors disagree, and agents get lost a new way | One corpus. A conformance test runs both doors on every fixture. `board.sh`'s existing flags join the oracle. | `tests/orient/conformance.test.mjs` |
| Task text steers an agent | Provenance, `data` only, caps, stripping | A fuzz test: planted text never reaches a structured field |
| A stale cache | The committed part is keyed by content. The live overlay is never cached. | A test edits `AA.yml`, the NOW block and a trail without committing, and the answer changes |
| bash/jq limits make `board.sh --orient` hard to keep exact | Byte caps are counted in bytes (`LC_ALL=C`). The budget is applied by jq at the end. | Corpus fixtures with multi-byte and long text |
| Rolling `board.sh` out to other repositories is a spend there | It goes through the `aa-init` template (with T004), and each repository's own session updates it | — |
| A deep corpus slows the suite | Fixtures are built once and cached. The perf fixture is only in `npm run perf`. | — |

## 8. How it is verified

- **The gate is the scenario corpus** (`tests/orient/`). Each case is a
  fabricated repository, a working-tree overlay (uncommitted trail lines,
  `AA.yml` edits), a pinned `asOf`, `run` and `task`, and the expected
  `next`. Cases:
  - every row in §5.2;
  - B2's cases: a live `doing` in a second session of the same operator, at
    the WIP limit, trail against handoff, an expired claim while you hold
    work;
  - a claim on another branch;
  - injected text in a title and a trail;
  - a malformed line;
  - a subagent bound to a brief;
  - a pipeline gate.

  Both doors must produce the expected answer, the same bytes once `data` is
  removed. This tests correctness, not consistency.
- **Unit tests:**
  - the budget property;
  - provenance fuzzing;
  - cache keys: an edit to `AA.yml`, `STATE.md` or a trail invalidates, and
    an unrelated commit does not.
- **The lost-agent metric**, computed from ledgers and trails (`lib/`, a
  script). Measures:
  - (a) `doing` acts that a later run repeated;
  - (b) overlapping claims on one task;
  - (c) claims made at or over the WIP limit;
  - (d) time from claim to the first `did`.

  P0 measures a baseline on the three repositories. The target after rollout
  is no (b) and no (c) on new claims, and (a) down.
- **The LLM smoke test.** Claude Code and Codex CLI each run 3 scenarios
  (dead `doing`, WIP at limit, a ready claim) 10 times. Pass: at least 9 of 10
  each. It is an `agent-fan-out` spend with its own decision rules in its task.
- **Perf:** the §5.5 targets on the §5.5 fixture.

## 9. Phases, each one task

| # | Task | depends | Done when |
|---|---|---|---|
| P0a | **Lost-agent metric**, plus a baseline in PROGRESS.md | — | The metric runs on the three repositories, and the numbers are recorded |
| P0b | **Scale fixture and baseline**, plus a check that the payload is history (N12) | — | `npm run perf` covers 300 repos, with today's misses measured |
| P1a | **The contract and corpus:** `docs/ORIENT.md` and `tests/orient/` cases, with expected answers | — | The operator has reviewed the cases. Every §5.2 row and every §8 case is present. |
| P1b | **`AA/board.sh --orient`**, here and in the `aa-init` template | P1a, T004 | It passes the corpus, and `/aa orient` prints it |
| P1c | **`Cockpit.orient` and `GET /api/orient`**, one repository | P1a | It passes the corpus, and the conformance test against P1b passes |
| P1d | **AGENTS.md:** `board.sh --orient` beside steps 1–4, here and in the template | P1b | The bootstrap names it, and the four reads stay |
| P2a | **Disk cache** for the committed part and ledgers | P0b, P1c | The restart target is met, and the cache-key tests pass |
| P2b | **Slim `/api/workspace`**, with delivered tasks paged, and the UI follows | P0b | The payload target is met, and e2e passes |
| P3 | **Portfolio:** `all=1`, and Home's Needs-you capped with counts | P1c, P2a | The 300-repo targets are met. Home's payload is under 100 KB. |
| P4 | **Capabilities:** the classified manifest and the parity test | — | Every `data-action` is classified, and no `operator-only` entry is offered to agents |
| P5 | **LLM smoke test** in two harnesses | P1b, P1d | At least 9 of 10 per scenario per harness |
| — | Incremental ledgers | P0b, P2a | Registered only if the targets are missed |

P0a, P0b, P1a and P4 can start at once. P1 delivers what was asked first,
without waiting on scale.

## 10. Decisions for the operator

**Decided 2026-10-10 by the operator. Each followed the recommendation:**

- **D1:** `board.sh --orient`.
- **D2:** register the hub design now.
- **D3:** beside, then replace.
- **D4:** keep off.

The decisions as they were put:

- **D1. The repo door is `AA/board.sh --orient`, in bash and jq, in every AA
  repository**, rather than a Node CLI in the plugin.
  - Recommended: yes. It reaches every harness and every repository.
  - Its cost: a second implementation, held to the first by the corpus.
- **D2. The team hub: register its design as a task now, to follow P3, or wait
  for a second operator?**
  - Recommended: register it now, because the operator named a team. Until
    then the team works through git (§5.7).
  - It is a security design, because the hub would serve beyond 127.0.0.1.
- **D3. Does `board.sh --orient` sit beside AGENTS.md's four reads, or replace
  them?**
  - Recommended: beside, until the lost-agent metric shows it does better.
    Then it replaces them.
- **D4. When the same operator has a live run on a task in another session,
  is a new session told to keep off it?**
  - Recommended: yes, keep off. Rule 3 covers idle claims; a live run is a
    second worker.
  - The alternative, "continue", would bring back the double spend rule 6
    exists to prevent.

## ADR

- **Decision:** `aa.orient/1`, a ranked, budgeted answer with stated
  provenance, telling an agent what to do next. It is built from a cached
  committed part and a live overlay. It is served by `AA/board.sh --orient` in
  every repository and by `Cockpit.orient` in AGE Aris. Both are held to one
  scenario corpus.
- **Drivers:** agents get lost; there is too much to read; hundreds of
  repositories; a team; agent-first.
- **Alternatives considered:** a single Node implementation (A); a central
  authority (B); a state file (C). §4 gives the reasons.
- **Why chosen:** it reaches every harness and keeps liveness right by
  reading the working tree. It reuses the two implementations of the method
  that already exist and proves they agree. Git stays the lock.
- **Consequences:**
  - `board.sh` grows, and changes there spread through `aa-init`.
  - A public contract has to be versioned.
  - A cache folder appears in the data directory.
  - Home's payload gets a limit.
- **Follow-ups:** the hub design, claims across machines, archiving plain
  projects, incremental ledgers (if needed), memory, agents acting, and MCP.
