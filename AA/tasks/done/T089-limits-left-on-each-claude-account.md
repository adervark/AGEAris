---
id: T089
title: "The limits left on each Claude account"
status: done
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

- [x] `lib/limits.mjs`: find the accounts, read each token, call the
      endpoint, cache, and say plainly when an account cannot be read.
- [x] `GET /api/limits`, behind the API token like every other route;
      `?refresh=1` bypasses the cache.
- [x] The Agents page shows one row per account.
- [x] `/aa limits` prints the same table (`skills/aa/aa.sh`, `SKILL.md`).
- [x] Tests on temporary home folders with a stubbed fetch: no network.
- [x] README: the outbound call and what it reads, under "Storage and
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

- **Last touched:** 2026-10-22, adervark @default/1f16c0d5: every step
  built and committed.
  - `npm test` (550, 0 failing) and `npm run check` pass. Read live on this
    machine: `default`, `b` and `k` read; `v` shows expired (its token
    lapsed 12:38Z, Claude Code has not run there since).
  - The accounts are read one after another: read together, connections
    to api.anthropic.com timed out in Node's dual-stack race (ETIMEDOUT
    in ~500 ms).
  - The endpoint answers 429 after a few reads in quick succession. That
    was only from probing while building it, but it is why the 5-minute
    cache matters.
  - Screenshots, wide and phone, no console errors and no sideways scroll.
- **Not verified:** that the numbers agree with `/usage` inside each
  profile (Verify, below). They come from the same endpoint.
- **Closed** 2026-10-22 18:03Z: `/aa limits` read `default`, `b` and `k`
  live, with `b` the most left; `v` expired.
- **In flight:** nothing
- **On disk:** nothing uncommitted

## Verify

`/aa limits` and the Agents page list the four accounts with the same
numbers, and those agree with Claude Code's `/usage` in each profile.

## Result

**Done (2026-10-22), `3c08f3a`.** Every account on this machine shows its
session and weekly use and their resets, on the Agents page's Account
limits tab, from `GET /api/limits`, and from `/aa limits`, with the one
that has the most left named.

- `lib/limits.mjs` reads the accounts one after another; read together,
  connections to api.anthropic.com timed out in Node's dual-stack race.
- An expired token is never refreshed; the row says so and keeps its last
  good reading. Nothing under `~/.claude*` is written, and no token or
  email reaches a reading (tested).
- Readings are held 5 minutes per account, a forced read once a minute.
  The endpoint answers 429 to a few quick reads in a row, which is why.
- 8 new tests on temporary home folders with a stubbed fetch; `npm test`
  550 of 550, `npm run check` clean. Screenshots, wide and phone: no
  console errors, no sideways scroll.
- **Not verified:** agreement with `/usage` inside each profile. The
  numbers come from the endpoint `/usage` reads.

**Spend:** none.

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
