# State — AGE Aris

<!-- AA:now -->
**Standing:** AGE Aris tracks its own development on this board from
2026-10-07. The UI revamp, the renames and task actions on tracked AA boards
are committed on `feature/pm-cockpit`, which is not on `main` yet; it was
pushed on 2026-10-08 so a tester can try it (T028). Every bug the reviews
found is fixed (2026-10-08: T002, T007–T016, T026).

**Next action:** the Flow tab's first slice of charts is done (T030–T032:
aging WIP, cycle-time scatterplot, forecast). The rest of
`docs/plans/visualisation.md` (CFD, burnup, where a task's time went, process
behaviour charts) is registered only when the operator chooses. Otherwise
T024 (card menu, keys, drag) and T025 (STATE.md behind). T003 needs the
operator's choice in its file before it can be claimed.

**Watch out for:** T016 patched `AA/ckpt.sh` in AGEION, AGEIS, Gem4A and RSNA
and left it uncommitted there; each repository's own session commits it.
AGE Aris must go on reading `deaddrop/` and `pm/` boards. Its data folder
must stay outside this repository, or it refuses to track it (T003).
<!-- /AA:now -->

<!-- AA:generated -->
`board · 2026-10-08T10:34Z · 33 tasks: 4 backlog, 0 WIP (0 in progress), 29 delivered`

FLOW · **WIP 0/2** · throughput 6.8/wk (29 in 30d) · cycle time 50th 4m / 85th 13m (n=29)
FLOW · Little's Law: 0 ÷ 6.8/wk ≈ now expected · lead time 85th 35h

| | id | task | owner | age | |
|---|---|---|---|---|---|
| **BACKLOG** | T003 | Track the repository AGE Aris runs from without moving its data | — | 37h |  |
|  | T004 | Keep one copy of the aa-init template | — | 37h |  |
|  | T024 | The card menu, the keyboard map, and drag through the action registry | — | 17h |  |
|  | T025 | Say on the project page that STATE.md is behind, or kept by hand | — | 17h |  |
| **DONE** | T033 | Chart defects found on real boards: a yearless date, a thin forecast, repeated ticks, stacked dots | adervark | now |  |
|  | T032 | A forecast from throughput: when, and how many | adervark | 20m |  |
|  | T030 | An aging WIP chart: what is not moving | adervark | 25m |  |
|  | T031 | A cycle-time scatterplot with the service level | adervark | 25m |  |
|  | T029 | Research: what Scrum masters and flow coaches use to see the work | adervark | 45m |  |
|  | T026 | Tracked task actions: the review's remaining low findings | adervark | 62m |  |
|  | T016 | ckpt.sh check exits 1 on a clean trail | adervark | 67m |  |
|  | T014 | A paragraph past MAX_INLINE drops hard breaks for a span it never renders | adervark | 76m |  |
|  | T015 | Code spans are not found as CommonMark finds them | adervark | 76m |  |
|  | T002 | Bold or a link that contains inline code shows raw markers | adervark | 79m |  |
|  | T009 | Four markdown patterns take quadratic time on one long line | adervark | 79m |  |
|  | T008 | A line separator in a wrapped list line crashes the renderer | adervark | 84m |  |
|  | T010 | A paragraph indented less than a list item's content keeps the list's hold | adervark | 84m |  |
|  | T011 | board.sh loses the history from before a board rename | adervark | 86m |  |
|  | T013 | The Method view names a settings file the board does not have | adervark | 86m |  |
|  | T007 | A board moved in one commit follows the wrong file when an id is duplicated | adervark | 89m |  |
|  | T012 | A blocked task loses its Handoff reason when its file moves | adervark | 89m |  |
|  | T028 | A README that explains the workflow, for a first-time tester | adervark | 4h |  |
|  | T027 | /aa restarts an AGE Aris server that is older than its code | adervark | 5h |  |
|  | T023 | Task actions on tracked AA boards, end to end; the read-only rule lifted | adervark | 14h |  |
|  | T021 | A tracked-write engine that commits one task file under git's lock | adervark | 15h |  |
|  | T022 | Task actions in the drawer, on AGE Aris projects first | adervark | 15h |  |
|  | T019 | A Working page: everything in progress or blocked, on every board | adervark | 35h |  |
|  | T020 | A cockpit test fails when run in the early hours | adervark | 35h |  |
|  | T018 | /aa pulls up a project's board in any Claude Code session | adervark | 36h |  |
|  | T017 | Two owner-line regexes take quadratic time on a long line | adervark | 36h |  |
|  | T005 | A dollar pattern in a task title corrupts the task file on every edit | adervark | 36h |  |
|  | T006 | A stray AA/tasks/ folder switches a project's board | adervark | 36h |  |
|  | T001 | Review 479b6e7 and e64f823 independently | adervark | 36h |  |

age: in the queue (BACKLOG) · since the claim (IN PROGRESS) · since blocking (BLOCKED) · since delivery (DONE)
<!-- /AA:generated -->

<!--
  NOW block: yours. Three fields, rewritten in place, never appended to.
  Generated region: rendered by `AA/board.sh --write`; hand edits are
  discarded (rule 11). History belongs in the log, the task file, or done/.
-->
