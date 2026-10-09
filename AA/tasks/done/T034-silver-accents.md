---
id: T034
title: "Silver accents, taken from the logo"
status: done
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

- [x] The accent, hover, tint and focus tokens become silver; status colours
      stay as they are.
- [x] Neutral chart bars become a quiet silver; status-coloured dots stay.
- [x] At most two small flourishes: a silver sheen on the primary button
      and on the wordmark.
- [x] DESIGN.md and the stylesheet's header say what silver is for.

## Decision rules — fixed in advance

- Pass: no blue is left outside "in progress"; accent text is at least 7:1
  on black and its tint; the focus ring stays clearly visible; status
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

Screenshots of Home, a board and the Flow tab before and after; the walk.

## Result

Pass. The accent is silver, as the logo is.

- **Tokens:** `--accent` is #c5cbd3, `--accent-hover` #e6e9ed, `--accent-tint`
  #16181b and `--focus` #d6dbe1. Links, the selected tab and sidebar item,
  focus rings and switches all follow. The neutral chart bars (`--chart`) are
  #8d949f. The status colours are unchanged, so blue now means only "in
  progress". Project and agent colours, which the operator picks, stay.
- **Two flourishes:** a metallic sheen on the primary button, and a white to
  silver fade on the AGE Aris wordmark.
- **Contrast on black:** accent text 12.9:1 (10.9:1 on its tint), the focus
  ring 15.1:1, black text on the button's darkest silver 11.7:1, the
  wordmark's darkest point 8.1:1, chart bars 6.9:1.
- DESIGN.md and the stylesheet's header say what silver is for.
- `npm test` passed 498 of 498 and `npm run check` passed. The browser walk
  over six boards at two widths found no problem in 72 page views.
  Screenshots of the board, the Flow tab, the sidebar and the New project
  dialog were checked by eye.
- Found on the way: T035, the forecast samples days from before a young
  board existed.

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
