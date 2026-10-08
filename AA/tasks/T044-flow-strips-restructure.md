---
id: T044
title: "Restructure the interface around flow strips: it reads as a stock SaaS card kit"
status: claimed
owner: adervark @k/c1e9ef11 2026-10-09 — flow strips restructure
# type: one word; tasks of one type are timed together; `bug` counts as defect work
type: design
# blockedReason: while blocked, one line saying what unblocks it; cleared on unblock
blockedReason: ""
depends: [T037, T038, T041, T042, T043]
created: 2026-10-09
---

# T044 — Restructure the interface around flow strips

## Goal

AGE Aris has a point of view of its own: each board's work, moving through
its states, is the thing you see first, and the rest is quiet and typographic.

## Context

- 2026-10-09 the operator ran /frontend-design: "restructure this bad boy".
  The interface is the stock SaaS card kit: every section in the same
  rounded bordered box, ALL-CAPS labels, middle-dot meta strings, monospace
  data labels, the four numbers repeated as tiles, a Home with no hero.
- The operator chose (2026-10-09), from three directions: **flow strips**;
  body type **Hanken Grotesk** with Michroma for display. The plan is in this
  session's reply and summarised here:
  - Colour: true black, ink #F4F4F4, pewter #8E959E, silver #C9CED5 for rim
    and selection, status colours for meaning only (unchanged).
  - Type: Michroma for the wordmark, page titles and one figure a page;
    Hanken Grotesk for the rest, both self-hosted woff2 under the SIL OFL.
    Sentence-case labels, never caps.
  - The memorable element: a flow strip per board (Backlog → In progress →
    Blocked → Done this week), aging work amber then red, WIP over the limit
    crowding its lane. Home: Needs you beside the strips. A project page
    leads with its strip; its four numbers become one line; board columns
    become open lanes and cards quiet rows.
  - Boxes only where a thing is a separate object; left-aligned; no
    entrance animations.
- Constraints that stand: the CSP (no inline style or script), no npm
  dependencies, true black, the owner's artwork only, untrusted task text.

## Steps

- [ ] A throwaway mock of Home and a project page, on the real AGEIS and
      AGE Aris data, screenshotted for the operator. **Stop for approval.**
- [ ] The fonts, self-hosted with their licences.
- [ ] Type and colour tokens; caps labels, middle-dot strings and the card
      kit removed.
- [ ] The flow strip, as a module with tests.
- [ ] Home restructured; the project page restructured.
- [ ] DESIGN.md rewritten for the new system.

## Decision rules — fixed in advance

- The mock goes ahead only on the operator's approval.
- Pass: Home and every project page lead with flow strips drawn from the
  real data; no ALL-CAPS label and no middle-dot meta string remains in the
  UI; the strip is tested; the browser walk finds no problem at 390, 1440 and
  3440; WCAG AA contrast holds; `npm test` and `npm run check` pass.
- No spend.

## Handoff — state at last stop

*Kept true while claimed, not written on the way out (rule 8).*

- **Last touched:** 2026-10-09, adervark @k/c1e9ef11 (claimed)
- **In flight:** the mock
- **On disk:** nothing
- **Resume with:** the Steps
- **Next decision:** the operator approves the mock or redirects it

## Verify

Screenshots at three widths; the walk; the tests.

## Result

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
