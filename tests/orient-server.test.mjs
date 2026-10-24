import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdir, mkdtemp, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { Cockpit } from '../lib/brief.mjs';
import { fixedView, serialize } from '../lib/orient.mjs';
import { at, blocked, build, bytes, doing, end, open, owner, proc, task } from './orient/corpus.mjs';

// The server's door on the orient corpus (docs/ORIENT.md §11, P1c): every
// case, server-only ones included, through Cockpit.orient, compared with the
// case's answer byte for byte. The gates come from pipeline runs, as they do
// on the server.

process.env.GIT_CONFIG_GLOBAL = os.devNull;
process.env.GIT_CONFIG_NOSYSTEM = '1';

const PROJECT = '0c0c0c0c-0000-4000-8000-000000000001';
const cases = [];
for (const name of (await readdir(new URL('./orient/cases/', import.meta.url))).filter((entry) => entry.endsWith('.mjs')).sort()) {
  const { default: list } = await import(new URL(`./orient/cases/${name}`, import.meta.url));
  for (const c of list) cases.push({ ...c, source: name });
}

// A cockpit over one repository: the project resolves to it, and each gate in
// the case's view is a run awaiting approval on that task.
function cockpitFor(dir, c) {
  const runs = new Map(Object.entries(c.view.gates || {}).map(([id, since], index) => [`r${index}`, {
    projectId: PROJECT,
    state: { status: 'awaiting_approval', taskId: `${PROJECT}:${id}`, attempts: [{ status: 'awaiting_approval', gateOpenedAt: since }] },
  }]));
  return new Cockpit({
    workspace: { _describe: async () => ({ dir, board: c.board || 'AA', linked: true }), _verifyProjectRepoAsync: async () => {} },
    engine: { runs },
    ledgers: { close() {}, forget() {} },
    view: fixedView(c.view),
  });
}

function query(call) {
  const out = { project: PROJECT, operator: call.operator, asOf: call.asOf, budget: String(call.budget) };
  if (call.run !== undefined) out.run = call.run;
  if (call.task !== undefined) out.task = call.task;
  if (call.remote !== undefined) out.remote = call.remote ? '1' : '0';
  return out;
}

test('orient, the server door: every corpus case, byte for byte', { timeout: 300000 }, async () => {
  const root = await mkdtemp(join(os.tmpdir(), 'aa-orient-server-'));
  const failures = [];
  try {
    const queue = [...cases];
    const work = async () => {
      for (let c = queue.shift(); c; c = queue.shift()) {
        try {
          const caseRoot = join(root, c.name);
          await mkdir(caseRoot);
          const { dir, head } = await build(c, caseRoot);
          const got = serialize(await cockpitFor(dir, c).orient(query(c.call)));
          const expected = bytes({ ...c.answer, repo: { ...c.answer.repo, door: 'server' } }, head);
          if (got !== expected) failures.push(`${c.name} (${c.source}):\n  expected ${expected}\n  got      ${got}`);
        } catch (error) {
          failures.push(`${c.name} (${c.source}): ${error.stack}`);
        }
      }
    };
    await Promise.all(Array.from({ length: 6 }, work));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
  assert.equal(failures.length, 0, `${failures.length} of ${cases.length} cases differ:\n${failures.join('\n')}`);
});

// No repository text reaches a structured field (§6, design §8): hostile text
// in every field a task file or trail holds comes out in `data` or nowhere.
// The marker cannot be an id, a run id, an enum, a time or a fixed path.
test('orient, the server door: no repository text reaches a structured field', { timeout: 120000 }, async () => {
  const root = await mkdtemp(join(os.tmpdir(), 'aa-orient-fuzz-'));
  let seed = 7;
  const random = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  const pieces = ['Z~Q', '"', '\\', '\n', '\r\n', ' — ', '@x/y', 'T001', 'T999999', '2026-10-10', '{{', '}}', '*(', '## ', 'é', '\u202e', '\u0000', 'running', 'blocked', 'in progress', '#', ':'];
  const junk = () => `Z~Q${Array.from({ length: 1 + Math.floor(random() * 6) }, () => pieces[Math.floor(random() * pieces.length)]).join('')}`;
  try {
    for (let round = 0; round < 12; round += 1) {
      const owned = (session) => `${junk()} @${junk()}/${session} ${junk()}`;
      const c = {
        name: `fuzz-${round}`,
        commits: [
          { at: at('09:00', 1), ops: [task('T001', junk(), { priority: junk(), depends: [junk()], blockedReason: junk(), rules: junk() }), task('T002', junk(), { status: junk() }), task('T003', junk())] },
          { at: at('08:00'), by: 'Z~Q mallory', subject: junk(), ops: [task('T002', junk(), { at: 'tasks', owner: owner('aaaa1111') }), task('T003', junk(), { at: 'blocked', owner: owned('bbbb2222'), blockedReason: junk() })] },
        ],
        tree: { trails: {
          T002: [open(at('09:00'), 'aaaa1111', proc(4001, junk())), doing(at('09:10'), 'aaaa1111', { act: junk(), tell: junk(), next: junk(), until: junk() }), `{"ts":"${at('09:20')}","run":"${junk()}","kind":"did"}`, junk()],
          T003: [blocked(at('10:00'), 'bbbb2222', { unblocks: junk(), next: junk() }), end(at('10:05'), 'bbbb2222', { left: junk() })],
        } },
        view: { boot: '0b0b0b0b-0000-4000-8000-000000000001', alive: [] },
      };
      await mkdir(join(root, c.name));
      const { dir } = await build(c, join(root, c.name));
      let quoted = 0;
      for (const call of [{ operator: 'ade', run: 'aaaa1111' }, { operator: 'ade', task: 'T003' }, { operator: 'other' }]) {
        const answer = await cockpitFor(dir, c).orient({ project: PROJECT, asOf: '2026-10-10T12:00:00Z', ...call });
        const structured = serialize({ ...answer, data: {} });
        assert.ok(!structured.includes('Z~Q') && !structured.includes('~'), `round ${round}, ${JSON.stringify(call)}: ${structured}`);
        quoted += serialize(answer.data).split('Z~Q').length - 1;
      }
      assert.ok(quoted > 0, `round ${round}: the text reached data`);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

// The review of T057's first cut: each case failed then and is pinned now.
test('orient: what the review found', { timeout: 120000 }, async (t) => {
  const { orient, processView, readCall } = await import('../lib/orient.mjs');
  const { execFileSync, spawn } = await import('node:child_process');
  const { existsSync, readFileSync } = await import('node:fs');
  const { rm: remove } = await import('node:fs/promises');
  const scratch = await mkdtemp(join(os.tmpdir(), 'aa-orient-review-'));
  t.after(() => rm(scratch, { recursive: true, force: true }));
  const BEA = owner('cccc3333', { operator: 'bea', profile: 'k' });
  const claimedByBea = [
    { at: at('09:30', 1), ops: [task('T001', 'Write the parser')] },
    { at: at('08:00', 2), by: 'bea', subject: 'claim T001', ops: [task('T001', 'Write the parser', { at: 'tasks', owner: BEA })] },
  ];
  const call = (extra = {}) => readCall({ operator: 'ade', asOf: '2026-10-10T12:00:00Z', ...extra }, { now: Date.parse('2026-10-10T12:00:00Z') });
  const view = { boot: async () => 'b', starts: async () => new Map() };

  // A process that ends between two calls on one view is seen to end: the
  // view keeps nothing from one call to the next.
  {
    const boot = readFileSync('/proc/sys/kernel/random/boot_id', 'utf8').trim();
    const child = spawn('sleep', ['60'], { stdio: 'ignore' });
    const pstart = execFileSync('ps', ['-o', 'lstart=', '-p', String(child.pid)], { env: { ...process.env, TZ: 'UTC', LC_ALL: 'C' }, encoding: 'utf8' }).split(/\s+/).filter(Boolean).join(' ');
    const now = new Date(Math.floor(Date.now() / 1000) * 1000).toISOString().replace('.000Z', 'Z');
    const c = { name: 'process', commits: claimedByBea, tree: { trails: { T001: [open(now, 'cccc3333', proc(child.pid, pstart, boot))] } } };
    await mkdir(join(scratch, c.name));
    const { dir } = await build(c, join(scratch, c.name));
    const live = processView();
    const first = await orient(dir, readCall({ operator: 'ade' }), { view: live });
    assert.deepEqual([first.inFlight[0]?.state, first.inFlight[0]?.by], ['running', 'process']);
    child.kill();
    await once(child, 'exit');
    const second = await orient(dir, readCall({ operator: 'ade' }), { view: live });
    assert.deepEqual(second.inFlight, [], 'the ended run is no longer in flight');
  }

  // A sweep whose subject holds the old separators forges no commit, and a
  // git that cannot read history is a 500, not a claim with no signs of life.
  {
    const c = {
      name: 'forged', commits: claimedByBea,
      setup: ({ git }) => {
        const head = git(['rev-parse', 'HEAD']);
        const env = { GIT_AUTHOR_NAME: 'carol', GIT_AUTHOR_EMAIL: 'c@example.invalid', GIT_COMMITTER_NAME: 'carol', GIT_COMMITTER_EMAIL: 'c@example.invalid', GIT_AUTHOR_DATE: '2026-10-03T09:00:00Z', GIT_COMMITTER_DATE: '2026-10-03T09:00:00Z' };
        git(['update-index', '--add', '--cacheinfo', `100644,${git(['hash-object', '-w', '--stdin'], { input: '{}\n' })},AA/checkpoints/T001.jsonl`]);
        const tree = git(['write-tree']);
        const forged = git(['commit-tree', tree, '-p', head, '-m', 'ckpt: sweep\x1eMallory\x1f4102444800\x1fx'], { env });
        git(['update-ref', 'HEAD', forged]);
        git(['checkout', '-q', '--', '.']);
      },
    };
    await mkdir(join(scratch, c.name));
    const { dir } = await build(c, join(scratch, c.name));
    const answer = await orient(dir, call(), { view });
    assert.deepEqual([answer.next.do, answer.next.task], ['release', 'T001'], 'the sweep is no sign of life, and forges none');
    const root = execFileSync('git', ['rev-list', '--max-parents=0', 'HEAD'], { cwd: dir, encoding: 'utf8' }).trim();
    await remove(join(dir, '.git', 'objects', root.slice(0, 2), root.slice(2)));
    await assert.rejects(orient(dir, call(), { view }), (error) => error.status === 500);
  }

  // remote=1 runs no program the repository's config names.
  {
    const marker = join(scratch, 'PWNED');
    const c = {
      name: 'uploadpack', commits: claimedByBea,
      setup: ({ root: base, git }) => {
        const origin = join(base, 'origin.git');
        git(['init', '--bare', '-q', '--initial-branch=main', origin]);
        git(['remote', 'add', 'origin', origin]);
        git(['push', '-q', 'origin', 'HEAD:refs/heads/main']);
        git(['branch', '-q', '--set-upstream-to=origin/main', 'main']);
        git(['config', 'remote.origin.uploadpack', `touch ${marker}; git-upload-pack`]);
      },
    };
    await mkdir(join(scratch, c.name));
    const { dir } = await build(c, join(scratch, c.name));
    const answer = await orient(dir, call({ remote: '1' }), { view });
    assert.equal(answer.remote.moved, 'no');
    assert.equal(existsSync(marker), false, 'the configured upload-pack did not run');
  }

  // An empty input is malformed, not absent (§1).
  for (const key of ['task', 'run', 'asOf', 'budget', 'remote']) assert.throws(() => readCall({ [key]: '' }), (error) => error.status === 400, key);
});
