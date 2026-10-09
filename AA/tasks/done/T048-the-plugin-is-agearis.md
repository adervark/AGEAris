---
id: T048
title: "The plugin is agearis: the install and the plugin list still said agesight"
status: done
owner: adervark @k/edd32d65 2026-10-09 — rename the plugin, marketplace and package
# type: one word; tasks of one type are timed together; `bug` counts as defect work
type: bug
# blockedReason: while blocked, one line saying what unblocks it; cleared on unblock
blockedReason: ""
depends: [T046]
created: 2026-10-09
---

# T048 — The plugin is agearis: the install and the plugin list still said agesight

## Goal

Installing reads `claude plugin install agearis@agearis`, and nothing a person
reads about the plugin calls it agesight.

## Context

- 2026-10-09: the operator asked why it still says AGESight. The rename to AGE
  Aris kept the plugin's name, because a plugin's name is its install id and
  renaming it makes existing installs reinstall; `AGENTS.md` listed "the
  `agesight` package and plugin" among the old names kept. No profile on this
  machine has it installed and the operator's friend has not installed it yet,
  so the operator chose `agearis`, matching `AGEARIS_*` and
  `~/.local/state/agearis`.
- Old name, as a name: `.claude-plugin/plugin.json` and `marketplace.json`,
  `package.json`, `docs/PLUGIN.md`, the README's plugin section (T046 wrote
  "The `agesight` plugin"), the `AA/AA.yml` push comment, the clone's remote
  URL (GitHub redirects it).
- Stays, as stored data (the operator's choice): `.agesight-data`,
  `AGESIGHT_*`, `X-AGESight-Token`, `AGESight-Via`, `@agesight/web` owner
  lines, the `agesight <nonce>` lock and scratch names, the `agesight` system
  actor, the `agesight.*` browser storage keys.

## Steps

- [x] Manifests and `package.json`: `agearis`; descriptions say AGE Aris; the repository URL is `adervark/AGEAris`.
- [x] README, `docs/PLUGIN.md`, the `AA.yml` comment: the new install line and name.
- [x] `AGENTS.md`: the plugin and package leave the list of kept names.
- [x] The clone's remote URL; the project memory note.
- [x] Independent check.

## Decision rules — fixed in advance

- Spends: `agent-fan-out`, one independent check subagent;
  `global-config`, the project memory note under `~/.claude-k/projects/`. A
  trail entry goes before each. No push: the operator's call.
- Done means:
  - in a clean `CLAUDE_CONFIG_DIR`, `claude plugin marketplace add` on this
    checkout and `claude plugin install agearis@agearis` install `aa` and
    `aa-init`;
  - `git grep -i agesight` finds it only in the stored-data names above, in
    history (`AA/tasks/done/`, `PROGRESS.md`, the README's naming note) and in
    test fixtures;
  - `npm test` and `npm run check` pass, and the check leaves no open defect.

## Handoff — state at last stop

*Kept true while claimed, not written on the way out (rule 8).*

- **Last touched:** 2026-10-09, adervark @k/edd32d65 (done)
- **In flight:** nothing
- **On disk:** nothing
- **Resume with:** nothing
- **Next decision:** none

## Verify

The clean-config install above, and the `git grep`.

## Result

**Done.** The plugin, its marketplace and the package are `agearis`; their
descriptions start with AGE Aris and the repository URL is `adervark/AGEAris`.
README and `docs/PLUGIN.md` install `agearis@agearis`. `AGENTS.md` lists the
old names kept in stored data, until T049 migrates them, and no longer the
plugin. The clone's remote is `https://github.com/adervark/AGEAris.git`, and
the project memory note says the plugin is `agearis`.

Against the decision rules:

- In a clean `CLAUDE_CONFIG_DIR`, `claude plugin marketplace add` on this
  checkout and `claude plugin install agearis@agearis` installed the skills
  `aa` and `aa-init`; `claude plugin validate` passes on both manifests (the
  reviewer, Claude Code 2.1.295).
- `git grep -i agesight` finds the old name only in stored-data names, in
  history and in test fixtures.
- `npm test` 518 of 518 and `npm run check` pass. The check (reviewer run
  `edd32d65.ea4b`) found nothing blocking; its two nits, the incomplete list
  of kept names and a new `agesight-aa-` temp prefix, are fixed.
- The install line works against GitHub only once this branch is on `main`,
  whose manifests still say `agesight`.
- Trail digest:
  - **edd32d65** (session @k/edd32d65): .claude-plugin manifests,
    package.json, AGENTS.md, AA.yml comment, README and docs/PLUGIN.md install
    lines; remote URL; memory note · cost shared reviewer run · left: nothing
  - **edd32d65.ea4b** (reviewer @k/edd32d65): nothing · cost reads only ·
    left: the boards sentence in AGENTS.md, since fixed
- Log: PROGRESS.md, 2026-10-09 — T046 and T048.

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
