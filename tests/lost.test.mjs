import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { appendFile, mkdtemp, rm } from 'node:fs/promises';
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
+ create T007 backlog "Answered"
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
day 1 20:00 ade: ${line('T007', 1, '20:00', 'aaaa1111', 'doing', { act: 'compile' })}
+ ${line('T007', 1, '20:10', 'aaaa1111', 'did', { what: 'compiled' })}
+ ${line('T007', 1, '20:30', 'bbbb2222', 'doing', { act: 'compile' })}
`);
  const { a, read } = await lostAgents(dir, { asOf: AS_OF });
  // T001 counts once for bbbb2222 and once for cccc3333; T002's act was
  // answered by the reaping end, T007's by a did; T003 is one run; T004
  // matches through what.
  assert.deepEqual(a.items.map((item) => [item.task, item.earlier.run, item.run, item.sameFamily]), [
    ['T001', 'aaaa1111', 'bbbb2222', false],
    ['T001', 'bbbb2222', 'cccc3333', false],
    ['T004', 'aaaa1111', 'bbbb2222', false],
    ['T006', 'aaaa1111', 'aaaa1111.c0de', true],
  ]);
  assert.equal(a.items[0].act, 'train fold 0');
  assert.equal(a.noAct, 2);
  assert.equal(read.runs, 14);
  assert.equal(a.runs, 14);
  assert.equal(a.per100Runs, 28.57);
  assert.equal(read.malformed, 0);
});

test('(b) counts two families writing at once and owner lines held at once on branches that diverged', async () => {
  const dir = await fabricated(`
day 0 08:00 ade: create T001 backlog "At once"
+ create T002 backlog "One after the other"
+ create T003 backlog "Reaped"
+ create T004 backlog "Resumed"
+ create T005 backlog "Two branches"
+ create T006 backlog "Handed back"
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
day 4 10:00 ade: ${line('T006', 4, '10:00', 'aaaa1111', 'open', { operator: 'ade', boot: 'b1', pid: 300, pstart: 'Sat Sep  5 08:59:00 2026' })}
+ ${line('T006', 4, '10:10', 'aaaa1111', 'did', { what: 'first part' })}
+ ${line('T006', 4, '10:30', 'aaaa1111', 'end', { left: 'handed over' })}
+ ${line('T006', 4, '12:00', 'bbbb2222', 'open', { operator: 'ade' })}
+ ${line('T006', 4, '12:10', 'bbbb2222', 'did', { what: 'second part' })}
+ ${line('T006', 4, '12:30', 'bbbb2222', 'end', { left: 'handed back' })}
+ ${line('T006', 4, '15:00', 'aaaa1111', 'open', { operator: 'ade', boot: 'b1', pid: 300, pstart: 'Sat Sep  5 08:59:00 2026' })}
+ ${line('T006', 4, '15:10', 'aaaa1111', 'did', { what: 'third part' })}
`);
  const { b, read } = await lostAgents(dir, { asOf: AS_OF });
  assert.equal(read.merges, 1);
  // T005's runs overlap too, but that pair is the owner lines' pair. T006's
  // first run ended before the second began, and opened again after it ended.
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

test('(c) takes a commit\'s claims in numeric id order, keeps a renamed board\'s limit, and gives WIP at a claim for claims with no limit', async () => {
  const together = await fabricated(`
day 0 08:00 ade: write AA/AA.yml "wip:\\n  in_progress: 2\\n"
+ create T005 backlog "Five"
+ create T999 backlog "Nine nine nine"
+ create T1000 backlog "One thousand"
day 1 09:00 ade: move T005 blocked ${claim('ade', 'aaaa1111')}
day 1 10:00 ade: move T999 tasks ${claim('ade', 'bbbb2222')}
+ move T1000 tasks ${claim('ade', 'bbbb2222')}
`);
  // T999 comes before T1000, as orient orders ids, so T1000 is the one over.
  assert.deepEqual((await lostAgents(together, { asOf: AS_OF })).c.items.map((item) => [item.task, item.wip, item.limit]), [['T1000', 2, 2]]);

  // The commit that moves the board to AA/ also raises the limit; the claim it
  // makes is held to the limit before it, under the board's old name.
  const task = (id, status, owner) => `"---\\nid: ${id}\\ntitle: \\"x\\"\\nstatus: ${status}\\nowner: ${owner}\\n---\\n\\n# ${id} — x\\n"`;
  const renamed = await fabricated(`
day 0 08:00 ade: write deaddrop/deaddrop.yml "wip:\\n  in_progress: 1\\n"
+ write deaddrop/backlog/T001-x.md ${task('T001', 'open', '—')}
+ write deaddrop/tasks/T002-y.md ${task('T002', 'claimed', 'ade @k/aaaa1111 2026-09-02 — w')}
day 1 09:00 ade: delete deaddrop/deaddrop.yml
+ delete deaddrop/backlog/T001-x.md
+ delete deaddrop/tasks/T002-y.md
+ write AA/AA.yml "wip:\\n  in_progress: 9\\n"
+ write AA/tasks/T002-y.md ${task('T002', 'claimed', 'ade @k/aaaa1111 2026-09-02 — w')}
+ write AA/tasks/T001-x.md ${task('T001', 'claimed', 'ade @k/bbbb2222 2026-09-02 — w')}
`);
  const moved = (await lostAgents(renamed, { asOf: AS_OF })).c;
  assert.deepEqual(moved.items.map((item) => [item.task, item.wip, item.limit]), [['T001', 1, 1]]);

  // A commit that deletes one board's settings and claims on another board
  // that has none renames nothing: the claim has no limit.
  const dropped = await fabricated(`
day 0 08:00 ade: write AA/AA.yml "wip:\\n  in_progress: 1\\n"
+ create T001 backlog "Held"
day 1 09:00 ade: move T001 tasks ${claim('ade', 'aaaa1111')}
day 2 09:00 ade: delete AA/AA.yml
+ write pm/tasks/T002-b.md ${task('T002', 'claimed', 'bea @k/bbbb2222 2026-09-02 — w')}
`);
  const elsewhere = (await lostAgents(dropped, { asOf: AS_OF })).c;
  assert.deepEqual([elsewhere.items, elsewhere.limited, elsewhere.noLimit], [[], 1, 1]);

  // T001 and T003 are claimed with no limit set, at WIP 1 and 2; T004 is
  // claimed over the limit that comes after them.
  const mixed = await fabricated(`
day 0 08:00 ade: write pm/tasks/T001-a.md ${task('T001', 'open', 'ade @k/aaaa1111 2026-09-02 — w')}
+ write pm/tasks/T002-b.md ${task('T002', 'queued', '—')}
day 1 09:00 ade: write pm/tasks/T001-a.md ${task('T001', 'claimed', 'ade @k/aaaa1111 2026-09-02 — w')}
day 1 10:00 ade: write pm/tasks/T003-c.md ${task('T003', 'open', 'ade @k/bbbb2222 2026-09-02 — w')}
day 2 09:00 ade: write pm/deaddrop.yml "wip:\\n  in_progress: 2\\n"
day 2 10:00 ade: write pm/tasks/T004-d.md ${task('T004', 'claimed', 'ade @k/cccc3333 2026-09-02 — w')}
`);
  const both = (await lostAgents(mixed, { asOf: AS_OF })).c;
  assert.deepEqual(both.items.map((item) => [item.task, item.wip, item.limit]), [['T004', 3, 2]]);
  assert.deepEqual([both.claims, both.limited, both.noLimit], [3, 1, 2]);
  assert.deepEqual(both.wipAtClaim, { median: 1, max: 2 });
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
  // Nothing after --as-of counts: at 13:30, T003's trail has not begun.
  const early = (await lostAgents(dir, { asOf: ts(1, '13:30') })).d;
  assert.deepEqual(early.items.map((item) => [item.task, item.state, item.trail]), [['T001', 'measured', true], ['T002', 'measured', true], ['T003', 'no-did', false]]);
  assert.equal(early.withTrail, 2);
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

test('a merge goes on with the hold that no line has ended, whether or not the task is held at HEAD', async () => {
  // The branch releases and claims the task again; main, which never saw the
  // release, still holds the first claim when it merges the branch.
  const history = `
day 0 08:00 ade: create T001 backlog "Stale main"
day 1 09:00 ade: move T001 tasks ${claim('ade', 'aaaa1111')}
branch work
day 2 09:00 ade: set T001 {"priority": "high"}
checkout main
day 2 10:00 ade: merge work
checkout work
day 3 09:00 ade: move T001 backlog {"owner": "—"}
day 4 09:00 ade: move T001 tasks ${claim('ade', 'bbbb2222')}`;
  const held = await fabricated(`${history}
day 4 09:08 ade: ${line('T001', 4, '09:08', 'bbbb2222', 'did', { what: 'the second claim\'s' })}
checkout main
day 5 09:00 ade: merge work
`);
  assert.deepEqual((await lostAgents(held, { asOf: AS_OF })).d.items.map((item) => [item.at, item.left, item.state, item.minutes ?? null]), [
    [ts(1, '09:00'), ts(3, '09:00'), 'no-did', null],
    [ts(4, '09:00'), null, 'measured', 8],
  ]);
  const done = await fabricated(`${history}
checkout main
day 5 09:00 ade: merge work
day 5 10:00 ade: ${line('T001', 5, '10:00', 'bbbb2222', 'did', { what: 'after the merge' })}
day 6 09:00 ade: move T001 done
`);
  assert.deepEqual((await lostAgents(done, { asOf: AS_OF })).d.items.map((item) => [item.at, item.left, item.state, item.minutes ?? null]), [
    [ts(1, '09:00'), ts(3, '09:00'), 'no-did', null],
    [ts(4, '09:00'), ts(6, '09:00'), 'measured', 1500],
  ]);

  // A third line released main's claim on day 3 and is merged only after
  // main merges the second claim on day 4: the merge goes on with the second.
  const third = await fabricated(`
day 0 08:00 ade: create T001 backlog "Three lines"
branch side
checkout main
day 1 09:00 ade: move T001 tasks ${claim('ade', 'aaaa1111')}
branch x
day 3 09:00 ade: move T001 backlog {"owner": "—"}
checkout side
day 2 09:00 ade: move T001 tasks ${claim('ade', 'bbbb2222')}
checkout main
day 4 09:00 ade: merge side
day 5 09:00 ade: ${line('T001', 5, '09:00', 'bbbb2222', 'did', { what: 'after the merge' })}
day 6 09:00 ade: merge x
`);
  assert.deepEqual((await lostAgents(third, { asOf: AS_OF })).d.items.map((item) => [item.at, item.left, item.state, item.minutes ?? null]), [
    [ts(1, '09:00'), ts(3, '09:00'), 'no-did', null],
    [ts(2, '09:00'), ts(6, '09:00'), 'measured', 4320],
  ]);
});

test('a merge that keeps an owner neither line holds the task under goes on with the hold no line has ended', async () => {
  // bea claims again on the branch after its release; main, still on ade's
  // first claim, merges it keeping its own file.
  const dir = await fabricated(`
day 0 08:00 ade: create T001 backlog "Ours"
day 1 09:00 ade: move T001 tasks ${claim('ade', 'aaaa1111')}
branch s
day 2 09:00 ade: move T001 backlog {"owner": "—"}
day 3 09:00 bea: move T001 tasks ${claim('bea', 'eeee5555')}
checkout main
day 2 10:00 ade: set T001 {"priority": "high"}
`);
  const git = (args, day, clock) => {
    const date = new Date(EPOCH + day * 86400000 + Number(clock.slice(0, 2)) * 3600000).toISOString();
    return exec('git', ['-C', dir, ...args], { env: { ...process.env, GIT_AUTHOR_NAME: 'ade', GIT_AUTHOR_EMAIL: 'ade@example.com', GIT_COMMITTER_NAME: 'ade', GIT_COMMITTER_EMAIL: 'ade@example.com', GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date } });
  };
  await git(['checkout', '-q', 'main'], 5, '09');
  await git(['merge', '-q', '-s', 'ours', '--no-edit', 's'], 5, '09');
  await appendFile(path.join(dir, 'AA', 'checkpoints', 'T001.jsonl'), `${JSON.stringify({ ts: ts(5, '10:00'), run: 'eeee5555', kind: 'did', what: 'after the merge', next: 'go on' })}\n`);
  await git(['add', 'AA/checkpoints/T001.jsonl'], 5, '10');
  await git(['commit', '-q', '-m', 'ckpt: T001'], 5, '10');
  assert.deepEqual((await lostAgents(dir, { asOf: AS_OF })).d.items.map((item) => [item.at, item.left, item.state, item.minutes ?? null]), [
    [ts(1, '09:00'), ts(2, '09:00'), 'no-did', null],
    [ts(3, '09:00'), null, 'measured', 2940],
  ]);
});

test('owner lines read the same whatever comes after them: a takeover on one line ends the stint there', async () => {
  // bea takes the task over on main while ade goes on with it on a branch;
  // ade's stint ends at the takeover, so the two do not overlap, done or not.
  const history = `
day 0 08:00 ade: create T001 backlog "Takeover"
day 1 09:00 ade: move T001 tasks ${claim('ade', 'aaaa1111')}
branch side
day 2 09:00 ade: set T001 {"priority": "high"}
checkout main
day 3 09:00 bea: set T001 ${claim('bea', 'eeee5555')}
checkout side
day 4 09:00 ade: set T001 {"priority": "urgent"}
checkout main
day 5 09:00 ade: merge side`;
  const held = (await lostAgents(await fabricated(`${history}\n`), { asOf: AS_OF })).b;
  const done = (await lostAgents(await fabricated(`${history}\nday 6 09:00 ade: move T001 done\n`), { asOf: AS_OF })).b;
  assert.deepEqual(held.items, done.items);
  assert.equal(held.overlaps, 0);

  // ade takes it back from bea on a branch that main merges; the merge goes
  // on with that stint, not ade's first, so cal's claim on z overlaps it.
  const back = await fabricated(`
day 0 08:00 ade: create T001 backlog "Take back"
branch z
checkout main
day 1 09:00 ade: move T001 tasks ${claim('ade', 'aaaa1111')}
branch p2
day 3 09:00 bea: set T001 ${claim('bea', 'eeee5555')}
day 4 09:00 ade: set T001 ${claim('ade', 'bbbb2222')}
checkout main
day 5 09:00 ade: merge p2
checkout z
day 6 09:00 cal: move T001 tasks ${claim('cal', 'cccc3333')}
checkout main
day 8 09:00 ade: merge z
`);
  assert.deepEqual((await lostAgents(back, { asOf: AS_OF })).b.items.map((item) => [item.source, [item.a.operator, item.b.operator].sort(), item.from, item.to]), [
    ['owner-lines', ['ade', 'cal'], ts(6, '09:00'), ts(8, '09:00')],
  ]);
});

test('a resumed session\'s new process ends its old runs, so a run that ended before another family wrote leaves no overlap', async () => {
  // P1 dies without an end; P2's run ends before bbbb2222 writes, and P2
  // writes again only after it.
  const dir = await fabricated(`
day 0 08:00 ade: create T001 backlog "Resume"
day 1 09:00 ade: move T001 tasks ${claim('ade', 'aaaa1111')}
day 1 10:00 ade: ${line('T001', 1, '10:00', 'aaaa1111', 'open', { operator: 'ade', boot: 'b1', pid: 100, pstart: 'P1' })}
+ ${line('T001', 1, '10:10', 'aaaa1111', 'did', { what: 'first, then the process died' })}
day 1 12:00 ade: ${line('T001', 1, '12:00', 'aaaa1111.b', 'open', { operator: 'ade', boot: 'b1', pid: 200, pstart: 'P2' })}
+ ${line('T001', 1, '12:10', 'aaaa1111.b', 'did', { what: 'resumed' })}
+ ${line('T001', 1, '12:30', 'aaaa1111.b', 'end', { left: 'handed over' })}
day 1 13:00 bea: ${line('T001', 1, '13:00', 'bbbb2222', 'open', { operator: 'ade' })}
+ ${line('T001', 1, '13:10', 'bbbb2222', 'did', { what: 'second worker' })}
+ ${line('T001', 1, '14:00', 'bbbb2222', 'end', { left: 'handed back' })}
day 1 15:00 ade: ${line('T001', 1, '15:00', 'aaaa1111.c', 'open', { operator: 'ade', boot: 'b1', pid: 200, pstart: 'P2' })}
+ ${line('T001', 1, '15:10', 'aaaa1111.c', 'did', { what: 'third part' })}
`);
  assert.equal((await lostAgents(dir, { asOf: AS_OF })).b.overlaps, 0);
});

test('an older board claims by status and owner: unowned work in tasks/ counts in WIP but is not claimed', async () => {
  // T003 is open under an owner line: backlog on an older board, until its
  // status says it is taken.
  const dir = await fabricated(`
day 0 08:00 ade: create T001 tasks "One"
+ set T001 {"status": "open"}
+ create T002 tasks "Queued"
+ set T002 {"status": "queued"}
+ create T003 tasks "Owned, open"
+ set T003 {"status": "open", "owner": "ade @k/cccc3333 2026-09-02 — later"}
day 1 09:00 ade: set T001 {"status": "claimed", "owner": "ade @k/aaaa1111 2026-09-02 — one"}
day 1 09:10 ade: ${line('T001', 1, '09:10', 'aaaa1111', 'did', { what: 'first result' })}
day 2 09:00 ade: set T003 {"status": "claimed"}
`);
  const { c, d } = await lostAgents(dir, { asOf: AS_OF });
  assert.deepEqual([c.claims, c.noLimit, c.wipAtClaim.max], [2, 2, 2]);
  assert.deepEqual(d.items.map((item) => [item.task, item.at, item.state, item.minutes ?? null]), [
    ['T001', ts(1, '09:00'), 'measured', 10], ['T003', ts(2, '09:00'), 'open', null],
  ]);
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
