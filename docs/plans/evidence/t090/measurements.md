# T090: v2.8, measured for free on H1's material

*adervark @default/1f16c0d5, 2026-10-22. No subagent and no spend: every
number here is a script over `../t086`, rerunnable from this folder, and the
hand marks are the parent's. All of it is in-sample: drawn from T112, the
round v2.8 answers. A held-out round decides acceptance (T090's decision
rules).*

| File | What it is |
|---|---|
| `edit-pairs.mjs`, `edit-pairs.json` | Item 1: each clause an edit dropped, paired with the most similar clause of a later version of the same document (`node edit-pairs.mjs 0.4`) |
| `cues.mjs`, `cues.json` | Item 2: the facts whose quote carries a correction cue, each with a cue unit of the 12 earlier facts most like it (`node cues.mjs 12`) |
| `twin-rule.mjs`, `twin-rule.json` | Item 3: which of H1's group twins the new rule re-picks |
| `brief-reconciler.md` | v2.8's reconciler brief, a template; `t086/brief-check.mjs` finds 0 hits in it against H1's key |

## What H1 missed, and why

H1 caught 4 of 13 corrections in reach. Of the nine it missed:

| Key | Both sides in one unit? | Shape | Why the reconciler passed it |
|---|---|---|---|
| K1 | yes, R1 g1 (175 facts), R3 g18 | an edited sentence, `doc@commit` → `doc` | the brief: a file changed between commits "is not a disagreement unless the later commit still says the earlier thing" |
| K3 | yes, R1 g19, R2 g5 | an edited sentence: a definition appended | the same; both read the figure, not the term |
| K4 | yes, seven groups | an edited sentence: a word struck | the same; R1: "not a quantity" |
| K6 | yes, R3 g42 | a later section of one document, same commit: "zero, not two" | read as another condition: "a stated other day" |
| K9 | yes, R1 g1 (175 facts) | a later section of one document: the banner's reason | nothing named it in a 175-fact group |
| K12 | yes, R2 g2 (119 facts), g115 | a later section: the machine's OS rules out the bash bring-up | read "needs bash" without the plan it breaks |
| K7, K10, K11 | no | prose states with no shared referent | never met |

So the v2.7 brief itself told the reconcilers to pass three of them, and its
value-first frame ("the same quantity") let two more through as "not a
quantity" or "another condition".

## Item 1: an edit is a unit, judged as a claim

The linker pairs each clause a later version dropped (`<doc>@<commit>`, the
cut's own record of an edit) with the clause of a later version of the same
document most like it, by the Dice coefficient over their word sets, when the
likeness is at least the threshold and below 1. Each pair becomes an **edit**
unit, read by a reconciler as two claims.

| Threshold | Pairs | On the key | Corrections reached |
|---|---|---|---|
| 0.3 | 43 | 11 | K1, K2, K3, K4, K14 |
| **0.4** | **39** | **10** | **K1, K2, K3, K4, K14** |
| 0.5 | 33 | 9 | K1, K2, K4, K14 |
| 0.7 | 19 | 8 | K1, K2, K4, K14 |

0.4 is the lowest threshold that reaches K3, whose edit appended a definition
to an unchanged sentence. Of 53 dropped clauses, 39 pair; 39 units against
H1's 330 groups is a small load.

**The 29 pairs off the key, marked by hand:**
- **The claim changed, 13:** #7, #9, #10 (the status line's moving state);
  #8 (a row struck in place); #20 (the arm to run); #23 (the re-review, which
  never ran); #24 (the error message's `img` → `res`, part of K1 though on
  other clauses); #26 (what a check must contain); #27, #28 (`dry_run.py`'s
  seven stages → thirteen, which R1 and R2 caught as groups); #34 (`coat.py`'s
  refusal rule); #38, #39 (`setup_4090.cmd`'s package source and size, which
  R2 caught).
- **Reworded, or two clauses about different things, 16:** #11–#19 (the
  handoff's lines among them), #21, #22, #32, #33, #35–#37.

So of 39 edit units, 23 hold a change of claim (10 on the key, 13 off it),
and 16 are for `ok`.

## Item 2: a cue unit for a fact that reads like a correction

A fact whose quote carries one of eight cues (`struck` or `~~`,
`superseded`, `turned out`, `was/is wrong`, `mistake`, `was undefined` or
`never happened`, `assumed`, `withdrawn`, and `not` before a figure or a
number word) gets a **cue** unit: itself and the 12 facts recorded before it
that are most like it, in any document. "Recorded before" is an earlier
commit, or the same commit and document, earlier in it.

- **Load:** 33 of 1,977 facts carry a cue, so 33 units of 13 facts.
  `instead of`, `rather than`, `in fact` and `actually` were tried and
  dropped: 69 more flags, none on a correcting fact.
- **Hand marks, the 33:** 19 correct something earlier in the record, 1 is
  unclear (#25, "Not one of them built the backbone"), 13 correct nothing
  (a rule, an error message, "measured, not assumed" as emphasis).
- **Reach:** a cue sits on a correcting fact of K1, K3, K4, K6, K11 and K12.
  The cue unit holds an earlier fact of the same correction for K3, K4, K6
  and **K11**, one whose sides never met in H1. K1's and K12's earlier facts
  are not among the 12 nearest.

| Size of a cue unit | Corrections whose sides meet in it |
|---|---|
| 5 | K3, K4, K6 |
| 8 | K3, K4, K6 |
| **12** | **K3, K4, K6, K11** |
| 20 | K3, K4, K6, K11 |

## Item 3: a group twin takes no figure its group already states

A group twin's figure, rounded to the precision another fact in its group
writes, must differ from that fact's figure, in any unit; one-digit figures
elsewhere are passed over, as v2.7 passes them over for checks. The rule
picks the twin's value, not which groups get a twin, so it costs no canary.

| H1's ten group twins | Count |
|---|---|
| Re-picked by the rule | 4: R2 g299 (197 → 200 KiB beside "200 KB", the unfair miss), R2 g10, R3 g12, R3 g60 |
| of which caught in H1 | 3 |
| Kept, all caught | 6 |

A relative bound was tried first and dropped: 10% re-picked 6 of 10,
0.941 → 0.869 among them, a large step for a score.

## The brief, by hand on the six in-group misses

v2.8's brief changes the reconciler's frame, not its output format:
- **Removed:** a file changed between commits "is not a disagreement unless
  the later commit still says the earlier thing".
- **Added:**
  - every pair judged as two claims;
  - a correction of a word, a scope or a reason, with examples from
    neither round;
  - "not a quantity" is never a reason to pass;
  - a later clause that denies an earlier one by name or value corrects it
    even when it names a date;
  - the edit and cue units, each with its own lines.

Read by hand against that text (the parent, who wrote both, so this shows
the brief's words cover each pair, not that an agent will mark it):

| Key | Unit in v2.8 | The brief's sentence that decides it | Mark |
|---|---|---|---|
| K1 | edit (`…@3ed78d4#2` → `…#121`), and its groups | "the later version says something else about the same thing": 336 is not legal → not a legal *res* | `conflict`, a scope corrected |
| K3 | edit (`T112@416447b#1` → `#140`), cue F156 | "this was undefined when it was written" | `conflict`, a term defined after the rule used it |
| K4 | edit (`T112@416447b#5` → `#197`), cue F216 | a word corrected; "struck" | `conflict`, a word |
| K6 | cue F249 (holds F111), R3 g42 | "denies an earlier one by value … even when it names a date" | `conflict`, the schedule's premise failed |
| K9 | R1 g1 only (175 facts) | a reason corrected: prints because the arm ran → prints at import | `conflict`, a reason |
| K12 | R2 g2 (119 facts), g115; cue F1694 without the earlier side | a scope corrected: the bring-up cannot run on that machine | `conflict`, a scope |

## What v2.8 can reach on H1, at best

| | Corrections |
|---|---|
| Caught by v2.7 | K2, K5, K8, K14 (4) |
| A new unit puts both sides in front of a reconciler | K1, K3, K4 (edit); K3, K4, K6, K11 (cue): **5** |
| Still only in a large group, needing the brief's frame | K9, K12 (2) |
| Never met, no rule | K7, K10 (2) |

If every pointed unit is marked and both large-group pairs are too, v2.8
reaches 11 of 13 on H1, exactly the bar. Every miss beyond that fails it.
That is an upper bound, in-sample, and the cue unit's size of 12 was chosen
on this same material. What decides is a held-out round.
