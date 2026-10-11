---
id: T055
title: "The orient contract and its scenario corpus"
status: claimed
owner: adervark @b/cab833a2 2026-10-11 — docs/ORIENT.md and the tests/orient corpus
# type: one word; tasks of one type are timed together; `bug` counts as defect work
type: design
# blockedReason: while blocked, one line saying what unblocks it; cleared on unblock
blockedReason: ""
depends: []
created: 2026-10-10
---

# T055 — The orient contract and its scenario corpus

## Goal

`docs/ORIENT.md` defines `aa.orient/1`, and `tests/orient/` holds every scenario with its expected answer, reviewed by the operator.

## Context

- From T052, the agent's brain design: [`docs/plans/agent-brain.md`](../../docs/plans/agent-brain.md). §5.1–5.4 and §8 of the design, and **every item in §11**, which the third Critic pass made a condition of approval.
- 2026-10-10, T069 settled §11 N1 and N2 in the design (v2.3): `until` on
  `doing`, three run states, `verify` before any `resume`, and siblings in the
  family. Write their fixtures (rows 1a and 1b) rather than re-deciding them.
  The `until` question in the open list is answered.
- 2026-10-11, the operator asked for a clear decision between running and
  closed sessions, with a failsafe. T070 makes it (design v2.4, D5): a run is
  running or closed, decided by `end`, then `until`, then its process on this
  machine, then the clock. *Unknown* and `verify` are gone. The contract and
  the corpus follow v2.4, with process cases on an injected process view.
- The same day the operator answered §11's open question (D6). When your own
  task is held by a session that is verified running, a new session waits, and
  the holder is named.

## Steps

- [x] Write `docs/ORIENT.md`: definitions, the precedence table, provenance, serialization, budget, versioning, with every §11 fix applied.
- [x] Write the corpus: every fixture named in §5.2, every case in §8, and the §11 fixtures, marking server-only cases. 82 cases in `tests/orient/cases/`, checked by `tests/orient.test.mjs`.
- [x] One independent review of the contract and the corpus (the decision rule below): the critic's verdict was revise, with one wrong answer (budget-cuts), eight majors, and minors and lint gaps. All are fixed: the contract pins what two doors could read apart, 17 new cases and 13 changed ones pin it, and the lint catches 14 mutations. The critic's reference implementation, brought to the pinned rules, gives all 82 answers.
- [x] Ask the operator the §11 open question: answered 2026-10-11 (D6, wait).
- [ ] Review the cases with the operator.

## Decision rules — fixed in advance

- `agent-fan-out`: at most one independent review of the contract and the
  corpus, by one critic subagent, opened with a `doing` first. Nothing else
  spends.
- Done means: every §5.2 fixture, every §8 case and every §11 item is in the contract or the corpus; the serialization rules are pinned; the operator has reviewed the cases.

## Handoff — state at last stop

*Kept true while claimed, not written on the way out (rule 8).*

- **Last touched:** 2026-10-11, the critic's review fixed; `tests/orient.test.mjs` passes, and 14 mutations of the corpus each fail it
- **In flight:** nothing
- **On disk:** `docs/ORIENT.md`, `tests/orient/` (builder and 82 cases), `tests/orient.test.mjs`
- **Resume with:** the operator's review of the cases (a review page of all 82, story beside answer, built from the corpus 2026-10-11: https://claude.ai/artifact/SR44MUvb4w2BJeHUYMSGWu); the critic's one open question is answered (2026-10-11, the operator: keep it, §8 cuts `data.now` first, since it is data's last key and tied to no task)
- **Next decision:** the operator's, on the cases

## Result

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*
