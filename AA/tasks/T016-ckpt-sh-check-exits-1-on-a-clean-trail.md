---
id: T016
title: "ckpt.sh check exits 1 on a clean trail"
status: claimed
owner: adervark @k/adccab68 2026-10-08 — ckpt.sh check's exit; the task-action review's last findings
# type: one word; tasks of one type are timed together; `bug` counts as defect work
type: bug
# blockedReason: while blocked, one line saying what unblocks it; cleared on unblock
blockedReason: ""
depends: []
created: 2026-10-07
---

# T016 — ckpt.sh check exits 1 on a clean trail

## Goal

`ckpt.sh check` exits 0 when every line parses, and non-zero only when one
does not.

## Context

- Severity low, older than the rename: found by T001's review of e64f823 (P2).
- `skills/aa-init/template/ckpt.sh:209`: the loop's last command is
  `[ "$bad" -gt 0 ] && jq …`, so a clean last trail returns 1. Input:
  `AA/ckpt.sh check T001` here printed "T001 10 records, 0 unparseable" and
  exited 1 on 2026-10-07.
- The same line is in `AA/ckpt.sh`, the global template, and the copies in
  AGEION, AGEIS, Gem4A and RSNA.

## Steps

- [ ] Fix the template and `AA/ckpt.sh`.
- [ ] The global template.
- [ ] The four repositories' copies, only if the operator says so.

## Decision rules — fixed in advance

- `global-config` is a spend: a `doing` line first.
- A change inside another repository is `data-migration` here: not without
  the operator's word.

## Handoff — state at last stop

*Kept true while claimed, not written on the way out (rule 8).*

- **Last touched:** 2026-10-08, adervark @k/adccab68 (claimed)
- **In flight:** nothing
- **On disk:** nothing yet
- **Resume with:** fix the template and `AA/ckpt.sh`
- **Next decision:** none

## Verify

`AA/ckpt.sh check T001; echo $?` prints 0 on a clean trail and 1 after
appending an unparseable line to a scratch copy.

## Result

*(on completion: the outcome against the decision rules above, a pointer to the
entry in the log, and the digest from `AA/ckpt.sh close T016` — then
retire the trail with `--delete`)*

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*

- 2026-10-08, the operator (asked by adervark @k/adccab68): patch the four
  repositories' copies too, left uncommitted for their own sessions.
