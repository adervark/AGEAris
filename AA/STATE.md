# State — AGE Aris

<!-- AA:now -->
**Standing:** AGE Aris tracks its own development on this board from
2026-10-07. The UI revamp, the renames and task actions on tracked AA boards
are committed on `feature/pm-cockpit`, which is not on `main` yet; it was
pushed on 2026-10-08 so a tester can try it (T028). Every bug the reviews
found is fixed (2026-10-08: T002, T007–T016, T026).

**In progress:** nothing. T075 (R0b) is done: the research-runs design caught
2 of RSNA round 3's 12 corrections. Linking was precise, 17 of 17, but facts
were never transcribed or had no code referent. T082 revises the design before
any code (T077 waits on it).

**Next action:** make AGE Aris an agent's brain (T052, approved
2026-10-10: `docs/plans/agent-brain.md`). T055, the orient contract and its
82 cases, is done (2026-10-11). T053, T054, T057 and T063 can start;
T056 waits on T004. Before
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
**Do not push this branch before 2026-10-22 without the operator's word.**
`docs/plans/research-runs.md` §2, PROGRESS.md (T074), T073, T074 and
`docs/plans/evidence/t074/` quote RSNA's competition research, and RSNA
closes on that date.
<!-- /AA:now -->

<!-- AA:generated -->
`board · 2026-10-17T06:16Z · 83 tasks: 30 backlog, 1 WIP (1 in progress), 52 delivered`

FLOW · **WIP 1/2** · throughput 12.1/wk (52 in 30d) · cycle time 50th 5m / 85th 45m (n=52)
FLOW · Little's Law: 1 ÷ 12.1/wk ≈ 13h expected · flow efficiency 7% (touch 5h of 3d, n=1 trails) · lead time 85th 35h

| | id | task | owner | age | |
|---|---|---|---|---|---|
| **IN PROGRESS** 1/2 | T082 | Research-runs design v2.5: answer R0b's recall of 2 of 12 | adervark | 3d | ⚠ |
| **BACKLOG** 30 | | `T003` `T004` `T024` `T025` `T047` `T051` +24 more (`--all`) | | | ⚑ 0 not ready |
| **DONE** | T075 | R0b: replay RSNA's round 3 with facts, graded on every correction its synthesis records | adervark | 3d |  |
|  | T073 | Research runs, aggregated: one line of thought, in the operator's sight | adervark | 3d |  |
|  | T074 | Replay RSNA's research round 3 as a ledger: do the checks catch what its synthesis caught by hand? | adervark | 4d |  |
|  | T055 | The orient contract and its scenario corpus | adervark | 5d |  |
|  | T070 | A run names its process, so a session reads as running or closed | adervark | 6d |  |
|  | T069 | A long act says when it expects to finish, so orient never restarts it | adervark | 6d |  |
|  | T052 | The agent's brain: a design that orients any agent, on any repo, at team scale | adervark | 6d |  |
|  | T049 | Every AGESight name becomes AGE Aris's, and the old ones are still read | adervark | 7d |  |
|  | T050 | /aa on Windows without WSL | adervark | 7d |  |
|  | T046 | Install in one line: /aa names everything the machine is missing, at once | adervark | 7d |  |
|  | T048 | The plugin is agearis: the install and the plugin list still said agesight | adervark | 7d |  |
|  | T045 | /aa prints the signed-in link: the plain link gave a sign-in error | adervark | 8d |  |
|  | T044 | Restructure the interface around flow strips: it reads as a stock SaaS card kit | adervark | 8d |  |
|  | T043 | The menu button does nothing on a desktop: it should fold the sidebar away | adervark | 8d |  |
|  | T042 | Black glass with a silver edge: T039's gradient chrome looked like a basic app | adervark | 8d |  |
|  | T041 | The Aris wordmark in Michroma: the plain sans looked too basic | adervark | 8d |  |
|  | T040 | Aris under the logo, centred | adervark | 8d |  |
|  | T039 | Silver that reads as metal: T036's chrome still looks like flat grey | adervark | 8d |  |
|  | T038 | The Flow tab shows only what the data supports: empty charts, oversized text, numbers that disagree | adervark | 8d |  |
|  | T037 | The page fills a wide screen: on an ultrawide monitor it is a 1240px strip | adervark | 8d |  |
|  | T036 | Silver you can see: T034's accent was too faint to notice | adervark | 8d |  |
|  | T035 | The forecast samples days from before the board existed | adervark | 8d |  |
|  | T034 | Silver accents, taken from the logo | adervark | 8d |  |
|  | T033 | Chart defects found on real boards: a yearless date, a thin forecast, repeated ticks, stacked dots | adervark | 8d |  |
|  | T032 | A forecast from throughput: when, and how many | adervark | 8d |  |
|  | T030 | An aging WIP chart: what is not moving | adervark | 8d |  |
|  | T031 | A cycle-time scatterplot with the service level | adervark | 8d |  |
|  | T029 | Research: what Scrum masters and flow coaches use to see the work | adervark | 8d |  |
|  | T026 | Tracked task actions: the review's remaining low findings | adervark | 8d |  |
|  | T016 | ckpt.sh check exits 1 on a clean trail | adervark | 8d |  |
|  | T014 | A paragraph past MAX_INLINE drops hard breaks for a span it never renders | adervark | 8d |  |
|  | T015 | Code spans are not found as CommonMark finds them | adervark | 8d |  |
|  | T002 | Bold or a link that contains inline code shows raw markers | adervark | 8d |  |
|  | T009 | Four markdown patterns take quadratic time on one long line | adervark | 8d |  |
|  | T008 | A line separator in a wrapped list line crashes the renderer | adervark | 8d |  |
|  | T010 | A paragraph indented less than a list item's content keeps the list's hold | adervark | 8d |  |
|  | T011 | board.sh loses the history from before a board rename | adervark | 8d |  |
|  | T013 | The Method view names a settings file the board does not have | adervark | 8d |  |
|  | T007 | A board moved in one commit follows the wrong file when an id is duplicated | adervark | 8d |  |
|  | T012 | A blocked task loses its Handoff reason when its file moves | adervark | 8d |  |
|  | T028 | A README that explains the workflow, for a first-time tester | adervark | 9d |  |
|  | T027 | /aa restarts an AGE Aris server that is older than its code | adervark | 9d |  |
|  | T023 | Task actions on tracked AA boards, end to end; the read-only rule lifted | adervark | 9d |  |
|  | T021 | A tracked-write engine that commits one task file under git's lock | adervark | 9d |  |
|  | T022 | Task actions in the drawer, on AGE Aris projects first | adervark | 9d |  |
|  | T019 | A Working page: everything in progress or blocked, on every board | adervark | 10d |  |
|  | T020 | A cockpit test fails when run in the early hours | adervark | 10d |  |
|  | T018 | /aa pulls up a project's board in any Claude Code session | adervark | 10d |  |
|  | T017 | Two owner-line regexes take quadratic time on a long line | adervark | 10d |  |
|  | T005 | A dollar pattern in a task title corrupts the task file on every edit | adervark | 10d |  |
|  | T006 | A stray AA/tasks/ folder switches a project's board | adervark | 10d |  |
|  | T001 | Review 479b6e7 and e64f823 independently | adervark | 10d |  |

age: in the queue (BACKLOG) · since the claim (IN PROGRESS) · since blocking (BLOCKED) · since delivery (DONE)
- ⚠ work item age past the 85th-percentile cycle time this repo has delivered — finish or split it; it is not a lock
<!-- /AA:generated -->

<!--
  NOW block: yours. Three fields, rewritten in place, never appended to.
  Generated region: rendered by `AA/board.sh --write`; hand edits are
  discarded (rule 11). History belongs in the log, the task file, or done/.
-->
