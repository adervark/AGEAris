---
id: T008
title: "A line separator in a wrapped list line crashes the renderer"
status: done
owner: adervark @k/adccab68 2026-10-08 — the renderer's list items and list hold
# type: one word; tasks of one type are timed together; `bug` counts as defect work
type: bug
# blockedReason: while blocked, one line saying what unblocks it; cleared on unblock
blockedReason: ""
depends: []
created: 2026-10-07
---

# T008 — A line separator in a wrapped list line crashes the renderer

## Goal

`renderMarkdown()` returns HTML for any text; a list item whose wrapped line
holds U+2028 or U+2029 renders, and the task drawer and the Method view with it.

## Context

- Severity high, older than 479b6e7 (779db76): found by T001's review of
  479b6e7 (defect 1).
- `public/markdown.js:162` appends a wrapped line to the item's raw text, and
  `:50` parses it again with `LIST_ITEM`, `/^(\s*)([-*+]|\d+[.)])\s+(.*)$/`. `.`
  stops at U+2028 and `$` is the end of input, so `exec` returns null and the
  destructuring throws.
- Input: `'- a\n  b\u2028c'` (also `'1. a\n   b\u2028c'`). Actual: `TypeError: object
  null is not iterable`. Expected: `<ul><li>a b\u2028c</li></ul>`.
- Effect: the task drawer (`public/app.js:707`, outside its `try`) stays on
  "Reading the task file…"; a board document with such a line stops the Method
  view rendering (`public/cockpit.js:386`, `public/app.js:382`).

## Steps

- [x] A failing test for both inputs.
- [x] Parse each item once, when it is collected, and append wrapped text to
  the parsed text, so `LIST_ITEM` never runs on joined text.

## Decision rules — fixed in advance

- No regex with nested or end-anchored quantifiers (as in T002).
- Pass: both inputs render; `tests/markdown.test.mjs` passes.
- No spend.

## Handoff — state at last stop

*Kept true while claimed, not written on the way out (rule 8).*

- **Last touched:** 2026-10-08, adervark @k/adccab68 (done)
- **In flight:** nothing
- **On disk:** nothing
- **Resume with:** nothing
- **Next decision:** none

## Verify

`npm test`; both inputs through `renderMarkdown()`.

## Result

**Done.** List items are parsed once, when they are collected (`listItem`),
and a wrapped line is appended to the parsed text, so `LIST_ITEM` never runs
on joined text. No new regex.

Against the decision rules:

- Test: `'- a\n  b\u2028c'` gives `<ul><li>a b\u2028c</li></ul>` and
  `'1. a\n   b\u2029c'` gives `<ol><li>a b\u2029c</li></ol>`; both threw
  before. `tests/markdown.test.mjs` passes.
- Found live: this repository's own `AA/tasks/done/T017-…md` holds a U+2028
  in a wrapped list line, and its drawer threw before the fix. It renders now.
  Of 307 task files on five boards (AGEIS, AGEION, RSNA, Gem4A, AGE Aris), it
  is the only render this pair of fixes changed.
- `npm test` 479 of 479 and `npm run check` pass. No spend.
- Log: PROGRESS.md, 2026-10-08 — T008 and T010.

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
