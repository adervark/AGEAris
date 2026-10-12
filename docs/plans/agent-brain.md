# The agent's brain: orient any agent, on any repo, at team scale

**Status: approved** (v2.2, 2026-10-10), amended as v2.3 the same day by
T069, and as v2.4 on 2026-10-11 by T070 at the operator's request. The third
Critic pass, on the v2.1→v2.2 diff, approved v2.2. §11 lists what P1a must fix
while it writes the contract; v2.3 settles §11's N1 and N2, and v2.4 answers
its open question.
v1 was drafted 2026-10-10 from `feature/pm-cockpit` at 3c69485, after an
interview with the operator, and committed with the T052 claim (00a3f26). It
was reviewed by an Architect (sound, with required changes R1–R10) and by a
Critic (revise, blocking issues B1–B9), each separately. v2 answered both
reviews. v2.1 recorded the operator's decisions D1–D4. A second Critic round
on v2.1 (684034c) found B4–B7 resolved, and six more blocking issues in §5.2,
§5.3 and §9, which v2.2 answers. Nothing here is built yet. Each phase in §9 is
now a task on `AA/`: T053–T068, with the follow-ups.

## Changes since v2.3

The operator, 2026-10-11: "I need clear decision on running and closed
sessions so use something as a failsafe." v2.3 left a state orient could not
decide, *unknown*, and answered it with `verify`. A crashed session also read
as live for `live_minutes`, so a restarted session was kept off its own task.

1. **Every run is running or closed (D5).** The first rule that applies
   decides, and orient says which one did (`by`):
   - `end`: closed;
   - a `doing` whose `until` is ahead: running;
   - **the process**, on the machine that ran it: alive is running, gone is
     closed. Each run names its process (`boot`, `pid`, `pstart`), which
     `ckpt.sh open` records from `CLAUDE_PID` (T070);
   - the clock, only where no process can be checked: running within
     `live_minutes`, closed after.

   The process check is the failsafe. A crash, a closed terminal or a reboot
   reads as closed at once, and an open session reads as running however
   quiet. *Unknown* and `verify` are gone. `resume` still begins with the
   `tell` check, because an act can outlive its session.
2. **Your own task held by a running session: wait (D6).** This answers §11's
   open question. `next` is `wait`, and it names the holder: its run, the
   evidence, and since when. The new session starts nothing, so the operator
   decides.
3. **The table is renumbered 0–9** (§5.2). Rows 1a and 1b become row 1, and
   the new row 5 is D6.
4. **A running run is a sign of life** for rule 4, as a `doing` with `until`
   ahead already was.

## Changes since v2.2

The third Critic pass rated one issue the most serious: a long act that writes
nothing would read as dead after `live_minutes`, so a second session would be
told to resume it and pay for it twice (§11 N1). The operator asked for it to
be fixed in the design instead of being left to P1a (T069).

1. **A `doing` can say until when it may run silent.**
   - `_SCHEMA.md` (here and in the `aa-init` template) adds an optional
     `until`.
   - `ckpt.sh log … doing --for 2h` writes it, and `--until <UTC time>` is
     checked. Either is refused on anything but a `doing`.
   - A reader counts `until` at most `stale_hours` past its line, so it can
     never hold a task longer than rule 4 allows.
2. **There are three states, and only a dead run is resumed** (§5.2):
   - a live run, or one running silent before its `until`, is in flight and
     kept off;
   - a silent `doing` with no `until`, younger than `stale_hours`, is
     *unknown*, and gets the new `verify` (row 1a): establish from `tell`
     whether the act is running before touching it;
   - only a dead run gets `resume`, row 1b, which still checks `tell` first
     and then reaps.
3. **The family includes siblings** (§11 N2): every run that shares the root
   id.

## Changes since v2.1

1. **"Live" is defined, and it is not `stale_hours`** (blocking issue 1). A
   run is live if it has not ended and its newest entry is within
   `live_minutes`, a new AA.yml key that defaults to 30.
   - Under the old definition, a crashed session's run counted as live for
     24 hours. D4 then kept a new session off its own task, and row 1 never
     fired.
   - `resume` now always says to check the `doing`'s `tell` first. That alone
     does not cover a long act that wrote nothing for 30 minutes. §11 N1
     says what `resume` must mean.
   - `stale_hours` still governs other people's claims (rule 4).
2. **Run families** (blocking issue 2). The caller's run, its parent and its
   children are one worker. A subagent is no longer told to stop on its
   parent's task, and a parent is no longer pushed off by its own child.
3. **WIP counts the way the code does** (blocking issue 3). Claims are gated
   when in progress plus blocked reaches `wip.in_progress`. That is what
   `lib/workspace.mjs:1530` (`isWip`, `:318-319`), metric 11
   (`lib/metrics.mjs:131`) and `board.sh:350` already count. v2's citation
   was wrong.
4. **Gates belong to the server only** (blocking issue 4). Pipeline gates live
   in the data directory (`lib/pipeline.mjs:342`), so `board.sh` never emits
   `wait`, and gate cases are marked server-only in the corpus.
5. **The budget adds up** (blocking issue 5). Every never-cut list is capped by
   count, `spend` and the repo name move to `data`, and the worst case is
   computed (about 2.7 KB). The minimum budget is 4 KB.
6. **Phase dependencies are fixed** (blocking issue 6). The conformance test is
   its own phase, P1e. P3 depends on P2b. P6 measures the lost-agent metric
   after rollout and decides D3's "then replace".
7. **Notes folded in:**
   - `ready` is board.sh's test, with content in the section, and stricter than
     rule 5. That is stated.
   - Any dead `doing` counts, not just the newest run's.
   - A held, blocked task without a trail entry goes to row 2.
   - "Holds" and the order of held tasks are defined.
   - An expired claim is dealt with before new work.
   - Task-file state comes from HEAD in both doors, with a warning for
     uncommitted changes.
   - Flow numbers are out of the committed part.
   - The server door takes `task=`.
   - The lost-agent measures are defined mechanically, with numbers.
   - The serialization rules are pinned in P1a.
   - P1b and P1d carry a `global-config` decision rule.
   - "No repository writes" replaces "writes nothing".
   - A killed dependency is not met.
   - An orient call is never a sign of life.

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
   `--remote` uses `git ls-remote`, which makes no repository writes. No door writes to a
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

**Task-file state comes from HEAD in both doors.** A claim is a commit
(rule 1), so an uncommitted move or edit is not yet a claim. When the working
tree differs from HEAD under the board's task folders, the answer carries the
warning `uncommitted-task-change` with the ids. A corpus case covers it.

**Committed part** (cacheable). Its key is `(projectId, ledgerSha, oid of the
board folder's tree at HEAD, paths, backlogFolder, ledger SCHEMA, orient
version)`, following `lib/brief.mjs:404-407`. It holds nothing that depends on
the clock:

- the tasks of backlog and WIP, as frontmatter, with `claimedAt`;
- `depends`, read from frontmatter. The ledger lacks it (`history.mjs:30`), so
  the read is added there and `SCHEMA` is bumped;
- `ready`, which is `board.sh`'s Definition-of-Ready test: a
  `## Decision rules` section with content, not just the heading
  (`board.sh:56-77`). This is stricter than rule 5, which needs decision
  rules only for a task that will spend. The repository cannot tell which
  tasks spend, so orient takes the stricter reading, as the board's ⚑ already
  does. Every backlog task on this board passes it today;
- delivered tasks, as counts only. A killed task is in `done/` but never
  counts as a met dependency.

`aa.orient/1` carries no flow numbers. Those stay with the brief and the
project page, keyed as they are now.

**Live overlay** (read on every call):

- working-tree trails, through `readTrail` (`lib/tracked.mjs:451`) or
  `ckpt.sh`. They give runs, running or closed by §5.2's definition, each
  run's newest entry and `next`, every run whose last entry is `doing`, and
  malformed lines;
- the process view: this machine's boot id, and `ps` for each run that names a
  process on this boot (§5.2, rule 3 of running or closed);
- the `AA.yml` policy: `wip.in_progress`, `wip.blocked`, `stale_hours`,
  `live_minutes`, `spend`;
- the NOW block, and whether `STATE.md` is stale (`board.sh --check`);
- the `## Handoff` section of the tasks the caller holds;
- the pipeline gates of the project's runs, on the **server door only**
  (`lib/pipeline.mjs:342`; they are in the data directory, not in the
  repository);
- `asOf`.

**Not read:** task bodies beyond the head and the Handoff and Decision-rules
sections. There is no network unless `--remote` is given. **No repository
writes**, in the clone or its `.git`. An orient call is never a sign of life,
because it leaves nothing behind.

### 5.2 `next`: the precedence table

**Inputs:**

- `operator`: git user.name;
- `run`: the caller's run id. A subagent's run id is `parent.xxxx`
  (`_SCHEMA.md`, run ids; `ckpt.sh:117`);
- `task`, optional: a subagent bound to its brief.

**Definitions:**

- **The caller holds T** when T is in `tasks/` (not `done/`) and its owner's
  operator is the caller's `operator`. With several held tasks, the oldest
  claim comes first, as in `board.sh:298`.
- **Every run is running or closed** (v2.4, D5, T070). Running answers one
  question: is a worker on this task right now? The first rule that applies
  decides, and the answer names it as `by`:
  1. `end`: its newest entry is an `end`. Closed.
  2. `until`: its newest entry is a `doing` whose `until` is after `asOf`,
     counted at most `stale_hours` past that line's `ts` (`_SCHEMA.md`, T069).
     Running.
  3. `process`: its newest process record (`boot`, `pid`, `pstart`) carries
     this machine's boot id. Running if that process is alive and started at
     `pstart`, closed if not. This is the failsafe: a crash reads as closed at
     once, and an open session reads as running however quiet.
  4. `clock`: otherwise, because the process ran on another machine or none was
     named. Running if its newest entry is within `live_minutes` of `asOf`,
     closed if not. `live_minutes` is an `AA.yml` key, default 30, clamped
     below `stale_hours` × 60. It is deliberately not `stale_hours`, which
     governs whether *other* people's claims are pullable (rule 4) and is
     unchanged.

  A closed run whose newest entry is a `doing` **stopped mid-act**. Only such a
  run is ever resumed, and `resume` checks that act's `tell` first, because an
  act can outlive its session (a detached job).
- **The caller's family** is every run that shares the caller's root, the run
  id before the first `.`: the session, its subagents and their siblings. A
  family is one worker. With no `run` given, the family is empty.
- **Held by another run:** T has a run outside the caller's family that is
  running. This includes another session of the same operator (D4). Such a
  task is never the subject of continue, resume or claim. It appears under
  `inFlight`, and when the caller holds it, row 5 says `wait` (D6).
- **WIP** is the number of tasks in progress plus blocked, against
  `wip.in_progress`. This is how `lib/workspace.mjs:1530` (`isWip`,
  `:318-319`), metric 11 (`lib/metrics.mjs:131`) and `board.sh:350` count it
  today. `wip.blocked` is reported, and it gates nothing in orient.
- **Expired:** a claim of another operator with no sign of life within
  `stale_hours` from anyone but its owner, read from the trail first (rule 4,
  board.sh's ⊘). A running run is a sign of life: a `doing` whose `until` is
  still ahead, as in v2.3, and now a run whose process is alive. §11 N3 pins
  the wording to rule 4's.

**The first row that matches wins:**

| # | Predicate | `next.do` | Rule | Fixtures |
|---|---|---|---|---|
| 0 | `task` given (a subagent bound to a brief) | `stop` if T is not the caller's or is held by another run; `resume` T if the caller's own run on T stopped mid-act; otherwise `continue` T | 7 | `bound-subagent`, `bound-subagent-parent-doing`, `bound-subagent-other-session`, `bound-subagent-resumed` |
| 1 | The caller holds T. T is not held by another run. A run on T **stopped mid-act**: closed, with `doing` as its newest entry | `resume` T with `verify: "tell"`. Check that act's `tell` first. If the act is still running, keep off. If it stopped, append the reaping `end` for that run (rule 2's exception), then act. If you cannot tell, stop | 3, 6, 8 | `dead-doing`, `crashed-a-minute-ago`, `dead-doing-clock`, `doing-past-until`, `older-run-dead-doing`, `after-reap-continues` |
| 2 | The caller holds T, not held by another run, and T is blocked: in the BLOCKED column, `status: blocked`, or its newest entry is `blocked` | `check-unblock` T. The data is `blockedReason` or the entry's `unblocks` | 8 | `dead-blocked`, `blocked-no-trail` |
| 3 | The caller holds T, in progress, not held by another run. On the server only: not waiting on a pipeline gate | `continue` T. The data is the newest trail `next`, else the Handoff. If the owner line's session is not the caller's, add `rewrite-owner` (rule 3) | 3, 8 | `held-continue`, `trail-beats-handoff`, `idle-own-claim`, `parent-with-live-child` |
| 4 | Server only: the caller holds T, and T waits on an operator decision gate | `wait` T | — | `gate-waiting` (server-only) |
| 5 | The caller holds T, and T is held by another run: a running session, the caller's own operator's included (D4, D6) | `wait` T, naming the holder: its run, `by`, and since when. Start nothing else; the operator decides | 3 | `held-by-open-session`, `held-by-quiet-session`, `held-running-silent`, `held-other-machine` |
| 6 | An expired claim exists | `release` T after reading its trail, or take it over (rule 4) | 4 | `expired-under-limit`, `wip-full-expired` |
| 7 | WIP ≥ `wip.in_progress` | `stop`: WIP is full | 10 | `wip-at-limit`, `wip-one-blocked`, `wip-over` |
| 8 | A backlog task is ready, every `depends` is done and not killed, and it is not held by another run | `claim` the first by priority, then how many it unblocks, then age | 1, 5, 12 | `claim-best`, `skip-unready`, `skip-unmet-depends`, `skip-killed-depends` |
| 9 | Otherwise | `idle`, with reason codes `empty-backlog`, `none-ready` or `all-blocked` | — | `idle-*` |

How the table reads:

- **Your own work first, then finishing, then starting.** Rows 1–5 come before
  6, so an agent with work is never sent to tidy, and one whose task is held
  elsewhere starts nothing new. Row 6 comes before 7–8, so an expired claim is
  dealt with before new work starts, whether or not WIP is full. That is rule
  4, and Kanban's "stop starting, start finishing". A release is a commit, so
  racing releases resolve in git.
- **Claims are gated at the limit**, counted as the server counts them (row 7).
- **`next` is advice; git is the lock.** A claim is still a commit, and a
  conflicting commit decides a race (rule 1).
- **`board.sh` never emits row 4's `wait`.** It cannot see pipeline gates.
  Gate fixtures are marked server-only in the corpus.

**Warnings**, all structured:

- a malformed trail line;
- `STATE.md` is stale;
- `uncommitted-task-change`;
- an unpushed commit of yours touches a claim;
- `depends-killed`;
- an older board layout is in use, under `deaddrop/` or `pm/`.

### 5.3 The answer, and where each field comes from

```json
{
  "schema": "aa.orient/1",
  "asOf": "2026-10-10T07:20:00Z",
  "repo": { "head": "a1b2c3d", "board": "AA/", "door": "board.sh" },
  "next": { "do": "resume", "task": "T061", "run": "e857a8c8", "by": "process", "since": "2026-10-10T05:02:11Z",
            "verify": "tell", "reasons": ["dead-doing"], "rule": [3, 6, 8] },
  "rules": { "wip": { "used": 1, "limit": 2, "blocked": [0, 2] }, "staleHours": 24, "liveMinutes": 30,
             "notReady": ["T071"], "notReadyMore": 0 },
  "you": [ { "task": "T061", "status": "in_progress", "runs": 2, "lastKind": "doing" } ],
  "inFlight": [ { "task": "T058", "run": "91c2ab07", "kind": "doing", "since": "…", "state": "running", "by": "process" } ],
  "take": [ { "task": "T070", "priority": "high", "unblocks": 1, "ageDays": 3 } ],
  "warnings": [ { "code": "trail-malformed", "task": "T055", "line": 14 } ],
  "data": {
    "repo": { "name": "RSNA" },
    "spend": ["gpu-hour", "submission"],
    "T061": { "title": "…", "trailNext": "…", "left": "…", "tell": "…",
              "from": { "file": "AA/checkpoints/T061.jsonl", "author": "ana" } },
    "now": { "text": "…", "from": { "file": "AA/STATE.md" } }
  },
  "more": { "trail": "AA/ckpt.sh live T061", "task": "AA/tasks/T061-…md", "board": "AA/board.sh" },
  "cut": { "take": 7 }
}
```

- **Structured fields** are everything outside `data`: ids, enums, numbers,
  times and rule numbers. No byte of repository text appears in them. That
  includes the repo name and the `spend` words, which moved to `data` in
  v2.2. A test fuzzes this.
- **`data`** is free text taken from files: titles, trail `next`, `left` and
  `tell`, the NOW block, the Handoff, the repo name and the spend words. Each
  value is:
  - cleaned by the rules P1a pins;
  - capped in bytes: title 160 B, trail `next`/`left`/`tell` 240 B each,
    Handoff 480 B, NOW 1 KB, each spend word 40 B;
  - tagged with the file it came from and, where known, the commit author.

  A harness or skill that shows `data` to a model says it is quoted from
  repository files.
- **Budget:**
  - `--budget` is in bytes of the `--json` output. Text output is not
    budgeted.
  - The default is 8 KB and the minimum 4 KB.
  - The never-cut set is `schema`, `asOf`, `repo`, `next`, `rules`,
    `inFlight`, `warnings` and `more`. Each list in it is capped by count with
    a `more` count: `inFlight` 10, `warnings` 10, `notReady` 20.
  - Its worst case is about 2.7 KB: envelope ~250 B, `next` ~250 B,
    `rules` ~350 B, `inFlight` 10 × ~90 B, `warnings` 10 × ~60 B, `more`
    ~150 B. It fits under the minimum with room to spare, and P1a's tests
    prove the bound.
  - `next` is computed before any truncation.
  - `data`, then `take`, then `you` are cut from their ends, whole entries
    only. Each cut is counted in `cut`.
  - The output is never larger than the budget. A property test over random
    states proves it.
- **Serialization is part of the contract, pinned in P1a:**
  - invalid UTF-8 is replaced with U+FFFD before measuring;
  - C0, C1, DEL and the bidi controls (U+202A–202E, U+2066–2069, U+200E–200F,
    U+061C) are stripped, and newlines become spaces;
  - truncation falls on a code-point boundary, with `…` counted in the cap;
  - keys come in the order shown above, in compact JSON with no spaces.

  "The same bytes" between doors therefore includes `data`.
- **Versioning:**
  - Adding a field is `aa.orient/1`.
  - Removing a field, renaming one, or changing a meaning is
    `aa.orient/2`, and both doors print the version they emit.
  - Consumers are the skills, AGENTS.md and the server's Home.

### 5.4 The doors

| Door | For | Needs | Scope |
|---|---|---|---|
| `AA/board.sh --orient [--json] [--budget N] [--run ID] [--task T] [--remote]` | any agent in a clone, any harness | bash, jq ≥ 1.6, git: what AA already needs | this repository |
| `/aa orient` (the plugin skill) | Claude Code users | the plugin | runs the door above and prints it |
| `GET /api/orient?project=&budget=&run=&task=` | agents and scripts beside AGE Aris | the server, the API token | one tracked repository, or `all=1` |

- `--remote` runs `git ls-remote` against the upstream and reports
  `remote: { moved: yes|no|unknown, checkedAt }`. It makes no repository
  writes. Credential helpers and ssh may still update their own state.
- The server reads its own tracked clone. An agent in a linked worktree on
  another branch can therefore get a different answer from the two doors, and
  `repo.head` shows why. The conformance tests pin the clock, the branch and
  the working tree.
- The `board.sh` door costs 0.11 s on this repository today. jq 1.6 or later
  has `utf8bytelength`, so the byte caps and the budget are done in jq.

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

Both are separate designs (§6, D2). One constraint carries into the hub
design now. A hub sees only pushed commits, never the working-tree trails that
rule 4 counts as signs of life. So a hub must never emit row 6's `release` for
someone else's claim. It can only report "no pushed sign of life since X".

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
| Wrong advice, and an agent double-spends | The precedence table, a running run excluding the task, and git staying the lock | The corpus: every §5.2 fixture and every §8 case |
| The two doors disagree, and agents get lost a new way | One corpus. A conformance test runs both doors on every fixture. `board.sh`'s existing flags join the oracle. | `tests/orient/conformance.test.mjs` |
| Task text steers an agent | Provenance, `data` only, caps, stripping | A fuzz test: planted text never reaches a structured field |
| A stale cache | The committed part is keyed by content. The live overlay is never cached. | A test edits `AA.yml`, the NOW block and a trail without committing, and the answer changes |
| bash/jq limits make `board.sh --orient` hard to keep exact | Byte caps are counted in bytes (`LC_ALL=C`). The budget is applied by jq at the end. | Corpus fixtures with multi-byte and long text |
| Rolling `board.sh` out to other repositories is a spend there | It goes through the `aa-init` template (with T004), and each repository's own session updates it | — |
| A deep corpus slows the suite | Fixtures are built once and cached. The perf fixture is only in `npm run perf`. | — |
| The process check reads a session wrong | A run names its boot id, pid and start time, so a reboot or a pid used again reads as closed. A run from another machine, or one that names no process, goes by the clock. `until` covers an act that outlives its session, and `resume` checks `tell` first. One case is left: a reader in another pid namespace on the same kernel (a container) shares the boot id, so the doors are not run across pid namespaces. | `tests/fixtures/board/ckpt-process.sh`, and the corpus's process cases |

## 8. How it is verified

- **The gate is the scenario corpus** (`tests/orient/`). Each case is:
  - a fabricated repository;
  - a working-tree overlay: uncommitted trail lines, `AA.yml` edits, an
    uncommitted task move;
  - a pinned `asOf`, `run` and `task`;
  - the expected answer.

  Cases:
  - every fixture named in §5.2;
  - a live `doing` in a second session of the same operator;
  - a crashed session's `doing`, its process gone a minute after its last
    word, and a quiet open session three hours silent (v2.4);
  - a pid used again by a later process, a run from another machine decided
    by the clock either way, and a resumed session that names a new process;
  - a subagent whose parent has an open `doing`;
  - at the WIP limit, and with one task blocked;
  - trail against handoff;
  - an expired claim while you hold work;
  - a claim on another branch;
  - an uncommitted claim;
  - injected text in a title, a trail and the NOW block;
  - multi-byte text at every cap;
  - a malformed line;
  - a killed dependency;
  - a pipeline gate (server-only).

  Both doors must produce the expected answer byte for byte, except on cases
  marked server-only. This tests correctness, not just consistency.
- **Unit tests:**
  - the budget property, including the never-cut worst case;
  - provenance fuzzing;
  - cache keys: an edit to `AA.yml`, `STATE.md` or a trail changes the
    answer, and an unrelated commit does not touch the committed part.
- **The lost-agent metric**, computed from ledgers and trails by a script in
  `lib/`. Measures:
  - **(a) repeated acts:** a `doing` whose `act` is identical, after
    whitespace is normalised, to a `doing` in an earlier run on the same task,
    with no `did` or `end` in between that answers it;
  - **(b) overlapping claims:** two owner lines on one task whose claimed
    intervals overlap with different operators, or with the same operator and
    two runs writing in the same interval;
  - **(c) over-limit claims:** a commit that moves a task into `tasks/` while
    WIP, counted as in §5.2, is already at `wip.in_progress`;
  - **(d) start latency:** the time from a claim commit to the first `did` on
    that task.

  P0a measures a baseline on the three repositories. P6 measures again 28 days
  after P1d. Targets:
  - no (b) and no (c) among new claims;
  - (a) at or below half its baseline rate per 100 runs;
  - (d)'s median no worse than baseline.
- **The LLM smoke test.** Claude Code and Codex CLI each run 3 scenarios
  (dead `doing`, WIP at limit, a ready claim) 10 times. Pass: at least 9 of 10
  each. It is an `agent-fan-out` spend, with its own decision rules in its
  task.
- **Perf:** the §5.5 targets on the §5.5 fixture.

## 9. Phases, each one task

| # | Task | depends | Done when |
|---|---|---|---|
| P0a | **Lost-agent metric**, plus a baseline in PROGRESS.md | — | Measures (a)–(d) as defined in §8 run on the three repositories, and the numbers are recorded |
| P0b | **Scale fixture and baseline**, plus a check that the payload is history (N12) | — | `npm run perf` covers 300 repos, with today's misses measured |
| P1a | **The contract and corpus:** `docs/ORIENT.md` (definitions, the table, provenance, serialization, budget, versioning) and the `tests/orient/` cases with expected answers | — | Every fixture in §5.2 and every case in §8 is present. The serialization rules are pinned. The operator has reviewed the cases. |
| P1b | **`AA/board.sh --orient`**, here and in the `aa-init` template, plus `live_minutes` in the template's AA.yml | P1a, T004 | It passes every corpus case not marked server-only, and `/aa orient` prints it. Decision rules: syncing the installed plugin is `global-config`, so a trail entry comes first. |
| P1c | **`Cockpit.orient` and `GET /api/orient`**, one repository, `task=` included | P1a | It passes every corpus case |
| P1d | **AGENTS.md:** `board.sh --orient` beside steps 1–4, here and in the template | P1b | The bootstrap names it, and the four reads stay. Same decision rule as P1b. |
| P1e | **Conformance:** both doors on every shared corpus case, compared byte for byte | P1b, P1c | The test is in `npm test` and passes |
| P2a | **Disk cache** for the committed part and ledgers | P0b, P1c | The restart target is met, and the cache-key tests pass |
| P2b | **Slim `/api/workspace`**, with delivered tasks paged, and the UI follows | P0b | The payload target is met, and e2e passes |
| P3 | **Portfolio:** `all=1`, and Home's Needs-you capped with counts | P1c, P2a, P2b | The 300-repo targets are met. Home and `/api/workspace` are each under 100 KB. |
| P4 | **Capabilities:** the classified manifest and the parity test | — | Every `data-action` is classified, and no `operator-only` entry is offered to agents |
| P5 | **LLM smoke test** in two harnesses | P1b, P1d | At least 9 of 10 per scenario per harness |
| P6 | **After-measurement; decide D3's replace** | P0a, P1d, then 28 days | The §8 targets are measured. If they are met, `board.sh --orient` becomes AGENTS.md step 1, and the four reads become the fallback. |
| — | Incremental ledgers | P0b, P2a | Registered only if the targets are missed |

P0a, P0b, P1a and P4 can start at once. P1 delivers what was asked first,
without waiting on scale.

## 10. Decisions for the operator

**Decided 2026-10-10 by the operator. Each followed the recommendation:**

- **D1:** `board.sh --orient`.
- **D2:** register the hub design now.
- **D3:** beside, then replace.
- **D4:** keep off.

**Decided 2026-10-11 by the operator:**

- **D5:** a clear decision between running and closed sessions, with a
  failsafe. Asked for by the operator; the process check is how (§5.2, T070).
- **D6:** when your own task is held by a session that is verified running,
  a new session is told to wait, and the holder is named. It followed the
  recommendation.

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

## 11. Must-fix in P1a (third Critic pass, on v2.2)

The pass approved v2.2, on the condition that P1a's `docs/ORIENT.md` and
`tests/orient/` fix the following. Each is a definition, not architecture.

- **N1. A long silent act reads as dead. Settled in v2.3 by T069, and in v2.4
  by T070.** v2.4 replaces the states below with running or closed (§5.2): on
  its own machine a run's process decides, so a quiet act in an open session
  is running and a crash is closed. `until` still covers an act that outlives
  its session, and the clock decides only where no process can be checked. The
  schema's own example (`_SCHEMA.md:25-26`) goes two hours between `doing` and
  `did`. With `live_minutes` at 30, a second session would have been told
  `resume`. Now:
  - a `doing` can carry `until` (`ckpt.sh … --for 2h`), and until then its run
    is running (T069);
  - a run's process decides on its own machine, so a quiet act in an open
    session is running however long it is silent (T070);
  - `resume` is only for a run that stopped mid-act, closed by §5.2's rules,
    and it still checks `tell` first.

  The `_SCHEMA.md` example carries `until` and a process. P1a writes the
  fixtures named in rows 0, 1 and 5.
- **N2. Siblings. Settled in v2.3:** §5.2 defines the family as every run
  sharing the root, and an empty family when no `run` is given.
- **N3. Expired is rule 4 verbatim.** The trail counts from anyone. Commits
  count only when made by anyone but the reader, with `migrate:` and `ckpt:`
  sweeps excluded, as `board.sh:214` codes it. P1a pins one sweep-exclusion
  set. `workspace.mjs:1515` `_lastSignInGit` excludes by trailer instead,
  which is existing drift to reconcile. `board.sh:345`'s legend is wrong too.
- **N4. Resume ends with the reap.** The `resume` contract ends by appending
  the reaping `end` (rule 2's exception, `ckpt.sh log T end --run <ID>`), so
  row 1 stops firing. `older-run-dead-doing` adds the state after the reap,
  where row 3 fires.
- **N5. Budget holes.**
  - `uncommitted-task-change` gets one warning per id, capped with a `more`
    count.
  - `more.task` names the task by id only, since a file slug is repository
    text.
  - `cut` and `remote` are placed in the budget.
- **N6. No limit.** Row 6 applies only when `wip.in_progress` > 0 (as
  `workspace.mjs:1473` does), with a `no-wip-limit` warning.
- **N7. Consistent keys.** `live_minutes` is clamped below `stale_hours` × 60,
  with a fixture. §5.2 now states the clamp.
- **Also:**
  - Row 0 resumes when the caller's own run stopped mid-act (a resumed
    session), as row 1 does.
  - `inFlight` includes `doing`s whose run is closed, marked `closed`, to
    match `board.sh`'s ⚙.
  - The two meanings of "live" are named apart. `readTrail.live` is within
    `stale_hours`; orient's word is *running*, by §5.2's four rules. T071
    brings the server's own reading to running or closed.
  - `rewrite-owner` compares the session only.
  - The byte-for-byte comparison excludes `repo.door` and `remote`.
  - The sources are stated: HEAD for the task head, the overlay for the
    Handoff.
  - A corpus case pins the replacement of invalid UTF-8 for jq and for Node.
  - Measure (a)'s target when the baseline is 0: it stays 0.
  - P1b aligns `board.sh:331`'s IN PROGRESS header with `:257` and `:350`.
  - P6 carries P1b's `global-config` decision rule.
- **Answered 2026-10-11 (D6):** within `live_minutes` after a crash, should a
  restarting session get `own-task-live-elsewhere` (wait, with `since`)
  rather than be sent to claim new work? With D5 a crash reads as closed at
  once on its own machine, so the question is only about a session that is
  verified running. It gets `wait`, naming the holder (row 5).

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
