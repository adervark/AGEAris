---
id: T039
title: "Silver that reads as metal: T036's chrome still looks like flat grey"
status: backlog
owner: ""
# type: one word; tasks of one type are timed together; `bug` counts as defect work
type: design
# blockedReason: while blocked, one line saying what unblocks it; cleared on unblock
blockedReason: ""
depends: [T036]
created: 2026-10-08
---

# T039 — Silver that reads as metal

## Goal

The operator sees real metal: a few elements in polished silver with a clear
highlight and shadow, not grey lines everywhere.

## Context

- 2026-10-08 the operator called the silver bullshit. Close up, T036's
  hairlines, lit edges and wordmark read as flat grey; only the avatar reads
  as metal, and "Add project" is a plain outlined button.
- The operator chose "make it real metal" over removing it.
- Fewer, stronger: chrome on the wordmark, the primary button and the
  selected tab, built like the avatar (a light band, a dark band, a bright
  edge); drop the grey hairlines and lit edges that only read as grey.

## Steps

- [ ] Chrome on the wordmark, the primary button and the selected tab and
      sidebar item, with a highlight and a shadow band.
- [ ] Remove the touches that read only as grey.
- [ ] Status colours unchanged; contrast still passes WCAG AA.
- [ ] DESIGN.md says so.

## Decision rules — fixed in advance

- Pass: in a screenshot at 100% the silver elements read as metal next to the
  avatar, and nothing else reads as grey decoration; text on chrome passes
  4.5:1; the browser walk finds no problem; `npm test` and `npm run check`
  pass.
- No spend.

## Handoff — state at last stop

*Kept true while claimed, not written on the way out (rule 8).*

- **Last touched:** 2026-10-08, registered
- **In flight:** nothing
- **On disk:** nothing
- **Resume with:** the Steps
- **Next decision:** none

## Verify

Close-up screenshots beside the avatar.

## Result

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
