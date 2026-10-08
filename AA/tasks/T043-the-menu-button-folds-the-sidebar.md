---
id: T043
title: "The menu button does nothing on a desktop: it should fold the sidebar away"
status: claimed
owner: adervark @k/c1e9ef11 2026-10-09 — the menu button folds the sidebar
# type: one word; tasks of one type are timed together; `bug` counts as defect work
type: bug
# blockedReason: while blocked, one line saying what unblocks it; cleared on unblock
blockedReason: ""
depends: [T037]
created: 2026-10-09
---

# T043 — The menu button folds the sidebar away

## Goal

The menu button at the left of the top bar hides and shows the sidebar on
every screen.

## Context

- 2026-10-09 the operator: "the side bar button doesnt work".
- The button was meant for phones only (`.mobile-menu { display: none }`),
  but `.icon-button { display: inline-flex }` comes later with the same
  specificity, so it shows on every screen. Its click toggles `.is-open`,
  which only does anything below 860 px.

## Steps

- [ ] On a wide screen the button folds the sidebar away and back; the page
      takes the width; the choice is remembered in this browser.
- [ ] On a phone it slides the sidebar over the page, as before.
- [ ] `aria-expanded` and the label say whether the sidebar is shown.
- [ ] The Flow charts redraw when the sidebar folds, as on a resize.

## Decision rules — fixed in advance

- Pass: clicking the button at 1440 hides the sidebar and clicking again
  shows it; a reload keeps the choice; at 390 the slide-over still works;
  the browser walk finds no problem; `npm test` and `npm run check` pass.
- No spend.

## Handoff — state at last stop

*Kept true while claimed, not written on the way out (rule 8).*

- **Last touched:** 2026-10-09, adervark @k/c1e9ef11 (claimed)
- **In flight:** nothing
- **On disk:** nothing
- **Resume with:** the Steps
- **Next decision:** none

## Verify

A browser script clicking the button at 1440 and 390.

## Result

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
