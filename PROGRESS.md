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
