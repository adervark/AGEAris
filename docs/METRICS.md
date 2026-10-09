# Metrics

AGE Aris computes every number on Home, a project's Flow and Method tabs, and Decisions from
two records: the project's git history and the runs' hash-chained audit logs.
Nothing is typed in by hand and nothing is stored apart from those records. The
engine is `lib/metrics.mjs`; it is pure, takes the moment it computes for
(`asOf`) as an argument, and never reads the clock or the disk.

Every value carries its definition, formula, clock, window, sample size, the
settings it used (`params`), its items, and the items it excluded with a reason.
Each item cites a commit (`commit`) or an audit event (`runId`, `seq`, `hash`);
an item that used the uncommitted trail cites the trail file with `live: true`.

## Time

- **Commit time (`at`).** Ledger metrics use the commit's committer date,
  clamped so it never decreases along first-parent history. A rebase restamps
  the committer date, so rebased agent work counts when it landed. A commit
  fast-forwarded with an older date takes the `at` of the commit before it, is
  marked `clamped`, and raises an `out_of_order_time` anomaly.
- **Event time.** Pipeline metrics use each audit event's `at`.
- **Checkpoint time.** Stale claims also read checkpoint lines' own `ts`.
- **Days** follow the workspace time zone (`settings.json`, `timezone`).
  Working days are `settings.workdays` (ISO weekdays, default Monday–Friday).
- **Durations** are elapsed calendar days, shown in minutes below an hour
  (`24 min`), to one decimal in hours below a day (`6.0 h`), otherwise in days. Item values keep three decimals of a
  day, so short cycles do not round to zero. Approval
  latency, blocked-for, and decision-wait checks subtract every whole
  non-working local day inside the interval, at its real length (a 25-hour day
  removes 25 hours).
- **Percentiles** use the nearest rank: `sorted[ceil(p/100 × n) − 1]`.
- **Flow window:** items finished in the last 90 days, at least 5 of them;
  below 5 a value is `insufficient`, shown as "not enough history (3 of 5)".
- **Sweep commits** (subject `migrate:` or `ckpt:`) update state but never
  supply a start or a finish time.

## Shared definitions

**States** follow the directory, refined by frontmatter: `backlog/` is backlog;
`tasks/` is blocked with `status: blocked`, backlog with an unclaimed status
(`open`, `unclaimed`, `backlog`, or none: older boards have no `backlog/` and
file new work in `tasks/`), otherwise in progress; `tasks/done/` is dropped with
`status: killed`, otherwise done. The status is its first word, lowercased, and
`in progress` in any spelling is in progress. WIP is in progress plus blocked.
Open work is backlog plus WIP.

**Boards.** A project created in AGE Aris reads `AA/` (`deaddrop/` when the
project is older than that name) and its pipeline runs. A tracked repository
reads only its board's `backlog/`, `tasks/`, and `checkpoints/`, under `AA/`
and under `deaddrop/` and `pm/`, the board's older names. A commit that moves a
task from `deaddrop/` to `AA/` is a move, not a deletion and a creation, so the
task's history continues.

**Cycle start.** A cycle begins at creation or at a reopen (leaving done or
dropped). Its start is its first entry into WIP: creation in WIP, backlog →
WIP, or done → WIP. Moving between in progress and blocked is not a start, and
WIP → backlog → WIP keeps the original start. When the first WIP entry is in a
sweep commit, the start is the first later non-sweep commit touching the task
while it is still in WIP, labelled "start bounded by first non-sweep commit
(cycle time may be understated)"; with no such commit the item is excluded,
"start known only from a sweep commit". Cycle time never falls back to
creation.

**Finish.** A move into done. An item finished more than once counts once, at
its final finish as of `asOf`, measured from the start of that final cycle. A
finish known only from a sweep commit is excluded ("finish known only from a
sweep commit"). When an item finished earlier is reopened and still open, its
finish is withdrawn, and the done counts list it as excluded ("earlier finish
withdrawn by a reopen"). A brief for a past `asOf` replays only the history up
to that moment, so it is unaffected.

**Dropped.** Entering `tasks/done/` as killed, or done changed to killed. It is
scope removal, never a finish, and is excluded from throughput, cycle time, and
lead time as "dropped (killed)".

**Created.** The `at` of the first commit that adds the task file (per
incarnation). The frontmatter `createdAt` is never used.

**Type.** Grouping uses `typeKey`: lowercased and trimmed; any value
containing `{` or `}` (the template placeholder) is untyped; other characters
outside `[a-z0-9 _-]` are removed. Untyped items use the project reference.

**Owner line.** `owner:` reads `<operator> @<profile>/<session> <date> — <note>`.
`ade @agesight/web …` is written by the UI or by `startRun`: bookkeeping, not
ownership. Any other `@profile/session` is an agent session, identified as
`<operator> @<profile>/<session>`.

**Effective owner**, the first that applies at `asOf`:
1. `assignee` (a person);
2. an active run on the task whose latest attempt is an agent attempt: that
   agent, "via run R001" (a human stage gives nothing here);
3. an agent claim: the agent identity from the owner line, or
   `<operator> (trail)` when only a checkpoint trail marks it;
4. Unassigned, including `@agesight/web` owner lines and owners with no
   session.

## Reproducibility

A value is reproducible from the ledger sha it was built from, `asOf`, and the
settings; every value carries `build: {headSha, ledgerSha}` and
`ledgerHeadAtAsOf`, the last commit at or before `asOf`. Commits that land later
with older dates (fast-forwards) take the time of the commit before them, so a
value recomputed for a past `asOf` after such a landing can include them; the
ledger flags them as clamped. The one input that is not reproducible is the
live working-tree trail (see Stale claims): it is read only for a value
computed now, and every value that used it says `inputs.live: true`.

## Metric reference

Each section names the ids `lib/metrics.mjs` produces (`METRIC_DEFINITIONS`).

### `waiting_on_you` — Waiting on you (1)

- **Definition:** runs that need a person at `asOf`, by the same rule as the
  Decisions page (`needsHumanAt`): a gate awaiting approval, a human stage, a
  run waiting (for example, no agent available), a failed run not superseded by
  a newer run on the task that had started by `asOf`, pull work queued longer
  than the lease, or an audit log that failed verification.
- **Formula:** count of such runs. Wait age = `asOf − wait start`, oldest first.
- **Wait start:** gate → `gate_opened`; human stage → its `attempt_dispatched`;
  waiting → the first `waiting` event of the wait; failed → `run_failed`;
  unclaimed → `dispatchedAt`; integrity → the first broken event, or the last
  verified one. Each item cites that event.
- **Clock:** event. **Params:** `leaseMs`.

### `approval_latency_p50`, `approval_latency_p85` — Approval latency (2a)

- **Definition:** for each `gate_opened` and the next `approved` or `rejected`
  on the same attempt, the hours between them minus whole non-working local
  days. Friday 17:00 → Monday 09:00 is 16 hours.
- **Window:** decisions in the last 14 days; minimum sample 5.
- **Exclusions:** runs whose audit log fails verification.
- **Items:** each decision event, with its gate event as `from`.
- **Clock:** event.

### `delta_finished`, `delta_started`, `delta_blocked`, `delta_unblocked`, `delta_added`, `delta_removed`, `delta_dropped`, `delta_slipped`, `delta_pulled_in`, `delta_reopened`, `delta_returned`, `delta_runs_completed`, `delta_runs_failed` — Delta (3)

What moved in a window, one list each:

| Id | Lists |
|---|---|
| `delta_finished` | moves into done (not by a sweep commit), each task once at its latest |
| `delta_started` | cycle starts, including sweep-fallback starts (labelled) |
| `delta_blocked` | moves into blocked |
| `delta_unblocked` | blocked → in progress |
| `delta_added` | tasks created (split moves excluded) |
| `delta_removed` | task files deleted (split moves excluded) |
| `delta_dropped` | moves into done as killed, or done → killed; never in Finished |
| `delta_slipped` | due dates moved later or cleared (metric 16) |
| `delta_pulled_in` | due dates moved earlier |
| `delta_reopened` | done or dropped → open |
| `delta_returned` | WIP → backlog |
| `delta_runs_completed` | `run_completed` events |
| `delta_runs_failed` | `run_failed` events |

- **Window:** with a head cursor (`sinceSha`), the transitions after that
  commit's `seq`, which catches fast-forwarded commits with older dates. When
  the cursor's commit is no longer in first-parent history, the window falls
  back to `at > since` and says so (`window.fallback`). Without a cursor the
  window is time based (`settings.deltaFallback`: the start of the previous
  working day, 24 hours, or 7 days). Run events always use `at > since`.
- **Known limitation:** in a time window, a fast-forwarded commit takes the
  `at` of the commit before it, so it can fall before the window.

### `overdue` — Overdue (4)

- **Definition:** open tasks whose `dueDate` is before the local date today.
- **Order:** priority (urgent, high, medium, low), then days overdue.
- **Clock:** local date. A done or dropped task is never overdue.

### `due_soon` — Due soon (4b)

- **Definition:** open tasks with `today ≤ dueDate < addWorkdays(today, 6)`:
  due on or before the day before the 6th working day after today. Every
  calendar date in that range counts, non-working days included. On Saturday
  3 October the window is 3–11 October; on Monday 5 October it is 5–12 October.
- **Clock:** local date.

### `due_risk`, `due_risk_flagged` — Due-date risk (5)

- **`due_risk`** is a ratio per open task whose due date has not passed
  (returned in `dueRisk`, keyed by task). With `d` the days until the end of
  the due date (local midnight after it):
  - WIP of age `a` (from cycle start): `#{ct : a < ct ≤ a+d} / #{ct : ct > a}`.
    When no finished item took longer than `a`, the value is 0, "older than
    every finished item".
  - Backlog: `#{ct ≤ d} / n`, labelled "if started today".
- **Reference sample:** cycle times of items finished in the 90-day window, of
  the task's type when that type has at least 5, otherwise of the project
  (`params.reference`; `params.referenceTypeSample` gives the type's count).
  `insufficient` when the project has fewer than 5.
- **`due_risk_flagged`** counts due-soon tasks whose risk is below 0.5.
- **Exclusions:** a WIP task whose start is unknown (`na`, with the reason).
- **Clock:** `at`.

### `aging` — Aging WIP (6)

- **Definition:** WIP items (blocked included) whose age, `asOf − cycle start`,
  exceeds the reference P85: their type's if that type has at least 5 finishes
  in the window, otherwise the project's. Above twice the reference an item is
  `critical`. Each item names its reference.
- **Status:** `insufficient` when the project has fewer than 5 finishes in the
  window.
- **Exclusions:** WIP items whose start is unknown.
- **Clock:** `at`.

### `blocked`, `blocked_share` — Blocked (7)

- **`blocked`:** blocked items, oldest blocker first. Blocker age = `asOf −` the
  last move into blocked; `workingDays` subtracts non-working days. The reason
  comes from the first informative source: `blockedReason`, then the latest
  checkpoint line with `kind: "blocked"`, then the Handoff's "Next decision",
  else "No reason given". AGE Aris's default Next-decision text, `{{…}}`
  placeholders, and empty or "nothing" values are skipped. `reasonSource`
  names the source. The trail is the committed one; for a value computed now,
  a newer line in the live trail is used and marked `reasonLive`.
- **`blocked_share`:** blocked item-days / WIP item-days over the last 30 local
  days, sampling each task's state at the end of each day (at `asOf` for
  today). Each item-day is listed. `na` when there was no WIP.
- **Clock:** `at`.

### `done_7d` — Done, last 7 days (8)

- **Definition:** final finishes in the last 7 local days, today included.
- **Exclusions:** dropped items, sweep-only finishes, and finishes withdrawn by
  a reopen, each with its reason.
- **Clock:** `at`.

### `done_4w` — Done, previous 4 weeks (8b)

- **Definition:** final finishes in the 28 local days before the `done_7d`
  window, displayed as a weekly mean: value ÷ 4, or, on a board whose first
  commit falls inside those days, value ÷ the weeks it existed in them, with
  its window starting at that commit. With less than a week of them the
  metric is insufficient and there is no usual week: a board finished nothing
  before it existed, and those days are not slow ones.
- **Clock:** `at`.

### `throughput_series` — Throughput series (8s)

- **Definition:** final finishes per local day for the last 42 days, days with
  none included. A series has no headline value; each point lists its items.
  `params.born` is the local day of the board's first commit: the Flow tab
  draws only the days from it, and only once there are 7.
- **Clock:** `at`.

### `cycle_time_p50`, `cycle_time_p85` — Cycle time (9)

- **Definition:** calendar days from the start of the final cycle to the final
  move into done, for items finished in the 90-day window; minimum sample 5.
- **Exclusions:** "no start" (for example created directly in done), "start
  known only from a sweep commit", "finish known only from a sweep commit",
  "dropped (killed)".
- **Clock:** `at`.

### `lead_time_p50`, `lead_time_p85` — Lead time (10)

- **Definition:** calendar days from creation to the final move into done,
  over the same window. An item created directly in done has lead time 0.
- **Exclusions:** dropped items and sweep-only finishes.
- **Clock:** `at`.

### `wip`, `wip_series` — WIP vs limit (11)

- **`wip`:** tasks in progress or blocked, shown against the project's WIP
  limit (`params.wipLimit`); blocked counts.
- **`wip_series`:** WIP at the end of each local day for the last 42 days.
- **Clock:** `at`.

### `slips`, `repeat_slips` — Slips (16)

- **Definition:** a `dueDate` moved later is a slip (`kind: later`, with slip
  days); a date cleared is a slip (`kind: cleared`); a date moved earlier is a
  pull-in, not a slip; a date set where there was none is neither.
- **`slips`:** slips in the last 30 days. **`repeat_slips`:** tasks with two or
  more of them. Milestone target dates join in Cut 2.
- **Clock:** `at`.

### `load`, `unassigned_wip` — Load per person (17)

- **`load`:** WIP per effective owner. `people` lists each person with their
  WIP against `settings.personalWipLimit` (default 3); the value counts the
  people over it. `agents` lists each agent (a run's agent or an agent-claim
  identity) with its WIP and no limit; agents are never counted as overloaded
  people. Each task names the precedence step that chose its owner. This is
  not a productivity score.
- **`unassigned_wip`:** WIP whose effective owner is Unassigned, with why (no
  owner, or a UI bookkeeping owner line).
- **Clock:** `at`.

### `stale_claims` — Stale agent claims (30)

- **Agent claim:** a WIP task where, at `asOf`, a run on it has started and is
  not finished, its checkpoint trail has any entry (committed or live), or its
  owner line has an `@profile/session` other than `@agesight/web`. Every other
  WIP task is a human claim and gets aging only; it is listed in `excluded`.
- **Excluded:** a task with a run that needs a person (it is a decision).
- **Last sign of life** is the latest of:
  - non-sweep commits touching the task file or its trail, except commits with
    the `AGESight-Via: ui` trailer (edits made in AGE Aris, whoever made them),
    and except commits authored by the workspace operator when the claimant's
    operator is someone else;
  - the `ts` of committed checkpoint lines (for a `ckpt:` commit, the lines'
    own times decide, never the commit time);
  - the latest audit event of runs on the task;
  - the live working-tree trail, only when the value is computed within 60
    seconds of now (entries dated after `asOf` are ignored). The caller reads
    the file; for a past `asOf` this input is "unavailable (past asOf)".
  
  A claim is never staler than its own cycle start.
- **Stale** when `asOf − last sign of life > stale_hours` (from
  `AA/AA.yml`, default 24).
- **Drawer data:** `claims` lists every WIP claim with its type, why it is an
  agent claim, each input with its time, the commits ignored and why, and the
  live-trail state.
- **Clock:** `at`, checkpoint `ts`, and event time.

### `health` — Project health (23)

Each rule returns `green`, `amber`, `red`, `unknown` (applies but cannot be
evaluated), or `na` (does not apply), with the items that fired it.

| Rule | Red | Amber | Unknown / na | Core |
|---|---|---|---|---|
| H2 Overdue | an overdue task with priority high or urgent | any overdue task | — | no |
| H3 Aging | a WIP item older than 2 × its reference | older than its reference | unknown: fewer than 5 finishes in the window and WIP > 0; na: no WIP | yes |
| H4 Blocked | WIP ≥ 2 and blocked ≥ half of WIP | an item blocked for ≥ 2 working days | — | no |
| H5 Stalled / idle | — | WIP and no finish in the last 5 working days ("stalled"), or open work and no start and no finish ("idle with open work") | unknown: the first commit is less than 5 working days old; na: no open work | yes |
| H6 Decisions | — | a decision has waited more than 1 working day | — | no |
| H7 WIP limit | — | WIP over the limit | na: no limit | no |
| H8 Stale claims | — | any stale agent claim | — | no |

"The last 5 working days" starts at the beginning of the 5th working day
before today. H1 (forecast) arrives in Cut 2. Thresholds are constants
(`HEALTH_THRESHOLDS`).

**`combine`:**
1. Any rule red → **red**.
2. Otherwise any rule amber → **amber**.
3. Otherwise any core rule unknown → grey **"Not enough history"**, naming the
   rules.
4. Otherwise no open work and no finish in the 90-day window → grey **"Idle"**,
   or **"No work"** if the project never had a task.
5. Otherwise **green**: every applicable core rule was evaluated and green, and
   there is recent delivery or open work.

## Value contract

Every MetricValue has `id`, `kind` (count, percentile, ratio, series, health;
forecast arrives in Cut 2), `label`, `value`, `unit`, `display`, `status`
(`ok`, `insufficient`, `na`), `reason`, `clock`, `definition`, `formula`,
`window`, `sample: {n, required}`, `params` (always `timezone` and `workdays`),
`inputs: {live}`, `items`, `excluded`, `asOf`, `build`, and `ledgerHeadAtAsOf`.
List endpoints carry the slim form `{id, kind, value, display, status, reason,
sample}`.

| Kind | Invariant (checked by `checkInvariant`) |
|---|---|
| count | `value === items.length`; when not `ok`, `value` is null and there are no items |
| percentile | `sample.n === items.length`; when `ok`, `value` is the nearest rank of the item values at `params.percentile` |
| ratio | `numerator.n` and `denominator.n` equal their item counts; `value = numerator.n / denominator.n`, or `na` (or 0 with a reason, for due risk) when the denominator is 0 |
| series | `value === null`; each point's `n` equals its item count |
| health | `level === combine(rules, context)`, and every red or amber rule lists items |

## Differences from board.sh

`skills/aa-init/template/board.sh` computes flow metrics from the same
files. It is a precedent, not an oracle: AGE Aris differs on purpose here.

| Topic | board.sh (line) | AGE Aris | Why AGE Aris differs |
|---|---|---|---|
| `killed` | Counted as delivered (141) | Dropped: removed from scope, never a finish | A cancelled item is not delivery; counting it inflates throughput and forecasts. |
| Cycle start | The **latest** `claimed` line, "this stint" (140); WIP → backlog → WIP restarts the clock | The **first** WIP entry of the cycle; a return keeps the original start; a reopen starts a new cycle | A manager's cycle time includes time parked and resumed; the latest stint understates it. |
| Sweep commits | Ignored for timing (131, 137) | Ignored; a sweep-only start falls back to the first later non-sweep commit, otherwise the item is excluded; a sweep-only finish is excluded | Same intent; exclusions are listed with reasons. |
| Timestamps | Author time (`%at`, 127) | Committer time, clamped so it never decreases; "since last visit" uses a head cursor | Rebased or merged agent work must appear when it landed. |
| Status detection | Diffs of `status:` lines (`-G'^status:'`) | The directory plus the frontmatter of each full file version | The directory is the state (RULES.md); a move without a `status:` edit is real. |
| Unclaimed tasks in `tasks/` | WIP, by location (93) | Backlog while the status is `open`, `unclaimed`, `backlog`, or empty | Older boards had no `backlog/`; counting unclaimed work as WIP inflates WIP and starts cycle clocks before anyone took the task. |
| Blocked item age | Measured from the move into blocked (275) | Aging from cycle start; blocker age shown separately, from the move into blocked | Aging measures the item's whole time in flight. |
| Aging reference | Per-type P85, else global, with no minimum (280) | Per-`typeKey` P85 when the type has ≥5 finishes, else the project P85; `insufficient` under 5 | Same idea, with a minimum sample. |
| Type normalization | Lowercase, `{…}` → untyped, other characters removed (89–91) | The same (`typeKey`); the stored value is kept as written; untyped items use the project reference | Kept identical on purpose. |
| Owner parsing | Reduced to the operator name (85–88) | The same operator parse, keeping `@profile/session` too | Every AGE Aris repository commits as the workspace operator, so only the profile and session tell agents apart. |
| Who owns a task | The parsed `owner:` operator | `assignee` → the active run's agent ("via run Rxxx") → the agent-claim identity → Unassigned; `@agesight/web` owner lines never make anyone the owner | The UI writes `owner:` for whoever clicks, and so does `startRun`; treating that as ownership would put every task the manager touched under the manager. |
| Staleness: whose commits count | Ignores the **viewer's** commits (`user.name`) unless the claim is the viewer's own (161, 282–288) | Commits with `AGESight-Via: ui` never count, whoever authored them; the workspace operator's commits do not count unless the claimant's operator is the workspace operator | In the default setup the claimant's operator is always the workspace operator, so an author rule alone would let the manager's UI edits keep dead agent claims alive. |
| Staleness: scope | Every WIP claim | Agent claims only; human `@agesight/web` claims get aging only; tasks whose run waits on a person are excluded | Human UI claims are never written to again, so they would always look stale. |
| Staleness: floor | — | A claim is never staler than its own cycle start | An old trail from an earlier cycle must not make a fresh claim stale. |
| Trail source | The **working tree**, `$CK/*.jsonl` (102) | Committed trail lines from git; the live working-tree trail only for a value computed now, labelled not reproducible | Past values must be reproducible; today's value must not miss uncommitted entries. |
| Windows | 30-day throughput by default | 7 days against the previous 4 weeks; percentiles over 90 days, minimum 5 | A daily view against a steadier baseline. |
| Reopened items | Delivered at the latest `done` or `killed` line, still counted after a reopen (139) | Counted once, at the final finish as of `asOf`; an item reopened and still open has no finish (its earlier finish is listed as withdrawn) | Work reopened is not delivered; counting it would also inflate forecasts. |
| Display | Whole units (`3d`, `14h`) | One decimal: hours below a day, days above | Comparing percentiles needs the extra resolution. |
