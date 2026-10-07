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
`board · 2026-10-07T17:12Z · 25 tasks: 18 backlog, 0 WIP (0 in progress), 7 delivered`

FLOW · **WIP 0/2** · throughput 1.6/wk (7 in 30d) · cycle time 50th 5m / 85th 7m (n=7)
FLOW · Little's Law: 0 ÷ 1.6/wk ≈ now expected · lead time 85th 7m

| | id | task | owner | age | |
|---|---|---|---|---|---|
| **BACKLOG** 18 | | `T002` `T003` `T004` `T007` `T008` `T009` +12 more (`--all`) | | | ⚑ 0 not ready |
| **DONE** | T019 | A Working page: everything in progress or blocked, on every board | adervark | 18h |  |
|  | T020 | A cockpit test fails when run in the early hours | adervark | 18h |  |
|  | T018 | /aa pulls up a project's board in any Claude Code session | adervark | 19h |  |
|  | T017 | Two owner-line regexes take quadratic time on a long line | adervark | 19h |  |
|  | T005 | A dollar pattern in a task title corrupts the task file on every edit | adervark | 19h |  |
|  | T006 | A stray AA/tasks/ folder switches a project's board | adervark | 19h |  |
|  | T001 | Review 479b6e7 and e64f823 independently | adervark | 19h |  |

age: in the queue (BACKLOG) · since the claim (IN PROGRESS) · since blocking (BLOCKED) · since delivery (DONE)
<!-- /AA:generated -->

<!--
  NOW block: yours. Three fields, rewritten in place, never appended to.
  Generated region: rendered by `AA/board.sh --write`; hand edits are
  discarded (rule 11). History belongs in the log, the task file, or done/.
-->
