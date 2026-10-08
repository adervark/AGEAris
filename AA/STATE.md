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
`board · 2026-10-08T05:46Z · 28 tasks: 16 backlog, 0 WIP (0 in progress), 12 delivered`

FLOW · **WIP 0/2** · throughput 2.8/wk (12 in 30d) · cycle time 50th 6m / 85th 1h (n=12)
FLOW · Little's Law: 0 ÷ 2.8/wk ≈ now expected · lead time 85th 2h

| | id | task | owner | age | |
|---|---|---|---|---|---|
| **BACKLOG** 16 | | `T002` `T003` `T004` `T007` `T008` `T009` +10 more (`--all`) | | | ⚑ 0 not ready |
| **DONE** | T028 | A README that explains the workflow, for a first-time tester | adervark | now |  |
|  | T027 | /aa restarts an AGE Aris server that is older than its code | adervark | 60m |  |
|  | T023 | Task actions on tracked AA boards, end to end; the read-only rule lifted | adervark | 9h |  |
|  | T021 | A tracked-write engine that commits one task file under git's lock | adervark | 10h |  |
|  | T022 | Task actions in the drawer, on AGE Aris projects first | adervark | 10h |  |
|  | T019 | A Working page: everything in progress or blocked, on every board | adervark | 30h |  |
|  | T020 | A cockpit test fails when run in the early hours | adervark | 30h |  |
|  | T018 | /aa pulls up a project's board in any Claude Code session | adervark | 31h |  |
|  | T017 | Two owner-line regexes take quadratic time on a long line | adervark | 31h |  |
|  | T005 | A dollar pattern in a task title corrupts the task file on every edit | adervark | 31h |  |
|  | T006 | A stray AA/tasks/ folder switches a project's board | adervark | 31h |  |
|  | T001 | Review 479b6e7 and e64f823 independently | adervark | 32h |  |

age: in the queue (BACKLOG) · since the claim (IN PROGRESS) · since blocking (BLOCKED) · since delivery (DONE)
<!-- /AA:generated -->

<!--
  NOW block: yours. Three fields, rewritten in place, never appended to.
  Generated region: rendered by `AA/board.sh --write`; hand edits are
  discarded (rule 11). History belongs in the log, the task file, or done/.
-->
