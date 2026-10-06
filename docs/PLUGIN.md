# agesight

An agent-first, human-auditable task board for Claude Code, kept entirely in git.

agesight is a Claude Code plugin that ships one skill, `deaddrop-init`. The skill scaffolds the **deaddrop** convention into any repository: a Kanban system in which coordination between AI agents happens through files and commits rather than through a server, a daemon, or two agents being awake at the same time.

## The problem

Agents working on one project never meet. A session dies mid-task, a headless worker wakes up with no history, a plan limit cuts you off and you return on another account, or a different harness picks the work up tomorrow. They need a fixed place where one leaves material and the next collects it. That place is the repository.

- A claim is a commit.
- A result is a commit.
- Two agents on one task is a merge conflict, by design.

## What you get

Running the skill adds this layout to your repo:

```
deaddrop/
  RULES.md            the protocol, one page, binding
  WHY.md              the reasons behind each rule
  deaddrop.yml        spend words, WIP limit, log, map (the only per-project file)
  STATE.md            hand-written NOW block plus a generated board
  ckpt.sh             writes and reads the checkpoint trail
  board.sh            renders the board: --write / --check
  backlog/            registered, not committed
  tasks/              past the commitment point; counts against WIP
  tasks/done/         delivered or killed
  checkpoints/        T###.jsonl trails for live tasks; _SCHEMA.md is the format
.claude/commands/     board.md, reclaim.md, checkpoint.md
AGENTS.md             session bootstrap (CLAUDE.md and GEMINI.md symlink to it)
```

## Key ideas

**The directory is the state.** A task in `backlog/` is an option that costs nothing to drop. Moving it to `tasks/` is the commitment point: from then on it counts against the work-in-progress limit and its age is measured. The `status:` field only adds detail within a column.

**The board is generated, never maintained.** Everything on it is derivable from task files, checkpoint trails, and git history. Exactly one region of `STATE.md`, the NOW block, is written by a human. `board.sh --check` exits non-zero when the generated region is stale, so it fits a pre-commit hook or a CI step. It compares structure rather than the clock, so it does not fire when nothing has happened.

**Checkpoints survive dead sessions.** Each task has an append-only JSONL trail. A run writes a `doing` entry before anything expensive or irreversible, a `did` entry after it, and an `end` entry whenever it stops. A `doing` that nothing closed is the most valuable line in the file: it turns "nobody knows" into "this exact thing was in flight, go and check it", and it prevents a successor from paying for the same work twice. Trail-only commits are prefixed `ckpt:` so real project history stays one `--invert-grep` away.

**Decision rules before the spend.** A task that will spend something the project cannot undo must carry its pass/fail criteria in the file before it can be claimed. The board marks tasks without them.

**Ownership follows the operator.** Claims belong to the git identity, not the session or the account plan. Switching accounts mid-task is a continuation, not a new claim.

**Flow metrics are computed.** WIP, work item age, cycle time, throughput, flow efficiency, and Little's Law are derived from git and the trails. Work item age is judged against the 85th percentile of this repository's own delivered cycle times.

**No sprints, estimates, or velocity.** Work arrives when a limit resets or a machine frees up. A WIP limit provides the same focus without a date to miss.

## Installation

Add the marketplace and install the plugin from within Claude Code:

```
/plugin marketplace add adervark/agesight
/plugin install agesight@agesight
```

Alternatively, clone this repository and point Claude Code at it as a local marketplace.

## Usage

From the repository you want to adopt the convention in, ask Claude Code to set up a task board, or invoke the skill directly:

```
/deaddrop-init
```

The skill will:

1. Refuse if `deaddrop/STATE.md` (or the legacy `pm/STATE.md`) already exists.
2. Create the directory layout and copy the rules, reasons, and scripts verbatim.
3. Ask what counts as a spend in your project and what the real WIP limit is, then fill in `deaddrop.yml`.
4. Merge the bootstrap into any existing `AGENTS.md` or `CLAUDE.md` instead of replacing it.
5. Seed real tasks from the conversation into `backlog/`, render the board, and commit.

Afterwards, day-to-day work uses three commands that the skill installs into the target repo:

| Command | Purpose |
|---|---|
| `/board` | Read-only review. Runs the board and trail checks, then names one next action. |
| `/reclaim [ID] [--release]` | Claim or reclaim a task: check the right to take it, verify the handoff, commit the claim before any work. |
| `/checkpoint [ID \| open \| did \| doing \| end \| close]` | Open, append to, review, or retire a task's checkpoint trail. |

Scripts, run from the target repo:

```sh
deaddrop/board.sh                 # print the board
deaddrop/board.sh --write         # regenerate the generated region of STATE.md
deaddrop/board.sh --check         # exit 1 if that region is stale
deaddrop/ckpt.sh live             # what was in flight when the last run stopped
deaddrop/ckpt.sh last <ID>        # newest trail entries for a task
deaddrop/ckpt.sh close <ID>       # digest the trail into the task's Result
```

## Requirements

- git
- bash
- `jq`

A harness that cannot run bash can still take part: the checkpoint format is the contract, and appending a valid line of JSON is equivalent to using the script.

## Repository layout

```
.claude-plugin/
  plugin.json             plugin manifest
  marketplace.json        single-plugin marketplace definition
skills/deaddrop-init/
  SKILL.md                install steps and what must survive any edit
  template/               files copied into the target repo
    RULES.md  WHY.md  SCHEMA.md  STATE.md  TASK.md  AGENTS.md
    deaddrop.yml  board.sh  ckpt.sh
    commands/             board.md  checkpoint.md  reclaim.md
```

## Design notes

- `RULES.md` is normative and complete. An agent that reads only that page works correctly.
- `WHY.md` holds the argument and the incidents behind each rule. Read it when you want to change a rule, not before you work.
- Every fact has one home. Files link to it rather than restating it, because restated prose is what drifts.
- The read-always path (bootstrap, rules, NOW block, one task file) is kept to roughly 180 lines. Everything else loads on demand.

## Template additions

`TASK.md` gained a `blockedReason:` key and a clearer `type:` comment, and `RULES.md` asks for a `blockedReason:` when a task moves to blocked. Both are additive: a task file without the key reads as having none, and gains it on its next edit through AGE Aris.

## Legacy naming

Repositories scaffolded before 2026-09-02 use `pm/` instead of `deaddrop/`. It is the same convention; leave the directory name alone unless you intend to migrate it.

## License

UNLICENSED. All rights reserved by the author.
