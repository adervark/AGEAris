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
`board · 2026-10-10T10:06Z · 52 tasks: 6 backlog, 1 WIP (1 in progress), 45 delivered`

FLOW · **WIP 1/2** · throughput 10.5/wk (45 in 30d) · cycle time 50th 4m / 85th 33m (n=45)
FLOW · Little's Law: 1 ÷ 10.5/wk ≈ 16h expected · flow efficiency 78% (touch 12m of 16m, n=1 trails) · lead time 85th 35h

| | id | task | owner | age | |
|---|---|---|---|---|---|
| **IN PROGRESS** 1/2 | T052 | The agent's brain: a design that orients any agent, on any repo, at team scale | adervark | 16m | ⚠ |
| **BACKLOG** | T003 | Track the repository AGE Aris runs from without moving its data | — | 3d |  |
|  | T004 | Keep one copy of the aa-init template | — | 3d |  |
|  | T024 | The card menu, the keyboard map, and drag through the action registry | — | 2d |  |
|  | T025 | Say on the project page that STATE.md is behind, or kept by hand | — | 2d |  |
|  | T047 | The sign-in page sends you to a terminal that /aa never opened | — | 25h |  |
|  | T051 | /aa restarts a server older than its code only on Linux | — | 20h |  |
| **DONE** | T049 | Every AGESight name becomes AGE Aris's, and the old ones are still read | adervark | 19h |  |
|  | T050 | /aa on Windows without WSL | adervark | 20h |  |
|  | T046 | Install in one line: /aa names everything the machine is missing, at once | adervark | 25h |  |
|  | T048 | The plugin is agearis: the install and the plugin list still said agesight | adervark | 25h |  |
|  | T045 | /aa prints the signed-in link: the plain link gave a sign-in error | adervark | 28h |  |
|  | T044 | Restructure the interface around flow strips: it reads as a stock SaaS card kit | adervark | 37h |  |
|  | T043 | The menu button does nothing on a desktop: it should fold the sidebar away | adervark | 38h |  |
|  | T042 | Black glass with a silver edge: T039's gradient chrome looked like a basic app | adervark | 38h |  |
|  | T041 | The Aris wordmark in Michroma: the plain sans looked too basic | adervark | 38h |  |
|  | T040 | Aris under the logo, centred | adervark | 38h |  |
|  | T039 | Silver that reads as metal: T036's chrome still looks like flat grey | adervark | 39h |  |
|  | T038 | The Flow tab shows only what the data supports: empty charts, oversized text, numbers that disagree | adervark | 39h |  |
|  | T037 | The page fills a wide screen: on an ultrawide monitor it is a 1240px strip | adervark | 39h |  |
|  | T036 | Silver you can see: T034's accent was too faint to notice | adervark | 45h |  |
|  | T035 | The forecast samples days from before the board existed | adervark | 45h |  |
|  | T034 | Silver accents, taken from the logo | adervark | 47h |  |
|  | T033 | Chart defects found on real boards: a yearless date, a thin forecast, repeated ticks, stacked dots | adervark | 47h |  |
|  | T032 | A forecast from throughput: when, and how many | adervark | 47h |  |
|  | T030 | An aging WIP chart: what is not moving | adervark | 47h |  |
|  | T031 | A cycle-time scatterplot with the service level | adervark | 47h |  |
|  | T029 | Research: what Scrum masters and flow coaches use to see the work | adervark | 2d |  |
|  | T026 | Tracked task actions: the review's remaining low findings | adervark | 2d |  |
|  | T016 | ckpt.sh check exits 1 on a clean trail | adervark | 2d |  |
|  | T014 | A paragraph past MAX_INLINE drops hard breaks for a span it never renders | adervark | 2d |  |
|  | T015 | Code spans are not found as CommonMark finds them | adervark | 2d |  |
|  | T002 | Bold or a link that contains inline code shows raw markers | adervark | 2d |  |
|  | T009 | Four markdown patterns take quadratic time on one long line | adervark | 2d |  |
|  | T008 | A line separator in a wrapped list line crashes the renderer | adervark | 2d |  |
|  | T010 | A paragraph indented less than a list item's content keeps the list's hold | adervark | 2d |  |
|  | T011 | board.sh loses the history from before a board rename | adervark | 2d |  |
|  | T013 | The Method view names a settings file the board does not have | adervark | 2d |  |
|  | T007 | A board moved in one commit follows the wrong file when an id is duplicated | adervark | 2d |  |
|  | T012 | A blocked task loses its Handoff reason when its file moves | adervark | 2d |  |
|  | T028 | A README that explains the workflow, for a first-time tester | adervark | 2d |  |
|  | T027 | /aa restarts an AGE Aris server that is older than its code | adervark | 2d |  |
|  | T023 | Task actions on tracked AA boards, end to end; the read-only rule lifted | adervark | 2d |  |
|  | T021 | A tracked-write engine that commits one task file under git's lock | adervark | 2d |  |
|  | T022 | Task actions in the drawer, on AGE Aris projects first | adervark | 2d |  |
|  | T019 | A Working page: everything in progress or blocked, on every board | adervark | 3d |  |
|  | T020 | A cockpit test fails when run in the early hours | adervark | 3d |  |
|  | T018 | /aa pulls up a project's board in any Claude Code session | adervark | 3d |  |
|  | T017 | Two owner-line regexes take quadratic time on a long line | adervark | 3d |  |
|  | T005 | A dollar pattern in a task title corrupts the task file on every edit | adervark | 3d |  |
|  | T006 | A stray AA/tasks/ folder switches a project's board | adervark | 3d |  |
|  | T001 | Review 479b6e7 and e64f823 independently | adervark | 3d |  |

age: in the queue (BACKLOG) · since the claim (IN PROGRESS) · since blocking (BLOCKED) · since delivery (DONE)
- ⚠ work item age past the 85th-percentile cycle time this repo has delivered — finish or split it; it is not a lock
<!-- /AA:generated -->

<!--
  NOW block: yours. Three fields, rewritten in place, never appended to.
  Generated region: rendered by `AA/board.sh --write`; hand edits are
  discarded (rule 11). History belongs in the log, the task file, or done/.
-->
