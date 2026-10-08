# {{PROJECT NAME}} — session bootstrap

*Canonical for every agent; `CLAUDE.md` and `GEMINI.md` are symlinks to it.
Edit here, once.*

{{Two or three sentences: what this project is, and its headline status.}}

**Start here, in order:**

0. **New here, or back after a gap?** `{{MAP}}` — what this system is, stage by
   stage. **Skip it if you already know**; everything below assumes you do. The
   board says what is being worked on, never what there is to work on.
1. `AA/STATE.md` — the board. The NOW block is hand-written; everything
   below it is rendered by `AA/board.sh`, which is also how you get it
   fresh. **If WIP is over the limit, the next action is to finish or release
   something — not to claim.**
2. `AA/RULES.md` — the protocol, one page, binding. What counts as a
   *spend* here is in `AA/AA.yml`.
3. Your task file in `AA/tasks/`. It links the deeper context it needs.
4. `AA/ckpt.sh live` — what runs have already done here, and whether
   anything was in flight when the last one stopped. **Check it before you spend
   anything; you may be about to buy something twice.**

`{{LOG}}` is the authoritative results log (rule 9).

**Your identity:** `<git user.name> @<profile>/<session>`. Claims belong to the
operator, so an account-plan switch mid-task is a continuation, not a new claim
(rule 3).

**Hard constraints, non-negotiable:**

- {{Project-specific constraints an agent could violate expensively — budgets,
  forbidden operations, noise thresholds, data-handling rules. If there are
  none yet, say so rather than leaving the placeholder.}}
