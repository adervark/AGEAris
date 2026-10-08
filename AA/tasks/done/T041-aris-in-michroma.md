---
id: T041
title: "The Aris wordmark in Michroma: the plain sans looked too basic"
status: done
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

- [x] `public/michroma.woff2` served as `font/woff2`; its licence in
      `docs/brand/`.
- [x] The wordmark in Michroma, capitals, spaced, chrome, centred.
- [x] DESIGN.md says so.

## Decision rules — fixed in advance

- Pass: the sidebar shows ARIS in Michroma (not a fallback face), centred
  under the logo; the server serves the font with its type and the test
  checks it; the browser walk finds no problem, and no request fails;
  `npm test` and `npm run check` pass.
- No spend.

## Handoff — state at last stop

*Kept true while claimed, not written on the way out (rule 8).*

- **Last touched:** 2026-10-09, adervark @k/c1e9ef11 (done)
- **In flight:** nothing
- **On disk:** nothing
- **Resume with:** nothing
- **Next decision:** none

## Verify

A close-up of the sidebar; the font's request in the walk.

## Result

Pass. The wordmark reads ARIS in Michroma: 22 px, capitals, 0.22 em apart,
in the T039 chrome, centred under the logo.

- **The font:** `public/michroma.woff2`, 3.5 KB, the glyphs A, R, I and S
  only (another letter would fall back to the sans); served at
  `/michroma.woff2` as `font/woff2`, under the page's `default-src 'self'`.
  Its licence, SIL OFL 1.1, is `docs/brand/michroma-OFL.txt`.
- **Checked:** the browser reports the wordmark drawn in Michroma (4 glyphs,
  web font), not a fallback. The server test fetches the font and checks its
  type and its `wOF2` signature.
- `npm test` passed 505 of 505, and `npm run check` passed. The browser walk
  found 0 problems in 102 page views, with no failed request.

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
