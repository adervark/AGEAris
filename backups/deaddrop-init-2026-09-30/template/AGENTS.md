# {{PROJECT NAME}} — session bootstrap

*Canonical for every agent; `CLAUDE.md` and `GEMINI.md` are symlinks to it.
Edit here, once.*

{{Two or three sentences: what this project is, and its headline status.}}

**Start here, in order:**

0. **New here, or back after a gap?** `{{MAP}}` — what this system is, stage by
   stage. **Skip it if you already know**; everything below assumes you do. The
   board says what is being worked on, never what there is to work on.
1. `deaddrop/STATE.md` — the board. The NOW block is hand-written; everything
   below it is rendered by `deaddrop/board.sh`, which is also how you get it
   fresh. **If WIP is over the limit, the next action is to finish or release
   something — not to claim.**
2. `deaddrop/RULES.md` — the protocol, one page, binding. The reasoning behind
   each rule is in `deaddrop/WHY.md`; read that when you want to argue with one,
   not before you work.
3. Your task file in `deaddrop/tasks/`. It links the deeper context it needs.
4. `deaddrop/ckpt.sh live` — what runs have already done here, and whether
   anything was in flight when the last one stopped. **Check it before you spend
   anything; you may be about to buy something twice.**

`{{LOG}}` is the authoritative results log — append to it as you measure, never
at session end.

**Your identity:** `<git user.name> @<profile>/<session>`. Claims belong to the
**operator**, not the session, so switching account plans mid-task is a
continuation you may pick up immediately (rule 3) — not a new claim, and not a
stale one.

**What a *spend* means here** is listed in `deaddrop/deaddrop.yml`. Rules 5
(decision rules first) and 6 (checkpoint first) key off that list and nothing
else.

**If you spend, or spawn a subagent, you checkpoint** — one append-only trail
per task under `deaddrop/checkpoints/`, written with `deaddrop/ckpt.sh`: a
`doing` *before* the act, a `did` after it, an `end` whenever you stop. A
subagent dies with its parent and its report reaches one reader once; the trail
is what survives.

Checkpoint commits are prefixed `ckpt:`, so the project's real history stays
`git log --invert-grep --grep='^ckpt: '`.

**Hard constraints, non-negotiable:**

- {{Project-specific constraints an agent could violate expensively — budgets,
  forbidden operations, noise thresholds, data-handling rules. If there are
  none yet, say so rather than leaving the placeholder.}}
