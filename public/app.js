import { actionFor, actionRequest, availability, inputFor, projectKind, TASK_ACTIONS } from './actions.js';
import { decisionsSummary, escape, formatAge, headline, healthDot, localId, metricButton, plural, projectCard, renderActivity, renderEvidence, renderExplain, renderFlow, renderHome, renderMethod, renderThreads, renderTimeline, renderWorking, sampleBadge, signalBadges, signalIndex, threadTag, waitingChip } from './cockpit.js';
import { briefQuery, cursorFromBrief, readWindow, writeCursor, writeWindow } from './cursor.js';
import { icon } from './icons.js';
import { renderMarkdown } from './markdown.js';
import { buildThreads } from './threads.js';
import { healthTone, healthWord, ownerChip, TERMS } from './words.js';

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
// A project's tabs. It opens on its board.
const LAYOUTS = { board: ['board', 'Board'], threads: ['route', 'Threads'], list: ['list', 'List'], flow: ['activity', 'Flow'], method: ['shield', 'Method'] };
const state = { projects: [], tasks: [], runs: [], agents: [], operator: '', view: 'home', layout: 'board', agentsTab: 'now', query: '', priority: '', status: '', owner: '', loading: true, runId: '', run: null, runError: null, decisionMode: '', decisionRun: '', drafts: {}, acting: false, authLost: false };
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
// The cockpit's read models: the brief (Home, the Decisions header, signals on
// every card, and the health dots in the sidebar), each project's metrics and
// method, and the change feed. `expanded` holds what a person opened: delta
// groups, long Needs you groups, and board columns shown in full.
const cockpit = { brief: null, briefAt: 0, briefError: '', metrics: new Map(), method: new Map(), pipelines: new Map(), changes: null, changesKey: '', changesFilter: { kind: '', projectId: '' }, expanded: new Set() };
const BRIEF_POLL_MS = 30000;
// "Since your last visit" moves on when a person leaves Home after looking at
// it for at least this long, or presses Mark seen.
const SEEN_AFTER_MS = 10000;
let homeShownAt = 0;
// A board column shows this many cards before "Show all"; Done shows fewer,
// the newest of what finished this week.
const COLUMN_CARDS = 25;
const DONE_CARDS = 10;

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

function projectOf(task) {
  return state.projects.find((project) => project.id === task.projectId);
}

// The full edit form, new tasks and the pipeline are for AGE Aris's own
// projects; a tracked repository's tasks change only through task actions.
function writable(project) {
  return Boolean(project) && !project.linked;
}

// What a tracked task's file adds to the task as listed (its Result still a
// placeholder, a live run on its trail), kept while its version is the same.
const taskDetails = new Map();

function withDetails(task) {
  const details = task && taskDetails.get(task.id);
  return details && details.version === task.version ? { ...task, ...details.fields } : task;
}

function writableProjects() {
  return state.projects.filter(writable);
}

// Who holds a task: its assignee, else the agent session its owner line names.
function ownerOf(task) {
  return task.assignee || task.claim || '';
}

function briefLine(projectId) {
  return cockpit.brief?.projects.find((entry) => entry.projectId === projectId);
}

// Signals (stale, aging, blocked, …) per task, from the brief.
function signals() {
  if (cockpit.signalsFor !== cockpit.brief) {
    cockpit.signals = signalIndex(cockpit.brief);
    cockpit.signalsFor = cockpit.brief;
  }
  return cockpit.signals;
}

// Each project's threads (what its tasks build on), rebuilt when the tasks change.
function threadsFor(projectId) {
  if (cockpit.threadsOf !== state.tasks) { cockpit.threads = new Map(); cockpit.threadsOf = state.tasks; }
  if (!cockpit.threads.has(projectId)) cockpit.threads.set(projectId, buildThreads(state.tasks.filter((task) => task.projectId === projectId)));
  return cockpit.threads.get(projectId);
}

function placeOf(task) {
  return threadsFor(task.projectId).place.get(task.id);
}

// Agent sessions holding work in progress, per project.
function agentsByProject() {
  const sessions = new Map();
  for (const task of state.tasks) {
    if (!task.claim || !['in_progress', 'blocked'].includes(task.status)) continue;
    if (!sessions.has(task.projectId)) sessions.set(task.projectId, new Set());
    sessions.get(task.projectId).add(task.claim);
  }
  return new Map([...sessions].map(([id, set]) => [id, set.size]));
}

// The API token arrives as an HttpOnly cookie with the page, and same-origin
// fetches send it. A 401 means this page's token is stale (AGE Aris restarted
// with another data directory, or the cookie was cleared): only a reload helps.
async function api(path, method = 'GET', data) {
  const response = await fetch(`/api${path}`, { method, credentials: 'same-origin', ...(data ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) } : {}) });
  if (response.status === 401) {
    connectionLost();
    const error = new Error('Reload AGE Aris to reconnect.');
    error.status = 401;
    throw error;
  }
  if (state.authLost) connectionRestored();
  let result;
  try { result = await response.json(); } catch { throw new Error('The server did not return a valid response. Restart AGE Aris and refresh.'); }
  if (!response.ok) {
    const error = new Error(result.error || 'Changes could not be saved. Try again.');
    error.status = response.status;
    // A refusal can name its reason (`code`) and what to do about it (`remedy`);
    // a confirmation carries its reasons and token, a bad input its field.
    if (result.code) error.code = result.code;
    if (result.remedy) error.remedy = result.remedy;
    if (Array.isArray(result.reasons)) error.reasons = result.reasons;
    if (result.confirmToken) error.confirmToken = result.confirmToken;
    if (result.field) error.field = result.field;
    throw error;
  }
  return result;
}

// `duration` (ms) keeps a long message, such as a remedy to copy, up longer.
function toast(message, error = false, duration = 0) {
  if (error && state.authLost) return; // the reconnect banner already says what to do
  clearTimeout(toastTimer);
  $('#toast').textContent = message;
  $('#toast').className = `toast visible${error ? ' toast-error' : ''}`;
  toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), duration || (error ? 7000 : 3500));
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
  banner.innerHTML = `${icon('alert')}<p><strong>Sign in to AGE Aris.</strong> <span>Open the sign-in link printed in the terminal where AGE Aris is running (npm start), then reload. This keeps other local users out of your workspace. Automatic updates are stopped.</span></p><button type="button" class="button button-primary" id="reload-button">${icon('refresh')}Reload</button>`;
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

// Old links keep working: Overview and Today became Home, Tasks and Work All
// tasks, Activity and Changes Activity.
const ROUTE_ALIASES = { overview: 'home', today: 'home', tasks: 'work', changes: 'activity' };
const VIEWS = ['home', 'projects', 'work', 'working', 'activity', 'decisions', 'agents'];

function readRoute() {
  const raw = location.hash.slice(1);
  const hash = ROUTE_ALIASES[raw] || raw;
  if (hash.startsWith('project/')) {
    const [id, layout] = hash.slice(8).split('/');
    state.view = state.projects.some((project) => project.id === id) ? id : 'home';
    if (layout && LAYOUTS[layout]) state.layout = layout;
  } else if (hash.startsWith('run/')) {
    state.view = 'run';
    try { state.runId = decodeURIComponent(hash.slice(4)); } catch { state.runId = ''; }
  } else state.view = VIEWS.includes(hash) ? hash : 'home';
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
  const isProject = state.projects.some((project) => project.id === view);
  // A project link opens its board, also from one of its other tabs.
  if (isProject) state.layout = 'board';
  const route = isProject ? `project/${view}` : view;
  if (location.hash === `#${route}`) { readRoute(); render(); } else location.hash = route;
  closeSlideOver();
}

const PAGE_NAMES = { home: 'Home', projects: 'Projects', work: 'All tasks', working: 'Working', activity: 'Activity', decisions: 'Decisions', agents: 'Agents' };

function render() {
  renderNavigation();
  const project = selectedProject();
  const page = project?.name || PAGE_NAMES[state.view] || (state.run?.id === state.runId ? `Run ${state.run.localId}` : 'Run');
  document.title = `${page} · AGE Aris`;
  const parent = project ? '<a href="#projects">Projects</a> <span>/</span> ' : state.view === 'work' ? '<a href="#projects">Projects</a> <span>/</span> ' : ['decisions', 'run'].includes(state.view) ? '<a href="#home">Home</a> <span>/</span> ' : '';
  $('#breadcrumb').innerHTML = `${parent}<strong>${escape(page)}</strong>`;
  // In one of your own projects the button adds a task there; elsewhere it adds a project.
  const addTask = writable(project);
  $('#create-button').className = 'button button-secondary topbar-create';
  $('#create-button').innerHTML = `${icon('plus')}<span>${addTask ? 'New task' : 'Add project'}</span>`;
  $('#create-button').title = addTask ? `Add a task to ${project.name} (N)` : 'Track a repository or start a project';
  renderMain();
}

function renderNavigation() {
  const needs = cockpit.brief?.needsYou.length || 0;
  const working = state.tasks.filter((task) => task.status === 'in_progress' || task.status === 'blocked').length;
  const counts = {
    home: needs ? `<span class="nav-count nav-count-alert" aria-label="${needs} need you">${needs}</span>` : '',
    working: working ? `<span class="nav-count" aria-label="${working} in progress or blocked">${working}</span>` : '',
  };
  const active = { home: ['home', 'decisions', 'run'], projects: ['projects', 'work'], working: ['working'], agents: ['agents'], activity: ['activity'] };
  $('#navigation').innerHTML = [['home', 'grid', 'Home'], ['projects', 'folder', 'Projects'], ['working', 'play', 'Working'], ['agents', 'agent', 'Agents'], ['activity', 'activity', 'Activity']].map(([view, symbol, label]) => {
    const on = active[view].includes(state.view);
    return `<a href="#${view}" class="nav-link ${on ? 'active' : ''}" ${state.view === view ? 'aria-current="page"' : ''}>${icon(symbol)}<span>${label}</span>${counts[view] || ''}</a>`;
  }).join('');
  $('#project-navigation').innerHTML = state.projects.length ? state.projects.map((project) => {
    const health = briefLine(project.id)?.health;
    return `<a href="#project/${escape(project.id)}" class="nav-link project-nav ${state.view === project.id ? 'active' : ''}" ${state.view === project.id ? 'aria-current="page"' : ''} title="${escape(`${project.name}: ${health ? healthWord(health) : 'not computed yet'}`)}">${healthDot(health)}<span class="truncate">${escape(project.name)}</span></a>`;
  }).join('') : '<p class="sidebar-empty">Your projects will appear here.</p>';
}

function filteredTasks() {
  const project = selectedProject();
  const query = state.query.trim().toLowerCase();
  const ordered = { urgent: 0, high: 1, medium: 2, low: 3 };
  return state.tasks.filter((task) => (!project || task.projectId === project.id) && (!state.status || task.status === state.status) && (!state.priority || task.priority === state.priority) && (!state.owner || (state.owner === '__unassigned' ? !ownerOf(task) : ownerOf(task) === state.owner)) && (!query || `${task.title} ${task.description} ${ownerOf(task)} ${task.claimNote || ''} ${taskNumber(task)} ${state.projects.find((item) => item.id === task.projectId)?.name}`.toLowerCase().includes(query))).sort((a, b) => ordered[a.priority] - ordered[b.priority] || b.createdAt.localeCompare(a.createdAt));
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
  if (state.view === 'activity' && !state.query) return renderActivityPage();
  if (state.view === 'working' && !state.query) return renderWorkingPage();
  if (state.view === 'home' && !state.query) return renderHomePage();
  if (state.view === 'projects' && !state.query) return renderProjectsPage();
  const project = selectedProject();
  if (project && !state.query) return renderProjectPage(project);
  renderTaskSearch();
}

// Everything in progress or blocked, on every board.
function renderWorkingPage() {
  $('#main').innerHTML = renderWorking({ tasks: state.tasks, projects: state.projects, brief: cockpit.brief });
}

// All tasks across projects, or search results: one grouped list.
function renderTaskSearch() {
  const tasks = filteredTasks();
  const title = state.query ? 'Search results' : 'All tasks';
  const intro = state.query ? `Tasks matching “${state.query}”` : 'Every task in every project, grouped by state.';
  $('#main').innerHTML = `<section class="page-heading"><div><h1>${escape(title)}</h1><p>${escape(intro)}</p></div></section>
    <div class="view-toolbar"><span class="board-meta">${escape(plural(tasks.length, 'task'))}${state.query ? ' found' : ''}</span><div class="filters">${filterControls(state.tasks)}${state.status || state.priority || state.owner ? '<button class="text-button" data-action="clear-filters">Clear</button>' : ''}</div></div>
    ${taskList(tasks, { showProject: true })}`;
}

// --- Projects ------------------------------------------------------------------

function renderProjectsPage() {
  const agents = agentsByProject();
  const cards = state.projects.map((project) => {
    const line = briefLine(project.id) || { projectId: project.id, name: project.name, linked: project.linked, state: 'building', sentence: 'Reading this project’s history…' };
    return projectCard(line, { agents: agents.get(project.id) || 0, project });
  }).join('');
  const open = state.tasks.filter((task) => task.status !== 'done').length;
  $('#main').innerHTML = `<section class="page-heading"><div><h1>Projects</h1><p>Your own projects and the repositories you track. Each card says whether the work follows the method, and why not.</p></div><div class="heading-actions"><a class="button button-secondary" href="#work">${icon('tasks')}All tasks <span class="muted">${open} open</span></a><button class="button button-secondary" data-action="add-project">${icon('plus')}Add project</button></div></section><div class="project-cards">${cards}</div>`;
}

// --- A project: status, then the board; flow and method one tab away ----------

function renderProjectPage(project) {
  const line = briefLine(project.id);
  const projectTasks = state.tasks.filter((task) => task.projectId === project.id);
  const layout = LAYOUTS[state.layout] ? state.layout : 'board';
  const tabs = Object.entries(LAYOUTS).map(([value, [symbol, label]]) => `<button class="view-tab ${layout === value ? 'selected' : ''}" data-action="layout" data-value="${value}" aria-pressed="${layout === value}">${icon(symbol)}${label}</button>`).join('');
  const taskView = layout === 'board' || layout === 'list';
  const tasks = taskView ? filteredTasks() : [];
  const filters = taskView ? `<div class="filters">${filterControls(projectTasks)}${state.status || state.priority || state.owner ? '<button class="text-button" data-action="clear-filters">Clear</button>' : ''}</div>` : '';
  let body;
  if (layout === 'threads') body = `${problemsNote(project)}${renderThreads(threadsFor(project.id), { signals: signals(), expanded: cockpit.expanded, holder })}`;
  else if (layout === 'flow') body = renderFlow(cockpit.metrics.get(project.id), { projectId: project.id, wipLimit: Number.isInteger(project.wipLimit) ? project.wipLimit : 0, width: mainWidth() });
  else if (layout === 'method') body = renderMethod({ project, method: cockpit.method.get(project.id), data: cockpit.metrics.get(project.id), line, tasks: projectTasks, pipeline: cockpit.pipelines.get(project.id) });
  else body = `${problemsNote(project)}${layout === 'board' ? board(tasks, project) : taskList(tasks)}${!projectTasks.length && writable(project) ? '<p class="board-hint">Start with a task. Give it an owner and a clear next step.</p>' : ''}`;
  $('#main').innerHTML = `${projectHeader(project, line)}<div class="view-toolbar has-tabs"><div class="view-tabs" role="group" aria-label="Project view">${tabs}</div>${filters}</div>${body}`;
}

// The width #main lays its content out in: the Flow tab draws its charts at
// it, so their text stays the page's size on any screen.
function mainWidth() {
  const main = $('#main');
  const style = getComputedStyle(main);
  return main.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
}

function projectHeader(project, line) {
  const where = project.linked
    ? `<p class="project-where">Tracked from <code>${escape(project.repository)}</code>. AGE Aris reads its <code>${escape(project.board)}/</code> board and git history. ${project.actions?.on ? `Task actions commit to <code>${escape(project.actions.branch)}</code> as ${escape(project.actions.operator || '')}, one task file at a time, and are not pushed.` : 'Its tasks change in the repository, where its agents work, until task actions are switched on here.'}</p>${interruptedNote(project)}`
    : project.description ? `<p class="project-where">${escape(project.description)}</p>` : '';
  const status = line?.state === 'ready'
    ? `<p class="project-status tone-${healthTone(line.health)}">${healthDot(line.health)}${metricButton({ projectId: project.id, metricId: 'health', display: healthWord(line.health), className: 'health-word', title: 'Which checks pass and fail' })}<span>${escape(headline(line))}</span></p>`
    : `<p class="project-status">${healthDot(null)}<span>${escape(headline(line) || 'Reading this project’s history…')}</span></p>`;
  return `<header class="project-header"><div class="project-title-row"><span class="project-symbol color-${projectColor(project)}">${icon('folder')}</span><h1>${escape(project.name)}</h1>${project.linked ? trackedBadge(project) : ''}${sampleBadge(line?.sample)}<div class="project-actions">${projectActions(project)}</div></div>${where}${status}${vitals(project, line)}</header>`;
}

// A tracked repository's badge: what AGE Aris may do there.
function trackedBadge(project) {
  const title = project.actions?.on
    ? `AGE Aris changes this repository's tasks only through task actions, committed to ${project.actions.branch}.`
    : 'AGE Aris reads this repository; task actions are off.';
  return `<span class="readonly-badge" title="${escape(title)}">Tracked</span>`;
}

// A task action that was interrupted stays named here until the operator
// has checked it and removed the marker.
function interruptedNote(project) {
  const left = project.actions?.interrupted;
  if (!left) return '';
  return `<p class="window-note problems-note" role="status">${icon('alert')}<span>A task action was interrupted: ${escape(left.message)} Once it is checked, remove <code>${escape(left.marker)}</code>; until then task actions here are refused.</span></p>`;
}

// The four numbers a project is run by, each with its plain meaning.
function vitals(project, line) {
  if (line?.state !== 'ready') return '';
  const k = line.kpis;
  const usual = line.usualWeek ?? null;
  const number = (metric) => (metric ? metricButton({ projectId: project.id, metricId: metric.id, display: metric.display, title: metric.status === 'ok' ? '' : metric.reason }) : '—');
  const over = k.wipLimit && k.wip?.value > k.wipLimit;
  const vital = (label, value, help, alert = false) => `<div class="vital"><span class="vital-label">${escape(label)}</span><span class="vital-value ${alert ? 'is-alert' : ''}">${value}</span><span class="vital-help">${escape(help)}</span></div>`;
  return `<div class="vitals">${vital(TERMS.throughput[0], number(k.done7d), usual !== null ? `Finished in 7 days; usually ~${usual} a week` : TERMS.throughput[1])}${vital(TERMS.wip[0], number(k.wip), k.wipLimit ? `In progress or blocked; the limit is ${k.wipLimit}` : `${TERMS.wip[1].split(': ')[1]}; no limit set`, over)}${vital(TERMS.cycle[0], number(k.cycle50), TERMS.cycle[1])}${vital(TERMS.service[0], number(k.cycle85), TERMS.service[1])}</div>`;
}

function projectActions(project) {
  if (project.linked) {
    const on = Boolean(project.actions?.on);
    const label = on ? `Task actions on · ${escape(project.actions.branch)}` : 'Task actions off';
    const title = on ? 'Switch task actions off: AGE Aris stops committing here' : (project.actions?.reason || 'Switch task actions on');
    const toggle = project.unavailable ? '' : `<button class="text-button project-settings" data-action="task-actions" aria-pressed="${on}" title="${escape(title)}">${icon('git')}${label}</button>`;
    return `${toggle}<button class="text-button project-settings" data-action="copy-path" data-value="${escape(project.repository)}" title="Copy the repository path">${icon('git')}Copy path</button><button class="text-button project-settings" data-action="unlink-project">Stop tracking</button>`;
  }
  return `<button class="text-button project-settings" data-action="edit-project">${icon('edit')}Edit project</button><button class="text-button project-settings" data-action="edit-pipeline">${icon('pipeline')}Pipeline</button>`;
}

// Task files in a tracked repository that could not be read; the rest of the
// board is shown without them.
function problemsNote(project) {
  if (project.unavailable) return `<p class="window-note problems-note">${icon('alert')}<span>This repository cannot be read right now: ${escape(project.unavailable)} Its tasks show again once it can be read; Stop tracking removes it from AGE Aris.</span></p>`;
  const problems = project.problems || [];
  if (!problems.length) return '';
  const listed = problems.slice(0, 5).map((problem) => `${problem.file} (${problem.error})`).join('; ');
  return `<p class="window-note problems-note">${icon('alert')}<span>${problems.length === 1 ? '1 task file was' : `${problems.length} task files were`} not read: ${escape(listed)}${problems.length > 5 ? `; ${problems.length - 5} more` : ''}.</span></p>`;
}

function filterControls(tasks) {
  const owners = [...new Set(tasks.map(ownerOf).filter(Boolean))].sort();
  return `<label class="filter-select"><span class="sr-only">Filter by owner</span><select data-filter="owner"><option value="">All owners</option><option value="__unassigned" ${state.owner === '__unassigned' ? 'selected' : ''}>Unassigned</option>${owners.map((owner) => `<option value="${escape(owner)}" ${state.owner === owner ? 'selected' : ''}>${escape(owner)}</option>`).join('')}</select></label><label class="filter-select"><span class="sr-only">Filter by priority</span><select data-filter="priority"><option value="">All priorities</option>${options(priorities, state.priority)}</select></label><label class="filter-select"><span class="sr-only">Filter by status</span><select data-filter="status"><option value="">All statuses</option>${options(statuses, state.status)}</select></label>`;
}

function options(values, current) {
  return Object.entries(values).map(([value, label]) => `<option value="${value}" ${current === value ? 'selected' : ''}>${label}</option>`).join('');
}

// What a project's metrics know about finishes: the tasks that finished in the
// last 7 days (sweeps included), and every task with a recorded finish. A done
// task the metrics have not seen yet (its move not yet indexed) counts as recent.
function finishes(projectId) {
  const tables = cockpit.metrics.get(projectId)?.tables;
  if (!tables?.finishedWeek) return null;
  const key = (row) => `${projectId}:${localId(row.taskKey)}`;
  const week = new Map(tables.finishedWeek.map((row) => [key(row), row.at]));
  const known = new Set([...tables.cycle, ...tables.excluded].map(key));
  return { week, recent: (task) => week.has(task.id) || !known.has(task.id) };
}

function board(tasks, project) {
  const canAdd = writable(project);
  const finished = finishes(project.id);
  const limit = project.wipLimit > 0 ? project.wipLimit : 0;
  const wip = state.tasks.filter((task) => task.projectId === project.id && ['in_progress', 'blocked'].includes(task.status)).length;
  return `<div class="board">${Object.entries(statuses).map(([status, label]) => {
    let column = tasks.filter((task) => task.status === status);
    let heading = label;
    let hidden = 0;
    let week = 0;
    const key = `column:${project.id}:${status}`;
    if (status === 'done') {
      // Done shows the newest of what finished this week; the rest is one click away.
      // Times compare as instants, since finishes carry their commit's UTC
      // offset. A finish the ledger has not indexed yet counts as the newest;
      // a sweep's, whose time is unknown, as the oldest.
      const time = (task) => {
        if (finished?.week.has(task.id)) return Date.parse(finished.week.get(task.id)) || 0;
        return finished?.recent(task) ? Infinity : Date.parse(task.updatedAt) || 0;
      };
      column = column.sort((a, b) => Number(finished ? finished.recent(b) : 0) - Number(finished ? finished.recent(a) : 0) || (time(b) - time(a)) || 0);
      if (!cockpit.expanded.has(key)) {
        const recent = finished ? column.filter(finished.recent) : column;
        week = finished ? recent.length : 0;
        hidden = column.length - Math.min(recent.length, DONE_CARDS);
        heading = finished ? 'Done this week' : 'Done';
        column = recent.slice(0, DONE_CARDS);
      }
    } else if (!cockpit.expanded.has(key) && column.length > COLUMN_CARDS) {
      hidden = column.length - COLUMN_CARDS;
      column = column.slice(0, COLUMN_CARDS);
    }
    const total = column.length + hidden;
    const more = hidden ? `<button class="column-more" data-action="toggle-delta" data-value="${escape(key)}">Show all ${total}${status === 'done' ? ' done' : ''}</button>` : cockpit.expanded.has(key) ? `<button class="column-more" data-action="toggle-delta" data-value="${escape(key)}">Show fewer</button>` : '';
    return `<section class="board-column" data-drop-status="${status}" aria-label="${label}"><header class="column-heading"><span class="status-dot status-${status}"></span><h2>${heading}</h2><span class="column-count ${status === 'in_progress' && limit && wip > limit ? 'is-over' : ''}">${status === 'done' && hidden && week !== total ? `${week || column.length} of ${total}` : total}</span>${status === 'in_progress' && limit ? `<span class="column-limit" title="WIP limit, counting blocked work: ${wip} in progress or blocked">limit ${escape(limit)}</span>` : ''}${canAdd ? `<button class="icon-button" data-action="new-task" data-status="${status}" aria-label="Add task to ${label}">${icon('plus')}</button>` : ''}</header><div class="column-tasks">${column.map(taskCard).join('')}${!column.length ? `<div class="column-empty">${status === 'done' && hidden ? 'Nothing finished this week' : 'Nothing here'}</div>` : ''}</div>${week > column.length ? `<p class="column-note">${week - column.length} more finished this week</p>` : ''}${more}${canAdd ? `<button class="column-add" data-action="new-task" data-status="${status}">${icon('plus')} Add task</button>` : ''}</section>`;
  }).join('')}</div>`;
}

function priorityBadge(task) {
  return task.priorityGiven === false ? '' : `<span class="priority priority-${task.priority}">${icon('flag')}${priorities[task.priority]}</span>`;
}

function holder(task) {
  return task.assignee ? ownerChip(task.assignee) : task.claim ? ownerChip(task.claim) : '';
}

// One task, one look: the same signals, holder and note on a card, a row, and
// in the drawer.
function taskCard(task) {
  const project = projectOf(task);
  const editable = writable(project) || Boolean(project?.actions?.on);
  const signal = signals().get(task.id);
  const footer = `${task.dueDate ? `<span class="due-date ${overdue(task) ? 'is-overdue' : ''}">${icon('calendar')}${escape(formatDate(task.dueDate))}</span>` : '<span></span>'}${holder(task) || (task.status === 'done' ? '' : '<span class="muted">Unclaimed</span>')}`;
  return `<button class="task-card ${task.status === 'done' ? 'task-complete' : ''}" data-action="open-task" data-id="${escape(task.id)}" draggable="${editable}" aria-label="Open ${escape(taskNumber(task))}: ${escape(task.title)}"><span class="card-top"><span class="task-number">${escape(taskNumber(task))}</span>${priorityBadge(task)}</span><span class="card-title">${escape(task.title)}</span>${task.status !== 'done' && (signal || placeOf(task)?.waitingOn.length || placeOf(task)?.thread) ? `<span class="card-signals">${signal ? signalBadges(signal) : ''}${waitingChip(placeOf(task))}${threadTag(placeOf(task))}</span>` : ''}${task.claimNote && task.status !== 'done' ? `<span class="card-description" title="The agent’s latest note">“${escape(task.claimNote)}”</span>` : ''}${runLine(task)}<span class="card-footer">${footer}</span></button>`;
}

function taskRow(task, showProject) {
  const signal = signals().get(task.id);
  const project = showProject ? projectOf(task) : null;
  return `<li><button class="task-row" data-action="open-task" data-id="${escape(task.id)}"><span class="task-number">${escape(taskNumber(task))}</span><span class="task-row-title" title="${escape(task.title)}">${escape(task.title)}${project ? `<small>${escape(project.name)}</small>` : ''}</span><span class="task-row-signals">${signal && task.status !== 'done' ? signalBadges(signal) : ''}${task.status !== 'done' ? waitingChip(placeOf(task)) : ''}${runLine(task)}</span><span class="task-row-owner">${holder(task) || '<span class="muted">—</span>'}</span><span class="task-row-when">${task.dueDate ? `<span class="due-date ${overdue(task) ? 'is-overdue' : ''}">${escape(formatDate(task.dueDate))}</span>` : escape(formatDate(task.createdAt))}</span></button></li>`;
}

// Grouped by state; each group shows a page of rows and the rest on request.
function taskList(tasks, { showProject = false } = {}) {
  const filtering = state.query || state.status || state.priority || state.owner;
  if (!tasks.length) return `<div class="empty-results">${icon('tasks')}<h2>No tasks found</h2><p>${filtering ? 'Try another search or clear your filters.' : 'Tasks will appear here.'}</p>${filtering ? '<button class="button button-secondary" data-action="clear-filters">Clear search and filters</button>' : ''}</div>`;
  const groups = ['blocked', 'in_progress', 'backlog', 'done'].map((status) => {
    const rows = tasks.filter((task) => task.status === status);
    if (!rows.length) return '';
    const key = `list:${state.view}:${status}`;
    const open = cockpit.expanded.has(key);
    const limit = status === 'done' ? 15 : 50;
    const shown = open ? rows : rows.slice(0, limit);
    return `<section aria-label="${statuses[status]}"><h2 class="task-group-heading"><span class="status-dot status-${status}"></span>${statuses[status]}<span>${rows.length}</span></h2><ul class="task-rows">${shown.map((task) => taskRow(task, showProject)).join('')}</ul>${rows.length > shown.length ? `<button class="task-group-more" data-action="toggle-delta" data-value="${escape(key)}">Show all ${rows.length}</button>` : ''}</section>`;
  }).join('');
  return `<div class="task-groups">${groups}</div>`;
}

function renderEmptyWorkspace() {
  $('#main').innerHTML = `<section class="page-heading home-heading"><div><h1>Welcome to AGE Aris</h1><p class="home-sub">Run projects with people and agents: what needs you, how work flows, and whether the method is being followed.</p></div></section><section class="section panel add-panel"><div class="dialog-fields">${addChoices()}</div></section>`;
}

// The two ways to add a project, plus the sample.
function addChoices() {
  return `<div class="choice-cards"><button type="button" class="choice-card" data-action="link-project">${icon('git')}<span><strong>Track an existing repository</strong><span>Its agents already keep an AA/ board (or deaddrop/, its older name). AGE Aris reads the board and git history, and changes its tasks only through task actions you switch on.</span></span></button><button type="button" class="choice-card" data-action="new-project">${icon('folder')}<span><strong>Start a new project here</strong><span>AGE Aris keeps its board in a git repository of its own. Add tasks, set a WIP limit, and run them with agents.</span></span></button><button type="button" class="choice-card" data-action="sample-project">${icon('activity')}<span><strong>Explore a sample project</strong><span>Six weeks of simulated history, so every view has something to show.</span></span></button></div>`;
}

function openAddProject() {
  const dialog = $('#project-dialog');
  dialog.innerHTML = `<header class="dialog-heading"><div><span class="dialog-eyebrow">Your workspace</span><h2 id="project-dialog-title">Add a project</h2></div><button type="button" class="icon-button" data-close aria-label="Close">${icon('close')}</button></header><div class="dialog-fields">${addChoices()}</div>`;
  dialog.querySelectorAll('[data-action]').forEach((button) => button.addEventListener('click', () => {
    const action = button.dataset.action;
    if (action === 'link-project') openLinkEditor();
    else if (action === 'new-project') openProjectEditor();
    else { closeDialog(dialog); createSample(button); }
  }));
  setupDialog(dialog);
  dialog.querySelector('.choice-card')?.focus();
}

// --- Cockpit: Home, flow, method, activity, explain --------------------------------

function storage() {
  try { return window.localStorage; } catch { return null; }
}

// The menu button hides and shows the sidebar. On a phone the sidebar slides
// over the page and closes on navigation; on a wider screen it folds away, and
// this browser remembers the choice.
const narrowScreen = window.matchMedia('(max-width: 860px)');
const SIDEBAR_KEY = 'agearis.sidebar';

function syncMenuButton() {
  const shown = narrowScreen.matches ? $('#sidebar').classList.contains('is-open') : !$('.app-shell').classList.contains('sidebar-hidden');
  $('#menu-toggle').setAttribute('aria-expanded', String(shown));
  $('#menu-toggle').setAttribute('aria-label', shown ? 'Hide navigation' : 'Show navigation');
}

function closeSlideOver() {
  $('#sidebar').classList.remove('is-open');
  syncMenuButton();
}

function cockpitSignature() {
  const project = selectedProject();
  return [cockpit.brief, cockpit.briefError, state.view === 'activity' ? cockpit.changes : null, project ? [cockpit.metrics.get(project.id), cockpit.method.get(project.id), cockpit.pipelines.get(project.id)] : null];
}

async function loadBrief() {
  const { params } = briefQuery({ storage: storage() });
  try {
    cockpit.brief = await api(`/brief?${params}`);
    cockpit.briefError = '';
  } catch (error) {
    if (error.status === 401) throw error;
    // A stored cursor the server rejects must not leave Home empty, nor mark
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
  // A project's metrics feed the board (what finished this week), Flow and Method.
  if (project && !state.query && (force || metrics || changed || stale || !cockpit.metrics.has(project.id))) {
    jobs.push(api(`/projects/${encodeURIComponent(project.id)}/metrics`).then((data) => { cockpit.metrics.set(project.id, data); }, (error) => {
      if (error.status === 401) throw error;
      cockpit.metrics.set(project.id, { state: 'error', error: error.message });
    }));
  }
  // The board's method documents are not part of the workspace, so they are read again on the brief's clock.
  if (changed) for (const id of [...cockpit.method.keys()]) if (id !== project?.id) cockpit.method.delete(id);
  if (project && state.layout === 'method' && !state.query && (force || changed || stale || !cockpit.method.has(project.id))) {
    jobs.push(api(`/projects/${encodeURIComponent(project.id)}/method`).then((method) => { cockpit.method.set(project.id, method); }, (error) => {
      if (error.status === 401) throw error;
      cockpit.method.set(project.id, { error: error.message });
    }));
    if (writable(project)) jobs.push(api(`/projects/${encodeURIComponent(project.id)}/pipeline`).then((pipeline) => { cockpit.pipelines.set(project.id, pipeline); }, (error) => { if (error.status === 401) throw error; }));
  }
  if (state.view === 'activity') {
    const { kind, projectId } = cockpit.changesFilter;
    const key = `${kind}|${projectId}`;
    if (force || changed || stale || cockpit.changesKey !== key || !cockpit.changes) {
      const params = new URLSearchParams({ limit: '200', ...(kind ? { kinds: kind } : {}), ...(projectId ? { projectId } : {}) });
      jobs.push(api(`/changes?${params}`).then((feed) => { cockpit.changes = feed; cockpit.changesKey = key; }));
    }
  }
  await Promise.all(jobs);
  // A project still indexing is asked again soon.
  if (cockpit.brief?.projects.some((line) => line.state !== 'ready' && line.state !== 'unavailable')) cockpit.briefAt = Date.now() - BRIEF_POLL_MS + 3000;
}

function renderHomePage() {
  if (!cockpit.brief) {
    $('#main').innerHTML = cockpit.briefError
      ? `<div class="empty-results">${icon('alert')}<h2>Home is unavailable</h2><p>${escape(cockpit.briefError)}</p></div>`
      : '<div class="loading-state"><span class="spinner"></span>Reading your projects’ history…</div>';
    return;
  }
  if (!document.hidden && !homeShownAt) homeShownAt = Date.now();
  const tasks = new Map(state.tasks.map((task) => [task.id, task]));
  $('#main').innerHTML = renderHome(cockpit.brief, { mode: readWindow(storage()), expanded: cockpit.expanded, taskOf: (id) => tasks.get(id), agentsByProject: agentsByProject(), projects: state.projects });
}

function renderActivityPage() {
  $('#main').innerHTML = renderActivity(cockpit.changes, { ...cockpit.changesFilter, projects: state.projects, timezone: cockpit.brief?.timezone });
}

// Leaving Home after looking at it marks what it showed as seen.
function leaveHome(view) {
  if (view !== 'home' || !homeShownAt) return;
  const looked = Date.now() - homeShownAt;
  homeShownAt = 0;
  if (looked >= SEEN_AFTER_MS && cockpit.brief?.live) writeCursor(storage(), cursorFromBrief(cockpit.brief));
}

async function markSeen() {
  if (!cockpit.brief) return;
  writeCursor(storage(), cursorFromBrief(cockpit.brief));
  if (readWindow(storage()) !== 'last-visit') writeWindow(storage(), 'last-visit');
  for (const key of [...cockpit.expanded]) if (!key.includes(':')) cockpit.expanded.delete(key);
  try { await refreshCockpit(null, { force: true }); renderMain(); toast('Marked as seen. Changes from now on will show here.'); } catch (error) { toast(error.message, true); }
}

async function changeWindow(value) {
  writeWindow(storage(), value);
  for (const key of [...cockpit.expanded]) if (!key.includes(':')) cockpit.expanded.delete(key);
  try { await refreshCockpit(null, { force: true }); renderMain(); } catch (error) { toast(error.message, true); }
}

function toggleExpanded(name) {
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
  else toast('This task is no longer on the board. Its history stays in Activity.', true);
}

// The full MetricValue behind a number, as of the time the number was computed.
async function openExplain({ metric, project: projectId, task: taskKey }, opener) {
  const dialog = $('#explain-dialog');
  // Focus comes back to the number when the drawer closes.
  opener?.focus({ preventScroll: true });
  const asOf = ['home', 'decisions', 'projects'].includes(state.view) ? cockpit.brief?.asOf : cockpit.metrics.get(projectId)?.asOf || cockpit.brief?.asOf;
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

// A task's timeline in its drawer, and the commits behind it.
async function loadTaskHistory(task) {
  let history;
  try { history = await api(`/tasks/${encodeURIComponent(task.id)}/history`); } catch (error) { history = { error: error.status === 404 ? 'No history yet: this task has not been committed.' : error.message }; }
  const slot = $('#task-history');
  if (!slot || slot.dataset.task !== task.id) return;
  slot.innerHTML = renderTimeline(history, cockpit.brief?.timezone);
  const evidence = $('#task-evidence');
  if (evidence) evidence.innerHTML = renderEvidence(task, history);
}

// The task as written: the Markdown below its frontmatter.
async function loadTaskBody(task) {
  let text = '';
  let failed = '';
  let read = null;
  try { read = await api(`/tasks/${encodeURIComponent(task.id)}`); text = read.body || ''; } catch (error) { failed = error.message; }
  const slot = $('#task-body');
  if (!slot || slot.dataset.task !== task.id) return;
  slot.innerHTML = failed ? `<p class="muted">${escape(failed)}</p>` : text.trim() ? `<div class="markdown">${renderMarkdown(text, { shift: 2 })}</div>` : '<p class="muted">The task file has no text below its header.</p>';
  // A tracked task's file says whether Done asks for a Result line and
  // whether a live run holds every action; the bar learns it here.
  if (read && 'liveRun' in read) {
    taskDetails.set(task.id, { version: read.version, fields: { liveRun: read.liveRun, resultPending: read.resultPending } });
    const bar = $('#task-dialog .action-bar');
    const current = state.tasks.find((entry) => entry.id === task.id);
    if (bar && current && !$('#action-slot')?.childElementCount && !bar.contains(document.activeElement) && !state.acting) bar.outerHTML = actionBar(current);
  }
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
  if (!dialog.open) {
    // Focus goes back to what opened the dialog, or to the same task's card when
    // a refresh has replaced it.
    const opener = document.activeElement;
    const taskId = opener?.dataset?.action === 'open-task' ? opener.dataset.id : '';
    dialog.addEventListener('close', () => {
      if (document.querySelector('dialog[open]')) return;
      const target = opener?.isConnected ? opener : taskId && $('#main').querySelector(`[data-action="open-task"][data-id="${CSS.escape(taskId)}"]`);
      target?.focus({ preventScroll: true });
    }, { once: true });
    dialog.showModal();
  } else {
    // The content was swapped in place (a linked task): focus starts where a fresh open's would.
    dialog.querySelector('[autofocus], [data-close]')?.focus();
  }
}

function anyDialogOpen() {
  return Boolean(document.querySelector('dialog[open]'));
}

function colorField(selected) {
  return `<fieldset class="color-field"><legend>Project color</legend><div class="color-options">${colors.map((color) => `<label class="color-option color-${color}"><input type="radio" name="color" value="${color}" ${selected === color ? 'checked' : ''}><span aria-hidden="true">${icon('check')}</span><span class="sr-only">${color}</span></label>`).join('')}</div></fieldset>`;
}

function openProjectEditor(project = null) {
  const dialog = $('#project-dialog');
  dialog.innerHTML = `<form id="project-form"><header class="dialog-heading"><div><span class="dialog-eyebrow">${project ? escape(project.name) : 'Start a new project here'}</span><h2 id="project-dialog-title">${project ? 'Edit project' : 'New project'}</h2></div><button type="button" class="icon-button" data-close aria-label="Close project editor">${icon('close')}</button></header><div class="dialog-fields"><label class="field">Project name<input name="name" required maxlength="100" placeholder="e.g. Website launch" value="${escape(project?.name || '')}" autofocus></label><label class="field">Description <span class="field-optional">optional</span><textarea name="description" rows="3" maxlength="4000" placeholder="What are you working toward?">${escape(project?.description || '')}</textarea></label>${colorField(project ? projectColor(project) : 'blue')}<label class="field">WIP limit<input name="wipLimit" type="number" min="1" max="99" required value="${project?.wipLimit || 6}"><small>How many tasks may be in progress or blocked at once. The method checks it.</small></label><p class="form-error" id="project-error" role="alert"></p></div><footer class="dialog-footer">${project ? '' : '<button type="button" class="text-button dialog-switch" data-switch-link>Track an existing repository instead</button>'}<button type="button" class="button button-secondary" data-close>Cancel</button><button type="submit" class="button button-primary">${project ? 'Save changes' : 'Create project'}</button></footer></form>`;
  dialog.querySelector('[data-switch-link]')?.addEventListener('click', () => openLinkEditor());
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
  dialog.querySelector('[name="name"]').focus();
}

// Tracks an existing repository: AGE Aris reads its board and history.
function openLinkEditor() {
  const dialog = $('#project-dialog');
  dialog.innerHTML = `<form id="link-form"><header class="dialog-heading"><div><span class="dialog-eyebrow">Track an existing repository</span><h2 id="project-dialog-title">Track a repository</h2></div><button type="button" class="icon-button" data-close aria-label="Close">${icon('close')}</button></header><div class="dialog-fields"><p class="dialog-copy">AGE Aris reads the repository’s AA/ task board (or deaddrop/ or pm/, its older names) and its git history, and checks the work against the board’s method. Nothing there changes unless you switch task actions on for it; then each claim, block or done is one commit of one task file, and the agents working in it carry on as before.</p><label class="field">Repository folder<input name="path" required maxlength="4096" placeholder="/home/you/code/project" spellcheck="false" autocomplete="off" autofocus><small>The full path of the folder that holds .git and the board.</small></label><label class="field">Name <span class="field-optional">optional</span><input name="name" maxlength="100" placeholder="The folder’s name"></label>${colorField('blue')}<p class="form-error" id="link-error" role="alert"></p></div><footer class="dialog-footer"><button type="button" class="text-button dialog-switch" data-switch-new>Start a new project instead</button><button type="button" class="button button-secondary" data-close>Cancel</button><button type="submit" class="button button-primary">Track repository</button></footer></form>`;
  const form = $('#link-form');
  form.querySelector('[data-switch-new]').addEventListener('click', () => openProjectEditor());
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = form.querySelector('[type="submit"]');
    const data = Object.fromEntries(new FormData(form));
    button.disabled = true;
    $('#link-error').textContent = '';
    try {
      const saved = await api('/projects/link', 'POST', { path: data.path.trim(), name: data.name.trim(), color: colorHex[data.color] });
      closeDialog(dialog);
      await refresh();
      navigate(saved.id);
      toast(`Tracking ${saved.name}. Task actions are off until you switch them on.`);
    } catch (error) { $('#link-error').textContent = error.message; } finally { button.disabled = false; }
  });
  setupDialog(dialog);
  form.elements.path.focus();
}

function openUnlinkDialog(project) {
  if (!project?.linked) return;
  const dialog = $('#action-dialog');
  dialog.innerHTML = `<form id="unlink-form">${dialogHeading('Tracked repository', `Stop tracking ${escape(project.name)}?`, 'Close dialog')}<div class="dialog-fields"><p class="dialog-copy">It leaves Home, Projects, and Activity. Nothing in <code>${escape(project.repository)}</code> changes, and you can track it again at any time.</p><p class="form-error" role="alert"></p></div><footer class="dialog-footer"><button type="button" class="button button-secondary" data-close autofocus>Keep tracking</button><button type="submit" class="button button-danger">Stop tracking</button></footer></form>`;
  const form = $('#unlink-form');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = form.querySelector('[type="submit"]');
    button.disabled = true;
    try {
      await api(`/projects/${encodeURIComponent(project.id)}`, 'DELETE');
      closeDialog(dialog);
      await refresh();
      navigate('home');
      toast(`${project.name} is no longer tracked. The repository is unchanged.`);
    } catch (error) { form.querySelector('.form-error').textContent = error.message; button.disabled = false; }
  });
  setupDialog(dialog);
}

// The switch for task actions on a tracked repository. Switching on shows
// what it means there (the branch it pins, the identity, skipped hooks, other
// worktrees, STATE.md), as the server lists it, and needs a confirmation;
// switching off takes one click.
async function switchTaskActions(project, button) {
  if (!project?.linked) return;
  const on = !project.actions?.on;
  const send = (confirm) => api(`/projects/${encodeURIComponent(project.id)}`, 'PATCH', { version: project.version, taskActions: { on }, ...(confirm ? { confirm } : {}) });
  button.disabled = true;
  try {
    let saved;
    try { saved = await send(); } catch (error) {
      if (error.code !== 'CONFIRM') throw error;
      button.disabled = false;
      const go = await confirmAction({ eyebrow: project.name, title: `Switch task actions on for ${project.name}?`, reasons: error.reasons || [], confirm: 'Switch on' });
      if (!go) return button.focus();
      button.disabled = true;
      saved = await send(error.confirmToken);
    }
    await refresh();
    toast(saved.actions?.on ? `Task actions are on for ${project.name}: each one is a commit to ${saved.actions.branch}, not pushed.` : `Task actions are off for ${project.name}.`);
    $('#main').querySelector('[data-action="task-actions"]')?.focus();
  } catch (error) {
    toast(refusalText(error), true);
  } finally {
    if (button.isConnected) button.disabled = false;
  }
}

async function copyPath(path) {
  try { await navigator.clipboard.writeText(path); toast('Repository path copied'); } catch { toast(path); }
}

// The grouping key of a task type, as the server computes it: lowercased,
// trimmed, placeholders and stray characters removed; '' means untyped.
function typeKey(value = '') {
  const text = String(value).toLowerCase().trim();
  return /[{}]/.test(text) ? '' : text.replace(/[^a-z0-9 _-]/g, '').trim();
}

// The top of the task drawer, the same for every task: where it is, its state,
// who holds it, its signals, and the holder's latest note.
function drawerHead(task, { editable }) {
  const project = projectOf(task);
  const signal = signals().get(task.id);
  const eyebrow = `<span class="dialog-eyebrow"><span class="task-number">${escape(taskNumber(task))}</span><span>${escape(project?.name || '')}</span>${project?.linked ? '<span class="readonly-badge">Tracked</span>' : ''}</span>`;
  const heading = `<header class="dialog-heading"><div>${eyebrow}<h2 id="task-dialog-title">${escape(task.title)}</h2></div><button type="button" class="icon-button" data-close aria-label="Close task">${icon('close')}</button></header>`;
  const summary = `<div class="drawer-summary"><span class="status-pill status-${task.status}"><span class="status-dot"></span>${statuses[task.status] || task.status}</span>${holder(task) || '<span>Unclaimed</span>'}${signal && task.status !== 'done' ? signalBadges(signal) : ''}${task.priorityGiven === false ? '' : priorityBadge(task)}${task.dueDate ? `<span class="due-date ${overdue(task) ? 'is-overdue' : ''}">${icon('calendar')}Due ${escape(formatDate(task.dueDate, true))}</span>` : ''}${task.type ? `<span class="needs-tag">${escape(task.type)}</span>` : ''}${!editable && task.createdAt ? `<span>Filed ${escape(formatDate(task.createdAt, true))}</span>` : ''}</div>`;
  const note = `${task.status === 'blocked' && task.blockedReason ? `<div class="drawer-note"><small>Blocked because</small><p>${escape(task.blockedReason)}</p></div>` : ''}${task.claimNote ? `<div class="drawer-note"><small>${ownerChip(task.claim)} latest note</small><p>${escape(task.claimNote)}</p></div>` : ''}`;
  return { heading, summary: editable ? summary : `${summary}${note}`, note };
}

// Where a task sits in its thread: what it builds on and what builds on it.
function drawerThread(task) {
  const place = placeOf(task);
  if (!place || (!place.needs.length && !place.children.length)) return '';
  const line = (entry) => `<li><button type="button" class="task-link" data-action="open-task" data-id="${escape(entry.id)}"><span class="task-number">${escape(taskNumber(entry))}</span>${escape(entry.title)}</button> <span class="status-pill status-${entry.status}"><span class="status-dot"></span>${statuses[entry.status] || entry.status}</span></li>`;
  const thread = place.thread;
  const done = thread ? thread.tasks.length - thread.open.length : 0;
  return `<section class="drawer-section drawer-thread"><h3>Thread</h3>${thread ? `<p class="drawer-thread-name">${icon('route')}<span class="drawer-thread-title"><span class="task-number">${escape(taskNumber(thread.root))}</span> ${escape(thread.root.title)}</span><span class="muted">${done} of ${thread.tasks.length} done</span></p>` : ''}${place.needs.length ? `<h4>Builds on</h4><ul class="drawer-thread-list">${place.needs.map(line).join('')}</ul>` : ''}${place.children.length ? `<h4>Built on by</h4><ul class="drawer-thread-list">${place.children.map(line).join('')}</ul>` : ''}</section>`;
}

function drawerTimeline(task, open) {
  return `<details class="drawer-history" data-key="history" ${open ? 'open' : ''}><summary>Timeline</summary><div id="task-history" data-task="${escape(task.id)}">${renderTimeline(null)}</div></details><div id="task-evidence"></div>`;
}

// `status` presets a new task's column.
function openTaskEditor(task = null, status = '') {
  if (task && !writable(projectOf(task))) return openTaskViewer(task);
  const here = selectedProject();
  if (!task && here && !writable(here)) return toast(`New tasks for ${here.name} are added in the repository; AGE Aris acts on the tasks already there.`, true);
  const choices = writableProjects();
  if (!task && !choices.length) return openAddProject();
  const current = selectedProject();
  const projectId = task?.projectId || (writable(current) ? current.id : choices[0].id);
  const initialStatus = status || task?.status || 'backlog';
  const types = [...new Set(['feature', 'bug', 'chore', ...state.tasks.filter((entry) => entry.projectId === projectId).map((entry) => typeKey(entry.type))].filter(Boolean))];
  const dialog = $('#task-dialog');
  const head = task ? drawerHead(task, { editable: true }) : null;
  const heading = head ? head.heading : `<header class="dialog-heading"><div><span class="dialog-eyebrow">Plan your next step</span><h2 id="task-dialog-title">New task</h2></div><button type="button" class="icon-button" data-close aria-label="Close task editor">${icon('close')}</button></header>`;
  dialog.innerHTML = `<form id="task-form" ${task ? `data-task="${escape(task.id)}"` : ''}>${heading}<div class="dialog-fields">${head ? `${head.summary}${head.note}${actionBar(task)}` : ''}${task ? `${drawerThread(task)}${taskRunPanel(task)}` : ''}<label class="field">Task title<input name="title" required maxlength="200" placeholder="What needs to get done?" value="${escape(task?.title || '')}" autofocus></label><label class="field">Project<select name="projectId" ${task ? 'disabled' : ''}>${(task ? state.projects : choices).map((project) => `<option value="${escape(project.id)}" ${projectId === project.id ? 'selected' : ''}>${escape(project.name)}</option>`).join('')}</select></label><div class="field-row"><label class="field">Status<select name="status">${options(statuses, initialStatus)}</select></label><label class="field">Priority<select name="priority">${options(priorities, task?.priority || 'medium')}</select></label></div><label class="field" id="blocked-reason-field" ${initialStatus === 'blocked' ? '' : 'hidden'}>What would unblock it? <span class="field-optional">optional</span><input name="blockedReason" maxlength="200" placeholder="e.g. Waiting on the API key from Ops" value="${escape(task?.blockedReason || '')}"><small>One line. It is cleared when the task leaves Blocked.</small></label><label class="field">Type <span class="field-optional">optional</span><input name="type" maxlength="40" list="type-suggestions" placeholder="e.g. feature or bug" value="${escape(task?.type || '')}"><datalist id="type-suggestions">${types.map((type) => `<option value="${escape(type)}"></option>`).join('')}</datalist><small>Tasks of one type share a service level; bug counts as defect work.</small></label><div class="field-row"><label class="field">Owner <span class="field-optional">optional</span><input name="assignee" maxlength="100" list="owner-suggestions" placeholder="Unassigned" value="${escape(task?.assignee || '')}"><datalist id="owner-suggestions">${[...new Set([state.operator, ...state.tasks.map((entry) => entry.assignee)].filter(Boolean))].map((owner) => `<option value="${escape(owner)}"></option>`).join('')}</datalist></label><label class="field">Due date <span class="field-optional">optional</span><input name="dueDate" type="date" value="${escape(task?.dueDate || '')}"></label></div><label class="field">Description <span class="field-optional">optional</span><textarea name="description" rows="8" maxlength="20000" placeholder="Add context, a clear next step, or what done looks like…">${escape(task?.description || '')}</textarea></label>${task ? `<div class="task-timestamps"><span>Created ${escape(formatDate(task.createdAt, true))}</span><span>Updated ${escape(formatDate(task.updatedAt, true))}</span></div>${drawerTimeline(task, false)}` : ''}<p class="form-error" id="task-error" role="alert"></p></div><footer class="dialog-footer"><button type="button" class="button button-secondary" data-close>Cancel</button><button type="submit" class="button button-primary">${task ? 'Save changes' : 'Create task'}</button></footer></form>`;
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
    dialog.querySelector('.drawer-history').addEventListener('toggle', (event) => { if (event.currentTarget.open) loadTaskHistory(task); }, { once: true });
  }
  setupDialog(dialog);
}

// A tracked repository's task: the task file as written, its timeline, the
// commits behind it, and the task actions its board allows. Anything else is
// changed in the repository.
function openTaskViewer(task) {
  const project = projectOf(task);
  const dialog = $('#task-dialog');
  const head = drawerHead(task, { editable: false });
  const actions = project?.actions;
  const where = actions?.on
    ? `Commits to <code>${escape(actions.branch)}</code> in <code>${escape(project.repository)}</code> as ${escape(actions.operator || '')}; not pushed. Anything else about <code>${escape(task.file || taskNumber(task))}</code> changes in the repository, and AGE Aris picks it up.`
    : `${escape(actions?.reason || 'Task actions are off.')} Change <code>${escape(task.file || taskNumber(task))}</code> in <code>${escape(project?.repository || '')}</code> and AGE Aris picks the change up.`;
  dialog.innerHTML = `<div class="task-view" data-task="${escape(task.id)}">${head.heading}<div class="dialog-fields">${head.summary}${actionBar(task)}${drawerThread(task)}<section class="drawer-section"><h3>The task</h3><div id="task-body" data-task="${escape(task.id)}"><p class="muted">Reading the task file…</p></div></section><section class="drawer-section">${drawerTimeline(task, true)}</section><p class="readonly-note">${icon('git')}<span>${where}</span></p></div><footer class="dialog-footer"><button type="button" class="button button-secondary" data-close>Close</button></footer></div>`;
  setupDialog(dialog);
  loadTaskBody(task);
  loadTaskHistory(task);
}

// --- Task actions --------------------------------------------------------------
// One registry (actions.js) says what can be done and why not. The drawer's bar
// and a column change by drag both go through performAction.

// What an action that asks for input says: its label, a placeholder, a length.
const actionPrompts = { block: ['What would unblock it?', 'e.g. Waiting on the API key from Ops', 200], done: ['What came of it?', 'One line for the task’s Result', 200], priority: ['Priority'], assign: ['Owner', 'Leave empty for nobody', 100] };

function wipCountOf(task) {
  return state.tasks.filter((entry) => entry.projectId === task.projectId && ['in_progress', 'blocked'].includes(entry.status)).length;
}

function actionsFor(task) {
  return availability(withDetails(task), projectOf(task), { operator: state.operator, wipCount: wipCountOf(task) });
}

function actionBar(task) {
  const buttons = actionsFor(task).filter((entry) => entry.relevant).map((entry) => {
    const action = TASK_ACTIONS.find((candidate) => candidate.id === entry.id);
    const why = `action-why-${entry.id}`;
    return `<span class="action-item"><button type="button" class="button button-secondary action-button" data-action="act" data-act="${entry.id}" data-id="${escape(task.id)}" ${entry.enabled ? '' : `aria-disabled="true" aria-describedby="${why}"`}>${icon(action.icon)}${escape(entry.label)}</button>${entry.enabled ? '' : `<span class="action-why" id="${why}" role="tooltip">${escape(entry.why)}</span>`}</span>`;
  }).join('');
  return `<div class="action-bar" role="group" aria-label="Task actions"><div class="action-buttons">${buttons}</div><div class="action-slot" id="action-slot"></div><p class="action-note" id="action-note" role="status"></p><p class="form-error action-error" id="action-error" role="alert"></p></div>`;
}

// The task the open drawer shows, if any: in the edit form, or in a tracked
// task's view.
function drawerTaskId() {
  return $('#task-dialog').open ? ($('#task-form') || $('#task-dialog .task-view'))?.dataset.task || '' : '';
}

// A person's answer to an action that asks for one: a line, or one choice.
function showActionInput(id, task) {
  const asks = inputFor(id, withDetails(task), projectOf(task)) || { needs: 'result', required: true };
  const label = actionsFor(task).find((entry) => entry.id === id)?.label || id;
  const [prompt, placeholder, max] = actionPrompts[id];
  $('#action-error').textContent = '';
  $('#action-note').textContent = '';
  const field = id === 'priority'
    ? `<select name="input" data-action-input>${options(priorities, task.priority)}</select>`
    : `<input name="input" data-action-input maxlength="${max}" placeholder="${escape(placeholder)}" ${asks.required ? 'required aria-required="true"' : ''} ${id === 'assign' ? `list="action-owners" value="${escape(task.assignee)}"` : ''}>${id === 'assign' ? `<datalist id="action-owners">${[...new Set([state.operator, ...state.tasks.map((entry) => entry.assignee)].filter(Boolean))].map((owner) => `<option value="${escape(owner)}"></option>`).join('')}</datalist>` : ''}`;
  $('#action-slot').innerHTML = `<div class="action-input" role="group" aria-label="${escape(label)}"><label class="field">${prompt}${asks.needs === 'reason' && !asks.required ? ' <span class="field-optional">optional</span>' : ''}${field}</label><button type="button" class="button button-primary" data-action="act-confirm" data-act="${id}" data-id="${escape(task.id)}">${escape(label)}</button><button type="button" class="button button-secondary" data-action="act-cancel" data-act="${id}">Cancel</button></div>`;
  const answer = $('#action-slot [data-action-input]');
  answer.focus();
  if (answer.select) answer.select();
}

function closeActionInput(id) {
  $('#action-slot').innerHTML = '';
  $('#task-dialog').querySelector(`[data-action="act"][data-act="${id}"]`)?.focus();
}

// The fields a person has changed in the drawer's full form, by name, except
// those in `skip` (the ones an action is about to set).
function dirtyFields(form, skip) {
  const dirty = {};
  for (const element of form.elements) {
    if (!element.name || element.name === 'input' || element.disabled || skip.includes(element.name)) continue;
    const initial = element.tagName === 'SELECT' ? ([...element.options].find((option) => option.defaultSelected) || element.options[0])?.value : element.defaultValue;
    if (element.value !== initial) dirty[element.name] = element.value;
  }
  return dirty;
}

// While a request is out the bar says so and does nothing more.
function setBarBusy(busy) {
  const bar = $('#task-dialog .action-bar');
  if (!bar) return;
  if (busy) bar.setAttribute('aria-busy', 'true');
  else bar.removeAttribute('aria-busy');
}

// A refusal as the person reads it: what happened, that nothing changed, and
// what to do about it.
function refusalText(error) {
  const said = error.message.endsWith('.') ? error.message : `${error.message}.`;
  const unchanged = error.status === 409 && !/nothing was changed/i.test(said) ? ' Nothing was changed.' : '';
  return `${said}${unchanged}${error.remedy ? ` ${error.remedy}` : ''}`;
}

// What a committed task action says: the commit, the branch, that it was not
// pushed, and any warning with its remedy.
function committedText(action, task, result) {
  const done = `${action.aa?.done || action.done} ${taskNumber(task)} · ${result.commit.slice(0, 7)} on ${result.branch} · not pushed`;
  return [done, ...(result.warnings || []).map((warning) => `${warning.message}${warning.remedy ? ` ${warning.remedy}` : ''}`)].join(' · ');
}

// One confirmation for an action, listing every reason it needs one. Resolves
// true when the person confirms.
function confirmAction({ eyebrow, title, reasons, confirm }) {
  return new Promise((resolve) => {
    const dialog = $('#action-dialog');
    dialog.innerHTML = `<form id="confirm-form">${dialogHeading(escape(eyebrow), escape(title), 'Close dialog')}<div class="dialog-fields"><ul class="confirm-reasons">${reasons.map((reason) => `<li>${escape(reason.text)}</li>`).join('')}</ul></div><footer class="dialog-footer"><button type="button" class="button button-secondary" data-close>Cancel</button><button type="submit" class="button button-primary" autofocus>${escape(confirm)}</button></footer></form>`;
    let confirmed = false;
    $('#confirm-form').addEventListener('submit', (event) => {
      event.preventDefault();
      confirmed = true;
      closeDialog(dialog);
    });
    dialog.addEventListener('close', () => resolve(confirmed), { once: true });
    setupDialog(dialog);
    dialog.querySelector('[type="submit"]').focus();
  });
}

// The single entry point for changing a task by action. A refusal is shown in
// the drawer (as an alert) and as a toast, and nothing is shown as done until
// the server has said so. One action is in flight at a time. On a tracked
// board a CONFIRM refusal becomes one confirmation, and confirming resends
// the action with its token.
async function performAction(id, taskId, { input, confirm } = {}) {
  if (state.acting) return;
  const listed = state.tasks.find((entry) => entry.id === taskId);
  const action = TASK_ACTIONS.find((entry) => entry.id === id);
  if (!listed || !action) return toast('This task is no longer on the board. Its history stays in Activity.', true);
  const task = withDetails(listed);
  const project = projectOf(task);
  const tracked = projectKind(project) === 'aa';
  const refuse = (message) => {
    if (drawerTaskId() === taskId) $('#action-error').textContent = message;
    toast(message, true);
  };
  const entry = actionsFor(task).find((candidate) => candidate.id === id);
  if (!entry.enabled) return refuse(entry.why);
  const asks = inputFor(id, task, project);
  if (asks && input === undefined) {
    if (drawerTaskId() !== taskId) {
      // Focus goes back to this task's card when the drawer closes.
      $('#main').querySelector(`[data-action="open-task"][data-id="${CSS.escape(taskId)}"]`)?.focus({ preventScroll: true });
      openTask(taskId);
    }
    return showActionInput(id, task);
  }
  if (asks?.required && !String(input).trim()) return refuse(`${actionPrompts[id][0]} One line is needed.`);
  let request;
  try { request = actionRequest(id, task, input, project, { confirm }); } catch (error) { return refuse(error.message); }
  const inDrawer = drawerTaskId() === taskId;
  const dirty = inDrawer && $('#task-form') ? dirtyFields($('#task-form'), Object.keys(request.body)) : {};
  state.acting = true;
  setBarBusy(true);
  let failure = '';
  let refused = null;
  let result = null;
  let refreshed = true;
  try { result = await api(request.path, request.method, request.body); } catch (error) { refused = error; failure = refusalText(error); }
  if (refused?.code === 'CONFIRM') {
    state.acting = false;
    setBarBusy(false);
    const go = await confirmAction({ eyebrow: `${taskNumber(task)} · ${project?.name || ''}`, title: `${entry.label} ${taskNumber(task)}?`, reasons: refused.reasons || [], confirm: entry.label });
    if (go) return performAction(id, taskId, { input, confirm: refused.confirmToken });
    if (drawerTaskId() === taskId) $('#task-dialog').querySelector(`[data-act="${id}"]`)?.focus();
    return;
  }
  // Done on a board whose Result turned out to be a placeholder: ask for the line.
  if (refused?.field === 'result') taskDetails.set(taskId, { version: task.version, fields: { ...taskDetails.get(taskId)?.fields, resultPending: true } });
  // The refresh is its own step: a failed one must not turn a saved action into a refusal,
  // and after a refusal it brings the drawer's version up to date for the retry.
  try { await refresh(); } catch { refreshed = false; }
  if (refused?.field === 'result') {
    const now = state.tasks.find((candidate) => candidate.id === taskId);
    if (now) taskDetails.set(taskId, { version: now.version, fields: { ...taskDetails.get(taskId)?.fields, resultPending: true } });
  }
  state.acting = false;
  setBarBusy(false);
  const done = tracked && result ? committedText(action, task, result) : action.done;
  if (failure) toast(failure, true);
  else toast(refreshed ? done : `${done}, but AGE Aris could not refresh. Use the refresh button.`, false, result?.warnings?.length ? 12000 : 0);
  // Only a drawer still showing this task follows it; one closed meanwhile stays closed.
  if (drawerTaskId() !== taskId) return;
  const fresh = state.tasks.find((candidate) => candidate.id === taskId);
  if (!fresh) return closeDialog($('#task-dialog'));
  if (!refreshed) {
    if (failure) $('#action-error').textContent = failure;
    return;
  }
  // The drawer follows the task and keeps what was typed in the fields the action does not set.
  openTaskEditor(fresh);
  const form = $('#task-form');
  if (form) for (const [name, value] of Object.entries(dirty)) if (form.elements[name]) form.elements[name].value = value;
  if (failure && (asks || refused?.field === 'result')) {
    // A refusal keeps the person's answer in its field, ready to send again.
    showActionInput(id, fresh);
    $('#action-slot [data-action-input]').value = input ?? '';
  } else if (!failure) {
    const bar = $('#task-dialog .action-bar');
    (bar.querySelector(`[data-act="${id}"]:not([aria-disabled])`) || bar.querySelector('.action-button:not([aria-disabled])') || $('#task-dialog-title')).focus();
    // Warnings stay in the drawer after the toast has gone.
    if (result?.warnings?.length) $('#action-note').textContent = result.warnings.map((warning) => `${warning.message}${warning.remedy ? ` ${warning.remedy}` : ''}`).join(' ');
  }
  if (failure) $('#action-error').textContent = failure;
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
    return card('fail', `${icon('shieldAlert')}Audit check failed`, 'This run is locked', `<p class="decision-copy">The audit log failed verification${chain.brokenAt ? ` at event ${escape(chain.brokenAt)}` : ''}. AGE Aris will not change this run.</p><pre class="error-text">${escape(chain.reason || 'No reason was recorded.')}</pre><p class="decision-copy">Inspect the git history of <code>${escape(run.path)}</code> in the project repository.</p>`);
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
        return card('wait', `${icon('decision')}Waiting on you`, `Waiting for ${agent} to claim this stage`, `<p class="decision-copy">${agent} is a pull agent. It was given ${stageName} ${escape(relativeTime(attempt.dispatchedAt).replace(/^Just now$/, 'just now'))} and has not claimed it. Check that it is running and can reach AGE Aris, or move the stage to someone else.</p><div class="decision-actions"><button class="button button-primary" data-action="reassign">${icon('route')}Reassign</button><button class="button button-secondary" data-action="run-act" data-run-action="takeover">${icon('user')}Take over this stage</button></div>`);
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

// Agents: the sessions working on the boards now, and the pipeline's agents.
function renderAgents() {
  const tabs = [['now', 'Working now'], ['pipeline', 'Pipeline agents']].map(([value, label]) => `<button class="view-tab ${state.agentsTab === value ? 'selected' : ''}" data-action="agents-tab" data-value="${value}" aria-pressed="${state.agentsTab === value}">${label}</button>`).join('');
  const heading = `<section class="page-heading"><div><h1>Agents</h1><p>Who is doing the work: the agent sessions holding tasks on each board, and the agents the pipeline routes stages to.</p></div>${state.agentsTab === 'pipeline' ? `<button class="button button-secondary" data-action="add-agent">${icon('plus')}Add agent</button>` : ''}</section><div class="view-toolbar has-tabs"><div class="view-tabs" role="group" aria-label="Agents view">${tabs}</div></div>`;
  $('#main').innerHTML = heading + (state.agentsTab === 'pipeline' ? pipelineAgents() : workingNow());
}

// One row per agent session holding work: what it holds, its latest note, and
// whether its claim is stale.
function workingNow() {
  const stale = new Map((cockpit.brief?.needsYou || []).filter((row) => row.kind === 'stale' || row.reasons?.includes('stale')).map((row) => [`${row.projectId}:${localId(row.taskKey)}`, row]));
  const sessions = new Map();
  for (const task of state.tasks) {
    if (!task.claim || !['in_progress', 'blocked'].includes(task.status)) continue;
    if (!sessions.has(task.claim)) sessions.set(task.claim, []);
    sessions.get(task.claim).push(task);
  }
  if (!sessions.size) return `<div class="empty-results">${icon('agent')}<h2>No agent session holds work</h2><p>When an agent claims a task on a board, writing its session on the task’s owner line, it appears here with its latest note.</p></div>`;
  const rows = [...sessions].map(([claim, tasks]) => {
    const quiet = tasks.map((task) => stale.get(task.id)).filter(Boolean);
    const hours = quiet.length ? Math.max(...quiet.map((row) => row.hours || 0)) : 0;
    return { claim, tasks, quiet: quiet.length > 0, hours };
  }).sort((a, b) => Number(b.quiet) - Number(a.quiet) || b.hours - a.hours || a.claim.localeCompare(b.claim));
  const quietCount = rows.filter((row) => row.quiet).length;
  return `<p class="flow-intro">${escape(plural(rows.length, 'session'))} holding work${quietCount ? `; ${quietCount} ${quietCount === 1 ? 'has' : 'have'} gone quiet past the stale threshold` : ', all showing life'}. A session shows life with a commit or a checkpoint.</p><ul class="session-list">${rows.map(({ claim, tasks, quiet, hours }) => `<li class="session-row"><div class="session-who">${ownerChip(claim)}<small>${escape(claim)}</small></div><div class="session-work">${tasks.map((task) => `<button type="button" class="task-link" data-action="open-task" data-id="${escape(task.id)}"><span class="task-number">${escape(taskNumber(task))}</span>${escape(task.title)}</button>${task.claimNote ? `<p class="session-note">“${escape(task.claimNote)}”</p>` : ''}`).join('')}</div><div class="session-state">${quiet ? `<span class="chip tone-wait" title="No commit or checkpoint within the stale threshold">Stale claim · quiet ${escape(formatAge(hours))}</span>` : '<span class="chip tone-done">Active</span>'}<span>${escape([...new Set(tasks.map((task) => projectOf(task)?.name).filter(Boolean))].join(', '))}</span></div></li>`).join('')}</ul>`;
}

function pipelineAgents() {
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
  return `<p class="flow-intro">The agents a project’s pipeline routes stages to, and how each has performed per role. Results come from the audit log of every run.</p>
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
    <div class="field-row"><label class="field">Runner<select name="runner"><option value="command" ${agent?.runner !== 'pull' ? 'selected' : ''}>Command: AGE Aris starts it</option><option value="pull" ${agent?.runner === 'pull' ? 'selected' : ''}>Pull: it asks for work</option></select></label><label class="field">Preferred tier<select name="tier">${TIERS.map((tier) => `<option value="${tier}" ${(agent?.tier || 'sonnet') === tier ? 'selected' : ''}>${tierLabel(tier)}</option>`).join('')}</select></label></div>
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

// A column change is the action that makes it. Block asks (optionally) what
// would unblock the task.
function moveTask(id, status) {
  const task = state.tasks.find((entry) => entry.id === id);
  if (!task || task.status === status) return;
  // The registry decides, and performAction refuses with its reason (task
  // actions off, another operator's task, …).
  const action = actionFor(task.status, status, projectKind(projectOf(task)));
  if (!action) return toast(`A ${statuses[task.status].toLowerCase()} task cannot move to ${statuses[status].toLowerCase()}.`, true);
  return performAction(action.id, id);
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

// A project's tab is part of its link, so a reload or a shared link keeps it.
function setLayout(layout) {
  const project = selectedProject();
  state.layout = LAYOUTS[layout] ? layout : 'board';
  if (project) history.replaceState(null, '', `#project/${project.id}${state.layout === 'board' ? '' : `/${state.layout}`}`);
  renderMain();
  refreshCockpit(null).then(() => { if (!refreshPaused()) renderMain(); }).catch(monitorOffline);
}

// One delegated handler serves the page and the task drawer, so a control does
// the same wherever it is and a linked task swaps the drawer's content in place.
function onAction(event) {
  const target = event.target.closest('[data-action]');
  if (!target) return;
  switch (target.dataset.action) {
    case 'act': if (target.getAttribute('aria-disabled') === 'true') $('#action-note').textContent = target.nextElementSibling?.textContent || ''; else performAction(target.dataset.act, target.dataset.id); break;
    case 'act-confirm': performAction(target.dataset.act, target.dataset.id, { input: $('#action-slot [data-action-input]').value }); break;
    case 'act-cancel': closeActionInput(target.dataset.act); break;
    case 'new-project': openProjectEditor(); break;
    case 'edit-project': openProjectEditor(selectedProject()); break;
    case 'new-task': openTaskEditor(null, target.dataset.status || 'backlog'); break;
    case 'open-task': openTask(target.dataset.id); break;
    case 'explain': openExplain(target.dataset, target); break;
    case 'mark-seen': markSeen(); break;
    case 'toggle-delta': toggleExpanded(target.dataset.value); break;
    case 'add-project': openAddProject(); break;
    case 'copy-path': copyPath(target.dataset.value); break;
    case 'agents-tab': state.agentsTab = target.dataset.value; renderMain(); break;
    case 'open-project': navigate(target.dataset.id); break;
    case 'layout': setLayout(target.dataset.value); break;
    case 'clear-filters': state.priority = ''; state.status = ''; state.owner = ''; state.query = ''; $('#search').value = ''; renderMain(); break;
    case 'sample-project': createSample(target); break;
    case 'link-project': openLinkEditor(); break;
    case 'unlink-project': openUnlinkDialog(selectedProject()); break;
    case 'task-actions': switchTaskActions(selectedProject(), target); break;
    case 'open-run': closeDialog($('#task-dialog')); openRun(target.dataset.id); break;
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
}
$('#main').addEventListener('click', onAction);
// A chart's dots are SVG with the role of a button: Enter and Space press them.
$('#main').addEventListener('keydown', (event) => {
  if ((event.key !== 'Enter' && event.key !== ' ') || !event.target.matches?.('[role="button"][data-action]:not(button)')) return;
  event.preventDefault();
  event.target.dispatchEvent(new MouseEvent('click', { bubbles: true }));
});
$('#task-dialog').addEventListener('click', onAction);

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

// Enter in an action's field does the action instead of saving the whole form;
// Escape closes the field and leaves the drawer open.
$('#task-dialog').addEventListener('keydown', (event) => {
  const field = event.target.closest('[data-action-input]');
  if (!field || !['Enter', 'Escape'].includes(event.key)) return;
  event.preventDefault();
  const confirm = field.closest('.action-input').querySelector('[data-action="act-confirm"]');
  if (event.key === 'Enter') performAction(confirm.dataset.act, confirm.dataset.id, { input: field.value });
  else closeActionInput(confirm.dataset.act);
});
$('#search').addEventListener('input', (event) => { state.query = event.target.value; renderMain(); });
$('#sidebar-add').innerHTML = icon('plus');
$('#search-icon').innerHTML = icon('search');
$('#menu-toggle').innerHTML = icon('menu');
$('#refresh').innerHTML = icon('refresh');
$('#sidebar-add').addEventListener('click', () => openAddProject());
$('#create-button').addEventListener('click', () => (writable(selectedProject()) ? openTaskEditor() : openAddProject()));
$('#refresh').addEventListener('click', async () => {
  $('#refresh').disabled = true;
  try { await refresh(); toast('Workspace refreshed'); } catch (error) { toast(error.message, true); } finally { $('#refresh').disabled = false; }
});
$('#menu-toggle').addEventListener('click', () => {
  if (narrowScreen.matches) $('#sidebar').classList.toggle('is-open');
  else {
    const hidden = $('.app-shell').classList.toggle('sidebar-hidden');
    try { storage()?.setItem(SIDEBAR_KEY, hidden ? 'hidden' : 'shown'); } catch { /* the choice lasts this page only */ }
  }
  syncMenuButton();
});
try { if (storage()?.getItem(SIDEBAR_KEY) === 'hidden') $('.app-shell').classList.add('sidebar-hidden'); } catch { /* shown, the default */ }
narrowScreen.addEventListener('change', syncMenuButton);
syncMenuButton();
$('#sidebar').addEventListener('click', (event) => {
  const link = event.target.closest('a');
  if (!link) return;
  event.preventDefault();
  const route = link.hash.slice(1);
  navigate(route.startsWith('project/') ? route.slice(8) : route);
});
window.addEventListener('hashchange', () => {
  const previous = state.view;
  const previousLayout = state.layout;
  readRoute();
  if (state.view !== previous) leaveHome(previous);
  // A project opens on its board unless the link names a tab.
  if (state.view !== previous && selectedProject() && !/^#project\/[^/]+\/\w/.test(location.hash)) state.layout = 'board';
  if (state.view !== lastView || state.view === 'run') window.scrollTo(0, 0);
  lastView = state.view;
  render();
  // A new view, or another tab of the same project, fetches what it shows.
  if (state.view === 'run' && state.run?.id !== state.runId) refresh().catch(monitorOffline);
  else if (state.view !== previous || state.layout !== previousLayout) refreshCockpit(null, { force: state.view === 'home' }).then(() => { if (!refreshPaused()) renderMain(); }).catch(monitorOffline);
});
document.addEventListener('keydown', (event) => {
  if (event.ctrlKey || event.metaKey || event.altKey || anyDialogOpen() || event.target.closest('input,textarea,select,[contenteditable]')) return;
  if (event.key === '/') { event.preventDefault(); $('#search').focus(); }
  if (event.key.toLowerCase() === 'n' && writableProjects().length) { event.preventDefault(); openTaskEditor(); }
  if (event.key === 'Escape') closeSlideOver();
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
  if (document.hidden) leaveHome(state.view);
  else if (state.view === 'home') homeShownAt = Date.now();
});
window.addEventListener('pagehide', () => leaveHome(state.view));
// Charts are drawn at the width they are shown at, so they redraw when #main
// changes width: a window resize, or the sidebar folding away.
let drawnWidth = 0;
let resizeTimer = 0;
new ResizeObserver(() => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    const width = mainWidth();
    if (Math.abs(width - drawnWidth) <= 8) return;
    if (drawnWidth && state.layout === 'flow' && selectedProject()) renderMain();
    drawnWidth = width;
  }, 150);
}).observe($('#main'));
document.addEventListener('visibilitychange', () => { if (!document.hidden && !refreshing && !state.authLost && !editingMain()) refresh().catch(monitorOffline); });

lastView = state.view;
refresh().catch((error) => {
  state.loading = false;
  $('#main').setAttribute('aria-busy', 'false');
  $('#main').innerHTML = `<div class="empty-results">${icon('alert')}<h1>Workspace unavailable</h1><p>${escape(error.message)}</p><p>Check that AGE Aris is running, then use the refresh button.</p></div>`;
  $('#create-button').disabled = true;
  monitorOffline(error);
});
