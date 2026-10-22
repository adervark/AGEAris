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
