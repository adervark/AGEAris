// What an agent may do with AGE Aris and an AA board, and how (the agent's
// brain design, docs/plans/agent-brain.md §5.6). Every action is one entry:
//
//   agent-git      a board or git command in the repository; needs no AGE Aris
//   agent-read     a read endpoint of AGE Aris, with the API token
//   operator-only  the operator does it, in AGE Aris; an agent asks them to
//   ui-only        layout and navigation, with nothing to do outside the page
//
// `how` is the command or the endpoint, `inputs` what it takes, `refuses`
// when it is refused, and `ui` the page's `data-action`s that do it, so a
// test can hold the page and this table together. An operator-only entry is
// never offered to an agent as something it can do: its `ask` says what to
// ask the operator for, and `instead` names the agent's own way, when there is
// one. The agent-git entries are also printed by `AA/board.sh --capabilities`,
// which a test keeps identical to them.

export const SCHEMA = 'aa.capabilities/1';
export const CLASSES = ['agent-git', 'agent-read', 'operator-only', 'ui-only'];

const RULE_1 = 'the commit conflicts: someone else has it (rule 1)';
const RULE_2 = 'another operator holds the task (rule 2)';
const LOCK = 'a run on the task is live (`AA/ckpt.sh live T`): keep off unless it is yours (rule 6)';

export const CAPABILITIES = [
  // ---- agent-git: the AA protocol, done with git in the repository
  {
    id: 'board', class: 'agent-git',
    how: 'AA/board.sh [--all]',
    inputs: [], refuses: [], ui: [],
  },
  {
    id: 'state', class: 'agent-git',
    how: 'AA/board.sh --write, then commit AA/STATE.md (rule 11)',
    inputs: [], refuses: ['--check exits 1 while the generated region is stale'], ui: [],
  },
  {
    id: 'register', class: 'agent-git',
    how: 'a new file AA/backlog/<next id>-<slug>.md, shaped as the other task files are (aa-init\'s TASK.md), its decision rules written before it can be claimed; commit (rules 5, 12)',
    inputs: ['title', 'goal', 'decision rules'], refuses: [], ui: [],
  },
  {
    id: 'claim', class: 'agent-git',
    how: 'git mv AA/backlog/T-*.md AA/tasks/; set status: claimed and owner: <operator> @<profile>/<session> <date> — <note>; commit "claim T" (rule 1)',
    inputs: ['task', 'note'],
    refuses: ['the WIP limit is reached (rule 10)', 'the task has no decision rules (rule 5)', RULE_1, RULE_2],
    ui: [],
  },
  {
    id: 'checkpoint', class: 'agent-git',
    how: 'AA/ckpt.sh open T, then AA/ckpt.sh log T doing|did|blocked|end … before and after each spend (rule 6)',
    inputs: ['task', 'kind', 'what', 'next'], refuses: ['a task id that is not one', LOCK], ui: [],
  },
  {
    id: 'live', class: 'agent-git',
    how: 'AA/ckpt.sh live [T]',
    inputs: ['task'], refuses: [], ui: [],
  },
  {
    id: 'block', class: 'agent-git',
    how: 'set status: blocked and blockedReason: <what unblocks it> in AA/tasks/T-*.md; commit',
    inputs: ['task', 'reason'], refuses: [RULE_2], ui: [],
  },
  {
    id: 'unblock', class: 'agent-git',
    how: 'set status: claimed and clear blockedReason in AA/tasks/T-*.md; commit',
    inputs: ['task'], refuses: [RULE_2], ui: [],
  },
  {
    id: 'release', class: 'agent-git',
    how: 'git mv AA/tasks/T-*.md AA/backlog/; set status: open and owner: —; commit "release T" (rule 4)',
    inputs: ['task'], refuses: [RULE_2, LOCK], ui: [],
  },
  {
    id: 'done', class: 'agent-git',
    how: 'fill ## Result, with AA/ckpt.sh close T --delete\'s digest when T has a trail; git mv AA/tasks/T-*.md AA/tasks/done/, set status: done; commit',
    inputs: ['task', 'result'], refuses: [RULE_2, 'the Result is empty or a placeholder'], ui: [],
  },
  {
    id: 'kill', class: 'agent-git',
    how: 'say why in ## Result, git mv the task file to AA/tasks/done/, set status: killed; commit',
    inputs: ['task', 'reason'], refuses: [RULE_2], ui: [],
  },

  // ---- agent-read: AGE Aris's read endpoints, with the X-AGEAris-Token header
  { id: 'orient', class: 'agent-read', how: 'GET /api/orient?project=<id>', inputs: ['project', 'operator', 'run', 'task', 'asOf', 'budget', 'remote'], refuses: ['a malformed input (400)', 'an unknown project (404)', 'a repository without a board (404)'], ui: [] },
  { id: 'capabilities', class: 'agent-read', how: 'GET /api/capabilities[?for=agent]', inputs: ['for'], refuses: [], ui: [] },
  { id: 'workspace', class: 'agent-read', how: 'GET /api/workspace', inputs: [], refuses: [], ui: [] },
  { id: 'settings', class: 'agent-read', how: 'GET /api/settings', inputs: [], refuses: [], ui: [] },
  { id: 'brief', class: 'agent-read', how: 'GET /api/brief', inputs: ['asOf', 'window', 'since', 'sinceHeads'], refuses: ['asOf in the future (400)'], ui: [] },
  { id: 'changes', class: 'agent-read', how: 'GET /api/changes', inputs: ['projectId', 'since', 'kinds', 'limit'], refuses: [], ui: [] },
  { id: 'metrics', class: 'agent-read', how: 'GET /api/projects/<id>/metrics', inputs: ['project', 'asOf'], refuses: ['an unknown project (404)'], ui: [] },
  { id: 'explain', class: 'agent-read', how: 'GET /api/explain/<metric>', inputs: ['metric', 'projectId', 'taskKey', 'asOf'], refuses: ['an unknown metric (404)'], ui: ['explain'] },
  { id: 'task', class: 'agent-read', how: 'GET /api/tasks/<project>:<T>', inputs: ['task'], refuses: ['an unknown task (404)'], ui: ['open-task'] },
  { id: 'task-history', class: 'agent-read', how: 'GET /api/tasks/<project>:<T>/history', inputs: ['task'], refuses: ['an unknown task (404)'], ui: [] },
  { id: 'method', class: 'agent-read', how: 'GET /api/projects/<id>/method', inputs: ['project'], refuses: ['an unknown project (404)'], ui: [] },
  { id: 'pipeline', class: 'agent-read', how: 'GET /api/projects/<id>/pipeline', inputs: ['project'], refuses: ['an unknown project (404)'], ui: [] },
  { id: 'runs', class: 'agent-read', how: 'GET /api/runs, GET /api/runs/<id>, GET /api/runs/<id>/audit', inputs: ['run'], refuses: ['an unknown run (404)'], ui: ['open-run'] },
  { id: 'limits', class: 'agent-read', how: 'GET /api/limits[?refresh=1]', inputs: ['refresh'], refuses: [], ui: ['read-limits'] },
  { id: 'agents', class: 'agent-read', how: 'GET /api/agents', inputs: [], refuses: [], ui: ['agents-tab'] },

  // ---- operator-only: the operator does these in AGE Aris
  {
    id: 'task-action', class: 'operator-only',
    how: 'POST /api/tasks/<project>:<T>/actions, from a task\'s drawer',
    ask: 'ask the operator to claim, block, unblock, finish or release the task in AGE Aris', instead: 'claim',
    inputs: ['task', 'action', 'input'],
    refuses: ['task actions are off for the repository', 'the branch is not the pinned one, or a merge or rebase is in progress', 'the task file is not clean and committed', RULE_2, LOCK, 'the WIP limit is reached'],
    ui: ['act', 'act-confirm'],
  },
  {
    id: 'switch-task-actions', class: 'operator-only',
    how: 'PATCH /api/projects/<id> {taskActions: {on}}, from the project header',
    ask: 'ask the operator to switch task actions on or off for the repository',
    inputs: ['project', 'on'], refuses: ['the project is not a tracked repository', 'the branch cannot be pinned'], ui: ['task-actions'],
  },
  {
    id: 'track', class: 'operator-only',
    how: 'POST /api/projects/link {path, name}, or /aa link',
    ask: 'ask the operator to track the repository in AGE Aris',
    inputs: ['path', 'name'], refuses: ['the path is not a full path to a git repository', 'it is already tracked', 'AGE Aris\'s data folder is inside it, or it is inside the data folder'], ui: ['link-project'],
  },
  {
    id: 'stop-tracking', class: 'operator-only',
    how: 'DELETE /api/projects/<id>, from the project header: Stop tracking. The repository is not touched',
    ask: 'ask the operator to stop tracking the repository',
    inputs: ['project'], refuses: ['the project is AGE Aris\'s own, not a tracked repository'], ui: ['unlink-project'],
  },
  {
    id: 'project', class: 'operator-only',
    how: 'POST /api/projects, PATCH /api/projects/<id>, POST /api/projects/sample',
    ask: 'ask the operator to make or change an AGE Aris project',
    inputs: ['name', 'wipLimit'], refuses: ['a stale version (409)'], ui: ['new-project', 'edit-project', 'sample-project'],
  },
  {
    id: 'edit-task', class: 'operator-only',
    how: 'POST /api/tasks, PATCH /api/tasks/<project>:<T>, on an AGE Aris project',
    ask: 'ask the operator to add or edit the task in AGE Aris', instead: 'register',
    inputs: ['project', 'title', 'fields'], refuses: ['a tracked repository: its board is changed with git (409)', 'a stale version (409)'], ui: ['new-task'],
  },
  {
    id: 'edit-pipeline', class: 'operator-only',
    how: 'PUT /api/projects/<id>/pipeline',
    ask: 'ask the operator to change the project\'s pipeline',
    inputs: ['project', 'stages'], refuses: ['a stage that is not valid (400)'], ui: ['edit-pipeline'],
  },
  {
    id: 'run', class: 'operator-only',
    how: 'POST /api/runs {taskId}, POST /api/runs/<id>/actions',
    ask: 'ask the operator to start, approve, send back, reassign or cancel the run',
    inputs: ['task', 'action', 'comment'], refuses: ['a run is already active on the task', 'the stage waits on another decision first (409)'],
    ui: ['approve', 'run-act', 'reassign', 'cancel-run', 'close-run', 'inbox-approve'],
  },
  {
    id: 'agent-registry', class: 'operator-only',
    how: 'POST /api/agents, PATCH /api/agents/<id>',
    ask: 'ask the operator to add or change an agent in the registry',
    inputs: ['name', 'command', 'roles'], refuses: ['an agent that is not valid (400)'], ui: ['add-agent', 'edit-agent'],
  },

  // ---- ui-only: the page's own layout and navigation
  { id: 'layout', class: 'ui-only', how: 'the page', inputs: [], refuses: [], ui: ['layout', 'clear-filters', 'toggle-delta', 'add-project', 'copy-path', 'focus-comment'] },
  { id: 'seen', class: 'ui-only', how: 'the page; the browser keeps the cursor', inputs: [], refuses: [], ui: ['mark-seen'] },
  { id: 'decision-form', class: 'ui-only', how: 'the page; the decision itself is `run`', inputs: [], refuses: [], ui: ['decision-mode', 'more-options', 'inbox-toggle', 'inbox-mode', 'act-cancel'] },
];

// The table for a reader: everything, or for an agent only what it may do
// itself, with what to ask the operator for kept apart.
export function capabilities({ for: reader } = {}) {
  if (reader === 'agent') {
    return {
      schema: SCHEMA,
      may: CAPABILITIES.filter((entry) => entry.class === 'agent-git' || entry.class === 'agent-read').map(({ ui, ...entry }) => entry),
      askOperator: CAPABILITIES.filter((entry) => entry.class === 'operator-only').map(({ id, ask, instead }) => ({ id, ask, ...(instead ? { instead } : {}) })),
    };
  }
  return { schema: SCHEMA, capabilities: CAPABILITIES };
}

// The agent-git entries as `AA/board.sh --capabilities` prints them: one line
// each, its id, class, how, inputs and refusals separated by tabs, the lists
// joined by "; ".
export function boardLines() {
  return CAPABILITIES.filter((entry) => entry.class === 'agent-git')
    .map((entry) => [entry.id, entry.class, entry.how, entry.inputs.join('; '), entry.refuses.join('; ')].join('\t'))
    .join('\n');
}
