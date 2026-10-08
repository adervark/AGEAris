---
id: T037
title: "The page fills a wide screen: on an ultrawide monitor it is a 1240px strip"
status: claimed
owner: adervark @k/c1e9ef11 2026-10-08 — the page fills a wide screen
# type: one word; tasks of one type are timed together; `bug` counts as defect work
type: bug
# blockedReason: while blocked, one line saying what unblocks it; cleared on unblock
blockedReason: ""
depends: []
created: 2026-10-08
---

# T037 — The page fills a wide screen

## Goal

On the operator's ultrawide monitor (3440×1440) the page uses the width, the
way it uses a laptop's.

## Context

- 2026-10-08 the operator said "the page is not adjusting to my UW monitor".
  `#main` stops at 1240px (`public/styles.css`), so at 3440px about 1,100px
  of black sits on each side of the content.
- Prose must not run 3,000px wide: paragraphs keep a reading measure, while
  boards, grids, tables and charts take the width.

## Steps

- [ ] The main column grows with the window; prose keeps its measure.
- [ ] Boards, card grids, number tiles and charts lay out more columns on a
      wide screen, not wider ones.
- [ ] Nothing breaks at 1280, 1440, 1920, 2560 and 3440 wide, nor on a phone.
- [ ] DESIGN.md says so.

## Decision rules — fixed in advance

- Pass: at 3440×1440 no page leaves more than a gutter of empty black beside
  its content; no paragraph is wider than about 90 characters; the pages at
  1440 wide look as before or better; the browser walk finds no problem;
  `npm test` and `npm run check` pass.
- No spend.

## Handoff — state at last stop

*Kept true while claimed, not written on the way out (rule 8).*

- **Last touched:** 2026-10-08, adervark @k/c1e9ef11 2026-10-08 (claimed)
- **In flight:** nothing
- **On disk:** nothing
- **Resume with:** the Steps
- **Next decision:** none

## Verify

Screenshots at each width.

## Result

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
