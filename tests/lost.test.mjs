import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';

import { fabricate } from '../lib/fabricate.mjs';
import { lostAgents } from '../lib/lost.mjs';

// The lost-agent measures (docs/METRICS.md § "The lost-agent measures"), each
// on a fabricated repository that holds what it counts and what it must not.

const exec = promisify(execFile);
const temporaryDirectories = new Set();
const EPOCH = Date.parse('2026-09-01T00:00:00+01:00');
const AS_OF = '2026-09-20T00:00:00Z';

test.after(async () => {
  await Promise.all([...temporaryDirectories].map((directory) => rm(directory, { recursive: true, force: true })));
});

async function fabricated(script) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'agearis-lost-'));
  temporaryDirectories.add(directory);
  return (await fabricate(path.join(directory, 'repo'), script)).dir;
}

// A fabricated `day <n> <HH:MM>` as a trail's UTC time.
function ts(day, clock) {
  const [hours, minutes] = clock.split(':').map(Number);
  return new Date(EPOCH + day * 86400000 + (hours * 60 + minutes) * 60000).toISOString().replace('.000Z', 'Z');
}

// One trail line, appended verbatim by a `ckpt … raw` operation.
function line(task, day, clock, run, kind, fields = {}) {
  return `ckpt ${task} raw ${JSON.stringify(JSON.stringify({ ts: ts(day, clock), run, kind, ...fields, ...(kind === 'open' ? {} : { next: 'go on' }) }))}`;
}

const claim = (operator, session) => JSON.stringify({ owner: `${operator} @k/${session} 2026-09-02 — working` });

test('(a) counts a doing that repeats another run\'s unanswered act, once, and nothing else', async () => {
  const dir = await fabricated(`
day 0 08:00 ade: create T001 backlog "Repeat"
+ create T002 backlog "Reaped"
+ create T003 backlog "Same run"
+ create T004 backlog "What"
+ create T005 backlog "No act"
+ create T006 backlog "Subagent"
day 1 09:00 ade: move T001 tasks ${claim('ade', 'aaaa1111')}
day 1 09:05 ade: ${line('T001', 1, '09:05', 'aaaa1111', 'open', { operator: 'ade' })}
+ ${line('T001', 1, '09:06', 'aaaa1111', 'doing', { act: 'train fold 0' })}
day 1 12:00 ade: ${line('T001', 1, '12:00', 'bbbb2222', 'open', { operator: 'ade' })}
+ ${line('T001', 1, '12:01', 'bbbb2222', 'doing', { act: '  train   fold 0 ' })}
+ ${line('T001', 1, '12:02', 'cccc3333', 'doing', { act: 'train fold 0' })}
day 1 13:00 ade: ${line('T002', 1, '13:00', 'aaaa1111', 'doing', { act: 'migrate' })}
+ ${line('T002', 1, '15:00', 'aaaa1111', 'end', { left: 'reaped: the act had stopped' })}
+ ${line('T002', 1, '15:01', 'bbbb2222', 'doing', { act: 'migrate' })}
day 1 16:00 ade: ${line('T003', 1, '16:00', 'aaaa1111', 'doing', { act: 'build' })}
+ ${line('T003', 1, '16:30', 'aaaa1111', 'doing', { act: 'build' })}
day 1 17:00 ade: ${line('T004', 1, '17:00', 'aaaa1111', 'doing', { what: 'push the kernel' })}
+ ${line('T004', 1, '17:30', 'bbbb2222', 'doing', { act: 'push the kernel' })}
day 1 18:00 ade: ${line('T005', 1, '18:00', 'aaaa1111', 'doing', { key: 'act=nothing a reader can compare' })}
+ ${line('T005', 1, '18:30', 'bbbb2222', 'doing', { key: 'act=nothing a reader can compare' })}
day 1 19:00 ade: ${line('T006', 1, '19:00', 'aaaa1111', 'doing', { act: 'spawn the reviewer' })}
+ ${line('T006', 1, '19:01', 'aaaa1111.c0de', 'doing', { act: 'spawn the reviewer' })}
`);
  const { a, read } = await lostAgents(dir, { asOf: AS_OF });
  // T001 counts once for bbbb2222 and once for cccc3333; T002's act was
  // answered by the reaping end; T003 is one run; T004 matches through what.
  assert.deepEqual(a.items.map((item) => [item.task, item.earlier.run, item.run, item.sameFamily]), [
    ['T001', 'aaaa1111', 'bbbb2222', false],
    ['T001', 'bbbb2222', 'cccc3333', false],
    ['T004', 'aaaa1111', 'bbbb2222', false],
    ['T006', 'aaaa1111', 'aaaa1111.c0de', true],
  ]);
  assert.equal(a.items[0].act, 'train fold 0');
  assert.equal(a.noAct, 2);
  assert.equal(read.runs, 12);
  assert.equal(a.runs, 12);
  assert.equal(a.per100Runs, 33.33);
  assert.equal(read.malformed, 0);
});

test('(b) counts two families writing at once and owner lines held at once on branches that diverged', async () => {
  const dir = await fabricated(`
day 0 08:00 ade: create T001 backlog "At once"
+ create T002 backlog "One after the other"
+ create T003 backlog "Reaped"
+ create T004 backlog "Resumed"
+ create T005 backlog "Two branches"
day 1 08:00 ade: move T001 tasks ${claim('ade', 'aaaa1111')}
day 1 10:00 ade: ${line('T001', 1, '10:00', 'aaaa1111', 'open', { operator: 'ade' })}
+ ${line('T001', 1, '10:20', 'bbbb2222', 'did', { what: 'a second session, at once' })}
+ ${line('T001', 1, '11:00', 'aaaa1111', 'did', { what: 'the first session, still writing' })}
day 1 12:00 ade: ${line('T002', 1, '12:00', 'aaaa1111', 'open', { operator: 'ade' })}
+ ${line('T002', 1, '12:30', 'aaaa1111', 'did', { what: 'one' })}
+ ${line('T002', 1, '13:00', 'bbbb2222', 'open', { operator: 'ade' })}
+ ${line('T002', 1, '13:30', 'bbbb2222', 'did', { what: 'two' })}
day 1 14:00 ade: ${line('T003', 1, '14:00', 'aaaa1111', 'doing', { act: 'a fold' })}
+ ${line('T003', 1, '15:00', 'bbbb2222', 'open', { operator: 'ade' })}
+ ${line('T003', 1, '15:05', 'aaaa1111', 'end', { left: 'reaped' })}
+ ${line('T003', 1, '15:30', 'bbbb2222', 'did', { what: 'resumed the fold' })}
day 2 10:00 ade: ${line('T004', 2, '10:00', 'aaaa1111', 'open', { operator: 'ade', boot: 'b1', pid: 100, pstart: 'Wed Sep  2 08:59:00 2026' })}
+ ${line('T004', 2, '10:10', 'aaaa1111', 'did', { what: 'before the crash' })}
+ ${line('T004', 2, '11:00', 'bbbb2222', 'open', { operator: 'ade' })}
+ ${line('T004', 2, '11:30', 'bbbb2222', 'did', { what: 'meanwhile' })}
+ ${line('T004', 2, '12:00', 'aaaa1111', 'did', { what: 'resumed in a new process', boot: 'b1', pid: 200, pstart: 'Wed Sep  2 10:59:00 2026' })}
branch other
day 3 10:00 bea: move T005 tasks ${claim('bea', 'eeee5555')}
checkout main
day 3 10:30 ade: move T005 tasks ${claim('ade', 'aaaa1111')}
day 3 10:40 ade: ${line('T005', 3, '10:40', 'aaaa1111', 'did', { what: 'mine' })}
checkout other
day 3 10:45 bea: ${line('T005', 3, '10:45', 'eeee5555', 'did', { what: 'mine too' })}
+ ${line('T005', 3, '11:15', 'eeee5555', 'did', { what: 'still mine' })}
checkout main
day 3 11:20 ade: ${line('T005', 3, '11:20', 'aaaa1111', 'did', { what: 'still mine' })}
day 3 12:00 ade: merge other
`);
  const { b, read } = await lostAgents(dir, { asOf: AS_OF });
  assert.equal(read.merges, 1);
  // T005's runs overlap too, but that pair is the owner lines' pair.
  assert.deepEqual(b.items.map((item) => [item.task, item.source, item.from, item.to]), [
    ['T005', 'owner-lines', ts(3, '10:30'), ts(3, '12:00')],
    ['T001', 'runs', ts(1, '10:20'), ts(1, '10:20')],
  ]);
  assert.deepEqual([b.items[0].a.operator, b.items[0].b.operator].sort(), ['ade', 'bea']);
  assert.deepEqual([b.overlaps, b.ownerLines, b.runs], [2, 1, 1]);
});

test('(c) counts a claim made at the WIP limit in force before it, and none on a board without one', async () => {
  const dir = await fabricated(`
day 0 08:00 ade: write AA/AA.yml "wip:\\n  in_progress: 1\\n  blocked: 1\\n"
+ create T001 backlog "One"
+ create T002 backlog "Two"
+ create T003 backlog "Three"
+ create T004 backlog "Four"
+ create T005 backlog "Five"
day 1 09:00 ade: move T001 tasks ${claim('ade', 'aaaa1111')}
day 1 10:00 ade: move T002 tasks ${claim('ade', 'aaaa1111')}
day 1 11:00 ade: move T002 backlog {"owner": "—"}
day 2 09:00 ade: move T001 done
+ move T003 tasks ${claim('ade', 'bbbb2222')}
day 2 10:00 ade: write AA/AA.yml "wip:\\n  in_progress: 2\\n"
day 2 11:00 ade: move T004 tasks ${claim('ade', 'bbbb2222')}
+ move T005 tasks ${claim('ade', 'bbbb2222')}
`);
  const { c } = await lostAgents(dir, { asOf: AS_OF });
  // T002 joins T001 at a limit of 1; T003 replaces T001 in one commit; T004
  // and T005 are claimed together at a limit of 2, beside T003.
  assert.deepEqual(c.items.map((item) => [item.task, item.wip, item.limit]), [['T002', 1, 1], ['T005', 2, 2]]);
  assert.deepEqual([c.claims, c.limited, c.noLimit], [5, 5, 0]);

  const open = await fabricated(`
day 0 08:00 ade: create T001 backlog "One"
+ create T002 backlog "Two"
day 1 09:00 ade: move T001 tasks ${claim('ade', 'aaaa1111')}
day 1 10:00 ade: move T002 tasks ${claim('ade', 'aaaa1111')}
`);
  const unlimited = (await lostAgents(open, { asOf: AS_OF })).c;
  assert.deepEqual([unlimited.items.length, unlimited.claims, unlimited.limited, unlimited.noLimit], [0, 2, 0, 2]);
  assert.deepEqual(unlimited.wipAtClaim, { median: 0, max: 1 });
});

test('(d) times a claim to the first did while it is held, from the commit that made it, branch or not', async () => {
  const dir = await fabricated(`
day 0 08:00 ade: create T001 backlog "Quick"
+ create T002 backlog "Early did"
+ create T003 backlog "Released"
+ create T004 backlog "Still held"
+ create T005 backlog "On a branch"
day 1 09:00 ade: move T001 tasks ${claim('ade', 'aaaa1111')}
day 1 09:30 ade: ${line('T001', 1, '09:30', 'aaaa1111', 'did', { what: 'first result' })}
day 1 09:50 ade: ${line('T002', 1, '09:50', 'aaaa1111', 'did', { what: 'before the claim' })}
day 1 10:00 ade: move T002 tasks ${claim('ade', 'aaaa1111')}
day 1 11:00 ade: ${line('T002', 1, '11:00', 'aaaa1111', 'did', { what: 'after the claim' })}
day 1 12:00 ade: move T003 tasks ${claim('ade', 'aaaa1111')}
day 1 13:00 ade: move T003 backlog {"owner": "—"}
day 1 14:00 ade: ${line('T003', 1, '14:00', 'aaaa1111', 'did', { what: 'after the release' })}
day 1 15:00 ade: move T004 tasks ${claim('ade', 'aaaa1111')}
branch side
day 2 09:00 ade: move T005 tasks ${claim('ade', 'bbbb2222')}
day 2 09:20 ade: ${line('T005', 2, '09:20', 'bbbb2222', 'did', { what: 'on the branch' })}
checkout main
day 2 10:00 ade: set T001 {"priority": "high"}
day 3 09:00 ade: merge side
`);
  const { d } = await lostAgents(dir, { asOf: AS_OF });
  assert.deepEqual(d.items.map((item) => [item.task, item.state, item.minutes ?? null]), [
    ['T001', 'measured', 30], ['T002', 'measured', 60], ['T003', 'no-did', null], ['T004', 'open', null], ['T005', 'measured', 20],
  ]);
  assert.equal(d.items[4].at, ts(2, '09:00'));
  assert.equal(d.items[2].left, ts(1, '13:00'));
  assert.deepEqual([d.claims, d.measured, d.noDid, d.open, d.medianMinutes, d.p85Minutes], [5, 3, 1, 1, 30, 60]);

  // A window counts what starts in it.
  const later = (await lostAgents(dir, { since: ts(2, '00:00'), asOf: AS_OF })).d;
  assert.deepEqual(later.items.map((item) => item.task), ['T005']);
});

test('a stay ends where the line that held it let it go, not where a line nobody worked on caught up', async () => {
  // As on AGEIS: claimed on main, worked on a branch that main merges, then
  // released and claimed again on the branch.
  const dir = await fabricated(`
day 0 08:00 ade: create T001 backlog "Stale main"
day 1 09:00 ade: move T001 tasks ${claim('ade', 'aaaa1111')}
branch work
day 2 09:00 ade: set T001 {"priority": "high"}
checkout main
day 2 10:00 ade: merge work
checkout work
day 3 09:00 ade: move T001 backlog {"owner": "—"}
day 4 09:00 ade: move T001 tasks ${claim('ade', 'bbbb2222')}
day 4 09:08 ade: ${line('T001', 4, '09:08', 'bbbb2222', 'did', { what: 'the second claim\'s' })}
day 4 09:10 ade: move T001 done
checkout main
day 5 09:00 ade: merge work
`);
  const { d } = await lostAgents(dir, { asOf: AS_OF });
  assert.deepEqual(d.items.map((item) => [item.at, item.left, item.state, item.minutes ?? null]), [
    [ts(1, '09:00'), ts(3, '09:00'), 'no-did', null],
    [ts(4, '09:00'), ts(4, '09:10'), 'measured', 8],
  ]);
});

test('an older board claims by status and owner: unowned work in tasks/ counts in WIP but is not claimed', async () => {
  const dir = await fabricated(`
day 0 08:00 ade: create T001 tasks "One"
+ set T001 {"status": "open"}
+ create T002 tasks "Queued"
+ set T002 {"status": "queued"}
day 1 09:00 ade: set T001 {"status": "claimed", "owner": "ade @k/aaaa1111 2026-09-02 — one"}
day 1 09:10 ade: ${line('T001', 1, '09:10', 'aaaa1111', 'did', { what: 'first result' })}
`);
  const { c, d } = await lostAgents(dir, { asOf: AS_OF });
  assert.deepEqual([c.claims, c.noLimit, c.wipAtClaim.max], [1, 1, 1]);
  assert.deepEqual(d.items.map((item) => [item.task, item.minutes]), [['T001', 10]]);
});

test('a malformed trail line is counted and skipped, and the command prints the measures as JSON', async () => {
  const dir = await fabricated(`
day 0 08:00 ade: create T001 backlog "One"
day 1 09:00 ade: ckpt T001 raw "{not json"
+ ${line('T001', 1, '09:01', 'aaaa1111', 'did', { what: 'fine' })}
`);
  const { stdout } = await exec(process.execPath, [path.join(import.meta.dirname, '..', 'lib', 'lost.mjs'), '--json', '--as-of', AS_OF, dir]);
  const [result] = JSON.parse(stdout);
  assert.equal(result.schema, 'aa.lost/1');
  assert.equal(result.dir, dir);
  assert.deepEqual([result.read.lines, result.read.malformed, result.read.runs], [2, 1, 1]);
  await assert.rejects(exec(process.execPath, [path.join(import.meta.dirname, '..', 'lib', 'lost.mjs'), '--since', 'yesterday', dir]), (error) => error.code === 2);
});
