---
id: T034
title: "Silver accents, taken from the logo"
status: claimed
owner: adervark @k/adccab68 2026-10-08 — silver accents
# type: one word; tasks of one type are timed together; `bug` counts as defect work
type: design
# blockedReason: while blocked, one line saying what unblocks it; cleared on unblock
blockedReason: ""
depends: []
created: 2026-10-08
---

# T034 — Silver accents, taken from the logo

## Goal

The interface's accent is silver, as the logo is, tasteful and minimal.

## Context

- 2026-10-08, the operator asked: "give it silver accents (tasteful and
  minimal)".
- The accent today is blue (`--accent: #7ea4ff`): links, the selected tab and
  sidebar item, focus rings, the primary button, switches. Blue also means
  "in progress" (`--run`), so the accent and a status share a colour, which
  DESIGN.md's "colour carries meaning only" rules out. The neutral chart bars
  are blue too (`--chart`).
- The logo (`docs/brand/age-aris-logo.png`) is white and silver on black.

## Steps

- [ ] The accent, hover, tint and focus tokens become silver; status colours
      stay as they are.
- [ ] Neutral chart bars become a quiet silver; status-coloured dots stay.
- [ ] At most two small flourishes: a silver sheen on the primary button
      and on the wordmark.
- [ ] DESIGN.md and the stylesheet's header say what silver is for.

## Decision rules — fixed in advance

- Pass: no blue is left outside "in progress"; accent text is at least 7:1
  on black and its tint; the focus ring stays clearly visible; status
  colours are unchanged; the browser walk finds no problem; `npm test` and
  `npm run check` pass.
- No spend.

## Handoff — state at last stop

*Kept true while claimed, not written on the way out (rule 8).*

- **Last touched:** 2026-10-08, adervark @k/adccab68 (claimed)
- **In flight:** nothing
- **On disk:** nothing
- **Resume with:** the Steps
- **Next decision:** none

## Verify

Screenshots of Home, a board and the Flow tab before and after; the walk.

## Result

*(placeholder)*

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
