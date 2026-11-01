import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { Workspace } from '../../lib/workspace.mjs';
import { BUILD_BUDGET_MS, payloadSplit, scaleFixture, SHAPE } from './scale-fixture.mjs';

// The scale targets of docs/plans/agent-brain.md §5.5, on its fixture: 300
// tracked repositories of about 200 commits and 3 of about 5,000
// (scale-fixture.mjs, built once into a cache outside the repository). AGE
// Aris runs as its own process on a temporary data folder, as after a restart,
// and is measured from outside, over HTTP.
//
// Run with `npm run perf`; the default run allows 3× each budget,
// AGEARIS_PERF_STRICT=1 holds the exact ones. A target whose phase is not
// built yet is a todo that names the phase: it is measured and reported, and it
// fails only as a todo. Each phase's task drops its todo when it lands.

process.env.GIT_CONFIG_GLOBAL = os.devNull;
process.env.GIT_CONFIG_NOSYSTEM = '1';

const STRICT = process.env.AGEARIS_PERF_STRICT === '1';
const SLACK = STRICT ? 1 : 3;
const SERVER = fileURLToPath(new URL('../../server.mjs', import.meta.url));
const KB = 1024;
const MB = 1024 * KB;
const ORIENT_CALLS = 20;
const ORIENT_BUDGET_BYTES = 8192;

const summary = {};

function within(label, measured, budget, unit = 'ms') {
  const shown = unit === 'KB' ? `${(measured / KB).toFixed(1)} KB` : unit === 'MB' ? `${(measured / MB).toFixed(1)} MB` : `${measured.toFixed(1)} ms`;
  const limit = unit === 'KB' ? `${budget / KB} KB` : unit === 'MB' ? `${budget / MB} MB` : `${budget} ms`;
  console.log(`# ${label}: ${shown} (target ${limit}${STRICT ? ', strict' : `, ×${SLACK} allowed`})`);
  assert.ok(measured <= budget * SLACK, `${label} is ${shown}, over ${limit}${SLACK > 1 ? ` ×${SLACK}` : ''}`);
}

const p95 = (values) => [...values].sort((a, b) => a - b)[Math.ceil(values.length * 0.95) - 1];
const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

function freePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

// VmRSS and VmHWM (the peak) of a process, in bytes; null off Linux.
async function memoryOf(pid) {
  const status = await readFile(`/proc/${pid}/status`, 'utf8').catch(() => null);
  if (!status) return null;
  const field = (name) => Number(new RegExp(`^${name}:\\s+(\\d+) kB`, 'm').exec(status)?.[1]) * KB;
  return { rss: field('VmRSS'), peak: field('VmHWM') };
}

test('300 repositories against the agent-brain §5.5 targets', { timeout: 45 * 60 * 1000 }, async (t) => {
  // ---- The fixture, built once.
  const fixture = await scaleFixture({ log: (line) => console.log(`# ${line}`) });
  const commits = fixture.repos.reduce((sum, repo) => sum + repo.commits, 0);
  const small = fixture.repos.filter((repo) => !repo.large);
  const large = fixture.repos.filter((repo) => repo.large);
  console.log(`# fixture: ${fixture.repos.length} repositories, ${commits} commits, ${fixture.built ? 'built' : 'cached'} (${fixture.dir})`);
  assert.equal(small.length, SHAPE.small);
  assert.equal(large.length, SHAPE.large);
  assert.ok(small.every((repo) => Math.abs(repo.commits - SHAPE.smallCommits) <= 15), 'each small repository has about 200 commits');
  assert.ok(large.every((repo) => Math.abs(repo.commits - SHAPE.largeCommits) <= 50), 'each large repository has about 5,000 commits');
  summary.fixture = { repositories: fixture.repos.length, commits, buildMs: Math.round(fixture.buildMs) };
  if (fixture.built) {
    console.log(`# fixture build: ${(fixture.buildMs / 1000).toFixed(1)} s (budget ${BUILD_BUDGET_MS / 1000} s)`);
    assert.ok(fixture.buildMs <= BUILD_BUDGET_MS, 'the fixture builds in under 5 minutes');
  }

  // ---- A fresh data folder tracking every repository.
  const dataDir = await mkdtemp(path.join(os.tmpdir(), 'agearis-scale-'));
  const home = await mkdtemp(path.join(os.tmpdir(), 'agearis-scale-home-'));
  // One hook, so the server stops before its data folder goes.
  let child = null;
  let exited = null;
  t.after(async () => {
    if (child && child.exitCode === null) { child.kill('SIGTERM'); await exited; }
    await Promise.all([rm(dataDir, { recursive: true, force: true }), rm(home, { recursive: true, force: true })]);
  });
  const workspace = await new Workspace({ dataDir, operator: 'dev', email: 'dev@example.invalid' }).init();
  const linking = performance.now();
  const ids = new Map();
  for (const repo of fixture.repos) ids.set(repo.name, (await workspace.linkProject({ path: repo.path, name: repo.name })).id);
  console.log(`# linking ${ids.size} repositories: ${((performance.now() - linking) / 1000).toFixed(1)} s (setup, not a target)`);

  // ---- Restart: AGE Aris starts on that folder, and Home is fresh when the
  // brief reads every project ready.
  const port = await freePort();
  const started = performance.now();
  child = spawn(process.execPath, [SERVER], {
    env: { ...process.env, PORT: String(port), AGEARIS_DATA_DIR: dataDir, AGESIGHT_DATA_DIR: '', HOME: home, USERPROFILE: home },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  exited = new Promise((resolve) => child.once('exit', resolve));
  let stderr = '';
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  await new Promise((resolve, reject) => {
    let stdout = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; if (stdout.includes('AGE Aris is running')) resolve(); });
    child.once('exit', (code) => reject(new Error(`AGE Aris exited (${code}) before it listened: ${stderr}`)));
  });
  const listening = performance.now() - started;
  const token = (await readFile(path.join(dataDir, '.api-token'), 'utf8')).trim();
  const get = async (pathname) => {
    const begun = performance.now();
    const response = await fetch(`http://127.0.0.1:${port}${pathname}`, { headers: { 'X-AGEAris-Token': token }, signal: AbortSignal.timeout(10 * 60 * 1000) });
    const text = await response.text();
    const ms = performance.now() - begun;
    let json = null;
    try { json = JSON.parse(text); } catch { /* reported by the caller */ }
    return { status: response.status, ms, bytes: Buffer.byteLength(text), json };
  };

  // A brief waits 250 ms for a cold ledger, then reads it as still indexing,
  // so one that takes far longer is a server that could not answer.
  let brief;
  const polls = [];
  for (;;) {
    brief = await get('/api/brief');
    polls.push(Math.round(brief.ms));
    assert.equal(brief.status, 200, `the brief answers: ${JSON.stringify(brief.json)}`);
    if (brief.json.projects.length === ids.size && brief.json.projects.every((line) => line.state === 'ready')) break;
    assert.ok(performance.now() - started < 30 * 60 * 1000, 'every project is ready within 30 minutes');
  }
  const fresh = performance.now() - started;
  const memoryFresh = await memoryOf(child.pid);
  console.log(`# listening after ${listening.toFixed(0)} ms; ${polls.length} briefs until every project was ready, taking ${polls.join(', ')} ms`);
  summary.restart = { listeningMs: Math.round(listening), freshMs: Math.round(fresh), briefsMs: polls, memoryFresh };
  await t.test('restart to fresh, 300 repositories, cache warm: < 10 s', { todo: 'P2a (T060): no disk cache yet, so a restart rebuilds every ledger' }, () => {
    within('restart to fresh (cold: no cache exists)', fresh, 10_000);
  });

  // ---- Home: the brief and the changes since the last visit, warm.
  const briefs = [];
  for (let n = 0; n < 10; n += 1) briefs.push(await get('/api/brief'));
  const changes = await get('/api/changes');
  assert.equal(changes.status, 200);
  const homePayload = { briefBytes: briefs.at(-1).bytes, changesBytes: changes.bytes, briefP95Ms: Math.round(p95(briefs.map((call) => call.ms))), changesMs: Math.round(changes.ms) };
  console.log(`# Home: brief ${(homePayload.briefBytes / KB).toFixed(1)} KB (warm p95 ${homePayload.briefP95Ms} ms), changes ${(homePayload.changesBytes / KB).toFixed(1)} KB (${homePayload.changesMs} ms)`);
  homePayload.briefParts = Object.fromEntries(Object.entries(briefs.at(-1).json)
    .map(([key, value]) => [key, Buffer.byteLength(JSON.stringify(value ?? null))])
    .sort((a, b) => b[1] - a[1]));
  console.log(`#   the brief's largest parts: ${Object.entries(homePayload.briefParts).slice(0, 4).map(([key, size]) => `${key} ${(size / KB).toFixed(0)} KB`).join(', ')}`);
  summary.home = homePayload;
  await t.test('Home payload: < 100 KB, whatever the number of repositories', { todo: 'P3 (T062): Needs-you is not capped yet' }, () => {
    within('Home payload (brief + changes)', homePayload.briefBytes + homePayload.changesBytes, 100 * KB, 'KB');
  });

  // ---- /api/workspace: its size, and what it carries.
  const workspaces = [];
  for (let n = 0; n < 3; n += 1) workspaces.push(await get('/api/workspace'));
  assert.ok(workspaces.every((call) => call.status === 200));
  const split = payloadSplit(workspaces.at(-1).json);
  const share = (part) => `${(part / KB).toFixed(0)} KB, ${((part / split.total) * 100).toFixed(0)}%`;
  console.log(`# /api/workspace: ${(split.total / MB).toFixed(2)} MB, median ${median(workspaces.map((call) => call.ms)).toFixed(0)} ms`);
  console.log(`#   delivered ${split.delivered.tasks} tasks ${share(split.delivered.bytes)}; activity ${split.activity.rows} rows ${share(split.activity.bytes)}; backlog ${split.backlog.tasks} tasks ${share(split.backlog.bytes)}; WIP ${split.wip.tasks} tasks ${share(split.wip.bytes)}; other ${share(split.other)}`);
  console.log(`#   history (delivered + activity) ${(split.historyShare * 100).toFixed(0)}%, WIP ${(split.wipShare * 100).toFixed(1)}%`);
  summary.workspace = { bytes: split.total, medianMs: Math.round(median(workspaces.map((call) => call.ms))), split };
  await t.test('/api/workspace: < 100 KB, whatever the number of repositories', { todo: 'P2b (T061): delivered history is not paged yet' }, () => {
    within('/api/workspace payload', split.total, 100 * KB, 'KB');
  });

  // ---- /api/orient, one repository, warm.
  const orientP95 = {};
  for (const repo of [small[0], large[0]]) {
    const project = ids.get(repo.name);
    await get(`/api/orient?project=${project}`);
    const calls = [];
    for (let n = 0; n < ORIENT_CALLS; n += 1) calls.push(await get(`/api/orient?project=${project}`));
    assert.ok(calls.every((call) => call.status === 200), `orient answers on ${repo.name}`);
    orientP95[repo.name] = Math.round(p95(calls.map((call) => call.ms)));
  }
  summary.orientOne = orientP95;
  // Orient walks the board's whole history on every call (lib/orient.mjs
  // `history`), so a 5,000-commit repository misses.
  for (const repo of [small[0], large[0]]) {
    const todo = repo.large ? 'T102: orient walks the whole board history on every call' : false;
    await t.test(`GET /api/orient, one repository, warm (${repo.name}): p95 < 150 ms`, { todo }, () => within(`orient p95, ${repo.name}`, orientP95[repo.name], 150));
  }

  // ---- Every repository's answer, within its budget; and today's nearest
  // thing to all=1, an orient per repository in turn.
  const everyStarted = performance.now();
  const answers = [];
  for (const [name, project] of ids) answers.push({ name, ...(await get(`/api/orient?project=${project}`)) });
  const every = performance.now() - everyStarted;
  const largest = answers.reduce((most, answer) => (answer.bytes > most.bytes ? answer : most));
  console.log(`# orient on each of ${answers.length} repositories in turn: ${(every / 1000).toFixed(1)} s; the largest answer ${largest.bytes} B (${largest.name})`);
  summary.orientEach = { ms: Math.round(every), largestBytes: largest.bytes };
  await t.test('any answer: within its budget, always', () => {
    for (const answer of answers) {
      assert.equal(answer.status, 200, `orient answers on ${answer.name}`);
      assert.ok(answer.bytes <= ORIENT_BUDGET_BYTES, `${answer.name}'s answer is ${answer.bytes} B, over ${ORIENT_BUDGET_BYTES}`);
    }
  });

  const all = await get('/api/orient?all=1');
  summary.orientAll = { status: all.status, ms: Math.round(all.ms) };
  console.log(`# GET /api/orient?all=1: ${all.status}${all.status === 200 ? `, ${all.ms.toFixed(0)} ms` : ` (${all.json?.error || 'no answer'})`}`);
  await t.test('GET /api/orient?all=1, 300 repositories, warm: p95 < 1 s', { todo: 'P3 (T062): all=1 is not built' }, () => {
    assert.equal(all.status, 200, 'all=1 answers');
    within('orient all=1', all.ms, 1000);
  });
  await t.test('board.sh --orient, a 5,000-commit repository: p95 < 1 s', { skip: 'P1b (T056): board.sh --orient is not built' });

  // ---- Memory, after everything above.
  const memory = await memoryOf(child.pid);
  summary.memory = memory;
  if (memory) console.log(`# server memory: ${(memory.rss / MB).toFixed(0)} MB resident, ${(memory.peak / MB).toFixed(0)} MB at its peak`);
  await t.test('server memory, 300 repositories: < 300 MB', { todo: 'P3 (T062): the 300-repository targets', skip: memory ? false : 'resident memory is read from /proc, on Linux only' }, () => {
    within('server memory, resident', memory.rss, 300 * MB, 'MB');
  });
  console.log(`# summary ${JSON.stringify(summary)}`);
});
