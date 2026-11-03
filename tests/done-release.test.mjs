// T121: Done in AGE Aris releases the task's environment, from AGE Aris's own
// copy of ckpt.sh. Real temporary repositories, no global or system git config,
// and nothing outside os.tmpdir() is touched.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { chmod, lstat, mkdir, mkdtemp, readFile, realpath, rm, symlink, utimes, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';

import { redactEmails, Workspace } from '../lib/workspace.mjs';

process.env.GIT_CONFIG_GLOBAL = os.devNull;
process.env.GIT_CONFIG_NOSYSTEM = '1';
delete process.env.AGEARIS_TRACKED_WRITES;
delete process.env.CLAUDE_CODE_SESSION_ID;

const exec = promisify(execFile);
const temporary = new Set();
test.after(() => Promise.all([...temporary].map((directory) => rm(directory, { recursive: true, force: true }))));

async function tempDir(kind) {
  const directory = await realpath(await mkdtemp(path.join(os.tmpdir(), `agearis-done-release-${kind}-`)));
  temporary.add(directory);
  return directory;
}

const git = async (dir, ...args) => (await exec('git', args, { cwd: dir, env: process.env })).stdout.trim();
const exists = (file) => lstat(file).then(() => true, () => false);

async function write(dir, file, content) {
  await mkdir(path.dirname(path.join(dir, file)), { recursive: true });
  await writeFile(path.join(dir, file), content);
}

function taskFile(id) {
  return `---\nid: ${id}\ntitle: "A task"\nstatus: claimed\nowner: ade @agearis/web 2026-11-03 — working\nblockedReason: ""\n---\n\n# ${id} — A task\n\n## Result\n\nShipped.\n`;
}

// A repository on `main` with T050 and T051 in progress, each holding a scratch
// folder with a notes file (kept) and a build (not), tracked with actions on.
async function repository({ yml = 'scratch: scratch\n', files = {}, workspace: options = {}, branch } = {}) {
  const dir = await tempDir('repo');
  await git(dir, 'init', '--quiet', '--initial-branch=main');
  await git(dir, 'config', 'user.name', 'ade');
  await git(dir, 'config', 'user.email', 'ade@example.invalid');
  const all = { 'AA/AA.yml': `wip:\n  in_progress: 3\n${yml}`, 'AA/STATE.md': '# State\n', 'AA/backlog/.gitkeep': '', 'AA/tasks/T050-a-task.md': taskFile('T050'), 'AA/tasks/T051-another.md': taskFile('T051'), '.gitignore': 'scratch/\n', ...files };
  for (const [file, content] of Object.entries(all)) await write(dir, file, content);
  await git(dir, 'add', '-A');
  await git(dir, 'commit', '--quiet', '-m', 'fixture');
  for (const id of ['t050', 't051']) {
    await write(dir, `scratch/${id}/notes.md`, 'what we found\n');
    await write(dir, `scratch/${id}/build/a.bin`, 'bulk\n');
  }
  if (branch) await git(dir, 'checkout', '--quiet', '-b', branch);
  const workspace = await new Workspace({ dataDir: await tempDir('data'), operator: 'Tester', email: 'tester@example.invalid', ...options }).init();
  let project = await workspace.linkProject({ path: dir, name: 'Theirs' });
  const asked = await workspace.updateProject(project.id, { version: project.version, taskActions: { on: true } }).catch((error) => error);
  assert.equal(asked.code, 'CONFIRM', asked.message);
  project = await workspace.updateProject(project.id, { version: project.version, taskActions: { on: true }, confirm: asked.details.confirmToken });
  return { dir, workspace, project, id: `${project.id}:T050` };
}

async function done(repo, input = {}) {
  const task = await repo.workspace.getTask(repo.id);
  return repo.workspace.actOnTask(repo.id, { action: 'done', version: task.version, ...input });
}

test('Done releases the task\'s scratch and commits what it keeps; another task\'s scratch stays', async () => {
  const repo = await repository();
  const result = await done(repo);
  assert.equal(result.release.state, 'released', JSON.stringify(result.release));
  assert.match(result.release.summary, /T050's environment is released/);
  assert.equal(await exists(path.join(repo.dir, 'scratch/t050')), false);
  assert.equal(await exists(path.join(repo.dir, 'scratch/t051/notes.md')), true);
  assert.equal(await git(repo.dir, 'log', '-1', '--format=%s'), "evidence: T050's kept files, before its environment is released");
  assert.equal(await git(repo.dir, 'show', 'HEAD:AA/evidence/T050/t050/notes.md'), 'what we found');
  assert.equal(await git(repo.dir, 'status', '--porcelain'), '');
  assert.equal((await repo.workspace.getTask(repo.id)).release.state, 'released');
  const record = JSON.parse(await readFile(path.join(repo.workspace.dataDir, 'releases.jsonl'), 'utf8'));
  assert.equal(record.task, 'T050');
  assert.equal(record.state, 'released');
  assert.ok(record.lines.some((line) => line.startsWith('delete scratch/t050')), JSON.stringify(record.lines));
});

test('the repository\'s own ckpt.sh, its hooks, filters and signing do not run', async () => {
  const canaries = await tempDir('canaries');
  const canary = (name) => `#!/bin/sh\ntouch ${path.join(canaries, name)}\ncat\n`;
  const repo = await repository({
    files: {
      'AA/ckpt.sh': canary('own-ckpt'),
      '.gitattributes': '*.md filter=sneak diff=sneak\n',
    },
  });
  for (const [name, config, value] of [
    ['hook', 'core.hooksPath', path.join(canaries, 'hooks')],
    ['clean', 'filter.sneak.clean', path.join(canaries, 'run-clean')],
    ['sign', 'gpg.program', path.join(canaries, 'run-sign')],
    ['external', 'diff.external', path.join(canaries, 'run-external')],
    ['driver', 'diff.sneak.command', path.join(canaries, 'run-driver')],
    ['textconv', 'diff.sneak.textconv', path.join(canaries, 'run-textconv')],
  ]) {
    await git(repo.dir, 'config', config, value);
    if (name !== 'hook') {
      await writeFile(value, canary(name));
      await chmod(value, 0o755);
    }
  }
  await git(repo.dir, 'config', 'commit.gpgSign', 'true');
  await mkdir(path.join(canaries, 'hooks'));
  for (const hook of ['pre-commit', 'prepare-commit-msg', 'commit-msg', 'post-commit']) {
    const file = path.join(canaries, 'hooks', hook);
    await writeFile(file, canary(`hook-${hook}`));
    await chmod(file, 0o755);
  }
  const result = await done(repo);
  assert.equal(result.release.state, 'released', JSON.stringify(result.release));
  assert.equal(await exists(path.join(repo.dir, 'scratch/t050')), false);
  for (const name of ['own-ckpt', 'clean', 'sign', 'external', 'driver', 'textconv', 'hook-pre-commit', 'hook-prepare-commit-msg', 'hook-commit-msg', 'hook-post-commit']) {
    assert.equal(await exists(path.join(canaries, name)), false, `${name} ran`);
  }
});

test('a board whose AA.yml names no scratch: is left alone, and the result says so', async () => {
  const repo = await repository({ yml: '' });
  const result = await done(repo);
  assert.equal(result.release.state, 'off');
  assert.match(result.release.summary, /names no scratch: folder/);
  assert.equal(await exists(path.join(repo.dir, 'scratch/t050/notes.md')), true);
  assert.match(await git(repo.dir, 'log', '-1', '--format=%s'), /^T050 done/);
});

test('a refused release leaves the Done standing and the folder whole, and says what to run', async () => {
  const dir = await repository({ yml: 'scratch: scratch\ntrunk: main\n', branch: 'side' });
  const result = await done(dir);
  assert.equal(result.release.state, 'refused', JSON.stringify(result.release));
  assert.match(result.release.summary, /check out main first/);
  assert.match(result.release.remedy, /release T050$/);
  assert.equal(await exists(path.join(dir.dir, 'scratch/t050/build/a.bin')), true);
  assert.equal(await exists(path.join(dir.dir, 'AA/tasks/done/T050-a-task.md')), true);
});

test('a run that never ended blocks the release, not the confirmed Done', async () => {
  const line = JSON.stringify({ ts: '2026-01-01T00:00:00Z', run: 'old', kind: 'doing', act: 'train', next: 'x' });
  const repo = await repository({ files: { 'AA/checkpoints/T050.jsonl': `${line}\n` } });
  const asked = await done(repo).catch((error) => error);
  assert.equal(asked.code, 'CONFIRM', asked.message);
  const result = await done(repo, { confirm: asked.details.confirmToken });
  assert.equal(result.release.state, 'refused', JSON.stringify(result.release));
  assert.match(result.release.summary, /stopped mid-act/);
  assert.equal(await exists(path.join(repo.dir, 'scratch/t050/notes.md')), true);
  assert.equal(await exists(path.join(repo.dir, 'AA/tasks/done/T050-a-task.md')), true);
});

test('a nested repository keeps its folder whole: AGE Aris does not read its config', async () => {
  const repo = await repository();
  const canaries = await tempDir('canaries');
  const nested = path.join(repo.dir, 'scratch/t050/clone');
  await mkdir(nested, { recursive: true });
  await git(nested, 'init', '--quiet', '--initial-branch=main');
  await git(nested, 'config', 'user.name', 'ade');
  await git(nested, 'config', 'user.email', 'ade@example.invalid');
  await writeFile(path.join(nested, '.gitattributes'), '*.txt filter=sneak\n');
  await writeFile(path.join(nested, 'a.txt'), 'one\n');
  await git(nested, 'add', '-A');
  await git(nested, 'commit', '--quiet', '-m', 'one');
  const filter = path.join(canaries, 'run-filter');
  await writeFile(filter, `#!/bin/sh\ntouch ${path.join(canaries, 'ran')}\ncat\n`);
  await chmod(filter, 0o755);
  await git(nested, 'config', 'filter.sneak.clean', filter);
  await writeFile(path.join(nested, 'a.txt'), 'two\n');
  const result = await done(repo);
  assert.equal(await exists(path.join(canaries, 'ran')), false, 'the nested repository\'s filter ran');
  assert.match(result.release.summary, /AGE Aris leaves it to you/);
  assert.equal(result.release.state, 'kept', JSON.stringify(result.release));
  assert.match(result.release.summary, /nested repository scratch\/t050\/clone/);
  assert.match(result.release.remedy, /release T050$/);
  assert.equal(await exists(path.join(nested, '.git')), true);
  assert.equal(await exists(path.join(repo.dir, 'scratch/t050/notes.md')), true);
});

test('a task that holds nothing says nothing', async () => {
  const repo = await repository();
  await rm(path.join(repo.dir, 'scratch/t050'), { recursive: true });
  const result = await done(repo);
  assert.equal(result.release.state, 'nothing', JSON.stringify(result.release));
  assert.equal(result.release.summary, '');
});

test('a long release answers "running", and the task says how it ended', async () => {
  const repo = await repository({ workspace: { releaseWait: 0 } });
  const result = await done(repo);
  assert.equal(result.release.state, 'running');
  assert.match(await git(repo.dir, 'log', '--format=%s'), /T050 done/);
  await repo.workspace.releasesSettled();
  assert.equal((await repo.workspace.getTask(repo.id)).release.state, 'released');
  assert.equal(await exists(path.join(repo.dir, 'scratch/t050')), false);
});

test('a release that cannot start is reported, and the Done stands', async () => {
  const repo = await repository({ workspace: { releaseScript: '/nonexistent/ckpt.sh' } });
  const result = await done(repo);
  assert.equal(result.release.state, 'refused', JSON.stringify(result.release));
  assert.equal(await exists(path.join(repo.dir, 'AA/tasks/done/T050-a-task.md')), true);
  assert.equal(await exists(path.join(repo.dir, 'scratch/t050/notes.md')), true);
});

test('no other task action releases anything', async () => {
  const repo = await repository();
  const task = await repo.workspace.getTask(repo.id);
  const result = await repo.workspace.actOnTask(repo.id, { action: 'block', reason: 'waiting', version: task.version });
  assert.equal(result.release, undefined);
  assert.equal(await exists(path.join(repo.dir, 'scratch/t050/notes.md')), true);
});

// A script that leaves a mark when it runs, as the value of a config key.
async function canary(name) {
  const folder = await tempDir('canary');
  const file = path.join(folder, 'run');
  await writeFile(file, `#!/bin/sh\ntouch ${path.join(folder, name)}\ncat\n`);
  await chmod(file, 0o755);
  return { file, ran: () => exists(path.join(folder, name)) };
}

test('the commit\'s automatic maintenance does not run gc\'s hook', async () => {
  const repo = await repository();
  const hook = await canary('gc');
  for (let index = 0; index < 3; index += 1) {
    await write(repo.dir, `pack${index}.txt`, `${index}\n`);
    await git(repo.dir, 'add', '-A');
    await git(repo.dir, 'commit', '--quiet', '-m', `pack ${index}`);
    await git(repo.dir, 'repack', '--quiet');
  }
  // An old object nothing reaches, which is what gc asks the hook about.
  await write(repo.dir, 'loose.txt', 'unreachable\n');
  await git(repo.dir, 'add', 'loose.txt');
  const id = await git(repo.dir, 'rev-parse', ':loose.txt');
  await git(repo.dir, 'rm', '--quiet', '--cached', 'loose.txt');
  await rm(path.join(repo.dir, 'loose.txt'));
  const old = new Date('2020-01-01');
  await utimes(path.join(repo.dir, '.git/objects', id.slice(0, 2), id.slice(2)), old, old);
  for (const [key, value] of [['gc.auto', '1'], ['gc.autoPackLimit', '1'], ['gc.autoDetach', 'false'], ['gc.recentObjectsHook', hook.file]]) await git(repo.dir, 'config', key, value);
  const result = await done(repo);
  assert.equal(result.release.state, 'released', JSON.stringify(result.release));
  assert.equal(await hook.ran(), false, 'gc\'s hook ran');
});

test('a linked worktree\'s own filter does not run, and a filter whose name has = runs neither in the release nor in the Done', async () => {
  const repo = await repository({ files: { '.gitattributes': '*.txt filter=own\n*.md filter=a=b\n', 'tracked.txt': 'one\n' } });
  const own = await canary('own');
  const equals = await canary('equals');
  const worktree = path.join(repo.dir, 'scratch/t050/wt');
  await git(repo.dir, 'worktree', 'add', '--quiet', '-b', 't050-wt', worktree);
  await git(repo.dir, 'config', 'extensions.worktreeConfig', 'true');
  await git(worktree, 'config', '--worktree', 'filter.own.clean', own.file);
  await git(repo.dir, 'config', 'filter.a=b.clean', equals.file);
  // Rewritten with the same bytes and an old-looking entry, so status asks the filter.
  const stamp = new Date(Date.now() + 5000);
  await writeFile(path.join(worktree, 'tracked.txt'), 'one\n');
  await utimes(path.join(worktree, 'tracked.txt'), stamp, stamp);
  const result = await done(repo);
  assert.equal(await own.ran(), false, 'the worktree\'s filter ran');
  assert.equal(await equals.ran(), false, 'the = filter ran');
  assert.equal(result.release.state, 'released', JSON.stringify(result.release));
  assert.equal(await exists(worktree), false);
});

test('a symlink under the evidence folder stops the release before any copy goes through it', async () => {
  const outside = await tempDir('outside');
  await writeFile(path.join(outside, 'precious'), 'mine\n');
  const repo = await repository();
  await mkdir(path.join(repo.dir, 'AA/evidence/T050/t050'), { recursive: true });
  await symlink(path.join(outside, 'precious'), path.join(repo.dir, 'AA/evidence/T050/t050/notes.md'));
  await git(repo.dir, 'add', '-A');
  await git(repo.dir, 'commit', '--quiet', '-m', 'a link');
  const result = await done(repo);
  assert.equal(result.release.state, 'refused', JSON.stringify(result.release));
  assert.match(result.release.summary, /holds a symlink/);
  assert.equal(await readFile(path.join(outside, 'precious'), 'utf8'), 'mine\n');
  assert.equal(await exists(path.join(repo.dir, 'scratch/t050/notes.md')), true);
});

test('keeps: never reads through a symlinked folder', async () => {
  const outside = await tempDir('outside');
  await writeFile(path.join(outside, 'token.conf'), 'secret\n');
  const repo = await repository({ files: { 'AA/tasks/T050-a-task.md': taskFile('T050').replace('blockedReason: ""', 'blockedReason: ""\nkeeps: [lnk/token.conf]') } });
  await symlink(outside, path.join(repo.dir, 'lnk'));
  await git(repo.dir, 'add', 'lnk');
  await git(repo.dir, 'commit', '--quiet', '-m', 'a link');
  const result = await done(repo);
  assert.equal(result.release.state, 'refused', JSON.stringify(result.release));
  assert.match(result.release.summary, /goes through a symlink/);
  assert.equal(await exists(path.join(repo.dir, 'AA/evidence/T050/token.conf')), false);
  assert.equal(await exists(path.join(repo.dir, 'scratch/t050/notes.md')), true);
});

test('scratch: cannot name git\'s folder, the board, or a folder git does not ignore', async () => {
  for (const folder of ['.git/refs/heads', 'AA']) {
    const repo = await repository({ yml: `scratch: ${folder}\n` });
    await git(repo.dir, 'branch', 't050-wip');
    const result = await done(repo);
    assert.equal(result.release.state, 'refused', JSON.stringify(result.release));
    assert.match(result.release.summary, /cannot be git's folder or the board/);
    assert.match(await git(repo.dir, 'branch', '--list', 't050-wip'), /t050-wip/);
  }
  const repo = await repository({ yml: 'scratch: src\n' });
  await write(repo.dir, 'src/t050-draft/work.c', 'int main;\n');
  const result = await done(repo);
  assert.equal(result.release.state, 'refused', JSON.stringify(result.release));
  assert.match(result.release.summary, /src is not ignored by git/);
  assert.equal(await exists(path.join(repo.dir, 'src/t050-draft/work.c')), true);
});

test('core.worktree cannot send the release to another repository', async () => {
  const other = await tempDir('other');
  await git(other, 'init', '--quiet', '--initial-branch=main');
  await write(other, 'scratch/t050/theirs.bin', 'theirs\n');
  await write(other, '.gitignore', 'scratch/\n');
  const repo = await repository();
  const task = await repo.workspace.getTask(repo.id);
  // Set as the Done lands, as an agent could: AGE Aris's own write has passed by then.
  const realRelease = repo.workspace._releaseDone.bind(repo.workspace);
  repo.workspace._releaseDone = async (...args) => {
    await git(repo.dir, 'config', 'core.worktree', other);
    return realRelease(...args);
  };
  const result = await repo.workspace.actOnTask(repo.id, { action: 'done', version: task.version });
  assert.equal(result.release.state, 'refused', JSON.stringify(result.release));
  assert.match(result.release.summary, /check core\.worktree/);
  assert.equal(await exists(path.join(other, 'scratch/t050/theirs.bin')), true);
});

test('a huge keeps: line does not stall the server, and is reported clipped', async () => {
  const repo = await repository({ files: { 'AA/tasks/T050-a-task.md': taskFile('T050').replace('blockedReason: ""', `blockedReason: ""\nkeeps: [${'a'.repeat(200_000)}]`) } });
  const started = Date.now();
  const result = await done(repo);
  assert.ok(Date.now() - started < 5000, `took ${Date.now() - started} ms`);
  assert.equal(result.release.state, 'refused', JSON.stringify(result.release).slice(0, 300));
  assert.ok(result.release.summary.length < 500, `${result.release.summary.length} characters`);
  assert.equal(redactEmails('mail a@b.c, or @x and y@ <d@e>'), 'mail [email redacted] or @x and y@ <[email redacted]>');
});

test('a release with more output than is kept still says it released', async () => {
  const repo = await repository({ workspace: { releaseWait: 60_000 } });
  const name = 'x'.repeat(200);
  for (let index = 0; index < 400; index += 1) await mkdir(path.join(repo.dir, `scratch/t050-${index}-${name}`), { recursive: true });
  const result = await done(repo);
  assert.equal(result.release.state, 'released', JSON.stringify(result.release).slice(0, 300));
  assert.match(result.release.lines.at(-1), /^and \d+ more$/);
});

test('what cannot be deleted makes the release partial, not released', { skip: process.getuid?.() === 0 }, async () => {
  const repo = await repository();
  const locked = path.join(repo.dir, 'scratch/t050/locked');
  await mkdir(locked);
  await writeFile(path.join(locked, 'a.bin'), 'x');
  await chmod(locked, 0o555);
  try {
    const result = await done(repo);
    assert.equal(result.release.state, 'partial', JSON.stringify(result.release));
    assert.match(result.release.summary, /released in part: could not delete all of scratch\/t050/);
    assert.match(result.release.remedy, /release T050$/);
  } finally {
    await chmod(locked, 0o755);
  }
});

test('nothing after the commit can turn a Done into an error', async () => {
  const repo = await repository();
  repo.workspace._releaseDone = async () => { throw new Error('release.mjs is gone'); };
  const result = await done(repo);
  assert.equal(result.release.state, 'failed');
  assert.match(result.release.summary, /release\.mjs is gone/);
  assert.equal(await exists(path.join(repo.dir, 'AA/tasks/done/T050-a-task.md')), true);
});
