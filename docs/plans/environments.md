# Environments a task leaves behind

**Status: approved 2026-11-03.** The operator: "I want the task environment
files deleted once it is finished." Closing a task therefore releases its
environment automatically (T111); S4's lists stay as the check that nothing
was missed. T114 releases what the tasks already done left behind.

A task makes things that are not task files: worktrees, branches, scratch
folders, builds, copies of data, background processes. The AA convention
tracks the task and says nothing about these. When the task closes they
stay, and nobody owns them.

## 1. What is there (measured 2026-11-03, read-only)

Every git repository under `~/Code` was scanned. All of the waste is in
AGEIS. The disk is ext4, with 441 GB used of 767 GB.

**AGEIS `scratch/`: 194 GB, which is 44% of everything on the disk.** It is
git-ignored, with one folder per task.

| Held by | Size | Examples |
|---|---|---|
| Tasks already in `done/` | **110.1 GB** | T092 25.1 GB, T112 13.6, T111 13.3, T083 8.0, T076 7.4, T090 7.0 |
| Tasks in progress | 51.0 GB | T113 48.0 GB |
| Nobody: no task id in the name | 31.6 GB | `lock` 13.0, `sp500-years` 8.6, `demo` 6.0, `sp500-early` 1.7 |

**Copies.** Files over 100 MB with the same name and size appear several
times. The extra copies add up to **50.6 GB**. They were not hashed, so they
are likely copies, not proven ones.

- `ageis.db` at 5.24 GB appears 7 times: in T113's `ref/`, `demo`, T121, and
  others.
- `ageis.db` at 0.73 GB appears 28 times. T111 kept four e2e runs, about
  755 MB each, and each holds its own copy of the data set. T112 has `show`
  and `demo-backup` side by side.

**Evidence that lives outside git.** 47 of AGEIS's 109 done task files cite
a path under `scratch/`, for example `scratch/t111/wt-old`,
`scratch/t061/smuggle.py` and `scratch/t123/ledger/`. Because `scratch/` is
ignored, a Result's evidence is one `rm` away from gone. That is also why
nobody dares to delete anything there.

**Worktrees.** AGEIS has 19, and 18 of them are fully landed on `main`:

- 10 subagent worktrees under `.claude/worktrees/` (973 MB). Nine of them
  stayed only because a build folder (`build-t123/`) sits inside. Claude Code
  removes an isolated worktree only when it is unchanged, and an untracked
  build counts as a change.
- 9 session worktrees under `scratch/t123/` and `scratch/t111/`.
  `scratch/t123/integ` alone is 1.4 GB, of which 1.2 GB is a TSan build.
- One is not landed: `worktree-agent-a8fe233b604fa1d1e`, with 14 T123
  commits (`T123 L: …`) that are not on `main` by patch id, although T123 is
  done. Either they were dropped on purpose or they were lost.

**Branches.** AGEIS has 18, and 17 are merged. AGE Aris has a landed subagent
worktree (T023's worker, 4 MB), its branch, and the merged
`feature/agent-pipeline`. The other 14 repositories have no extra worktrees
or branches.

**Processes.** One AGE Aris server is running, started by `/aa`. No stray
Chrome or test processes. Each AGE Aris test and e2e removes its temporary
folders; `/tmp` holds one leftover, a 4 KB token folder.

## 2. Why it happens

1. **The convention has no lifecycle for environments.** The trail records
   acts, not what they leave on disk. Done checks the Result, not the disk.
   `RULES.md`, `AA.yml` and the aa-init template never mention scratch or
   worktrees.
2. **Ignored means unseen.** Git is AA's coordination medium, and `scratch/`
   is outside it. The board, `git status` and AGE Aris cannot see 194 GB.
3. **Evidence and bulk share one folder.** A Result points into the same
   folder as a 25 GB set of per-year data copies. Keeping the evidence
   therefore keeps the bulk.
4. **A copy per run.** Each verify or e2e run copies the data set, and ext4
   has no reflinks, so every copy is a full copy.
5. **Builds inside worktrees.** They defeat the automatic cleanup of subagent
   worktrees.
6. **Folders without an owner.** Names like `lock`, `demo` and `sp500-years`
   belong to no task, so no close ever reaches them.

## 3. The structure

Five pieces. Each follows a rule AA already has: the location is the state;
decide before you spend; the board is generated, not kept by hand.

### S1. Every environment belongs to a task, by its path

- Scratch lives at `scratch/T###/…`, which is the task's own folder.
- A session's worktree lives at `scratch/T###/wt-<name>`.
- Builds go out of tree, at `scratch/T###/build-<name>`, never inside a
  worktree. That lets the automatic cleanup of subagent worktrees work again.
- Data that several tasks read lives once, at `scratch/shared/<name>`, and
  is read in place, never copied per run. A run that must write gets one
  copy, named in its trail.
- Anything else under `scratch/` is **unowned**, and the board says so.

`AA.yml` gains `scratch: scratch` (the root). For a discipline with no
scratch folder, the line is left out.

### S2. Keep or release, decided before the task closes

A task's decision rules gain one line: **what it keeps.** For example,
"keeps: `bench.jsonl` and the script; the builds and the copies of the data
set are released."

- At Done, the kept files are promoted to `AA/evidence/T###/<folder>/` and
  committed. **As built (T111):** what is kept is the task's documentation,
  visuals and metrics (`keep_kinds`), every file its own task file cites,
  and its `keeps:` line. The operator chose this over an explicit list
  alone: "keep only task documentation and visuals and metrics".
- A file over `keep_max_kb`, or one that looks like it holds a secret, is
  copied to the archive outside git (`archive:`), checked by sha256, and
  its size and sha256 are committed in `AA/evidence/T###/RELEASED.tsv`.
  `keep_task_mb` caps what one task commits.
- Everything else of the task's is released: landed worktrees removed,
  merged branches deleted, scratch deleted.

A Result then cites only committed paths, or a hash with a rebuild command.

### S3. A rule in RULES.md: closing releases what the task holds

As built, rule 13 is in `AA/RULES.md`: the release runs when the task
reaches `done/`, by its owner (`ckpt.sh release`, or `close --delete`).
S4 only lists; it never deletes.

### S4. See it: board.sh and AGE Aris

- `board.sh --check` gains warnings. They are advisory and never fail the
  check:
  - a done task still holding `scratch/T###` (with its size);
  - landed worktrees, and merged branches;
  - unowned scratch folders;
  - a done Result citing a git-ignored path.
- `board.sh --litter` prints each warning with the exact command that
  releases it. It deletes nothing itself.
- The board's FLOW lines gain one more line, for example:
  `DISK · scratch 194G: 110G held by 27 done tasks, 32G unowned · 18 landed worktrees`.
- AGE Aris shows the same as a Method check ("environments released") and a
  number on the project page. It reads sizes only. **Since T121 and T122**
  AGE Aris also releases a done task, from its own copy of `ckpt.sh`, on a Done
  taken in it and by a sweep for tasks closed with git. Linked worktrees stay
  for a terminal. The check and the number still only read.

### S5. An optional disk budget

`AA.yml` may set `scratch_gb: 100`. Over the budget, the board says so on
every run, as it does for a WIP breach. It is advisory to begin with
(Q2).

## 4. Phases, as tasks once approved (rule 12)

| Task | What | Where |
|---|---|---|
| **T111** | `board.sh --check` warnings and `board.sh --litter` (S4). Tested on temporary repositories with landed and unlanded worktrees, unowned folders and Results that cite ignored paths. | this repository and the aa-init template |
| **T112** | Rule 13, the "keeps" line in TASK.md's decision rules, and the `scratch:` and `scratch_gb:` keys (S1–S3, S5) | RULES.md, WHY.md, TASK.md, AA.yml, the template |
| **T113** | AGE Aris reads it: the Method check and the disk number, read-only | `lib/`, `public/` |
| **T114** | AGEIS released, from T111's list, in AGEIS's own session (`data-migration` there) | AGEIS |

T111 comes first, because T114 should run from its output, not from a list
written by hand.

## 5. Questions for the operator

- **Q1. AGEIS now.**
  - Recommendation: first promote the 47 Results' cited files to
    `docs/evidence/`, then release the 110 GB held by done tasks and the
    landed worktrees.
  - Keep T123's unlanded branch as a tag, `archive/T123-L`, and remove its
    worktree.
  - Leave the 31.6 GB of unowned folders and T113's 48 GB until their owners
    say otherwise.
- **Q2. The budget.** Recommendation: advisory, never a stop. Disk is cheap
  until the day it is not, and a stop on disk would block unrelated work.
- **Q3. Big evidence.** Recommendation: commit kept files up to 1 MB per task.
  Above that, keep them outside git with their hash and the command that
  rebuilds them, never in `scratch/`.
- **Q4. AGE Aris's own leftovers.** T023's landed worktree and branch, and
  the merged `feature/agent-pipeline`. Recommendation: remove all three now.
  This is the only cleanup in this repository.
