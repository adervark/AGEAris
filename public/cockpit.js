import { icon } from './icons.js';
import { WINDOWS } from './cursor.js';

// The manager's views: Today (the morning brief), a project's Health tab, the
// Changes feed, a task's history, and the Explain drawer behind every number.
// Each function turns an API response into HTML; app.js owns state, fetching,
// and events. Every number that has a definition is a button that opens the
// drawer (data-action="explain"), so the audit trail is one click down.

export function escape(value = '') {
  return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
}

const HEALTH_TONES = { green: 'done', amber: 'wait', red: 'fail', grey: 'idle' };
const NEEDS_LABELS = { decision: 'Decision', overdue: 'Overdue', stale: 'Stale claim', due_risk: 'Date at risk', aging: 'Aging', blocked: 'Blocked', unassigned: 'No owner' };
const DELTA_LABELS = [
  ['finished', 'Finished'], ['started', 'Started'], ['blocked', 'Blocked'], ['unblocked', 'Unblocked'], ['added', 'Added'],
  ['removed', 'Removed'], ['dropped', 'Dropped'], ['slipped', 'Slipped'], ['pulledIn', 'Pulled in'], ['reopened', 'Reopened'],
  ['returned', 'Returned'], ['runsCompleted', 'Runs completed'], ['runsFailed', 'Runs failed'],
];
const STATUS_WORDS = { backlog: 'Backlog', in_progress: 'In progress', blocked: 'Blocked', done: 'Done', dropped: 'Dropped' };
const RUN_EVENTS = { run_started: 'Run started', gate_opened: 'Waiting for approval', approved: 'Approved', rejected: 'Changes requested', run_completed: 'Run completed', run_failed: 'Run failed', cancelled: 'Run cancelled', retried: 'Retried' };
export const CHANGE_KINDS = { status: 'Status', field: 'Fields', created: 'Created', removed: 'Removed', dropped: 'Dropped', run: 'Runs', project: 'Project' };

const round1 = (value) => Math.round(value * 10) / 10;
const plural = (n, word, many = `${word}s`) => `${n} ${n === 1 ? word : many}`;
const shortSha = (sha) => String(sha || '').slice(0, 7);
const localId = (taskKey) => String(taskKey || '').split('#')[0];

function zoned(value, timezone, options) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  try { return date.toLocaleString(undefined, { ...options, timeZone: timezone || undefined }); } catch { return date.toLocaleString(undefined, options); }
}

export function formatWhen(value, timezone) {
  return zoned(value, timezone, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatDay(value, timezone) {
  return zoned(value, timezone, { weekday: 'long', month: 'long', day: 'numeric' });
}

// An age in hours, the way a person says it.
export function formatAge(hours) {
  if (hours === null || hours === undefined || !Number.isFinite(hours)) return '';
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} min`;
  if (hours < 48) return `${round1(hours)} h`;
  return `${round1(hours / 24)} days`;
}

// A number with a definition: opens the Explain drawer. `metric` is a slim or
// full MetricValue; an insufficient one shows — and says why.
export function metricButton({ projectId, metricId, display, title = '', taskKey = '', className = '' }) {
  return `<button type="button" class="metric-number ${className}" data-action="explain" data-metric="${escape(metricId)}" data-project="${escape(projectId)}"${taskKey ? ` data-task="${escape(taskKey)}"` : ''}${title ? ` title="${escape(title)}"` : ''}>${escape(display)}</button>`;
}

function metricOf(projectId, metric, extra = {}) {
  if (!metric) return '<span class="muted">—</span>';
  return metricButton({ projectId, metricId: metric.id, display: metric.display, title: metric.status === 'ok' ? `Explain ${metric.id.replace(/_/g, ' ')}` : metric.reason, ...extra });
}

export function healthDot(health) {
  const tone = HEALTH_TONES[health?.level] || 'idle';
  return `<span class="health-dot tone-${tone}" aria-hidden="true"></span>`;
}

function sampleBadge(sample) {
  return sample ? '<span class="sample-badge" title="This project’s history was generated to show how AGESight works.">Simulated history</span>' : '';
}

function openItem({ projectId, taskKey, runId }) {
  if (runId) return `data-action="open-run" data-id="${escape(runId)}"`;
  return `data-action="open-task" data-id="${escape(`${projectId}:${localId(taskKey)}`)}"`;
}

// --- Today -----------------------------------------------------------------------

function needsDetail(row) {
  const metric = (display, title = '') => metricButton({ projectId: row.projectId, metricId: row.metricId, display, title, taskKey: row.kind === 'due_risk' ? row.taskKey : '' });
  switch (row.kind) {
    case 'decision': return `${escape({ gate: 'Approval', input: 'Input requested', waiting: 'No agent free', failed: 'Run failed', unclaimed: 'Unclaimed', integrity: 'Audit log check failed' }[row.reason] || 'Decision')} · waiting ${metric(formatAge(row.age), row.workingHours !== undefined ? `${row.workingHours} working hours` : '')}`;
    case 'overdue': return `Due ${escape(row.dueDate)} · ${metric(plural(row.daysOverdue, 'day'))} overdue${row.priority ? ` · ${escape(row.priority)} priority` : ''}`;
    case 'stale': return `No sign of life for ${metric(formatAge(row.hours))}${row.live ? ' · checked the live trail' : ''}`;
    case 'due_risk': return `Due ${escape(row.dueDate)} · ${metric(`${Math.round((row.probability ?? 0) * 100)}% on time`, row.reasonText)}`;
    case 'aging': return `In progress ${metric(`${row.ageDays} days`)} · ${escape(row.level === 'critical' ? 'far past' : 'past')} the usual for ${escape(row.typeKey || 'untyped')} work`;
    case 'blocked': return `Blocked ${metric(plural(round1(row.days), 'day'))}${row.reasonText ? ` · ${escape(row.reasonText)}` : ''}`;
    case 'unassigned': return `In progress with no owner · ${escape(row.priority)} priority`;
    default: return '';
  }
}

function needsRow(row) {
  const tone = row.severity === 'red' ? 'fail' : row.kind === 'decision' ? 'wait' : row.severity === 'amber' ? 'wait' : 'idle';
  const tags = row.reasons.slice(1).map((reason) => `<span class="needs-tag">${escape(NEEDS_LABELS[reason] || reason)}</span>`).join('');
  const target = openItem({ projectId: row.projectId, taskKey: row.taskKey, runId: row.kind === 'decision' ? row.runId : '' });
  return `<li class="needs-row tone-${tone}"><span class="needs-kind">${escape(NEEDS_LABELS[row.kind] || row.kind)}</span><div class="needs-main"><button type="button" class="needs-title" ${target}>${row.taskKey ? `<span class="task-number">${escape(localId(row.taskKey))}</span>` : ''}${escape(row.title || 'Untitled')}</button><p class="needs-detail">${needsDetail(row)}</p><p class="needs-meta">${escape(row.projectName)}${row.owner ? ` · ${escape(row.owner)}` : ''}${sampleBadge(row.sample)}${tags}</p></div></li>`;
}

function deltaList(name, items, timezone) {
  if (!items.length) return '';
  const rows = items.slice(0, 100).map((item) => {
    const target = item.taskKey ? openItem({ projectId: item.projectId, taskKey: item.taskKey }) : '';
    const what = item.from !== undefined && item.to !== undefined && name !== 'reopened' ? ` <small>${escape(item.from || 'none')} → ${escape(item.to || 'none')}</small>` : '';
    const title = `${item.taskKey ? `<span class="task-number">${escape(localId(item.taskKey))}</span>` : ''}${escape(item.title || item.taskKey || `Run ${item.runId}`)}${what}`;
    return `<li>${target ? `<button type="button" class="delta-item" ${target}>${title}</button>` : `<span class="delta-item">${title}</span>`}<span class="delta-meta">${escape(item.projectName)} · ${escape(formatWhen(item.at, timezone))}${item.commit ? ` · <code title="Commit ${escape(item.commit)}">${escape(shortSha(item.commit))}</code>` : ''}</span></li>`;
  }).join('');
  return `<ol class="delta-list" id="delta-${escape(name)}">${rows}${items.length > 100 ? `<li class="muted">${items.length - 100} more in Changes</li>` : ''}</ol>`;
}

function windowNote(brief) {
  const notes = [];
  if (brief.window.clamped) notes.push('Your last visit was more than 14 days ago, so this shows the last 14 days.');
  const general = brief.window.fallbacks.find((entry) => !entry.projectId);
  if (general) notes.push(`No last visit is recorded in this browser yet, so this counts from the previous working day.`);
  const cursorMissing = brief.window.fallbacks.filter((entry) => entry.projectId);
  if (cursorMissing.length) notes.push(`${plural(cursorMissing.length, 'project')} counted by time: history was rewritten since your last visit.`);
  if (brief.window.lateLanding) notes.push(`${plural(brief.window.lateLanding.n, 'change')} dated before the window may have landed inside it (clock skew).`);
  return notes.map((note) => `<p class="window-note">${icon('alert')}${escape(note)}</p>`).join('');
}

function projectLine(line) {
  const name = `<a class="project-line-name" href="#project/${escape(line.projectId)}">${escape(line.name)}</a>`;
  if (line.state !== 'ready') return `<li class="project-line">${healthDot(null)}<div><p>${name}<span class="health-label">Indexing</span>${sampleBadge(line.sample)}</p><p class="project-line-sentence">${escape(line.sentence)}</p></div></li>`;
  const label = metricButton({ projectId: line.projectId, metricId: 'health', display: line.health.label, className: `health-label tone-${HEALTH_TONES[line.health.level] || 'idle'}`, title: line.health.rules.filter((rule) => rule.level !== 'ok').map((rule) => rule.message).join(' · ') || 'Explain health' });
  const k = line.kpis;
  const kpi = (metric, label) => `<span class="kpi"><span>${label}</span>${metricOf(line.projectId, metric)}</span>`;
  return `<li class="project-line">${healthDot(line.health)}<div><p>${name}${label}${sampleBadge(line.sample)}</p><p class="project-line-sentence">${escape(line.sentence)}</p><p class="kpis">${kpi(k.done7d, 'Done 7d')}${kpi(k.wip, `WIP${k.wipLimit ? ` / ${k.wipLimit}` : ''}`)}${kpi(k.overdue, 'Overdue')}${kpi(k.blocked, 'Blocked')}${kpi(k.aging, 'Aging')}${kpi(k.stale, 'Stale')}</p></div></li>`;
}

export function renderToday(brief, { mode, expanded, seenAt }) {
  const tz = brief.timezone;
  const totals = DELTA_LABELS.map(([name, label]) => [name, label, brief.delta[name] || []]);
  const moved = totals.filter(([, , items]) => items.length);
  const decisions = brief.needsYou.filter((row) => row.kind === 'decision').length;
  const others = brief.needsYou.length - decisions;
  const summary = brief.needsYou.length ? `${decisions ? `${plural(decisions, 'decision')} waiting` : ''}${decisions && others ? ', ' : ''}${others ? `${plural(others, 'item')} to look at` : ''}.` : 'Nothing needs you right now.';
  const windowMenu = `<label class="window-menu"><span class="sr-only">Changes window</span><select data-brief-window>${Object.entries(WINDOWS).map(([value, label]) => `<option value="${value}" ${mode === value ? 'selected' : ''}>${escape(label)}</option>`).join('')}</select></label>`;
  return `<section class="page-heading today-heading"><div><h1>Today</h1><p>${escape(formatDay(brief.asOf, tz))} · ${escape(summary)}</p></div><div class="today-actions">${windowMenu}<button type="button" class="button button-secondary" data-action="mark-seen" title="Start the next “since your last visit” from now">${icon('check')}Mark seen</button></div></section>
    <section class="today-section" aria-labelledby="needs-heading"><div class="section-heading"><h2 id="needs-heading">Needs you</h2><span>${brief.needsYou.length || ''}</span></div>${brief.needsYou.length ? `<ol class="needs-list">${brief.needsYou.map(needsRow).join('')}</ol>` : `<p class="today-clear">${icon('check')}No decisions, overdue, stale, aging, or blocked work.</p>`}</section>
    <section class="today-section" aria-labelledby="delta-heading"><div class="section-heading"><h2 id="delta-heading">${escape(brief.window.label.replace(/^./, (letter) => letter.toUpperCase()))}</h2><span>${escape(formatWhen(brief.window.from, tz))} → now${seenAt ? '' : ''}</span></div>${windowNote(brief)}${moved.length ? `<div class="delta-chips">${moved.map(([name, label, items]) => `<button type="button" class="delta-chip ${expanded.has(name) ? 'selected' : ''}" data-action="toggle-delta" data-value="${name}" aria-expanded="${expanded.has(name)}" aria-controls="delta-${name}"><strong>${items.length}</strong>${escape(label.toLowerCase())}</button>`).join('')}</div>${moved.filter(([name]) => expanded.has(name)).map(([name, label, items]) => `<div class="delta-group"><h3>${escape(label)}</h3>${deltaList(name, items, tz)}</div>`).join('')}` : '<p class="today-clear">Nothing moved in this window.</p>'}</section>
    <section class="today-section" aria-labelledby="projects-heading"><div class="section-heading"><h2 id="projects-heading">Projects</h2><span>${brief.projects.length}</span></div><ol class="project-lines">${brief.projects.map(projectLine).join('')}</ol></section>`;
}

// --- Decisions header ------------------------------------------------------------

export function decisionsSummary(brief) {
  if (!brief) return '';
  const { decisions } = brief;
  const oldest = decisions.oldestWait ? formatAge((Date.parse(brief.asOf) - Date.parse(decisions.oldestWait)) / 3600000) : '';
  const latency = (metric, label) => `<span class="kpi"><span>${label}</span><span class="metric-number static" title="${escape(metric.reason || 'Hours from the gate opening to the decision')}">${escape(metric.display)}</span></span>`;
  return `<p class="kpis decisions-kpis"><span class="kpi"><span>Waiting</span><strong>${decisions.waiting.value}</strong></span>${oldest ? `<span class="kpi"><span>Oldest wait</span><strong>${escape(oldest)}</strong></span>` : ''}${latency(decisions.approvalLatency, 'Approval time, median')}${decisions.approvalLatencyP85 ? latency(decisions.approvalLatencyP85, '85th percentile') : ''}<span class="kpi-note">Last 14 days; non-working days excluded.</span></p>`;
}

// --- Project Health tab -----------------------------------------------------------

function seriesChart(points, label) {
  if (!points?.length) return '';
  const max = Math.max(1, ...points.map((point) => point.n));
  const width = 6;
  const gap = 2;
  const height = 40;
  const bars = points.map((point, index) => {
    const h = point.n ? Math.max(2, Math.round((point.n / max) * height)) : 0;
    return `<rect x="${index * (width + gap)}" y="${height - h}" width="${width}" height="${h}" rx="1"><title>${escape(point.date)}: ${point.n}</title></rect>`;
  }).join('');
  return `<figure class="series"><svg viewBox="0 0 ${points.length * (width + gap)} ${height}" preserveAspectRatio="none" role="img" aria-label="${escape(label)}">${bars}</svg><figcaption>${escape(label)}</figcaption></figure>`;
}

function table(caption, columns, rows, empty) {
  if (!rows.length) return `<div class="health-table"><h3>${escape(caption)}</h3><p class="muted">${escape(empty)}</p></div>`;
  return `<div class="health-table"><h3>${escape(caption)} <span>${rows.length}</span></h3><div class="task-table-wrap"><table class="task-table compact-table"><thead><tr>${columns.map(([label]) => `<th scope="col">${escape(label)}</th>`).join('')}</tr></thead><tbody>${rows.map((row) => `<tr>${columns.map(([, cell]) => `<td>${cell(row)}</td>`).join('')}</tr>`).join('')}</tbody></table></div></div>`;
}

function ownerText(owner) {
  if (!owner) return '—';
  if (typeof owner === 'string') return escape(owner);
  if (owner.kind === 'unassigned') return '<span class="muted">Unassigned</span>';
  return `${escape(owner.kind === 'agent' ? `agent ${owner.name}` : owner.name)}${owner.via ? ` <small class="muted">${escape(owner.via)}</small>` : ''}`;
}

export function renderHealth(data, { projectId }) {
  if (!data) return '<div class="loading-state"><span class="spinner"></span>Computing metrics…</div>';
  if (data.state !== 'ready') return `<p class="today-clear">${icon('clock')}Indexing this project’s history (${escape(data.building?.commitsSeen ?? 0)} commits so far). This page fills in when it is done.</p>`;
  const m = data.metrics;
  const number = (metric) => metricOf(projectId, metric);
  const task = (row) => `<button type="button" class="task-link" ${openItem({ projectId, taskKey: row.taskKey })}><span class="task-number">${escape(localId(row.taskKey))}</span>${escape(row.title)}</button>`;
  const rules = data.health.rules.map((rule) => `<li class="rule rule-${escape(rule.level)}"><span class="rule-id">${escape(rule.id)}</span>${escape(rule.message)}</li>`).join('');
  const kpi = (metric, label) => `<div class="flow-kpi"><span>${escape(label)}</span>${number(metric)}</div>`;
  const t = data.tables;
  const risk = [
    table('Overdue', [['Task', task], ['Due', (row) => escape(row.dueDate)], ['Days late', (row) => escape(row.daysOverdue)], ['Owner', (row) => ownerText(row.owner)]], t.overdue, 'Nothing is overdue.'),
    table('Due-date forecasts', [['Task', task], ['Due', (row) => escape(row.dueDate)], ['On time', (row) => metricButton({ projectId, metricId: 'due_risk', taskKey: row.taskKey, display: row.display, title: row.reason })], ['Basis', (row) => escape(row.reason || row.reference)]], t.dueRisk.filter((row) => row.status === 'ok' || row.display !== '—'), 'No open task with a due date has a forecast yet.'),
    table('Aging work', [['Task', task], ['Days in progress', (row) => escape(row.value)], ['Level', (row) => escape(row.level)], ['Owner', (row) => ownerText(row.owner)]], t.aging, m.aging.status === 'ok' ? 'Nothing is older than usual.' : m.aging.reason),
    table('Blocked', [['Task', task], ['Days', (row) => escape(round1(row.value))], ['Why', (row) => escape(row.reason || '—')], ['Owner', (row) => ownerText(row.owner)]], t.blocked, 'Nothing is blocked.'),
    table('Stale agent claims', [['Task', task], ['Quiet for', (row) => escape(formatAge(row.value))], ['Claimed by', (row) => ownerText(row.owner)]], t.stale, 'Every agent claim shows recent life.'),
    table('Due-date slips, last 30 days', [['Task', task], ['From', (row) => escape(row.from || 'none')], ['To', (row) => escape(row.to || 'none')], ['When', (row) => escape(formatWhen(row.at, data.timezone))]], t.slips, 'No due date moved later.'),
  ].join('');
  const held = (row) => row.tasks.map((entry) => `<button type="button" class="task-link inline" ${openItem({ projectId, taskKey: entry.taskKey })} title="${escape(entry.title)}">${escape(localId(entry.taskKey))}</button>`).join(' ');
  const people = table('People', [['Person', (row) => escape(row.owner)], ['In progress', (row) => `${escape(row.wip)}${row.overloaded ? ' <span class="needs-tag">over limit</span>' : ''}`], ['Limit', (row) => escape(row.limit)], ['Tasks', held]], t.people, 'No one holds work in progress.');
  const agents = table('Agents', [['Agent', (row) => escape(row.owner)], ['In progress', (row) => escape(row.wip)], ['Tasks', held]], t.agents, 'No agent holds work in progress.');
  const unassigned = table('In progress with no owner', [['Task', task], ['Priority', (row) => escape(row.priority)]], t.unassigned, 'Every task in progress has an owner.');
  const anomalies = Object.entries(data.ledger.anomalies).map(([kind, n]) => `${n} ${kind.replace(/_/g, ' ')}`).join(', ');
  return `<section class="health-header tone-${HEALTH_TONES[data.health.level] || 'idle'}"><div class="health-verdict">${healthDot(data.health)}${metricButton({ projectId, metricId: 'health', display: data.health.label, className: 'health-label' })}</div><ul class="rules">${rules}</ul></section>
    <section class="health-section" aria-labelledby="flow-heading"><div class="section-heading"><h2 id="flow-heading">Flow</h2><span>Finished work and time to finish</span></div><div class="flow-grid">${kpi(m.done_7d, 'Done, last 7 days')}${kpi(m.done_4w, 'Done, last 4 weeks')}${kpi(m.cycle_time_p50, 'Cycle time, median')}${kpi(m.cycle_time_p85, 'Cycle time, 85th pct')}${kpi(m.lead_time_p50, 'Lead time, median')}${kpi(m.lead_time_p85, 'Lead time, 85th pct')}${kpi(m.wip, 'Work in progress')}${kpi(m.blocked_share, 'Blocked share, 30 days')}${kpi(m.repeat_slips, 'Repeat slips')}</div><div class="series-row">${seriesChart(data.series.throughput, 'Finished per day, last 6 weeks')}${seriesChart(data.series.wip, 'Work in progress per day, last 6 weeks')}</div></section>
    <section class="health-section" aria-labelledby="risk-heading"><div class="section-heading"><h2 id="risk-heading">Risk</h2></div>${risk}</section>
    <section class="health-section" aria-labelledby="people-heading"><div class="section-heading"><h2 id="people-heading">People and agents</h2></div>${people}${agents}${unassigned}</section>
    <p class="data-line">${icon('git')}Computed ${escape(formatWhen(data.asOf, data.timezone))} from ${plural(data.ledger.commits, 'commit')} on ${escape(data.ledger.branch || 'the default branch')}${data.ledger.clamped ? ` (${plural(data.ledger.clamped, 'commit')} with clamped times)` : ''}${anomalies ? ` · ${escape(anomalies)}` : ''} · ledger <code>${escape(shortSha(data.build.ledgerSha))}</code>${data.ledger.live ? ' · includes the live trail' : ''}</p>`;
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
  return `<h3>${own ? 'Items' : 'Finished items compared'} <span>${items.length}</span></h3><div class="task-table-wrap"><table class="task-table compact-table"><thead><tr><th scope="col">Item</th>${extra.map((key) => `<th scope="col">${escape(key)}</th>`).join('')}<th scope="col">Source</th></tr></thead><tbody>${items.slice(0, 200).map((item) => `<tr><td>${item.taskKey ? `<span class="task-number">${escape(localId(item.taskKey))}</span>${escape(item.title || '')}` : escape(typeof item.owner === 'string' ? item.owner : item.title || (item.runId ? `Run ${item.runId}` : ''))}${item.owner && typeof item.owner !== 'string' ? `<small class="muted"> · ${ownerText(item.owner)}</small>` : ''}</td>${extra.map((key) => `<td>${itemValue(item[key])}</td>`).join('')}<td>${citation(item)}</td></tr>`).join('')}</tbody></table></div>${items.length > 200 ? `<p class="muted">${items.length - 200} more not shown.</p>` : ''}`;
}

function definitionList(entries) {
  const rows = entries.filter(([, value]) => value !== undefined && value !== null && value !== '');
  return rows.length ? `<dl class="explain-facts">${rows.map(([label, value]) => `<dt>${escape(label)}</dt><dd>${value}</dd>`).join('')}</dl>` : '';
}

export function renderExplain(value) {
  if (value.error) return `<header class="dialog-heading"><div><span class="dialog-eyebrow">Explain</span><h2 id="explain-dialog-title">Not available</h2></div><button type="button" class="icon-button" data-close aria-label="Close">${icon('close')}</button></header><div class="dialog-fields"><p>${escape(value.error)}</p></div>`;
  const params = Object.entries(value.params || {}).map(([key, entry]) => `<code>${escape(key)}</code> ${escape(typeof entry === 'object' ? JSON.stringify(entry) : entry)}`).join('<br>');
  const window = value.window ? `${escape(value.window.from || value.window.since || '')} → ${escape(value.window.to || '')}${value.window.mode ? ` (${escape(value.window.mode)})` : ''}${value.window.fallback ? `<br><small>${escape(value.window.fallback)}</small>` : ''}` : '';
  const rules = value.kind === 'health' && value.rules ? `<h3>Rules</h3><ul class="rules">${value.rules.map((rule) => `<li class="rule rule-${escape(rule.level)}"><span class="rule-id">${escape(rule.id)}</span>${escape(rule.message)}</li>`).join('')}</ul>` : '';
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

// --- Changes feed -------------------------------------------------------------------

function changeSentence(entry) {
  const task = entry.taskKey ? `<button type="button" class="task-link" ${openItem({ projectId: entry.projectId, taskKey: entry.taskKey })}><span class="task-number">${escape(localId(entry.taskKey))}</span>${escape(entry.title)}</button>` : '';
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

export function renderChanges(feed, { kind, projectId, projects, timezone }) {
  const filters = `<div class="filters"><label class="filter-select"><span class="sr-only">Kind of change</span><select data-changes-filter="kind"><option value="">All changes</option>${Object.entries(CHANGE_KINDS).map(([value, label]) => `<option value="${value}" ${kind === value ? 'selected' : ''}>${escape(label)}</option>`).join('')}</select></label><label class="filter-select"><span class="sr-only">Project</span><select data-changes-filter="project"><option value="">All projects</option>${projects.map((project) => `<option value="${escape(project.id)}" ${projectId === project.id ? 'selected' : ''}>${escape(project.name)}</option>`).join('')}</select></label></div>`;
  const heading = `<section class="page-heading"><div><h1>Changes</h1><p>Every status, field, and run change, newest first, read from each project’s git history and the runs’ audit logs.</p></div></section><div class="view-toolbar">${filters}</div>`;
  if (!feed) return `${heading}<div class="loading-state"><span class="spinner"></span>Reading history…</div>`;
  if (!feed.changes.length) return `${heading}<div class="empty-results">${icon('git')}<h2>No changes</h2><p>Changes to tasks and runs will appear here.</p></div>`;
  let day = '';
  const rows = feed.changes.map((entry) => {
    const entryDay = zoned(entry.at, timezone, { weekday: 'short', month: 'short', day: 'numeric' });
    const header = entryDay !== day ? `<li class="change-day">${escape((day = entryDay))}</li>` : '';
    const actor = typeof entry.actor === 'object' ? entry.actor?.id || entry.actor?.type : entry.actor;
    const source = entry.commit ? `<code title="${escape(entry.subject || '')} (${escape(entry.commit)})">${escape(shortSha(entry.commit))}</code>` : entry.hash ? `<a href="#run/${escape(encodeURIComponent(entry.globalRunId))}" title="Audit event ${escape(entry.hash)}">event #${escape(entry.seq)}</a>` : '';
    return `${header}<li class="change-row change-${escape(entry.kind)}"><time datetime="${escape(entry.at)}">${escape(zoned(entry.at, timezone, { hour: '2-digit', minute: '2-digit' }))}</time><div><p>${changeSentence(entry)}</p><p class="change-meta">${escape(entry.projectName)}${actor ? ` · ${escape(actor)}` : ''}${entry.via ? ` · via ${escape(entry.via)}` : ''} · ${source}</p></div></li>`;
  }).join('');
  return `${heading}<ol class="change-list">${rows}</ol>${feed.more ? '<p class="board-hint">Showing the latest 200 changes. Filter by project or kind to see further back.</p>' : ''}`;
}

// --- Task history (in the task drawer) ------------------------------------------------

export function renderHistory(history, timezone) {
  if (!history) return '<p class="muted">Loading history…</p>';
  if (history.error) return `<p class="muted">${escape(history.error)}</p>`;
  const incarnations = history.incarnations.length > 1 ? `<p class="history-note">${icon('alert')}This task id was used ${history.incarnations.length} times (${history.incarnations.map((entry) => escape(entry.key)).join(', ')}); each use is tracked on its own.</p>` : '';
  const rows = [...history.transitions].reverse().slice(0, 100).map((entry) => {
    let what;
    if (entry.kind === 'status') what = `${escape(STATUS_WORDS[entry.from] || entry.from || '—')} → <strong>${escape(STATUS_WORDS[entry.to] || entry.to)}</strong>`;
    else if (entry.kind === 'field') what = `${escape(entry.field)}: ${escape(entry.from || 'none')} → ${escape(entry.to || 'none')}`;
    else if (entry.kind === 'created') what = `<strong>Created</strong>${entry.retracted ? ' (moved between folders)' : ''}`;
    else if (entry.kind === 'removed') what = `<strong>Removed</strong>${entry.retracted ? ' (moved between folders)' : ''}`;
    else if (entry.kind === 'life') what = 'Checkpoint';
    else what = escape(entry.kind);
    const marks = [entry.clamped ? '<span class="needs-tag" title="This commit’s time was earlier than the commit before it, so it takes that time.">clamped time</span>' : '', entry.sweep ? '<span class="needs-tag" title="A board sweep moved it, so the real finish time is unknown.">sweep</span>' : '', history.incarnations.length > 1 ? `<span class="needs-tag">${escape(entry.taskKey)}</span>` : ''].join('');
    return `<li><time datetime="${escape(entry.at)}">${escape(formatWhen(entry.at, timezone))}</time><div><p>${what}${marks}</p><p class="change-meta">${escape(entry.actor || '')}${entry.via ? ` · via ${escape(entry.via)}` : ''}${entry.runId ? ` · Run ${escape(entry.runId)}` : ''} · <code title="${escape(entry.subject || '')}">${escape(shortSha(entry.commit))}</code></p></div></li>`;
  }).join('');
  return `${incarnations}<ol class="history-list">${rows}</ol>${history.transitions.length > 100 ? `<p class="muted">${history.transitions.length - 100} older changes not shown.</p>` : ''}`;
}
