# State — AGE Aris

<!-- AA:now -->
**Standing:** AGE Aris tracks its own development on this board from
2026-10-07. The UI revamp, the renames and task actions on tracked AA boards
are committed on `feature/pm-cockpit`, which is not on `main` yet; it was
pushed on 2026-10-08 so a tester can try it (T028). Every bug the reviews
found is fixed (2026-10-08: T002, T007–T016, T026).

**In progress:** nothing. T054 is done (2026-11-01): `npm run perf`
measures 303 fabricated repositories against §5.5, and the baseline is in
PROGRESS.md. Every miss is a `todo` naming its owner: T060, T061, T062, and
T102, which is new (orient walks the whole history on every call, 203–260 ms
on 5,000 commits). `/api/workspace` is 92% history. T068 is done (2026-10-25): any project can be
deprecated, archived and restored, read-only between, nothing deleted.
T100 is registered: `task-actions.e2e.mjs` fails 9 of 24, before T068 as
after. T098 now covers a sixth cold-build race. T053 is done: the lost-agent
baseline on the three repositories is in PROGRESS.md, reviewed twice. The
second pass's 5 low findings are fixed without a third review, and no
baseline number moved. T097 is done: `npm test`
passes at its default concurrency again (three tests gave a cold build
250 ms; `/aa` polled without its token while the old data folder moved).
T096 is registered: the ledger dates a merged branch's work by its merge,
so AGEIS's cycles read wrong. T098 is registered: a fifth test races the
cold build, seen once under load. T089, T091,
T092 and T093 are done: each Claude
account's limits, read fresh each minute and backing off on a 429, with each
window's start and end, are in a strip on every page, on the Agents page,
from `GET /api/limits` and `/aa limits`; a lapsed token is renewed and
written back. Check them before a fan-out. Research: v2.8 is accepted as it stands (2026-10-24, D14)
after H2 (T094) caught 5 of 10 on RSNA's T121; v2.9's three mechanical fixes
wait as T095. T077 (S1a) can start, on v2.8.

**Next action:** make AGE Aris an agent's brain (T052, approved
2026-10-10: `docs/plans/agent-brain.md`). T055, the orient contract and its
82 cases, is done (2026-10-11). T057 (`GET /api/orient`, 82 of 82) and
T063 (`GET /api/capabilities`, `board.sh --capabilities`) are done
(2026-10-24). T053 and T054, the baselines (agents lost, and scale), are
done. T060 (the disk cache), T061 (a slim `/api/workspace`) and T102 (the
warm orient) can start on T054's fixture. T056, the board.sh door, waits on
T004, and T059 compares the two doors once it lands. Before
that, the Flow tab's first slice of charts was done (T030–T032:
aging WIP, cycle-time scatterplot, forecast). The rest of
`docs/plans/visualisation.md` (CFD, burnup, where a task's time went, process
behaviour charts) is registered only when the operator chooses. Otherwise
T024 (card menu, keys, drag) and T025 (STATE.md behind). T003 needs the
operator's choice in its file before it can be claimed.

**Watch out for:** T016 patched `AA/ckpt.sh` in AGEION, AGEIS, Gem4A and RSNA
and left it uncommitted there; each repository's own session commits it.
AGE Aris must go on reading `deaddrop/` and `pm/` boards. Its data folder
must stay outside this repository, or it refuses to track it (T003). The
installed `/aa` (`~/.claude/skills/aa`, a copy) is behind `skills/aa` since
T097. Updating it is a `global-config` spend, registered as T099.
**Do not push this branch before 2026-10-22 without the operator's word.**
`docs/plans/research-runs.md` §2, PROGRESS.md (T074), T073, T074 and
`docs/plans/evidence/t074/` quote RSNA's competition research, and RSNA
closes on that date.
<!-- /AA:now -->

<!-- AA:generated -->
`board · 2026-11-02T19:36Z · 102 tasks: 30 backlog, 2 WIP (2 in progress), 70 delivered`

FLOW · **WIP 2/2** · throughput 16.3/wk (70 in 30d) · cycle time 50th 7m / 85th 3h (n=70)
FLOW · Little's Law: 2 ÷ 16.3/wk ≈ 20h expected · lead time 85th 35h

| | id | task | owner | age | |
|---|---|---|---|---|---|
| **IN PROGRESS** 2/2 | T024 | The card menu, the keyboard map, and drag through the action registry | adervark | now |  |
|  | T025 | Say on the project page that STATE.md is behind, or kept by hand | adervark | now |  |
| **BACKLOG** 30 | | `T003` `T004` `T047` `T051` `T056` `T058` +24 more (`--all`) | | | ⚑ 0 not ready |
| **DONE** | T100 | The task-actions e2e fails 9 of 24, before T068 as after | adervark | now |  |
|  | T054 | Scale baseline: a 300-repository perf fixture | adervark | 32h |  |
|  | T068 | Deprecate or archive a project, either kind, and restore it | adervark | 8d |  |
|  | T053 | Measure how often agents get lost: a baseline | adervark | 8d |  |
|  | T097 | Three tests race a cold ledger build when the whole suite runs at once | adervark | 8d |  |
|  | T057 | `Cockpit.orient` and `GET /api/orient` | adervark | 9d |  |
|  | T063 | Capabilities: what an agent may do, and how | adervark | 9d |  |
|  | T094 | H2: research-runs v2.8 on RSNA T121, the held-out round | adervark | 9d |  |
|  | T090 | Research-runs design v2.8: catch a correction of a word, a scope or a reason | adervark | 10d |  |
|  | T093 | Limits read each minute, the 5-hour window defined, /aa current | adervark | 10d |  |
|  | T092 | Renew an expired token, so every account reads live | adervark | 10d |  |
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
|  | T043 | The menu button does nothing on a desktop: it should fold the sidebar away | adervark | 24d |  |
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
