// Rule 13: `AA/ckpt.sh release` deletes what a done task left on disk and
// nothing else (T111). Real temporary repositories, no global git config, and
// nothing outside os.tmpdir() is touched.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { copyFile, lstat, mkdir, mkdtemp, readFile, realpath, rm, symlink, utimes, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';

process.env.GIT_CONFIG_GLOBAL = os.devNull;
process.env.GIT_CONFIG_NOSYSTEM = '1';
delete process.env.CLAUDE_CODE_SESSION_ID;

const exec = promisify(execFile);
const CKPT = new URL('../AA/ckpt.sh', import.meta.url).pathname;
const temporary = new Set();
test.after(() => Promise.all([...temporary].map((directory) => rm(directory, { recursive: true, force: true }))));

async function tempDir(kind) {
  const directory = await realpath(await mkdtemp(path.join(os.tmpdir(), `agearis-release-${kind}-`)));
  temporary.add(directory);
  return directory;
}

const git = async (dir, ...args) => (await exec('git', args, { cwd: dir, env: process.env })).stdout.trim();
const exists = (file) => lstat(file).then(() => true, () => false);

function taskFile(id, fields = {}) {
  const header = Object.entries({ id, title: '"A task"', status: 'done', owner: '—', ...fields }).map(([key, value]) => `${key}: ${value}`).join('\n');
  return `---\n${header}\n---\n\n# ${id} — A task\n\n## Result\n\nDone.\n`;
}

async function write(dir, file, content) {
  await mkdir(path.dirname(path.join(dir, file)), { recursive: true });
  await writeFile(path.join(dir, file), content);
}

// A repository on `main` with T001 done, T002 done and T003 in progress, each
// committed; scratch/ is ignored, as in AGEIS.
async function repo({ t001 = {}, yml = '' } = {}) {
  const dir = await tempDir('repo');
  await git(dir, 'init', '--quiet', '--initial-branch=main');
  await git(dir, 'config', 'user.name', 'ade');
  await git(dir, 'config', 'user.email', 'ade@example.invalid');
  await mkdir(path.join(dir, 'AA/checkpoints'), { recursive: true });
  await copyFile(CKPT, path.join(dir, 'AA/ckpt.sh'));
  await write(dir, '.gitignore', 'scratch/\n');
  await write(dir, 'AA/tasks/done/T001-one.md', taskFile('T001', t001));
  await write(dir, 'AA/tasks/done/T002-two.md', taskFile('T002'));
  await write(dir, 'AA/tasks/T003-three.md', taskFile('T003', { status: 'claimed' }));
  if (yml) await write(dir, 'AA/AA.yml', yml);
  await write(dir, 'README.md', 'one\n');
  await git(dir, 'add', '-A');
  await git(dir, 'commit', '--quiet', '-m', 'fixture');
  return dir;
}

async function release(dir, ...args) {
  try {
    const { stdout, stderr } = await exec('bash', ['AA/ckpt.sh', 'release', ...args], { cwd: dir, env: process.env });
    return { code: 0, out: stdout + stderr };
  } catch (error) {
    return { code: error.code, out: `${error.stdout}${error.stderr}` };
  }
}

const branches = async (dir) => (await git(dir, 'for-each-ref', '--format=%(refname:short)', 'refs/heads')).split('\n').filter(Boolean).sort();

// Makes every file under `dir` look untouched for two days.
async function age(dir) {
  const old = new Date(Date.now() - 48 * 3_600_000);
  const { stdout } = await exec('find', [dir]);
  for (const entry of stdout.split('\n').filter(Boolean)) await utimes(entry, old, old).catch(() => {});
}

test('a done task\'s scratch folders, its landed worktree and its merged branches go; another task\'s stay; kept files are committed first', async () => {
  const dir = await repo({ t001: { keeps: '[scratch/T001/bench.jsonl, scratch/T001/code/run.py]' } });
  await write(dir, 'scratch/T001/bench.jsonl', '{"n":1}\n');
  await write(dir, 'scratch/T001/code/run.py', 'print(1)\n');
  await write(dir, 'scratch/T001/copies/data.db', 'x'.repeat(4096));
  await write(dir, 'scratch/t001-extra/build/out.o', 'o');
  await write(dir, 'scratch/T002/mine.txt', 'T002 is released on its own');
  await write(dir, 'scratch/t0010/other.txt', 'a different task id');
  await write(dir, 'scratch/lock/unowned.txt', 'no task');
  // A worktree inside the task's folder, its branch merged, with a build in it.
  await git(dir, 'worktree', 'add', '--quiet', '-b', 't001-wt', path.join(dir, 'scratch/T001/wt'));
  await write(dir, 'scratch/T001/wt/build/a.o', 'build');
  // Branches named for it: one merged, one with work not on main.
  await git(dir, 'branch', 'T001-merged');
  await git(dir, 'switch', '--quiet', '-c', 't001-unlanded');
  await write(dir, 'wip.txt', 'not landed');
  await git(dir, 'add', 'wip.txt');
  await git(dir, 'commit', '--quiet', '-m', 'not landed');
  await git(dir, 'switch', '--quiet', 'main');
  const before = await git(dir, 'rev-parse', 'HEAD');

  const dry = await release(dir, 'T001', '--dry-run');
  assert.equal(dry.code, 0, dry.out);
  assert.match(dry.out, /keep scratch\/T001\/bench\.jsonl in AA\/evidence\/T001\//);
  assert.match(dry.out, /remove worktree scratch\/T001\/wt \(branch t001-wt\)/);
  assert.match(dry.out, /KEPT: branch t001-unlanded has commits not on main/);
  assert.match(dry.out, /dry run: nothing changed/);
  assert.equal(await exists(path.join(dir, 'scratch/T001/copies/data.db')), true, 'a dry run deletes nothing');
  assert.equal(await git(dir, 'rev-parse', 'HEAD'), before, 'and commits nothing');

  const done = await release(dir, 'T001');
  assert.equal(done.code, 0, done.out);
  assert.match(done.out, /released\./);
  for (const gone of ['scratch/T001', 'scratch/t001-extra']) assert.equal(await exists(path.join(dir, gone)), false, `${gone} is deleted`);
  for (const kept of ['scratch/T002/mine.txt', 'scratch/t0010/other.txt', 'scratch/lock/unowned.txt']) assert.equal(await exists(path.join(dir, kept)), true, `${kept} is not T001's`);
  assert.equal(await git(dir, 'worktree', 'list', '--porcelain').then((list) => list.includes('scratch/T001/wt')), false, 'git forgets the worktree');
  assert.deepEqual(await branches(dir), ['main', 't001-unlanded'], 'merged branches go, the unlanded one stays');
  // The kept files are in git, in a commit of their own, before anything went.
  assert.equal(await readFile(path.join(dir, 'AA/evidence/T001/bench.jsonl'), 'utf8'), '{"n":1}\n');
  assert.equal(await readFile(path.join(dir, 'AA/evidence/T001/code/run.py'), 'utf8'), 'print(1)\n');
  assert.equal(await git(dir, 'status', '--porcelain'), '', 'nothing left uncommitted');
  assert.match(await git(dir, 'log', '-1', '--format=%s'), /^evidence: T001's kept files/);
  const again = await release(dir, 'T001');
  assert.equal(again.out.trim(), '- KEPT: branch t001-unlanded has commits not on main\nnothing to release; the above stays.', 'a second release changes nothing, and still names what it keeps');
});

test('only a finished task is released, and never while a run on it is live', async () => {
  const dir = await repo();
  await write(dir, 'scratch/T003/x.txt', 'in progress');
  const active = await release(dir, 'T003');
  assert.notEqual(active.code, 0);
  assert.match(active.out, /T003 is not in AA\/tasks\/done\/: only a finished task is released/);
  assert.equal(await exists(path.join(dir, 'scratch/T003/x.txt')), true);
  // A run that has not ended and wrote an hour ago is live.
  await write(dir, 'scratch/T001/x.txt', 'x');
  const ts = new Date(Date.now() - 3_600_000).toISOString().replace(/\.\d{3}Z$/, 'Z');
  await write(dir, 'AA/checkpoints/T001.jsonl', `${JSON.stringify({ ts, run: 'r1', kind: 'open', brief: 'b', next: 'n' })}\n`);
  const live = await release(dir, 'T001');
  assert.notEqual(live.code, 0);
  assert.match(live.out, /a run on T001 is live \(r1 \)/);
  assert.equal(await exists(path.join(dir, 'scratch/T001/x.txt')), true);
  // Dead for longer than stale_hours, it holds nothing.
  const old = new Date(Date.now() - 48 * 3_600_000).toISOString().replace(/\.\d{3}Z$/, 'Z');
  await write(dir, 'AA/checkpoints/T001.jsonl', `${JSON.stringify({ ts: old, run: 'r1', kind: 'open', brief: 'b', next: 'n' })}\n`);
  assert.equal((await release(dir, 'T001')).code, 0);
  assert.equal(await exists(path.join(dir, 'scratch/T001')), false);
});

test('work that is not landed keeps the whole folder: a worktree ahead of main, tracked changes, a nested repository with commits no remote has', async () => {
  const dir = await repo();
  // Ahead of main.
  await git(dir, 'worktree', 'add', '--quiet', '-b', 'ahead', path.join(dir, 'scratch/T001/wt'));
  await write(dir, 'scratch/T001/wt/new.txt', 'new');
  await git(path.join(dir, 'scratch/T001/wt'), 'add', 'new.txt');
  await git(path.join(dir, 'scratch/T001/wt'), 'commit', '--quiet', '-m', 'ahead');
  let result = await release(dir, 'T001');
  assert.match(result.out, /KEPT: worktree scratch\/T001\/wt: its HEAD [0-9a-f]{7} is not on main/);
  assert.match(result.out, /KEPT: scratch\/T001 is kept whole/);
  assert.equal(await exists(path.join(dir, 'scratch/T001/wt/new.txt')), true);

  // Landed, but a tracked file changed.
  await write(dir, 'scratch/T002/.keep', '');
  await git(dir, 'worktree', 'add', '--quiet', '--detach', path.join(dir, 'scratch/T002/wt'));
  await writeFile(path.join(dir, 'scratch/T002/wt/README.md'), 'changed\n');
  result = await release(dir, 'T002');
  assert.match(result.out, /KEPT: worktree scratch\/T002\/wt: it has uncommitted changes to tracked files/);
  assert.equal(await readFile(path.join(dir, 'scratch/T002/wt/README.md'), 'utf8'), 'changed\n');

  // A clone whose only commit is on no remote.
  const other = await repo();
  const nested = path.join(other, 'scratch/T001/clone');
  await mkdir(nested, { recursive: true });
  await git(nested, 'init', '--quiet', '--initial-branch=main');
  await git(nested, 'config', 'user.name', 'ade');
  await git(nested, 'config', 'user.email', 'ade@example.invalid');
  await write(nested, 'a.txt', 'a');
  await git(nested, 'add', 'a.txt');
  await git(nested, 'commit', '--quiet', '-m', 'local only');
  result = await release(other, 'T001');
  assert.match(result.out, /KEPT: nested repository scratch\/T001\/clone: branch main is on no remote/);
  assert.equal(await exists(path.join(nested, 'a.txt')), true);
});

test('a symlinked scratch folder loses only its link; what it points to stays', async () => {
  const dir = await repo();
  const outside = await tempDir('outside');
  await writeFile(path.join(outside, 'precious.txt'), 'keep me');
  await mkdir(path.join(dir, 'scratch'), { recursive: true });
  await symlink(outside, path.join(dir, 'scratch/T001'));
  const result = await release(dir, 'T001');
  assert.equal(result.code, 0, result.out);
  assert.match(result.out, /remove the link scratch\/T001 \(not what it points to\)/);
  assert.equal(await exists(path.join(dir, 'scratch/T001')), false);
  assert.equal(await readFile(path.join(outside, 'precious.txt'), 'utf8'), 'keep me');
});

test('a kept file over keep_max_kb, or outside the repository, refuses the release before anything is deleted', async () => {
  const dir = await repo({ t001: { keeps: '[scratch/T001/big.bin]' }, yml: 'keep_max_kb: 1\n' });
  await write(dir, 'scratch/T001/big.bin', 'x'.repeat(4096));
  await write(dir, 'scratch/T001/junk.txt', 'junk');
  const result = await release(dir, 'T001');
  assert.notEqual(result.code, 0);
  assert.match(result.out, /keeps: scratch\/T001\/big\.bin is 4 KB, over keep_max_kb \(1\)\. Record its sha256 \([0-9a-f]{16}…\)/);
  assert.equal(await exists(path.join(dir, 'scratch/T001/junk.txt')), true);
  assert.equal(await exists(path.join(dir, 'AA/evidence')), false);

  const escape = await repo({ t001: { keeps: '[../outside.txt]' } });
  const refused = await release(escape, 'T001');
  assert.notEqual(refused.code, 0);
  assert.match(refused.out, /keeps: \.\.\/outside\.txt must be a path inside the repository/);
  const absolute = await repo({ yml: 'scratch: /tmp\n' });
  assert.match((await release(absolute, 'T001')).out, /scratch: must be a folder inside the repository/);
});

test('subagent worktrees go once landed and untouched for stale_hours; a fresh one, or one ahead of main, stays', async () => {
  const dir = await repo();
  const idle = path.join(dir, '.claude/worktrees/agent-idle');
  const fresh = path.join(dir, '.claude/worktrees/agent-fresh');
  const ahead = path.join(dir, '.claude/worktrees/agent-ahead');
  await git(dir, 'worktree', 'add', '--quiet', '-b', 'worktree-agent-idle', idle);
  await git(dir, 'worktree', 'add', '--quiet', '-b', 'worktree-agent-fresh', fresh);
  await git(dir, 'worktree', 'add', '--quiet', '-b', 'worktree-agent-ahead', ahead);
  await write(ahead, 'x.txt', 'x');
  await git(ahead, 'add', 'x.txt');
  await git(ahead, 'commit', '--quiet', '-m', 'ahead');
  await write(idle, 'build/out.o', 'o');
  await age(idle);
  await age(ahead);
  const result = await release(dir, 'T002');
  assert.equal(result.code, 0, result.out);
  assert.match(result.out, /remove landed subagent worktree \.claude\/worktrees\/agent-idle/);
  assert.equal(await exists(idle), false);
  assert.equal(await exists(fresh), true, 'touched within stale_hours: maybe still running');
  assert.equal(await exists(ahead), true, 'not landed');
  assert.deepEqual(await branches(dir), ['main', 'worktree-agent-ahead', 'worktree-agent-fresh']);
});

test('a branch whose every commit reached main rebased counts as landed; one with a single commit of its own does not', async () => {
  const dir = await repo();
  await git(dir, 'switch', '--quiet', '-c', 't001-rebased');
  await write(dir, 'a.txt', 'a');
  await git(dir, 'add', 'a.txt');
  await git(dir, 'commit', '--quiet', '-m', 'a');
  await git(dir, 'switch', '--quiet', 'main');
  await write(dir, 'other.txt', 'moves main on');
  await git(dir, 'add', 'other.txt');
  await git(dir, 'commit', '--quiet', '-m', 'main moves');
  await git(dir, 'cherry-pick', 't001-rebased');
  await git(dir, 'branch', 't001-own', 't001-rebased');
  await git(dir, 'switch', '--quiet', 't001-own');
  await write(dir, 'b.txt', 'b');
  await git(dir, 'add', 'b.txt');
  await git(dir, 'commit', '--quiet', '-m', 'b, only here');
  await git(dir, 'switch', '--quiet', 'main');
  const result = await release(dir, 'T001');
  assert.match(result.out, /delete merged branch t001-rebased/);
  assert.match(result.out, /KEPT: branch t001-own has commits not on main/);
  assert.deepEqual(await branches(dir), ['main', 't001-own']);
});

test('close --delete releases the task after retiring its trail', async () => {
  const dir = await repo();
  await write(dir, 'scratch/T001/out.txt', 'x');
  const old = new Date(Date.now() - 48 * 3_600_000).toISOString().replace(/\.\d{3}Z$/, 'Z');
  await write(dir, 'AA/checkpoints/T001.jsonl', `${JSON.stringify({ ts: old, run: 'r1', kind: 'open', brief: 'b', next: 'n' })}\n${JSON.stringify({ ts: old, run: 'r1', kind: 'end', next: 'none' })}\n`);
  await git(dir, 'add', '-A');
  await git(dir, 'commit', '--quiet', '-m', 'trail');
  const { stdout } = await exec('bash', ['AA/ckpt.sh', 'close', 'T001', '--delete'], { cwd: dir, env: process.env });
  assert.match(stdout, /deleted\. The trail is in git/);
  assert.match(stdout, /delete scratch\/T001/);
  assert.match(stdout, /released\./);
  assert.equal(await exists(path.join(dir, 'scratch/T001')), false);
});
