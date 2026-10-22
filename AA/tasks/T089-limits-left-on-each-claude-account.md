---
id: T089
title: "The limits left on each Claude account"
status: claimed
owner: adervark @k/4279585a 2026-10-22 — limits per Claude account: lib, API, Agents page, /aa limits
# type: one word; tasks of one type are timed together; `bug` counts as defect work
type: feature
# blockedReason: while blocked, one line saying what unblocks it; cleared on unblock
blockedReason: ""
depends: []
created: 2026-10-22
---

# T089 — The limits left on each Claude account

## Goal

AGE Aris shows, for every Claude account signed in on this machine, how much
of its session (5-hour) and weekly limits is used and when each resets. A
person sees it on a page; an agent gets the same numbers from the API and
from `/aa limits`, so it can check headroom before it spends and choose the
account with the most left.

## Context

- 2026-10-22: T086's three reconcilers all died on one account's session
  limit before writing a line. Nothing on screen said the account was near
  it, or that three others had room.
- Four accounts are signed in here: `~/.claude` (with `~/.claude.json`),
  `~/.claude-b`, `~/.claude-k` and `~/.claude-v`, each a Claude Code config
  folder holding `.credentials.json` (`claudeAiOauth`) and `.claude.json`
  (`oauthAccount`).
- Claude Code reads its own limits from `GET
  https://api.anthropic.com/api/oauth/usage` with the account's OAuth access
  token and `anthropic-beta: oauth-2025-04-20`. Probed once for `~/.claude-k`
  on 2026-10-22: `five_hour` and `seven_day`, each `utilization` (percent)
  and `resets_at`; `seven_day_opus` and `seven_day_sonnet` when the plan has
  them; `extra_usage`.
- The operator approved the approach on 2026-10-22: read the token, call the
  endpoint, as described below. It is AGE Aris's first outbound call.

## Steps

- [ ] `lib/limits.mjs`: find the accounts, read each token, call the
      endpoint, cache, and say plainly when an account cannot be read.
- [ ] `GET /api/limits`, behind the API token like every other route;
      `?refresh=1` bypasses the cache.
- [ ] The Agents page shows one row per account.
- [ ] `/aa limits` prints the same table (`skills/aa/aa.sh`, `SKILL.md`).
- [ ] Tests on temporary home folders with a stubbed fetch: no network.
- [ ] README: the outbound call and what it reads, under "Storage and
      behavior".

## Decision rules — fixed in advance

- No spend in `AA.yml` applies: nothing is pushed, and nothing under
  `~/.claude*` is written. Reading the credentials is not `global-config`;
  writing them would be.
- Done means:
  - every account found shows its session and weekly use and their resets,
    or a plain reason it cannot (`expired`, `no token`, `error: …`);
  - **an expired token is never refreshed**: refreshing rotates the
    refresh token Claude Code keeps, and could sign that account out. The
    row says so and shows the last good reading, if any;
  - nothing under `~/.claude*` is written; the token never reaches the
    browser, a log, the data folder or git;
  - results are cached for 5 minutes per account, and a forced refresh is
    held to once a minute;
  - the API and `/aa limits` give the same numbers as the page;
  - `npm test` and `npm run check` pass, and the board is current.

## Handoff — state at last stop

*Kept true while claimed, not written on the way out (rule 8).*

- **Last touched:** 2026-10-22, claimed; building `lib/limits.mjs` first
- **In flight:** nothing
- **On disk:** nothing uncommitted

## Verify

`/aa limits` and the Agents page list the four accounts with the same
numbers, and those agree with Claude Code's `/usage` in each profile.

## Result

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
