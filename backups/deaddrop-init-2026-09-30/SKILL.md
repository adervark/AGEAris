---
name: deaddrop-init
description: Scaffold the deaddrop/ task-board convention into the current repo — a Kanban system kept in git, in any discipline. One page of rules, a backlog/tasks/done split where the directory IS the state, an append-only checkpoint trail per run so a dead session or a killed subagent still says what was in flight, and a STATE.md board that is GENERATED from the task files and git history rather than hand-maintained (board.sh --check fails when it is stale). Flow metrics — work item age, cycle time, throughput, flow efficiency, Little's Law — are computed, never written down. One deaddrop.yml adapts it to the discipline. Use when the user wants a task board, a kanban board, or WIP limits in a project that lacks deaddrop/.
---

# deaddrop-init — adopt the task-board convention in this repo

Agents on one project never meet. A session dies mid-task, a headless worker
wakes with no history, a plan limit cuts you off and you return on another
account, a different harness picks up tomorrow. So they coordinate the way
people who cannot meet do: a fixed location both sides know, where one leaves
material and the next collects it. The drop site carries the whole protocol.

**Git is the coordination medium.** A claim is a commit, a result is a commit,
and two agents on one task is a merge conflict by design.

## Two properties to preserve above all others

**1. Lean.** The read-always path is ~120 lines: the bootstrap, `RULES.md`, the
NOW block, the task file. Everything else loads on demand — `WHY.md` when
somebody wants to argue with a rule, `SCHEMA.md` when writing a trail line by
hand, a command when invoked. **Do not move commentary into `RULES.md`, and do
not add a rule to `WHY.md`.**

**2. Nothing hand-maintained grows with task count.** This is the rule the
convention's own reference repo broke: it carried *"STATE.md stays under one
screen"* and reached **804 lines**, of which twenty were current. So the board
is **generated** — `board.sh --write` renders it, `--check` fails when it is
stale — and exactly one region, NOW, is written by a human. Put the gate where
the drift is.

## The shape

```
deaddrop/
  RULES.md          the protocol, one page, binding          <- read always
  WHY.md            the incidents that earned each rule      <- read on challenge
  deaddrop.yml      spend words, WIP limit, log, map         <- the ONLY per-discipline file
  STATE.md          NOW block (yours) + generated board
  ckpt.sh           the trail                                <- what agents call
  board.sh          the render, --write / --check
  backlog/          registered, not committed. No owner.
  tasks/            past the commitment point. Counts to WIP.
  tasks/done/       delivered or killed.
  checkpoints/      T###.jsonl, one line per event, live tasks only
```

**The location is the state.** Moving a file from `backlog/` to `tasks/` *is*
the commitment point, so a claim is a `git mv` plus an owner line, committed
before any work. `status:` refines a column; it never overrides one. This is
deliberate — a status field that can disagree with the directory will.

**`deaddrop.yml` is the entire discipline-portability mechanism.** The rules are
identical everywhere; the adapter names what a *spend* is here — `gpu-hour` and
`submission` in a lab, `filing` and `client-hour` in a law firm, `deploy` and
`customer-email` in a build, `beta-reader-pass` for a novel. Rules 5 and 6 key
off that word and nothing else.

## Steps

1. **Refuse gently if `deaddrop/STATE.md` or `pm/STATE.md` already exists** —
   the repo has the convention. Point the user at it rather than re-scaffolding.
2. `mkdir -p deaddrop/{tasks/done,backlog,checkpoints} .claude/commands`
3. Copy from `template/`:
   - `RULES.md`, `WHY.md`, `SCHEMA.md` → `deaddrop/` **verbatim**. They are
     generic; there is nothing to fill in. `SCHEMA.md` goes to
     `deaddrop/checkpoints/_SCHEMA.md`.
   - `ckpt.sh`, `board.sh` → `deaddrop/`, `chmod +x` both. Verbatim.
     **They need `jq`** — say so if the machine has none rather than scaffolding
     a script that cannot run.
   - `deaddrop.yml` → `deaddrop/`, **filling every `{{...}}` from the
     conversation.** Ask what a spend is here and what the real WIP limit is —
     one machine, one operator, one reviewer, one meter. A board with no limit
     is a push queue, and `board.sh` says so on every run until it is set.
   - `STATE.md` → `deaddrop/`, filling the NOW block only. **Leave the
     generated markers alone**; step 6 fills that region.
   - `AGENTS.md` → repo root, filling placeholders. If a real `CLAUDE.md` or
     `AGENTS.md` exists, **merge into it** — the bootstrap points at deaddrop/,
     it does not replace project instructions.
   - `commands/*.md` → `.claude/commands/`. They are prompts, not scripts;
     committed, so every session and agent gets them from git.
   - `TASK.md` is the skeleton for task files. Do not copy it as-is.
   - Append to `.gitattributes` (create if absent), so the trail stays out of
     the way of review and two clones can append to one run file without a
     conflict:

     ```
     deaddrop/checkpoints/*.jsonl    diff merge=union linguist-generated=true
     ```
4. **Point `map:` at what already exists.** Most repos have a README, an
   ARCHITECTURE.md or an orientation doc that answers *"how does this work"*.
   Name **that** in `deaddrop.yml` and in `AGENTS.md` step 0. Only write a new
   one if there is genuinely nothing.
5. Symlinks: `ln -s AGENTS.md CLAUDE.md`, `ln -s AGENTS.md GEMINI.md`. Skip any
   that exist as real files; on a Windows checkout, tell the user instead of
   forcing them.
6. **Seed real tasks** from the conversation, using `template/TASK.md`, into
   `backlog/`. A task that will spend must carry its decision rules before it
   can be claimed — that is the Definition of Ready, and the board marks one
   that lacks it `⚑`. Where the project mixes plainly different kinds of work,
   give each a `type:` so cycle times are only compared with their own kind.
   Then render the board:

   ```sh
   deaddrop/board.sh --write
   ```
7. Ensure the log named by `deaddrop.yml` exists (default `PROGRESS.md`), with
   a title and a *"measurements land here as they happen"* note.
8. Offer the staleness gate, and let the user decide — it is their hook:

   ```sh
   # .git/hooks/pre-commit  (or a CI step)
   deaddrop/board.sh --check || exit 1
   ```
9. Commit everything in one commit unless told otherwise.

## What must survive any edit to this skill

- **`RULES.md` is normative and complete; `WHY.md` is neither.** An agent that
  reads only `RULES.md` must be able to work correctly.
- **The board is generated.** If someone hand-edits below the marker, the next
  `--write` discards it and `--check` fails in CI. That is the design, not a
  wart.
- **The format is the contract; the script is the fast path.** A trail line
  appended by hand with `jq` is equally valid, and a harness that cannot run
  bash can still take part. Never add a rule only the script can satisfy.
- **The commitment point is a file move**, so WIP cannot be faked and cannot
  drift from the board.
- **Ownership follows the operator** (the git identity), not the session or the
  account plan — which is what makes a mid-task plan switch a continuation
  rather than a 24 h lock-out.
- **`doing` before the act, `did` after, `end` whenever you stop.** A subagent's
  brief carries this verbatim or the trail is not written at all.
- **Trails are retired on close** (`ckpt.sh close ID --delete`, which commits
  first). Git keeps them, so the tree only ever holds live tasks.
- **Checkpoint commits are prefixed `ckpt:`**, so the project's real history
  stays one `--invert-grep` away.

**Legacy name:** repos scaffolded before 2026-09-02 use `pm/`. Same convention.
Read `pm/STATE.md` there and leave the directory name alone unless asked to
migrate it.
