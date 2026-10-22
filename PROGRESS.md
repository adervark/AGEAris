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

## 2026-10-09 — T041: the Aris wordmark in Michroma

- ARIS under the logo is set in Michroma, chosen by the operator from eight
  faces rendered in chrome. AGE Aris serves it itself: a 3.5 KB woff2 of the
  four glyphs, SIL OFL 1.1, licence in `docs/brand/`.
- `npm test` passed 505 of 505. The browser walk found 0 problems in 102 page
  views.

## 2026-10-09 — T042: black glass with a silver edge

- T039's gradient chrome looked like a stock app. Silver is now light on
  black, as in the logo: the primary button and avatar are black glass with a
  silver rim and a faint glow, the wordmark is grained silver lit from above,
  and the selected item and tab carry a light silver bar. The operator chose
  it from six treatments rendered beside the logo.
- `npm test` passed 505 of 505. The browser walk found 0 problems in 102 page
  views.

## 2026-10-09 — T043: the menu button folds the sidebar

- The menu button showed on every screen but only worked on phones. It now
  folds the sidebar away on a wide screen (remembered in the browser) and
  slides it over the page on a phone; the Flow charts redraw when it folds.
- `npm test` passed 505 of 505. The browser walk found 0 problems in 102 page
  views.

## 2026-10-09 — T044: the interface restructured around flow strips

- Each board is a flow strip: Backlog, In progress, Blocked, Done this week on
  one track, work in progress placed by age against the service level, the
  week's finishes stacked by day. Home pairs Needs you with every board's
  strip; a project page leads with its title, one line of figures and its
  strip. The card kit, caps labels and middle-dot strings are gone; Michroma
  sets titles and Hanken Grotesk the rest. The operator approved a mock on
  the real boards first.
- `npm test` passed 513 of 513. The browser walk found 0 problems in 102 page
  views.

## 2026-10-09 — T045: /aa prints the signed-in link

- The plain link `/aa` printed gave a sign-in error in any browser that had
  not signed in before. It now carries the token: a fresh headless Chrome
  profile lands on the project page with every API call answering 200.
- `npm test` 513 of 513, `npm run check` passes. Installed copy synced.
- Evidence: the Result of T045.

## 2026-10-09 — T046 and T048: a one-line install, named AGE Aris

- **T046:** `/aa` names every missing prerequisite at once (git, jq, curl,
  Node 22), with one install line for the OS, before anything runs; five tests
  on stubbed PATHs pass under bash 5.3 and 3.2.57. The server starts through
  Node's detached spawn, so `/aa` no longer needs Linux's `setsid`; it leads
  its own session, outlives the command and restarts when its code changes,
  also where `node` is a link to `node-22`. The log holding the sign-in link
  is now 600.
- **T048:** the plugin, marketplace and package are `agearis`. A clean-config
  install of this checkout gives `agearis@agearis` with `aa` and `aa-init`.
- `npm test` 518 of 518, `npm run check` passes. One independent review, two
  rounds: nothing blocking; every finding fixed.
- Evidence: the Results of T046 and T048.

## 2026-10-09 — T050: /aa on Windows without WSL

- `/aa` now runs natively in Git Bash, the shell Claude Code uses on Windows.
  It hands Node and AGE Aris Windows paths, finds a tracked project by its
  Windows path in any letter case, and opens the page through `cmd`. The
  server and its git children start hidden, and missing tools get `winget`
  lines. `.gitattributes` keeps the scripts LF in an autocrlf clone.
- Six tests on a stubbed Git Bash; Linux unchanged apart from a UUID guard on
  the project id. `npm test` 523 of 523, `npm run check` passes. Independent
  review, three rounds: no open defect.
- Not tested on a Windows machine. Known limits: ASCII-only case-folding,
  `subst` drives; restarting an old server off Linux is T051.
- Evidence: the Result of T050.

## 2026-10-09 — T049: every name is AGE Aris's, the old ones still read

- AGE Aris writes only its own names: the `AGEAris-Via` trailer, the
  `X-AGEAris-Token` header and `agearis_token` cookie, `.agearis-data`,
  `AGEARIS_*`, `@agearis/web`, `agearis <nonce>` locks, `agearis.*` browser
  keys. Each old AGESight name is still read, each with a test.
- `.agesight-data` moves to `.agearis-data` the first time AGE Aris starts on
  it, leaving a link. The operator's two folders were moved, with copies kept
  first. Afterwards: the same projects and token, and the old header and
  cookie still answer 200.
- `npm test` 534 of 534, `npm run check` passes. Independent review, two
  rounds: no open defect. The Windows junction is untested.
- Evidence: the Result of T049.

## 2026-10-11 — T070: a run reads as running or closed

- `ckpt.sh live` decides every run by its `end`, its `until`, its process,
  then the clock, and prints which. `tests/fixtures/board/ckpt-process.sh`
  passes 14 reading cases and 9 writing cases on a fake `ps`. It also checks a
  real process: alive, it reads as running; killed, it reads as closed at once.
- On this repository the session's run reads `RUNNING  process 15508 alive`. A
  run opened before the change reads by the clock until its next entry.
- `npm test` passed 536 of 536, and `npm run check` passed.

## 2026-10-11 — T055: the orient contract and its 82 cases

- `docs/ORIENT.md` defines `aa.orient/1`, the answer an agent gets on what to
  do next. `tests/orient/` holds 82 cases, each a repository and the exact
  bytes both doors must print; every §5.2 fixture, §8 case and §11 item is in
  one or the other.
- One critic review: revise, 17 findings, all fixed. 14 mutations of the
  corpus each fail its test.
- The operator waived reviewing the cases (2026-10-11).
- `npm test` passed 542 of 542, and `npm run check` passed.
- Evidence: the Result of T055.

## 2026-10-13 — T074: RSNA's round 3 replayed as a ledger, 1 of 3 defects caught

- RSNA's research round 3 (its T047: five lanes and a synthesis, at RSNA
  `e4e356c`) was recast into a draft ledger by a script. The script applied
  T074's procedure, which was fixed before any lane report was read: 8
  questions, 254 claims, 34 decisions.
- **Partial: v1's checks catch 1 of the 3 defects** that RSNA's synthesis
  found by hand.
  - **Caught: lane 11's efficiency half, never written** (`uncovered`). The
    catch rests on two choices made before the reports were read. A
    document's title is not a section, and a claim that matches no question
    falls to the brief's first question. In a real ledger the lanes name their
    questions themselves, which makes the catch robust.
  - **Missed: lanes 10 and 11 disagreeing on a count, 10 against 12.** v1
    compares claims only within one question, and the two lanes answered
    different questions. A noun-phrase subject (`about`, under test) fired on
    "members", but over six unrelated counts (5 to 22), so it would have fired
    without the defect.
  - **Missed: lane 12's two verdicts with no section behind them.** Rows 3 and
    4 of its table point nowhere, and the report goes from §2 to §5.
- **False positives:**
  - 3 `uncovered`, from the replay's matching of headings to questions;
  - 17 `unbacked`: 11 rest on evidence from rounds 1–2, 5 cite sections
    written as prose, which the procedure does not extract, and 1 cites a
    round 2 lane;
  - 2 `contradiction-about`;
  - 1 `where-missing`, from a reference to another lane's §3.4.
- **Real, beyond the three:**
  - lane 13 ran with no brief (`registered-late`);
  - 1 cited file no longer exists anywhere (`outputs/t028/run_density.sh`);
  - 3 more cited sources sit in untracked folders.
- **The baseline:**
  - (r1) questions asked again: 0, by exact text;
  - (r2) and (r3): not applicable, because the round spent nothing;
  - (r4) defects that reached the synthesis with no tool flag: 3 of 3. With
    v1's checks, 2 of 3 would still have reached it;
  - (r5): not measurable on one round finished in a day;
  - (r6) cited evidence out of sight: 4 of 22 `path:line` sources (18%).
  - Also: 67 of 254 claims carry no evidence mark in their row or section,
    and 7 carry a verdict word.
- **For T073's v2:**
  - contradictions are keyed on registered subjects, not on questions;
  - a verdict's `where` must name a section that exists and has a body;
  - `q` and `verdict` are required on every claim;
  - independence is not orient's run family, because all five lanes were one
    family;
  - sources get the same out-of-sight check as `where`.
- **Evidence:** T074's Result. The script and its ledger are in `docs/plans/evidence/t074/`; the operator
  chose to commit them, amending T074's rule. They quote RSNA's research:
  not pushed before 2026-10-22.

## 2026-10-13 — T074 re-graded: its one catch cannot be told from noise

- T073's Critic (run `b8438f28.15f2`) graded R0 while it reviewed v1:
  `docs/plans/reviews/research-runs-v1-critic.md`.
- **The catch does not discriminate.** `uncovered` fired on 4 questions and
  was right on 1. Under the fallback rule, every lane's second question (L9.Q2,
  L11.Q2, L13.Q2) got 0 claims, and all three fired.
- **The deciding choice was not blind.** "A document's H1 is its title" was
  pinned after the headings were seen, by a session that knew the target.
  T074's Result says so; the entry above shortened it to "before the reports
  were read". The entry above also says a real ledger "makes the catch
  robust". Nothing tested that, so it is withdrawn.
- **Not tested:** whether lanes keep a ledger as they go, v1's riskiest
  assumption. A script transcribed finished prose, and the round spent
  nothing.
- **Stands:**
  - both misses;
  - lane 13's `registered-late`;
  - the script lane 10 cites in `outputs/`, never tracked and now gone;
  - 23 of the 26 warnings false.
- **What it changed:** T073's v2.1 takes the Critic's cheaper design as stage
  1. One writer records a verdict per question at synthesis, and four checks
  are each held to an incident and a counterfactual. The next replay is
  RSNA's T112 and T118, the rounds that spent, after 2026-10-22.

## 2026-10-13 — T073: research runs aggregated; v2.4 accepted, conflicts and repeats in stage 1

- The operator accepted `docs/plans/research-runs.md` v2.4, with its open
  objections listed in T073's Result. Nothing is built yet.
- **The design:**
  - load-bearing facts, each citing a pinned source, a scoped search, or its
    premises;
  - identity computed from shared referents, never from labels;
  - a separate reconciler checked by canaries;
  - eleven checks, seven of them for conflicting and repeated data;
  - no decision on an open conflict.
- **Reviews:** one Architect and four Critic runs (one died, one partial), in
  `docs/plans/reviews/`. Each Critic round found a real hole, and each was
  checked against RSNA at `e4e356c` before it was answered.
- **Corrected along the way:**
  - v2.2's 10-against-12 incident linked two true facts. The error was lane
    10 §3.3's unsourced inference, lane 10:350–351.
  - v2.3 claimed `git grep -n -- --layer-decay 2b3d2a6` finds only the
    definition. It finds 29 lines, and 3 when scoped to `src`.
- **Next, on evidence:**
  - T075 (R0b) grades recall over every correction RSNA's round 3 synthesis
    records;
  - T076 (S0) simulates linking with planted conflicts, the uncatchable
    shapes included;
  - T077–T081 build and replay;
  - T072 runs on a hand-written ledger.

## 2026-10-13 — T075: R0b, round 3 replayed with facts: recall 2 of 12

- A fresh transcriber wrote 232 facts from RSNA's round 3 lanes and the
  record settled before it (13.4 min). `link.mjs` applied v2.4's referent rules
  and found 234 pairs. A separate reconciler marked them (7.3 min).
- **Recall: 2 of the 12 corrections** that the round 3 synthesis records.
  - Caught: C1 (flags "never passed") and C2 ("encoder too hot").
  - Missed:
    - 6 never transcribed, 4 of them from documents the transcriber read
      (C12, the 10-vs-12 inference, among them);
    - 2 not linked, because runtime and leaderboard figures have no code
      referent;
    - 1 within one document;
    - 1 from a later code commit.
- **Precision: 17 of 17.** One of them is a real defect the synthesis never
  recorded: lane 10's "~+30 min" for a third pass misreads the kernel's
  "~67 min … x ~2".
- The verdict, by T075's rule: below 10 of 12, so the design is revised
  (T082) before T077.
- Evidence: `docs/plans/evidence/t075/` (`grade.md` first). It quotes RSNA's
  research: not pushed before 2026-10-22.

## 2026-10-21 — T082: R0c, round 3 replayed under v2.5: recall 7 of 12

- Under v2.5 every clause was disposed of: 4,033 facts and 391 skips from
  3,231 clauses, by a registrar, five transcribers and an auditor (81 of 81
  canaries on its rerun). Three reconcilers marked 286 groups and 1,220
  premise checks, 13 subagent runs in all.
- Reconcilers 1 and 2 are graded at pass 1 (10 of 11 canaries each). Their
  reruns died at the usage limit. Finishing them cannot change the recall:
  the units that hold the misses were re-marked the same way, or have no
  pair to mark.
- **Recall: 7 of 12**, by the rule fixed in `grade.mjs` and by hand. The
  two readings agree on the count but differ on one member each:
  - by the rule, C1, C2, C3, C4, C7, C10 and C12;
  - by hand, C2 is out: its only credit is "a premise is missing". C11 is
    in: all three reconcilers found "~175 min drops the 25.2 min intercept:
    200.6", on facts the key did not name.
- **Reach:** 11 by the design (C6 was never committed). By hand it is 10:
  C8's earlier claim is, in the synthesis's words, R1's framing "applied to
  the field", never written down.
- **The misses within reach:**
  - C5 and C9 were linked and judged consistent, as the brief says they
    are. 113 min lies inside 1.5–4.4 h, and 776 and 804 are dated readings.
    Supersession has no place in v2.5.
  - C2's two sides name `--layer-decay` in their quotes but were given no
    refs, so they never met.
- **The measurement had two flaws:**
  - a check canary replaces the real check it copies, so 27 real checks
    were never shown. C11's own check was one of them;
  - the key pinned one correcting clause per correction.
- **Precision:**
  - conflicts: 44 of 49 unique pairs real, 4 ambiguous, 1 false; that is
    89.8% to 98.0% against the 90% floor;
  - does-not-follow: 20 of a sample of 20 apply the rule, but only 5 name
    a defect in the research. 14 name a premise the ledger lacks.
- **A defect the synthesis carried:** its instrument table gives OOF-AUC
  vs Sonnet 4,349 studies; lane 3 measured 3,749 (RESEARCH-0902c:381
  against lane 3:453).
- The verdict, by T082's rule: below 10 of 12, so the operator decides.
  The operator sent v2.5 back for a v2.6 (T084), using the candidate
  changes listed in the grade.
- Evidence: `docs/plans/evidence/t082/r0c/` (`grade.md` first). It quotes
  RSNA's research: not pushed before 2026-10-22.

## 2026-10-21 — T084: v2.6 measured for free on R0c's material

- **Refs from quotes are kept.** A linear scan of each fact's quote adds
  544 refs to 423 of 4,033 facts: flags, paths and identifiers.
  - R2's S1 and lane 10's "--layer-decay cannot express the hypothesis" now
    share a group. That is C2, whose two sides never met in R0c.
  - The review load grows 17.1% (4,848 to 5,676 fact lines), under the
    quarter T084 allows.
- **Supersession is a reconciler mark, not a list.** A mechanical rule
  raises 2,933 candidates over R0c's 63 measurand groups, C5's and C9's
  pairs among them. That is far over the 300 allowed.
- **Fair canaries:** 70 of 1,220 checks have premises that bear on their
  conclusion's number, enough for three reconcilers. 9 of R0c's 27 check
  canaries were not eligible, including the one reconciler 2 missed.
- **Code read at two commits:** `src/tta.py` was cut before and after
  T039's fix. No fact carries its commit, though §5.2 says `at` does.
- **A correction to R0c's grade:** C2's key sides did share a group (R1
  group 23), on a figure lane 10 does not dispute. The count stays 7.
- Evidence: `docs/plans/evidence/t084/measurements.md`.

## 2026-10-21 — T084: v2.6 accepted, to be tested on R0d

- The operator accepted v2.6 of the research-runs design with no Critic
  round, to be tested on R0d (T085). R0d is R0c's ledger in v2.6's view,
  with three fresh reconcilers.
- The operator ruled C8 out of reach, so 10 of 12 are within reach and
  R0d's bar is 9 of 12 (design §10, D7). R0d's go (D8) is still open.

## 2026-10-21 — R0c re-read (T085): its own briefs primed three catches

- R0c's briefs took their examples from round 3, the round being graded:
  - the reconciler brief's example of a failed premise check is C11's
    correction, verbatim (`25.2 + 1.329 × 132 = 200.6 min, not ~175`);
  - the transcriber brief's worked fact is C12's earlier claim
    (`lane10#392`). That brief was never committed; it was recovered from
    session `b8438f28`'s transcript;
  - that brief and the auditor's both name C10's "no --resume".
- The catches no brief prompted are **4 of 12: C1, C3, C4 and C7**. The
  mechanical count stays 7.
- The design's §5.5 incidents are round 3's too. So a replay of round 3,
  R0d included, is in-sample. v2.6 now requires that briefs carry no
  answers, and that acceptance come from a round no incident or example
  came from. What R0d is for is the operator's (§10, D9).
- Evidence: the correction in `docs/plans/evidence/t082/r0c/grade.md`, and
  `brief-transcriber-recovered.md` beside it.

## 2026-10-21 — T085: R0d checks the mechanics; a held-out round decides

- The operator ruled what R0d is for (research-runs design §10, D9). R0d
  checks v2.6's mechanics on round 3: `superseded`, the three-way checks,
  and canaries beside real units. It passes when every canary is caught and
  `superseded`, `contradicted` and `conflict` lines are each at least 90%
  real. Its recall on the twelve is reported as in-sample and decides
  nothing.
- v2.6 is accepted or not on a held-out round with its own key (H1, T086).
  The round is the operator's to choose: T112 is a candidate, T118 is not.
- R0d's go (D8): three Opus reconcilers, once the view, the key and the
  brief are committed and the brief passes its check against the key.

## 2026-10-21 — T085: R0d graded, not a pass: one canary of 33 missed

- **The verdict, by T085's rules: not a pass.** One mechanic fails.
  - Canaries: 32 of 33. R2 missed check canary 498 ("throttling at 3×" for
    2×) and marked it `unsupported`. The real check's holder marked it
    `follows`, so the exception does not apply. R2's one rerun went to its
    death.
  - `superseded`: 28 of 31 unique pairs real, 90.3%. It holds by one unit.
  - `contradicted`: 23 of 25 real, 92.0%.
  - `conflict`: 40 of 43 real, 93.0%.
- **Recall on the twelve, in-sample, decides nothing:** 8 by the rule (R0c:
  7), 7 by R0d's reconcilers. 6 rest on nothing any brief named (R0c: 4).
  - C5 and C9 are gained through `superseded`.
  - C11 is gained without the answer in the brief.
  - C3 is lost: its pair sat in a unit and was not marked.
- **The runs.** The first three reconcilers died with session `2bb43cf0`
  mid-pass. Each was rerun once, resuming from its lines (`7359ccc`).
  `check-reconcile.mjs` made each rerun relabel the dead run's lines with
  its own run id. That is a checker defect; git keeps the originals.
- **Next: the operator's.** Revise v2.6 before T086, or rule the canary
  unfair. The canary's premises give the cost ratio, 1.85×, but not the
  bag ratio. The checker's run-id rule is fixed either way.
- Evidence: `docs/plans/evidence/t085/grade.md`, `precision.md`,
  `grade.json`.

## 2026-10-22 — T085 closed: the operator let R0d's failure stand

- The missed canary (R2, check 498) stands, so R0d is not a pass. v2.6 is
  revised before the held-out round. The revision is T087, free.
  - a rule that only twins checks whose premises hold the refuting figure;
  - `check-reconcile.mjs` keeps a dead run's ids;
  - when a different condition counts as a replacement;
  - C3's passed-over pair.
- T086 now depends on T087.

## 2026-10-22 — T087: research-runs v2.7 answers R0d, measured for free

- **Check canaries:** a check is twinned only when its premises give the
  figure the twin replaces, and the parent writes the refutation first. On
  R0d's 20 check canaries the rule drops 9, the missed 498 among them. The
  other 8 were caught, so the rule is conservative. It leaves 22 twinnable
  checks, against v2.6's 31.
- **Group canaries** go into each reconciler's largest groups. R0d's 13
  sat in groups of 5 to 36 facts, none in the 29 groups of 40 or more. C3's
  pair sat in a group of 118.
- **`superseded`:** the brief says a later figure under another condition
  replaces nothing. All three of R0d's ambiguous units turned on that.
- **The checker** keeps a dead run's lines under their own ids. Its 6
  cases pass, R0d's rebuilt outputs among them.
- **§5.5** lists a pair a reconciler passes over as caught by no check.
- **Evidence:** `docs/plans/evidence/t087/measurements.md`. The brief,
  checker and test carry nothing from R0d's key (`brief-check.mjs`: 0
  hits). Waiting on the operator's acceptance.

## 2026-10-22 — T087 closed: v2.7 accepted, to be tested on the held-out round

- The operator accepted research-runs v2.7, the stricter canary rule
  included. T086 runs under it and waits only on the choice of round.
