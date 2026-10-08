---
id: T028
title: "A README that explains the workflow, for a first-time tester"
status: done
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

- [x] Open with what AGE Aris is, in a few lines, and the owner's logo.
- [x] A quick start for a tester, with the warning about Implement-stage agents.
- [x] A workflow section: the task lifecycle, who does what, the three ways in
      (own projects, tracked repositories, the agent pipeline), with diagrams
      GitHub renders.
- [x] A ten-minute tour that walks the workflow in the app.
- [x] Keep the reference sections and their anchors.

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

- **Last touched:** 2026-10-08, adervark @k/adccab68 (done)
- **In flight:** nothing
- **On disk:** nothing
- **Resume with:** nothing
- **Next decision:** none

## Verify

Read the README on GitHub after the push; click every internal link.

## Result

**Done.** README.md now opens with what AGE Aris is (with the owner's logo),
a quick start, the workflow (the board as a folder, a task's life with a
state diagram, who does what with a flow diagram, the three ways in with the
pipeline diagram, a day with it) and a ten-minute tour. The reference
sections follow unchanged, anchors included. Commit 34af27b.

Against the decision rules:

- One push: `feature/pm-cockpit` 09b4b78..34af27b, checkpointed before and
  after (run adccab68; trail committed in 81339b5 and retired in 2cadc09).
- Claims checked against a scratch server (its own data folder, no `claude`
  on PATH). The tour changed twice as a result. `main` holds only the plugin,
  so the quick start clones `feature/pm-cockpit`. The sample project sits at
  its WIP limit of 8, so **Run with agents** there is refused, and the tour
  runs the pipeline on a new project instead. That run stopped at the Plan
  and Review gates and reached Done once both were approved. A second clone of
  this repository tracked with 28 tasks.
- Renders: the three Mermaid diagrams render with mermaid 11.4.1 in headless
  Chrome. GitHub's rendered README (`gh api …/readme`, HTML) has three mermaid
  sections, the warning alert, the logo, and both internal anchors.
  Headless Chrome could not load github.com itself, so the page was not seen
  as a person sees it.
- `npm test` 473 of 473 and `npm run check` pass.
- Found, not fixed: `docs/PIPELINE.md` still says AGE Aris "only reads" a
  tracked repository, which T023 made untrue.
- Log: PROGRESS.md, 2026-10-08 — T028.

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
