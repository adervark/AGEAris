import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { copyFile, mkdtemp, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';

import { Workspace } from '../lib/workspace.mjs';

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
