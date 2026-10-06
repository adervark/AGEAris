---
id: T004
title: "Keep one copy of the aa-init template"
status: open
owner: —
# type: one word; tasks of one type are timed together; `bug` counts as defect work
type: chore
# blockedReason: while blocked, one line saying what unblocks it; cleared on unblock
blockedReason: ""
depends: []
created: 2026-10-07
---

# T004 — Keep one copy of the aa-init template

## Goal

`~/.claude/skills/aa-init`, which Codex reads too through `~/.agents/skills`,
scaffolds the same board as `skills/aa-init` in this repository.

## Context

- This repository's template is newer: its `RULES.md` asks for
  `blockedReason:` when a task moves to blocked, and its `TASK.md` carries the
  `type:` and `blockedReason:` keys. The global copy has neither (found
  2026-10-07).

## Steps

- [ ] Take this repository's copy, which AGE Aris ships as its plugin, as the
  source.
- [ ] Make the global one follow it, by a copy or a link.

## Decision rules — fixed in advance

- Changing `~/.claude` or `~/.agents` is a `global-config` spend: the operator
  approves the method, copy or link, before the task is claimed.
- Done when `diff -r` finds no difference in `SKILL.md` or `template/`.

## Handoff — state at last stop

*Kept true while claimed, not written on the way out (rule 8).*

- **Last touched:** 2026-10-07, adervark @k/ff713831 (registered, never claimed)
- **In flight:** nothing
- **On disk:** nothing yet
- **Resume with:** the operator's approval of copy or link
- **Next decision:** copy or link

## Verify

`diff -r ~/.claude/skills/aa-init skills/aa-init` is empty apart from ignored files.

## Result

*(on completion: the outcome against the decision rules above, a pointer to the
entry in the log, and the digest from `AA/ckpt.sh close T004` — then
retire the trail with `--delete`)*

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
