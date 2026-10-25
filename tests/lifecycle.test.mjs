// Deprecating, archiving and restoring a project (T068), on both kinds: a
// tracked repository and an AGE Aris project. Real temporary repositories, no
// global or system git config, and nothing outside os.tmpdir().
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readdir, readFile, realpath, rename, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';

import { AgentRegistry } from '../lib/agents.mjs';
import { Cockpit } from '../lib/brief.mjs';
import { fabricate } from '../lib/fabricate.mjs';
import { PipelineEngine } from '../lib/pipeline.mjs';
import { Workspace } from '../lib/workspace.mjs';

process.env.GIT_CONFIG_GLOBAL = os.devNull;
process.env.GIT_CONFIG_NOSYSTEM = '1';
delete process.env.AGEARIS_TRACKED_WRITES;

const exec = promisify(execFile);
const temporary = new Set();

test.after(async () => {
  await Promise.all([...temporary].map((directory) => rm(directory, { recursive: true, force: true })));
});

async function tempDir(kind) {
  const directory = await realpath(await mkdtemp(path.join(os.tmpdir(), `agearis-lifecycle-${kind}-`)));
  temporary.add(directory);
  return directory;
}

async function g(dir, ...args) {
  const { stdout } = await exec('git', args, { cwd: dir, env: process.env });
  return stdout.trim();
}

async function refusal(promise) {
  try { await promise; } catch (error) { return error; }
  assert.fail('expected a refusal');
}

const task = (id, title) => `---\nid: ${id}\ntitle: "${title}"\nstatus: open\nowner: —\nblockedReason: ""\n---\n\n# ${id} — ${title}\n\n## Result\n\n*(pending)*\n`;

// A tracked repository with an AA board and T001 in its backlog, linked in a
// fresh data folder with task actions switched on.
async function tracked() {
  const dir = await tempDir('repo');
  await g(dir, 'init', '--quiet', '--initial-branch=main');
  await g(dir, 'config', 'user.name', 'adervark');
  await g(dir, 'config', 'user.email', 'operator@example.invalid');
  for (const [name, content] of Object.entries({ 'AA/backlog/T001-one.md': task('T001', 'One'), 'AA/tasks/.gitkeep': '', 'AA/AA.yml': 'wip:\n  in_progress: 2\n', 'AA/STATE.md': '# State\n' })) {
    await mkdir(path.dirname(path.join(dir, name)), { recursive: true });
    await writeFile(path.join(dir, name), content);
  }
  await g(dir, 'add', '-A');
  await g(dir, 'commit', '--quiet', '-m', 'fixture');
  const dataDir = await tempDir('data');
  const workspace = await new Workspace({ dataDir, operator: 'AGE Aris Tester', email: 'tester@example.invalid' }).init();
  let project = await workspace.linkProject({ path: dir, name: 'Theirs' });
  const asked = await refusal(workspace.updateProject(project.id, { version: project.version, taskActions: { on: true } }));
  project = await workspace.updateProject(project.id, { version: project.version, taskActions: { on: true }, confirm: asked.details.confirmToken });
  return { dir, dataDir, workspace, project };
}

// Every file in the repository, with its ref and status: equal before and
// after means nothing there changed.
async function repositoryState(dir) {
  const files = {};
  async function visit(current) {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      if (entry.name === '.git') continue;
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) await visit(absolute);
      else files[path.relative(dir, absolute)] = createHash('sha256').update(await readFile(absolute)).digest('hex');
    }
  }
  await visit(dir);
  return { head: await g(dir, 'rev-parse', 'HEAD'), status: await g(dir, 'status', '--porcelain', '--untracked-files=all'), files };
}

// A lifecycle change that needs a confirmation, confirmed.
async function confirmed(workspace, project, lifecycle) {
  const asked = await refusal(workspace.updateProject(project.id, { version: project.version, lifecycle }));
  assert.equal(asked.code, 'CONFIRM', asked.message);
  return workspace.updateProject(project.id, { version: project.version, lifecycle, confirm: asked.details.confirmToken });
}

const claim = async (workspace, project, id) => {
  const found = await workspace.getTask(`${project.id}:${id}`);
  return workspace.actOnTask(`${project.id}:${id}`, { action: 'claim', version: found.version });
};

test('a tracked repository is deprecated, archived and restored with only AGE Aris\'s project.json changing, and its task-actions switch comes back', async () => {
  const repo = await tracked();
  const other = await repo.workspace.createProject({ name: 'Next' });
  const before = await repositoryState(repo.dir);

  const asked = await refusal(repo.workspace.updateProject(repo.project.id, { version: repo.project.version, lifecycle: { state: 'deprecated', reason: 'Moved on', successor: other.id } }));
  assert.deepEqual([asked.status, asked.code], [409, 'CONFIRM']);
  const said = asked.details.reasons.map((reason) => reason.text).join('\n');
  assert.match(said, /Theirs stays listed, marked deprecated in favour of Next\./);
  assert.match(said, /Nothing in .+ changes, and nothing is deleted/);
  const wrong = await refusal(repo.workspace.updateProject(repo.project.id, { version: repo.project.version, lifecycle: { state: 'deprecated' }, confirm: asked.details.confirmToken }));
  assert.equal(wrong.code, 'CONFIRM', 'a token confirms only what it was handed out for');

  const deprecated = await repo.workspace.updateProject(repo.project.id, { version: repo.project.version, lifecycle: { state: 'deprecated', reason: 'Moved on', successor: other.id }, confirm: asked.details.confirmToken });
  assert.deepEqual([deprecated.lifecycle.state, deprecated.lifecycle.reason, deprecated.lifecycle.successor], ['deprecated', 'Moved on', other.id]);
  assert.ok(Date.parse(deprecated.lifecycle.since));
  assert.equal(deprecated.taskActions.on, true, 'the switch is kept');

  // Read-only while deprecated: task actions, and the switch itself.
  assert.equal((await refusal(claim(repo.workspace, repo.project, 'T001'))).code, 'PROJECT_INACTIVE');
  assert.equal((await refusal(repo.workspace.updateProject(repo.project.id, { version: deprecated.version, taskActions: { on: false } }))).code, 'PROJECT_INACTIVE');

  const archived = await confirmed(repo.workspace, deprecated, { state: 'archived' });
  assert.equal(archived.lifecycle.state, 'archived');
  assert.equal((await refusal(claim(repo.workspace, repo.project, 'T001'))).code, 'PROJECT_INACTIVE');
  const listed = (await repo.workspace.read()).projects.find((project) => project.id === repo.project.id);
  assert.equal(listed.lifecycle.state, 'archived');

  // Restoring takes no confirmation, and puts the project back as it was.
  const restored = await repo.workspace.updateProject(repo.project.id, { version: archived.version, lifecycle: { state: 'active' } });
  assert.equal('lifecycle' in restored, false);
  assert.deepEqual([restored.actions.on, restored.actions.branch], [true, 'main']);
  assert.deepEqual(await repositoryState(repo.dir), before, 'nothing in the repository changed');
  assert.deepEqual(await readdir(path.join(repo.dataDir, 'projects', repo.project.id)), ['project.json']);
  await claim(repo.workspace, repo.project, 'T001');
});

test('an AGE Aris project is deprecated and restored by one commit each to its project.json, and refuses task and project writes between', async () => {
  const workspace = await new Workspace({ dataDir: await tempDir('data'), operator: 'ade', email: 'ade@example.invalid' }).init();
  const project = await workspace.createProject({ name: 'Mine', wipLimit: 3 });
  const created = await workspace.createTask({ projectId: project.id, title: 'Keep me' });
  const dir = path.join(workspace.dataDir, 'projects', project.id);
  const commits = Number(await g(dir, 'rev-list', '--count', 'HEAD'));
  const files = await g(dir, 'ls-files');

  const deprecated = await confirmed(workspace, project, { state: 'deprecated', reason: 'Winding down' });
  assert.equal(deprecated.lifecycle.state, 'deprecated');
  assert.equal(Number(await g(dir, 'rev-list', '--count', 'HEAD')), commits + 1);
  assert.equal(await g(dir, 'log', '-1', '--format=%s'), 'Update project: Mine: deprecated');
  assert.equal(await g(dir, 'show', '--format=', '--name-only', 'HEAD'), 'project.json');
  assert.equal(await g(dir, 'ls-files'), files, 'nothing is deleted');

  // The pipeline still reads; a new run does not start, nor a pipeline save.
  const registry = await new AgentRegistry({ dataDir: workspace.dataDir, operator: 'ade', email: 'ade@example.invalid', seed: () => [] }).init();
  const engine = await new PipelineEngine({ workspace, registry }).init();
  const pipeline = await engine.getPipeline(project.id);
  assert.ok(pipeline.version);
  for (const attempt of [
    () => engine.startRun({ taskId: created.id }),
    () => engine.savePipeline(project.id, { stages: pipeline.stages, version: pipeline.version }),
    () => workspace.createTask({ projectId: project.id, title: 'New' }),
    () => workspace.updateTask(created.id, { version: created.version, title: 'Changed' }),
    () => workspace.actOnTask(created.id, { action: 'claim', version: created.version }),
    () => workspace.updateProject(project.id, { version: deprecated.version, name: 'Renamed' }),
  ]) assert.equal((await refusal(attempt())).code, 'PROJECT_INACTIVE');

  // Archiving a deprecated project starts a new since; asking again for the
  // state it is in changes nothing.
  const archived = await confirmed(workspace, deprecated, { state: 'archived' });
  const again = await confirmed(workspace, archived, { state: 'archived' });
  assert.equal(again.version, archived.version);
  assert.equal(Number(await g(dir, 'rev-list', '--count', 'HEAD')), commits + 2);

  const restored = await workspace.updateProject(project.id, { version: archived.version, lifecycle: { state: 'active' } });
  assert.equal('lifecycle' in restored, false);
  assert.equal(await g(dir, 'log', '-1', '--format=%s'), 'Update project: Mine: restored');
  assert.equal(restored.wipLimit, 3);
  await workspace.createTask({ projectId: project.id, title: 'New' });
  await engine.stop();
});

test('a lifecycle change refuses a bad state, successor, field or version, and writes nothing', async () => {
  const workspace = await new Workspace({ dataDir: await tempDir('data'), operator: 'ade', email: 'ade@example.invalid' }).init();
  const project = await workspace.createProject({ name: 'Mine' });
  const dir = path.join(workspace.dataDir, 'projects', project.id);
  const head = await g(dir, 'rev-parse', 'HEAD');
  for (const [input, code] of [
    [{ version: project.version, lifecycle: { state: 'gone' } }, 'BAD_INPUT'],
    [{ version: project.version, lifecycle: 'archived' }, 'BAD_INPUT'],
    [{ version: project.version, lifecycle: { state: 'deprecated', successor: project.id } }, 'BAD_INPUT'],
    [{ version: project.version, lifecycle: { state: 'deprecated', successor: '00000000-0000-4000-8000-000000000001' } }, 'BAD_INPUT'],
    [{ version: project.version, lifecycle: { state: 'deprecated', reason: 'two\nlines' } }, undefined],
    [{ version: project.version, lifecycle: { state: 'archived' }, name: 'Also' }, 'BAD_INPUT'],
    [{ lifecycle: { state: 'archived' } }, 'BAD_INPUT'],
    [{ version: 'old', lifecycle: { state: 'archived' } }, 'STALE'],
  ]) {
    const error = await refusal(workspace.updateProject(project.id, input));
    if (code) assert.equal(error.code, code, JSON.stringify(input));
    else assert.equal(error.status, 400, JSON.stringify(input));
  }
  assert.equal(await g(dir, 'rev-parse', 'HEAD'), head);
});

test('a tracked repository that cannot be read can still be archived and restored', async () => {
  const repo = await tracked();
  const moved = `${repo.dir}-moved`;
  await rename(repo.dir, moved);
  temporary.add(moved);
  const [listed] = (await repo.workspace.read()).projects;
  assert.ok(listed.unavailable);
  const archived = await confirmed(repo.workspace, listed, { state: 'archived' });
  assert.deepEqual([archived.lifecycle.state, Boolean(archived.unavailable)], ['archived', true]);
  const restored = await repo.workspace.updateProject(repo.project.id, { version: archived.version, lifecycle: { state: 'active' } });
  assert.equal('lifecycle' in restored, false);
});

test('a lifecycle on disk that is not one AGE Aris writes reads as active', async () => {
  const repo = await tracked();
  const file = path.join(repo.dataDir, 'projects', repo.project.id, 'project.json');
  const stored = JSON.parse(await readFile(file, 'utf8'));
  await writeFile(file, JSON.stringify({ ...stored, lifecycle: { state: 'Archived' } }));
  const [listed] = (await repo.workspace.read()).projects;
  assert.equal('lifecycle' in listed, false);
  await claim(repo.workspace, repo.project, 'T001');
});

test('the brief leaves an archived project out, keeps a deprecated one\'s line without its needs, and Activity across projects leaves both out', async () => {
  const dataDir = await tempDir('brief');
  const workspace = await new Workspace({ dataDir, operator: 'ade', email: 'ade@example.invalid' }).init();
  const ids = ['Old', 'Gone', 'Live'].map((_, index) => `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`);
  for (const [index, name] of ['Old', 'Gone', 'Live'].entries()) {
    await fabricate(path.join(dataDir, 'projects', ids[index]), `day 0 08:00 ade: project {"id": "${ids[index]}", "name": "${name}", "createdAt": "2026-09-01T07:00:00Z", "wipLimit": 5}
day 2 09:00 ade: create T001 tasks "Urgent" {"priority": "urgent", "owner": "ade @agearis/web 2026-09-03 — working"}`);
  }
  const cockpit = new Cockpit({ workspace, engine: { eventsByProject: () => new Map() }, clock: () => Date.parse('2026-09-10T09:00:00Z'), buildWaitMs: 60_000 });
  const before = await cockpit.brief({});
  assert.deepEqual(before.needsYou.map((row) => row.projectName).sort(), ['Gone', 'Live', 'Old']);

  const projects = (await workspace.read()).projects;
  const of = (name) => projects.find((project) => project.name === name);
  await confirmed(workspace, of('Old'), { state: 'deprecated', successor: of('Live').id });
  await confirmed(workspace, of('Gone'), { state: 'archived' });

  const after = await cockpit.brief({});
  assert.deepEqual(after.projects.map((line) => [line.name, line.lifecycle?.state ?? 'active']), [['Old', 'deprecated'], ['Live', 'active']]);
  assert.equal(after.projects[0].lifecycle.successor, of('Live').id);
  assert.equal(after.projects[0].state, 'ready', 'a deprecated project still reads');
  assert.deepEqual(after.needsYou.map((row) => row.projectName), ['Live']);
  assert.ok(Object.values(after.delta).flat().every((item) => item.projectName === 'Live'));

  const across = await cockpit.changes({});
  assert.ok(across.changes.length);
  assert.ok(across.changes.every((change) => change.projectName === 'Live'));
  assert.ok((await cockpit.changes({ projectId: of('Gone').id })).changes.length, 'its own changes are still there');
  // Its own read-only pages still read.
  assert.ok((await cockpit.projectMetrics(of('Gone').id, {})).metrics);
});
