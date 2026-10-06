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
