---
id: T015
title: "Code spans are not found as CommonMark finds them"
status: open
owner: —
# type: one word; tasks of one type are timed together; `bug` counts as defect work
type: bug
# blockedReason: while blocked, one line saying what unblocks it; cleared on unblock
blockedReason: ""
depends: []
created: 2026-10-07
---

# T015 — Code spans are not found as CommonMark finds them

## Goal

A backtick run closes only on a run of the same length; an opener with none
stays literal text. A lone double backtick no longer vanishes.

## Context

- Severity low, older than 479b6e7: found by T001's review of 479b6e7
  (defect 4). Since 479b6e7 the same pattern also decides line breaks
  (`public/markdown.js:110`), so the fix must reach both.
- `public/markdown.js:42`: `` line.split(/(`+[^`]*?`+)/) `` closes at the next run
  of any length.
- Inputs (markdown-it 3.0.0 as the reference): "don", two backticks, "t stop"
  renders `<p>don<code></code>t stop</p>`, where both backticks should stay as
  text; and a span opened by two backticks closes at the next single one, so
  runs of different lengths pair up.
- Close to T002 (code inside bold or a link), which changes the same function.

## Steps

- [ ] Failing tests for both inputs.
- [ ] One left-to-right scan over backtick runs, shared by `:42` and `:110`.

## Decision rules — fixed in advance

- No regex with nested or end-anchored quantifiers; linear on the 4 MB inputs.
- No spend.

## Handoff — state at last stop

*Kept true while claimed, not written on the way out (rule 8).*

- **Last touched:** 2026-10-07, adervark @k/ff713831 (registered, never claimed)
- **In flight:** nothing
- **On disk:** nothing yet
- **Resume with:** write the failing tests first
- **Next decision:** none

## Verify

`npm test`.

## Result

*(on completion: the outcome against the decision rules above, a pointer to the
entry in the log, and the digest from `AA/ckpt.sh close T015` — then
retire the trail with `--delete`)*

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
