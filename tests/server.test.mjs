import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { once } from 'node:events';
import { chmod, mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';

import { createServer } from '../server.mjs';

const exec = promisify(execFile);

async function git(directory, ...args) {
  await exec('git', args, {
    cwd: directory,
    env: { ...process.env, GIT_CONFIG_GLOBAL: os.devNull, GIT_CONFIG_NOSYSTEM: '1' },
  });
}

async function repository() {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'agesight-server-'));
  await git(directory, 'init', '--quiet');
  await git(directory, 'config', 'user.name', 'HTTP Tester');
  await git(directory, 'config', 'user.email', 'http@example.invalid');
  return directory;
}

async function json(response) {
  const body = await response.json();
  assert.match(response.headers.get('content-type') ?? '', /^application\/json/);
  return body;
}

test('HTTP API performs a project and task CRUD round trip and reports client errors', async (t) => {
  const directory = await repository();
  const server = await createServer({ dataDir: directory });
  t.after(async () => {
    if (server.listening) {
      server.close();
      await once(server, 'close');
    }
    await rm(directory, { recursive: true, force: true });
  });
  const listening = Promise.race([
    once(server, 'listening'),
    once(server, 'error').then(([error]) => Promise.reject(error)),
  ]);
  server.listen(0, '127.0.0.1');
  try {
    await listening;
  } catch (error) {
    if (error?.code === 'EPERM') {
      t.skip('This environment does not permit binding a loopback test server');
      return;
    }
    throw error;
  }
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const base = `http://127.0.0.1:${address.port}`;
  // Every API request carries the workspace token, as the browser does via its cookie.
  const fetch = (url, options = {}) => globalThis.fetch(url, { ...options, headers: { 'x-agesight-token': server.apiToken, ...(options.headers || {}) } });

  let response = await globalThis.fetch(`${base}/api/workspace`);
  assert.equal(response.status, 401, 'the API refuses requests without the token');
  response = await globalThis.fetch(`${base}/`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('set-cookie'), null, 'loading the page alone never hands out the token');
  response = await globalThis.fetch(`${base}/?token=${'x'.repeat(43)}`, { redirect: 'manual' });
  assert.equal(response.status, 303);
  assert.equal(response.headers.get('set-cookie'), null, 'a wrong sign-in link sets no cookie');
  response = await globalThis.fetch(`${base}/?token=${server.apiToken}`, { redirect: 'manual' });
  assert.equal(response.status, 303);
  assert.equal(response.headers.get('location'), '/');
  const cookie = response.headers.get('set-cookie') ?? '';
  assert.match(cookie, /^agesight_token=[A-Za-z0-9_-]{43}; HttpOnly; SameSite=Strict; Path=\/; Max-Age=31536000$/);
  response = await globalThis.fetch(`${base}/api/workspace`, { headers: { cookie: cookie.split(';')[0] } });
  assert.equal(response.status, 200, 'the page cookie authorizes the browser');
  response = await globalThis.fetch(`${base}/api/workspace`, { headers: { 'x-agesight-token': 'x'.repeat(43) } });
  assert.equal(response.status, 401, 'a wrong token is refused');
  response = await fetch(`${base}/api/projects`, { method: 'POST', body: JSON.stringify({ name: 'No type' }) });
  assert.equal(response.status, 415, 'a body without a JSON content type is refused');

  response = await fetch(`${base}/favicon.svg`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type') ?? '', /^image\/svg\+xml/);

  response = await fetch(`${base}/api/workspace`);
  assert.equal(response.status, 200);
  let snapshot = await json(response);
  assert.deepEqual(snapshot.projects, []);
  assert.deepEqual(snapshot.tasks, []);
  assert.ok(Array.isArray(snapshot.activity));
  assert.equal(typeof snapshot.operator, 'string');

  response = await fetch(`${base}/api/projects`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Web project', description: 'Created over HTTP', color: '#2563eb', wipLimit: 2 }),
  });
  assert.equal(response.status, 201);
  let project = await json(response);
  assert.equal(project.name, 'Web project');

  response = await fetch(`${base}/api/projects/${encodeURIComponent(project.id)}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ version: project.version, description: 'Edited over HTTP' }),
  });
  assert.equal(response.status, 200);
  project = await json(response);
  assert.equal(project.description, 'Edited over HTTP');

  response = await fetch(`${base}/api/tasks`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      projectId: project.id,
      title: 'Exercise the API',
      description: 'A real request round trip.',
      priority: 'high',
      dueDate: '2027-03-12',
    }),
  });
  assert.equal(response.status, 201);
  let taskRecord = await json(response);
  assert.equal(taskRecord.status, 'backlog');
  assert.equal(taskRecord.projectId, project.id);

  response = await fetch(`${base}/api/tasks/${encodeURIComponent(taskRecord.id)}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ version: taskRecord.version, status: 'in_progress', assignee: 'HTTP Tester' }),
  });
  assert.equal(response.status, 200);
  taskRecord = await json(response);
  assert.equal(taskRecord.status, 'in_progress');
  assert.equal(taskRecord.assignee, 'HTTP Tester');

  response = await fetch(`${base}/api/workspace`);
  snapshot = await json(response);
  assert.equal(snapshot.projects[0].description, 'Edited over HTTP');
  assert.equal(snapshot.tasks[0].status, 'in_progress');

  response = await fetch(`${base}/api/tasks`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ projectId: project.id, title: 'Impossible date', dueDate: '2027-02-30' }),
  });
  assert.equal(response.status, 400);
  const error = await json(response);
  assert.equal(typeof error.error, 'string');

  response = await fetch(`${base}/api/projects`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'https://evil.example' },
    body: JSON.stringify({ name: 'Cross-origin project' }),
  });
  assert.equal(response.status, 403);
});

const OK_AGENT_SCRIPT = `let prompt = '';
process.stdin.setEncoding('utf8');
for await (const chunk of process.stdin) prompt += chunk;
const role = /^Role: (\\w+)/m.exec(prompt)?.[1] ?? 'stage';
process.stdout.write('HTTP-OUT-' + role + '\\n');
`;

function seedAgent(id, overrides = {}) {
  return {
    id,
    name: id,
    description: '',
    runner: 'command',
    command: [process.execPath, '-e', '0'],
    cwd: '',
    roles: ['plan', 'implement'],
    tier: 'sonnet',
    enabled: true,
    maxConcurrent: 2,
    timeoutSec: 60,
    ...overrides,
  };
}

async function eventually(check, message, timeout = 10000) {
  const deadline = Date.now() + timeout;
  for (;;) {
    const value = await check();
    if (value) return value;
    if (Date.now() > deadline) assert.fail(`Timed out waiting for ${message}`);
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

test('HTTP API drives an agent pipeline run, enforces stale and cross-origin protections, and serves the pull runner', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'agesight-server-run-'));
  await mkdir(path.join(root, 'scripts'));
  const script = path.join(root, 'scripts', 'ok.mjs');
  await writeFile(script, OK_AGENT_SCRIPT);
  const seed = () => [
    seedAgent('ok', { command: [process.execPath, script] }),
    seedAgent('puller', { runner: 'pull', command: [], roles: ['review'] }),
  ];
  const server = await createServer({ dataDir: path.join(root, 'data'), engineOptions: { tickMs: 20 }, registryOptions: { seed } });
  t.after(async () => {
    if (server.listening) {
      server.close();
      await once(server, 'close');
    } else {
      server.engine.stop();
    }
    await rm(root, { recursive: true, force: true, maxRetries: 5 });
  });
  const listening = Promise.race([
    once(server, 'listening'),
    once(server, 'error').then(([error]) => Promise.reject(error)),
  ]);
  server.listen(0, '127.0.0.1');
  try {
    await listening;
  } catch (error) {
    if (error?.code === 'EPERM') {
      t.skip('This environment does not permit binding a loopback test server');
      return;
    }
    throw error;
  }
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const base = `http://127.0.0.1:${address.port}`;
  // Every API request carries the workspace token, as the browser does via its cookie.
  const fetch = (url, options = {}) => globalThis.fetch(url, { ...options, headers: { 'x-agesight-token': server.apiToken, ...(options.headers || {}) } });

  async function call(method, route, body, headers = {}) {
    const response = await fetch(`${base}${route}`, {
      method,
      headers: { ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, body: await json(response) };
  }
  const runRoute = (id) => `/api/runs/${encodeURIComponent(id)}`;
  const getRun = async (id) => (await call('GET', runRoute(id))).body;
  const approve = (run, extra = {}) => call('POST', `${runRoute(run.id)}/actions`, { action: 'approve', expectedSeq: run.lastSeq, ...extra });

  // Project and its pipeline.
  const project = (await call('POST', '/api/projects', { name: 'Run project' })).body;
  let result = await call('GET', `/api/projects/${project.id}/pipeline`);
  assert.equal(result.status, 200);
  assert.equal(result.body.isDefault, true);
  assert.equal(result.body.version, 'default');
  assert.equal(result.body.stages.length, 5);
  const stages = [
    { id: 'plan', name: 'Plan', role: 'plan', tier: 'sonnet', gate: 'approve' },
    { id: 'build', name: 'Build', role: 'implement', tier: 'sonnet' },
  ];
  result = await call('PUT', `/api/projects/${project.id}/pipeline`, { version: 'default', stages });
  assert.equal(result.status, 200);
  const savedVersion = result.body.version;
  assert.equal((await call('PUT', `/api/projects/${project.id}/pipeline`, { version: 'default', stages })).status, 409);
  assert.equal((await call('PUT', `/api/projects/${project.id}/pipeline`, { version: savedVersion, stages: [{ id: 'x', name: 'X', role: 'wizard' }] })).status, 400);
  result = await call('GET', `/api/projects/${project.id}/pipeline`);
  assert.deepEqual(result.body.stages.map((stage) => stage.id), ['plan', 'build']);
  assert.equal(result.body.version, savedVersion);

  // A run to the first gate.
  const task = (await call('POST', '/api/tasks', { projectId: project.id, title: 'Run over HTTP', description: 'Exercise the pipeline.' })).body;
  result = await call('POST', '/api/runs', { taskId: task.id });
  assert.equal(result.status, 201);
  const runId = result.body.id;
  assert.equal(runId, `${project.id}:R001`);
  assert.equal((await call('POST', '/api/runs', { taskId: task.id })).status, 409);

  const gated = await eventually(async () => {
    const run = await getRun(runId);
    return run.status === 'awaiting_approval' ? run : null;
  }, 'the run to reach the plan gate');
  assert.equal(gated.currentStage.id, 'plan');
  assert.match(gated.attempts[0].output, /HTTP-OUT-plan/);
  assert.equal((await call('GET', '/api/workspace')).body.tasks.find((entry) => entry.id === task.id).status, 'in_progress');

  // Stale and cross-origin decisions change nothing.
  result = await approve(gated, { expectedSeq: gated.lastSeq - 1 });
  assert.equal(result.status, 409);
  assert.equal(typeof result.body.error, 'string');
  result = await call('POST', `${runRoute(runId)}/actions`, { action: 'approve', expectedSeq: gated.lastSeq }, { origin: 'http://evil.example' });
  assert.equal(result.status, 403);
  result = await call('POST', '/api/runs', { taskId: task.id }, { origin: 'http://evil.example' });
  assert.equal(result.status, 403);
  assert.equal((await getRun(runId)).lastSeq, gated.lastSeq);

  // Approve with the current sequence and wait for completion.
  result = await approve(gated, { comment: 'Looks good' });
  assert.equal(result.status, 200);
  const done = await eventually(async () => {
    const run = await getRun(runId);
    return run.status === 'completed' ? run : null;
  }, 'the run to complete');
  assert.deepEqual(done.attempts.map((attempt) => [attempt.stageId, attempt.status]), [['plan', 'approved'], ['build', 'succeeded']]);
  assert.equal(done.attempts[0].decision.comment, 'Looks good');

  result = await call('GET', `${runRoute(runId)}/audit`);
  assert.equal(result.status, 200);
  assert.equal(result.body.runId, runId);
  assert.equal(result.body.audit.chain.ok, true);
  assert.equal(result.body.audit.artifacts.ok, true);
  assert.equal(result.body.audit.chain.count, result.body.events.length);
  assert.equal(result.body.path, 'pipeline/runs/R001');

  // The task moves to Done just after the run's completion is recorded, so wait for it.
  let snapshot = await eventually(async () => {
    const current = (await call('GET', '/api/workspace')).body;
    return current.tasks.find((entry) => entry.id === task.id).status === 'done' ? current : null;
  }, 'the task to move to done');
  const summary = snapshot.runs.find((entry) => entry.id === runId);
  assert.equal(summary.status, 'completed');
  assert.equal(summary.integrity, true);
  const okAgent = snapshot.agents.find((agent) => agent.id === 'ok');
  assert.equal(okAgent.performance.plan.successes, 1);
  assert.equal(okAgent.performance.implement.successes, 1);
  assert.ok(snapshot.agents.some((agent) => agent.id === 'puller'));
  assert.equal((await call('GET', '/api/runs')).body.length, 1);

  // Unknown runs and actions.
  assert.equal((await call('GET', runRoute(`${project.id}:R999`))).status, 404);
  assert.equal((await call('POST', `${runRoute(runId)}/actions`, { action: 'explode', expectedSeq: done.lastSeq })).status, 400);

  // The pull runner over HTTP.
  const pullProject = (await call('POST', '/api/projects', { name: 'Pull project' })).body;
  await call('PUT', `/api/projects/${pullProject.id}/pipeline`, { version: 'default', stages: [{ id: 'review', name: 'Review', role: 'review', tier: 'sonnet' }] });
  const pullTask = (await call('POST', '/api/tasks', { projectId: pullProject.id, title: 'Pulled work' })).body;
  const pullRunId = (await call('POST', '/api/runs', { taskId: pullTask.id })).body.id;
  await eventually(async () => (await getRun(pullRunId)).attempts[0]?.status === 'queued', 'the attempt to be queued for the pull agent');

  result = await call('POST', '/api/agents/puller/claim', {});
  assert.equal(result.status, 200);
  const { work } = result.body;
  assert.equal(work.attemptId, `${pullRunId}:1`);
  assert.equal(work.runId, pullRunId);
  assert.match(work.prompt, /^Role: review$/m);
  assert.deepEqual((await call('POST', '/api/agents/puller/claim', {})).body, { work: null });
  assert.equal((await call('POST', '/api/agents/ok/claim', {})).status, 400);

  const attemptRoute = (action) => `/api/attempts/${encodeURIComponent(work.attemptId)}/${action}`;
  result = await call('POST', attemptRoute('heartbeat'), { agentId: 'puller' });
  assert.equal(result.status, 200);
  assert.ok(Date.parse(result.body.leaseUntil) > Date.now());
  assert.equal((await call('POST', attemptRoute('complete'), { agentId: 'ok', outcome: 'succeeded', output: 'stolen' })).status, 403);
  assert.equal((await call('POST', attemptRoute('complete'), { agentId: 'puller', outcome: 'bogus', output: 'x' })).status, 400);
  assert.equal((await call('POST', `/api/attempts/${encodeURIComponent(`${pullRunId}:9`)}/complete`, { agentId: 'puller' })).status, 404);

  result = await call('POST', attemptRoute('complete'), { agentId: 'puller', outcome: 'succeeded', output: 'Pulled over HTTP' });
  assert.equal(result.status, 200);
  assert.equal(result.body.status, 'completed');
  assert.equal(result.body.attempts[0].output, 'Pulled over HTTP');
  assert.equal(result.body.audit.chain.ok, true);
  assert.equal((await call('POST', attemptRoute('complete'), { agentId: 'puller', output: 'twice' })).status, 409);
  snapshot = (await call('GET', '/api/workspace')).body;
  assert.equal(snapshot.tasks.find((entry) => entry.id === pullTask.id).status, 'done');

  // Agent registry endpoints.
  result = await call('POST', '/api/agents', { id: 'extra', name: 'Extra', command: [process.execPath, '-e', '0'], roles: ['verify'], tier: 'opus' });
  assert.equal(result.status, 201);
  const extra = result.body;
  assert.equal((await call('POST', '/api/agents', { id: 'extra', name: 'Extra', command: [process.execPath] })).status, 409);
  assert.equal((await call('POST', '/api/agents', { id: 'Bad Id', name: 'Bad', command: [process.execPath] })).status, 400);
  assert.equal((await call('PATCH', '/api/agents/extra', { version: 'stale', enabled: false })).status, 409);
  result = await call('PATCH', '/api/agents/extra', { version: extra.version, enabled: false });
  assert.equal(result.status, 200);
  assert.equal(result.body.enabled, false);
  result = await call('GET', '/api/agents');
  assert.equal(result.status, 200);
  assert.equal(result.body.find((agent) => agent.id === 'extra').enabled, false);
  assert.ok('performance' in result.body.find((agent) => agent.id === 'ok'));
});

// --- API token --------------------------------------------------------------------------

// A server on a fresh data dir with no agents, so nothing is ever spawned by these tests.
async function tokenServer(t, { dataDir, listen = true } = {}) {
  const root = dataDir ? '' : await mkdtemp(path.join(os.tmpdir(), 'agesight-token-'));
  const dir = dataDir ?? path.join(root, 'data');
  const server = await createServer({ dataDir: dir, registryOptions: { seed: () => [] } });
  t.after(async () => {
    if (server.listening) {
      server.close();
      await once(server, 'close');
    } else {
      await server.engine.stop();
    }
    if (root) await rm(root, { recursive: true, force: true, maxRetries: 5 });
  });
  if (!listen) return { server, dir };
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  const fetch = (url, options = {}) => globalThis.fetch(url, { ...options, headers: { 'x-agesight-token': server.apiToken, ...(options.headers || {}) } });
  return { server, dir, base, fetch };
}

test('the API refuses requests without the token with a 401', async (t) => {
  const { base } = await tokenServer(t);
  let response = await globalThis.fetch(`${base}/api/runs`);
  assert.equal(response.status, 401);
  assert.equal(typeof (await json(response)).error, 'string');
  response = await globalThis.fetch(`${base}/api/agents/x/claim`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
  assert.equal(response.status, 401);
  assert.equal(typeof (await json(response)).error, 'string');
  response = await globalThis.fetch(`${base}/api/runs`, { headers: { 'x-agesight-token': 'wrong-token' } });
  assert.equal(response.status, 401);
});

test('a text/plain body is refused with a 415 even with a valid token', async (t) => {
  const { base, fetch } = await tokenServer(t);
  const response = await fetch(`${base}/api/runs`, { method: 'POST', headers: { 'content-type': 'text/plain' }, body: JSON.stringify({ taskId: 'x:T001' }) });
  assert.equal(response.status, 415);
  assert.equal(typeof (await json(response)).error, 'string');
});

test('the sign-in link sets an HttpOnly token cookie that authorizes POST /api/runs', async (t) => {
  const { base, fetch, dir: dataDir } = await tokenServer(t);
  const project = await json(await fetch(`${base}/api/projects`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Cookie project' }) }));
  const task = await json(await fetch(`${base}/api/tasks`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ projectId: project.id, title: 'Cookie task' }) }));

  assert.equal((await globalThis.fetch(`${base}/`)).headers.get('set-cookie'), null);
  const page = await globalThis.fetch(`${base}/?token=${(await readFile(path.join(dataDir, '.api-token'), 'utf8')).trim()}`, { redirect: 'manual' });
  assert.equal(page.status, 303);
  const cookie = page.headers.get('set-cookie') ?? '';
  assert.match(cookie, /; HttpOnly/);
  assert.match(cookie, /; SameSite=Strict/);
  const pair = cookie.split(';')[0];
  assert.match(pair, /^agesight_token=[A-Za-z0-9_-]{43}$/);

  const refused = await globalThis.fetch(`${base}/api/runs`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ taskId: task.id }) });
  assert.equal(refused.status, 401, 'without the cookie the same request is refused');
  const started = await globalThis.fetch(`${base}/api/runs`, { method: 'POST', headers: { 'content-type': 'application/json', cookie: pair }, body: JSON.stringify({ taskId: task.id }) });
  assert.equal(started.status, 201);
  assert.equal((await json(started)).taskId, task.id);
});

test('the data directory keeps the token in a private .api-token file', async (t) => {
  const { server } = await tokenServer(t, { listen: false });
  const file = path.join(server.workspace.dataDir, '.api-token');
  const info = await stat(file);
  assert.ok(info.isFile());
  assert.equal(info.mode & 0o777, 0o600);
  assert.equal((await readFile(file, 'utf8')).trim(), server.apiToken);
  assert.match(server.apiToken, /^[A-Za-z0-9_-]{43}$/);
});

test('a second server on the same data directory reuses the token', async (t) => {
  const first = await tokenServer(t, { listen: false });
  const second = await tokenServer(t, { dataDir: first.dir, listen: false });
  assert.equal(second.server.apiToken, first.server.apiToken);
  assert.equal((await readFile(path.join(first.dir, '.api-token'), 'utf8')).trim(), first.server.apiToken);
});

test('reusing the token file tightens loosened permissions back to 0600', async (t) => {
  const first = await tokenServer(t, { listen: false });
  const file = path.join(first.dir, '.api-token');
  await chmod(file, 0o644);
  const second = await tokenServer(t, { dataDir: first.dir, listen: false });
  assert.equal(second.server.apiToken, first.server.apiToken);
  assert.equal((await stat(file)).mode & 0o777, 0o600);
});

test('GET /api/settings returns the defaults without a settings file and the file values with one', async (t) => {
  const { base, fetch, dir } = await tokenServer(t);
  let response = await fetch(`${base}/api/settings`);
  assert.equal(response.status, 200);
  assert.deepEqual(await json(response), {
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    workdays: [1, 2, 3, 4, 5],
    personalWipLimit: 3,
    deltaFallback: 'previous-workday',
    version: 'default',
  });

  await writeFile(path.join(dir, 'settings.json'), JSON.stringify({ timezone: 'Europe/London', workdays: [1, 2, 3, 4], personalWipLimit: 2, deltaFallback: '24h' }));
  response = await fetch(`${base}/api/settings`);
  assert.equal(response.status, 200);
  const settings = await json(response);
  assert.deepEqual({ ...settings, version: undefined }, { timezone: 'Europe/London', workdays: [1, 2, 3, 4], personalWipLimit: 2, deltaFallback: '24h', version: undefined });
  assert.match(settings.version, /^[0-9a-f]{64}$/);

  await writeFile(path.join(dir, 'settings.json'), JSON.stringify({ workdays: 'weekdays' }));
  response = await fetch(`${base}/api/settings`);
  assert.equal(response.status, 500);
  assert.match((await json(response)).error, /workdays/);
});

test('every task and project write through the API is committed with AGESight-Via: ui, and a run\'s task move with Run instead', async (t) => {
  const { base, fetch, server } = await tokenServer(t);
  const committed = [];
  server.workspace.onCommit((projectId) => committed.push(projectId));
  const send = async (method, url, body, status = 200) => {
    const response = await fetch(`${base}${url}`, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const value = await json(response);
    assert.equal(response.status, status, value.error);
    return value;
  };
  const lastMessage = async (projectId, ...paths) => (await exec('git', ['log', '-1', '--format=%B', '--', ...paths], {
    cwd: path.join(server.workspace.projectsDir, projectId),
    env: { ...process.env, GIT_CONFIG_GLOBAL: os.devNull, GIT_CONFIG_NOSYSTEM: '1' },
  })).stdout.trim();
  const assertViaUi = async (projectId, subject, ...paths) => {
    const message = await lastMessage(projectId, ...paths);
    assert.match(message, subject);
    assert.match(message, /\n\nAGESight-Via: ui$/, `"${message}" ends with the trailer`);
  };

  let project = await send('POST', '/api/projects', { name: 'Via UI' }, 201);
  await assertViaUi(project.id, /^Create project: Via UI\n/);
  project = await send('PATCH', `/api/projects/${project.id}`, { name: 'Via UI, renamed', version: project.version });
  await assertViaUi(project.id, /^Update project: Via UI, renamed\n/);
  let task = await send('POST', '/api/tasks', { projectId: project.id, title: 'Typed', type: 'analysis' }, 201);
  assert.equal(task.type, 'analysis');
  await assertViaUi(project.id, /^Create T001: Typed\n/);
  task = await send('PATCH', `/api/tasks/${encodeURIComponent(task.id)}`, { status: 'blocked', blockedReason: 'Waiting on legal', version: task.version });
  assert.equal(task.blockedReason, 'Waiting on legal');
  await assertViaUi(project.id, /^Update T001: Typed\n/);
  const pipeline = await send('GET', `/api/projects/${project.id}/pipeline`);
  await send('PUT', `/api/projects/${project.id}/pipeline`, { stages: pipeline.stages.slice(0, 2), version: pipeline.version });
  await assertViaUi(project.id, /^Update pipeline: /);
  assert.equal(committed.length, 5);
  assert.ok(committed.every((id) => id === project.id));

  const invalid = await fetch(`${base}/api/tasks/${encodeURIComponent(task.id)}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type: 'x'.repeat(41), version: task.version }) });
  assert.equal(invalid.status, 400);

  // Starting a run is an HTTP request too, but the task move it makes belongs to the run.
  await send('POST', '/api/runs', { taskId: task.id }, 201);
  const moved = await lastMessage(project.id, 'deaddrop/tasks');
  assert.match(moved, /^Update T001: Typed\n\nRun: R001$/);
  assert.doesNotMatch(moved, /AGESight-Via/);
  const current = await send('GET', '/api/workspace');
  const stored = current.tasks.find((entry) => entry.id === task.id);
  assert.equal(stored.status, 'in_progress');
  assert.equal(stored.blockedReason, '', 'the reason is cleared when the run takes the task out of blocked');
});
