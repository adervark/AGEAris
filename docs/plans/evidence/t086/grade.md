# T086: H1 graded

*Graded by the parent on 2026-10-22, adervark @default/4279585a, by T086's
rules as approved: `node grade.mjs > grade.json` (committed at `7a4bfff`,
before any reconciler ran), each candidate's `why` judged by hand, and
`precision.md` marked by hand.*

## Verdict: not a pass. Recall fails, 4 of 13 against 11

| Bar | Result | Holds |
|---|---|---|
| Recall ≥ 80% of the corrections in reach | 4 of 13 (31%); the bar is 11 | **no** |
| Every canary caught, after at most one rerun | auditor 40 of 40; reconcilers 14 of 15, the miss unfair (below) | no, as the rule reads |
| `conflict`, `superseded`, `contradicted` each ≥ 90% real | 9 of 9, 9 of 9, none real to mark | yes (the last vacuously) |

v2.7 is not accepted on this round. Under T086's rules the operator decides
between revising the design and accepting it as it stands.

## The runs

Nine Opus first passes against a cap of ten; no rerun.

| Agent | Run | Minutes | Output |
|---|---|---|---|
| registrar | (in `02ed6a5`) | ~4 | 122 measurands |
| transcriber G1 | `4279585a.2f32` | 17 | 551 facts, 62 skips |
| transcriber G2 | `4279585a.bf5b` | 13 | 609 facts, 70 skips |
| transcriber G3 | `4279585a.f127` | 11 | 651 facts, 38 skips |
| closure transcriber GC | `4279585a.d669` | 6 | 166 facts, 4 skips |
| auditor | `4279585a.d49c` | 9 | 264 skips audited (92 missed, 40 of them canaries), 544 assignments |
| reconciler R1 | `4279585a.5f2e` | 15 | 109 groups, 127 checks |
| reconciler R2 | `4279585a.6df6` | 14 | 111 groups, 125 checks |
| reconciler R3 | `4279585a.bf4b` | 16 | 110 groups, 126 checks |

The account's session limit stopped all three reconcilers before any of
them wrote a line or a trail entry. The same agents were continued once the
limit reset, so these are first passes, not reruns.

## Canaries

- **Auditor: 40 of 40.**
- **Reconcilers: 14 of 15.** R1 5/5, R2 4/5, R3 5/5. All five check
  canaries were caught `contradicted`, each on the figure its refutation
  gives. All three largest-decile group canaries (ranks 3, 3 and
  4 by size) were caught.
- **The miss is unfair.** R2 group 299, `m:teacher-file-size`: the twin put
  "200 KiB" where `bringup_4090.sh` says "197 KiB", in a group that already
  holds T112's real "teacher, 200 KB". R2 marked it `ok`, "197 KiB = 202 KB,
  given as 200 KB and 200 KiB elsewhere: rounding of one size". That is the
  right reading. v2.7 made check canaries fair (item 1) and left group
  twins alone: a twin may take a value within the real one's rounding, or
  one another real fact in its group already gives.
- **No rerun of R2.** A rerun is allowed for a missed canary, but it would
  meet the same twin, and the right answer is still `ok`. Recall fails
  either way, so a rerun could not change the verdict.

## Recall: 4 of 13 corrections in reach

| Key | Correction | Furthest step | Caught by |
|---|---|---|---|
| K2 | the published arm, 0.9128–0.9213 → 0.9054–0.9213 | **caught** | R1 groups 53, 122, `conflict`, both stating the dropped lowest figure |
| K5 | dry run 9/9 → crashed; 13/13 | **caught** | R2 group 8, R3 group 101, `conflict`, each stating the crash |
| K8 | quota exhausted → reset | **caught** | R2 group 146, `superseded`, "a later reading of a moving state" |
| K14 | smoke counts 1164 → 1176 → 1192 → 1159 | **caught** | R1 groups 7, 135, R3 group 27, `superseded` |
| K1 | 336 illegal → illegal as res only | in a group, marked `ok` | R1 group 1 (175 facts): "old 336-illegal text was dropped later"; R3 group 18 (29): "first draft guarded img … agree" |
| K3 | "full fidelity" undefined → defined | in a group, marked `ok` | R1 group 19, R2 group 5: both read the BROKEN floor's figure, not the term |
| K4 | "a realistic good day" → "the best case" | in seven groups, marked `ok` | R1 group 128: "'realistic good day' became 'best case' at 59efe32, one file edited, not a quantity". R2 check 213 called the earlier claim `unsupported`, "(T112 later struck the word)" |
| K6 | at most two cycles → zero today | in a group, marked `ok` | R3 group 42: "zero cycles is 2026-09-18 alone, a stated other day" |
| K9 | the VOID banner prints because the arm ran → it prints at import | in a group, marked `ok` | R1 group 1 (175 facts), whose line names neither fact |
| K12 | bring-up runs on the 4090 → Windows without WSL | in a group, marked `ok` | R2 groups 2 (119 facts) and 115: both read "needs bash", neither ties it to the plan |
| K7 | gap not resolved → resolved behind | no unit holds both sides | checks on the earlier facts' arithmetic, `follows` |
| K10 | chain verified end to end → the 224 arm could not run | no unit holds both sides | R2 check 235 on a neighbouring fact, `follows` |
| K11 | submission 1 → withdrawn | transcribed, in no unit | — |

The search reruns (`searchflip.json`) flipped 3 sources (F354, F756, F822),
none an earlier fact of any key correction.

### The misses, by §5.5's gaps

- **"A reconciler that marks a real conflict `agree`" and "a supersession
  the reconciler calls consistent": 6 (K1, K3, K4, K6, K9, K12).** Both
  sides reached one reconciler in one group, and the line said `ok`. In
  K1 and K4 the line names the edit and still says `ok`: R1's "not a
  quantity" is the brief's frame read literally. Every catch is a figure or
  a count (a range, a stage count, a check count, a quota state). Every miss
  in a group is a correction of a word, a scope or a reason. K9's only
  shared group held 175 facts.
- **"Two facts about one thing that share no referent": 3 (K7, K10, K11).**
  The earlier and the correcting fact never met in a unit. Each side is
  prose about a state ("not resolved", "verified end to end", "submission
  1") with no measurand, flag or path in common.

## Found outside the key

The reconcilers marked 18 unique findings, all real. Thirteen bear on the
four corrections caught (K2, K5, K8, K14). The other five:

- **A correction the key omits.** `coat_curve.py` (`fa63633`, a T112 commit)
  says the per-epoch window resampling `coat_data.py` describes "never
  happened", because `persistent_workers=True` froze `set_epoch`. R3
  marked it `conflict`, a correction (group 4). It is a correction T112's
  record states, and the key, pinned before the spend, missed it. Counted
  in, recall would be 5 of 14, still under the bar; the key stays as it was
  pinned.
- `setup_4090.cmd`, torch ~3 GB / ~40 min → 1.9 GB / ~30 min (R2, a
  correction made in place), and the package source, the drive's wheels →
  uv's cache (R2, `superseded`).
- `_order.py`'s "533 GB" staged corpus against 21.9 GB everywhere else at
  the same commit (R2): a disagreement the record never notices.
- `dry_run.py`'s chain, seven stages → thirteen (R1, R2).

## What the operator decides

R0d failed on one unfair canary. H1 fails on recall, and the failure has a
shape. On a round that is one author correcting their own record in place:

1. The pipeline catches corrections of figures and counts, 4 of 4 in reach.
   On what it marks it is precise: 18 of 18 unique findings real.
2. It misses corrections of words, scopes and reasons, 0 of 9 in reach. In
   six of them the reconciler had both sides and called them consistent,
   in two cases naming the edit. In three the linker never put the sides
   together, because prose states share no referent.
3. Group canaries can still be unfair, by a twin inside the real value's
   rounding.

The two choices T086's rules give:

- **Revise.** Two candidate items for a v2.8: the reconciler's brief
  treats a sentence edited between two commits of one document (`doc` and
  `doc@commit`) as a pair to judge as a claim, not only as a value. And
  group twins take a value outside the real one's rounding and not given
  by another fact in the group. Linking prose states that share no
  referent has no mechanical rule yet (§5.5 says so).
- **Accept as it stands**, with what H1 measured written into §5.5: the
  design catches figure and count corrections and is blind to qualitative
  ones on single-author rounds.
