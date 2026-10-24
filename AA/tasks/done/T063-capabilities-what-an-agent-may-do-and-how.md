---
id: T063
title: "Capabilities: what an agent may do, and how"
status: done
owner: adervark @default/906416cf 2026-10-24 — the capabilities manifest and its parity test
# type: one word; tasks of one type are timed together; `bug` counts as defect work
type: feature
# blockedReason: while blocked, one line saying what unblocks it; cleared on unblock
blockedReason: ""
depends: []
created: 2026-10-10
---

# T063 — Capabilities: what an agent may do, and how

## Goal

`GET /api/capabilities` and `board.sh --capabilities` list every action with its class (`agent-git`, `agent-read`, `operator-only`, `ui-only`), how to do it, its inputs and what it refuses.

## Context

- From T052, the agent's brain design: [`docs/plans/agent-brain.md`](../../docs/plans/agent-brain.md). §5.6. The 2026-10-10 incident: the operator could not find how to remove a repository, and nothing told an agent the endpoint existed.

## Steps

- [x] Write the manifest: `lib/capabilities.mjs`, 39 entries (11 agent-git, 15 agent-read, 1 agent-runner, 9 operator-only, 3 ui-only); `GET /api/capabilities[?for=agent]`;
      `AA/board.sh --capabilities` (and the aa-init template's copy) prints the agent-git part.
- [x] Parity test: every `data-action` in `public/` has an entry, and no `operator-only` entry is offered to agents
      (`tests/capabilities.test.mjs`; board.sh's copy is held to the manifest too).

## Decision rules — fixed in advance

- No spend applies.
- Done means: the parity test passes, and `npm test` and `npm run check` pass.

## Handoff — state at last stop

*Kept true while claimed, not written on the way out (rule 8).*

- **Last touched:** 2026-10-24, done
- **In flight:** nothing
- **On disk:** `lib/capabilities.mjs`, the route in `server.mjs`, `--capabilities` in
  `AA/board.sh` and `skills/aa-init/template/board.sh`, `tests/capabilities.test.mjs`,
  an endpoint test at the end of `tests/server.test.mjs`, two rows in `docs/PIPELINE.md`.
  `npm test` 562/562, `npm run check` clean.
- **Resume with:** nothing; delivered
- **Next decision:** for the operator, two classifications the design leaves open (Notes)

## Result

- `lib/capabilities.mjs`: 39 entries, 11 `agent-git`, 15 `agent-read`, 1
  `agent-runner`, 9 `operator-only`, 3 `ui-only`, each with how, inputs,
  refusals (and, on agent-git, what the protocol says to stop on), the
  server routes and the page actions it covers. `GET /api/capabilities`
  gives all; `?for=agent` gives what an agent may do, and what to ask the
  operator for without the how. `AA/board.sh --capabilities`, identical in
  the aa-init template, prints the agent-git part (`45c97fd`, `90aaef7`,
  `617cfde`).
- Parity, each check shown to fail when broken: every `data-action` the page
  writes or `onAction` handles has an entry and every entry's is written;
  every route in `server.mjs` has an entry and every route named answers on
  a live server; no operator-only entry reaches the agent view; board.sh's
  copy matches. The 2026-10-10 incident: stop tracking is in `askOperator`.
- Review (sonnet): changes requested, then 1–4 fixed and 5–7 fixed or
  answered on re-check. A dead `onAction` case, `open-project`, removed.
- `npm test` 564 of 564, `npm run check` clean.

**Spend:** none.

**For the operator:** two classifications, each one line (Notes): AGE Aris
projects' writes are `operator-only` for now, and the pull runner is a fifth
class, `agent-runner`.

## Notes

*(anyone may append here — the one part of a claimed file that is not the
owner's alone, rule 2)*

- 2026-10-24, adervark: **two classifications for the operator.** (1) Writes
  to AGE Aris's own projects (new task, edit task, new or edited project, the
  sample) are classed `operator-only`, the cautious reading; agent-first would
  open them to agents through the API. (2) The pull-runner endpoints
  (`POST /api/agents/:id/claim`, `/api/attempts/:id/heartbeat|complete`) are
  writes made by agents, which none of §5.6's four classes covers: they are
  classed `agent-runner`, a fifth, until the operator says otherwise. Each is
  a one-line change to the table.
- 2026-10-24, adervark: **the review (sonnet), and what changed.** Requested
  changes: pull-runner routes missing; wrong or missing inputs and refusals on
  `task-action`, `switch-task-actions`, `edit-task`, `run`, `project`,
  `track`, `brief`, `changes`; agent-git "refuses" listing rules no tool
  enforces; a parity test that missed other quote styles, subfolders and
  selectors. All fixed: inputs and refusals checked against the code (refusal
  codes from `workspace.mjs` and `tracked.mjs`), agent-git entries split into
  `refuses` (what a tool refuses) and `stops` (what the protocol says to stop
  on), and two new tests hold the manifest to `server.mjs`'s routes both
  ways, one by reading them and one by calling each on a live server. Noted,
  not changed: the full view shows operator-only `how` strings; the class is
  advice, since the token opens every endpoint, and the module says so.
