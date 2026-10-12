---
id: T049
title: "Every AGESight name becomes AGE Aris's, and the old ones are still read"
status: done
owner: adervark @k/be648959 2026-10-09 — new names written, old ones read, data folders moved (was: adervark @k/edd32d65 2026-10-09, same work, before a session switch)
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
  path, so scripts that name it keep working. (2026-10-09, the review: a
  server still running on the old folder does not; storage refuses links, so
  it must be stopped before the move and restarted after.)
- Files: `server.mjs`, `lib/{workspace,tracked,history,metrics,pipeline,fabricate,sample}.mjs`,
  `public/{cursor,actions}.js`, `skills/aa/aa.sh`, `agents/`, README,
  `docs/{PIPELINE,METRICS}.md`, `AGENTS.md`, `.gitignore`, and the tests.
  `docs/plans/` are design records of their time and keep their wording.

## Steps

- [x] Write side: every name above is the new one.
- [x] Read side: each old name is accepted, each with a test.
- [x] Data folder: moved once to the new name, with a link at the old path; by the server for its default folder, by `/aa` for `~/`.
- [x] Docs and `AGENTS.md`: the new names, and that the old ones are still read.
- [x] The operator's two data folders, moved and checked.

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

- **Last touched:** 2026-10-09, adervark @k/be648959 (done)
- **In flight:** nothing
- **On disk:** nothing
- **Resume with:** nothing
- **Next decision:** none

## Verify

Start AGE Aris on a copy of an old data folder: the projects are listed, the
old cookie and header work, and the folder has moved with a link left behind.

## Result

**Done.** AGE Aris writes only its own names. Each old AGESight name is still
read, through a small helper with a test of its own:

| Old name | Read by |
|---|---|
| `X-AGESight-Token` header, `agesight_token` cookie | `presentedTokens` in `server.mjs`: every cookie presented is checked, and signing in clears the old cookie |
| `AGESight-Via` trailer | `viaTrailers` in the git log formats (`history.mjs`, `_lastSignInGit`) |
| `@agesight/web` owner tag | `isUiClaim`, `holderKind` |
| `agesight <nonce>` index lock | `holdsNonce` in recovery |
| `AGESIGHT_DATA_DIR`, `AGESIGHT_TRACKED_WRITES` | `createServer`, `trackedWritesOff`, aa.sh |
| `AGESIGHT_*` for agents | `runEnv`: agents get both names |
| `agesight.*` browser keys | `public/cursor.js`, moved to `agearis.*` on first read |
| `.agesight-data` | `dataFolder`: it moves to `.agearis-data` with a link left at the old path |

The data folder moves when AGE Aris starts on either name, or the default.
`/aa` reads `~/.agesight-data` until it next starts AGE Aris itself, so it
never moves a folder under a running server. The system actor in stored
events keeps the id it was written with, and is only displayed.

Against the decision rules:

- Moved, 2026-10-09, after copying both folders to the session scratchpad.
  AGE Aris (PID 12351) was stopped first, then:
  - `~/.agesight-data` was moved by the new `/aa`, which started AGE Aris on
    `~/.agearis-data`;
  - `~/Code/AGEAris/.agesight-data` was moved by `dataFolder`.
- After the move, AGE Aris lists the same projects (AGEIS, AGE Aris) with the
  same token, compared by hash. The old header and the old cookie both answer
  200. Both old paths are links to the new folders. The repository's folder is
  identical to its copy. The same check had passed first on a copy, with
  `npm start` from a scratch folder.
- Covered by tests, under both names: an `@agesight/web` owner line is the
  operator's own claim (`history`, `actions`); an `AGESight-Via` commit is a
  UI edit (`history`) and is skipped as a sign of life (`task-actions`); and
  an `agesight <nonce>` lock is recovered (`task-actions`). The remaining old
  names are covered in `server`, `tracked`, `pipeline`, `cockpit-ui`,
  `workspace` and `aa-script`.
- `git grep -i agesight` finds the old names in the following places. The
  read side and its tests, and history (`AA/tasks/done/`, `PROGRESS.md`,
  `docs/plans/`), as the rule allows. The README's naming note. Also, outside
  the rule as written:
  - `AGENTS.md`'s naming note;
  - task titles in `AA/STATE.md`, and this file;
  - two places that write an old name on purpose, for the transition:
    - sign-in clears the old cookie;
    - `/aa` sends the token under both header names, so an AGE Aris started
      before the rename still answers until it restarts.
- `npm test` 534 of 534, `npm run check` passes.
- Independent review, two rounds (`be648959.987e`):
  - Round 1, should-fix: a server still running on the old folder breaks
    once the folder has moved, because storage refuses links. This is now
    documented and avoided by `/aa`, not detected. A folder named explicitly
    by its old path never moved. This is fixed.
  - Round 1, nits: a stale new cookie hid a valid old one; a race between two
    starts; a reason string with the wrong trailer name; and a `Workspace`
    constructor that moved folders. All fixed.
  - Round 2: no open defect.
- Not tested: the Windows junction (`symlinkSync(…, 'junction')` and
  `realpathSync` across it) has never run on Windows.
- Spends: two reviewer rounds; data-migration of the two folders, as above;
  the installed `~/.claude/skills/aa/` synced (`diff -r` empty). No push.
- Trail: runs be648959 (session) and be648959.987e (reviewer), both ended; the full trail is in git (`git log -- AA/checkpoints/T049.jsonl`).
- Log: PROGRESS.md, 2026-10-09 — T049.

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
