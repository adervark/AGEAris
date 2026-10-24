import assert from 'node:assert/strict';
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
    workspace: { _describe: async () => ({ dir, board: c.board || 'AA', linked: true }) },
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
