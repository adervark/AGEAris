# State — AGE Aris

<!-- AA:now -->
**Standing:** AGE Aris tracks its own development on this board from
2026-10-07. The UI revamp and the renames (the product, AGE Aris; its board,
AA) are committed on `feature/pm-cockpit`, which is not on `main` yet.
AGEION, AGEIS, Gem4A and RSNA have moved their boards to `AA/` too.

**Next action:** one-click task actions (plan `docs/plans/task-control.md`,
approved 2026-10-07): T021 (write engine) with T022 (drawer actions on AGE
Aris projects), then T023, T024, T025. The review's bugs (T007 with T012, T011
with T013, T008 with T010) follow. Done today: T005, T006, T017, T018, T019,
T020.

**Watch out for:** until T007 is fixed, AGE Aris reads RSNA's T120 as the
task that reuses its id. AGE Aris must go on reading `deaddrop/` and `pm/`
boards. Its data folder must stay outside this repository, or it refuses to
track it (T003).
<!-- /AA:now -->

<!-- AA:generated -->
`board · 2026-10-07T19:13Z · 25 tasks: 15 backlog, 1 WIP (1 in progress), 9 delivered`

FLOW · **WIP 1/2** · throughput 2.1/wk (9 in 30d) · cycle time 50th 6m / 85th 1h (n=9)
FLOW · Little's Law: 1 ÷ 2.1/wk ≈ 3d expected · lead time 85th 1h

| | id | task | owner | age | |
|---|---|---|---|---|---|
| **IN PROGRESS** 1/2 | T023 | Task actions on tracked AA boards, end to end; the read-only rule lifted | adervark | 2h | ⚠ |
| **BACKLOG** 15 | | `T002` `T003` `T004` `T007` `T008` `T009` +9 more (`--all`) | | | ⚑ 0 not ready |
| **DONE** | T021 | A tracked-write engine that commits one task file under git's lock | adervark | now |  |
|  | T022 | Task actions in the drawer, on AGE Aris projects first | adervark | 15m |  |
|  | T019 | A Working page: everything in progress or blocked, on every board | adervark | 20h |  |
|  | T020 | A cockpit test fails when run in the early hours | adervark | 20h |  |
|  | T018 | /aa pulls up a project's board in any Claude Code session | adervark | 21h |  |
|  | T017 | Two owner-line regexes take quadratic time on a long line | adervark | 21h |  |
|  | T005 | A dollar pattern in a task title corrupts the task file on every edit | adervark | 21h |  |
|  | T006 | A stray AA/tasks/ folder switches a project's board | adervark | 21h |  |
|  | T001 | Review 479b6e7 and e64f823 independently | adervark | 21h |  |

age: in the queue (BACKLOG) · since the claim (IN PROGRESS) · since blocking (BLOCKED) · since delivery (DONE)
- ⚠ work item age past the 85th-percentile cycle time this repo has delivered — finish or split it; it is not a lock
<!-- /AA:generated -->

<!--
  NOW block: yours. Three fields, rewritten in place, never appended to.
  Generated region: rendered by `AA/board.sh --write`; hand edits are
  discarded (rule 11). History belongs in the log, the task file, or done/.
-->
