---
id: T120
title: "The installed aa-init skill is a month behind its template"
status: open
owner: —
# type: one word; tasks of one type are timed together; `bug` counts as defect work
type: chore
# blockedReason: while blocked, one line saying what unblocks it; cleared on unblock
blockedReason: ""
depends: [T111]
created: 2026-11-03
---

# T120 — The installed aa-init skill is a month behind its template

## Goal

A board that `aa-init` scaffolds today gets this repository's
`skills/aa-init/template/`, including rule 13 and `ckpt.sh release`.

## Context

- The installed copies, `~/.claude*/skills/aa-init/` in five profiles
  (default, b, k, ka, v), are plain folders dated 2026-09-30, not links to
  this repository. Their `ckpt.sh` has no `release`; `AA.yml`, `board.sh`,
  `RULES.md`, `SCHEMA.md`, `TASK.md`, `WHY.md` and `SKILL.md` all differ.
- Found by T119, which upgraded AGEIS's board by hand for the same reason.
- Every other board under `~/Code` keeps whatever copy it was scaffolded
  with; only AGEIS and this repository have rule 13.

## Steps

- [ ] Decide: copy on each change, or link the installed skill to this
      repository's `skills/aa-init/`.
- [ ] Bring the five installed copies up to date.
- [ ] List the other boards whose `ckpt.sh` predates rule 13.

## Decision rules — fixed in advance

- `global-config` (`~/.claude*`) is the spend; the operator says which way
  first.
