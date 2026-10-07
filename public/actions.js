// Task actions: what can be done to a task, whether it can be done now, and the
// request that does it. Pure, with no DOM, so the drawer, a card menu and the
// keyboard map can share one answer and tests can import it.

export const PRIORITIES = ['low', 'medium', 'high', 'urgent'];

// `needs`: null (a click does it), 'reason' (an optional line), 'result' (a
// required line; tracked boards only, so no AGE Aris action asks for it yet) or
// 'choice' (one value from `field`). `from` lists the columns it applies to and
// `to` the column it moves the task to. `capability` names a flag in CAPABILITIES.
export const TASK_ACTIONS = [
  { id: 'start', label: 'Start', icon: 'play', key: 'c', needs: null, from: ['backlog'], to: 'in_progress', done: 'Task started' },
  { id: 'unblock', label: 'Unblock', icon: 'play', key: 'u', needs: null, from: ['blocked'], to: 'in_progress', done: 'Task unblocked' },
  { id: 'reopen', label: 'Reopen', icon: 'back', key: 'o', needs: null, from: ['done'], to: 'in_progress', done: 'Task reopened' },
  { id: 'block', label: 'Block', icon: 'pause', key: 'b', needs: 'reason', field: 'blockedReason', from: ['backlog', 'in_progress', 'done'], to: 'blocked', done: 'Task blocked' },
  { id: 'done', label: 'Done', icon: 'check', key: 'd', needs: null, from: ['backlog', 'in_progress', 'blocked'], to: 'done', done: 'Task done' },
  { id: 'release', label: 'Release', icon: 'back', key: 'r', needs: null, from: ['in_progress', 'blocked', 'done'], to: 'backlog', done: 'Task back in the queue' },
  { id: 'priority', label: 'Priority', icon: 'flag', key: 'p', needs: 'choice', field: 'priority', capability: 'fields', done: 'Priority set' },
  { id: 'assign', label: 'Assign', icon: 'user', key: 'a', needs: 'choice', field: 'assignee', capability: 'fields', done: 'Owner set' },
];

// What each kind of project allows. `fields` is Priority and Assign: AGE Aris
// projects keep both, and an AA board does not (AA is pull-based). Allowing them
// on AA boards later is a change to this table, not to the code around it.
export const CAPABILITIES = {
  native: { fields: true },
  aa: { fields: false },
};

export const WHY = {
  fields: 'AA is pull-based: claim it or leave it in the queue',
  tracked: 'AGE Aris only reads this repository until task actions are switched on for it',
  other: (holder) => `${holder} holds this task: ask them to release it`,
};

export function projectKind(project) {
  return project?.linked ? 'aa' : 'native';
}

// Who holds the task, as one of four kinds: 'unclaimed'; 'self' (claimed through
// AGE Aris by this operator); 'agent' (this operator's own agent session);
// 'other' (another operator).
export function holderKind(task, operator = '') {
  const holder = task.holder;
  if (holder && (holder.operator || holder.profile)) {
    if (holder.operator && operator && holder.operator !== operator) return 'other';
    return holder.profile === 'agesight' && holder.session === 'web' ? 'self' : 'agent';
  }
  const claim = String(task.claim || '');
  if (!claim) return 'unclaimed';
  const name = claim.slice(0, claim.indexOf(' @') >= 0 ? claim.indexOf(' @') : claim.length).trim();
  return operator && name && name !== operator ? 'other' : 'agent';
}

function holderName(task) {
  return task.holder?.operator || String(task.claim || '').split(' @')[0] || 'Another operator';
}

// Taking a task into progress or blocked counts against the project's WIP limit.
function entersWip(task, action) {
  const wip = ['in_progress', 'blocked'];
  return wip.includes(action.to) && !wip.includes(task.status);
}

// Every action, in registry order, with whether it applies to this task's column
// (`relevant`), whether it can be done now (`enabled`) and, if not, why not.
// `project` may carry `trackedWrites` (the switch) and `backlogFolder` (the
// layout); `wipCount` is how many tasks the project has in progress or blocked.
export function availability(task, project, { operator = '', wipCount = 0 } = {}) {
  const kind = projectKind(project);
  const capabilities = CAPABILITIES[kind];
  const held = holderKind(task, operator) === 'other';
  const wipLimit = Number.isInteger(project?.wipLimit) && project.wipLimit > 0 && kind === 'native' ? project.wipLimit : 0;
  return TASK_ACTIONS.map((action) => {
    const relevant = action.from ? action.from.includes(task.status) : true;
    let why = '';
    if (!relevant) why = `Not available while the task is ${task.status.replace('_', ' ')}`;
    else if (kind === 'aa' && !project.trackedWrites) why = WHY.tracked;
    else if (held) why = WHY.other(holderName(task));
    else if (action.capability && !capabilities[action.capability]) why = WHY[action.capability];
    else if (wipLimit && wipCount >= wipLimit && entersWip(task, action)) why = `WIP limit of ${wipLimit} reached: finish or release something first`;
    return { id: action.id, relevant, enabled: !why, why };
  });
}

// The action that moves a task from one column to another, if there is one.
export function actionFor(from, to) {
  return TASK_ACTIONS.find((action) => action.to === to && action.from?.includes(from)) || null;
}

// The API request for an action on an AGE Aris project: PATCH /api/tasks/:id,
// which takes partial bodies and the task's `version`. Throws on input the
// action cannot take.
export function actionRequest(id, task, input = '') {
  const action = TASK_ACTIONS.find((entry) => entry.id === id);
  if (!action) throw new Error(`Unknown action ${id}`);
  const text = String(input ?? '').trim();
  let body;
  if (action.to) body = { status: action.to, ...(id === 'block' ? { blockedReason: text } : {}) };
  else if (id === 'priority') {
    if (!PRIORITIES.includes(text)) throw new Error('Choose low, medium, high or urgent.');
    body = { priority: text };
  } else body = { assignee: text };
  return { method: 'PATCH', path: `/tasks/${encodeURIComponent(task.id)}`, body: { ...body, version: task.version } };
}
