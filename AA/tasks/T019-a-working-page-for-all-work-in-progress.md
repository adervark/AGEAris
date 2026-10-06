---
id: T019
title: "A Working page: everything in progress or blocked, on every board"
status: claimed
owner: adervark @v/2e8b687e 2026-10-07 — building the Working page
# type: one word; tasks of one type are timed together; `bug` counts as defect work
type: feature
# blockedReason: while blocked, one line saying what unblocks it; cleared on unblock
blockedReason: ""
depends: []
created: 2026-10-07
---

# T019 — A Working page: everything in progress or blocked, on every board

## Goal

One place in the main navigation that answers "what is being worked on right
now": every task in progress or blocked on every board, whoever holds it,
with how long it has been in progress and what its holder last said.

## Context

- Asked for 2026-10-07: "we need to add currently working tab". The operator
  chose a main-navigation item covering all projects, beside Home, Projects,
  Agents and Activity.
- Agents → "Working now" (`workingNow`, `public/app.js`) lists only agent
  sessions, so work claimed through the app is missing from it. It stays as it
  is.
- The client has no per-task age: the brief sends ages only for tasks already
  past the aging threshold. `metrics.wip.items` (`lib/metrics.mjs`) already
  carries each WIP task's start, `from.at`.

## Steps

- [ ] The brief's project line carries `wipSince`: taskKey → when that task's
  current work started. It sits outside `kpis`, whose shape is tested.
- [ ] `renderWorking` in `public/cockpit.js`: grouped by project, oldest first;
  the holder, the age, the note (the blocked reason, else the claim note), and
  the usual signal badges; a summary line and an empty state.
- [ ] Route `#working`, a "Working" nav item with the WIP count, and the
  page name. Update DESIGN.md's sidebar line.
- [ ] Tests for both, and a look at desktop and phone widths.

## Decision rules — fixed in advance

- Pass: `#working` lists exactly the in-progress and blocked tasks of every
  project, grouped by project and oldest first. Each row has its holder, age
  and note, and every value is escaped. The nav count equals that number. At
  390 px and at 1440 px the page does not scroll sideways, and it adds no
  inline style. `npm test` and `npm run check` pass.
- No spend.

## Handoff — state at last stop

*Kept true while claimed, not written on the way out (rule 8).*

- **Last touched:** 2026-10-07, adervark @v/2e8b687e (claimed)
- **In flight:** the page, in this session
- **On disk:** nothing yet
- **Resume with:** `wipSince` in the brief
- **Next decision:** none

## Verify

`npm test`; open `#working` at both widths.

## Result

*(on completion: the outcome against the decision rules above, a pointer to the
entry in the log, and the digest from `AA/ckpt.sh close T019` — then
retire the trail with `--delete`)*

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
