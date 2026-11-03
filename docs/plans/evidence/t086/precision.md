# T086: H1's precision, marked by hand

*Marked by the parent on 2026-10-22, adervark @default/4279585a, on every
unit `grade.mjs` wrote to `precision-units.txt` (each kind under 60, so in
full). Ambiguous counts as not real (R0d's rule). Where a mark needed the
source, it was read in RSNA with `git show` or `git grep` at the fact's
commit; those are marked "read".*

## Conflict: 9 of 9 real (100%)

| Unit | Mark | Why |
|---|---|---|
| C1, C2 | real | the published member's gold-58 range: 0.9128–0.9213 in T111 and in T112 at `416447b`, 0.9054–0.9213 at `59efe32`, which says the older range dropped the lowest public figure. K2 |
| C3, C8 | real | "make dryrun, 9/9 stages" against "13/13 now": the 9/9 was read off a run that crashed. K5 |
| C4, C9 | real | PROGRESS at 07:54 reports 9/9 stages while `dry_run.py` at 07:00 already runs thirteen, and says the nine PASS lines preceded a traceback. K5 |
| C5 | real | `tests/smoke/_order.py` at `1661b58` says the staged corpus is 533 GB; the Makefile, `fetch_corpus.sh`, `bringup_4090.sh` and T112 at the same commit say 21.9 GB (read). Not in the key: a disagreement the record never notices |
| C6 | real | `setup_4090.cmd` at `3659952`: torch ~3 GB, about 40 min on the 10 Mbps line; at `eefcc9c`: 1.9 GB, ~30 min. A correction made in place. Not in the key |
| C7 | real | `coat_data.py` says training redraws window centres every epoch; `coat_curve.py` (`fa63633`, a T112 commit) says `persistent_workers=True` froze `set_epoch`, so the redraw "never happened" (read). A correction the record states. **The key omits it** |

## Superseded: 9 of 9 real (100%)

| Unit | Mark | Why |
|---|---|---|
| S1–S6 | real | the gated smoke suite's count, 1164 → 1176 → 1192 → 1159, in the Makefile and in `_order.py`. K14 |
| S7 | real | `dry_run.py`'s chain, "Seven stages" at `3ed78d4`, "Thirteen stages" at `416447b`: the script grew |
| S8 | real | the weekly Kaggle quota, exhausted on 09-18, reset by the trail's 09-19 reading. K8 |
| S9 | real | `setup_4090.cmd`'s package source, the drive's wheels at `3659952`, uv's cache on C: at `eefcc9c`: the later version replaces the earlier as the script's current method. Key §considered calls this a change of method, not a corrected claim, which is what `superseded` marks |

## Contradicted: none real

All five `contradicted` lines were on check canaries, and all five were
right. No real check was marked `contradicted`, so the kind has no
precision to mark: the bar holds vacuously and measures nothing.
