# State — AGE Aris

<!-- AA:now -->
**Standing:** AGE Aris tracks its own development on this board from
2026-10-07. The UI revamp and the renames (the product, AGE Aris; its board,
AA) are committed on `feature/pm-cockpit`, which is not on `main` yet.
AGEION, AGEIS, Gem4A and RSNA have moved their boards to `AA/` too.

**Next action:** the review's bugs (T001), two at a time: T005 with T006, then
T007 with T012, T011 with T013, and T008 with T010.

**Watch out for:** until T007 is fixed, AGE Aris reads RSNA's T120 as the
task that reuses its id. AGE Aris must go on reading `deaddrop/` and `pm/`
boards. Its data folder must stay outside this repository, or it refuses to
track it (T003).
<!-- /AA:now -->

<!-- AA:generated -->
`board · 2026-10-06T21:41Z · 16 tasks: 13 backlog, 2 WIP (2 in progress), 1 delivered`

FLOW · **WIP 2/2** · throughput 0.2/wk (1 in 30d) · cycle time: too few delivered with a claim commit (n=1)
FLOW · Little's Law: 2 ÷ 0.2/wk ≈ 60d expected

| | id | task | owner | age | |
|---|---|---|---|---|---|
| **IN PROGRESS** 2/2 | T005 | A dollar pattern in a task title corrupts the task file on every edit | adervark | now |  |
|  | T006 | A stray AA/tasks/ folder switches a project's board | adervark | now |  |
| **BACKLOG** 13 | | `T002` `T003` `T004` `T007` `T008` `T009` +7 more (`--all`) | | | ⚑ 0 not ready |
| **DONE** | T001 | Review 479b6e7 and e64f823 independently | adervark | now |  |

age: in the queue (BACKLOG) · since the claim (IN PROGRESS) · since blocking (BLOCKED) · since delivery (DONE)
<!-- /AA:generated -->

<!--
  NOW block: yours. Three fields, rewritten in place, never appended to.
  Generated region: rendered by `AA/board.sh --write`; hand edits are
  discarded (rule 11). History belongs in the log, the task file, or done/.
-->
