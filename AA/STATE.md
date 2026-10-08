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
`board · 2026-10-08T12:08Z · 35 tasks: 4 backlog, 0 WIP (0 in progress), 31 delivered`

FLOW · **WIP 0/2** · throughput 7.2/wk (31 in 30d) · cycle time 50th 4m / 85th 13m (n=31)
FLOW · Little's Law: 0 ÷ 7.2/wk ≈ now expected · lead time 85th 35h

| | id | task | owner | age | |
|---|---|---|---|---|---|
| **BACKLOG** | T003 | Track the repository AGE Aris runs from without moving its data | — | 39h |  |
|  | T004 | Keep one copy of the aa-init template | — | 39h |  |
|  | T024 | The card menu, the keyboard map, and drag through the action registry | — | 18h |  |
|  | T025 | Say on the project page that STATE.md is behind, or kept by hand | — | 18h |  |
| **DONE** | T035 | The forecast samples days from before the board existed | adervark | now |  |
|  | T034 | Silver accents, taken from the logo | adervark | 83m |  |
|  | T033 | Chart defects found on real boards: a yearless date, a thin forecast, repeated ticks, stacked dots | adervark | 1h |  |
|  | T032 | A forecast from throughput: when, and how many | adervark | 1h |  |
|  | T030 | An aging WIP chart: what is not moving | adervark | 1h |  |
|  | T031 | A cycle-time scatterplot with the service level | adervark | 1h |  |
|  | T029 | Research: what Scrum masters and flow coaches use to see the work | adervark | 2h |  |
|  | T026 | Tracked task actions: the review's remaining low findings | adervark | 2h |  |
|  | T016 | ckpt.sh check exits 1 on a clean trail | adervark | 2h |  |
|  | T014 | A paragraph past MAX_INLINE drops hard breaks for a span it never renders | adervark | 2h |  |
|  | T015 | Code spans are not found as CommonMark finds them | adervark | 2h |  |
|  | T002 | Bold or a link that contains inline code shows raw markers | adervark | 2h |  |
|  | T009 | Four markdown patterns take quadratic time on one long line | adervark | 2h |  |
|  | T008 | A line separator in a wrapped list line crashes the renderer | adervark | 2h |  |
|  | T010 | A paragraph indented less than a list item's content keeps the list's hold | adervark | 2h |  |
|  | T011 | board.sh loses the history from before a board rename | adervark | 3h |  |
|  | T013 | The Method view names a settings file the board does not have | adervark | 3h |  |
|  | T007 | A board moved in one commit follows the wrong file when an id is duplicated | adervark | 3h |  |
|  | T012 | A blocked task loses its Handoff reason when its file moves | adervark | 3h |  |
|  | T028 | A README that explains the workflow, for a first-time tester | adervark | 6h |  |
|  | T027 | /aa restarts an AGE Aris server that is older than its code | adervark | 7h |  |
|  | T023 | Task actions on tracked AA boards, end to end; the read-only rule lifted | adervark | 16h |  |
|  | T021 | A tracked-write engine that commits one task file under git's lock | adervark | 16h |  |
|  | T022 | Task actions in the drawer, on AGE Aris projects first | adervark | 17h |  |
|  | T019 | A Working page: everything in progress or blocked, on every board | adervark | 37h |  |
|  | T020 | A cockpit test fails when run in the early hours | adervark | 37h |  |
|  | T018 | /aa pulls up a project's board in any Claude Code session | adervark | 38h |  |
|  | T017 | Two owner-line regexes take quadratic time on a long line | adervark | 38h |  |
|  | T005 | A dollar pattern in a task title corrupts the task file on every edit | adervark | 38h |  |
|  | T006 | A stray AA/tasks/ folder switches a project's board | adervark | 38h |  |
|  | T001 | Review 479b6e7 and e64f823 independently | adervark | 38h |  |

age: in the queue (BACKLOG) · since the claim (IN PROGRESS) · since blocking (BLOCKED) · since delivery (DONE)
<!-- /AA:generated -->

<!--
  NOW block: yours. Three fields, rewritten in place, never appended to.
  Generated region: rendered by `AA/board.sh --write`; hand edits are
  discarded (rule 11). History belongs in the log, the task file, or done/.
-->
