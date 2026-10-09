---
id: T039
title: "Silver that reads as metal: T036's chrome still looks like flat grey"
status: done
owner: adervark @k/c1e9ef11 2026-10-09 — silver that reads as metal
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

- [x] Chrome on the wordmark, the primary button and the selected tab and
      sidebar item, with a highlight and a shadow band.
- [x] Remove the touches that read only as grey.
- [x] Status colours unchanged; contrast still passes WCAG AA.
- [x] DESIGN.md says so.

## Decision rules — fixed in advance

- Pass: in a screenshot at 100% the silver elements read as metal next to the
  avatar, and nothing else reads as grey decoration; text on chrome passes
  4.5:1; the browser walk finds no problem; `npm test` and `npm run check`
  pass.
- No spend.

## Handoff — state at last stop

*Kept true while claimed, not written on the way out (rule 8).*

- **Last touched:** 2026-10-09, adervark @k/c1e9ef11 (done)
- **In flight:** nothing
- **On disk:** nothing
- **Resume with:** nothing
- **Next decision:** none

## Verify

Close-up screenshots beside the avatar.

## Result

Pass, judged by eye in screenshots at 2× and 1×. The operator has not seen it
yet.

- **Why T036 read as grey:** its gradients shifted a few shades over 18 px of
  text, and the hairlines and lit edges were grey lines. Metal needs a
  horizon: a bright top, a sharp dark band just below the middle, a lighter
  reflection under it.
- **Chrome now:** the wordmark (20 px, 800 weight, horizon #6b727c: 4.3:1 on
  black, above the 3:1 large text needs); the primary button, bevelled with a
  white top edge and a dark rim (its darkest band gives black text 10.9:1,
  12.7:1 on hover); the avatar on the same sheen; a 3 px chrome bar on the
  selected sidebar item and under the selected tab.
- **Removed:** the brushed hairlines on the sidebar and top bar, the silver
  edges and lit tops on every surface, and the silver rims on secondary
  buttons. Surfaces keep their plain borders.
- **Unchanged:** the status colours, and "Add project", which is a secondary
  button by design.
- `npm test` passed 505 of 505, and `npm run check` passed. The browser walk
  found 0 problems in 102 page views.

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
