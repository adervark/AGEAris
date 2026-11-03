# T082: what v2.5's fixes do on T075's material, measured for free

*No subagent ran for this. Everything below is a script over RSNA, read
through `git show` with `GIT_OPTIONAL_LOCKS=0`, or over T075's committed
ledger. Nothing in RSNA was written.*

## 1. The clause sieve (`sieve.mjs`)

`node sieve.mjs ~/Code/RSNA <out> ../t075/ledger.jsonl`. It cuts each
document into clauses by a linear scan (sentences, semicolon clauses, table
cells, headings; fenced code dropped). It marks a clause `claim` when it
carries a digit, a sign (`→ ⇒ × % ≥ ≤ ~ < >`) or a word from a fixed list.
It finds each fact's `says` verbatim in its document and marks the clauses
that quote overlaps.

`clauses.jsonl` (1.8 MB) is not committed; the command regenerates it.
`sieve-report.json` holds the counts.

| Document | Commit | Clauses | Claim clauses | Covered by T075's facts |
|---|---|---|---|---|
| R1 synthesis | `d9c7c6e` | 285 | 206 | 53 |
| R2 synthesis | `d9c7c6e` | 185 | 152 | 47 |
| T047 brief | `d9c7c6e` | 83 | 47 | 9 |
| lane 9 | `e4e356c` | 573 | 470 | 36 |
| lane 10 | `e4e356c` | 639 | 456 | 47 |
| lane 11 | `e4e356c` | 267 | 216 | 40 |
| lane 12 | `e4e356c` | 331 | 267 | 38 |
| lane 13 | `e4e356c` | 152 | 127 | 25 |
| **The eight R0b read** | | **2,515** | **1,941** | **295** |
| Rounds 1–2's nine lane reports | `d9c7c6e` | 6,156 | 4,662 | — |

- 8 of T075's 232 facts quote text the sieve cannot find verbatim in their
  document. v2.5 refuses those at `research.sh fact`.
- 77% of clauses carry a claim by this test, so the test is not much of a
  filter. v2.5 therefore disposes of every clause, and the `claim` mark only
  orders the auditor's reading.

**The corrections' clauses.** Each one I could locate is a claim clause. The
ones T075 left uncovered are the misses that v2.5's `untranscribed` makes
visible:

| Correction | Clause | Line | Covered by T075 |
|---|---|---|---|
| C12, the earlier claim | `lane10#392` "or drop the ten fold? members, which frees the slot and unlocks three TTA views (§3.4)…" | 349 | **no** |
| C12, the correction's premise | `lane11#223` "tta.unmatched (src/tta.py:110) refuses a view unless every member was trained for it…" | 301 | **no** |
| C7, the earlier claim | `R1#220` "384 px only behind it." | 178 | **no** |
| C8, the hypothesis lane 9 tests | `lane9#100` "So — is the whole band public overfit?" | 123 | **no** |
| C8, R1's basis | `R1#125` "Picking the best public score among ~40 distinct submissions manufactures ~+0.010 of worthless public gain." | 142 | F44 |
| C4, the earlier claim (scope) | `lane7/R2#270` "…the model under-predicts by 2× in practice." | 331 | **no**, outside R0b's scope |
| C11, the earlier claim | `lane11#187` "…66 → 132 units ⇒ ~175 min…" | 233 | F178 |
| C9, the earlier claim | `R1#27` "776, at 0.926" | 27 | F16, F17 |
| C5, the earlier claim | `T047brief#46` "…a bracketed 1.5–4.4 h." | 48 | F7 |
| C10, the earlier claim | `lane12#238` "…because train.py has no --resume" | 291 | F203 |
| C6, the correction | `lane11#30` "Correction to the brief: … 3 TTA views (id, crop, bright), not 2." | 37 | F158 |

## 2. C6's earlier claim is in no commit

T075's grade counted C6 among the claims "in documents the transcriber
read". That was wrong.
- `git grep` for "2 TTA views", "two TTA views", "2 views" and "two views"
  at `d9c7c6e` finds nothing in the T047 brief.
- The brief's history (`d9c7c6e`, `f896e38`, `e4e356c`, `4ebf6d1`) adds no
  line with "view" to its lane 11 section before the synthesis.
- Lane 11:37 corrects "the brief", meaning the prompt lane 11 was given,
  which was never committed. v2.5 commits prompts (`question.prompt`).

## 3. C3's earlier claim is in the cited definition

`src/tta.py` at `d9c7c6e`: `def budget_minutes` at line 324, and its
docstring's "**upper bound**" at line 330. Lane 11 cites `src/tta.py:324`
(lane 11:96), so under v2.5's citation closure the definition enters scope
with its docstring.

## 4. C10: the search flips

```
git grep -n -e --resume d9c7c6e -- src   → (nothing)
git grep -n -e --resume e4e356c -- src   → src/train.py:320, :454, :457
```

`f896e38` ("train.py --resume + stall watchdog") landed at 2026-09-02
20:02 +0530, after the lanes' base `d9c7c6e` (15:47). T075's F203 cites
`AGENTS.md:46,49`, not a search, so nothing could flip.

The hash must not cover line numbers. `git grep -n -e --layer-decay -- src`
hashes differently at `2b3d2a6`, `d9c7c6e` and `e4e356c`, because the
definition moved. With `-h` (no names or line numbers) all three give
`e519bfd2c829`. v2.5 hashes each match's file and text.

## 5. Re-linking T075's ledger under v2.5 (`link.mjs`, `relink/`)

`node link.mjs ../t075/ledger.jsonl ~/Code/RSNA relink relink/canary-key.json`

| | v2.4 (T075) | v2.5 |
|---|---|---|
| Real pairs | 234 | 427 |
| of which premise → conclusion | — | 103 |
| of which within one document | 0 | 193 |
| `out-of-sight` | 39 | 2 (both in `.venv`); 37 now `regenerable` |
| Canary values | ×1.5 or −2, reaching an AUC of 1.419 | another real fact's plain value of the same unit and shape |

- **C11 is now a pair:** F161 → F178, `via: premise`, both in lane 11. F161
  gives 25.2 + 1.329 × 132 = 200.6 min against F178's ~175. Whether the
  reconciler marks it `does-not-follow` is for R0c.
- **The canaries** (`relink/canary-key.json`): gold-58 macro AUC 0.9054 →
  0.8793; rank 265 → 776; % 90.6 → 20.0; public AUC 0.924 → 0.946. Each
  takes another real fact's plain value of the same unit and shape, and no
  fact both lends and is twinned.
- **How the rule got there**, each step run on this ledger:
  - Free-text values swapped across facts read as a different kind of
    statement: a duration in seconds became a list of three timings. So only
    plain decimal values twin.
  - Mutual swaps (776 ↔ 265, 0.9054 ↔ 0.8793) let a reader who remembers the
    ledger spot a value that belongs elsewhere. Lenders are not twinned now.
  - A unit is not a domain. A gold AUC delta of −0.0053 became 0.8976, and
    0.0653 s per study became 1591 s. A lender must match the sign and the
    digits before and after the point.
  - That leaves 4 canaries, not 6. T075's ledger has few plain values.
- `pairs.json` and `view.jsonl` are not committed; the command regenerates
  them.

## What this does not show

- That transcribers dispose of every clause well, or that the auditor
  catches what they skip. That needs subagents: R0c.
- That measurands link C5 and C9. No measurand exists in T075's ledger, and
  assigning them here would be me choosing identity by label.
