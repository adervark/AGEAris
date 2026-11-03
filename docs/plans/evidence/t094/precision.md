# T094: precision, marked by hand

*The parent, 2026-10-24, on `precision-units.txt` (every unique line; no kind
had more than 60). Real: the two facts disagree as the line says, or the
later replaces the earlier as the line says.*

## conflict: 20 of 22 real (90.9%)

| Unit | Mark | Note |
|---|---|---|
| C1 R1 group 14 | real | K10 |
| C2 R1 group 33 | real | "61 days to zero" wrong by ~5x, a correction AGENTS.md states |
| C3 R1 group 65 | real | 49.4 GB against the cost table's stated error |
| C4 R1 group 139 | real | ~70 GB rests on the 49.4 GB figure |
| C5 R1 cue 2 | real, a judgement | both facts sit on the correcting side; one quotes the table's 49.4 GB inside the sentence that corrects it |
| C6 R1 cue 7 | real, a judgement | as C5 |
| C7 R1 cue 8 | **false** | the docstring describes the windows after T119's fix, `_order.py` the history before it: two conditions |
| C8 R2 group 12, R3 group 19 | real | 1239 against 1335 at one commit |
| C9 R2 group 12 | real | 975 against 984, the doc wrong |
| C10 R2 group 15 | real | K2's arithmetic without the 3 channels |
| C11 R2 group 272 | **false** | 7.62 against 7.65 GiB: one card, two instruments |
| C12 R2 edit 21 | real | K10 |
| C13 R2 edit 25 | real | the G-log gate, extended |
| C14 R2 cue 17 | real | 49.4 GB against the statement that it was wrong |
| C15 R3 group 3 | real | K7 |
| C16 R3 group 4 | real | K7 |
| C17 R3 group 31 | real | K2, on unpinned clauses |
| C18 R3 group 31 | real | AGENTS.md keeps ~49 GB after the correction |
| C19 R3 group 336 | real | comment against docstring |
| C20 R3 edit 28 | real | K5 |
| C21 R3 edit 31 | real | K7 |
| C22 R3 cue 31 | real | K2, on unpinned clauses |

## superseded: 25 of 26 real (96.2%)

S1–S6, S8–S26 real: later readings of free space (S4, S5), check counts
(S9–S13, S17, S19, S20), the task's status, owner and in-flight state (S8,
S15, S16, S18, S21–S23, S25, S26), code that moved after T120's review (S1–S3,
S6), the fold-time estimate (S24, 10.7 h just above the 7.2–10.6 h bracket,
a later estimate rather than a sharper one inside it), and / at 98% then 97%
(S14).

**S7 false:** `build_t112_kernel.py`'s "coat_data.py does no normalisation"
and `bag_child.py`'s BagWindows that applies it are two classes under two
conditions; neither replaces the other.

## contradicted: 5 of 5 real

C1 (11 MB × 4,407 is 48.5 GB, not 148 GB), C2 (the premise says no false
positives, the conclusion a false one), C3 and C4 (dropping the first of 13,
14, 15 gives 14.5, not the centre), C5 (145/7 against 125/8 is 33% per
epoch, or 16% in total, not 24%).

C5 is a judgement: "about 24%" is (46 − 11)/145, T004's extra overhead as a
share of its time, which the closure transcriber noticed. If the text meant
that, C5 is false and the kind is 4 of 5 (80%). Either reading leaves the
verdict where recall puts it.
