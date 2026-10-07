import assert from 'node:assert/strict';
import { execFile, execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmod, lstat, mkdir, mkdtemp, readdir, readFile, readlink, realpath, rename, rm, symlink, unlink, utimes, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';

import { boardPolicy, git as workspaceGit, parseOwner, parseTaskMarkdown } from '../lib/workspace.mjs';
import {
  commitSubject, commitTaskChange, editFrontmatter, ownerLine, probeRepository, readTrail, recoverInflight, resultSection, setResult,
  TrackedError, trackedGit,
} from '../lib/tracked.mjs';

// Every repository here is a temporary one; no global or system git config.
process.env.GIT_CONFIG_GLOBAL = os.devNull;
process.env.GIT_CONFIG_NOSYSTEM = '1';
delete process.env.AGESIGHT_TRACKED_WRITES;

const exec = promisify(execFile);
const FIXTURES = new URL('./fixtures/tracked/', import.meta.url);
const T004 = 'T004-one-copy-of-the-aa-init-template.md';
const T012 = 'T012-a-moved-blocked-task-loses-its-handoff-reason.md';
const T019 = 'T019-a-working-page-for-all-work-in-progress.md';
const T030 = 'T030-a-task-in-the-older-layout.md';
const BRANCH = 'refs/heads/main';
const MESSAGE = 'claim T012: test the engine\n\nMade in AGE Aris by Repo Operator.\n\nAGESight-Via: ui\n';
const FAST = { call: 600, hold: 1500, grace: 150, reserve: 500 };
const temporary = new Set();

test.after(async () => {
  await Promise.all([...temporary].map((directory) => rm(directory, { recursive: true, force: true })));
});

function fixture(name) {
  return readFile(new URL(name, FIXTURES), 'utf8');
}

async function tempDir(kind) {
  const directory = await realpath(await mkdtemp(path.join(os.tmpdir(), `agesight-tracked-${kind}-`)));
  temporary.add(directory);
  return directory;
}

async function g(dir, ...args) {
  const { stdout } = await exec('git', args, { cwd: dir, env: process.env, maxBuffer: 16 * 1024 * 1024 });
  return stdout.trim();
}

function gSync(dir, args, { input, env } = {}) {
  return execFileSync('git', args, { cwd: dir, input, env: { ...process.env, ...env } }).toString().trim();
}

// A git command an agent runs: its exit and its error output.
async function agent(dir, ...args) {
  try {
    await exec('git', args, { cwd: dir, env: process.env });
    return { ok: true, stderr: '' };
  } catch (error) {
    return { ok: false, stderr: String(error.stderr) };
  }
}

// A tracked repository with an AA board. With backlog/: T004 and T012 queued,
// T019 done, a WIP limit of 2. Without (the older layout, as AGEIS): T030
// claimed and T012 open, both in tasks/, and no tasks/done/ yet.
async function makeRepo({ backlog = true, gitattributes = '' } = {}) {
  const dir = await tempDir('repo');
  await g(dir, 'init', '--quiet', '--initial-branch=main');
  await g(dir, 'config', 'user.name', 'Repo Operator');
  await g(dir, 'config', 'user.email', 'repo@example.invalid');
  await mkdir(path.join(dir, 'AA', 'tasks'), { recursive: true });
  if (backlog) {
    await mkdir(path.join(dir, 'AA', 'backlog'));
    await mkdir(path.join(dir, 'AA', 'tasks', 'done'));
    await writeFile(path.join(dir, 'AA', 'backlog', T004), await fixture(T004));
    await writeFile(path.join(dir, 'AA', 'backlog', T012), await fixture(T012));
    await writeFile(path.join(dir, 'AA', 'tasks', 'done', T019), await fixture(T019));
    await writeFile(path.join(dir, 'AA', 'AA.yml'), 'wip:\n  in_progress: 2\n  blocked: 1\nstale_hours: 24\n');
  } else {
    await writeFile(path.join(dir, 'AA', 'tasks', T030), await fixture(T030));
    await writeFile(path.join(dir, 'AA', 'tasks', T012), await fixture(T012));
  }
  await writeFile(path.join(dir, 'AA', 'STATE.md'), '# State\n');
  await writeFile(path.join(dir, 'README.md'), '# A tracked repository\n');
  await writeFile(path.join(dir, 'other.txt'), 'one\n');
  if (gitattributes) await writeFile(path.join(dir, '.gitattributes'), gitattributes);
  await g(dir, 'add', '-A');
  await g(dir, 'commit', '--quiet', '-m', 'fixture');
  return { dir, dataDir: await tempDir('data') };
}

function claimed(text) {
  return editFrontmatter(text, { status: 'claimed', owner: ownerLine('Repo Operator', 'testing the engine', new Date('2026-10-07T12:00:00Z')) });
}

// One tracked write: `edit` maps the file's current text to its new text.
async function act(repo, { from = `AA/backlog/${T012}`, to = 'AA/tasks/' + T012, edit = claimed, message = MESSAGE, check, seams, identity } = {}) {
  const content = edit(await readFile(path.join(repo.dir, ...from.split('/')), 'utf8'));
  return commitTaskChange(repo.dir, { from, to, content, message, branch: BRANCH, check, dataDir: repo.dataDir, projectId: 'p1', seams, identity });
}

// Everything a person could see: the branch, the index's bytes, every file in
// the working tree (and the folders), and the git folder's own files (a lock
// or a scratch index left behind). Taking it changes nothing.
async function snapshot(dir) {
  const files = {};
  async function visit(relative) {
    for (const entry of await readdir(path.join(dir, relative), { withFileTypes: true })) {
      const name = relative ? `${relative}/${entry.name}` : entry.name;
      if (name === '.git') continue;
      if (entry.isSymbolicLink()) {
        files[name] = `link to ${await readlink(path.join(dir, name))}`;
      } else if (entry.isDirectory()) {
        files[`${name}/`] = 'folder';
        await visit(name);
      } else {
        files[name] = createHash('sha256').update(await readFile(path.join(dir, name))).digest('hex');
      }
    }
  }
  await visit('');
  return {
    ref: await g(dir, 'rev-parse', BRANCH),
    index: createHash('sha256').update(await readFile(path.join(dir, '.git', 'index'))).digest('hex'),
    files,
    gitFiles: (await readdir(path.join(dir, '.git'))).filter((name) => !['objects', 'logs', 'COMMIT_EDITMSG', 'ORIG_HEAD'].includes(name)).sort(),
  };
}

async function markers(repo) {
  try { return await readdir(path.join(repo.dataDir, 'tracked-inflight')); } catch { return []; }
}

async function assertUnchanged(repo, before, message) {
  assert.deepEqual(await snapshot(repo.dir), before, message);
  assert.deepEqual(await markers(repo), [], 'no marker is left');
}

// Committed and consistent: the branch is at the commit, and the index and
// working tree agree with it for the task paths; nothing of AGE Aris's is left.
async function assertCommitted(repo, result, paths) {
  assert.equal(await g(repo.dir, 'rev-parse', BRANCH), result.commit);
  assert.equal(await g(repo.dir, 'status', '--porcelain', '--untracked-files=all', '--', ...paths), '');
  assert.equal(await g(repo.dir, 'status', '--porcelain', '--untracked-files=all', '--', 'AA'), '');
  const gitFiles = await readdir(path.join(repo.dir, '.git'));
  assert.ok(!gitFiles.includes('index.lock'), 'the lock is released');
  assert.deepEqual(gitFiles.filter((name) => name.startsWith('agesight-')), [], 'no scratch index is left');
  assert.deepEqual(await markers(repo), [], 'no marker is left');
}

async function refused(promise, code, status) {
  await assert.rejects(promise, (error) => {
    assert.equal(error.code, code, `${error.code}: ${error.message}`);
    if (status) assert.equal(error.status, status);
    return true;
  });
}

function crash() {
  throw Object.assign(new Error('simulated crash'), { crash: true });
}

// Another writer's commit, made with plumbing and a scratch index of its own,
// on `parent`; it moves the branch by CAS.
function plumbingCommit(dir, parent, changes) {
  const indexFile = path.join(dir, '.git', 'other-writer-index');
  const env = { GIT_INDEX_FILE: indexFile };
  gSync(dir, ['read-tree', parent], { env });
  for (const [file, content] of Object.entries(changes)) {
    const blob = gSync(dir, ['hash-object', '-w', '--stdin'], { input: content });
    gSync(dir, ['update-index', '--add', '--cacheinfo', `100644,${blob},${file}`], { env });
  }
  const tree = gSync(dir, ['write-tree'], { env });
  const commit = gSync(dir, ['commit-tree', tree, '-p', parent, '-m', 'another writer']);
  gSync(dir, ['update-ref', BRANCH, commit, parent]);
  execFileSync('rm', ['-f', indexFile]);
  return commit;
}

// A §4 check as T023 will write it: another operator's claim, and the WIP limit.
function protocolCheck({ operator = 'Repo Operator', wipLimit = 0 } = {}) {
  return async (head) => {
    const owner = parseOwner(parseTaskMarkdown(head.content).fields.owner);
    if (owner.operator && owner.operator !== operator) throw new TrackedError(409, 'HELD_BY_OTHER', `held by ${owner.operator}`);
    if (wipLimit) {
      const open = (await head.list('AA/tasks')).filter((name) => name.endsWith('.md'));
      if (open.length >= wipLimit) throw new TrackedError(409, 'WIP_LIMIT', `WIP is ${open.length} of ${wipLimit}`);
    }
  };
}

// A spawn for the seams: `pick(args)` returns a shell script to run in git's
// place (its "$@" is the real git command), or nothing to run git itself.
function spawnWith(pick) {
  return (file, args, options) => {
    const script = pick(args);
    return script ? spawn('sh', ['-c', script, 'sh', file, ...args], options) : spawn(file, args, options);
  };
}

// ---- workspace.mjs: git() and boardPolicy

test('git() writes input to stdin, filters dropped variables out of its overrides, and fails a call that runs past its timeout', async () => {
  const repo = await makeRepo();
  const blob = workspaceGit(repo.dir, ['hash-object', '--stdin'], { input: 'hello\n' }).stdout.trim();
  assert.equal(blob, createHash('sha1').update('blob 6\0hello\n').digest('hex'));
  const gitDir = workspaceGit(repo.dir, ['rev-parse', '--absolute-git-dir'], { env: { GIT_DIR: os.tmpdir(), GIT_INDEX_FILE: '/elsewhere' } }).stdout.trim();
  assert.equal(gitDir, path.join(repo.dir, '.git'), 'GIT_DIR from a caller is dropped');
  const started = Date.now();
  assert.throws(() => workspaceGit(repo.dir, ['-c', 'alias.nap=!exec sleep 3', 'nap'], { timeout: 200 }), /timed out after 200 ms/);
  assert.ok(Date.now() - started < 2900, 'the call did not wait for git to finish');
});

test('boardPolicy gives the blocked limit, and stale_hours defaults to 24 without a settings file', () => {
  assert.equal(boardPolicy('wip:\n  in_progress: 2\n  blocked: 1\n').blockedLimit, 1);
  assert.equal(boardPolicy('').staleHours, 24);
});

// ---- Task-file text

test('editFrontmatter changes only the named keys of a real task file, and keeps every other byte', async () => {
  const before = await fixture(T004);
  const after = editFrontmatter(before, { status: 'claimed', owner: 'Repo Operator @agesight/web 2026-10-07 — on it', blockedReason: 'a "quoted" reason' });
  const [oldLines, newLines] = [before.split('\n'), after.split('\n')];
  assert.equal(newLines.length, oldLines.length);
  const changed = oldLines.map((line, index) => (line === newLines[index] ? null : newLines[index])).filter(Boolean);
  assert.deepEqual(changed, ['status: claimed', 'owner: Repo Operator @agesight/web 2026-10-07 — on it', 'blockedReason: "a \\"quoted\\" reason"']);
  assert.ok(after.endsWith('owner\'s alone, rule 2)*\n'), 'the body and its trailing newline are kept');
  assert.equal(parseTaskMarkdown(after).fields.blockedReason, 'a "quoted" reason');
  assert.equal(editFrontmatter(before, {}), before, 'no updates, no change');
});

test('editFrontmatter keeps CRLF, comments, unknown keys and order, sets a repeated key both times, and appends a missing key inside the block', async () => {
  const crlf = (await fixture(T012)).replaceAll('\n', '\r\n');
  const after = editFrontmatter(crlf, { status: 'blocked', blockedReason: 'waiting on T011' });
  assert.ok(!after.replaceAll('\r\n', '').includes('\n'), 'every line still ends in CRLF');
  assert.ok(after.includes('\r\nstatus: blocked\r\nowner: —\r\n# type: one word;'));
  assert.ok(after.includes('\r\nblockedReason: "waiting on T011"\r\n'));
  assert.equal(after.length - crlf.length, 'blocked'.length - 'open'.length + '"waiting on T011"'.length - '""'.length);
  assert.equal(
    editFrontmatter('---\nid: T001\nx-custom: \'kept\'\nstatus: open\nstatus: open\n---\nbody\n', { status: 'done', owner: '—', blockedReason: '' }),
    '---\nid: T001\nx-custom: \'kept\'\nstatus: done\nstatus: done\nowner: —\nblockedReason: ""\n---\nbody\n',
  );
});

test('editFrontmatter throws without a closed block, refuses a multi-line value, and handles a 1 MB line quickly', () => {
  assert.throws(() => editFrontmatter('---\nid: T001\nstatus: open\n', { status: 'done' }), /not closed/);
  assert.throws(() => editFrontmatter('# no frontmatter\n', { status: 'done' }), /no frontmatter/);
  for (const value of ['a\nb', 'a\rb', 'a\u2028b', 'a\u0085b']) assert.throws(() => editFrontmatter('---\nid: T001\n---\n', { owner: value }), /single line/);
  const big = 'x'.repeat(1024 * 1024);
  const started = Date.now();
  const content = `---\nid: T001\nnote: ${big}\nstatus: open\n---\nbody\n`;
  const after = editFrontmatter(content, { owner: `a ${big}`, status: 'claimed' });
  assert.ok(after.includes(`note: ${big}\nstatus: claimed\nowner: a ${big}\n---\n`));
  assert.ok(Date.now() - started < 2000, 'a backtracking scan would take minutes');
});

test('resultSection: the template instruction, *(pending)*, {{…}} and an empty section are placeholders; T019\'s Result is real; ### Result is not the section', async () => {
  for (const name of [T004, T012, T030]) {
    const section = resultSection(parseTaskMarkdown(await fixture(name)).body);
    assert.equal(section.found, true, name);
    assert.equal(section.placeholder, true, name);
  }
  assert.equal(resultSection(parseTaskMarkdown(await fixture(T030)).body).text, '*(pending)*');
  assert.equal(resultSection('## Result\n\n{{the outcome}}\n').placeholder, true);
  assert.equal(resultSection('## Result\n\n## Notes\n\nx\n').placeholder, true);
  const real = resultSection(parseTaskMarkdown(await fixture(T019)).body);
  assert.equal(real.placeholder, false);
  assert.ok(real.text.startsWith('Pass, against the decision rules.'));
  assert.equal(resultSection('## Goal\n\n### Result\n\nnot this\n').found, false);
});

test('setResult replaces a placeholder with one line, keeps real content, and adds a missing section', async () => {
  const body = parseTaskMarkdown(await fixture(T030)).body;
  const after = setResult(body, 'Pass: fold 2 reached 0.91.');
  assert.ok(after.includes('## Result\n\nPass: fold 2 reached 0.91.\n\n## Notes\n\n- 2026-09-21: a note someone appended.\n'));
  assert.equal(after.replace('Pass: fold 2 reached 0.91.', '*(pending)*'), body, 'nothing else changes');
  const template = parseTaskMarkdown(await fixture(T012)).body;
  assert.ok(setResult(template, 'Fixed.').includes('## Result\n\nFixed.\n\n## Notes\n'));
  const real = parseTaskMarkdown(await fixture(T019)).body;
  assert.equal(setResult(real, 'Something else.'), real);
  assert.equal(setResult('# T001\n\n## Goal\n\nx\n', 'Done.'), '# T001\n\n## Goal\n\nx\n\n## Result\n\nDone.\n');
  assert.equal(setResult('## Result\r\n\r\n*(pending)*\r\n\r\n## Notes\r\n', 'Done.'), '## Result\r\n\r\nDone.\r\n\r\n## Notes\r\n');
  assert.throws(() => setResult(body, 'two\nlines'), /single line/);
  assert.throws(() => setResult(body, '  '), /empty/);
});

test('ownerLine strips #, quotes and line breaks, caps the note, and parseOwner reads it back as the operator\'s own claim through AGE Aris', () => {
  const line = ownerLine('Repo Operator', `#1 "quoted" 'single' \`tick\` “curly”\r\nnext\u2028line ${'n'.repeat(300)}`, new Date('2026-10-07T23:30:00-05:00'));
  assert.ok(line.startsWith('Repo Operator @agesight/web 2026-10-08 — 1 quoted single tick curly next line n'));
  assert.ok(!/[#"'`\r\n\u2028]/.test(line));
  assert.equal(line.split(' — ')[1].length, 120);
  const owner = parseOwner(line);
  assert.deepEqual([owner.operator, owner.profile, owner.session], ['Repo Operator', 'agesight', 'web']);
  assert.equal(ownerLine('Repo Operator', '', new Date('2026-10-07T00:00:00Z')), 'Repo Operator @agesight/web 2026-10-07');
  assert.throws(() => ownerLine(' # ', 'x'), /operator/);
});

test('commitSubject speaks AA, stays within 72 characters on one line, and never starts with a sweep prefix', () => {
  assert.equal(commitSubject('claim', 'T012', 'testing the engine'), 'claim T012: testing the engine');
  assert.equal(commitSubject('release', 'T012'), 'release T012: back to the queue');
  assert.equal(commitSubject('block', 'T012', 'waiting on\nT011'), 'block T012: waiting on T011');
  assert.equal(commitSubject('unblock', 'T012'), 'unblock T012');
  assert.equal(commitSubject('done', 'T012', 'ckpt: looks like a sweep'), 'T012 done: ckpt: looks like a sweep');
  const long = commitSubject('done', 'T012', 'word '.repeat(40));
  assert.ok([...long].length <= 72 && [...long].length > 60);
  assert.ok(long.endsWith('…'));
  for (const subject of [long, commitSubject('claim', 'T1234', 'migrate: x')]) assert.ok(!/^(migrate|ckpt):/.test(subject));
  assert.throws(() => commitSubject('claim', 'T012', ''), /needs text/);
  assert.throws(() => commitSubject('migrate', 'T012', 'x'), /no commit subject/);
  assert.throws(() => commitSubject('claim', 'ckpt: T012', 'x'), /task id/);
});

// ---- readTrail

const NOW = Date.parse('2026-10-07T12:00:00Z');
const hoursAgo = (hours) => new Date(NOW - hours * 3_600_000).toISOString();
const line = (run, kind, hours, extra = {}) => JSON.stringify({ ts: hoursAgo(hours), run, kind, ...extra, next: 'resume' });

async function trailFile(lines) {
  const file = path.join(await tempDir('trail'), 'T053.jsonl');
  await writeFile(file, `${lines.join('\n')}\n`);
  return file;
}

test('readTrail: an unended run is live within stale_hours and dead after it; staleHours is 24 without AA.yml', async () => {
  const file = await trailFile([
    line('2e8b687e', 'open', 3), line('2e8b687e', 'doing', 1, { act: 'fold 0' }),
    line('7c1e2a90', 'open', 22 * 24 + 1), line('7c1e2a90', 'doing', 22 * 24, { act: 'train fold 2' }),
    line('5a5a5a5a', 'did', 72, { what: 'three days ago' }),
    line('23h00000', 'did', 23), line('25h00000', 'did', 25),
  ]);
  const { runs, malformed, truncated } = await readTrail(file, { staleHours: boardPolicy('').staleHours, now: NOW });
  const state = Object.fromEntries(runs.map((run) => [run.id, run.live ? 'live' : run.ended ? 'ended' : 'dead']));
  assert.deepEqual(state, { '2e8b687e': 'live', '7c1e2a90': 'dead', '5a5a5a5a': 'dead', '23h00000': 'live', '25h00000': 'dead' });
  assert.equal(runs.find((run) => run.id === '7c1e2a90').last.act, 'train fold 2');
  assert.deepEqual([malformed, truncated], [[], false]);
  const longer = await readTrail(file, { staleHours: 48, now: new Date(NOW) });
  assert.equal(longer.runs.find((run) => run.id === '5a5a5a5a').live, false, 'three days is past 48 hours');
  assert.equal(longer.runs.find((run) => run.id === '25h00000').live, true);
  const defaults = await readTrail(file, { now: NOW });
  assert.equal(defaults.runs.find((run) => run.id === '25h00000').live, false, 'the default is 24 hours');
});

test('readTrail: runs are grouped by id and judged by their newest line, so three opens and four ends have all ended, and a resumed run has not', async () => {
  const file = await trailFile([
    line('aaaa1111', 'open', 50), line('aaaa1111', 'end', 49),
    line('bbbb2222', 'open', 40), line('bbbb2222', 'end', 39), line('bbbb2222', 'end', 38),
    line('cccc3333', 'open', 30), line('cccc3333', 'end', 1),
    line('dddd4444', 'open', 10), line('dddd4444', 'end', 9), line('dddd4444', 'did', 2),
  ]);
  const { runs } = await readTrail(file, { now: NOW });
  assert.deepEqual(runs.map((run) => [run.id, run.ended, run.live]), [
    ['aaaa1111', true, false], ['bbbb2222', true, false], ['cccc3333', true, false], ['dddd4444', false, true],
  ]);
});

test('readTrail reports malformed lines by number, reads no file as no runs, and reads only the last 1 MB with true line numbers', async () => {
  const file = await trailFile([line('aaaa1111', 'open', 2), '{"ts":"2026-10-07T10:00:00Z","run":"aaa', JSON.stringify({ ts: hoursAgo(1), kind: 'did' }), '', '[1]', line('aaaa1111', 'did', 1)]);
  const { runs, malformed } = await readTrail(file, { now: NOW });
  assert.deepEqual(malformed, [2, 3, 5]);
  assert.deepEqual(runs.map((run) => [run.id, run.live]), [['aaaa1111', true]]);
  assert.deepEqual(await readTrail(path.join(path.dirname(file), 'T999.jsonl')), { runs: [], malformed: [], truncated: false, numbered: true });
  const filler = line('0ld00000', 'did', 400, { what: 'x'.repeat(1000) });
  const count = Math.ceil((1.2 * 1024 * 1024) / filler.length);
  const big = await trailFile([...Array(count).fill(filler), '{broken', line('2e8b687e', 'doing', 1)]);
  const capped = await readTrail(big, { now: NOW });
  assert.equal(capped.truncated, true);
  assert.deepEqual(capped.malformed, [count + 1]);
  assert.equal(capped.runs.find((run) => run.id === '2e8b687e').live, true);
});

// ---- trackedGit

test('trackedGit sends SIGTERM at the deadline less the grace period, and SIGKILL to a child that ignores it', async () => {
  const dir = await tempDir('kill');
  const honours = Date.now();
  const polite = await trackedGit(dir, ['status'], { timeout: 400, grace: 200, spawn: spawnWith(() => 'exec sleep 5') });
  assert.equal(polite.timedOut, true);
  assert.equal(polite.signal, 'SIGTERM');
  assert.ok(Date.now() - honours < 390, 'SIGTERM came before the deadline');
  const stubborn = Date.now();
  const killed = await trackedGit(dir, ['status'], { timeout: 400, grace: 200, spawn: spawnWith(() => 'trap "" TERM; exec sleep 5') });
  assert.equal(killed.timedOut, true);
  assert.equal(killed.signal, 'SIGKILL');
  const elapsed = Date.now() - stubborn;
  assert.ok(elapsed >= 390 && elapsed < 1500, `killed at the deadline (${elapsed} ms)`);
  assert.throws(() => trackedGit(dir, ['status'], { env: { GIT_DIR: '/tmp' } }), /cannot be set/);
  assert.throws(() => trackedGit(dir, ['status'], { env: { GIT_INDEX_FILE: '/tmp/index' } }), /git folder/);
});

// ---- probeRepository

test('probeRepository refuses reftable, a sparse checkout, a sparse index, a split index and a detached HEAD', async () => {
  const reftable = await tempDir('reftable');
  await g(reftable, 'init', '--quiet', '--ref-format=reftable', '--initial-branch=main');
  await mkdir(path.join(reftable, 'AA', 'tasks'), { recursive: true });
  await writeFile(path.join(reftable, 'README.md'), 'x\n');
  await g(reftable, 'add', '-A');
  await g(reftable, '-c', 'user.name=x', '-c', 'user.email=x@example.invalid', 'commit', '--quiet', '-m', 'x');
  await assert.rejects(probeRepository(reftable), (error) => error.code === 'UNSUPPORTED_REPO' && /reftable/.test(error.message));
  const cases = [
    ['sparse checkout', (dir) => g(dir, 'config', 'core.sparseCheckout', 'true')],
    ['sparse', (dir) => g(dir, 'config', 'index.sparse', 'true')],
    ['split', (dir) => g(dir, 'config', 'core.splitIndex', 'true')],
    ['split', (dir) => g(dir, 'update-index', '--split-index')],
    ['detached', (dir) => g(dir, 'checkout', '--quiet', '--detach')],
  ];
  for (const [word, setUp] of cases) {
    const repo = await makeRepo();
    assert.equal((await probeRepository(repo.dir)).branch, BRANCH);
    await setUp(repo.dir);
    await assert.rejects(probeRepository(repo.dir), (error) => error.code === 'UNSUPPORTED_REPO' && error.message.includes(word), word);
  }
});

test('probeRepository refuses a task folder where link() fails, leaving no probe file, and discloses hooks and linked worktrees', async () => {
  const repo = await makeRepo();
  const eperm = async () => { throw Object.assign(new Error('operation not permitted'), { code: 'EPERM' }); };
  await assert.rejects(probeRepository(repo.dir, { link: eperm }), (error) => error.code === 'UNSUPPORTED_REPO' && /EPERM/.test(error.message));
  assert.deepEqual((await readdir(path.join(repo.dir, 'AA', 'tasks'))).filter((name) => name.startsWith('.agesight')), []);
  await writeFile(path.join(repo.dir, '.git', 'hooks', 'pre-commit'), '#!/bin/sh\nexit 1\n', { mode: 0o755 });
  const linked = path.join(await tempDir('worktree'), 'wt-p0a');
  await g(repo.dir, 'worktree', 'add', '--quiet', '-b', 'side', linked);
  const probe = await probeRepository(repo.dir);
  assert.ok(probe.hooks.includes('pre-commit'));
  assert.ok(!probe.hooks.some((name) => name.endsWith('.sample')));
  assert.deepEqual(probe.worktrees, [linked]);
  assert.deepEqual((await readdir(path.join(repo.dir, 'AA', 'tasks'))).filter((name) => name.startsWith('.agesight')), []);
});

// ---- commitTaskChange: the happy paths

test('a move commits the one file as a rename, with the repository\'s identity and the trailer, and leaves other staged and unstaged work alone', async () => {
  const repo = await makeRepo();
  await writeFile(path.join(repo.dir, 'other.txt'), 'one\ntwo, unstaged\n');
  await writeFile(path.join(repo.dir, 'staged.txt'), 'staged by an agent\n');
  await writeFile(path.join(repo.dir, 'README.md'), '# Staged edit\n');
  await g(repo.dir, 'add', 'staged.txt', 'README.md');
  const [diff, cached] = [await g(repo.dir, 'diff'), await g(repo.dir, 'diff', '--cached')];
  const before = await readFile(path.join(repo.dir, 'AA', 'backlog', T012), 'utf8');
  const result = await act(repo);
  assert.equal(result.branch, BRANCH);
  assert.deepEqual(result.warnings, []);
  await assertCommitted(repo, result, [`AA/backlog/${T012}`, `AA/tasks/${T012}`]);
  const changes = (await g(repo.dir, 'show', '--name-status', '--format=', result.commit)).split('\n');
  assert.equal(changes.length, 1);
  assert.match(changes[0], new RegExp(`^R\\d+\\tAA/backlog/${T012}\\tAA/tasks/${T012}$`));
  const after = await readFile(path.join(repo.dir, 'AA', 'tasks', T012), 'utf8');
  const changed = before.split('\n').filter((text, index) => text !== after.split('\n')[index]);
  assert.deepEqual(changed, ['status: open', 'owner: —']);
  assert.equal(await g(repo.dir, 'show', `${result.commit}:AA/tasks/${T012}`), after.trimEnd());
  assert.equal(await g(repo.dir, 'log', '-1', '--format=%an <%ae>|%cn <%ce>'), 'Repo Operator <repo@example.invalid>|Repo Operator <repo@example.invalid>');
  assert.equal(await g(repo.dir, 'log', '-1', '--format=%(trailers:key=AGESight-Via,valueonly)'), 'ui');
  assert.equal(await g(repo.dir, 'log', '-1', '--format=%s'), 'claim T012: test the engine');
  assert.equal(await g(repo.dir, 'rev-parse', `${result.commit}^`), await g(repo.dir, 'rev-parse', 'HEAD~1'));
  assert.deepEqual([await g(repo.dir, 'diff'), await g(repo.dir, 'diff', '--cached')], [diff, cached], 'other work is byte-identical');
  assert.match(await g(repo.dir, 'reflog', '-1', '--format=%gs', 'main'), /^AGE Aris: claim T012/);
});

test('an in-place change on the older layout commits as M, and Done moves a file into a tasks/done/ it creates', async () => {
  const repo = await makeRepo({ backlog: false });
  const claim = await act(repo, { from: `AA/tasks/${T012}`, to: `AA/tasks/${T012}` });
  await assertCommitted(repo, claim, [`AA/tasks/${T012}`]);
  assert.equal(await g(repo.dir, 'show', '--name-status', '--format=', claim.commit), `M\tAA/tasks/${T012}`);
  const finish = (text) => {
    const marked = editFrontmatter(text, { status: 'done', blockedReason: '' });
    const { body } = parseTaskMarkdown(marked);
    return marked.slice(0, marked.length - body.length) + setResult(body, 'Pass: fold 2 reached 0.91.');
  };
  const done = await act(repo, { from: `AA/tasks/${T030}`, to: `AA/tasks/done/${T030}`, edit: finish, message: 'T030 done: Pass\n\nAGESight-Via: ui\n' });
  await assertCommitted(repo, done, [`AA/tasks/${T030}`, `AA/tasks/done/${T030}`]);
  const text = await readFile(path.join(repo.dir, 'AA', 'tasks', 'done', T030), 'utf8');
  assert.ok(text.includes('status: done\nowner: adervark @k/b6192924 2026-09-20 — fold 2 of 5\n'), 'the owner line is kept');
  assert.ok(text.includes('## Result\n\nPass: fold 2 reached 0.91.\n\n## Notes\n'));
  assert.ok(!(await g(repo.dir, 'show', '--name-only', '--format=', done.commit)).includes('STATE.md'));
});

test('no repository code runs: hooks, a filter driver and a signing program leave no marker, and the commit is unsigned', async () => {
  const repo = await makeRepo({ gitattributes: '*.md filter=mark\n' });
  const seen = await tempDir('foreign');
  const touch = (name) => `#!/bin/sh\ntouch "${seen}/${name}"\n`;
  // Racily clean: an entry newer than the index, recorded by a refresh made
  // before any hook or filter exists. Writing any copy of this index re-checks
  // it through the clean filter.
  const later = new Date(Date.now() + 60_000);
  await utimes(path.join(repo.dir, 'AA', 'backlog', T004), later, later);
  await g(repo.dir, 'update-index', '--refresh');
  for (const hook of ['pre-commit', 'post-commit', 'reference-transaction', 'post-index-change', 'pre-auto-gc']) {
    await writeFile(path.join(repo.dir, '.git', 'hooks', hook), touch(hook), { mode: 0o755 });
  }
  const programs = await tempDir('programs');
  await writeFile(path.join(programs, 'gpg'), `${touch('gpg')}exit 1\n`, { mode: 0o755 });
  await g(repo.dir, 'config', 'filter.mark.clean', `sh -c 'touch "${seen}/clean"; cat'`);
  await g(repo.dir, 'config', 'filter.mark.smudge', `sh -c 'touch "${seen}/smudge"; cat'`);
  await g(repo.dir, 'config', 'commit.gpgSign', 'true');
  await g(repo.dir, 'config', 'gpg.program', path.join(programs, 'gpg'));
  const result = await act(repo);
  assert.deepEqual(await readdir(seen), [], 'no hook, filter or signing program ran');
  assert.ok(!(await g(repo.dir, 'cat-file', 'commit', result.commit)).includes('gpgsig'), 'the commit is unsigned');
  assert.equal(await g(repo.dir, 'rev-parse', BRANCH), result.commit);
  // The control: a plain git commit here does run them.
  await writeFile(path.join(repo.dir, 'other.txt'), 'control\n');
  assert.equal((await agent(repo.dir, 'commit', '-am', 'control')).ok, false);
  assert.ok((await readdir(seen)).includes('pre-commit'));
});

// ---- Refusals before anything changes

test('refusals leave the repository unchanged: dirty, staged, untracked target, CRLF, not committed, git state, branch, lock, probe, board', async () => {
  const cases = [
    ['DIRTY_FILE', 'an unstaged change', async ({ dir }) => writeFile(path.join(dir, 'AA', 'backlog', T012), 'changed\n', { flag: 'a' })],
    ['DIRTY_FILE', 'a staged change', async ({ dir }) => {
      await writeFile(path.join(dir, 'AA', 'backlog', T012), 'changed\n', { flag: 'a' });
      await g(dir, 'add', `AA/backlog/${T012}`);
    }],
    ['DIRTY_FILE', 'an untracked target', async ({ dir }) => writeFile(path.join(dir, 'AA', 'tasks', T012), 'someone else\n')],
    ['DIRTY_FILE', 'a CRLF-converted file', async ({ dir }) => {
      const file = path.join(dir, 'AA', 'backlog', T012);
      await writeFile(file, (await readFile(file, 'utf8')).replaceAll('\n', '\r\n'));
    }],
    ['NOT_COMMITTED', 'a file not in HEAD', async ({ dir }) => {
      await rename(path.join(dir, 'AA', 'backlog', T004), path.join(dir, 'AA', 'backlog', 'T044-new.md'));
    }, { from: 'AA/backlog/T044-new.md', to: 'AA/tasks/T044-new.md' }],
    ['GIT_BUSY', 'a detached HEAD', ({ dir }) => g(dir, 'checkout', '--quiet', '--detach')],
    ['GIT_BUSY', 'a merge in progress', async ({ dir }) => {
      await g(dir, 'checkout', '--quiet', '-b', 'side');
      await writeFile(path.join(dir, 'side.txt'), 'side\n');
      await g(dir, 'add', 'side.txt');
      await g(dir, 'commit', '--quiet', '-m', 'side');
      await g(dir, 'checkout', '--quiet', 'main');
      await g(dir, 'merge', '--quiet', '--no-commit', '--no-ff', 'side');
    }],
    ['GIT_BUSY', 'a conflicting cherry-pick', async ({ dir }) => {
      await g(dir, 'checkout', '--quiet', '-b', 'side');
      await writeFile(path.join(dir, 'other.txt'), 'side\n');
      await g(dir, 'commit', '--quiet', '-am', 'side');
      await g(dir, 'checkout', '--quiet', 'main');
      await writeFile(path.join(dir, 'other.txt'), 'main\n');
      await g(dir, 'commit', '--quiet', '-am', 'main');
      await assert.rejects(g(dir, 'cherry-pick', 'side'));
    }],
    ['GIT_BUSY', 'a conflicting rebase', async ({ dir }) => {
      await g(dir, 'checkout', '--quiet', '-b', 'side');
      await writeFile(path.join(dir, 'other.txt'), 'side\n');
      await g(dir, 'commit', '--quiet', '-am', 'side');
      await g(dir, 'checkout', '--quiet', 'main');
      await writeFile(path.join(dir, 'other.txt'), 'main\n');
      await g(dir, 'commit', '--quiet', '-am', 'main');
      await g(dir, 'checkout', '--quiet', 'side');
      await assert.rejects(g(dir, 'rebase', 'main'));
    }],
    ['GIT_BUSY', 'an index.lock held by an agent (W1)', ({ dir }) => writeFile(path.join(dir, '.git', 'index.lock'), 'an agent\'s commit\n')],
    ['WRONG_BRANCH', 'another branch', ({ dir }) => g(dir, 'checkout', '--quiet', '-b', 'hotfix')],
    ['UNSUPPORTED_REPO', 'a sparse checkout set after switching on', ({ dir }) => g(dir, 'config', 'core.sparseCheckout', 'true')],
    ['NO_IDENTITY', 'no user.name', ({ dir }) => g(dir, 'config', '--unset', 'user.name')],
    ['LEGACY_BOARD', 'a deaddrop/ board', async () => {}, { from: `deaddrop/tasks/${T012}`, to: `deaddrop/tasks/${T012}` }],
    ['BAD_INPUT', 'a path outside the task folders', async () => {}, { from: 'AA/STATE.md', to: 'AA/STATE.md', edit: (text) => text }],
    ['BAD_INPUT', 'a change that changes nothing', async () => {}, { from: `AA/backlog/${T012}`, to: `AA/backlog/${T012}`, edit: (text) => text }],
  ];
  for (const [code, label, setUp, options = {}] of cases) {
    const repo = await makeRepo();
    await setUp(repo);
    const before = await snapshot(repo.dir);
    const from = options.from ?? `AA/backlog/${T012}`;
    const content = await readFile(path.join(repo.dir, ...from.split('/'))).catch(() => Buffer.from('---\nid: T012\n---\n'));
    const edit = options.edit ?? claimed;
    await refused(commitTaskChange(repo.dir, {
      from, to: options.to ?? `AA/tasks/${T012}`, content: edit(content.toString('utf8')), message: MESSAGE, branch: BRANCH, dataDir: repo.dataDir, projectId: 'p1',
    }), code);
    await assertUnchanged(repo, before, label);
  }
});

test('AGESIGHT_TRACKED_WRITES=0 refuses every write', async () => {
  const repo = await makeRepo();
  const before = await snapshot(repo.dir);
  process.env.AGESIGHT_TRACKED_WRITES = '0';
  try {
    await refused(act(repo), 'ACTIONS_OFF');
  } finally {
    delete process.env.AGESIGHT_TRACKED_WRITES;
  }
  await assertUnchanged(repo, before);
});

// ---- Seams: an agent's commit in each window

for (const [window, seam] of [['W2, under the lock before the CAS', 'beforeCas'], ['W3, after the CAS', 'afterCas'], ['W4, after the working tree', 'afterWorktree']]) {
  for (const command of ['commit', 'commit -a']) {
    test(`an agent's git ${command} in ${window} fails on index.lock, and after release commits only its own change`, async () => {
      const repo = await makeRepo();
      const own = command === 'commit' ? 'staged.txt' : 'other.txt';
      await writeFile(path.join(repo.dir, own), 'the agent\'s change\n');
      if (command === 'commit') await g(repo.dir, 'add', own);
      const args = command === 'commit' ? ['commit', '-m', 'agent'] : ['commit', '-a', '-m', 'agent'];
      let during;
      const result = await act(repo, { seams: { [seam]: async () => { during ??= await agent(repo.dir, ...args); } } });
      assert.equal(during.ok, false);
      assert.match(during.stderr, /index\.lock/);
      await assertCommitted(repo, result, [`AA/backlog/${T012}`, `AA/tasks/${T012}`]);
      const retry = await agent(repo.dir, ...args);
      assert.equal(retry.ok, true, retry.stderr);
      assert.equal(await g(repo.dir, 'show', '--name-only', '--format=', 'HEAD'), own, 'the agent commits only its own change');
      assert.equal(await g(repo.dir, 'rev-parse', 'HEAD~1'), result.commit);
      assert.equal(await g(repo.dir, 'status', '--porcelain', '--untracked-files=all'), '');
    });
  }
}

test('W1: an agent\'s commit that lands before the lock is built on; W5: commit -a after release reverts nothing', async () => {
  const repo = await makeRepo();
  await writeFile(path.join(repo.dir, 'staged.txt'), 'first\n');
  await g(repo.dir, 'add', 'staged.txt');
  await g(repo.dir, 'commit', '--quiet', '-m', 'agent first');
  const first = await g(repo.dir, 'rev-parse', 'HEAD');
  const result = await act(repo);
  assert.equal(await g(repo.dir, 'rev-parse', `${result.commit}^`), first);
  await assertCommitted(repo, result, [`AA/tasks/${T012}`]);
  await writeFile(path.join(repo.dir, 'other.txt'), 'after\n');
  assert.equal((await agent(repo.dir, 'commit', '-a', '-m', 'agent after')).ok, true);
  assert.equal(await g(repo.dir, 'show', '--name-only', '--format=', 'HEAD'), 'other.txt');
  assert.equal(await g(repo.dir, 'rev-parse', `HEAD:AA/tasks/${T012}`), await g(repo.dir, 'rev-parse', `${result.commit}:AA/tasks/${T012}`));
});

test('an editor write to the task file in W3 rolls the branch back: STALE, and only the editor\'s bytes differ', async () => {
  const repo = await makeRepo({ backlog: false });
  const file = path.join(repo.dir, 'AA', 'tasks', T012);
  const before = await snapshot(repo.dir);
  const edited = `${await readFile(file, 'utf8')}\nAn editor saved this.\n`;
  await refused(act(repo, { from: `AA/tasks/${T012}`, to: `AA/tasks/${T012}`, seams: { afterCas: () => writeFile(file, edited) } }), 'STALE');
  assert.equal(await readFile(file, 'utf8'), edited, 'the editor\'s write is kept');
  const after = await snapshot(repo.dir);
  assert.deepEqual({ ...after, files: { ...after.files, [`AA/tasks/${T012}`]: null } }, { ...before, files: { ...before.files, [`AA/tasks/${T012}`]: null } });
  assert.deepEqual(await markers(repo), []);
});

test('a plumbing writer in W2 loses AGE Aris the CAS, and every check runs again against the new HEAD', async () => {
  const outcomes = [
    ['an unrelated change', { 'unrelated.txt': 'x\n' }, null],
    ['a change to the task file', { [`AA/backlog/${T012}`]: null }, 'STALE'],
    ['another operator\'s claim', { [`AA/backlog/${T012}`]: null }, 'HELD_BY_OTHER'],
    ['a claim that fills WIP', { 'AA/tasks/T050-x.md': '---\nid: T050\n---\n', 'AA/tasks/T051-x.md': '---\nid: T051\n---\n' }, 'WIP_LIMIT'],
  ];
  for (const [label, changes, code] of outcomes) {
    const repo = await makeRepo();
    const original = await readFile(path.join(repo.dir, 'AA', 'backlog', T012), 'utf8');
    if (code === 'STALE') changes[`AA/backlog/${T012}`] = `${original}\nA line another writer added.\n`;
    if (code === 'HELD_BY_OTHER') changes[`AA/backlog/${T012}`] = editFrontmatter(original, { owner: 'alice @a/1234 2026-10-07 — mine' });
    let other;
    let checks = 0;
    const check = protocolCheck({ wipLimit: 2 });
    const run = act(repo, {
      check: async (head) => { checks += 1; return check(head); },
      seams: { beforeCas: (info) => { other ??= plumbingCommit(repo.dir, info.H, changes); } },
    });
    if (!code) {
      const result = await run;
      assert.equal(await g(repo.dir, 'rev-parse', `${result.commit}^`), other, label);
      assert.equal(checks, 2, 'the checks ran again');
      assert.equal(await g(repo.dir, 'status', '--porcelain', '--', 'AA'), '', label);
      continue;
    }
    await refused(run, code);
    assert.equal(await g(repo.dir, 'rev-parse', BRANCH), other, `${label}: the other writer's commit stands`);
    assert.equal(await readFile(path.join(repo.dir, 'AA', 'backlog', T012), 'utf8'), original);
    assert.deepEqual(await markers(repo), []);
    assert.ok(!(await readdir(path.join(repo.dir, '.git'))).some((name) => name === 'index.lock' || name.startsWith('agesight-')));
  }
});

// ---- Crash and recovery

const MARKER = (repo) => path.join(repo.dataDir, 'tracked-inflight', 'p1.json');

test('a crash in phase locked: recovery removes the lock it left, puts back a renamed file, and a second run changes nothing', async () => {
  const repo = await makeRepo();
  const before = await snapshot(repo.dir);
  await assert.rejects(act(repo, { seams: { locked: crash } }), /simulated crash/);
  const marker = JSON.parse(await readFile(MARKER(repo), 'utf8'));
  assert.equal(marker.phase, 'locked');
  assert.match(await readFile(path.join(repo.dir, '.git', 'index.lock'), 'utf8'), /^agesight [0-9a-f]{32}\n$/);
  await rename(path.join(repo.dir, 'AA', 'backlog', T012), marker.aside);
  assert.deepEqual(await recoverInflight(repo.dataDir, repo.dir), [{ marker: MARKER(repo), dir: repo.dir, outcome: 'unchanged' }]);
  await assertUnchanged(repo, before);
  assert.deepEqual(await recoverInflight(repo.dataDir), []);
  await assertUnchanged(repo, before);
});

for (const [phase, seam] of [['publishing', 'afterCas'], ['worktree', 'afterWorktree']]) {
  test(`a crash in phase ${phase}: recovery adopts the lock left behind and completes the write; a second run changes nothing`, async () => {
    const repo = await makeRepo();
    let commit;
    await assert.rejects(act(repo, { seams: { [seam]: (info) => { commit = info.C; crash(); } } }), /simulated crash/);
    assert.equal(JSON.parse(await readFile(MARKER(repo), 'utf8')).phase, phase);
    assert.equal(await g(repo.dir, 'rev-parse', BRANCH), commit);
    const [result] = await recoverInflight(repo.dataDir);
    assert.equal(result.outcome, 'committed');
    await assertCommitted(repo, { commit }, [`AA/backlog/${T012}`, `AA/tasks/${T012}`]);
    const settled = await snapshot(repo.dir);
    assert.deepEqual(await recoverInflight(repo.dataDir, repo.dir), []);
    assert.deepEqual(await snapshot(repo.dir), settled);
  });
}

test('after a crash, an agent that stages a file once the stale lock is deleted keeps it: recovery rebuilds the index from the current one', async () => {
  const repo = await makeRepo();
  let commit;
  await assert.rejects(act(repo, { seams: { afterCas: (info) => { commit = info.C; crash(); } } }), /simulated crash/);
  await unlink(path.join(repo.dir, '.git', 'index.lock'));
  await writeFile(path.join(repo.dir, 'agent.txt'), 'staged after the crash\n');
  await g(repo.dir, 'add', 'agent.txt');
  const [result] = await recoverInflight(repo.dataDir, repo.dir);
  assert.equal(result.outcome, 'committed');
  await assertCommitted(repo, { commit }, [`AA/tasks/${T012}`]);
  assert.equal(await g(repo.dir, 'diff', '--cached', '--name-only'), 'agent.txt');
  assert.deepEqual(await recoverInflight(repo.dataDir, repo.dir), []);
});

test('a lock with a reused inode but another nonce is not AGE Aris\'s: recovery leaves it', async () => {
  const repo = await makeRepo();
  await assert.rejects(act(repo, { seams: { locked: crash } }), /simulated crash/);
  const lock = path.join(repo.dir, '.git', 'index.lock');
  await unlink(lock);
  await writeFile(lock, 'another process\n');
  const marker = JSON.parse(await readFile(MARKER(repo), 'utf8'));
  await writeFile(MARKER(repo), JSON.stringify({ ...marker, lockIno: (await lstat(lock)).ino }));
  const [result] = await recoverInflight(repo.dataDir, repo.dir);
  assert.equal(result.outcome, 'unchanged');
  assert.equal(await readFile(lock, 'utf8'), 'another process\n');
  assert.deepEqual(await markers(repo), []);
});

test('a lock stolen before the index is installed: no install, the branch rolled back, the working tree restored, GIT_BUSY', async () => {
  const repo = await makeRepo();
  const before = await snapshot(repo.dir);
  const lock = path.join(repo.dir, '.git', 'index.lock');
  await refused(act(repo, { seams: { afterWorktree: async () => { await unlink(lock); await writeFile(lock, 'an agent\n'); } } }), 'GIT_BUSY');
  assert.equal(await readFile(lock, 'utf8'), 'an agent\n', 'the other process\'s lock is left alone');
  await unlink(lock);
  await assertUnchanged(repo, before);
});

// ---- The settle rule and timeouts

test('update-ref times out with the branch still at H: unchanged', async () => {
  const repo = await makeRepo();
  const before = await snapshot(repo.dir);
  const started = Date.now();
  const spawnProcess = spawnWith((args) => (args.includes('update-ref') ? 'trap "" TERM; exec sleep 5' : null));
  await refused(act(repo, { seams: { spawn: spawnProcess, timeouts: FAST } }), 'GIT_BUSY');
  assert.ok(Date.now() - started < FAST.hold + 500, 'the lock was held within the budget');
  await assertUnchanged(repo, before);
});

test('update-ref times out after moving the branch to C: the settle rule completes the write', async () => {
  const repo = await makeRepo();
  let calls = 0;
  const spawnProcess = spawnWith((args) => (args.includes('update-ref') && !calls++ ? 'trap "" TERM; "$@"; exec sleep 5' : null));
  const result = await act(repo, { seams: { spawn: spawnProcess, timeouts: FAST } });
  await assertCommitted(repo, result, [`AA/backlog/${T012}`, `AA/tasks/${T012}`]);
});

test('a timed-out update-ref that leaves the ref lock behind: INTERRUPTED, naming the exact path, and the lock is not deleted', async () => {
  const repo = await makeRepo();
  const refLock = path.join(repo.dir, '.git', 'refs', 'heads', 'main.lock');
  const spawnProcess = spawnWith((args) => (args.includes('update-ref') ? `: > "${refLock}"; exec sleep 5` : null));
  await assert.rejects(act(repo, { seams: { spawn: spawnProcess, timeouts: FAST } }), (error) => {
    assert.equal(error.code, 'INTERRUPTED');
    assert.equal(error.status, 500);
    assert.ok(error.message.includes(`${refLock} was left by a timed-out git call; delete it once no git command is running there`), error.message);
    return true;
  });
  await lstat(refLock);
  assert.equal(JSON.parse(await readFile(MARKER(repo), 'utf8')).phase, 'interrupted');
  assert.ok(!(await readdir(path.join(repo.dir, '.git'))).includes('index.lock'), 'git\'s index lock is released');
});

test('a git call under the lock that runs past its limit, and a hold past its budget, refuse with nothing changed', async () => {
  const slow = await makeRepo();
  const before = await snapshot(slow.dir);
  const spawnProcess = spawnWith((args) => (args.includes('write-tree') ? 'trap "" TERM; exec sleep 5' : null));
  await refused(act(slow, { seams: { spawn: spawnProcess, timeouts: FAST } }), 'GIT_BUSY');
  await assertUnchanged(slow, before);
  const long = await makeRepo();
  const longBefore = await snapshot(long.dir);
  const started = Date.now();
  await refused(act(long, { check: () => new Promise((done) => setTimeout(done, FAST.hold - FAST.reserve + 100)), seams: { timeouts: FAST } }), 'GIT_BUSY');
  assert.ok(Date.now() - started < FAST.hold + 500);
  await assertUnchanged(long, longBefore);
});

// ---- INTERRUPTED: only where a test builds its path

test('INTERRUPTED: a plumbing writer moves the branch on after the CAS; C stays in history, the marker stays, the index and working tree are untouched', async () => {
  const repo = await makeRepo();
  const before = await snapshot(repo.dir);
  let commit;
  await assert.rejects(act(repo, {
    seams: { afterCas: (info) => { commit = info.C; plumbingCommit(repo.dir, info.C, { 'unrelated.txt': 'x\n' }); } },
  }), (error) => error.code === 'INTERRUPTED' && error.status === 500 && error.message.startsWith(`Committed ${commit.slice(0, 7)}, but main moved`));
  assert.equal(await g(repo.dir, 'merge-base', '--is-ancestor', commit, BRANCH).then(() => true), true);
  const after = await snapshot(repo.dir);
  assert.deepEqual({ ...after, ref: null }, { ...before, ref: null });
  assert.equal(JSON.parse(await readFile(MARKER(repo), 'utf8')).phase, 'interrupted');
  for (let run = 0; run < 2; run += 1) {
    const [result] = await recoverInflight(repo.dataDir, repo.dir);
    assert.equal(result.outcome, 'interrupted');
    assert.deepEqual(await snapshot(repo.dir), after, 'recovery never touches an interrupted write');
  }
  await refused(act(repo, { from: `AA/backlog/${T004}`, to: `AA/tasks/${T004}` }), 'INTERRUPTED_PENDING', 409);
});

test('INTERRUPTED: a stolen lock, then the CAS back lost to a plumbing writer; C stays in history and nothing more is touched', async () => {
  const repo = await makeRepo();
  const before = await snapshot(repo.dir);
  const lock = path.join(repo.dir, '.git', 'index.lock');
  let commit;
  let worktree;
  await assert.rejects(act(repo, {
    seams: {
      afterWorktree: async (info) => {
        commit = info.C;
        await unlink(lock);
        await writeFile(lock, 'an agent\n');
        worktree = (await snapshot(repo.dir)).files;
      },
      beforeRollback: (info) => { plumbingCommit(repo.dir, info.C, { 'unrelated.txt': 'x\n' }); },
    },
  }), (error) => error.code === 'INTERRUPTED' && error.message.includes(`${lock} is not AGE Aris's`));
  assert.equal(await g(repo.dir, 'merge-base', '--is-ancestor', commit, BRANCH).then(() => true), true);
  assert.equal(await readFile(lock, 'utf8'), 'an agent\n');
  await unlink(lock);
  const after = await snapshot(repo.dir);
  assert.equal(after.index, before.index, 'the index is untouched');
  assert.deepEqual(after.files, worktree, 'the settle rule touched nothing in the working tree');
  assert.equal(JSON.parse(await readFile(MARKER(repo), 'utf8')).phase, 'interrupted');
});

test('a write is refused while another in this process holds the same repository', async () => {
  const repo = await makeRepo();
  let second;
  const result = await act(repo, {
    seams: { locked: async () => { second = await act(repo, { from: `AA/backlog/${T004}`, to: `AA/tasks/${T004}` }).catch((error) => error); } },
  });
  assert.equal(second.code, 'GIT_BUSY');
  await assertCommitted(repo, result, [`AA/tasks/${T012}`]);
});

test('the product does not reach the engine yet, and the read-only rule still stands', async () => {
  const agents = await readFile(new URL('../AGENTS.md', import.meta.url), 'utf8');
  assert.ok(agents.includes('never writes to a repository it tracks'));
  for (const file of ['../server.mjs', '../lib/workspace.mjs']) {
    assert.ok(!(await readFile(new URL(file, import.meta.url), 'utf8')).includes('tracked.mjs'), file);
  }
});

test('an executable task file keeps its mode', async () => {
  const repo = await makeRepo({ backlog: false });
  await chmod(path.join(repo.dir, 'AA', 'tasks', T012), 0o755);
  await g(repo.dir, '-c', 'core.fileMode=true', 'commit', '--quiet', '-am', 'executable');
  const result = await act(repo, { from: `AA/tasks/${T012}`, to: `AA/tasks/${T012}` });
  assert.match(await g(repo.dir, 'ls-tree', result.commit, '--', `AA/tasks/${T012}`), /^100755 /);
  await assertCommitted(repo, result, [`AA/tasks/${T012}`]);
});

// ---- Review fixes (second commit)

// Every file under a folder, with its bytes' hash.
async function filesUnder(root) {
  const found = {};
  async function visit(relative) {
    for (const entry of await readdir(path.join(root, relative), { withFileTypes: true })) {
      const name = relative ? `${relative}/${entry.name}` : entry.name;
      if (entry.isDirectory()) await visit(name);
      else found[name] = createHash('sha256').update(await readFile(path.join(root, name))).digest('hex');
    }
  }
  await visit('');
  return found;
}

for (const folder of ['AA', 'AA/tasks', 'AA/backlog']) {
  for (const where of ['in the working tree', 'committed']) {
    test(`a symbolic link at ${folder}, ${where}, is refused and nothing is written outside the repository`, async () => {
      const repo = await makeRepo();
      const outside = path.join(await tempDir('outside'), 'target');
      const linkPath = path.join(repo.dir, ...folder.split('/'));
      await rename(linkPath, outside);
      await symlink(outside, linkPath);
      if (where === 'committed') {
        await g(repo.dir, 'add', '-A');
        await g(repo.dir, 'commit', '--quiet', '-m', `link ${folder}`);
      }
      const [outsideBefore, before] = [await filesUnder(outside), await snapshot(repo.dir)];
      await refused(commitTaskChange(repo.dir, {
        from: `AA/backlog/${T012}`, to: `AA/tasks/${T012}`, content: claimed(await fixture(T012)), message: MESSAGE, branch: BRANCH, dataDir: repo.dataDir, projectId: 'p1',
      }), 'UNSUPPORTED_REPO');
      assert.deepEqual(await filesUnder(outside), outsideBefore, 'nothing was written through the link');
      await assertUnchanged(repo, before);
      await assert.rejects(probeRepository(repo.dir), (error) => error.code === 'UNSUPPORTED_REPO' && /not a real folder/.test(error.message));
      assert.deepEqual(await filesUnder(outside), outsideBefore, 'the probe wrote nothing through the link');
    });
  }
}

test('a crash after the index is installed but before the lock is released: recovery removes the lock and finds the write finished', async () => {
  const repo = await makeRepo();
  let commit;
  await assert.rejects(act(repo, { seams: { installed: (info) => { commit = info.C; crash(); } } }), /simulated crash/);
  assert.match(await readFile(path.join(repo.dir, '.git', 'index.lock'), 'utf8'), /^agesight [0-9a-f]{32}\n$/, 'the lock still carries the nonce');
  const [result] = await recoverInflight(repo.dataDir, repo.dir);
  assert.equal(result.outcome, 'committed');
  await assertCommitted(repo, { commit }, [`AA/backlog/${T012}`, `AA/tasks/${T012}`]);
  const settled = await snapshot(repo.dir);
  assert.deepEqual(await recoverInflight(repo.dataDir, repo.dir), []);
  assert.deepEqual(await snapshot(repo.dir), settled);
});

test('a failure while cleaning up does not leave the repository busy, and a failure while taking the lock leaves no lock', async () => {
  const repo = await makeRepo();
  await assert.rejects(act(repo, { seams: { beforeRelease: () => { throw new Error('disk full'); } } }), /disk full/);
  const next = await act(repo, { from: `AA/backlog/${T004}`, to: `AA/tasks/${T004}` });
  assert.deepEqual(next.warnings.map((warning) => warning.code), ['INTERRUPTED_RECOVERED'], 'the first write was found finished');
  await assertCommitted(repo, next, [`AA/tasks/${T012}`, `AA/tasks/${T004}`]);
  const fresh = await makeRepo();
  const before = await snapshot(fresh.dir);
  await assert.rejects(act(fresh, { seams: { lockOpened: () => { throw new Error('no space left'); } } }), /no space left/);
  await assertUnchanged(fresh, before);
  await assertCommitted(fresh, await act(fresh), [`AA/tasks/${T012}`]);
});

test('a check that never settles is cut off at the hold\'s deadline: GIT_BUSY, nothing changed', async () => {
  const repo = await makeRepo();
  const before = await snapshot(repo.dir);
  const started = Date.now();
  await refused(act(repo, { check: () => new Promise(() => {}), seams: { timeouts: FAST } }), 'GIT_BUSY');
  assert.ok(Date.now() - started < FAST.hold + 500, `released in time (${Date.now() - started} ms)`);
  await assertUnchanged(repo, before);
});

test('replace refs are ignored: the commit is built from HEAD\'s real tree', async () => {
  const repo = await makeRepo();
  const head = await g(repo.dir, 'rev-parse', 'HEAD');
  const indexFile = path.join(repo.dir, '.git', 'replace-index');
  gSync(repo.dir, ['read-tree', head], { env: { GIT_INDEX_FILE: indexFile } });
  gSync(repo.dir, ['update-index', '--force-remove', 'README.md'], { env: { GIT_INDEX_FILE: indexFile } });
  const tree = gSync(repo.dir, ['write-tree'], { env: { GIT_INDEX_FILE: indexFile } });
  await unlink(indexFile);
  await g(repo.dir, 'replace', head, gSync(repo.dir, ['commit-tree', tree, '-m', 'a stand-in']));
  const result = await act(repo);
  const files = (await g(repo.dir, '--no-replace-objects', 'ls-tree', '-r', '--name-only', result.commit)).split('\n');
  assert.ok(files.includes('README.md'), 'README.md is still in the commit');
  assert.ok(files.includes(`AA/tasks/${T012}`));
});

test('an aside file already there is never overwritten: STALE, and the task file is as it was', async () => {
  const repo = await makeRepo({ backlog: false });
  const file = path.join(repo.dir, 'AA', 'tasks', T012);
  const original = await readFile(file, 'utf8');
  const head = await g(repo.dir, 'rev-parse', BRANCH);
  await refused(act(repo, {
    from: `AA/tasks/${T012}`, to: `AA/tasks/${T012}`,
    seams: { afterCas: async () => writeFile(JSON.parse(await readFile(MARKER(repo), 'utf8')).aside, 'a copy that is not the task\n') },
  }), 'STALE');
  assert.equal(await readFile(file, 'utf8'), original);
  assert.equal(await g(repo.dir, 'rev-parse', BRANCH), head, 'the branch was rolled back');
  assert.deepEqual(await markers(repo), []);
});

test('an operation that starts while the lock is held is caught under the lock: GIT_BUSY', async () => {
  const repo = await makeRepo();
  const before = await snapshot(repo.dir);
  const mergeHead = path.join(repo.dir, '.git', 'MERGE_HEAD');
  await refused(act(repo, { seams: { locked: async () => writeFile(mergeHead, `${before.ref}\n`) } }), 'GIT_BUSY');
  await unlink(mergeHead);
  await assertUnchanged(repo, before);
});

test('INTERRUPTED says "may have committed" when the branch cannot be read', async () => {
  const repo = await makeRepo();
  const refLock = path.join(repo.dir, '.git', 'refs', 'heads', 'main.lock');
  let updated = false;
  const spawnProcess = spawnWith((args) => {
    if (args.includes('update-ref')) {
      updated = true;
      return `"$@"; : > "${refLock}"; exec sleep 5`;
    }
    return updated && args.includes('rev-parse') && args.includes('-q') ? 'exit 1' : null;
  });
  await assert.rejects(act(repo, { seams: { spawn: spawnProcess, timeouts: FAST } }), (error) => {
    assert.equal(error.code, 'INTERRUPTED');
    assert.match(error.message, /^AGE Aris may have committed [0-9a-f]{7} \(the branch could not be read\)/);
    return true;
  });
});

test('readTrail stops counting lines more than 8 MB before its window, and says so', async () => {
  const filler = line('0ld00000', 'did', 400, { what: 'x'.repeat(4000) });
  const count = Math.ceil((9.5 * 1024 * 1024) / filler.length);
  const file = await trailFile([...Array(count).fill(filler), '{broken', line('2e8b687e', 'doing', 1)]);
  const capped = await readTrail(file, { now: NOW });
  assert.deepEqual([capped.truncated, capped.numbered], [true, false]);
  assert.equal(capped.malformed.length, 1);
  assert.ok(capped.malformed[0] < 300, 'numbered from the window');
  assert.equal(capped.runs.find((run) => run.id === '2e8b687e').live, true);
});

test('editFrontmatter keeps a trailing # comment on the line it replaces', () => {
  const content = '---\nid: T001\nstatus: open  # the AA word\nblockedReason: "a # inside" # why it waits\nowner: \'x\'\'s\' # quoted\nnote: a#b\n---\n';
  assert.equal(
    editFrontmatter(content, { status: 'claimed', blockedReason: 'waiting', owner: 'y', note: 'c' }),
    '---\nid: T001\nstatus: claimed  # the AA word\nblockedReason: "waiting" # why it waits\nowner: "y" # quoted\nnote: c\n---\n',
  );
});
