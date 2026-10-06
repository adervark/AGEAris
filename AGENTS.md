# AGE Aris — session bootstrap

*Canonical for every agent; `CLAUDE.md` and `GEMINI.md` are symlinks to it.
Edit here, once.*

AGE Aris is a local project-management app for people and agents, kept in
git: Node 22 with no dependencies, `server.mjs` serving the plain ES modules
in `public/`. It reads AA task boards, this repository's among them, and shows
the method they follow. The UI revamp is done on `feature/pm-cockpit`.

**Start here, in order:**

0. **New here, or back after a gap?** `README.md` — what this system is, stage by
   stage; `DESIGN.md` for the interface and `docs/METRICS.md` for the metrics. **Skip it if you already know**; everything below assumes you do. The
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

`PROGRESS.md` is the authoritative results log (rule 9).

**Your identity:** `<git user.name> @<profile>/<session>`. Claims belong to the
operator, so an account-plan switch mid-task is a continuation, not a new claim
(rule 3).

**Hard constraints, non-negotiable:**

- The product is **AGE Aris** and its board convention is **AA**, in anything a
  person reads. Older names stay only where data or integrations depend on
  them: the `AGESight-Via` trailer, the `X-AGESight-Token` header,
  `.agesight-data`, `AGESIGHT_*`, `@agesight/web`, the `agesight` package and
  plugin, and the `deaddrop/` and `pm/` boards AGE Aris still reads.
- Use only the owner's artwork, `docs/brand/age-aris-logo.png` and the planet
  cut from it. Never design or substitute a mark.
- No npm dependencies. The page runs under a strict CSP: no inline scripts or
  styles, images from the app itself and `data:` only.
- AGE Aris never writes to a repository it tracks.
- Task text is untrusted: no regex that can backtrack on it (no nested or
  end-anchored quantifiers), and inline markup stops at `MAX_INLINE`.
- `npm test` and `npm run check` pass before every commit.
