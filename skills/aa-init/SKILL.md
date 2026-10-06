---
name: aa-init
description: Scaffold the AA/ task-board convention into the current repo — a Kanban system kept in git, in any discipline. One page of rules, a backlog/tasks/done split where the directory IS the state, an append-only checkpoint trail per run so a dead session or a killed subagent still says what was in flight, and a STATE.md board that is GENERATED from the task files and git history rather than hand-maintained (board.sh --check fails when it is stale). Flow metrics — work item age, cycle time, throughput, flow efficiency, Little's Law — are computed, never written down. One AA.yml adapts it to the discipline. Use when the user wants a task board, a kanban board, or WIP limits in a project that has none (no AA/, nor deaddrop/ or pm/, its older names).
---

# aa-init — adopt the AA task-board convention in this repo

Agents on one project never meet, so they coordinate through a fixed place in
git: a claim is a commit, a result is a commit, and two agents on one task is a
merge conflict by design. The full argument is `template/WHY.md`.

This file is for **installing** the convention and for **editing this skill**.
It holds no rules; `template/RULES.md` does.

## The shape

```
AA/
  RULES.md            the protocol, one page, binding     <- read always
  WHY.md              the reasons, one section per rule   <- read on challenge
  AA.yml        spend words, WIP limit, log, map    <- the only per-discipline file
  STATE.md            NOW block (hand-written) + generated board
  ckpt.sh             writes and reads the trail
  board.sh            renders the board: --write / --check
  backlog/            registered, not committed
  tasks/              past the commitment point; counts to WIP
  tasks/done/         delivered or killed
  checkpoints/        T###.jsonl, live tasks only; _SCHEMA.md is the format
.claude/commands/     board.md, reclaim.md, checkpoint.md
AGENTS.md             bootstrap; CLAUDE.md and GEMINI.md symlink to it
```

## One home per fact

Every file has one job. When a fact is needed elsewhere, **link to its home; do
not restate it.** Restated prose is what drifts: before 2026-09-30 the `doing`
before / `did` after rule was written out in six files, and the trail's design
reasons were split between WHY.md and the schema.

| kind of content | its only home |
|---|---|
| a rule an agent must follow | `RULES.md` |
| the trail's format, and how to read and write it | `SCHEMA.md` (deployed as `checkpoints/_SCHEMA.md`) |
| why a rule or a format choice is what it is, and the incident behind it | `WHY.md`, in the section for that rule |
| a step-by-step procedure | `commands/*.md` |
| what differs per discipline | `AA.yml` |
| read order, identity, project constraints | `AGENTS.md` |
| why a line of code is written the way it is | a comment beside that code |
| how to install, and what must survive an edit | this file |

Two properties to protect above all others:

1. **Lean.** The read-always path — `AGENTS.md`, `RULES.md`, the NOW block, one
   task file — is ~180 lines. Everything else loads on demand. **Do not move
   commentary into `RULES.md`, and do not add a rule to `WHY.md`.**
2. **Nothing hand-maintained grows with task count.** The board is generated
   and exactly one region, NOW, is written by a human (WHY § the board that ate
   itself).

## Steps

1. **Refuse gently if `AA/STATE.md`, `deaddrop/STATE.md` or `pm/STATE.md` exists** —
   the repo has the convention. Point the user at it rather than re-scaffolding.
2. `mkdir -p AA/{tasks/done,backlog,checkpoints} .claude/commands`
3. Copy from `template/`:
   - `RULES.md`, `WHY.md` → `AA/`, and `SCHEMA.md` →
     `AA/checkpoints/_SCHEMA.md`. **Verbatim**; there is nothing to fill in.
   - `ckpt.sh`, `board.sh` → `AA/`, `chmod +x` both. Verbatim.
     **They need `jq`** — say so if the machine has none rather than scaffolding
     a script that cannot run.
   - `AA.yml` → `AA/`, **filling every `{{...}}` from the
     conversation.** Ask what a spend is here and what the real WIP limit is —
     one machine, one operator, one reviewer, one meter. `board.sh` complains on
     every run until the limit is set.
   - `STATE.md` → `AA/`, filling the NOW block only. **Leave the
     generated markers alone**; step 6 fills that region.
   - `AGENTS.md` → repo root, filling placeholders. If a real `CLAUDE.md` or
     `AGENTS.md` exists, **merge into it** — the bootstrap points at AA/,
     it does not replace project instructions.
   - `commands/*.md` → `.claude/commands/`. Committed, so every session and
     agent gets them from git. If `.gitignore` ignores `.claude/`, narrow it to
     `.claude/*` plus `!.claude/commands/`.
   - `TASK.md` is the skeleton for task files. Do not copy it as-is.
   - Append to `.gitattributes` (create if absent), so the trail stays out of
     review and two clones appending to one task's trail merge cleanly:

     ```
     AA/checkpoints/*.jsonl    diff merge=union linguist-generated=true
     ```
4. **Point `map:` at what already exists.** Most repos have a README, an
   ARCHITECTURE.md or an orientation doc that answers *"how does this work"*.
   Name **that** in `AA.yml` and in `AGENTS.md` step 0. Only write a new
   one if there is genuinely nothing.
5. Symlinks: `ln -s AGENTS.md CLAUDE.md`, `ln -s AGENTS.md GEMINI.md`. Skip any
   that exist as real files; on a Windows checkout, tell the user instead of
   forcing them.
6. **Seed real tasks** from the conversation into `backlog/`, using
   `template/TASK.md`. A task that will spend carries its decision rules before
   it can be claimed (rule 5). Where the project mixes plainly different kinds
   of work, give each a `type:`. Then render the board:

   ```sh
   AA/board.sh --write
   ```
7. Ensure the log named by `AA.yml` exists (default `PROGRESS.md`), with
   a title and a *"measurements land here as they happen"* note.
8. Offer the staleness gate, and let the user decide — it is their hook:

   ```sh
   # .git/hooks/pre-commit  (or a CI step)
   AA/board.sh --check || exit 1
   ```
9. Commit everything in one commit unless told otherwise.

## What must survive any edit to this skill

Each of these is argued in WHY.md; this list is so an edit cannot quietly drop
one.

- **`RULES.md` is normative and complete; `WHY.md` is neither.** An agent that
  reads only `RULES.md` must be able to work correctly.
- **The board is generated**, and `--check` compares structure, not the clock.
- **The format is the contract; the script is the fast path.** Never add a rule
  only the script can satisfy.
- **The commitment point is a file move**, so WIP cannot be faked and cannot
  drift from the board.
- **Ownership follows the operator** (the git identity), not the session or the
  account plan.
- **`ckpt.sh` commits with `--no-verify`**, and `close --delete` commits before
  it deletes. Both are load-bearing.
- **Checkpoint commits are prefixed `ckpt:`**, so the project's real history
  stays one `--invert-grep` away.

**Older names:** repos scaffolded before 2026-10-07 use `deaddrop/`, with
`deaddrop.yml` and `<!-- deaddrop:… -->` markers, and before 2026-09-02, `pm/`.
Same convention. Read `STATE.md` there and leave the directory name alone
unless asked to migrate it. Repos scaffolded before 2026-09-21 have one
`WORKFLOW.md` where this template has `RULES.md` + `WHY.md`, and no `board.sh`
or settings file.
