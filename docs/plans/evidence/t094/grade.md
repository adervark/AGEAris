# T094: H2 graded

*Graded by the parent on 2026-10-24, adervark @default/1f16c0d5, by T094's
rules as approved: `node grade.mjs > grade.json` (the grade committed at
`53fcfbf`, before any reconciler ran), each candidate's `why` judged by
hand, and precision marked by hand below.*

## Verdict: not a pass. Recall fails, 5 of 10 against 8

| Bar | Result | Holds |
|---|---|---|
| Recall ≥ 80% of the corrections in reach | 5 of 10 (50%); the bar is 8 | **no** |
| Every canary caught, after at most one rerun | auditor 73 of 73; reconcilers 23 of 24 | no, as the rule reads |
| `conflict`, `superseded`, `contradicted` each ≥ 90% real | 20 of 22, 25 of 26, 5 of 5 (4 of 5 on another reading of one line) | yes, by one line each way |

v2.8 is not accepted on this round. Under T094's rules the operator decides
between revising the design and accepting v2.7 or v2.8 as it stands.

## The runs

Ten Opus first passes, the cap; no rerun.

| Agent | Run | Minutes | Output |
|---|---|---|---|
| registrar | `1f16c0d5.fc91` | 5 | 136 measurands |
| transcriber G1 | `1f16c0d5.3e18` | 13 | 772 facts, 37 skips |
| transcriber G2 | `1f16c0d5.13a9` | 16 | 740 facts, 26 skips |
| transcriber G3 | `1f16c0d5.89bd` | 14 | 931 facts, 17 skips |
| transcriber G4 | `1f16c0d5.0d23` | 16 | 762 facts, 51 skips |
| closure transcriber GC | `1f16c0d5.f207` | 78 wall, a session limit inside | 401 facts, 4 skips |
| auditor | `1f16c0d5.d58f` | 8 | 251 skips audited (110 missed, 73 of them canaries), 510 assignments |
| reconciler R1 | `1f16c0d5.20c6` | 15 | 387 units |
| reconciler R2 | `1f16c0d5.b999` | 13 | 386 units |
| reconciler R3 | `1f16c0d5.112b` | 15 | 388 units |

The account's session limit stopped the closure transcriber before it wrote
a line. The same agent was continued once the limit reset, so it is a first
pass, not a rerun.

R1 reported one `git grep` over RSNA's `deaddrop/` and `docs/`, outside its
brief, and says it used nothing it returned. None of R1's catches below
depends on a document outside the cut.

## Canaries

- **Auditor: 73 of 73.**
- **Reconcilers: 23 of 24.** R1 8/8, R2 7/8, R3 8/8. All 21 group twins
  were caught, every one chosen under v2.8 item 4, and none sat within its
  group's own figures. Two of the three check twins were caught
  `contradicted`.
- **The miss is fair.** R2 check 153: the twin turned "still small against
  53 GiB" into "18 GiB"; its premise states 53 GiB free. R2 marked it
  `unsupported`: "the 18 GiB set against it (a projection for the close
  date) is in no premise". The refutation, written first, was "F3266 states
  53 GiB free".
- **No rerun of R2.** A rerun is allowed for a missed canary, but recall
  fails by 3, so a rerun cannot change the verdict.

## Recall: 5 of 10 corrections in reach

| Key | Correction | Furthest step | Caught by |
|---|---|---|---|
| K3 | / free, 29 → 26 GB | **caught** | R1 group 33 and **edit 7**, `superseded` |
| K5 | 384/bs2, 97% full → 75% | **caught** | R3 **edit 28**, `conflict`, "the 97% is REFUTED: it is 75%: a correction" |
| K7 | gold held out → in training since `--train-gold` | **caught** | R3 group 3, group 4 and **edit 31**, `conflict` |
| K9 | gate count 1302 → … → 1335 | **caught** | R2 group 12, R1 **edits 5, 6**, R2 **edits 19, 20**, `superseded` |
| K10 | insert at `_coat_substitute` → before the Raptor backup | **caught** | R1 group 14, R2 **edit 21**, `conflict` |
| K2 | dicom_bag corpus 49.4 → 148.2 GB | in a unit, marked on unpinned clauses | R3 group 31 and **cue 31**, `conflict`, against `_order.py#56`, `#57`: see below |
| K8 | the queue starts the fold → launched by hand, OOM, the service stopped | in a unit, not marked | R3 groups 100, 222 `superseded` a neighbouring pair: "a later state of the fold", not the correction |
| K4 | EXT1 → a USB disk that drops off; /mnt/S | in a unit, not marked | groups 191, 197, 194 `ok`; R3 cue 25, on "not withdrawn", rightly `ok` |
| K6 | the premise moved | in a unit, not marked | R2 group 51 (16 facts): "consistent" |
| K1 | the corpus row counted part 1 only | transcribed, in no unit | — |

The search reruns (`searchflip.json`, at `3c8fcaa`) flipped one source,
F1423, none an earlier fact of a key correction.

**K2, caught outside the pinned clauses.** R3 paired the task file's earlier
"49.4 GB" with `_order.py`'s "T121'S COST TABLE WAS WRONG BY 3x" and "the
table assumed a 76-slice single-channel volume, giving 49.4 GB … the real
size is … 148.2 GB", and called it a correction, in a group and in a cue unit.
That is K2. The key pinned K2's correcting clauses in the task file alone; the
record states it in `_order.py`, `coat.py` and `materialise.py` too, and the
key missed them. The key stays as pinned, as H1's did: 5 of 10. Counted in,
recall would be 6 of 10, still under the bar.

## What v2.8's units did

| Unit | Catches on the key | Only through it |
|---|---|---|
| edit (40 units) | K3, K5, K7, K9, K10 | **K5** |
| cue (36 units) | K2 (on unpinned clauses) | K2 |
| groups and checks, v2.7's units | K3, K7, K9, K10 | — |

So v2.7's units alone would have caught 4 of 10 here, and v2.8's edit unit
added one. Of the edit units' marked lines (unique pairs), 18 were real and
none false: 4 corrections (K5, K7, K10, and the G-log gate) and 14 later
readings of a moving record (counts, status, owner, free space).

## The misses, by mechanism

- **An edit made by striking through (K2).** The task file struck "49.4 GB"
  to `~~49.4 GB~~` beside the measured 148.2 GB. The struck clause has the
  same words, so its likeness is 1, and v2.8 item 1 forms an edit only below
  1. A strike is the plainest correction in place there is.
- **A correction that names itself with a word v2.8 does not cue (K1).**
  T121#50 opens "CORRECTED 2026-09-21 by measuring"; T121#90 says "REFUTED".
  Neither word is in v2.8's cue list. K1's earlier side is a table's row
  label, which no edit pairs with the relabelled row (likeness 0.29).
- **A cue fired on a negation (K4's neighbourhood).** "not withdrawn" matched
  `withdrawn`; R3 rightly marked it `ok`. A cue needs the negation excluded.
- **A correction of a premise or a plan, in a group, marked `ok` (K6, K4).**
  "The premise moved" and "the registered target is under review" sat in
  units with their earlier sides; the lines said "consistent". v2.8 item 3's
  claim frame did not turn them.
- **A plan superseded by what happened, described as a later state (K8).**
  R3 marked a neighbouring pair `superseded` with a `why` that never says
  the queue did not start the fold.

## Found outside the key

Every marked line, real or false, is in `precision.md`. Among the real ones,
corrections the record states that the key, pinned before the spend, did not
hold:

- AGENTS.md's "61 days to zero", "wrong by about 5x in the dangerous
  direction" (R1 group 33).
- AGENTS.md still saying the T121 rebuild "needs ~49 GB" at `3c8fcaa`, after
  the correction (R3 group 31): copy drift.
- The Makefile's "1239-check suite" against the 1335-check gate at one
  commit (R2 group 12, R3 group 19), which the key's `considered` list named
  and set aside.
- A comment saying `slot_groups()` refuses an unknown depth against its own
  docstring and the T120 review (R3 group 336).
- T121's G-log gate, extended after G v2 silently lost the parent's child
  (R2 edit 25).

## What the operator decides

H2 was a held-out round v2.8 was not drawn from.

1. **v2.8 caught 5 of 10**, against H1's 4 of 13 under v2.7. Its edit unit
   carried the round: every catch but one went through it or a group, and
   K5 through it alone. Precision held: 20 of 22, 25 of 26, 5 of 5.
2. **It missed five, and three of the five are mechanical**, each fixable
   for free: a struck clause makes no edit; "CORRECTED" and "REFUTED" are not
   cues; a cue fires on "not withdrawn". The other two are judgement in a
   unit that held both sides (K6, and K4 and K8 near it): the
   word-scope-reason blind spot again.
3. **The key under-pinned K2**, which was caught against clauses the key did
   not list.

The two choices T094's rules give:

- **Revise (v2.9).** Three mechanical items: strike-aware edit pairing,
  `corrected` and `refuted` as cues, and cues that skip a negated word, each
  measured for free on H1 and H2. The judgement misses have no mechanical
  answer yet. v2.9 would need a third held-out round, another ten passes.
- **Accept v2.8 as it stands**, with what H2 measured written into §5.5:
  corrections made in place, by edit or by an explicit word, are caught; a
  correction of a premise, a plan or a reason, inside a unit that holds both
  sides, often is not.
