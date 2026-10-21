# T085: R0d's inputs

R0d checks v2.6's mechanics on RSNA's round 3 (design §7, §10 D9). Everything
here was built without a subagent, and committed before any reconciler ran.
A reconciler reads only its view (`rec/R<k>.jsonl`), `brief-reconciler.md` and
`check-reconcile.mjs`. Every other file here holds answers.

## Rebuild, from this folder

    node ../t084/quote-refs.mjs ../t082/r0c/merged/ledger.jsonl scanned.jsonl
    node prepare.mjs ../t082/r0c/merged/ledger.jsonl scanned.jsonl ../t082/r0c /home/ade/Code/RSNA ledger.jsonl
    node ../t082/link.mjs ledger.jsonl /home/ade/Code/RSNA link link/link-canary-key.json
    node groups.mjs ledger.jsonl link/link-report.json /home/ade/Code/RSNA rec rec-key.json 3 canary-exclude.json
    node brief-check.mjs key.json ../t082/r0c brief-reconciler.md check-reconcile.mjs

`link/`'s large files are not committed; the linker rebuilds them from the
ledger. `scanned.jsonl` is an intermediate file and can be deleted.

## What each file is

| File | What it is |
|---|---|
| `ledger.jsonl` | R0c's 4,033 facts. Refs come from the quotes, with bare file names resolved, and `at` carries the clause's commit |
| `rec/R1–R3.jsonl` | The three views: 344 groups and 1,240 checks, 20 of them copies. Each fact shows its commit and the commit's time |
| `rec-key.json` | The view map and the 33 canaries: 13 group twins and 20 check copies, 11 per reconciler |
| `canary-exclude.json` | The facts no canary may touch: the key's 173 facts, plus 19 conclusions whose premises cannot refute a changed number, or whose number has another real reading, each read by hand |
| `key.json` | The twelve corrections. For each: every clause that carries the earlier claim or the correction (from `key-search.mjs`'s hits, read by hand), and what a `why` must state. Then the terms and figures no brief may hold |
| `brief-check.mjs` | Checks any file against the key. It flags 27 hits in R0c's three briefs and none in R0d's |
| `grade.mjs` | The mechanical grade by T085's rules, and the units to mark by hand |
