# State — AGE Aris

<!-- AA:now -->
**Standing:** AGE Aris tracks its own development on this board from
2026-10-07. The UI revamp and the renames (the product, AGE Aris; its board,
AA) are committed on `feature/pm-cockpit`, which is not on `main` yet.
AGEION, AGEIS, Gem4A and RSNA have moved their boards to `AA/` too.

**Next action:** the review's bugs (T001), two at a time: T007 with T012, then
T011 with T013, and T008 with T010. T005, T006, T017 and T018 (`/aa`) are done.

**Watch out for:** until T007 is fixed, AGE Aris reads RSNA's T120 as the
task that reuses its id. AGE Aris must go on reading `deaddrop/` and `pm/`
boards. Its data folder must stay outside this repository, or it refuses to
track it (T003).
<!-- /AA:now -->

<!-- AA:generated -->
`board · 2026-10-06T22:05Z · 18 tasks: 13 backlog, 0 WIP (0 in progress), 5 delivered`

FLOW · **WIP 0/2** · throughput 1.2/wk (5 in 30d) · cycle time 50th 5m / 85th 33m (n=5)
FLOW · Little's Law: 0 ÷ 1.2/wk ≈ now expected · lead time 85th 36m

| | id | task | owner | age | |
|---|---|---|---|---|---|
| **BACKLOG** 13 | | `T002` `T003` `T004` `T007` `T008` `T009` +7 more (`--all`) | | | ⚑ 0 not ready |
| **DONE** | T018 | /aa pulls up a project's board in any Claude Code session | adervark | now |  |
|  | T017 | Two owner-line regexes take quadratic time on a long line | adervark | 8m |  |
|  | T005 | A dollar pattern in a task title corrupts the task file on every edit | adervark | 18m |  |
|  | T006 | A stray AA/tasks/ folder switches a project's board | adervark | 18m |  |
|  | T001 | Review 479b6e7 and e64f823 independently | adervark | 24m |  |

age: in the queue (BACKLOG) · since the claim (IN PROGRESS) · since blocking (BLOCKED) · since delivery (DONE)
<!-- /AA:generated -->

<!--
  NOW block: yours. Three fields, rewritten in place, never appended to.
  Generated region: rendered by `AA/board.sh --write`; hand edits are
  discarded (rule 11). History belongs in the log, the task file, or done/.
-->
