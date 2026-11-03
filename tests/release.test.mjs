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
const BOARD = new URL('../AA/board.sh', import.meta.url).pathname;
const MARKERS = /^MARK_A='([^']+)'$[\s\S]*?^MARK_B='([^']+)'$/m.exec(await readFile(BOARD, 'utf8'));
const [, MARK_A, MARK_B] = MARKERS;
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
  await copyFile(BOARD, path.join(dir, 'AA/board.sh'));
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
  await write(dir, 'scratch/t001-extra/notes.md', '# notes\n');
  await write(dir, 'scratch/T001/plot.png', 'png');
  await write(dir, 'scratch/T001/venv/lib/site.json', '{}');
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
  assert.match(dry.out, /keep 4 file\(s\), 1 KB, in AA\/evidence\/T001\//, 'bench.jsonl, run.py, plot.png and notes.md: kinds and keeps:, never a venv, a build or a tracked file');
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
  assert.equal(await readFile(path.join(dir, 'AA/evidence/T001/T001/bench.jsonl'), 'utf8'), '{"n":1}\n');
  assert.equal(await readFile(path.join(dir, 'AA/evidence/T001/T001/code/run.py'), 'utf8'), 'print(1)\n');
  assert.equal(await readFile(path.join(dir, 'AA/evidence/T001/t001-extra/notes.md'), 'utf8'), '# notes\n', 'each folder keeps its name, so two folders never collide');
  assert.equal(await exists(path.join(dir, 'AA/evidence/T001/T001/plot.png')), true);
  assert.equal(await exists(path.join(dir, 'AA/evidence/T001/T001/wt/README.md')), false, 'git already has a checkout\'s tracked files');
  assert.equal(await exists(path.join(dir, 'AA/evidence/T001/T001/venv')), false);
  assert.equal(await git(dir, 'status', '--porcelain'), '', 'nothing left uncommitted');
  assert.match(await git(dir, 'log', '-1', '--format=%s'), /^evidence: T001's kept files/);
  const again = await release(dir, 'T001');
  assert.equal(again.out.trim(), '- KEPT: branch t001-unlanded has commits not on main\nnothing to release; the above stays.', 'a second release changes nothing, and still names what it keeps');
});

test('kept files already committed as they are count as kept: the release goes on without a commit', async () => {
  const dir = await repo({ t001: { keeps: '[scratch/T001/bench.jsonl]' } });
  await write(dir, 'scratch/T001/bench.jsonl', '{"n":1}\n');
  await write(dir, 'AA/evidence/T001/T001/bench.jsonl', '{"n":1}\n');
  await git(dir, 'add', 'AA/evidence');
  await git(dir, 'commit', '--quiet', '-m', 'evidence first');
  const before = await git(dir, 'rev-parse', 'HEAD');
  const result = await release(dir, 'T001');
  assert.equal(result.code, 0, result.out);
  assert.equal(await git(dir, 'rev-parse', 'HEAD'), before, 'no empty commit');
  assert.equal(await exists(path.join(dir, 'scratch/T001')), false);
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
  assert.match(live.out, /a run on T001 has not ended and wrote within stale_hours \(r1\)/);
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
  assert.match(result.out, /KEPT: nested repository scratch\/T001\/clone has no remote/);
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

test('a kept file over keep_max_kb goes to the archive, checked by sha256 and recorded in git; with no archive the release refuses', async () => {
  const dir = await repo({ t001: { keeps: '[scratch/T001/big.bin]' }, yml: 'keep_max_kb: 1\n' });
  await write(dir, 'scratch/T001/big.bin', 'x'.repeat(4096));
  await write(dir, 'scratch/T001/out/early.json', '['.repeat(2048));
  await write(dir, 'scratch/T001/junk.txt', 'junk');
  const result = await release(dir, 'T001');
  assert.notEqual(result.code, 0);
  assert.match(result.out, /2 kept file\(s\), 6 KB, are over keep_max_kb \(1\) and there is no archive/);
  assert.equal(await exists(path.join(dir, 'scratch/T001/junk.txt')), true);
  assert.equal(await exists(path.join(dir, 'AA/evidence')), false);
  const dry = await release(dir, 'T001', '--dry-run');
  assert.equal(dry.code, 0, 'a dry run shows it instead');
  assert.match(dry.out, /KEPT: 2 kept file\(s\)/);

  const archive = await tempDir('archive');
  const done = await release(dir, 'T001', '--archive', archive);
  assert.equal(done.code, 0, done.out);
  assert.match(done.out, new RegExp(`archive 2 bigger file\\(s\\), 6 KB, to ${archive}/T001/`));
  assert.equal(await readFile(path.join(archive, 'T001/T001/big.bin'), 'utf8'), 'x'.repeat(4096));
  assert.equal(await readFile(path.join(archive, 'T001/T001/out/early.json'), 'utf8'), '['.repeat(2048));
  const manifest = await readFile(path.join(dir, 'AA/evidence/T001/RELEASED.tsv'), 'utf8');
  const { createHash } = await import('node:crypto');
  assert.ok(manifest.includes(`scratch/T001/big.bin\t4096\t${createHash('sha256').update('x'.repeat(4096)).digest('hex')}\t${archive}/T001/T001/big.bin`), manifest);
  assert.equal(await readFile(path.join(dir, 'AA/evidence/T001/T001/junk.txt'), 'utf8'), 'junk');
  assert.equal(await git(dir, 'status', '--porcelain'), '');
  assert.equal(await exists(path.join(dir, 'scratch/T001')), false);
  const own = await repo();
  await write(own, 'AA/AA.yml', `archive: ${own}/keep\n`);
  const inside = await release(own, 'T001');
  assert.match(inside.out, /archive: .* is inside the repository/);

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

test('only ancestry counts as landed: a branch on main by patch only is named, not deleted, since patch ids ignore whitespace', async () => {
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
  assert.match(result.out, /KEPT: branch t001-rebased is on main by patch only, not by ancestry: check, then git branch -D t001-rebased/);
  assert.match(result.out, /KEPT: branch t001-own has commits not on main/);
  assert.deepEqual(await branches(dir), ['main', 't001-own', 't001-rebased']);
});

test('a folder an open task cites is an input to work not yet done: it is kept whole, and the citing task named', async () => {
  const dir = await repo();
  await write(dir, 'scratch/t001/vec/Q-years.bin', 'vectors');
  await write(dir, 'scratch/t0011/other.txt', 'a prefix of no citation');
  await write(dir, 'AA/tasks/T003-three.md', `${taskFile('T003', { status: 'claimed' })}\nReuses \`scratch/t001/vec/Q-*\` and scratch/t00.\n`);
  const result = await release(dir, 'T001');
  assert.match(result.out, /KEPT: scratch\/t001 is kept whole: open task T003 cites it/);
  // A worktree in the held folder keeps its branch, even merged.
  await git(dir, 'worktree', 'add', '--quiet', '-b', 't001-wt', path.join(dir, 'scratch/t001/wt'));
  assert.match((await release(dir, 'T001')).out, /KEPT: branch t001-wt is checked out in scratch\/t001\/wt, which stays/);
  assert.ok((await branches(dir)).includes('t001-wt'));
  assert.equal(await exists(path.join(dir, 'scratch/t001/vec/Q-years.bin')), true);
  const { stdout } = await exec('bash', ['AA/board.sh', '--litter'], { cwd: dir, env: process.env });
  assert.equal(stdout.trim(), 'Finished tasks hold nothing on disk.', '--litter does not list a held folder');
  await write(dir, 'scratch/T002/x.txt', 'x');
  const listed = await exec('bash', ['AA/board.sh', '--litter'], { cwd: dir, env: process.env });
  assert.match(listed.stdout, /^T002 +\d+ KB {2}scratch\/T002$/m);
  assert.match(listed.stdout, /^ {2}AA\/ckpt\.sh release T002$/m);
  await write(dir, 'AA/STATE.md', `# Board\n\n${MARK_A}\n${MARK_B}\n`);
  await exec('bash', ['AA/board.sh', '--write'], { cwd: dir, env: process.env });
  const check = await exec('bash', ['AA/board.sh', '--check'], { cwd: dir, env: process.env });
  assert.match(check.stderr, /board: rule 13 — 1 finished task\(s\) still hold files or branches/, '--check warns on stderr');
});

// The reviewer's attacks on beeefb3, each one now a refusal.
test('a folder held for any reason loses nothing: a landed worktree with an unpushed repository inside stays registered and whole', async () => {
  const dir = await repo();
  const wt = path.join(dir, 'scratch/T001/wt');
  await git(dir, 'worktree', 'add', '--quiet', '-b', 't001-wt', wt);
  const inner = path.join(wt, 'inner');
  await mkdir(inner);
  await git(inner, 'init', '--quiet', '--initial-branch=main');
  await write(inner, 'a.txt', 'a');
  await git(inner, 'add', 'a.txt');
  await git(inner, '-c', 'user.name=ade', '-c', 'user.email=ade@example.invalid', 'commit', '--quiet', '-m', 'unpushed');
  const result = await release(dir, 'T001');
  assert.match(result.out, /KEPT: nested repository scratch\/T001\/wt\/inner has no remote/);
  assert.match(result.out, /KEPT: scratch\/T001 is kept whole/);
  assert.doesNotMatch(result.out, /remove worktree/);
  assert.equal(await exists(path.join(inner, 'a.txt')), true);
  assert.match(await git(dir, 'worktree', 'list'), /scratch\/T001\/wt/);
});

test('a checkout git does not list as ours (another repository\'s worktree) is checked like a nested repository', async () => {
  const dir = await repo();
  const other = await repo();
  await git(other, 'worktree', 'add', '--quiet', '-b', 'side', path.join(dir, 'scratch/T001/theirs'));
  await write(dir, 'scratch/T001/theirs/side.txt', 'side');
  await git(path.join(dir, 'scratch/T001/theirs'), 'add', 'side.txt');
  await git(path.join(dir, 'scratch/T001/theirs'), 'commit', '--quiet', '-m', 'side work');
  const result = await release(dir, 'T001');
  assert.match(result.out, /KEPT: nested repository scratch\/T001\/theirs has no remote/);
  assert.equal(await exists(path.join(dir, 'scratch/T001/theirs/side.txt')), true);
});

test('scratch: written with a trailing slash still finds the worktrees in it', async () => {
  const dir = await repo({ yml: 'scratch: ./scratch/\n' });
  const wt = path.join(dir, 'scratch/T001/wt');
  await git(dir, 'worktree', 'add', '--quiet', '--detach', wt);
  await write(wt, 'x.txt', 'x');
  await git(wt, 'add', 'x.txt');
  await git(wt, 'commit', '--quiet', '-m', 'detached, unlanded');
  const result = await release(dir, 'T001');
  assert.match(result.out, /KEPT: worktree scratch\/T001\/wt: its HEAD [0-9a-f]{7} is not on main/);
  assert.equal(await exists(path.join(wt, 'x.txt')), true);
});

test('a locked worktree, a running process, an unreadable trail or a doing with time ahead each keep the folder', async () => {
  const dir = await repo();
  await git(dir, 'worktree', 'add', '--quiet', '--detach', path.join(dir, 'scratch/T001/wt'));
  await git(dir, 'worktree', 'lock', path.join(dir, 'scratch/T001/wt'));
  assert.match((await release(dir, 'T001')).out, /KEPT: worktree scratch\/T001\/wt: it is locked/);
  assert.equal(await exists(path.join(dir, 'scratch/T001/wt')), true);

  await write(dir, 'scratch/T002/run/out.log', 'running');
  const { spawn } = await import('node:child_process');
  const child = spawn('sleep', ['30'], { cwd: path.join(dir, 'scratch/T002/run'), stdio: 'ignore' });
  try {
    await new Promise((resolve) => setTimeout(resolve, 200));
    assert.match((await release(dir, 'T002')).out, /KEPT: scratch\/T002 is kept whole: a running process is using it/);
    assert.equal(await exists(path.join(dir, 'scratch/T002/run/out.log')), true);
  } finally { child.kill(); }

  const trail = path.join(dir, 'AA/checkpoints/T002.jsonl');
  await write(dir, 'AA/checkpoints/T002.jsonl', `${JSON.stringify({ ts: 'yesterday', run: 'r1', kind: 'open', brief: 'b', next: 'n' })}\n`);
  assert.match((await release(dir, 'T002')).out, /refusing: an entry in T002's trail has no readable time/);
  const old = new Date(Date.now() - 30 * 3_600_000).toISOString().replace(/\.\d{3}Z$/, 'Z');
  const until = new Date(Date.now() + 3 * 86_400_000).toISOString().replace(/\.\d{3}Z$/, 'Z');
  await writeFile(trail, `${JSON.stringify({ ts: old, run: 'r1', kind: 'open', brief: 'b', next: 'n' })}\n${JSON.stringify({ ts: old, run: 'r1', kind: 'doing', act: 'train', next: 'n', until })}\n`);
  await writeFile(path.join(dir, 'AA/AA.yml'), 'stale_hours: 48\n');
  assert.match((await release(dir, 'T002')).out, /refusing: a run on T002 (has not ended|is running)/);
  assert.equal(await exists(path.join(dir, 'scratch/T002/run/out.log')), true);
});

test('kept files that .gitignore would skip are committed anyway, and checked in the commit', async () => {
  const dir = await repo();
  await write(dir, '.gitignore', 'scratch/\n*.csv\n');
  await git(dir, 'commit', '--quiet', '-am', 'ignore csv');
  await write(dir, 'scratch/T001/res.csv', 'a,b\n1,2\n');
  const result = await release(dir, 'T001');
  assert.equal(result.code, 0, result.out);
  assert.equal(await git(dir, 'ls-files', 'AA/evidence/T001/T001/res.csv'), 'AA/evidence/T001/T001/res.csv');
});

test('a nested repository with a commit only on a detached HEAD keeps its folder, though it has a remote', async () => {
  const dir = await repo();
  const remote = await tempDir('remote');
  await git(remote, 'init', '--quiet', '--bare', '--initial-branch=main');
  const nested = path.join(dir, 'scratch/T001/clone');
  await git(dir, 'push', '--quiet', remote, 'main');
  await exec('git', ['clone', '--quiet', remote, nested], { env: process.env });
  await git(nested, 'switch', '--quiet', '--detach');
  await write(nested, 'lost.txt', 'only here');
  await git(nested, 'add', 'lost.txt');
  await git(nested, '-c', 'user.name=ade', '-c', 'user.email=ade@example.invalid', 'commit', '--quiet', '-m', 'detached');
  const result = await release(dir, 'T001');
  assert.match(result.out, /KEPT: nested repository scratch\/T001\/clone has commits no remote has \([0-9a-f]{7}\)/);
  assert.equal(await exists(path.join(nested, 'lost.txt')), true);
  // Pushed and clean, a clone goes.
  const pushed = path.join(dir, 'scratch/T002/clone');
  await exec('git', ['clone', '--quiet', remote, pushed], { env: process.env });
  const gone = await release(dir, 'T002');
  assert.equal(gone.code, 0, gone.out);
  assert.equal(await exists(pushed), false);
});

test('a release runs only from the main checkout on the main line', async () => {
  const dir = await repo();
  await git(dir, 'branch', 'T001-feat');
  const linked = path.join(dir, 'scratch/T002/linked');
  await git(dir, 'worktree', 'add', '--quiet', '-b', 'integ', linked);
  const fromLinked = await exec('bash', [path.join(dir, 'AA/ckpt.sh'), 'release', 'T001', '--dry-run'], { cwd: linked, env: process.env }).catch((error) => error);
  assert.match(`${fromLinked.stdout}${fromLinked.stderr}`, /from the repository's main checkout, not a linked worktree/);
  await git(dir, 'switch', '--quiet', '-c', 'elsewhere');
  assert.match((await release(dir, 'T001', '--dry-run')).out, /check out main first/);
  await git(dir, 'switch', '--quiet', 'main');
  assert.match((await release(dir, 'T001', '--dry-run')).out, /delete merged branch T001-feat/);
});

test('close --delete --force retires the trail but does not release: the runs it overrode may still be running', async () => {
  const dir = await repo();
  await write(dir, 'scratch/T001/out.txt', 'x');
  const ts = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  await write(dir, 'AA/checkpoints/T001.jsonl', `${JSON.stringify({ ts, run: 'r1', kind: 'open', brief: 'b', next: 'n' })}\n`);
  await git(dir, 'add', '-A');
  await git(dir, 'commit', '--quiet', '-m', 'trail');
  const { stdout } = await exec('bash', ['AA/ckpt.sh', 'close', 'T001', '--delete', '--force'], { cwd: dir, env: process.env });
  assert.match(stdout, /not released \(--force\): once nothing of T001 runs, ckpt\.sh release T001/);
  assert.equal(await exists(path.join(dir, 'scratch/T001/out.txt')), true);
});

// Third round: the second review and the agy review.
test('a run that stopped mid-act blocks the release until it is reaped', async () => {
  const dir = await repo();
  await write(dir, 'scratch/T001/x.txt', 'x');
  const old = new Date(Date.now() - 72 * 3_600_000).toISOString().replace(/\.\d{3}Z$/, 'Z');
  await write(dir, 'AA/checkpoints/T001.jsonl', `${JSON.stringify({ ts: old, run: 'r1', kind: 'open', brief: 'b', next: 'n' })}\n${JSON.stringify({ ts: old, run: 'r1', kind: 'doing', act: 'train', next: 'n' })}\n`);
  assert.match((await release(dir, 'T001')).out, /refusing: a run on T001 stopped mid-act \(r1\)/);
  assert.equal(await exists(path.join(dir, 'scratch/T001/x.txt')), true);
});

test('an archive reached through a symlink or .. into the repository is refused', async () => {
  const dir = await repo({ t001: { keeps: '[scratch/T001/big.bin]' }, yml: 'keep_max_kb: 1\n' });
  await write(dir, 'scratch/T001/big.bin', 'x'.repeat(4096));
  const outside = await tempDir('link');
  await symlink(path.join(dir, 'scratch/T001'), path.join(outside, 'arc'));
  assert.match((await release(dir, 'T001', '--archive', path.join(outside, 'arc'))).out, /archive: .* is inside the repository/);
  assert.match((await release(dir, 'T001', '--archive', `${dir}/../${path.basename(dir)}/scratch`)).out, /archive: .* is inside the repository/);
  assert.equal(await exists(path.join(dir, 'scratch/T001/big.bin')), true);
});

test('a folder the repository tracks files in, or one holding a bare repository, is kept whole', async () => {
  const dir = await repo();
  await write(dir, 'scratch/T001/run.py', 'print(1)\n');
  await git(dir, 'add', '-f', 'scratch/T001/run.py');
  await git(dir, 'commit', '--quiet', '-m', 'tracked under scratch');
  assert.match((await release(dir, 'T001')).out, /KEPT: scratch\/T001 is kept whole: the repository tracks files in it/);
  await git(dir, 'init', '--quiet', '--bare', path.join(dir, 'scratch/T002/origin.git'));
  assert.match((await release(dir, 'T002')).out, /KEPT: bare repository scratch\/T002\/origin\.git/);
  assert.equal(await exists(path.join(dir, 'scratch/T002/origin.git/HEAD')), true);
});

test('keep_kinds that are not plain extensions refuse; one task\'s kept files are capped by keep_task_mb', async () => {
  const bad = await repo({ yml: 'keep_kinds: [md, png]\n' });
  await write(bad, 'scratch/T001/a.md', 'a');
  assert.match((await release(bad, 'T001')).out, /keep_kinds: '\[md,' is not an extension/);
  assert.equal(await exists(path.join(bad, 'scratch/T001/a.md')), true);
  const big = await repo({ yml: 'keep_task_mb: 0\n' });
  await write(big, 'scratch/T001/a.md', 'a');
  const result = await release(big, 'T001');
  assert.match(result.out, /the kept files come to 1 KB, over keep_task_mb \(0\) for one task/);
  assert.equal(await exists(path.join(big, 'scratch/T001/a.md')), true);
});

test('a kept file that looks like it holds a secret goes to the archive, never to git', async () => {
  const dir = await repo();
  const key = ['AKIA', 'ABCDEFGHIJKLMNOP'].join('');
  await write(dir, 'scratch/T001/run.log', `aws ${key}\n`);
  await write(dir, 'scratch/T001/risk.json', '{"risk-free-rate-adjusted-value": 1}');
  assert.match((await release(dir, 'T001')).out, /no archive/, 'no archive: refuses');
  const archive = await tempDir('archive');
  const result = await release(dir, 'T001', '--archive', archive);
  assert.equal(result.code, 0, result.out);
  assert.match(result.out, /1 kept file\(s\) look like they hold a secret: archived, not committed/);
  assert.equal(await readFile(path.join(archive, 'T001/T001/run.log'), 'utf8'), `aws ${key}\n`);
  assert.equal(await git(dir, 'log', '--all', '-p', '--format=', '--', 'AA/evidence').then((log) => log.includes(key)), false, 'the key is in no commit');
  assert.equal(await exists(path.join(dir, 'AA/evidence/T001/T001/risk.json')), true, 'risk- is not sk-');
});

test('a file the task\'s Result cites is kept whatever its kind', async () => {
  const dir = await repo();
  await write(dir, 'AA/tasks/done/T001-one.md', `${taskFile('T001')}\nThe probe is \`scratch/t001/smuggle.py\`, and scratch/t001/out.bin.\n`);
  await git(dir, 'commit', '--quiet', '-am', 'cite');
  await write(dir, 'scratch/t001/smuggle.py', 'probe()\n');
  await write(dir, 'scratch/t001/out.bin', 'bin');
  await write(dir, 'scratch/t001/other.py', 'not cited');
  const result = await release(dir, 'T001');
  assert.equal(result.code, 0, result.out);
  assert.equal(await readFile(path.join(dir, 'AA/evidence/T001/t001/smuggle.py'), 'utf8'), 'probe()\n');
  assert.equal(await exists(path.join(dir, 'AA/evidence/T001/t001/out.bin')), true);
  assert.equal(await exists(path.join(dir, 'AA/evidence/T001/t001/other.py')), false);
});

test('a subagent worktree with untracked work git does not ignore stays; one with only ignored or build files goes', async () => {
  const dir = await repo();
  await write(dir, '.gitignore', 'scratch/\n.omc/\n');
  await git(dir, 'commit', '--quiet', '-am', 'ignore .omc');
  const work = path.join(dir, '.claude/worktrees/agent-work');
  const junk = path.join(dir, '.claude/worktrees/agent-junk');
  await git(dir, 'worktree', 'add', '--quiet', '-b', 'worktree-agent-work', work);
  await git(dir, 'worktree', 'add', '--quiet', '-b', 'worktree-agent-junk', junk);
  await write(work, 'report.md', '# found it\n');
  await write(junk, '.omc/state/x.json', '{}');
  await write(junk, 'build-t1/CMakeCache.txt', 'cache');
  await age(work);
  await age(junk);
  const listed = await exec('bash', ['AA/board.sh', '--litter'], { cwd: dir, env: process.env });
  assert.doesNotMatch(listed.stdout, /agent-work/, '--litter agrees: held, so not listed');
  assert.match(listed.stdout, /agent-junk/);
  const result = await release(dir, 'T002');
  assert.match(result.out, /KEPT: subagent worktree \.claude\/worktrees\/agent-work has untracked work \(report\.md\)/);
  assert.equal(await exists(path.join(work, 'report.md')), true);
  assert.equal(await exists(junk), false);
});

test('an open task citing the folder in another case still holds it', async () => {
  const dir = await repo();
  await write(dir, 'scratch/t001/x.txt', 'x');
  await write(dir, 'AA/tasks/T003-three.md', `${taskFile('T003', { status: 'claimed' })}\nReads scratch/T001/x.txt.\n`);
  assert.match((await release(dir, 'T001')).out, /KEPT: scratch\/t001 is kept whole: open task T003 cites it/);
});

test('close --delete retires the trail even when the release then refuses, and says so', async () => {
  const dir = await repo();
  await write(dir, 'scratch/T001/out.txt', 'x');
  const old = new Date(Date.now() - 48 * 3_600_000).toISOString().replace(/\.\d{3}Z$/, 'Z');
  await write(dir, 'AA/checkpoints/T001.jsonl', `${JSON.stringify({ ts: old, run: 'r1', kind: 'open', brief: 'b', next: 'n' })}\n${JSON.stringify({ ts: old, run: 'r1', kind: 'end', next: 'none' })}\n`);
  await git(dir, 'add', '-A');
  await git(dir, 'commit', '--quiet', '-m', 'trail');
  await git(dir, 'switch', '--quiet', '-c', 'elsewhere');
  const { stdout, stderr } = await exec('bash', ['AA/ckpt.sh', 'close', 'T001', '--delete'], { cwd: dir, env: process.env });
  assert.match(stdout, /deleted\. The trail is in git/);
  assert.match(stderr, /the trail is retired, but T001's environment is not released/);
  assert.equal(await exists(path.join(dir, 'scratch/T001/out.txt')), true);
});

test('a loose file named for the task is a folder of one: kept by kind, then removed; a loose binary just goes', async () => {
  const dir = await repo();
  await write(dir, 'scratch/t001-gate.log', 'gate ok\n');
  await write(dir, 'scratch/t001-core.bin', 'core');
  await write(dir, 'scratch/t0011-gate.log', 'another task');
  const result = await release(dir, 'T001');
  assert.equal(result.code, 0, result.out);
  assert.equal(await readFile(path.join(dir, 'AA/evidence/T001/t001-gate.log'), 'utf8'), 'gate ok\n');
  assert.equal(await exists(path.join(dir, 'scratch/t001-gate.log')), false);
  assert.equal(await exists(path.join(dir, 'scratch/t001-core.bin')), false);
  assert.equal(await exists(path.join(dir, 'scratch/t0011-gate.log')), true);
  const { stdout } = await exec('bash', ['AA/board.sh', '--litter'], { cwd: dir, env: process.env });
  assert.equal(stdout.trim(), 'Finished tasks hold nothing on disk.', '--litter and release agree');
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

test('a worktree in the task\'s folder with untracked work stays, as a subagent\'s does', async () => {
  const dir = await repo();
  await git(dir, 'worktree', 'add', '--quiet', '-b', 't001-wt', path.join(dir, 'scratch/T001/wt'));
  await write(dir, 'scratch/T001/wt/new_module.py', 'print(1)\n');
  const { out } = await release(dir, 'T001');
  assert.match(out, /KEPT: worktree scratch\/T001\/wt has untracked work \(new_module\.py\)/);
  assert.equal(await exists(path.join(dir, 'scratch/T001/wt/new_module.py')), true);
});

test('an invalid scratch: stops the release, and it never names git\'s folder or the board', async () => {
  for (const value of ['.git/refs/heads', 'AA', '../x']) {
    const dir = await repo({ yml: `scratch: ${value}\n` });
    const { code, out } = await release(dir, 'T001');
    assert.notEqual(code, 0, `${value} was accepted`);
    assert.match(out, /scratch:/);
  }
});

test('a release refuses during a merge, before anything is staged', async () => {
  const dir = await repo();
  await write(dir, 'c.txt', 'base\n');
  await git(dir, 'add', 'c.txt');
  await git(dir, 'commit', '--quiet', '-m', 'base');
  await git(dir, 'checkout', '--quiet', '-b', 'other');
  await write(dir, 'c.txt', 'theirs\n');
  await git(dir, 'commit', '--quiet', '-am', 'theirs');
  await git(dir, 'checkout', '--quiet', 'main');
  await write(dir, 'c.txt', 'ours\n');
  await git(dir, 'commit', '--quiet', '-am', 'ours');
  await git(dir, 'merge', '--quiet', 'other').catch(() => {});
  await write(dir, 'scratch/T001/notes.md', 'x\n');
  const { code, out } = await release(dir, 'T001');
  assert.notEqual(code, 0, 'a release ran during a merge');
  assert.match(out, /in progress \(MERGE_HEAD\)/);
  assert.equal(await exists(path.join(dir, 'scratch/T001')), true);
});

