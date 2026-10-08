// Task actions: what can be done to a task, whether it can be done now, and the
// request that does it. Pure, with no DOM, so the drawer, a card menu, the
// keyboard map and the server (lib/workspace.mjs) share one answer and tests
// can import it.

export const PRIORITIES = ['low', 'medium', 'high', 'urgent'];

// `needs`: null (a click does it), 'reason' (a line; optional on AGE Aris
// projects, required on AA boards), 'result' (a required line: Done on an AA
// board whose Result is still a placeholder, see inputFor) or 'choice' (one
// value from `field`). `from` lists the columns it applies to and `to` the
// column it moves the task to; `aa` overrides the label and the columns on an
// AA board (§4 of docs/plans/task-control.md). `capability` names a flag in
// CAPABILITIES.
export const TASK_ACTIONS = [
  { id: 'start', label: 'Start', icon: 'play', key: 'c', needs: null, from: ['backlog'], to: 'in_progress', done: 'Task started', aa: { label: 'Claim', done: 'Claimed' } },
  { id: 'unblock', label: 'Unblock', icon: 'play', key: 'u', needs: null, from: ['blocked'], to: 'in_progress', done: 'Task unblocked', aa: { done: 'Unblocked' } },
  { id: 'reopen', label: 'Reopen', icon: 'back', key: 'o', needs: null, from: ['done'], to: 'in_progress', capability: 'reopen', done: 'Task reopened' },
  { id: 'block', label: 'Block', icon: 'pause', key: 'b', needs: 'reason', field: 'blockedReason', from: ['backlog', 'in_progress', 'done'], to: 'blocked', done: 'Task blocked', aa: { from: ['in_progress'], done: 'Blocked' } },
  { id: 'done', label: 'Done', icon: 'check', key: 'd', needs: null, from: ['backlog', 'in_progress', 'blocked'], to: 'done', done: 'Task done', aa: { from: ['in_progress', 'blocked'], done: 'Done' } },
  { id: 'release', label: 'Release', icon: 'back', key: 'r', needs: null, from: ['in_progress', 'blocked', 'done'], to: 'backlog', done: 'Task back in the queue', aa: { from: ['in_progress', 'blocked'], done: 'Released' } },
  { id: 'priority', label: 'Priority', icon: 'flag', key: 'p', needs: 'choice', field: 'priority', capability: 'fields', done: 'Priority set' },
  { id: 'assign', label: 'Assign', icon: 'user', key: 'a', needs: 'choice', field: 'assignee', capability: 'fields', done: 'Owner set' },
];

// What each kind of project allows. `fields` is Priority and Assign: AGE Aris
// projects keep both, and an AA board does not (AA is pull-based). `reopen`:
// AA closes a task by moving it to done/, and its protocol has no way back.
// Allowing either on AA boards later is a change to this table, not to the code
// around it.
export const CAPABILITIES = {
  native: { fields: true, reopen: true },
  aa: { fields: false, reopen: false },
};

export const WHY = {
  fields: 'AA is pull-based: claim it or leave it in the queue',
  reopen: 'AA has no reopen: a task in done/ goes back by hand, in the repository',
  tracked: 'Task actions are off for this repository: switch them on in the project header',
  other: (holder) => `${holder} holds this task: ask them to release it`,
};

export function projectKind(project) {
  return project?.linked ? 'aa' : 'native';
}

// The columns an action applies to, and its label, on this kind of project.
export function columnsFor(action, kind) {
  return (kind === 'aa' && action.aa?.from) || action.from;
}

export function labelFor(action, kind) {
  return (kind === 'aa' && action.aa?.label) || action.label;
}

// Who holds the task, as one of four kinds, from the `holder` the API sends
// (the owner line's operator, profile and session): 'unclaimed'; 'self'
// (claimed through AGE Aris by this operator); 'agent' (this operator's own
// agent session, or a claim of theirs that names none); 'other' (another
// operator).
export function holderKind(task, operator = '') {
  const holder = task.holder || {};
  if (!holder.operator) return 'unclaimed';
  if (operator && holder.operator !== operator) return 'other';
  return holder.profile === 'agesight' && holder.session === 'web' ? 'self' : 'agent';
}

function holderName(task) {
  return task.holder?.operator || 'Another operator';
}

// Taking a task into progress or blocked counts against the project's WIP limit.
function entersWip(task, action) {
  const wip = ['in_progress', 'blocked'];
  return wip.includes(action.to) && !wip.includes(task.status);
}

// Every action, in registry order, with its label here, whether it applies to
// this task's column (`relevant`), whether it can be done now (`enabled`) and,
// if not, why not. A tracked project carries `actions` ({ on, reason,
// operator }: the switch, why it is off, and the repository's operator); a
// tracked task may carry `liveRun` (a run on its trail that is live).
// `wipCount` is how many tasks the project has in progress or blocked.
export function availability(task, project, { operator = '', wipCount = 0 } = {}) {
  const kind = projectKind(project);
  const capabilities = CAPABILITIES[kind];
  const off = kind === 'aa' && !project.actions?.on ? project.actions?.reason || WHY.tracked : '';
  const held = holderKind(task, (kind === 'aa' && project.actions?.operator) || operator) === 'other';
  const wipLimit = Number.isInteger(project?.wipLimit) && project.wipLimit > 0 ? project.wipLimit : 0;
  return TASK_ACTIONS.map((action) => {
    const columns = columnsFor(action, kind);
    const relevant = columns ? columns.includes(task.status) : true;
    let why = '';
    if (!relevant) why = `Not available while the task is ${task.status.replace('_', ' ')}`;
    else if (off) why = off;
    else if (held) why = WHY.other(holderName(task));
    else if (action.capability && !capabilities[action.capability]) why = WHY[action.capability];
    else if (kind === 'aa' && task.liveRun) why = `${task.liveRun.text} Every action waits for it to end.`;
    else if (wipLimit && wipCount >= wipLimit && entersWip(task, action)) why = `WIP limit of ${wipLimit} reached: finish or release something first`;
    return { id: action.id, label: labelFor(action, kind), relevant, enabled: !why, why };
  });
}

// What an action asks for before it is sent, or null: { needs, field,
// required }. Block's reason is required on an AA board; Done there asks for a
// Result line while the task's Result is a placeholder (`resultPending`).
export function inputFor(id, task, project) {
  const action = TASK_ACTIONS.find((entry) => entry.id === id);
  const aa = projectKind(project) === 'aa';
  if (id === 'done') return aa && task.resultPending ? { needs: 'result', field: 'result', required: true } : null;
  if (!action?.needs) return null;
  return { needs: action.needs, field: action.field, required: aa && action.needs === 'reason' };
}

// The action that moves a task from one column to another, if there is one.
export function actionFor(from, to, kind = 'native') {
  return TASK_ACTIONS.find((action) => action.to === to && columnsFor(action, kind)?.includes(from) && (kind !== 'aa' || !action.capability || CAPABILITIES.aa[action.capability])) || null;
}

// The API request for an action. On an AGE Aris project: PATCH /api/tasks/:id,
// which takes partial bodies and the task's `version`. On an AA board: POST
// /api/tasks/:id/actions, with the `confirm` token a confirmation returned.
// Throws on input the action cannot take.
export function actionRequest(id, task, input = '', project = null, { confirm } = {}) {
  const action = TASK_ACTIONS.find((entry) => entry.id === id);
  if (!action) throw new Error(`Unknown action ${id}`);
  const text = String(input ?? '').trim();
  if (projectKind(project) === 'aa') {
    const body = { action: id === 'start' ? 'claim' : id, version: task.version };
    if (id === 'block') body.reason = text;
    if (id === 'done' && text) body.result = text;
    if (confirm) body.confirm = confirm;
    return { method: 'POST', path: `/tasks/${encodeURIComponent(task.id)}/actions`, body };
  }
  let body;
  if (action.to) body = { status: action.to, ...(id === 'block' ? { blockedReason: text } : {}) };
  else if (id === 'priority') {
    if (!PRIORITIES.includes(text)) throw new Error('Choose low, medium, high or urgent.');
    body = { priority: text };
  } else body = { assignee: text };
  return { method: 'PATCH', path: `/tasks/${encodeURIComponent(task.id)}`, body: { ...body, version: task.version } };
}
