---
id: T036
title: "Silver you can see: T034's accent was too faint to notice"
status: done
owner: adervark @k/adccab68 2026-10-08 — silver you can see
# type: one word; tasks of one type are timed together; `bug` counts as defect work
type: design
# blockedReason: while blocked, one line saying what unblocks it; cleared on unblock
blockedReason: ""
depends: [T034]
created: 2026-10-08
---

# T036 — Silver you can see

## Goal

The operator sees silver at a glance, and it stays tasteful.

## Context

- 2026-10-08, after T034 the operator asked "where the fuck is the silver".
  T034 made the accent a light grey, and on black it reads the same as the
  white text. Silver needs metal cues to read as silver: a lit edge, a sheen
  or a brushed line.

## Steps

- [x] A brushed silver hairline along the sidebar and under the top bar.
- [x] A lit silver top edge and silver-grey borders on the main surfaces.
- [x] Polished chrome on the wordmark, the avatar and the primary button.
- [x] A silver bar on the selected sidebar item and a chrome underline on the
      selected tab; silver edges on secondary buttons.
- [x] DESIGN.md says so.

## Decision rules — fixed in advance

- Pass: silver is visible on every page without being looked for; status
  colours are unchanged; the browser walk finds no problem; `npm test` and
  `npm run check` pass.
- No spend.

## Handoff — state at last stop

*Kept true while claimed, not written on the way out (rule 8).*

- **Last touched:** 2026-10-08, adervark @k/adccab68 (done)
- **In flight:** nothing
- **On disk:** nothing
- **Resume with:** nothing
- **Next decision:** none

## Verify

Screenshots; the walk.

## Result

Pass. Silver now reads as metal, not as grey text.

- **The shell:** a brushed silver hairline (a gradient that fades at both
  ends) runs along the sidebar's edge and under the top bar.
- **Surfaces:** panels, vitals, charts, board columns, cards and lists get
  silver-grey borders (#33373d) and a lit top edge.
- **Chrome:** a polished gradient on the AGE Aris wordmark, the avatar and
  the primary button.
- **Selection:** a silver bar and a silver wash on the selected sidebar item,
  a chrome underline on the selected tab, and silver edges on secondary
  buttons.
- **Unchanged:** the status colours.
- `npm test` passed 501 of 501, and `npm run check` passed. The browser walk
  found no problem in 72 page views. Screenshots of the board and the sidebar
  were checked by eye.

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
