import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { monitorEventLoopDelay, performance } from 'node:perf_hooks';
import test from 'node:test';

import { buildEvent } from '../../lib/audit.mjs';
import { Cockpit } from '../../lib/brief.mjs';
import { fabricate } from '../../lib/fabricate.mjs';
import { Workspace } from '../../lib/workspace.mjs';

// The perf budgets of plan §8 S4, on 10 projects, 500 tasks, about 5,000
// commits, and 50 runs. Run with `npm run perf`; the default run allows 3× each
// budget, AGESIGHT_PERF_STRICT=1 holds the exact budgets. (The 3 dated
// milestones per project arrive with milestones in Cut 2.)

process.env.GIT_CONFIG_GLOBAL = os.devNull;
process.env.GIT_CONFIG_NOSYSTEM = '1';

const STRICT = process.env.AGESIGHT_PERF_STRICT === '1';
const SLACK = STRICT ? 1 : 3;
const PROJECTS = 10;
const TASKS = 50;
const RUNS = 5;
const ASOF = Date.parse('2026-10-05T09:12:00+01:00');

function within(label, measured, budget) {
  console.log(`# ${label}: ${measured.toFixed(1)} ms (budget ${budget} ms${STRICT ? ', strict' : `, ×${SLACK} allowed`})`);
  assert.ok(measured <= budget * SLACK, `${label} took ${measured.toFixed(1)} ms, over ${budget * SLACK} ms`);
}

async function timed(operation) {
  const started = performance.now();
  const value = await operation();
  return { value, ms: performance.now() - started };
}

// About 500 commits for one project: 50 tasks created, claimed, checkpointed,
// edited, and mostly finished over six weeks.
function projectScript(id, name) {
  const lines = [`day 0 08:00 ade: project {"id": "${id}", "name": "${name}", "createdAt": "2026-09-01T07:00:00.000Z", "wipLimit": 8}`];
  for (let n = 1; n <= TASKS; n += 1) {
    const task = `T${String(n).padStart(3, '0')}`;
    const day = Math.floor((n - 1) * 0.6);
    const time = (minute) => `${String(9 + Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
    const base = (n % 7) * 3;
    lines.push(`day ${day} ${time(base)} ade: create ${task} backlog "Task ${n}" {"type": "${n % 3 ? 'feature' : 'bug'}", "dueDate": "2026-10-${String(1 + (n % 20)).padStart(2, '0')}"}`);
    lines.push(`day ${day + 1} ${time(base)} ade: move ${task} tasks {"owner": "ade @k/s${n} 2026-09-02 — ${task}"}`);
    for (let step = 0; step < 4; step += 1) lines.push(`day ${day + 1} ${time(base + 1 + step)} ade: ckpt ${task} did "step ${step}" ts="day ${day + 1} ${time(base + 1 + step)}"`);
    lines.push(`day ${day + 2} ${time(base)} ade: set ${task} {"priority": "high"} via=ui`);
    lines.push(`day ${day + 2} ${time(base + 1)} ade: set ${task} {"dueDate": "2026-10-${String(5 + (n % 20)).padStart(2, '0')}"} via=ui`);
    if (n % 5) lines.push(`day ${day + 3 + (n % 4)} ${time(base)} ade: move ${task} done`);
    else lines.push(`day ${day + 3} ${time(base)} ade: move ${task} blocked {"blockedReason": "waiting on review"}`);
  }
  return lines.sort((a, b) => {
    const key = (line) => { const [, day, clock] = /^day (\d+) (\d\d:\d\d)/.exec(line); return Number(day) * 10000 + Number(clock.replace(':', '')); };
    return key(a) - key(b);
  }).join('\n');
}

function runLog(projectId, localId, taskId, startMs) {
  const events = [];
  let previous = null;
  const push = (type, ms, data) => {
    previous = buildEvent(previous, { type, actor: { type: 'system', id: 'agesight' }, data, at: new Date(ms).toISOString() });
    events.push(previous);
  };
  push('run_started', startMs, { runId: localId, taskId: `${projectId}:${taskId}`, taskTitle: taskId, pipeline: [{ id: 'plan', name: 'Plan', role: 'plan', tier: 'opus', executor: 'agent', gate: 'approve', verdict: false, maxAttempts: 1, onFail: 'retry', instructions: '' }] });
  push('attempt_dispatched', startMs + 1000, { attempt: 1, stageId: 'plan', stageIndex: 0, role: 'plan', gate: 'approve', agentId: 'claude-opus', runner: 'command' });
  push('attempt_finished', startMs + 60000, { attempt: 1, outcome: 'succeeded', durationMs: 59000 });
  push('gate_opened', startMs + 60000, { attempt: 1, stageId: 'plan' });
  return { id: `${projectId}:${localId}`, localId, taskId: `${projectId}:${taskId}`, integrity: { ok: true }, events };
}

test('brief, project metrics, and ledger rebuilds stay within their budgets', { timeout: 600000 }, async (t) => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), 'agesight-perf-'));
  t.after(() => rm(dataDir, { recursive: true, force: true }));
  const workspace = await new Workspace({ dataDir, operator: 'ade', email: 'ade@example.invalid' }).init();
  await writeFile(path.join(dataDir, 'settings.json'), '{"timezone": "Europe/London", "workdays": [1, 2, 3, 4, 5]}');
  const ids = [];
  const runs = new Map();
  for (let index = 0; index < PROJECTS; index += 1) {
    const id = `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`;
    await fabricate(path.join(dataDir, 'projects', id), projectScript(id, `Project ${index + 1}`));
    ids.push(id);
    runs.set(id, Array.from({ length: RUNS }, (_, n) => runLog(id, `R00${n + 1}`, `T00${n + 5}`, ASOF - (n + 2) * 3600 * 1000)));
  }
  const spawned = [];
  const counting = (command, args, options) => {
    spawned.push(args[args.indexOf('-C') + 2]);
    return spawn(command, args, options);
  };
  const engine = { eventsByProject: () => runs };
  const cockpit = new Cockpit({ workspace, engine, clock: () => ASOF, ledgerOptions: { spawn: counting }, buildWaitMs: 60000 });
  t.after(() => cockpit.close());

  // Cold ledger builds, with the event loop watched.
  const delay = monitorEventLoopDelay({ resolution: 10 });
  delay.enable();
  const cold = await timed(() => Promise.all(ids.map((id) => cockpit.ledgers.get(id))));
  delay.disable();
  const commits = cold.value.reduce((sum, ledger) => sum + ledger.commits.length, 0);
  console.log(`# fixture: ${PROJECTS} projects, ${commits} commits, ${PROJECTS * TASKS} tasks, ${PROJECTS * RUNS} runs`);
  assert.ok(commits >= 4500, `about 5,000 commits (got ${commits})`);
  within('cold ledger builds, all projects', cold.ms, 3000);
  within('max event-loop delay during the cold build', delay.max / 1e6, 100);

  // The first brief over warm ledgers computes every project's metrics.
  const query = { asOf: new Date(ASOF).toISOString(), window: 'previous-workday' };
  const first = await timed(() => cockpit.brief(query));
  assert.equal(first.value.projects.length, PROJECTS);
  assert.ok(first.value.projects.every((line) => line.state === 'ready'));
  within('cold brief memo over warm ledgers', first.ms, 300);

  // A warm brief runs no git at all.
  spawned.length = 0;
  const warm = await timed(() => cockpit.brief(query));
  assert.deepEqual(spawned, [], 'a warm brief spawns no git process');
  within('warm brief', warm.ms, 20);

  const metrics = await timed(() => cockpit.projectMetrics(ids[0], { asOf: query.asOf }));
  assert.equal(metrics.value.state, 'ready');
  within('project metrics', metrics.ms, 150);

  // One task commit invalidates its project; the rebuild is a full one.
  const task = await workspace.getTask(`${ids[0]}:T050`);
  await workspace.updateTask(task.id, { priority: 'low', version: task.version });
  spawned.length = 0;
  const rebuild = await timed(() => cockpit.ledgers.get(ids[0]));
  assert.ok(spawned.includes('log'), 'the task commit rebuilt the ledger');
  within('full rebuild of one project after a task commit', rebuild.ms, 500);

  // A pipeline-only commit resolves the heads and rebuilds nothing.
  const dir = workspace._projectDir(ids[1]);
  await writeFile(path.join(dir, 'pipeline-note.txt'), 'x');
  await workspace._serialize(() => workspace._commit(dir, [path.join(dir, 'pipeline-note.txt')], 'Run R001 (T005): note'));
  spawned.length = 0;
  await cockpit.brief(query);
  assert.ok(!spawned.includes('log'), `no rebuild after a commit outside the ledger's paths (spawned ${spawned.join(', ')})`);
});
