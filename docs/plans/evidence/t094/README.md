# T094: H2, research-runs v2.8 on RSNA T121

The held-out round for v2.8 (design §10, D12, D13). T094's decision rules,
approved by the operator on 2026-10-22, fix the scope, the gate, the spend
and the bar. **The grade: not a pass**, recall 5 of 10 against 8
(`grade.md`).

## Built before any subagent

| File | What it is |
|---|---|
| `cut.mjs`, `cut/clauses.jsonl`, `cut/scope.json` | T121's record, 2,271 clauses over 24 documents (H1's cutter on T121's scope). The task file's `path` is given as its first path even at `3c8fcaa`, where it had moved to `tasks/done/`; its text is read at the right path |
| `split.mjs`, `cut/G1–G4.jsonl` | The four transcriber groups, a document whole with its earlier versions |
| `key.json` | **The key.** 15 corrections, 10 in reach, pinned by the parent from the whole task file, trail, PROGRESS and every dropped clause, and a search of the code. No subagent may read it. Two brief-check terms were narrowed before any brief was filled (its `note`) |
| `reach.mjs` | The viability gate: 10 in reach against 8 |
| `brief-*.md` | The briefs: H1's registrar, transcriber and auditor briefs; the reconciler's from v2.8's template (`t090/brief-reconciler.md`). 0 hits against the key |
| `check-measurands.mjs`, `check-audit.mjs`, `audit-view.mjs`, `prepare.mjs` | H1's, unchanged but for their headers |

## Built before any reconciler

| File | What it is |
|---|---|
| `groups.mjs` | H1's view builder with v2.8's edit units, cue units and twin rule. On H1's ledger it gives T090's measured 39 edits and 33 cues |
| `check-reconcile.mjs` | H1's checker; an edit and a cue take the lines a group takes |
| `grade.mjs` | H1's grade; a line in an edit or a cue counts as one in a group. Tested on H1's material with a planted edit-unit catch |

## After the go

| File | What it is |
|---|---|
| `measurands.jsonl` | The registrar's 136 measurands |
| `ledger-G1–G4.jsonl`, `ledger-GC.jsonl` | The transcribers' ledgers: 3,606 facts, 135 skips, every one `check.mjs`-clean |
| `cut/GC.jsonl` | The citation closure: 227 clauses from 19 cited units |
| `audit/`, `audit-key.json` | The auditor's view (251 skips, 73 canaries, none on a key clause; 510 blind assignments) and its output: every canary caught |
| `merged/`, `ledger.jsonl`, `scanned.jsonl` | Merge with the audit (489 measurands agreed, 21 disputed), refs from quotes, each fact's commit |
| `searchflip.json` | 1 flipped, at `3c8fcaa` |
| `link/` | The links |
| `canary-exclude.json`, `refutations.json` | The 177 facts at key clauses, which no canary touches; the parent's refutations of the 9 checks it twinned from |
| `rec/R1–R3.jsonl`, `rec-key.json`, `rec/summary.json` | The reconcilers' views, ~387 units each (400 groups, 40 edits, 36 cues, 682 checks), and the canary key: 21 group twins, 3 check twins |
| `rec/out-R1–R3.jsonl` | The reconcilers' outputs, each checker-clean |
| `run/` | Every brief as filled for its run |
| `grade.json`, `precision-units.txt`, `precision.md`, `grade.md` | The grade |
