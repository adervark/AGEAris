# State — AGE Aris

<!-- AA:now -->
**Standing:** AGE Aris tracks its own development on this board from
2026-10-07. The UI revamp, the renames and task actions on tracked AA boards
are committed on `feature/pm-cockpit`, which is not on `main` yet; it was
pushed on 2026-10-08 so a tester can try it (T028). Every bug the reviews
found is fixed (2026-10-08: T002, T007–T016, T026).

**Next action:** make AGE Aris an agent's brain (T052, approved
2026-10-10: `docs/plans/agent-brain.md`). T053, T054, T055 and T063 can start
at once, and T055 (the orient contract) must apply the design's §11. Before
that, the Flow tab's first slice of charts was done (T030–T032:
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
`board · 2026-10-11T14:33Z · 71 tasks: 22 backlog, 0 WIP (0 in progress), 49 delivered`

FLOW · **WIP 0/2** · throughput 11.2/wk (48 in 30d) · cycle time 50th 4m / 85th 33m (n=48)
FLOW · Little's Law: 0 ÷ 11.2/wk ≈ now expected · lead time 85th 35h

| | id | task | owner | age | |
|---|---|---|---|---|---|
| **BACKLOG** 22 | | `T003` `T004` `T024` `T025` `T047` `T051` +16 more (`--all`) | | | ⚑ 0 not ready |
| **DONE** | T070 | A run names its process, so a session reads as running or closed | adervark | 19h |  |
|  | T069 | A long act says when it expects to finish, so orient never restarts it | adervark | 27h |  |
|  | T052 | The agent's brain: a design that orients any agent, on any repo, at team scale | adervark | 27h |  |
|  | T049 | Every AGESight name becomes AGE Aris's, and the old ones are still read | adervark | 2d |  |
|  | T050 | /aa on Windows without WSL | adervark | 2d |  |
|  | T046 | Install in one line: /aa names everything the machine is missing, at once | adervark | 2d |  |
|  | T048 | The plugin is agearis: the install and the plugin list still said agesight | adervark | 2d |  |
|  | T045 | /aa prints the signed-in link: the plain link gave a sign-in error | adervark | 2d |  |
|  | T044 | Restructure the interface around flow strips: it reads as a stock SaaS card kit | adervark | 2d |  |
|  | T043 | The menu button does nothing on a desktop: it should fold the sidebar away | adervark | 2d |  |
|  | T042 | Black glass with a silver edge: T039's gradient chrome looked like a basic app | adervark | 2d |  |
|  | T041 | The Aris wordmark in Michroma: the plain sans looked too basic | adervark | 2d |  |
|  | T040 | Aris under the logo, centred | adervark | 2d |  |
|  | T039 | Silver that reads as metal: T036's chrome still looks like flat grey | adervark | 2d |  |
|  | T038 | The Flow tab shows only what the data supports: empty charts, oversized text, numbers that disagree | adervark | 2d |  |
|  | T037 | The page fills a wide screen: on an ultrawide monitor it is a 1240px strip | adervark | 2d |  |
|  | T036 | Silver you can see: T034's accent was too faint to notice | adervark | 3d |  |
|  | T035 | The forecast samples days from before the board existed | adervark | 3d |  |
|  | T034 | Silver accents, taken from the logo | adervark | 3d |  |
|  | T033 | Chart defects found on real boards: a yearless date, a thin forecast, repeated ticks, stacked dots | adervark | 3d |  |
|  | T032 | A forecast from throughput: when, and how many | adervark | 3d |  |
|  | T030 | An aging WIP chart: what is not moving | adervark | 3d |  |
|  | T031 | A cycle-time scatterplot with the service level | adervark | 3d |  |
|  | T029 | Research: what Scrum masters and flow coaches use to see the work | adervark | 3d |  |
|  | T026 | Tracked task actions: the review's remaining low findings | adervark | 3d |  |
|  | T016 | ckpt.sh check exits 1 on a clean trail | adervark | 3d |  |
|  | T014 | A paragraph past MAX_INLINE drops hard breaks for a span it never renders | adervark | 3d |  |
|  | T015 | Code spans are not found as CommonMark finds them | adervark | 3d |  |
|  | T002 | Bold or a link that contains inline code shows raw markers | adervark | 3d |  |
|  | T009 | Four markdown patterns take quadratic time on one long line | adervark | 3d |  |
|  | T008 | A line separator in a wrapped list line crashes the renderer | adervark | 3d |  |
|  | T010 | A paragraph indented less than a list item's content keeps the list's hold | adervark | 3d |  |
|  | T011 | board.sh loses the history from before a board rename | adervark | 3d |  |
|  | T013 | The Method view names a settings file the board does not have | adervark | 3d |  |
|  | T007 | A board moved in one commit follows the wrong file when an id is duplicated | adervark | 3d |  |
|  | T012 | A blocked task loses its Handoff reason when its file moves | adervark | 3d |  |
|  | T028 | A README that explains the workflow, for a first-time tester | adervark | 3d |  |
|  | T027 | /aa restarts an AGE Aris server that is older than its code | adervark | 3d |  |
|  | T023 | Task actions on tracked AA boards, end to end; the read-only rule lifted | adervark | 3d |  |
|  | T021 | A tracked-write engine that commits one task file under git's lock | adervark | 3d |  |
|  | T022 | Task actions in the drawer, on AGE Aris projects first | adervark | 3d |  |
|  | T019 | A Working page: everything in progress or blocked, on every board | adervark | 4d |  |
|  | T020 | A cockpit test fails when run in the early hours | adervark | 4d |  |
|  | T018 | /aa pulls up a project's board in any Claude Code session | adervark | 4d |  |
|  | T017 | Two owner-line regexes take quadratic time on a long line | adervark | 4d |  |
|  | T005 | A dollar pattern in a task title corrupts the task file on every edit | adervark | 4d |  |
|  | T006 | A stray AA/tasks/ folder switches a project's board | adervark | 4d |  |
|  | T001 | Review 479b6e7 and e64f823 independently | adervark | 4d |  |

age: in the queue (BACKLOG) · since the claim (IN PROGRESS) · since blocking (BLOCKED) · since delivery (DONE)
<!-- /AA:generated -->

<!--
  NOW block: yours. Three fields, rewritten in place, never appended to.
  Generated region: rendered by `AA/board.sh --write`; hand edits are
  discarded (rule 11). History belongs in the log, the task file, or done/.
-->
