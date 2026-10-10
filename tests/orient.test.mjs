import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { lstat, mkdir, mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { test } from 'node:test';

import { build, bytes, canonical, clean, measure } from './orient/corpus.mjs';

// The orient corpus checked on its own (docs/ORIENT.md §11): every case
// builds, every answer is in the contract's form, and between them the cases
// cover every row, code and fixture the contract names. The two doors' runners
// (P1b, P1c) compare their answers with these.

const cases = [];
for (const name of (await readdir(new URL('./orient/cases/', import.meta.url))).filter((entry) => entry.endsWith('.mjs')).sort()) {
  const { default: list } = await import(new URL(`./orient/cases/${name}`, import.meta.url));
  for (const c of list) cases.push({ ...c, source: name });
}
const orient = await readFile(new URL('../docs/ORIENT.md', import.meta.url), 'utf8');

const ID = /^T\d{3,6}$/;
const RUN = /^[0-9A-Za-z_-]{1,12}(?:\.[0-9A-Za-z_-]{1,12}){0,2}$/;
const TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
const DOS = ['resume', 'check-unblock', 'continue', 'wait', 'release', 'stop', 'claim', 'idle'];
const REASONS = ['bound', 'not-yours', 'held-elsewhere', 'stopped-mid-act', 'blocked', 'in-progress', 'rewrite-owner', 'gate', 'expired', 'wip-full', 'ready', 'empty-backlog', 'none-ready'];
const BYS = ['end', 'until', 'process', 'clock'];
const PRIORITIES = ['urgent', 'high', 'medium', 'low'];
const FIELDS = {
  'older-board': [],
  'no-wip-limit': [],
  'live-minutes-clamped': [],
  'state-stale': [],
  'claim-expired': ['task'],
  'claim-unpushed': ['task'],
  'depends-killed': ['task', 'on'],
  'duplicate-id': ['task'],
  'uncommitted-task-change': ['task'],
  'trail-malformed': ['task', 'line', 'n'],
  'trail-unreadable': ['task'],
  'trail-truncated': ['task'],
};
const CODES = Object.keys(FIELDS);
// Each row's `do`s and rule numbers (§4).
const ROWS = {
  0: { dos: ['stop', 'resume', 'continue'], rule: [7] },
  1: { dos: ['resume'], rule: [3, 6, 8] },
  2: { dos: ['check-unblock'], rule: [8] },
  3: { dos: ['continue'], rule: [3, 8] },
  4: { dos: ['wait'], rule: [] },
  5: { dos: ['wait'], rule: [3, 6] },
  6: { dos: ['release'], rule: [4] },
  7: { dos: ['stop'], rule: [10] },
  8: { dos: ['claim'], rule: [1, 5, 12] },
  9: { dos: ['idle'], rule: [] },
};
const FIRST_REASON = { 'stopped-mid-act': 1, blocked: 2, 'in-progress': 3, gate: 4, 'held-elsewhere': 5, expired: 6, 'wip-full': 7, ready: 8, 'empty-backlog': 9, 'none-ready': 9 };
const CAPS = { title: 160, file: 200, author: 80, next: 240, act: 240, tell: 240, left: 240, blocked: 240, handoff: 480 };
// The keys a case and its parts may have, so a misspelt one cannot pass as
// a default.
const KEYS = {
  case: ['name', 'rows', 'story', 'serverOnly', 'future', 'repoName', 'board', 'yml', 'state', 'commits', 'tree', 'setup', 'view', 'call', 'answer', 'source'],
  call: ['operator', 'asOf', 'budget', 'run', 'task', 'remote'],
  view: ['boot', 'alive', 'gates'],
  alive: ['pid', 'lstart'],
  tree: ['remove', 'files', 'trails', 'links'],
  commit: ['at', 'by', 'subject', 'ops'],
};
const AT_START = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z) /;

const number = (id) => Number(id.slice(1));
const byId = (a, b) => number(a) - number(b) || (a < b ? -1 : a > b ? 1 : 0);
const rowOf = (next) => (next.rule.length === 1 && next.rule[0] === 7 ? 0 : FIRST_REASON[next.reasons[0]]);
const plus = (time, minutes) => new Date(Date.parse(time) + minutes * 60000).toISOString().replace('.000Z', 'Z');
const sorted = (list, compare) => list.every((item, index) => index === 0 || compare(list[index - 1], item) <= 0);
const only = (value, keys, where) => {
  for (const key of Object.keys(value)) assert.ok(keys.includes(key), `${where} has no key ${key}`);
};

// A value of data is well-formed, and one that ends in … was cut at its cap:
// cut to at most cap - 3 bytes at a code point, less a space, and the three
// bytes of the …, so cap - 4 to cap bytes (§7).
function checkText(value, cap, where) {
  assert.ok(typeof value === 'string' && value !== '', `${where} is a non-empty string`);
  assert.ok(value.isWellFormed(), `${where} has no lone surrogate`);
  assert.equal(clean(value, cap), value, `${where} is clean and within its cap`);
  if (value.endsWith('…')) {
    const size = Buffer.byteLength(value);
    assert.ok(size >= cap - 4 && size <= cap, `${where} ends in … at ${size} bytes, so it was not cut at its cap of ${cap}`);
  }
}

// Every time a case writes into its repository comes before asOf, unless the
// case says it tests one after.
function checkTimes(c) {
  if (c.future) return;
  const asOf = Date.parse(c.call.asOf);
  const before = (time, where) => assert.ok(Date.parse(time) <= asOf, `${where}: ${time} is after asOf`);
  for (const commit of c.commits || []) {
    if (typeof commit === 'string') { const time = AT_START.exec(commit)?.[1]; if (time) before(time, 'a commit'); continue; }
    before(commit.at, 'a commit');
  }
  for (const [id, entries] of Object.entries(c.tree?.trails || {})) {
    for (const item of entries) {
      let value = item;
      if (typeof item === 'string') { try { value = JSON.parse(item); } catch { continue; } }
      if (value && typeof value.ts === 'string' && TIME.test(value.ts)) before(value.ts, `${id}'s trail`);
    }
  }
}

// The fixtures ORIENT.md §11 names, by row.
function listedFixtures() {
  const start = orient.indexOf('Fixtures by row:');
  const section = orient.slice(start, orient.indexOf('\n## ', start));
  return section.split('\n- **').slice(1).map((item) => ({
    label: item.slice(0, item.indexOf(':**')),
    names: [...item.matchAll(/`([a-z0-9-]+)`/g)].map((match) => match[1]),
  }));
}

function checkCall(c) {
  const { call, view } = c;
  only(c, KEYS.case, 'the case');
  only(call, KEYS.call, 'call');
  only(view, KEYS.view, 'view');
  for (const process of view.alive) only(process, KEYS.alive, 'view.alive');
  if (c.tree) only(c.tree, KEYS.tree, 'tree');
  for (const commit of c.commits || []) if (typeof commit !== 'string') only(commit, KEYS.commit, 'a commit');
  assert.ok(typeof call.operator === 'string' && call.operator !== '', 'operator');
  if (call.run !== undefined) assert.match(call.run, RUN);
  if (call.task !== undefined) assert.match(call.task, ID);
  assert.match(call.asOf, TIME);
  assert.ok(Number.isInteger(call.budget) && call.budget >= 4096 && call.budget <= 65536, 'budget');
  if (call.remote !== undefined) assert.equal(typeof call.remote, 'boolean');
  assert.equal(typeof view.boot, 'string');
  for (const process of view.alive) {
    assert.ok(Number.isInteger(process.pid) && process.pid > 0, 'pid');
    assert.equal(typeof process.lstart, 'string');
  }
  assert.equal(view.gates !== undefined, Boolean(c.serverOnly), 'gates are for server-only cases');
  assert.ok(Array.isArray(c.rows) && c.rows.length && c.rows.every((row) => row in ROWS), 'rows');
  assert.ok(typeof c.story === 'string' && c.story.length > 20, 'story');
}

// The answer as §6 has it, and the structured part free of repository text.
function checkAnswer(c) {
  const { answer: a, call } = c;
  assert.equal(JSON.stringify(a), JSON.stringify(canonical(a)), 'keys in the contract\'s order');
  assert.equal(a.schema, 'aa.orient/1');
  assert.equal(a.asOf, call.asOf);
  assert.ok(['AA/', 'deaddrop/', 'pm/'].includes(a.repo.board));
  assert.equal(a.remote !== undefined, Boolean(call.remote), 'remote only when asked for');
  if (a.remote) {
    assert.ok(['yes', 'no', 'unknown'].includes(a.remote.moved));
    assert.equal(a.remote.checkedAt, a.asOf);
  }
  const board = a.repo.board;

  // next
  const { next } = a;
  assert.ok(DOS.includes(next.do));
  assert.ok(next.reasons.length && next.reasons.every((reason) => REASONS.includes(reason)), 'reasons');
  const row = rowOf(next);
  assert.ok(c.rows.includes(row), `next is row ${row}, not among the case's rows`);
  assert.ok(ROWS[row].dos.includes(next.do), `row ${row} does not ${next.do}`);
  assert.deepEqual(next.rule, ROWS[row].rule, 'rule numbers');
  if (next.task !== undefined) assert.match(next.task, ID);
  assert.equal(next.task !== undefined, !['idle'].includes(next.do) && !(next.do === 'stop' && row === 7), 'next names a task');
  if (call.task) assert.equal(next.task, call.task, 'row 0 answers for the bound task');
  if (next.run !== undefined) {
    assert.match(next.run, RUN);
    assert.ok(BYS.includes(next.by) && TIME.test(next.since), 'a named run has by and since');
  } else assert.equal(next.by, undefined);
  if (next.since !== undefined) assert.match(next.since, TIME);
  if (next.do === 'resume') {
    assert.equal(next.verify, 'tell');
    assert.ok(['process', 'clock'].includes(next.by), 'a stopped run is closed by its process or the clock');
    assert.equal(next.until, undefined, 'a closed run has no until');
  } else assert.equal(next.verify, undefined);
  if (next.run && next.do !== 'resume') {
    assert.ok(['until', 'process', 'clock'].includes(next.by), 'a holder is running');
    assert.equal(next.until !== undefined, next.by !== 'process', 'until is known unless a process decides');
    if (next.by === 'clock') assert.equal(next.until, plus(next.since, a.rules.liveMinutes));
  }
  if (next.reasons.includes('rewrite-owner')) assert.deepEqual(next.reasons, ['in-progress', 'rewrite-owner']);
  // The run next names is in inFlight as next describes it, unless inFlight
  // was cut; a holder is the run you names.
  if (next.run !== undefined) {
    const flight = a.inFlight.find((item) => item.task === next.task && item.run === next.run);
    if (flight) {
      assert.deepEqual([flight.state, flight.by, flight.since, flight.until], [next.do === 'resume' ? 'closed' : 'running', next.by, next.since, next.until], 'next and inFlight describe its run alike');
    } else assert.ok(a.cut?.inFlight, `next's run ${next.run} is in inFlight`);
    const held = a.you.find((item) => item.task === next.task);
    if (next.do !== 'resume' && held) assert.equal(held.heldBy, next.run, 'next names the holder you names');
  }
  for (const item of a.you.filter((entry) => entry.heldBy)) {
    const flight = a.inFlight.find((entry) => entry.task === item.task && entry.run === item.heldBy);
    assert.ok(flight ? flight.state === 'running' : a.cut?.inFlight, `${item.task}'s holder is a running run in inFlight`);
  }

  // rules
  const { wip } = a.rules;
  for (const key of ['used', 'limit', 'blocked', 'blockedLimit']) assert.ok(Number.isInteger(wip[key]) && wip[key] >= 0, `rules.wip.${key}`);
  assert.ok(wip.blocked <= wip.used);
  assert.ok(Number.isInteger(a.rules.staleHours) && a.rules.staleHours >= 1 && a.rules.staleHours <= 8760);
  assert.ok(Number.isInteger(a.rules.liveMinutes) && a.rules.liveMinutes >= 1 && a.rules.liveMinutes < a.rules.staleHours * 60);
  assert.ok(a.rules.notReady.length <= 20 && a.rules.notReady.every((id) => ID.test(id)) && sorted(a.rules.notReady, byId), 'notReady');

  // you, inFlight, take
  assert.ok(a.you.length <= 10 && sorted(a.you.map((item) => item.task), byId), 'you, by id');
  for (const item of a.you) {
    assert.match(item.task, ID);
    assert.ok(['in_progress', 'blocked'].includes(item.column));
    if (item.heldBy !== undefined) assert.match(item.heldBy, RUN);
  }
  assert.ok(a.inFlight.length <= 10, 'inFlight cap');
  for (const item of a.inFlight) {
    assert.match(item.task, ID);
    assert.match(item.run, RUN);
    assert.ok(['open', 'did', 'doing', 'blocked'].includes(item.kind));
    assert.match(item.since, TIME);
    assert.ok(['running', 'closed'].includes(item.state));
    if (item.state === 'closed') assert.equal(item.kind, 'doing', 'a closed run is in flight only when it stopped mid-act');
    assert.ok(item.state === 'running' ? ['until', 'process', 'clock'].includes(item.by) : ['process', 'clock'].includes(item.by));
    assert.equal(item.until !== undefined, item.state === 'running' && item.by !== 'process', 'inFlight until');
    if (item.until) assert.match(item.until, TIME);
    if (item.state === 'running' && item.by === 'clock') assert.equal(item.until, plus(item.since, a.rules.liveMinutes));
    if (item.by === 'until') assert.ok(Date.parse(item.until) > Date.parse(a.asOf) && Date.parse(item.until) <= Date.parse(item.since) + a.rules.staleHours * 3600000);
  }
  const flightOrder = (x, y) => (x.state === y.state ? 0 : x.state === 'running' ? -1 : 1) || byId(x.task, y.task) || (x.run < y.run ? -1 : x.run > y.run ? 1 : 0);
  assert.ok(sorted(a.inFlight, flightOrder), 'inFlight: running first, then by task, then by run');
  assert.ok(a.take.length <= 10, 'take cap');
  for (const item of a.take) {
    assert.match(item.task, ID);
    if (item.priority !== undefined) assert.ok(PRIORITIES.includes(item.priority));
    assert.ok(Number.isInteger(item.unblocks) && item.unblocks >= 0);
  }
  const rank = (item) => (item.priority ? PRIORITIES.indexOf(item.priority) : 4);
  assert.ok(sorted(a.take, (x, y) => rank(x) - rank(y) || y.unblocks - x.unblocks || byId(x.task, y.task)), 'take by rank');
  if (next.do === 'claim') assert.equal(next.task, a.take[0]?.task, 'claim takes the first by rank');

  // warnings
  assert.ok(a.warnings.length <= 10, 'warnings cap');
  for (const warning of a.warnings) {
    assert.ok(CODES.includes(warning.code), warning.code);
    assert.deepEqual(Object.keys(warning).slice(1), FIELDS[warning.code], `${warning.code}'s fields`);
    for (const key of ['task', 'on']) if (warning[key] !== undefined) assert.match(warning[key], ID);
    for (const key of ['line', 'n']) if (warning[key] !== undefined) assert.ok(Number.isInteger(warning[key]) && warning[key] > 0);
  }
  const warningOrder = (x, y) => CODES.indexOf(x.code) - CODES.indexOf(y.code) || (x.task && y.task ? byId(x.task, y.task) : 0) || (x.on && y.on ? byId(x.on, y.on) : 0);
  assert.ok(sorted(a.warnings, warningOrder), 'warnings in the order of the table');
  if (a.warnings.some((warning) => warning.code === 'no-wip-limit')) assert.equal(wip.limit, 0);
  for (const warning of a.warnings.filter((item) => item.code === 'claim-expired')) assert.notEqual(warning.task, next.task, 'an expired claim next names is not also warned of');

  // more
  const trail = `${board}ckpt.sh live ${next.task}`;
  if (next.task) {
    assert.equal(a.more.trail, trail);
    if (a.more.task !== undefined) assert.match(a.more.task, new RegExp(`^${board}(?:backlog|tasks|tasks/done)/${next.task}-\\*\\.md$`));
  } else assert.deepEqual(Object.keys(a.more), ['board']);
  assert.equal(a.more.board, `${board}board.sh`);

  // data: repository text, cleaned and capped, in the order §6 gives
  const { data } = a;
  if (data.repo) checkText(data.repo.name, 80, 'data.repo.name');
  if (data.spend) {
    assert.ok(data.spend.length >= 1 && data.spend.length <= 10, 'spend');
    data.spend.forEach((word, index) => checkText(word, 40, `data.spend[${index}]`));
  }
  if (data.now) {
    checkText(data.now.text, 1024, 'data.now.text');
    assert.equal(data.now.file, `${board}STATE.md`);
  }
  const expected = [...new Set([next.task, ...a.you.map((item) => item.task), ...a.take.map((item) => item.task)].filter(Boolean))];
  const tasks = Object.keys(data).filter((key) => ID.test(key));
  assert.deepEqual(tasks, expected.slice(0, tasks.length), 'data: next\'s task, then you\'s, then take\'s');
  for (const id of tasks) {
    const entry = data[id];
    const head = ['title', 'file', 'author'].filter((key) => key in entry);
    assert.ok(head.length === 0 || head.length === 3, `data.${id} has its title, file and author together, or none of them`);
    for (const [key, value] of Object.entries(entry)) checkText(value, CAPS[key], `data.${id}.${key}`);
    if (id !== next.task) assert.deepEqual(Object.keys(entry).filter((key) => !['title', 'file', 'author', 'next'].includes(key)), [], `data.${id} carries only title, file, author and next`);
    if (entry.handoff) assert.ok(a.you.some((item) => item.task === id), 'a handoff only for a task the caller holds');
    if (entry.blocked) assert.equal(next.do, 'check-unblock');
  }
  // cut, and the budget
  if (a.cut) {
    for (const [key, value] of Object.entries(a.cut)) assert.ok(Number.isInteger(value) && value > 0, `cut.${key}`);
  }
  assert.ok(measure(a) <= call.budget, `${measure(a)} bytes over the budget of ${call.budget}`);
}

test('orient corpus: the fixtures ORIENT.md names are the cases, each once, under its rows', () => {
  const names = cases.map((c) => c.name);
  assert.equal(new Set(names).size, names.length, 'case names are unique');
  const listed = listedFixtures();
  const all = listed.flatMap((group) => group.names);
  assert.equal(new Set(all).size, all.length, 'ORIENT.md names each fixture once');
  assert.deepEqual([...all].sort(), [...names].sort(), 'ORIENT.md §11 and tests/orient/cases name the same fixtures');
  for (const { label, names: fixtures } of listed) {
    if (!/^\d$/.test(label)) continue;
    for (const name of fixtures) assert.ok(cases.find((c) => c.name === name).rows.includes(Number(label)), `${name} is listed under row ${label}`);
  }
});

test('orient corpus: every row, do, reason, state, code and column has a case', () => {
  const answers = cases.map((c) => c.answer);
  const seen = (values) => new Set(values.flat());
  assert.deepEqual([...seen(cases.map((c) => c.rows))].sort(), Object.keys(ROWS).map(Number), 'rows');
  for (const value of DOS) assert.ok(seen(answers.map((a) => a.next.do)).has(value), `do ${value}`);
  for (const value of REASONS) assert.ok(seen(answers.map((a) => a.next.reasons)).has(value), `reason ${value}`);
  for (const value of ['until', 'process', 'clock']) {
    assert.ok(seen(answers.map((a) => a.next.by ?? [])).has(value), `next by ${value}`);
    assert.ok(seen(answers.map((a) => a.inFlight.map((item) => item.by))).has(value), `inFlight by ${value}`);
  }
  for (const value of ['running', 'closed']) assert.ok(seen(answers.map((a) => a.inFlight.map((item) => item.state))).has(value), `inFlight ${value}`);
  for (const value of ['open', 'did', 'doing', 'blocked']) assert.ok(seen(answers.map((a) => a.inFlight.map((item) => item.kind))).has(value), `inFlight kind ${value}`);
  for (const value of CODES) assert.ok(seen(answers.map((a) => a.warnings.map((item) => item.code))).has(value), `warning ${value}`);
  for (const value of ['in_progress', 'blocked']) assert.ok(seen(answers.map((a) => a.you.map((item) => item.column))).has(value), `column ${value}`);
  for (const value of PRIORITIES) assert.ok(seen(answers.map((a) => a.take.map((item) => item.priority ?? []))).has(value), `priority ${value}`);
  for (const value of ['yes', 'no', 'unknown']) assert.ok(seen(answers.map((a) => a.remote?.moved ?? [])).has(value), `remote ${value}`);
  for (const value of ['AA/', 'deaddrop/']) assert.ok(seen(answers.map((a) => a.repo.board)).has(value), `board ${value}`);
  for (const value of ['inFlight', 'warnings', 'notReady', 'you', 'take', 'spend', 'data']) assert.ok(answers.some((a) => a.cut?.[value]), `cut ${value}`);
});

test('orient corpus: every answer is in the contract\'s form, within its caps and budget', () => {
  for (const c of cases) {
    try {
      checkCall(c);
      checkTimes(c);
      checkAnswer(c);
    } catch (error) {
      error.message = `${c.name} (${c.source}): ${error.message}`;
      throw error;
    }
  }
});

test('orient corpus: the part of an answer that is never cut fits the least budget', () => {
  // Each field at its longest, and several that never occur together:
  // the bound holds for any board with ids of six digits and counts and line
  // numbers of seven (§8).
  const id = 'T999999';
  const run = 'abcdefghijkl.abcdefghijkl.abcdefghijkl';
  const time = '2026-10-10T12:00:00Z';
  const big = 9999999;
  const worst = {
    schema: 'aa.orient/1',
    asOf: time,
    repo: { head: 'f'.repeat(40), board: 'deaddrop/', door: 'board.sh' },
    remote: { moved: 'unknown', checkedAt: time },
    next: { do: 'check-unblock', task: id, run, by: 'process', since: time, until: time, verify: 'tell', reasons: ['in-progress', 'rewrite-owner'], rule: [1, 5, 12] },
    rules: { wip: { used: big, limit: 9999, blocked: big, blockedLimit: 9999 }, staleHours: 8760, liveMinutes: 525599, notReady: Array(20).fill(id) },
    you: [],
    inFlight: Array(10).fill({ task: id, run, kind: 'blocked', since: time, state: 'running', by: 'process', until: time }),
    take: [],
    warnings: Array(10).fill({ code: 'uncommitted-task-change', task: id, on: id, line: big, n: big }),
    data: {},
    more: { trail: `deaddrop/ckpt.sh live ${id}`, task: `deaddrop/tasks/done/${id}-*.md`, board: 'deaddrop/board.sh' },
    cut: { inFlight: big, warnings: big, notReady: big, you: big, take: big, spend: big, data: big },
  };
  const size = Buffer.byteLength(JSON.stringify(canonical(worst)));
  assert.ok(size <= 4096, `the uncut part can reach ${size} bytes`);
});

test('orient corpus: every case builds, and data names the files and authors git has', { timeout: 300000 }, async () => {
  const root = await mkdtemp(join(tmpdir(), 'aa-orient-'));
  // Paths are read unquoted, as a door must read them, multi-byte ones too.
  const git = (dir, args) => execFileSync('git', ['--no-optional-locks', '-c', 'core.quotePath=false', ...args], { cwd: dir, encoding: 'utf8', env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' } }).trim();
  // Every worker runs to its end and keeps its failures, so the temporary
  // directory is removed only once nothing writes to it.
  const failures = [];
  try {
    const queue = [...cases];
    const work = async () => {
      for (let c = queue.shift(); c; c = queue.shift()) {
        try {
          const caseRoot = join(root, c.name);
          await mkdir(caseRoot);
          const { dir, head } = await build(c, caseRoot);
          assert.match(head, /^[0-9a-f]{40}$/);
          const board = c.answer.repo.board;
          // Task files are regular files at HEAD: a committed symbolic link is not one.
          const atHead = git(dir, ['ls-tree', '-r', '-z', 'HEAD', '--', board]).split('\0').filter(Boolean)
            .map((record) => ({ mode: record.slice(0, record.indexOf(' ')), path: record.slice(record.indexOf('\t') + 1) }))
            .filter((item) => item.mode === '100644' || item.mode === '100755')
            .map((item) => item.path);
          const filesOf = (id) => atHead.filter((path) => /^[^/]+\/(?:backlog|tasks|tasks\/done)\/[^/]+$/.test(path) && path.split('/').at(-1).startsWith(`${id}-`));
          if (c.answer.data.repo) assert.equal(clean(basename(dir), 80), c.answer.data.repo.name, 'data.repo.name');
          for (const [id, entry] of Object.entries(c.answer.data).filter(([key]) => ID.test(key))) {
            const files = filesOf(id);
            if (files.length !== 1) {
              assert.ok(!('title' in entry) && !('file' in entry) && !('author' in entry), `data.${id}: with ${files.length} files at HEAD, no title, file or author`);
              continue;
            }
            assert.equal(clean(files[0], 200), entry.file, `data.${id}.file is its one file at HEAD`);
            assert.equal(clean(git(dir, ['log', '-1', '--format=%an', 'HEAD', '--', files[0]]), 80), entry.author, `data.${id}.author`);
            assert.ok(entry.title, `data.${id} has a title`);
          }
          // A trail is over 1 MiB exactly when it is warned of as truncated.
          if (!c.answer.cut?.warnings) {
            const truncated = new Set(c.answer.warnings.filter((item) => item.code === 'trail-truncated').map((item) => item.task));
            const folder = join(dir, board, 'checkpoints');
            for (const name of await readdir(folder).catch(() => [])) {
              const id = /^(T\d{3,6})\.jsonl$/.exec(name)?.[1];
              const stats = id && await lstat(join(folder, name));
              if (!stats?.isFile()) continue;
              assert.equal(stats.size > 1048576, truncated.has(id), `${id}'s trail of ${stats.size} bytes, and its trail-truncated warning`);
            }
          }
          for (const item of c.answer.you) assert.ok(filesOf(item.task).some((path) => path.startsWith(`${board}tasks/`) && !path.startsWith(`${board}tasks/done/`)), `you: ${item.task} is in tasks/`);
          for (const item of c.answer.take) assert.equal(filesOf(item.task).length, 1, `take: ${item.task} has one file`);
          const { next, more } = c.answer;
          if (next.task) {
            const files = filesOf(next.task);
            assert.equal(more.task !== undefined, files.length === 1, 'more.task when next\'s task has one file');
            if (more.task) assert.equal(more.task, `${files[0].slice(0, files[0].lastIndexOf('/'))}/${next.task}-*.md`);
          }
          const text = bytes(c.answer, head);
          assert.equal(JSON.parse(text).repo.head, head);
          assert.ok(!text.endsWith('\n'));
        } catch (error) {
          failures.push(`${c.name}: ${error.message}`);
        }
      }
    };
    await Promise.all(Array.from({ length: 6 }, work));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
  assert.deepEqual(failures, []);
});

test('orient corpus: repository text is cleaned and capped as §7 says', () => {
  const cp = (...points) => String.fromCodePoint(...points);
  assert.equal(clean(`a\tb\nc\r\nd${cp(0x0b, 0x0c, 0x85, 0x2028, 0x2029)}e`), 'a b c d e');
  assert.equal(clean(`x${cp(0x00, 0x07, 0x1f, 0x7f, 0x80, 0x9f)}y`), 'xy');
  assert.equal(clean(`l${cp(0x061c, 0x200e, 0x200f, 0x202a, 0x202e, 0x2066, 0x2069)}r`), 'lr');
  assert.equal(clean(`  two   spaces  `), 'two spaces');
  assert.equal(clean('abcdefghij', 8), 'abcde…');
  assert.equal(clean('abcd fghij', 8), 'abcd…', 'a space before the ellipsis is dropped');
  assert.equal(clean('abcdefgh', 8), 'abcdefgh', 'a value at its cap is kept whole');
  assert.equal(clean(cp(0x1f600).repeat(3), 10), `${cp(0x1f600)}…`, 'cut at a code point');
  assert.equal(clean(cp(0xe9).repeat(3), 6), cp(0xe9).repeat(3), 'six bytes at a cap of six');
  assert.equal(clean(cp(0xe9).repeat(4), 6), `${cp(0xe9)}…`);
});
