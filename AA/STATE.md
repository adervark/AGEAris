# State — AGE Aris

<!-- AA:now -->
**Standing:** AGE Aris tracks its own development on this board from
2026-10-07. The UI revamp, the renames and task actions on tracked AA boards
are committed on `feature/pm-cockpit`, which is not on `main` yet; it was
pushed on 2026-10-08 so a tester can try it (T028). Every bug the reviews
found is fixed (2026-10-08: T002, T007–T016, T026).

**Next action:** T024 (card menu, keys, drag) and T025 (STATE.md behind), from
`docs/plans/task-control.md`. T003 needs the operator's choice in its file
before it can be claimed.

**Watch out for:** T016 patched `AA/ckpt.sh` in AGEION, AGEIS, Gem4A and RSNA
and left it uncommitted there; each repository's own session commits it.
AGE Aris must go on reading `deaddrop/` and `pm/` boards. Its data folder
must stay outside this repository, or it refuses to track it (T003).
<!-- /AA:now -->

<!-- AA:generated -->
`board · 2026-10-08T10:14Z · 32 tasks: 4 backlog, 0 WIP (0 in progress), 28 delivered`

FLOW · **WIP 0/2** · throughput 6.5/wk (28 in 30d) · cycle time 50th 4m / 85th 8m (n=28)
FLOW · Little's Law: 0 ÷ 6.5/wk ≈ now expected · lead time 85th 35h

| | id | task | owner | age | |
|---|---|---|---|---|---|
| **BACKLOG** | T003 | Track the repository AGE Aris runs from without moving its data | — | 37h |  |
|  | T004 | Keep one copy of the aa-init template | — | 37h |  |
|  | T024 | The card menu, the keyboard map, and drag through the action registry | — | 17h |  |
|  | T025 | Say on the project page that STATE.md is behind, or kept by hand | — | 17h |  |
| **DONE** | T032 | A forecast from throughput: when, and how many | adervark | now |  |
|  | T030 | An aging WIP chart: what is not moving | adervark | 5m |  |
|  | T031 | A cycle-time scatterplot with the service level | adervark | 5m |  |
|  | T029 | Research: what Scrum masters and flow coaches use to see the work | adervark | 24m |  |
|  | T026 | Tracked task actions: the review's remaining low findings | adervark | 42m |  |
|  | T016 | ckpt.sh check exits 1 on a clean trail | adervark | 47m |  |
|  | T014 | A paragraph past MAX_INLINE drops hard breaks for a span it never renders | adervark | 55m |  |
|  | T015 | Code spans are not found as CommonMark finds them | adervark | 55m |  |
|  | T002 | Bold or a link that contains inline code shows raw markers | adervark | 59m |  |
|  | T009 | Four markdown patterns take quadratic time on one long line | adervark | 59m |  |
|  | T008 | A line separator in a wrapped list line crashes the renderer | adervark | 63m |  |
|  | T010 | A paragraph indented less than a list item's content keeps the list's hold | adervark | 63m |  |
|  | T011 | board.sh loses the history from before a board rename | adervark | 66m |  |
|  | T013 | The Method view names a settings file the board does not have | adervark | 66m |  |
|  | T007 | A board moved in one commit follows the wrong file when an id is duplicated | adervark | 69m |  |
|  | T012 | A blocked task loses its Handoff reason when its file moves | adervark | 69m |  |
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
