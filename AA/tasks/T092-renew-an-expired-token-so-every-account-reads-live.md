---
id: T092
title: "Renew an expired token, so every account reads live"
status: in_progress
owner: adervark @default/1f16c0d5 2026-10-22 — renew a lapsed token and write it back
# type: one word; tasks of one type are timed together; `bug` counts as defect work
type: feature
# blockedReason: while blocked, one line saying what unblocks it; cleared on unblock
blockedReason: ""
depends: [T089, T091]
created: 2026-10-22
---

# T092 — Renew an expired token, so every account reads live

## Goal

An account whose access token has lapsed still shows live limits: AGE Aris
renews the token the way Claude Code does and saves the renewed sign-in back
into that profile, so Claude Code there carries on signed in.

## Context

- T089 left an expired account unread ("expired: Claude Code renews the
  token the next time it runs in this profile; AGE Aris never does"), because
  renewing rotates the refresh token Claude Code keeps. The operator
  (2026-10-22), on that message: "I dont want this I want live".
- Renewing without writing back would sign the profile out, so the renewed
  sign-in is written back, as Claude Code itself and the OMC HUD (already in
  every profile here) do: `POST https://platform.claude.com/v1/oauth/token`
  with `grant_type=refresh_token`, Claude Code's public client id.

## Decision rules (written before the spend)

- Spend: `global-config` — AGE Aris writes `~/.claude*/.credentials.json`.
  The operator's word above authorises it, for this and only this file.
- Only the three token fields (`accessToken`, `refreshToken`, `expiresAt`)
  change; every other field and the file's mode (0600) stay. The write is a
  temporary file renamed over the old one.
- Renew only a token that has lapsed. Re-read the file just before renewing
  and just before writing: if Claude Code renewed it meanwhile, use theirs and
  write nothing.
- A refused renewal leaves the file untouched and says to sign in again.
- No token reaches a reading, an error, a log or git.

## Steps

- [ ] `lib/limits.mjs`: renew a lapsed token, write it back, then read.
- [ ] Tests: renewal and write-back with other fields kept; Claude Code
      renewing first; a refused renewal; no refresh token.
- [ ] README: the outbound calls and the one write.
- [ ] Live: `v` reads with numbers, and Claude Code in `v` still signed in.
