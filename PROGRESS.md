# AGE Aris — progress

The results log (AA rule 9): measurements land here as they happen, each with
its date, the number, and where the evidence is. Newest last.

## 2026-10-07 — T001: independent review of 479b6e7 and e64f823

- **479b6e7** (code spans and kept line breaks): comment.
  - Line breaks were compared against `inline()` on 600,000 generated
    paragraphs: no mismatch in the number of `<br>` or in any span's contents.
  - 4 MB of spans renders in 49 ms.
  - One regression (T010) and four older defects (T008, T009, T014, T015).
- **e64f823** (the board named AA): changes requested.
  - The four real `deaddrop/` boards read identically with the code before and
    after the commit: project, tasks, ledger, metrics and brief.
  - `npm test` passed 365 of 365.
  - Defects: T006 (a regression), T007, T011, T012 and T013. Older: T005 and
    T016.
- Evidence: the bug tasks T005 to T016, each with its failing input, and the
  Result of T001.

## 2026-10-07 — T005 and T006: two of the review's bugs fixed

- **T005** (a `$` pattern corrupts a task file on every edit): fixed. A task
  whose title, assignee and blocked reason hold `$&`, `$'`, `` $` ``, `$1` and
  `$$` keeps all three as typed through four edits; before the fix the title
  grew until the file was refused as too large.
- **T006** (a stray `AA/tasks/` switches the board): fixed. With a stray
  `AA/` folder, an own `deaddrop/` project reads and writes there as before
  (it used to fail with `ENOENT`). A tracked one keeps its WIP limit of 4,
  `stale_hours` of 12 and its 8 tasks (it used to get 0, 24 and none). A
  committed move to `AA/` is still followed.
- `npm test` passed 369 of 369.
- Evidence: the Results of T005 and T006 in `AA/tasks/done/`, and their tests
  in `tests/workspace.test.mjs`.

## 2026-10-07 — T017: owner lines read in linear time

- `parseOwner` on `'x' + ' '.repeat(n) + 'y'`: 2,839 ms at n = 40,000 and
  10.8 s at 80,000 before the fix; under 100 ms at 80,000 after it. `ownerNote`
  on `' —'.repeat(n / 2) + ' '`: 871 ms at 40,000 before; under 100 ms at
  80,000 after.
- Old and new agree on all 272 distinct `owner:` values in the history of the
  five real boards.
- `npm test` passed 371 of 371.
- Evidence: the Result of T017 in `AA/tasks/done/`, and its tests in
  `tests/history.test.mjs`.

## 2026-10-07 — T018: /aa pulls up the board in any session

- `/aa` printed a board in all five repositories, each left unchanged: in
  0.1 s where there is a `board.sh`, and in under 1 s from the task files on
  the three older boards. It also prints the AGE Aris link, starting AGE Aris
  if it is not running (0.34 s cold).
- `/aa open` lands on the project, signed in (headless Chrome 152).
- `/aa link` tracks a repository and leaves it unchanged (scratch data folder).
- Spend: one global-config write, `~/.claude/skills/aa/`.
- Evidence: the Result of T018 in `AA/tasks/done/`.

## 2026-10-07 — T019 and T020: a Working page; a clock-dependent test

- **T019:** the main navigation has a Working page. On real data it lists 7
  tasks (AGEIS 6, AGE Aris 1), each with its holder, time in progress and note.
  At 1440, 1100 and 390 px nothing scrolls sideways and there are no console or
  CSP errors (headless Chrome 152).
- **T020:** a cockpit test failed between local midnight and the sample's next
  finish. With its clocks pinned, it passes at 00:30, 04:30, 12:00 and 23:30
  London; the old test fails at 00:30.
- `npm test` passed 372 of 372.
- Evidence: the Results of T019 and T020 in `AA/tasks/done/`.

## 2026-10-08 — T022: one-click task actions in the drawer

- On AGE Aris projects, Start, Unblock, Block, Done, Release, Reopen, Priority
  and Assign each take one click, or one click and Enter, from the drawer.
- `npm run e2e` (new, headless Chrome 152, its own server and temporary data):
  19 of 19 pass at 4d78075, run twice by the worker and once by the owner. It
  covers each action, a disabled action's reason on hover and focus, focus
  return, the in-place swap, drag through actions, a refusal followed by a
  retry, a double click and a double Enter, and unsaved form edits kept across
  an action. No console or CSP errors.
- `npm test` 383 of 383; `npm run check` passes.
- Independent review: APPROVE; its three medium findings are fixed in
  4d78075.
- Evidence: `tests/e2e/task-actions.e2e.mjs`, `tests/actions.test.mjs`, and the
  Result of T022.

## 2026-10-08 — T021: a tracked-write engine, reviewed adversarially

- `lib/tracked.mjs` commits one task-file change to a pinned branch under
  `.git/index.lock`. Every outcome is committed, unchanged, or reported as
  interrupted. It is not reachable from the API yet.
- `tests/tracked.test.mjs`: 62 tests on real temporary repositories.
  - Agent `git commit` and `commit -a` in each of five windows.
  - Crashes in each phase, with recovery run twice.
  - Stolen and leaked locks.
  - Hooks, filters, gpg signing and replace refs leaving no trace.
  - Symlinked task folders, in the working tree and committed.
  - Timeouts (SIGTERM, then SIGKILL).
- Independent review: REQUEST CHANGES (a symlinked folder escaped the
  repository, reproduced), then APPROVE. Mutation checks confirmed that the
  key tests fail without their fixes.
- `npm test` 445 of 445 and `npm run e2e` 19 of 19 at 1de20b2; `npm run check`
  passes.
- Evidence: `tests/tracked.test.mjs` and the Result of T021.

## 2026-10-08 — T023: task actions on tracked AA boards

- Claim, release, block, unblock and done now work on a tracked AA board, in
  both layouts, once the operator switches task actions on. Each is one commit
  of one task file on the pinned branch. AGENTS.md's read-only rule is replaced
  by plan §2's rule; the acceptance grep prints exactly the four permitted
  lines.
- `npm run e2e` 24 of 24 at 4bae6ce (headless Chrome 152). The five new tracked
  scenarios cover:
  - the switch's disclosures;
  - claim, block and done with `backlog/`;
  - claim in place without it;
  - an own agent's hold with a dead run, confirmed once and warned;
  - a live run refusing every action.

  No console or CSP errors.
- `npm test` 473 of 473; `npm run check` passes.
- Independent review: REQUEST CHANGES. A HIGH finding (a discarded uncommitted
  edit could be committed) and a MEDIUM one (a symlinked trail gave a 500) were
  both reproduced and are fixed in 4bae6ce. A mutation check confirmed that the
  regression test fails without its fix. The remaining LOWs are T026.
- Evidence: `tests/task-actions.test.mjs`, `tests/e2e/task-actions.e2e.mjs`,
  and the Result of T023.

## 2026-10-08 — T027: /aa restarts a server older than its code

- The cause of "Aris is not working": a server started 2026-10-07 13:52 was
  still running after T021–T023 landed. The new page met the old API:
  `/api/tasks/:id/actions` gave 404, and projects had no `actions`. Restarting
  it fixed it.
- `aa.sh` now restarts this checkout's server when it started before the newest
  change to `server.mjs` or `lib/`. Fresh server: PID kept. After `touch
  lib/workspace.mjs`: restarted, answers 200, not restarted again on the next
  run.
- `npm test` 473 of 473; `npm run check` passes.
- Evidence: the Result of T027.

## 2026-10-08 — T028: a README that explains the workflow

- README.md opens with the workflow and a ten-minute tour; commit 34af27b,
  pushed to `origin/feature/pm-cockpit` so a first-time tester sees it.
- The tour was run against a scratch server: the sample refuses a run at its
  WIP limit of 8, and a new project's run stops at both gates and reaches Done.
- GitHub renders the three Mermaid diagrams (3 mermaid sections in its HTML).
- `npm test` 473 of 473.

## 2026-10-08 — T007 and T012: the ledger across a board move

- **T007** (a moved board follows the wrong duplicate): fixed. RSNA's T120
  reads "Check T119 series-safe windows for regressions" with no transitions
  at 38c58e5; before the fix it took the duplicate's title and owner. T081 and
  T098 unchanged.
- **T012** (a moved blocked task loses its Handoff reason): fixed. A blocked
  task renamed with nothing else changed gives the Handoff line (`handoff`);
  before, "No reason given" (`none`).
- `npm test` 476 of 476.

## 2026-10-08 — T011 and T013: board.sh across a rename; the Method view's settings file

- **T011** (board.sh loses history across a rename): fixed. A migrated
  `deaddrop/` board prints the same `board.sh --all` as a never-migrated twin;
  before, ages `?` and cycle time n=0 (twin: 33d, 34d, n=1). The global
  `aa-init` copy is synced.
- **T013** (the Method view names a missing settings file): fixed. A board
  without one says the defaults apply.
- `npm test` 477 of 477.

## 2026-10-08 — T008 and T010: list items and the list's hold

- **T008** (a line separator in a list crashes the renderer): fixed. Found
  live in this board's own T017 task file, whose drawer threw; it renders now.
- **T010** (an under-indented paragraph keeps the list's hold): fixed. The
  four inputs render their last block as code, as in CommonMark.
- 307 task files on five boards rendered before and after: T017's is the only
  render that changed. `npm test` 479 of 479.

## 2026-10-08 — T002 and T009: code inside bold and links; linear-time block patterns

- **T002** (bold or a link holding inline code shows raw markers): fixed.
  AGEIS blocks showing raw markers: 101 → 7 (97 files). 595 blocks changed on
  four boards, all only by markers becoming markup; code text byte-identical.
  The 4 MB adversarial input: 21 ms before, 21 ms after.
- **T009** (quadratic block patterns): fixed. At n = 80,000 the five inputs
  took 4,097–5,069 ms before and 1–3 ms after. No AGEIS block changes from it.
- `npm test` 481 of 481.

## 2026-10-08 — T014 and T015: code spans as CommonMark finds them; long paragraphs keep their breaks

- **T015** (code spans differ from CommonMark): fixed. One linear scan, shared
  by inline markup and line breaks. 4 MB of lone backticks: 48 → 261 ms (a
  million spans); the 4 MB adversarial input 21 → 55 ms.
- **T014** (a long paragraph drops hard breaks): fixed. The input gives three
  `<br>`.
- No render changes on AGEIS, AGEION, RSNA or Gem4A. `npm test` 483 of 483.

## 2026-10-08 — T016: ckpt.sh check's exit code

- Fixed. The exit was inverted (a clean trail 1, a bad one 0); it is now 0
  and 1, and 1 for a bad trail before a clean one.
- Patched here, in the template, in the global copy, and, on the operator's
  word, in AGEION, AGEIS, Gem4A and RSNA (uncommitted there).
- `npm test` 484 of 484.

## 2026-10-08 — T026: the task-action review's last findings

- The switch is checked before the folder name; §4 amended where the code's
  order is better. Overlapping refusals tested.
- Claim over the operator's own agent takes it back and keeps the agent's line
  (`; was …`), on the operator's decision.
- The AA.yml read under the lock is capped at 64 KB, as elsewhere.
- Missing tests added (index-only DIRTY_FILE, target exists, detached HEAD,
  email redaction). `npm test` 489 of 489.

## 2026-10-08 — T030 and T031: aging WIP chart and cycle-time scatterplot

- Both on the Flow tab, from data the metrics already count: on the sample,
  the aging dots past the service level are exactly the `aging` metric's
  items, and the scatterplot's dots and 50th/85th lines are exactly
  `cycle_time_p50`/`p85`'s.
- Every dot opens its task by mouse and keyboard; read in headless Chrome at
  1280 and 390 px with no console errors.
- A new test requires every module the page imports to be served (a new
  `public/` file had 404'd). `npm test` 491 of 491.

## 2026-10-08 — T032: the forecast

- A seeded Monte Carlo over 41 whole days of throughput answers "when will
  the open tasks be done?" and "how many in the next 14 days?" at 50/85/95%.
- On the sample (28 finished in 41 days, 14 open): 50% by 28 Oct, 85% by
  4 Nov, 95% by 8 Nov; 85% likely 6 or more in 14 days. The same numbers came
  back a minute apart, once seeded by the day rather than the instant.
- `npm test` 492 of 492.

## 2026-10-08 — T033: the charts on real boards

- The test and regression check before pushing T030–T032:
  - `npm test` and `npm run check` passed.
  - The metrics and the brief are identical to those of the pre-chart code.
  - The Flow page is unchanged apart from the new charts.
- The real boards showed five chart defects, all now fixed:
  - a forecast date a year out showed no year;
  - a forecast was drawn from one finished task;
  - an axis repeated a date;
  - 31 aging dots were stacked on top of each other;
  - the fix for the stacked dots could put a dot below zero.
- After the fixes:
  - `npm test` passed 498 of 498.
  - The browser walk over six boards at two widths found 0 problems in 72
    page views.
  - The real repositories were unchanged.
- Evidence: the Result of T033, and `tests/charts.test.mjs`.

## 2026-10-08 — T034: silver accents

- The accent is silver, taken from the logo, in place of a blue that also
  meant "in progress". Only CSS tokens changed, plus a sheen on the primary
  button and on the wordmark.
- Accent text is 12.9:1 on black. `npm test` passed 498 of 498. The browser
  walk found 0 problems in 72 page views.
- Found on the way: the forecast samples days from before a young board
  existed (T035).
- Evidence: the Result of T034.

## 2026-10-08 — T035: a young board's forecast

- The forecast sampled 41 days even for a board with 2 days of history, so
  AGE Aris's own board said "85% by Dec 25" for 5 tasks. It now samples only
  days from the board's first commit on. It also needs 5 whole days, since
  one day sampled has no spread.
- The forecasts of the sample, AGEIS, AGEION and RSNA are identical before and
  after the fix. `npm test` passed 501 of 501. The browser walk found 0
  problems in 72 page views.
- Evidence: the Result of T035.

## 2026-10-08 — T036: silver you can see

- T034's silver accent read as grey on black. Silver now shows as metal: a
  brushed hairline along the shell, lit edges on the surfaces, and chrome on
  the wordmark, the avatar, the primary button and the selected tab.
- `npm test` passed 501 of 501. The browser walk found 0 problems in 72 page
  views.
- Evidence: the Result of T036.

## 2026-10-08 — T037: the page fills a wide screen

- At 3440 wide the page was a 1240 px strip with about 1,100 px of black on
  each side. The column cap is gone: the page takes the window's width, a
  board column tiles its cards, and method checks sit in columns. Prose stops
  at 90 characters.
- `npm test` passed 501 of 501. A new browser walk (17 pages × 390, 1280,
  1440, 1920, 2560 and 3440 wide) found 0 problems in 102 page views: no page
  error, no failed request, no sideways scroll.
- Evidence: the Result of T037.

## 2026-10-09 — T038: the Flow tab shows only what the data supports

- Charts are drawn at the width they are shown at, so their text is the
  page's size (measured scale 1.000 at 1440 and 3440). Durations sit on a log
  axis (1 min … 90 days), so minute-long and week-long tasks both spread out.
  A chart with nothing to draw is one line. The usual week counts only the
  weeks the board existed. Durations under an hour read in minutes. The tab
  no longer repeats the four numbers above it.
- `npm test` passed 505 of 505. The browser walk found 0 problems in 102 page
  views.
- Evidence: the Result of T038.

## 2026-10-09 — T039: silver that reads as metal

- T036's silver still read as grey. Silver is now polished chrome with a dark
  horizon, in few places: the wordmark, the avatar, the primary button and
  the selected item and tab. The grey hairlines and edges are gone. Text on
  chrome keeps 10.9:1; the wordmark's darkest band is 4.3:1 on black.
- `npm test` passed 505 of 505. The browser walk found 0 problems in 102 page
  views.
- Evidence: the Result of T039.

## 2026-10-09 — T040: Aris under the logo, centred

- The sidebar wordmark reads "Aris", centred under the logo; the link's
  accessible name stays "AGE Aris: Home".
- `npm test` passed 505 of 505. The browser walk found 0 problems in 102 page
  views.
