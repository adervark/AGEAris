import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import {
  chmod, copyFile, mkdir, mkdtemp, readFile, readdir, readlink, realpath, rename, rm, stat, symlink, writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';

import {
  blockedReasonOf, boardPolicy, DEFAULT_NEXT_DECISION, git as workspaceGit, gitStream, statusWord, taskState, Workspace,
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
  externallyEdited.description = 'Edited outside AgeAris';
  await writeFile(metadataPath, `${JSON.stringify(externallyEdited, null, 2)}\n`);

  await assert.rejects(
    workspace.updateProject(project.id, { version: project.version, description: 'Stale overwrite' }),
    (error) => error?.status === 409 && /changed|refresh|stale|version|conflict/i.test(error.message),
  );
  const current = (await workspace.read()).projects.find(candidate => candidate.id === project.id);
  assert.equal(current.description, 'Edited outside AgeAris');
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

  assert.deepEqual(blockedReasonOf({ body: handoff(DEFAULT_NEXT_DECISION) }), { text: 'No reason given', source: 'none' }, 'AgeAris boilerplate only');
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

// --- tracked repositories: status words, board policy, link and unlink ------------

const AGENT_CLAIM = 'ade @k/e857a8c8 2026-10-01 — importer';

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// A task file as a board AgeAris did not write keeps it: the keys given, in
// that order, values written verbatim.
function boardTask(id, title, fields = {}) {
  const header = Object.entries({ id, title, ...fields }).map(([key, value]) => `${key}: ${value}`).join('\n');
  return `---\n${header}\n---\n\n# ${id} — ${title}\n\n## Goal\n\nWork tracked outside AgeAris.\n`;
}

// A git repository outside the data folder, as an agent team keeps it: a
// README and `files` (relative path → content), committed. Returns its real path.
async function makeTrackedRepository(files = {}) {
  const directory = await realpath(await mkdtemp(path.join(os.tmpdir(), 'agesight-tracked-')));
  temporaryDirectories.add(directory);
  await git(directory, 'init', '--quiet');
  await git(directory, 'config', 'user.name', 'Repository Owner');
  await git(directory, 'config', 'user.email', 'owner@example.invalid');
  for (const [name, content] of Object.entries({ 'README.md': '# Their project\n', ...files })) {
    await mkdir(path.dirname(path.join(directory, name)), { recursive: true });
    await writeFile(path.join(directory, name), content);
  }
  await git(directory, 'add', '-A');
  await git(directory, 'commit', '--quiet', '-m', 'Their first commit');
  return directory;
}

async function scratchFolder() {
  const directory = await realpath(await mkdtemp(path.join(os.tmpdir(), 'agesight-scratch-')));
  temporaryDirectories.add(directory);
  return directory;
}

// HEAD, git status, and every file outside .git with its content (a symlink
// as its target): equal before and after means AgeAris changed nothing.
async function repositoryState(directory) {
  const files = {};
  async function visit(current) {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      if (entry.name === '.git') continue;
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) await visit(absolute);
      else files[path.relative(directory, absolute)] = entry.isSymbolicLink() ? `-> ${await readlink(absolute)}` : await readFile(absolute, 'utf8');
    }
  }
  await visit(directory);
  return {
    head: await git(directory, 'rev-parse', 'HEAD'),
    status: await git(directory, 'status', '--porcelain', '--untracked-files=all'),
    files,
  };
}

// A board under its older name, pm/, from before backlog/ existed: unclaimed
// work waits in tasks/ marked `status: open`, and status lines carry notes.
function legacyBoard() {
  return {
    'pm/deaddrop.yml': 'wip:\n  in_progress: 4  # four agents\n  blocked: 2\nstale_hours: 12\n',
    'pm/tasks/T001-write-the-importer.md': boardTask('T001', 'Write the importer', { status: 'open', owner: '—', priority: 'high' }),
    'pm/tasks/T002-parse-dates.md': boardTask('T002', 'Parse dates', { status: '**claimed**', owner: AGENT_CLAIM, priority: 'High' }),
    'pm/tasks/T003-load-the-archive.md': boardTask('T003', 'Load the archive', { status: 'blocked — waiting on the archive key', owner: AGENT_CLAIM }),
    'pm/tasks/T004-review-the-schema.md': boardTask('T004', 'Review the schema', { status: 'In progress', owner: 'ana', priority: 'critical' }),
    'pm/tasks/T005-try-a-faster-parser.md': boardTask('T005', 'Try a faster parser', { status: 'unclaimed' }),
    'pm/tasks/T006-tidy-the-logs.md': boardTask('T006', 'Tidy the logs', { status: '' }),
    'pm/tasks/done/T007-set-up-ci.md': boardTask('T007', 'Set up CI', { status: 'done — green on main' }),
    'pm/tasks/done/T008-drop-xml.md': boardTask('T008', 'Drop XML', { status: 'killed — superseded by T001' }),
  };
}

function tasksOf(snapshot, projectId) {
  return Object.fromEntries(snapshot.tasks.filter((task) => task.projectId === projectId).map((task) => [task.id.split(':').at(-1), task]));
}

test('statusWord reads the first lowercase word of a status line, and in progress in any spelling is in_progress', () => {
  assert.equal(statusWord('**claimed**'), 'claimed');
  assert.equal(statusWord('done — out of memory'), 'done');
  assert.equal(statusWord('  Blocked: waiting on the key'), 'blocked');
  assert.equal(statusWord('KILLED'), 'killed');
  for (const spelling of ['in progress', 'in-progress', 'in_progress', 'In Progress', '**in progress** since Monday']) {
    assert.equal(statusWord(spelling), 'in_progress', spelling);
  }
  assert.equal(statusWord('inprogress'), 'inprogress', 'only a space, hyphen, or underscore joins the two words');
  for (const empty of ['', '—', '42', undefined, null]) assert.equal(statusWord(empty), '', JSON.stringify(empty));
});

test('the state rule: in tasks/, an unclaimed status is backlog only on a board without backlog/; blocked is blocked, and any other word is in progress', () => {
  for (const unclaimed of ['', 'open', 'unclaimed', 'backlog', 'Open — nobody yet', undefined]) {
    assert.equal(taskState('tasks', unclaimed, { backlogFolder: false }), 'backlog', JSON.stringify(unclaimed));
    assert.equal(taskState('tasks', unclaimed), 'in_progress', `${JSON.stringify(unclaimed)} where backlog/ exists, as board.sh reads it`);
  }
  assert.equal(taskState('tasks', 'blocked — waiting on the archive key'), 'blocked');
  for (const working of ['claimed', '**claimed**', 'in progress', 'review', 'killed']) {
    assert.equal(taskState('tasks', working), 'in_progress', working);
  }
});

test('the state rule: the folder decides backlog and done, and a killed task in done/ is dropped whatever note follows', () => {
  assert.equal(taskState('backlog', 'claimed'), 'backlog');
  assert.equal(taskState('backlog', 'blocked'), 'backlog');
  assert.equal(taskState('done', 'open'), 'done');
  assert.equal(taskState('done', 'done — green on main'), 'done');
  assert.equal(taskState('done', 'killed — superseded by T001'), 'dropped');
  assert.equal(taskState('done', '**Killed**'), 'dropped');
});

test('boardPolicy reads the in-progress WIP limit and stale_hours, and gives 0 when no limit is set or it is still the placeholder', async () => {
  assert.deepEqual(boardPolicy('wip:\n  in_progress: 3  # three agents\n  blocked: 2\nstale_hours: 12\n'), { staleHours: 12, wipLimit: 3 });
  assert.deepEqual(boardPolicy(''), { staleHours: undefined, wipLimit: 0 });
  assert.deepEqual(boardPolicy('stale_hours: 24\nlog: PROGRESS.md\n'), { staleHours: 24, wipLimit: 0 });
  assert.deepEqual(boardPolicy('limits:\n  in_progress: 9\nwip:\n  blocked: 2\n'), { staleHours: undefined, wipLimit: 0 }, 'only the wip: block sets it');
  const template = await readFile(new URL('../skills/deaddrop-init/template/deaddrop.yml', import.meta.url), 'utf8');
  assert.match(template, /^ {2}in_progress: \{\{N\}\}$/m, 'the template still carries the placeholder');
  assert.deepEqual(boardPolicy(template), { staleHours: 24, wipLimit: 0 });
});

test('linkProject refuses a missing, relative, absent, or non-folder path, and any folder inside the data folder', async () => {
  const directory = await makeRepository();
  const workspace = await openWorkspace(directory);
  const own = await workspace.createProject({ name: 'Own board' });
  const repository = await makeTrackedRepository({ 'deaddrop/tasks/T001-read-me.md': boardTask('T001', 'Read me', { status: 'open' }) });
  const outside = await scratchFolder();
  await symlink(projectRepository(directory, own.id), path.join(outside, 'alias'));

  await expectRejected(workspace.linkProject({}), 400, /^path is required$/);
  await expectRejected(workspace.linkProject({ path: 'code/project' }), 400, /full path/);
  await expectRejected(workspace.linkProject({ path: path.join(repository, 'missing') }), 400, new RegExp(`^There is no folder at ${escapeRegExp(path.join(repository, 'missing'))}$`));
  await expectRejected(workspace.linkProject({ path: path.join(repository, 'README.md') }), 400, /README\.md is not a folder$/);
  // An AgeAris project is a git repository with a board, so only its place refuses it.
  for (const inside of [directory, projectRepository(directory, own.id), path.join(outside, 'alias'), `${repository}/../${path.basename(directory)}/projects`]) {
    await expectRejected(workspace.linkProject({ path: inside }), 400, /inside AgeAris's own data folder/);
  }
  assert.deepEqual(await readdir(path.join(directory, 'projects')), [own.id], 'nothing was written, not even a staging folder');
});

test('linkProject refuses a folder that is not a git repository, a subfolder of one, a worktree\'s .git file, and a repository without a board', async () => {
  const directory = await makeRepository();
  const workspace = await openWorkspace(directory);
  const plain = await scratchFolder();
  await mkdir(path.join(plain, 'deaddrop', 'tasks'), { recursive: true });
  await expectRejected(workspace.linkProject({ path: plain }), 400, new RegExp(`^${escapeRegExp(plain)} is not a git repository$`));

  // A monorepo whose service keeps its own board: the repository root is what can be tracked.
  const monorepo = await makeTrackedRepository({ 'services/api/deaddrop/tasks/T001-route.md': boardTask('T001', 'Route', { status: 'open' }) });
  await expectRejected(
    workspace.linkProject({ path: path.join(monorepo, 'services', 'api') }),
    400,
    new RegExp(`^${escapeRegExp(path.join(monorepo, 'services', 'api'))} is inside the repository at ${escapeRegExp(monorepo)}; give that folder instead$`),
  );

  const repository = await makeTrackedRepository({ 'deaddrop/tasks/T001-read-me.md': boardTask('T001', 'Read me', { status: 'open' }) });
  const worktree = path.join(await scratchFolder(), 'worktree');
  await git(repository, 'worktree', 'add', '--quiet', '--detach', worktree);
  assert.ok((await stat(path.join(worktree, 'deaddrop', 'tasks'))).isDirectory(), 'the worktree has the board');
  await expectRejected(workspace.linkProject({ path: worktree }), 400, /\.git is not a folder: worktrees and submodules cannot be tracked yet$/);

  const boardless = await makeTrackedRepository({
    'deaddrop/backlog/T001-idea.md': boardTask('T001', 'Idea', { status: 'open' }),
    'docs/tasks/T002-notes.md': boardTask('T002', 'Notes', { status: 'open' }),
  });
  await expectRejected(workspace.linkProject({ path: boardless }), 400, /has no task board: AgeAris reads deaddrop\/tasks\/ \(or pm\/tasks\/, its older name\), and not through a symbolic link$/);
  assert.deepEqual(await readdir(path.join(directory, 'projects')), []);
});

test('a repository can be tracked once: a second link is a 409 however its path is spelled', async () => {
  const directory = await makeRepository();
  const workspace = await openWorkspace(directory);
  const repository = await makeTrackedRepository({ 'deaddrop/tasks/T001-read-me.md': boardTask('T001', 'Read me', { status: 'open' }) });
  const alias = path.join(await scratchFolder(), 'alias');
  await symlink(repository, alias);

  const first = await workspace.linkProject({ path: repository });
  assert.equal(first.name, path.basename(repository), 'without a name, the project is named after the folder');
  for (const spelling of [repository, `${repository}/`, `${repository}/deaddrop/..`, alias]) {
    await expectRejected(workspace.linkProject({ path: spelling, name: 'Again' }), 409, new RegExp(`^${escapeRegExp(repository)} is already tracked as ${escapeRegExp(first.name)}$`));
  }
  assert.deepEqual(await readdir(path.join(directory, 'projects')), [first.id]);
});

test('linking a legacy pm/ board writes only project.json, and the project takes its WIP limit from pm/deaddrop.yml', async () => {
  const directory = await makeRepository();
  const workspace = await openWorkspace(directory);
  const repository = await makeTrackedRepository(legacyBoard());
  const before = await repositoryState(repository);

  const project = await workspace.linkProject({ path: repository, name: 'Legacy board', color: '#16A34A' });
  assert.deepEqual(
    [project.linked, project.board, project.repository, project.name, project.color, project.wipLimit],
    [true, 'pm', repository, 'Legacy board', '#16a34a', 4],
  );
  const folder = projectRepository(directory, project.id);
  assert.deepEqual(await readdir(path.join(directory, 'projects')), [project.id], 'no staging folder is left behind');
  assert.deepEqual(await readdir(folder), ['project.json'], 'no .git and no board of its own');
  const stored = JSON.parse(await readFile(path.join(folder, 'project.json'), 'utf8'));
  assert.deepEqual([stored.repository, stored.board, 'wipLimit' in stored, 'linked' in stored], [repository, 'pm', false, false]);

  const listed = (await workspace.read()).projects.find((candidate) => candidate.id === project.id);
  assert.deepEqual([listed.linked, listed.wipLimit, listed.problems], [true, 4, []]);
  assert.deepEqual(await repositoryState(repository), before, 'the repository is untouched');
});

test('a tracked board without backlog/ is read: each task takes its state from its folder and the first word of status:', async () => {
  const directory = await makeRepository();
  const workspace = await openWorkspace(directory);
  const project = await workspace.linkProject({ path: await makeTrackedRepository(legacyBoard()) });
  const tasks = tasksOf(await workspace.read(), project.id);
  assert.deepEqual(Object.fromEntries(Object.entries(tasks).map(([id, task]) => [id, task.status])), {
    T001: 'backlog', T002: 'in_progress', T003: 'blocked', T004: 'in_progress', T005: 'backlog', T006: 'backlog', T007: 'done', T008: 'done',
  });
  assert.equal(tasks.T001.file, 'pm/tasks/T001-write-the-importer.md', 'a tracked task names the file it is changed in');
  assert.equal(tasks.T007.file, 'pm/tasks/done/T007-set-up-ci.md');
});

test('a tracked task keeps a valid priority in any case, reports whether one was given, and names the agent session claiming it', async () => {
  const directory = await makeRepository();
  const workspace = await openWorkspace(directory);
  const project = await workspace.linkProject({ path: await makeTrackedRepository(legacyBoard()) });
  const tasks = tasksOf(await workspace.read(), project.id);
  assert.deepEqual(
    ['T001', 'T002', 'T003', 'T004'].map((id) => [id, tasks[id].priority, tasks[id].priorityGiven, tasks[id].claim]),
    [
      ['T001', 'high', true, ''],
      ['T002', 'high', true, 'ade @k/e857a8c8'],
      ['T003', 'medium', false, 'ade @k/e857a8c8'],
      ['T004', 'medium', false, ''],
    ],
  );
  const single = await workspace.getTask(tasks.T002.id);
  assert.deepEqual([single.status, single.claim, single.file], ['in_progress', 'ade @k/e857a8c8', 'pm/tasks/T002-parse-dates.md']);
});

test('a tracked board reports unreadable task files and symlinks as problems and still reads every other task', async () => {
  const directory = await makeRepository();
  const workspace = await openWorkspace(directory);
  const elsewhere = await scratchFolder();
  await writeFile(path.join(elsewhere, 'T009-elsewhere.md'), boardTask('T009', 'Elsewhere', { status: 'claimed' }));
  const repository = await makeTrackedRepository({
    'deaddrop/backlog/T001-good.md': boardTask('T001', 'Good', { status: 'open' }),
    'deaddrop/tasks/T002-also-good.md': boardTask('T002', 'Also good', { status: 'claimed' }),
    'deaddrop/tasks/T003-no-frontmatter.md': '# T003 — No frontmatter\n\nJust notes.\n',
    'deaddrop/tasks/T004-wrong-id.md': boardTask('T005', 'Wrong id', { status: 'claimed' }),
    'deaddrop/tasks/done/T002-copy.md': boardTask('T002', 'A copy', { status: 'done' }),
  });
  await symlink(path.join(elsewhere, 'T009-elsewhere.md'), path.join(repository, 'deaddrop', 'tasks', 'T009-elsewhere.md'));
  await git(repository, 'add', '-A');
  await git(repository, 'commit', '--quiet', '-m', 'Link a task from elsewhere');
  const project = await workspace.linkProject({ path: repository, name: 'Messy board' });

  const snapshot = await workspace.read();
  const listed = snapshot.projects.find((candidate) => candidate.id === project.id);
  // readdir order is the file system's; compare in code-point order.
  assert.deepEqual([...listed.problems].sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : 0)), [
    { file: 'deaddrop/tasks/T003-no-frontmatter.md', error: 'Task file has invalid frontmatter' },
    { file: 'deaddrop/tasks/T004-wrong-id.md', error: 'Task file T004-wrong-id.md has an invalid id' },
    { file: 'deaddrop/tasks/T009-elsewhere.md', error: 'Symbolic links are not read' },
    { file: 'deaddrop/tasks/done/T002-copy.md', error: 'Duplicate task id T002 in project Messy board' },
  ]);
  assert.deepEqual(Object.keys(tasksOf(snapshot, project.id)).sort(), ['T001', 'T002']);
  assert.equal(tasksOf(snapshot, project.id).T002.title, 'Also good');
});

test('a tracked repository\'s activity is the commits that touch its board, not the rest of its code', async () => {
  const directory = await makeRepository();
  const workspace = await openWorkspace(directory);
  const repository = await makeTrackedRepository({ 'deaddrop/tasks/T001-read-me.md': boardTask('T001', 'Read me', { status: 'open' }) });
  await writeFile(path.join(repository, 'README.md'), '# Their project, documented\n');
  await git(repository, 'commit', '--quiet', '-am', 'Document the code');
  const project = await workspace.linkProject({ path: repository });
  const activity = (await workspace.read()).activity.filter((entry) => entry.projectId === project.id);
  assert.deepEqual(activity.map((entry) => entry.message), ['Their first commit']);
});

test('a tracked repository refuses task and project writes with a 409 naming its board, and is left untouched', async () => {
  const directory = await makeRepository();
  const workspace = await openWorkspace(directory);
  const repository = await makeTrackedRepository(legacyBoard());
  const project = await workspace.linkProject({ path: repository, name: 'Theirs' });
  const task = await workspace.getTask(`${project.id}:T001`);
  const before = await repositoryState(repository);
  const readOnly = new RegExp(`^Theirs is a tracked repository, which AgeAris only reads\\. Change its tasks in ${escapeRegExp(path.join(repository, 'pm'))}, where its agents work\\.$`);

  await expectRejected(workspace.createTask({ projectId: project.id, title: 'One more' }), 409, readOnly);
  await expectRejected(workspace.updateTask(task.id, { version: task.version, status: 'in_progress' }), 409, readOnly);
  await expectRejected(workspace.updateTask(task.id, { version: task.version, title: 'Renamed' }), 409, readOnly);
  await expectRejected(workspace.updateProject(project.id, { version: project.version, name: 'Renamed' }), 409, readOnly);
  assert.deepEqual(await repositoryState(repository), before);
  assert.deepEqual(await readdir(projectRepository(directory, project.id)), ['project.json']);
  assert.equal((await workspace.getTask(task.id)).status, 'backlog');
});

test('_commit and _resetPaths refuse any folder but an own project repository, so git never falls through to a repository above', async () => {
  // Here the data folder is itself a git repository: a tracked project's
  // folder has no .git, so a git command run there would reach this one.
  const directory = await makeRepository();
  const workspace = await openWorkspace(directory);
  const repository = await makeTrackedRepository({ 'deaddrop/tasks/T001-read-me.md': boardTask('T001', 'Read me', { status: 'open' }) });
  const project = await workspace.linkProject({ path: repository });
  const folder = projectRepository(directory, project.id);
  await writeFile(path.join(repository, 'deaddrop', 'tasks', 'T002-sneaked-in.md'), boardTask('T002', 'Sneaked in', { status: 'open' }));
  const heads = async () => [await git(directory, 'rev-parse', 'HEAD'), await git(repository, 'rev-parse', 'HEAD')];
  const before = await heads();

  for (const target of [folder, repository, directory, path.join(directory, 'projects')]) {
    const paths = [path.join(target, 'project.json'), path.join(target, 'deaddrop')];
    assert.throws(() => workspace._commit(target, paths, 'Sneak a commit in'), (error) => error.status === 500 && /^AgeAris writes only to the project repositories in its data folder$/.test(error.message), target);
    assert.throws(() => workspace._resetPaths(target, paths), (error) => error.status === 500, target);
  }
  assert.deepEqual(await heads(), before, 'neither the data folder\'s repository nor the tracked one got a commit');
  assert.match(await git(repository, 'status', '--porcelain'), /^\?\? deaddrop\/tasks\/T002-sneaked-in\.md$/);
});

test('unlinkProject removes only a tracked project\'s folder; an own project is a 409 and an unknown one a 404', async () => {
  const directory = await makeRepository();
  const workspace = await openWorkspace(directory);
  const own = await workspace.createProject({ name: 'Own' });
  const repository = await makeTrackedRepository(legacyBoard());
  const project = await workspace.linkProject({ path: repository, name: 'Theirs' });
  const before = await repositoryState(repository);

  await expectRejected(workspace.unlinkProject(own.id), 409, /^Own is an AgeAris project; only a tracked repository can be removed$/);
  await expectRejected(workspace.unlinkProject('00000000-0000-4000-8000-000000000000'), 404, /Project not found/);
  await expectRejected(workspace.unlinkProject('../projects'), 404, /Project not found/);
  assert.deepEqual(await workspace.unlinkProject(project.id), { id: project.id, name: 'Theirs' });

  await assert.rejects(stat(projectRepository(directory, project.id)), { code: 'ENOENT' });
  assert.deepEqual(await readdir(path.join(directory, 'projects')), [own.id], 'the own project stays');
  const snapshot = await workspace.read();
  assert.deepEqual(snapshot.projects.map((candidate) => candidate.id), [own.id]);
  assert.deepEqual(snapshot.tasks, []);
  assert.deepEqual(await repositoryState(repository), before, 'the repository\'s files and HEAD are unchanged');
  await expectRejected(workspace.unlinkProject(project.id), 404, /Project not found/);
  const again = await workspace.linkProject({ path: repository });
  assert.notEqual(again.id, project.id, 'once removed, the repository can be tracked again');
});

test('an own project whose project.json names a repository is still an own project: the key is ignored', async () => {
  const directory = await makeRepository();
  const workspace = await openWorkspace(directory);
  const repository = await makeTrackedRepository({ 'deaddrop/tasks/T001-theirs.md': boardTask('T001', 'Theirs', { status: 'claimed' }) });
  const project = await workspace.createProject({ name: 'Own' });
  await workspace.createTask({ projectId: project.id, title: 'Mine' });
  const projectDir = projectRepository(directory, project.id);
  const metadata = path.join(projectDir, 'project.json');
  await writeFile(metadata, `${JSON.stringify({ ...JSON.parse(await readFile(metadata, 'utf8')), repository, board: 'deaddrop' }, null, 2)}\n`);
  await git(projectDir, 'commit', '--quiet', '-am', 'An agent points project.json elsewhere');
  const before = await repositoryState(repository);

  const snapshot = await workspace.read();
  const listed = snapshot.projects.find((candidate) => candidate.id === project.id);
  assert.deepEqual([listed.linked, listed.problems, listed.wipLimit], [undefined, undefined, 6]);
  assert.deepEqual(snapshot.tasks.map((task) => task.title), ['Mine']);
  assert.equal((await workspace.createTask({ projectId: project.id, title: 'Still writable' })).id, `${project.id}:T002`);
  assert.match(await git(projectDir, 'log', '-1', '--format=%s'), /^Create T002: Still writable$/);
  await expectRejected(workspace.unlinkProject(project.id), 409, /is an AgeAris project/);
  assert.deepEqual(await repositoryState(repository), before);
});

test('a tracked task carries its holder\'s latest note from the owner line, and getTask with body returns the task as written', async () => {
  const directory = await makeRepository();
  const workspace = await openWorkspace(directory);
  const project = await workspace.linkProject({ path: await makeTrackedRepository({
    'deaddrop/backlog/T001-idea.md': boardTask('T001', 'Idea', { status: 'open', owner: '—' }),
    'deaddrop/tasks/T002-import.md': boardTask('T002', 'Import', { status: 'claimed', owner: AGENT_CLAIM }),
    'deaddrop/tasks/T003-quiet.md': boardTask('T003', 'Quiet', { status: 'claimed', owner: 'ade @k/e857a8c8 2026-10-01' }),
    'deaddrop/tasks/T004-ui.md': boardTask('T004', 'From the UI', { status: 'claimed', owner: 'ade @agesight/web 2026-10-01 — moved on the board' }),
  }) });
  const tasks = tasksOf(await workspace.read(), project.id);
  assert.deepEqual(['T001', 'T002', 'T003', 'T004'].map((id) => [id, tasks[id].claimNote]), [['T001', ''], ['T002', 'importer'], ['T003', ''], ['T004', '']], 'a note needs a claim, and a UI claim names nobody');

  const plain = await workspace.getTask(tasks.T002.id);
  assert.equal('body' in plain, false, 'the body is read only when asked for');
  assert.equal('_localId' in plain, false);
  const full = await workspace.getTask(tasks.T002.id, { body: true });
  assert.match(full.body, /^\s*# T002 — Import\n\n## Goal\n\nWork tracked outside AgeAris\.\n$/);
  assert.deepEqual(Object.keys(full).filter((key) => key.startsWith('_')), []);
});

test('methodOf reads a board\'s policy and its own method documents, skipping symlinked and oversized ones, and writes nothing', async () => {
  const directory = await makeRepository();
  const workspace = await openWorkspace(directory);
  const elsewhere = await scratchFolder();
  await writeFile(path.join(elsewhere, 'RULES.md'), '# Not the board\'s\n');
  const repository = await makeTrackedRepository({
    'deaddrop/tasks/T001-work.md': boardTask('T001', 'Work', { status: 'claimed', owner: AGENT_CLAIM }),
    'deaddrop/deaddrop.yml': 'wip:\n  in_progress: 4\n  blocked: 4\nstale_hours: 12\n',
    'deaddrop/WORKFLOW.md': '# Workflow\n\nClaim, checkpoint, done.\n',
    'deaddrop/WHY.md': `# Why\n\n${'x'.repeat(300 * 1024)}\n`,
    'deaddrop/NOTES.md': '# Not a method document\n',
  });
  await symlink(path.join(elsewhere, 'RULES.md'), path.join(repository, 'deaddrop', 'RULES.md'));
  const before = await repositoryState(repository);
  const project = await workspace.linkProject({ path: repository });

  const method = await workspace.methodOf(project.id);
  assert.deepEqual([method.projectId, method.linked, method.board, method.staleHours, method.wipLimit], [project.id, true, 'deaddrop', 12, 4]);
  assert.deepEqual(method.docs, [{ name: 'WORKFLOW.md', path: 'deaddrop/WORKFLOW.md', text: '# Workflow\n\nClaim, checkpoint, done.\n' }]);
  assert.deepEqual(await repositoryState(repository), before);

  const own = await workspace.createProject({ name: 'Own', wipLimit: 5 });
  const ownMethod = await workspace.methodOf(own.id);
  assert.deepEqual([ownMethod.linked, ownMethod.board, ownMethod.wipLimit, ownMethod.staleHours], [false, 'deaddrop', 5, 24]);
  await expectRejected(workspace.methodOf('missing-project'), 404, /./);
});
