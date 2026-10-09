---
id: T049
title: "Every AGESight name becomes AGE Aris's, and the old ones are still read"
status: claimed
owner: adervark @k/edd32d65 2026-10-09 — new names written, old ones read, data folders moved
# type: one word; tasks of one type are timed together; `bug` counts as defect work
type: migration
# blockedReason: while blocked, one line saying what unblocks it; cleared on unblock
blockedReason: ""
depends: [T048]
created: 2026-10-09
---

# T049 — Every AGESight name becomes AGE Aris's, and the old ones are still read

## Goal

AGE Aris writes only its own names. Every old name it finds is still read, so
existing data folders, scripts, task files and commits keep working.

## Context

- 2026-10-09: the operator asked to go the full way after T048 renamed the
  plugin. Until now, `AGENTS.md` kept the old names "where data or integrations
  depend on them".
- New names, old ones still read:
  - data folder `.agearis-data` (`.agesight-data`);
  - env `AGEARIS_DATA_DIR`, `AGEARIS_TRACKED_WRITES` (`AGESIGHT_*`);
  - agent run env `AGEARIS_WORKDIR`, `_TASK`, `_STAGE`, `_RUN`, `_ATTEMPT`.
    The old variables are set alongside for agents written against them;
  - header `X-AGEAris-Token` (`X-AGESight-Token`), cookie `agearis_token`
    (`agesight_token`);
  - commit trailer `AGEAris-Via` (`AGESight-Via`), owner tag `@agearis/web`
    (`@agesight/web`);
  - lock content and scratch names `agearis …` (`agesight …`);
  - system actor `agearis` (`agesight`) in stored events;
  - browser keys `agearis.*` (`agesight.*`, copied once);
  - fallback email `agearis@localhost.invalid`.
- The data folder defaults to `.agesight-data` in the folder AGE Aris starts
  from (`server.mjs`, `lib/workspace.mjs`); `/aa` uses `~/.agesight-data`.
  Both exist on the operator's machine. Moving one leaves a link at the old
  path, so a server still running on it, and scripts that name it, keep
  working.
- Files: `server.mjs`, `lib/{workspace,tracked,history,metrics,pipeline,fabricate,sample}.mjs`,
  `public/{cursor,actions}.js`, `skills/aa/aa.sh`, `agents/`, README,
  `docs/{PIPELINE,METRICS}.md`, `AGENTS.md`, `.gitignore`, and the tests.
  `docs/plans/` are design records of their time and keep their wording.

## Steps

- [ ] Write side: every name above is the new one.
- [ ] Read side: each old name is accepted, each with a test.
- [ ] Data folder: moved once to the new name, with a link at the old path; by the server for its default folder, by `/aa` for `~/`.
- [ ] Docs and `AGENTS.md`: the new names, and that the old ones are still read.
- [ ] The operator's two data folders, moved and checked.

## Decision rules — fixed in advance

- Spend: `data-migration`, moving the operator's `~/.agesight-data` and
  `~/Code/AGEAris/.agesight-data`. Before either: a trail entry, and a copy of
  both folders in the session scratchpad. Also `global-config`: the installed
  `/aa` copy. No push: the operator's call.
- Pass, all of them:
  - after the move, AGE Aris lists the same projects as before, with the same
    token; a browser holding the old cookie is still signed in; a request
    with `X-AGESight-Token` still answers 200;
  - the old path is a link to the new folder;
  - a task file whose owner line reads `@agesight/web` still counts as the
    operator's own claim; a commit with `AGESight-Via` still counts as a UI
    action; a lock reading `agesight <nonce>` is still recognized in recovery;
  - `git grep -i agesight` finds the old names only in read-compatibility
    code and its tests, in history (`AA/tasks/done/`, `PROGRESS.md`,
    `docs/plans/`) and in the README's naming note;
  - `npm test` and `npm run check` pass; an independent review leaves no open
    defect.
- Stop and restore from the copy if the project list or the token differs
  after the move.

## Handoff — state at last stop

*Kept true while claimed, not written on the way out (rule 8).*

- **Last touched:** 2026-10-09, adervark @k/edd32d65 (claimed)
- **In flight:** reading where each old name is written and read; no edits
  until T050, under review, is committed (both change `skills/aa/aa.sh`)
- **On disk:** nothing
- **Resume with:** the Steps above
- **Next decision:** none

## Verify

Start AGE Aris on a copy of an old data folder: the projects are listed, the
old cookie and header work, and the folder has moved with a link left behind.

## Result

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
