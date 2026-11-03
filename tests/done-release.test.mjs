// T121: Done in AGE Aris releases the task's environment, from AGE Aris's own
// copy of ckpt.sh. Real temporary repositories, no global or system git config,
// and nothing outside os.tmpdir() is touched.
import assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
import { chmod, lstat, mkdir, mkdtemp, readFile, realpath, rm, symlink, utimes, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';

import { namedFor, releaseTask, scratchFolder } from '../lib/release.mjs';
import { createServer } from '../server.mjs';
import { filterOff, trackedGit } from '../lib/tracked.mjs';
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

test('the repository\'s own ckpt.sh, its hooks and signing do not run, and the kept files still go in', async () => {
  const canaries = await tempDir('canaries');
  const canary = (name) => `#!/bin/sh\ntouch ${path.join(canaries, name)}\ncat\n`;
  const repo = await repository({ files: { 'AA/ckpt.sh': canary('own-ckpt') } });
  for (const [config, value, name] of [['gpg.program', path.join(canaries, 'run-sign'), 'sign'], ['diff.external', path.join(canaries, 'run-external'), 'external']]) {
    await git(repo.dir, 'config', config, value);
    await writeFile(value, canary(name));
    await chmod(value, 0o755);
  }
  await git(repo.dir, 'config', 'commit.gpgSign', 'true');
  await git(repo.dir, 'config', 'core.hooksPath', path.join(canaries, 'hooks'));
  await mkdir(path.join(canaries, 'hooks'));
  const hooks = ['pre-commit', 'prepare-commit-msg', 'commit-msg', 'post-commit', 'reference-transaction', 'post-index-change'];
  for (const hook of hooks) {
    const file = path.join(canaries, 'hooks', hook);
    await writeFile(file, canary(`hook-${hook}`));
    await chmod(file, 0o755);
  }
  const result = await done(repo);
  assert.equal(result.release.state, 'released', JSON.stringify(result.release));
  assert.equal(await exists(path.join(repo.dir, 'scratch/t050')), false);
  assert.equal(await git(repo.dir, 'show', 'HEAD:AA/evidence/T050/t050/notes.md'), 'what we found');
  for (const name of ['own-ckpt', 'sign', 'external', ...hooks.map((hook) => `hook-${hook}`)]) {
    assert.equal(await exists(path.join(canaries, name)), false, `${name} ran`);
  }
});

test('the evidence commit leaves the index and the working tree clean, and others\' staged work alone', async () => {
  const repo = await repository({ files: { 'theirs.txt': 'one\n' } });
  await writeFile(path.join(repo.dir, 'theirs.txt'), 'two\n');
  await git(repo.dir, 'add', 'theirs.txt');
  await writeFile(path.join(repo.dir, 'dirty.txt'), 'untracked\n');
  const result = await done(repo);
  assert.equal(result.release.state, 'released', JSON.stringify(result.release));
  assert.equal(await git(repo.dir, 'status', '--porcelain'), 'M  theirs.txt\n?? dirty.txt');
  assert.equal(await git(repo.dir, 'show', 'HEAD:theirs.txt'), 'one');
  assert.match(await git(repo.dir, 'log', '-1', '--format=%an %s'), /^ade evidence: T050/);
});

test('a repository whose own config names a filter is refused, and no filter runs', async () => {
  const repo = await repository({ files: { '.gitattributes': '*.md filter=sneak\n' } });
  const filter = await canary('sneak');
  await git(repo.dir, 'config', 'filter.sneak.clean', filter.file);
  const result = await done(repo);
  assert.equal(result.release.state, 'refused', JSON.stringify(result.release));
  assert.match(result.release.summary, /own git config names a filter/);
  assert.equal(await filter.ran(), false);
  assert.equal(await exists(path.join(repo.dir, 'scratch/t050/notes.md')), true);
  assert.equal(await exists(path.join(repo.dir, 'AA/tasks/done/T050-a-task.md')), true);
});

test('a filter in the user\'s own config is theirs, and does not stop the release', async () => {
  const file = path.join(await tempDir('global'), 'gitconfig');
  await writeFile(file, '[filter "lfs"]\n\tclean = cat\n');
  const before = process.env.GIT_CONFIG_GLOBAL;
  process.env.GIT_CONFIG_GLOBAL = file;
  try {
    const repo = await repository();
    assert.equal((await done(repo)).release.state, 'released');
  } finally {
    process.env.GIT_CONFIG_GLOBAL = before;
  }
});

test('filterOff switches off a filter with an empty name or an = in it; without it, git runs them', async () => {
  for (const [section, attributes] of [['[filter ""]', '*.txt filter=\n'], ['[filter "a=b"]', '*.txt filter=a=b\n']]) {
    const dir = await tempDir('off');
    await git(dir, 'init', '--quiet', '--initial-branch=main');
    await writeFile(path.join(dir, '.gitattributes'), attributes);
    const filter = await canary('ran');
    const config = path.join(dir, '.git/config');
    await writeFile(config, `${await readFile(config, 'utf8')}${section}\n\tclean = ${filter.file}\n`);
    await writeFile(path.join(dir, 'a.txt'), 'one\n');
    const off = await filterOff((args, options) => trackedGit(dir, args, options));
    assert.equal((await trackedGit(dir, [...off, 'add', 'a.txt'])).code, 0);
    assert.equal(await filter.ran(), false, `${section} ran with filterOff`);
    await writeFile(path.join(dir, 'a.txt'), 'two\n');
    await trackedGit(dir, ['add', 'a.txt']);
    assert.equal(await filter.ran(), true, `${section} does not run at all, so this proves nothing`);
  }
});

test('filters a task action could not otherwise switch off: an empty name and one with = do not run; a name that is not UTF-8 is refused', async () => {
  for (const [section, attributes, name] of [['[filter ""]', '*.md filter=\n', 'empty'], ['[filter "a=b"]', '*.md filter=a=b\n', 'equals']]) {
    const repo = await repository({ yml: '', files: { '.gitattributes': attributes } });
    const filter = await canary(name);
    const config = path.join(repo.dir, '.git/config');
    await writeFile(config, `${await readFile(config, 'utf8')}${section}\n\tclean = ${filter.file}\n`);
    const result = await done(repo);
    assert.match(result.commit, /^[0-9a-f]{40}$/);
    assert.equal(await filter.ran(), false, `the ${name} filter ran`);
  }
  const repo = await repository({ yml: '' });
  const config = path.join(repo.dir, '.git/config');
  await writeFile(config, Buffer.concat([await readFile(config), Buffer.from('[filter "'), Buffer.from([0xff]), Buffer.from('"]\n\tclean = /nonexistent\n')]));
  const refused = await done(repo).catch((error) => error);
  assert.equal(refused.code, 'BAD_CONFIG', refused.message);
  assert.equal(await exists(path.join(repo.dir, 'AA/tasks/T050-a-task.md')), true);
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

test('a folder holding a linked worktree stays whole: AGE Aris does not read it, so its own filter and a submodule\'s cannot run', async () => {
  const repo = await repository({ files: { '.gitattributes': '*.txt filter=own\n', 'tracked.txt': 'one\n' } });
  const own = await canary('own');
  const worktree = path.join(repo.dir, 'scratch/t050/wt');
  await git(repo.dir, 'worktree', 'add', '--quiet', '-b', 't050-wt', worktree);
  await git(repo.dir, 'config', 'extensions.worktreeConfig', 'true');
  await git(worktree, 'config', '--worktree', 'filter.own.clean', own.file);
  const stamp = new Date(Date.now() + 5000);
  await writeFile(path.join(worktree, 'tracked.txt'), 'one\n');
  await utimes(path.join(worktree, 'tracked.txt'), stamp, stamp);
  const result = await done(repo);
  assert.equal(await own.ran(), false, 'the worktree\'s filter ran');
  assert.notEqual(result.release.state, 'released', JSON.stringify(result.release));
  assert.match(result.release.lines.join(' '), /AGE Aris leaves worktrees to you|names a filter/);
  assert.equal(await exists(worktree), true);
  assert.equal(await exists(path.join(repo.dir, 'scratch/t050/notes.md')), true);
});

test('a landed worktree in the folder is left to a terminal, and the folder is named', async () => {
  const repo = await repository();
  const worktree = path.join(repo.dir, 'scratch/t050/wt');
  await git(repo.dir, 'worktree', 'add', '--quiet', '-b', 't050-wt', worktree);
  const result = await done(repo);
  assert.equal(result.release.state, 'kept', JSON.stringify(result.release));
  assert.match(result.release.summary, /AGE Aris leaves worktrees to you/);
  assert.match(result.release.remedy, /release T050$/);
  assert.equal(await exists(path.join(worktree, '.git')), true);
});

test('a replace ref cannot make unlanded work look landed', async () => {
  const repo = await repository();
  await git(repo.dir, 'checkout', '--quiet', '-b', 't050-wip');
  await write(repo.dir, 'wip.txt', 'not landed\n');
  await git(repo.dir, 'add', 'wip.txt');
  await git(repo.dir, 'commit', '--quiet', '-m', 'wip');
  await git(repo.dir, 'checkout', '--quiet', 'main');
  // Main's tip, replaced by one with the branch for its parent: to anything that
  // honours replace refs, the branch is now on main.
  await git(repo.dir, 'replace', '--graft', 'main', 't050-wip');
  await exec('git', ['merge-base', '--is-ancestor', 't050-wip', 'main'], { cwd: repo.dir, env: process.env });
  const result = await done(repo);
  assert.match(result.release.lines.join(' '), /branch t050-wip has commits not on main/);
  assert.match(await git(repo.dir, 'branch', '--list', 't050-wip'), /t050-wip/);
});

test('a running process named by path holds its folder, though it holds nothing open there', async () => {
  const repo = await repository();
  const child = spawn('sh', ['-c', 'sleep 30', 'scratch/t050/job.py'], { cwd: repo.dir, stdio: 'ignore' });
  try {
    const result = await done(repo);
    assert.equal(await exists(path.join(repo.dir, 'scratch/t050/notes.md')), true);
    assert.match(result.release.lines.join(' '), /a running process is using it/);
  } finally {
    child.kill();
  }
});

test('during a merge the release refuses, and leaves the merge\'s index alone', async () => {
  const repo = await repository({ files: { 'c.txt': 'base\n' } });
  await git(repo.dir, 'checkout', '--quiet', '-b', 'other');
  await write(repo.dir, 'c.txt', 'theirs\n');
  await git(repo.dir, 'commit', '--quiet', '-am', 'theirs');
  await git(repo.dir, 'checkout', '--quiet', 'main');
  await write(repo.dir, 'c.txt', 'ours\n');
  await git(repo.dir, 'commit', '--quiet', '-am', 'ours');
  await git(repo.dir, 'merge', '--quiet', 'other').catch(() => {});
  await mkdir(path.join(repo.dir, 'AA/tasks/done'), { recursive: true });
  // The Done is refused by the merge; the release of a task closed earlier is what is at stake.
  await write(repo.dir, 'AA/tasks/done/T060-closed.md', taskFile('T060').replace('status: claimed', 'status: done'));
  await write(repo.dir, 'scratch/t060/notes.md', 'x\n');
  const before = await git(repo.dir, 'diff', '--cached', '--name-only');
  const outcome = await releaseTask(repo.dir, 'T060');
  assert.equal(outcome.state, 'refused', JSON.stringify(outcome));
  assert.match(outcome.summary, /in progress \(MERGE_HEAD\)/);
  assert.equal(await git(repo.dir, 'diff', '--cached', '--name-only'), before);
  assert.equal(await exists(path.join(repo.dir, 'scratch/t060/notes.md')), true);
});

test('scratch/ swapped for a link while the release runs: nothing outside it is deleted', async () => {
  const outside = await tempDir('outside');
  await write(outside, 't050/precious.txt', 'mine\n');
  const repo = await repository();
  // Nothing to keep, so the release reaches the delete with no copy to stop it first.
  await rm(path.join(repo.dir, 'scratch/t050/notes.md'));
  // `du` runs after the checks; this one does the swap as a racing agent might.
  const bin = await tempDir('bin');
  await writeFile(path.join(bin, 'du'), `#!/bin/sh\ncd ${repo.dir} && [ -d scratch ] && [ ! -L scratch ] && mv scratch scratch-real && ln -s ${outside} scratch\necho 4\n`);
  await chmod(path.join(bin, 'du'), 0o755);
  const before = process.env.PATH;
  process.env.PATH = `${bin}:${before}`;
  try {
    const result = await done(repo);
    assert.notEqual(result.release.state, 'released', JSON.stringify(result.release));
  } finally {
    process.env.PATH = before;
  }
  assert.equal(await readFile(path.join(outside, 't050/precious.txt'), 'utf8'), 'mine\n');
});

test('a task file that is a FIFO is refused rather than hanging, and a stuck release is stopped', async () => {
  const repo = await repository();
  await mkdir(path.join(repo.dir, 'AA/tasks/done'), { recursive: true });
  await exec('mkfifo', [path.join(repo.dir, 'AA/tasks/done/T060-pipe.md')]);
  const refused = await releaseTask(repo.dir, 'T060');
  assert.equal(refused.state, 'refused', JSON.stringify(refused));
  assert.match(refused.summary, /not a regular file/);
  const script = path.join(await tempDir('stuck'), 'stuck.sh');
  await writeFile(script, "#!/bin/bash\ntrap '' TERM\nsleep 60 &\nsleep 60\n");
  const started = Date.now();
  const stopped = await releaseTask(repo.dir, 'T050', { script, limit: 100 });
  assert.equal(stopped.state, 'failed', JSON.stringify(stopped));
  assert.ok(Date.now() - started < 8000, `took ${Date.now() - started} ms`);
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

// ---- The sweep: tasks closed with git (T122).

// T050 moved to done/ with git, as an agent closes one, its scratch left behind.
async function closedByGit(repo, id = 'T050', slug = 'a-task') {
  await mkdir(path.join(repo.dir, 'AA/tasks/done'), { recursive: true });
  await git(repo.dir, 'mv', `AA/tasks/${id}-${slug}.md`, 'AA/tasks/done/');
  await git(repo.dir, 'commit', '--quiet', '-m', `${id} done`);
}
const HOUR = 3_600_000;
const later = (hours = 2) => Date.now() + hours * HOUR;
// The first sweep sees the task; a sweep past the grace period acts on it.
async function sweptPastGrace(repo) {
  await repo.workspace.sweepReleases({ now: later(0) });
  await repo.workspace.sweepReleases({ now: later(2) });
}

test('a task an agent closed with git is released once AGE Aris has known of it for an hour; another task is not', async () => {
  const repo = await repository();
  await closedByGit(repo);
  await sweptPastGrace(repo);
  assert.equal(await exists(path.join(repo.dir, 'scratch/t050')), false);
  assert.equal(await exists(path.join(repo.dir, 'scratch/t051/notes.md')), true);
  assert.equal(await git(repo.dir, 'show', 'HEAD:AA/evidence/T050/t050/notes.md'), 'what we found');
  const record = JSON.parse(await readFile(path.join(repo.workspace.dataDir, 'releases.jsonl'), 'utf8'));
  assert.equal(record.trigger, 'sweep');
  assert.equal(record.state, 'released');
  const project = (await repo.workspace._project(repo.project.id)).project;
  assert.equal(project.actions.releases.released, 1);
  assert.deepEqual(project.actions.releases.stuck, []);
});

test('the sweep leaves a fresh close and an uncommitted move alone, and a commit\'s date does not hurry it', async () => {
  const repo = await repository();
  await mkdir(path.join(repo.dir, 'AA/tasks/done'), { recursive: true });
  await git(repo.dir, 'mv', 'AA/tasks/T050-a-task.md', 'AA/tasks/done/');
  await exec('git', ['commit', '--quiet', '-m', 'T050 done, dated long ago'], { cwd: repo.dir, env: { ...process.env, GIT_COMMITTER_DATE: '2020-01-01T00:00:00Z', GIT_AUTHOR_DATE: '2020-01-01T00:00:00Z' } });
  await repo.workspace.sweepReleases({ now: later(0) });
  assert.equal(await exists(path.join(repo.dir, 'scratch/t050/notes.md')), true, 'first sight, whatever the date says');
  await git(repo.dir, 'mv', 'AA/tasks/T051-another.md', 'AA/tasks/done/');
  await repo.workspace.sweepReleases({ now: later(2) });
  await repo.workspace.sweepReleases({ now: later(4) });
  assert.equal(await exists(path.join(repo.dir, 'scratch/t051/notes.md')), true, 'a move not committed');
  assert.equal(await exists(path.join(repo.dir, 'scratch/t050')), false, 'past the hour');
});

test('the sweep leaves a board with actions off, or with no scratch:, alone', async () => {
  const off = await repository();
  await closedByGit(off);
  const stored = (await off.workspace._project(off.project.id)).project;
  await off.workspace.updateProject(off.project.id, { version: stored.version, taskActions: { on: false } });
  await sweptPastGrace(off);
  assert.equal(await exists(path.join(off.dir, 'scratch/t050/notes.md')), true, 'actions off');

  const bare = await repository({ yml: '' });
  await closedByGit(bare);
  await sweptPastGrace(bare);
  assert.equal(await exists(path.join(bare.dir, 'scratch/t050/notes.md')), true, 'no scratch:');
});

test('switching actions off during a pass stops it before the next task', async () => {
  const repo = await repository();
  await closedByGit(repo);
  await closedByGit(repo, 'T051', 'another');
  await repo.workspace.sweepReleases({ now: later(0) });
  const queue = repo.workspace._queueRelease.bind(repo.workspace);
  repo.workspace._queueRelease = async (...args) => {
    const outcome = await queue(...args);
    const stored = (await repo.workspace._project(repo.project.id)).project;
    await repo.workspace.updateProject(repo.project.id, { version: stored.version, taskActions: { on: false } });
    return outcome;
  };
  await repo.workspace.sweepReleases({ now: later(2) });
  assert.equal(await exists(path.join(repo.dir, 'scratch/t050')), false, 'the first went');
  assert.equal(await exists(path.join(repo.dir, 'scratch/t051/notes.md')), true, 'the second stayed');
});

test('one sweep at a time', async () => {
  const repo = await repository();
  await closedByGit(repo);
  await repo.workspace.sweepReleases({ now: later(0) });
  await Promise.all([repo.workspace.sweepReleases({ now: later(2) }), repo.workspace.sweepReleases({ now: later(2) })]);
  const lines = (await readFile(path.join(repo.workspace.dataDir, 'releases.jsonl'), 'utf8')).trim().split('\n');
  assert.equal(lines.length, 1);
  repo.workspace._sweeping = true;
  await closedByGit(repo, 'T051', 'another');
  await repo.workspace.sweepReleases({ now: later(0) });
  await repo.workspace.sweepReleases({ now: later(2) });
  assert.equal(await exists(path.join(repo.dir, 'scratch/t051/notes.md')), true, 'a sweep going keeps a second off');
});

async function stuckRepository() {
  const repo = await repository();
  const line = JSON.stringify({ ts: '2026-01-01T00:00:00Z', run: 'old', kind: 'doing', act: 'train', next: 'x' });
  await write(repo.dir, 'AA/checkpoints/T050.jsonl', `${line}\n`);
  await git(repo.dir, 'add', '-A');
  await git(repo.dir, 'commit', '--quiet', '-m', 'a trail');
  await closedByGit(repo);
  return repo;
}
const records = async (repo) => (await readFile(path.join(repo.workspace.dataDir, 'releases.jsonl'), 'utf8')).trim().split('\n').length;

test('what the sweep cannot release shows on the project, and is not tried again for a day', async () => {
  const repo = await stuckRepository();
  await sweptPastGrace(repo);
  const stuck = (await repo.workspace._project(repo.project.id)).project.actions.releases.stuck;
  assert.equal(stuck.length, 1);
  assert.equal(stuck[0].task, 'T050');
  assert.match(stuck[0].summary, /stopped mid-act/);
  assert.match(stuck[0].remedy, /release T050$/);
  assert.equal(await exists(path.join(repo.dir, 'scratch/t050/notes.md')), true);
  await repo.workspace.sweepReleases({ now: later(3) });
  assert.equal(await records(repo), 1, 'tried again within the day');
  await repo.workspace.sweepReleases({ now: later(30) });
  assert.equal(await records(repo), 2, 'not tried again after the day');
});

test('once the operator clears what was stuck, the project stops saying it is', async () => {
  const repo = await stuckRepository();
  await sweptPastGrace(repo);
  assert.equal((await repo.workspace._project(repo.project.id)).project.actions.releases.stuck.length, 1);
  await rm(path.join(repo.dir, 'scratch/t050'), { recursive: true });
  await repo.workspace.sweepReleases({ now: later(3) });
  assert.deepEqual((await repo.workspace._project(repo.project.id)).project.actions.releases.stuck, []);
});

test('a release that left something behind is not tried again within the day', async () => {
  const repo = await repository();
  await git(repo.dir, 'checkout', '--quiet', '-b', 't050-wip');
  await write(repo.dir, 'wip.txt', 'not landed\n');
  await git(repo.dir, 'add', 'wip.txt');
  await git(repo.dir, 'commit', '--quiet', '-m', 'wip');
  await git(repo.dir, 'checkout', '--quiet', 'main');
  await closedByGit(repo);
  await sweptPastGrace(repo);
  assert.equal(await exists(path.join(repo.dir, 'scratch/t050')), false);
  assert.match(await git(repo.dir, 'branch', '--list', 't050-wip'), /t050-wip/);
  assert.equal((await repo.workspace._project(repo.project.id)).project.actions.releases.stuck[0].task, 'T050');
  await repo.workspace.sweepReleases({ now: later(3) });
  assert.equal(await records(repo), 1);
});

test('a sweep finds branches named for a done task; a task holding nothing is never run', async () => {
  const repo = await repository();
  await rm(path.join(repo.dir, 'scratch/t050'), { recursive: true });
  await closedByGit(repo);
  await sweptPastGrace(repo);
  await assert.rejects(readFile(path.join(repo.workspace.dataDir, 'releases.jsonl')), 'nothing named for it, no run');
  await git(repo.dir, 'branch', 't050-side');
  await sweptPastGrace(repo);
  assert.equal(await git(repo.dir, 'branch', '--list', 't050-side'), '');
});

test('namedFor reads names as ckpt.sh does', () => {
  assert.deepEqual(namedFor(['T123', 'T12', 'T999'], ['t123', 'T123-x']), ['T123']);
  assert.deepEqual(namedFor(['T123'], ['t123_x']), ['T123']);
  assert.deepEqual(namedFor(['T123'], ['t123/x']), ['T123']);
  assert.deepEqual(namedFor(['T123'], ['t1234', 'xt123', 't123x']), []);
});

test('scratchFolder reads the value, not a comment', () => {
  assert.equal(scratchFolder('a: 1\nscratch: work  # here\nb: 2\n'), 'work');
  assert.equal(scratchFolder('# scratch: no\n'), '');
  assert.equal(scratchFolder('scratch:\n'), '');
});

test('a real server sweeps by itself once told to start', async () => {
  const repo = await repository({ workspace: { sweepGrace: 0 } });
  await closedByGit(repo);
  const server = await createServer({ dataDir: repo.workspace.dataDir });
  server.workspace.sweepGrace = 0;
  server.startSweeping({ first: 5, every: 50 });
  try {
    for (let tries = 0; tries < 200 && await exists(path.join(repo.dir, 'scratch/t050')); tries += 1) await new Promise((resolve) => { setTimeout(resolve, 50); });
    assert.equal(await exists(path.join(repo.dir, 'scratch/t050')), false);
  } finally {
    await new Promise((resolve) => { server.close(resolve); server.emit('close'); });
    await server.workspace.releasesSettled();
  }
});
