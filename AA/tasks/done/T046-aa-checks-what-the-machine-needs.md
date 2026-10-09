---
id: T046
title: "Install in one line: /aa names everything the machine is missing, at once"
status: done
owner: adervark @k/edd32d65 2026-10-09 — prerequisite check in aa.sh, install docs
# type: one word; tasks of one type are timed together; `bug` counts as defect work
type: bug
# blockedReason: while blocked, one line saying what unblocks it; cleared on unblock
blockedReason: ""
depends: [T045]
created: 2026-10-09
---

# T046 — Install in one line: /aa names everything the machine is missing, at once

## Goal

Installing is one line, and the first `/aa` names every missing prerequisite
together, with the command that installs it, before anything else runs.

## Context

- 2026-10-09: the operator found the install cumbersome and multistage. Two
  plugin commands, then Node 22, git, jq and curl, none of them checked: a
  missing one surfaces later, one at a time, naming no fix. Without jq,
  `board.sh` stops with `ckpt: jq is required`; without Node, `/aa` says only
  that AGE Aris "did not answer". The operator chose: install stays one line,
  `/aa` checks everything up front.
- Two plugin commands are Claude Code's (a marketplace, then the plugin); in a
  terminal they chain into one line. Checked 2026-10-09 on a clean
  `CLAUDE_CONFIG_DIR`: it installs `aa`, `aa-init` and the app.
- `aa.sh` starts the server with `setsid -f`, which macOS does not ship, so
  `/aa` cannot start AGE Aris there. Node's detached spawn makes the same new
  session on Linux and macOS.
- On Windows, Claude Code's bash is Git Bash: `realpath` gives `/c/...` paths
  the server cannot open. WSL is the supported route.
- `skills/aa/aa.sh`; installed copy `~/.claude/skills/aa/` (T045).

## Steps

- [x] `aa.sh` checks git, jq, curl and Node ≥ 22 before anything else; any missing: one list, one install line for the OS (apt, dnf, pacman, brew), the Node download link, exit 1.
- [x] On Windows outside WSL: say to use WSL, exit 1.
- [x] Start the server with Node's detached spawn in place of `setsid -f`.
- [x] Tests for the check, on a stubbed PATH; no server is started.
- [x] Docs: the one-line install and the prerequisites in README and `docs/PLUGIN.md`.
- [x] Independent review; sync the installed copy.

## Decision rules — fixed in advance

- Spends: `agent-fan-out`, one independent review subagent before the done
  commit; `global-config`, the sync to `~/.claude/skills/aa/`. A trail entry
  goes before each. No push: that is the operator's call.
- Done means:
  - with jq and curl missing and Node v18, `/aa` prints one list naming all
    three, one install line and the Node link, prints nothing else, and exits 1;
  - a stubbed macOS gets `brew install …`, a stubbed Git Bash gets the WSL line;
  - with everything present the check prints nothing and `/aa` goes on as
    before;
  - a server `/aa` starts runs in its own session, outlives the command and
    answers 200 (temporary data folder and port);
  - `npm test` and `npm run check` pass, and the review leaves no open defect.

## Handoff — state at last stop

*Kept true while claimed, not written on the way out (rule 8).*

- **Last touched:** 2026-10-09, adervark @k/edd32d65 (done)
- **In flight:** nothing
- **On disk:** nothing
- **Resume with:** nothing
- **Next decision:** none

## Verify

`node --test tests/aa-script.test.mjs`; then `/aa` in a temporary data folder
and port: `ps -o sid=` of the server differs from the shell's, and
`/api/settings` answers 200 after the command returns.

## Result

**Done.** Before anything else, `/aa` runs `git`, `jq` and `curl` with
`--version` and reads Node's major version. If anything is missing, it prints
one list with one install line for the OS (apt, dnf, pacman, brew, or "with
your package manager"), the Node download link, and exits 1. Git Bash on
Windows is sent to WSL (T050 changes that). The server now starts through
Node's detached spawn (`argv0: "node"`) in place of `setsid -f`, which macOS
lacks. The log folder is 700, the log 600, because the server prints its
sign-in link there. README and `docs/PLUGIN.md` give the one-line install and
the prerequisites, and how to change the token.

Against the decision rules:

- jq and curl missing with Node v18: one list naming all three, `sudo apt-get
  install -y jq curl`, the Node link, nothing else, exit 1. A stubbed macOS
  gets `brew install …`, a stubbed Git Bash the WSL line, and everything
  present prints nothing from the check. All are in `tests/aa-script.test.mjs`
  (5 tests); the reviewer also ran them under bash 3.2.57.
- A server `/aa` started leads its own session (SID 87698, the shell's 87628),
  answered 200 after the command had returned, restarted when its code
  changed, also with `node` linked to a binary named `node-22`.
- `npm test` 518 of 518 and `npm run check` pass.
- Independent review (reviewer run `edd32d65.a7e9`, two rounds): nothing
  blocking. Fixed: a regression, where the spawned command line
  `/usr/bin/node-22 server.mjs` escaped the stale-server match (`argv0`); the
  log readable by other local users (older than this task); a Mac's `git`
  stub passing the check; the token to stay out of files and trails
  (`SKILL.md`); two overstatements in the docs; a test's empty failure
  message. The re-check confirmed each and raised three wording nits, fixed as
  it suggested and not reviewed again.
- Spends: one reviewer subagent run; the installed copy in
  `~/.claude/skills/aa/` synced (`diff -r` empty). No push.
- Not tested on macOS or Windows.
- Trail digest:
  - **edd32d65** (session @k/edd32d65): skills/aa/aa.sh, SKILL.md,
    tests/aa-script.test.mjs, README, docs/PLUGIN.md; installed /aa · cost one
    reviewer subagent run (two rounds) · left: nothing
  - **edd32d65.a7e9** (reviewer @k/edd32d65): nothing · cost local CPU, temp
    copies and servers, all stopped · left: the re-check's two wording nits,
    since fixed
- Log: PROGRESS.md, 2026-10-09 — T046 and T048.

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
