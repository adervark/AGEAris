import { icon } from './icons.js';
import { WINDOWS } from './cursor.js';
import { renderMarkdown } from './markdown.js';
import { visibleRows } from './threads.js';
import { agentChip, agentShort, CHECKS, escape, healthTone, healthWord, NEED, NEEDS, ownerChip, TERMS } from './words.js';

export { escape };

// The manager's views: Home, a project's Flow and Method tabs, Activity, a
// task's timeline, and the Explain drawer behind every number. Each function
// turns API responses into HTML; app.js owns state, fetching, and events.
// The story comes first and the evidence is one click down: every number with
// a definition opens the Explain drawer (data-action="explain"), and every raw
// change keeps its commit behind an expand.

const DELTA_LABELS = [
  ['finished', 'Finished'], ['started', 'Started'], ['blocked', 'Blocked'], ['unblocked', 'Unblocked'], ['added', 'Added'],
  ['removed', 'Removed'], ['dropped', 'Dropped'], ['slipped', 'Slipped'], ['pulledIn', 'Pulled in'], ['reopened', 'Reopened'],
  ['returned', 'Returned'], ['runsCompleted', 'Runs completed'], ['runsFailed', 'Runs failed'],
];
export const STATUS_WORDS = { backlog: 'Backlog', in_progress: 'In progress', blocked: 'Blocked', done: 'Done', dropped: 'Dropped' };
const RUN_EVENTS = { run_started: 'Run started', gate_opened: 'Waiting for approval', approved: 'Approved', rejected: 'Changes requested', run_completed: 'Run completed', run_failed: 'Run failed', cancelled: 'Run cancelled', retried: 'Retried' };
export const CHANGE_KINDS = { status: 'Status', field: 'Fields', created: 'Created', removed: 'Removed', dropped: 'Dropped', run: 'Runs', project: 'Project' };
// The short word a signal badge shows on a card or a row.
const SIGNAL_WORDS = { decision: 'Decision', overdue: 'Overdue', stale: 'Stale claim', due_risk: 'Date at risk', aging: 'Aging', blocked: 'Blocked', unassigned: 'No owner' };

const round1 = (value) => Math.round(value * 10) / 10;
export const plural = (n, word, many = `${word}s`) => `${n} ${n === 1 ? word : many}`;
const shortSha = (sha) => String(sha || '').slice(0, 7);
export const localId = (taskKey) => String(taskKey || '').split('#')[0];
const capital = (text) => String(text).replace(/^./, (letter) => letter.toUpperCase());

function zoned(value, timezone, options) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  try { return date.toLocaleString(undefined, { ...options, timeZone: timezone || undefined }); } catch { return date.toLocaleString(undefined, options); }
}

export function formatWhen(value, timezone) {
  return zoned(value, timezone, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatClock(value, timezone) {
  return zoned(value, timezone, { hour: '2-digit', minute: '2-digit' });
}

function formatDay(value, timezone) {
  return zoned(value, timezone, { weekday: 'long', month: 'long', day: 'numeric' });
}

function shortDate(value) {
  const date = new Date(String(value).length === 10 ? `${value}T12:00:00` : value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// An age in hours, the way a person says it.
export function formatAge(hours) {
  if (hours === null || hours === undefined || !Number.isFinite(hours)) return '';
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} min`;
  if (hours < 48) return `${round1(hours)} h`;
  return `${round1(hours / 24)} days`;
}

// A number with a definition: opens the Explain drawer. The number reads as
// plain text; hover and focus show that it explains itself.
export function metricButton({ projectId, metricId, display, title = '', taskKey = '', className = '' }) {
  return `<button type="button" class="metric-number ${className}" data-action="explain" data-metric="${escape(metricId)}" data-project="${escape(projectId)}"${taskKey ? ` data-task="${escape(taskKey)}"` : ''} title="${escape(title || 'How this number is computed')}">${escape(display)}</button>`;
}

function metricOf(projectId, metric, extra = {}) {
  if (!metric) return '<span class="muted">—</span>';
  return metricButton({ projectId, metricId: metric.id, display: metric.display, title: metric.status === 'ok' ? '' : metric.reason, ...extra });
}

export function healthDot(health) {
  return `<span class="health-dot tone-${healthTone(health)}" aria-hidden="true"></span>`;
}

export function sampleBadge(sample) {
  return sample ? '<span class="sample-badge" title="This project’s history was generated to show how AGE Aris works.">Simulated history</span>' : '';
}

function openItem({ projectId, taskKey, runId }) {
  if (runId) return `data-action="open-run" data-id="${escape(runId)}"`;
  return `data-action="open-task" data-id="${escape(`${projectId}:${localId(taskKey)}`)}"`;
}

function taskLink(projectId, taskKey, title, extra = '') {
  return `<button type="button" class="task-link ${extra}" ${openItem({ projectId, taskKey })}><span class="task-number">${escape(localId(taskKey))}</span>${escape(title || '')}</button>`;
}

// What a project's health checks say, as one sentence: the failing checks'
// messages, or that nothing breaks them.
export function headline(line) {
  if (!line) return '';
  if (line.state === 'unavailable') return line.unavailable || 'This repository cannot be read right now.';
  if (line.state !== 'ready') return line.sentence || 'Reading this project’s history…';
  if (line.health.level === 'grey') return line.sentence;
  const failing = line.health.rules.filter((rule) => rule.level === 'red' || rule.level === 'amber').sort((a, b) => (a.level === 'red' ? 0 : 1) - (b.level === 'red' ? 0 : 1));
  return failing.length ? `${capital(failing.map((rule) => rule.message).join(', '))}.` : 'Every method check passes.';
}

// --- Signals: one badge vocabulary for cards, rows and the drawer --------------

// Signals per task, from the brief's Needs you rows: `${projectId}:${T001}` →
// { reasons, row }.
export function signalIndex(brief) {
  const index = new Map();
  for (const row of brief?.needsYou || []) {
    if (!row.taskKey) continue;
    index.set(`${row.projectId}:${localId(row.taskKey)}`, { reasons: row.reasons?.length ? row.reasons : [row.kind], row });
  }
  return index;
}

function signalDetail(kind, row) {
  if (!row || row.kind !== kind) return '';
  if (kind === 'stale') return formatAge(row.hours);
  if (kind === 'aging') return `${row.ageDays} d`;
  if (kind === 'blocked') return `${round1(row.days)} d`;
  if (kind === 'overdue') return `${row.daysOverdue} d`;
  return '';
}

export function signalBadges(signal) {
  if (!signal) return '';
  return signal.reasons.map((kind) => {
    const need = NEED[kind];
    const detail = signalDetail(kind, signal.row);
    return `<span class="chip tone-${need?.tone || 'idle'}" title="${escape(need ? `${need.term}: ${need.help}` : kind)}">${escape(SIGNAL_WORDS[kind] || kind)}${detail ? ` ${escape(detail)}` : ''}</span>`;
  }).join('');
}

// --- Home -------------------------------------------------------------------------

function needDetail(row) {
  const metric = (display, title = '') => metricButton({ projectId: row.projectId, metricId: row.metricId, display, title, taskKey: row.kind === 'due_risk' ? row.taskKey : '' });
  switch (row.kind) {
    case 'decision': return `${escape({ gate: 'Approval', input: 'Input requested', waiting: 'No agent free', failed: 'Run failed', unclaimed: 'Unclaimed', integrity: 'Audit check failed' }[row.reason] || 'Decision')} · waiting ${metric(formatAge(row.age), row.workingHours !== undefined ? `${row.workingHours} working hours` : '')}`;
    case 'overdue': return `${metric(plural(row.daysOverdue, 'day'))} past ${escape(shortDate(row.dueDate))}`;
    case 'stale': return `quiet ${metric(formatAge(row.hours))}`;
    case 'due_risk': return `${metric(`${Math.round((row.probability ?? 0) * 100)}% on time`, row.reasonText)} · due ${escape(shortDate(row.dueDate))}`;
    case 'aging': return `in progress ${metric(`${row.ageDays} d`)}`;
    case 'blocked': return `blocked ${metric(plural(round1(row.days), 'day'))}`;
    case 'unassigned': return `${escape(row.priority)} priority`;
    default: return '';
  }
}

// One row in Needs you. `taskOf` finds the task for its latest note.
function needRow(row, { taskOf, manyProjects }) {
  const task = row.taskKey ? taskOf(`${row.projectId}:${localId(row.taskKey)}`) : null;
  const target = openItem({ projectId: row.projectId, taskKey: row.taskKey, runId: row.kind === 'decision' ? row.runId : '' });
  const others = (row.reasons || []).filter((reason) => reason !== row.kind).map((reason) => `<span class="needs-tag" title="${escape(NEED[reason]?.help || '')}">also ${escape((SIGNAL_WORDS[reason] || reason).toLowerCase())}</span>`).join('');
  const reason = row.kind === 'blocked' && row.reasonText ? row.reasonText : row.kind === 'aging' ? `${row.level === 'critical' ? 'Past twice' : 'Past'} the service level for ${row.typeKey || 'this project’s'} work` : '';
  const note = task?.claimNote ? `“${task.claimNote}”` : reason;
  return `<li class="need-row"><button type="button" class="need-open" ${target}>${row.taskKey ? `<span class="task-number">${escape(localId(row.taskKey))}</span>` : ''}<span class="need-title" title="${escape(row.title || '')}">${escape(row.title || 'Untitled')}</span></button><span class="need-detail">${needDetail(row)}</span><span class="need-meta">${row.owner ? ownerChip(row.owner) : ''}${manyProjects ? `<span>${escape(row.projectName)}</span>` : ''}${sampleBadge(row.sample)}${others}</span>${note ? `<p class="need-reason truncate" title="${escape(note)}">${escape(note)}</p>` : ''}</li>`;
}

const NEED_ROWS = 5;

function needGroups(brief, { expanded, taskOf, manyProjects }) {
  return NEEDS.map((need) => {
    const rows = brief.needsYou.filter((row) => row.kind === need.kind);
    if (!rows.length) return '';
    const open = expanded.has(`need:${need.kind}`);
    const shown = open ? rows : rows.slice(0, NEED_ROWS);
    const more = rows.length - shown.length;
    const inbox = need.kind === 'decision' ? '<a class="text-button need-more" href="#decisions">Open the decisions inbox</a>' : '';
    return `<div class="need-group tone-${need.tone}"><div class="need-label"><strong><span class="status-dot"></span>${escape(need.term)}<span class="need-count">${rows.length}</span></strong><small>${escape(need.help)}</small></div><div><ol class="need-rows">${shown.map((row) => needRow(row, { taskOf, manyProjects })).join('')}</ol>${more ? `<button type="button" class="text-button need-more" data-action="toggle-delta" data-value="need:${need.kind}">Show ${more} more</button>` : ''}${inbox}</div></div>`;
  }).join('');
}

const CLEAR_WORDS = { decision: 'no decisions waiting', overdue: 'nothing overdue', stale: 'no stale claims', due_risk: 'no dates at risk', aging: 'no aging WIP', blocked: 'nothing blocked', unassigned: 'all urgent work has an owner' };

// The checks that found nothing, in words. A task is listed once, under its
// most pressing need, so a need it also has is not clear; nor is a check that
// cannot run yet because a project has too little history. While a project
// is still being read, no check is called clear.
function clearChecks(brief) {
  if (brief.projects.some((line) => line.state !== 'ready')) return [];
  const unchecked = new Set();
  for (const line of brief.projects) {
    if (line.kpis?.aging?.status !== 'ok') unchecked.add('aging');
    if (line.kpis?.dueRisk?.status !== 'ok') unchecked.add('due_risk');
  }
  return NEEDS.filter((need) => !unchecked.has(need.kind) && !brief.needsYou.some((row) => row.kind === need.kind || row.reasons?.includes(need.kind))).map((need) => CLEAR_WORDS[need.kind]);
}

// The clear checks, in one quiet line.
function allClear(words) {
  return words.length ? `<p class="all-clear home-clear">${icon('check')}<span>All clear: ${escape(words.join(' · '))}</span></p>` : '';
}

export function sparkline(points = [], label = 'Finished per day') {
  if (!points.length) return '';
  const max = Math.max(1, ...points.map((point) => point.n));
  const width = 4;
  const gap = 1;
  const height = 34;
  const bars = points.map((point, index) => {
    const h = point.n ? Math.max(3, Math.round((point.n / max) * height)) : 2;
    return `<rect class="${point.n ? '' : 'is-zero'}" x="${index * (width + gap)}" y="${height - h}" width="${width}" height="${h}" rx="1"><title>${escape(shortDate(point.date))}: ${point.n} finished</title></rect>`;
  }).join('');
  return `<svg class="spark" viewBox="0 0 ${points.length * (width + gap)} ${height}" preserveAspectRatio="none" role="img" aria-label="${escape(`${label}, last ${points.length} days, most ${max} in a day`)}">${bars}</svg>`;
}

// The usual week: the weekly mean of finishes over the 4 weeks before.
export function usualWeek(metric) {
  return metric?.status === 'ok' ? round1(metric.value / 4) : null;
}

// One project as a card: its health in words, why, and how work is flowing.
export function projectCard(line, { agents = 0, project } = {}) {
  const name = `<a class="project-card-name" href="#project/${escape(line.projectId)}">${escape(line.name)}</a>`;
  const badges = `${line.linked ? '<span class="readonly-badge" title="AGE Aris reads this repository and never writes to it.">Read-only</span>' : ''}${sampleBadge(line.sample)}`;
  if (line.state !== 'ready') {
    const word = line.state === 'unavailable' ? 'Unavailable' : 'Indexing';
    return `<article class="project-card"><div class="project-card-head">${healthDot(null)}${name}<span class="health-word">${word}</span>${badges}</div><p class="project-card-indexing">${line.state === 'unavailable' ? icon('alert') : '<span class="spinner"></span>'}${escape(headline(line))}</p></article>`;
  }
  const k = line.kpis;
  const usual = usualWeek(k.done4w);
  const word = metricButton({ projectId: line.projectId, metricId: 'health', display: healthWord(line.health), className: 'health-word', title: 'Which checks pass and fail' });
  const fact = (label, help, value) => `<div title="${escape(help)}"><dt>${escape(label)}</dt><dd>${value}</dd></div>`;
  return `<article class="project-card tone-${healthTone(line.health)}"><div class="project-card-head">${healthDot(line.health)}${name}${word}${badges}</div>
    <p class="project-card-sentence">${escape(headline(line))}</p>
    <div class="project-card-flow"><p><strong>${metricOf(line.projectId, k.done7d)}</strong>finished in 7 days${usual !== null ? `<br><span class="muted">usually ~${escape(usual)} a week</span>` : ''}</p>${sparkline(line.spark)}</div>
    <dl class="project-card-facts">${fact(TERMS.wip[0], TERMS.wip[1], metricOf(line.projectId, k.wip))}${k.cycle50 ? fact(TERMS.cycle[0], TERMS.cycle[1], metricOf(line.projectId, k.cycle50)) : ''}${k.cycle85 ? fact(TERMS.service[0], TERMS.service[1], metricOf(line.projectId, k.cycle85)) : ''}${fact('Agents', 'Agent sessions holding work in progress', escape(agents))}${project?.problems?.length ? fact('Unread files', 'Task files AGE Aris could not read', escape(project.problems.length)) : ''}</dl></article>`;
}

function windowNote(brief) {
  const notes = [];
  if (brief.window.clamped) notes.push('Your last visit was more than 14 days ago, so this shows the last 14 days.');
  if (brief.window.fallbacks.some((entry) => !entry.projectId)) notes.push('No last visit is recorded in this browser yet, so this counts from the previous working day.');
  const cursorMissing = brief.window.fallbacks.filter((entry) => entry.projectId);
  if (cursorMissing.length) notes.push(`${plural(cursorMissing.length, 'project')} counted by time: history was rewritten since your last visit.`);
  if (brief.window.lateLanding) notes.push(`${plural(brief.window.lateLanding.n, 'change')} dated before the window may have landed inside it (clock skew).`);
  return notes.map((note) => `<p class="window-note">${icon('alert')}${escape(note)}</p>`).join('');
}

function deltaList(name, items, timezone, manyProjects) {
  const rows = items.slice(0, 100).map((item) => {
    const target = item.taskKey ? openItem({ projectId: item.projectId, taskKey: item.taskKey }) : '';
    const what = item.from !== undefined && item.to !== undefined && name !== 'reopened' ? ` <small>${escape(item.from || 'none')} → ${escape(item.to || 'none')}</small>` : '';
    const title = `${item.taskKey ? `<span class="task-number">${escape(localId(item.taskKey))}</span>` : ''}${escape(item.title || item.taskKey || `Run ${item.runId}`)}${what}`;
    return `<li>${target ? `<button type="button" class="delta-item" ${target}>${title}</button>` : `<span class="delta-item">${title}</span>`}<span class="delta-meta">${manyProjects ? `${escape(item.projectName)} · ` : ''}${escape(formatWhen(item.at, timezone))}</span></li>`;
  }).join('');
  return `<ol class="delta-list" id="delta-${escape(name)}">${rows}${items.length > 100 ? `<li class="muted">${items.length - 100} more in Activity</li>` : ''}</ol>`;
}

export function renderHome(brief, { mode, expanded, taskOf, agentsByProject, projects }) {
  const tz = brief.timezone;
  const manyProjects = brief.projects.length > 1;
  const count = brief.needsYou.length;
  const attention = brief.projects.filter((line) => line.state === 'ready' && ['red', 'amber'].includes(line.health.level));
  const sub = attention.length ? attention.map((line) => `${line.name} ${healthWord(line.health) === 'Watch' ? 'needs watching' : 'needs attention'}`).join(' · ') : brief.projects.length ? 'Every project is on track.' : '';
  const windowMenu = `<label class="window-menu"><span class="sr-only">Window for what changed</span><select data-brief-window>${Object.entries(WINDOWS).map(([value, label]) => `<option value="${value}" ${mode === value ? 'selected' : ''}>${escape(label)}</option>`).join('')}</select></label>`;
  const moved = DELTA_LABELS.map(([name, label]) => [name, label, brief.delta[name] || []]).filter(([, , items]) => items.length);
  const clear = clearChecks(brief);
  const needs = count
    ? `<div class="panel need-board">${needGroups(brief, { expanded, taskOf, manyProjects })}</div>${allClear(clear)}`
    : `<p class="today-clear">${icon('check')}<span>Nothing needs you${clear.length ? `: ${escape(clear.join(' · '))}` : ''}.</span></p>`;
  const projectById = new Map((projects || []).map((project) => [project.id, project]));
  return `<section class="page-heading home-heading"><div><p class="home-date">${escape(formatDay(brief.asOf, tz))}</p><h1>${count ? `${plural(count, 'thing')} ${count === 1 ? 'needs' : 'need'} you` : 'Nothing needs you'}</h1>${sub ? `<p class="home-sub">${escape(sub)}</p>` : ''}</div></section>
    <section class="section" aria-labelledby="needs-heading"><div class="section-heading"><h2 id="needs-heading">Needs you</h2><span>What breaks the method’s checks, most pressing first</span></div>${needs}</section>
    <section class="section" aria-labelledby="projects-heading"><div class="section-heading"><h2 id="projects-heading">Projects</h2><a href="#projects">All projects</a></div><div class="project-cards">${brief.projects.map((line) => projectCard(line, { agents: agentsByProject.get(line.projectId) || 0, project: projectById.get(line.projectId) })).join('')}</div></section>
    <section class="section" aria-labelledby="delta-heading"><div class="section-heading"><h2 id="delta-heading">${escape(capital(brief.window.label))}</h2><div class="heading-actions">${windowMenu}<button type="button" class="button button-secondary button-small" data-action="mark-seen" title="Start the next “since your last visit” from now">${icon('check')}Mark seen</button></div></div>${windowNote(brief)}${moved.length ? `<div class="delta-chips">${moved.map(([name, label, items]) => `<button type="button" class="delta-chip ${expanded.has(name) ? 'selected' : ''}" data-action="toggle-delta" data-value="${name}" aria-expanded="${expanded.has(name)}" aria-controls="delta-${name}"><strong>${items.length}</strong>${escape(label.toLowerCase())}</button>`).join('')}</div>${moved.filter(([name]) => expanded.has(name)).map(([name, label, items]) => `<div class="delta-group"><h3>${escape(label)}</h3>${deltaList(name, items, tz, manyProjects)}</div>`).join('')}` : '<p class="today-clear">Nothing moved in this window.</p>'}<a class="section-link" href="#activity">See all activity${icon('chevron')}</a></section>`;
}

// --- Decisions header ------------------------------------------------------------

export function decisionsSummary(brief) {
  if (!brief) return '';
  const { decisions } = brief;
  const oldest = decisions.oldestWait ? formatAge((Date.parse(brief.asOf) - Date.parse(decisions.oldestWait)) / 3600000) : '';
  const latency = (metric, label) => `<span class="kpi"><span>${label}</span><span class="metric-number static" title="${escape(metric.reason || 'Hours from the gate opening to the decision')}">${escape(metric.display)}</span></span>`;
  return `<p class="kpis decisions-kpis"><span class="kpi"><span>Waiting</span><strong>${decisions.waiting.value}</strong></span>${oldest ? `<span class="kpi"><span>Oldest wait</span><strong>${escape(oldest)}</strong></span>` : ''}${latency(decisions.approvalLatency, 'Approval time, median')}${decisions.approvalLatencyP85 ? latency(decisions.approvalLatencyP85, '85% within') : ''}<span class="kpi-note">Last 14 days; non-working days excluded.</span></p>`;
}

// --- Project Flow tab --------------------------------------------------------------

function seriesChart(points, { title, caption, limit: rawLimit = 0, unit }) {
  if (!points?.length) return '';
  const limit = Number.isInteger(rawLimit) && rawLimit > 0 ? rawLimit : 0;
  const max = Math.max(1, limit, ...points.map((point) => point.n));
  const width = 6;
  const gap = 2;
  const height = 64;
  const bars = points.map((point, index) => {
    const h = point.n ? Math.max(2, Math.round((point.n / max) * height)) : 0;
    return `<rect x="${index * (width + gap)}" y="${height - h}" width="${width}" height="${h}" rx="1"><title>${escape(shortDate(point.date))}: ${point.n} ${escape(unit)}</title></rect>`;
  }).join('');
  const total = points.length * (width + gap);
  const line = limit ? `<line class="limit-line" x1="0" x2="${total}" y1="${height - Math.round((limit / max) * height)}" y2="${height - Math.round((limit / max) * height)}"><title>WIP limit ${limit}</title></line>` : '';
  return `<figure class="series"><figcaption>${escape(title)}<small>${escape(caption)}</small></figcaption><div class="series-plot"><span class="series-max">${max}</span><span class="series-zero">0</span><svg viewBox="0 0 ${total} ${height}" preserveAspectRatio="none" role="img" aria-label="${escape(`${title}: ${caption}; most ${max} in a day`)}">${bars}${line}</svg></div><div class="series-axis"><span>${escape(shortDate(points[0].date))}</span><span>${escape(shortDate(points.at(-1).date))}</span></div></figure>`;
}

function table(caption, columns, rows, empty, note = '') {
  if (!rows.length) return `<div class="health-table"><h3>${escape(caption)}</h3><p class="all-clear">${icon('check')}${escape(empty)}</p></div>`;
  return `<div class="health-table"><h3>${escape(caption)} <span>${rows.length}</span>${note ? `<small>${escape(note)}</small>` : ''}</h3><div class="task-table-wrap"><table class="task-table compact-table"><thead><tr>${columns.map(([label]) => `<th scope="col">${escape(label)}</th>`).join('')}</tr></thead><tbody>${rows.map((row) => `<tr>${columns.map(([, cell]) => `<td>${cell(row)}</td>`).join('')}</tr>`).join('')}</tbody></table></div></div>`;
}

function notReady(data) {
  if (!data) return '<div class="loading-state"><span class="spinner"></span>Computing metrics…</div>';
  if (data.state === 'error') return `<p class="today-clear">${icon('alert')}${escape(data.error)}</p>`;
  if (data.state !== 'ready') return `<p class="today-clear">${icon('clock')}Indexing this project’s history (${escape(data.building?.commitsSeen ?? 0)} commits so far). This fills in when it is done.</p>`;
  return '';
}

export function renderFlow(data, { projectId, wipLimit = 0 }) {
  const waiting = notReady(data);
  if (waiting) return waiting;
  const m = data.metrics;
  const usual = usualWeek(m.done_4w);
  const kpi = (metric, [term, help]) => `<div class="flow-kpi"><span class="flow-label">${escape(term)}</span><span class="flow-value">${metricOf(projectId, metric)}</span><span class="flow-help">${escape(help)}</span></div>`;
  const task = (row) => taskLink(projectId, row.taskKey, row.title);
  const t = data.tables;
  const risk = [
    table('Overdue', [['Task', task], ['Due', (row) => escape(row.dueDate)], ['Days late', (row) => escape(row.daysOverdue)], ['Owner', (row) => ownerChip(row.owner) || '—']], t.overdue, 'Nothing is overdue.'),
    table('Due-date forecasts', [['Task', task], ['Due', (row) => escape(row.dueDate)], ['On time', (row) => metricButton({ projectId, metricId: 'due_risk', taskKey: row.taskKey, display: row.display, title: row.reason })], ['Basis', (row) => escape(row.reason || row.reference)]], t.dueRisk.filter((row) => row.status === 'ok' || row.display !== '—'), 'No open task with a due date has a forecast yet.'),
    table('Aging WIP', [['Task', task], ['Days in progress', (row) => escape(row.value)], ['Level', (row) => escape(row.level === 'critical' ? 'past 2× service level' : 'past service level')], ['Owner', (row) => ownerChip(row.owner) || '—']], t.aging, m.aging.status === 'ok' ? 'Nothing is older than the service level.' : m.aging.reason, NEED.aging.help),
    table('Blocked', [['Task', task], ['Days', (row) => escape(round1(row.value))], ['Why', (row) => escape(row.reason || '—')], ['Owner', (row) => ownerChip(row.owner) || '—']], t.blocked, 'Nothing is blocked.'),
    table('Stale claims', [['Task', task], ['Quiet for', (row) => escape(formatAge(row.value))], ['Claimed by', (row) => ownerChip(row.owner) || '—']], t.stale, 'Every agent claim shows recent life.', NEED.stale.help),
    table('Due-date slips, last 30 days', [['Task', task], ['From', (row) => escape(row.from || 'none')], ['To', (row) => escape(row.to || 'none')], ['When', (row) => escape(formatWhen(row.at, data.timezone))]], t.slips, 'No due date moved later.'),
  ].join('');
  const held = (row) => row.tasks.map((entry) => `<button type="button" class="task-link inline" ${openItem({ projectId, taskKey: entry.taskKey })} title="${escape(entry.title)}">${escape(localId(entry.taskKey))}</button>`).join(' ');
  const people = table('People', [['Person', (row) => escape(row.owner)], ['WIP', (row) => `${escape(row.wip)}${row.overloaded ? ' <span class="needs-tag">over limit</span>' : ''}`], ['Limit', (row) => escape(row.limit)], ['Tasks', held]], t.people, 'No person holds work in progress.');
  const agents = table('Agent sessions', [['Agent', (row) => agentChip(row.owner)], ['WIP', (row) => escape(row.wip)], ['Tasks', held]], t.agents, 'No agent holds work in progress.');
  const unassigned = table('In progress with no owner', [['Task', task], ['Priority', (row) => escape(row.priority)]], t.unassigned, 'Every task in progress has an owner.');
  const anomalies = Object.entries(data.ledger.anomalies).map(([kind, n]) => `${n} ${kind.replace(/_/g, ' ')}`).join(', ');
  return `<p class="flow-intro">How work moves: what finishes, how long it takes, and how much is open at once. Each number opens its definition, formula and the tasks behind it.</p>
    <section class="health-section" aria-label="Flow measures"><div class="flow-grid">${kpi(m.done_7d, TERMS.throughput)}${kpi(usual === null ? m.done_4w : { ...m.done_4w, display: String(usual) }, TERMS.usualWeek)}${kpi(m.wip, TERMS.wip)}${kpi(m.cycle_time_p50, TERMS.cycle)}${kpi(m.cycle_time_p85, TERMS.service)}${kpi(m.lead_time_p50, TERMS.lead)}${kpi(m.lead_time_p85, TERMS.lead85)}${kpi(m.blocked_share, TERMS.blockedShare)}${kpi(m.repeat_slips, TERMS.repeatSlips)}</div>
    <div class="series-row">${seriesChart(data.series.throughput, { title: 'Throughput', caption: 'finished per day, last 6 weeks', unit: 'finished' })}${seriesChart(data.series.wip, { title: 'WIP', caption: 'in progress or blocked per day, last 6 weeks', limit: wipLimit, unit: 'in progress' })}</div></section>
    <section class="health-section" aria-labelledby="risk-heading"><div class="section-heading"><h2 id="risk-heading">Risk</h2><span>The work behind each failing check</span></div>${risk}</section>
    <section class="health-section" aria-labelledby="people-heading"><div class="section-heading"><h2 id="people-heading">Load</h2><span>Who holds work in progress</span></div>${people}${agents}${unassigned}</section>
    <p class="data-line">${icon('git')}Computed ${escape(formatWhen(data.asOf, data.timezone))} from ${plural(data.ledger.commits, 'commit')} on ${escape(data.ledger.branch || 'the default branch')}${data.ledger.clamped ? ` (${plural(data.ledger.clamped, 'commit')} with clamped times)` : ''}${anomalies ? ` · ${escape(anomalies)}` : ''} · ledger <code title="${escape(data.build.ledgerSha)}">${escape(shortSha(data.build.ledgerSha))}</code>${data.ledger.live ? ' · includes the live trail' : ''}</p>`;
}

// --- Project Method tab ---------------------------------------------------------------

const CHECK_TONES = { green: 'done', ok: 'done', amber: 'wait', red: 'fail' };

// The tasks that break one health check, from the metrics tables.
function checkItems(id, data, projectId) {
  const t = data?.tables;
  if (!t) return [];
  const rows = { H2: t.overdue, H3: t.aging, H4: t.blocked, H8: t.stale }[id] || [];
  return rows.map((row) => taskLink(projectId, row.taskKey, row.title, 'check-item'));
}

export function renderMethod({ project, method, data, line, tasks, pipeline }) {
  if (!method) return '<div class="loading-state"><span class="spinner"></span>Reading the project’s method…</div>';
  if (method.error) return `<p class="today-clear">${icon('alert')}${escape(method.error)}</p>`;
  const count = (status) => tasks.filter((task) => task.status === status).length;
  const board = method.board || 'deaddrop';
  const limit = method.wipLimit;
  const states = [
    ['backlog', `Filed and not started. Lives in ${board}/backlog/${method.linked ? ' (or in tasks/ marked open, on boards older than backlog/)' : ''}.`],
    ['in_progress', `Claimed by a person or an agent session. The claim starts the cycle-time clock.${limit ? ` At most ${limit} at once, counting blocked work.` : ''}`],
    ['blocked', 'Waiting on something outside the task. Still counts as WIP; the policy asks for the reason.'],
    ['done', `Moved to ${board}/tasks/done/. Ends the cycle. A task killed in done/ counts as dropped.`],
  ];
  const workflow = `<ol class="workflow">${states.map(([status, policy], index) => `${index ? `<li class="workflow-arrow" aria-hidden="true">${status === 'blocked' ? '⇄' : '→'}</li>` : ''}<li class="workflow-state status-${status}"><strong>${escape(STATUS_WORDS[status])}<span>${count(status)}</span></strong><p>${escape(policy)}</p></li>`).join('')}</ol>`;
  const k = line?.kpis;
  const policies = [
    ['WIP limit', limit ? `${limit} tasks in progress or blocked at once.` : 'No limit is set.', method.linked ? `From ${board}/deaddrop.yml` : 'Set in Edit project'],
    ['Stale threshold', `An agent claim with no commit or checkpoint for ${method.staleHours} h is stale.`, method.linked ? `stale_hours in ${board}/deaddrop.yml` : 'deaddrop.yml'],
    ['Service level', k?.cycle85?.status === 'ok' ? `85% of tasks finish within ${k.cycle85.display} of being claimed.` : 'Not enough finished work yet to set one.', 'The 85th percentile of cycle time'],
    ['Aging', 'Work in progress past the service level is aging; past twice the service level, it is critical.', 'Per task type when a type has enough history'],
    ['Cycle and lead time', 'Cycle time runs from the claim to done; lead time from filing to done.', 'First-parent git history, commit times clamped'],
    ['Sweeps', 'A board sweep that moves many tasks at once records no real finish time; those finishes are left out of cycle times.', 'Marked “sweep” in each task’s timeline'],
  ];
  const policyList = `<ul class="policy-list">${policies.map(([name, text, source]) => `<li><strong>${escape(name)}</strong>${escape(text)}<small>${escape(source)}</small></li>`).join('')}</ul>`;
  const rules = line?.state === 'ready' ? line.health.rules : data?.health?.rules || [];
  const checks = rules.length ? `<ul class="checks">${rules.map((rule) => {
    const tone = CHECK_TONES[rule.level] || 'idle';
    const check = CHECKS[rule.id] || { name: rule.id, help: '' };
    const items = tone === 'done' || tone === 'idle' ? [] : checkItems(rule.id, data, project.id);
    return `<li class="check tone-${tone}"><span class="check-mark">${icon(tone === 'done' ? 'check' : tone === 'idle' ? 'circle' : 'alert')}</span><div class="check-text"><strong>${escape(check.name)}</strong>${rule.message.toLowerCase() === check.name.toLowerCase() ? '' : `<p>${escape(capital(rule.message))}${tone === 'idle' ? ' (not checked)' : ''}</p>`}${items.length ? `<div class="check-items">${items.slice(0, 12).join('')}${items.length > 12 ? `<span class="muted">+${items.length - 12} more in Flow</span>` : ''}</div>` : ''}</div><span class="check-code" title="${escape(check.help)}">${escape(rule.id)}</span></li>`;
  }).join('')}</ul>` : '<p class="today-clear">The checks run once the project’s history is indexed.</p>';
  const sessions = data?.tables?.agents || [];
  const stale = new Set((data?.tables?.stale || []).map((row) => typeof row.owner === 'object' ? row.owner.name : row.owner));
  const protocol = `<p class="protocol"><span class="protocol-step">Claim</span>→<span class="protocol-step">Checkpoint</span>→<span class="protocol-step">Done</span></p><p class="flow-intro">An agent claims a task by writing its session on the task’s <code>owner:</code> line (<code>operator @profile/session date — note</code>), shows life with a commit or a line in <code>${escape(board)}/checkpoints/</code> at least every ${escape(method.staleHours)} h, and finishes by moving the file to <code>tasks/done/</code>.</p>${sessions.length ? `<ul class="session-list">${sessions.map((row) => `<li class="session-row"><div class="session-who">${agentChip(row.owner)}<small>${escape(row.owner)}</small></div><div class="session-work">${row.tasks.map((entry) => taskLink(project.id, entry.taskKey, entry.title)).join('')}</div><div class="session-state">${stale.has(row.owner) ? `<span class="chip tone-wait">Stale claim</span>` : '<span class="chip tone-done">Following</span>'}</div></li>`).join('')}</ul>` : '<p class="all-clear">No agent session holds work right now.</p>'}`;
  const pipe = !method.linked && pipeline?.stages?.length ? `<section class="method-section" aria-labelledby="pipeline-heading"><div class="section-heading"><h2 id="pipeline-heading">Pipeline</h2><button type="button" class="text-button" data-action="edit-pipeline">${icon('edit')}Edit stages and gates</button></div><ol class="pipeline-stages">${pipeline.stages.map((stage, index) => `${index ? '<li class="workflow-arrow" aria-hidden="true">→</li>' : ''}<li class="pipeline-stage"><strong>${escape(stage.name)}</strong><small>${escape(stage.role || '')}</small>${stage.gate ? `<span title="Stops for your approval">${icon('gate')}</span>` : ''}</li>`).join('')}</ol></section>` : '';
  const docs = method.docs?.length ? `<section class="method-section" aria-labelledby="docs-heading"><div class="section-heading"><h2 id="docs-heading">The board’s own rules</h2><span>Read-only, as written in the repository</span></div>${method.docs.map((doc) => `<details class="method-doc" data-key="doc-${escape(doc.name)}"><summary>${icon('chevron')}<code>${escape(doc.path)}</code><small>${escape(plural(doc.text.split('\n').length, 'line'))}</small></summary><div class="markdown">${renderMarkdown(doc.text, { shift: 2 })}</div></details>`).join('')}</section>` : '';
  return `<p class="flow-intro">The way this project works, written down and checked: the states work moves through, the policies that govern each move, and whether the work on the board follows them.</p>
    <section class="method-section" aria-labelledby="workflow-heading"><div class="section-heading"><h2 id="workflow-heading">Workflow</h2><span>${escape(plural(tasks.length, 'task'))} on the board</span></div>${workflow}${policyList}</section>
    <section class="method-section" aria-labelledby="checks-heading"><div class="section-heading"><h2 id="checks-heading">Method checks</h2><span>The health rules; the project’s health is the worst of them</span></div>${checks}</section>
    <section class="method-section" aria-labelledby="protocol-heading"><div class="section-heading"><h2 id="protocol-heading">Agent protocol</h2><span>${escape(plural(sessions.length, 'session'))} holding work</span></div>${protocol}</section>
    ${pipe}${docs}`;
}

// --- Explain drawer ----------------------------------------------------------------

const ITEM_SKIP = new Set(['taskKey', 'title', 'commit', 'owner', 'tasks', 'from', 'to', 'lastLife', 'reference', 'hash']);

function itemValue(value) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'object') return escape(JSON.stringify(value));
  return escape(value);
}

function citation(item) {
  if (item.commit) return `<code title="Commit ${escape(item.commit)}">${escape(shortSha(item.commit))}</code>`;
  if (item.runId && item.seq !== undefined) return `<span title="Audit event ${escape(item.hash || '')}">Run ${escape(item.runId)} #${escape(item.seq)}</span>`;
  if (item.trail) return '<span>live trail</span>';
  return '';
}

function explainItems(value) {
  // A due-date forecast lists the finished items it compared against.
  const own = Boolean(value.items?.length);
  const items = own ? value.items : value.denominator?.items || [];
  if (!items.length) return '';
  const extra = [...new Set(items.slice(0, 50).flatMap((item) => Object.keys(item).filter((key) => !ITEM_SKIP.has(key) && typeof item[key] !== 'object')))].slice(0, 5);
  return `<h3>${own ? 'Items' : 'Finished items compared'} <span>${items.length}</span></h3><div class="task-table-wrap"><table class="task-table compact-table"><thead><tr><th scope="col">Item</th>${extra.map((key) => `<th scope="col">${escape(key)}</th>`).join('')}<th scope="col">Source</th></tr></thead><tbody>${items.slice(0, 200).map((item) => `<tr><td>${item.taskKey ? `<span class="task-number">${escape(localId(item.taskKey))}</span>${escape(item.title || '')}` : escape(typeof item.owner === 'string' ? item.owner : item.title || (item.runId ? `Run ${item.runId}` : ''))}${item.owner && typeof item.owner !== 'string' ? `<small class="muted"> · ${ownerChip(item.owner)}</small>` : ''}</td>${extra.map((key) => `<td>${itemValue(item[key])}</td>`).join('')}<td>${citation(item)}</td></tr>`).join('')}</tbody></table></div>${items.length > 200 ? `<p class="muted">${items.length - 200} more not shown.</p>` : ''}`;
}

function definitionList(entries) {
  const rows = entries.filter(([, value]) => value !== undefined && value !== null && value !== '');
  return rows.length ? `<dl class="explain-facts">${rows.map(([label, value]) => `<dt>${escape(label)}</dt><dd>${value}</dd>`).join('')}</dl>` : '';
}

export function renderExplain(value) {
  if (value.error) return `<header class="dialog-heading"><div><span class="dialog-eyebrow">Explain</span><h2 id="explain-dialog-title">Not available</h2></div><button type="button" class="icon-button" data-close aria-label="Close">${icon('close')}</button></header><div class="dialog-fields"><p>${escape(value.error)}</p></div>`;
  const params = Object.entries(value.params || {}).map(([key, entry]) => `<code>${escape(key)}</code> ${escape(typeof entry === 'object' ? JSON.stringify(entry) : entry)}`).join('<br>');
  const window = value.window ? `${escape(value.window.from || value.window.since || '')} → ${escape(value.window.to || '')}${value.window.mode ? ` (${escape(value.window.mode)})` : ''}${value.window.fallback ? `<br><small>${escape(value.window.fallback)}</small>` : ''}` : '';
  const rules = value.kind === 'health' && value.rules ? `<h3>Method checks</h3><ul class="rules">${value.rules.map((rule) => `<li class="rule rule-${escape(rule.level)}"><span class="rule-id">${escape(rule.id)}</span>${escape(CHECKS[rule.id]?.name ? `${CHECKS[rule.id].name}: ` : '')}${escape(rule.message)}</li>`).join('')}</ul>` : '';
  const excluded = value.excluded?.length ? `<h3>Left out <span>${value.excluded.length}</span></h3><ul class="explain-excluded">${value.excluded.slice(0, 100).map((entry) => `<li>${entry.taskKey ? `<span class="task-number">${escape(localId(entry.taskKey))}</span>` : ''}${escape(entry.title || (entry.runId ? `Run ${entry.runId}` : ''))} <span class="muted">${escape(entry.reason || entry.excluded || '')}</span></li>`).join('')}</ul>` : '';
  return `<header class="dialog-heading"><div><span class="dialog-eyebrow">${escape(value.project?.name || '')}${value.task?.taskKey ? ` · ${escape(localId(value.task.taskKey))}` : ''}</span><h2 id="explain-dialog-title">${escape(value.label || value.id)}</h2></div><button type="button" class="icon-button" data-close aria-label="Close">${icon('close')}</button></header>
    <div class="dialog-fields explain-body"><p class="explain-value"><strong>${escape(value.display)}</strong>${value.unit && value.status === 'ok' ? `<span>${escape(value.value === 1 ? value.unit.replace(/s$/, '') : value.unit)}</span>` : ''}</p>${value.status !== 'ok' ? `<p class="window-note">${icon('alert')}${escape(value.reason || value.status)}</p>` : value.reason ? `<p class="explain-reason">${escape(value.reason)}</p>` : ''}
    <p class="explain-definition">${escape(value.definition)}</p>
    ${definitionList([
      ['Formula', escape(value.formula)], ['Clock', escape(value.clock)], ['As of', escape(value.asOf)], ['Window', window],
      ['Sample', value.sample ? `${escape(value.sample.n)}${value.sample.required ? ` (needs ${escape(value.sample.required)})` : ''}` : ''], ['Settings', params],
    ])}${rules}${explainItems(value)}${excluded}
    ${definitionList([['Repository head', `<code>${escape(shortSha(value.build?.headSha))}</code>`], ['Ledger head', `<code>${escape(shortSha(value.build?.ledgerSha))}</code>`], ['Ledger head at as-of', value.ledgerHeadAtAsOf ? `<code>${escape(shortSha(value.ledgerHeadAtAsOf))}</code>` : '']])}
    <p class="muted explain-id">Metric <code>${escape(value.id)}</code>. Definitions: docs/METRICS.md.</p></div>`;
}

// --- Activity: one row per task per day, raw changes one click down ---------------------

function changeSentence(entry) {
  const task = entry.taskKey ? taskLink(entry.projectId, entry.taskKey, entry.title) : '';
  switch (entry.kind) {
    case 'status': return `${task} moved ${escape(STATUS_WORDS[entry.from] || entry.from || '—')} → <strong>${escape(STATUS_WORDS[entry.to] || entry.to)}</strong>`;
    case 'dropped': return `${task} was <strong>dropped</strong>`;
    case 'created': return `${task} was <strong>created</strong> in ${escape(STATUS_WORDS[entry.to] || entry.to || 'the backlog')}`;
    case 'removed': return `${task} was <strong>removed</strong>`;
    case 'field': return `${task} ${escape(entry.field)}: ${escape(entry.from || 'none')} → <strong>${escape(entry.to || 'none')}</strong>`;
    case 'project': return `Project ${escape(entry.change || 'changed')}${entry.field ? ` (${escape(entry.field)})` : ''}`;
    case 'run': return `${task} <a href="#run/${escape(encodeURIComponent(entry.globalRunId))}">${escape(RUN_EVENTS[entry.event] || entry.event)} · Run ${escape(entry.runId)}</a>${entry.reason ? ` <span class="muted">${escape(entry.reason)}</span>` : ''}`;
    default: return escape(entry.subject || entry.kind);
  }
}

function rawRow(entry, timezone) {
  const actor = typeof entry.actor === 'object' ? entry.actor?.id || entry.actor?.type : entry.actor;
  const source = entry.commit ? `<code title="${escape(entry.subject || '')} (${escape(entry.commit)})">${escape(shortSha(entry.commit))}</code>` : entry.hash ? `<a href="#run/${escape(encodeURIComponent(entry.globalRunId))}" title="Audit event ${escape(entry.hash)}">event #${escape(entry.seq)}</a>` : '';
  return `<li class="change-row change-${escape(entry.kind)}"><time datetime="${escape(entry.at)}">${escape(formatClock(entry.at, timezone))}</time><div><p>${changeSentence(entry)}</p><p class="change-meta">${actor ? `${escape(actor)}` : ''}${entry.via ? ` · via ${escape(entry.via)}` : ''} · ${source}${entry.subject ? ` · ${escape(entry.subject)}` : ''}</p></div></li>`;
}

const statusPill = (status) => `<span class="status-pill status-${escape(status)}"><span class="status-dot"></span>${escape(STATUS_WORDS[status] || status)}</span>`;

// The steps one task took in a day, oldest first: its states, then what else
// changed, and who held it.
function activitySteps(entries) {
  const ordered = [...entries].reverse();
  const steps = [];
  for (const entry of ordered) {
    if (entry.kind === 'created') steps.push(`<span>filed</span>${entry.to && entry.to !== 'backlog' ? `<span class="step-sep">→</span>${statusPill(entry.to)}` : ''}`);
    else if (entry.kind === 'status') steps.push(`${steps.length ? '' : `${statusPill(entry.from)}`}<span class="step-sep">→</span>${statusPill(entry.to)}`);
    else if (entry.kind === 'dropped') steps.push(`<span class="step-sep">→</span>${statusPill('dropped')}`);
    else if (entry.kind === 'removed') steps.push('<span>removed</span>');
    else if (entry.kind === 'run') steps.push(`<span>${escape(RUN_EVENTS[entry.event] || entry.event)}</span>`);
  }
  const fields = [...new Set(ordered.filter((entry) => entry.kind === 'field').map((entry) => entry.field))];
  if (fields.length) steps.push(`<span class="field-change">${escape(fields.map((field) => field.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase()).join(', '))} changed</span>`);
  return steps.join(' ');
}

function activityWho(entries) {
  const owner = entries.find((entry) => entry.kind === 'field' && entry.field === 'owner' && entry.to);
  if (owner && /@[^\s/]+\/\S+/.test(owner.to)) return agentChip(owner.to.split(/\s+\d{4}-\d\d-\d\d/)[0]);
  const actor = entries.map((entry) => (typeof entry.actor === 'object' ? entry.actor?.id || entry.actor?.type : entry.actor)).find(Boolean);
  return actor ? `<span class="person-chip">${escape(actor)}</span>` : '';
}

export function renderActivity(feed, { kind, projectId, projects, timezone }) {
  const filters = `<div class="filters"><label class="filter-select"><span class="sr-only">Kind of change</span><select data-changes-filter="kind"><option value="">All changes</option>${Object.entries(CHANGE_KINDS).map(([value, label]) => `<option value="${value}" ${kind === value ? 'selected' : ''}>${escape(label)}</option>`).join('')}</select></label><label class="filter-select"><span class="sr-only">Project</span><select data-changes-filter="project"><option value="">All projects</option>${projects.map((project) => `<option value="${escape(project.id)}" ${projectId === project.id ? 'selected' : ''}>${escape(project.name)}</option>`).join('')}</select></label></div>`;
  const heading = `<section class="page-heading"><div><h1>Activity</h1><p>What happened to each task, a day at a time, read from each project’s git history and the runs’ audit logs. Expand a row for every change and its commit.</p></div></section><div class="view-toolbar"><span></span>${filters}</div>`;
  if (!feed) return `${heading}<div class="loading-state"><span class="spinner"></span>Reading history…</div>`;
  if (!feed.changes.length) return `${heading}<div class="empty-results">${icon('git')}<h2>No activity</h2><p>Changes to tasks and runs will appear here.</p></div>`;
  const manyProjects = projects.length > 1 && !projectId;
  // Group: day → task (or a lone change without a task), newest first.
  const days = [];
  for (const entry of feed.changes) {
    const day = zoned(entry.at, timezone, { weekday: 'short', month: 'short', day: 'numeric' });
    let bucket = days.at(-1);
    if (!bucket || bucket.day !== day) days.push(bucket = { day, groups: new Map() });
    const key = entry.taskKey ? `${entry.projectId}:${entry.taskKey}` : `${entry.projectId}:${entry.kind}:${entry.seq ?? entry.at}`;
    if (!bucket.groups.has(key)) bucket.groups.set(key, []);
    bucket.groups.get(key).push(entry);
  }
  const rows = days.map(({ day, groups }) => `<li class="change-day">${escape(day)}</li>${[...groups].map(([key, entries]) => {
    const [latest] = entries;
    const first = entries.at(-1);
    const span = entries.length > 1 && formatClock(first.at, timezone) !== formatClock(latest.at, timezone) ? `${formatClock(first.at, timezone)}–${formatClock(latest.at, timezone)}` : formatClock(latest.at, timezone);
    const title = latest.taskKey ? taskLink(latest.projectId, latest.taskKey, latest.title) : `<span>${changeSentence(latest)}</span>`;
    return `<li class="activity-row"><time datetime="${escape(latest.at)}">${escape(span)}</time><div class="activity-main"><p class="activity-title">${title}</p><p class="activity-steps">${latest.taskKey ? activitySteps(entries) : ''} ${activityWho(entries)}${manyProjects ? `<span class="muted">· ${escape(latest.projectName)}</span>` : ''}</p><details class="activity-raw" data-key="raw-${escape(key)}-${escape(day)}"><summary>${icon('chevron')}${escape(plural(entries.length, 'change'))} and ${entries.length === 1 ? 'its commit' : 'their commits'}</summary><ol>${entries.map((entry) => rawRow(entry, timezone)).join('')}</ol></details></div></li>`;
  }).join('')}`).join('');
  return `${heading}<ol class="activity-list">${rows}</ol>${feed.more ? '<p class="board-hint">Showing the latest 200 changes. Filter by project or kind to see further back.</p>' : ''}`;
}

// --- A task's timeline (in the task drawer) -----------------------------------------------

// An owner line, `operator @profile/session date — note`, as words.
function ownerWords(line) {
  const holder = String(line).split(/\s+\d{4}-\d\d-\d\d/)[0].split(/\s(?:—|--)\s/)[0];
  const note = /\s(?:—|--)\s*(.*)$/.exec(line)?.[1];
  return `${/@[^\s/]+\/\S+/.test(holder) ? `claimed by ${agentChip(holder)}` : `owner ${escape(holder)}`}${note ? ` <span class="muted">“${escape(note)}”</span>` : ''}`;
}

function timelineWhat(entry) {
  if (entry.kind === 'status') return `${escape(STATUS_WORDS[entry.from] || entry.from || '—')} → <strong>${escape(STATUS_WORDS[entry.to] || entry.to)}</strong>`;
  if (entry.kind === 'field' && entry.field === 'owner') return entry.to ? ownerWords(entry.to) : 'claim released';
  if (entry.kind === 'field') return `${escape(entry.field)}: ${escape(entry.from || 'none')} → ${escape(entry.to || 'none')}`;
  if (entry.kind === 'created') return `<strong>Filed</strong>${entry.snapshot?.status && entry.snapshot.status !== 'backlog' ? ` in ${escape(STATUS_WORDS[entry.snapshot.status] || entry.snapshot.status)}` : ''}${entry.snapshot?.owner && entry.snapshot.owner !== '—' ? `, ${ownerWords(entry.snapshot.owner)}` : ''}${entry.retracted ? ' (moved between folders)' : ''}`;
  if (entry.kind === 'removed') return `<strong>Removed</strong>${entry.retracted ? ' (moved between folders)' : ''}`;
  if (entry.kind === 'life') return `Checkpoint${entry.subject ? ` <span class="muted">${escape(entry.subject)}</span>` : ''}`;
  return escape(entry.kind);
}

function timelineRow(entry, history, timezone) {
  const marks = [entry.clamped ? '<span class="needs-tag" title="This commit’s time was earlier than the commit before it, so it takes that time.">clamped time</span>' : '', entry.sweep && entry.kind !== 'life' ? '<span class="needs-tag" title="A board sweep moved it, so the real finish time is unknown.">sweep</span>' : '', history.incarnations.length > 1 ? `<span class="needs-tag">${escape(entry.taskKey)}</span>` : ''].join('');
  return `<li><time datetime="${escape(entry.at)}">${escape(formatWhen(entry.at, timezone))}</time><div><p>${timelineWhat(entry)}${marks}</p><p class="change-meta">${escape(entry.actor || '')}${entry.via ? ` · via ${escape(entry.via)}` : ''}${entry.runId ? ` · Run ${escape(entry.runId)}` : ''} · <code title="${escape(entry.subject || '')} (${escape(entry.commit)})">${escape(shortSha(entry.commit))}</code></p></div></li>`;
}

// Oldest first. Checkpoints in a row fold into one line that expands.
export function renderTimeline(history, timezone) {
  if (!history) return '<p class="muted">Loading the timeline…</p>';
  if (history.error) return `<p class="muted">${escape(history.error)}</p>`;
  const incarnations = history.incarnations.length > 1 ? `<p class="history-note">${icon('alert')}This task id was used ${history.incarnations.length} times (${history.incarnations.map((entry) => escape(entry.key)).join(', ')}); each use is tracked on its own.</p>` : '';
  const shown = history.transitions.slice(-200);
  const blocks = [];
  for (const entry of shown) {
    const last = blocks.at(-1);
    if (entry.kind === 'life' && Array.isArray(last)) last.push(entry);
    else blocks.push(entry.kind === 'life' ? [entry] : entry);
  }
  const items = blocks.map((block) => {
    if (!Array.isArray(block)) return timelineRow(block, history, timezone);
    if (block.length === 1) return timelineRow(block[0], history, timezone);
    return `<li class="history-fold-row"><details class="history-fold" data-key="fold-${escape(block[0].commit)}"><summary>${escape(plural(block.length, 'checkpoint'))}, ${escape(formatWhen(block[0].at, timezone))} – ${escape(formatWhen(block.at(-1).at, timezone))} ▸</summary><ol class="history-list">${block.map((entry) => timelineRow(entry, history, timezone)).join('')}</ol></details></li>`;
  }).join('');
  return `${incarnations}${history.transitions.length > 200 ? `<p class="muted">${history.transitions.length - 200} older changes not shown.</p>` : ''}<ol class="history-list">${items}</ol>`;
}

// The commits behind a task: its file and the first and latest commits.
export function renderEvidence(task, history) {
  const commits = history?.transitions?.length ? [...new Set([history.transitions[0].commit, history.transitions.at(-1).commit])] : [];
  return `<p class="drawer-evidence">${icon('git')}<span>${task.file ? `<code>${escape(task.file)}</code>` : ''}${commits.map((sha) => ` · <code title="${escape(sha)}">${escape(shortSha(sha))}</code>`).join('')}${history?.transitions ? ` · ${escape(plural(history.transitions.length, 'change'))} on record` : ''}</span></p>`;
}

export { agentShort };

// --- Threads: a project's tasks by what they build on ------------------------------

const statusChip = (status) => `<span class="status-pill status-${escape(status)}"><span class="status-dot"></span>${escape(STATUS_WORDS[status] || status)}</span>`;
const taskWord = (task) => `${task.id.split(':').at(-1)} ${task.title}`;

// "Waiting on T076": an open task whose dependency is not finished.
export function waitingChip(place) {
  if (!place?.waitingOn?.length) return '';
  const [first, ...rest] = place.waitingOn;
  return `<span class="chip tone-wait" title="${escape(`Builds on work that is not done: ${place.waitingOn.map(taskWord).join('; ')}`)}">Waiting on ${escape(first.id.split(':').at(-1))}${rest.length ? ` +${rest.length}` : ''}</span>`;
}

// The thread a task belongs to, as a small tag: "T021 thread".
export function threadTag(place) {
  const thread = place?.thread;
  if (!thread || thread.root === place.task) return '';
  return `<span class="needs-tag thread-tag" title="${escape(`Thread: ${taskWord(thread.root)} (${thread.tasks.length - thread.open.length} of ${thread.tasks.length} done)`)}">${icon('route')}${escape(thread.root.id.split(':').at(-1))}</span>`;
}

function threadRow(row, place, { signals, holder }) {
  const { task } = row;
  const entry = place.get(task.id);
  const open = task.status !== 'done';
  const also = entry.alsoNeeds.length ? `<span class="muted thread-also" title="${escape(entry.alsoNeeds.map(taskWord).join('; '))}">also needs ${escape(entry.alsoNeeds.map((need) => need.id.split(':').at(-1)).join(', '))}</span>` : '';
  const link = row.link === 'then' ? '<span class="thread-link" aria-hidden="true">↓</span>' : row.link === 'branch' ? '<span class="thread-link" aria-hidden="true">↳</span>' : '<span class="thread-link" aria-hidden="true">●</span>';
  return `<li class="thread-row depth-${Math.min(row.depth, 6)} ${open ? 'is-open' : 'is-done'}"><button type="button" class="thread-task" data-action="open-task" data-id="${escape(task.id)}">${link}<span class="task-number">${escape(task.id.split(':').at(-1))}</span><span class="thread-title" title="${escape(task.title)}">${escape(task.title)}</span></button><span class="thread-meta">${open ? (signals.get(task.id)?.reasons.includes('blocked') ? '' : statusChip(task.status)) : '<span class="muted">Done</span>'}${open ? signalBadges(signals.get(task.id)) : ''}${open ? waitingChip(entry) : ''}${also}${open ? holder(task) : ''}</span></li>`;
}

function threadCard(thread, place, options) {
  const key = `thread:${thread.root.id}`;
  const open = options.expanded.has(key);
  const done = thread.tasks.length - thread.open.length;
  const rows = visibleRows(thread, place, { expanded: open }).map((row) => (row.fold
    ? `<li class="thread-row thread-fold depth-${Math.min(row.depth, 6)}"><button type="button" class="text-button" data-action="toggle-delta" data-value="${escape(key)}">${escape(plural(row.fold, 'finished step'))}</button></li>`
    : threadRow(row, place, options))).join('');
  const holders = [...new Set(thread.open.map((task) => task.claim || task.assignee).filter(Boolean))].map((who) => ownerChip(who)).join('');
  return `<article class="thread panel"><header class="thread-head"><div class="thread-name"><span class="task-number">${escape(thread.root.id.split(':').at(-1))}</span><strong title="${escape(thread.root.title)}">${escape(thread.root.title)}</strong></div><div class="thread-facts"><span class="thread-progress" title="${escape(`${done} of ${thread.tasks.length} tasks done`)}"><span class="thread-bar"><span class="thread-bar-fill fill-${Math.round((done / thread.tasks.length) * 10)}"></span></span>${escape(done)} of ${escape(thread.tasks.length)} done</span>${holders}${open && thread.tasks.length > thread.open.length ? `<button type="button" class="text-button" data-action="toggle-delta" data-value="${escape(key)}">Fold finished steps</button>` : ''}</div></header><ol class="thread-rows">${rows}</ol></article>`;
}

// `built` is buildThreads() over the project's tasks; `holder(task)` renders
// who holds a task.
export function renderThreads(built, { signals, expanded, holder }) {
  const { threads, alone, place } = built;
  const options = { signals, expanded, holder };
  const active = threads.filter((thread) => thread.open.length);
  const finished = threads.filter((thread) => !thread.open.length);
  const aloneOpen = alone.filter((task) => task.status !== 'done');
  const aloneDone = alone.length - aloneOpen.length;
  if (!threads.length && !alone.length) return '<div class="empty-results"><h2>No tasks yet</h2><p>Tasks will appear here, organised by what they build on.</p></div>';
  const finishedOpen = expanded.has('threads:finished');
  return `<p class="flow-intro">Tasks organised by what they build on, read from each task file’s <code>depends:</code>. Open work shows with the tasks it builds on; finished steps fold away.</p>
    <section class="section" aria-labelledby="threads-active"><div class="section-heading"><h2 id="threads-active">Threads with open work</h2><span>${active.length}</span></div>${active.length ? `<div class="thread-list">${active.map((thread) => threadCard(thread, place, options)).join('')}</div>` : `<p class="all-clear">${icon('check')}Every thread is finished.</p>`}</section>
    <section class="section" aria-labelledby="threads-alone"><div class="section-heading"><h2 id="threads-alone">On their own</h2><span>Tasks that build on nothing and that nothing builds on</span></div>${aloneOpen.length ? `<ol class="thread-rows panel thread-alone">${aloneOpen.map((task) => threadRow({ task, depth: 0, link: 'root' }, place, options)).join('')}</ol>` : `<p class="all-clear">${icon('check')}No open task stands on its own.</p>`}${aloneDone ? `<p class="muted thread-note">${escape(plural(aloneDone, 'finished task'))} on their own; see Board or List.</p>` : ''}</section>
    ${finished.length ? `<section class="section" aria-labelledby="threads-finished"><div class="section-heading"><h2 id="threads-finished">Finished threads</h2><button type="button" class="text-button" data-action="toggle-delta" data-value="threads:finished" aria-expanded="${finishedOpen}">${finishedOpen ? 'Hide' : `Show ${finished.length}`}</button></div>${finishedOpen ? `<div class="thread-list">${finished.map((thread) => threadCard(thread, place, options)).join('')}</div>` : `<p class="muted">${escape(finished.map((thread) => `${thread.root.id.split(':').at(-1)} (${thread.tasks.length})`).join(' · '))}</p>`}</section>` : ''}`;
}
