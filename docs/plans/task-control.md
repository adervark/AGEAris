# Task control: one-click task actions, on AGE Aris projects and tracked AA boards

**Status: pending approval** (v3.1)
v1 drafted 2026-10-07 by the Planner (ralplan consensus, DELIBERATE mode) from
`feature/pm-cockpit` at f7c3540. v2 answered the first reviews: the write is
made under git's index lock, a branch is pinned, the older AA layout is
supported, Priority and Assign follow one rule, and the scope is trimmed. v3
answers the second reviews (Architect: sound, R1–R6 required; Critic: one
blocker).

## Changes since v3

The Critic approved v3; the Architect called it sound, with three small required changes, which v3.1 makes.

1. **Recovery adopts its own stale lock** when the inode and nonce match the marker, and it rebuilds *N* from the current `.git/index` under that lock (§3).
2. **Timed-out git calls get SIGTERM, then SIGKILL** after a grace period. Afterwards `refs/heads/<b>.lock` is checked, and if found it is reported as interrupted with its path (§3).
3. **`RUN_LIVE` names the reap command** for a session that is gone. One line now says that it reads only the trail, and that the confirmation shows the last commit (§4).
4. **Opt-in probes that `link()` works** in the task folder. The README note on the agent side mentions the brief `index.lock` error. The T023 dry run prints 24 lines, not 23 (§1 C, T023).

## Changes since v2

1. **Live and dead runs (Critic blocker, Architect R6).**
   - Opens and ends are paired by run id.
   - A run is *live* if it has not ended and its newest entry is within
     `stale_hours` (24 h when there is no `AA.yml`). A live run refuses
     **every** action on the task (`RUN_LIVE`).
   - A dead run, or a malformed line, needs a confirmation that names it. The
     action then proceeds with a `RUN_NOT_ENDED` warning whose remedy is the
     reap command, `AA/ckpt.sh log T### end --run <ID>`.
   - §4, Q3 and the tests now agree. (§4)
2. **Crash safety (Architect R1–R5, Critic note 4).**
   - The lock is taken *before* the marker is written. The lock holds a nonce.
   - The marker is rewritten with H, C, B and the paths before `update-ref`.
   - A stolen lock is detected (fstat/lstat and the nonce) before the index is
     installed.
   - One **settle rule**, keyed on the ref's value, handles every failure after
     the CAS and is also what recovery runs. Recovery is idempotent.
   - Under the lock, git calls time out after 2 s, with a 3 s budget for the
     whole hold.
   - The repository probe runs before every action.
   - Also adopted from the optional items: on a move, `<from>` is first renamed
     to a temporary name, re-hashed, and the new file is created exclusively.
     (§3)
3. **Honest residual windows** are listed in pre-mortem 1. (§7)
4. **T023's string list and check:**
   - `app.js:787`, `:856` and `:1898`, `DESIGN.md:23-24` and `:75`, and
     `README.md:71`, `:133` and `:149` are added.
   - `:856` is reworded, not deleted: adding tasks on tracked boards stays
     unavailable.
   - The check normalises line breaks and names the lines expected to remain.
5. **T025 tracks STATE.md per task** on hand-kept boards. On `board.sh` boards
   it counts from the last regeneration. (§5)
6. **Consequences:** refusals are recorded only on stderr until the writes log
   follow-up lands.
7. **Citation fixes:** AGEIS `STATE.md:298` is now `:302`;
   `workspace.mjs:1145-1160` is now `:1148-1160`.
8. **Optional items adopted:**
   - The own-agent confirmation shows the session's last sign of life.
   - README links the trail-retirement deviation from AGEIS's Done.
   - A5 stays in the ADR as the fallback.

## The request

"I think the interactability is not well structured and has room for
improvement." Clarified with the user:

1. Scope: **both, UX-led.** Fix what the operator feels, and restructure the
   interaction code only as far as that needs.
2. Main pain: **acting on tasks**: "I want to control, schedule the tasks."
3. "Schedule" means **quick task actions**: claim, move, block, prioritise or
   assign in one click, without the full edit form. **Out of scope:** dates,
   calendar, queue ranking, timed agent runs.
4. Tracked boards: **lift the rule.** AGE Aris may edit task files in a tracked
   repository, committing as the operator. This changes a hard constraint, so
   the plan treats it as **high-risk**.

## The boards it must work on (verified 2026-10-07)

| Repository | Board layout | Checked-out branch | Notes |
|---|---|---|---|
| AGE Aris (this one; tracked) | AA with `backlog/`, `AA.yml`, `board.sh` | `feature/pm-cockpit` | STATE.md generated |
| Gem4A | AA with `backlog/`, `AA.yml`, `board.sh` | `master` | STATE.md generated |
| AGEIS (tracked) | **AA, no `backlog/`**, `WORKFLOW.md`, no `AA.yml` | `deaddrop-migration` | STATE.md **kept by hand** (WORKFLOW.md:16). One linked worktree (`scratch/t068/wt-p0a`). All 6 open tasks are `status: claimed` by `adervark @k/…` agent sessions. |
| AGEION | AA, no `backlog/`, `WORKFLOW.md` | `deaddrop-migration` | as AGEIS |
| RSNA | AA, no `backlog/`, `WORKFLOW.md` | `labels-teacher-correction-t031` | as AGEIS |

What this means for the plan:

- The older layout has to be supported, or most of the work does not benefit.
- Feature branches are normal, which is why a branch is pinned.
- Most open tasks are held by the operator's **own** agent sessions, so acting
  on them under rule 3 is in scope (§4).
- Unended checkpoint runs are common and mostly dead: nine open RSNA tasks have
  runs opened 14–29 Sep that never ended, and Gem4A T001 and T006 have runs
  from 5 Oct. A rule that treated every unended run as live would refuse those
  tasks forever. (§4)

## What is there today (verified)

| Where | What |
|---|---|
| `lib/workspace.mjs:552` `readOnly()`, `:711-716` `_writable()` | Every task or project write to a tracked repository is a 409. |
| `lib/workspace.mjs:1225` `_commit`, `:1242` `_assertOwnRepository` | Commits are made with `git add -A` and `commit --only`, and only inside the data folder. |
| `lib/workspace.mjs:1137-1222` `updateTask` | Optimistic concurrency through `version`. Renames the file to a new slug (`:1198`). Re-renders STATE.md (`:1259`). |
| `lib/workspace.mjs:55-74` `gitEnv` / `git()` | Overrides are applied *after* the dropped variables, so any variable gets through. stdin is `'ignore'`. There is no timeout. |
| `lib/workspace.mjs:30` `GIT_HARDENING` | Hooks and fsmonitor are off. Signing and filters are not. |
| `lib/workspace.mjs:326-331` `taskState`, `:693` | The older layout is read: an `open` task in `tasks/` counts as backlog when there is no `backlog/`. |
| `lib/workspace.mjs:1008-1009` | Tracking a partial clone is refused. Turning actions on adds its own refusals next to this one. |
| `lib/workspace.mjs:241` `blockedReasonOf` | Already reads checkpoint trails line by line. |
| `lib/history.mjs:34`, `:82-88`; `lib/metrics.mjs:685` | The ledger reads `AGESight-Via` on HEAD's branch. A blocked → in_progress change counts as an unblock. |
| `server.mjs:37`, `:248-255` | `POST` and `PATCH` `/api/tasks`, with `VIA_UI`. |
| `public/app.js:853` `openTaskEditor`, `:900` `openTaskViewer` | A native task's drawer is one form behind "Save changes". A tracked task's drawer is read-only. |
| `public/app.js:1895`, `:1992-2023` | Columns change by drag only. A tracked task is refused. |
| `public/app.js:1929`, `:2026`, `:2070` | One 30-case switch. A separate drawer listener that closes and reopens the drawer. Only three keys, and none while a dialog is open. |
| `public/app.js:502` | A card is a single `<button>`. |
| `AA/RULES.md` 1-4, 6, 10, 11; `skills/aa-init/template/commands/reclaim.md` | Claim, continue and release subjects, the owner line, the WIP stop, the generated STATE.md. |
| `AA/board.sh:122-147`, `:140`, `:163`, `:349`, `:419-446` | History comes from `status:` changes. The *latest* `claimed` change starts a stint. There is an in-progress limit and a blocked limit (the blocked one only adds a note). `--check` compares column, id, title and owner. |
| `~/Code/AGEIS/AA/WORKFLOW.md:276-293` | Older-layout lifecycle: claim in place, then update the task's line in STATE.md. Done = Result + `ckpt.sh close --delete` + move to `done/` + STATE.md line. |

---

## 1. RALPLAN-DR summary

### Principles

1. **The protocol is the product.** On an AA board a quick action does what
   the board's rules say a person or agent does: the same moves, fields,
   subjects and refusals. AGE Aris invents no fields and no dialect.
2. **Never lose or misattribute someone else's work.** A dirty file, a
   concurrent commit, a live run or another operator's claim is a reason to
   refuse.
3. **A named outcome, never a half-write.** An action either commits, with
   the ref, index and working tree in agreement, or changes nothing a person
   can see. Only on the narrow paths named in §3 does it instead report itself
   *interrupted*, with the commit and what to check.
4. **Run no code from the repository.** No hooks, filters, signing programs or
   board scripts.
5. **One action, every surface.** The drawer, the card menu, the keyboard and
   drag share one definition of an action, when it is allowed, and why not.

### Decision drivers (top 3)

1. Safety where live agents commit (the boards above).
2. Fidelity to the AA protocol, in both its layouts.
3. Operator speed with keyboard parity.

### Decision A: how a tracked write is performed

| Option | Pros | Cons | Verdict |
|---|---|---|---|
| A1. Working-tree `git add` + `commit --only` as `_commit` does | Already written. | Runs clean filters and signing. Commits whatever bytes the working tree holds when `add` runs. | Rejected. |
| A5. *Antithesis (Architect):* a hardened A1 (`-c commit.gpgSign=false -c core.autocrlf=false`, refuse when `check-attr filter` is set). Git does the locking and copes with reftable and sparse or split index; about 20 lines. | Small, and lets git handle layouts. | The bytes still come from the working tree: an editor write between AGE Aris's write and `add` is committed as AGE Aris's. The hooks dilemma: with hooks on, AGE Aris runs repository code, and the aa-init `board.sh --check` pre-commit gate (`skills/aa-init/SKILL.md:107-111`) refuses **every** action, because STATE.md is stale by design (B). With hooks off, there is no fidelity gain over A2. | Rejected; recorded as the fallback if A2 proves fragile (ADR follow-up). |
| **A2. Plumbing under `.git/index.lock`** (§3) | Exact bytes, and no repository code. Concurrent `git commit` and `commit -a` are excluded by git's own lock for the whole write. CAS on the ref. One consistent outcome, with a rollback. | About 250 lines of new git code. Agents get a brief "index.lock exists" while it is held (tens of ms): `ckpt.sh` retries, a bare `git commit` fails once. Reftable, sparse and split repositories are not supported. | **Chosen.** |
| A3. Plumbing without an index or working-tree sync | Touches nothing the agents use. | A reverse diff in the agent's tree, which its next `commit -a` turns into a revert. | Invalid. |
| A4. A separate worktree or branch | Isolation. | The claim is invisible until merged, which breaks rule 1. | Invalid. |

**Policies that come with A2:**

- Commits go only to the **pinned branch** (C).
- Pushing is never done (`AA/AA.yml` `spend: push`).
- Identity: the repository's `user.name` and `user.email`. Rule 1's operator is
  `git config user.name` *there*.
- Extra config: `-c commit.gpgSign=false -c core.autocrlf=false`. Object hashing
  uses `--no-filters`.
- A task file whose bytes differ from its blob (CRLF conversion) reads as dirty
  and is refused.
- Every tracked git call has a `spawnSync` `timeout`: 10 s outside the lock,
  and under it 2 s per call with a 3 s budget for the whole hold, so the lock
  is never held long enough to tempt anyone into `rm -f .git/index.lock`. A
  timeout before the CAS refuses; after it, the settle rule (§3) decides.

### Decision B: STATE.md after a tracked write

| Option | Verdict |
|---|---|
| B1. Run the repository's `board.sh --write` | Rejected: it runs repository code, needs jq, and adds a second path. |
| B2. Port `board.sh` to JavaScript | Rejected: a second dialect that has to track every repository's copy. |
| B3. Overwrite the region with `_renderState` | Invalid: `--check` would fail permanently. |
| B5. *Older layout:* edit the task's row in the hand-kept table | Rejected for now: the rows are free prose (`**blocked (halt)** — was claimed; … control 0/12 …`, AGEIS STATE.md:302), and rewriting a status cell would destroy the author's text. Put to the user as Q2. |
| **B4. Never write STATE.md, and say so** | **Chosen.** The commit carries one line. A generated board gets `AA/STATE.md was not regenerated: run AA/board.sh --write.` A hand-kept board gets `AA/STATE.md is kept by hand: T077's board line still says its old status.` The project page shows the matching note (T025). |

### Decision C: switching task actions on

- **Off for every tracked project** until it is switched on, the old projects
  and new links alike.
- The switch opens a short dialog. It names the pinned branch, says that
  "Commits made here skip this repository's hooks" (listing any non-sample hook
  or a `core.hooksPath`), and "Agents in 1 other worktree (scratch/t068/wt-p0a)
  will not see these commits until it merges", and states the STATE.md
  handling for this board's layout.
- Confirming it stores `taskActions: { on: true, branch: "refs/heads/<b>", since }`
  in AGE Aris's own `project.json`, in the data folder, never in the
  repository.
- The probe refuses (`UNSUPPORTED_REPO`) a repository with any of these:
  - `extensions.refStorage=reftable`
  - `core.sparseCheckout`
  - `index.sparse`
  - `core.splitIndex`
  - an index that is a split index (link extension)
  - a detached HEAD
  - a task folder where `link()` fails. The probe creates and links a temporary
    `.agesight-probe-<nonce>` file (not ending in `.md`) in `AA/tasks/`, then
    removes both. Some FUSE and vfat filesystems return `EPERM`, which would
    otherwise turn every action into `STALE`.
- The same probe runs again in every action's preflight (Architect R5): a
  sparse checkout or split index added later would break the index copy in §3
  step 4. It costs one `git config --get-regexp` and a read of the index
  header.
- Global kill switch: `AGESIGHT_TRACKED_WRITES=0`.
- Switching off and on again re-pins the branch.

A default-on choice was rejected: it would silently change what projects
linked under the read-only promise do, and the disclosures have to be seen.

### Decision D: quick-action UX shape

| Option | Verdict |
|---|---|
| **D1. One registry → a drawer action bar, a card "⋯" menu, a keyboard map, and drag mapped to actions** | **Chosen.** Discoverable, fast and accessible, and it keeps "one task has one look". |
| D2. Inline selects on every card | Rejected: clutter, accidental changes, unusable at phone width, and no room for a reason or result. |
| D3. A command palette only | Rejected: not discoverable. Possible later. |
| D4. Drag only, extended to tracked boards | Rejected as the whole answer; kept as one surface of D1. |

### Decision E: which fields AGE Aris writes on an AA board

**Rule:** on an AA board, AGE Aris writes only what the protocol defines:

- the file's folder;
- `status:`, `owner:` and `blockedReason:`;
- the `## Result` section.

Neither `priority:` nor `assignee:` exists in the template (`skills/aa-init/template/TASK.md`),
in AGEIS's `WORKFLOW.md`, or in any task file across the five repositories.
`board.sh` ignores both, and AA is pull-based (`AA/board.sh:10`: "nothing is
assigned"). So **Priority and Assign are both offered on AGE Aris projects and
both disabled, with the reason, on AA boards.** The registry carries them
behind one capability flag, so allowing them on AA boards later is a
data change, not a rework. **User question Q1.**

---

## 2. The new rule (replaces "AGE Aris never writes to a repository it tracks")

To go into `AGENTS.md` (hard constraints; `CLAUDE.md` and `GEMINI.md` are
symlinks to it), with matching wording in `DESIGN.md`, `README.md` and
`skills/aa/SKILL.md`:

> **AGE Aris writes to a repository it tracks only through a task action the
> operator takes, and only after the operator has switched task actions on for
> that repository.** The switch pins a branch. Each action is one commit on
> that branch, changing one task file on an `AA/` board, the file's folder
> included. The commit is authored as the repository's own git identity and
> made with git plumbing while git's index lock is held: no hooks, filters or
> signing. No other path in the index or working tree changes; at most, git
> gains unreferenced objects that `git gc` removes. AGE Aris refuses when the
> task file is not clean and committed, when the branch is not the pinned one
> or a merge or rebase is in progress, when another operator holds the task,
> when a checkpoint run on it is live, or when the WIP limit is reached.
> It never pushes, never runs the repository's scripts, and never writes
> `STATE.md`, checkpoints, or anything outside the board's task folders. Boards
> under the older folder names `deaddrop/` and `pm/` stay read-only.

`AA/AA.yml`'s `data-migration` spend still governs this project's own
development. Tests write only to temporary repositories, never to the
operator's real boards.

---

## 3. The write protocol (T021)

Names used below:

- `H`: the HEAD commit read under the lock.
- `B`: the new task-file blob.
- `T`: the new tree.
- `C`: the new commit.
- `<from>` and `<to>`: the task file's path before and after. They are equal
  for an in-place change.
- *marker*: `.agesight-data/tracked-inflight/<projectId>.json`, always written
  to a temporary file and renamed into place.

The steps:

1. **Preflight, outside the lock (advisory).**
   - Settle any marker left for this repository first (see *Recovery*).
   - `probeRepository` (C).
   - The switch is on and the layout is supported.
   - `git symbolic-ref -q HEAD` equals the pinned branch.
   - No merge, rebase, cherry-pick, revert, bisect or sequencer is in progress
     (the marker files under `.git`).
   - An identity is set.
2. **Lock, then marker (R1).**
   - `open('.git/index.lock', O_CREAT|O_EXCL|O_WRONLY)`. `EEXIST` →
     `GIT_BUSY`.
   - Write `agesight <nonce>\n` (16 random bytes, hex) into it, then `fstat`
     it for its inode.
   - Only then write the marker: `{ phase: "locked", dir, branch, lockIno, nonce, paths, startedAt }`.
3. **Authoritative checks, under the lock, against HEAD as it is now.**
   - `H = rev-parse --verify HEAD^{commit}`. The branch must be unchanged.
   - The task file must be identical in the working tree, the index and `H`:
     - working tree: `hash-object --no-filters --stdin`, given the bytes;
     - index: `ls-files -s -z`;
     - `H`: `rev-parse H:<from>`.
   - `<to>` must be absent.
   - Then every §4 check, in its order: holder, runs, column, WIP and `version`.
4. **Build.**
   - `hash-object -w --no-filters --stdin` gives `B`.
   - Scratch index *S* (`GIT_INDEX_FILE=.git/agesight-S-<nonce>`): `read-tree H`,
     `update-index --add --cacheinfo 100644,B,<to>` (plus `--force-remove <from>`
     on a move), then `write-tree` gives `T`. *S* starts from `H`, never from
     the real index, so another person's staged changes are never committed.
   - New real index *N* (`.git/agesight-N-<nonce>`): a copy of `.git/index`, with
     the same `update-index` operations applied.
5. **Publish.**
   - `commit-tree T -p H` gives `C`.
   - **Rewrite the marker** as `{ phase: "publishing", H, C, B, … }` (R1).
   - `update-ref -m "AGE Aris: <subject>" refs/heads/<b> C H`.
   - If the CAS is lost, set the marker back to `locked`, discard *S* and *N*,
     and return to step 3 still under the lock, re-running **all** checks
     against the new HEAD. At most 3 attempts; then `STALE`.
6. **Working tree.** This closes the editor window as far as a filesystem
   allows.
   - `rename(<from>, <from-dir>/.<name>.agesight-<nonce>)`. It is atomic; an
     editor writing `<from>` afterwards creates a new file instead of changing
     the one being moved.
   - Re-hash the renamed file; it must equal `H:<from>`.
   - Write the new content to a temporary file in `<to>`'s folder, then
     `link(temp, <to>)`, which is atomic and fails if anyone has created `<to>`
     meanwhile, and unlink the temporary file.
   - On a move, `<from>` must still be absent.
   - If anything fails here, go to the settle rule.
   - Marker: `phase: "worktree"`.
7. **Install the index, if the lock is still ours (R3).**
   - Check that `fstat(fd).ino` equals `lstat('.git/index.lock').ino` and that
     the file's first line is still `agesight <nonce>`.
   - If yes: `rename(N, .git/index.lock)`, then
     `rename(.git/index.lock, .git/index)`. This is git's own lock-and-rename
     protocol, and it releases the lock.
   - If no, someone ran `rm -f .git/index.lock` and possibly took a new lock.
     Do **not** install. Go to the settle rule, which rolls back here because
     the index cannot be made consistent; the result is
     `GIT_BUSY: another process took git's index lock; nothing was changed`.
8. **`finally`.**
   - Close the fd.
   - Unlink *S*, *N*, and the renamed `<from>` copy once the outcome is
     settled.
   - Unlink `.git/index.lock` only if its inode **and** nonce are ours.
   - Delete the marker only when the outcome is settled.
   - Unreferenced loose objects stay for `git gc`.

**The settle rule (R4).** It runs after any failure past step 5 — a lost or
timed-out `update-ref`, a failed working-tree check, a stolen lock, an error
installing the index — and recovery runs it too. It reads the ref value `R`
with `rev-parse`:

- **`R == H`:** nothing was published. Put the renamed `<from>` back if it is
  still there and `<from>` is free, and remove a `<to>` that holds `B` if it was
  created. Return `STALE` (or the refusal that triggered it).
- **`R == C`:**
  - *Complete* if the lock is ours and the working tree can be finished. That
    means `<to>` already holds `B`, or `<to>` is free and the renamed `<from>`
    equals `H:<from>`; and `<from>` is absent. Finish step 6, then install
    the index as in step 7. *N* is always rebuilt from the **current**
    `.git/index` under the held lock, with the same `update-index`
    operations. An earlier *N* is never reused, because it may be partial.
  - Otherwise *roll back*: `update-ref refs/heads/<b> H C` (a CAS back), then
    restore the working tree as for `R == H`, and return `STALE`.
  - If the CAS back is lost, re-read `R` once and apply this rule again; if it
    still cannot settle, the write is *interrupted*.
- **`R` is anything else** (the branch moved on after `C` was published, which
  under a held lock means a plumbing writer or a stolen lock): the write is
  *interrupted*. `C` is in history. AGE Aris touches nothing except putting
  back its own renamed file when `<from>` is free.
  - It returns `500 INTERRUPTED`, "Committed `<C>`, but the branch moved before
    AGE Aris finished. Check `git status` for T012 in AGEIS". The message also
    names any stale lock file found: `.git/index.lock` without AGE Aris's
    nonce, or `.git/refs/heads/<b>.lock`.
- **A timed-out git call** (any phase): after it is killed (see *Allowed
  overrides*), check for `.git/refs/heads/<b>.lock`. If it exists, a killed
  `update-ref` left it, and every commit on the branch now fails with "cannot
  lock ref". AGE Aris never deletes it, since it cannot know whose lock it is.
  The write is *interrupted*, and the message gives the exact path:
  "`/home/ade/Code/AGEIS/.git/refs/heads/deaddrop-migration.lock` was left by
  a timed-out git call; delete it once no git command is running there".
  - The marker stays with `phase: "interrupted"`, so the project header shows
    it until the operator dismisses it.

The result is always one of three: **committed and consistent**,
**unchanged** (with at most loose objects added), or **interrupted** and
reported, which is reachable only through the paths named above.

**Recovery.** It runs at startup and in every preflight for that repository,
and it is idempotent (R2).

- **Phase `locked`:** nothing was published. Remove `.git/index.lock` only if
  its inode **and** nonce match. Put back a renamed `<from>`. Delete the marker.
- **Phase `publishing` or `worktree`:**
  - If `<to>` holds `B`, the index entry for `<to>` is `B`, `<from>` is absent
    from the index and the working tree (on a move), and the ref is `C`: the
    write already finished, so only clean up.
  - Otherwise hold the lock, then apply the settle rule with the marker's `H`,
    `C`, `B` and paths:
    - **Adopt AGE Aris's own stale lock:** if `.git/index.lock` exists and its
      inode **and** nonce match the marker, AGE Aris died holding it. Open it
      and carry on with it, rather than failing on O_EXCL at every start
      (Architect v3, change 1).
    - **Otherwise** take it afresh (O_EXCL with a new nonce, and record the
      new nonce in the marker). If someone else holds it, keep the marker and
      retry at the next preflight.
  - Phase `locked` also adopts a matching lock before removing it, so a lock
    left by a crash never outlives the next start.
- **Phase `interrupted`:** left for the operator. It is shown in the header,
  and recovery never touches it again.

Running recovery twice leaves the same state (tested).

**What an agent sees.** While the lock is held (at most 3 s, normally tens of
ms), an agent's `git commit`, `commit -a` or `add` fails with "index.lock
exists". `ckpt.sh` retries; a bare command fails once. If AGE Aris dies holding
the lock, the file reads `agesight <nonce>`, and README says it is safe to
delete when AGE Aris is not running. After release, the agent's index already
holds AGE Aris's entries, so `commit -a` cannot revert them.

**Allowed overrides.** `trackedGit(dir, args, { input, env, timeout })` accepts:

- `GIT_INDEX_FILE`, only when it resolves under `<dir>/.git/`;
- `GIT_AUTHOR_*` and `GIT_COMMITTER_*`.

It pipes stdin when `input` is given and reuses `GIT_HARDENING` plus the extra
config. It enforces its own timeout:

- At the deadline it sends **SIGTERM**, on which git removes its own lock files
  (`refs/heads/<b>.lock`, `agesight-N-*.lock`).
- It sends **SIGKILL** only after a 500 ms grace period.
- After any timed-out call it runs the ref-lock check in the settle rule.

`spawnSync`'s single `killSignal` cannot do both, so tracked calls use `spawn`
with timers. The 2 s and 3 s bounds include the grace period.
`git()` in workspace.mjs gets the same `input` and `timeout` options, and its
`env` no longer passes anything in `GIT_ENV_DROPPED`.

---

## 4. Protocol semantics and refusals

**Common to every tracked action:**

- The filename and slug are kept.
- Frontmatter is edited line by line, with no regex over the file. Comments,
  unknown keys, order, quoting and CRLF are kept byte for byte.
- `status:` uses AA's words.
- Trailer `AGESight-Via: ui`. The body is `Made in AGE Aris by <operator>.`
  plus the STATE.md line from B.
- Subjects are one line of at most 72 characters and never start with
  `migrate:` or `ckpt:`.
- The owner line is `<operator> @agesight/web <UTC date> — <note>`; the note
  drops `#`, quotes and control characters and is at most 120 characters.

**Holders.**

- *Unclaimed* (owner empty or `—`).
- *Self via AGE Aris* (`@agesight/web`, same operator).
- *Self via an agent* (same operator, another profile or session; rule 3).
- *Another operator* (rule 2: always refused).

Acting on a *self via an agent* task needs a one-step confirmation. It names
the session and its last sign of life, which is the newer of its trail's newest
entry and the last commit touching the task by anyone but AGE Aris (rule 4):
"Your agent session @k/b6192924 holds T077; last sign of life 3 h ago. Act as
the same operator?" The owner line is kept, except on Release, and on Claim,
which takes the task back (rule 3) and keeps the agent's line inline:
`<new owner line>; was <old owner line>` (amended 2026-10-08, T026, the
operator's decision). This is in scope
because every open AGEIS task is held this way. A separate "take over"
(continue) action is a follow-up.

**Runs: one definition, for every action.** `readTrail(path, { staleHours, now })`
reads `checkpoints/T###.jsonl` line by line with `JSON.parse`, capped at
1 MB.

- Lines are grouped **by run id**. A run's state is its *newest* line in file
  order, which is append-only. The run has **ended** when that line's `kind` is
  `end`. Counting opens and ends is wrong: AGEIS T077 has 3 opens and 4 ends,
  and every run in it has ended.
- A run that has not ended is **live** if its newest line's `ts` is within
  `staleHours`, and **dead** otherwise.
  - `staleHours` is `boardPolicy().staleHours`: `stale_hours` in `AA.yml`, or
    24 when there is none (rule 4; AGEIS WORKFLOW.md:302).
- A line that does not parse, or lacks `run`, `kind` or `ts`, is **malformed**
  and is reported by line number.
- **A live run refuses every action on the task** (`RUN_LIVE`), whoever holds
  it. A run that wrote within `stale_hours` is alive, whether or not it
  committed (rule 4).
- **Liveness comes from the trail only.** Rule 4's fallback to commits applies
  only when there is no trail, so it is not used here. The confirmation still
  shows the task's last commit by anyone but AGE Aris, beside the trail entry.
- **Dead runs and malformed lines** (and no live run) need a confirmation that
  names each one: "Run 7c1e2a90 on T053 last wrote `doing: train fold 2`
  (next: `resume at epoch 5`) 22 days ago and never ended."
  - The action then proceeds with the warning `RUN_NOT_ENDED`. Its remedy is
    the reaping append that rule 2 allows: `AA/ckpt.sh log T053 end --run
    7c1e2a90 --changed "unknown — reaped by <operator>, process gone"`
    (`AA/ckpt.sh:150-153`, `:234`). For a malformed line the remedy is
    `AA/ckpt.sh check T053`.
  - AGE Aris still never writes the trail itself.
- **Done with every run ended** proceeds with the warning `TRAIL_NOT_RETIRED`
  ("run AA/ckpt.sh close T012 --delete").

**One confirmation step.** The own-agent and run-not-ended reasons are
returned together as `409 CONFIRM { reasons, confirmToken }`. The
`confirmToken` is a hash of the reasons and the file `version`. The client
shows one dialog and resends with the token. A changed situation produces a
different token, so it needs a new confirmation. A confirmation never
overrides `RUN_LIVE`, which is re-checked under the lock.

| Action | AA with `backlog/` | AA without `backlog/` (AGEIS, AGEION, RSNA) | Fields | Commit subject |
|---|---|---|---|---|
| **Claim** | `backlog/` → `tasks/` | in place, from `open`/`unclaimed`/empty in `tasks/` | `status: claimed`, `owner:` new line; over the operator's own agent, `; was <old owner>` after it | `claim T012: <note>` |
| **Release** | `tasks/` → `backlog/` | in place | `status: open`, `owner: — (released <date>; was <old owner>)`, `blockedReason: ""` | `release T012: back to the queue` |
| **Block** | in `tasks/` | in `tasks/` | `status: blocked`, `blockedReason: "<one line, required>"` | `block T012: <reason>` |
| **Unblock** | in `tasks/` | in `tasks/` | `status: claimed`, `blockedReason: ""` | `unblock T012` |
| **Done** | `tasks/` → `tasks/done/` | `tasks/` → `tasks/done/` | `status: done`, `blockedReason: ""`. `## Result`: a placeholder is replaced with the one line typed (required); real content is kept and nothing is asked. | `T012 done: <result or title>` |
| Priority, Assign | disabled on AA boards (E) | disabled | — | — |

**AGE Aris projects** use the same registry through the existing `PATCH`
(`updateTask`). Claim/Start is `in_progress`, Block is `blocked` with an
optional reason, Done is `done`, Release is `backlog`, and Priority and Assign
set their fields. Their commit format and STATE.md render are unchanged.

**What counts as a Result placeholder.** The text of the section, from
`## Result` to the next line starting with `## `, read by a line scan and
trimmed. It is a placeholder when it:

- is empty;
- is `*(pending)*` (the AGEIS form);
- starts with `*(` and ends with `)*` (the template's italic instruction, which
  spans several lines);
- or contains `{{`.

Anything else is real content.

**Notes on the semantics:**

- **Unblock and the stint.** Unblock writes `claimed`, as people do (the AGEIS
  halt lift set its tasks "back to `claimed`"). `board.sh:140` treats the newest
  `claimed` as the start of a new stint, so the task's age on the board restarts
  after an unblock. That is existing protocol behaviour, not new: AGE Aris's
  metrics (`metrics.mjs:685`) still read it as an unblock. Changing `board.sh`
  is an AA-convention follow-up.
- **The checkpoint trail on Done.** AGE Aris never writes trails (rule 2) and
  never runs `ckpt.sh`, so Done leaves the trail in place (`TRAIL_NOT_RETIRED`).
  That is a recorded deviation from WORKFLOW.md's Done, which retires the
  trail; README links it.
- **WIP.** Claim is refused when the tasks in `tasks/` (in progress plus
  blocked, as `board.sh:229-230` counts them) are at or over `wip.in_progress`.
  0 or no `AA.yml` means no limit. Block over `wip.blocked` (`board.sh:163`,
  `:349`) proceeds with the warning `BLOCKED_OVER_LIMIT`, which uses
  `board.sh`'s words: "a blocker nobody is clearing is the flow problem". It
  only warns because `board.sh` itself only notes it. `boardPolicy` learns
  `wip.blocked`.

**Refusals.** All are HTTP 409 `{ error, code, remedy }`, except `NOT_FOUND`
(404) and `BAD_INPUT` (400). They are checked in this order, and each check runs
again on every retry. Two amendments (2026-10-08, T026), where the code's order
is the better one:

- A request that cannot be acted on at all is refused before the repository
  is read, right after `ACTIONS_OFF` and `LEGACY_BOARD`: `NOT_FOUND`,
  `BAD_INPUT` for a missing `version`, and `NOT_ALLOWED` for an action an AA
  board does not have (Priority, Assign). The rest of `BAD_INPUT` stays last.
- `NOT_COMMITTED`, and `DIRTY_FILE` for a task file that is not a regular file
  in HEAD, come right after `GIT_BUSY`: every check from `DUPLICATE_ID` on
  reads the file from HEAD.


| Code | When | Message |
|---|---|---|
| `ACTIONS_OFF` | switch off, or `AGESIGHT_TRACKED_WRITES=0` | "Task actions are off for AGEIS. Switch them on in the project header." |
| `LEGACY_BOARD` | board folder `deaddrop/` or `pm/` | "This board is in deaddrop/, an older folder name. AGE Aris acts only on AA/ boards." |
| `WRONG_BRANCH` | HEAD is not the pinned branch | "AGEIS is on main; task actions commit to deaddrop-migration, the branch pinned when they were switched on. Switch back, or switch actions off and on to pin main." |
| `GIT_BUSY` | detached HEAD, an operation in progress, or `index.lock` held | "AGEIS is in the middle of a rebase. Finish it, then try again." |
| `NO_IDENTITY` | no `user.name` | "Set git user.name in AGEIS; AGE Aris commits as you." |
| `DUPLICATE_ID` | the id is also a duplicate in `problems` (T007) | "Two files claim T120. Resolve the duplicate first." |
| `HELD_BY_OTHER` | another operator holds it | "T012 is claimed by alice. AA rule 2: only its owner changes it." |
| `RUN_LIVE` | any action, when a run on the task has not ended and wrote within `stale_hours` | "Run 2e8b687e on T012 last wrote `doing: fold 0` 12 min ago and has not ended. Wait for it to end, or stop it from its session. If that session is gone (the same operator takes a claim back without waiting, rule 3): `AA/ckpt.sh log T012 end --run 2e8b687e --changed "unknown — reaped by <operator>, process gone"`, then try again." |
| `CONFIRM` | held by the same operator via an agent, or dead runs or malformed lines, and no matching `confirmToken` | the confirmation step, not an error |
| `NOT_ALLOWED` | the action does not fit the column, or a disabled field (E) | "T012 is in the queue: claim it before marking it done." |
| `WIP_LIMIT` | Claim at the limit | "WIP is 2 of 2. Finish or release something before claiming (rule 10)." |
| `STALE` | the `version` differs, a CAS was lost 3 times, or the settle rule rolled back | "T012 changed while you acted. It has been refreshed; nothing was changed." |
| `NOT_COMMITTED` | the file is not in HEAD | "T030 is not committed yet." |
| `DIRTY_FILE` | working tree, index and HEAD differ for the file, or the target exists | "T012 has uncommitted changes in /home/ade/Code/AGEIS. Commit or discard them, then try again." |
| `BAD_INPUT` | missing reason or result, over 200 characters | the field's message |

Turning actions on can be refused with `UNSUPPORTED_REPO` (C).

**Warnings** come back as `200 { task, commit, branch, warnings }`:

- `RUN_NOT_ENDED` (with the reap command)
- `TRAIL_NOT_RETIRED`
- `BLOCKED_OVER_LIMIT`
- `INTERRUPTED_RECOVERED` (recovery settled an earlier write first)

`500 INTERRUPTED` is the settle rule's third outcome (§3).

---

## 5. Phases (proposed AA tasks T021–T025; not created yet, per rule 12)

The project's WIP limit is 2: T021 and T022 run in parallel, and T023 starts
when both are done. Each task carries its decision rules before it is claimed
(rule 5). No task spends anything: tests touch only temporary repositories.

### T021: A tracked-write engine that commits one task file under git's lock

*(lib only. Nothing reaches it from the API, so the product still never writes
to a tracked repository.)*

- **New** `lib/tracked.mjs`:
  - `trackedGit`;
  - `probeRepository(dir)` (C);
  - `repoState(dir)` (via `symbolic-ref -q HEAD` and marker files);
  - `editFrontmatter(content, updates)` (a line scanner);
  - `resultSection(body)` and `setResult(body, line)` (§4);
  - `ownerLine` and `commitSubject`;
  - `readTrail(path, { staleHours, now })` →
    `{ runs: [{ id, ended, live, last }], malformed: [line] }` (§4);
  - `commitTaskChange(dir, { from, to, content, message, identity, branch, check, seams })`,
    which implements §3 steps 2–8 and calls `check(headState)` under the lock
    on every attempt;
  - `settle(marker)`, the single rule used both after failures and by recovery;
  - `recoverInflight(dataDir, dir?)`, which is idempotent.
- `lib/workspace.mjs`: `git()` gains `input` and `timeout`, and its `env`
  overrides are filtered against `GIT_ENV_DROPPED`. `boardPolicy` (`:514`)
  returns `blockedLimit` too, and `staleHours` (already parsed) defaults to 24.
- `package.json` `check` adds `lib/tracked.mjs`.
- **New** `tests/tracked.test.mjs`, plus fixtures copied from
  `AA/backlog/T004-*.md`, `AA/backlog/T012-*.md` and
  `AA/tasks/done/T019-*.md` (a filled Result), and a synthetic `*(pending)*`
  file.

**Acceptance:**

- `npm test` and `npm run check` pass.
- In every seam test (§8), the result is one of two:
  - *committed and consistent*: the ref, the index and the working tree agree,
    and `git status --porcelain` for the task paths is empty;
  - *unchanged*: the ref, the index and the working tree are byte-identical to
    before, apart from loose objects.
- `INTERRUPTED` occurs only in the two tests that construct its paths (a
  plumbing writer after the CAS, and a stolen lock followed by a lost CAS
  back). There it leaves `C` in history, the marker in place, and the index and
  working tree untouched.
- `recoverInflight` run twice on the same marker gives the same state as
  running it once, in every phase.
- With a pre-commit and a post-commit hook, a `*.md` filter driver and
  `commit.gpgSign=true` plus a marker-writing `gpg.program` configured in the
  temporary repository, no marker appears and the commit is unsigned.
- `probeRepository` refuses each of reftable, sparse checkout, sparse index,
  split index and a detached HEAD.
- `grep -n "never writes to a repository it tracks" AGENTS.md` still matches;
  the rule is unchanged in T021.

### T022: Task actions in the drawer, on AGE Aris projects first (parallel with T021)

- **New** `public/actions.js`. It is pure, with no DOM, so it can be tested the
  way `tests/cockpit-ui.test.mjs:10` imports `cockpit.js`. It defines:
  - `TASK_ACTIONS`: `{ id, label, icon, key, needs: null|'reason'|'result'|'choice', field? }`;
  - `availability(task, project, { operator })` → `[{ id, enabled, why }]`,
    with the capability flags for E;
  - `actionRequest(id, task, input)`. On AGE Aris projects it maps to
    `PATCH /api/tasks/:id`, which already takes partial bodies
    (`workspace.mjs:1148-1160`).
- `public/app.js`:
  - `performAction(id, taskId, { opener, input, confirm })` is the single entry
    point. It asks for input inline, shows a refusal inline (`role="alert"`)
    and as a toast, refreshes, and restores focus by `data-id`.
  - `api()` (`:146`) keeps `code` and `remedy` on its errors.
  - The action bar sits under `drawerHead`'s summary (`:827-836`), with the
    full form still below it.
  - One delegated `[data-action]` handler serves `#main` and `#task-dialog`. It
    replaces `:2026`, and a linked task swaps the drawer's content in place.
  - `moveTask` (`:1895`) maps a column change to an action and calls
    `performAction`.
- `public/styles.css`: the bar, the inline field and the disabled state, all
  from tokens; no inline styles (CSP, `server.mjs:40`).
- `package.json` `check` adds `public/actions.js`.
- **New** `tests/actions.test.mjs`.
- **New** `tests/e2e/task-actions.e2e.mjs`, run by `npm run e2e` (outside
  `npm test`, as `perf` is). It reads `AGESIGHT_PUPPETEER` and
  `AGESIGHT_CHROME`. Its results go to PROGRESS.md (rule 9).

**Acceptance:**

- On an AGE Aris project, Start, Block (with an optional reason), Done,
  Release, Priority and Assign each take one click, or one click and Enter,
  from the drawer. None needs "Save changes".
- A disabled action shows its `why` on hover and focus and through
  `aria-describedby`.
- After success, focus is back on the same task.
- `tests/actions.test.mjs` covers project kind × column × holder (4 kinds) ×
  switch × layout.
- The e2e drawer scenarios pass, and the run is recorded in PROGRESS.md.
- Tracked tasks still open the read-only viewer, with no action bar.

### T023: Task actions on tracked AA boards, end to end; the rule lifted

- `lib/workspace.mjs`:
  - `actOnTask(globalId, { action, version, reason, result, confirm }, { trailers })`
    inside `_serialize`. An AGE Aris project goes through `updateTask`; a
    tracked AA board goes through `tracked.mjs` with §4's semantics, for both
    layouts.
  - `WorkspaceError` gains `code` and `remedy`.
  - `taskPublic` exposes `holder: { operator, profile, session }`.
  - `_project` exposes `actions: { on, branch, reason }` from cheap checks.
  - `updateProject` accepts only `taskActions` for a tracked project: it runs
    the probe and pins the branch on, and clears on off.
  - `recoverInflight` runs in `init()`.
  - The `_writable()` guard still covers the full edit form.
- `server.mjs`: `POST /api/tasks/:id/actions` (`VIA_UI`). Error JSON carries
  `code` and `remedy`. `AGESIGHT_TRACKED_WRITES` is read. Every refusal and
  failure of a tracked action is logged to stderr in one line:
  `tracked action <code>: <project> <task> <action> [<step>]`, with emails
  redacted.
- `public/actions.js` and `public/app.js`:
  - tracked tasks get the drawer action bar (`openTaskViewer`, `:900`);
  - `CONFIRM` becomes one confirmation dialog that lists its reasons (the
    own-agent session and its last sign of life, dead runs, malformed lines);
  - the switch, with the disclosure dialog (C), goes in the project header.
- **Every user-facing string that promises read-only is changed here, in the
  same commit as the rule:**
  - `AGENTS.md`: the hard constraint, now the §2 rule.
  - `DESIGN.md`: the "First version" bullet at `:23-24` ("read-only. AGE Aris
    never / writes …", split across two lines), and the text sketch at `:75`
    (`AGEIS  Read-only` → `AGEIS  Tracked`).
  - `README.md`:
    - `:133-135` ("AGE Aris only reads it … nothing is ever written there");
    - `:149`, the "Editing … not available" bullet, which narrows to the full
      edit form, adding tasks, the pipeline and agent runs;
    - new text on the actions, refusals, branch pin, switch, STATE.md handling,
      the agent-facing `.git/index.lock` note (§3: a brief "index.lock exists"
      error, at most 3 s, while AGE Aris acts, which agents retry; and a lock
      reading `agesight <nonce>`, which is safe to delete when AGE Aris is not
      running), and the trail-retirement deviation
      from WORKFLOW.md's Done;
    - "Storage and behavior".
    - `:71` ("rendered read-only", about a board's rule documents) stays: those
      documents are still never written.
  - `skills/aa/SKILL.md:21`.
  - `public/app.js`:
    - `:404`, the badge and its title;
    - `:538`, the add-project choice copy;
    - `:773`, the link dialog copy;
    - `:787`, the "Tracking … AGE Aris only reads it" toast;
    - `:830`, the drawer's eyebrow badge;
    - `:856`, **reworded, not deleted**: adding tasks to a tracked board stays
      unavailable. It becomes "New tasks for AGEIS are added in the repository;
      AGE Aris acts on the tasks already there";
    - `:904`, the read-only note, which becomes "Commits to `<branch>` in
      `<repo>` as `<operator>`; not pushed", or "Task actions are off";
    - `:1898`, the `moveTask` refusal, which is replaced by the registry's
      `why`.
  - `public/cockpit.js:264`, the brief badge and its title ("… never writes to it").
  - `lib/workspace.mjs`: the `readOnly()` message at `:552-553`, which becomes
    "… AGE Aris changes its tasks only through task actions", and the comments
    at `:711` and `:985-987`.
- Tests: `tests/workspace.test.mjs`, where the test at `:1175` is rewritten so
  that form and project edits stay refused and actions are refused while the
  switch is off; `tests/server.test.mjs`; e2e tracked scenarios.

**Acceptance:**

- A claim through `/actions` on a temporary repository with the switch on lands
  as specified, for both layouts:
  - with `backlog/`, the file moves; without it, the change is in place;
  - `status: claimed`, the owner line, the `AGESight-Via: ui` trailer and the
    repository's identity are present;
  - the commit is on the pinned branch;
  - the index and working tree are clean for those paths.
- Every code in §4 has a test that asserts the status, the `code`, and an
  unchanged repository (`repositoryState`, `workspace.test.mjs:952`).
- Each AGE Aris project action through `/actions` produces the same file as
  the equivalent `PATCH`.
- A check that ignores line breaks finds no read-only promise left:
  `for f in AGENTS.md DESIGN.md README.md skills/aa/SKILL.md public/app.js public/cockpit.js lib/workspace.mjs; do tr '\n' ' ' < "$f" | grep -o -i -E "never +writ[a-z]*|only reads|read-only[^.]{0,60}" | sed "s|^|$f: |"; done`
  prints exactly four lines. Today it prints 24 (on f7c3540); the dry run was made on
  2026-10-07. The four that remain:
  - `README.md:71`: "rendered read-only", about a board's rule documents;
  - `public/cockpit.js:434`: "Read-only, as written in the repository", the
    same documents;
  - `lib/workspace.mjs:881`: the comment on the same documents;
  - `skills/aa/SKILL.md:3`: the `/aa` skill describing *itself* as read-only.

  All four remain true: the rule documents are never written, and `/aa` changes
  nothing.
  The rule's own wording says "never pushes" and "never runs", which the
  pattern does not match.
- The e2e tracked scenarios pass and are recorded in PROGRESS.md.

### T024: The card menu, the keyboard map, and drag through the registry

- `public/app.js`:
  - `taskCard` (`:502`) becomes `<article class="task-card" data-id draggable>`,
    holding `<button class="card-open" data-action="open-task">` (stretched over
    the card) and `<button class="card-menu" data-action="task-menu" aria-haspopup="menu" aria-expanded>`.
  - The menu is rendered inside the card on demand: `role="menu"`, menu items
    taken from the registry, and `aria-disabled` plus `why` on disabled items.
    It is positioned by CSS only.
  - `taskRow` (`:510`) gets the same menu.
  - **Keyboard:** on a focused card or row, or in an open task drawer: `c`
    claim/start, `b` block, `u` unblock, `d` done, `r` release, `p` priority
    and `a` assign where they are enabled, and `.` or the ContextMenu key for
    the menu. Inside the menu, arrows, Home and End move and Esc closes it and
    returns focus. The global handler (`:2070`) keeps its input guard and
    routes task keys while a task drawer is open.
  - `refreshPaused` (`:2088`) also pauses while a menu or an inline input is
    open.
  - `focusSelector` (`:319`) learns `.task-card[data-id]` and
    `.card-menu[data-id]`.
  - Drag (`:1992-2023`): `draggable` comes from `availability`, and `drop` calls
    `performAction`.
- `public/styles.css`: the card wrapper, the menu and focus rings.
- `DESIGN.md`: one paragraph on the bar, the menu and the keys. The text sketch
  shows "Tracked".

**Acceptance:**

- With the keyboard only: Tab to a backlog card on a tracked board, press `c`,
  and the card is in In progress with focus on it.
- The menu opens with Enter, Space and `.`; arrows move; Esc returns focus.
- Every action available by drag is also available by menu and by key, with
  the same refusals.
- No nested interactive elements.
- At 390 px wide, the page has no sideways scroll.
- `npm test` and `npm run check` pass. `npm run e2e` passes and is recorded in
  PROGRESS.md.

### T025: Say on the project page that STATE.md is behind, or kept by hand

- `lib/brief.mjs` with `lib/history.mjs`: `stateBehind` lists the **tasks**
  whose AGE Aris changes STATE.md has not caught up with. The ledger records
  carry `via` and paths (`history.mjs:300-306`). There is one
  `git log -p --format=… -- <board>/STATE.md` call, covering only the commits
  since the oldest pending `via: ui` change and capped at 200.
  - **A board with `board.sh`:** a STATE.md commit whose added lines contain
    the generated header `` `board · `` (`board.sh:252`) is a regeneration and
    covers every task. The list is the tasks with `via: ui` changes after the
    last regeneration. Hand edits to the NOW block do not count.
  - **A hand-kept board:** a task is caught up once a later STATE.md commit
    *adds* a line containing its id (`String.includes`, no regex). Frequent
    unrelated STATE.md edits, as on RSNA, therefore do not hide it.
- `public/cockpit.js`:
  - For a board with `board.sh`: "STATE.md is behind AGE Aris's changes to
    T012, T014 · Copy `AA/board.sh --write`" (reusing `copy-path`).
  - For a hand-kept board: "STATE.md is kept by hand here; its lines for T077
    and T036 predate their changes in AGE Aris". The wording follows the user's
    answer to Q2.
  - Both say "as far as the commits show". A line edited without its id is not
    seen.
- Tests: `tests/brief.test.mjs`, `tests/cockpit-ui.test.mjs`.

This is the mitigation that Decision B relies on, and it is why it stays in
scope.

**Acceptance:**

- After AGE Aris claims T001 and T002 on a `board.sh` board, the note names
  both. A NOW-only STATE.md edit leaves the note in place; `board.sh --write`
  plus a commit clears it.
- On a hand-kept board, an unrelated STATE.md commit leaves T077 listed. A
  commit adding a line with "T077" removes it.
- On an AGE Aris project, the note never appears.

---

## 6. Interaction-code restructuring, and the need behind each piece

| Piece | User-facing need | Explicitly not done |
|---|---|---|
| `public/actions.js` registry with `availability()` | The bar, the menu, the keys and drag must agree on what is allowed and why not. | Run, inbox and agent actions stay in the switch at `app.js:1929`. |
| `performAction()` | The same refusal display, confirmation, refresh and focus return everywhere. | No optimistic UI: a refused claim must never flash as claimed. |
| One delegated handler for `#main` and `#task-dialog` | Drawer and card controls behave the same, and the drawer does not flicker when moving to a linked task. | Other dialogs keep their own listeners. |
| A keyboard map from the registry | Board moves are drag-only today, which falls short of DESIGN.md's keyboard requirement. | No j/k navigation, no palette, no `?` sheet (follow-ups). Shortcuts are shown in the menu items and in each action's `title`. |
| Card markup as a wrapper with two buttons | A menu cannot sit inside a `<button>`. | The card looks the same. |
| `refreshPaused` and `focusSelector` additions | The 10 s refresh must not destroy an open menu or a half-typed reason, and focus must follow a card that moved. | Rendering stays `innerHTML`. |

---

## 7. Pre-mortem

**1. AGE Aris reverts or overwrites an agent's work.**
An agent commits, runs `commit -a`, or edits the task file while the operator
clicks Done.

*Mitigations:*

- `.git/index.lock` is held for the whole write, so a concurrent `git commit`
  or `commit -a` fails cleanly instead of interleaving. The new index is
  installed through that same lock, so no window is left in which the agent's
  index lacks AGE Aris's entries.
- The scratch tree is built from `HEAD`, never from the real index.
- On a move, `<from>` is renamed aside before it is re-hashed, and `<to>` is
  created with `link()`. An editor write after the CAS is therefore either
  caught (the rename aside, the hash and the exclusive create all fail) and
  undone by the settle rule, or it lands in a new file that AGE Aris does not
  touch.
- The settle rule and idempotent recovery mean every failure path ends in a
  named outcome (§3).
- Seam tests cover all five windows (§8).

*Residual windows (honest):*

- **Read before, write after.** An agent or editor that read the task file
  *before* the action and writes its old copy back *after* the lock is released
  reverts AGE Aris's change in the working tree, and its next commit carries
  the revert. No git mechanism prevents this; it is an ordinary lost update
  between two writers of one file.
  - Mitigations: rule 2 (the holder owns its file), `RUN_LIVE` (no action while
    the holder's run is live), and the own-agent confirmation.
  - Detection: the task re-reads with its old status, and the timeline shows
    both commits.
- **A non-atomic in-place write.** In an in-place change, an editor that
  writes `<from>` in the microseconds between AGE Aris's rename aside and its
  `link()` is caught by `link()` (EEXIST) and rolled back. An editor that
  truncates and rewrites the renamed-aside file through an already-open
  descriptor writes into a file that is about to be deleted. Its content
  survives only in the editor's buffer.
- **A stolen lock between the check and the rename.** Between step 7's
  ownership check and `rename(N, index.lock)` there are a few microseconds in
  which another process could delete and retake the lock. Its new lock would
  then be overwritten.
- **A crash while the lock is held.** Agents see "index.lock exists" until AGE
  Aris restarts and recovery removes its own lock (inode and nonce), or until
  the operator deletes the file. README says how to recognise it.
- **Agents see a brief lock error** during normal operation (≤ 3 s, typically
  tens of ms).

**2. The commit lands where nobody expects it, or breaks the repository's own tooling.**
AGEIS is switched to `main` for a hotfix, or is mid-rebase, and a claim lands
there. Or a `board.sh --check` pre-commit hook in an agent session fails after
an AGE Aris write, and the agent hand-edits STATE.md (against rule 11).

*Mitigations:*

- The pinned branch and `WRONG_BRANCH`.
- `GIT_BUSY`.
- The branch name on the action bar and in the toast.
- The switch dialog says hooks are skipped and lists other worktrees.
- The commit body names the exact remedy, and T025's note shows it.
- An integration test runs the template `board.sh` against AGE Aris's commits:
  columns and owner are right, `--check` is stale, and it is current after
  `--write`.

**3. AGE Aris breaks the protocol, and the board stops being trusted.**
It claims beyond WIP; marks Done a task whose agent run is still spending;
writes an owner line `board.sh` misreads; requotes untouched frontmatter;
replaces a real Result; or leaves the Result placeholder in place, so the
Definition of Done is silently unmet.

*Mitigations:*

- WIP is checked under the lock, the way `board.sh` counts it.
- `RUN_LIVE` blocks every action while a run on the task is live, with the
  definition shared with rule 4.
- Dead runs need a confirmation, and the action carries the reap command, so
  they are neither ignored nor allowed to block the task forever.
- A confirmation is needed for the operator's own agent's claims.
- Owner lines are sanitised, with an `ownerLine` → `parseOwner` → `board.sh`
  round trip test.
- Byte-preservation tests run on real task files.
- Placeholder detection is tested on the template's italic instruction,
  `*(pending)*`, `{{…}}`, empty, and a filled Result (T019).

---

## 8. Expanded test plan

### Unit (`npm test`)

- **`editFrontmatter`:**
  - changes only the named keys;
  - keeps comments, unknown keys, order, quoting, CRLF and the trailing
    newline;
  - appends missing keys inside the block;
  - throws when the closing `---` is missing;
  - a 1 MB single-line value completes in **under 2 s** (generous: a
    backtracking pattern would take minutes).
- **`resultSection` / `setResult`:**
  - the template instruction from `AA/backlog/T004` and `T012` counts as a
    placeholder, and so do `*(pending)*`, `{{…}}` and an empty section;
  - T019's Result counts as real;
  - a `### Result` heading is not matched;
  - a missing section is appended.
- **`ownerLine`:** strips `#`, quotes, `\r\n` and U+2028, and caps the length.
  A round trip through `parseOwner` gives the operator, `agesight` and `web`.
- **`commitSubject`:** limits, and never a sweep prefix.
- **`readTrail`:**
  - **live**: an unended run whose newest entry is 1 h old;
  - **dead**: an unended run 22 days old (the RSNA shape) and 3 days old with
    `stale_hours: 48`;
  - **ended**: the AGEIS T077 shape (3 opens and 4 ends, all runs ended), and a
    run resumed after its `end` (unended again);
  - **malformed**: an unparseable line, and a line without `run`;
  - the 1 MB cap, and `staleHours` defaulting to 24 without `AA.yml`.
- **`availability`:** the full matrix. No duplicate keys. Every `needs` has an
  input. Priority and Assign are disabled on AA boards with the E reason.

### Integration (real temporary repositories, `GIT_CONFIG_GLOBAL=/dev/null`)

- **Happy path for each action, in both layouts:**
  - `git show --name-status` (a rename on a move, M in place);
  - the frontmatter diff is limited to the named keys;
  - identity and trailer are present;
  - STATE.md is not in the commit;
  - the working tree and index are clean for the task paths;
  - other staged and unstaged files are byte-identical in `git diff` and
    `git diff --cached`.
- **Seam tests.** An agent `git commit` of an unrelated staged file, and an
  agent `git commit -a`, are run in each window:
  - W1, before the lock (the agent holds the lock → `GIT_BUSY`);
  - W2, under the lock before the CAS (the agent's command fails with
    `index.lock`; it is retried after release and commits only its own
    change);
  - W3, after the CAS before the working-tree write;
  - W4, after the working-tree write before the index install;
  - W5, after release (`commit -a` adds nothing of AGE Aris's as a revert).

  An **editor write** to the task file in W3 → `STALE`, with the ref rolled
  back and everything unchanged.

  A **plumbing `update-ref`** by "another writer" in W2 → the CAS is lost and
  all checks re-run against the new HEAD. Then:
  - an unrelated change succeeds;
  - a change to the task file → `STALE`;
  - a new claim on the task by another operator in that commit →
    `HELD_BY_OTHER`;
  - a commit that pushes WIP to the limit → `WIP_LIMIT`.

  Every seam test asserts exactly one of the two outcomes.
- **Crash and recovery.** A seam aborts without running `finally`:
  - in phase `locked`: recovery removes the lock (inode and nonce match) and
    puts back a renamed `<from>`; nothing was published;
  - after `update-ref` (`publishing`): recovery **adopts** the lock left
    behind (inode and nonce match the marker), rebuilds *N* from the current
    `.git/index`, and completes the write;
  - after the working-tree write (`worktree`): the same, and the index is
    installed;
  - an agent stages an unrelated file after the crash, which it can do only if
    the operator deleted the stale lock: the rebuilt *N* keeps that entry.

  Each case is recovered twice, and the second run changes nothing.
- **Lock identity:**
  - after the crash, the lock is deleted and another process creates a new
    `index.lock` with a reused inode; recovery leaves it, because the nonce
    differs;
  - a stolen lock in step 7 (the test deletes and recreates `index.lock`) →
    no install, the ref rolled back, the working tree restored, and
    `GIT_BUSY` with nothing changed.
- **The settle rule.** `update-ref` times out (a seam) with the ref at `H`,
  and again with the ref at `C`; the CAS back is lost (a plumbing writer moves
  the ref) → `INTERRUPTED`, with the marker kept and the index and working tree
  untouched.
- **Timeouts:** a git call under the lock that sleeps past 2 s, and a hold
  past the 3 s budget → settled per the rule.
  - A git child that ignores SIGTERM is killed after the grace period.
  - A seam that leaves `.git/refs/heads/<b>.lock` behind → `INTERRUPTED`,
    with that exact path in the message and the file not deleted.
- **`link()` probe:** a stubbed `link` that returns `EPERM` → switching on is
  refused with `UNSUPPORTED_REPO`, and no probe file is left behind.
- **Probe on every action:** `core.sparseCheckout` set *after* switching on →
  the next action is refused with `UNSUPPORTED_REPO`.
- **Dirty and git state:**
  - an unstaged, staged or untracked target → `DIRTY_FILE`;
  - a CRLF-converted file → `DIRTY_FILE`;
  - a detached HEAD, a conflicting rebase, `merge --no-commit`, a cherry-pick
    conflict, or an existing `index.lock` → `GIT_BUSY`;
  - another branch → `WRONG_BRANCH`.
- **Switch probe:** reftable, `core.sparseCheckout`, `index.sparse`,
  `core.splitIndex` → `UNSUPPORTED_REPO`. A linked worktree and a pre-commit
  hook are listed in the probe's disclosures.
- **No foreign code:** hooks, a filter driver, and `gpg.program` with
  `commit.gpgSign` leave no markers.
- **Protocol:**
  - another operator → `HELD_BY_OTHER`;
  - the operator's own agent → `CONFIRM` naming the session and its last sign
    of life, then the action with `confirmToken` (the owner line is kept); a
    stale token (the file changed) → `CONFIRM` again;
  - **a live run → `RUN_LIVE` on each of Claim, Release, Block, Unblock and
    Done**, even with a `confirmToken`;
  - **a dead run → `CONFIRM`, then the action with the warning
    `RUN_NOT_ENDED`**, whose remedy names the run id; the trail file is
    byte-identical afterwards;
  - **a malformed line → `CONFIRM` naming the line number, then
    `RUN_NOT_ENDED`** with the `ckpt.sh check` remedy;
  - an ended trail → Done with `TRAIL_NOT_RETIRED`;
  - WIP at the limit → Claim refused, while Done and Release are allowed;
  - the blocked limit → Block with `BLOCKED_OVER_LIMIT`;
  - a duplicate id → `DUPLICATE_ID`;
  - a `deaddrop/` folder → `LEGACY_BOARD`.
- **`board.sh` compatibility (with `backlog/`):** copy the template's
  `board.sh` and `ckpt.sh` into the temporary repository and check:
  - claim → IN PROGRESS with the operator;
  - done → DONE;
  - unblock → a new stint (documents §4);
  - `--check` exits 1, then 0 after `--write`.

  bash and jq are required, and the test fails with a clear message without
  them; it is never skipped.
- **Server:**
  - `/actions` needs the token;
  - errors carry `code` and `remedy`;
  - `AGESIGHT_TRACKED_WRITES=0` overrides the switch;
  - `PATCH` on a tracked task is still 409;
  - the stderr line is emitted for a refusal.
- **Parity:** each AGE Aris project action through `/actions` matches the
  equivalent `PATCH`.

### End-to-end (`npm run e2e`; headless Chrome; each run recorded in PROGRESS.md)

Puppeteer is not a dependency: it is loaded from `AGESIGHT_PUPPETEER` (the
cached install in the memory note), and Chrome from `AGESIGHT_CHROME`. The
script exits non-zero with instructions when either is missing. It starts
`createServer` on a temporary data folder with one AGE Aris project and two
temporary tracked repositories, one AA board with `backlog/` and one without.
It logs in through `/?token=`.

1. (T022) Drawer actions on the AGE Aris project. Focus returns afterwards.
2. (T023) Switching actions on shows the disclosures and the branch.
   Confirming enables the bar.
3. (T023) A keyboard-free claim from the drawer on each layout: a commit with
   `claim T001:` on the pinned branch, and the toast names the branch.
4. (T023) Block with a reason → Blocked column. Done with a placeholder Result
   asks for one line.
5. (T023) A refusal: the file is dirtied on disk → an inline alert with the
   remedy, no commit, and the drawer still open.
6. (T023) The operator's own agent claim, with a dead run → one confirmation
   that lists both reasons → done, and the toast shows the reap command. A
   live run → the action is disabled with its reason.
7. (T024) A keyboard-only claim from a card (`Tab` … `c`), with focus kept.
   The menu opens with Enter, moves with the arrows and closes with Esc.
   Drag maps to the same action.
8. (T024) At 390 px, `scrollWidth ≤ clientWidth`. No console errors and no CSP
   violations.

### Observability: what the operator sees

- **Success:** a toast, "Claimed T012 · a1b2c3d on deaddrop-migration · not
  pushed", plus any warning with its remedy. The commit appears "via ui" in
  the task timeline and in Activity (`cockpit.js:509`, `:585`).
- **Refusal:** an inline `role="alert"` at the control used, and a toast, with
  the message and the remedy. The task re-renders from a fresh read. A
  one-line stderr record is written.
- **Failure:** a 500 that says either "Nothing was changed" (refused, or
  rolled back) or `INTERRUPTED`: "Committed a1b2c3d, but the branch moved
  before AGE Aris finished; check `git status` for T012". In the second case
  the project header keeps a notice until it is dismissed. A stderr line names
  the step.
- **Where refusals are recorded:** only in the response, the UI and stderr.
  There is no persistent record until the writes-log follow-up.
- **Drift:** T025's STATE.md note.
- The project header always shows the switch state and the pinned branch.

---

## 9. ADR draft

**Title:** AGE Aris acts on tracked AA boards through one-commit task actions
made under git's index lock.

**Decision.**

- The hard constraint "never writes to a repository it tracks" is replaced by
  §2's narrower rule.
- On a tracked `AA/` board, in either layout, the operator can claim, release,
  block, unblock and finish tasks with one click or one key.
- Each action is one commit of one task file, made with git plumbing while
  `.git/index.lock` is held:
  - the tree is built from `HEAD`;
  - the ref is updated by compare-and-swap;
  - the working tree is written next, and the index is installed through the
    lock, which carries a nonce and is checked for theft first;
  - one settle rule, keyed on the ref's value, decides every failure after the
    CAS (complete, roll back, or report interrupted). Recovery runs the same
    rule from a marker written under the lock, and it is idempotent.
- A run that wrote within `stale_hours` and has not ended blocks every action.
  Dead runs need a confirmation, and the action carries the reap command.
- Commits go to a branch pinned when the operator switches actions on, after a
  dialog that discloses skipped hooks and other worktrees. They are authored
  as the repository's identity and never pushed.
- STATE.md is never written; the commit and the project page say what to do.
- Priority and Assign stay with AGE Aris projects, because they are not AA
  protocol fields.
- On AGE Aris projects the same actions reuse `updateTask`.
- In the UI, one action registry drives the drawer bar, the card menu, the
  keyboard and drag.

**Drivers.**

1. Safety where live agents commit.
2. Fidelity to both AA layouts and `board.sh`.
3. Operator speed with keyboard parity.

**Alternatives considered.**

- **Write mechanism.**
  - Working-tree `add`/`commit --only`, hardened or not (A1, A5): the bytes come
    from the working tree, and of the hooks, either they run repository code
    and a `--check` gate refuses every action, or they are off and the
    approach offers no fidelity gain.
  - Plumbing without a sync (A3): reverse diffs.
  - A separate worktree or branch (A4): invisible claims.
  - Plumbing that syncs the index after the CAS without the lock (v1): an
    agent's `commit` or `commit -a` inside the window reverts the change.
    Rejected by both reviews.
- **Runs:** treat every unended run as live (v2): nine RSNA tasks and two Gem4A
  tasks would be refused for good. Ignore the trail entirely: Done would land
  on a task whose run is still spending.
- **STATE.md:**
  - Running `board.sh` executes repository code.
  - A port would be a second dialect.
  - `_renderState` would cause a permanent `--check` failure.
  - Editing hand-kept rows would destroy prose (pending Q2).
- **Opt-in:** default on, or on at link time without the disclosures.
- **UX:** inline card controls, a palette only, drag only.
- **Fields:** `priority:` and `assignee:` written into AA files (pending Q1).

**Why chosen.**

- Holding git's own lock is the only way, short of git doing the commit, to
  exclude concurrent `commit` and `commit -a` across the whole write while
  still committing exact bytes and running no repository code.
- The settle rule turns every failure into one of three named outcomes.
  Ordinary races only ever produce the first two, and tests assert that.
- Branch pinning and the disclosures make where commits land a decision the
  operator made once, knowingly.
- Supporting the older layout is what makes the feature reach AGEIS, AGEION
  and RSNA.

**Consequences.**

- AGE Aris becomes a writer in repositories it does not own. A leaked API token
  reaches their task files (local, token-protected, never pushed, one file per
  commit, but still more blast radius).
- Agents may see a lock error lasting a few tens of milliseconds, at most 3 s.
  Unreferenced loose objects can accumulate until `gc`.
- Residual windows remain, listed in pre-mortem 1: a read-before/write-after
  lost update by another writer, a microsecond lock-theft window, and a lock
  left behind by a crash until restart.
- **Refusals are recorded only on stderr** and in the operator's UI until the
  writes-log follow-up. After the fact, git shows what AGE Aris committed but
  not what it refused.
- Acting past a dead run leaves its trail unended. The warning gives the reap
  command, and AGE Aris never writes the trail.
- Commits are unsigned. CRLF-converted task files, reftable repositories and
  sparse or split-index repositories are refused.
- `board.sh --check` reports stale after each action until `--write`. Hand-kept
  STATE.md lags until a person updates it.
- Done does not retire the checkpoint trail (`TRAIL_NOT_RETIRED`).
- An unblock restarts the task's age on `board.sh` boards, as a hand-written
  unblock does.
- Boards under `deaddrop/` or `pm/`, and full-form editing of tracked tasks,
  stay read-only.
- The card markup changes.
- `lib/tracked.mjs` is new, security-relevant git code, guarded by the seam
  and no-foreign-code tests.

**Follow-ups (not in this plan).**

- A hash-chained writes log, `/api/writes`, and an "AGE Aris writes" Activity
  filter.
- A "take over" (continue, rule 3) action.
- Reclaiming or releasing **stale claims** (rule 4).
- Kill/drop and Reopen.
- Appending to `## Notes`.
- The ⚑ Definition of Ready on Claim.
- A `?` shortcut sheet and a command palette.
- An opt-in to run `board.sh --write`.
- Raising with the AA convention that `board.sh` should not start a new stint
  on unblock.
- A5 as the fallback write path if A2 proves fragile.
- Writing to `deaddrop/` and `pm/` boards.
- Reftable and sparse support.
- Push behind its own confirmation.
- Dates and queue ranking.

---

## 10. Open questions for the user (each with a recommendation)

- **Q1. Priority and Assign on AA boards.** The AA protocol has no such fields,
  and `board.sh` and agents ignore them.
  - **Recommended:** offer both on AGE Aris projects only, and show them
    disabled on AA boards with the reason "AA is pull-based: claim it or leave
    it in the queue".
  - Alternative: write `priority:` and `assignee:` into AA task files as fields
    only AGE Aris reads. Either way, both follow the same rule.
- **Q2. A hand-kept STATE.md (AGEIS, AGEION, RSNA).** Their WORKFLOW.md says
  whoever changes a status updates the task's board line.
  - **Recommended:** AGE Aris leaves STATE.md alone, names the stale line in the
    commit body, and the project page says N changes are not on it yet.
  - Alternative: AGE Aris edits only the status cell of the task's row, which
    risks overwriting the prose people keep there.
- **Q3. The operator's own agents' claims.** Every open AGEIS task is held by
  an `adervark @k/…` session.
  - **Recommended:** allow Block, Unblock, Done and Release on them after a
    one-step confirmation naming the session and its last sign of life.
    Every action is refused while a run on the task is **live**, meaning it
    has not ended and wrote within `stale_hours`. A dead run adds itself to
    the same confirmation, and the action returns the reap command.
  - Alternative: refuse ("release it from the agent's session"), which leaves
    the operator unable to act on most AGEIS tasks from AGE Aris.

### Decided by the user, 2026-10-07

- **Q1:** the recommendation. Priority and Assign are offered on AGE Aris projects and shown disabled, with the reason, on AA boards.
- **Q2:** the recommendation. STATE.md is never written; the commit names the stale line and the project page lists the tasks whose line is behind (T025).
- **Q3:** the recommendation. Actions on the operator's own agents' claims go through one confirmation. They are always refused while that agent's run on the task is live.

Execution approval is still pending. When it is given, the first step is registering T021–T025 in `AA/backlog/` (rule 12), each with its acceptance criteria from §5 as its Definition of Ready.
