# T084: v2.6 measured for free on R0c's material

*2026-10-21. Everything here reruns from R0c's committed ledger
(`docs/plans/evidence/t082/r0c/merged/ledger.jsonl`) with no subagent. RSNA
is read with `git show` only. Run each script from
`docs/plans/evidence/t082/r0c/`.*

**The baseline reproduces.** `link.mjs` and `groups.mjs` on R0c's ledger
give R0c's `link-report.json`, `summary.json` and `R1`–`R3.jsonl` byte for
byte: 286 groups (4,848 fact lines) and 1,220 checks (4,681 lines).

## 1. Refs from quotes (C2): kept

`quote-refs.mjs` scans each fact's `says` linearly. Every flag, path and
code identifier it names is added to the fact's `refs`.

- 423 of 4,033 facts gain a ref; 544 refs in all:
  - 141 flags, on 113 facts;
  - 239 paths, on 215 facts;
  - 164 identifiers, on 140 facts.
- The most frequent are `train.py` (28), `--seqs` (15), `--layer-decay` (15)
  and `src/tta.py` (13).

| refs taken from quotes | groups | fact lines in groups | vs R0c |
|---|---|---|---|
| none (R0c) | 286 | 4,848 | — |
| flags | 299 | 5,144 | +6.1% |
| flags and paths | 329 | 5,482 | +13.1% |
| flags, paths and identifiers | 351 | 5,676 | +17.1% |

- **C2 meets.** R2's S1 ("Screen S1, --layer-decay 0.6 --warmup-frac
  0.15", `R2#174`) and lane 10's "--layer-decay cannot express the
  hypothesis T042 is spending a fold on" (`lane10#16`) now share
  `ref:--layer-decay`, a 60-fact group. In R0c they never shared a unit.
  Flags alone are enough.
- Units in which each correction's two sides meet (`reach.mjs`, T082's
  key):
  - C2 goes from 1 to 2, C3 from 2 to 5, C11 from 2 to 3, C12 from 2 to 4;
  - none loses one.
- **By T084's rule:** C2's sides share a unit, and the load grows 17.1%,
  under the quarter allowed. All three classes are kept.
- Paths are not normalized: `train.py` and `src/train.py` are two refs.
  v2.6 resolves a bare file name to its repository path when exactly one
  path matches.

## 2. Supersession (C5, C9): a reconciler mark, not a mechanical list

`supersede.mjs` takes each group linked through a measurand. A candidate is
two facts from different documents whose readings differ. A reading is the
numbers in the value, with ranges as their two ends, thousands commas
dropped, hours and seconds turned into minutes, and thresholds such as
"≥0.94" left out.

- 63 measurand groups give 12,616 cross-document pairs, and **2,933
  candidates**. The largest group alone (R2 group 7,
  `m:deployed-kernel-runtime`, 84 facts) gives 752: runtimes of hypothetical
  configurations, which differ by design.
- C5's and C9's pairs are among them:
  - C5: 1.5–4.4 h, read as 90–264 min, against 113 min (R2 group 7);
  - C9: 776 against 804 (R1 group 29).
- **By T084's rule:** more than 300 candidates is too noisy for a list. So
  supersession becomes a reconciler mark only: a `superseded` finding on a
  group, with no candidate list. Whether reconcilers mark C5 and C9 with it
  cannot be measured without a replay.

## 3. Canaries that can be refuted (the measurement)

`canary-checks.mjs` asks which checks can carry a fair canary. The
conclusion must hold one number in a unit domain (`groups.mjs`'s `slot`,
unchanged), and some premise must hold a number in the same domain.

- 119 of 1,220 checks can be twinned, and **70 are eligible**. Three
  reconcilers need 27 check canaries in all, about 9 each.
- 9 of R0c's 27 check canaries were not eligible. Reconciler 2's missed
  canary (check 158, "~25 lines" on a premise with no count) is among the 9.
- A canary shown beside its real check, to a different reconciler, removes
  nothing from review. Every one of R0c's check canaries removed its real
  check, C11's own among them.

## 4. Code read at two commits (`precision.md` P45)

`closure.mjs` cuts each cited code file at the commit its citing fact
names.

- So the cut holds `src/tta.py`, `src/train.py`, `src/dataset.py` and
  `scripts/smoke_test.py` at two commits each: `6d10943` and `d9c7c6e`.
  T039's fix to `apply_view` (`53b985e`) lies between them.
- §5.2 says a fact's `at` carries its commit. **None of the 4,033 facts'
  `at` does**, and the reconcilers' view shows no commit.
- So a docstring from before the fix sat beside lane 10's reading after it,
  with nothing to tell them apart.

## 5. Not measurable for free

- Whether reconcilers mark C5 and C9 `superseded`.
- Whether a split premise check (`contradicted` against `unsupported`) and
  an ESTIMATED mark lower the noise. R0c's sample gives the expected shape:
  of 20 `does-not-follow`, 5 contradicted, 14 unsupported, 1 ambiguous.

Each needs a replay, which is its own task (T084's rule).
