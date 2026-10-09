import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';

import { Cockpit } from '../lib/brief.mjs';
import { buildLedger } from '../lib/history.mjs';
import { parseTaskMarkdown, Workspace } from '../lib/workspace.mjs';

const exec = promisify(execFile);
process.env.GIT_CONFIG_GLOBAL = os.devNull;
process.env.GIT_CONFIG_NOSYSTEM = '1';

const NOW = Date.parse('2026-10-05T09:12:00+01:00');

async function sample(t, now = NOW) {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), 'agesight-sample-'));
  t.after(() => rm(dataDir, { recursive: true, force: true }));
  const workspace = await new Workspace({ dataDir, operator: 'ade', email: 'ade@example.invalid' }).init();
  await writeFile(path.join(dataDir, 'settings.json'), '{"timezone": "Europe/London"}');
  const project = await workspace.createSampleProject({ now });
  return { workspace, project, dir: workspace._projectDir(project.id) };
}

test('the sample project is a fixed, simulated history with every kind of item Today raises', async (t) => {
  const { workspace, project, dir } = await sample(t);
  assert.equal(project.sample, true);
  assert.match(project.description, /^Sample project — its history is simulated/);
  const cockpit = new Cockpit({ workspace, engine: null, clock: () => NOW });
  t.after(() => cockpit.close());
  const brief = await cockpit.brief({ window: 'previous-workday' });
  const [line] = brief.projects;
  assert.deepEqual([line.name, line.sample, line.state], ['Sample: Atlas launch', true, 'ready']);
  assert.equal(line.health.level, 'red');
  assert.deepEqual(line.health.rules.filter((rule) => rule.level !== 'green' && rule.level !== 'na').map((rule) => rule.id), ['H2', 'H3', 'H8']);
  // Every kind of Needs you item except a decision, which needs a pipeline run.
  assert.deepEqual(brief.needsYou.map((row) => [row.kind, row.taskKey]), [
    ['overdue', 'T040'], ['stale', 'T035'], ['due_risk', 'T039'], ['aging', 'T036'], ['blocked', 'T029'], ['blocked', 'T030'], ['unassigned', 'T037'],
  ]);
  const blocked = brief.needsYou.filter((row) => row.kind === 'blocked').map((row) => row.reasonSource);
  assert.deepEqual(blocked, ['blockedReason', 'checkpoint'], 'one blocked reason comes only from a checkpoint');
  assert.ok(brief.needsYou.find((row) => row.kind === 'due_risk').probability < 0.5);

  const ledger = await buildLedger(dir);
  const tasks = Object.values(ledger.tasks);
  assert.equal(tasks.length, 43);
  assert.equal(tasks.filter((task) => task.status === 'done').length, 28);
  assert.equal(tasks.filter((task) => task.status === 'dropped').length, 1);
  assert.deepEqual(ledger.anomalies, []);
  assert.equal(ledger.transitions.filter((transition) => transition.kind === 'status' && transition.from === 'done' && transition.to === 'in_progress').length, 2, 'two reopens');
  const dueChanges = ledger.transitions.filter((transition) => transition.kind === 'field' && transition.field === 'dueDate' && transition.from);
  assert.deepEqual(dueChanges.map((transition) => (transition.to ? 'later' : 'cleared')).sort(), ['cleared', 'later', 'later']);
  const merge = (await exec('git', ['-C', dir, 'log', '--merges', '--format=%an %s'])).stdout.trim();
  assert.match(merge, /^ade Merge/, 'an agent claim made on a branch is merged by a person');
  const metrics = await cockpit.projectMetrics(project.id, {});
  assert.deepEqual(metrics.tables.unassigned.map((item) => item.taskKey), ['T037']);
  assert.ok(metrics.tables.agents.length >= 3);
});

test('every sample commit is dated at or before now, and each task\'s createdAt is its first commit, to the minute', async (t) => {
  const { dir } = await sample(t);
  const log = (await exec('git', ['-C', dir, 'log', '--format=%cI %aI'])).stdout.trim().split('\n');
  assert.ok(log.length > 100);
  for (const line of log) for (const time of line.split(' ')) assert.ok(Date.parse(time) <= NOW, `${time} is after now`);
  const files = (await exec('git', ['-C', dir, 'ls-files', 'AA/backlog', 'AA/tasks'])).stdout.trim().split('\n').filter((file) => /\/T\d{3}-/.test(file));
  assert.equal(files.length, 43);
  const firstCommitOf = new Map();
  const added = (await exec('git', ['-C', dir, 'log', '--reverse', '--diff-filter=A', '--name-only', '--format=@%cI', '--', 'AA'])).stdout.split('\n');
  let current = '';
  for (const entry of added) {
    if (entry.startsWith('@')) current = entry.slice(1);
    const id = /\/(T\d{3})-/.exec(entry)?.[1];
    if (id && !firstCommitOf.has(id)) firstCommitOf.set(id, current);
  }
  for (const file of files) {
    const { fields } = parseTaskMarkdown(await readFile(path.join(dir, file), 'utf8'));
    const id = String(fields.id);
    assert.equal(new Date(fields.createdAt).toISOString().slice(0, 16), new Date(firstCommitOf.get(id)).toISOString().slice(0, 16), `${id} createdAt`);
  }
});

test('the sample is the same history for the same now', async (t) => {
  const first = await sample(t);
  const second = await sample(t);
  const subjects = async (dir) => (await exec('git', ['-C', dir, 'log', '--format=%cI %s'])).stdout;
  assert.equal(await subjects(first.dir), await subjects(second.dir));
});

test('the Flow charts draw what the metrics count: every WIP task by age and level, every finished cycle, and the percentile lines (T030, T031)', async (t) => {
  const { workspace, project } = await sample(t);
  const cockpit = new Cockpit({ workspace, engine: { eventsByProject: () => new Map() }, clock: () => NOW });
  const data = await cockpit.projectMetrics(project.id, {});
  const { aging, cycles } = data.charts;
  const p50 = await cockpit.explain('cycle_time_p50', { projectId: project.id });
  const p85 = await cockpit.explain('cycle_time_p85', { projectId: project.id });
  const agingMetric = await cockpit.explain('aging', { projectId: project.id });

  // Aging WIP: one dot per task in progress or blocked with a start.
  assert.equal(aging.items.length + aging.unstarted, data.metrics.wip.value);
  assert.ok(aging.items.every((item) => ['in_progress', 'blocked'].includes(item.status)));
  assert.deepEqual(aging.items.filter((item) => item.level !== 'ok' && item.level !== 'unknown').map((item) => item.taskKey).sort(), agingMetric.items.map((item) => item.taskKey).sort(), 'its levels agree with the aging metric');
  assert.deepEqual(aging.items.filter((item) => item.stale).map((item) => item.taskKey), data.tables.stale.map((item) => item.taskKey));
  assert.ok(aging.bands.p50 <= aging.bands.p70 && aging.bands.p70 <= aging.bands.p85 && aging.bands.p85 <= aging.bands.p95);

  // Cycle times: the dots are the metric's items, and its lines its values.
  assert.deepEqual(cycles.items.map((item) => item.taskKey).sort(), p85.items.map((item) => item.taskKey).sort());
  assert.equal(cycles.bands.p50, Math.round(p50.value * 10) / 10);
  assert.equal(cycles.bands.p85, Math.round(p85.value * 10) / 10);
  assert.equal(cycles.excluded, p85.excluded.length);
});
