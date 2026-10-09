import {
  addDays, addWorkdays, DEFAULT_WORKDAYS, isWorkday, localDate, previousWorkday, startOfLocalDay,
} from './calendar.mjs';
import { agentIdentity, cycles, isUiClaim, ledgerAt } from './history.mjs';
import { needsHumanAt, reduce } from './pipeline.mjs';
import { blockedReasonOf } from './workspace.mjs';

// The metrics engine: pure functions from a ledger (lib/history.mjs), the runs'
// audit events, the project, and the workspace settings to MetricValues at an
// explicit `asOf`. Nothing here reads the clock or the disk; the live
// working-tree trail and task bodies are inputs the caller reads. Every value
// carries its definition, formula, clock, sample, params, and items citing a
// commit or an audit event. docs/METRICS.md states each definition; plan §3.

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const FLOW_WINDOW_DAYS = 90;
const MIN_SAMPLE = 5;
const APPROVAL_WINDOW_DAYS = 14;
const SHARE_WINDOW_DAYS = 30;
const SLIP_WINDOW_DAYS = 30;
const SERIES_DAYS = 42;
const DEFAULT_STALE_HOURS = 24;
const DEFAULT_PERSONAL_WIP_LIMIT = 3;
export const DEFAULT_LEASE_MS = 10 * 60 * 1000;
// The live trail is only read for a brief computed now (plan §4.7(d)).
const LIVE_SLACK_MS = 60 * 1000;
const WIP = new Set(['in_progress', 'blocked']);
const OPEN = new Set(['backlog', 'in_progress', 'blocked']);
const CLOSED = new Set(['done', 'dropped']);
const PRIORITY_RANK = { urgent: 0, high: 1, medium: 2, low: 3 };
const TERMINAL_RUN = new Set(['completed', 'failed', 'cancelled']);
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const AT = 'at (committer time, clamped so it never decreases)';
const EVENT = 'event (audit event time)';

// Health thresholds (plan §3.3). Constants in v1; per-project tuning is LATER.
export const HEALTH_THRESHOLDS = Object.freeze({
  blockedShareOfWip: 0.5, // H4 red: WIP ≥ 2 and blocked ≥ half of it
  blockedWorkingDays: 2, // H4 amber: an item blocked this long
  quietWorkingDays: 5, // H5: no finish (or no start) in this many working days
  decisionWorkingDays: 1, // H6 amber: a decision waited longer than this
});

export const HEALTH_RULES = Object.freeze({
  H2: Object.freeze({ id: 'H2', name: 'Overdue', core: false }),
  H3: Object.freeze({ id: 'H3', name: 'Aging', core: true }),
  H4: Object.freeze({ id: 'H4', name: 'Blocked', core: false }),
  H5: Object.freeze({ id: 'H5', name: 'Stalled / idle', core: true }),
  H6: Object.freeze({ id: 'H6', name: 'Decisions', core: false }),
  H7: Object.freeze({ id: 'H7', name: 'WIP limit', core: false }),
  H8: Object.freeze({ id: 'H8', name: 'Stale claims', core: false }),
});

function definition(number, id, kind, label, clock, unit, text, formula, minSample = 0) {
  return [id, Object.freeze({ id, number, kind, label, clock, unit, definition: text, formula, minSample, cut: 1 })];
}

function deltaDefinition(id, label, text) {
  return definition('3', id, 'count', `Since the window start: ${label}`, 'head cursor (seq after the cursor commit) or at; event time for runs', 'items', text, `count of ${label.toLowerCase()} in the window`);
}

// Every metric id this module produces, with its fixed definition and formula
// template (a value's own `formula` fills the template in).
export const METRIC_DEFINITIONS = Object.freeze(Object.fromEntries([
  definition('1', 'waiting_on_you', 'count', 'Waiting on you', EVENT, 'runs',
    'Runs that need a person at asOf (needsHumanAt): a gate, a human stage, a wait, a failed run not superseded, unclaimed pull work, or an audit log that failed verification. Wait age = asOf − wait start; oldest first.',
    'count of runs where needsHumanAt(state at asOf) holds'),
  definition('2a', 'approval_latency_p50', 'percentile', 'Approval latency, median', EVENT, 'hours',
    'Hours from each gate_opened to the next approved or rejected on the same attempt, minus whole non-working local days, for decisions in the last 14 days.',
    'nearest-rank P50 of approval latencies', MIN_SAMPLE),
  definition('2a', 'approval_latency_p85', 'percentile', 'Approval latency, 85th percentile', EVENT, 'hours',
    'Hours from each gate_opened to the next approved or rejected on the same attempt, minus whole non-working local days, for decisions in the last 14 days.',
    'nearest-rank P85 of approval latencies', MIN_SAMPLE),
  deltaDefinition('delta_finished', 'Finished', 'Tasks moved into done in the window, each listed once at its latest finish.'),
  deltaDefinition('delta_started', 'Started', 'Cycle starts in the window (the first WIP entry of a cycle, or its sweep fallback).'),
  deltaDefinition('delta_blocked', 'Blocked', 'Tasks moved into blocked in the window.'),
  deltaDefinition('delta_unblocked', 'Unblocked', 'Tasks moved from blocked back to in progress in the window.'),
  deltaDefinition('delta_added', 'Added', 'Tasks created in the window (split moves excluded).'),
  deltaDefinition('delta_removed', 'Removed', 'Task files deleted in the window (split moves excluded).'),
  deltaDefinition('delta_dropped', 'Dropped', 'Tasks moved into done as killed, or done changed to killed, in the window.'),
  deltaDefinition('delta_slipped', 'Slipped', 'Due dates moved later or cleared in the window (metric 16).'),
  deltaDefinition('delta_pulled_in', 'Pulled in', 'Due dates moved earlier in the window (metric 16).'),
  deltaDefinition('delta_reopened', 'Reopened', 'Tasks moved out of done or dropped in the window.'),
  deltaDefinition('delta_returned', 'Returned', 'Tasks moved from WIP back to the backlog in the window.'),
  deltaDefinition('delta_runs_completed', 'Runs completed', 'run_completed events in the window.'),
  deltaDefinition('delta_runs_failed', 'Runs failed', 'run_failed events in the window.'),
  definition('4', 'overdue', 'count', 'Overdue', 'local date', 'tasks',
    'Open tasks (backlog or WIP) whose dueDate is before the local date today. Ordered by priority, then days overdue.',
    'count of open tasks with dueDate < today'),
  definition('4b', 'due_soon', 'count', 'Due soon', 'local date', 'tasks',
    'Open tasks with today ≤ dueDate < addWorkdays(today, 6): due on or before the day before the 6th working day after today, non-working days included.',
    'count of open tasks with today ≤ dueDate < addWorkdays(today, 6)'),
  definition('5', 'due_risk', 'ratio', 'Due-date risk', AT, 'probability',
    'For one open task with a due date not yet passed: the chance it finishes by the end of its due date, from the cycle times of items finished in the last 90 days (its type\'s if that type has ≥5, else the project\'s). WIP of age a with d days left: #{ct : a < ct ≤ a+d} / #{ct : ct > a}, 0 when no item took longer than a. Backlog: #{ct ≤ d} / n, "if started today".',
    'numerator / denominator over the reference cycle times', MIN_SAMPLE),
  definition('5', 'due_risk_flagged', 'count', 'Dates at risk', AT, 'tasks',
    'Open tasks due within 5 working days (the due-soon window) whose due-date risk is below 0.5.',
    'count of due-soon tasks with P(finish by due date) < 0.5', MIN_SAMPLE),
  definition('6', 'aging', 'count', 'Aging WIP', AT, 'tasks',
    'WIP items (blocked included) whose age since cycle start exceeds the reference: the P85 cycle time of their type if it has ≥5 finishes in the 90-day window, else the project P85. Critical above 2 × the reference.',
    'count of WIP items with age > reference P85', MIN_SAMPLE),
  definition('7', 'blocked', 'count', 'Blocked', AT, 'tasks',
    'Blocked items. Blocker age = asOf − the last move into blocked. The reason follows the fallback chain blockedReason → checkpoint → handoff, with its source.',
    'count of tasks in tasks/ with status: blocked'),
  definition('7', 'blocked_share', 'ratio', 'Blocked share, 30 days', AT, 'ratio',
    'Blocked item-days / WIP item-days over the last 30 local days, sampling each task\'s state at the end of each day (at asOf for today).',
    'blocked item-days / WIP item-days'),
  definition('8', 'done_7d', 'count', 'Done, last 7 days', AT, 'tasks',
    'Final finishes (as of asOf) in the last 7 local days, today included. A killed item is never a finish; an item finished more than once counts once, at its final finish.',
    'count of final finishes in the last 7 local days'),
  definition('8b', 'done_4w', 'count', 'Done, previous 4 weeks', AT, 'tasks',
    'Final finishes in the 28 local days before the done_7d window. Displayed as a weekly mean over the part of those days the board existed for (value ÷ 4 on a board older than them); a board with less than a week of them has none.',
    'count of final finishes in the 28 local days before the last 7'),
  definition('8s', 'throughput_series', 'series', 'Throughput series', AT, 'tasks per day',
    'Final finishes per local day for the last 6 weeks, days with none included.',
    'final finishes per local day'),
  definition('9', 'cycle_time_p50', 'percentile', 'Cycle time, median', AT, 'days',
    'Calendar days from the start of the final cycle to the final move into Done, for items finished in the last 90 days.',
    'nearest-rank P50 of cycle times', MIN_SAMPLE),
  definition('9', 'cycle_time_p85', 'percentile', 'Cycle time, 85th percentile', AT, 'days',
    'Calendar days from the start of the final cycle to the final move into Done, for items finished in the last 90 days.',
    'nearest-rank P85 of cycle times', MIN_SAMPLE),
  definition('10', 'lead_time_p50', 'percentile', 'Lead time, median', AT, 'days',
    'Calendar days from creation (the first commit adding the file) to the final move into Done, for items finished in the last 90 days.',
    'nearest-rank P50 of lead times', MIN_SAMPLE),
  definition('10', 'lead_time_p85', 'percentile', 'Lead time, 85th percentile', AT, 'days',
    'Calendar days from creation (the first commit adding the file) to the final move into Done, for items finished in the last 90 days.',
    'nearest-rank P85 of lead times', MIN_SAMPLE),
  definition('11', 'wip', 'count', 'WIP', AT, 'tasks',
    'Tasks in progress or blocked, against the project WIP limit (blocked counts).',
    'count of tasks in progress or blocked'),
  definition('11', 'wip_series', 'series', 'WIP series', AT, 'tasks',
    'WIP at the end of each local day (at asOf for today) for the last 6 weeks.',
    'WIP count at the end of each local day'),
  definition('16', 'slips', 'count', 'Slips, 30 days', AT, 'changes',
    'Due-date changes in the last 30 days that moved a date later (with slip days) or cleared it. Moving a date earlier is a pull-in; setting the first date is neither.',
    'count of dueDate changes later or cleared in the last 30 days'),
  definition('16', 'repeat_slips', 'count', 'Tasks slipped twice or more, 30 days', AT, 'tasks',
    'Tasks with two or more slips in the last 30 days.',
    'count of tasks with ≥2 slips in the last 30 days'),
  definition('17', 'load', 'count', 'Overloaded people', AT, 'people',
    'Open WIP per effective owner (assignee → the active run\'s agent → the agent-claim identity → Unassigned). People over personalWipLimit are listed; agents are listed separately and never measured against it. Not a productivity score.',
    'count of people whose WIP exceeds personalWipLimit'),
  definition('17', 'unassigned_wip', 'count', 'Unassigned WIP', AT, 'tasks',
    'WIP whose effective owner is Unassigned: no assignee, no active run on an agent stage, and no agent claim (UI-written @agesight/web owner lines are bookkeeping, not ownership).',
    'count of WIP tasks with no effective owner'),
  definition('30', 'stale_claims', 'count', 'Stale agent claims', 'at, checkpoint ts, and audit event time', 'tasks',
    'WIP agent claims (a run in flight, a checkpoint trail, or a non-UI @profile/session owner) with asOf − last sign of life > stale_hours. Human claims get aging only; tasks whose run waits on a person are decisions instead.',
    'count of agent claims with asOf − lastLife > staleHours'),
  definition('23', 'health', 'health', 'Project health', 'rules H2–H8 at asOf', 'level',
    'The combination of health rules H2–H8: red if any is red, else amber if any is amber, else grey when a core rule cannot be evaluated or the project is idle, else green.',
    'combine(rules, context)'),
]));

// --- small helpers -------------------------------------------------------------

function toMs(value) {
  const ms = value instanceof Date ? value.getTime() : typeof value === 'number' ? value : Date.parse(value);
  if (!Number.isFinite(ms)) throw new TypeError(`Invalid time: ${value}`);
  return ms;
}

const iso = (ms) => new Date(ms).toISOString();
const round1 = (value) => Math.round(value * 10) / 10;
// Durations a percentile is taken over keep about a minute of resolution: work
// that moves within hours must not all read as 0.0 days.
const round3 = (value) => Math.round(value * 1000) / 1000;

function isDate(text) {
  return typeof text === 'string' && DATE.test(text) && new Date(`${text}T00:00:00Z`).toISOString().slice(0, 10) === text;
}

function dayDiff(from, to) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
}

function show(value, unit) {
  if (value === null || value === undefined) return '—';
  // Under an hour a duration reads in minutes, under a day in hours: the
  // words the Flow tab's charts use for the same values.
  if (unit === 'days' && value * 24 < 1) return `${Math.round(value * 1440)} min`;
  if (unit === 'days') return value < 1 ? `${(value * 24).toFixed(1)} h` : `${value.toFixed(1)} d`;
  if (unit === 'hours') return value < 1 ? `${Math.round(value * 60)} min` : `${value.toFixed(1)} h`;
  if (unit === 'probability' || unit === 'ratio') return `${Math.round(value * 100)}%`;
  return String(value);
}

// The nearest-rank percentile: sorted[ceil(p/100 × n) − 1]; null for no values.
export function percentile(values, p) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(1, Math.ceil((p * sorted.length) / 100)) - 1];
}

// Elapsed milliseconds minus every whole non-working local day inside the
// interval (each at its real length, so a 25-hour day removes 25 hours).
function workingMs(fromMs, toMsValue, timezone, workdays) {
  let total = toMsValue - fromMs;
  if (total <= 0) return Math.max(0, total);
  for (let date = localDate(fromMs, timezone), last = localDate(toMsValue, timezone); date <= last; date = addDays(date, 1)) {
    if (isWorkday(date, workdays)) continue;
    const start = startOfLocalDay(date, timezone).getTime();
    const end = startOfLocalDay(addDays(date, 1), timezone).getTime();
    if (start >= fromMs && end <= toMsValue) total -= end - start;
  }
  return total;
}

// The window a delta covers when no cursor is given: the start of the previous
// working day, 24 hours, or 7 days before asOf (plan §4.6).
export function timeWindow(mode, asOf, { timezone = 'UTC', workdays = DEFAULT_WORKDAYS } = {}) {
  const asOfMs = toMs(asOf);
  if (mode === '24h') return { since: iso(asOfMs - DAY_MS), mode, label: 'the last 24 hours' };
  if (mode === '7d') return { since: iso(asOfMs - 7 * DAY_MS), mode, label: 'the last 7 days' };
  if (mode !== 'previous-workday') throw new RangeError(`Unknown window ${mode}`);
  const day = previousWorkday(localDate(asOfMs, timezone), workdays);
  return { since: iso(startOfLocalDay(day, timezone).getTime()), mode, label: `since the start of ${day}` };
}

// Due-date risk for one item (plan §3.1 metric 5). `sample` is the reference
// cycle times in days; `age` the item's age (null for a backlog item); `daysLeft`
// the days until the end of its due date. Returns the numerator and denominator
// as indexes into `sample`.
export function dueRisk({ age = null, daysLeft, sample }) {
  const indexes = sample.map((_value, index) => index);
  if (age === null) {
    const numerator = indexes.filter((index) => sample[index] <= daysLeft);
    return { probability: sample.length ? numerator.length / sample.length : null, numerator, denominator: indexes, reason: 'if started today' };
  }
  const denominator = indexes.filter((index) => sample[index] > age);
  const numerator = denominator.filter((index) => sample[index] <= age + daysLeft);
  if (!denominator.length) return { probability: 0, numerator, denominator, reason: 'older than every finished item' };
  return { probability: numerator.length / denominator.length, numerator, denominator, reason: '' };
}

// The health level from rule results (plan §3.3 "Combination"). `context`:
// open work (backlog + WIP), finishes in the 90-day window, and whether the
// project ever had a task.
export function combine(rules, { openWork = 0, recentFinishes = 0, everHadTask = true } = {}) {
  if (rules.some((rule) => rule.level === 'red')) return { level: 'red', label: 'Red', because: rules.filter((rule) => rule.level === 'red').map((rule) => rule.id) };
  if (rules.some((rule) => rule.level === 'amber')) return { level: 'amber', label: 'Amber', because: rules.filter((rule) => rule.level === 'amber').map((rule) => rule.id) };
  const unknown = rules.filter((rule) => rule.level === 'unknown' && HEALTH_RULES[rule.id]?.core);
  if (unknown.length) return { level: 'grey', label: 'Not enough history', because: unknown.map((rule) => rule.id) };
  if (!openWork && !recentFinishes) return { level: 'grey', label: everHadTask ? 'Idle' : 'No work', because: [] };
  return { level: 'green', label: 'Green', because: [] };
}

// The slim MetricValue every list endpoint carries.
export function slim(value) {
  const { id, kind, status, reason, sample } = value;
  return { id, kind, value: value.value, display: value.display, status, reason, sample: { n: sample.n, required: sample.required } };
}

// The weekly mean of a count over its window, the way done_4w's "usual week"
// reads: per week the board existed, not per calendar week before it.
export function weeklyMean(metric) {
  if (metric?.status !== 'ok' || !metric.window) return null;
  const weeks = (Date.parse(metric.window.to) - Date.parse(metric.window.from)) / (7 * DAY_MS);
  return weeks > 0 ? round1(metric.value / weeks) : null;
}

function cites(item, commits) {
  if (typeof item?.commit === 'string' && item.commit) return !commits || commits.has(item.commit);
  if (item?.runId && Number.isInteger(item.seq) && typeof item.hash === 'string' && item.hash) return true;
  if (item?.trail && item.live === true && item.ts) return true;
  // An aggregate (a person's load) cites through its tasks.
  return Array.isArray(item?.tasks) && item.tasks.length > 0 && item.tasks.every((task) => cites(task, commits));
}

// The §3.2 invariants of a MetricValue; returns the problems found (none: []).
// `commits` (a Set of shas) also checks that every commit cited is in the ledger.
export function checkInvariant(value, { commits } = {}) {
  const problems = [];
  const expect = (condition, message) => { if (!condition) problems.push(`${value?.id}: ${message}`); };
  expect(['count', 'percentile', 'ratio', 'forecast', 'series', 'health'].includes(value?.kind), `unknown kind ${value?.kind}`);
  for (const key of ['definition', 'formula', 'clock', 'asOf']) expect(typeof value?.[key] === 'string' && value[key].length > 0, `${key} is empty`);
  expect(value?.build && typeof value.build.headSha === 'string' && typeof value.build.ledgerSha === 'string', 'build is missing');
  expect(typeof value?.ledgerHeadAtAsOf === 'string', 'ledgerHeadAtAsOf is missing');
  expect(typeof value?.params?.timezone === 'string' && Array.isArray(value?.params?.workdays), 'params.timezone or params.workdays is missing');
  expect(typeof value?.inputs?.live === 'boolean', 'inputs.live is missing');
  expect(['ok', 'insufficient', 'na'].includes(value?.status), `unknown status ${value?.status}`);
  expect(Array.isArray(value?.items), 'items is not a list');
  if (problems.length) return problems;
  const ok = value.status === 'ok';
  const allItems = [...value.items];
  switch (value.kind) {
    case 'count':
      expect(ok ? value.value === value.items.length : value.value === null && value.items.length === 0, `value ${value.value} with ${value.items.length} items (${value.status})`);
      break;
    case 'percentile': {
      expect(value.sample.n === value.items.length, `sample.n ${value.sample.n} with ${value.items.length} items`);
      const expected = ok ? percentile(value.items.map((item) => item.value), value.params.percentile) : null;
      expect(value.value === expected, `value ${value.value}, nearest rank gives ${expected}`);
      break;
    }
    case 'ratio': {
      const { numerator, denominator } = value;
      expect(numerator?.n === numerator?.items?.length && denominator?.n === denominator?.items?.length, 'numerator or denominator n differs from its items');
      if (!numerator || !denominator) break;
      allItems.push(...numerator.items, ...denominator.items);
      if (value.status === 'insufficient') expect(value.value === null, 'an insufficient ratio has a value');
      else if (denominator.n === 0) {
        // Due-date risk defines an empty denominator as 0 with its reason.
        expect(value.status === 'na' ? value.value === null : value.value === 0 && value.reason.length > 0, 'an empty denominator needs status na, or value 0 with a reason');
      } else expect(value.value === numerator.n / denominator.n, `value ${value.value} is not ${numerator.n}/${denominator.n}`);
      break;
    }
    case 'series':
      expect(value.value === null, 'a series has a headline value');
      for (const point of value.points || []) {
        expect(point.n === point.items.length, `point ${point.date} n ${point.n} with ${point.items.length} items`);
        allItems.push(...point.items);
      }
      break;
    case 'health': {
      const expected = combine(value.rules, value.context).level;
      expect(value.level === expected && value.value === expected, `level ${value.level}, combine gives ${expected}`);
      for (const rule of value.rules) {
        if (rule.level === 'red' || rule.level === 'amber') expect(rule.items.length > 0, `${rule.id} fired without items`);
        allItems.push(...rule.items);
      }
      break;
    }
    default:
      break;
  }
  for (const item of allItems) expect(cites(item, commits), `item ${JSON.stringify(item).slice(0, 120)} cites no commit or event`);
  return problems;
}

// --- the engine ------------------------------------------------------------------

// Everything the metrics share, derived once per call.
function prepare({ ledger, runs, project, settings, asOf, operator, live, bodies, leaseMs }) {
  const asOfMs = toMs(asOf);
  const view = ledgerAt(ledger, asOfMs);
  const timezone = settings.timezone || 'UTC';
  const workdays = settings.workdays?.length ? [...settings.workdays] : [...DEFAULT_WORKDAYS];
  const ctx = {
    asOfMs, asOfIso: iso(asOfMs), view, timezone, workdays, operator, bodies, leaseMs,
    today: localDate(asOfMs, timezone),
    tasks: view.tasks,
    cycles: cycles(view),
    build: { headSha: ledger.headSha || '', ledgerSha: ledger.ledgerSha || '' },
    staleHours: Number.isFinite(project.staleHours) && project.staleHours > 0 ? project.staleHours : DEFAULT_STALE_HOURS,
    board: project.board || 'AA',
    wipLimit: Number.isInteger(project.wipLimit) && project.wipLimit > 0 ? project.wipLimit : 0,
    personalWipLimit: settings.personalWipLimit || DEFAULT_PERSONAL_WIP_LIMIT,
    byKey: new Map(),
    touching: new Map(),
    keyOfId: new Map(),
  };
  for (const transition of view.transitions) {
    if (!transition.taskKey) continue;
    if (!ctx.byKey.has(transition.taskKey)) ctx.byKey.set(transition.taskKey, []);
    ctx.byKey.get(transition.taskKey).push(transition);
  }
  for (const commit of view.commits) {
    for (const key of commit.touched) {
      if (!ctx.touching.has(key)) ctx.touching.set(key, []);
      ctx.touching.get(key).push(commit);
    }
  }
  for (const [key, task] of Object.entries(view.tasks)) {
    if (task.present || !ctx.keyOfId.has(task.id)) ctx.keyOfId.set(task.id, key);
  }
  ctx.keys = (states) => Object.keys(view.tasks).filter((key) => view.tasks[key].present && states.has(view.tasks[key].status)).sort();

  // The live working-tree trail: used only when it was read within 60 s of asOf.
  ctx.live = { provided: Boolean(live), usable: false, used: false, trails: {} };
  if (live) {
    const readAt = toMs(live.readAt);
    ctx.live.usable = Math.abs(asOfMs - readAt) <= LIVE_SLACK_MS;
    ctx.live.trails = live.trails || {};
  }
  const parsedTrails = new Map();
  ctx.liveEntries = (id) => {
    if (!ctx.live.usable || typeof ctx.live.trails[id] !== 'string') return [];
    if (parsedTrails.has(id)) return parsedTrails.get(id);
    const entries = [];
    parsedTrails.set(id, entries);
    for (const line of ctx.live.trails[id].split('\n')) {
      let entry;
      try { entry = JSON.parse(line); } catch { continue; }
      const ms = typeof entry?.ts === 'string' ? Date.parse(entry.ts) : NaN;
      // Entries dated after asOf are ignored.
      if (Number.isFinite(ms) && ms <= asOfMs) entries.push({ ms, ts: entry.ts, kind: entry.kind, what: entry.what });
    }
    return entries;
  };

  // Runs at asOf: events up to asOf, reduced; integrity holds for the prefix
  // unless the break lies inside it.
  ctx.runs = [];
  for (const run of runs) {
    const events = [];
    for (const event of run.events || []) {
      if (toMs(event.at) > asOfMs) break;
      events.push(event);
    }
    if (!events.length) continue;
    let integrity = run.integrity?.ok === false && run.integrity.brokenAt <= events.length ? run.integrity : { ok: true };
    let state;
    try { state = reduce(events); } catch (error) {
      state = reduce([]);
      integrity = { ok: false, brokenAt: events.length, reason: error.message };
    }
    const taskId = String(run.taskId || state.taskId || '');
    const localId = run.localId || String(run.id || '').split(':').at(-1);
    ctx.runs.push({ id: run.id, localId, key: ctx.keyOfId.get(taskId.split(':').at(-1)) || '', state, events, integrity });
  }
  const states = ctx.runs.map((run) => run.state);
  for (const run of ctx.runs) {
    run.needs = needsHumanAt({ state: run.state, integrity: run.integrity, events: run.events, otherRuns: states, asOf: asOfMs, leaseMs });
    run.active = Boolean(run.state.startedAt) && !TERMINAL_RUN.has(run.state.status);
  }
  ctx.runsOf = (key) => ctx.runs.filter((run) => run.key === key);
  ctx.activeRun = (key) => ctx.runsOf(key).filter((run) => run.active).at(-1) || null;
  ctx.hasTrail = (key) => (ctx.byKey.get(key) || []).some((transition) => transition.kind === 'life') || ctx.liveEntries(view.tasks[key].id).length > 0;
  ctx.lastCommit = (key, predicate = () => true) => (ctx.byKey.get(key) || []).filter(predicate).at(-1)?.commit || '';
  ctx.created = (key) => (ctx.byKey.get(key) || []).find((transition) => transition.kind === 'created' && !transition.retracted);
  return ctx;
}

// The effective owner (plan §3.0): assignee → the active run's agent → an agent
// claim's identity → Unassigned. `step` names the precedence step that chose it.
function ownerOf(ctx, key) {
  const task = ctx.tasks[key];
  if (task.assignee) return { kind: 'person', name: task.assignee, step: 'assignee' };
  const run = ctx.activeRun(key);
  const attempt = run?.state.attempts.at(-1);
  if (attempt && attempt.runner !== 'human' && attempt.agentId) {
    return { kind: 'agent', name: attempt.agentId, step: 'run', via: `via run ${run.localId}`, runId: run.localId };
  }
  const identity = agentIdentity(task.owner);
  if (identity) return { kind: 'agent', name: identity, step: 'claim' };
  if (ctx.hasTrail(key)) return { kind: 'agent', name: `${task.owner.operator || 'agent'} (trail)`, step: 'trail' };
  const reason = isUiClaim(task.owner) ? 'the owner line is UI bookkeeping (@agesight/web)' : task.owner.raw ? 'the owner line names no agent session' : 'no assignee or owner';
  return { kind: 'unassigned', name: 'Unassigned', step: 'unassigned', reason };
}

function taskItem(ctx, key, extra = {}) {
  const task = ctx.tasks[key];
  return {
    taskKey: key, title: task.title, status: task.status, priority: task.priority, typeKey: task.typeKey,
    owner: ownerOf(ctx, key), commit: ctx.lastCommit(key), ...extra,
  };
}

function base(ctx, id, fields = {}) {
  const def = METRIC_DEFINITIONS[id];
  const { params = {}, ...rest } = fields;
  return {
    id, kind: def.kind, label: def.label, value: null, unit: def.unit, display: '—', status: 'ok', reason: '',
    clock: def.clock, definition: def.definition, formula: def.formula, window: null,
    sample: { n: 0, required: def.minSample },
    params: { timezone: ctx.timezone, workdays: [...ctx.workdays], ...params },
    inputs: { live: false }, items: [], excluded: [],
    asOf: ctx.asOfIso, build: { ...ctx.build }, ledgerHeadAtAsOf: ctx.view.ledgerHeadAtAsOf,
    ...rest,
  };
}

function count(ctx, id, items, fields = {}) {
  const value = base(ctx, id, fields);
  value.items = items;
  value.value = items.length;
  value.sample = { n: items.length, required: 0 };
  value.display = fields.display ?? String(items.length);
  value.formula = `${METRIC_DEFINITIONS[id].formula} = ${items.length}`;
  return value;
}

function insufficient(value, n, required, what) {
  return Object.assign(value, {
    value: null, display: '—', status: 'insufficient', items: [],
    reason: `not enough history (${n} of ${required} ${what})`, sample: { n, required },
  });
}

function percentileValue(ctx, id, p, items, fields = {}) {
  const value = base(ctx, id, fields);
  value.params = { ...value.params, percentile: p, minSample: MIN_SAMPLE };
  value.items = [...items].sort((a, b) => a.value - b.value || a.taskKey?.localeCompare?.(b.taskKey) || 0);
  const n = items.length;
  value.sample = { n, required: MIN_SAMPLE };
  if (n < MIN_SAMPLE) {
    Object.assign(value, { status: 'insufficient', reason: `not enough history (${n} of ${MIN_SAMPLE})`, formula: `nearest-rank P${p} needs at least ${MIN_SAMPLE} values; ${n} available` });
    return value;
  }
  const rank = Math.ceil((p * n) / 100);
  value.value = value.items[rank - 1].value;
  value.display = show(value.value, value.unit);
  value.formula = `nearest-rank P${p} = sorted[ceil(${p / 100} × ${n}) − 1] = sorted[${rank - 1}] = ${value.value.toFixed(value.unit === 'days' && value.value < 1 ? 3 : 1)}`;
  return value;
}

// Each task's final cycle, and the finishes (final cycle done) and drops.
function outcomes(ctx) {
  const finishes = [];
  const drops = [];
  const withdrawn = [];
  const sweeps = [];
  for (const [key, list] of Object.entries(ctx.cycles)) {
    const last = list.at(-1);
    // A sweep commit never supplies a finish (§3.0); history marks the end.
    if (last.outcome === 'done' && last.end.sweep) sweeps.push({ key, cycle: last, endMs: toMs(last.end.at), reason: last.excluded || 'finish known only from a sweep commit' });
    else if (last.outcome === 'done') finishes.push({ key, cycle: last, endMs: toMs(last.end.at) });
    else if (last.outcome === 'dropped') drops.push({ key, cycle: last, endMs: toMs(last.end.at) });
    else {
      // An earlier finish withdrawn by a reopen (plan §11 A2).
      const earlier = list.slice(0, -1).filter((cycle) => cycle.outcome === 'done').at(-1);
      if (earlier) withdrawn.push({ key, endMs: toMs(earlier.end.at), finished: earlier.end, reopened: last.begin });
    }
  }
  return { finishes, drops, withdrawn, sweeps };
}

// Cycle-time and lead-time samples over the 90-day flow window, and the
// per-type cycle samples the aging and risk references use.
function flow(ctx, { finishes, drops, sweeps }) {
  const from = ctx.asOfMs - FLOW_WINDOW_DAYS * DAY_MS;
  const inWindow = (entry) => entry.endMs > from && entry.endMs <= ctx.asOfMs;
  const cycle = [];
  const lead = [];
  const excluded = [];
  for (const { key, cycle: entry, endMs } of finishes.filter(inWindow)) {
    const task = ctx.tasks[key];
    const to = { at: entry.end.at, commit: entry.end.commit };
    const created = ctx.created(key);
    if (created) {
      const days = (endMs - toMs(created.at)) / DAY_MS;
      lead.push({ taskKey: key, title: task.title, value: round3(days), days, from: { at: created.at, commit: created.commit }, to, commit: entry.end.commit });
    }
    if (!entry.start) {
      excluded.push({ taskKey: key, title: task.title, reason: entry.excluded || 'no start' });
      continue;
    }
    const days = (endMs - toMs(entry.start.at)) / DAY_MS;
    cycle.push({
      taskKey: key, title: task.title, typeKey: task.typeKey, value: round3(days), days,
      from: { at: entry.start.at, commit: entry.start.commit }, to, commit: entry.end.commit,
      ...(entry.start.source === 'fallback' ? { startLabel: entry.start.label } : {}),
    });
  }
  const unfinished = [
    ...drops.filter(inWindow).map(({ key }) => ({ taskKey: key, title: ctx.tasks[key].title, reason: 'dropped (killed)' })),
    ...sweeps.filter(inWindow).map(({ key, reason }) => ({ taskKey: key, title: ctx.tasks[key].title, reason })),
  ];
  const byType = new Map();
  for (const item of cycle) {
    if (!item.typeKey) continue;
    if (!byType.has(item.typeKey)) byType.set(item.typeKey, []);
    byType.get(item.typeKey).push(item);
  }
  const reference = (typeKey) => {
    if (typeKey && (byType.get(typeKey)?.length || 0) >= MIN_SAMPLE) return { source: `type ${typeKey}`, typeKey, items: byType.get(typeKey) };
    if (cycle.length >= MIN_SAMPLE) return { source: 'project', typeKey: '', items: cycle };
    return null;
  };
  reference.typeCount = (typeKey) => (typeKey ? byType.get(typeKey)?.length || 0 : 0);
  return { cycle, lead, excluded: [...excluded, ...unfinished], unfinished, from, reference, finished: finishes.filter(inWindow).length };
}

// Task state at each boundary (ascending ms): a Map of present task → {status, commit}.
function statesAt(ctx, boundaries) {
  const result = [];
  const state = new Map();
  const transitions = ctx.view.transitions;
  let index = 0;
  for (const boundary of boundaries) {
    for (; index < transitions.length && toMs(transitions[index].at) <= boundary; index += 1) {
      const transition = transitions[index];
      const { taskKey: key } = transition;
      if (!key) continue;
      if (transition.kind === 'created') state.set(key, { status: transition.snapshot.status, present: true, commit: transition.commit });
      else if (transition.kind === 'status' && state.has(key)) Object.assign(state.get(key), { status: transition.to, commit: transition.commit });
      else if (transition.kind === 'removed' && state.has(key)) state.get(key).present = false;
    }
    result.push(new Map([...state].filter(([, entry]) => entry.present).map(([key, entry]) => [key, { ...entry }])));
  }
  return result;
}

// The local dates of the last `n` days ending today, with each day's end
// instant (asOf for today).
function lastDays(ctx, n) {
  const days = [];
  for (let offset = n - 1; offset >= 0; offset -= 1) {
    const date = addDays(ctx.today, -offset);
    days.push({ date, end: offset === 0 ? ctx.asOfMs : startOfLocalDay(addDays(date, 1), ctx.timezone).getTime() });
  }
  return days;
}

// Classifies a dueDate field change (metric 16).
function slipOf(transition) {
  const from = isDate(transition.from) ? transition.from : '';
  const to = isDate(transition.to) ? transition.to : '';
  if (!from) return null;
  if (!to) return { kind: 'cleared' };
  const days = dayDiff(from, to);
  if (days > 0) return { kind: 'later', days };
  if (days < 0) return { kind: 'pulled_in', days: -days };
  return null;
}

function eventCite(run, event) {
  return { runId: run.localId, seq: event.seq, hash: event.hash, at: event.at };
}

// The event that began a run's wait, for its citation.
function waitEvent(run) {
  const { reason, waitStart } = run.needs;
  const type = { gate: 'gate_opened', input: 'attempt_dispatched', waiting: 'waiting', failed: 'run_failed', unclaimed: 'attempt_dispatched' }[reason];
  if (reason === 'integrity') return run.events[run.integrity.brokenAt - 1] || run.events[run.integrity.brokenAt - 2] || run.events.at(-1);
  const matches = run.events.filter((event) => event.type === type && event.at === waitStart);
  return (reason === 'waiting' ? matches[0] : matches.at(-1)) || run.events.at(-1);
}

// --- per-metric functions --------------------------------------------------------

function waitingOnYou(ctx) {
  const items = ctx.runs.filter((run) => run.needs.needsHuman).map((run) => {
    const waitMs = run.needs.waitStart ? toMs(run.needs.waitStart) : toMs(run.events.at(-1).at);
    return {
      ...eventCite(run, waitEvent(run)), taskKey: run.key, title: run.key ? ctx.tasks[run.key].title : run.state.taskTitle || '',
      reason: run.needs.reason, waitStart: iso(waitMs), value: round1((ctx.asOfMs - waitMs) / HOUR_MS),
      workingHours: round1(workingMs(waitMs, ctx.asOfMs, ctx.timezone, ctx.workdays) / HOUR_MS),
    };
  }).sort((a, b) => toMs(a.waitStart) - toMs(b.waitStart) || a.runId.localeCompare(b.runId));
  return count(ctx, 'waiting_on_you', items, { params: { leaseMs: ctx.leaseMs } });
}

function approvalLatency(ctx) {
  const from = ctx.asOfMs - APPROVAL_WINDOW_DAYS * DAY_MS;
  const items = [];
  const excluded = [];
  for (const run of ctx.runs) {
    if (!run.integrity.ok) { excluded.push({ runId: run.localId, reason: 'audit log failed verification' }); continue; }
    const gates = new Map();
    for (const event of run.events) {
      if (event.type === 'gate_opened') gates.set(event.data.attempt, event);
      if ((event.type === 'approved' || event.type === 'rejected') && gates.has(event.data.attempt)) {
        const gate = gates.get(event.data.attempt);
        gates.delete(event.data.attempt);
        const decidedMs = toMs(event.at);
        if (decidedMs <= from) continue;
        const ms = workingMs(toMs(gate.at), decidedMs, ctx.timezone, ctx.workdays);
        items.push({
          ...eventCite(run, event), taskKey: run.key, decision: event.type,
          stageId: run.state.attempts.find((attempt) => attempt.n === event.data.attempt)?.stageId || '',
          value: round1(ms / HOUR_MS), elapsedHours: round1((decidedMs - toMs(gate.at)) / HOUR_MS),
          from: eventCite(run, gate), to: eventCite(run, event),
        });
      }
    }
  }
  const window = { from: iso(from), to: ctx.asOfIso };
  const params = { windowDays: APPROVAL_WINDOW_DAYS };
  return [50, 85].map((p) => percentileValue(ctx, `approval_latency_p${p}`, p, items, { window, params, excluded }));
}

function deltas(ctx, window) {
  const sinceMs = toMs(window.since);
  let mode = 'time';
  let fallback = '';
  let inWindow = (entry) => toMs(entry.at) > sinceMs;
  if (window.sinceSha) {
    const cursor = ctx.view.commits.find((commit) => commit.sha === window.sinceSha);
    if (cursor) {
      mode = 'cursor';
      inWindow = (entry) => entry.seq > cursor.seq;
    } else fallback = 'the cursor commit is not in first-parent history; counted by time instead';
  }
  const lists = {
    finished: new Map(), started: [], blocked: [], unblocked: [], added: [], removed: [], dropped: [],
    slipped: [], pulled_in: [], reopened: [], returned: [], runs_completed: [], runs_failed: [],
  };
  const item = (transition, extra = {}) => ({
    taskKey: transition.taskKey, title: ctx.tasks[transition.taskKey]?.title || '', at: transition.at, commit: transition.commit,
    actor: transition.actor, ...(transition.runId ? { runId: transition.runId } : {}), ...extra,
  });
  for (const transition of ctx.view.transitions) {
    if (!transition.taskKey || !inWindow(transition)) continue;
    const { kind, from, to } = transition;
    const arrived = kind === 'created' && !transition.retracted ? transition.snapshot.status : kind === 'status' ? to : '';
    if (arrived === 'done' && !transition.sweep) lists.finished.set(transition.taskKey, item(transition));
    if (arrived === 'blocked' && from !== 'blocked') lists.blocked.push(item(transition));
    if (arrived === 'dropped') lists.dropped.push(item(transition, kind === 'status' ? { from } : {}));
    if (kind === 'created' && !transition.retracted) lists.added.push(item(transition));
    if (kind === 'removed' && !transition.retracted) lists.removed.push(item(transition));
    if (kind === 'status') {
      if (from === 'blocked' && to === 'in_progress') lists.unblocked.push(item(transition));
      if (CLOSED.has(from) && !CLOSED.has(to)) lists.reopened.push(item(transition, { from, to }));
      if (WIP.has(from) && to === 'backlog') lists.returned.push(item(transition, { from }));
    }
    if (kind === 'field' && transition.field === 'dueDate') {
      const slip = slipOf(transition);
      if (slip?.kind === 'pulled_in') lists.pulled_in.push(item(transition, { from, to, days: slip.days }));
      else if (slip) lists.slipped.push(item(transition, { from, to, kind: slip.kind, ...(slip.days ? { days: slip.days } : {}) }));
    }
  }
  for (const [key, list] of Object.entries(ctx.cycles)) {
    for (const cycle of list) {
      if (cycle.start && inWindow(cycle.start)) {
        lists.started.push({
          taskKey: key, title: ctx.tasks[key].title, at: cycle.start.at, commit: cycle.start.commit,
          source: cycle.start.source, ...(cycle.start.label ? { label: cycle.start.label } : {}),
        });
      }
    }
  }
  lists.started.sort((a, b) => toMs(a.at) - toMs(b.at) || a.taskKey.localeCompare(b.taskKey));
  for (const run of ctx.runs) {
    for (const event of run.events) {
      if (toMs(event.at) <= sinceMs) continue;
      if (event.type === 'run_completed') lists.runs_completed.push({ ...eventCite(run, event), taskKey: run.key });
      if (event.type === 'run_failed') lists.runs_failed.push({ ...eventCite(run, event), taskKey: run.key, reason: event.data?.reason || '' });
    }
  }
  const shape = { from: iso(sinceMs), to: ctx.asOfIso, mode, ...(window.sinceSha ? { sinceSha: window.sinceSha } : {}), ...(fallback ? { fallback } : {}), ...(window.label ? { label: window.label } : {}) };
  return Object.entries(lists).map(([name, list]) => count(ctx, `delta_${name}`, list instanceof Map ? [...list.values()] : list, { window: shape }));
}

function dueDates(ctx, reference, projectN) {
  const open = ctx.keys(OPEN).filter((key) => isDate(ctx.tasks[key].dueDate));
  const soonEnd = addWorkdays(ctx.today, 6, ctx.workdays);
  const overdue = open.filter((key) => ctx.tasks[key].dueDate < ctx.today)
    .map((key) => taskItem(ctx, key, {
      dueDate: ctx.tasks[key].dueDate, daysOverdue: dayDiff(ctx.tasks[key].dueDate, ctx.today),
      commit: ctx.lastCommit(key, (transition) => transition.kind === 'created' || transition.field === 'dueDate'),
    }))
    .sort((a, b) => (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9) || b.daysOverdue - a.daysOverdue || a.taskKey.localeCompare(b.taskKey));
  const soon = open.filter((key) => ctx.tasks[key].dueDate >= ctx.today && ctx.tasks[key].dueDate < soonEnd)
    .map((key) => taskItem(ctx, key, { dueDate: ctx.tasks[key].dueDate, daysLeft: dayDiff(ctx.today, ctx.tasks[key].dueDate) }))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.taskKey.localeCompare(b.taskKey));
  const window = { from: ctx.today, to: addDays(soonEnd, -1) };

  // Due-date risk for every open task whose date has not passed.
  const risks = {};
  for (const key of open.filter((entry) => ctx.tasks[entry].dueDate >= ctx.today)) {
    const task = ctx.tasks[key];
    const daysLeft = (startOfLocalDay(addDays(task.dueDate, 1), ctx.timezone).getTime() - ctx.asOfMs) / DAY_MS;
    const value = base(ctx, 'due_risk', { params: { taskKey: key, minSample: MIN_SAMPLE, windowDays: FLOW_WINDOW_DAYS } });
    const cycle = ctx.cycles[key]?.at(-1);
    const backlog = task.status === 'backlog';
    value.task = { taskKey: key, title: task.title, dueDate: task.dueDate, daysLeft: round1(daysLeft), status: task.status, commit: ctx.lastCommit(key) };
    value.numerator = { n: 0, items: [] };
    value.denominator = { n: 0, items: [] };
    const ref = reference(task.typeKey);
    if (!ref) insufficient(value, projectN, MIN_SAMPLE, 'finished items'); else if (!backlog && !cycle?.start) {
      Object.assign(value, { status: 'na', reason: `start unknown: ${cycle?.excluded || 'no start'}` });
    } else {
      const age = backlog ? null : (ctx.asOfMs - toMs(cycle.start.at)) / DAY_MS;
      const sample = ref.items.map((item) => item.days);
      const result = dueRisk({ age, daysLeft, sample });
      value.params.reference = ref.source;
      value.params.referenceTypeSample = reference.typeCount(task.typeKey);
      value.sample = { n: ref.items.length, required: MIN_SAMPLE };
      value.numerator = { n: result.numerator.length, items: result.numerator.map((index) => ref.items[index]) };
      value.denominator = { n: result.denominator.length, items: result.denominator.map((index) => ref.items[index]) };
      value.value = result.probability;
      value.reason = result.reason;
      value.display = show(value.value, 'probability');
      if (age !== null) value.task.age = round1(age);
      value.formula = backlog
        ? `#{ct ≤ ${round1(daysLeft)}} / n = ${result.numerator.length} / ${result.denominator.length} (if started today)`
        : result.denominator.length
          ? `#{ct : ${round1(age)} < ct ≤ ${round1(age + daysLeft)}} / #{ct > ${round1(age)}} = ${result.numerator.length} / ${result.denominator.length}`
          : `no finished item took longer than ${round1(age)} d: P = 0`;
    }
    risks[key] = value;
  }
  const flaggedItems = Object.values(risks)
    .filter((risk) => risk.status === 'ok' && risk.value < 0.5 && risk.task.dueDate < soonEnd)
    .map((risk) => taskItem(ctx, risk.task.taskKey, { dueDate: risk.task.dueDate, probability: risk.value, reference: risk.params.reference, reason: risk.reason }))
    .sort((a, b) => a.probability - b.probability || a.dueDate.localeCompare(b.dueDate));
  const flagged = projectN < MIN_SAMPLE
    ? insufficient(base(ctx, 'due_risk_flagged', { window }), projectN, MIN_SAMPLE, 'finished items')
    : count(ctx, 'due_risk_flagged', flaggedItems, { window, params: { minSample: MIN_SAMPLE, windowDays: FLOW_WINDOW_DAYS } });
  return {
    overdue: count(ctx, 'overdue', overdue),
    due_soon: count(ctx, 'due_soon', soon, { window }),
    due_risk_flagged: flagged,
    risks,
  };
}

function aging(ctx, reference, projectN) {
  const items = [];
  const excluded = [];
  for (const key of ctx.keys(WIP)) {
    const cycle = ctx.cycles[key]?.at(-1);
    if (!cycle?.start) { excluded.push({ taskKey: key, title: ctx.tasks[key].title, reason: cycle?.excluded || 'no start' }); continue; }
    const ref = reference(ctx.tasks[key].typeKey);
    if (!ref) continue;
    const age = (ctx.asOfMs - toMs(cycle.start.at)) / DAY_MS;
    const p85 = percentile(ref.items.map((item) => item.days), 85);
    if (age <= p85) continue;
    items.push(taskItem(ctx, key, {
      value: round1(age), age, level: age > 2 * p85 ? 'critical' : 'aging',
      reference: { source: ref.source, p85: round1(p85), n: ref.items.length },
      from: { at: cycle.start.at, commit: cycle.start.commit }, commit: cycle.start.commit,
    }));
  }
  items.sort((a, b) => b.age - a.age || a.taskKey.localeCompare(b.taskKey));
  const params = { windowDays: FLOW_WINDOW_DAYS, minSample: MIN_SAMPLE, reference: 'type P85 with ≥5 finishes, else project P85' };
  if (projectN < MIN_SAMPLE) return insufficient(base(ctx, 'aging', { params, excluded }), projectN, MIN_SAMPLE, 'finished items');
  return count(ctx, 'aging', items, { params, excluded });
}

function blocked(ctx) {
  let live = false;
  const items = ctx.keys(new Set(['blocked'])).map((key) => {
    const task = ctx.tasks[key];
    const entry = (ctx.byKey.get(key) || []).filter((transition) => (transition.kind === 'status' && transition.to === 'blocked') || (transition.kind === 'created' && transition.snapshot.status === 'blocked')).at(-1);
    const sinceMs = entry ? toMs(entry.at) : ctx.asOfMs;
    const committedTrail = task.trailBlocked ? JSON.stringify({ kind: 'blocked', what: task.trailBlocked }) : '';
    const body = ctx.bodies?.[key] || '';
    let reason = blockedReasonOf({ blockedReason: task.blockedReason, trail: committedTrail, body });
    let reasonLive = false;
    const liveEntries = ctx.liveEntries(task.id);
    if (liveEntries.length) {
      const withLive = blockedReasonOf({ blockedReason: task.blockedReason, trail: [committedTrail, ...liveEntries.map((line) => JSON.stringify(line))].join('\n'), body });
      if (withLive.text !== reason.text || withLive.source !== reason.source) { reason = withLive; reasonLive = true; live = true; }
    }
    return taskItem(ctx, key, {
      blockedSince: iso(sinceMs), value: round1((ctx.asOfMs - sinceMs) / DAY_MS),
      workingDays: round1(workingMs(sinceMs, ctx.asOfMs, ctx.timezone, ctx.workdays) / DAY_MS),
      reason: reason.text, reasonSource: reason.source, ...(reasonLive ? { reasonLive: true } : {}),
      commit: entry?.commit || ctx.lastCommit(key),
    });
  }).sort((a, b) => toMs(a.blockedSince) - toMs(b.blockedSince) || a.taskKey.localeCompare(b.taskKey));
  const value = count(ctx, 'blocked', items);
  value.inputs.live = live;
  return value;
}

function blockedShare(ctx) {
  const days = lastDays(ctx, SHARE_WINDOW_DAYS);
  const states = statesAt(ctx, days.map((day) => day.end));
  const numerator = [];
  const denominator = [];
  days.forEach((day, index) => {
    for (const [key, entry] of [...states[index]].sort(([a], [b]) => a.localeCompare(b))) {
      if (!WIP.has(entry.status)) continue;
      const item = { taskKey: key, date: day.date, status: entry.status, commit: entry.commit };
      denominator.push(item);
      if (entry.status === 'blocked') numerator.push(item);
    }
  });
  const value = base(ctx, 'blocked_share', {
    window: { from: days[0].date, to: ctx.today }, params: { windowDays: SHARE_WINDOW_DAYS },
    numerator: { n: numerator.length, items: numerator }, denominator: { n: denominator.length, items: denominator },
  });
  value.sample = { n: denominator.length, required: 0 };
  if (!denominator.length) return Object.assign(value, { status: 'na', reason: 'no WIP in the last 30 days', formula: 'blocked item-days / WIP item-days = 0 / 0' });
  value.value = numerator.length / denominator.length;
  value.display = show(value.value, 'ratio');
  value.formula = `blocked item-days / WIP item-days = ${numerator.length} / ${denominator.length}`;
  return value;
}

// When the board began: its first commit, as an instant and as a local day.
function bornOf(ctx) {
  const ms = ctx.view.commits.length ? toMs(ctx.view.commits[0].at) : -Infinity;
  return { ms, day: Number.isFinite(ms) ? localDate(ms, ctx.timezone) : '' };
}

function throughput(ctx, { finishes, drops, withdrawn, sweeps }) {
  const weekStart = startOfLocalDay(addDays(ctx.today, -6), ctx.timezone).getTime();
  const monthStart = startOfLocalDay(addDays(ctx.today, -34), ctx.timezone).getTime();
  const finishItem = ({ key, cycle }) => ({ taskKey: key, title: ctx.tasks[key].title, at: cycle.end.at, commit: cycle.end.commit, date: localDate(toMs(cycle.end.at), ctx.timezone) });
  const between = (list, from, to) => list.filter((entry) => entry.endMs >= from && entry.endMs < to);
  const order = (a, b) => toMs(a.at) - toMs(b.at) || a.taskKey.localeCompare(b.taskKey);
  const excludedIn = (from, to) => [
    ...between(drops, from, to).map(({ key }) => ({ taskKey: key, title: ctx.tasks[key].title, reason: 'dropped (killed)' })),
    ...between(sweeps, from, to).map(({ key, reason }) => ({ taskKey: key, title: ctx.tasks[key].title, reason })),
    ...between(withdrawn, from, to).map(({ key, finished, reopened }) => ({
      taskKey: key, title: ctx.tasks[key].title, reason: `earlier finish withdrawn by a reopen (finished ${finished.at}, reopened ${reopened.at})`,
    })),
  ];
  const end = ctx.asOfMs + 1;
  const week = count(ctx, 'done_7d', between(finishes, weekStart, end).map(finishItem).sort(order), {
    window: { from: iso(weekStart), to: ctx.asOfIso }, excluded: excludedIn(weekStart, end), params: { windowDays: 7 },
  });
  // The usual week counts only the time the board existed: before its first
  // commit nothing finished because there was nothing, not because work was
  // slow. It needs one whole week of that time.
  const { ms: bornMs, day: born } = bornOf(ctx);
  const monthFrom = Math.max(monthStart, bornMs);
  const monthItems = between(finishes, monthStart, weekStart).map(finishItem).sort(order);
  const weeks = (weekStart - monthFrom) / (7 * DAY_MS);
  const month = count(ctx, 'done_4w', monthItems, {
    window: { from: iso(Math.min(monthFrom, weekStart)), to: iso(weekStart) }, excluded: excludedIn(monthStart, weekStart), params: { windowDays: 28 },
    display: `weekly mean ${weeks > 0 ? round1(monthItems.length / weeks) : 0}`,
  });
  if (weeks < 1) {
    Object.assign(month, {
      value: null, display: '—', status: 'insufficient', items: [],
      reason: `the board is younger than a week before these 7 days (first commit ${born})`,
    });
  }
  const days = lastDays(ctx, SERIES_DAYS);
  const byDate = new Map(days.map((day) => [day.date, []]));
  for (const entry of finishes) {
    const item = finishItem(entry);
    if (byDate.has(item.date) && entry.endMs <= ctx.asOfMs) byDate.get(item.date).push(item);
  }
  const series = base(ctx, 'throughput_series', { window: { from: days[0].date, to: ctx.today }, params: { days: SERIES_DAYS, born } });
  series.points = days.map(({ date }) => ({ date, n: byDate.get(date).length, items: byDate.get(date).sort(order) }));
  series.sample = { n: days.length, required: 0 };
  series.formula = `final finishes per local day, ${days[0].date} to ${ctx.today}`;
  return [week, month, series];
}

function wip(ctx) {
  const items = ctx.keys(WIP).map((key) => {
    const cycle = ctx.cycles[key]?.at(-1);
    return taskItem(ctx, key, { ...(cycle?.start ? { from: { at: cycle.start.at, commit: cycle.start.commit } } : {}) });
  });
  const value = count(ctx, 'wip', items, {
    params: { wipLimit: ctx.wipLimit }, display: ctx.wipLimit ? `${items.length} of ${ctx.wipLimit}` : String(items.length),
  });
  const days = lastDays(ctx, SERIES_DAYS);
  const states = statesAt(ctx, days.map((day) => day.end));
  const born = bornOf(ctx).day;
  const series = base(ctx, 'wip_series', { window: { from: days[0].date, to: ctx.today }, params: { days: SERIES_DAYS, wipLimit: ctx.wipLimit, born } });
  series.points = days.map((day, index) => {
    const pointItems = [...states[index]].filter(([, entry]) => WIP.has(entry.status)).sort(([a], [b]) => a.localeCompare(b))
      .map(([key, entry]) => ({ taskKey: key, status: entry.status, commit: entry.commit }));
    return { date: day.date, n: pointItems.length, items: pointItems };
  });
  series.sample = { n: days.length, required: 0 };
  series.formula = `WIP at the end of each local day, ${days[0].date} to ${ctx.today}`;
  return [value, series];
}

function slips(ctx) {
  const from = ctx.asOfMs - SLIP_WINDOW_DAYS * DAY_MS;
  const items = [];
  for (const transition of ctx.view.transitions) {
    if (transition.kind !== 'field' || transition.field !== 'dueDate' || toMs(transition.at) <= from) continue;
    const slip = slipOf(transition);
    if (!slip || slip.kind === 'pulled_in') continue;
    items.push({
      taskKey: transition.taskKey, title: ctx.tasks[transition.taskKey]?.title || '', from: transition.from, to: transition.to,
      kind: slip.kind, ...(slip.days ? { days: slip.days } : {}), at: transition.at, commit: transition.commit, actor: transition.actor,
    });
  }
  const window = { from: iso(from), to: ctx.asOfIso };
  const params = { windowDays: SLIP_WINDOW_DAYS };
  const perTask = new Map();
  for (const item of items) perTask.set(item.taskKey, [...(perTask.get(item.taskKey) || []), item]);
  const repeat = [...perTask].filter(([, list]) => list.length >= 2).sort(([a], [b]) => a.localeCompare(b))
    .map(([key, list]) => ({ taskKey: key, title: ctx.tasks[key]?.title || '', slips: list.length, commit: list.at(-1).commit }));
  return [count(ctx, 'slips', items, { window, params }), count(ctx, 'repeat_slips', repeat, { window, params })];
}

function load(ctx) {
  const people = new Map();
  const agents = new Map();
  const unassigned = [];
  for (const key of ctx.keys(WIP)) {
    const owner = ownerOf(ctx, key);
    const task = { taskKey: key, title: ctx.tasks[key].title, priority: ctx.tasks[key].priority, commit: ctx.lastCommit(key) };
    if (owner.kind === 'unassigned') unassigned.push(taskItem(ctx, key, { reason: owner.reason }));
    else {
      const group = owner.kind === 'person' ? people : agents;
      if (!group.has(owner.name)) group.set(owner.name, []);
      group.get(owner.name).push({ ...task, step: owner.step, ...(owner.via ? { via: owner.via } : {}) });
    }
  }
  const limit = ctx.personalWipLimit;
  const peopleList = [...people].sort(([a], [b]) => a.localeCompare(b))
    .map(([name, tasks]) => ({ owner: name, kind: 'person', wip: tasks.length, limit, overloaded: tasks.length > limit, tasks }));
  const agentList = [...agents].sort(([a], [b]) => a.localeCompare(b)).map(([name, tasks]) => ({ owner: name, kind: 'agent', wip: tasks.length, tasks }));
  return [
    count(ctx, 'load', peopleList.filter((person) => person.overloaded), { params: { personalWipLimit: limit }, people: peopleList, agents: agentList }),
    count(ctx, 'unassigned_wip', unassigned),
  ];
}

// Stale agent claims (metric 30, plan §4.7).
function staleClaims(ctx) {
  const items = [];
  const claims = [];
  const excluded = [];
  let liveUsed = false;
  const liveInput = !ctx.live.provided ? 'not read' : ctx.live.usable ? 'read' : 'unavailable (past asOf)';
  for (const key of ctx.keys(WIP)) {
    const task = ctx.tasks[key];
    const runs = ctx.runsOf(key);
    const active = runs.filter((run) => run.active);
    const life = (ctx.byKey.get(key) || []).filter((transition) => transition.kind === 'life');
    const liveEntries = ctx.liveEntries(task.id);
    const why = [];
    if (active.length) why.push(`run ${active.at(-1).localId} in flight`);
    if (life.length || liveEntries.length) why.push('checkpoint trail');
    if (task.owner.profile && !isUiClaim(task.owner)) why.push(`owner ${agentIdentity(task.owner)}`);
    if (!why.length) {
      claims.push({ taskKey: key, type: 'human', why: [isUiClaim(task.owner) ? 'claimed in AGE Aris (@agesight/web)' : 'no agent session, trail, or run'] });
      excluded.push({ taskKey: key, title: task.title, reason: 'human claim (aging only)' });
      continue;
    }
    const waiting = runs.find((run) => run.needs.needsHuman);
    if (waiting) {
      claims.push({ taskKey: key, type: 'agent', why, waitingOn: waiting.localId });
      excluded.push({ taskKey: key, title: task.title, reason: `run ${waiting.localId} is waiting on a person (a decision)` });
      continue;
    }
    const cycle = ctx.cycles[key]?.at(-1);
    const claimant = cycle?.claimant?.operator || task.owner.operator;
    const operatorCounts = !ctx.operator || claimant === ctx.operator;
    const inputs = [];
    const ignored = [];
    for (const commit of ctx.touching.get(key) || []) {
      if (commit.sweep) continue;
      if (commit.via === 'ui') ignored.push({ commit: commit.sha, at: commit.at, reason: 'AGESight-Via: ui (an edit made in AGE Aris)' });
      else if (ctx.operator && commit.actor === ctx.operator && !operatorCounts) ignored.push({ commit: commit.sha, at: commit.at, reason: `authored by the workspace operator ${ctx.operator}; the claimant is ${claimant || 'unknown'}` });
      else inputs.push({ source: 'commit', at: commit.at, commit: commit.sha });
    }
    for (const transition of life) {
      if (toMs(transition.ts) <= ctx.asOfMs) inputs.push({ source: 'checkpoint', at: transition.ts, commit: transition.commit });
    }
    for (const run of runs) inputs.push({ source: 'run', ...eventCite(run, run.events.at(-1)) });
    if (liveEntries.length) {
      const newest = liveEntries.reduce((a, b) => (b.ms > a.ms ? b : a));
      inputs.push({ source: 'live trail', at: iso(newest.ms), trail: `${ctx.board}/checkpoints/${task.id}.jsonl`, ts: newest.ts, live: true });
      liveUsed = true;
    }
    // A claim is never staler than its own start.
    const startAt = cycle?.start?.at || cycle?.begin?.at;
    const floor = startAt ? { source: 'cycle start', at: startAt, commit: cycle.start?.commit || cycle.begin.commit } : null;
    const lastLife = [...inputs, ...(floor ? [floor] : [])].reduce((a, b) => (!a || toMs(b.at) > toMs(a.at) ? b : a), null);
    const lastMs = lastLife ? toMs(lastLife.at) : ctx.asOfMs;
    const hours = (ctx.asOfMs - lastMs) / HOUR_MS;
    const stale = hours > ctx.staleHours;
    const claim = {
      taskKey: key, type: 'agent', why, stale, hours: round1(hours), lastLife, inputs: inputs.sort((a, b) => toMs(b.at) - toMs(a.at)),
      ignored: ignored.filter((entry) => toMs(entry.at) > lastMs), liveInput, live: lastLife?.live === true,
    };
    claims.push(claim);
    if (stale) items.push(taskItem(ctx, key, { value: round1(hours), lastLife, why, live: claim.live, commit: cycle?.start?.commit || ctx.lastCommit(key) }));
  }
  items.sort((a, b) => b.value - a.value || a.taskKey.localeCompare(b.taskKey));
  const value = count(ctx, 'stale_claims', items, { params: { staleHours: ctx.staleHours }, excluded, claims, liveInput });
  value.inputs.live = liveUsed;
  return value;
}

function health(ctx, metrics, recentFinishes) {
  const rule = (id, level, message, items = []) => ({ id, level, message, items });
  const rules = [];
  const wipCount = metrics.wip.value;
  const open = ctx.keys(OPEN);

  const overdue = metrics.overdue.items;
  const urgent = overdue.filter((item) => item.priority === 'high' || item.priority === 'urgent');
  if (urgent.length) rules.push(rule('H2', 'red', `${urgent.length} high or urgent item${urgent.length === 1 ? '' : 's'} overdue`, urgent));
  else if (overdue.length) rules.push(rule('H2', 'amber', `${overdue.length} item${overdue.length === 1 ? '' : 's'} overdue`, overdue));
  else rules.push(rule('H2', 'green', 'nothing overdue'));

  const agingValue = metrics.aging;
  if (!wipCount) rules.push(rule('H3', 'na', 'no WIP'));
  else if (agingValue.status === 'insufficient') rules.push(rule('H3', 'unknown', `${agingValue.reason}`));
  else {
    const critical = agingValue.items.filter((item) => item.level === 'critical');
    if (critical.length) rules.push(rule('H3', 'red', `${critical.length} item${critical.length === 1 ? '' : 's'} past 2× usual`, critical));
    else if (agingValue.items.length) rules.push(rule('H3', 'amber', `${agingValue.items.length} item${agingValue.items.length === 1 ? '' : 's'} aging`, agingValue.items));
    else rules.push(rule('H3', 'green', 'no item older than usual'));
  }

  const blockedItems = metrics.blocked.items;
  const longBlocked = blockedItems.filter((item) => workingMs(toMs(item.blockedSince), ctx.asOfMs, ctx.timezone, ctx.workdays) >= HEALTH_THRESHOLDS.blockedWorkingDays * DAY_MS);
  if (wipCount >= 2 && blockedItems.length >= HEALTH_THRESHOLDS.blockedShareOfWip * wipCount) rules.push(rule('H4', 'red', `${blockedItems.length} of ${wipCount} WIP items blocked`, blockedItems));
  else if (longBlocked.length) rules.push(rule('H4', 'amber', `${longBlocked.length} item${longBlocked.length === 1 ? '' : 's'} blocked for 2 working days or more`, longBlocked));
  else rules.push(rule('H4', 'green', 'nothing blocked for long'));

  // H5: the quiet window starts at the 5th working day before today.
  let quietDay = ctx.today;
  for (let n = 0; n < HEALTH_THRESHOLDS.quietWorkingDays; n += 1) quietDay = previousWorkday(quietDay, ctx.workdays);
  const quietMs = startOfLocalDay(quietDay, ctx.timezone).getTime();
  const firstCommit = ctx.view.commits[0];
  const finishedRecently = ctx.view.transitions.some((transition) => !transition.sweep && toMs(transition.at) >= quietMs && ((transition.kind === 'status' && transition.to === 'done') || (transition.kind === 'created' && !transition.retracted && transition.snapshot.status === 'done')));
  const startedRecently = Object.values(ctx.cycles).some((list) => list.some((cycle) => cycle.start && toMs(cycle.start.at) >= quietMs));
  if (!open.length) rules.push(rule('H5', 'na', 'no open work'));
  else if (!firstCommit || toMs(firstCommit.at) > quietMs) rules.push(rule('H5', 'unknown', 'the project\'s first commit is less than 5 working days old'));
  else if (wipCount && !finishedRecently) rules.push(rule('H5', 'amber', 'stalled: WIP and no finish in the last 5 working days', metrics.wip.items));
  else if (!finishedRecently && !startedRecently) rules.push(rule('H5', 'amber', 'idle with open work: no start and no finish in the last 5 working days', open.map((key) => taskItem(ctx, key))));
  else rules.push(rule('H5', 'green', 'work started or finished in the last 5 working days'));

  const slow = metrics.waiting_on_you.items.filter((item) => item.workingHours > HEALTH_THRESHOLDS.decisionWorkingDays * 24);
  if (slow.length) rules.push(rule('H6', 'amber', `${slow.length} decision${slow.length === 1 ? ' has' : 's have'} waited more than 1 working day`, slow));
  else rules.push(rule('H6', 'green', 'no decision waiting long'));

  if (!ctx.wipLimit) rules.push(rule('H7', 'na', 'no WIP limit set'));
  else if (wipCount > ctx.wipLimit) rules.push(rule('H7', 'amber', `WIP ${wipCount} over the limit of ${ctx.wipLimit}`, metrics.wip.items));
  else rules.push(rule('H7', 'green', `WIP ${wipCount} of ${ctx.wipLimit}`));

  const stale = metrics.stale_claims.items;
  if (stale.length) rules.push(rule('H8', 'amber', `${stale.length} stale agent claim${stale.length === 1 ? '' : 's'}`, stale));
  else rules.push(rule('H8', 'green', 'no stale agent claims'));

  const context = { openWork: open.length, recentFinishes, everHadTask: Object.keys(ctx.tasks).length > 0 };
  const { level, label, because } = combine(rules, context);
  const value = base(ctx, 'health', { rules, context, level, label, because });
  value.value = level;
  value.display = label;
  value.sample = { n: rules.length, required: 0 };
  value.inputs.live = metrics.stale_claims.inputs.live || metrics.blocked.inputs.live;
  value.formula = `combine(${rules.map((entry) => `${entry.id} ${entry.level}`).join(', ')}; open work ${context.openWork}, finishes in 90 days ${recentFinishes}) = ${label}`;
  return value;
}

// Every Cut 1 metric of one project at `asOf`.
//   ledger     the project's ledger (lib/history.mjs buildLedger)
//   runs       its runs' audit events: [{id, localId, taskId, integrity, events}]
//              (PipelineEngine.eventsByProject().get(projectId))
//   project    {id, wipLimit, staleHours, board} (staleHours from the board's settings
//              file; board, AA or an older deaddrop or pm, names the folder live
//              trails come from)
//   settings   the effective workspace settings {timezone, workdays, personalWipLimit, deltaFallback}
//   operator   the workspace operator (git user.name of every project)
//   live       optional {readAt, trails: {T004: text}}: the working-tree trails,
//              read by the caller at `readAt`; used only within 60 s of asOf
//   bodies     optional {taskKey: task markdown body}, for the Handoff reason
//   window     optional {since, sinceSha?, label?}: the delta window; default
//              settings.deltaFallback
export function projectMetrics({
  ledger, runs = [], project = {}, settings = {}, asOf, operator = '', live = null, bodies = {}, window = null, leaseMs = DEFAULT_LEASE_MS,
}) {
  if (asOf === undefined || asOf === null) throw new TypeError('asOf is required');
  const ctx = prepare({ ledger, runs, project, settings, asOf, operator, live, bodies, leaseMs });
  const metrics = {};
  const add = (...values) => { for (const value of values.flat()) metrics[value.id] = value; };
  const results = outcomes(ctx);
  const sample = flow(ctx, results);
  const flowWindow = { from: iso(sample.from), to: ctx.asOfIso };
  const flowParams = { windowDays: FLOW_WINDOW_DAYS };

  add(waitingOnYou(ctx), approvalLatency(ctx));
  add(deltas(ctx, window || timeWindow(settings.deltaFallback || 'previous-workday', ctx.asOfMs, ctx)));
  const due = dueDates(ctx, sample.reference, sample.cycle.length);
  add(due.overdue, due.due_soon, due.due_risk_flagged);
  add(aging(ctx, sample.reference, sample.cycle.length), blocked(ctx), blockedShare(ctx));
  add(throughput(ctx, results));
  for (const p of [50, 85]) {
    add(percentileValue(ctx, `cycle_time_p${p}`, p, sample.cycle, { window: flowWindow, params: flowParams, excluded: sample.excluded }));
    add(percentileValue(ctx, `lead_time_p${p}`, p, sample.lead, { window: flowWindow, params: flowParams, excluded: sample.unfinished }));
  }
  add(wip(ctx), slips(ctx), load(ctx), staleClaims(ctx));
  add(health(ctx, metrics, sample.finished));
  return {
    projectId: ledger.projectId || project.id || '', asOf: ctx.asOfIso, build: { ...ctx.build }, ledgerHeadAtAsOf: ctx.view.ledgerHeadAtAsOf,
    metrics, dueRisk: due.risks,
    charts: { aging: agingChart(ctx, sample, metrics.stale_claims), cycles: cycleChart(sample, flowWindow), forecast: forecastChart(ctx, metrics.throughput_series) },
  };
}

// --- chart data ---------------------------------------------------------------
// The shapes the Flow tab draws. They add no new measure: every dot is a task
// a metric above already counts, and every line is one of its percentiles.

// The bands an age is read against: percentiles of the project's finished
// cycle times in the flow window, or null below the minimum sample.
function bandsOf(cycle) {
  if (cycle.length < MIN_SAMPLE) return null;
  const days = cycle.map((item) => item.days);
  return { p50: round3(percentile(days, 50)), p70: round3(percentile(days, 70)), p85: round3(percentile(days, 85)), p95: round3(percentile(days, 95)), n: days.length };
}

// Aging WIP: every task in progress or blocked, by column and age since its
// cycle started, with the level the `aging` metric gives it (its own type's
// service level when that type has enough history) and whether its agent
// claim is stale.
function agingChart(ctx, sample, staleClaims) {
  const stale = new Set((staleClaims.items || []).map((item) => item.taskKey));
  const items = [];
  let unstarted = 0;
  for (const key of ctx.keys(WIP)) {
    const cycle = ctx.cycles[key]?.at(-1);
    if (!cycle?.start) { unstarted += 1; continue; }
    const age = (ctx.asOfMs - toMs(cycle.start.at)) / DAY_MS;
    const ref = sample.reference(ctx.tasks[key].typeKey);
    const p85 = ref ? percentile(ref.items.map((item) => item.days), 85) : null;
    const level = p85 === null ? 'unknown' : age > 2 * p85 ? 'critical' : age > p85 ? 'aging' : 'ok';
    items.push({ ...taskItem(ctx, key), age: round3(age), level, stale: stale.has(key), since: cycle.start.at });
  }
  items.sort((a, b) => b.age - a.age || a.taskKey.localeCompare(b.taskKey));
  return { bands: bandsOf(sample.cycle), items, unstarted, minSample: MIN_SAMPLE };
}

// The forecast: a Monte Carlo over the project's own daily throughput (§ the
// operator's choice in T032). Each simulated day finishes as many tasks as a
// past whole day, drawn at random, did; no estimates. The generator is seeded
// from the history and asOf, so the same ledger always gives the same numbers.
const FORECAST_TRIALS = 10000;
const FORECAST_HORIZON_DAYS = 365;
const FORECAST_AHEAD_DAYS = 14;

function seededRandom(text) {
  let seed = 2166136261;
  for (let index = 0; index < text.length; index += 1) seed = Math.imul(seed ^ text.charCodeAt(index), 16777619) >>> 0;
  return () => {
    seed = (seed + 0x6d2b79f5) >>> 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// The value below which p% of sorted outcomes fall (nearest rank).
const rank = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))];

function forecastChart(ctx, series) {
  // Whole days only: today is still going, and would read as a slow day. And
  // only days the board existed for: a day before its first commit finished
  // nothing because there was nothing yet, not because the pace was slow.
  const bornMs = bornOf(ctx).ms;
  const days = series.points.slice(0, -1).filter(({ date }) => startOfLocalDay(addDays(date, 1), ctx.timezone).getTime() > bornMs);
  return forecast({
    history: days.map((point) => point.n), open: ctx.keys(OPEN).length, today: ctx.today,
    // Seeded by the day, not the instant: the page refreshes every few seconds
    // and must not move a date each time.
    from: days[0]?.date || '', to: days.at(-1)?.date || '', seed: ctx.today,
  });
}

// The simulation itself, pure: `history` is finishes per past whole day,
// `open` the tasks still to finish, `today` a local date (YYYY-MM-DD).
export function forecast({ history, open, today, from = '', to = '', seed = '' }) {
  const finished = history.reduce((sum, n) => sum + n, 0);
  const basis = { days: history.length, finished, from, to, trials: FORECAST_TRIALS };
  if (!open) return { status: 'nothing-open', open, basis };
  if (!finished) return { status: 'no-history', open, basis };
  // As with every flow measure, too few finishes say nothing about a pace, and
  // too few days say nothing about how it varies: one day sampled is a
  // forecast with no spread at all.
  if (history.length < MIN_SAMPLE) return { status: 'thin', short: 'days', open, basis, minSample: MIN_SAMPLE };
  if (finished < MIN_SAMPLE) return { status: 'thin', short: 'finishes', open, basis, minSample: MIN_SAMPLE };
  const random = seededRandom(`${history.join(',')}|${seed}|${open}`);
  const draw = () => history[Math.floor(random() * history.length)];
  // When: how many days until `open` tasks have finished.
  const needed = [];
  for (let trial = 0; trial < FORECAST_TRIALS; trial += 1) {
    let done = 0;
    let day = 0;
    while (done < open && day < FORECAST_HORIZON_DAYS) { done += draw(); day += 1; }
    needed.push(done >= open ? day : Infinity);
  }
  needed.sort((a, b) => a - b);
  const when = (p) => {
    const value = rank(needed, p);
    return Number.isFinite(value) ? { days: value, date: addDays(today, value) } : { days: null, date: '' };
  };
  const histogram = new Map();
  for (const value of needed) if (Number.isFinite(value)) histogram.set(value, (histogram.get(value) || 0) + 1);
  // How many in the next FORECAST_AHEAD_DAYS days.
  const counts = [];
  for (let trial = 0; trial < FORECAST_TRIALS; trial += 1) {
    let done = 0;
    for (let day = 0; day < FORECAST_AHEAD_DAYS; day += 1) done += draw();
    counts.push(done);
  }
  counts.sort((a, b) => a - b);
  return {
    status: 'ok', open, basis,
    when: { p50: when(50), p85: when(85), p95: when(95), beyondHorizon: needed.filter((value) => !Number.isFinite(value)).length, horizonDays: FORECAST_HORIZON_DAYS },
    histogram: [...histogram].sort((a, b) => a[0] - b[0]).map(([days, n]) => ({ days, n })),
    // "p% likely at least n": the (100 − p)th percentile of the counts.
    ahead: { days: FORECAST_AHEAD_DAYS, date: addDays(today, FORECAST_AHEAD_DAYS), p50: rank(counts, 50), p85: rank(counts, 15), p95: rank(counts, 5) },
  };
}

// Cycle times: every task finished in the flow window with a known start, by
// finish time and cycle time; the percentile lines; how many were left out.
function cycleChart(sample, window) {
  const items = sample.cycle.map((item) => ({ taskKey: item.taskKey, title: item.title, days: round3(item.days), at: item.to.at }));
  return { window, bands: bandsOf(sample.cycle), items, excluded: sample.excluded.length, minSample: MIN_SAMPLE };
}
