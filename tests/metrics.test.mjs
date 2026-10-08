import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { buildEvent } from '../lib/audit.mjs';
import { fabricate } from '../lib/fabricate.mjs';
import { buildLedger } from '../lib/history.mjs';
import {
  checkInvariant, combine, dueRisk, METRIC_DEFINITIONS, percentile, projectMetrics, slim, timeWindow,
} from '../lib/metrics.mjs';

// The library spawns git itself; keep it independent of the developer's config.
process.env.GIT_CONFIG_GLOBAL = os.devNull;
process.env.GIT_CONFIG_NOSYSTEM = '1';

// Fixture defaults (plan §8): asOf Monday 2026-10-05 09:12 Europe/London,
// working days Monday–Friday. The fabricator's epoch is 2026-09-01 (+01:00), so
// `day 34 09:12` is asOf, `day 31` is Friday 2 October, `day 32` Saturday.
const ASOF = '2026-10-05T09:12:00+01:00';
const SETTINGS = { timezone: 'Europe/London', workdays: [1, 2, 3, 4, 5], personalWipLimit: 3, deltaFallback: 'previous-workday' };
const CLAIM = 'ade @k/e857a8c8 2026-10-04 — importer';
const UI = 'ade @agesight/web 2026-10-04 — working on it';
const temporaryDirectories = new Set();
// Every result computed in this file, for the §3.2 property test at the end.
const computed = [];

test.after(async () => {
  await Promise.all([...temporaryDirectories].map((directory) => rm(directory, { recursive: true, force: true })));
});

// Every fixture is fabricated as in the default setup: the workspace operator
// `ade` authors every commit unless a line names someone else.
async function fixture(script) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'agesight-metrics-'));
  temporaryDirectories.add(directory);
  const fabrication = await fabricate(path.join(directory, 'repo'), script);
  return { fabrication, ledger: await buildLedger(fabrication.dir, { projectId: 'p1' }) };
}

function compute(ledger, options = {}) {
  const result = projectMetrics({ ledger, project: { id: 'p1', wipLimit: 5 }, settings: SETTINGS, asOf: ASOF, operator: 'ade', ...options });
  computed.push({ ledger, result });
  return result;
}

// Script lines [day, 'HH:MM', 'actor: op'] written in time order; the sort is
// stable, so one task's lines at the same time keep their order.
function timeline(...groups) {
  return groups.flat().sort((a, b) => a[0] - b[0] || a[1].localeCompare(b[1])).map(([day, time, rest]) => `day ${day} ${time} ${rest}`).join('\n');
}

// A task created in the backlog, started, and finished, all at 09:00.
function flowTask(id, { create, start, finish, type = '', fields = '' }) {
  const extra = type ? `{"type": "${type}"${fields ? `, ${fields}` : ''}}` : fields ? `{${fields}}` : '';
  return [
    [create, '09:00', `ade: create ${id} backlog "${id} work" ${extra}`],
    [start, '09:00', `ade: move ${id} tasks`],
    ...(finish === undefined ? [] : [[finish, '09:00', `ade: move ${id} done`]]),
  ];
}

// The ISO time of fabricator `day N HH:MM` (+01:00, as the epoch).
function at(day, time = '09:00') {
  const [hours, minutes] = time.split(':').map(Number);
  return new Date(Date.UTC(2026, 8, 1 + day, hours - 1, minutes)).toISOString();
}

// A run's hash-chained audit events, shaped like eventsByProject() entries.
function runLog(localId, taskId, steps) {
  const events = [];
  let previous = null;
  const push = (type, when, data, actor = { type: 'system', id: 'agesight' }) => {
    previous = buildEvent(previous, { type, actor, data, at: when });
    events.push(previous);
  };
  const [first, ...rest] = steps;
  push('run_started', first, { runId: localId, taskId: `p1:${taskId}`, taskTitle: taskId, pipeline: [] }, { type: 'human', id: 'ade' });
  for (const [type, when, data = {}] of rest) push(type, when, data);
  return { id: `p1:${localId}`, localId, taskId: `p1:${taskId}`, integrity: { ok: true }, events };
}

function dispatch(n, { agentId = 'claude-sonnet', runner = 'command', stageId = 'plan' } = {}) {
  return { attempt: n, stageId, stageIndex: 0, role: 'plan', gate: 'approve', agentId: runner === 'human' ? '' : agentId, runner, reason: '', scoreboard: [], promptFile: '', promptHash: '', command: [] };
}

const keys = (value) => value.items.map((item) => item.taskKey);
const rule = (result, id) => result.metrics.health.rules.find((entry) => entry.id === id);

// --- percentile, due risk, combine (unit) -----------------------------------------

test('percentile is the nearest rank: P50 = 10 and P85 = 17 on 1..20', () => {
  const values = Array.from({ length: 20 }, (_value, index) => index + 1);
  assert.equal(percentile(values, 50), 10);
  assert.equal(percentile(values, 85), 17);
  assert.equal(percentile([3], 85), 3);
  assert.equal(percentile([], 50), null);
});

test('a percentile over 3 items is insufficient, "3 of 5"', async () => {
  const { ledger } = await fixture(timeline(
    flowTask('T001', { create: 20, start: 21, finish: 23 }),
    flowTask('T002', { create: 20, start: 21, finish: 24 }),
    flowTask('T003', { create: 20, start: 21, finish: 25 }),
  ));
  const cycle = compute(ledger).metrics.cycle_time_p85;
  assert.equal(cycle.status, 'insufficient');
  assert.equal(cycle.value, null);
  assert.equal(cycle.reason, 'not enough history (3 of 5)');
  assert.deepEqual(cycle.sample, { n: 3, required: 5 });
  assert.equal(cycle.items.length, 3, 'the items are still listed');
  assert.deepEqual(slim(cycle), { id: 'cycle_time_p85', kind: 'percentile', value: null, display: '—', status: 'insufficient', reason: 'not enough history (3 of 5)', sample: { n: 3, required: 5 } });
});

test('dueRisk: age 5, due in 3 days, sample [1,2,3,4,6,7,8,9,12,20] → 3/6 = 0.5', () => {
  const sample = [1, 2, 3, 4, 6, 7, 8, 9, 12, 20];
  const risk = dueRisk({ age: 5, daysLeft: 3, sample });
  assert.equal(risk.probability, 0.5);
  assert.deepEqual(risk.numerator.map((index) => sample[index]), [6, 7, 8]);
  assert.deepEqual(risk.denominator.map((index) => sample[index]), [6, 7, 8, 9, 12, 20]);

  const old = dueRisk({ age: 25, daysLeft: 3, sample });
  assert.equal(old.probability, 0);
  assert.equal(old.reason, 'older than every finished item');

  const backlog = dueRisk({ age: null, daysLeft: 5, sample });
  assert.equal(backlog.probability, 0.4);
  assert.equal(backlog.reason, 'if started today');
});

test('combine: red over amber over grey over green, Idle and No work', () => {
  const r = (id, level) => ({ id, level, message: '', items: level === 'red' || level === 'amber' ? [{ commit: 'x' }] : [] });
  const context = { openWork: 3, recentFinishes: 4, everHadTask: true };
  assert.equal(combine([r('H2', 'amber'), r('H3', 'red')], context).level, 'red');
  assert.equal(combine([r('H2', 'amber'), r('H3', 'unknown')], context).level, 'amber');
  assert.deepEqual(combine([r('H2', 'green'), r('H4', 'green'), r('H3', 'unknown')], context), { level: 'grey', label: 'Not enough history', because: ['H3'] });
  assert.equal(combine([r('H2', 'green'), r('H3', 'green'), r('H5', 'green')], context).level, 'green');
  assert.equal(combine([r('H3', 'na'), r('H5', 'na')], { openWork: 0, recentFinishes: 0, everHadTask: true }).label, 'Idle');
  assert.equal(combine([r('H3', 'na'), r('H5', 'na')], { openWork: 0, recentFinishes: 0, everHadTask: false }).label, 'No work');
  assert.equal(combine([r('H3', 'na'), r('H5', 'na')], { openWork: 0, recentFinishes: 2, everHadTask: true }).level, 'green');
});

test('timeWindow: previous working day, 24 h, and 7 d', () => {
  assert.equal(timeWindow('previous-workday', ASOF, SETTINGS).since, '2026-10-01T23:00:00.000Z');
  assert.equal(timeWindow('24h', ASOF, SETTINGS).since, '2026-10-04T08:12:00.000Z');
  assert.equal(timeWindow('7d', ASOF, SETTINGS).since, '2026-09-28T08:12:00.000Z');
});

// --- flow: cycle time, lead time, done counts -------------------------------------

test('cycle and lead time over 12 finished items: reopen, created in done, sweep fallback, killed (golden)', async () => {
  const { ledger } = await fixture(timeline(
    flowTask('T001', { create: 0, start: 1, finish: 2 }),
    flowTask('T002', { create: 1, start: 2, finish: 4 }),
    flowTask('T003', { create: 2, start: 3, finish: 6 }),
    flowTask('T004', { create: 3, start: 4, finish: 9 }),
    flowTask('T005', { create: 4, start: 5, finish: 11 }),
    flowTask('T006', { create: 5, start: 6, finish: 13 }),
    flowTask('T007', { create: 6, start: 7, finish: 15 }),
    flowTask('T008', { create: 7, start: 10, finish: 20 }),
    // Reopened: the final cycle runs from the reopen (day 20) to day 24.
    flowTask('T009', { create: 10, start: 11, finish: 13 }),
    [[20, '09:00', 'ade: move T009 tasks'], [24, '09:00', 'ade: move T009 done']],
    // Created directly in done: no start, so no cycle time; lead time 0.
    [[25, '09:00', 'ade: create T010 done "Recorded after the fact"']],
    // First WIP entry in a sweep; the next non-sweep commit in WIP starts it.
    [[12, '09:00', 'ade: create T011 backlog "Swept"'], [14, '09:00', 'ade: move T011 tasks subject="migrate: board sweep"'],
      [15, '09:00', 'ade: set T011 {"priority": "high"}'], [18, '09:00', 'ade: move T011 done']],
    // Killed: dropped, never a finish.
    [[5, '09:00', 'ade: create T012 backlog "Cancelled"'], [6, '09:00', 'ade: move T012 tasks'], [9, '09:00', 'ade: kill T012']],
  ));
  const { metrics } = compute(ledger);
  const cycle = metrics.cycle_time_p85;
  assert.deepEqual(cycle.items.map((item) => item.value), [1, 2, 3, 3, 4, 5, 6, 7, 8, 10]);
  assert.equal(metrics.cycle_time_p50.value, 4);
  assert.equal(cycle.value, 8);
  assert.equal(cycle.formula, 'nearest-rank P85 = sorted[ceil(0.85 × 10) − 1] = sorted[8] = 8.0');
  assert.equal(cycle.display, '8.0 d');
  assert.deepEqual(cycle.excluded.map((entry) => [entry.taskKey, entry.reason]), [['T010', 'no start'], ['T012', 'dropped (killed)']]);
  const reopened = cycle.items.find((item) => item.taskKey === 'T009');
  assert.deepEqual([reopened.value, reopened.from.at], [4, '2026-09-21T09:00:00+01:00']);
  const swept = cycle.items.find((item) => item.taskKey === 'T011');
  assert.equal(swept.value, 3);
  assert.match(swept.startLabel, /first non-sweep commit/);

  const lead = metrics.lead_time_p85;
  assert.deepEqual(lead.items.map((item) => [item.taskKey, item.value]).sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0])), [
    ['T010', 0], ['T001', 2], ['T002', 3], ['T003', 4], ['T004', 6], ['T011', 6], ['T005', 7], ['T006', 8], ['T007', 9], ['T008', 13], ['T009', 14],
  ]);
  assert.equal(metrics.lead_time_p50.value, 6);
  assert.equal(lead.value, 13);
  assert.deepEqual(lead.excluded.map((entry) => [entry.taskKey, entry.reason]), [['T012', 'dropped (killed)']]);

  // The killed item appears only in `excluded`, never among the flow items.
  for (const value of ['cycle_time_p50', 'cycle_time_p85', 'lead_time_p50', 'lead_time_p85', 'done_7d', 'done_4w', 'throughput_series'].map((id) => metrics[id])) {
    const items = [...value.items, ...(value.points || []).flatMap((point) => point.items)];
    assert.ok(!items.some((item) => item.taskKey === 'T012'), `${value.id} lists the killed item`);
  }
  assert.deepEqual(cycle.params, { timezone: 'Europe/London', workdays: [1, 2, 3, 4, 5], windowDays: 90, percentile: 85, minSample: 5 });
});

test('a finish known only from a sweep commit is excluded from cycle, lead, and done counts', async () => {
  const { ledger } = await fixture(timeline(
    flowTask('T001', { create: 20, start: 21, finish: 30 }),
    [[20, '09:00', 'ade: create T002 backlog "Swept done"'], [21, '09:00', 'ade: move T002 tasks'], [30, '10:00', 'ade: move T002 done subject="migrate: board sweep"']],
  ));
  const { metrics } = compute(ledger);
  const reason = 'finish known only from a sweep commit';
  for (const id of ['cycle_time_p85', 'lead_time_p85', 'done_7d']) {
    assert.ok(!keys(metrics[id]).includes('T002'), `${id} lists the swept finish`);
    assert.deepEqual(metrics[id].excluded.filter((entry) => entry.taskKey === 'T002').map((entry) => entry.reason), [reason], id);
  }
  assert.ok(!metrics.throughput_series.points.some((point) => point.items.some((item) => item.taskKey === 'T002')));
  assert.deepEqual(keys(metrics.done_7d), ['T001']);
  assert.deepEqual(keys(metrics.delta_finished), [], 'a sweep move into done is not a finish in the delta either');
});

// Five tasks created at 08:00 on day 30, started at 09:00, and finished 6 min,
// 12 min, 24 min, 2 h, and 6 h after the start: work that moves within hours.
async function subDayFlow() {
  const finishes = ['09:06', '09:12', '09:24', '11:00', '15:00'];
  return fixture(timeline(finishes.flatMap((finish, index) => {
    const id = `T00${index + 1}`;
    return [[30, '08:00', `ade: create ${id} backlog "${id} work"`], [30, '09:00', `ade: move ${id} tasks`], [30, finish, `ade: move ${id} done`]];
  })));
}

test('a cycle-time percentile under a day reads in hours ("0.4 h"), with its formula value to 0.001 day', async () => {
  const { metrics } = compute((await subDayFlow()).ledger);
  const p50 = metrics.cycle_time_p50;
  assert.deepEqual([p50.status, p50.value, p50.display], ['ok', 0.017, '0.4 h']);
  assert.equal(p50.formula, 'nearest-rank P50 = sorted[ceil(0.5 × 5) − 1] = sorted[2] = 0.017');
  assert.deepEqual([metrics.cycle_time_p85.value, metrics.cycle_time_p85.display], [0.25, '6.0 h']);
  assert.equal(metrics.cycle_time_p85.formula, 'nearest-rank P85 = sorted[ceil(0.85 × 5) − 1] = sorted[4] = 0.250');
  assert.deepEqual([metrics.lead_time_p50.display, metrics.lead_time_p85.display], ['1.4 h', '7.0 h']);
});

test('cycle and lead items keep their value to 0.001 day, so work done within hours never reads as 0.0 days', async () => {
  const { metrics } = compute((await subDayFlow()).ledger);
  const cycle = metrics.cycle_time_p85.items;
  assert.deepEqual(cycle.map((item) => [item.taskKey, item.value]), [['T001', 0.004], ['T002', 0.008], ['T003', 0.017], ['T004', 0.083], ['T005', 0.25]]);
  assert.equal(cycle[0].days, 6 / 1440, 'the unrounded duration is kept beside the value');
  assert.deepEqual(metrics.lead_time_p85.items.map((item) => item.value), [0.046, 0.05, 0.058, 0.125, 0.292]);
  for (const item of [...cycle, ...metrics.lead_time_p85.items]) assert.equal(item.value, Math.round(item.days * 1000) / 1000, item.taskKey);
});

test('done counts: 7 days, the previous 4 weeks as a weekly mean, and a 6-week series with zero days', async () => {
  const { ledger, fabrication } = await fixture(timeline(
    // The previous 4 weeks (days 0–27).
    flowTask('T001', { create: 0, start: 1, finish: 5 }),
    flowTask('T002', { create: 0, start: 1, finish: 10 }),
    flowTask('T003', { create: 0, start: 1, finish: 20 }),
    flowTask('T004', { create: 0, start: 1, finish: 27 }),
    // The last 7 local days (day 28 = Tuesday 29 September, to asOf).
    flowTask('T005', { create: 20, start: 21, finish: 28 }),
    flowTask('T006', { create: 20, start: 21, finish: 30 }),
    flowTask('T007', { create: 20, start: 21, finish: 33 }),
    // Finished, reopened, finished: counted once, on the final day (Saturday 3 October).
    flowTask('T008', { create: 20, start: 21, finish: 29 }),
    [[30, '10:00', 'ade: move T008 tasks'], [32, '10:00', 'ade: move T008 done label=refinish']],
    // Killed in the window: not a finish.
    [[20, '09:00', 'ade: create T009 backlog "Killed"'], [31, '09:00', 'ade: kill T009']],
    // Finished, then reopened and still open: the finish is withdrawn.
    flowTask('T010', { create: 20, start: 21, finish: 30 }),
    [[33, '11:00', 'ade: move T010 tasks']],
  ));
  const { metrics } = compute(ledger);
  assert.deepEqual(keys(metrics.done_7d), ['T005', 'T006', 'T008', 'T007']);
  assert.equal(metrics.done_7d.value, 4);
  const refinish = metrics.done_7d.items.find((item) => item.taskKey === 'T008');
  assert.deepEqual([refinish.date, refinish.commit], ['2026-10-03', fabrication.sha('refinish')]);
  assert.deepEqual(metrics.done_7d.excluded.map((entry) => [entry.taskKey, entry.reason.replace(/ \(finished .*/, '')]), [
    ['T009', 'dropped (killed)'], ['T010', 'earlier finish withdrawn by a reopen'],
  ]);
  assert.deepEqual(metrics.done_7d.window, { from: '2026-09-28T23:00:00.000Z', to: '2026-10-05T08:12:00.000Z' });

  assert.equal(metrics.done_4w.value, 4);
  assert.equal(metrics.done_4w.display, 'weekly mean 1');
  assert.deepEqual(keys(metrics.done_4w), ['T001', 'T002', 'T003', 'T004']);

  const series = metrics.throughput_series;
  assert.equal(series.value, null);
  assert.equal(series.points.length, 42);
  assert.deepEqual([series.points[0].date, series.points.at(-1).date], ['2026-08-25', '2026-10-05']);
  assert.equal(series.points.filter((point) => point.n === 0).length, 42 - 8, 'every day without a finish is a zero');
  assert.deepEqual(series.points.find((point) => point.date === '2026-10-03').items.map((item) => item.taskKey), ['T008']);
  assert.ok(!series.points.find((point) => point.date === '2026-09-30').items.some((item) => item.taskKey === 'T008'), 'the earlier finish is not counted again');
  assert.equal(series.points.reduce((sum, point) => sum + point.n, 0), 8);
});

// --- due dates: overdue, due soon, due risk ------------------------------------------

test('due soon on Saturday 3 October runs 3–11 October; on Monday 5 October it runs 5–12 October', async () => {
  const { ledger } = await fixture([
    'day 20 09:00 ade: create T001 backlog "Due Fri 2" {"dueDate": "2026-10-02"}',
    'day 20 09:01 ade: create T002 backlog "Due Sat 3" {"dueDate": "2026-10-03"}',
    'day 20 09:02 ade: create T003 backlog "Due Fri 9" {"dueDate": "2026-10-09"}',
    'day 20 09:03 ade: create T004 backlog "Due Sat 10" {"dueDate": "2026-10-10"}',
    'day 20 09:04 ade: create T005 tasks "Due Sun 11" {"dueDate": "2026-10-11"}',
    'day 20 09:05 ade: create T006 backlog "Due Mon 12" {"dueDate": "2026-10-12"}',
    'day 20 09:06 ade: create T007 backlog "Due Tue 13" {"dueDate": "2026-10-13"}',
    'day 20 09:07 ade: create T008 done "Done, due 9" {"dueDate": "2026-10-09"}',
  ].join('\n'));
  const saturday = compute(ledger, { asOf: '2026-10-03T12:00:00+01:00' }).metrics;
  assert.deepEqual(keys(saturday.due_soon), ['T002', 'T003', 'T004', 'T005']);
  assert.deepEqual(saturday.due_soon.window, { from: '2026-10-03', to: '2026-10-11' });
  assert.deepEqual(keys(saturday.overdue), ['T001']);

  const monday = compute(ledger).metrics;
  assert.deepEqual(keys(monday.due_soon), ['T003', 'T004', 'T005', 'T006']);
  assert.deepEqual(monday.due_soon.window, { from: '2026-10-05', to: '2026-10-12' });
  assert.deepEqual(keys(monday.overdue), ['T001', 'T002'], 'a done task is never overdue');
});

test('overdue is ordered by priority, then days overdue', async () => {
  const { ledger } = await fixture([
    'day 20 09:00 ade: create T001 backlog "Low, 5 days" {"dueDate": "2026-09-30", "priority": "low"}',
    'day 20 09:01 ade: create T002 tasks "Urgent, 1 day" {"dueDate": "2026-10-04", "priority": "urgent"}',
    'day 20 09:02 ade: create T003 backlog "Urgent, 3 days" {"dueDate": "2026-10-02", "priority": "urgent"}',
    'day 20 09:03 ade: create T004 backlog "High, 2 days" {"dueDate": "2026-10-03", "priority": "high"}',
  ].join('\n'));
  const overdue = compute(ledger).metrics.overdue;
  assert.deepEqual(overdue.items.map((item) => [item.taskKey, item.daysOverdue]), [['T003', 3], ['T002', 1], ['T004', 2], ['T001', 5]]);
});

// Finished work with cycle times: `bugs` bugs of 1 day and 5 untyped of 10 days.
function referenceHistory(bugs) {
  return [
    ...Array.from({ length: bugs }, (_value, index) => flowTask(`T00${index + 1}`, { create: 2, start: 3 + index, finish: 4 + index, type: 'bug' })),
    ...Array.from({ length: 5 }, (_value, index) => flowTask(`T01${index}`, { create: 2, start: 5 + index, finish: 15 + index })),
  ];
}

test('aging uses the type reference at 5 finishes and the project reference at 4; a {{…}} type is untyped', async () => {
  const wipLines = [
    [22, '09:00', 'ade: create T020 tasks "Old bug" {"type": "bug", "dueDate": "2026-10-07"}'],
    [22, '09:01', 'ade: create T021 tasks "Placeholder type" {"type": "{{optional — doc}}"}'],
    [22, '09:02', 'ade: create T022 backlog "Queued bug" {"type": "bug", "dueDate": "2026-10-30"}'],
  ];
  const five = compute((await fixture(timeline(...referenceHistory(5), wipLines))).ledger).metrics.aging;
  const typed = five.items.find((item) => item.taskKey === 'T020');
  assert.deepEqual([typed.level, typed.reference], ['critical', { source: 'type bug', p85: 1, n: 5 }]);
  const untyped = five.items.find((item) => item.taskKey === 'T021');
  assert.deepEqual([untyped.typeKey, untyped.level, untyped.reference.source], ['', 'aging', 'project']);
  assert.equal(five.params.reference, 'type P85 with ≥5 finishes, else project P85');

  const fourLedger = (await fixture(timeline(...referenceHistory(4), wipLines))).ledger;
  const four = compute(fourLedger);
  const projectRef = four.metrics.aging.items.find((item) => item.taskKey === 'T020');
  assert.deepEqual([projectRef.level, projectRef.reference], ['aging', { source: 'project', p85: 10, n: 9 }]);

  // Due-date risk follows the same reference rule (plan metric 5).
  const risk = four.dueRisk.T020;
  assert.equal(risk.kind, 'ratio');
  assert.deepEqual([risk.params.reference, risk.params.referenceTypeSample], ['project', 4]);
  assert.deepEqual([risk.value, risk.reason, risk.denominator.n], [0, 'older than every finished item', 0]);
  assert.match(risk.formula, /no finished item took longer than 12 d: P = 0/);
  const backlog = four.dueRisk.T022;
  assert.deepEqual([backlog.value, backlog.reason, backlog.numerator.n, backlog.denominator.n], [1, 'if started today', 9, 9]);
  assert.deepEqual(keys(four.metrics.due_risk_flagged), ['T020'], 'due within 5 working days and P < 0.5');
  assert.equal(four.metrics.due_risk_flagged.items[0].probability, 0);
});

test('due risk of a WIP item uses #{a < ct ≤ a+d} / #{ct > a}; insufficient under 5 finishes', async () => {
  // Cycle times 1, 2, 3, 4, 6, 7, 8, 9, 12, 20 days; the WIP item is 5 days old
  // and due at the end of Wednesday 7 October (2.6 days away).
  const times = [1, 2, 3, 4, 6, 7, 8, 9, 12, 20];
  const history = times.map((ct, index) => flowTask(`T0${String(index + 10)}`, { create: 1, start: 5, finish: 5 + ct }));
  const { ledger } = await fixture(timeline(...history, [[29, '09:12', 'ade: create T001 tasks "In flight" {"dueDate": "2026-10-07"}']]));
  const risk = compute(ledger).dueRisk.T001;
  assert.equal(risk.task.age, 5);
  assert.equal(risk.task.daysLeft, 2.6);
  assert.deepEqual(risk.numerator.items.map((item) => item.value), [6, 7]);
  assert.deepEqual([risk.numerator.n, risk.denominator.n, risk.value], [2, 6, 2 / 6]);
  assert.equal(risk.display, '33%');

  const small = await fixture(timeline(...history.slice(0, 3), [[29, '09:12', 'ade: create T001 tasks "In flight" {"dueDate": "2026-10-07"}']]));
  const thin = compute(small.ledger);
  assert.deepEqual([thin.dueRisk.T001.status, thin.dueRisk.T001.reason], ['insufficient', 'not enough history (3 of 5 finished items)']);
  assert.equal(thin.metrics.due_risk_flagged.status, 'insufficient');
});

// --- effective owner and load (C1/N2) ------------------------------------------------

test('effective owner: assignee, then the active run\'s agent, then the agent claim, else Unassigned', async () => {
  const { ledger } = await fixture([
    `day 30 09:00 ade: create T001 tasks "Agent claim" {"owner": "${CLAIM}"}`,
    `day 30 09:01 ade: create T002 tasks "UI claim" {"owner": "${UI}"} via=ui`,
    `day 30 09:02 ade: create T003 tasks "Run on an agent stage" {"owner": "${UI}"} run=R001`,
    `day 30 09:03 ade: create T004 tasks "Run at a human stage" {"owner": "${UI}"} run=R002`,
    `day 30 09:04 ade: create T005 tasks "Assigned, with a run" {"owner": "${UI}", "assignee": "Ana"} run=R003`,
    'day 30 09:05 ade: create T006 tasks "Trail, no profile" {"owner": "ade"}',
    'day 30 09:06 ade: ckpt T006 progress "half way"',
    'day 30 09:07 ade: create T007 tasks "No owner" {"owner": "—"}',
    'day 30 09:08 ade: create T008 tasks "Ana 2" {"assignee": "Ana"}',
    'day 30 09:09 ade: create T009 tasks "Ana 3" {"assignee": "Ana"}',
    'day 30 09:10 ade: create T010 tasks "Ana 4" {"assignee": "Ana"}',
    ...[11, 12, 13, 14].map((n) => `day 30 09:${n} ade: create T0${n} tasks "Fold ${n}" {"owner": "ade @k/beef 2026-10-01 — fold"}`),
  ].join('\n'));
  const runs = [
    runLog('R001', 'T003', [at(30, '09:02'), ['attempt_dispatched', at(30, '09:03'), dispatch(1, { agentId: 'claude-sonnet' })]]),
    runLog('R002', 'T004', [at(30, '09:03'), ['attempt_dispatched', at(30, '09:04'), dispatch(1, { runner: 'human' })]]),
    runLog('R003', 'T005', [at(30, '09:04'), ['attempt_dispatched', at(30, '09:05'), dispatch(1, { agentId: 'claude-opus' })]]),
  ];
  const { metrics } = compute(ledger, { runs, project: { id: 'p1', wipLimit: 20 } });
  const ownerOf = (key) => metrics.wip.items.find((item) => item.taskKey === key).owner;
  assert.deepEqual(ownerOf('T001'), { kind: 'agent', name: 'ade @k/e857a8c8', step: 'claim' });
  assert.deepEqual([ownerOf('T002').kind, ownerOf('T002').reason], ['unassigned', 'the owner line is UI bookkeeping (@agesight/web)']);
  assert.deepEqual(ownerOf('T003'), { kind: 'agent', name: 'claude-sonnet', step: 'run', via: 'via run R001', runId: 'R001' });
  assert.equal(ownerOf('T004').kind, 'unassigned', 'a run waiting at a human stage gives no owner');
  assert.deepEqual(ownerOf('T005'), { kind: 'person', name: 'Ana', step: 'assignee' });
  assert.deepEqual(ownerOf('T006'), { kind: 'agent', name: 'ade (trail)', step: 'trail' });
  assert.deepEqual([ownerOf('T007').kind, ownerOf('T007').reason], ['unassigned', 'no assignee or owner']);

  assert.deepEqual(keys(metrics.unassigned_wip), ['T002', 'T004', 'T007']);
  const load = metrics.load;
  assert.deepEqual(load.people.map((person) => [person.owner, person.wip, person.overloaded]), [['Ana', 4, true]]);
  assert.ok(!load.people.some((person) => person.owner === 'ade'), 'nothing here counts toward ade\'s load');
  assert.deepEqual(load.items.map((item) => item.owner), ['Ana']);
  assert.equal(load.value, 1);
  assert.deepEqual(load.agents.map((agent) => [agent.owner, agent.wip]), [
    ['ade (trail)', 1], ['ade @k/beef', 4], ['ade @k/e857a8c8', 1], ['claude-sonnet', 1],
  ]);
  assert.ok(load.agents.every((agent) => !('overloaded' in agent) && !('limit' in agent)), 'agents are never measured against the personal limit');
  assert.equal(load.params.personalWipLimit, 3);
});

// --- stale claims (K1, N1): one golden test per case ---------------------------------

// An agent claim made 30 hours before asOf (day 33 03:00), then `more`.
async function claimed(more = '', { owner = CLAIM, actor = 'ade' } = {}) {
  return fixture([
    `day 20 09:00 ${actor}: create T001 backlog "Importer"`,
    `day 33 03:00 ${actor}: move T001 tasks {"owner": "${owner}"}`,
    more,
  ].join('\n'));
}

function staleKeys(result) {
  return keys(result.metrics.stale_claims);
}

test('stale 1: a human @agesight/web claim untouched for 72 h is not stale (aging only)', async () => {
  const { ledger } = await fixture(`
    day 20 09:00 ade: create T001 backlog "Human work"
    day 31 09:00 ade: move T001 tasks {"owner": "${UI}"} via=ui
  `);
  const stale = compute(ledger).metrics.stale_claims;
  assert.deepEqual(keys(stale), []);
  assert.deepEqual(stale.excluded.map((entry) => [entry.taskKey, entry.reason]), [['T001', 'human claim (aging only)']]);
  assert.equal(stale.claims[0].type, 'human');
});

test('stale 2: an agent claim whose last non-sweep commit was 30 h ago is stale', async () => {
  const { ledger } = await claimed();
  const stale = compute(ledger).metrics.stale_claims;
  assert.deepEqual(keys(stale), ['T001']);
  assert.equal(stale.items[0].value, 30.2);
  assert.deepEqual(stale.items[0].why, ['owner ade @k/e857a8c8']);
  assert.equal(stale.items[0].lastLife.commit, ledger.commits[1].sha);
  assert.equal(stale.params.staleHours, 24);
});

test('stale 3: a committed checkpoint line 2 h ago keeps the claim alive', async () => {
  const { ledger } = await claimed('day 34 07:00 ade: ckpt T001 progress "parsed 400 rows"');
  const result = compute(ledger);
  assert.deepEqual(staleKeys(result), []);
  const claim = result.metrics.stale_claims.claims[0];
  assert.deepEqual([claim.lastLife.source, claim.hours], ['checkpoint', 2.2]);
});

test('stale 4: a ckpt: commit 2 h ago whose lines are dated 30 h ago is stale (the line ts decides)', async () => {
  const { ledger } = await claimed('day 34 07:00 ade: ckpt T001 progress "old note" ts="day 33 03:00"');
  assert.deepEqual(staleKeys(compute(ledger)), ['T001']);
});

test('stale 5 (N1): a UI edit 2 h ago never counts as life; the same edit by raw git does', async () => {
  const ui = compute((await claimed('day 34 07:00 ade: set T001 {"priority": "high"} via=ui')).ledger).metrics.stale_claims;
  assert.deepEqual(keys(ui), ['T001']);
  assert.deepEqual(ui.claims[0].ignored.map((entry) => entry.reason), ['AGESight-Via: ui (an edit made in AGE Aris)']);

  const raw = compute((await claimed('day 34 07:00 ade: set T001 {"priority": "high"}')).ledger).metrics.stale_claims;
  assert.deepEqual(keys(raw), []);
  assert.equal(raw.claims[0].lastLife.source, 'commit');
});

test('stale 5b: the workspace operator\'s commits count only when the claimant is that operator', async () => {
  const bot = await claimed('day 34 07:00 ade: set T001 {"priority": "high"}', { owner: 'bot @k/beef 2026-10-04 — fold', actor: 'bot' });
  const botStale = compute(bot.ledger).metrics.stale_claims;
  assert.deepEqual(keys(botStale), ['T001']);
  assert.match(botStale.claims[0].ignored[0].reason, /authored by the workspace operator ade; the claimant is bot/);

  const own = await claimed('day 34 07:00 ade: set T001 {"priority": "high"}', { owner: 'ade @k/beef 2026-10-04 — fold', actor: 'bot' });
  assert.deepEqual(staleKeys(compute(own.ledger)), []);
});

test('stale 6: a task whose run waits at a gate is a decision, not a stale claim', async () => {
  const { ledger } = await claimed();
  const runs = [runLog('R001', 'T001', [at(33, '03:00'), ['attempt_dispatched', at(33, '03:01'), dispatch(1)], ['gate_opened', at(33, '05:00'), { attempt: 1 }]])];
  const { metrics } = compute(ledger, { runs });
  assert.deepEqual(keys(metrics.stale_claims), []);
  assert.deepEqual(metrics.stale_claims.excluded.map((entry) => entry.reason), ['run R001 is waiting on a person (a decision)']);
  assert.deepEqual(metrics.waiting_on_you.items.map((item) => [item.runId, item.taskKey, item.reason]), [['R001', 'T001', 'gate']]);
});

test('stale 7: an uncommitted trail line 1 h ago keeps the claim alive now, and is unavailable for a past asOf', async () => {
  const { ledger } = await claimed();
  const live = { readAt: ASOF, trails: { T001: `${JSON.stringify({ ts: '2026-10-05T07:00:00Z', run: 'x', kind: 'progress', what: 'live', next: 'go' })}\n{"ts": "2026-10-09T00:00:00Z", "kind": "progress"}\nnot json\n` } };
  const now = compute(ledger, { live }).metrics.stale_claims;
  assert.deepEqual(keys(now), []);
  assert.equal(now.inputs.live, true);
  const claim = now.claims[0];
  assert.equal(claim.live, true);
  assert.equal(claim.liveInput, 'read');
  assert.deepEqual(claim.lastLife, { source: 'live trail', at: '2026-10-05T07:00:00.000Z', trail: 'AA/checkpoints/T001.jsonl', ts: '2026-10-05T07:00:00Z', live: true });

  const past = compute(ledger, { live, asOf: '2026-10-04T09:12:00+01:00' }).metrics.stale_claims;
  assert.equal(past.inputs.live, false);
  assert.equal(past.liveInput, 'unavailable (past asOf)');
  assert.equal(past.claims[0].live, false);

  // Without the live trail the same claim is stale.
  assert.deepEqual(staleKeys(compute(ledger)), ['T001']);
});

test('stale 7b: on a legacy pm/ board, a live trail keeps the claim alive and is cited from pm/checkpoints', async () => {
  const { ledger } = await claimed();
  const live = { readAt: ASOF, trails: { T001: `${JSON.stringify({ ts: '2026-10-05T07:00:00Z', run: 'x', kind: 'progress', what: 'live', next: 'go' })}\n` } };
  const stale = compute(ledger, { live, project: { id: 'p1', wipLimit: 5, board: 'pm' } }).metrics.stale_claims;
  assert.deepEqual(keys(stale), []);
  assert.equal(stale.claims[0].lastLife.trail, 'pm/checkpoints/T001.jsonl');
});

test('stale 8: a run in flight with an event 1 h ago and no profile on owner: is an agent claim, not stale', async () => {
  const { ledger } = await claimed('', { owner: 'ade' });
  const runs = [runLog('R001', 'T001', [at(33, '03:00'), ['attempt_dispatched', at(34, '08:00'), dispatch(1)]])];
  const stale = compute(ledger, { runs }).metrics.stale_claims;
  assert.deepEqual(keys(stale), []);
  const claim = stale.claims[0];
  assert.deepEqual([claim.type, claim.why, claim.lastLife.source, claim.hours], ['agent', ['run R001 in flight'], 'run', 1.2]);
  // Without the run, the same owner line is a human claim.
  assert.equal(compute(ledger).metrics.stale_claims.claims[0].type, 'human');
});

// --- slips and the delta ---------------------------------------------------------------

test('slips: later is a slip with days, cleared is a slip, earlier is pulled in, the first date is neither', async () => {
  const { ledger } = await fixture(`
    day 20 09:00 ade: create T001 backlog "Dated"
    day 31 09:00 ade: set T001 {"dueDate": "2026-10-09"}
    day 31 10:00 ade: set T001 {"dueDate": "2026-10-12"}
    day 31 11:00 ade: set T001 {"dueDate": ""}
    day 31 12:00 ade: set T001 {"dueDate": "2026-10-20"}
    day 31 13:00 ade: set T001 {"dueDate": "2026-10-18"}
  `);
  const { metrics } = compute(ledger);
  assert.deepEqual(metrics.slips.items.map((item) => [item.from, item.to, item.kind, item.days]), [
    ['2026-10-09', '2026-10-12', 'later', 3], ['2026-10-12', '', 'cleared', undefined],
  ]);
  assert.deepEqual(metrics.repeat_slips.items.map((item) => [item.taskKey, item.slips]), [['T001', 2]]);
  assert.deepEqual(metrics.delta_slipped.items.map((item) => item.kind), ['later', 'cleared']);
  assert.deepEqual(metrics.delta_pulled_in.items.map((item) => [item.from, item.to, item.days]), [['2026-10-20', '2026-10-18', 2]]);
});

async function deltaFixture() {
  return fixture(`
    day 20 09:00 ade: create T001 backlog "Sweep start"
    day 20 09:01 ade: create T002 tasks "Killed"
    day 20 09:02 ade: create T003 tasks "Finishes"
    day 20 09:03 ade: create T004 tasks "Blocks"
    day 20 09:04 ade: create T005 blocked "Unblocks"
    day 20 09:05 ade: create T007 backlog "Removed"
    day 20 09:06 ade: create T008 tasks "Reopens"
    day 20 09:07 ade: create T009 tasks "Returns"
    day 21 09:00 ade: move T008 done
    day 30 09:00 ade: move T001 tasks subject="migrate: board sweep"
    day 31 10:00 ade: set T001 {"priority": "high"} label=fallback
    day 32 09:00 ade: kill T002
    day 32 10:00 ade: move T003 done label=finished
    day 32 11:00 ade: move T004 blocked
    day 32 12:00 ade: move T005 tasks
    day 33 09:00 ade: create T006 backlog "Added"
    day 33 10:00 ade: remove T007
    day 33 11:00 ade: move T008 tasks
    day 33 12:00 ade: move T009 backlog
  `);
}

const deltaRuns = () => [
  runLog('R001', 'T003', [at(31, '09:00'), ['run_completed', at(32, '10:00')]]),
  runLog('R002', 'T004', [at(31, '09:00'), ['run_failed', at(33, '08:00'), { reason: 'Implement failed' }]]),
  runLog('R003', 'T009', [at(24, '09:00'), ['run_completed', at(25, '09:00')]]),
];

test('delta since the previous working day: every list, a fallback start, dropped apart from finished, runs', async () => {
  const { ledger, fabrication } = await deltaFixture();
  const { metrics } = compute(ledger, { runs: deltaRuns() });
  const lists = Object.fromEntries(Object.values(metrics).filter((value) => value.id.startsWith('delta_')).map((value) => [value.id.slice(6), keys(value)]));
  assert.deepEqual(lists, {
    finished: ['T003'], started: ['T001', 'T008'], blocked: ['T004'], unblocked: ['T005'], added: ['T006'], removed: ['T007'],
    dropped: ['T002'], slipped: [], pulled_in: [], reopened: ['T008'], returned: ['T009'], runs_completed: ['T003'], runs_failed: ['T004'],
  });
  const started = metrics.delta_started.items[0];
  assert.deepEqual([started.source, started.commit], ['fallback', fabrication.sha('fallback')]);
  assert.match(started.label, /cycle time may be understated/);
  assert.deepEqual(metrics.delta_runs_completed.items.map((item) => item.runId), ['R001']);
  assert.equal(metrics.delta_runs_failed.items[0].reason, 'Implement failed');
  assert.deepEqual(metrics.delta_finished.window, { from: '2026-10-01T23:00:00.000Z', to: '2026-10-05T08:12:00.000Z', mode: 'time', label: 'since the start of 2026-10-02' });
});

test('delta with a head cursor counts the transitions after the cursor commit; an unknown cursor falls back to time', async () => {
  const { ledger, fabrication } = await deltaFixture();
  const since = '2026-10-01T23:00:00.000Z';
  const cursor = compute(ledger, { window: { since, sinceSha: fabrication.sha('finished') } }).metrics;
  assert.deepEqual(keys(cursor.delta_finished), [], 'the cursor commit itself was already seen');
  assert.deepEqual(keys(cursor.delta_blocked), ['T004']);
  assert.deepEqual(keys(cursor.delta_started), ['T008']);
  assert.equal(cursor.delta_blocked.window.mode, 'cursor');

  const lost = compute(ledger, { window: { since, sinceSha: 'f'.repeat(40) } }).metrics;
  assert.equal(lost.delta_finished.window.mode, 'time');
  assert.match(lost.delta_finished.window.fallback, /not in first-parent history/);
  assert.deepEqual(keys(lost.delta_finished), ['T003']);
});

// --- pipeline: waiting on you, approval latency ---------------------------------------

test('approval latency excludes weekends (Friday 17:00 → Monday 09:00 is 16 h) and items cite events', async () => {
  const { ledger } = await fixture('day 20 09:00 ade: create T001 tasks "Gated"');
  const steps = [at(26, '08:00')];
  const decisions = [[27, '09:00', 27, '10:00', 'approved'], [28, '10:00', 28, '13:00', 'rejected'], [29, '09:00', 29, '14:00', 'approved'], [30, '09:00', 30, '17:00', 'approved'], [31, '17:00', 34, '09:00', 'approved']];
  decisions.forEach(([openDay, openTime, decideDay, decideTime, decision], index) => {
    const n = index + 1;
    steps.push(['attempt_dispatched', at(openDay, '08:00'), dispatch(n)]);
    steps.push(['gate_opened', at(openDay, openTime), { attempt: n }]);
    steps.push([decision, at(decideDay, decideTime), decision === 'approved' ? { attempt: n, comment: '' } : { attempt: n, feedback: 'again', targetStage: 'plan' }]);
    steps.push(['stage_moved', at(decideDay, decideTime), { from: 0, to: 0 }]);
  });
  const run = runLog('R001', 'T001', steps);
  const { metrics } = compute(ledger, { runs: [run] });
  const p85 = metrics.approval_latency_p85;
  assert.deepEqual(p85.items.map((item) => item.value), [1, 3, 5, 8, 16]);
  assert.equal(metrics.approval_latency_p50.value, 5);
  assert.equal(p85.value, 16);
  assert.equal(p85.display, '16.0 h');
  const weekend = p85.items.at(-1);
  assert.equal(weekend.elapsedHours, 64);
  const event = run.events.find((entry) => entry.seq === weekend.seq);
  assert.deepEqual([weekend.runId, event.type, weekend.hash], ['R001', 'approved', event.hash]);
  assert.equal(weekend.from.hash, run.events.find((entry) => entry.type === 'gate_opened' && entry.data.attempt === 5).hash);
  assert.deepEqual(metrics.waiting_on_you.items, []);
});

test('waiting on you: a failed run superseded later still waits at an earlier asOf; items cite the wait event', async () => {
  const { ledger } = await fixture('day 20 09:00 ade: create T001 tasks "Retried"');
  const failed = runLog('R001', 'T001', [at(29, '09:00'), ['run_failed', at(30, '09:00'), { reason: 'boom' }]]);
  const newer = runLog('R002', 'T001', [at(33, '09:00')]);
  const before = compute(ledger, { runs: [failed, newer], asOf: '2026-10-02T09:00:00+01:00' }).metrics.waiting_on_you;
  assert.deepEqual(before.items.map((item) => [item.runId, item.reason, item.waitStart, item.value]), [['R001', 'failed', '2026-10-01T08:00:00.000Z', 24]]);
  assert.equal(before.items[0].hash, failed.events[1].hash);
  assert.equal(before.items[0].seq, 2);
  const after = compute(ledger, { runs: [failed, newer] }).metrics.waiting_on_you;
  assert.deepEqual(after.items, [], 'superseded by R002, which had started by asOf');
});

// --- health (C2, K5, R6) ----------------------------------------------------------------

// Six tasks of 10 days each, finished on Tuesday 29 September (inside the last
// 5 working days), and one young WIP item: every rule green.
function healthy({ finish = 28 } = {}) {
  return [
    [[0, '08:00', 'ade: project {"name": "Atlas", "wipLimit": 3}']],
    ...Array.from({ length: 6 }, (_value, index) => flowTask(`T00${index + 1}`, { create: 1, start: finish - 10, finish })),
    flowTask('T010', { create: 1, start: 33 }),
  ];
}

async function healthOf(extra = [], options = {}, base = healthy()) {
  const { ledger, fabrication } = await fixture(timeline(...base, extra));
  return { fabrication, result: compute(ledger, { project: { id: 'p1', wipLimit: 3 }, ...options }) };
}

test('health: every rule green with recent finishes → green', async () => {
  const { result } = await healthOf();
  const value = result.metrics.health;
  assert.deepEqual(value.rules.map((entry) => [entry.id, entry.level]), [
    ['H2', 'green'], ['H3', 'green'], ['H4', 'green'], ['H5', 'green'], ['H6', 'green'], ['H7', 'green'], ['H8', 'green'],
  ]);
  assert.deepEqual([value.level, value.label, value.value], ['green', 'Green', 'green']);
});

test('health H2: an overdue low item is amber; an overdue urgent item is red', async () => {
  const amber = (await healthOf([[30, '09:00', 'ade: create T020 backlog "Late" {"dueDate": "2026-10-01", "priority": "low"}']])).result;
  assert.deepEqual([rule(amber, 'H2').level, amber.metrics.health.level], ['amber', 'amber']);
  const red = (await healthOf([[30, '09:00', 'ade: create T020 backlog "Late" {"dueDate": "2026-10-01", "priority": "urgent"}']])).result;
  assert.deepEqual([rule(red, 'H2').level, rule(red, 'H2').message, red.metrics.health.level], ['red', '1 high or urgent item overdue', 'red']);
});

test('health H3: older than the reference is amber; older than twice the reference is red', async () => {
  const amber = (await healthOf(flowTask('T020', { create: 1, start: 22 }))).result;
  assert.deepEqual([rule(amber, 'H3').level, keys(rule(amber, 'H3'))], ['amber', ['T020']]);
  const red = (await healthOf(flowTask('T020', { create: 1, start: 10 }))).result;
  assert.deepEqual([rule(red, 'H3').level, red.metrics.health.level], ['red', 'red']);
});

test('health H4: blocked ≥ half of WIP is red; one item blocked for 2 working days is amber', async () => {
  const red = (await healthOf([[33, '10:00', 'ade: create T020 blocked "Stuck"']])).result;
  assert.deepEqual([rule(red, 'H4').level, rule(red, 'H4').message], ['red', '1 of 2 WIP items blocked']);
  const amber = (await healthOf([
    [30, '09:00', 'ade: create T020 blocked "Stuck since Thursday" {"blockedReason": "waiting on key"}'],
    [33, '10:00', 'ade: create T021 tasks "Moving"'],
  ])).result;
  assert.deepEqual([rule(amber, 'H4').level, keys(rule(amber, 'H4'))], ['amber', ['T020']]);
  const blocked = amber.metrics.blocked.items[0];
  assert.deepEqual([blocked.reason, blocked.reasonSource, blocked.workingDays], ['waiting on key', 'blockedReason', 2]);
});

test('blocked reasons: field, then checkpoint, then the Handoff, then "No reason given"', async () => {
  const { fabrication } = await healthOf([
    [30, '09:00', 'ade: create T020 blocked "From the field" {"blockedReason": "waiting on key"}'],
    [30, '09:01', 'ade: create T021 blocked "From a checkpoint"'],
    [30, '09:02', 'ade: ckpt T021 blocked "vendor API key"'],
    [30, '09:03', 'ade: create T022 blocked "From the handoff" {"next": "ask legal for sign-off"}'],
    [30, '09:04', 'ade: create T023 blocked "Boilerplate only"'],
  ]);
  const ledger = await buildLedger(fabrication.dir);
  const bodies = {};
  for (const key of ['T022', 'T023']) {
    const file = ledger.transitions.filter((transition) => transition.taskKey === key).at(-1).path;
    bodies[key] = await readFile(path.join(fabrication.dir, file), 'utf8');
  }
  const blocked = compute(ledger, { bodies }).metrics.blocked;
  assert.deepEqual(blocked.items.map((item) => [item.taskKey, item.reason, item.reasonSource]), [
    ['T020', 'waiting on key', 'blockedReason'], ['T021', 'vendor API key', 'checkpoint'],
    ['T022', 'ask legal for sign-off', 'handoff'], ['T023', 'No reason given', 'none'],
  ]);
  // A live blocked line, newer than the committed one, wins and is labelled.
  const live = { readAt: ASOF, trails: { T023: `${JSON.stringify({ ts: '2026-10-05T07:00:00Z', kind: 'blocked', what: 'waiting on review' })}\n` } };
  const withLive = compute(ledger, { bodies, live }).metrics.blocked;
  const item = withLive.items.find((entry) => entry.taskKey === 'T023');
  assert.deepEqual([item.reason, item.reasonSource, item.reasonLive, withLive.inputs.live], ['waiting on review', 'checkpoint', true, true]);
});

test('health H5: WIP and no finish in 5 working days is amber "stalled"', async () => {
  const { result } = await healthOf([], {}, healthy({ finish: 24 }));
  assert.deepEqual([rule(result, 'H5').level, rule(result, 'H5').message], ['amber', 'stalled: WIP and no finish in the last 5 working days']);
  assert.deepEqual(keys(rule(result, 'H5')), ['T010']);
});

test('health H6: a decision waiting more than 1 working day is amber', async () => {
  const runs = [runLog('R001', 'T010', [at(30, '08:00'), ['attempt_dispatched', at(30, '08:30'), dispatch(1)], ['gate_opened', at(30, '09:00'), { attempt: 1 }]])];
  const { result } = await healthOf([], { runs });
  assert.deepEqual([rule(result, 'H6').level, rule(result, 'H6').items[0].workingHours], ['amber', 48.2]);
  const fresh = (await healthOf([], { runs: [runLog('R001', 'T010', [at(34, '08:00'), ['attempt_dispatched', at(34, '08:01'), dispatch(1)], ['gate_opened', at(34, '08:30'), { attempt: 1 }]])] })).result;
  assert.equal(rule(fresh, 'H6').level, 'green');
});

test('health H7: WIP over the limit is amber', async () => {
  const { result } = await healthOf(flowTask('T020', { create: 1, start: 33 }), { project: { id: 'p1', wipLimit: 1 } });
  assert.deepEqual([rule(result, 'H7').level, rule(result, 'H7').message], ['amber', 'WIP 2 over the limit of 1']);
  assert.equal(result.metrics.wip.display, '2 of 1');
});

test('health H8: a stale agent claim is amber', async () => {
  const { result } = await healthOf([[33, '03:00', `ade: create T020 tasks "Agent work" {"owner": "${CLAIM}"}`]]);
  assert.deepEqual([rule(result, 'H8').level, keys(rule(result, 'H8'))], ['amber', ['T020']]);
});

// Two recent finishes, so H3 cannot be evaluated while everything else is green.
function thin() {
  return [
    [[0, '08:00', 'ade: project {"name": "Thin"}']],
    flowTask('T001', { create: 1, start: 18, finish: 28 }),
    flowTask('T002', { create: 1, start: 18, finish: 28 }),
    flowTask('T010', { create: 1, start: 33 }),
  ];
}

test('health: H2 and H4 green with H3 unknown → grey "Not enough history"; amber with H3 unknown → amber', async () => {
  const grey = (await healthOf([], {}, thin())).result.metrics.health;
  assert.deepEqual([grey.level, grey.label, grey.because], ['grey', 'Not enough history', ['H3']]);
  assert.equal(grey.rules.find((entry) => entry.id === 'H3').message, 'not enough history (2 of 5 finished items)');
  const amber = (await healthOf([[30, '09:00', 'ade: create T020 backlog "Late" {"dueDate": "2026-10-01", "priority": "low"}']], {}, thin())).result.metrics.health;
  assert.deepEqual([amber.level, amber.rules.find((entry) => entry.id === 'H3').level], ['amber', 'unknown']);
});

test('health: a new project with 2 WIP and no finishes → grey', async () => {
  const { result } = await healthOf([], {}, [
    [[33, '08:00', 'ade: project {"name": "New"}']],
    [[33, '09:00', 'ade: create T001 tasks "One"'], [33, '09:01', 'ade: create T002 tasks "Two"']],
  ]);
  const value = result.metrics.health;
  assert.deepEqual([value.level, value.label, value.because], ['grey', 'Not enough history', ['H3', 'H5']]);
});

test('health: a backlog of 4, no WIP, and no start or finish for 6 working days → H5 amber "idle with open work"', async () => {
  const { result } = await healthOf([], {}, [
    [[0, '08:00', 'ade: project {"name": "Quiet"}']],
    [1, 2, 3, 4].map((n) => [25, '09:00', `ade: create T00${n} backlog "Queued ${n}"`]),
  ]);
  assert.deepEqual([rule(result, 'H5').level, rule(result, 'H5').message], ['amber', 'idle with open work: no start and no finish in the last 5 working days']);
  assert.equal(rule(result, 'H5').items.length, 4);
  assert.equal(result.metrics.health.level, 'amber');
});

test('health: no WIP, no backlog, and no finish in 90 days → grey "Idle"; never had tasks → "No work"', async () => {
  const idle = (await healthOf([], {}, [
    [[-120, '08:00', 'ade: project {"name": "Old"}']],
    flowTask('T001', { create: -110, start: -105, finish: -100 }),
  ])).result.metrics.health;
  assert.deepEqual([idle.level, idle.label], ['grey', 'Idle']);
  const empty = (await healthOf([], {}, [[[0, '08:00', 'ade: project {"name": "Empty"}']]])).result.metrics.health;
  assert.deepEqual([empty.level, empty.label], ['grey', 'No work']);
});

// --- contracts ------------------------------------------------------------------------

test('every metric id in METRIC_DEFINITIONS is produced, and slim keys are exact', async () => {
  const { result } = await healthOf();
  assert.deepEqual(Object.keys(result.metrics).sort(), Object.keys(METRIC_DEFINITIONS).filter((id) => id !== 'due_risk').sort());
  for (const value of Object.values(result.metrics)) {
    assert.deepEqual(Object.keys(slim(value)), ['id', 'kind', 'value', 'display', 'status', 'reason', 'sample']);
    assert.equal(value.kind, METRIC_DEFINITIONS[value.id].kind);
  }
  assert.throws(() => projectMetrics({ ledger: computed[0].ledger, settings: SETTINGS }), /asOf is required/);
});

test('invariants (§3.2) hold for every MetricValue in every fixture', () => {
  assert.ok(computed.length >= 40, `${computed.length} results`);
  let checked = 0;
  for (const { ledger, result } of computed) {
    const commits = new Set(ledger.commits.map((commit) => commit.sha));
    for (const value of [...Object.values(result.metrics), ...Object.values(result.dueRisk)]) {
      assert.deepEqual(checkInvariant(value, { commits }), []);
      assert.equal(value.params.timezone, 'Europe/London');
      assert.deepEqual(value.params.workdays, [1, 2, 3, 4, 5]);
      assert.deepEqual(value.build, { headSha: ledger.headSha, ledgerSha: ledger.ledgerSha });
      assert.equal(typeof value.ledgerHeadAtAsOf, 'string');
      checked += 1;
    }
  }
  assert.ok(checked > 1000, `${checked} values checked`);
});

test('the invariant checker catches a broken value', () => {
  const [{ result }] = computed;
  const broken = { ...result.metrics.wip, value: result.metrics.wip.value + 1 };
  assert.match(checkInvariant(broken).join('\n'), /value \d+ with \d+ items/);
  const uncited = { ...result.metrics.wip, items: [{ taskKey: 'T999' }], value: 1 };
  assert.match(checkInvariant(uncited).join('\n'), /cites no commit or event/);
  const health = { ...result.metrics.health, level: 'green', value: 'green' };
  const expected = combine(health.rules, health.context).level;
  if (expected !== 'green') assert.match(checkInvariant(health).join('\n'), /combine gives/);
});

test('docs/METRICS.md has a section for each metric id', async () => {
  const docs = await readFile(new URL('../docs/METRICS.md', import.meta.url), 'utf8');
  const headings = docs.split('\n').filter((line) => /^#{2,4} /.test(line));
  for (const id of Object.keys(METRIC_DEFINITIONS)) {
    assert.ok(headings.some((line) => line.includes(`\`${id}\``)), `no section for ${id}`);
  }
  assert.match(docs, /## Differences from board\.sh/);
});

test('lib/metrics.mjs never reads the clock', async () => {
  const source = await readFile(new URL('../lib/metrics.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /Date\.now\(/);
  assert.doesNotMatch(source, /new Date\(\s*\)/);
});

test('the forecast: exact on a steady history, reproducible, ordered, and silent without history or open work (T032)', async () => {
  const { forecast } = await import('../lib/metrics.mjs');
  // One finish every day: 5 open tasks take exactly 5 days, at every percentile.
  const steady = forecast({ history: Array(41).fill(1), open: 5, today: '2026-10-08' });
  assert.deepEqual([steady.when.p50, steady.when.p85, steady.when.p95], [{ days: 5, date: '2026-10-13' }, { days: 5, date: '2026-10-13' }, { days: 5, date: '2026-10-13' }]);
  assert.deepEqual([steady.ahead.p50, steady.ahead.p85, steady.ahead.p95, steady.ahead.date], [14, 14, 14, '2026-10-22']);
  // A lumpy history: the same inputs give the same numbers; later percentiles are later.
  const history = [0, 0, 3, 0, 1, 0, 0, 2, 0, 0, 0, 1, 4, 0, 0, 1, 0, 0, 2, 0, 0];
  const one = forecast({ history, open: 12, today: '2026-10-08', seed: 'x' });
  assert.deepEqual(forecast({ history, open: 12, today: '2026-10-08', seed: 'x' }), one);
  assert.ok(one.when.p50.days <= one.when.p85.days && one.when.p85.days <= one.when.p95.days);
  assert.ok(one.ahead.p95 <= one.ahead.p85 && one.ahead.p85 <= one.ahead.p50, '85% likely at least fewer than the median');
  assert.equal(one.histogram.reduce((sum, bar) => sum + bar.n, 0) + one.when.beyondHorizon, one.basis.trials);
  assert.equal(forecast({ history: Array(41).fill(0), open: 3, today: '2026-10-08' }).status, 'no-history');
  assert.equal(forecast({ history, open: 0, today: '2026-10-08' }).status, 'nothing-open');
  // Past the horizon is not a date.
  // Five finishes in 41 days cannot clear 200 tasks within a year.
  const slow = forecast({ history: [1, 1, 1, 1, 1, ...Array(36).fill(0)], open: 200, today: '2026-10-08' });
  assert.equal(slow.status, 'ok');
  assert.equal(slow.when.p95.days, null);
});
