---
id: T041
title: "The Aris wordmark in Michroma: the plain sans looked too basic"
status: claimed
owner: adervark @k/c1e9ef11 2026-10-09 — Aris in Michroma
# type: one word; tasks of one type are timed together; `bug` counts as defect work
type: design
# blockedReason: while blocked, one line saying what unblocks it; cleared on unblock
blockedReason: ""
depends: [T040]
created: 2026-10-09
---

# T041 — The Aris wordmark in Michroma

## Goal

The wordmark under the logo has a display face of its own, in chrome.

## Context

- 2026-10-09 the operator: "Give the logo a cool font this looks too basic".
  Eight candidates were rendered in chrome under the logo; the operator chose
  Michroma (wide, space-age capitals, spaced out).
- The page runs under a strict CSP (`default-src 'self'`) and takes no npm
  dependencies, so the font is served by AGE Aris itself: a woff2 subset of
  the four glyphs A, R, I, S, under the SIL Open Font License, whose text
  ships with it.

## Steps

- [ ] `public/michroma.woff2` served as `font/woff2`; its licence in
      `docs/brand/`.
- [ ] The wordmark in Michroma, capitals, spaced, chrome, centred.
- [ ] DESIGN.md says so.

## Decision rules — fixed in advance

- Pass: the sidebar shows ARIS in Michroma (not a fallback face), centred
  under the logo; the server serves the font with its type and the test
  checks it; the browser walk finds no problem, and no request fails;
  `npm test` and `npm run check` pass.
- No spend.

## Handoff — state at last stop

*Kept true while claimed, not written on the way out (rule 8).*

- **Last touched:** 2026-10-09, adervark @k/c1e9ef11 (claimed)
- **In flight:** nothing
- **On disk:** nothing
- **Resume with:** the Steps
- **Next decision:** none

## Verify

A close-up of the sidebar; the font's request in the walk.

## Result

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
