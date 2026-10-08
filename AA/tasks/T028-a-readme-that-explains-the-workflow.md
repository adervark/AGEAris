---
id: T028
title: "A README that explains the workflow, for a first-time tester"
status: claimed
owner: adervark @k/adccab68 2026-10-08 — rewrite README.md around the workflow
# type: one word; tasks of one type are timed together; `bug` counts as defect work
type: docs
# blockedReason: while blocked, one line saying what unblocks it; cleared on unblock
blockedReason: ""
depends: []
created: 2026-10-08
---

# T028 — A README that explains the workflow, for a first-time tester

## Goal

Someone who has never seen AGE Aris can read `README.md` top to bottom and
know what it is, how work flows through it (people, agents, the AA board, git),
and how to try it in ten minutes — before the reference detail starts.

## Context

- 2026-10-08: `feature/pm-cockpit` was pushed so the operator's friend can test
  it. The README is a feature catalogue: it says what each view shows but never
  how a task travels from idea to done, or who does what.
- `AA.yml` names `README.md` as the map; extend it, do not start a rival doc.

## Steps

- [ ] Open with what AGE Aris is, in a few lines, and the owner's logo.
- [ ] A quick start for a tester, with the warning about Implement-stage agents.
- [ ] A workflow section: the task lifecycle, who does what, the three ways in
      (own projects, tracked repositories, the agent pipeline), with diagrams
      GitHub renders.
- [ ] A ten-minute tour that walks the workflow in the app.
- [ ] Keep the reference sections and their anchors.

## Decision rules — fixed in advance

- Spend: one `push` of `feature/pm-cockpit` to origin, the branch already
  published there, so the friend sees the new README. Nothing else.
- Every claim in the new text is checked against the code or the existing docs;
  no feature is described that does not exist.
- Done means: the README renders (Markdown and Mermaid) on GitHub, every
  internal link resolves, product and board names follow CLAUDE.md, and
  `npm test` and `npm run check` pass on the commit.

## Handoff — state at last stop

*Kept true while claimed, not written on the way out (rule 8).*

- **Last touched:** 2026-10-08, adervark @k/adccab68 (claimed)
- **In flight:** README.md rewrite
- **On disk:** nothing yet
- **Resume with:** write README.md
- **Next decision:** none

## Verify

Read the README on GitHub after the push; click every internal link.

## Result

*(placeholder)*

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
