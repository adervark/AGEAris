// Task actions on tracked AA boards, end to end through the workspace
// (docs/plans/task-control.md §4, §8): real temporary repositories in both
// layouts, no global or system git config, and nothing outside os.tmpdir().
import assert from 'node:assert/strict';
import { execFile, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstat, mkdir, mkdtemp, readdir, readFile, readlink, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';

import { Workspace } from '../lib/workspace.mjs';

process.env.GIT_CONFIG_GLOBAL = os.devNull;
process.env.GIT_CONFIG_NOSYSTEM = '1';
delete process.env.AGESIGHT_TRACKED_WRITES;

const exec = promisify(execFile);
const FIXTURES = new URL('./fixtures/tracked/', import.meta.url);
const TEMPLATE = new URL('../skills/aa-init/template/', import.meta.url);
const T004 = 'T004-one-copy-of-the-aa-init-template.md';
const T012 = 'T012-a-moved-blocked-task-loses-its-handoff-reason.md';
const T019 = 'T019-a-working-page-for-all-work-in-progress.md';
const T030 = 'T030-a-task-in-the-older-layout.md';
const OPERATOR = 'adervark';
const temporary = new Set();

test.after(async () => {
  await Promise.all([...temporary].map((directory) => rm(directory, { recursive: true, force: true })));
});

async function tempDir(kind) {
  const directory = await realpath(await mkdtemp(path.join(os.tmpdir(), `agesight-actions-${kind}-`)));
  temporary.add(directory);
  return directory;
}

async function g(dir, ...args) {
  const { stdout } = await exec('git', args, { cwd: dir, env: process.env, maxBuffer: 16 * 1024 * 1024 });
  return stdout.trim();
}

const fixture = (name) => readFile(new URL(name, FIXTURES), 'utf8');

function taskFile(id, title, fields = {}, result = '*(pending)*') {
  const header = Object.entries({ id, title: JSON.stringify(title), status: 'open', owner: '—', blockedReason: '""', ...fields }).map(([key, value]) => `${key}: ${value}`).join('\n');
  return `---\n${header}\n---\n\n# ${id} — ${title}\n\n## Goal\n\nSomething to do.\n\n## Result\n\n${result}\n\n## Notes\n`;
}

// A tracked repository with an AA board, linked in a fresh data folder. With
// backlog/: T004 and T012 queued, T019 done, a WIP limit of 2 and a blocked
// limit of 1. Without (the older layout, as AGEIS): T030 claimed by the
// operator's own agent session and T012 open, both in tasks/. `files` adds
// or replaces files (null removes one); `on` switches task actions on.
async function board({ backlog = true, files = {}, on = true, operator = OPERATOR, trackedWrites } = {}) {
  const dir = await tempDir('repo');
  await g(dir, 'init', '--quiet', '--initial-branch=main');
  await g(dir, 'config', 'user.name', operator);
  await g(dir, 'config', 'user.email', 'operator@example.invalid');
  const base = backlog
    ? { [`AA/backlog/${T004}`]: await fixture(T004), [`AA/backlog/${T012}`]: await fixture(T012), [`AA/tasks/done/${T019}`]: await fixture(T019), 'AA/AA.yml': 'wip:\n  in_progress: 2\n  blocked: 1\nstale_hours: 24\n', 'AA/tasks/.gitkeep': '' }
    : { [`AA/tasks/${T030}`]: await fixture(T030), [`AA/tasks/${T012}`]: await fixture(T012) };
  for (const [name, content] of Object.entries({ ...base, 'AA/STATE.md': '# State\n', 'README.md': '# Theirs\n', 'other.txt': 'one\n', ...files })) {
    if (content === null) continue;
    await mkdir(path.dirname(path.join(dir, name)), { recursive: true });
    await writeFile(path.join(dir, name), content);
  }
  await g(dir, 'add', '-A');
  await g(dir, 'commit', '--quiet', '-m', 'fixture');
  const dataDir = await tempDir('data');
  const workspace = await new Workspace({ dataDir, operator: 'AGE Aris Tester', email: 'tester@example.invalid', ...(trackedWrites === undefined ? {} : { trackedWrites }) }).init();
  let project = await workspace.linkProject({ path: dir, name: 'Theirs' });
  if (on) project = await switchOn(workspace, project);
  return { dir, dataDir, workspace, project };
}

async function refusal(promise) {
  try { await promise; } catch (error) { return error; }
  assert.fail('expected a refusal');
}

async function switchOn(workspace, project) {
  const asked = await refusal(workspace.updateProject(project.id, { version: project.version, taskActions: { on: true } }));
  assert.equal(asked.code, 'CONFIRM', asked.message);
  return workspace.updateProject(project.id, { version: project.version, taskActions: { on: true }, confirm: asked.details.confirmToken });
}

const taskId = (repo, id) => `${repo.project.id}:${id}`;
const current = (repo, id) => repo.workspace.getTask(taskId(repo, id));

async function act(repo, id, action, input = {}) {
  const task = await current(repo, id);
  return repo.workspace.actOnTask(taskId(repo, id), { action, version: task.version, ...input }, { trailers: { 'AGESight-Via': 'ui' } });
}

// The ref, the index's bytes, git status and every file outside .git: equal
// before and after means the action changed nothing a person could see.
async function repositoryState(dir) {
  const files = {};
  async function visit(current) {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      if (entry.name === '.git') continue;
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) await visit(absolute);
      else files[path.relative(dir, absolute)] = entry.isSymbolicLink() ? `-> ${await readlink(absolute)}` : await readFile(absolute, 'utf8');
    }
  }
  await visit(dir);
  return {
    head: await g(dir, 'rev-parse', 'HEAD'),
    index: createHash('sha256').update(await readFile(path.join(dir, '.git', 'index'))).digest('hex'),
    status: await g(dir, '--no-optional-locks', 'status', '--porcelain', '--untracked-files=all'),
    files,
    lock: await lstat(path.join(dir, '.git', 'index.lock')).then(() => true, () => false),
  };
}

// A refusal: its status and code, and the repository exactly as it was.
async function refused(repo, attempt, status, code) {
  const before = await repositoryState(repo.dir);
  const error = await refusal(attempt());
  assert.deepEqual([error.status, error.code], [status, code], error.message);
  assert.ok(error.message, 'it says why');
  assert.deepEqual(await repositoryState(repo.dir), before, `${code} changed nothing`);
  return error;
}

// `git show --name-status` of a commit that changed T012 alone.
const IN_PLACE = new RegExp(`^M\\tAA/tasks/${T012}$`);
const MOVED = (from, to) => new RegExp(`^R\\d+\\t${from}/${T012}\\t${to}/${T012}$`);

function frontmatter(text) {
  return Object.fromEntries(text.slice(4, text.indexOf('\n---\n')).split('\n').filter((line) => !line.startsWith('#')).map((line) => [line.slice(0, line.indexOf(':')), line.slice(line.indexOf(':') + 1).trim()]));
}

async function committed(repo, result, { subject, status, paths }) {
  assert.match(result.commit, /^[0-9a-f]{40}$/);
  assert.equal(result.branch, 'main');
  assert.equal(await g(repo.dir, 'rev-parse', 'refs/heads/main'), result.commit, 'on the pinned branch');
  assert.equal(await g(repo.dir, 'log', '-1', '--format=%s', result.commit), subject);
  assert.equal(await g(repo.dir, 'log', '-1', '--format=%an <%ae>', result.commit), `${OPERATOR} <operator@example.invalid>`, 'authored as the repository\'s identity');
  const body = await g(repo.dir, 'log', '-1', '--format=%B', result.commit);
  assert.match(body, new RegExp(`Made in AGE Aris by ${OPERATOR}\\.`));
  assert.match(body, /AA\/STATE\.md (was not regenerated: run AA\/board\.sh --write\.|is kept by hand: T\d+'s board line still says its old status\.)/);
  assert.equal(await g(repo.dir, 'log', '-1', '--format=%(trailers:key=AGESight-Via,valueonly)', result.commit), 'ui');
  assert.match(await g(repo.dir, 'show', '--name-status', '--format=', result.commit), paths, 'one task file: renamed on a move, modified in place');
  assert.equal(await g(repo.dir, 'status', '--porcelain', '--untracked-files=all', '--', 'AA'), '', 'the index and the working tree agree for the task');
  if (status) assert.equal(result.task.status, status);
}

// ---- The switch

test('task actions are off until switched on: the switch discloses the branch, the identity, the hooks, other worktrees and STATE.md, and writes only project.json', async () => {
  const repo = await board({ on: false, files: { 'AA/board.sh': '#!/bin/sh\n' } });
  await writeFile(path.join(repo.dir, '.git', 'hooks', 'pre-commit'), '#!/bin/sh\nexit 1\n', { mode: 0o755 });
  const worktree = path.join(await tempDir('worktree'), 'wt');
  await g(repo.dir, 'worktree', 'add', '--quiet', '-b', 'side', worktree);
  assert.deepEqual(repo.project.actions, { on: false, branch: '', reason: 'Task actions are off for Theirs. Switch them on in the project header.' });
  await refused(repo, () => act(repo, 'T012', 'claim'), 409, 'ACTIONS_OFF');

  const before = await repositoryState(repo.dir);
  const asked = await refusal(repo.workspace.updateProject(repo.project.id, { version: repo.project.version, taskActions: { on: true } }));
  assert.deepEqual([asked.status, asked.code, asked.details.branch], [409, 'CONFIRM', 'main']);
  const said = asked.details.reasons.map((reason) => reason.text).join('\n');
  assert.match(said, /Each action is one commit to main, the branch checked out now\./);
  assert.match(said, new RegExp(`Commits are authored as ${OPERATOR}, this repository's git identity, and are not pushed\\.`));
  assert.match(said, /skip this repository's hooks \(pre-commit\)/);
  assert.match(said, new RegExp(`Agents in 1 other worktree \\(${worktree.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\) will not see these commits`));
  assert.match(said, /AA\/STATE\.md is not regenerated: run AA\/board\.sh --write after acting\./);
  const wrong = await refusal(repo.workspace.updateProject(repo.project.id, { version: repo.project.version, taskActions: { on: true }, confirm: 'not-the-token' }));
  assert.equal(wrong.code, 'CONFIRM', 'only the token it handed out confirms');

  const project = await repo.workspace.updateProject(repo.project.id, { version: repo.project.version, taskActions: { on: true }, confirm: asked.details.confirmToken });
  assert.deepEqual(project.actions, { on: true, branch: 'main', reason: '', operator: OPERATOR });
  assert.deepEqual([project.taskActions.on, project.taskActions.branch], [true, 'refs/heads/main']);
  assert.deepEqual(await repositoryState(repo.dir), before, 'switching on wrote nothing in the repository (the link probe cleaned up)');
  assert.deepEqual(await readdir(path.join(repo.dataDir, 'projects', repo.project.id)), ['project.json']);
  // Every other project field stays refused.
  assert.equal((await refusal(repo.workspace.updateProject(repo.project.id, { version: project.version, name: 'Renamed' }))).status, 409);

  const off = await repo.workspace.updateProject(repo.project.id, { version: project.version, taskActions: { on: false } });
  assert.equal(off.actions.on, false);
  assert.equal('taskActions' in off, false);
  await refused(repo, () => act(repo, 'T012', 'claim'), 409, 'ACTIONS_OFF');
});

test('a hand-kept STATE.md is disclosed as kept by hand, and a repository the engine cannot write to is refused at the switch', async () => {
  const repo = await board({ backlog: false, on: false });
  const asked = await refusal(repo.workspace.updateProject(repo.project.id, { version: repo.project.version, taskActions: { on: true } }));
  assert.match(asked.details.reasons.map((reason) => reason.text).join('\n'), /AA\/STATE\.md is kept by hand here: AGE Aris leaves it alone, and each commit names the board line that is behind\./);
  await g(repo.dir, 'config', 'core.sparseCheckout', 'true');
  const error = await refusal(repo.workspace.updateProject(repo.project.id, { version: repo.project.version, taskActions: { on: true } }));
  assert.deepEqual([error.status, error.code], [409, 'UNSUPPORTED_REPO']);
});

test('AGESIGHT_TRACKED_WRITES=0 overrides the switch: actions and switching on are refused', async () => {
  const repo = await board({ on: false, trackedWrites: false });
  assert.match(repo.project.actions.reason, /AGESIGHT_TRACKED_WRITES=0/);
  const error = await refusal(repo.workspace.updateProject(repo.project.id, { version: repo.project.version, taskActions: { on: true } }));
  assert.equal(error.code, 'ACTIONS_OFF');
  // A project switched on before the kill switch was set.
  const raw = JSON.parse(await readFile(path.join(repo.dataDir, 'projects', repo.project.id, 'project.json'), 'utf8'));
  await writeFile(path.join(repo.dataDir, 'projects', repo.project.id, 'project.json'), JSON.stringify({ ...raw, taskActions: { on: true, branch: 'refs/heads/main', since: '2026-10-08T00:00:00Z' } }));
  await refused(repo, () => act(repo, 'T012', 'claim'), 409, 'ACTIONS_OFF');
});

// ---- The actions, in both layouts

test('claim with backlog/: the file moves to tasks/ with status claimed and the operator\'s owner line, one commit on the pinned branch; other staged and unstaged work is untouched', async () => {
  const repo = await board();
  await writeFile(path.join(repo.dir, 'other.txt'), 'staged\n');
  await g(repo.dir, 'add', 'other.txt');
  await writeFile(path.join(repo.dir, 'README.md'), '# unstaged\n');
  const [cached, unstaged] = [await g(repo.dir, 'diff', '--cached'), await g(repo.dir, 'diff')];
  const result = await act(repo, 'T012', 'claim');
  // One line of at most 72 characters.
  await committed(repo, result, { subject: 'claim T012: working on A blocked task loses its Handoff reason when its…', status: 'in_progress', paths: MOVED('AA/backlog', 'AA/tasks') });
  const text = await readFile(path.join(repo.dir, 'AA', 'tasks', T012), 'utf8');
  const fields = frontmatter(text);
  assert.equal(fields.status, 'claimed');
  assert.match(fields.owner, new RegExp(`^${OPERATOR} @agesight/web \\d{4}-\\d{2}-\\d{2} — working on A blocked task`));
  // Only the named keys changed: comments, order and every other byte stay.
  const before = await fixture(T012);
  assert.deepEqual(text.split('\n').filter((line, index) => line !== before.split('\n')[index]).map((line) => line.split(':')[0]), ['status', 'owner']);
  assert.deepEqual([await g(repo.dir, 'diff', '--cached'), await g(repo.dir, 'diff')], [cached, unstaged], 'the operator\'s own staged and unstaged changes are as they were');
  assert.deepEqual(result.task.holder, { operator: OPERATOR, profile: 'agesight', session: 'web' });
  assert.deepEqual(result.warnings, []);
});

test('claim without backlog/: the change is in place', async () => {
  const repo = await board({ backlog: false });
  const result = await act(repo, 'T012', 'claim', { reason: 'reading the #code' });
  await committed(repo, result, { subject: 'claim T012: reading the code', status: 'in_progress', paths: IN_PLACE });
  assert.match(frontmatter(await readFile(path.join(repo.dir, 'AA', 'tasks', T012), 'utf8')).owner, / — reading the code$/);
});

test('block needs a reason, unblock clears it, release puts the task back with the old owner named, done fills a placeholder Result and moves the file', async () => {
  for (const backlog of [true, false]) {
    const repo = await board({ backlog });
    await act(repo, 'T012', 'claim');
    const where = 'AA/tasks';
    const missing = await refused(repo, () => act(repo, 'T012', 'block'), 400, 'BAD_INPUT');
    assert.equal(missing.details.field, 'reason');
    await refused(repo, () => act(repo, 'T012', 'block', { reason: 'x'.repeat(201) }), 400, 'BAD_INPUT');

    let result = await act(repo, 'T012', 'block', { reason: 'waiting on the archive key' });
    await committed(repo, result, { subject: 'block T012: waiting on the archive key', status: 'blocked', paths: IN_PLACE });
    let fields = frontmatter(await readFile(path.join(repo.dir, ...where.split('/'), T012), 'utf8'));
    assert.deepEqual([fields.status, fields.blockedReason], ['blocked', '"waiting on the archive key"']);
    assert.match(fields.owner, /@agesight\/web/, 'the owner line is kept');

    result = await act(repo, 'T012', 'unblock');
    await committed(repo, result, { subject: 'unblock T012', status: 'in_progress', paths: IN_PLACE });
    fields = frontmatter(await readFile(path.join(repo.dir, ...where.split('/'), T012), 'utf8'));
    assert.deepEqual([fields.status, fields.blockedReason], ['claimed', '""']);

    result = await act(repo, 'T012', 'release');
    const back = backlog ? 'AA/backlog' : 'AA/tasks';
    assert.equal(result.task.status, 'backlog');
    assert.match(await g(repo.dir, 'show', '--name-status', '--format=', result.commit), backlog ? MOVED('AA/tasks', 'AA/backlog') : IN_PLACE);
    assert.equal(await g(repo.dir, 'log', '-1', '--format=%s', result.commit), 'release T012: back to the queue');
    fields = frontmatter(await readFile(path.join(repo.dir, ...back.split('/'), T012), 'utf8'));
    assert.equal(fields.status, 'open');
    assert.match(fields.owner, new RegExp(`^— \\(released \\d{4}-\\d{2}-\\d{2}; was ${OPERATOR} @agesight/web \\d{4}-\\d{2}-\\d{2} — working on `));
    assert.deepEqual(result.task.holder, { operator: '', profile: '', session: '' }, 'a released task has no holder');

    await act(repo, 'T012', 'claim');
    const placeholder = await refused(repo, () => act(repo, 'T012', 'done'), 400, 'BAD_INPUT');
    assert.equal(placeholder.details.field, 'result');
    result = await act(repo, 'T012', 'done', { result: 'Fixed: the reason follows the file' });
    await committed(repo, result, { subject: 'T012 done: Fixed: the reason follows the file', status: 'done', paths: MOVED('AA/tasks', 'AA/tasks/done') });
    const done = await readFile(path.join(repo.dir, 'AA', 'tasks', 'done', T012), 'utf8');
    assert.equal(frontmatter(done).status, 'done');
    assert.match(done, /## Result\n\nFixed: the reason follows the file\n\n## Notes/);
  }
});

test('done keeps a real Result and asks for nothing; reopen, priority and assign are not AA actions', async () => {
  const repo = await board({ files: { 'AA/tasks/T050-shipped.md': taskFile('T050', 'Shipped', { status: 'claimed', owner: `${OPERATOR} @agesight/web 2026-10-01 — shipping` }, 'Shipped on 2026-10-07; see RESULTS.md.') } });
  const result = await act(repo, 'T050', 'done', { result: 'ignored' });
  assert.equal(await g(repo.dir, 'log', '-1', '--format=%s', result.commit), 'T050 done: Shipped');
  assert.match(await readFile(path.join(repo.dir, 'AA', 'tasks', 'done', 'T050-shipped.md'), 'utf8'), /## Result\n\nShipped on 2026-10-07; see RESULTS\.md\.\n/);
  for (const action of ['reopen', 'priority', 'assign']) {
    const error = await refused(repo, () => act(repo, 'T050', action, { value: 'high' }), 409, 'NOT_ALLOWED');
    assert.match(error.message, action === 'reopen' ? /AA has no reopen/ : /AA is pull-based: claim it or leave it in the queue/);
  }
});

// ---- Every refusal: its status, its code, and an unchanged repository

test('refusals in §4\'s order, each leaving the repository unchanged', async () => {
  const repo = await board({
    files: {
      'AA/tasks/T040-theirs.md': taskFile('T040', 'Theirs', { status: 'claimed', owner: 'alice @k/0f0f0f0f 2026-10-01 — hers' }),
      'AA/backlog/T060-twice.md': taskFile('T060', 'Twice'),
      'AA/tasks/done/T060-twice-again.md': taskFile('T060', 'Twice again', { status: 'done' }),
    },
  });
  await refused(repo, () => repo.workspace.actOnTask(taskId(repo, 'T999'), { action: 'claim', version: 'x' }), 404, 'NOT_FOUND');
  await refused(repo, () => act(repo, 'T012', 'teleport'), 400, 'BAD_INPUT');
  await refused(repo, () => repo.workspace.actOnTask(taskId(repo, 'T012'), { action: 'claim' }), 400, 'BAD_INPUT');
  await refused(repo, () => act(repo, 'T040', 'release'), 409, 'HELD_BY_OTHER');
  await refused(repo, () => act(repo, 'T060', 'claim'), 409, 'DUPLICATE_ID');
  await refused(repo, () => act(repo, 'T004', 'done', { result: 'early' }), 409, 'NOT_ALLOWED');
  await refused(repo, () => act(repo, 'T004', 'unblock'), 409, 'NOT_ALLOWED');
  const stale = await current(repo, 'T004');
  await refused(repo, () => repo.workspace.actOnTask(taskId(repo, 'T004'), { action: 'claim', version: `${stale.version.slice(0, -1)}0` }), 409, 'STALE');

  // The working tree, the index and HEAD must agree on the file.
  const dirty = await current(repo, 'T004');
  await writeFile(path.join(repo.dir, 'AA', 'backlog', T004), `${await readFile(path.join(repo.dir, 'AA', 'backlog', T004), 'utf8')}\nedited\n`);
  await refused(repo, () => repo.workspace.actOnTask(dirty.id, { action: 'claim', version: dirty.version }), 409, 'DIRTY_FILE');
  await g(repo.dir, 'checkout', '--', 'AA');
  await writeFile(path.join(repo.dir, 'AA', 'backlog', 'T070-new.md'), taskFile('T070', 'New'));
  await refused(repo, () => act(repo, 'T070', 'claim'), 409, 'NOT_COMMITTED');
  await rm(path.join(repo.dir, 'AA', 'backlog', 'T070-new.md'));

  // Git's own state.
  await g(repo.dir, 'checkout', '--quiet', '-b', 'elsewhere');
  const wrong = await refused(repo, () => act(repo, 'T004', 'claim'), 409, 'WRONG_BRANCH');
  assert.match(wrong.message, /on elsewhere; task actions commit to main/);
  await g(repo.dir, 'checkout', '--quiet', 'main');
  await writeFile(path.join(repo.dir, '.git', 'index.lock'), '');
  await refused(repo, () => act(repo, 'T004', 'claim'), 409, 'GIT_BUSY');
  await rm(path.join(repo.dir, '.git', 'index.lock'));
  await writeFile(path.join(repo.dir, '.git', 'MERGE_HEAD'), `${await g(repo.dir, 'rev-parse', 'HEAD')}\n`);
  assert.match((await refused(repo, () => act(repo, 'T004', 'claim'), 409, 'GIT_BUSY')).message, /in the middle of a merge/);
  await rm(path.join(repo.dir, '.git', 'MERGE_HEAD'));
  await g(repo.dir, 'config', '--unset', 'user.name');
  await refused(repo, () => act(repo, 'T004', 'claim'), 409, 'NO_IDENTITY');
  await g(repo.dir, 'config', 'user.name', OPERATOR);
  // A sparse checkout set after switching on is refused at the next action.
  await g(repo.dir, 'config', 'core.sparseCheckout', 'true');
  await refused(repo, () => act(repo, 'T004', 'claim'), 409, 'UNSUPPORTED_REPO');
  await g(repo.dir, 'config', '--unset', 'core.sparseCheckout');
  // And after all of that, the claim goes through.
  assert.equal((await act(repo, 'T004', 'claim')).task.status, 'in_progress');
});

test('a deaddrop/ board is never acted on, even with a switch written by hand', async () => {
  const repo = await board({ on: false, files: { [`AA/backlog/${T004}`]: null, [`AA/backlog/${T012}`]: null, [`AA/tasks/done/${T019}`]: null, 'AA/AA.yml': null, 'AA/STATE.md': null, 'AA/tasks/.gitkeep': null, 'deaddrop/tasks/T001-old.md': taskFile('T001', 'Old'), 'deaddrop/STATE.md': '# State\n' } });
  const raw = JSON.parse(await readFile(path.join(repo.dataDir, 'projects', repo.project.id, 'project.json'), 'utf8'));
  await writeFile(path.join(repo.dataDir, 'projects', repo.project.id, 'project.json'), JSON.stringify({ ...raw, taskActions: { on: true, branch: 'refs/heads/main', since: '2026-10-08T00:00:00Z' } }));
  const error = await refused(repo, () => act(repo, 'T001', 'claim'), 409, 'LEGACY_BOARD');
  assert.equal(error.message, 'This board is in deaddrop/, an older folder name. AGE Aris acts only on AA/ boards.');
});

test('WIP at the limit refuses a claim while done and release are allowed; blocking past the blocked limit warns in board.sh\'s words', async () => {
  const repo = await board({ files: { 'AA/tasks/T050-mine.md': taskFile('T050', 'Mine', { status: 'claimed', owner: `${OPERATOR} @agesight/web 2026-10-01 — mine` }), 'AA/tasks/T051-also.md': taskFile('T051', 'Also mine', { status: 'blocked', owner: `${OPERATOR} @agesight/web 2026-10-01 — also`, blockedReason: '"keys"' }) } });
  const error = await refused(repo, () => act(repo, 'T012', 'claim'), 409, 'WIP_LIMIT');
  assert.equal(error.message, 'WIP is 2 of 2. Finish or release something before claiming (rule 10).');
  const blocked = await act(repo, 'T050', 'block', { reason: 'waiting on review' });
  assert.deepEqual(blocked.warnings.map((warning) => [warning.code, warning.message]), [['BLOCKED_OVER_LIMIT', '2 blocked against a limit of 1: a blocker nobody is clearing is the flow problem.']]);
  assert.equal((await act(repo, 'T051', 'release')).task.status, 'backlog');
  assert.equal((await act(repo, 'T050', 'done', { result: 'reviewed' })).task.status, 'done');
  assert.equal((await act(repo, 'T012', 'claim')).task.status, 'in_progress');
});

test('overlapping refusals come in §4\'s order: the switch before the folder, the holder before a live run, the confirmation before the column, the limit before the version (T026)', async () => {
  // A deaddrop/ board with the switch off is off first.
  const legacy = await board({ on: false, files: { [`AA/backlog/${T004}`]: null, [`AA/backlog/${T012}`]: null, [`AA/tasks/done/${T019}`]: null, 'AA/AA.yml': null, 'AA/STATE.md': null, 'AA/tasks/.gitkeep': null, 'deaddrop/tasks/T001-old.md': taskFile('T001', 'Old'), 'deaddrop/STATE.md': '# State\n' } });
  await refused(legacy, () => act(legacy, 'T001', 'claim'), 409, 'ACTIONS_OFF');

  const live = trailLine('2e8b687e', 'doing', 0.2, { act: 'fold 0' });
  const repo = await board({ files: {
    'AA/tasks/T040-theirs.md': taskFile('T040', 'Theirs', { status: 'claimed', owner: 'alice @k/0f0f0f0f 2026-10-01 — hers' }),
    'AA/checkpoints/T040.jsonl': live,
    'AA/tasks/T041-agent.md': taskFile('T041', 'Agent', { status: 'claimed', owner: `${OPERATOR} @k/b6192924 2026-09-20 — fold 2` }),
  } });
  await refused(repo, () => act(repo, 'T040', 'release'), 409, 'HELD_BY_OTHER');
  // Unblock does not fit a claimed task, but the own agent's hold is asked about first.
  await refused(repo, () => act(repo, 'T041', 'unblock'), 409, 'CONFIRM');
  // At the limit (T040 and T041 are WIP 2 of 2) with a stale version: the limit.
  const stale = await current(repo, 'T004');
  await refused(repo, () => repo.workspace.actOnTask(stale.id, { action: 'claim', version: `${stale.version.slice(0, -1)}0` }), 409, 'WIP_LIMIT');
});

test('DIRTY_FILE for a change only in the index and for a file already at the target; GIT_BUSY on a detached HEAD (T026)', async () => {
  const repo = await board();
  const file = path.join(repo.dir, 'AA', 'backlog', T004);
  const original = await readFile(file, 'utf8');
  await writeFile(file, `${original}\nstaged\n`);
  await g(repo.dir, 'add', '--', file);
  await writeFile(file, original);
  await refused(repo, () => act(repo, 'T004', 'claim'), 409, 'DIRTY_FILE');
  await g(repo.dir, 'reset', '--quiet', '--', file);

  await mkdir(path.join(repo.dir, 'AA', 'tasks', T004));
  await refused(repo, () => act(repo, 'T004', 'claim'), 409, 'DIRTY_FILE');
  await rm(path.join(repo.dir, 'AA', 'tasks', T004), { recursive: true });

  await g(repo.dir, 'checkout', '--quiet', '--detach');
  assert.match((await refused(repo, () => act(repo, 'T004', 'claim'), 409, 'GIT_BUSY')).message, /detached HEAD/);
  await g(repo.dir, 'checkout', '--quiet', 'main');
  assert.equal((await act(repo, 'T004', 'claim')).task.status, 'in_progress');
});

test('a settings file past 64 KB is not read under the lock either: its WIP limit does not apply, as everywhere else (T026)', async () => {
  const repo = await board({ files: {
    'AA/AA.yml': `wip:\n  in_progress: 1\n  blocked: 1\nstale_hours: 24\n${'#'.repeat(70 * 1024)}\n`,
    'AA/tasks/T050-mine.md': taskFile('T050', 'Mine', { status: 'claimed', owner: `${OPERATOR} @agesight/web 2026-10-01 — mine` }),
  } });
  assert.equal((await act(repo, 'T004', 'claim')).task.status, 'in_progress');
});

test('claiming a queued task the operator\'s own agent holds takes it back and keeps the agent\'s line inline (T026, rule 3)', async () => {
  const repo = await board({ backlog: false, files: { 'AA/tasks/T032-queued.md': taskFile('T032', 'Queued', { status: 'open', owner: `${OPERATOR} @k/b6192924 2026-09-20 — paused` }) } });
  const asked = await refused(repo, () => act(repo, 'T032', 'claim'), 409, 'CONFIRM');
  assert.match(asked.details.reasons[0].text, /^Your agent session @k\/b6192924 holds T032/);
  const task = await current(repo, 'T032');
  await repo.workspace.actOnTask(task.id, { action: 'claim', version: task.version, confirm: asked.details.confirmToken });
  const owner = frontmatter(await readFile(path.join(repo.dir, 'AA', 'tasks', 'T032-queued.md'), 'utf8')).owner;
  assert.match(owner, new RegExp(`^${OPERATOR} @agesight/web \\d{4}-\\d{2}-\\d{2} — working on Queued; was ${OPERATOR} @k/b6192924 2026-09-20 — paused$`));
  // An unclaimed task names no one displaced.
  const free = await current(repo, 'T012');
  await repo.workspace.actOnTask(free.id, { action: 'claim', version: free.version });
  assert.doesNotMatch(frontmatter(await readFile(path.join(repo.dir, 'AA', 'tasks', T012), 'utf8')).owner, /; was/);
});

// ---- Holders, runs and the one confirmation

function trailLine(run, kind, ageHours, extra = {}) {
  return `${JSON.stringify({ ts: new Date(Date.now() - ageHours * 3_600_000).toISOString().replace(/\.\d{3}Z$/, 'Z'), run, kind, next: 'resume at epoch 5', ...extra })}\n`;
}

test('the operator\'s own agent claim and a dead run need one confirmation naming both; the action then keeps the owner line and returns the reap command; the trail is not written', async () => {
  const trail = `${trailLine('7c1e2a90', 'open', 530, { brief: 'train' })}${trailLine('7c1e2a90', 'doing', 528, { act: 'train fold 2' })}`;
  const repo = await board({ backlog: false, files: { 'AA/checkpoints/T030.jsonl': trail } });
  const asked = await refused(repo, () => act(repo, 'T030', 'block', { reason: 'GPU is gone' }), 409, 'CONFIRM');
  const said = asked.details.reasons.map((reason) => reason.text);
  assert.equal(said.length, 2);
  assert.match(said[0], /^Your agent session @k\/b6192924 holds T030; last sign of life (just now|\d+ (min|h|days) ago)\. Act as the same operator\?$/);
  assert.equal(said[1], 'Run 7c1e2a90 on T030 last wrote `doing: train fold 2` (next: `resume at epoch 5`) 22 days ago and never ended.');
  assert.match(asked.details.confirmToken, /^[0-9a-f]{32}$/);

  const task = await current(repo, 'T030');
  const result = await repo.workspace.actOnTask(task.id, { action: 'block', reason: 'GPU is gone', version: task.version, confirm: asked.details.confirmToken });
  assert.equal(result.task.status, 'blocked');
  assert.equal(frontmatter(await readFile(path.join(repo.dir, 'AA', 'tasks', T030), 'utf8')).owner, 'adervark @k/b6192924 2026-09-20 — fold 2 of 5', 'the agent\'s owner line is kept');
  assert.deepEqual(result.warnings.map((warning) => [warning.code, warning.remedy]), [['RUN_NOT_ENDED', 'AA/ckpt.sh log T030 end --run 7c1e2a90 --changed "unknown — reaped by adervark, process gone"']]);
  assert.equal(await readFile(path.join(repo.dir, 'AA', 'checkpoints', 'T030.jsonl'), 'utf8'), trail, 'AGE Aris never writes a trail');

  // The old token no longer fits: the file changed, so the situation did.
  const fresh = await current(repo, 'T030');
  const again = await refused(repo, () => repo.workspace.actOnTask(fresh.id, { action: 'unblock', version: fresh.version, confirm: asked.details.confirmToken }), 409, 'CONFIRM');
  assert.notEqual(again.details.confirmToken, asked.details.confirmToken);
});

test('a malformed trail line needs a confirmation naming its line, then warns with the ckpt.sh check remedy', async () => {
  const repo = await board({ backlog: false, files: { 'AA/tasks/T012-a-moved-blocked-task-loses-its-handoff-reason.md': null, 'AA/checkpoints/T012.jsonl': `${trailLine('aa11bb22', 'open', 5)}${trailLine('aa11bb22', 'end', 4)}{"half a line\n`, [`AA/tasks/${T012}`]: (await fixture(T012)).replace('status: open', 'status: claimed').replace('owner: —', `owner: ${OPERATOR} @agesight/web 2026-10-01 — mine`) } });
  const asked = await refused(repo, () => act(repo, 'T012', 'release'), 409, 'CONFIRM');
  assert.deepEqual(asked.details.reasons.map((reason) => reason.text), ['Line 3 of AA/checkpoints/T012.jsonl cannot be read.']);
  const result = await act(repo, 'T012', 'release', { confirm: asked.details.confirmToken });
  assert.deepEqual(result.warnings.map((warning) => [warning.code, warning.remedy]), [['RUN_NOT_ENDED', 'AA/ckpt.sh check T012']]);
});

test('a trail that is a symbolic link neither breaks the drawer nor fails the action: it needs a confirmation, then warns', async () => {
  const repo = await board({ backlog: false });
  await mkdir(path.join(repo.dir, 'AA', 'checkpoints'));
  await symlink('../../other.txt', path.join(repo.dir, 'AA', 'checkpoints', 'T012.jsonl'));
  await g(repo.dir, 'add', '-A');
  await g(repo.dir, 'commit', '--quiet', '-m', 'a linked trail');
  const read = await repo.workspace.getTask(taskId(repo, 'T012'), { body: true });
  assert.equal(read.liveRun, null);
  const asked = await refused(repo, () => act(repo, 'T012', 'start'), 409, 'CONFIRM');
  assert.deepEqual(asked.details.reasons.map((reason) => reason.kind), ['malformed']);
  assert.match(asked.details.reasons[0].text, /^AA\/checkpoints\/T012\.jsonl cannot be read: it is not a regular file/);
  const result = await act(repo, 'T012', 'start', { confirm: asked.details.confirmToken });
  assert.equal(result.task.status, 'in_progress');
  assert.deepEqual(result.warnings.map((warning) => warning.code), ['RUN_NOT_ENDED']);
  assert.equal(await readFile(path.join(repo.dir, 'other.txt'), 'utf8'), 'one\n', 'the link\'s target is untouched');
});

test('a confirmation is for one action: its token does not confirm another', async () => {
  const repo = await board({ backlog: false });
  const asked = await refused(repo, () => act(repo, 'T030', 'block', { reason: 'GPU is gone' }), 409, 'CONFIRM');
  const other = await refused(repo, () => act(repo, 'T030', 'release', { confirm: asked.details.confirmToken }), 409, 'CONFIRM');
  assert.notEqual(other.details.confirmToken, asked.details.confirmToken);
});

test('an uncommitted edit read before the lock and discarded before it is taken is not committed: DIRTY_FILE', async () => {
  const repo = await board({ backlog: false });
  const file = path.join(repo.dir, 'AA', 'tasks', T030);
  const asked = await refusal(act(repo, 'T030', 'block', { reason: 'GPU is gone' }));
  assert.equal(asked.code, 'CONFIRM');
  const task = await current(repo, 'T030');
  const head = await g(repo.dir, 'rev-parse', 'HEAD');
  // An agent's edit is on disk when AGE Aris reads the file, and is thrown
  // away (git checkout) between that read and git's lock.
  await writeFile(file, (await readFile(file, 'utf8')).replace('## Goal', 'UNCOMMITTED AGENT EDIT\n\n## Goal'));
  const walk = repo.workspace._lastSignInGit.bind(repo.workspace);
  repo.workspace._lastSignInGit = (...args) => { execFileSync('git', ['checkout', '--', 'AA'], { cwd: repo.dir, env: process.env }); return walk(...args); };
  const error = await refusal(repo.workspace.actOnTask(task.id, { action: 'block', reason: 'GPU is gone', version: task.version, confirm: asked.details.confirmToken }));
  assert.deepEqual([error.status, error.code], [409, 'DIRTY_FILE'], error.message);
  assert.equal(await g(repo.dir, 'rev-parse', 'HEAD'), head, 'nothing was committed');
  assert.doesNotMatch(await readFile(file, 'utf8'), /UNCOMMITTED AGENT EDIT/);
  assert.equal(await g(repo.dir, 'status', '--porcelain'), '');
});

test('a live run refuses claim, release, block, unblock and done, even with a confirmation token', async () => {
  const live = trailLine('2e8b687e', 'doing', 0.2, { act: 'fold 0' });
  const repo = await board({ backlog: false, files: {
    'AA/checkpoints/T030.jsonl': live,
    'AA/checkpoints/T012.jsonl': live,
    'AA/tasks/T031-blocked.md': taskFile('T031', 'Blocked', { status: 'blocked', owner: `${OPERATOR} @agesight/web 2026-10-01 — mine`, blockedReason: '"keys"' }),
    'AA/checkpoints/T031.jsonl': live,
  } });
  for (const [id, action] of [['T012', 'claim'], ['T030', 'release'], ['T030', 'block'], ['T031', 'unblock'], ['T030', 'done']]) {
    const error = await refused(repo, () => act(repo, id, action, { reason: 'r', result: 'r', confirm: 'f'.repeat(32) }), 409, 'RUN_LIVE');
    assert.match(error.message, new RegExp(`^Run 2e8b687e on ${id} last wrote \`doing: fold 0\` \\d+ min ago and has not ended\\.$`));
    assert.match(error.remedy, new RegExp(`AA/ckpt\\.sh log ${id} end --run 2e8b687e --changed "unknown — reaped by adervark, process gone"`));
  }
  // The drawer learns it from the task as written.
  const shown = await repo.workspace.getTask(taskId(repo, 'T030'), { body: true });
  assert.equal(shown.liveRun.id, '2e8b687e');
  assert.match(shown.liveRun.text, /^Run 2e8b687e on T030 last wrote `doing: fold 0` \d+ min ago and has not ended\.$/);
});

test('done with every run ended warns that the trail is not retired', async () => {
  const repo = await board({ backlog: false, files: { 'AA/checkpoints/T030.jsonl': `${trailLine('5d5d5d5d', 'open', 3)}${trailLine('5d5d5d5d', 'end', 2)}` } });
  const asked = await refusal(act(repo, 'T030', 'done', { result: 'fold 2 of 5 done' }));
  assert.equal(asked.code, 'CONFIRM', 'still the agent\'s claim');
  const result = await act(repo, 'T030', 'done', { result: 'fold 2 of 5 done', confirm: asked.details.confirmToken });
  assert.deepEqual(result.warnings.map((warning) => [warning.code, warning.remedy]), [['TRAIL_NOT_RETIRED', 'run AA/ckpt.sh close T030 --delete']]);
});

test('a tracked task shows its holder and whether its Result is still a placeholder', async () => {
  const repo = await board({ backlog: false });
  assert.deepEqual((await current(repo, 'T030')).holder, { operator: OPERATOR, profile: 'k', session: 'b6192924' });
  const detail = await repo.workspace.getTask(taskId(repo, 'T030'), { body: true });
  assert.deepEqual([detail.resultPending, detail.liveRun], [true, null]);
});

// ---- board.sh reads what AGE Aris writes

test('board.sh reads the history from before a board rename: a migrated board prints what its never-migrated twin does (T011)', async () => {
  const script = new URL('fixtures/board/board-rename.sh', import.meta.url);
  const { stdout } = await exec('bash', [script.pathname, new URL('.', TEMPLATE).pathname]).catch((error) => assert.fail(`the boards differ:\n${error.stdout}${error.stderr}`));
  assert.equal(stdout, '');
});

test('ckpt.sh check exits 0 when every line parses and 1 when one does not, whichever trail comes last (T016)', async () => {
  const script = new URL('fixtures/board/ckpt-check.sh', import.meta.url);
  const { stdout } = await exec('bash', [script.pathname, new URL('ckpt.sh', TEMPLATE).pathname]);
  assert.equal(stdout, 'clean: 0\nbad: 1\nbad then clean: 1\n');
});

test('board.sh compatibility: a claim is IN PROGRESS with the operator, done is DONE, unblock starts a new stint, and --check is stale until --write', async () => {
  for (const tool of ['bash', 'jq']) {
    await exec('sh', ['-c', `command -v ${tool}`]).catch(() => assert.fail(`${tool} is required for the board.sh compatibility test; install it`));
  }
  const files = {};
  for (const name of ['board.sh', 'ckpt.sh', 'STATE.md']) files[`AA/${name}`] = await readFile(new URL(name, TEMPLATE), 'utf8');
  const repo = await board({ files });
  const run = async (...args) => exec('bash', ['AA/board.sh', ...args], { cwd: repo.dir, env: process.env }).then(({ stdout }) => ({ code: 0, stdout }), (error) => ({ code: error.code, stdout: String(error.stdout) }));
  // T012's row on the board: its column, id, title, owner and age.
  const row = async () => ((await run()).stdout.split('\n').find((line) => line.includes('| T012 |'))?.split('|') || []).map((cell) => {
    // A column's first row also carries its count (`**IN PROGRESS** 1/2`).
    const text = cell.trim();
    return text.startsWith('**') ? text.slice(0, text.indexOf('**', 2) + 2) : text;
  });
  assert.equal((await run('--write')).code, 0);
  await g(repo.dir, 'commit', '--quiet', '-am', 'board');
  assert.equal((await run('--check')).code, 0, 'current before the action');

  const result = await act(repo, 'T012', 'claim');
  assert.match(await g(repo.dir, 'log', '-1', '--format=%B', result.commit), /AA\/STATE\.md was not regenerated: run AA\/board\.sh --write\./);
  assert.equal((await run('--check')).code, 1, 'stale after the action: STATE.md is never written');
  let cells = await row();
  assert.equal(cells[1], '**IN PROGRESS**');
  assert.match(cells[4], new RegExp(`^${OPERATOR}\\b`), 'board.sh reads the operator from the owner line');
  await act(repo, 'T012', 'block', { reason: 'keys' });
  assert.equal((await row())[1], '**BLOCKED**');
  // Unblock writes `claimed`, which board.sh takes as the start of a new stint (§4).
  await act(repo, 'T012', 'unblock');
  assert.equal((await row())[1], '**IN PROGRESS**');
  await act(repo, 'T012', 'done', { result: 'done in AGE Aris' });
  cells = await row();
  assert.equal(cells[1], '**DONE**');
  assert.equal((await run('--write')).code, 0);
  assert.equal((await run('--check')).code, 0, 'current after --write');
});

// ---- AGE Aris projects: the same actions, through updateTask

test('an AGE Aris project\'s actions produce the same file as the equivalent PATCH', async () => {
  const dataDir = await tempDir('own');
  const workspace = await new Workspace({ dataDir, operator: 'AGE Aris Tester', email: 'tester@example.invalid' }).init();
  const read = async (task) => {
    const project = path.join(dataDir, 'projects', task.projectId, 'AA');
    for (const folder of ['backlog', 'tasks', 'tasks/done']) {
      for (const name of await readdir(path.join(project, folder)).catch(() => [])) if (name.startsWith('T001-')) return (await readFile(path.join(project, folder, name), 'utf8')).replace(/^(createdAt|updatedAt|created): .*$/gm, '');
    }
    return null;
  };
  const steps = [
    ['start', {}, { status: 'in_progress' }],
    ['block', { reason: 'keys' }, { status: 'blocked', blockedReason: 'keys' }],
    ['unblock', {}, { status: 'in_progress' }],
    ['priority', { value: 'urgent' }, { priority: 'urgent' }],
    ['assign', { value: 'Ada' }, { assignee: 'Ada' }],
    ['done', {}, { status: 'done' }],
    ['reopen', {}, { status: 'in_progress' }],
    ['release', {}, { status: 'backlog' }],
  ];
  const viaActions = await workspace.createTask({ projectId: (await workspace.createProject({ name: 'Same' })).id, title: 'Same task' });
  const viaPatch = await workspace.createTask({ projectId: (await workspace.createProject({ name: 'Same' })).id, title: 'Same task' });
  for (const [action, input, patch] of steps) {
    const a = await workspace.getTask(viaActions.id);
    const b = await workspace.getTask(viaPatch.id);
    const result = await workspace.actOnTask(a.id, { action, version: a.version, ...input });
    await workspace.updateTask(b.id, { ...patch, version: b.version });
    assert.deepEqual(result.warnings, []);
    assert.equal(await read(a), await read(b), action);
  }
  const task = await workspace.getTask(viaActions.id);
  const error = await refusal(workspace.actOnTask(task.id, { action: 'unblock', version: task.version }));
  assert.deepEqual([error.status, error.code], [409, 'NOT_ALLOWED']);
});

// ---- Recovery at start

test('a write a dead process left locked is settled when the workspace starts', async () => {
  const repo = await board();
  const nonce = 'ab'.repeat(16);
  const lock = path.join(repo.dir, '.git', 'index.lock');
  await writeFile(lock, `agesight ${nonce}\n`);
  const { ino } = await lstat(lock);
  const gitDir = path.join(repo.dir, '.git');
  const marker = {
    phase: 'locked', dir: repo.dir, gitDir, commonDir: gitDir, format: 'sha1', branch: 'refs/heads/main',
    from: `AA/backlog/${T012}`, to: `AA/tasks/${T012}`, nonce, lockIno: ino,
    aside: path.join(repo.dir, 'AA', 'backlog', `.${T012}.agesight-${nonce}`), temp: path.join(repo.dir, 'AA', 'tasks', `.${T012}.agesight-${nonce}.tmp`),
    S: path.join(gitDir, `agesight-S-${nonce}`), N: path.join(gitDir, `agesight-N-${nonce}`), startedAt: new Date().toISOString(),
  };
  await mkdir(path.join(repo.dataDir, 'tracked-inflight'), { recursive: true });
  await writeFile(path.join(repo.dataDir, 'tracked-inflight', `${repo.project.id}.json`), JSON.stringify(marker));
  await new Workspace({ dataDir: repo.dataDir, operator: 'AGE Aris Tester', email: 'tester@example.invalid' }).init();
  assert.equal(await lstat(lock).then(() => true, () => false), false, 'its own lock is gone');
  assert.deepEqual(await readdir(path.join(repo.dataDir, 'tracked-inflight')), []);
  assert.equal((await act(repo, 'T012', 'claim')).task.status, 'in_progress');
});

test('an interrupted write is shown on the project until the operator clears it, and refuses the next action', async () => {
  const repo = await board();
  const markerPath = path.join(repo.dataDir, 'tracked-inflight', `${repo.project.id}.json`);
  await mkdir(path.dirname(markerPath), { recursive: true });
  await writeFile(markerPath, JSON.stringify({ phase: 'interrupted', dir: repo.dir, reason: 'Committed abc1234, but main moved before AGE Aris finished.' }));
  const project = (await repo.workspace.read()).projects.find((entry) => entry.id === repo.project.id);
  assert.deepEqual(project.actions.interrupted, { message: 'Committed abc1234, but main moved before AGE Aris finished.', marker: markerPath });
  await refused(repo, () => act(repo, 'T012', 'claim'), 409, 'INTERRUPTED_PENDING');
  await rm(markerPath);
  assert.equal((await act(repo, 'T012', 'claim')).task.status, 'in_progress');
});
