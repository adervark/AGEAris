import { lstat, open, readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { ledgerAt, Ledgers, readBlobs } from './history.mjs';
import { DEFAULT_LEASE_MS, METRIC_DEFINITIONS, percentile, projectMetrics, slim, timeWindow } from './metrics.mjs';
import { assertNotSymlink, fail, PROJECT_ID } from './workspace.mjs';

// The cockpit read model: the morning brief (Needs you, what moved, one line
// per project), a project's metrics, the full MetricValue behind any number,
// a task's history, and the change feed. Everything is computed from the
// ledgers (lib/history.mjs) and the runs' audit events by lib/metrics.mjs at an
// explicit asOf; this module only gathers inputs, memoizes, and arranges.

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
// The live working-tree trail is read only for a brief computed now (§4.7(d)).
const LIVE_SLACK_MS = MINUTE_MS;
const LIVE_TRAIL_BYTES = 64 * 1024;
const CURSOR_MAX_DAYS = 14;
const MEMO_SIZE = 64;
const BODY_CACHE_SIZE = 2000;
const MAX_SINCE_HEADS = 50;
const WINDOW_MODES = new Set(['last-visit', 'previous-workday', '24h', '7d']);
const CHANGE_KINDS = ['status', 'field', 'created', 'removed', 'dropped', 'run', 'project'];
const RUN_EVENTS = new Set(['run_started', 'gate_opened', 'approved', 'rejected', 'run_completed', 'run_failed', 'cancelled', 'retried']);
const WIP = new Set(['in_progress', 'blocked']);
const URGENT = new Set(['urgent', 'high']);
const PRIORITY_RANK = { urgent: 0, high: 1, medium: 2, low: 3 };
const SHA = /^[0-9a-f]{40}$/;
const TASK_ID = /^T\d{3,}$/;
// The order of Needs you; an item appears once, under its first reason.
const NEEDS_ORDER = ['decision', 'overdue', 'stale', 'due_risk', 'aging', 'blocked', 'unassigned'];
const DELTA_LISTS = [
  ['finished', 'delta_finished'], ['started', 'delta_started'], ['blocked', 'delta_blocked'], ['unblocked', 'delta_unblocked'],
  ['added', 'delta_added'], ['removed', 'delta_removed'], ['dropped', 'delta_dropped'], ['slipped', 'delta_slipped'],
  ['pulledIn', 'delta_pulled_in'], ['reopened', 'delta_reopened'], ['returned', 'delta_returned'],
  ['runsCompleted', 'delta_runs_completed'], ['runsFailed', 'delta_runs_failed'],
];

const iso = (ms) => new Date(ms).toISOString();
const round1 = (value) => Math.round(value * 10) / 10;
const plural = (n, word, many = `${word}s`) => `${n} ${n === 1 ? word : many}`;

function parseTime(raw, field) {
  if (typeof raw !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/.test(raw)) fail(400, `${field} must be an ISO 8601 time with an offset`);
  const ms = Date.parse(raw);
  if (Number.isNaN(ms)) fail(400, `${field} must be an ISO 8601 time with an offset`);
  return ms;
}

function delay(ms) {
  let timer;
  const promise = new Promise((resolve) => { timer = setTimeout(resolve, ms); timer.unref?.(); });
  return { promise, cancel: () => clearTimeout(timer) };
}

// `sinceHeads` is `<projectId>:<sha>,…`, the ledgerSha of each project when the
// brief was last seen.
function parseHeads(raw) {
  const heads = new Map();
  if (raw === undefined || raw === null || raw === '') return heads;
  const pairs = String(raw).split(',');
  if (pairs.length > MAX_SINCE_HEADS) fail(400, `sinceHeads takes at most ${MAX_SINCE_HEADS} projects`);
  for (const pair of pairs) {
    const [projectId, sha, extra] = pair.split(':');
    if (extra !== undefined || !PROJECT_ID.test(projectId || '') || !SHA.test(sha || '')) fail(400, 'sinceHeads must be <projectId>:<40-hex sha> pairs separated by commas');
    heads.set(projectId, sha);
  }
  return heads;
}

// The commits a time window may miss: the clamped commits after the last
// commit dated inside the window's past (§4.6 "Known limitation"). Each took
// the time of the commit before it, so it may have landed after `since`.
function lateLanding(view, sinceMs) {
  let last = -1;
  view.commits.forEach((commit, index) => { if (!commit.clamped && Date.parse(commit.at) <= sinceMs) last = index; });
  return view.commits.filter((commit, index) => index > last && commit.clamped && Date.parse(commit.at) <= sinceMs).length;
}

function ownerName(owner) {
  if (!owner) return '';
  if (owner.kind === 'unassigned') return 'Unassigned';
  return owner.kind === 'agent' ? `agent ${owner.name}` : owner.name;
}

// The one-line summary of a project on Today: what is wrong first, then
// delivery and load. Counts, ages, and means only; never a percentile.
function sentenceOf(metrics, health) {
  if (health.level === 'grey') {
    if (health.label === 'Not enough history') {
      const rule = health.rules.find((entry) => entry.level === 'unknown');
      const detail = /\(([^)]*)\)/.exec(rule?.message || '')?.[1] || rule?.message || 'too few finished items';
      return `Not enough history: ${detail}.`;
    }
    return health.label === 'No work' ? 'No tasks yet.' : 'Idle: no open work, nothing finished in 90 days.';
  }
  const problems = [];
  const overdue = metrics.overdue.items;
  const urgent = overdue.filter((item) => URGENT.has(item.priority)).length;
  if (overdue.length) problems.push(urgent ? `${plural(urgent, 'high or urgent item')} overdue${overdue.length > urgent ? ` (${overdue.length} in all)` : ''}` : `${plural(overdue.length, 'item')} overdue`);
  if (metrics.due_risk_flagged.status === 'ok' && metrics.due_risk_flagged.value) problems.push(`${plural(metrics.due_risk_flagged.value, 'date')} at risk`);
  if (metrics.due_soon.value) problems.push(`${metrics.due_soon.value} due soon`);
  if (metrics.aging.status === 'ok' && metrics.aging.value) problems.push(`${plural(metrics.aging.value, 'item')} aging`);
  if (metrics.stale_claims.value) problems.push(plural(metrics.stale_claims.value, 'stale agent claim'));
  if (metrics.blocked.value) problems.push(`${metrics.blocked.value} blocked`);
  if (metrics.waiting_on_you.value) problems.push(plural(metrics.waiting_on_you.value, 'decision') + ' waiting');
  const parts = [];
  if (problems.length) parts.push(`${problems.join(', ').replace(/^./, (letter) => letter.toUpperCase())}.`);
  const weekly = round1(metrics.done_4w.value / 4);
  parts.push(`Done ${metrics.done_7d.value} in the last 7 days (weekly mean ${weekly}).`);
  const limit = metrics.wip.params.wipLimit;
  parts.push(`WIP ${metrics.wip.value}${limit ? ` of ${limit}` : ''}.`);
  return parts.join(' ');
}

// Rows of Needs you for one project, in NEEDS_ORDER, before deduplication.
function needsRows(project, metrics, asOfMs) {
  const rows = [];
  const base = (kind, item, fields) => ({
    kind, projectId: project.id, projectName: project.name, sample: Boolean(project.sample),
    taskKey: item.taskKey || '', title: item.title || '', owner: ownerName(item.owner), ...fields,
  });
  const ageOf = (at) => (at ? round1((asOfMs - Date.parse(at)) / HOUR_MS) : null);
  for (const item of metrics.waiting_on_you.items) {
    rows.push(base('decision', item, {
      severity: 'act', runId: `${project.id}:${item.runId}`, localRunId: item.runId, reason: item.reason,
      waitStart: item.waitStart, age: item.value, workingHours: item.workingHours, metricId: 'waiting_on_you',
    }));
  }
  for (const item of metrics.overdue.items) {
    rows.push(base('overdue', item, {
      severity: URGENT.has(item.priority) ? 'red' : 'amber', priority: item.priority, dueDate: item.dueDate,
      daysOverdue: item.daysOverdue, waitStart: null, age: null, metricId: 'overdue',
    }));
  }
  for (const item of metrics.stale_claims.items) {
    rows.push(base('stale', item, {
      severity: 'amber', hours: item.value, waitStart: item.lastLife?.at || null, age: ageOf(item.lastLife?.at), live: Boolean(item.live), metricId: 'stale_claims',
    }));
  }
  if (metrics.due_risk_flagged.status === 'ok') {
    for (const item of metrics.due_risk_flagged.items) {
      rows.push(base('due_risk', item, {
        severity: 'amber', probability: item.probability, dueDate: item.dueDate, reasonText: item.reason || '', waitStart: null, age: null, metricId: 'due_risk',
      }));
    }
  }
  if (metrics.aging.status === 'ok') {
    for (const item of metrics.aging.items) {
      rows.push(base('aging', item, {
        severity: item.level === 'critical' ? 'red' : 'amber', level: item.level, ageDays: item.value, typeKey: item.typeKey,
        referenceSource: item.reference?.source || '', waitStart: item.from?.at || null, age: ageOf(item.from?.at), metricId: 'aging',
      }));
    }
  }
  for (const item of metrics.blocked.items) {
    rows.push(base('blocked', item, {
      severity: 'amber', days: item.value, reasonText: item.reason, reasonSource: item.reasonSource, waitStart: item.blockedSince,
      age: ageOf(item.blockedSince), metricId: 'blocked',
    }));
  }
  for (const item of metrics.unassigned_wip.items.filter((entry) => URGENT.has(entry.priority))) {
    rows.push(base('unassigned', item, { severity: 'amber', priority: item.priority, waitStart: null, age: null, metricId: 'unassigned_wip' }));
  }
  return rows;
}

const ROW_ORDER = {
  decision: (a, b) => Date.parse(a.waitStart) - Date.parse(b.waitStart),
  overdue: (a, b) => (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9) || b.daysOverdue - a.daysOverdue,
  stale: (a, b) => b.hours - a.hours,
  due_risk: (a, b) => a.probability - b.probability || a.dueDate.localeCompare(b.dueDate),
  aging: (a, b) => b.ageDays - a.ageDays,
  blocked: (a, b) => Date.parse(a.waitStart) - Date.parse(b.waitStart),
  unassigned: (a, b) => (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9),
};

// One row per item, under its first reason in NEEDS_ORDER; the other reasons
// become tags. A run and its task are the same item.
export function arrangeNeeds(rows) {
  const ordered = NEEDS_ORDER.flatMap((kind) => rows.filter((row) => row.kind === kind)
    .sort((a, b) => ROW_ORDER[kind](a, b) || a.projectId.localeCompare(b.projectId) || a.taskKey.localeCompare(b.taskKey)));
  const byItem = new Map();
  const result = [];
  for (const row of ordered) {
    const item = row.taskKey ? `${row.projectId}:${row.taskKey}` : `${row.projectId}:run:${row.localRunId}`;
    const first = byItem.get(item);
    if (first) {
      if (!first.reasons.includes(row.kind)) first.reasons.push(row.kind);
      continue;
    }
    const entry = { ...row, reasons: [row.kind] };
    byItem.set(item, entry);
    result.push(entry);
  }
  return result;
}

export class Cockpit {
  // `ledgers` (or `ledgerOptions` for a new Ledgers) and `clock` (ms) are
  // injectable; `buildWaitMs` is how long a brief waits for a cold ledger
  // before showing the project as still indexing.
  constructor({ workspace, engine, clock = () => Date.now(), ledgers, ledgerOptions = {}, buildWaitMs = 250, leaseMs = DEFAULT_LEASE_MS }) {
    this.workspace = workspace;
    this.engine = engine;
    this.clock = clock;
    this.ledgers = ledgers || new Ledgers({ workspace, ...ledgerOptions });
    this.buildWaitMs = buildWaitMs;
    this.leaseMs = leaseMs;
    this._memo = new Map();
    this._bodies = new Map();
    this._staleHours = new Map();
    this._trails = new Map();
  }

  close() {
    this.ledgers.close();
  }

  // asOf from a request: now when absent, never in the future.
  asOf(raw) {
    const now = this.clock();
    if (raw === undefined || raw === null || raw === '') return now;
    const ms = parseTime(raw, 'asOf');
    if (ms > now + LIVE_SLACK_MS) fail(400, 'asOf cannot be in the future');
    return ms;
  }

  // The projects' metadata, read without git.
  async projects() {
    const dir = this.workspace.projectsDir;
    await assertNotSymlink(dir, true);
    let entries;
    try { entries = await readdir(dir, { withFileTypes: true }); } catch (error) {
      if (error?.code === 'ENOENT') return [];
      throw error;
    }
    const projects = [];
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.isSymbolicLink() || !PROJECT_ID.test(entry.name)) continue;
      projects.push(await this._project(entry.name));
    }
    return projects.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)) || a.id.localeCompare(b.id));
  }

  async _project(projectId) {
    const path = join(this.workspace._projectDir(projectId), 'project.json');
    await assertNotSymlink(path, true);
    let raw;
    try { raw = await readFile(path, 'utf8'); } catch (error) {
      if (error?.code === 'ENOENT') fail(404, 'Project not found');
      throw error;
    }
    let stored;
    try { stored = JSON.parse(raw); } catch { fail(500, 'Project metadata is invalid'); }
    return {
      id: projectId, name: String(stored?.name ?? ''), createdAt: String(stored?.createdAt ?? ''),
      wipLimit: Number.isInteger(stored?.wipLimit) ? stored.wipLimit : 0, sample: stored?.sample === true,
    };
  }

  // The project's deaddrop/ folder, if it is a real folder (not a symlink).
  async _deaddrop(dir) {
    const path = join(dir, 'deaddrop');
    try {
      const info = await lstat(path);
      return info.isDirectory() ? path : '';
    } catch (error) {
      if (error?.code === 'ENOENT') return '';
      throw error;
    }
  }

  // stale_hours from the project's deaddrop/deaddrop.yml, re-read when it changes.
  async _staleHoursOf(dir) {
    const deaddrop = await this._deaddrop(dir);
    if (!deaddrop) return undefined;
    const path = join(deaddrop, 'deaddrop.yml');
    let info;
    try { info = await lstat(path); } catch (error) {
      if (error?.code === 'ENOENT') return undefined;
      throw error;
    }
    const stamp = `${info.ino}:${info.mtimeMs}:${info.size}`;
    const cached = this._staleHours.get(path);
    if (cached?.stamp === stamp) return cached.value;
    const text = info.isFile() && info.size <= 64 * 1024 ? await readFile(path, 'utf8') : '';
    const match = /^stale_hours:\s*([0-9]+(?:\.[0-9]+)?)\s*(?:#.*)?$/m.exec(text);
    const value = match ? Number(match[1]) : undefined;
    this._staleHours.set(path, { stamp, value });
    return value;
  }

  // The newest 64 KB of each WIP task's working-tree trail, for a brief
  // computed now; `stamp` changes whenever any of them does. A trail is read
  // again only when its file changed; symlinks are never followed.
  async _liveTrails(dir, ids) {
    const trails = {};
    const stamps = [];
    const deaddrop = await this._deaddrop(dir);
    const folder = deaddrop && join(deaddrop, 'checkpoints');
    let names;
    try {
      if (!folder || !(await lstat(folder)).isDirectory()) return { trails, stamp: '' };
      names = new Set(await readdir(folder));
    } catch (error) {
      if (error?.code === 'ENOENT') return { trails, stamp: '' };
      throw error;
    }
    for (const id of ids) {
      if (!names.has(`${id}.jsonl`)) continue;
      const path = join(folder, `${id}.jsonl`);
      let info;
      try { info = await lstat(path); } catch (error) {
        if (error?.code === 'ENOENT') continue;
        throw error;
      }
      if (!info.isFile()) continue;
      const stamp = `${info.ino}:${info.mtimeMs}:${info.size}`;
      stamps.push(`${id}:${stamp}`);
      const cached = this._trails.get(path);
      if (cached?.stamp === stamp) { trails[id] = cached.text; continue; }
      const start = Math.max(0, info.size - LIVE_TRAIL_BYTES);
      const handle = await open(path, 'r');
      try {
        const buffer = Buffer.alloc(info.size - start);
        await handle.read(buffer, 0, buffer.length, start);
        const text = buffer.toString('utf8');
        // A read from the middle starts mid-line.
        trails[id] = start ? text.slice(text.indexOf('\n') + 1) : text;
        this._trails.set(path, { stamp, text: trails[id] });
        while (this._trails.size > BODY_CACHE_SIZE) this._trails.delete(this._trails.keys().next().value);
      } finally {
        await handle.close();
      }
    }
    return { trails, stamp: stamps.join(',') };
  }

  // The task files of blocked tasks as of the view's head, for the Handoff
  // reason; read from git so a past asOf gets the text it had then.
  async _bodiesOf(dir, view) {
    const bodies = {};
    const sha = view.ledgerHeadAtAsOf;
    if (!sha) return bodies;
    const paths = new Map();
    for (const transition of view.transitions) if (transition.path && transition.kind !== 'life') paths.set(transition.taskKey, transition.path);
    const wanted = Object.entries(view.tasks).filter(([key, task]) => task.present && task.status === 'blocked' && paths.has(key))
      .map(([key]) => ({ key, sha, path: paths.get(key), cacheKey: `${sha}:${paths.get(key)}` }));
    const missing = wanted.filter((entry) => !this._bodies.has(entry.cacheKey));
    if (missing.length) {
      // One cat-file process for every body this view still needs.
      const texts = await readBlobs(dir, missing, { spawn: this.ledgers.spawn });
      missing.forEach((entry, index) => this._bodies.set(entry.cacheKey, texts[index] ?? ''));
      while (this._bodies.size > BODY_CACHE_SIZE) this._bodies.delete(this._bodies.keys().next().value);
    }
    for (const entry of wanted) bodies[entry.key] = this._bodies.get(entry.cacheKey);
    return bodies;
  }

  // The project's ledger, or `{building}` while a cold build outlasts buildWaitMs.
  async _ledger(projectId, { wait = false } = {}) {
    const pending = this.ledgers.get(projectId);
    if (wait) return { ledger: await pending };
    pending.catch(() => {});
    const timeout = delay(this.buildWaitMs);
    try {
      const settled = await Promise.race([pending.then((ledger) => ({ ledger })), timeout.promise.then(() => null)]);
      return settled || { building: this.ledgers.building(projectId) || { commitsSeen: 0 } };
    } finally {
      timeout.cancel();
    }
  }

  // A project's metrics at asOfMs, memoized on everything they depend on.
  // `explicit` is false when asOf is "now": the result is then reused for the
  // rest of the minute unless the ledger, the runs, or the inputs change.
  async _metrics(project, { asOfMs, explicit = true, settings, window = null, wait = false }) {
    const found = await this._ledger(project.id, { wait });
    if (!found.ledger) return { state: 'building', building: found.building };
    const { ledger } = found;
    const dir = this.workspace._projectDir(project.id);
    const runs = this.engine?.eventsByProject().get(project.id) || [];
    const staleHours = await this._staleHoursOf(dir);
    const now = this.clock();
    const live = Math.abs(asOfMs - now) <= LIVE_SLACK_MS;
    let liveInput = null;
    let liveStamp = '';
    if (live) {
      const ids = Object.values(ledger.tasks).filter((task) => task.present && WIP.has(task.status)).map((task) => task.id);
      const { trails, stamp } = await this._liveTrails(dir, ids);
      liveInput = { readAt: iso(now), trails };
      liveStamp = stamp;
    }
    const key = JSON.stringify([
      project.id, ledger.ledgerSha, ledger.headSha, runs.map((run) => `${run.id}:${run.events.length}:${run.integrity?.ok !== false}`).join(','),
      settings.version, explicit ? asOfMs : `minute ${Math.floor(asOfMs / MINUTE_MS)}`, window, staleHours ?? null, project.wipLimit, live, liveStamp, this.workspace.operator,
    ]);
    if (this._memo.has(key)) return this._memo.get(key);
    const projectInput = { id: project.id, wipLimit: project.wipLimit, ...(staleHours ? { staleHours } : {}) };
    const bodies = await this._bodiesOf(dir, ledgerAt(ledger, asOfMs));
    const result = projectMetrics({ ledger, runs, project: projectInput, settings, asOf: asOfMs, operator: this.workspace.operator, live: liveInput, bodies, window, leaseMs: this.leaseMs });
    const value = { state: 'ready', ledger, result, live: live && Boolean(liveInput) };
    this._memo.set(key, value);
    // The brief, project pages, and explain ask for a few windows and times;
    // the oldest results go first.
    while (this._memo.size > MEMO_SIZE) this._memo.delete(this._memo.keys().next().value);
    return value;
  }

  // The delta window of a brief, and each project's part of it (§4.6).
  _window({ mode = 'last-visit', since, sinceHeads }, asOfMs, settings) {
    if (!WINDOW_MODES.has(mode)) fail(400, 'window must be last-visit, previous-workday, 24h, or 7d');
    const heads = parseHeads(sinceHeads);
    const sinceMs = since === undefined || since === null || since === '' ? null : parseTime(since, 'since');
    const fallbacks = [];
    if (mode === 'last-visit' && sinceMs !== null) {
      const floor = asOfMs - CURSOR_MAX_DAYS * DAY_MS;
      const clamped = sinceMs < floor;
      const fromMs = Math.min(Math.max(sinceMs, floor), asOfMs);
      const label = clamped ? `the last ${CURSOR_MAX_DAYS} days (your last visit was earlier)` : 'since your last visit';
      return {
        mode, from: iso(fromMs), label, fallbacks, clamped,
        // A clamped cursor no longer says where the visit was in history.
        forProject: (projectId) => ({ since: iso(fromMs), label, ...(!clamped && heads.has(projectId) ? { sinceSha: heads.get(projectId) } : {}) }),
      };
    }
    let timeMode = mode;
    if (mode === 'last-visit') {
      timeMode = settings.deltaFallback || 'previous-workday';
      fallbacks.push({ projectId: '', reason: 'no last visit recorded in this browser' });
    }
    const window = timeWindow(timeMode, asOfMs, settings);
    return { mode: timeMode, from: window.since, label: window.label, fallbacks, timeBased: true, forProject: () => ({ since: window.since, label: window.label }) };
  }

  async brief(query = {}) {
    const asOfMs = this.asOf(query.asOf);
    const explicit = Boolean(query.asOf);
    const settings = await this.workspace.readSettings();
    const window = this._window({ mode: query.window || undefined, since: query.since, sinceHeads: query.sinceHeads }, asOfMs, settings);
    const projects = await this.projects();
    const computed = await Promise.all(projects.map(async (project) => ({
      project, ...(await this._metrics(project, { asOfMs, explicit, settings, window: window.forProject(project.id) })),
    })));
    const rows = [];
    const delta = Object.fromEntries(DELTA_LISTS.map(([name]) => [name, []]));
    const latency = [];
    let late = 0;
    const lines = computed.map(({ project, state, building, ledger, result }) => {
      const line = { projectId: project.id, name: project.name, sample: project.sample, state };
      if (state !== 'ready') return { ...line, building, build: null, health: null, sentence: `Indexing history (${building.commitsSeen} commits so far)…`, kpis: null };
      const { metrics } = result;
      rows.push(...needsRows(project, metrics, asOfMs));
      for (const [name, id] of DELTA_LISTS) delta[name].push(...metrics[id].items.map((item) => ({ ...item, projectId: project.id, projectName: project.name })));
      latency.push(...metrics.approval_latency_p50.items);
      const fallback = metrics.delta_finished.window?.fallback;
      if (fallback) window.fallbacks.push({ projectId: project.id, reason: fallback });
      if (window.timeBased) late += lateLanding({ commits: ledger.commits.filter((commit) => Date.parse(commit.at) <= asOfMs) }, Date.parse(window.from));
      const health = metrics.health;
      return {
        ...line,
        build: { headSha: ledger.headSha, ledgerSha: ledger.ledgerSha },
        health: { level: health.level, label: health.label, rules: health.rules.map(({ id, level, message }) => ({ id, level, message })) },
        sentence: sentenceOf(metrics, health),
        kpis: {
          done7d: slim(metrics.done_7d), done4w: slim(metrics.done_4w), wip: slim(metrics.wip), wipLimit: project.wipLimit,
          overdue: slim(metrics.overdue), dueSoon: slim(metrics.due_soon), dueRisk: slim(metrics.due_risk_flagged),
          aging: slim(metrics.aging), blocked: slim(metrics.blocked), stale: slim(metrics.stale_claims),
        },
      };
    });
    for (const list of Object.values(delta)) list.sort((a, b) => Date.parse(b.at) - Date.parse(a.at) || String(a.taskKey || '').localeCompare(String(b.taskKey || '')));
    const needsYou = arrangeNeeds(rows);
    const decisions = needsYou.filter((row) => row.kind === 'decision');
    return {
      asOf: iso(asOfMs),
      timezone: settings.timezone,
      live: Math.abs(asOfMs - this.clock()) <= LIVE_SLACK_MS,
      window: {
        from: window.from, to: iso(asOfMs), label: window.label, mode: window.mode, fallbacks: window.fallbacks,
        ...(window.clamped ? { clamped: true } : {}), ...(late ? { lateLanding: { n: late } } : {}),
      },
      needsYou,
      delta,
      projects: lines,
      decisions: {
        waiting: { id: 'waiting_on_you', kind: 'count', value: decisions.length, display: String(decisions.length), status: 'ok', reason: '', sample: { n: decisions.length, required: 0 } },
        oldestWait: decisions[0]?.waitStart || null,
        approvalLatency: pooledLatency(latency, 50),
        approvalLatencyP85: pooledLatency(latency, 85),
      },
    };
  }

  async _projectOr404(projectId) {
    if (typeof projectId !== 'string' || !PROJECT_ID.test(projectId)) fail(404, 'Project not found');
    return this._project(projectId);
  }

  async projectMetrics(projectId, query = {}) {
    const project = await this._projectOr404(projectId);
    const asOfMs = this.asOf(query.asOf);
    const settings = await this.workspace.readSettings();
    const computed = await this._metrics(project, { asOfMs, explicit: Boolean(query.asOf), settings });
    if (computed.state !== 'ready') return { project, asOf: iso(asOfMs), state: computed.state, building: computed.building };
    const { ledger, result } = computed;
    const { metrics } = result;
    const commits = ledger.commits.filter((commit) => Date.parse(commit.at) <= asOfMs);
    const anomalies = ledger.anomalies.filter((anomaly) => anomaly.seq < commits.length);
    const anomalyCounts = {};
    for (const anomaly of anomalies) anomalyCounts[anomaly.kind] = (anomalyCounts[anomaly.kind] || 0) + 1;
    return {
      project, asOf: result.asOf, state: 'ready', timezone: settings.timezone, build: result.build,
      ledger: {
        branch: ledger.branch, commits: commits.length, clamped: commits.filter((commit) => commit.clamped).length,
        anomalies: anomalyCounts, recentAnomalies: anomalies.slice(-20), ledgerHeadAtAsOf: result.ledgerHeadAtAsOf,
        live: computed.live && (metrics.stale_claims.inputs.live || metrics.blocked.inputs.live),
      },
      health: { level: metrics.health.level, label: metrics.health.label, rules: metrics.health.rules.map(({ id, level, message }) => ({ id, level, message })) },
      metrics: Object.fromEntries(Object.entries(metrics).map(([id, value]) => [id, slim(value)])),
      series: {
        throughput: metrics.throughput_series.points.map(({ date, n }) => ({ date, n })),
        wip: metrics.wip_series.points.map(({ date, n }) => ({ date, n })),
      },
      tables: {
        overdue: metrics.overdue.items,
        dueSoon: metrics.due_soon.items,
        dueRisk: Object.values(result.dueRisk).map((risk) => ({ ...risk.task, status: risk.status, probability: risk.value, display: risk.display, reason: risk.reason, reference: risk.params.reference || '' })),
        aging: metrics.aging.items,
        blocked: metrics.blocked.items,
        stale: metrics.stale_claims.items,
        people: metrics.load.people,
        agents: metrics.load.agents,
        unassigned: metrics.unassigned_wip.items,
        slips: metrics.slips.items,
        cycle: metrics.cycle_time_p85.items.map(({ taskKey, title, value, to }) => ({ taskKey, title, value, at: to.at })),
        excluded: metrics.cycle_time_p85.excluded,
      },
    };
  }

  // The full MetricValue behind a number.
  async explain(metricId, query = {}) {
    if (!Object.hasOwn(METRIC_DEFINITIONS, metricId)) fail(404, `Unknown metric ${metricId}`);
    if (!query.projectId) fail(400, 'projectId is required');
    const project = await this._projectOr404(query.projectId);
    const asOfMs = this.asOf(query.asOf);
    const settings = await this.workspace.readSettings();
    const computed = await this._metrics(project, { asOfMs, explicit: Boolean(query.asOf), settings, wait: true });
    if (metricId === 'due_risk') {
      if (!query.taskKey) fail(400, 'taskKey is required for due_risk');
      const risk = computed.result.dueRisk[query.taskKey];
      if (!risk) fail(404, `No due-date risk for ${query.taskKey}`);
      return { ...risk, project };
    }
    const value = computed.result.metrics[metricId];
    if (!value) fail(404, `Unknown metric ${metricId}`);
    return { ...value, project };
  }

  // Every transition of a task, across its incarnations, with its commit.
  async taskHistory(globalId) {
    const split = typeof globalId === 'string' ? globalId.lastIndexOf(':') : -1;
    const projectId = split > 0 ? globalId.slice(0, split) : '';
    const localId = split > 0 ? globalId.slice(split + 1) : '';
    if (!PROJECT_ID.test(projectId) || !TASK_ID.test(localId)) fail(404, 'Task not found');
    await this._projectOr404(projectId);
    const { ledger } = await this._ledger(projectId, { wait: true });
    const keys = Object.keys(ledger.tasks).filter((key) => key === localId || key.startsWith(`${localId}#`)).sort();
    if (!keys.length) fail(404, 'Task not found in history');
    const wanted = new Set(keys);
    const transitions = ledger.transitions.filter((transition) => wanted.has(transition.taskKey)).map((transition) => {
      const commit = ledger.commits[transition.seq];
      return {
        ...transition, commit: commit.sha, at: commit.at, committedAt: commit.committedAt, authoredAt: commit.authoredAt,
        clamped: commit.clamped, actor: commit.actor, subject: commit.subject, via: commit.via, runId: commit.runId, sweep: commit.sweep,
      };
    });
    const current = keys.find((key) => ledger.tasks[key].present) || keys.at(-1);
    return {
      taskId: globalId, taskKey: current,
      incarnations: keys.map((key) => ({ key, incarnation: ledger.tasks[key].incarnation, present: ledger.tasks[key].present, title: ledger.tasks[key].title, createdAt: ledger.tasks[key].createdAt })),
      transitions,
    };
  }

  // The change feed that replaces Activity: task and project transitions from
  // the ledgers and the runs' audit events, newest first.
  async changes(query = {}) {
    const kinds = query.kinds ? String(query.kinds).split(',').filter(Boolean) : CHANGE_KINDS;
    if (!kinds.every((kind) => CHANGE_KINDS.includes(kind))) fail(400, `kinds must be among ${CHANGE_KINDS.join(', ')}`);
    const limit = query.limit === undefined || query.limit === '' ? 200 : Number(query.limit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 500) fail(400, 'limit must be an integer from 1 to 500');
    const sinceMs = query.since ? parseTime(query.since, 'since') : -Infinity;
    const wanted = new Set(kinds);
    const projects = query.projectId ? [await this._projectOr404(query.projectId)] : await this.projects();
    const entries = [];
    for (const project of projects) {
      const { ledger } = await this._ledger(project.id, { wait: true });
      const titleOf = (key) => ledger.tasks[key]?.title || '';
      const common = { projectId: project.id, projectName: project.name };
      for (const transition of ledger.transitions) {
        if (Date.parse(transition.at) <= sinceMs || transition.kind === 'life') continue;
        const commit = ledger.commits[transition.seq];
        let kind = transition.kind;
        if (kind === 'created' || kind === 'removed') { if (transition.retracted) continue; }
        else if (kind === 'status') kind = transition.to === 'dropped' ? 'dropped' : 'status';
        else if (kind !== 'field' && kind !== 'project') continue;
        if (!wanted.has(kind)) continue;
        entries.push({
          ...common, kind, at: transition.at, seq: transition.seq, commit: transition.commit, actor: transition.actor, subject: commit.subject,
          via: commit.via, ...(commit.runId ? { runId: commit.runId } : {}),
          ...(transition.taskKey ? { taskKey: transition.taskKey, title: titleOf(transition.taskKey) } : {}),
          ...(transition.field ? { field: transition.field } : {}),
          ...(transition.from !== undefined ? { from: transition.from } : {}), ...(transition.to !== undefined ? { to: transition.to } : {}),
          ...(transition.change ? { change: transition.change } : {}),
          ...(kind === 'created' ? { to: transition.snapshot.status } : {}),
        });
      }
      if (!wanted.has('run')) continue;
      const keyOf = (taskId) => {
        const id = String(taskId || '').split(':').at(-1);
        return Object.keys(ledger.tasks).filter((key) => ledger.tasks[key].id === id).sort((a, b) => Number(ledger.tasks[b].present) - Number(ledger.tasks[a].present))[0] || id;
      };
      for (const run of this.engine?.eventsByProject().get(project.id) || []) {
        const taskKey = keyOf(run.taskId);
        for (const event of run.events) {
          if (!RUN_EVENTS.has(event.type) || Date.parse(event.at) <= sinceMs) continue;
          entries.push({
            ...common, kind: 'run', at: event.at, actor: event.actor, event: event.type, runId: run.localId, globalRunId: run.id,
            seq: event.seq, hash: event.hash, taskKey, title: titleOf(taskKey),
            ...(event.data?.reason ? { reason: String(event.data.reason) } : {}), ...(event.data?.stageId ? { stageId: event.data.stageId } : {}),
          });
        }
      }
    }
    entries.sort((a, b) => Date.parse(b.at) - Date.parse(a.at) || (b.seq ?? 0) - (a.seq ?? 0));
    return { changes: entries.slice(0, limit), more: entries.length > limit };
  }
}

// An approval latency percentile over every project's decisions (the
// Decisions page header).
function pooledLatency(items, p) {
  const n = items.length;
  const value = n >= 5 ? percentile(items.map((item) => item.value), p) : null;
  return {
    id: `approval_latency_p${p}`, kind: 'percentile', value, display: value === null ? '—' : `${round1(value)} h`,
    status: n >= 5 ? 'ok' : 'insufficient', reason: n >= 5 ? '' : `not enough history (${n} of 5)`, sample: { n, required: 5 },
  };
}
