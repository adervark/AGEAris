import { decisionsSummary, escape, healthDot, renderChanges, renderExplain, renderHealth, renderHistory, renderToday } from './cockpit.js';
import { briefQuery, cursorFromBrief, readWindow, writeCursor, writeWindow } from './cursor.js';
import { icon } from './icons.js';

const $ = (selector) => document.querySelector(selector);
const statuses = { backlog: 'Backlog', in_progress: 'In progress', blocked: 'Blocked', done: 'Done' };
const priorities = { low: 'Low', medium: 'Medium', high: 'High', urgent: 'Urgent' };
const colors = ['blue', 'violet', 'teal', 'amber', 'rose'];
const colorHex = { blue: '#3265df', violet: '#7c5ce0', teal: '#229b89', amber: '#db9c27', rose: '#d86783' };
const ROLES = ['triage', 'plan', 'implement', 'review', 'verify'];
const TIERS = ['haiku', 'sonnet', 'opus'];
const TERMINAL = ['completed', 'failed', 'cancelled'];
const runStatuses = { running: 'Running', waiting: 'Waiting for an agent', awaiting_approval: 'Needs approval', awaiting_input: 'Needs your input', failed: 'Failed', cancelled: 'Cancelled', completed: 'Completed' };
const stageStatuses = { done: 'Done', active: 'Running', awaiting_approval: 'Needs approval', awaiting_input: 'Needs input', waiting: 'No agent', failed: 'Failed', cancelled: 'Cancelled', pending: 'Not started' };
const attemptStatuses = { queued: 'Queued', running: 'Running', awaiting_input: 'Waiting for a person', succeeded: 'Succeeded', failed: 'Failed', awaiting_approval: 'Awaiting approval', approved: 'Approved', rejected: 'Changes requested', cancelled: 'Cancelled' };
const state = { projects: [], tasks: [], runs: [], agents: [], operator: '', view: 'today', layout: 'health', query: '', priority: '', status: '', owner: '', loading: true, runId: '', run: null, runError: null, decisionMode: '', decisionRun: '', drafts: {}, acting: false, authLost: false };
const detailsOpen = new Map();
// Decisions inbox: full runs fetched for rows opened inline, and which of them
// show the request-changes form.
const inbox = new Map();
const inboxMode = new Map();
let toastTimer;
let draggedId = '';
let refreshing = false;
let refreshPromise = Promise.resolve();
let workspaceSignature = '';
let lastView = '';
// The cockpit's read models: the brief (Today, the Decisions header, and the
// health dots in the sidebar), each project's metrics, and the change feed.
const cockpit = { brief: null, briefAt: 0, briefError: '', metrics: new Map(), changes: null, changesKey: '', changesFilter: { kind: '', projectId: '' }, expanded: new Set() };
const BRIEF_POLL_MS = 30000;
// "Since your last visit" moves on when a person leaves Today after looking at
// it for at least this long, or presses Mark seen.
const SEEN_AFTER_MS = 10000;
let todayShownAt = 0;

function projectColor(project) {
  const value = String(project?.color || 'blue');
  const hex = { '#3265df': 'blue', '#7c5ce0': 'violet', '#229b89': 'teal', '#db9c27': 'amber', '#d86783': 'rose' };
  return colors.includes(value) ? value : (hex[value.toLowerCase()] || 'blue');
}

function initials(name) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || '—';
}

function today() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function overdue(task) {
  return task.status !== 'done' && task.dueDate && task.dueDate < today();
}

function formatDate(value, includeYear = false) {
  if (!value) return '';
  const date = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', ...(includeYear ? { year: 'numeric' } : {}) });
}

function relativeTime(value) {
  const milliseconds = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(milliseconds)) return '';
  if (milliseconds < 60000) return 'Just now';
  if (milliseconds < 3600000) return `${Math.floor(milliseconds / 60000)}m ago`;
  if (milliseconds < 86400000) return `${Math.floor(milliseconds / 3600000)}h ago`;
  return formatDate(value);
}

function taskNumber(task) {
  return task.id.split(':').at(-1);
}

function selectedProject() {
  return state.projects.find((project) => project.id === state.view);
}

// The API token arrives as an HttpOnly cookie with the page, and same-origin
// fetches send it. A 401 means this page's token is stale (AGESight restarted
// with another data directory, or the cookie was cleared): only a reload helps.
async function api(path, method = 'GET', data) {
  const response = await fetch(`/api${path}`, { method, credentials: 'same-origin', ...(data ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) } : {}) });
  if (response.status === 401) {
    connectionLost();
    const error = new Error('Reload AGESight to reconnect.');
    error.status = 401;
    throw error;
  }
  if (state.authLost) connectionRestored();
  let result;
  try { result = await response.json(); } catch { throw new Error('The server did not return a valid response. Restart AGESight and refresh.'); }
  if (!response.ok) {
    const error = new Error(result.error || 'Changes could not be saved. Try again.');
    error.status = response.status;
    throw error;
  }
  return result;
}

function toast(message, error = false) {
  if (error && state.authLost) return; // the reconnect banner already says what to do
  clearTimeout(toastTimer);
  $('#toast').textContent = message;
  $('#toast').className = `toast visible${error ? ' toast-error' : ''}`;
  toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), error ? 7000 : 3500);
}

// #monitor-state is a live region, so its text changes only when the state does.
function setMonitor(text, offline, title = '') {
  const monitor = $('#monitor-state');
  monitor.classList.toggle('is-offline', offline);
  if (monitor.textContent !== text) monitor.innerHTML = `<span class="status-dot"></span><span>${escape(text)}</span>`;
  monitor.title = title;
}

// A persistent banner rather than toasts: polling stops until the person reloads.
function connectionLost() {
  if (state.authLost) return;
  state.authLost = true;
  const banner = $('#connection-banner');
  banner.innerHTML = `${icon('alert')}<p><strong>Sign in to AGESight.</strong> <span>Open the sign-in link printed in the terminal where AGESight is running (npm start), then reload. This keeps other local users out of your workspace. Automatic updates are stopped.</span></p><button type="button" class="button button-primary" id="reload-button">${icon('refresh')}Reload</button>`;
  banner.hidden = false;
  $('#reload-button').addEventListener('click', () => location.reload());
  setMonitor('Reload needed', true, 'The API rejected this page’s access key. Reload to reconnect.');
}

function connectionRestored() {
  state.authLost = false;
  $('#connection-banner').hidden = true;
  $('#connection-banner').innerHTML = '';
}

function refresh() {
  const operation = refreshPromise.catch(() => {}).then(async () => {
    refreshing = true;
    try {
      const workspace = await api('/workspace');
      state.projects = workspace.projects;
      state.tasks = workspace.tasks;
      state.runs = workspace.runs || [];
      state.agents = workspace.agents || [];
      state.operator = workspace.operator;
      readRoute();
      await refreshCockpit(workspace);
      if (state.view === 'decisions') await refreshInbox();
      if (state.view === 'run' && state.runId) {
        try {
          state.run = await api(`/runs/${encodeURIComponent(state.runId)}`);
          state.runError = null;
        } catch (error) {
          if (error.status !== 404 && error.status !== 400) throw error;
          state.run = null;
          state.runError = { id: state.runId, message: error.message };
        }
      }
      const signature = JSON.stringify([workspace, cockpitSignature(), state.view === 'run' ? [state.run, state.runError] : null, state.view === 'decisions' ? [...inbox].map(([id, entry]) => [id, entry.run?.lastSeq, entry.error]) : null]);
      const changed = signature !== workspaceSignature;
      workspaceSignature = signature;
      state.loading = false;
      $('#create-button').disabled = false;
      $('#main').setAttribute('aria-busy', 'false');
      setMonitor('Live', false, `Updated ${new Date().toLocaleTimeString()}. Refreshes every 10 seconds.`);
      $('#user-avatar').textContent = initials(state.operator);
      $('#user-avatar').title = state.operator || 'Local operator';
      if (changed) render();
    } finally { refreshing = false; }
  });
  refreshPromise = operation;
  return operation;
}

// Old links keep working: Overview became Today, All tasks Work, Activity Changes.
const ROUTE_ALIASES = { overview: 'today', tasks: 'work', activity: 'changes' };

function readRoute() {
  const raw = location.hash.slice(1);
  const hash = ROUTE_ALIASES[raw] || raw;
  if (hash.startsWith('project/')) {
    const id = hash.slice(8);
    state.view = state.projects.some((project) => project.id === id) ? id : 'today';
  } else if (hash.startsWith('run/')) {
    state.view = 'run';
    try { state.runId = decodeURIComponent(hash.slice(4)); } catch { state.runId = ''; }
  } else state.view = ['today', 'work', 'changes', 'decisions', 'agents'].includes(hash) ? hash : 'today';
  if (state.decisionRun !== state.runId) state.decisionMode = '';
}

function openRun(id) {
  navigate(`run/${encodeURIComponent(id)}`);
}

function navigate(view) {
  state.priority = '';
  state.status = '';
  state.owner = '';
  state.query = '';
  $('#search').value = '';
  const route = state.projects.some((project) => project.id === view) ? `project/${view}` : view;
  if (location.hash === `#${route}`) { readRoute(); render(); } else location.hash = route;
  $('#sidebar').classList.remove('is-open');
  $('#menu-toggle').setAttribute('aria-expanded', 'false');
}

function render() {
  renderNavigation();
  const project = selectedProject();
  const page = project?.name || ({ today: 'Today', work: 'Work', changes: 'Changes', decisions: 'Decisions', agents: 'Agents', run: state.run?.id === state.runId ? `Run ${state.run.localId}` : 'Run' }[state.view]);
  document.title = `${page} · AGESight`;
  $('#breadcrumb').innerHTML = `Workspace <span>/</span> <strong>${escape(page)}</strong>`;
  $('#create-button').innerHTML = `${icon('plus')}<span>${state.projects.length ? 'New task' : 'New project'}</span>`;
  renderMain();
}

function renderNavigation() {
  const waiting = state.runs.filter((run) => run.needsHuman).length;
  const counts = {
    work: `<span class="nav-count">${state.tasks.filter((task) => task.status !== 'done').length}</span>`,
    decisions: waiting ? `<span class="nav-count nav-count-alert" aria-label="${waiting} waiting on you">${waiting}</span>` : '',
  };
  $('#navigation').innerHTML = [ ['today', 'grid', 'Today'], ['decisions', 'decision', 'Decisions'], ['work', 'tasks', 'Work'], ['changes', 'activity', 'Changes'], ['agents', 'agent', 'Agents'] ].map(([view, symbol, label]) => `<a href="#${view}" class="nav-link ${state.view === view || (view === 'decisions' && state.view === 'run') ? 'active' : ''}" ${state.view === view ? 'aria-current="page"' : ''}>${icon(symbol)}<span>${label}</span>${counts[view] || ''}</a>`).join('');
  $('#project-navigation').innerHTML = state.projects.length ? state.projects.map((project) => {
    const line = cockpit.brief?.projects.find((entry) => entry.projectId === project.id);
    const health = line?.health;
    return `<a href="#project/${escape(project.id)}" class="nav-link project-nav ${state.view === project.id ? 'active' : ''}" ${state.view === project.id ? 'aria-current="page"' : ''}>${healthDot(health)}<span class="truncate">${escape(project.name)}</span>${health ? `<span class="nav-health">${escape(health.label)}</span>` : ''}</a>`;
  }).join('') : '<p class="sidebar-empty">Your projects will appear here.</p>';
}

function filteredTasks() {
  const project = selectedProject();
  const query = state.query.trim().toLowerCase();
  const ordered = { urgent: 0, high: 1, medium: 2, low: 3 };
  return state.tasks.filter((task) => (!project || task.projectId === project.id) && (!state.status || task.status === state.status) && (!state.priority || task.priority === state.priority) && (!state.owner || (state.owner === '__unassigned' ? !task.assignee : task.assignee === state.owner)) && (!query || `${task.title} ${task.description} ${task.assignee} ${taskNumber(task)} ${state.projects.find((item) => item.id === task.projectId)?.name}`.toLowerCase().includes(query))).sort((a, b) => ordered[a.priority] - ordered[b.priority] || b.createdAt.localeCompare(a.createdAt));
}

// Re-rendering replaces #main, so keep what a person was doing: open <details>,
// typed drafts (read from state.drafts by the templates), and keyboard focus.
function focusSelector(element) {
  if (!element || element === $('#main') || !$('#main').contains(element)) return '';
  if (element.dataset.draft) return `[data-draft="${CSS.escape(element.dataset.draft)}"]${element.dataset.draftRun ? `[data-draft-run="${CSS.escape(element.dataset.draftRun)}"]` : ''}`;
  if (element.id) return `#${CSS.escape(element.id)}`;
  if (element.tagName === 'SUMMARY' && element.parentElement.dataset.key) return `details[data-key="${CSS.escape(element.parentElement.dataset.key)}"] > summary`;
  if (element.dataset.action) return ['action', 'id', 'value', 'runAction'].filter((key) => element.dataset[key] !== undefined).map((key) => `[data-${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}="${CSS.escape(element.dataset[key])}"]`).join('');
  return '';
}

function renderMain() {
  const focus = focusSelector(document.activeElement);
  renderPage();
  $('#main').querySelectorAll('details[data-key]').forEach((details) => {
    if (detailsOpen.has(details.dataset.key)) details.open = detailsOpen.get(details.dataset.key);
  });
  if (focus && !$('#main').contains(document.activeElement)) $('#main').querySelector(focus)?.focus({ preventScroll: true });
}

function renderPage() {
  if (state.loading) return;
  if (state.view === 'agents' && !state.query) return renderAgents();
  if (!state.projects.length) return renderEmptyWorkspace();
  if (state.view === 'run' && !state.query) return renderRun();
  if (state.view === 'decisions' && !state.query) return renderDecisions();
  if (state.view === 'changes' && !state.query) return renderChangesPage();
  if (state.view === 'today' && !state.query) return renderTodayPage();
  const project = selectedProject();
  const health = project && !state.query && state.layout === 'health';
  const tasks = filteredTasks();
  const projectTasks = state.tasks.filter((task) => !project || task.projectId === project.id);
  const done = projectTasks.filter((task) => task.status === 'done').length;
  const active = projectTasks.filter((task) => ['in_progress', 'blocked'].includes(task.status)).length;
  const layout = state.layout === 'health' ? 'board' : state.layout;
  $('#main').innerHTML = `<section class="page-heading"><div><div class="heading-title">${project ? `<span class="project-symbol color-${projectColor(project)}">${icon('folder')}</span>` : ''}<h1>${escape(project?.name || (state.query ? 'Search results' : 'Work'))}</h1>${project ? `<button class="text-button project-settings" data-action="edit-project">Edit project</button><button class="text-button project-settings" data-action="edit-pipeline">${icon('pipeline')}Pipeline</button>` : ''}</div><p>${escape(project?.description || (state.query ? `Tasks matching “${state.query}”` : 'Everything on your plate, across your projects.'))}</p></div>${project ? `<div class="project-heading-progress"><span><strong>${done}</strong> of ${projectTasks.length} tasks complete</span><progress max="${Math.max(projectTasks.length, 1)}" value="${done}" aria-label="Project completion"></progress></div>` : ''}</section>
    <div class="view-toolbar"><div class="view-tabs" role="group" aria-label="Project view">${project && !state.query ? `<button class="view-tab ${health ? 'selected' : ''}" data-action="layout" data-value="health" aria-pressed="${health}">${icon('shield')} Health</button>` : ''}<button class="view-tab ${layout === 'board' && !health ? 'selected' : ''}" data-action="layout" data-value="board" aria-pressed="${layout === 'board' && !health}">${icon('board')} Board</button><button class="view-tab ${layout === 'list' && !health ? 'selected' : ''}" data-action="layout" data-value="list" aria-pressed="${layout === 'list' && !health}">${icon('list')} List</button></div>${health ? '' : `<div class="filters">${filterControls(projectTasks)}${state.status || state.priority || state.owner ? '<button class="text-button" data-action="clear-filters">Clear</button>' : ''}</div>`}</div>
    ${health ? renderHealth(cockpit.metrics.get(project.id), { projectId: project.id }) : `<div class="board-meta"><span>${tasks.length} ${tasks.length === 1 ? 'task' : 'tasks'}${state.query ? ' found' : ''}</span>${project ? `<span>${active} / ${project.wipLimit} in progress ${icon('circle', 'tiny-icon')}</span>` : '<span>Across all projects</span>'}</div>
    ${layout === 'board' ? board(tasks) : taskList(tasks)}
    ${!projectTasks.length ? `<p class="board-hint">Start with a task. Give it an owner and a clear next step.</p>` : ''}`}`;
}

function filterControls(tasks) {
  const owners = [...new Set(tasks.map((task) => task.assignee).filter(Boolean))].sort();
  return `<label class="filter-select"><span class="sr-only">Filter by owner</span><select data-filter="owner"><option value="">All owners</option><option value="__unassigned" ${state.owner === '__unassigned' ? 'selected' : ''}>Unassigned</option>${owners.map((owner) => `<option value="${escape(owner)}" ${state.owner === owner ? 'selected' : ''}>${escape(owner)}</option>`).join('')}</select></label><label class="filter-select"><span class="sr-only">Filter by priority</span><select data-filter="priority"><option value="">All priorities</option>${options(priorities, state.priority)}</select></label><label class="filter-select"><span class="sr-only">Filter by status</span><select data-filter="status"><option value="">All statuses</option>${options(statuses, state.status)}</select></label>`;
}

function options(values, current) {
  return Object.entries(values).map(([value, label]) => `<option value="${value}" ${current === value ? 'selected' : ''}>${label}</option>`).join('');
}

function board(tasks) {
  return `<div class="board">${Object.entries(statuses).map(([status, label]) => {
    const column = tasks.filter((task) => task.status === status);
    return `<section class="board-column" data-drop-status="${status}" aria-label="${label}"><header class="column-heading"><span class="status-dot status-${status}"></span><h2>${label}</h2><span class="column-count">${column.length}</span><button class="icon-button" data-action="new-task" data-status="${status}" aria-label="Add task to ${label}">${icon('plus')}</button></header><div class="column-tasks">${column.map(taskCard).join('')}${!column.length ? '<div class="column-empty">No tasks here yet</div>' : ''}</div><button class="column-add" data-action="new-task" data-status="${status}">${icon('plus')} Add task</button></section>`;
  }).join('')}</div>`;
}

function taskCard(task) {
  const project = state.projects.find((item) => item.id === task.projectId);
  return `<button class="task-card ${task.status === 'done' ? 'task-complete' : ''}" data-action="open-task" data-id="${escape(task.id)}" draggable="true" aria-label="Edit ${escape(task.title)}"><span class="card-top"><span class="task-number">${escape(taskNumber(task))}</span><span class="priority priority-${task.priority}">${icon('flag')}${priorities[task.priority]}</span></span><span class="card-title">${escape(task.title)}</span>${task.description ? `<span class="card-description">${escape(task.description)}</span>` : ''}${!selectedProject() ? `<span class="card-project"><span class="project-dot color-${projectColor(project)}"></span>${escape(project?.name)}</span>` : ''}${runLine(task)}<span class="card-footer"><span class="due-date ${overdue(task) ? 'is-overdue' : ''}">${task.dueDate ? `${icon('calendar')}${escape(formatDate(task.dueDate))}` : ''}</span>${avatar(task.assignee)}</span></button>`;
}

function avatar(name) {
  return name ? `<span class="task-avatar" title="${escape(name)}" aria-label="Owner: ${escape(name)}">${escape(initials(name))}</span>` : `<span class="task-avatar unassigned" title="Unassigned" aria-label="Unassigned">${icon('user')}</span>`;
}

function taskList(tasks) {
  if (!tasks.length) return `<div class="empty-results">${icon('tasks')}<h2>No tasks found</h2><p>${state.query || state.status || state.priority || state.owner ? 'Try another search or clear your filters.' : 'Create a task to start planning your project.'}</p><button class="button button-secondary" data-action="${state.query || state.status || state.priority || state.owner ? 'clear-filters' : 'new-task'}">${state.query || state.status || state.priority || state.owner ? 'Clear search and filters' : 'New task'}</button></div>`;
  return `<div class="task-table-wrap"><table class="task-table"><thead><tr><th scope="col">Task</th><th scope="col">Status</th><th scope="col">Priority</th><th scope="col">Owner</th><th scope="col">Due date</th></tr></thead><tbody>${tasks.map((task) => `<tr><td><button class="task-name-button" data-action="open-task" data-id="${escape(task.id)}"><span class="task-number">${escape(taskNumber(task))}</span><span class="list-task-title ${task.status === 'done' ? 'completed-title' : ''}">${escape(task.title)}</span>${!selectedProject() ? `<small>${escape(state.projects.find((project) => project.id === task.projectId)?.name)}</small>` : ''}${runLine(task)}</button></td><td><span class="status-pill status-${task.status}"><span class="status-dot"></span>${statuses[task.status]}</span></td><td><span class="priority priority-${task.priority}">${icon('flag')}${priorities[task.priority]}</span></td><td><span class="list-owner">${avatar(task.assignee)}<span>${escape(task.assignee || 'Unassigned')}</span></span></td><td><span class="due-date ${overdue(task) ? 'is-overdue' : ''}">${task.dueDate ? escape(formatDate(task.dueDate)) : '—'}</span></td></tr>`).join('')}</tbody></table></div>`;
}

function renderEmptyWorkspace() {
  $('#main').innerHTML = `<section class="page-heading"><div><h1>Today</h1><p>No projects yet.</p></div></section><section class="welcome-panel"><h2>Start with a project.</h2><p>Each morning, Today shows what needs you, what moved since your last visit, and how each project is doing.</p><button class="button button-primary" data-action="new-project">${icon('plus')} Create your first project</button><button class="text-button sample-button" data-action="sample-project">Explore a sample project with six weeks of history</button></section>`;
}

// --- Cockpit: Today, project health, changes, explain ----------------------------

function storage() {
  try { return window.localStorage; } catch { return null; }
}

function cockpitSignature() {
  const project = selectedProject();
  return [cockpit.brief, cockpit.briefError, state.view === 'changes' ? cockpit.changes : null, project ? cockpit.metrics.get(project.id) : null];
}

async function loadBrief() {
  const { params } = briefQuery({ storage: storage() });
  try {
    cockpit.brief = await api(`/brief?${params}`);
    cockpit.briefError = '';
  } catch (error) {
    if (error.status === 401) throw error;
    // A stored cursor the server rejects must not leave Today empty, nor mark
    // everything seen: forget it, so the brief counts from the previous
    // working day and says why.
    if (error.status === 400 && params.has('since')) {
      writeCursor(storage(), null);
      cockpit.brief = await api(`/brief?${briefQuery({ storage: storage() }).params}`);
      cockpit.briefError = '';
    } else cockpit.briefError = error.message;
  }
  cockpit.briefAt = Date.now();
}

// Fetches what the current view shows. `workspace` is the fresh workspace (or
// null); a changed workspace means the brief and metrics may be stale.
async function refreshCockpit(workspace, { force = false, metrics = false } = {}) {
  if (!state.projects.length) { cockpit.brief = null; return; }
  const changed = workspace && JSON.stringify([workspace.projects, workspace.tasks, workspace.runs]) !== cockpit.workspaceKey;
  if (workspace) cockpit.workspaceKey = JSON.stringify([workspace.projects, workspace.tasks, workspace.runs]);
  const project = selectedProject();
  // Other projects' metrics are fetched again when next shown.
  if (changed) for (const id of [...cockpit.metrics.keys()]) if (id !== project?.id) cockpit.metrics.delete(id);
  const stale = Date.now() - cockpit.briefAt >= BRIEF_POLL_MS;
  const jobs = [];
  if (force || changed || stale || !cockpit.brief) jobs.push(loadBrief());
  if (project && state.layout === 'health' && !state.query && (force || metrics || changed || stale || !cockpit.metrics.has(project.id))) {
    jobs.push(api(`/projects/${encodeURIComponent(project.id)}/metrics`).then((data) => { cockpit.metrics.set(project.id, data); }));
  }
  if (state.view === 'changes') {
    const { kind, projectId } = cockpit.changesFilter;
    const key = `${kind}|${projectId}`;
    if (force || changed || stale || cockpit.changesKey !== key || !cockpit.changes) {
      const params = new URLSearchParams({ limit: '200', ...(kind ? { kinds: kind } : {}), ...(projectId ? { projectId } : {}) });
      jobs.push(api(`/changes?${params}`).then((feed) => { cockpit.changes = feed; cockpit.changesKey = key; }));
    }
  }
  await Promise.all(jobs);
  // A project still indexing is asked again soon.
  if (cockpit.brief?.projects.some((line) => line.state !== 'ready')) cockpit.briefAt = Date.now() - BRIEF_POLL_MS + 3000;
}

function renderTodayPage() {
  if (!cockpit.brief) {
    $('#main').innerHTML = cockpit.briefError
      ? `<div class="empty-results">${icon('alert')}<h2>Today is unavailable</h2><p>${escape(cockpit.briefError)}</p></div>`
      : '<div class="loading-state"><span class="spinner"></span>Reading your projects’ history…</div>';
    return;
  }
  if (!document.hidden && !todayShownAt) todayShownAt = Date.now();
  $('#main').innerHTML = renderToday(cockpit.brief, { mode: readWindow(storage()), expanded: cockpit.expanded });
}

function renderChangesPage() {
  $('#main').innerHTML = renderChanges(cockpit.changes, { ...cockpit.changesFilter, projects: state.projects, timezone: cockpit.brief?.timezone });
}

// Leaving Today after looking at it marks what it showed as seen.
function leaveToday(view) {
  if (view !== 'today' || !todayShownAt) return;
  const looked = Date.now() - todayShownAt;
  todayShownAt = 0;
  if (looked >= SEEN_AFTER_MS && cockpit.brief?.live) writeCursor(storage(), cursorFromBrief(cockpit.brief));
}

async function markSeen() {
  if (!cockpit.brief) return;
  writeCursor(storage(), cursorFromBrief(cockpit.brief));
  if (readWindow(storage()) !== 'last-visit') writeWindow(storage(), 'last-visit');
  cockpit.expanded.clear();
  try { await refreshCockpit(null, { force: true }); renderMain(); toast('Marked as seen. Changes from now on will show here.'); } catch (error) { toast(error.message, true); }
}

async function changeWindow(value) {
  writeWindow(storage(), value);
  cockpit.expanded.clear();
  try { await refreshCockpit(null, { force: true }); renderMain(); } catch (error) { toast(error.message, true); }
}

function toggleDelta(name) {
  if (cockpit.expanded.has(name)) cockpit.expanded.delete(name); else cockpit.expanded.add(name);
  renderMain();
}

async function changeChangesFilter(field, value) {
  cockpit.changesFilter[field === 'project' ? 'projectId' : 'kind'] = value;
  cockpit.changes = null;
  renderMain();
  try { await refreshCockpit(null); renderMain(); } catch (error) { toast(error.message, true); }
}

function openTask(id) {
  const task = state.tasks.find((entry) => entry.id === id);
  if (task) openTaskEditor(task);
  else toast('This task is no longer on the board. Its history stays in Changes.', true);
}

// The full MetricValue behind a number, as of the time the number was computed.
async function openExplain({ metric, project: projectId, task: taskKey }, opener) {
  const dialog = $('#explain-dialog');
  // Focus comes back to the number when the drawer closes.
  opener?.focus({ preventScroll: true });
  const asOf = state.view === 'today' || state.view === 'decisions' ? cockpit.brief?.asOf : cockpit.metrics.get(projectId)?.asOf;
  dialog.innerHTML = `<header class="dialog-heading"><div><span class="dialog-eyebrow">Explain</span><h2 id="explain-dialog-title">Loading…</h2></div><button type="button" class="icon-button" data-close aria-label="Close">${icon('close')}</button></header><div class="dialog-fields"><div class="loading-state dialog-loading"><span class="spinner"></span></div></div>`;
  setupDialog(dialog);
  const params = new URLSearchParams({ projectId, ...(taskKey ? { taskKey } : {}) });
  if (asOf) params.set('asOf', asOf);
  let value;
  try { value = await api(`/explain/${encodeURIComponent(metric)}?${params}`); } catch (error) { value = { error: error.message }; }
  if (!dialog.open) return;
  dialog.innerHTML = renderExplain(value);
  dialog.querySelectorAll('[data-close]').forEach((button) => button.addEventListener('click', () => closeDialog(dialog)));
  dialog.querySelector('[data-close]')?.focus();
}

// A task's history in its drawer: every transition with its commit.
async function loadTaskHistory(task) {
  const slot = $('#task-history');
  if (!slot) return;
  let history;
  try { history = await api(`/tasks/${encodeURIComponent(task.id)}/history`); } catch (error) { history = { error: error.status === 404 ? 'No history yet: this task has not been committed.' : error.message }; }
  const current = $('#task-history');
  if (current && current.dataset.task === task.id) current.innerHTML = renderHistory(history, cockpit.brief?.timezone);
}

function closeDialog(dialog) {
  if (dialog.open) dialog.close();
}

function setupDialog(dialog) {
  dialog.querySelectorAll('[data-close]').forEach((button) => button.addEventListener('click', () => closeDialog(dialog)));
  dialog.onclick = (event) => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeDialog(dialog);
  };
  const opener = document.activeElement;
  dialog.addEventListener('close', () => { if (opener?.isConnected && !document.querySelector('dialog[open]')) opener.focus({ preventScroll: true }); }, { once: true });
  if (!dialog.open) dialog.showModal();
}

function anyDialogOpen() {
  return Boolean(document.querySelector('dialog[open]'));
}

function openProjectEditor(project = null) {
  const dialog = $('#project-dialog');
  dialog.innerHTML = `<form id="project-form"><header class="dialog-heading"><div><span class="dialog-eyebrow">Your workspace</span><h2 id="project-dialog-title">${project ? 'Edit project' : 'New project'}</h2></div><button type="button" class="icon-button" data-close aria-label="Close project editor">${icon('close')}</button></header><div class="dialog-fields"><label class="field">Project name<input name="name" required maxlength="100" placeholder="e.g. Website launch" value="${escape(project?.name || '')}" autofocus></label><label class="field">Description <span class="field-optional">optional</span><textarea name="description" rows="3" maxlength="4000" placeholder="What are you working toward?">${escape(project?.description || '')}</textarea></label><fieldset class="color-field"><legend>Project color</legend><div class="color-options">${colors.map((color) => `<label class="color-option color-${color}"><input type="radio" name="color" value="${color}" ${(project ? projectColor(project) : 'blue') === color ? 'checked' : ''}><span aria-hidden="true">${icon('check')}</span><span class="sr-only">${color}</span></label>`).join('')}</div></fieldset><label class="field">Work in progress limit<input name="wipLimit" type="number" min="1" max="99" required value="${project?.wipLimit || 6}"><small>Limit how many tasks can be in progress or blocked at once.</small></label><p class="form-error" id="project-error" role="alert"></p></div><footer class="dialog-footer"><button type="button" class="button button-secondary" data-close>Cancel</button><button type="submit" class="button button-primary">${project ? 'Save changes' : 'Create project'}</button></footer></form>`;
  $('#project-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('[type="submit"]');
    const data = Object.fromEntries(new FormData(form));
    data.wipLimit = Number(data.wipLimit);
    data.color = colorHex[data.color];
    if (project) data.version = project.version;
    button.disabled = true;
    $('#project-error').textContent = '';
    try {
      const saved = await api(project ? `/projects/${encodeURIComponent(project.id)}` : '/projects', project ? 'PATCH' : 'POST', data);
      closeDialog(dialog);
      await refresh();
      navigate(saved.id);
      toast(project ? 'Project updated' : 'Project created');
    } catch (error) { $('#project-error').textContent = error.message; } finally { button.disabled = false; }
  });
  setupDialog(dialog);
}

// The grouping key of a task type, as the server computes it: lowercased,
// trimmed, placeholders and stray characters removed; '' means untyped.
function typeKey(value = '') {
  const text = String(value).toLowerCase().trim();
  return /[{}]/.test(text) ? '' : text.replace(/[^a-z0-9 _-]/g, '').trim();
}

// `status` presets the status select: a new task's column, or Blocked when a
// card is dropped there, so the editor can ask what would unblock it.
function openTaskEditor(task = null, status = '') {
  if (!state.projects.length) return openProjectEditor();
  const projectId = task?.projectId || selectedProject()?.id || state.projects[0].id;
  const initialStatus = status || task?.status || 'backlog';
  const types = [...new Set(['feature', 'bug', 'chore', ...state.tasks.filter((entry) => entry.projectId === projectId).map((entry) => typeKey(entry.type))].filter(Boolean))];
  const dialog = $('#task-dialog');
  dialog.innerHTML = `<form id="task-form"><header class="dialog-heading"><div><span class="dialog-eyebrow">${task ? escape(taskNumber(task)) : 'Plan your next step'}</span><h2 id="task-dialog-title">${task ? 'Task details' : 'New task'}</h2></div><button type="button" class="icon-button" data-close aria-label="Close task editor">${icon('close')}</button></header><div class="dialog-fields">${task ? taskRunPanel(task) : ''}<label class="field">Task title<input name="title" required maxlength="200" placeholder="What needs to get done?" value="${escape(task?.title || '')}" autofocus></label><label class="field">Project<select name="projectId" ${task ? 'disabled' : ''}>${state.projects.map((project) => `<option value="${escape(project.id)}" ${projectId === project.id ? 'selected' : ''}>${escape(project.name)}</option>`).join('')}</select></label><div class="field-row"><label class="field">Status<select name="status">${options(statuses, initialStatus)}</select></label><label class="field">Priority<select name="priority">${options(priorities, task?.priority || 'medium')}</select></label></div><label class="field" id="blocked-reason-field" ${initialStatus === 'blocked' ? '' : 'hidden'}>What would unblock it? <span class="field-optional">optional</span><input name="blockedReason" maxlength="200" placeholder="e.g. Waiting on the API key from Ops" value="${escape(task?.blockedReason || '')}"><small>One line. It is cleared when the task leaves Blocked.</small></label><label class="field">Type <span class="field-optional">optional</span><input name="type" maxlength="40" list="type-suggestions" placeholder="e.g. feature or bug" value="${escape(task?.type || '')}"><datalist id="type-suggestions">${types.map((type) => `<option value="${escape(type)}"></option>`).join('')}</datalist><small>Tasks of one type are timed together; bug counts as defect work.</small></label><div class="field-row"><label class="field">Owner <span class="field-optional">optional</span><input name="assignee" maxlength="100" list="owner-suggestions" placeholder="Unassigned" value="${escape(task?.assignee || '')}"><datalist id="owner-suggestions">${[...new Set([state.operator, ...state.tasks.map((entry) => entry.assignee)].filter(Boolean))].map((owner) => `<option value="${escape(owner)}"></option>`).join('')}</datalist></label><label class="field">Due date <span class="field-optional">optional</span><input name="dueDate" type="date" value="${escape(task?.dueDate || '')}"></label></div><label class="field">Description <span class="field-optional">optional</span><textarea name="description" rows="8" maxlength="20000" placeholder="Add context, a clear next step, or what done looks like…">${escape(task?.description || '')}</textarea></label>${task ? `<div class="task-timestamps"><span>Created ${escape(formatDate(task.createdAt, true))}</span><span>Updated ${escape(formatDate(task.updatedAt, true))}</span></div><details class="drawer-history" data-key="history"><summary>History</summary><div id="task-history" data-task="${escape(task.id)}">${renderHistory(null)}</div></details>` : ''}<p class="form-error" id="task-error" role="alert"></p></div><footer class="dialog-footer"><button type="button" class="button button-secondary" data-close>Cancel</button><button type="submit" class="button button-primary">${task ? 'Save changes' : 'Create task'}</button></footer></form>`;
  const reasonField = $('#blocked-reason-field');
  $('#task-form [name="status"]').addEventListener('change', (event) => {
    reasonField.hidden = event.currentTarget.value !== 'blocked';
    if (!reasonField.hidden) reasonField.querySelector('input').focus();
  });
  $('#task-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('[type="submit"]');
    const data = Object.fromEntries(new FormData(form));
    if (task) { delete data.projectId; data.version = task.version; }
    button.disabled = true;
    $('#task-error').textContent = '';
    try {
      await api(task ? `/tasks/${encodeURIComponent(task.id)}` : '/tasks', task ? 'PATCH' : 'POST', data);
      closeDialog(dialog);
      await refresh();
      toast(task ? 'Task updated' : 'Task created');
    } catch (error) { $('#task-error').textContent = error.message; } finally { button.disabled = false; }
  });
  if (task) {
    const form = $('#task-form');
    const snapshot = JSON.stringify(Object.fromEntries(new FormData(form)));
    form.querySelector('[data-start-run]')?.addEventListener('click', (event) => startRun(task, event.currentTarget, form, snapshot));
    form.querySelector('[data-open-run]')?.addEventListener('click', (event) => { closeDialog(dialog); openRun(event.currentTarget.dataset.openRun); });
  }
  if (task) dialog.querySelector('.drawer-history').addEventListener('toggle', (event) => { if (event.currentTarget.open) loadTaskHistory(task); }, { once: true });
  setupDialog(dialog);
  if (status === 'blocked' && task) reasonField.querySelector('input').focus();
}

// Start a run from the drawer. Unsaved edits are saved first so the agents see
// what the person sees; then the drawer closes on the new run's page.
async function startRun(task, button, form, snapshot) {
  button.disabled = true;
  $('#task-error').textContent = '';
  try {
    const data = Object.fromEntries(new FormData(form));
    if (JSON.stringify(data) !== snapshot) {
      delete data.projectId;
      await api(`/tasks/${encodeURIComponent(task.id)}`, 'PATCH', { ...data, version: task.version });
    }
    const run = await api('/runs', 'POST', { taskId: task.id });
    state.run = run;
    state.runError = null;
    closeDialog($('#task-dialog'));
    openRun(run.id);
    toast('Run started');
    refresh().catch(monitorOffline);
  } catch (error) {
    $('#task-error').textContent = error.message;
    button.disabled = false;
  }
}

// --- Agent pipeline -----------------------------------------------------------

const actionMessages = { pause: 'Run paused', resume: 'Run resumed', takeover: 'Stage assigned to you' };
const decisionDrafts = ['approveComment', 'feedback', 'rejectStage', 'rejectPin', 'rejectExclude', 'editOutput', 'submitOutput', 'retryStage'];

function roleLabel(role) {
  return { triage: 'Triage', plan: 'Plan', implement: 'Implement', review: 'Review', verify: 'Verify' }[role] || role;
}

function tierLabel(tier) {
  return { haiku: 'Haiku', sonnet: 'Sonnet', opus: 'Opus' }[tier] || tier;
}

// Status colours carry meaning only: blue moving, amber waiting on a person,
// coral failed, teal done, grey idle.
function tone(status) {
  if (['running', 'active', 'queued'].includes(status)) return 'run';
  if (['awaiting_approval', 'awaiting_input', 'waiting'].includes(status)) return 'wait';
  if (status === 'failed') return 'fail';
  if (['completed', 'done', 'approved', 'succeeded'].includes(status)) return 'done';
  if (status === 'rejected') return 'changes';
  return 'idle';
}

function isActiveRun(run) {
  return Boolean(run) && !TERMINAL.includes(run.status);
}

function runsForTask(taskId) {
  return state.runs.filter((run) => run.taskId === taskId).sort((a, b) => String(b.startedAt || '').localeCompare(String(a.startedAt || '')));
}

function agentName(id) {
  if (!id) return 'Person';
  return state.agents.find((agent) => agent.id === id)?.name || id;
}

function formatDuration(ms) {
  if (!Number.isFinite(ms)) return '—';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds < 10 ? seconds.toFixed(1) : Math.round(seconds)} s`;
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60);
  if (minutes < 60) return rest ? `${minutes}m ${rest}s` : `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

function formatTime(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit' });
}

function percent(rate) {
  return rate === null || rate === undefined ? '—' : `${Math.round(rate * 100)}%`;
}

function clip(text, limit = 140) {
  const value = String(text ?? '').replace(/\s+/g, ' ').trim();
  return value.length > limit ? `${value.slice(0, limit - 1)}…` : value;
}

function decisionReason(run) {
  const stage = run.currentStage?.name || 'Stage';
  if (!run.integrity) return 'Audit check failed';
  // A running run needs a person only when a pull agent has left its stage unclaimed.
  if (run.status === 'running' && run.needsHuman) return `Waiting for ${agentName(run.currentAgent)} to claim ${stage}`;
  return { awaiting_approval: `Approve ${stage}`, awaiting_input: `${stage} needs your input`, waiting: `${stage}: no agent available`, failed: `Failed at ${stage}` }[run.status] || runStatuses[run.status] || run.status;
}

function runTone(run) {
  if (!run.integrity || run.status === 'failed') return 'fail';
  return run.needsHuman ? 'wait' : tone(run.status);
}

function runPill(status, label = runStatuses[status] || attemptStatuses[status] || status) {
  return `<span class="run-pill tone-${tone(status)}"><span class="status-dot"></span>${escape(label)}</span>`;
}

function miniSteps(run) {
  const label = run.stages.map((stage) => `${stage.name}: ${stageStatuses[stage.status] || stage.status}`).join(', ');
  return `<span class="mini-steps" role="img" aria-label="${escape(label)}">${run.stages.map((stage) => `<span class="mini-step tone-${tone(stage.status)}" title="${escape(`${stage.name}: ${stageStatuses[stage.status] || stage.status}`)}"></span>`).join('')}</span>`;
}

function stageTrack(run) {
  return `<ol class="stage-track" aria-label="Stages">${run.stages.map((stage, index) => `<li class="tone-${tone(stage.status)}" ${index === run.stageIndex && isActiveRun(run) ? 'aria-current="step"' : ''}><span class="status-dot"></span>${escape(stage.name)}<span class="sr-only">: ${stageStatuses[stage.status] || stage.status}</span></li>`).join('')}</ol>`;
}

function runLine(task) {
  const run = runsForTask(task.id)[0];
  if (!run || !(isActiveRun(run) || (run.status === 'failed' && task.status !== 'done'))) return '';
  const stage = run.currentStage?.name || 'Starting';
  const status = run.needsHuman ? '<span class="needs-you">Needs you</span>' : run.paused ? `<span class="run-quiet">${icon('pause')}Paused</span>` : '<span class="run-quiet"><span class="status-dot"></span>Running</span>';
  return `<span class="card-run">${icon('pipeline')}<span class="card-run-stage">${escape(run.status === 'failed' ? `${stage} failed` : stage)}</span>${status}</span>`;
}

function taskRunPanel(task) {
  const run = runsForTask(task.id)[0];
  const active = isActiveRun(run);
  const note = run && active ? `<p class="drawer-run-note">${escape(run.needsHuman ? decisionReason(run) : `${run.currentStage?.name || 'Stage'} ${run.paused ? 'is paused' : `is running${run.currentAgent ? ` on ${agentName(run.currentAgent)}` : ''}`}`)}.</p>` : '';
  const head = run ? `<div class="drawer-run-head"><span class="drawer-run-title">${icon('pipeline')}<span>${active ? 'Agent run' : 'Last run'} ${escape(run.localId)}</span>${run.needsHuman ? '<span class="needs-you">Needs you</span>' : runPill(run.status)}</span><button type="button" class="text-button drawer-run-link" data-open-run="${escape(run.id)}">Open run${icon('chevron')}</button></div>${stageTrack(run)}${note}` : '';
  const start = active ? '' : `<div class="drawer-run-start"><p>${run ? 'Start a fresh run through this project’s pipeline.' : 'Agents take this task stage by stage and stop for your approval at gates.'}</p><button type="button" class="button button-primary" data-start-run>${icon('play')}Run with agents</button></div>`;
  return `<section class="drawer-run${active ? ' is-active' : ''}" aria-label="Agent pipeline">${head}${start}</section>`;
}

// --- Drafts keep typed text across re-renders ----------------------------------

// Drafts are keyed by run, so a note typed in the Decisions inbox is still there
// on the run page (fields outside the run page name their run in data-draft-run).
function draftKey(name, runId = state.runId) {
  return `${runId}|${name}`;
}

function draft(name, fallback = '', runId = state.runId) {
  const key = draftKey(name, runId);
  return key in state.drafts ? state.drafts[key] : fallback;
}

function saveDraft(element) {
  if (!element?.dataset?.draft) return;
  const runId = element.dataset.draftRun || (state.view === 'run' ? state.runId : '');
  if (!runId) return;
  state.drafts[draftKey(element.dataset.draft, runId)] = element.type === 'checkbox' ? element.checked : element.value;
}

function clearDrafts(runId, names) {
  for (const key of Object.keys(state.drafts)) {
    const split = key.lastIndexOf('|');
    if (key.slice(0, split) === runId && names.includes(key.slice(split + 1))) delete state.drafts[key];
  }
}

// --- Decisions page --------------------------------------------------------------

function runRow(run) {
  const project = state.projects.find((entry) => entry.id === run.projectId);
  const label = run.needsHuman ? decisionReason(run) : isActiveRun(run) ? `${run.currentStage?.name || 'Starting'} · ${run.paused ? 'Paused' : run.currentAgent ? agentName(run.currentAgent) : 'Running'}` : runStatuses[run.status];
  return `<li><button class="run-row tone-${runTone(run)}" data-action="open-run" data-id="${escape(run.id)}"><span class="run-row-main"><span class="run-row-reason">${escape(label)}</span><strong>${escape(run.taskTitle)}</strong><small>${escape(project?.name || 'Project')} · Run ${escape(run.localId)} · ${escape(String(run.taskId).split(':').at(-1))} · <time datetime="${escape(run.updatedAt)}">${escape(relativeTime(run.updatedAt))}</time></small></span>${miniSteps(run)}${icon('chevron', 'run-row-chevron')}</button></li>`;
}

function renderDecisions() {
  const waiting = state.runs.filter((run) => run.needsHuman);
  const moving = state.runs.filter((run) => !run.needsHuman && isActiveRun(run));
  const recent = state.runs.filter((run) => !run.needsHuman && !isActiveRun(run)).slice(0, 20);
  const section = (key, title, runs, empty, row = runRow) => `<section class="run-section run-section-${key}" aria-labelledby="runs-${key}"><div class="section-heading"><h2 id="runs-${key}" tabindex="-1">${title}</h2><span class="${key === 'waiting' && runs.length ? 'count-alert' : ''}">${runs.length}</span></div>${runs.length ? `<ol class="run-list">${runs.map(row).join('')}</ol>` : `<p class="run-empty">${empty}</p>`}</section>`;
  const body = state.runs.length
    ? `${section('waiting', 'Waiting on you', waiting, `${icon('check')}Nothing is waiting on you.`, (run) => (inlineDecision(run) ? inboxItem(run) : runRow(run)))}${section('moving', 'In progress', moving, 'No runs are moving right now.')}${section('recent', 'Recent', recent, 'Finished runs will appear here.')}`
    : `<div class="empty-results">${icon('pipeline')}<h2>No agent runs yet</h2><p>Open a task and choose Run with agents. Runs that need you will wait here.</p><a class="button button-secondary" href="#work">Go to work</a></div>`;
  $('#main').innerHTML = `<section class="page-heading"><div><h1>Decisions</h1><p>Runs waiting on you come first. Expand an approval or a request for input to answer it here, or open the run for the full record.</p>${decisionsSummary(cockpit.brief)}</div></section>${body}`;
}

// --- Decisions inbox: answer approvals and input requests without leaving -----

function inlineDecision(run) {
  return run.integrity && ['awaiting_approval', 'awaiting_input'].includes(run.status);
}

function inboxOpen(id) {
  return detailsOpen.get(`inbox-${id}`) === true;
}

function inboxItem(run) {
  const project = state.projects.find((entry) => entry.id === run.projectId);
  const open = inboxOpen(run.id);
  const panelId = `inbox-panel-${run.localId}-${String(run.projectId).replace(/[^A-Za-z0-9_-]/g, '')}`;
  return `<li class="inbox-item tone-wait${open ? ' is-open' : ''}"><div class="inbox-row"><button type="button" class="inbox-toggle" data-action="inbox-toggle" data-id="${escape(run.id)}" aria-expanded="${open}" aria-controls="${escape(panelId)}">${icon('chevron', 'inbox-chevron')}<span class="run-row-main"><span class="run-row-reason">${escape(decisionReason(run))}</span><strong>${escape(run.taskTitle)}</strong><small>${escape(project?.name || 'Project')} · Run ${escape(run.localId)} · ${escape(String(run.taskId).split(':').at(-1))} · <time datetime="${escape(run.updatedAt)}">${escape(relativeTime(run.updatedAt))}</time></small></span>${miniSteps(run)}</button><a class="inbox-open" href="#run/${escape(encodeURIComponent(run.id))}" aria-label="Open run ${escape(run.localId)}: ${escape(run.taskTitle)}">Open run${icon('chevron')}</a></div>${open ? `<div class="inbox-panel" id="${escape(panelId)}" role="region" aria-label="${escape(decisionReason(run))}: ${escape(run.taskTitle)}">${inboxPanel(run)}</div>` : ''}</li>`;
}

function inboxPanel(summary) {
  const entry = inbox.get(summary.id);
  if (!entry) return '<p class="inbox-loading"><span class="spinner"></span>Loading the waiting output…</p>';
  if (entry.error) return `<p class="attempt-error">${icon('alert')}<span>${escape(entry.error)}</span></p>`;
  const run = entry.run;
  if (run.status === 'awaiting_approval') return inboxApproval(run);
  if (run.status === 'awaiting_input') return inboxInput(run);
  return `<p class="decision-copy">This run moved on: ${escape(runStatuses[run.status] || run.status)}.</p>`;
}

function inboxApproval(run) {
  const attempt = run.attempts.findLast((entry) => entry.status === 'awaiting_approval');
  if (!attempt) return '<p class="decision-copy">Nothing is waiting for approval.</p>';
  const stage = run.pipeline[attempt.stageIndex] || { name: attempt.stageId };
  const next = run.pipeline[attempt.stageIndex + 1];
  const text = attempt.edited || attempt.output;
  const id = escape(run.id);
  const facts = [escape(agentName(attempt.agentId)), `attempt ${escape(attempt.n)}`, Number.isFinite(attempt.durationMs) ? escape(formatDuration(attempt.durationMs)) : ''].filter(Boolean).join(' · ');
  const verdict = attempt.verdict ? `<span class="verdict verdict-${escape(attempt.verdict.toLowerCase())}">Verdict ${escape(attempt.verdict)}</span>` : '';
  const head = `<p class="inbox-meta"><strong>${escape(stage.name)}</strong><span>${facts}</span>${verdict}</p>`;
  const output = `<figure class="output-frame inbox-output"><figcaption>${attempt.edited ? `${icon('edit')}Edited by ${escape(attempt.editedBy || 'a person')} · the original is in the run timeline` : `${icon('agent')}Output`}</figcaption><pre class="output-text" tabindex="0" aria-label="${escape(stage.name)} output">${escape(text || '(empty output)')}</pre></figure>`;
  if (inboxMode.get(run.id) === 'reject') {
    return `${head}${output}<form class="decision-form inbox-form" data-form="inbox-reject" data-run="${id}" aria-label="Request changes to ${escape(stage.name)}"><label class="field">What should change?<textarea name="feedback" data-draft="feedback" data-draft-run="${id}" rows="4" maxlength="8000" required placeholder="Be specific. The agent sees this next to its previous answer.">${escape(draft('feedback', '', run.id))}</textarea><small>The work goes back to ${escape(stage.name)} and the router picks an agent.</small></label><p class="form-error" role="alert"></p><div class="form-actions"><button type="submit" class="button button-primary">${icon('back')}Send back to ${escape(stage.name)}</button><button type="button" class="button button-secondary" data-action="inbox-mode" data-id="${id}" data-value="">Cancel</button><a class="text-button inbox-more" href="#run/${escape(encodeURIComponent(run.id))}" data-action="more-options" data-id="${id}">More options${icon('chevron')}</a></div></form>`;
  }
  return `${head}${output}<div class="decision-actions inbox-actions" role="group" aria-label="Decide on ${escape(stage.name)}"><label class="approve-note"><span class="sr-only">Note with your approval (optional)</span><input data-draft="approveComment" data-draft-run="${id}" maxlength="4000" placeholder="Add a note (optional)" value="${escape(draft('approveComment', '', run.id))}"></label><button type="button" class="button button-primary" data-action="inbox-approve" data-id="${id}">${icon('check')}Approve</button><button type="button" class="button button-secondary" data-action="inbox-mode" data-id="${id}" data-value="reject">${icon('back')}Request changes</button></div><p class="form-error" role="alert"></p><p class="decision-hint">${next ? `Approving moves the task to ${escape(next.name)}.` : 'Approving completes the run and moves the task to Done.'} To edit the output or send it to another stage, open the run.</p>`;
}

function inboxInput(run) {
  const attempt = run.attempts.findLast((entry) => entry.status === 'awaiting_input');
  const stage = run.pipeline[attempt?.stageIndex ?? run.stageIndex] || { name: 'Stage' };
  const id = escape(run.id);
  const prompt = attempt ? `<details class="prompt-peek" data-key="inbox-prompt-${escape(attempt.id)}"><summary>What this stage asks for</summary><pre class="code-block" tabindex="0">${escape(attempt.prompt)}</pre></details>` : '';
  return `<p class="inbox-meta"><strong>${escape(stage.name)}</strong><span>Assigned to a person${attempt?.reason ? ` (${escape(attempt.reason)})` : ''}</span></p>${prompt}<form class="decision-form inbox-form" data-form="inbox-submit" data-run="${id}" aria-label="Submit ${escape(stage.name)} output"><label class="field">Your ${escape(stage.name)} output<textarea name="output" data-draft="submitOutput" data-draft-run="${id}" rows="6" maxlength="524288" required>${escape(draft('submitOutput', '', run.id))}</textarea><small>What you submit becomes the stage output, as if an agent wrote it.</small></label><p class="form-error" role="alert"></p><div class="form-actions"><button type="submit" class="button button-primary">${icon('check')}Submit</button></div></form>`;
}

// Fetch the full run behind an open row; refetch only when it has moved on.
async function loadInboxRun(id, force = false) {
  const summary = state.runs.find((run) => run.id === id);
  const cached = inbox.get(id);
  if (!force && cached?.run && cached.run.lastSeq === summary?.lastSeq) return;
  try {
    inbox.set(id, { run: await api(`/runs/${encodeURIComponent(id)}`) });
  } catch (error) {
    if (error.status === 401) throw error;
    inbox.set(id, { error: error.message });
  }
}

async function refreshInbox() {
  const waiting = new Set(state.runs.filter((run) => run.needsHuman && inlineDecision(run)).map((run) => run.id));
  for (const key of [...detailsOpen.keys()]) if (key.startsWith('inbox-') && !key.startsWith('inbox-prompt-') && !waiting.has(key.slice(6))) detailsOpen.delete(key);
  for (const id of [...inbox.keys()]) if (!waiting.has(id)) { inbox.delete(id); inboxMode.delete(id); }
  for (const id of waiting) if (inboxOpen(id)) await loadInboxRun(id);
}

async function toggleInbox(id) {
  const open = !inboxOpen(id);
  detailsOpen.set(`inbox-${id}`, open);
  renderMain();
  if (!open) return;
  try { await loadInboxRun(id); } catch (error) { monitorOffline(error); }
  if (state.view === 'decisions') renderMain();
}

function setInboxMode(id, mode) {
  inboxMode.set(id, mode);
  renderMain();
  const scope = $('#main').querySelector(`[data-action="inbox-toggle"][data-id="${CSS.escape(id)}"]`)?.closest('.inbox-item');
  (mode ? scope?.querySelector('textarea') : scope?.querySelector('[data-action="inbox-approve"]'))?.focus();
}

// What happened after a decision, from the run the server returned.
function afterDecision(result, done) {
  const stage = result.currentStage?.name || 'The next stage';
  if (result.status === 'completed') return `${done} — run completed`;
  if (result.status === 'waiting') return `${done} — ${stage} is waiting for an agent`;
  if (result.status === 'awaiting_input') return `${done} — ${stage} needs your input`;
  if (result.status === 'awaiting_approval') return `${done} — ${stage} is ready for review`;
  if (result.status === 'failed') return `${done} — the run failed`;
  return `${done} — ${stage} started`;
}

async function inboxAction(id, trigger, body, message) {
  const run = inbox.get(id)?.run;
  if (!run || state.acting) return;
  const item = trigger.closest('.inbox-item');
  const errorBox = item.querySelector('.form-error');
  const buttons = [...item.querySelectorAll('button')].filter((button) => !button.disabled);
  const rows = [...$('#main').querySelectorAll('[data-action="inbox-toggle"]')].map((button) => button.dataset.id);
  const following = rows[rows.indexOf(id) + 1] || rows[rows.indexOf(id) - 1] || '';
  state.acting = true;
  buttons.forEach((button) => { button.disabled = true; });
  errorBox.textContent = '';
  try {
    const result = await api(`/runs/${encodeURIComponent(id)}/actions`, 'POST', { ...body, expectedSeq: run.lastSeq });
    state.acting = false;
    clearDrafts(id, decisionDrafts);
    inbox.delete(id);
    inboxMode.delete(id);
    detailsOpen.delete(`inbox-${id}`);
    toast(message(result));
    await refresh().catch(monitorOffline);
    const next = $('#main').querySelector(`[data-action="inbox-toggle"][data-id="${CSS.escape(following)}"]`)
      || $('#main').querySelector(`[data-action="inbox-toggle"][data-id="${CSS.escape(id)}"]`);
    (next || $('#runs-waiting'))?.focus({ preventScroll: true });
  } catch (error) {
    state.acting = false;
    buttons.forEach((button) => { if (button.isConnected) button.disabled = false; });
    if (error.status === 409) {
      toast(`${error.message.replace(/[.\s]*$/, '.')} Showing the latest state.`, true);
      await loadInboxRun(id, true).catch(() => {});
      await refresh().catch(monitorOffline);
      renderMain();
    } else errorBox.textContent = error.message;
  }
}

function inboxApprove(button) {
  const id = button.dataset.id;
  const run = inbox.get(id)?.run;
  const attempt = run?.attempts.findLast((entry) => entry.status === 'awaiting_approval');
  const stage = attempt ? run.pipeline[attempt.stageIndex]?.name : 'Stage';
  inboxAction(id, button, { action: 'approve', comment: String(draft('approveComment', '', id)).trim() }, (result) => afterDecision(result, `${stage} approved`));
}

function submitInboxForm(form, submitter) {
  const id = form.dataset.run;
  const run = inbox.get(id)?.run;
  if (!run) return;
  const errorBox = form.querySelector('.form-error');
  if (form.dataset.form === 'inbox-reject') {
    const attempt = run.attempts.findLast((entry) => entry.status === 'awaiting_approval');
    const feedback = form.elements.feedback.value.trim();
    if (!feedback) { errorBox.textContent = 'Say what should change.'; form.elements.feedback.focus(); return; }
    inboxAction(id, submitter, { action: 'reject', feedback, stageId: attempt?.stageId }, (result) => afterDecision(result, 'Changes requested'));
  } else if (form.dataset.form === 'inbox-submit') {
    const output = form.elements.output.value;
    if (!output.trim()) { errorBox.textContent = 'Write the stage output first.'; form.elements.output.focus(); return; }
    const stage = run.currentStage?.name || 'Stage';
    inboxAction(id, submitter, { action: 'submit', output }, (result) => afterDecision(result, `${stage} submitted`));
  }
}

// --- Run page ----------------------------------------------------------------------

function renderRun() {
  const run = state.run?.id === state.runId ? state.run : null;
  if (!run) {
    $('#main').innerHTML = state.runError?.id === state.runId
      ? `<div class="empty-results">${icon('alert')}<h2>Run not found</h2><p>${escape(state.runError.message)}</p><a class="button button-secondary" href="#decisions">Back to decisions</a></div>`
      : '<div class="loading-state"><span class="spinner"></span>Loading the run…</div>';
    return;
  }
  const task = state.tasks.find((entry) => entry.id === run.taskId);
  const project = state.projects.find((entry) => entry.id === run.projectId);
  const started = run.events.find((event) => event.type === 'run_started');
  const title = task?.title || run.taskTitle;
  $('#main').innerHTML = `<div class="run-page">
    <nav class="run-crumbs" aria-label="Run location"><a href="#decisions">Decisions</a><span aria-hidden="true">/</span>${project ? `<a href="#project/${escape(project.id)}">${escape(project.name)}</a>` : '<span>Project</span>'}<span aria-hidden="true">/</span><span>Run ${escape(run.localId)}</span></nav>
    <header class="run-heading">
      <h1>${task ? `<button class="title-button" data-action="open-task" data-id="${escape(task.id)}" title="Open task">${escape(title)}</button>` : escape(title)}</h1>
      <p class="run-meta">${runPill(run.status)}${run.paused ? `<span class="run-pill tone-idle">${icon('pause')}Paused</span>` : ''}<span>${escape(String(run.taskId).split(':').at(-1))}</span><span>Started by ${escape(started?.actor.id || 'unknown')} · <time datetime="${escape(run.startedAt)}">${escape(formatTime(run.startedAt))}</time></span><span>Updated <time datetime="${escape(run.updatedAt)}">${escape(relativeTime(run.updatedAt).replace(/^Just now$/, 'just now'))}</time></span></p>
    </header>
    ${stepper(run)}
    ${routingNote(run)}
    ${run.taskSyncError ? `<p class="run-warning">${icon('alert')}<span>The task could not be updated to match this run: ${escape(run.taskSyncError)}</span></p>` : ''}
    ${statusCard(run)}
    ${runControls(run)}
    <div class="run-layout">${timeline(run)}<aside class="run-aside" aria-label="Comments and audit">${commentsPanel(run)}${auditPanel(run)}</aside></div>
  </div>`;
}

function stepper(run) {
  return `<ol class="stepper" aria-label="Stages">${run.stages.map((stage, index) => {
    const current = index === run.stageIndex && run.status !== 'completed';
    const marker = stage.status === 'done' ? icon('check') : ['failed', 'cancelled'].includes(stage.status) ? icon('close') : ['awaiting_approval', 'awaiting_input'].includes(stage.status) ? icon('user') : stage.status === 'waiting' ? icon('alert') : String(index + 1);
    return `<li class="step tone-${tone(stage.status)}${current ? ' is-current' : ''}" ${current ? 'aria-current="step"' : ''}><span class="step-marker" aria-hidden="true">${marker}</span><span class="step-text"><span class="step-name">${escape(stage.name)}${stage.gate === 'approve' ? `<span class="gate-mark" title="Waits for your approval">${icon('gate')}<span class="sr-only"> (waits for your approval)</span></span>` : ''}</span><small>${stageStatuses[stage.status] || escape(stage.status)}${stage.attempts > 1 ? ` · ${stage.attempts} attempts` : ''}</small></span></li>`;
  }).join('')}</ol>`;
}

function routingNote(run) {
  const notes = (run.pipeline || []).flatMap((stage) => [
    run.pins?.[stage.id] ? `${stage.name} pinned to ${agentName(run.pins[stage.id])}` : '',
    run.exclusions?.[stage.id]?.length ? `${stage.name} avoids ${run.exclusions[stage.id].map(agentName).join(', ')}` : '',
  ]).filter(Boolean);
  return notes.length ? `<p class="routing-note">${icon('route')}<span>Routing set by a person: ${escape(notes.join('; '))}.</span></p>` : '';
}

function statusCard(run) {
  const card = (cardTone, eyebrow, title, body) => `<section class="decision-card tone-${cardTone}" id="run-status" tabindex="-1" aria-labelledby="run-status-title"><div class="decision-heading"><span class="decision-eyebrow">${eyebrow}</span><h2 id="run-status-title">${title}</h2></div>${body}</section>`;
  const stageName = escape(run.currentStage?.name || 'This stage');
  const chain = run.audit?.chain || { ok: true };
  if (!run.integrity || !chain.ok) {
    return card('fail', `${icon('shieldAlert')}Audit check failed`, 'This run is locked', `<p class="decision-copy">The audit log failed verification${chain.brokenAt ? ` at event ${escape(chain.brokenAt)}` : ''}. AGESight will not change this run.</p><pre class="error-text">${escape(chain.reason || 'No reason was recorded.')}</pre><p class="decision-copy">Inspect the git history of <code>${escape(run.path)}</code> in the project repository.</p>`);
  }
  switch (run.status) {
    case 'awaiting_approval': return approvalCard(run, card);
    case 'awaiting_input': return inputCard(run, card);
    case 'waiting':
      return card('wait', `${icon('decision')}Waiting on you`, `No agent can take ${stageName}`, `<p class="decision-copy">${escape(run.waitingReason)}</p><div class="decision-actions"><button class="button button-primary" data-action="run-act" data-run-action="takeover">${icon('user')}Take over this stage</button><button class="button button-secondary" data-action="reassign">${icon('route')}Reassign</button><a class="button button-secondary" href="#agents">${icon('agent')}Manage agents</a></div>`);
    case 'failed': {
      const choices = run.pipeline.slice(0, run.stageIndex + 1);
      const selected = draft('retryStage', run.pipeline[run.stageIndex]?.id);
      return card('fail', `${icon('alert')}Waiting on you`, `Failed at ${stageName}`, `<pre class="error-text">${escape(run.error || 'The run stopped.')}</pre><form class="decision-form retry-form" data-form="retry" aria-label="Retry run"><label class="field">Retry from<select name="stageId" data-draft="retryStage">${choices.map((stage, index) => `<option value="${escape(stage.id)}" ${stage.id === selected ? 'selected' : ''}>${escape(stage.name)}${index === run.stageIndex ? ' (failed stage)' : ''}</option>`).join('')}</select></label><button type="submit" class="button button-primary">${icon('refresh')}Retry</button><button type="button" class="button button-secondary" data-action="close-run">${icon('stop')}Close run</button><p class="form-error" role="alert"></p></form><p class="decision-hint">Retrying resets the attempt count for that stage. Closing takes the run out of Decisions and keeps its record.</p>`);
    }
    case 'completed':
      return card('done', `${icon('check')}Completed`, 'Every stage passed', '<p class="decision-copy">The task moved to Done. The full record is below and in the project repository.</p>');
    case 'cancelled': {
      const index = run.events.findLastIndex((entry) => entry.type === 'cancelled');
      const event = run.events[index];
      const closed = run.events.slice(0, index).findLast((entry) => ['run_failed', 'retried'].includes(entry.type))?.type === 'run_failed';
      const by = escape(event?.actor.id || 'a person');
      return card('idle', `${icon('stop')}${closed ? 'Closed' : 'Cancelled'}`, closed ? `Closed by ${by} after it failed` : `Cancelled by ${by}`, `${closed && run.error ? `<pre class="error-text">${escape(run.error)}</pre>` : ''}<p class="decision-copy">${escape(event?.data?.reason || 'No reason given.')} The task keeps its current status.</p>`);
    }
    default: {
      const attempt = run.attempts.findLast((entry) => ['queued', 'running'].includes(entry.status));
      if (run.needsHuman && attempt?.status === 'queued') {
        const agent = escape(agentName(attempt.agentId));
        return card('wait', `${icon('decision')}Waiting on you`, `Waiting for ${agent} to claim this stage`, `<p class="decision-copy">${agent} is a pull agent. It was given ${stageName} ${escape(relativeTime(attempt.dispatchedAt).replace(/^Just now$/, 'just now'))} and has not claimed it. Check that it is running and can reach AGESight, or move the stage to someone else.</p><div class="decision-actions"><button class="button button-primary" data-action="reassign">${icon('route')}Reassign</button><button class="button button-secondary" data-action="run-act" data-run-action="takeover">${icon('user')}Take over this stage</button></div>`);
      }
      const body = run.paused
        ? 'The current stage finishes, then nothing new starts until you resume.'
        : attempt
          ? `${agentName(attempt.agentId)} ${attempt.status === 'queued' ? 'has this queued and starts when it claims the work' : 'is working on it'}. Started ${relativeTime(attempt.dispatchedAt).replace(/^Just now$/, 'just now')}.`
          : 'Choosing an agent for this stage.';
      return card(run.paused ? 'idle' : 'run', run.paused ? `${icon('pause')}Paused` : '<span class="status-dot"></span>In progress', run.paused ? `Paused at ${stageName}` : `${stageName} is running`, `<p class="decision-copy">${escape(body)} Nothing needs you right now.</p>`);
    }
  }
}

function approvalCard(run, card) {
  const attempt = run.attempts.findLast((entry) => entry.status === 'awaiting_approval');
  if (!attempt) return card('wait', `${icon('gate')}Waiting on you`, 'Waiting for approval', '');
  const stage = run.pipeline[attempt.stageIndex] || { name: attempt.stageId };
  const next = run.pipeline[attempt.stageIndex + 1];
  const text = attempt.edited || attempt.output;
  const mode = state.decisionRun === run.id ? state.decisionMode : '';
  const verdict = attempt.verdict ? ` <span class="verdict verdict-${escape(attempt.verdict.toLowerCase())}">Verdict ${escape(attempt.verdict)}</span>` : '';
  const meta = `<p class="decision-copy">${escape(agentName(attempt.agentId))} produced this${Number.isFinite(attempt.durationMs) ? ` in ${escape(formatDuration(attempt.durationMs))}` : ''}.${verdict} ${next ? `Approving moves the task to ${escape(next.name)}.` : 'Approving completes the run and moves the task to Done.'}</p>`;
  const output = `<figure class="output-frame"><figcaption>${attempt.edited ? `${icon('edit')}Edited by ${escape(attempt.editedBy || 'a person')} · the original stays in the timeline` : `${icon('agent')}Output · attempt ${escape(attempt.n)}`}</figcaption><pre class="output-text" tabindex="0">${escape(text || '(empty output)')}</pre></figure>`;
  let body;
  if (mode === 'edit') body = meta + editForm(text);
  else if (mode === 'reject') body = meta + output + rejectForm(run, attempt);
  else body = `${meta}${output}<div class="decision-actions"><label class="approve-note"><span class="sr-only">Note with your approval (optional)</span><input data-draft="approveComment" maxlength="4000" placeholder="Add a note (optional)" value="${escape(draft('approveComment'))}"></label><button class="button button-primary" data-action="approve">${icon('check')}Approve</button><button class="button button-secondary" data-action="decision-mode" data-value="reject">${icon('back')}Request changes</button><button class="button button-secondary" data-action="decision-mode" data-value="edit">${icon('edit')}Edit output</button></div>`;
  return card('wait', `${icon('gate')}Waiting on you`, `Review the ${escape(stage.name)} output`, body);
}

function rejectForm(run, attempt) {
  const target = run.pipeline.find((stage) => stage.id === draft('rejectStage', attempt.stageId)) || run.pipeline[attempt.stageIndex];
  const agents = state.agents.filter((agent) => agent.enabled && agent.roles.includes(target.role));
  const pin = draft('rejectPin', '');
  return `<form class="decision-form" data-form="reject" aria-labelledby="reject-title"><h3 id="reject-title">Request changes</h3>
    <label class="field">What should change?<textarea name="feedback" data-draft="feedback" data-autofocus rows="5" maxlength="8000" required placeholder="Be specific. The agent sees this next to its previous answer.">${escape(draft('feedback'))}</textarea></label>
    <div class="field-row"><label class="field">Send back to<select name="stageId" data-draft="rejectStage" data-rerender>${run.pipeline.slice(0, attempt.stageIndex + 1).map((stage) => `<option value="${escape(stage.id)}" ${stage.id === target.id ? 'selected' : ''}>${escape(stage.name)}${stage.id === attempt.stageId ? ' (this stage)' : ''}</option>`).join('')}</select></label>
    <label class="field">Redo with<select name="pinAgent" data-draft="rejectPin"><option value="">Best available</option>${agents.map((agent) => `<option value="${escape(agent.id)}" ${pin === agent.id ? 'selected' : ''}>${escape(agent.name)}</option>`).join('')}</select><small>Best available lets the router choose.</small></label></div>
    ${attempt.agentId ? `<label class="check-field"><input type="checkbox" name="excludeAgent" value="${escape(attempt.agentId)}" data-draft="rejectExclude" ${draft('rejectExclude', false) ? 'checked' : ''}><span>Don’t use ${escape(agentName(attempt.agentId))} for ${escape(target.name)}</span></label>` : ''}
    <p class="form-error" role="alert"></p>
    <div class="form-actions"><button type="submit" class="button button-primary">${icon('back')}Send back</button><button type="button" class="button button-secondary" data-action="decision-mode" data-value="">Cancel</button></div></form>`;
}

function editForm(text) {
  return `<form class="decision-form" data-form="edit" aria-labelledby="edit-title"><h3 id="edit-title">Edit output</h3><label class="field">Version later stages will receive<textarea class="mono-input" name="output" data-draft="editOutput" data-autofocus rows="16" required spellcheck="false">${escape(draft('editOutput', text))}</textarea><small>The original output stays in the audit trail.</small></label><p class="form-error" role="alert"></p><div class="form-actions"><button type="submit" class="button button-primary">Save edit</button><button type="button" class="button button-secondary" data-action="decision-mode" data-value="">Cancel</button></div></form>`;
}

function inputCard(run, card) {
  const attempt = run.attempts.findLast((entry) => entry.status === 'awaiting_input');
  const stage = run.pipeline[attempt?.stageIndex ?? run.stageIndex] || { name: 'Stage' };
  const prompt = attempt ? `<details class="prompt-peek" data-key="input-prompt-${escape(attempt.id)}"><summary>What this stage asks for</summary><pre class="code-block" tabindex="0">${escape(attempt.prompt)}</pre></details>` : '';
  return card('wait', `${icon('user')}Waiting on you`, `Your turn: ${escape(stage.name)}`, `<p class="decision-copy">This stage is assigned to a person${attempt?.reason ? ` (${escape(attempt.reason)})` : ''}. What you submit becomes the stage output, as if an agent wrote it.</p>${prompt}<form class="decision-form" data-form="submit" aria-label="Submit stage output"><label class="field">Your ${escape(stage.name)} output<textarea name="output" data-draft="submitOutput" rows="10" maxlength="524288" required>${escape(draft('submitOutput'))}</textarea></label><p class="form-error" role="alert"></p><div class="form-actions"><button type="submit" class="button button-primary">${icon('check')}Submit</button></div></form>`);
}

function runControls(run) {
  const open = isActiveRun(run) && run.integrity;
  const current = run.attempts.findLast((entry) => ['queued', 'running'].includes(entry.status));
  const buttons = [
    open ? `<button class="button button-secondary" data-action="run-act" data-run-action="${run.paused ? 'resume' : 'pause'}">${icon(run.paused ? 'play' : 'pause')}${run.paused ? 'Resume' : 'Pause'}</button>` : '',
    open && run.status === 'running' && current ? `<button class="button button-secondary" data-action="run-act" data-run-action="takeover">${icon('user')}Take over</button>` : '',
    open ? `<button class="button button-secondary" data-action="reassign">${icon('route')}Reassign</button>` : '',
    `<button class="button button-secondary" data-action="focus-comment">${icon('comment')}Add comment</button>`,
    open ? `<button class="button button-quiet-danger" data-action="cancel-run">${icon('stop')}Cancel run</button>` : '',
  ];
  return `<div class="run-controls" role="group" aria-label="Run controls">${buttons.join('')}</div>`;
}

function timeline(run) {
  const attempts = [...run.attempts].reverse();
  return `<section class="timeline" aria-labelledby="timeline-title"><div class="section-heading"><h2 id="timeline-title">Timeline</h2><span>${run.attempts.length} ${run.attempts.length === 1 ? 'attempt' : 'attempts'} · newest first</span></div>${attempts.length ? `<ol class="attempt-list">${attempts.map((attempt) => `<li>${attemptItem(run, attempt)}</li>`).join('')}</ol>` : '<p class="run-empty">The first stage is being routed to an agent.</p>'}</section>`;
}

function attemptItem(run, attempt) {
  const stage = run.pipeline[attempt.stageIndex] || { name: attempt.stageId };
  const who = attempt.agentId ? agentName(attempt.agentId) : 'Person';
  const live = ['queued', 'running', 'awaiting_input'].includes(attempt.status);
  const duration = Number.isFinite(attempt.durationMs) ? formatDuration(attempt.durationMs) : live ? `Started ${relativeTime(attempt.dispatchedAt).replace(/^Just now$/, 'just now')}` : '';
  const decision = attempt.decision ? `${attempt.status === 'rejected' ? 'Sent back' : 'Approved'} by ${attempt.decision.by}${attempt.decision.comment ? `: ${clip(attempt.decision.comment)}` : ''}` : '';
  const facts = [
    ['Stage', stage.name === roleLabel(attempt.role) ? stage.name : `${stage.name} (${roleLabel(attempt.role)} role)`],
    ['Done by', attempt.runner === 'human' ? `Person${attempt.finishedBy ? ` (${attempt.finishedBy})` : ''}` : `${who} · ${attempt.runner} runner`],
    ['Routing', attempt.reason],
    ['Dispatched', formatTime(attempt.dispatchedAt)],
    attempt.finishedAt ? ['Finished', formatTime(attempt.finishedAt)] : null,
    attempt.exitCode !== undefined && attempt.exitCode !== null ? ['Exit code', attempt.exitCode] : null,
    attempt.verdict ? ['Verdict', attempt.verdict] : null,
    ['Attempt id', attempt.id],
  ].filter(Boolean);
  const block = (label, text, extra = '') => `<div class="sub-block"><h4>${label}</h4><pre class="output-text ${extra}" tabindex="0">${escape(text)}</pre></div>`;
  return `<details class="attempt tone-${tone(attempt.status)}" data-key="attempt-${escape(attempt.id)}"><summary><span class="attempt-n">#${escape(attempt.n)}</span><span class="attempt-title"><span class="attempt-line"><strong>${escape(stage.name)}</strong><span class="attempt-agent">${escape(who)}</span>${runPill(attempt.status)}${duration ? `<span class="attempt-duration">${escape(duration)}</span>` : ''}</span>${decision ? `<span class="attempt-decision">${escape(decision)}</span>` : ''}</span>${icon('chevron', 'attempt-chevron')}</summary>
    <div class="attempt-body">
      <dl class="fact-list">${facts.map(([key, value]) => `<div><dt>${key}</dt><dd>${escape(value)}</dd></div>`).join('')}${attempt.command?.length ? `<div class="fact-wide"><dt>Command</dt><dd><code class="command-line">${escape(commandText(attempt.command))}</code></dd></div>` : ''}</dl>
      ${attempt.error ? `<p class="attempt-error">${icon('alert')}<span>${escape(attempt.error)}</span></p>` : ''}
      ${attempt.decision?.comment ? `<blockquote class="decision-quote"><strong>${attempt.status === 'rejected' ? 'Feedback' : 'Note'} from ${escape(attempt.decision.by)}</strong>${escape(attempt.decision.comment)}</blockquote>` : ''}
      ${scoreTable(attempt)}
      ${attempt.output ? block('Output', attempt.output) : `<div class="sub-block"><h4>Output</h4><p class="run-empty">${live ? 'No output yet.' : 'Empty output.'}</p></div>`}
      ${attempt.edited ? block(`Edited output · by ${escape(attempt.editedBy || 'a person')}`, attempt.edited, 'is-edited') : ''}
      ${attempt.stderr ? `<details class="sub-details" data-key="stderr-${escape(attempt.id)}"><summary>Standard error</summary><pre class="code-block" tabindex="0">${escape(attempt.stderr)}</pre></details>` : ''}
      <details class="sub-details" data-key="prompt-${escape(attempt.id)}"><summary>Prompt sent to ${escape(who)}</summary><pre class="code-block" tabindex="0">${escape(attempt.prompt || '(no prompt recorded)')}</pre></details>
    </div></details>`;
}

function scoreTable(attempt) {
  if (!attempt.scoreboard?.length) return '';
  const chosen = attempt.scoreboard.find((row) => row.agentId === attempt.agentId);
  const number = (value) => (value === null || value === undefined ? '—' : escape(Number(value).toFixed(3)));
  return `<div class="sub-block"><h4>Why this agent</h4><p class="sub-caption">Scores when the stage was dispatched. Score = quality + exploration + tier fit + latency.</p><div class="table-scroll"><table class="data-table score-table"><thead><tr><th scope="col">Agent</th><th scope="col">Tier</th><th scope="col" class="num">Score</th><th scope="col" class="num">Success</th><th scope="col" class="num">Attempts</th><th scope="col">Reason</th></tr></thead><tbody>${attempt.scoreboard.map((row) => `<tr class="${row.agentId === attempt.agentId ? 'is-chosen' : ''}${row.eligible ? '' : ' is-ineligible'}"><th scope="row">${escape(row.name || row.agentId)}${row.agentId === attempt.agentId ? '<span class="chosen-tag">Chosen</span>' : ''}</th><td>${escape(tierLabel(row.tier))}</td><td class="num">${number(row.score)}</td><td class="num">${percent(row.successRate)}</td><td class="num">${escape(row.attempts ?? 0)}</td><td>${escape(row.reason)}</td></tr>`).join('')}</tbody></table></div>${chosen?.parts ? `<p class="sub-caption">${escape(chosen.name || chosen.agentId)}: quality ${number(chosen.parts.quality)} + exploration ${number(chosen.parts.explore)} + tier fit ${number(chosen.parts.tierFit)} + latency ${number(chosen.parts.latency)} = ${number(chosen.score)}</p>` : ''}</div>`;
}

function commentsPanel(run) {
  const stageName = (id) => run.pipeline.find((stage) => stage.id === id)?.name || id;
  return `<section class="side-panel" aria-labelledby="comments-title"><div class="section-heading"><h2 id="comments-title">Comments</h2><span>${run.comments.length}</span></div>${run.comments.length ? `<ol class="comment-list">${run.comments.map((comment) => `<li><p>${escape(comment.text)}</p><span>${escape(comment.by)}${comment.stageId ? ` · ${escape(stageName(comment.stageId))}` : ''} · <time datetime="${escape(comment.at)}">${escape(formatTime(comment.at))}</time></span></li>`).join('')}</ol>` : '<p class="run-empty">Notes you add are saved in the audit trail.</p>'}<form class="comment-form" data-form="comment" aria-label="Add a comment"><label class="field">Add a comment<textarea id="comment-text" name="text" data-draft="comment" rows="3" maxlength="4000" required placeholder="Context for later, or for whoever picks this up">${escape(draft('comment'))}</textarea></label><p class="form-error" role="alert"></p><button type="submit" class="button button-secondary">Add comment</button></form></section>`;
}

function eventSummary(run, event) {
  const data = event.data || {};
  const stage = (id) => run.pipeline.find((entry) => entry.id === id)?.name || id;
  switch (event.type) {
    case 'run_started': return `Pipeline: ${(data.pipeline || []).map((entry) => entry.name).join(' → ')}`;
    case 'attempt_dispatched': return `${stage(data.stageId)} #${data.attempt} → ${data.runner === 'human' ? 'a person' : data.agentId} (${data.reason})`;
    case 'attempt_claimed': case 'lease_renewed': return `#${data.attempt}, lease until ${formatTime(data.leaseUntil)}`;
    case 'lease_expired': return `#${data.attempt} returned to the queue`;
    case 'attempt_finished': return `#${data.attempt} ${data.outcome}${data.verdict ? `, verdict ${data.verdict}` : ''}${data.error ? `: ${data.error}` : ''}`;
    case 'attempt_cancelled': return `#${data.attempt}: ${data.reason}`;
    case 'gate_opened': return `#${data.attempt} waits for approval`;
    case 'output_edited': return `#${data.attempt} → ${data.file}`;
    case 'approved': return `#${data.attempt}${data.comment ? `: ${data.comment}` : ''}`;
    case 'rejected': return `#${data.attempt} → ${stage(data.targetStage)}: ${data.feedback}`;
    case 'routing_set': return `${stage(data.stageId)}: ${data.pinAgent ? `pinned to ${data.pinAgent}` : 'router decides'}${data.exclude?.length ? `, avoids ${data.exclude.join(', ')}` : ''}`;
    case 'stage_moved': return `${run.pipeline[data.from]?.name || '—'} → ${run.pipeline[data.to]?.name || '—'}${data.reason ? ` (${data.reason})` : ''}`;
    case 'retried': return `From ${stage(data.stageId)}`;
    case 'waiting': case 'run_failed': case 'run_completed': case 'cancelled': return data.reason || '';
    case 'commented': return data.text;
    case 'task_sync_failed': return data.error;
    default: return Object.keys(data).join(', ');
  }
}

function auditPanel(run) {
  const chain = run.audit?.chain || { ok: false, count: run.events.length };
  const artifacts = run.audit?.artifacts || { ok: true, mismatches: [] };
  return `<section class="side-panel audit-panel" aria-labelledby="audit-title"><div class="section-heading"><h2 id="audit-title">Audit trail</h2></div>
    <p class="audit-badge ${chain.ok ? 'is-ok' : 'is-bad'}">${icon(chain.ok ? 'shield' : 'shieldAlert')}<span>${chain.ok ? `Audit chain verified · ${escape(chain.count)} events` : `Audit check failed at event ${escape(chain.brokenAt ?? '?')}${chain.reason ? `: ${escape(chain.reason)}` : ''}`}</span></p>
    <p class="audit-badge ${artifacts.ok ? 'is-ok' : 'is-bad'}">${icon(artifacts.ok ? 'check' : 'alert')}<span>${artifacts.ok ? 'Every prompt and output matches its recorded hash' : `${artifacts.mismatches.length} ${artifacts.mismatches.length === 1 ? 'file changed' : 'files changed'} after recording`}</span></p>
    ${artifacts.mismatches.length ? `<ul class="mismatch-list">${artifacts.mismatches.map((path) => `<li><code>${escape(path)}</code></li>`).join('')}</ul>` : ''}
    <p class="audit-path">Stored in the project repository at <code>${escape(run.path)}</code>. Each change is one git commit.</p>
    <details class="event-log" data-key="events-${escape(run.id)}"><summary>All events (${run.events.length})</summary><ol>${run.events.map((event) => `<li><details data-key="event-${escape(run.id)}-${escape(event.seq)}"><summary><span class="event-seq">${escape(event.seq)}</span><span class="event-main"><span class="event-type">${escape(String(event.type).replace(/_/g, ' '))}</span><span class="event-summary">${escape(clip(eventSummary(run, event), 160))}</span><span class="event-meta">${escape(event.actor?.type)}: ${escape(event.actor?.id)} · <time datetime="${escape(event.at)}">${escape(formatTime(event.at))}</time></span></span></summary><pre class="code-block" tabindex="0">${escape(JSON.stringify(event, null, 2))}</pre></details></li>`).join('')}</ol></details>
  </section>`;
}

// --- Run actions -------------------------------------------------------------------

function setDecisionMode(mode) {
  state.decisionMode = mode;
  state.decisionRun = state.runId;
  renderMain();
  if (mode) $('#main').querySelector('[data-autofocus]')?.focus();
  else $('#main').querySelector('[data-action="approve"]')?.focus();
}

function approveRun(button) {
  const attempt = state.run?.attempts.findLast((entry) => entry.status === 'awaiting_approval');
  const stage = attempt ? state.run.pipeline[attempt.stageIndex]?.name : '';
  runAction(button, { action: 'approve', comment: String(draft('approveComment', '')).trim() }, (result) => afterDecision(result, `${stage || 'Stage'} approved`));
}

// Every decision carries the lastSeq the person saw; a 409 means the run moved
// on, so show the new state rather than apply the decision to it.
async function runAction(trigger, body, message, { errorBox, dialog } = {}) {
  const run = state.run;
  if (!run || state.acting) return false;
  state.acting = true;
  const scope = dialog || $('#main');
  const buttons = [...scope.querySelectorAll('button')].filter((button) => !button.disabled);
  buttons.forEach((button) => { button.disabled = true; });
  if (errorBox) errorBox.textContent = '';
  try {
    const payload = body.action === 'comment' ? body : { ...body, expectedSeq: run.lastSeq };
    const result = await api(`/runs/${encodeURIComponent(run.id)}/actions`, 'POST', payload);
    state.acting = false;
    if (dialog) closeDialog(dialog);
    if (body.action === 'comment') clearDrafts(run.id, ['comment']);
    else { clearDrafts(run.id, decisionDrafts); state.decisionMode = ''; }
    state.run = result;
    render();
    (body.action === 'comment' ? $('#comment-text') : $('#run-status'))?.focus({ preventScroll: true });
    toast(typeof message === 'function' ? message(result) : message);
    refresh().catch(monitorOffline);
    return true;
  } catch (error) {
    state.acting = false;
    buttons.forEach((button) => { if (button.isConnected) button.disabled = false; });
    if (error.status === 409) {
      if (dialog) closeDialog(dialog);
      toast(error.message, true);
      await refresh().catch(monitorOffline);
    } else if (errorBox) errorBox.textContent = error.message;
    else toast(error.message, true);
    return false;
  }
}

function submitRunForm(form, submitter) {
  const run = state.run;
  if (!run) return;
  const errorBox = form.querySelector('.form-error');
  const fields = form.elements;
  const stageName = (id) => run.pipeline.find((stage) => stage.id === id)?.name || 'the stage';
  switch (form.dataset.form) {
    case 'reject': {
      const feedback = fields.feedback.value.trim();
      const stageId = fields.stageId.value;
      const pinAgent = fields.pinAgent.value;
      const excludeAgent = fields.excludeAgent?.checked ? fields.excludeAgent.value : '';
      if (!feedback) { errorBox.textContent = 'Say what should change.'; fields.feedback.focus(); return; }
      if (excludeAgent && pinAgent === excludeAgent) { errorBox.textContent = `You chose ${agentName(pinAgent)} to redo it and also excluded it. Pick one.`; return; }
      runAction(submitter, { action: 'reject', feedback, stageId, ...(pinAgent ? { pinAgent } : {}), ...(excludeAgent ? { excludeAgent } : {}) }, `Sent back to ${stageName(stageId)}`, { errorBox });
      break;
    }
    case 'edit': runAction(submitter, { action: 'edit', output: fields.output.value }, 'Edit saved. Approve when ready.', { errorBox }); break;
    case 'submit': runAction(submitter, { action: 'submit', output: fields.output.value }, 'Submitted', { errorBox }); break;
    case 'retry': runAction(submitter, { action: 'retry', stageId: fields.stageId.value }, `Retrying from ${stageName(fields.stageId.value)}`, { errorBox }); break;
    case 'comment': {
      const text = fields.text.value.trim();
      if (!text) { errorBox.textContent = 'Write a comment first.'; return; }
      runAction(submitter, { action: 'comment', text }, 'Comment added', { errorBox });
      break;
    }
  }
}

function dialogHeading(eyebrow, title, closeLabel) {
  return `<header class="dialog-heading"><div><span class="dialog-eyebrow">${eyebrow}</span><h2 id="action-dialog-title">${title}</h2></div><button type="button" class="icon-button" data-close aria-label="${closeLabel}">${icon('close')}</button></header>`;
}

function openReassign() {
  const run = state.run;
  if (!run) return;
  const dialog = $('#action-dialog');
  const current = run.attempts.findLast((entry) => ['queued', 'running'].includes(entry.status));
  dialog.innerHTML = `<form id="reassign-form">${dialogHeading(`Run ${escape(run.localId)}`, 'Reassign a stage', 'Close reassign')}<div class="dialog-fields"><p class="dialog-copy">Choose who takes a stage the next time it runs. The choice is recorded in the audit trail.</p><label class="field">Stage<select name="stageId">${run.pipeline.map((stage, index) => `<option value="${escape(stage.id)}" ${index === run.stageIndex ? 'selected' : ''}>${escape(stage.name)}${index === run.stageIndex ? ' (current)' : ''}</option>`).join('')}</select></label><div id="reassign-detail"></div><p class="form-error" role="alert"></p></div><footer class="dialog-footer"><button type="button" class="button button-secondary" data-close>Cancel</button><button type="submit" class="button button-primary">Save routing</button></footer></form>`;
  const form = $('#reassign-form');
  const detail = () => {
    const index = run.pipeline.findIndex((stage) => stage.id === form.elements.stageId.value);
    const stage = run.pipeline[index];
    const pinned = run.pins?.[stage.id] || '';
    const excluded = run.exclusions?.[stage.id] || [];
    const agents = state.agents.filter((agent) => agent.roles.includes(stage.role));
    form.querySelector('#reassign-detail').innerHTML = `<label class="field">Agent<select name="pinAgent"><option value="">Best available (router decides)</option>${agents.map((agent) => `<option value="${escape(agent.id)}" ${pinned === agent.id ? 'selected' : ''} ${agent.enabled ? '' : 'disabled'}>${escape(agent.name)}${agent.enabled ? '' : ' (disabled)'}</option>`).join('')}</select><small>${stage.pinnedAgent ? `The pipeline pins this stage to ${escape(agentName(stage.pinnedAgent))} unless you choose an agent here.` : `Agents that take the ${escape(roleLabel(stage.role).toLowerCase())} role.`}</small></label>${excluded.length ? `<label class="check-field"><input type="checkbox" name="clearExclusions"><span>Allow ${escape(excluded.map(agentName).join(', '))} again</span></label>` : ''}${current && current.stageIndex === index && current.runner !== 'human' ? `<label class="check-field"><input type="checkbox" name="restart"><span>Stop ${escape(agentName(current.agentId))} and restart this stage now</span></label>` : ''}`;
  };
  detail();
  form.elements.stageId.addEventListener('change', detail);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const body = { action: 'route', stageId: form.elements.stageId.value, pinAgent: form.elements.pinAgent.value, restart: Boolean(form.elements.restart?.checked) };
    if (form.elements.clearExclusions?.checked) body.exclude = [];
    runAction(event.submitter, body, 'Routing updated', { errorBox: form.querySelector('.form-error'), dialog });
  });
  setupDialog(dialog);
}

function openCancelRun() {
  const run = state.run;
  if (!run) return;
  const closing = run.status === 'failed';
  const dialog = $('#action-dialog');
  const copy = closing
    ? 'The run stops waiting on you and leaves Decisions. It cannot be retried afterwards. The task keeps its status, and the failure and everything before it stay in the audit trail.'
    : 'Any running agent is stopped and the run cannot be resumed. The task keeps its status, and everything so far stays in the audit trail.';
  dialog.innerHTML = `<form id="cancel-form">${dialogHeading(escape(run.taskTitle), `${closing ? 'Close' : 'Cancel'} run ${escape(run.localId)}?`, 'Close dialog')}<div class="dialog-fields"><p class="dialog-copy">${copy}</p><label class="field">Reason <span class="field-optional">optional</span><textarea name="reason" rows="3" maxlength="2000" placeholder="${closing ? 'e.g. Superseded by a manual fix' : ''}"></textarea></label><p class="form-error" role="alert"></p></div><footer class="dialog-footer"><button type="button" class="button button-secondary" data-close autofocus>${closing ? 'Keep it open' : 'Keep running'}</button><button type="submit" class="button button-danger">${icon('stop')}${closing ? 'Close run' : 'Cancel run'}</button></footer></form>`;
  const form = $('#cancel-form');
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    runAction(event.submitter, { action: 'cancel', reason: form.elements.reason.value.trim() }, closing ? 'Run closed' : 'Run cancelled', { errorBox: form.querySelector('.form-error'), dialog });
  });
  setupDialog(dialog);
}

// --- Agents page -------------------------------------------------------------------

function agentPerformance(agent, role) {
  return agent.performance?.[role] || { attempts: 0, successes: 0, failures: 0, rejections: 0, successRate: null, meanDurationMs: null };
}

// Shell-style quoting so a recorded argv reads, and pastes, exactly as it ran.
function commandText(command = []) {
  return command.map((part) => (/^[A-Za-z0-9_@%+=:,./-]+$/.test(part) ? part : `'${part.replace(/'/g, `'\\''`)}'`)).join(' ');
}

function rolesText(roles) {
  return roles.map(roleLabel).join(', ');
}

const bypassesPermissions = (part) => part === '--dangerously-skip-permissions' || part.includes('bypassPermissions');

// Where an agent runs with permission prompts switched off: everywhere when the
// flag is in its base command, otherwise only in its acting roles.
function unrestrictedIn({ runner = 'command', command = [], actArgs = [], actRoles = [], roles = [] }) {
  if (runner !== 'command') return [];
  if (command.some(bypassesPermissions)) return roles;
  return actArgs.some(bypassesPermissions) ? actRoles.filter((role) => roles.includes(role)) : [];
}

function unrestrictedWarning(agent) {
  const roles = unrestrictedIn(agent);
  if (!roles.length) return '';
  const where = (agent.command || []).some(bypassesPermissions) ? 'every role' : rolesText(roles);
  return `Runs any command your account can run, without asking, in: ${where}. Task text and earlier outputs reach it as input.`;
}

function actingApplies(agent, role) {
  return agent.runner === 'command' && (agent.actArgs || []).length > 0 && (agent.actRoles || []).includes(role);
}

function renderAgents() {
  const board = ROLES.map((role) => {
    const rows = state.agents.filter((agent) => agent.roles.includes(role)).sort((a, b) => {
      const first = agentPerformance(a, role);
      const second = agentPerformance(b, role);
      return (second.successRate ?? -1) - (first.successRate ?? -1) || second.attempts - first.attempts || a.name.localeCompare(b.name);
    });
    return `<section class="role-card" aria-labelledby="role-${role}"><h3 id="role-${role}">${roleLabel(role)}</h3>${rows.length ? `<div class="table-scroll"><table class="data-table"><thead><tr><th scope="col">Agent</th><th scope="col" class="num">Attempts</th><th scope="col" class="num">Success</th><th scope="col" class="num">Failed</th><th scope="col" class="num">Sent back</th><th scope="col" class="num">Mean time</th></tr></thead><tbody>${rows.map((agent, index) => {
      const stats = agentPerformance(agent, role);
      const unrestricted = unrestrictedIn(agent).includes(role);
      const acting = unrestricted || actingApplies(agent, role);
      const actTag = acting ? `<span class="act-tag${unrestricted ? ' is-unrestricted' : ''}" title="${escape(unrestricted ? `Runs without permission prompts in this role: ${commandText(agent.command.some(bypassesPermissions) ? agent.command : agent.actArgs)}` : `Adds ${commandText(agent.actArgs)} in this role`)}">${unrestricted ? 'No prompts' : 'Acts'}<span class="sr-only">: ${escape(unrestricted ? 'runs commands without asking in this role' : `adds ${commandText(agent.actArgs)} in this role`)}</span></span>` : '';
      return `<tr class="${agent.enabled ? '' : 'is-ineligible'}"><th scope="row"><span class="rank">${index + 1}</span>${escape(agent.name)}${agent.enabled ? '' : '<span class="off-tag">Off</span>'}${actTag}</th><td class="num">${escape(stats.attempts)}</td><td class="num"><strong>${percent(stats.successRate)}</strong></td><td class="num">${escape(stats.failures)}</td><td class="num">${escape(stats.rejections)}</td><td class="num">${stats.meanDurationMs === null ? '—' : escape(formatDuration(stats.meanDurationMs))}</td></tr>`;
    }).join('')}</tbody></table></div>` : '<p class="run-empty">No agent takes this role.</p>'}</section>`;
  }).join('');
  const cards = state.agents.map((agent) => {
    const warning = unrestrictedWarning(agent);
    const acting = agent.runner === 'command' && (agent.actRoles || []).length && (agent.actArgs || []).length
      ? `<span class="act-line">+ <code>${escape(commandText(agent.actArgs))}</code> in ${escape(rolesText(agent.actRoles))}</span>` : '';
    return `<article class="agent-card${agent.enabled ? '' : ' is-disabled'}" aria-labelledby="agent-${escape(agent.id)}-name">
      <header class="agent-card-head"><span class="agent-symbol">${icon('agent')}</span><div class="agent-title"><h3 id="agent-${escape(agent.id)}-name">${escape(agent.name)}</h3><small>${escape(agent.id)} · ${escape(tierLabel(agent.tier))} · ${agent.runner === 'pull' ? 'Pull runner' : 'Command runner'}</small></div>
      <label class="switch"><input type="checkbox" id="agent-toggle-${escape(agent.id)}" data-agent-toggle="${escape(agent.id)}" ${agent.enabled ? 'checked' : ''}><span class="switch-track" aria-hidden="true"></span><span class="switch-text" aria-hidden="true">${agent.enabled ? 'On' : 'Off'}</span><span class="sr-only">${escape(agent.name)} enabled</span></label></header>
      ${agent.description ? `<p class="agent-description">${escape(agent.description)}</p>` : ''}
      ${warning ? `<p class="agent-warning">${icon('alert')}<span>${escape(warning)}</span></p>` : ''}
      <dl class="fact-list agent-facts">${agent.runner === 'command' ? `<div class="fact-wide"><dt>Command</dt><dd><code>${escape(commandText(agent.command))}</code>${acting}</dd></div>` : ''}<div class="fact-wide"><dt>Working directory</dt><dd>${agent.cwd ? `<code>${escape(agent.cwd)}</code>` : 'The project repository'}</dd></div><div><dt>Roles</dt><dd>${escape(agent.roles.map(roleLabel).join(', '))}</dd></div><div><dt>Running now</dt><dd>${escape(agent.active || 0)} of ${escape(agent.maxConcurrent)}</dd></div><div><dt>Timeout</dt><dd>${escape(formatDuration(agent.timeoutSec * 1000))}</dd></div></dl>
      <footer class="agent-card-foot"><button class="button button-secondary" data-action="edit-agent" data-id="${escape(agent.id)}">${icon('edit')}Edit</button></footer>
    </article>`;
  }).join('');
  const enabled = state.agents.filter((agent) => agent.enabled).length;
  $('#main').innerHTML = `<section class="page-heading"><div><h1>Agents</h1><p>Who can take each stage, and how each has performed. Results come from the audit log of every run.</p></div><button class="button button-primary" data-action="add-agent">${icon('plus')}Add agent</button></section>
    <section class="agents-section" aria-labelledby="leaderboard-title"><div class="section-heading"><h2 id="leaderboard-title">Performance by role</h2><span>Approved or passed attempts count as successes</span></div><div class="role-grid">${board}</div></section>
    <section class="agents-section" aria-labelledby="registry-title"><div class="section-heading"><h2 id="registry-title">Registered agents</h2><span>${enabled} of ${state.agents.length} enabled</span></div>${state.agents.length ? `<div class="agent-grid">${cards}</div>` : `<div class="empty-results">${icon('agent')}<h2>No agents registered</h2><p>Add an agent so runs have someone to route work to.</p></div>`}</section>`;
}

async function toggleAgent(input) {
  const agent = state.agents.find((entry) => entry.id === input.dataset.agentToggle);
  if (!agent) return;
  const enabled = input.checked;
  input.disabled = true;
  try {
    await api(`/agents/${encodeURIComponent(agent.id)}`, 'PATCH', { enabled, version: agent.version });
    await refresh();
    toast(`${agent.name} ${enabled ? 'enabled' : 'disabled'}`);
  } catch (error) {
    input.checked = !enabled;
    toast(error.message, true);
    if (error.status === 409) await refresh().catch(monitorOffline);
  } finally { if (input.isConnected) input.disabled = false; }
}

function openAgentEditor(agent = null) {
  const dialog = $('#action-dialog');
  const value = (key, fallback = '') => escape(agent?.[key] ?? fallback);
  dialog.innerHTML = `<form id="agent-form">${dialogHeading('Agent registry', agent ? `Edit ${escape(agent.name)}` : 'Add agent', 'Close agent editor')}<div class="dialog-fields">
    ${agent ? '' : '<label class="field">Id<input name="agentId" required maxlength="40" pattern="[a-z0-9][a-z0-9\\-]{0,39}" placeholder="e.g. codex-review" spellcheck="false" autofocus><small>Lowercase letters, digits, and hyphens. It cannot change later.</small></label>'}
    <label class="field">Name<input name="name" required maxlength="80" value="${value('name')}" ${agent ? 'autofocus' : ''}></label>
    <label class="field">Description <span class="field-optional">optional</span><input name="description" maxlength="300" value="${value('description')}"></label>
    <div class="field-row"><label class="field">Runner<select name="runner"><option value="command" ${agent?.runner !== 'pull' ? 'selected' : ''}>Command: AGESight starts it</option><option value="pull" ${agent?.runner === 'pull' ? 'selected' : ''}>Pull: it asks for work</option></select></label><label class="field">Preferred tier<select name="tier">${TIERS.map((tier) => `<option value="${tier}" ${(agent?.tier || 'sonnet') === tier ? 'selected' : ''}>${tierLabel(tier)}</option>`).join('')}</select></label></div>
    <label class="field">Command <span class="field-optional">one argument per line</span><textarea name="command" rows="5" class="mono-input" spellcheck="false">${escape((agent?.command || []).join('\n'))}</textarea><small>Run without a shell. The stage prompt arrives on standard input; standard output becomes the stage output.</small></label>
    <label class="field">Working directory <span class="field-optional">optional</span><input name="cwd" maxlength="500" spellcheck="false" placeholder="Absolute path. Defaults to the project repository." value="${value('cwd')}"></label>
    <fieldset class="check-group"><legend>Roles</legend>${ROLES.map((role) => `<label class="check-field"><input type="checkbox" name="roles" value="${role}" ${!agent || agent.roles.includes(role) ? 'checked' : ''}><span>${roleLabel(role)}</span></label>`).join('')}</fieldset>
    <div class="acting-box">
      <label class="field">Acting arguments <span class="field-optional">one per line</span><textarea name="actArgs" rows="2" class="mono-input" spellcheck="false" aria-describedby="acting-help" placeholder="e.g. --dangerously-skip-permissions">${escape((agent?.actArgs || []).join('\n'))}</textarea></label>
      <fieldset class="check-group acting-roles" aria-describedby="acting-help"><legend>Acting roles</legend><div id="acting-roles"></div></fieldset>
      <p class="acting-help" id="acting-help">Added only in these roles. Use for flags that let the agent change files or run commands.</p>
      <p class="agent-warning" id="agent-dialog-warning" role="status" hidden></p>
    </div>
    <div class="field-row"><label class="field">Runs at once<input name="maxConcurrent" type="number" min="1" max="16" required value="${value('maxConcurrent', 1)}"></label><label class="field">Timeout in seconds<input name="timeoutSec" type="number" min="5" max="86400" required value="${value('timeoutSec', 900)}"></label></div>
    <label class="check-field"><input type="checkbox" name="enabled" ${!agent || agent.enabled ? 'checked' : ''}><span>Enabled: the router may choose this agent</span></label>
    <p class="form-error" id="agent-error" role="alert"></p>
  </div><footer class="dialog-footer"><button type="button" class="button button-secondary" data-close>Cancel</button><button type="submit" class="button button-primary">${agent ? 'Save agent' : 'Add agent'}</button></footer></form>`;
  const form = $('#agent-form');
  const lines = (name) => String(form.elements[name].value || '').split('\n').map((line) => line.trim()).filter(Boolean);
  const selectedRoles = () => [...form.querySelectorAll('[name="roles"]:checked')].map((input) => input.value);
  // Acting roles are limited to the roles the agent takes; a role unticked and
  // ticked again keeps its acting choice while the dialog is open.
  const acting = new Set(agent?.actRoles || []);
  const drawActing = () => {
    const roles = selectedRoles();
    $('#acting-roles').innerHTML = roles.length
      ? roles.map((role) => `<label class="check-field"><input type="checkbox" name="actRoles" value="${role}" ${acting.has(role) ? 'checked' : ''}><span>${roleLabel(role)}</span></label>`).join('')
      : '<p class="acting-empty">Choose the agent’s roles first.</p>';
  };
  const drawWarning = () => {
    const text = unrestrictedWarning({ runner: form.elements.runner.value, command: lines('command'), actArgs: lines('actArgs'), actRoles: [...acting], roles: selectedRoles() });
    const box = $('#agent-dialog-warning');
    box.hidden = !text;
    box.innerHTML = text ? `${icon('alert')}<span>${escape(text)}</span>` : '';
  };
  drawActing();
  drawWarning();
  form.addEventListener('change', (event) => {
    if (event.target.name === 'roles') drawActing();
    if (event.target.name === 'actRoles') event.target.checked ? acting.add(event.target.value) : acting.delete(event.target.value);
    drawWarning();
  });
  form.addEventListener('input', (event) => { if (['command', 'actArgs'].includes(event.target.name)) drawWarning(); });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const button = form.querySelector('[type="submit"]');
    const body = {
      name: String(data.get('name')).trim(),
      description: String(data.get('description') || '').trim(),
      runner: data.get('runner'),
      tier: data.get('tier'),
      command: lines('command'),
      actArgs: lines('actArgs'),
      cwd: String(data.get('cwd') || '').trim(),
      roles: data.getAll('roles'),
      actRoles: data.getAll('actRoles'),
      maxConcurrent: Number(data.get('maxConcurrent')),
      timeoutSec: Number(data.get('timeoutSec')),
      enabled: form.querySelector('[name="enabled"]').checked,
    };
    if (!body.roles.length) { $('#agent-error').textContent = 'Choose at least one role.'; return; }
    if (agent) body.version = agent.version; else body.id = String(data.get('agentId')).trim();
    button.disabled = true;
    $('#agent-error').textContent = '';
    try {
      await api(agent ? `/agents/${encodeURIComponent(agent.id)}` : '/agents', agent ? 'PATCH' : 'POST', body);
      closeDialog(dialog);
      await refresh();
      toast(agent ? 'Agent saved' : 'Agent added');
    } catch (error) { $('#agent-error').textContent = error.message; } finally { button.disabled = false; }
  });
  setupDialog(dialog);
}

// --- Pipeline editor ---------------------------------------------------------------

function stageEditorRow(stage, index, stages) {
  const field = (label, control) => `<label class="field">${label}${control}</label>`;
  const select = (key, values, current) => `<select data-field="${key}">${Object.entries(values).map(([option, label]) => `<option value="${escape(option)}" ${current === option ? 'selected' : ''}>${escape(label)}</option>`).join('')}</select>`;
  const agents = { '': 'Router decides', ...Object.fromEntries(state.agents.map((agent) => [agent.id, agent.name])) };
  if (stage.pinnedAgent && !(stage.pinnedAgent in agents)) agents[stage.pinnedAgent] = `${stage.pinnedAgent} (not registered)`;
  const label = escape(stage.name || `stage ${index + 1}`);
  return `<li class="stage-edit" data-index="${index}"><div class="stage-edit-head"><span class="stage-number">${index + 1}</span><strong class="stage-edit-name">${escape(stage.name || 'New stage')}</strong><span class="stage-edit-tools"><button type="button" class="icon-button" data-stage-move="-1" aria-label="Move ${label} up" ${index === 0 ? 'disabled' : ''}>${icon('up')}</button><button type="button" class="icon-button" data-stage-move="1" aria-label="Move ${label} down" ${index === stages.length - 1 ? 'disabled' : ''}>${icon('down')}</button><button type="button" class="icon-button" data-stage-remove aria-label="Remove ${label}" ${stages.length === 1 ? 'disabled' : ''}>${icon('trash')}</button></span></div>
    <div class="stage-edit-grid">
      ${field('Name', `<input data-field="name" required maxlength="60" value="${escape(stage.name)}">`)}
      ${field('Id', `<input data-field="id" required maxlength="30" pattern="[a-z][a-z0-9\\-]{0,29}" spellcheck="false" value="${escape(stage.id)}">`)}
      ${field('Role', select('role', Object.fromEntries(ROLES.map((role) => [role, roleLabel(role)])), stage.role))}
      ${field('Preferred tier', select('tier', Object.fromEntries(TIERS.map((tier) => [tier, tierLabel(tier)])), stage.tier))}
      ${field('Done by', select('executor', { agent: 'An agent', human: 'A person' }, stage.executor))}
      ${field('After it succeeds', select('gate', { none: 'Continue automatically', approve: 'Wait for my approval' }, stage.gate))}
      ${field('Attempts allowed', `<input data-field="maxAttempts" type="number" min="1" max="10" required value="${escape(stage.maxAttempts)}">`)}
      ${field('If it fails', `<select data-field="onFail">${onFailOptions(stage, index, stages)}</select>`)}
      ${field('Always use', select('pinnedAgent', agents, stage.pinnedAgent || ''))}
    </div>
    <label class="check-field"><input type="checkbox" data-field="verdict" ${stage.verdict ? 'checked' : ''}><span>Agent must end with VERDICT: PASS or VERDICT: FAIL</span></label>
    <label class="field">Instructions<textarea data-field="instructions" rows="3" maxlength="8000">${escape(stage.instructions || '')}</textarea></label></li>`;
}

function onFailOptions(stage, index, stages) {
  const values = { retry: 'Retry this stage', stop: 'Stop the run', ...Object.fromEntries(stages.slice(0, index).map((entry) => [`goto:${entry.id}`, `Go back to ${entry.name || entry.id}`])) };
  if (!(stage.onFail in values)) values[stage.onFail] = `${stage.onFail} (not an earlier stage)`;
  return Object.entries(values).map(([option, label]) => `<option value="${escape(option)}" ${stage.onFail === option ? 'selected' : ''}>${escape(label)}</option>`).join('');
}

async function openPipelineEditor(project) {
  if (!project) return;
  const dialog = $('#pipeline-dialog');
  dialog.innerHTML = '<div class="loading-state dialog-loading"><span class="spinner"></span>Loading the pipeline…</div>';
  setupDialog(dialog);
  let pipeline;
  try { pipeline = await api(`/projects/${encodeURIComponent(project.id)}/pipeline`); } catch (error) {
    dialog.innerHTML = `<header class="dialog-heading"><div><span class="dialog-eyebrow">${escape(project.name)}</span><h2 id="pipeline-dialog-title">Pipeline</h2></div><button type="button" class="icon-button" data-close aria-label="Close pipeline editor">${icon('close')}</button></header><div class="dialog-fields"><p class="form-error" role="alert">${escape(error.message)}</p></div>`;
    setupDialog(dialog);
    return;
  }
  let stages = pipeline.stages.map((stage) => ({ ...stage }));
  dialog.innerHTML = `<form id="pipeline-form"><header class="dialog-heading"><div><span class="dialog-eyebrow">${escape(project.name)}</span><h2 id="pipeline-dialog-title">Pipeline</h2></div><button type="button" class="icon-button" data-close aria-label="Close pipeline editor">${icon('close')}</button></header>
    <div class="dialog-fields"><p class="dialog-copy">Stages run in order. Runs already in progress keep the pipeline they started with.${pipeline.isDefault ? ' This project uses the default pipeline.' : ''}</p><ol class="stage-editor" id="stage-editor"></ol><button type="button" class="button button-secondary" data-stage-add>${icon('plus')}Add stage</button><p class="form-error" id="pipeline-error" role="alert"></p></div>
    <footer class="dialog-footer"><button type="button" class="button button-secondary" data-close>Cancel</button><button type="submit" class="button button-primary">Save pipeline</button></footer></form>`;
  const form = $('#pipeline-form');
  const list = $('#stage-editor');
  const read = () => {
    stages = [...list.children].map((row) => {
      const get = (key) => row.querySelector(`[data-field="${key}"]`);
      return { id: get('id').value.trim(), name: get('name').value.trim(), role: get('role').value, tier: get('tier').value, executor: get('executor').value, gate: get('gate').value, verdict: get('verdict').checked, maxAttempts: Number(get('maxAttempts').value), onFail: get('onFail').value, pinnedAgent: get('pinnedAgent').value, instructions: get('instructions').value };
    });
  };
  const draw = () => { list.innerHTML = stages.map(stageEditorRow).join(''); };
  draw();
  list.addEventListener('click', (event) => {
    const button = event.target.closest('[data-stage-move],[data-stage-remove]');
    if (!button || button.disabled) return;
    read();
    const index = Number(button.closest('[data-index]').dataset.index);
    if (button.hasAttribute('data-stage-remove')) {
      stages.splice(index, 1);
      draw();
      list.children[Math.min(index, stages.length - 1)]?.querySelector('[data-field="name"]').focus();
      return;
    }
    const to = index + Number(button.dataset.stageMove);
    [stages[index], stages[to]] = [stages[to], stages[index]];
    draw();
    const moved = list.children[to];
    (moved.querySelector(`[data-stage-move="${button.dataset.stageMove}"]:not(:disabled)`) || moved.querySelector('[data-field="name"]')).focus();
  });
  list.addEventListener('change', (event) => {
    if (!['id', 'name'].includes(event.target.dataset.field)) return;
    read();
    [...list.children].forEach((row, index) => {
      row.querySelector('.stage-edit-name').textContent = stages[index].name || 'New stage';
      row.querySelector('[data-field="onFail"]').innerHTML = onFailOptions(stages[index], index, stages);
    });
  });
  form.querySelector('[data-stage-add]').addEventListener('click', () => {
    read();
    if (stages.length >= 20) { $('#pipeline-error').textContent = 'A pipeline can have up to 20 stages.'; return; }
    let n = stages.length + 1;
    while (stages.some((stage) => stage.id === `stage-${n}`)) n += 1;
    stages.push({ id: `stage-${n}`, name: `Stage ${n}`, role: 'implement', tier: 'sonnet', executor: 'agent', gate: 'none', verdict: false, maxAttempts: 3, onFail: 'retry', pinnedAgent: '', instructions: '' });
    draw();
    const name = list.lastElementChild.querySelector('[data-field="name"]');
    name.focus();
    name.select();
  });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    read();
    const button = form.querySelector('[type="submit"]');
    button.disabled = true;
    $('#pipeline-error').textContent = '';
    try {
      await api(`/projects/${encodeURIComponent(project.id)}/pipeline`, 'PUT', { stages, version: pipeline.version });
      closeDialog(dialog);
      toast('Pipeline saved. New runs use it.');
    } catch (error) { $('#pipeline-error').textContent = error.message; } finally { button.disabled = false; }
  });
}

async function moveTask(id, status) {
  const task = state.tasks.find((entry) => entry.id === id);
  if (!task || task.status === status) return;
  // Moving to Blocked asks (optionally) what would unblock the task.
  if (status === 'blocked') return openTaskEditor(task, 'blocked');
  try {
    await api(`/tasks/${encodeURIComponent(id)}`, 'PATCH', { status, version: task.version });
    await refresh();
    toast(`Task moved to ${statuses[status].toLowerCase()}`);
  } catch (error) { toast(error.message, true); }
}

async function createSample(button) {
  button.disabled = true;
  try {
    const project = await api('/projects/sample', 'POST', {});
    await refresh();
    navigate(project.id);
    toast('Sample project created. Its history is simulated.');
  } catch (error) {
    toast(error.message, true);
  } finally { button.disabled = false; }
}

$('#main').addEventListener('click', (event) => {
  const target = event.target.closest('[data-action]');
  if (!target) return;
  switch (target.dataset.action) {
    case 'new-project': openProjectEditor(); break;
    case 'edit-project': openProjectEditor(selectedProject()); break;
    case 'new-task': openTaskEditor(null, target.dataset.status || 'backlog'); break;
    case 'open-task': openTask(target.dataset.id); break;
    case 'explain': openExplain(target.dataset, target); break;
    case 'mark-seen': markSeen(); break;
    case 'toggle-delta': toggleDelta(target.dataset.value); break;
    case 'open-project': navigate(target.dataset.id); break;
    case 'layout': state.layout = target.dataset.value; renderMain(); if (state.layout === 'health') refreshCockpit(null, { metrics: true }).then(renderMain).catch(monitorOffline); break;
    case 'clear-filters': state.priority = ''; state.status = ''; state.owner = ''; state.query = ''; $('#search').value = ''; renderMain(); break;
    case 'sample-project': createSample(target); break;
    case 'open-run': openRun(target.dataset.id); break;
    case 'edit-pipeline': openPipelineEditor(selectedProject()); break;
    case 'add-agent': openAgentEditor(); break;
    case 'edit-agent': openAgentEditor(state.agents.find((agent) => agent.id === target.dataset.id)); break;
    case 'decision-mode': setDecisionMode(target.dataset.value || ''); break;
    case 'approve': approveRun(target); break;
    case 'run-act': runAction(target, { action: target.dataset.runAction }, actionMessages[target.dataset.runAction]); break;
    case 'reassign': openReassign(); break;
    case 'cancel-run': case 'close-run': openCancelRun(); break;
    case 'inbox-toggle': toggleInbox(target.dataset.id); break;
    case 'inbox-mode': setInboxMode(target.dataset.id, target.dataset.value || ''); break;
    case 'inbox-approve': inboxApprove(target); break;
    case 'more-options': state.decisionMode = 'reject'; state.decisionRun = target.dataset.id; break;
    case 'focus-comment': $('#comment-text')?.focus(); break;
  }
});

$('#main').addEventListener('change', (event) => {
  saveDraft(event.target);
  if (event.target.hasAttribute('data-brief-window')) changeWindow(event.target.value);
  if (event.target.dataset.changesFilter) changeChangesFilter(event.target.dataset.changesFilter, event.target.value);
  if (event.target.dataset.filter) { state[event.target.dataset.filter] = event.target.value; renderMain(); }
  if (event.target.dataset.agentToggle) toggleAgent(event.target);
  if (event.target.hasAttribute('data-rerender')) renderMain();
});

$('#main').addEventListener('input', (event) => {
  saveDraft(event.target);
  const error = event.target.closest('.inbox-form')?.querySelector('.form-error');
  if (error) error.textContent = '';
});
$('#main').addEventListener('submit', (event) => {
  const form = event.target.closest('[data-form]');
  if (!form) return;
  event.preventDefault();
  const submitter = event.submitter || form.querySelector('[type="submit"]');
  if (form.dataset.form.startsWith('inbox-')) submitInboxForm(form, submitter);
  else submitRunForm(form, submitter);
});
$('#main').addEventListener('toggle', (event) => {
  if (event.target.dataset?.key) detailsOpen.set(event.target.dataset.key, event.target.open);
}, true);

$('#main').addEventListener('dragstart', (event) => {
  const card = event.target.closest('.task-card');
  if (!card) return;
  draggedId = card.dataset.id;
  event.dataTransfer.setData('text/plain', draggedId);
  event.dataTransfer.effectAllowed = 'move';
  card.classList.add('dragging');
});

$('#main').addEventListener('dragover', (event) => {
  const column = event.target.closest('[data-drop-status]');
  if (!column || !draggedId) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
  document.querySelectorAll('.drop-target').forEach((entry) => entry.classList.remove('drop-target'));
  column.classList.add('drop-target');
});

$('#main').addEventListener('drop', (event) => {
  const column = event.target.closest('[data-drop-status]');
  if (!column || !draggedId) return;
  event.preventDefault();
  moveTask(draggedId, column.dataset.dropStatus);
  draggedId = '';
  document.querySelectorAll('.drop-target').forEach((entry) => entry.classList.remove('drop-target'));
});

$('#main').addEventListener('dragend', () => {
  draggedId = '';
  document.querySelectorAll('.dragging, .drop-target').forEach((entry) => entry.classList.remove('dragging', 'drop-target'));
});

$('#search').addEventListener('input', (event) => { state.query = event.target.value; renderMain(); });
$('#sidebar-add').innerHTML = icon('plus');
$('#search-icon').innerHTML = icon('search');
$('#menu-toggle').innerHTML = icon('menu');
$('#refresh').innerHTML = icon('refresh');
$('#sidebar-add').addEventListener('click', () => openProjectEditor());
$('#create-button').addEventListener('click', () => state.projects.length ? openTaskEditor() : openProjectEditor());
$('#refresh').addEventListener('click', async () => {
  $('#refresh').disabled = true;
  try { await refresh(); toast('Workspace refreshed'); } catch (error) { toast(error.message, true); } finally { $('#refresh').disabled = false; }
});
$('#menu-toggle').addEventListener('click', () => {
  const open = $('#sidebar').classList.toggle('is-open');
  $('#menu-toggle').setAttribute('aria-expanded', String(open));
  $('#menu-toggle').setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
});
$('#sidebar').addEventListener('click', (event) => {
  const link = event.target.closest('a');
  if (!link) return;
  event.preventDefault();
  const route = link.hash.slice(1);
  navigate(route.startsWith('project/') ? route.slice(8) : route);
});
window.addEventListener('hashchange', () => {
  const previous = state.view;
  readRoute();
  if (state.view !== previous) leaveToday(previous);
  // A project opens on its Health tab.
  if (state.view !== previous && selectedProject()) state.layout = 'health';
  if (state.view !== lastView || state.view === 'run') window.scrollTo(0, 0);
  lastView = state.view;
  render();
  if (state.view === 'run' && state.run?.id !== state.runId) refresh().catch(monitorOffline);
  else if (state.view !== previous) refreshCockpit(null, { force: state.view === 'today' }).then(() => { if (!refreshPaused()) renderMain(); }).catch(monitorOffline);
});
document.addEventListener('keydown', (event) => {
  if (event.ctrlKey || event.metaKey || event.altKey || anyDialogOpen() || event.target.closest('input,textarea,select,[contenteditable]')) return;
  if (event.key === '/') { event.preventDefault(); $('#search').focus(); }
  if (event.key.toLowerCase() === 'n') { event.preventDefault(); openTaskEditor(); }
  if (event.key === 'Escape') { $('#sidebar').classList.remove('is-open'); $('#menu-toggle').setAttribute('aria-expanded', 'false'); }
});

function monitorOffline(error) {
  if (state.authLost) return;
  setMonitor('Reconnecting', true, error.message);
}

// Typing in a field on the page pauses refreshes so the caret never jumps.
function editingMain() {
  const element = document.activeElement;
  return Boolean(element && $('#main').contains(element) && element.matches('textarea, input:not([type="checkbox"]):not([type="radio"])'));
}

function refreshPaused() {
  return state.authLost || document.hidden || refreshing || state.acting || draggedId || anyDialogOpen() || editingMain();
}

setInterval(() => {
  if (refreshPaused()) return;
  refresh().catch(monitorOffline);
}, 10000);
// While a run is moving on screen, follow it more closely.
setInterval(() => {
  if (state.view !== 'run' || !['running', 'waiting'].includes(state.run?.status) || state.run?.paused || refreshPaused()) return;
  refresh().catch(monitorOffline);
}, 3000);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) leaveToday(state.view);
  else if (state.view === 'today') todayShownAt = Date.now();
});
window.addEventListener('pagehide', () => leaveToday(state.view));
document.addEventListener('visibilitychange', () => { if (!document.hidden && !refreshing && !state.authLost && !editingMain()) refresh().catch(monitorOffline); });

lastView = state.view;
refresh().catch((error) => {
  state.loading = false;
  $('#main').setAttribute('aria-busy', 'false');
  $('#main').innerHTML = `<div class="empty-results">${icon('alert')}<h1>Workspace unavailable</h1><p>${escape(error.message)}</p><p>Check that AGESight is running, then use the refresh button.</p></div>`;
  $('#create-button').disabled = true;
  monitorOffline(error);
});
