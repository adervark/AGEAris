# T086: H1, research-runs v2.7 on RSNA T112

The held-out round (design §7, H1). T086's decision rules, approved by the
operator on 2026-10-22, fix the scope, the gate, the spend and the bar.
Everything here before the operator's go was built without a subagent.

## Built before any subagent

| File | What it is |
|---|---|
| `cut.mjs`, `cut/clauses.jsonl`, `cut/scope.json` | T112's record cut into 1,315 clauses over 20 documents (the scope rule is in `cut.mjs`'s header) |
| `split.mjs`, `cut/G1–G3.jsonl` | The transcriber groups, a document whole with its earlier versions |
| `key-search.mjs`, `key-search.txt` | The key's search over the cut |
| `key.json` | **The key.** 20 corrections T112's record states, each pinned to its clauses, and the terms no brief may hold. No subagent may read it |
| `reach.mjs` | The viability gate: 13 corrections in reach against 8 |
| `brief-registrar.md`, `brief-transcriber.md`, `brief-auditor.md`, `brief-reconciler.md` | The briefs, from v2.7's templates. Their examples come from neither round 3 nor T112 |
| `check-measurands.mjs`, `check-audit.mjs`, `check-reconcile.mjs` | What each subagent runs on its own output. The last two keep a dead run's lines (v2.7 item 4) |
| `audit-view.mjs` | R0c's auditor view; no canary is drawn from a key clause |
| `brief-check.mjs` | Checks every file a subagent is given against the key: 0 hits on all nine |

## The procedure after the go

registrar → three transcribers → merge and citation closure → the closure
transcriber → the auditor → refs from quotes, linking, groups and canaries
(each check canary's refutation written into the canary key first) → three
reconcilers → the grade. Nine Opus first passes against a cap of ten.

## After the go

| File | What it is |
|---|---|
| `measurands.jsonl` | The registrar's 122 measurands; `check-measurands.mjs` clean |
| `ledger-G1–G3.jsonl` | The transcribers' ledgers: 551, 609 and 651 facts; 62, 70 and 38 skips. `t082/r0c/check.mjs` exits 0 on each |
| `cut/GC.jsonl` | The citation closure (`t082/r0c/closure.mjs`): 78 clauses from 21 cited units outside the cut |
| `ledger-GC.jsonl` | The closure transcriber's ledger: 166 facts, 4 skips; clean |
| `audit/`, `audit-key.json` | The auditor's view (264 skips, 40 of them canaries, none on a key clause; 544 blind assignments) and `audit.jsonl`, its output: 172 ok, 92 missed, every canary caught. `check-audit.mjs` exits 0 |
| `merged/` | `t082/r0c/merge.mjs` with the audit: 1,977 facts, 512 measurands agreed, 32 disputed, 4 premises unwritten |
| `ledger.jsonl` | `t084/quote-refs.mjs`, then `prepare.mjs`: refs from quotes and each fact's commit |
| `searchflip.json` | `t082/r0c/searchflip.mjs` at `fc0d19e`: 20 searches, 3 flipped, 8 drifted |
| `canary-exclude.json` | The 227 facts written at clauses the key pins: no canary touches them |
| `rec/eligible.json`, `refutations.json` | The 15 checks v2.7's rule admits, and the parent's refutation of 13, written from the premises alone. F142 and F433 are left out: their number names a lane or a card, not a figure the premises give |
| `rec/R1–R3.jsonl`, `rec-key.json` | The reconcilers' views, 236 units each (330 groups, 373 checks, 2,608 same-document pairs unreviewed as in R0d), and the canary key: 10 group canaries, each reconciler's first in its largest decile, and 5 check canaries, each with its refutation |
| `grade.mjs` | The grade, committed before any reconciler ran: R0d's, on this key, with the auditor's canaries and the 80% bar |
| `rec/out-R1–R3.jsonl` | The reconcilers' outputs; `check-reconcile.mjs` exits 0 on each |
| `grade.json`, `precision-units.txt` | `node grade.mjs > grade.json` |
| `precision.md` | Precision marked by hand: conflict 9/9, superseded 9/9, no real `contradicted` |
| `grade.md` | **The grade: not a pass.** Recall 4 of 13 against 11; canaries 40/40 and 14/15, the miss unfair |

The link outputs and `scanned.jsonl` are regenerable and ignored, as in R0d.

A filled transcriber brief scores hits on brief-check from its `Documents:`
line alone: the names of the group's own files, which the transcriber reads
anyway (`T112`, `bringup`, `4090`, `dry_run`, `paired`, the figure 224,
`T111`, `CoAtNet`, `smoke`). With that line removed, all four filled briefs
score 0.
