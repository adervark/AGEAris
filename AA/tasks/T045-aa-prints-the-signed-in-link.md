---
id: T045
title: "/aa prints the signed-in link: the plain link gave a sign-in error"
status: claimed
owner: adervark @k/edd32d65 2026-10-09 — aa.sh prints the token link
# type: one word; tasks of one type are timed together; `bug` counts as defect work
type: bug
# blockedReason: while blocked, one line saying what unblocks it; cleared on unblock
blockedReason: ""
depends: [T018, T027]
created: 2026-10-09
---

# T045 — /aa prints the signed-in link: the plain link gave a sign-in error

## Goal

The link `/aa` prints opens AGE Aris in any browser, including one that has
never signed in.

## Context

- 2026-10-09: the operator asked to pull up the board, opened the printed
  link `http://127.0.0.1:4310/#project/…` and got a sign-in error. The API
  takes the token only from the `agesight_token` cookie or the header, and the
  cookie is set only by `/?token=…`. `aa.sh` kept the token off the screen and
  put it in the URL only for `/aa open`, so the printed link worked only in a
  browser that had already signed in.
- The operator chose to print the signed-in link. `server.mjs` already says the
  token is no barrier against processes running as the operator, and the
  server prints the sign-in link to its log at every start.
- The sign-in handler answers 303 to `/` with no fragment, so the browser keeps
  `#project/…` across the redirect.
- `skills/aa/aa.sh`; the installed copy is `~/.claude/skills/aa/` (a copy, not
  a link; `~/.claude-{b,k,v}/skills` link to `~/.claude/skills`).

## Steps

- [ ] `aa.sh` prints `$URL/?token=…#project/$ID`, and `open` opens that same link.
- [ ] The "running but not tracked" line gives the signed-in link too.
- [ ] Header comment and `SKILL.md` say the link signs in.
- [ ] Sync the installed copy.

## Decision rules — fixed in advance

- Spend: `global-config`, the sync to `~/.claude/skills/aa/`. A trail is
  opened before it. No push, no fan-out, no data migration.
- Done means: in a fresh browser profile with no cookie, the printed link
  lands on the project page with `/api/settings` answering 200 (headless
  Chrome); `diff -r skills/aa ~/.claude/skills/aa` is empty; `npm test` and
  `npm run check` pass on the commit.

## Handoff — state at last stop

*Kept true while claimed, not written on the way out (rule 8).*

- **Last touched:** 2026-10-09, adervark @k/edd32d65 (claimed)
- **In flight:** editing `skills/aa/aa.sh`
- **On disk:** nothing uncommitted beyond this claim
- **Resume with:** the Steps above
- **Next decision:** none

## Verify

Fresh headless Chrome profile: open the printed link, end on
`/#project/<id>`, the page loads the project, no 401.

## Result

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
