---
id: T046
title: "Install in one line: /aa names everything the machine is missing, at once"
status: claimed
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

- [ ] `aa.sh` checks git, jq, curl and Node ≥ 22 before anything else; any missing: one list, one install line for the OS (apt, dnf, pacman, brew), the Node download link, exit 1.
- [ ] On Windows outside WSL: say to use WSL, exit 1.
- [ ] Start the server with Node's detached spawn in place of `setsid -f`.
- [ ] Tests for the check, on a stubbed PATH; no server is started.
- [ ] Docs: the one-line install and the prerequisites in README and `docs/PLUGIN.md`.
- [ ] Independent review; sync the installed copy.

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

- **Last touched:** 2026-10-09, adervark @k/edd32d65 (claimed)
- **In flight:** editing `skills/aa/aa.sh`
- **On disk:** nothing uncommitted beyond this claim
- **Resume with:** the Steps above
- **Next decision:** none

## Verify

`node --test tests/aa-script.test.mjs`; then `/aa` in a temporary data folder
and port: `ps -o sid=` of the server differs from the shell's, and
`/api/settings` answers 200 after the command returns.

## Result

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
