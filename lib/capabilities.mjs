// What an agent may do with AGE Aris and an AA board, and how (the agent's
// brain design, docs/plans/agent-brain.md §5.6). Every action is one entry:
//
//   agent-git      a board or git command in the repository; needs no AGE Aris
//   agent-read     a read endpoint of AGE Aris, with the API token
//   agent-runner   the pull runner's writes: an agent registered to take a
//                  pipeline's work claims an attempt and reports on it
//   operator-only  the operator does it, in AGE Aris; an agent asks them to
//   ui-only        layout and navigation, with nothing to do outside the page
//
// `how` is the command or the endpoint and `inputs` what it takes. `refuses`
// is what the tool or the server refuses, and `stops`, on agent-git entries,
// what the protocol says to stop on though git itself would not. `routes` are
// the server's routes it covers and `ui` the page's `data-action`s, so tests
// hold the server, the page and this table together. An operator-only entry is
// never offered to an agent as something it can do: its `ask` says what to ask
// the operator for, and `instead` names the agent's own way, when there is one.
// The class is advice, not a lock: the API token opens every endpoint. The
// agent-git entries are also printed by `AA/board.sh --capabilities`, which a
// test keeps identical to them.

export const SCHEMA = 'aa.capabilities/1';
export const CLASSES = ['agent-git', 'agent-read', 'agent-runner', 'operator-only', 'ui-only'];
export const AGENT_CLASSES = ['agent-git', 'agent-read', 'agent-runner'];

const HELD = 'another operator holds the task (rule 2)';
const LIVE = 'a run on the task is live (AA/ckpt.sh live T): keep off unless it is yours (rule 6)';
const CONFLICT = 'the commit conflicts: someone else has it (rule 1)';
const STALE = 'a stale version (409)';
const INACTIVE = 'the project is deprecated or archived: restore it first (PROJECT_INACTIVE)';
const UNKNOWN_PROJECT = 'an unknown project (404)';

const git = (id, how, inputs, { refuses = [], stops = [] } = {}) => ({ id, class: 'agent-git', how, inputs, refuses, stops, routes: [], ui: [] });
const read = (id, routes, inputs, refuses = [], ui = []) => ({ id, class: 'agent-read', how: routes.join(', '), inputs, refuses, routes, ui });

export const CAPABILITIES = [
  // ---- agent-git: the AA protocol, done with git in the repository
  git('board', 'AA/board.sh [--all]', []),
  git('state', 'AA/board.sh --write, then commit AA/STATE.md (rule 11)', [], { refuses: ['--check exits 1 while the generated region is stale'] }),
  git('register', 'a new file AA/backlog/<next id>-<slug>.md, shaped as the other task files are (aa-init\'s TASK.md), its decision rules written before it can be claimed; commit (rules 5, 12)', ['title', 'goal', 'decision rules']),
  git('claim', 'git mv AA/backlog/T-*.md AA/tasks/; set status: claimed and owner: <operator> @<profile>/<session> <date> — <note>; commit "claim T" (rule 1)', ['task', 'note'], {
    refuses: [CONFLICT],
    stops: ['the WIP limit is reached (rule 10)', 'the task has no decision rules (rule 5)', HELD, LIVE],
  }),
  git('checkpoint', 'AA/ckpt.sh open T, then AA/ckpt.sh log T doing|did|blocked|end … before and after each spend (rule 6)', ['task', 'kind', 'what', 'next'], {
    refuses: ['a task id that is not one'], stops: [LIVE],
  }),
  git('live', 'AA/ckpt.sh live [T]', ['task']),
  git('block', 'set status: blocked and blockedReason: <what unblocks it> in AA/tasks/T-*.md; commit', ['task', 'reason'], { stops: [HELD] }),
  git('unblock', 'set status: claimed and clear blockedReason in AA/tasks/T-*.md; commit', ['task'], { stops: [HELD] }),
  git('release', 'git mv AA/tasks/T-*.md AA/backlog/; set status: open and owner: —; commit "release T" (rule 4)', ['task'], { refuses: [CONFLICT], stops: [HELD, LIVE] }),
  git('done', 'fill ## Result, with AA/ckpt.sh close T --delete\'s digest when T has a trail; git mv AA/tasks/T-*.md AA/tasks/done/, set status: done; commit; then AA/ckpt.sh release T (rule 13: its scratch, landed worktrees and merged branches go; keeps: files are committed first)', ['task', 'result'], {
    refuses: ['ckpt.sh close: T has no trail'], stops: [HELD, 'the Result is empty or a placeholder'],
  }),
  git('kill', 'say why in ## Result, git mv the task file to AA/tasks/done/, set status: killed; commit', ['task', 'reason'], { stops: [HELD] }),

  // ---- agent-read: AGE Aris's read endpoints, with the X-AGEAris-Token header
  read('orient', ['GET /api/orient'], ['project', 'operator', 'run', 'task', 'asOf', 'budget', 'remote'], ['a malformed input (400)', UNKNOWN_PROJECT, 'a repository without a board (404)']),
  read('capabilities', ['GET /api/capabilities'], ['for'], ['for other than agent (400)']),
  read('workspace', ['GET /api/workspace'], []),
  read('settings', ['GET /api/settings'], []),
  read('brief', ['GET /api/brief'], ['asOf', 'window', 'since', 'sinceHeads'], ['a malformed asOf, window, since or sinceHeads, or an asOf in the future (400)']),
  read('changes', ['GET /api/changes'], ['projectId', 'since', 'kinds', 'limit'], ['a malformed since, kinds or limit (400)']),
  read('metrics', ['GET /api/projects/:id/metrics'], ['project', 'asOf'], [UNKNOWN_PROJECT]),
  read('explain', ['GET /api/explain/:metric'], ['metric', 'projectId', 'taskKey', 'asOf'], ['an unknown metric (404)'], ['explain']),
  read('task', ['GET /api/tasks/:id'], ['task'], ['an unknown task (404)'], ['open-task']),
  read('task-history', ['GET /api/tasks/:id/history'], ['task'], ['an unknown task (404)']),
  read('method', ['GET /api/projects/:id/method'], ['project'], [UNKNOWN_PROJECT]),
  read('pipeline', ['GET /api/projects/:id/pipeline'], ['project'], [UNKNOWN_PROJECT]),
  read('runs', ['GET /api/runs', 'GET /api/runs/:id', 'GET /api/runs/:id/audit'], ['run'], ['an unknown run (404)'], ['open-run']),
  read('limits', ['GET /api/limits'], ['refresh'], [], ['read-limits']),
  read('agents', ['GET /api/agents'], [], [], ['agents-tab']),

  // ---- agent-runner: the pull runner (docs/PIPELINE.md)
  {
    id: 'pull-work', class: 'agent-runner',
    how: 'POST /api/agents/:id/claim, then POST /api/attempts/:attempt/heartbeat while working and POST /api/attempts/:attempt/complete with the result',
    inputs: ['agent', 'attempt', 'agentId', 'outcome', 'output', 'error'],
    refuses: ['an agent that is not a pull agent (400)', 'an unknown agent (404)', 'a disabled agent (409)', 'an unknown attempt (404)', 'an attempt that belongs to another agent (403)', 'an outcome other than succeeded or failed (400)', 'the lease has ended: claim the work again (409)', 'the attempt is no longer running (409)'],
    routes: ['POST /api/agents/:id/claim', 'POST /api/attempts/:id/heartbeat', 'POST /api/attempts/:id/complete'], ui: [],
  },

  // ---- operator-only: the operator does these in AGE Aris
  {
    id: 'task-action', class: 'operator-only',
    how: 'POST /api/tasks/:id/actions, from a task\'s drawer, its card\'s or row\'s menu, its keys (c b u o d r p a) or a drag',
    ask: 'ask the operator to claim, block, unblock, finish or release the task in AGE Aris', instead: 'claim',
    inputs: ['task', 'action', 'version', 'reason', 'result', 'value', 'confirm'],
    refuses: [
      'task actions are off for the repository (ACTIONS_OFF)', 'a deaddrop/ or pm/ board (LEGACY_BOARD)', 'an action that does not apply to the task\'s column or kind (NOT_ALLOWED)',
      'no version, or a malformed reason, result or value (BAD_INPUT)', 'the branch is not the pinned one (WRONG_BRANCH)', 'a merge, rebase or git lock in progress (GIT_BUSY)',
      'the task file is not committed or not clean (NOT_COMMITTED, DIRTY_FILE)', 'two files have the id (DUPLICATE_ID)', `${HELD} (HELD_BY_OTHER)`,
      'a run on the task is live (RUN_LIVE)', 'the WIP limit is reached (WIP_LIMIT)', INACTIVE, 'a confirmation is needed first: send it back with confirm (CONFIRM)', 'the task changed meanwhile (STALE)',
    ],
    routes: ['POST /api/tasks/:id/actions'], ui: ['act', 'act-confirm', 'task-menu'],
  },
  {
    id: 'switch-task-actions', class: 'operator-only',
    how: 'PATCH /api/projects/:id {version, taskActions: {on}}, from the project header',
    ask: 'ask the operator to switch task actions on or off for the repository',
    inputs: ['project', 'version', 'on', 'confirm'],
    refuses: ['no version (BAD_INPUT)', 'the project changed meanwhile (STALE)', 'AGEARIS_TRACKED_WRITES=0 (ACTIONS_OFF)', 'a deaddrop/ or pm/ board (LEGACY_BOARD)', 'git user.name is not set in the repository (NO_IDENTITY)', 'a confirmation is needed first: send it back with confirm (CONFIRM)', INACTIVE],
    routes: [], ui: ['task-actions'],
  },
  {
    id: 'project-lifecycle', class: 'operator-only',
    how: 'PATCH /api/projects/:id {version, lifecycle: {state: active|deprecated|archived, reason, successor}}, from the project header: Deprecate, Archive, Restore. Only AGE Aris\'s project.json changes, and nothing is deleted',
    ask: 'ask the operator to deprecate, archive or restore the project',
    inputs: ['project', 'version', 'state', 'reason', 'successor', 'confirm'],
    refuses: ['a state other than active, deprecated or archived, a reason over 200 characters, or a successor that is not another active project (BAD_INPUT)', 'the project changed meanwhile (STALE)', 'a run on the project is still going: finish or cancel it first (RUNS_ACTIVE)', 'deprecating or archiving needs a confirmation first: send it back with confirm (CONFIRM)', UNKNOWN_PROJECT],
    routes: [], ui: ['deprecate-project', 'archive-project', 'restore-project'],
  },
  {
    id: 'track', class: 'operator-only',
    how: 'POST /api/projects/link {path, name}, or /aa link',
    ask: 'ask the operator to track the repository in AGE Aris',
    inputs: ['path', 'name', 'description', 'color'],
    refuses: [
      'not a full path to a folder (400)', 'not a git repository, or a folder inside one (400)', 'a worktree or submodule (400)', 'no commits yet, or a partial clone (400)',
      'no task board (400)', 'AGE Aris\'s data folder is inside it, or it is inside the data folder (400)', 'it is already tracked (409)',
    ],
    routes: ['POST /api/projects/link'], ui: ['link-project'],
  },
  {
    id: 'stop-tracking', class: 'operator-only',
    how: 'DELETE /api/projects/:id, from the project header: Stop tracking. The repository is not touched',
    ask: 'ask the operator to stop tracking the repository',
    inputs: ['project'], refuses: ['an AGE Aris project, which is never deleted here (409)', UNKNOWN_PROJECT],
    routes: ['DELETE /api/projects/:id'], ui: ['unlink-project'],
  },
  {
    id: 'project', class: 'operator-only',
    how: 'POST /api/projects, PATCH /api/projects/:id, POST /api/projects/sample',
    ask: 'ask the operator to make or change an AGE Aris project',
    inputs: ['name', 'description', 'color', 'wipLimit', 'version'], refuses: ['no version on a change (400)', STALE, 'a field that is not valid (400)', INACTIVE],
    routes: ['POST /api/projects', 'PATCH /api/projects/:id', 'POST /api/projects/sample'], ui: ['new-project', 'edit-project', 'sample-project'],
  },
  {
    id: 'edit-task', class: 'operator-only',
    how: 'POST /api/tasks, PATCH /api/tasks/:id, on an AGE Aris project',
    ask: 'ask the operator to add or edit the task in AGE Aris', instead: 'register',
    inputs: ['projectId', 'title', 'description', 'status', 'priority', 'assignee', 'dueDate', 'type', 'version'],
    refuses: ['a tracked repository: its board is changed with git (409)', 'the WIP limit is reached (409)', STALE, 'a field that is not valid (400)', INACTIVE],
    routes: ['POST /api/tasks', 'PATCH /api/tasks/:id'], ui: ['new-task'],
  },
  {
    id: 'edit-pipeline', class: 'operator-only',
    how: 'PUT /api/projects/:id/pipeline {stages, version}',
    ask: 'ask the operator to change the project\'s pipeline',
    inputs: ['project', 'stages', 'version'], refuses: ['a stage that is not valid (400)', STALE, INACTIVE],
    routes: ['PUT /api/projects/:id/pipeline'], ui: ['edit-pipeline'],
  },
  {
    id: 'run', class: 'operator-only',
    how: 'POST /api/runs {taskId}, POST /api/runs/:id/actions {action, expectedSeq, …}',
    ask: 'ask the operator to start, approve, send back, reassign or cancel the run',
    inputs: ['taskId', 'action', 'expectedSeq', 'comment'],
    refuses: ['a run is already active on the task (409)', 'expectedSeq is not the run\'s lastSeq (409)', 'the stage waits on another decision first (409)', `a new run: ${INACTIVE}`],
    routes: ['POST /api/runs', 'POST /api/runs/:id/actions'],
    ui: ['approve', 'run-act', 'reassign', 'cancel-run', 'close-run', 'inbox-approve'],
  },
  {
    id: 'agent-registry', class: 'operator-only',
    how: 'POST /api/agents, PATCH /api/agents/:id {version, …}',
    ask: 'ask the operator to add or change an agent in the registry',
    inputs: ['name', 'command', 'roles', 'version'], refuses: ['an agent that is not valid (400)', STALE],
    routes: ['POST /api/agents', 'PATCH /api/agents/:id'], ui: ['add-agent', 'edit-agent'],
  },

  // ---- ui-only: the page's own layout and navigation
  { id: 'layout', class: 'ui-only', how: 'the page', inputs: [], refuses: [], routes: [], ui: ['layout', 'clear-filters', 'toggle-delta', 'add-project', 'copy-path', 'focus-comment'] },
  { id: 'seen', class: 'ui-only', how: 'the page; the browser keeps the cursor', inputs: [], refuses: [], routes: [], ui: ['mark-seen'] },
  { id: 'decision-form', class: 'ui-only', how: 'the page; the decision itself is run', inputs: [], refuses: [], routes: [], ui: ['decision-mode', 'more-options', 'inbox-toggle', 'inbox-mode', 'act-cancel'] },
];

// The table for a reader: everything, or for an agent only what it may do
// itself, with what to ask the operator for kept apart.
export function capabilities({ for: reader } = {}) {
  if (reader === 'agent') {
    return {
      schema: SCHEMA,
      may: CAPABILITIES.filter((entry) => AGENT_CLASSES.includes(entry.class)).map(({ ui, ...entry }) => entry),
      askOperator: CAPABILITIES.filter((entry) => entry.class === 'operator-only').map(({ id, ask, instead }) => ({ id, ask, ...(instead ? { instead } : {}) })),
    };
  }
  return { schema: SCHEMA, capabilities: CAPABILITIES };
}

// The agent-git entries as `AA/board.sh --capabilities` prints them: one line
// each, its id, class, how, inputs, refusals and stops separated by tabs, the
// lists joined by "; ".
export function boardLines() {
  return CAPABILITIES.filter((entry) => entry.class === 'agent-git')
    .map((entry) => [entry.id, entry.class, entry.how, entry.inputs.join('; '), entry.refuses.join('; '), entry.stops.join('; ')].join('\t'))
    .join('\n');
}
