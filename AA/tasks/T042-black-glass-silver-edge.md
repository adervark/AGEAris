---
id: T042
title: "Black glass with a silver edge: T039's gradient chrome looked like a basic app"
status: claimed
owner: adervark @k/c1e9ef11 2026-10-09 — black glass, silver edge
# type: one word; tasks of one type are timed together; `bug` counts as defect work
type: design
# blockedReason: while blocked, one line saying what unblocks it; cleared on unblock
blockedReason: ""
depends: [T039, T041]
created: 2026-10-09
---

# T042 — Black glass with a silver edge

## Goal

Silver reads as premium, the way the logo does: black surfaces lit by fine
silver, not silver-filled shapes with a gradient.

## Context

- 2026-10-09 the operator: "the shade or gradient of silver looks like a
  basic application". T039's single linear gradient with a dark horizon is
  the stock "chrome text" effect, and silver-filled glossy buttons are 2010
  styling.
- Six treatments were rendered beside the logo (brushed, stippled, satin,
  mercury, black glass); the operator chose "black glass, silver edge".

## Steps

- [ ] The primary button and the avatar: black glass, a fine silver rim that
      catches light at the top, white text, a soft silver glow.
- [ ] The wordmark: silver lit from above with a fine grain, no dark band.
- [ ] The selected item and tab: a light silver bar, no dark band.
- [ ] DESIGN.md says so.

## Decision rules — fixed in advance

- Pass: no element keeps T039's dark-horizon gradient; text on the button
  and avatar passes 7:1; the browser walk finds no problem; `npm test` and
  `npm run check` pass.
- No spend.

## Handoff — state at last stop

*Kept true while claimed, not written on the way out (rule 8).*

- **Last touched:** 2026-10-09, adervark @k/c1e9ef11 (claimed)
- **In flight:** nothing
- **On disk:** nothing
- **Resume with:** the Steps
- **Next decision:** none

## Verify

Close-ups of the sidebar, the top bar and a dialog's buttons.

## Result

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
