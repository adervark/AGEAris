---
id: T050
title: "/aa on Windows without WSL"
status: done
owner: adervark @k/be648959 2026-10-09 — native Windows paths, opener and hints in aa.sh (was: adervark @k/edd32d65 2026-10-09, same work, before a session switch)
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

- [x] In Git Bash, the paths handed to Node and to AGE Aris are Windows paths, and the stored project path is matched in that form.
- [x] The browser opens through `cmd`, the server starts hidden.
- [x] The prerequisite list gives `winget` lines.
- [x] Tests on a stubbed Git Bash; docs say Windows works natively, untested on a real machine until someone runs it.

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

- **Last touched:** 2026-10-09, adervark @k/be648959 (done)
- **In flight:** nothing
- **On disk:** nothing
- **Resume with:** nothing
- **Next decision:** none

## Verify

`node --test tests/aa-script.test.mjs`, and on a Windows machine: install the
plugin, run `/aa` in a repository with a board, and the page opens on it.

## Result

**Done; not tested on a Windows machine.** In Git Bash (`MINGW*`, `MSYS*`,
`CYGWIN*`) `/aa` no longer sends the user to WSL. The paths it hands Node (data
folder, log) and the link request go through `cygpath -w`. A tracked project
is matched on its Windows path, ignoring letter case. The page opens through
`cmd.exe /c start` with MSYS path conversion off, the server and every git
child it spawns start with `windowsHide`, and missing prerequisites get
`winget` lines, with a reminder to restart Claude Code. jq output is stripped
of CR on Windows, since a native `jq.exe` writes CRLF; this uses `tr`, not
`-b`, which jq 1.6 lacks. `field()` reads CRLF task files.
`.gitattributes` keeps `*.sh`, `AA/**` and `skills/**` LF, so a Git for Windows
clone (autocrlf) can still run the scripts. `aa-init` adds the `AA/**` line to
new boards. A project id that is not a UUID goes to no browser opener, on any
OS. `lib/agents.mjs` no longer re-initialises the registry on Windows, where
git prints `C:/…`.

Against the decision rules:

- On a stubbed Git Bash (`uname` says `MINGW64_NT-10.0-26100`, with a stub
  `cygpath`, a jq that writes CRLF and rejects `-b`, and stub `curl` and
  `cmd.exe`): Node gets Windows paths for the data folder and the log, the
  link request carries the Windows path, a project stored under its
  upper-cased Windows path is found without a second link, the page opens
  through `cmd`, and missing tools get `winget` lines. Six new tests in
  `tests/aa-script.test.mjs`, ten there in all. Putting `-b` back fails three.
- Linux is unchanged, apart from the UUID guard, which only stops ids the
  server itself rejects.
- `npm test` 523 of 523 and `npm run check` pass.
- Independent review, three rounds over two sessions. Round 1 found: CRLF
  checkouts (blocking); git children without `windowsHide`, and CR from jq in
  the project id (should-fix); and CRLF task files, an unquoted path in
  `SKILL.md`, the docs' wording and test gaps (nits). Round 2 confirmed those
  fixed and found: jq 1.6 has no `-b`, and the skill templates were not
  `eol=lf` (should-fix); an unvalidated id reaching `cmd`, and the registry
  path compare (nits). Round 3: all fixed, no open defect. Its last nit, that
  `resolve('')` gives the current folder, was fixed as suggested and not
  reviewed again.
- Known limits, not fixed. Case-folding is ASCII only. `cygpath -w` keeps a
  `subst` or mapped drive letter, and Node's realpath resolves it, so such a
  repository is not matched and `/aa link` gets "already tracked". After an
  update, `/aa` does not restart an old server on macOS or Windows: T051.
- Spends: reviewer subagent runs; the installed `~/.claude/skills/aa/` synced
  (`diff -r` empty). No push.
- Trail digest (the full trail is in git, commit 76bfde7):
  - **edd32d65** (session @k/edd32d65): the implementation and round-1
    fixes, uncommitted · cost one reviewer run · left: the session stopped
    during round 2
  - **edd32d65.efae** (reviewer @k/edd32d65): nothing · cost local CPU,
    temp dirs removed · left: round-1 report; died in round 2, reaped by
    be648959
  - **be648959** (session @k/be648959): round-2 fixes, `lib/agents.mjs`,
    the installed /aa · cost two reviewer rounds, global-config · left:
    nothing
  - **be648959.c759** (reviewer @k/be648959): nothing · cost local CPU;
    autocrlf clones and a bash 3.2.48 build in the scratchpad, removed · left:
    rounds 2 and 3, no open defect
- Log: PROGRESS.md, 2026-10-09 — T050.

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
