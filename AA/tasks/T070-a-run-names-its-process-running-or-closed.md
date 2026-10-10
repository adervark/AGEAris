---
id: T070
title: "A run names its process, so a session reads as running or closed"
status: claimed
owner: adervark @b/cab833a2 2026-10-11 — the process check as the failsafe, ckpt.sh live verdicts, design v2.4
# type: one word; tasks of one type are timed together; `bug` counts as defect work
type: design
# blockedReason: while blocked, one line saying what unblocks it; cleared on unblock
blockedReason: ""
depends: [T069]
created: 2026-10-11
---

# T070 — A run names its process, so a session reads as running or closed

## Goal

Every run that has not ended reads as **running** or **closed**, never
"unknown". On the machine that ran it, its process decides: alive is running,
gone is closed. The clock decides only for a run whose process cannot be
checked from here.

## Context

- The operator, 2026-10-11: "I need clear decision on running and closed
  sessions so use something as a failsafe."
- T069 left a third state. A silent `doing` with no `until` was *unknown*, and
  orient said `verify`. A crashed session's run also read as live for
  `live_minutes`, so a restarted session was kept off its own dead run.
- Claude Code exports `CLAUDE_PID`, the session's own process. The boot id
  (`/proc/sys/kernel/random/boot_id`, `kern.bootsessionuuid` on macOS) tells a
  reader whether it is on the same machine and boot as the run.
- The operator answered the design's §11 open question the same day. When
  your own task is held by a session that is verified running, a new session
  is told to wait, and the holder is named.

## Steps

- [ ] `_SCHEMA.md` here and in the `aa-init` template: `boot`, `pid` and
      `pstart` on `open`, and on a later entry when the run continues in a new
      process. The reading rule, in order: `end`, then `until`, then the
      process, then the clock.
- [ ] `ckpt.sh` here and in the template: record the process
      (`AA_SESSION_PID`, `CLAUDE_PID`, or an agent CLI found above the shell).
      `ckpt.sh live` says running or closed for every run, with the evidence,
      and tells a `doing` in flight from one stopped mid-act.
- [ ] `live_minutes` in `AA.yml`, here and in the template.
- [ ] `board.sh`'s ⚙ legend says a `doing` may be running or stopped.
- [ ] Tests on a temporary repository: a fake `ps` and boot id for each rule,
      and the real process of the test itself.
- [ ] Design v2.4: D5 and D6, two states with their evidence, the table
      renumbered, and §11's open question answered.

## Decision rules — fixed in advance

- No spend in `AA.yml` applies. The template is edited in this repository.
  The installed plugin under `~/.claude` is not synced here, because that is
  `global-config`.
- Done means:
  - `ckpt.sh live` prints running or closed for every run that has not ended,
    with the rule that decided it. The test covers each rule: ended, `until`
    ahead, process alive, process gone, pid reused, another boot, and the
    clock either way;
  - a run whose recorded process is gone is closed whatever its age, and a run
    whose process is alive is running whatever its silence;
  - without the new fields, `ckpt.sh live` decides by the clock;
  - `npm test` and `npm run check` pass, and the board is current.

## Handoff — state at last stop

*Kept true while claimed, not written on the way out (rule 8).*

- **Last touched:** 2026-10-11, claimed
- **In flight:** nothing
- **On disk:** nothing
- **Resume with:** the Steps above
- **Next decision:** none

## Result

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
