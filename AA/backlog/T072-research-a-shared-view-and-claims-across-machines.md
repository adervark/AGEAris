---
id: T072
title: "Research: how a team shares one view and claims work across machines"
status: open
owner: —
# type: one word; tasks of one type are timed together; `bug` counts as defect work
type: research
# blockedReason: while blocked, one line saying what unblocks it; cleared on unblock
blockedReason: ""
depends: []
created: 2026-10-13
---

# T072 — Research: how a team shares one view and claims work across machines

## Goal

Sourced findings on how other tools give a team one view of many git
repositories, and how they settle a race between machines for the same work,
each weighed against AGE Aris's constraints. It ends in a starting point for
each open question of T066 (the team hub) and T067 (claims across machines),
the two designs of the brain's team half, which have no research behind them.
Nothing is built and nothing is decided here; those two designs decide.

## Context

- 2026-10-13, the operator asked whether the brain's plan has a line for
  research. It has none: §4 weighs five options, all of them built on AGE
  Aris's own code, and nothing looked at how other tools do it. The operator
  chose this scope, team scale, over prior art for orient.
- From T052, the agent's brain design:
  [`docs/plans/agent-brain.md`](../../docs/plans/agent-brain.md), §5.7 (what a
  team lacks until the hub) and §6 (claims across machines). T029 is the model
  for a research task here.
- The constraints every finding is weighed against:
  - no npm dependencies, only Node 22's own modules (AGENTS.md);
  - git is the lock and the truth; a central service as the authority was
    rejected (§4, option B);
  - AGE Aris never pushes (AGENTS.md);
  - a hub sees only pushed commits, never working-tree trails, so it never
    emits `release` for someone else's claim (§5.7);
  - the claim rule is a per-board `AA.yml` key, never a fork of RULES.md
    (T067), and `push` is a spend here (`AA/AA.yml`).

## Steps

- [ ] **One view for a team (T066).** How tools that read many git
      repositories serve a team from one place: network exposure, TLS,
      per-person auth, mirroring hundreds of repositories (bare mirrors,
      partial clone, batched blob fetch), the ref each one reads per
      repository, and freshness (webhooks or polling). Candidates: Gitea or
      Forgejo, Sourcegraph, Gerrit, Backstage, and identity proxies such as
      Tailscale Serve.
- [ ] **Claims across machines (T067).** How systems claim or lock work over
      git, or beside it, when two machines race for the same item: a
      compare-and-swap on a ref (`push --force-with-lease`, `push --atomic`),
      Git LFS file locks, data kept in refs (git-bug, git-appraise), and
      git-backed trackers built for agents (beads, Backlog.md). For each: what
      a lost race looks like to the loser, what needs a server, what needs a
      push, and how a claim made on another machine shows it is still alive.
- [ ] Write the findings to `docs/plans/team-scale.md`: for each question,
      what exists, its source, its fit against the constraints above, and a
      starting point for the design, or "nothing fits".

## Decision rules — fixed in advance

- No spend: web research and reading only; no subagents.
- Every claim about how a tool works carries a source; a vendor's own material
  is marked as such.
- An approach that needs an npm dependency, a central authority or a push by
  AGE Aris is recorded as rejected, with the constraint it breaks, and is not
  proposed.
- Done means the findings are written, each question in the Steps has a
  starting point or "nothing fits", and the operator has them. T066 and T067
  are not edited here; each reads the findings when it is claimed.

## Handoff — state at last stop

*Kept true while claimed, not written on the way out (rule 8).*

- **Last touched:** 2026-10-13, registered
- **In flight:** nothing
- **On disk:** nothing
- **Resume with:** the Steps above
- **Next decision:** none

## Verify

Every finding in `docs/plans/team-scale.md` cites a source, and each of T066's
and T067's open questions has a starting point or "nothing fits".

## Result

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
