# State — AGE Aris

<!-- AA:now -->
**Standing:** AGE Aris tracks its own development on this board from
2026-10-07. The UI revamp and the renames (the product, AGE Aris; its board,
AA) are committed on `feature/pm-cockpit`, which is not on `main` yet.
AGEION, AGEIS, Gem4A and RSNA have moved their boards to `AA/` too.

**Next action:** one-click task actions (plan `docs/plans/task-control.md`,
approved 2026-10-07): T021, T022 and T023 are done, so task actions work on
tracked AA boards once switched on. T024 (card menu, keys, drag) and T025
(STATE.md behind) are next; T026 holds the T023 review's low findings and one
operator decision. The review's bugs (T007 with T012, T011 with T013, T008
with T010) follow.

**Watch out for:** until T007 is fixed, AGE Aris reads RSNA's T120 as the
task that reuses its id. AGE Aris must go on reading `deaddrop/` and `pm/`
boards. Its data folder must stay outside this repository, or it refuses to
track it (T003).
<!-- /AA:now -->

<!-- AA:generated -->
`board · 2026-10-08T09:32Z · 28 tasks: 4 backlog, 0 WIP (0 in progress), 24 delivered`

FLOW · **WIP 0/2** · throughput 5.6/wk (24 in 30d) · cycle time 50th 3m / 85th 33m (n=24)
FLOW · Little's Law: 0 ÷ 5.6/wk ≈ now expected · lead time 85th 35h

| | id | task | owner | age | |
|---|---|---|---|---|---|
| **BACKLOG** | T003 | Track the repository AGE Aris runs from without moving its data | — | 36h |  |
|  | T004 | Keep one copy of the aa-init template | — | 36h |  |
|  | T024 | The card menu, the keyboard map, and drag through the action registry | — | 16h |  |
|  | T025 | Say on the project page that STATE.md is behind, or kept by hand | — | 16h |  |
| **DONE** | T026 | Tracked task actions: the review's remaining low findings | adervark | now |  |
|  | T016 | ckpt.sh check exits 1 on a clean trail | adervark | 5m |  |
|  | T014 | A paragraph past MAX_INLINE drops hard breaks for a span it never renders | adervark | 13m |  |
|  | T015 | Code spans are not found as CommonMark finds them | adervark | 13m |  |
|  | T002 | Bold or a link that contains inline code shows raw markers | adervark | 17m |  |
|  | T009 | Four markdown patterns take quadratic time on one long line | adervark | 17m |  |
|  | T008 | A line separator in a wrapped list line crashes the renderer | adervark | 21m |  |
|  | T010 | A paragraph indented less than a list item's content keeps the list's hold | adervark | 21m |  |
|  | T011 | board.sh loses the history from before a board rename | adervark | 24m |  |
|  | T013 | The Method view names a settings file the board does not have | adervark | 24m |  |
|  | T007 | A board moved in one commit follows the wrong file when an id is duplicated | adervark | 27m |  |
|  | T012 | A blocked task loses its Handoff reason when its file moves | adervark | 27m |  |
|  | T028 | A README that explains the workflow, for a first-time tester | adervark | 3h |  |
|  | T027 | /aa restarts an AGE Aris server that is older than its code | adervark | 4h |  |
|  | T023 | Task actions on tracked AA boards, end to end; the read-only rule lifted | adervark | 13h |  |
|  | T021 | A tracked-write engine that commits one task file under git's lock | adervark | 14h |  |
|  | T022 | Task actions in the drawer, on AGE Aris projects first | adervark | 14h |  |
|  | T019 | A Working page: everything in progress or blocked, on every board | adervark | 34h |  |
|  | T020 | A cockpit test fails when run in the early hours | adervark | 34h |  |
|  | T018 | /aa pulls up a project's board in any Claude Code session | adervark | 35h |  |
|  | T017 | Two owner-line regexes take quadratic time on a long line | adervark | 35h |  |
|  | T005 | A dollar pattern in a task title corrupts the task file on every edit | adervark | 35h |  |
|  | T006 | A stray AA/tasks/ folder switches a project's board | adervark | 35h |  |
|  | T001 | Review 479b6e7 and e64f823 independently | adervark | 35h |  |

age: in the queue (BACKLOG) · since the claim (IN PROGRESS) · since blocking (BLOCKED) · since delivery (DONE)
<!-- /AA:generated -->

<!--
  NOW block: yours. Three fields, rewritten in place, never appended to.
  Generated region: rendered by `AA/board.sh --write`; hand edits are
  discarded (rule 11). History belongs in the log, the task file, or done/.
-->
