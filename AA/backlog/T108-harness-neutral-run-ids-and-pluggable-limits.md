---
id: T108
title: "Run ids that any harness can set, and the limits reader as one adapter among others"
status: open
owner: —
# type: one word; tasks of one type are timed together; `bug` counts as defect work
type: feature
# blockedReason: while blocked, one line saying what unblocks it; cleared on unblock
blockedReason: ""
depends: []
created: 2026-11-03
---

# T108 — Run ids that any harness can set, and the limits reader as one adapter among others

## Goal

A subagent's run links to its parent under any orchestrator, and the limits strip does not depend on one CLI's private sign-in details.

## Context

- `AA/ckpt.sh` keys runs on `CLAUDE_CODE_SESSION_ID` and walks parent processes named claude, codex or gemini; otherwise runs are unlinked. PROGRESS.md records a false overlap between a Codex parent and its subagents.
- `lib/limits.mjs` hard-codes Claude Code's OAuth client id, the `oauth-2025-04-20` beta header, and writes renewed tokens back to `.credentials.json`.
- Found in an outside analysis, checked 2026-11-03. Changing the installed `/aa` or a credential file is a `global-config` spend.

## Steps

- [ ] Accept `AA_RUN_ID` and `AA_PARENT_RUN` in ckpt.sh and the template.
- [ ] Make token write-back opt-in; give limits a provider adapter.

## Decision rules — fixed in advance

- `data-migration`: tests write only to temporary repositories and folders.
- `push`: none.
- Done means a run started with `AA_PARENT_RUN` links in `ckpt.sh live`, renewal writes nothing unless switched on, and the tests pass. Any change to `~/.claude` waits for the operator's word.

## Handoff — state at last stop

*Kept true while claimed, not written on the way out (rule 8).*

- **Last touched:** 2026-11-03, adervark @b/cc5901e7 (registered, never claimed)
- **In flight:** nothing
- **On disk:** nothing yet
- **Resume with:** the Steps above
- **Next decision:** none

## Result

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
