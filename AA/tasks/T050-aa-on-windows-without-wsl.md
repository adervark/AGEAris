---
id: T050
title: "/aa on Windows without WSL"
status: claimed
owner: adervark @k/edd32d65 2026-10-09 — native Windows paths, opener and hints in aa.sh
# type: one word; tasks of one type are timed together; `bug` counts as defect work
type: bug
# blockedReason: while blocked, one line saying what unblocks it; cleared on unblock
blockedReason: ""
depends: [T046]
created: 2026-10-09
---

# T050 — /aa on Windows without WSL

## Goal

On Windows, `/aa` works in the Git Bash that Claude Code runs commands in,
with no WSL.

## Context

- 2026-10-09: the operator asked why WSL is needed, and chose native Windows.
  T046 sends Git Bash (`MINGW*`, `MSYS*`, `CYGWIN*`) to WSL.
- From reading the code, untested on Windows:
  - `realpath` and `$HOME` give `/c/Users/…`, a form Node on Windows cannot
    open. That breaks tracking (`/api/projects/link`), the match against a
    project's stored path, the data folder and the log handed to Node.
    `cygpath -w` gives Node's form;
  - nothing opens the browser: no `xdg-open` or `open`. Windows has `start`
    through `cmd`;
  - Node's detached spawn opens a console window on Windows unless
    `windowsHide` is set;
  - prerequisites install with `winget`;
  - `ss` and `/proc` are missing, so the stale-server check already leaves the
    server alone.

## Steps

- [ ] In Git Bash, the paths handed to Node and to AGE Aris are Windows paths, and the stored project path is matched in that form.
- [ ] The browser opens through `cmd`, the server starts hidden.
- [ ] The prerequisite list gives `winget` lines.
- [ ] Tests on a stubbed Git Bash; docs say Windows works natively, untested on a real machine until someone runs it.

## Decision rules — fixed in advance

- No spend in `AA.yml` applies, apart from syncing the installed `/aa`
  (`global-config`, a trail entry first).
- Done means: on a stubbed Git Bash (`uname` says `MINGW64_NT-…`, a stub
  `cygpath`), `/aa` hands Node and the link request Windows paths, finds an
  already tracked project by its Windows path, opens the browser through
  `cmd`, and lists `winget` lines for what is missing; Linux behaves exactly
  as before; `npm test` and `npm run check` pass; an independent review leaves
  no open defect.
- It is not called tested on Windows until it has run on a Windows machine.

## Handoff — state at last stop

*Kept true while claimed, not written on the way out (rule 8).*

- **Last touched:** 2026-10-09, adervark @k/edd32d65 (claimed)
- **In flight:** editing `skills/aa/aa.sh`
- **On disk:** nothing
- **Resume with:** the Steps above
- **Next decision:** none

## Verify

`node --test tests/aa-script.test.mjs`, and on a Windows machine: install the
plugin, run `/aa` in a repository with a board, and the page opens on it.

## Result

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
