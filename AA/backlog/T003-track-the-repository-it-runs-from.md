---
id: T003
title: "Track the repository AGE Aris runs from without moving its data"
status: open
owner: —
# type: one word; tasks of one type are timed together; `bug` counts as defect work
type: feature
# blockedReason: while blocked, one line saying what unblocks it; cleared on unblock
blockedReason: ""
depends: []
created: 2026-10-07
---

# T003 — Track the repository AGE Aris runs from without moving its data

## Goal

AGE Aris can track its own repository, or any repository it is started from,
without the operator first moving its data folder by hand.

## Context

- `npm start` keeps its data in `<current folder>/.agesight-data`. Started from
  this repository, that folder is inside it, and `linkProject` refuses the
  link because the agents' commits could pick the data up.
- The workaround since 2026-10-07: the data lives in `~/.agesight-data`, and
  AGE Aris starts with `AGESIGHT_DATA_DIR=~/.agesight-data npm start`.

## Steps

- [ ] Choose between a default outside the working tree (such as
  `~/.agesight-data`), `npm start` setting the folder, and accepting a data
  folder git ignores.
- [ ] Implement and test it, and update README's "Run the application".

## Decision rules — fixed in advance

- Changing where AGE Aris looks for its data is a `data-migration`: existing
  installs keep their token and projects. The operator makes the choice, in
  this file, before the task is claimed.
- The token is never committed: a git-ignored data folder is acceptable only if
  `git check-ignore` confirms it before every link.

## Handoff — state at last stop

*Kept true while claimed, not written on the way out (rule 8).*

- **Last touched:** 2026-10-07, adervark @k/ff713831 (registered, never claimed)
- **In flight:** nothing
- **On disk:** nothing yet
- **Resume with:** the operator's choice, written under Decision rules
- **Next decision:** which of the three ways to take

## Verify

A fresh start from this repository can track it; the old data folder still opens with its token.

## Result

*(on completion: the outcome against the decision rules above, a pointer to the
entry in the log, and the digest from `AA/ckpt.sh close T003` — then
retire the trail with `--delete`)*

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
