# T074's evidence: RSNA's research round 3, replayed as a ledger

- `replay.mjs` applies T074's extraction procedure to RSNA at `e4e356c`,
  reading through `git show`. It writes `ledger.jsonl` and `warnings.json`
  beside itself and prints `summary.json`. Run it with
  `node replay.mjs > summary.json`. Re-running it reproduces all three files
  byte for byte.
- `ledger.jsonl` contains 8 questions, 9 settled questions from rounds 1–2,
  254 claims and 34 decisions.
- The result is in `AA/tasks/done/T074-replay-rsna-round-3-as-a-ledger.md`
  and in PROGRESS.md (2026-10-13).
- **These files quote RSNA's competition research.** Do not push them
  before RSNA closes on 2026-10-22 without the operator's word.
