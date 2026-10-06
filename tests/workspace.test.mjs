import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { chmod, copyFile, mkdir, mkdtemp, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';

import {
  blockedReasonOf, DEFAULT_NEXT_DECISION, git as workspaceGit, gitStream, taskState, Workspace,
} from '../lib/workspace.mjs';

const exec = promisify(execFile);
const temporaryDirectories = new Set();

test.after(async () => {
  await Promise.all([...temporaryDirectories].map((directory) => rm(directory, { recursive: true, force: true })));
});

async function git(directory, ...args) {
  const { stdout } = await exec('git', args, {
    cwd: directory,
    env: {
      ...process.env,
      GIT_CONFIG_GLOBAL: os.devNull,
      GIT_CONFIG_NOSYSTEM: '1',
    },
  });
  return stdout.trim();
}

async function makeRepository() {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'agesight-workspace-'));
  temporaryDirectories.add(directory);
  await git(directory, 'init', '--quiet');
  await git(directory, 'config', 'user.name', 'Test Operator');
  await git(directory, 'config', 'user.email', 'test@example.invalid');
  await writeFile(path.join(directory, 'README.md'), '# Test workspace\n');
  await git(directory, 'add', 'README.md');
  await git(directory, 'commit', '--quiet', '-m', 'Initial fixture');
  return directory;
}

async function openWorkspace(directory) {
  return new Workspace({
    dataDir: directory,
    operator: 'Test Operator',
    email: 'test@example.invalid',
  }).init();
}

async function markdownFiles(directory) {
  const found = [];
  async function visit(current) {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      if (entry.name === '.git' || entry.name === 'node_modules') continue;
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) await visit(absolute);
      else if (entry.name.endsWith('.md')) found.push(absolute);
    }
  }
  await visit(directory);
  return found;
}

async function taskFile(directory, title) {
  for (const filename of await markdownFiles(directory)) {
    const contents = await readFile(filename, 'utf8');
    if (contents.includes(`title: "${title}"`) || contents.includes(`# ${title}`)) {
      return { filename, contents };
    }
  }
  assert.fail(`Could not find Markdown task titled ${title}`);
}

async function commitCount(directory) {
  return Number(await git(directory, 'rev-list', '--count', 'HEAD'));
}

function projectRepository(directory, projectId) {
  return path.join(directory, 'projects', projectId);
}

function taskByTitle(snapshot, title) {
  const task = snapshot.tasks.find((candidate) => candidate.title === title);
  assert.ok(task, `Expected task titled ${title}`);
  return task;
}

test('projects and editable tasks survive reopening the workspace', async () => {
  const directory = await makeRepository();
  const workspace = await openWorkspace(directory);

  const alpha = await workspace.createProject({
    name: 'Alpha',
    description: 'First project',
    color: '#2563eb',
    wipLimit: 4,
  });
  const beta = await workspace.createProject({
    name: 'Beta',
    description: 'Second project',
    color: '#db2777',
  });
  const alphaTask = await workspace.createTask({
    projectId: alpha.id,
    title: 'Draft launch plan',
    description: 'Write a concise launch plan.\nInclude owners.',
    priority: 'high',
    assignee: 'Ari',
    dueDate: '2027-01-15',
  });
  const betaTask = await workspace.createTask({
    projectId: beta.id,
    title: 'Interview customers',
    description: 'Talk to five teams.',
    priority: 'medium',
    assignee: '',
    dueDate: '',
  });

  assert.match(alphaTask.id, new RegExp(`^${alpha.id}:T\\d{3,}$`));
  assert.match(betaTask.id, new RegExp(`^${beta.id}:T\\d{3,}$`));
  assert.match(alpha.version, /^[0-9a-f]{64}$/);
  assert.match(beta.version, /^[0-9a-f]{64}$/);
  assert.notEqual(alphaTask.id, betaTask.id);

  const edited = await workspace.updateTask(alphaTask.id, {
    version: alphaTask.version,
    description: 'Plain text survives punctuation: <tag> & "quotes".\nSecond line.',
    assignee: 'Morgan',
  });

  const reopened = await openWorkspace(directory);
  const snapshot = await reopened.read();
  assert.equal(snapshot.projects.length, 2);
  assert.equal(snapshot.operator, 'Test Operator');
  assert.deepEqual(
    snapshot.projects.map(({ name }) => name).sort(),
    ['Alpha', 'Beta'],
  );
  assert.equal(taskByTitle(snapshot, 'Draft launch plan').description, edited.description);
  assert.equal(taskByTitle(snapshot, 'Draft launch plan').assignee, 'Morgan');
  assert.equal(taskByTitle(snapshot, 'Interview customers').projectId, beta.id);
});

test('task transitions move Markdown files, record ownership and result, and commit each mutation', async () => {
  const directory = await makeRepository();
  const workspace = await openWorkspace(directory);
  const project = await workspace.createProject({ name: 'Delivery', description: '', color: '#16a34a' });
  let task = await workspace.createTask({
    projectId: project.id,
    title: 'Ship release',
    description: 'Publish the release.',
    priority: 'urgent',
    assignee: 'Test Operator',
    dueDate: '',
  });

  let stored = await taskFile(directory, task.title);
  assert.equal(path.basename(path.dirname(stored.filename)), 'backlog');
  assert.match(stored.contents, /^status: (?:open|backlog)$/m);
  const projectDir = projectRepository(directory, project.id);
  const afterCreate = await commitCount(projectDir);

  task = await workspace.updateTask(task.id, { version: task.version, status: 'in_progress' });
  stored = await taskFile(directory, task.title);
  assert.equal(path.basename(path.dirname(stored.filename)), 'tasks');
  assert.match(stored.contents, /^status: (?:claimed|in_progress)$/m);
  assert.match(stored.contents, /^owner: "?Test Operator @agesight\/web \d{4}-\d{2}-\d{2} — working on Ship release"?$/m);
  assert.equal(await commitCount(projectDir), afterCreate + 1);

  task = await workspace.updateTask(task.id, { version: task.version, status: 'blocked' });
  stored = await taskFile(directory, task.title);
  assert.equal(path.basename(path.dirname(stored.filename)), 'tasks');
  assert.match(stored.contents, /^status: blocked$/m);
  assert.equal(await commitCount(projectDir), afterCreate + 2);

  task = await workspace.updateTask(task.id, {
    version: task.version,
    status: 'done',
  });
  stored = await taskFile(directory, task.title);
  assert.equal(path.basename(path.dirname(stored.filename)), 'done');
  assert.match(stored.contents, /^status: done$/m);
  assert.match(stored.contents, /## Result\s+\S.+/);
  assert.equal(await commitCount(projectDir), afterCreate + 3);
  assert.equal(await git(projectDir, 'status', '--porcelain'), '');
});

test('blocked work counts toward the WIP limit and prevents another claim', async () => {
  const directory = await makeRepository();
  const workspace = await openWorkspace(directory);
  const project = await workspace.createProject({
    name: 'Focused project',
    description: '',
    color: '#7c3aed',
    wipLimit: 1,
  });
  let first = await workspace.createTask({ projectId: project.id, title: 'First task' });
  const second = await workspace.createTask({ projectId: project.id, title: 'Second task' });

  first = await workspace.updateTask(first.id, { version: first.version, status: 'in_progress' });
  first = await workspace.updateTask(first.id, { version: first.version, status: 'blocked' });

  await assert.rejects(
    workspace.updateTask(second.id, { version: second.version, status: 'in_progress' }),
    /WIP|limit|in progress/i,
  );
  const snapshot = await workspace.read();
  assert.equal(taskByTitle(snapshot, 'First task').status, 'blocked');
  assert.equal(taskByTitle(snapshot, 'Second task').status, 'backlog');
});

test('stale task versions cannot overwrite a newer save', async () => {
  const directory = await makeRepository();
  const workspace = await openWorkspace(directory);
  const project = await workspace.createProject({ name: 'Concurrency', description: '', color: '#0891b2' });
  const original = await workspace.createTask({ projectId: project.id, title: 'Shared task' });

  const projectDir = projectRepository(directory, project.id);
  const beforeUnchangedSave = await commitCount(projectDir);
  const unchanged = await workspace.updateTask(original.id, { version: original.version });
  assert.equal(unchanged.version, original.version);
  assert.equal(unchanged.updatedAt, original.updatedAt);
  assert.equal(await commitCount(projectDir), beforeUnchangedSave);

  const current = await workspace.updateTask(unchanged.id, {
    version: unchanged.version,
    description: 'First writer won.',
  });
  await assert.rejects(
    workspace.updateTask(original.id, {
      version: original.version,
      description: 'Stale writer tried to replace it.',
    }),
    (error) => error?.status === 409 && /changed|refresh|stale|version|conflict/i.test(error.message),
  );

  const snapshot = await workspace.read();
  assert.equal(taskByTitle(snapshot, 'Shared task').description, 'First writer won.');
  assert.equal(taskByTitle(snapshot, 'Shared task').version, current.version);
});

test('invalid names, paths, enums, dates, and references are rejected without writes', async () => {
  const directory = await makeRepository();
  const workspace = await openWorkspace(directory);
  const project = await workspace.createProject({ name: 'Validation', description: '', color: '#ea580c' });
  const task = await workspace.createTask({ projectId: project.id, title: 'Valid task' });
  const projectDir = projectRepository(directory, project.id);
  const before = await commitCount(projectDir);

  const invalidActions = [
    () => workspace.createProject({ name: '', description: '', color: '#000000' }),
    () => workspace.createTask({ projectId: project.id, title: '' }),
    () => workspace.createTask({ projectId: project.id, title: 'Bad priority', priority: 'critical' }),
    () => workspace.createTask({ projectId: project.id, title: 'Bad date', dueDate: '2027-02-30' }),
    () => workspace.updateProject(project.id, { description: 'Missing version' }),
    () => workspace.createTask({ projectId: '../outside', title: 'Wrong project' }),
    () => workspace.updateTask('../outside:T999', { version: task.version, status: 'done' }),
    () => workspace.updateTask(task.id, { version: task.version, status: 'paused' }),
  ];

  for (const action of invalidActions) await assert.rejects(action);
  assert.equal(await commitCount(projectDir), before);
  assert.equal((await workspace.read()).tasks.length, 1);
  assert.equal(await git(projectDir, 'status', '--porcelain'), '');
});

test('directory placement is authoritative and duplicate task ids are rejected', async () => {
  const directory = await makeRepository();
  const workspace = await openWorkspace(directory);
  const project = await workspace.createProject({ name: 'Imported board', wipLimit: 1 });
  const task = await workspace.createTask({ projectId: project.id, title: 'Externally moved task' });
  const waiting = await workspace.createTask({ projectId: project.id, title: 'Waiting task' });
  let stored = await taskFile(directory, task.title);

  await writeFile(stored.filename, stored.contents.replace(/^status: open$/m, 'status: killed'));
  assert.equal(taskByTitle(await workspace.read(), task.title).status, 'backlog');

  const activePath = path.join(path.dirname(path.dirname(stored.filename)), 'tasks', path.basename(stored.filename));
  await rename(stored.filename, activePath);
  assert.equal(taskByTitle(await workspace.read(), task.title).status, 'in_progress');
  await assert.rejects(
    workspace.updateTask(waiting.id, { version: waiting.version, status: 'in_progress' }),
    /WIP|limit/i,
  );

  const duplicatePath = path.join(path.dirname(activePath), 'T001-duplicate.md');
  await copyFile(activePath, duplicatePath);
  await assert.rejects(
    workspace.read(),
    (error) => error?.status === 500 && /duplicate|T001/i.test(error.message),
  );
});

test('Markdown-like descriptions round-trip and unchanged project saves succeed', async () => {
  const directory = await makeRepository();
  const workspace = await openWorkspace(directory);
  const project = await workspace.createProject({
    name: 'Writing',
    description: 'Keep this description',
    color: '#334155',
    wipLimit: 3,
  });
  const projectDir = projectRepository(directory, project.id);
  const beforeUnchangedSave = await commitCount(projectDir);
  const unchanged = await workspace.updateProject(project.id, {
    version: project.version,
    name: project.name,
    description: project.description,
    color: project.color,
    wipLimit: project.wipLimit,
  });
  assert.deepEqual(unchanged, project);
  assert.equal(await commitCount(projectDir), beforeUnchangedSave);

  const initialDescription = 'Introduction\n\n## A heading\n\nContent under the heading.';
  let task = await workspace.createTask({
    projectId: project.id,
    title: 'Preserve structured text',
    description: initialDescription,
  });
  assert.equal(task.description, initialDescription);
  assert.equal(taskByTitle(await workspace.read(), task.title).description, initialDescription);

  const editedDescription = 'Updated introduction\n\n## Another heading\n\nLiteral replacement text: $&.';
  task = await workspace.updateTask(task.id, { version: task.version, description: editedDescription });
  assert.equal(task.description, editedDescription);
  const reopened = await openWorkspace(directory);
  assert.equal(taskByTitle(await reopened.read(), task.title).description, editedDescription);
});

test('task updates preserve manually maintained STATE content and use template-compatible config', async () => {
  const directory = await makeRepository();
  const workspace = await openWorkspace(directory);
  const project = await workspace.createProject({ name: 'Manual state', wipLimit: 2 });
  const projectDir = projectRepository(directory, project.id);
  const statePath = path.join(projectDir, 'deaddrop', 'STATE.md');
  const configPath = path.join(projectDir, 'deaddrop', 'deaddrop.yml');
  const original = await readFile(statePath, 'utf8');
  const manualNow = '<!-- deaddrop:now -->\nManual standing and next action.\n<!-- /deaddrop:now -->';
  const customized = `Manual preface that belongs to the operator.\n\n${original.replace(/<!-- deaddrop:now -->[\s\S]*?<!-- \/deaddrop:now -->/, manualNow)}\nManual footer that must survive.\n`;
  await writeFile(statePath, customized);

  let task = await workspace.createTask({ projectId: project.id, title: 'Refresh generated rows' });
  task = await workspace.updateTask(task.id, { version: task.version, status: 'in_progress' });
  const updatedState = await readFile(statePath, 'utf8');
  assert.match(updatedState, /^Manual preface that belongs to the operator\./);
  assert.ok(updatedState.includes(manualNow));
  assert.match(updatedState, /Manual footer that must survive\.\s*$/);
  assert.match(updatedState, /\| T001 \| Refresh generated rows \| in_progress \|/);

  const config = await readFile(configPath, 'utf8');
  assert.match(config, /^spend:\s*$/m);
  assert.match(config, /^wip:\s*$/m);
  assert.match(config, /^\s+in_progress: 2$/m);
  assert.match(config, /^\s+blocked: \d+$/m);
  assert.match(config, /^stale_hours: 24$/m);
  assert.match(config, /^log: /m);
  assert.match(config, /^map: /m);
  assert.match(config, /^id_prefix: T$/m);
});

test('external project metadata edits reject stale project saves', async () => {
  const directory = await makeRepository();
  const workspace = await openWorkspace(directory);
  const project = await workspace.createProject({ name: 'Shared metadata', description: 'Original' });
  const metadataPath = path.join(projectRepository(directory, project.id), 'project.json');
  const externallyEdited = JSON.parse(await readFile(metadataPath, 'utf8'));
  externallyEdited.description = 'Edited outside AGESight';
  await writeFile(metadataPath, `${JSON.stringify(externallyEdited, null, 2)}\n`);

  await assert.rejects(
    workspace.updateProject(project.id, { version: project.version, description: 'Stale overwrite' }),
    (error) => error?.status === 409 && /changed|refresh|stale|version|conflict/i.test(error.message),
  );
  const current = (await workspace.read()).projects.find(candidate => candidate.id === project.id);
  assert.equal(current.description, 'Edited outside AGESight');
  assert.notEqual(current.version, project.version);
});

test('a project directory without its own Git repository is rejected', async () => {
  const directory = await makeRepository();
  const workspace = await openWorkspace(directory);
  const project = await workspace.createProject({ name: 'Detached Git project' });
  await rm(path.join(projectRepository(directory, project.id), '.git'), { recursive: true, force: true });

  await assert.rejects(
    workspace.read(),
    (error) => error?.status === 500 && /Git|repository|worktree/i.test(error.message),
  );
});

test('reads started after queued mutations observe the completed mutations', async () => {
  const directory = await makeRepository();
  const workspace = await openWorkspace(directory);

  const firstCreation = workspace.createProject({ name: 'Queued first' });
  const secondCreation = workspace.createProject({ name: 'Queued second' });
  const readStartedAfterBoth = workspace.read();
  const [first, second, snapshot] = await Promise.all([firstCreation, secondCreation, readStartedAfterBoth]);

  assert.deepEqual(
    snapshot.projects.map(project => project.id).sort(),
    [first.id, second.id].sort(),
  );
});

// --- S1: task type and blocked reason, ids, trailers, settings, gitStream -------

async function collect(stream) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return chunks;
}

async function expectRejected(promise, status, pattern) {
  await assert.rejects(promise, (error) => {
    assert.equal(error?.status, status, `Expected ${status}, got ${error?.status}: ${error?.message}`);
    if (pattern) assert.match(error.message, pattern);
    return true;
  });
}

test('task type round-trips, including a free-text value, and invalid values are rejected without writes', async () => {
  const directory = await makeRepository();
  const workspace = await openWorkspace(directory);
  const project = await workspace.createProject({ name: 'Types' });
  const projectDir = projectRepository(directory, project.id);
  let task = await workspace.createTask({ projectId: project.id, title: 'Typed task', type: 'analysis' });
  assert.equal(task.type, 'analysis');
  assert.match((await taskFile(directory, task.title)).contents, /^type: "analysis"$/m);
  assert.equal((await workspace.getTask(task.id)).type, 'analysis');
  assert.equal(taskByTitle(await workspace.read(), task.title).type, 'analysis');

  task = await workspace.updateTask(task.id, { version: task.version, type: 'bug' });
  assert.equal(task.type, 'bug');
  const reopened = await openWorkspace(directory);
  assert.equal((await reopened.getTask(task.id)).type, 'bug');
  assert.equal((await workspace.createTask({ projectId: project.id, title: 'Untyped task' })).type, '');

  const before = await commitCount(projectDir);
  await expectRejected(workspace.updateTask(task.id, { version: task.version, type: 'x'.repeat(41) }), 400, /type must be at most 40/);
  await expectRejected(workspace.updateTask(task.id, { version: task.version, type: 'two\nlines' }), 400, /type must be a single line/);
  await expectRejected(workspace.createTask({ projectId: project.id, title: 'Too long', type: 'y'.repeat(41) }), 400, /type/);
  await expectRejected(workspace.createTask({ projectId: project.id, title: 'Two lines', type: 'a\rb' }), 400, /single line/);
  assert.equal((await workspace.updateTask(task.id, { version: task.version, type: 'z'.repeat(40) })).type, 'z'.repeat(40), '40 characters is allowed');
  assert.equal(await commitCount(projectDir), before + 1);
});

test('a blocked reason is kept while blocked and cleared when the task leaves blocked', async () => {
  const directory = await makeRepository();
  const workspace = await openWorkspace(directory);
  const project = await workspace.createProject({ name: 'Blocking' });
  let task = await workspace.createTask({ projectId: project.id, title: 'Waiting on access', status: 'blocked', blockedReason: 'API key from Ops' });
  assert.equal(task.status, 'blocked');
  assert.equal(task.blockedReason, 'API key from Ops');

  task = await workspace.updateTask(task.id, { version: task.version, blockedReason: 'Ops is on holiday until Monday' });
  assert.equal(task.blockedReason, 'Ops is on holiday until Monday');
  await expectRejected(workspace.updateTask(task.id, { version: task.version, blockedReason: 'r'.repeat(201) }), 400, /blockedReason must be at most 200/);
  await expectRejected(workspace.updateTask(task.id, { version: task.version, blockedReason: 'one\ntwo' }), 400, /single line/);

  task = await workspace.updateTask(task.id, { version: task.version, status: 'in_progress', blockedReason: 'ignored outside blocked' });
  assert.equal(task.blockedReason, '');
  assert.match((await taskFile(directory, task.title)).contents, /^blockedReason: ""$/m);
  const projectDir = projectRepository(directory, project.id);
  assert.match(await git(projectDir, 'log', '-p', '-1', '--format=', '--', 'deaddrop/tasks'), /^-blockedReason: "Ops is on holiday until Monday"$/m, 'git keeps the cleared reason');

  task = await workspace.updateTask(task.id, { version: task.version, status: 'blocked' });
  assert.equal(task.blockedReason, '');
  task = await workspace.updateTask(task.id, { version: task.version, status: 'done' });
  assert.equal(task.blockedReason, '');
  const backlog = await workspace.createTask({ projectId: project.id, title: 'Not blocked', blockedReason: 'nothing to see' });
  assert.equal(backlog.blockedReason, '', 'a task that is not blocked stores no reason');
});

test('task files written before type and blockedReason read with defaults and gain the keys on their next edit', async () => {
  const directory = await makeRepository();
  const workspace = await openWorkspace(directory);
  const project = await workspace.createProject({ name: 'Legacy' });
  const created = await workspace.createTask({ projectId: project.id, title: 'Old task' });
  const projectDir = projectRepository(directory, project.id);
  const { filename, contents } = await taskFile(directory, created.title);
  const legacy = contents.replace(/^type: .*\n/m, '').replace(/^blockedReason: .*\n/m, '');
  assert.doesNotMatch(legacy, /^(type|blockedReason):/m);
  await writeFile(filename, legacy);
  await git(projectDir, 'commit', '--quiet', '-am', 'Legacy task file');

  let task = await workspace.getTask(created.id);
  assert.equal(task.type, '');
  assert.equal(task.blockedReason, '');
  task = await workspace.updateTask(task.id, { version: task.version, title: 'Old task, renamed' });
  const after = await taskFile(directory, task.title);
  assert.match(after.contents, /^type: ""$/m);
  assert.match(after.contents, /^blockedReason: ""$/m);

  // A hand-written template placeholder is kept as written and never blocks an edit.
  const placeholder = after.contents.replace(/^type: ""$/m, 'type: {{any single word; tasks of one type are timed together; `bug` is counted\n  as defect work; leave this placeholder or delete the line for untyped}}');
  await writeFile(after.filename, placeholder);
  await git(projectDir, 'commit', '--quiet', '-am', 'Template placeholder');
  task = await workspace.getTask(task.id);
  assert.match(task.type, /^\{\{any single word/);
  task = await workspace.updateTask(task.id, { version: task.version, type: task.type, priority: 'high' });
  assert.equal(task.priority, 'high');
  assert.match((await taskFile(directory, task.title)).contents, /^type: \{\{any single word.*\n {2}as defect work/m, 'the placeholder line is untouched');
});

test('a new task id is above every id ever used, including deleted tasks', async () => {
  const directory = await makeRepository();
  const workspace = await openWorkspace(directory);
  const project = await workspace.createProject({ name: 'Ids' });
  const projectDir = projectRepository(directory, project.id);
  for (const title of ['One', 'Two', 'Three']) await workspace.createTask({ projectId: project.id, title });
  const third = await taskFile(directory, 'Three');
  assert.match(path.basename(third.filename), /^T003-/);
  await git(projectDir, 'rm', '--quiet', path.relative(projectDir, third.filename));
  await git(projectDir, 'commit', '--quiet', '-m', 'Delete T003 by hand');

  const next = await workspace.createTask({ projectId: project.id, title: 'Four' });
  assert.equal(next.id, `${project.id}:T004`);

  // A retired checkpoint trail holds its id too.
  await mkdir(path.join(projectDir, 'deaddrop', 'checkpoints'), { recursive: true });
  await writeFile(path.join(projectDir, 'deaddrop', 'checkpoints', 'T009.jsonl'), '{"ts":"2026-10-01T09:00:00Z","run":"r","kind":"open"}\n');
  await git(projectDir, 'add', 'deaddrop/checkpoints/T009.jsonl');
  await git(projectDir, 'commit', '--quiet', '-m', 'ckpt: T009');
  await git(projectDir, 'rm', '--quiet', 'deaddrop/checkpoints/T009.jsonl');
  await git(projectDir, 'commit', '--quiet', '-m', 'ckpt: retire T009');
  assert.equal((await workspace.createTask({ projectId: project.id, title: 'Five' })).id, `${project.id}:T010`);
});

test('commits carry the trailers they are given and every commit notifies the commit listeners', async () => {
  const directory = await makeRepository();
  const workspace = await openWorkspace(directory);
  const seen = [];
  const stop = workspace.onCommit((projectId) => seen.push(projectId));
  workspace.onCommit(() => { throw new Error('a broken listener'); });
  const ui = { trailers: { 'AGESight-Via': 'ui' } };
  const project = await workspace.createProject({ name: 'Trailers' }, ui);
  const projectDir = projectRepository(directory, project.id);
  const lastMessage = () => git(projectDir, 'log', '-1', '--format=%B');
  assert.match(await lastMessage(), /^Create project: Trailers\n\nAGESight-Via: ui$/);
  const task = await workspace.createTask({ projectId: project.id, title: 'Trailer task' }, { trailers: { Run: 'R001' } });
  assert.match(await lastMessage(), /^Create T001: Trailer task\n\nRun: R001$/);
  assert.equal(await git(projectDir, 'log', '-1', '--format=%(trailers:key=Run,valueonly)'), 'R001');
  await workspace.updateTask(task.id, { version: task.version, title: 'Plain update' });
  assert.equal(await lastMessage(), 'Update T001: Plain update');
  assert.deepEqual(seen, [project.id, project.id, project.id]);

  stop();
  const current = await workspace.getTask(task.id);
  await workspace.updateTask(task.id, { version: current.version, title: 'Unheard' });
  assert.equal(seen.length, 3, 'a removed listener is not called');
  const unchanged = await workspace.getTask(task.id);
  await expectRejected(workspace.updateTask(task.id, { version: unchanged.version, title: 'Bad trailer' }, { trailers: { Run: 'R1\nInjected: yes' } }), 500, /Invalid commit trailer/);
  assert.equal((await workspace.getTask(task.id)).title, 'Unheard', 'a refused commit leaves the task as it was');
  assert.equal(await git(projectDir, 'status', '--porcelain'), '');
});

test('commit listeners receive the committed paths, and a listener that rejects is contained', async (t) => {
  const directory = await makeRepository();
  const workspace = await openWorkspace(directory);
  const seen = [];
  workspace.onCommit((projectId, { paths }) => seen.push(paths));
  workspace.onCommit(async () => { throw new Error('an async listener failed'); });
  const unhandled = [];
  const onUnhandled = (reason) => unhandled.push(reason);
  process.on('unhandledRejection', onUnhandled);
  t.after(() => process.off('unhandledRejection', onUnhandled));
  const project = await workspace.createProject({ name: 'Paths' });
  const task = await workspace.createTask({ projectId: project.id, title: 'Path task' });
  await workspace.updateTask(task.id, { version: task.version, status: 'in_progress' });
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(seen, [
    ['project.json', 'deaddrop'],
    ['deaddrop/backlog/T001-path-task.md', 'deaddrop/STATE.md'],
    ['deaddrop/backlog/T001-path-task.md', 'deaddrop/tasks/T001-path-task.md', 'deaddrop/STATE.md'],
  ]);
  assert.deepEqual(unhandled, [], 'a rejected listener promise never becomes an unhandled rejection');
});

test('single-line fields refuse U+0085, U+2028, and U+2029, which would end the frontmatter line', async () => {
  const directory = await makeRepository();
  const workspace = await openWorkspace(directory);
  const project = await workspace.createProject({ name: 'Separators' });
  const projectDir = projectRepository(directory, project.id);
  const task = await workspace.createTask({ projectId: project.id, title: 'Plain' });
  const before = await commitCount(projectDir);
  await expectRejected(workspace.createTask({ projectId: project.id, title: 'Line\u2028separator' }), 400, /title must be a single line/);
  await expectRejected(workspace.updateTask(task.id, { version: task.version, assignee: 'Ana\u2029Ben' }), 400, /assignee must be a single line/);
  await expectRejected(workspace.updateTask(task.id, { version: task.version, type: 'bug\u0085x' }), 400, /type must be a single line/);
  await expectRejected(workspace.updateTask(task.id, { version: task.version, status: 'blocked', blockedReason: 'a\u2028b' }), 400, /blockedReason must be a single line/);
  await expectRejected(workspace.createProject({ name: 'Name\u2028two' }), 400, /name must be a single line/);
  assert.equal(await commitCount(projectDir), before);
  assert.equal((await workspace.getTask(task.id)).title, 'Plain');
});

test('blocked-reason fallback: field, then the newest blocked checkpoint, then the Handoff, then no reason', () => {
  const handoff = (next) => `# T001 — Task\n\n## Goal\n\nX\n\n## Handoff — state at last stop\n\n- **Last touched:** 2026-10-01\n- **Next decision:** ${next}\n\n## Verify\n\nY\n`;
  const blocked = (what, ts = '2026-10-02T09:00:00Z') => JSON.stringify({ ts, run: 'e857a8c8', kind: 'blocked', what, unblocks: 'later', next: 'wait' });
  const trail = [
    JSON.stringify({ ts: '2026-10-01T09:00:00Z', run: 'e857a8c8', kind: 'open' }),
    blocked('card busy with T038', '2026-10-01T10:00:00Z'),
    '{"half written',
    blocked('waiting on the GPU quota'),
    JSON.stringify({ ts: '2026-10-02T10:00:00Z', run: 'e857a8c8', kind: 'did', what: 'not a block' }),
  ].join('\n');

  assert.deepEqual(blockedReasonOf({ body: handoff(DEFAULT_NEXT_DECISION) }), { text: 'No reason given', source: 'none' }, 'AGESight boilerplate only');
  assert.deepEqual(blockedReasonOf({ body: handoff('{{what the resuming session has to choose, if anything}}') }), { text: 'No reason given', source: 'none' }, 'a template placeholder is skipped');
  assert.deepEqual(blockedReasonOf({ trail, body: handoff('Pick a vendor') }), { text: 'waiting on the GPU quota', source: 'checkpoint' });
  assert.deepEqual(blockedReasonOf({ body: handoff('Pick a vendor for the importer') }), { text: 'Pick a vendor for the importer', source: 'handoff' });
  assert.deepEqual(blockedReasonOf({ blockedReason: 'Legal review of the contract', trail, body: handoff('Pick a vendor') }), { text: 'Legal review of the contract', source: 'blockedReason' });

  for (const empty of ['', '   ', 'nothing', 'Nothing', '—', '-', '{{reason}}', DEFAULT_NEXT_DECISION]) {
    assert.equal(blockedReasonOf({ blockedReason: empty, body: handoff('Use the handoff') }).source, 'handoff', `blockedReason ${JSON.stringify(empty)} is skipped`);
    assert.equal(blockedReasonOf({ trail: blocked(empty), body: handoff('Use the handoff') }).source, 'handoff', `checkpoint ${JSON.stringify(empty)} is skipped`);
    assert.equal(blockedReasonOf({ body: handoff(empty) }).source, 'none', `Next decision ${JSON.stringify(empty)} is skipped`);
  }
  assert.equal(blockedReasonOf({ trail: `${blocked('older reason')}\n${blocked('nothing')}`, body: '' }).source, 'none', 'only the newest blocked line is read');
  assert.deepEqual(blockedReasonOf(), { text: 'No reason given', source: 'none' });
});

test('the state rule follows the directory, refined by the stored status', () => {
  assert.equal(taskState('backlog', 'blocked'), 'backlog');
  assert.equal(taskState('tasks', 'claimed'), 'in_progress');
  assert.equal(taskState('tasks', 'blocked'), 'blocked');
  assert.equal(taskState('done', 'done'), 'done');
  assert.equal(taskState('done', 'killed'), 'dropped');
});

test('workspace settings read with defaults, take the file values, and refuse invalid values', async () => {
  const directory = await makeRepository();
  const workspace = await openWorkspace(directory);
  const file = path.join(directory, 'settings.json');
  const defaults = await workspace.readSettings();
  assert.deepEqual(defaults, {
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    workdays: [1, 2, 3, 4, 5],
    personalWipLimit: 3,
    deltaFallback: 'previous-workday',
    version: 'default',
  });

  await writeFile(file, JSON.stringify({ timezone: 'America/New_York' }));
  const partial = await workspace.readSettings();
  assert.equal(partial.timezone, 'America/New_York');
  assert.deepEqual(partial.workdays, [1, 2, 3, 4, 5], 'a missing key takes its default');
  assert.match(partial.version, /^[0-9a-f]{64}$/);

  await writeFile(file, JSON.stringify({ timezone: 'UTC', workdays: [4, 1, 2, 3, 1], personalWipLimit: 5, deltaFallback: '7d' }));
  const full = await workspace.readSettings();
  assert.deepEqual({ ...full, version: undefined }, { timezone: 'UTC', workdays: [1, 2, 3, 4], personalWipLimit: 5, deltaFallback: '7d', version: undefined });
  assert.notEqual(full.version, partial.version);

  for (const [value, pattern] of [
    [{ timezone: 'Mars/Olympus' }, /timezone/],
    [{ workdays: [] }, /workdays/],
    [{ workdays: [0, 1] }, /workdays/],
    [{ personalWipLimit: 0 }, /personalWipLimit/],
    [{ deltaFallback: 'yesterday' }, /deltaFallback/],
  ]) {
    await writeFile(file, JSON.stringify(value));
    await expectRejected(workspace.readSettings(), 500, pattern);
  }
  await writeFile(file, '{ not json');
  await expectRejected(workspace.readSettings(), 500, /not valid JSON/);
  await writeFile(file, '[1]');
  await expectRejected(workspace.readSettings(), 500, /JSON object/);
});

test('gitStream returns a 1.5 MiB blob byte-identical, in more than one chunk', async () => {
  const directory = await makeRepository();
  const blob = randomBytes(1.5 * 1024 * 1024);
  await writeFile(path.join(directory, 'big.bin'), blob);
  await git(directory, 'add', 'big.bin');
  await git(directory, 'commit', '--quiet', '-m', 'Add a large blob');
  const chunks = await collect(gitStream(directory, ['cat-file', 'blob', 'HEAD:big.bin']));
  assert.ok(chunks.length > 1, 'the output arrives as a stream of chunks');
  assert.ok(chunks.every((chunk) => Buffer.isBuffer(chunk)));
  assert.ok(Buffer.concat(chunks).equals(blob));
});

test('gitStream keeps multi-byte characters intact across chunk boundaries and writes its input to stdin', async () => {
  const directory = await makeRepository();
  const text = 'Café 日本 🚀\n'.repeat(100000);
  await writeFile(path.join(directory, 'unicode.txt'), text);
  await git(directory, 'add', 'unicode.txt');
  await git(directory, 'commit', '--quiet', '-m', 'Add Unicode text');
  const chunks = await collect(gitStream(directory, ['cat-file', '--batch'], { input: 'HEAD:unicode.txt\n' }));
  const output = Buffer.concat(chunks);
  const header = output.indexOf(0x0a);
  assert.match(output.subarray(0, header).toString('utf8'), /^[0-9a-f]{40} blob \d+$/);
  const size = Number(/ (\d+)$/.exec(output.subarray(0, header).toString('utf8'))[1]);
  assert.equal(size, Buffer.byteLength(text));
  assert.equal(output.subarray(header + 1, header + 1 + size).toString('utf8'), text);
  const split = chunks.slice(0, -1).some((chunk, index) => (chunks[index + 1][0] & 0xc0) === 0x80 && chunk.at(-1) >= 0x80);
  assert.ok(split, 'at least one chunk boundary falls inside a multi-byte character');
});

test('gitStream reports git failures with redacted stderr and stops git when the consumer stops early', async () => {
  const directory = await makeRepository();
  await expectRejected(collect(gitStream(directory, ['cat-file', 'blob', 'HEAD:missing@example.invalid'])), 500, /Git operation failed: .*\[email redacted\]/);
  const stream = gitStream(directory, ['log', '--format=%H']);
  for await (const chunk of stream) { assert.ok(chunk.length); break; }
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(collect(gitStream(directory, ['log'], { signal: controller.signal })), { name: 'AbortError' });
});

test('gitStream never runs repository hooks or an fsmonitor, which a plain git would', async () => {
  const directory = await makeRepository();
  const marker = path.join(path.dirname(directory), `${path.basename(directory)}-hook-marker`);
  temporaryDirectories.add(marker);
  const hooks = path.join(directory, '.git', 'hooks');
  await mkdir(hooks, { recursive: true });
  const script = `#!/bin/sh\necho "$0" >> '${marker}'\nexit 0\n`;
  for (const name of ['pre-commit', 'commit-msg', 'post-commit', 'reference-transaction']) {
    await writeFile(path.join(hooks, name), script);
    await chmod(path.join(hooks, name), 0o755);
  }
  const fsmonitor = path.join(directory, '.git', 'fsmonitor-hook');
  await writeFile(fsmonitor, `#!/bin/sh\necho fsmonitor >> '${marker}'\nexit 1\n`);
  await chmod(fsmonitor, 0o755);
  await git(directory, 'config', 'core.fsmonitor', fsmonitor);

  // The same commands through plain git do run them, so the check below means something.
  await git(directory, 'commit', '--quiet', '--allow-empty', '-m', 'Plain commit');
  await git(directory, 'status', '--porcelain');
  assert.match(await readFile(marker, 'utf8'), /post-commit[\s\S]*fsmonitor/);
  await rm(marker);

  await collect(gitStream(directory, ['commit', '--quiet', '--allow-empty', '-m', 'Hardened commit']));
  await collect(gitStream(directory, ['status', '--porcelain']));
  assert.equal(await git(directory, 'log', '-1', '--format=%s'), 'Hardened commit');
  await assert.rejects(stat(marker), { code: 'ENOENT' }, 'no hook or fsmonitor ran');
});

test('git accepts extra environment variables', async () => {
  const directory = await makeRepository();
  workspaceGit(directory, ['commit', '--quiet', '--allow-empty', '-m', 'Dated'], { env: { GIT_COMMITTER_DATE: '2026-10-01T09:00:00+01:00' } });
  assert.equal(await git(directory, 'log', '-1', '--format=%cI'), '2026-10-01T09:00:00+01:00');
});

test('the async repository check passes a valid repository, is cached until .git changes, and rejects a foreign root', async () => {
  const directory = await makeRepository();
  const workspace = await openWorkspace(directory);
  const project = await workspace.createProject({ name: 'Async check' });
  const projectDir = projectRepository(directory, project.id);
  await workspace._verifyProjectRepoAsync(projectDir);

  const path0 = process.env.PATH;
  try {
    process.env.PATH = '';
    await workspace._verifyProjectRepoAsync(projectDir);
    await writeFile(path.join(projectDir, '.git', 'touched'), '');
    await expectRejected(workspace._verifyProjectRepoAsync(projectDir), 500, /Git could not run/);
  } finally {
    process.env.PATH = path0;
  }
  await workspace._verifyProjectRepoAsync(projectDir);

  const nested = path.join(projectDir, 'nested');
  await mkdir(path.join(nested, '.git'), { recursive: true });
  await expectRejected(workspace._verifyProjectRepoAsync(nested), 500, /root does not match|Git operation failed/);
  await expectRejected(workspace._verifyProjectRepoAsync(path.join(projectDir, 'missing')), 500, /missing/);
});
