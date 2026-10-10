# `aa.orient/1`: the orient contract

*Normative. Two doors implement it: `AA/board.sh --orient` (bash and jq, in
every AA repository) and `GET /api/orient` (AGE Aris). For every case in
`tests/orient/`, both must give the expected answer byte for byte. The design
and its reasons are in [`plans/agent-brain.md`](plans/agent-brain.md) (v2.4).
Where the two differ, this page is right. The trail format is
[`AA/checkpoints/_SCHEMA.md`](../AA/checkpoints/_SCHEMA.md).*

An agent that starts work asks once, and the answer says:

- what to do next (`next`), with the rule that requires it;
- what binds it (`rules`);
- what it holds (`you`), what is in flight (`inFlight`), and what it may take
  (`take`);
- what is wrong (`warnings`);
- the repository text behind all of that, quoted and capped (`data`);
- where to read further (`more`).

The answer is ranked and has a byte budget. Orient makes no writes, in the
clone or in its `.git`. A call to it is never a sign of life.

## 1. The call

| input | `board.sh --orient` | `GET /api/orient` | when not given |
|---|---|---|---|
| operator | `--operator NAME` | `operator=` | the repository's git `user.name` |
| run | `--run ID` | `run=` | board.sh: the first 8 characters of `CLAUDE_CODE_SESSION_ID`, as `ckpt.sh` takes them. Otherwise none. |
| task | `--task T` | `task=` | none |
| asOf | `--as-of TIME` | `asOf=` | now, to the second |
| budget | `--budget N` | `budget=` | 8192 |
| remote | `--remote` | `remote=1` | off |
| repository | the one it runs in | `project=` | — |

- `task` is `T` and three to six digits.
- `run` is a run id (§3.2).
- `asOf` is `YYYY-MM-DDTHH:MM:SSZ`. It moves the clock only, never the
  repository, and the server refuses a time in the future.
- `budget` is a whole number from 4096 to 65536.
- A malformed input gets no answer. board.sh exits 2; the server answers 400.
- board.sh prints the answer as JSON with `--json`. Without it, board.sh prints
  text (§10).

**The process view** is the reading machine's own: its boot id, and `ps`.
Tests supply both. For board.sh they set `AA_BOOT_ID` and put a `ps` first on
`PATH`. For the server they inject a view.

## 2. What is read

**The board** is found in the working tree, as AGE Aris finds it
(`findBoard`). It is the first of `AA/`, `deaddrop/` and `pm/` at the top that
is a directory holding a `tasks/` directory, neither a symbolic link, and that
is in use: its `STATE.md` or settings file is a regular file, or one of its
`tasks/`, `backlog/` and `tasks/done/` holds a task file. Failing that, it is
the first that holds a `tasks/` directory. Without one there is no answer:
board.sh exits 2, and the server answers 404. `<board>` below is that folder's
name.

**From HEAD.** A claim is a commit (rule 1), so what is uncommitted does not
count yet:

- the task files in `<board>/backlog/`, `<board>/tasks/` and
  `<board>/tasks/done/`, each named `<id>-<anything>.md` (§3.1). A task file
  over 1 MiB is read as empty;
- whether any file is under `<board>/backlog/`, and whether the settings file
  exists, for the layout (§3.1);
- the history reachable from HEAD, for signs of life (§3.6) and authors (§6);
- the upstream's tree, for `claim-unpushed` (§5), when the branch has an
  upstream.

**From the working tree**, on every call:

- the trails, `<board>/checkpoints/<id>.jsonl`. A trail over 1 MiB is read
  from its last 1 MiB, less that part's first line, whole or not
  (`trail-truncated`);
- the settings file: `<board>/AA.yml`, or `<board>/deaddrop.yml` in
  `deaddrop/` and `pm/`. One over 64 KiB is not read, and the defaults apply;
- `<board>/STATE.md`. One over 1 MiB is not read;
- the Handoff of each task the caller holds (§6);
- which task files differ from HEAD (`uncommitted-task-change`).

**From the machine:** the process view (§3.3). With `remote` only, it also
runs `git ls-remote` against the upstream.

**Never** read:

- a task body beyond its frontmatter, its Decision-rules section and its
  Handoff;
- a trail, settings file or `STATE.md` that is not a regular file;
- anything through a symbolic link.

**Never** written: anything. git runs with `--no-optional-locks`, so not even
an index refresh is written.

## 3. Definitions

### 3.1 Task files

- **Ids.** A task id is `T` and three to six digits. Ids sort by their
  number, then as text, so `T999` comes before `T1000`.
- **The id** of a task file is the id that starts its name, followed by `-`.
  When two files have the same id, it is a `duplicate-id`: that id is in no
  column, and every row skips it.
- **Columns.** A task file in:
  - `backlog/` is *backlog*;
  - `tasks/` is *in progress*, or *blocked* when its status is `blocked`;
  - `tasks/done/` is *done*, or *killed* when its status is `killed`.
- **Layout.** A board with no file under `backlog/` and no settings file at
  HEAD has the *older layout*, as AGEIS's does: it keeps unclaimed work in
  `tasks/`. There, a task in `tasks/` whose status is `open`, `unclaimed`,
  `backlog` or none is *backlog*. A new board with an empty backlog has its
  settings file, so it does not read as older.
- **Lines.** A task file is read as lines split at line feeds, and a
  carriage return at a line's end is dropped.
- **Frontmatter.** The first line is `---`, and the frontmatter runs to the
  next line that is `---`. A line `key: value` sets that key, and if a key
  appears twice the later line wins. The value is trimmed. If it starts and ends with `"`, it is read as a
  JSON string if it is one; otherwise the two quotes are removed. A file with
  no frontmatter sets no key.
- **`status`.** Lower-cased. `in progress`, `in_progress` or `in-progress` at
  its start is `in_progress`. Otherwise it is the value's first run of
  letters, so `open — registered, not queued` is `open`.
- **`owner`.** It has the form `<operator> @<profile>/<session> <date> — <note>`.
  - A value that is empty or `none`, or starts with `—`, or is one or more
    `-` alone or before a space, means no owner (`parseOwner`).
  - The operator is the text before the first ` @`, ` —`, ` --` or
    ` YYYY-MM-DD`, trimmed.
  - The session is what follows the first `@<profile>/` that starts the value
    or follows whitespace, up to whitespace.
- **`title`.** The frontmatter's. Without one, it is the file name between
  the id's `-` and `.md`, with each `-` read as a space.
- **`priority`.** `urgent`, `high`, `medium` or `low`, lower-cased. Any other
  value is none.
- **`depends`.** The ids in the value, each a whole word, without repeats or
  the task's own id: the first 20, as AGE Aris reads them.
- **Ready** follows `board.sh`'s Definition of Ready. The body must have a
  `## ` heading whose text contains `decision rule`, in any case. Under it,
  before the next `## ` heading, at least one line must count. Trimmed, a line
  counts unless it is:
  - empty;
  - inside a `{{…}}` placeholder. A placeholder that opens on a line without
    closing runs to the line that closes it. One that opens and closes on the
    same line is removed from that line;
  - template guidance. A line starting with `*(` opens guidance, which runs to
    the first line that ends in `*`, that line included.

  Placeholder and guidance state starts fresh in each file.

### 3.2 Trails

- **An entry** is a line that is a JSON object with all three of:
  - `ts`: a time `YYYY-MM-DDTHH:MM:SSZ` that reads back the same. A time
    such as `2026-02-30T00:00:00Z` does not;
  - `run`: a run id;
  - `kind`: one of `open`, `did`, `doing`, `blocked` and `end`.

  Every other non-blank line is **malformed** (`trail-malformed`). That
  includes a line with an unpaired surrogate escape such as `\ud800`.
- **A run id** is one to three parts joined by `.`. Each part is 1 to 12
  characters from `0-9`, `A-Z`, `a-z`, `_` and `-`. `ckpt.sh` makes
  `e857a8c8` and `e857a8c8.a4f2`.
- **A run** is the entries of one run id **within one trail**. Its **newest
  entry** is its last line in the file.
- **`until`** counts only on a `doing`, and only when it reads back the same
  as `ts` must. It is counted at most `stale_hours` past that line's `ts`.
- **A process record** is an entry's `boot` (a non-empty string), `pid` (a
  whole number above 0) and `pstart` (a non-empty string), all three together.
  A run's process is the one named by its newest entry that has a process
  record.
- **The trail's newest `next`** is the `next` of its last entry that has a
  non-empty string `next`. Its **newest `left`** is the `left` of its last
  `end` that has a non-empty string `left`. Both are taken across every run in
  the trail.

### 3.3 Running or closed

Every run is **running** or **closed**. The first rule that applies decides,
and the answer names it as `by`. These are the four rules of `_SCHEMA.md`,
evaluated at `asOf`:

1. **`end`.** Its newest entry is an `end`: closed.
2. **`until`.** Its newest entry is a `doing` whose `until` is after `asOf`:
   running.
3. **`process`.** Its process record's `boot` is this machine's boot id. It is
   running if `ps` shows a process with that `pid` that started at `pstart`,
   and closed if not. The start is compared after running
   `TZ=UTC LC_ALL=C ps -o lstart= -p <pid>`, with runs of whitespace collapsed
   to one space and the ends trimmed.
4. **`clock`.** Otherwise it is running if `asOf − ts ≤ live_minutes × 60 s`
   for its newest entry, and closed if not.

A closed run whose newest entry is a `doing` has **stopped mid-act**.

### 3.4 The caller

- **The caller holds T** when T is in progress or blocked and its owner's
  operator is exactly the caller's `operator`.
- **The caller's family** is every run whose root is the caller's root. A
  root is a run id up to its first `.`. With no `run`, the family is empty.
- **T is held by another run** when a run on T outside the caller's family is
  running. The **holder** is the one of those whose newest entry comes latest
  in the file.

### 3.5 Policy

- **The settings file** is read as `ckpt.sh` and `board.sh` read it, line by
  line:
  - A line that starts with `<key>:` sets that key. The first such line wins.
    Its value is the rest of the line, with everything from its first `#`
    removed, trimmed.
  - `wip:` and `spend:` open a block, which runs until a line that starts
    with neither whitespace nor `#`.
  - In `wip:`, a line whose first word is `in_progress:` or `blocked:` sets
    that key, and the first such line wins.
  - In `spend:`, a line that starts with `- `, after any indent, is an item.
- `stale_hours` is a whole number from 1 to 8760, and `live_minutes` one from
  1 to 525600, read as decimal. Any other value takes the default: 24 and 30.
- When `live_minutes` is at least `stale_hours × 60`, it becomes
  `stale_hours × 60 − 1` (`live-minutes-clamped`).
- `wip.in_progress` and `wip.blocked` are the whole numbers 0 to 9999 under
  `wip:`. Any other value, a `{{…}}` placeholder included, is 0.
- **WIP** `used` is the number of tasks in progress plus the number blocked,
  as the server and `board.sh` count it. `limit` is `wip.in_progress`. A limit
  of 0 is no limit (`no-wip-limit`).
- **`spend`** is the items of `spend:`, each with everything from its first
  `#` removed, trimmed. Empty items are skipped.

### 3.6 Expired

A claim is **expired** (rule 4) when:

- T is in progress or blocked;
- its owner's operator is not the caller's;
- and it has had no sign of life within `stale_hours` of `asOf`.

Any one of these is a sign of life:

- a running run on T;
- an entry on T's trail, written by anyone;
- a commit reachable from HEAD that touches a file of T under `tasks/`,
  `tasks/done/`, `backlog/` or `checkpoints/`, if its author is not the
  caller's operator and its subject starts with neither `ckpt:` nor `migrate:`.
  It counts at its author time.

Its **last sign of life** is the latest of these. A running run makes the claim
live whatever the clock says.

### 3.7 Claimable

- A backlog task is **claimable** when all three hold:
  - it is ready;
  - every id in its `depends` is done, and none is killed or missing;
  - it is not held by another run.
- **`unblocks`** counts the tasks in backlog, in progress or blocked whose
  `depends` names it.
- **Rank:** priority first (`urgent`, `high`, `medium`, `low`, then none), then
  the most `unblocks`, then the id.

## 4. `next`

The rows are tried in order. Within a row, the tasks the caller holds are
tried in id order. The first match wins.

| # | When | `next` | `reasons` | `rule` |
|---|---|---|---|---|
| 0 | `task` is given | below | below | 7 |
| 1 | the caller holds T, T is not held by another run, and a run on T stopped mid-act | `resume` T, naming that run, `verify: "tell"`. With several, the one whose newest entry comes latest in the file | `stopped-mid-act` | 3, 6, 8 |
| 2 | the caller holds T, T is not held by another run, and T is blocked or its trail's newest entry is a `blocked` | `check-unblock` T | `blocked` | 8 |
| 3 | the caller holds T, T is in progress and not held by another run, and on the server T waits on no gate | `continue` T | `in-progress`, and also `rewrite-owner` when `run` is given and its root is not exactly the owner line's session | 3, 8 |
| 4 | server only: the caller holds T, and T waits on an operator decision gate | `wait` T | `gate` | none |
| 5 | the caller holds T, and T is held by another run | `wait` T, naming the holder | `held-elsewhere` | 3, 6 |
| 6 | a claim is expired | `release` T: the claim with the oldest last sign of life (one with none first), then by id | `expired` | 4 |
| 7 | `limit` > 0 and `used` ≥ `limit` | `stop` | `wip-full` | 10 |
| 8 | a task is claimable | `claim` the first by rank | `ready` | 1, 5, 12 |
| 9 | none of the above | `idle` | `empty-backlog` when the backlog is empty, else `none-ready` | none |

**Row 0** is for a caller bound to T, such as a subagent with its brief
(rule 7):

- T is not held by the caller: `stop`, `not-yours`;
- T is held by another run: `stop`, `held-elsewhere`, naming the holder;
- the caller's own run on T, its exact id, stopped mid-act: `resume` T,
  `stopped-mid-act`, `verify: "tell"`;
- otherwise: `continue` T, `bound`.

**What each `do` asks of the agent:**

- **`resume`.** Check that act's `tell` first, because an act can outlive its
  session. If the act is still running, keep off. If it has stopped, append the
  reaping `end` for that run (`<board>/ckpt.sh log T end --run <run> …`, rule
  2's exception), then act. If you cannot tell, stop and ask.
- **`check-unblock`.** See whether what blocks T has cleared
  (`data.<T>.blocked`).
- **`continue`.** Go on with T from the trail's newest `next`, else from the
  Handoff. The newest trail entry wins (rule 8). With `rewrite-owner`, first
  rewrite the owner line to your own profile and session (rule 3).
- **`wait`.** Start nothing else. Either another session is working on T, or a
  gate waits on the operator. Ask the operator, or orient again after
  `until`.
- **`release`.** Read T's trail, then release the claim or take it over
  (rule 4).
- **`stop`.** Under row 7, WIP is full: finish or release something (rule 10).
  Under row 0, report to whoever bound you.
- **`claim`.** Claim T, which is a commit (rule 1). If the commit conflicts,
  someone else has it.
- **`idle`.** There is nothing to do here.

`next` is advice, and git is the lock.

## 5. Warnings

| code | fields | when |
|---|---|---|
| `older-board` | — | the board is `deaddrop/` or `pm/`, or has the older layout (§3.1) |
| `no-wip-limit` | — | `limit` is 0 |
| `live-minutes-clamped` | — | `live_minutes` was clamped (§3.5) |
| `state-stale` | — | `STATE.md` shows different tasks in progress or blocked from HEAD (below) |
| `claim-expired` | `task` | a claim is expired, and `next` does not name it |
| `claim-unpushed` | `task` | the caller holds T at HEAD but not at the upstream |
| `depends-killed` | `task`, `on` | a backlog task depends on a killed one |
| `duplicate-id` | `task` | two task files have this id |
| `uncommitted-task-change` | `task` | in the working tree, T's file is added, removed, moved, or has frontmatter that differs from HEAD. A change to its body alone does not count. |
| `trail-malformed` | `task`, `line`, `n` | T's trail has `n` malformed lines in what is read, the first at `line`, counted from the start of the file, a truncated one's too |
| `trail-unreadable` | `task` | T's trail is not a regular file, and is read as empty |
| `trail-truncated` | `task` | T's trail is over 1 MiB |

Warnings come in the order of the table, then by `task`, then by `on`. At most
10 are shown, and the rest are counted in `cut.warnings`.

**`state-stale`.** The generated region of `<board>/STATE.md` lies between
`<!-- <board>:generated -->` and `<!-- /<board>:generated -->`.

- In that region, a line that starts with `|` is a table row. Its cells are
  the text between its `|`s, trimmed.
- A row whose first cell starts with `**` opens a column, named by the text
  between its first two `**`. A row whose first cell is empty stays in the
  column before it. Any other row is in no column.
- A row in a column puts its second cell in that column, when that cell is a
  task id.

The (column, id) pairs under `IN PROGRESS` and `BLOCKED` must equal HEAD's.
Without the region there is no check.

## 6. The answer

Keys come in this order. Every key is always present, except `remote` (only
with `remote`) and `cut` (only when something was cut):

`schema`, `asOf`, `repo`, `remote`, `next`, `rules`, `you`, `inFlight`,
`take`, `warnings`, `data`, `more`, `cut`.

**Structured** means everything outside `data`. It holds ids, enums, whole
numbers, times and fixed paths, and never a byte of repository text.

| key | value |
|---|---|
| `schema` | `"aa.orient/1"` |
| `asOf` | the clock, to the second |
| `repo` | `{head, board, door}`. `head` is HEAD's 40-hex commit id, or null before the first commit. `board` is `"AA/"`, `"deaddrop/"` or `"pm/"`. `door` is `"board.sh"` or `"server"`. |
| `remote` | `{moved, checkedAt}`. `moved` is `"yes"` when `git ls-remote` gives the upstream branch another commit than the remote-tracking branch names, `"no"` when the same, and `"unknown"` with no upstream or when ls-remote fails. `checkedAt` is `asOf`. Someone may have claimed since you fetched. |
| `next` | `do`, then whichever of `task`, `run`, `by`, `since`, `until` and `verify` apply, then `reasons` and `rule` (both always; `rule` is `[]` where the table says none) |
| `rules` | `{wip: {used, limit, blocked, blockedLimit}, staleHours, liveMinutes, notReady}`. `liveMinutes` is after the clamp. `notReady` lists the backlog ids that are not ready, by id, at most 20. |
| `you` | the tasks the caller holds, by id, at most 10, each `{task, column, heldBy}`. `column` is `"in_progress"` or `"blocked"`. `heldBy` is the holder's run, and is present only when T is held by another run. |
| `inFlight` | every run whose newest entry is a `doing`, and every running run outside the caller's family, at most 10. Each is `{task, run, kind, since, state, by, until}`: `kind` is its newest entry's, `since` its time, `state` is `"running"` or `"closed"`, and `until` is present only when known. Running runs come first, then by task, then by run. |
| `take` | the claimable tasks by rank, at most 10, each `{task, priority, unblocks}`. `priority` is left out when there is none. |
| `warnings` | §5 |
| `more` | `{trail, task, board}`. `trail` is `<board>/ckpt.sh live T`, only when `next` names a task. `task` is `<board>/<folder>/T-*.md`, where `<folder>` is T's folder, only when `next` names a task that has one file at HEAD. `board` is `<board>/board.sh`. These are the convention's paths, and an older board may not have the scripts. |
| `cut` | for each list that lost entries, to a count cap or to the budget, how many it lost. The keys, in order, are `inFlight`, `warnings`, `notReady`, `you`, `take`, `spend` and `data`. A key appears only when its count is above 0. |

**In `next`:**

- `run`: under `resume`, the run that stopped. Under `wait` and row 0's
  `stop`, the holder.
- `by`: how that run's state was decided (§3.3).
- `since`: that run's newest entry's time. Under `release`, the last sign of
  life, left out when there is none. Under row 4's `wait`, when the gate began
  to wait.
- `until`: for a holder running `by: "until"`, its `until`. `by: "clock"`, its
  newest entry's time plus `live_minutes`. `by: "process"`, nothing: it runs
  until the process ends.
- `verify`: `"tell"`, under `resume`.

`inFlight`'s `until` follows the same rule.

**`data`** is repository text, quoted. Every value is cleaned (§7) and capped:

| key | value | cap |
|---|---|---|
| `repo` | `{name}`: the name of the repository's top-level directory | 80 B |
| `spend` | the `spend` words, at most 10. Left out when there are none | 40 B each |
| a task id | one entry each, for `next`'s task, then `you`'s, then `take`'s, in their order, without repeats | below |
| `now` | `{text, file}`: the NOW block of `<board>/STATE.md`, between `<!-- <board>:now -->` and `<!-- /<board>:now -->`, and that file's path. Left out when there is no block, or it is empty | 1024 B |

A task's entry has these keys, in this order. Keys that are empty or do not
apply are left out:

| key | value | cap |
|---|---|---|
| `title` | its title | 160 B |
| `file` | its path at HEAD | 200 B |
| `author` | the author of the newest commit that touched that path, as `git log -1 --format=%an HEAD -- <path>` gives it | 80 B |
| `next` | the trail's newest `next` | 240 B |
| `act`, `tell` | for `next`'s task when `next.run` names a run whose newest entry is a `doing`: that entry's `act`, or its `what` when `act` is not a non-empty string, and its `tell` | 240 B each |
| `left` | the trail's newest `left` | 240 B |
| `blocked` | under `check-unblock`: the trail's newest entry's `unblocks` when that entry is a `blocked` with a non-empty string `unblocks`, else the task's `blockedReason` | 240 B |
| `handoff` | for `next`'s task, when the caller holds it: in its file in the working tree, at its path at HEAD, the lines that start with `- ` in the section whose `## ` heading starts with `## Handoff`, each without its `- `, joined by a space | 480 B |

The entries for `you`'s and `take`'s other tasks carry only `title`, `file`,
`author` and `next`.

A harness that shows `data` to a model says it is quoted from repository
files.

## 7. Serialization

Repository text is cleaned in this order:

1. **Decode** as UTF-8. Each invalid sequence becomes U+FFFD, one for each
   maximal subpart. This is the WHATWG decoder, which Node uses. jq writes a
   single U+FFFD for a whole sequence that is overlong, encodes a surrogate,
   or encodes a value above U+10FFFF. Such text is outside the corpus, and the
   doors may differ on it.
2. **Spaces.** U+0009 to U+000D, U+0085, U+2028 and U+2029 become a space.
3. **Removed:** the other C0 controls, U+007F, the C1 controls, and the bidi
   controls U+061C, U+200E, U+200F, U+202A to U+202E and U+2066 to U+2069.
4. **Collapsed.** Runs of spaces become one space. Leading and trailing spaces
   are removed.
5. **Capped.** A value longer than its cap is cut at a code-point boundary to
   at most the cap minus 3 bytes. Trailing spaces are removed, and `…`
   (U+2026) is appended.

The JSON is compact. Its keys come in the order of §6. Only `"` and `\` are
escaped, and every other character is written as UTF-8. Numbers are whole
numbers. Times are `YYYY-MM-DDTHH:MM:SSZ`. The document has no trailing
newline, and a door prints one after it.

## 8. The budget

- The budget counts the bytes of the JSON document, measured as if
  `repo.door` were `"board.sh"` and `remote.moved` were `"unknown"`, the
  longest value of each. So both doors cut the same entries.
- Count caps come first (§5, §6).
- While the answer is over budget, entries are removed one at a time, and the
  answer is measured again, `cut` included, after each removal:
  1. the last key of `data`, until `data` is empty;
  2. then the last entry of `take`;
  3. then the last entry of `you`.
- Nothing else is ever cut: `schema`, `asOf`, `repo`, `remote`, `next`,
  `rules`, `inFlight`, `warnings`, `more` and `cut`. With ids of six digits,
  run ids at their longest, and counts and line numbers of seven digits, that
  part is under 4096 bytes. That is why the budget's minimum is 4096. The
  corpus test computes that bound, and the case `budget-worst-case` builds a
  board near it.
- An answer still over budget with nothing left to cut is given whole.
- `next` is computed before anything is cut.

## 9. Versioning

- Adding a key keeps the schema `aa.orient/1`.
- Removing or renaming a key, or changing what a value means, makes it
  `aa.orient/2`. Each door states which it emits, in `schema`.
- The consumers are the `aa` skill, AGENTS.md and AGE Aris's Home.

## 10. Text

Without `--json`, `board.sh --orient` prints the same answer for a reader.
`next` comes first, as one sentence with its reasons and rule numbers. Then
come what you hold, what is in flight, what you may take, and the warnings.
`data` is marked as quoted. Text output is not budgeted, and the corpus does
not test it.

## 11. The corpus

`tests/orient/` holds the cases. `corpus.mjs` builds them, and the files in
`cases/` hold them. Each case has:

- `name`, `rows` (the rows of §4 it tests) and `story`;
- `serverOnly`, for gates (row 4);
- the repository: commits on a base board, made with `lib/fabricate.mjs`, and
  then changes to the working tree;
- the process view: the reader's boot id, and which processes are alive.
  A server-only case also names the tasks that wait on a gate, and since
  when;
- `call`: the inputs of §1;
- `answer`: the expected answer, which the test writes out per §7 to get the
  expected bytes.

The runner fills `repo.head` from the repository it built, and `repo.door`
with its own door. It compares everything else, byte for byte.

`tests/orient.test.mjs` checks the corpus itself:

- every case builds;
- every answer fits its budget, with its keys in order;
- no structured field carries repository text;
- every row has a case, and every fixture named below is one.

P1b and P1c add the runners for the two doors. P1e compares the doors with
each other. The doors' own tests add what a corpus cannot hold (design §8):
fuzzing that no repository text reaches a structured field, and, on the
server, the cache keys.

Fixtures by row:

- **0:** `bound-subagent`, `bound-subagent-parent-doing`,
  `bound-subagent-other-session`, `bound-subagent-resumed`, `bound-not-yours`
- **1:** `dead-doing`, `crashed-a-minute-ago`, `dead-doing-clock`,
  `doing-past-until`, `older-run-dead-doing`, `own-run-resumed`,
  `pid-reused`
- **2:** `dead-blocked`, `blocked-no-trail`
- **3:** `held-continue`, `trail-beats-handoff`, `idle-own-claim`,
  `parent-with-live-child`, `sibling-subagents`, `rewrite-owner-session-only`,
  `after-reap-continues`, `handoff-from-worktree`
- **4:** `gate-waiting` (server only)
- **5:** `held-by-open-session`, `held-by-quiet-session`,
  `held-running-silent`, `held-resumed-session`, `held-other-machine`
- **6:** `expired-under-limit`, `wip-full-expired`,
  `expired-commit-by-reader-ignored`, `expired-sweep-ignored`
- **7:** `wip-at-limit`, `wip-one-blocked`, `wip-over`
- **8:** `claim-best`, `skip-unready`, `skip-unmet-depends`,
  `skip-killed-depends`, `skip-held-backlog`, `claim-on-other-branch`,
  `uncommitted-claim`, `no-wip-limit`
- **9:** `idle-empty-backlog`, `idle-none-ready`, `trail-entry-keeps-claim`,
  `running-run-keeps-claim`
- **Across rows:** `expired-while-holding`, `injected-text`, `multibyte-caps`,
  `multibyte-caps-unblock`, `invalid-utf8`, `trail-malformed`, `trail-unreadable`, `trail-truncated`,
  `older-board`, `deaddrop-board`, `duplicate-id`, `claim-unpushed`,
  `state-stale`, `live-minutes-clamped`, `uncommitted-many`, `budget-cuts`,
  `budget-worst-case`, `remote-moved`

## 12. Settled here, for the doors to follow

- **The sweeps are `ckpt:` and `migrate:`**, at the start of a subject (design
  §11 N3). Two places drift from this, and P1b and P1c remove the drift:
  - `_lastSignInGit` (`lib/workspace.mjs`) tests a trailer instead;
  - `board.sh` requires a space after the colon.
- **Rule 4 says commits by anyone but you, and the trail from anyone.**
  `board.sh`'s ⊘ legend says "from anyone but the owner".
- **WIP is in progress plus blocked.** `board.sh:331` counts only in progress
  against the limit in its IN PROGRESS header, while `:257` and `:350` count
  in progress plus blocked.
- **A board's placeholder and guidance state starts fresh in each file.**
  `board.sh`'s awk carries it from one file to the next.
- **The server's live run is `readTrail.live`:** a run that has not ended and
  wrote within `stale_hours`. Orient's is *running* (§3.3). T071 brings the
  server to the same reading.
