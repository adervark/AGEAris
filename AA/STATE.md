# State — AGE Aris

<!-- AA:now -->
**Standing:** AGE Aris tracks its own development on this board. Task
control (`docs/plans/task-control.md`, T021–T026) is delivered as of
2026-11-03: the drawer's bar, the card and row menu, the keys and drag all
act through one registry, on AGE Aris projects and on tracked AA boards, and
the project page says when STATE.md is behind (T025). `npm run e2e` is green
again (T100). Everything is on `feature/pm-cockpit`, not on `main`.

**In progress:** nothing.

**Next action:** the agent brain (T052, `docs/plans/agent-brain.md`). T060
(disk cache), T061 (slim `/api/workspace`) and T102 (warm orient) can start
on T054's fixture; T056 waits on T004. T003 needs the operator's choice in
its file first.

**Watch out for:** AGE Aris must go on reading `deaddrop/` and `pm/` boards,
and its data folder must stay outside this repository (T003). The installed
`/aa` is behind `skills/aa` (T099, a `global-config` spend). T016's
`AA/ckpt.sh` patch is uncommitted in AGEION, AGEIS, Gem4A and RSNA. History
lives in PROGRESS.md and `done/`, not here.
<!-- /AA:now -->

<!-- AA:generated -->
`board · 2026-11-02T19:53Z · 102 tasks: 30 backlog, 0 WIP (0 in progress), 72 delivered`

FLOW · **WIP 0/2** · throughput 16.3/wk (70 in 30d) · cycle time 50th 7m / 85th 3h (n=70)
FLOW · Little's Law: 0 ÷ 16.3/wk ≈ now expected · lead time 85th 35h

| | id | task | owner | age | |
|---|---|---|---|---|---|
| **BACKLOG** 30 | | `T003` `T004` `T047` `T051` `T056` `T058` +24 more (`--all`) | | | ⚑ 0 not ready |
| **DONE** | T100 | The task-actions e2e fails 9 of 24, before T068 as after | adervark | 17m |  |
|  | T054 | Scale baseline: a 300-repository perf fixture | adervark | 32h |  |
|  | T068 | Deprecate or archive a project, either kind, and restore it | adervark | 8d |  |
|  | T053 | Measure how often agents get lost: a baseline | adervark | 8d |  |
|  | T097 | Three tests race a cold ledger build when the whole suite runs at once | adervark | 8d |  |
|  | T057 | `Cockpit.orient` and `GET /api/orient` | adervark | 9d |  |
|  | T063 | Capabilities: what an agent may do, and how | adervark | 9d |  |
|  | T094 | H2: research-runs v2.8 on RSNA T121, the held-out round | adervark | 9d |  |
|  | T090 | Research-runs design v2.8: catch a correction of a word, a scope or a reason | adervark | 10d |  |
|  | T093 | Limits read each minute, the 5-hour window defined, /aa current | adervark | 10d |  |
|  | T092 | Renew an expired token, so every account reads live | adervark | 11d |  |
|  | T091 | Every account's limits in sight on every page, kept fresh | adervark | 11d |  |
|  | T089 | The limits left on each Claude account | adervark | 11d |  |
|  | T086 | H1: research-runs v2.6 replayed on a round it was not built from | adervark | 11d |  |
|  | T087 | Research-runs design v2.7: answer R0d's missed canary and its loose ends | adervark | 11d |  |
|  | T085 | R0d: round 3 re-reconciled under v2.6, graded on the same twelve | adervark | 11d |  |
|  | T084 | Research-runs design v2.6: answer R0c's 7 of 12 | adervark | 12d |  |
|  | T082 | Research-runs design v2.5: answer R0b's recall of 2 of 12 | adervark | 12d |  |
|  | T075 | R0b: replay RSNA's round 3 with facts, graded on every correction its synthesis records | adervark | 20d |  |
|  | T073 | Research runs, aggregated: one line of thought, in the operator's sight | adervark | 20d |  |
|  | T074 | Replay RSNA's research round 3 as a ledger: do the checks catch what its synthesis caught by hand? | adervark | 20d |  |
|  | T055 | The orient contract and its scenario corpus | adervark | 22d |  |
|  | T070 | A run names its process, so a session reads as running or closed | adervark | 23d |  |
|  | T069 | A long act says when it expects to finish, so orient never restarts it | adervark | 23d |  |
|  | T052 | The agent's brain: a design that orients any agent, on any repo, at team scale | adervark | 23d |  |
|  | T049 | Every AGESight name becomes AGE Aris's, and the old ones are still read | adervark | 24d |  |
|  | T050 | /aa on Windows without WSL | adervark | 24d |  |
|  | T046 | Install in one line: /aa names everything the machine is missing, at once | adervark | 24d |  |
|  | T048 | The plugin is agearis: the install and the plugin list still said agesight | adervark | 24d |  |
|  | T045 | /aa prints the signed-in link: the plain link gave a sign-in error | adervark | 24d |  |
|  | T044 | Restructure the interface around flow strips: it reads as a stock SaaS card kit | adervark | 24d |  |
|  | T043 | The menu button does nothing on a desktop: it should fold the sidebar away | adervark | 25d |  |
|  | T042 | Black glass with a silver edge: T039's gradient chrome looked like a basic app | adervark | 25d |  |
|  | T041 | The Aris wordmark in Michroma: the plain sans looked too basic | adervark | 25d |  |
|  | T040 | Aris under the logo, centred | adervark | 25d |  |
|  | T039 | Silver that reads as metal: T036's chrome still looks like flat grey | adervark | 25d |  |
|  | T038 | The Flow tab shows only what the data supports: empty charts, oversized text, numbers that disagree | adervark | 25d |  |
|  | T037 | The page fills a wide screen: on an ultrawide monitor it is a 1240px strip | adervark | 25d |  |
|  | T036 | Silver you can see: T034's accent was too faint to notice | adervark | 25d |  |
|  | T035 | The forecast samples days from before the board existed | adervark | 25d |  |
|  | T034 | Silver accents, taken from the logo | adervark | 25d |  |
|  | T033 | Chart defects found on real boards: a yearless date, a thin forecast, repeated ticks, stacked dots | adervark | 25d |  |
|  | T032 | A forecast from throughput: when, and how many | adervark | 25d |  |
|  | T030 | An aging WIP chart: what is not moving | adervark | 25d |  |
|  | T031 | A cycle-time scatterplot with the service level | adervark | 25d |  |
|  | T029 | Research: what Scrum masters and flow coaches use to see the work | adervark | 25d |  |
|  | T026 | Tracked task actions: the review's remaining low findings | adervark | 25d |  |
|  | T016 | ckpt.sh check exits 1 on a clean trail | adervark | 25d |  |
|  | T014 | A paragraph past MAX_INLINE drops hard breaks for a span it never renders | adervark | 25d |  |
|  | T015 | Code spans are not found as CommonMark finds them | adervark | 25d |  |
|  | T002 | Bold or a link that contains inline code shows raw markers | adervark | 25d |  |
|  | T009 | Four markdown patterns take quadratic time on one long line | adervark | 25d |  |
|  | T008 | A line separator in a wrapped list line crashes the renderer | adervark | 25d |  |
|  | T010 | A paragraph indented less than a list item's content keeps the list's hold | adervark | 25d |  |
|  | T011 | board.sh loses the history from before a board rename | adervark | 25d |  |
|  | T013 | The Method view names a settings file the board does not have | adervark | 25d |  |
|  | T007 | A board moved in one commit follows the wrong file when an id is duplicated | adervark | 25d |  |
|  | T012 | A blocked task loses its Handoff reason when its file moves | adervark | 25d |  |
|  | T028 | A README that explains the workflow, for a first-time tester | adervark | 25d |  |
|  | T027 | /aa restarts an AGE Aris server that is older than its code | adervark | 25d |  |
|  | T023 | Task actions on tracked AA boards, end to end; the read-only rule lifted | adervark | 25d |  |
|  | T021 | A tracked-write engine that commits one task file under git's lock | adervark | 26d |  |
|  | T022 | Task actions in the drawer, on AGE Aris projects first | adervark | 26d |  |
|  | T019 | A Working page: everything in progress or blocked, on every board | adervark | 26d |  |
|  | T020 | A cockpit test fails when run in the early hours | adervark | 26d |  |
|  | T018 | /aa pulls up a project's board in any Claude Code session | adervark | 26d |  |
|  | T017 | Two owner-line regexes take quadratic time on a long line | adervark | 26d |  |
|  | T005 | A dollar pattern in a task title corrupts the task file on every edit | adervark | 26d |  |
|  | T006 | A stray AA/tasks/ folder switches a project's board | adervark | 26d |  |
|  | T001 | Review 479b6e7 and e64f823 independently | adervark | 26d |  |

age: in the queue (BACKLOG) · since the claim (IN PROGRESS) · since blocking (BLOCKED) · since delivery (DONE)
<!-- /AA:generated -->

<!--
  NOW block: yours. Three fields, rewritten in place, never appended to.
  Generated region: rendered by `AA/board.sh --write`; hand edits are
  discarded (rule 11). History belongs in the log, the task file, or done/.
-->
