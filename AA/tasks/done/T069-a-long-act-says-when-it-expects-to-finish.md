---
id: T069
title: "A long act says when it expects to finish, so orient never restarts it"
status: done
owner: adervark @v/8cd02255 2026-10-10 — `until` on doing, ckpt.sh --for, design v2.3
# type: one word; tasks of one type are timed together; `bug` counts as defect work
type: design
# blockedReason: while blocked, one line saying what unblocks it; cleared on unblock
blockedReason: ""
depends: [T052]
created: 2026-10-10
---

# T069 — A long act says when it expects to finish, so orient never restarts it

## Goal

A `doing` that may run silently longer than `live_minutes` can say until when.
Orient never tells a session to resume an act that may still be running.

## Context

- The third Critic pass on the brain design (T052, `docs/plans/agent-brain.md`
  §11 N1) rated this the most serious open issue. `live_minutes` (30) marks a
  silent run dead, and the schema's own example is a 2-hour GPU `doing`, so a
  second session would be told `resume`: the double spend D4 was decided to
  prevent.
- 2026-10-10: a side agent raised it again, and the operator said to fix it now
  rather than leave it to T055.

## Steps

- [x] `_SCHEMA.md` here and in the `aa-init` template: an optional `until` on
      `doing`, and how a reader uses it.
- [x] `ckpt.sh` here and in the template: `--for 2h` writes `until`, and
      `--until` is validated. Both only on `doing`.
- [x] Tests on a temporary repository.
- [x] Design v2.3: three states (live, may be running, dead), the precedence
      rows, §11 N1 settled.
- [x] T055's context notes N1 is settled here.

## Decision rules — fixed in advance

- No spend in `AA.yml` applies. The template is edited in this repository.
  The installed plugin under `~/.claude` is not synced here, because that is
  `global-config`.
- Done means:
  - with `until` in the future, or with a silent `doing` younger than
    `stale_hours` and no `until`, the design never yields `resume`;
  - `ckpt.sh` writes and validates `until`, and the existing output is
    unchanged without it;
  - `npm test` and `npm run check` pass, and the board is current.

## Handoff — state at last stop

*Kept true while claimed, not written on the way out (rule 8).*

- **Last touched:** 2026-10-10, done
- **In flight:** nothing
- **On disk:** nothing uncommitted
- **Resume with:** nothing; T055 writes the fixtures for rows 1a and 1b
- **Next decision:** none

## Result

**Done.** A long act can no longer be restarted by a second session that takes
its silence for death.

- **The format.** `_SCHEMA.md`, here and in the `aa-init` template, adds an
  optional `until` on `doing`: the latest time the act may still be running
  without another line. A reader counts it at most `stale_hours` past its line.
  The schema's own 2-hour GPU example now carries it.
- **The tool.** `ckpt.sh log T doing … --for 90m|2h|1d` writes `until`, and
  `--until <UTC time>` is checked. Either is refused on anything but a
  `doing`. Nothing changes without them. The fixture is
  `tests/fixtures/board/ckpt-until.sh`, run by `tests/task-actions.test.mjs`.
- **The design**, `docs/plans/agent-brain.md` v2.3. A run that has not ended
  is in one of four states:
  - live;
  - running silent (before its `until`);
  - unknown (a silent `doing` with no `until`, younger than `stale_hours`);
  - dead.

  The first two are in flight and kept off (D4). Unknown gets the new
  `verify`: establish from `tell` whether the act is running before touching
  it. Only a dead run gets `resume`, which still checks `tell` and then reaps.
  Siblings are in the caller's family. §11 N1 and N2 are settled; T055 writes
  their fixtures.
- **Not done here:** the installed plugin under `~/.claude` is not synced
  (`global-config`). Other AA repositories pick the change up through
  `aa-init`.
- `npm test` (535) and `npm run check` pass.

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
