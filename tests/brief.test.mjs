import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { buildEvent } from '../lib/audit.mjs';
import { arrangeNeeds, Cockpit } from '../lib/brief.mjs';
import { fabricate } from '../lib/fabricate.mjs';
import { Workspace } from '../lib/workspace.mjs';

// The library spawns git itself; keep it independent of the developer's config.
process.env.GIT_CONFIG_GLOBAL = os.devNull;
process.env.GIT_CONFIG_NOSYSTEM = '1';

// asOf Monday 2026-10-05 09:12 Europe/London; the fabricator's `day 34 09:12`.
const ASOF = '2026-10-05T09:12:00+01:00';
const SETTINGS = '{"timezone": "Europe/London", "workdays": [1, 2, 3, 4, 5]}';
const directories = new Set();
const briefs = [];

test.after(async () => {
  await Promise.all([...directories].map((directory) => rm(directory, { recursive: true, force: true })));
});

function at(day, time = '09:00') {
  const [hours, minutes] = time.split(':').map(Number);
  return new Date(Date.UTC(2026, 8, 1 + day, hours - 1, minutes)).toISOString();
}

// A workspace whose projects are fabricated histories; every commit is the
// workspace operator's, as in a real AgeAris project.
async function workspaceWith(projects, { runs = {} } = {}) {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), 'agesight-brief-'));
  directories.add(dataDir);
  const workspace = await new Workspace({ dataDir, operator: 'ade', email: 'ade@example.invalid' }).init();
  await import('node:fs/promises').then(({ writeFile }) => writeFile(path.join(dataDir, 'settings.json'), SETTINGS));
  const ids = [];
  const fabrications = [];
  for (const [index, { name, script, wipLimit = 5, startDay = 0 }] of projects.entries()) {
    const id = `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`;
    const header = `day ${startDay} 08:00 ade: project {"id": "${id}", "name": "${name}", "createdAt": "${at(startDay, '08:00')}", "wipLimit": ${wipLimit}}`;
    fabrications.push(await fabricate(path.join(dataDir, 'projects', id), `${header}\n${script}`));
    ids.push(id);
  }
  const engine = { eventsByProject: () => new Map(ids.map((id, index) => [id, runs[index] || []])) };
  const cockpit = new Cockpit({ workspace, engine, clock: () => Date.parse(ASOF) });
  return { cockpit, ids, fabrications, workspace };
}

async function brief(cockpit, query = {}) {
  const result = await cockpit.brief({ asOf: ASOF, ...query });
  briefs.push(result);
  return result;
}

// A run waiting at a gate, as eventsByProject() hands it out.
function gateRun(projectId, localId, taskId, openedAt) {
  const events = [];
  let previous = null;
  const push = (type, when, data, actor = { type: 'system', id: 'agesight' }) => {
    previous = buildEvent(previous, { type, actor, data, at: when });
    events.push(previous);
  };
  push('run_started', at(30, '09:00'), { runId: localId, taskId: `${projectId}:${taskId}`, taskTitle: taskId, pipeline: [{ id: 'plan', name: 'Plan', role: 'plan', tier: 'opus', executor: 'agent', gate: 'approve', verdict: false, maxAttempts: 1, onFail: 'retry', instructions: '' }] }, { type: 'human', id: 'ade' });
  push('attempt_dispatched', at(30, '09:01'), { attempt: 1, stageId: 'plan', stageIndex: 0, role: 'plan', gate: 'approve', agentId: 'claude-opus', runner: 'command' });
  push('attempt_finished', openedAt, { attempt: 1, outcome: 'succeeded', durationMs: 1000 });
  push('gate_opened', openedAt, { attempt: 1, stageId: 'plan' });
  return { id: `${projectId}:${localId}`, localId, taskId: `${projectId}:${taskId}`, integrity: { ok: true }, events };
}

// Five items finished in a day each, so the aging and risk references exist.
const QUICK_FINISHES = [1, 2, 3, 4, 5].map((n) => [
  `day ${n} 09:00 ade: create T10${n} backlog "Quick ${n}"`,
  `day ${n} 10:00 ade: move T10${n} tasks`,
  `day ${n + 1} 10:00 ade: move T10${n} done`,
].join('\n')).join('\n');

test('arrangeNeeds orders decisions, overdue (urgent first), stale, due risk, aging, blocked, unassigned', () => {
  const row = (kind, taskKey, fields = {}) => ({ kind, projectId: 'p', taskKey, title: taskKey, waitStart: at(30), ...fields });
  const rows = [
    row('unassigned', 'T7', { priority: 'urgent' }),
    row('blocked', 'T6'),
    row('aging', 'T5', { ageDays: 4 }),
    row('due_risk', 'T4', { probability: 0.2, dueDate: '2026-10-07' }),
    row('stale', 'T3', { hours: 30 }),
    row('overdue', 'T2b', { priority: 'low', daysOverdue: 9 }),
    row('overdue', 'T2a', { priority: 'urgent', daysOverdue: 1 }),
    row('decision', '', { localRunId: 'R001', waitStart: at(31) }),
    row('decision', 'T1', { localRunId: 'R002', waitStart: at(30) }),
  ];
  assert.deepEqual(arrangeNeeds(rows).map((entry) => entry.taskKey || entry.localRunId), ['T1', 'R001', 'T2a', 'T2b', 'T3', 'T4', 'T5', 'T6', 'T7']);
});

test('arrangeNeeds shows an item once, under its first reason, with the others as tags; a run and its task are one item', () => {
  const rows = [
    { kind: 'aging', projectId: 'p', taskKey: 'T001', ageDays: 9 },
    { kind: 'overdue', projectId: 'p', taskKey: 'T001', priority: 'high', daysOverdue: 2 },
    { kind: 'blocked', projectId: 'p', taskKey: 'T001', waitStart: at(30) },
    { kind: 'decision', projectId: 'p', taskKey: 'T002', localRunId: 'R001', waitStart: at(30) },
    { kind: 'unassigned', projectId: 'p', taskKey: 'T002', priority: 'urgent' },
    { kind: 'overdue', projectId: 'q', taskKey: 'T001', priority: 'low', daysOverdue: 1 },
  ];
  const arranged = arrangeNeeds(rows);
  assert.deepEqual(arranged.map((entry) => [entry.projectId, entry.taskKey, entry.kind, entry.reasons]), [
    ['p', 'T002', 'decision', ['decision', 'unassigned']],
    ['p', 'T001', 'overdue', ['overdue', 'aging', 'blocked']],
    ['q', 'T001', 'overdue', ['overdue']],
  ]);
});

test('the brief: a task overdue and aging appears once, after a waiting decision, with overdue primary', async () => {
  const projects = [{
    name: 'Atlas',
    script: [
      QUICK_FINISHES,
      'day 1 09:00 ade: create T001 backlog "Late and old" {"dueDate": "2026-10-01", "priority": "high"}',
      'day 2 09:00 ade: move T001 tasks {"owner": "ade @k/e857a8c8 2026-09-03 — late"}',
      'day 29 09:00 ade: create T002 backlog "Plan me"',
      'day 30 09:00 ade: move T002 tasks run=R001',
      'day 33 08:00 ade: ckpt T001 did "still on it" ts="day 34 08:00"',
    ].join('\n'),
  }];
  const { cockpit, ids } = await workspaceWith(projects, { runs: { 0: [gateRun('00000000-0000-4000-8000-000000000001', 'R001', 'T002', at(31, '17:00'))] } });
  const result = await brief(cockpit);
  assert.deepEqual(result.needsYou.map((row) => [row.kind, row.taskKey, row.reasons]), [
    ['decision', 'T002', ['decision', 'aging']],
    ['overdue', 'T001', ['overdue', 'aging']],
  ]);
  const [decision, overdue] = result.needsYou;
  assert.equal(decision.runId, `${ids[0]}:R001`);
  assert.equal(decision.waitStart, at(31, '17:00'));
  assert.equal(overdue.severity, 'red');
  assert.equal(overdue.owner, 'agent ade @k/e857a8c8');
  assert.equal(result.decisions.waiting.value, 1);
  assert.equal(result.decisions.oldestWait, at(31, '17:00'));
  const [line] = result.projects;
  assert.equal(line.state, 'ready');
  assert.match(line.build.ledgerSha, /^[0-9a-f]{40}$/);
  assert.equal(line.health.level, 'red');
  assert.match(line.sentence, /^1 high or urgent item overdue, 2 items aging, 1 decision waiting\. Done \d+ in the last 7 days \(weekly mean [\d.]+\)\. WIP 2 of 5\.$/);
});

test('fast-forwarded commits dated before the window: last-visit mode shows them, a time window counts them as late', async () => {
  const projects = [{
    name: 'Beacon',
    script: [
      'day 0 09:00 ade: create T001 backlog "Base"',
      'day 30 09:00 ade: create T002 backlog "Head" label=head',
      'branch side',
      'day 29 10:00 ade: move T002 tasks',
      'day 29 11:00 ade: move T002 done',
      'checkout main',
      'ff side',
    ].join('\n'),
  }];
  const { cockpit, ids, fabrications } = await workspaceWith(projects);
  const head = fabrications[0].sha('head');
  const visit = await brief(cockpit, { window: 'last-visit', since: at(33, '12:00'), sinceHeads: `${ids[0]}:${head}` });
  assert.deepEqual(visit.delta.finished.map((item) => item.taskKey), ['T002']);
  assert.equal(visit.window.mode, 'last-visit');
  assert.equal(visit.window.lateLanding, undefined);
  assert.deepEqual(visit.window.fallbacks, []);

  const workday = await brief(cockpit, { window: 'previous-workday' });
  assert.deepEqual(workday.delta.finished, []);
  assert.deepEqual(workday.window.lateLanding, { n: 2 });
  assert.equal(workday.window.from, '2026-10-01T23:00:00.000Z', 'the start of Friday 2 October in London');
});

test('a cursor commit that is no longer in history falls back to time and says so; a missing cursor uses the fallback window', async () => {
  const { cockpit, ids } = await workspaceWith([{ name: 'Cobalt', script: 'day 33 10:00 ade: create T001 backlog "New"' }]);
  const rewritten = await brief(cockpit, { window: 'last-visit', since: at(33, '09:00'), sinceHeads: `${ids[0]}:${'a'.repeat(40)}` });
  assert.deepEqual(rewritten.window.fallbacks.map((entry) => entry.projectId), [ids[0]]);
  assert.match(rewritten.window.fallbacks[0].reason, /not in first-parent history/);
  assert.deepEqual(rewritten.delta.added.map((item) => item.taskKey), ['T001']);

  const first = await brief(cockpit, {});
  assert.equal(first.window.mode, 'previous-workday');
  assert.deepEqual(first.window.fallbacks, [{ projectId: '', reason: 'no last visit recorded in this browser' }]);

  const old = await brief(cockpit, { window: 'last-visit', since: at(1) });
  assert.equal(old.window.clamped, true);
  assert.equal(old.window.from, new Date(Date.parse(ASOF) - 14 * 24 * 3600 * 1000).toISOString());
});

test('the brief validates its window and cursor parameters', async () => {
  const { cockpit } = await workspaceWith([]);
  await assert.rejects(cockpit.brief({ window: 'fortnight' }), { status: 400 });
  await assert.rejects(cockpit.brief({ since: 'yesterday', window: 'last-visit' }), { status: 400 });
  await assert.rejects(cockpit.brief({ sinceHeads: 'nope:abc' }), { status: 400 });
  await assert.rejects(cockpit.brief({ asOf: '2026-10-05T09:12:00' }), { status: 400 }, 'an asOf without an offset is refused');
  await assert.rejects(cockpit.brief({ asOf: '2026-10-06T09:12:00+01:00' }), { status: 400 }, 'a future asOf is refused');
  const empty = await cockpit.brief({ asOf: ASOF });
  assert.deepEqual([empty.projects, empty.needsYou], [[], []]);
});

test('an idle project and a new one read grey in plain words; unassigned urgent work comes last in Needs you', async () => {
  const { cockpit } = await workspaceWith([
    { name: 'Dune', startDay: -100, script: 'day -99 09:00 ade: create T001 backlog "Once"\nday -99 10:00 ade: move T001 tasks\nday -98 09:00 ade: move T001 done' },
    { name: 'Echo', startDay: 32, script: 'day 32 09:00 ade: create T001 tasks "Fresh" {"priority": "urgent", "owner": "ade @agesight/web 2026-10-03 — working on Fresh"}' },
  ]);
  const result = await brief(cockpit);
  const [dune, echo] = result.projects;
  assert.deepEqual([dune.health.label, dune.sentence], ['Idle', 'Idle: no open work, nothing finished in 90 days.']);
  assert.equal(echo.health.label, 'Not enough history');
  assert.match(echo.sentence, /^Not enough history: /);
  assert.deepEqual(result.needsYou.map((row) => [row.kind, row.projectName, row.owner]), [['unassigned', 'Echo', 'Unassigned']]);
});

test('the brief\'s only percentiles are cycle time and its service level, and no sentence names a percentile', () => {
  assert.ok(briefs.length >= 5);
  for (const result of briefs) {
    for (const line of result.projects.filter((entry) => entry.kpis)) {
      for (const [name, kpi] of Object.entries(line.kpis)) {
        if (name === 'wipLimit') continue;
        if (name === 'cycle50' || name === 'cycle85') assert.equal(kpi.kind, 'percentile', `${line.name} ${name}`);
        else assert.notEqual(kpi.kind, 'percentile', `${line.name} ${name}`);
        assert.deepEqual(Object.keys(kpi).sort(), ['display', 'id', 'kind', 'reason', 'sample', 'status', 'value']);
      }
    }
    const text = JSON.stringify([result.projects.map((line) => line.sentence), result.needsYou]);
    assert.doesNotMatch(text, /\bP50\b|\bP85\b|percentile/i);
  }
});
