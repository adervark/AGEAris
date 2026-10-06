import assert from 'node:assert/strict';
import { execFile, execFileSync, spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { lstat, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import { promisify } from 'node:util';
import test from 'node:test';

import { fabricate } from '../lib/fabricate.mjs';
import {
  agentIdentity, BOARD_PATHS, buildLedger, cycles, fingerprint, isUiClaim, ledgerAt, Ledgers, parseOwner, typeKey,
} from '../lib/history.mjs';
import { Workspace } from '../lib/workspace.mjs';

const exec = promisify(execFile);
const temporaryDirectories = new Set();
const CLAIM = 'ade @k/e857a8c8 2026-10-01 — importer';
const AGENT = { operator: 'ade', profile: 'k', session: 'e857a8c8' };

test.after(async () => {
  await Promise.all([...temporaryDirectories].map((directory) => rm(directory, { recursive: true, force: true })));
});

async function scratch() {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'agesight-history-'));
  temporaryDirectories.add(directory);
  return directory;
}

// Every fixture is fabricated as in the default setup: the workspace operator
// `ade` authors every commit unless a line names someone else.
async function fabricated(script, options) {
  const fabrication = await fabricate(path.join(await scratch(), 'repo'), script, options);
  return { fabrication, ledger: await buildLedger(fabrication.dir) };
}

async function git(directory, ...args) {
  const { stdout } = await exec('git', args, { cwd: directory, env: { ...process.env, GIT_CONFIG_GLOBAL: os.devNull, GIT_CONFIG_NOSYSTEM: '1' } });
  return stdout.trim();
}

function of(ledger, taskKey) {
  return ledger.transitions.filter((transition) => transition.taskKey === taskKey);
}

// A transition without its commit bookkeeping, for exact comparisons.
function shape(transition) {
  if (transition.kind === 'status') return ['status', transition.from, transition.to, ...(transition.claimant ? [transition.claimant] : [])];
  if (transition.kind === 'field') return ['field', transition.field, transition.from, transition.to];
  return [transition.kind];
}

function anomalies(ledger, kind) {
  return ledger.anomalies.filter((anomaly) => anomaly.kind === kind);
}

// A spawner that records each git subcommand, then runs git as usual.
function countingSpawn() {
  const calls = [];
  return {
    calls,
    spawn: (command, args, options) => {
      calls.push(args[args.indexOf('-C') + 2]);
      return spawn(command, args, options);
    },
  };
}

async function openWorkspace() {
  return new Workspace({ dataDir: await scratch(), operator: 'ade', email: 'ade@example.invalid' }).init();
}

test('parseOwner splits operator, profile, and session; isUiClaim and agentIdentity follow from them', () => {
  const ui = parseOwner('ade @agesight/web 2026-10-01 — working on X');
  assert.deepEqual(ui, { raw: 'ade @agesight/web 2026-10-01 — working on X', operator: 'ade', profile: 'agesight', session: 'web' });
  assert.equal(isUiClaim(ui), true);
  assert.equal(agentIdentity(ui), '');

  const agent = parseOwner('ade @k/e857a8c8.a4f2 2026-10-01 — fold 0');
  assert.deepEqual([agent.operator, agent.profile, agent.session], ['ade', 'k', 'e857a8c8.a4f2']);
  assert.equal(isUiClaim(agent), false);
  assert.equal(agentIdentity(agent), 'ade @k/e857a8c8.a4f2');

  assert.equal(isUiClaim(parseOwner('ade @agesight/other 2026-10-01 — x')), false);
  const bare = parseOwner('ade');
  assert.deepEqual([bare.operator, bare.profile, bare.session], ['ade', '', '']);
  assert.equal(agentIdentity(bare), '');
  for (const none of ['—', '-', 'none', '', '— released', undefined]) {
    assert.deepEqual(parseOwner(none), { raw: '', operator: '', profile: '', session: '' }, JSON.stringify(none));
  }
  const accented = parseOwner('Zoë Ångström @k/beef 2026-10-01 — 日本');
  assert.equal(accented.operator, 'Zoë Ångström');
  assert.equal(agentIdentity(accented), 'Zoë Ångström @k/beef');
});

test('typeKey lowercases, treats placeholders as untyped, and strips other characters', () => {
  assert.equal(typeKey(' Bug '), 'bug');
  assert.equal(typeKey('{{optional — doc / analysis}}'), '');
  assert.equal(typeKey('Feature!'), 'feature');
  assert.equal(typeKey('é bug'), 'bug');
  assert.equal(typeKey(''), '');
  assert.equal(typeKey(undefined), '');
});

test('a task life cycle gives exact transitions and the agent claimant (golden)', async () => {
  const { fabrication, ledger } = await fabricated(`
    day 0 09:00 ade: create T001 backlog "Importer" {"dueDate": "2026-10-05"}
    day 1 09:00 ade: move T001 tasks {"owner": "${CLAIM}"} label=claim
    day 2 09:00 ade: move T001 blocked {"blockedReason": "waiting on key"} label=blocked
    day 3 09:00 ade: move T001 tasks {"blockedReason": ""}
    day 4 09:00 ade: set T001 {"dueDate": "2026-10-09"}
    day 5 09:00 ade: set T001 {"title": "Bulk importer"}
    day 6 09:00 ade: move T001 done
    day 7 09:00 ade: move T001 tasks
    day 8 09:00 ade: move T001 done
  `);
  assert.deepEqual(of(ledger, 'T001').map(shape), [
    ['created'],
    ['status', 'backlog', 'in_progress', AGENT],
    ['field', 'owner', '', CLAIM],
    ['status', 'in_progress', 'blocked'],
    ['field', 'blockedReason', '', 'waiting on key'],
    ['status', 'blocked', 'in_progress'],
    ['field', 'blockedReason', 'waiting on key', ''],
    ['field', 'dueDate', '2026-10-05', '2026-10-09'],
    ['field', 'title', 'Importer', 'Bulk importer'],
    ['status', 'in_progress', 'done'],
    ['status', 'done', 'in_progress', AGENT],
    ['status', 'in_progress', 'done'],
  ]);
  const claim = of(ledger, 'T001')[1];
  assert.equal(claim.commit, fabrication.sha('claim'));
  assert.equal(claim.at, '2026-09-02T09:00:00+01:00');
  assert.equal(claim.actor, 'ade');
  const rename = of(ledger, 'T001').find((transition) => transition.field === 'title');
  assert.equal(rename.path, 'deaddrop/tasks/T001-bulk-importer.md', 'the slug changes with the title');
  assert.equal(ledger.tasks.T001.status, 'done');
  assert.equal(ledger.tasks.T001.title, 'Bulk importer');
  assert.deepEqual(ledger.anomalies, []);

  const [first, second] = cycles(ledger).T001;
  assert.equal(first.begin.kind, 'created');
  assert.equal(first.start.commit, fabrication.sha('claim'));
  assert.equal(first.outcome, 'done');
  assert.deepEqual(first.claimant, AGENT);
  assert.equal(second.begin.kind, 'reopen');
  assert.equal(second.start.seq, second.begin.seq, 'a reopen straight into WIP starts at that moment');
  assert.equal(second.outcome, 'done');

  // ledgerAt between two transitions: the state as it stood then.
  const then = ledgerAt(ledger, '2026-09-03T12:00:00+01:00');
  assert.equal(then.tasks.T001.status, 'blocked');
  assert.equal(then.tasks.T001.blockedReason, 'waiting on key');
  assert.equal(then.ledgerHeadAtAsOf, fabrication.sha('blocked'));
  assert.equal(then.commits.length, 3);
  assert.ok(then.transitions.every((transition) => transition.seq <= 2));
  assert.equal(ledgerAt(ledger, '2026-08-01T00:00:00Z').ledgerHeadAtAsOf, '');
});

test('created carries the full normalized snapshot at the first commit, not the frontmatter createdAt', async () => {
  const { ledger } = await fabricated(`
    day 0 09:00 ade: create T001 tasks "Old file" {"createdAt": "2026-01-01T09:00:00+00:00", "created": "2026-01-01", "owner": "${CLAIM}", "assignee": "—", "priority": null, "type": "Bug"}
  `);
  const [created] = of(ledger, 'T001');
  assert.equal(created.kind, 'created');
  assert.equal(created.at, '2026-09-01T09:00:00+01:00');
  assert.deepEqual(created.snapshot, {
    status: 'in_progress', title: 'Old file', type: 'Bug', priority: 'medium', assignee: '', owner: CLAIM,
    dueDate: '', milestone: '', blockedReason: '',
  });
  assert.deepEqual(created.claimant, AGENT);
  assert.equal(ledger.tasks.T001.createdAt, '2026-09-01T09:00:00+01:00');
  assert.equal(ledger.tasks.T001.typeKey, 'bug');
});

test('a commit that only adds empty type and blockedReason keys produces no transitions', async () => {
  const { ledger } = await fabricated(`
    day 0 09:00 ade: create T001 backlog "Legacy" {"type": null, "blockedReason": null}
    day 1 09:00 ade: set T001 {"type": "", "blockedReason": ""}
  `);
  assert.equal(ledger.commits.length, 2);
  assert.deepEqual(ledger.commits[1].touched, ['T001']);
  assert.deepEqual(of(ledger, 'T001').map(shape), [['created']]);
});

test('cycle start: created directly in WIP starts at creation', async () => {
  const { ledger } = await fabricated(`day 0 09:00 ade: create T001 tasks "A" {"owner": "${CLAIM}"}`);
  const [cycle] = cycles(ledger).T001;
  assert.deepEqual([cycle.start.seq, cycle.start.source, cycle.excluded], [0, 'entry', '']);
  assert.deepEqual(cycle.claimant, AGENT);
});

test('cycle start: backlog to WIP starts at the move', async () => {
  const { ledger } = await fabricated(`
    day 0 09:00 ade: create T001 backlog "A"
    day 2 09:00 ade: move T001 tasks {"owner": "${CLAIM}"}
  `);
  const [cycle] = cycles(ledger).T001;
  assert.deepEqual([cycle.begin.seq, cycle.start.seq, cycle.start.at], [0, 1, '2026-09-03T09:00:00+01:00']);
});

test('cycle start: done to WIP starts a new cycle', async () => {
  const { ledger } = await fabricated(`
    day 0 09:00 ade: create T001 backlog "A"
    day 1 09:00 ade: move T001 tasks
    day 2 09:00 ade: move T001 done
    day 3 09:00 ade: move T001 tasks
  `);
  const list = cycles(ledger).T001;
  assert.equal(list.length, 2);
  assert.deepEqual([list[0].start.seq, list[0].end.seq, list[0].outcome], [1, 2, 'done']);
  assert.deepEqual([list[1].begin.kind, list[1].start.seq, list[1].end], ['reopen', 3, null]);
});

test('cycle start: WIP to backlog to WIP keeps the original start', async () => {
  const { ledger } = await fabricated(`
    day 0 09:00 ade: create T001 backlog "A"
    day 1 09:00 ade: move T001 tasks
    day 2 09:00 ade: move T001 backlog
    day 3 09:00 ade: move T001 tasks
    day 4 09:00 ade: move T001 done
  `);
  const list = cycles(ledger).T001;
  assert.equal(list.length, 1);
  assert.equal(list[0].start.seq, 1);
});

test('cycle start: a start in a migrate: sweep falls back to the next non-sweep commit in WIP, labelled', async () => {
  const { fabrication, ledger } = await fabricated(`
    day 0 09:00 ade: create T001 backlog "A"
    day 1 09:00 ade: move T001 tasks subject="migrate: move claimed tasks"
    day 2 09:00 ade: set T001 {"priority": "high"} label=work
    day 3 09:00 ade: move T001 done
  `);
  assert.equal(ledger.commits[1].sweep, true);
  const [cycle] = cycles(ledger).T001;
  assert.equal(cycle.start.commit, fabrication.sha('work'));
  assert.equal(cycle.start.source, 'fallback');
  assert.equal(cycle.start.label, 'start bounded by first non-sweep commit (cycle time may be understated)');
});

test('cycle start: a sweep start with no later non-sweep commit before the finish is excluded', async () => {
  const { ledger } = await fabricated(`
    day 0 09:00 ade: create T001 backlog "A"
    day 1 09:00 ade: move T001 tasks subject="migrate: sweep"
    day 2 09:00 ade: ckpt T001 did "x" subject="ckpt: T001"
    day 3 09:00 ade: move T001 done
  `);
  const [cycle] = cycles(ledger).T001;
  assert.equal(cycle.start, null);
  assert.equal(cycle.excluded, 'start known only from a sweep commit');
  assert.equal(cycle.outcome, 'done');
});

test('cycle start: created in backlog, started only in a sweep: excluded, never the creation time', async () => {
  const { ledger } = await fabricated(`
    day 0 09:00 ade: create T001 backlog "A"
    day 1 09:00 ade: move T001 tasks subject="migrate: bulk claim"
  `);
  const [cycle] = cycles(ledger).T001;
  assert.equal(cycle.start, null);
  assert.equal(cycle.excluded, 'start known only from a sweep commit');
  // The prefix decides: before the sweep, the cycle has not started at all.
  assert.deepEqual(cycles(ledger, '2026-09-01T12:00:00+01:00').T001[0].excluded, '');
});

test('cycle finish: a finish in a sweep commit is marked and excluded; a start exclusion takes precedence', async () => {
  const { ledger } = await fabricated(`
    day 0 09:00 ade: create T001 backlog "Finished by a sweep"
    day 0 09:30 ade: create T002 backlog "Started and finished by sweeps"
    day 0 10:00 ade: create T003 backlog "Finished by hand"
    day 1 09:00 ade: move T001 tasks
    day 1 10:00 ade: move T002 tasks subject="migrate: claim"
    day 1 11:00 ade: move T003 tasks
    day 2 09:00 ade: move T001 done subject="migrate: close finished tasks"
    day 2 10:00 ade: move T002 done subject="ckpt: close"
    day 2 11:00 ade: move T003 done
  `);
  const [swept] = cycles(ledger).T001;
  assert.deepEqual([swept.start.seq, swept.start.source, swept.outcome], [3, 'entry', 'done']);
  assert.equal(swept.end.sweep, true);
  assert.equal(swept.excluded, 'finish known only from a sweep commit');

  const [both] = cycles(ledger).T002;
  assert.equal(both.end.sweep, true);
  assert.equal(both.excluded, 'start known only from a sweep commit');

  const [manual] = cycles(ledger).T003;
  assert.equal(manual.end.sweep, undefined);
  assert.equal(manual.excluded, '');
  assert.equal(cycles(ledger, '2026-09-02T12:00:00+01:00').T001[0].excluded, '', 'before the sweep finish the cycle is open');
});

test('killed: a move into done/ as killed is dropped, and done edited to killed is done → dropped', async () => {
  const { ledger } = await fabricated(`
    day 0 09:00 ade: create T001 tasks "Cancelled"
    day 0 10:00 ade: create T002 tasks "Finished, then cancelled"
    day 1 09:00 ade: kill T001
    day 2 09:00 ade: move T002 done
    day 3 09:00 ade: set T002 {"status": "killed"}
  `);
  assert.deepEqual(of(ledger, 'T001').map(shape).at(-1), ['status', 'in_progress', 'dropped']);
  assert.equal(cycles(ledger).T001[0].outcome, 'dropped');
  assert.deepEqual(of(ledger, 'T002').filter((transition) => transition.kind === 'status').map(shape), [
    ['status', 'in_progress', 'done'],
    ['status', 'done', 'dropped'],
  ]);
  const t002 = cycles(ledger).T002;
  assert.equal(t002.length, 1, 'done → dropped is not a reopen');
  assert.equal(t002[0].outcome, 'dropped');
  assert.equal(ledger.tasks.T002.status, 'dropped');
});

test('agent commits: a raw git move by another author, and a side-branch claim merged by Ben', async () => {
  const { fabrication, ledger } = await fabricated(`
    day 0 09:00 ade: create T001 backlog "Moved by Mira"
    day 0 09:05 ade: create T002 backlog "Claimed on a branch"
    day 1 09:00 Mira: move T001 tasks {"owner": "Mira @c/77aa 2026-09-02 — moving"}
    branch agent
    day 1 10:00 ade: move T002 tasks {"owner": "${CLAIM}"} run=R009
    checkout main
    day 1 11:00 ade: create T003 backlog "Meanwhile on main"
    day 2 09:00 Ben: merge agent label=merge
  `);
  const moved = of(ledger, 'T001').find((transition) => transition.kind === 'status');
  assert.deepEqual([moved.actor, moved.to, moved.claimant.operator], ['Mira', 'in_progress', 'Mira']);

  const claim = of(ledger, 'T002').find((transition) => transition.kind === 'status');
  assert.equal(claim.commit, fabrication.sha('merge'));
  assert.equal(claim.actor, 'Ben');
  assert.equal(claim.at, '2026-09-03T09:00:00+01:00');
  assert.equal(claim.runId, '', 'trailers belong to the side commit, not the merge');
  assert.deepEqual(claim.claimant, AGENT);
  assert.equal(ledger.commits.at(-1).subject, "Merge branch 'agent'");
  assert.equal(ledger.commits.length, 5, 'first-parent history only');
});

test('clock: rebased commits count when they landed, not when they were authored', async () => {
  const { ledger } = await fabricated(`
    day 0 09:00 ade: create T001 backlog "A"
    branch agent
    day 1 09:00 ade: move T001 tasks {"owner": "${CLAIM}"}
    checkout main
    day 2 09:00 ade: create T002 backlog "B"
    day 4 10:00 ade: rebase agent
  `);
  const claim = of(ledger, 'T001').find((transition) => transition.kind === 'status');
  assert.equal(claim.at, '2026-09-05T10:00:00+01:00');
  const commit = ledger.commits[claim.seq];
  assert.equal(commit.authoredAt, '2026-09-02T09:00:00+01:00');
  assert.equal(commit.committedAt, '2026-09-05T10:00:00+01:00');
  assert.equal(commit.clamped, false);
});

test('clock: fast-forwarded older commits take the head\'s time, and appending never changes an existing at', async () => {
  const { fabrication, ledger } = await fabricated(`
    day 0 09:00 ade: create T001 backlog "A"
    day 5 09:00 ade: create T002 backlog "B" label=H
    branch agent
    day 2 09:00 ade: move T001 tasks {"owner": "${CLAIM}"}
    day 3 09:00 ade: set T001 {"priority": "high"}
    checkout main
    ff agent
  `);
  const head = ledger.commits.find((commit) => commit.sha === fabrication.sha('H'));
  const later = ledger.commits.slice(head.seq + 1);
  assert.equal(later.length, 2);
  for (const commit of later) {
    assert.equal(commit.at, head.at);
    assert.equal(commit.clamped, true);
    assert.ok(commit.seq > head.seq);
  }
  assert.equal(anomalies(ledger, 'out_of_order_time').length, 2);
  assert.equal(of(ledger, 'T001').find((transition) => transition.kind === 'status').at, head.at);

  await fabrication.run('day 6 09:00 ade: create T003 backlog "C"\nday 1 09:00 ade: set T003 {"priority": "low"}');
  const rebuilt = await buildLedger(fabrication.dir);
  assert.deepEqual(rebuilt.commits.slice(0, ledger.commits.length).map((commit) => commit.at), ledger.commits.map((commit) => commit.at));
  assert.deepEqual(rebuilt.transitions.slice(0, ledger.transitions.length), ledger.transitions);
  assert.equal(rebuilt.commits.at(-1).at, '2026-09-07T09:00:00+01:00');
});

test('clock: a commit dated in the future changes nothing at build time and is excluded at asOf, with what follows', async () => {
  const { ledger } = await fabricated(`
    day 0 09:00 ade: create T001 backlog "A"
    2027-01-01T09:00:00+00:00 ade: create T002 backlog "From the future"
    day 30 09:00 ade: create T003 backlog "After it"
  `);
  const future = Date.parse('2027-01-01T09:00:00Z');
  assert.equal(Date.parse(ledger.commits[1].at), future, 'the build does not clamp to the build time');
  assert.equal(ledger.commits[2].at, ledger.commits[1].at);
  assert.equal(ledger.commits[2].clamped, true);
  const view = ledgerAt(ledger, '2026-10-05T09:12:00+01:00');
  assert.deepEqual(Object.keys(view.tasks), ['T001']);
  assert.equal(view.ledgerHeadAtAsOf, ledger.commits[0].sha);
  assert.equal(view.futureCommits, 2);
  assert.equal(ledgerAt(ledger, '2027-01-01T09:04:00+00:00').futureCommits, 0, 'no commit lies past asOf');
});

test('clock: futureCommits counts every commit the view cuts, including those just past asOf', async () => {
  const { ledger } = await fabricated(`
    day 0 09:00 ade: create T001 backlog "A"
    day 1 09:00 ade: create T002 backlog "B"
    day 1 09:02 ade: create T003 backlog "Two minutes later"
    day 3 09:00 ade: create T004 backlog "Days later"
  `);
  const view = ledgerAt(ledger, '2026-09-02T09:00:00+01:00');
  assert.equal(view.commits.length, 2);
  assert.equal(view.futureCommits, 2);
  assert.equal(view.commits.length + view.futureCommits, ledger.commits.length);
});

test('ids: a split move is one incarnation, with the removal retracted', async () => {
  const { ledger } = await fabricated(`
    day 0 09:00 ade: create T004 backlog "Split" {"created": "2026-09-01", "createdAt": "2026-09-01T09:00:00+01:00"}
    day 1 09:00 ade: remove T004
    day 1 10:00 ade: create T005 backlog "Other"
    day 2 09:00 ade: create T004 tasks "Split" {"created": "2026-09-01", "createdAt": "2026-09-01T09:00:00+01:00", "owner": "${CLAIM}"}
  `);
  assert.deepEqual(Object.keys(ledger.tasks).sort(), ['T004', 'T005']);
  const list = of(ledger, 'T004');
  assert.deepEqual(list.map(shape), [['created'], ['removed'], ['created'], ['status', 'backlog', 'in_progress', AGENT], ['field', 'owner', '', CLAIM]]);
  assert.equal(list[1].retracted, true);
  assert.equal(list[2].retracted, true);
  const counted = (kind) => list.filter((transition) => transition.kind === kind && !transition.retracted).length;
  assert.deepEqual([counted('created'), counted('removed')], [1, 0], 'neither half counts as Removed or Added');
  assert.equal(ledger.tasks.T004.present, true);
  assert.equal(ledger.tasks.T004.status, 'in_progress');
  assert.deepEqual(anomalies(ledger, 'id_reused'), []);
  assert.equal(cycles(ledger).T004.length, 1);
  assert.equal(ledgerAt(ledger, '2026-09-02T12:00:00+01:00').tasks.T004.present, false);
});

test('ids: a past view between a split move\'s removal and re-add shows the removal unretracted', async () => {
  const { ledger } = await fabricated(`
    day 0 09:00 ade: create T004 backlog "Split" {"createdAt": "2026-09-01T09:00:00+01:00"}
    day 1 09:00 ade: remove T004
    day 2 09:00 ade: create T004 tasks "Split" {"createdAt": "2026-09-01T09:00:00+01:00"}
  `);
  const between = ledgerAt(ledger, '2026-09-02T12:00:00+01:00');
  const removal = of(between, 'T004').find((transition) => transition.kind === 'removed');
  assert.equal(removal.retracted, undefined, 'the re-add lies beyond the view');
  assert.equal(of(ledger, 'T004').find((transition) => transition.kind === 'removed').retracted, true, 'the full ledger is unchanged');
  const after = ledgerAt(ledger, '2026-09-03T12:00:00+01:00');
  assert.equal(of(after, 'T004').find((transition) => transition.kind === 'removed').retracted, true);
});

test('ids: a different task re-added under a removed id is a new incarnation', async () => {
  const { ledger } = await fabricated(`
    day 0 09:00 ade: create T004 backlog "First"
    day 1 09:00 ade: remove T004
    day 2 09:00 ade: create T004 backlog "Second"
  `);
  assert.equal(ledger.tasks.T004.present, false);
  assert.equal(ledger.tasks['T004#2'].title, 'Second');
  assert.equal(ledger.tasks['T004#2'].incarnation, 2);
  assert.equal(anomalies(ledger, 'id_reused').length, 1);
  assert.equal(of(ledger, 'T004')[1].retracted, undefined);
});

test('ids: a second file with a present id raises duplicate_id and is ignored', async () => {
  const { ledger } = await fabricated(`
    day 0 09:00 ade: create T001 backlog "Original"
    day 1 09:00 ade: write deaddrop/tasks/T001-copy.md "---\\nid: T001\\ntitle: \\"Copy\\"\\nstatus: claimed\\n---\\n"
  `);
  assert.equal(anomalies(ledger, 'duplicate_id').length, 1);
  assert.equal(ledger.tasks.T001.title, 'Original');
  assert.equal(ledger.tasks.T001.status, 'backlog');
});

test('ids: deleting the original of a duplicated id promotes the surviving duplicate', async () => {
  const { fabrication, ledger } = await fabricated(`
    day 0 09:00 ade: create T001 backlog "Original"
    day 1 09:00 ade: write deaddrop/tasks/T001-copy.md "---\\nid: T001\\ntitle: \\"Copy\\"\\nstatus: claimed\\n---\\n"
    day 2 09:00 ade: delete deaddrop/backlog/T001-original.md label=promote
    day 3 09:00 ade: set T001 {"priority": "high"}
  `);
  assert.equal(anomalies(ledger, 'duplicate_id').length, 1);
  const list = of(ledger, 'T001');
  assert.equal(list.filter((transition) => transition.kind === 'removed').length, 0, 'the task was not removed');
  const promoted = list.filter((transition) => transition.commit === fabrication.sha('promote'));
  assert.deepEqual(promoted.map(shape), [['status', 'backlog', 'in_progress', { operator: '', profile: '', session: '' }], ['field', 'title', 'Original', 'Copy']]);
  assert.equal(promoted[0].path, 'deaddrop/tasks/T001-copy.md');
  assert.deepEqual(shape(list.at(-1)), ['field', 'priority', 'medium', 'high'], 'the promoted file is followed');
  assert.deepEqual([ledger.tasks.T001.present, ledger.tasks.T001.title, ledger.tasks.T001.status, ledger.tasks.T001.priority], [true, 'Copy', 'in_progress', 'high']);
});

test('files: unsafe paths, checkpoints, non-ASCII content, and corrupt files become anomalies, never throws', async () => {
  const { ledger } = await fabricated(`
    day 0 09:00 ade: create T001 tasks "Café 日本 🚀" {"owner": "Zoë @k/beef 2026-09-01 — 日本", "blockedReason": "attente — clé"}
    day 0 10:00 ade: write deaddrop/tasks/notes.md "loose notes"
    day 1 09:00 ade: ckpt T001 did "first" ts="day 0 20:00"
    + ckpt T001 blocked "card busy" ts="day 0 23:30"
    + ckpt T001 did "older" ts="day 0 21:00"
    day 1 10:00 ade: ckpt T001 raw "{not json"
    + ckpt T001 did "fine" ts="day 1 10:00"
    day 2 09:00 ade: write deaddrop/tasks/T009-broken.md "no frontmatter at all"
    day 2 10:00 ade: write deaddrop/checkpoints/_SCHEMA.md "the format"
  `);
  const unsafe = anomalies(ledger, 'unsafe_path');
  assert.deepEqual(unsafe.map((anomaly) => anomaly.path), ['deaddrop/tasks/notes.md']);

  const life = of(ledger, 'T001').filter((transition) => transition.kind === 'life');
  assert.equal(life.length, 2);
  assert.equal(life[0].ts, '2026-09-01T22:30:00.000Z', 'the newest ts among the added lines');
  assert.equal(life[0].blocked, 'card busy');
  assert.equal(life[0].at, '2026-09-02T09:00:00+01:00');
  assert.equal(ledger.tasks.T001.trailBlocked, 'card busy');
  assert.equal(anomalies(ledger, 'unparseable_checkpoint').length, 1);

  assert.equal(ledger.tasks.T001.title, 'Café 日本 🚀');
  assert.equal(ledger.tasks.T001.owner.operator, 'Zoë');
  assert.equal(ledger.tasks.T001.blockedReason, 'attente — clé');
  assert.equal(anomalies(ledger, 'unparseable_task').length, 1);
  assert.equal(ledger.tasks.T009, undefined);
  assert.equal(ledger.commits.length, 6);
});

test('files: more than 1 MiB of task content builds, identically with a tiny chunk size', async () => {
  const body = 'é日🚀 '.repeat(410);
  const lines = [];
  for (let index = 0; index < 400; index += 1) {
    const minutes = index;
    const time = `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
    lines.push(`day 0 ${time} ade: create T${String(index + 1).padStart(3, '0')} backlog "Task ${index + 1}" {"body": "${body}"}`);
  }
  const { fabrication, ledger } = await fabricated(lines.join('\n'));
  assert.equal(Object.keys(ledger.tasks).length, 400);
  assert.ok(Buffer.byteLength(await readFile(path.join(fabrication.dir, 'deaddrop/backlog/T001-task-1.md'))) > 4000);
  assert.deepEqual(ledger.anomalies, []);
  const tiny = await buildLedger(fabrication.dir, { chunkSize: 7 });
  assert.deepEqual(tiny, ledger);
});

test('files: a checkpoint trail past 256 KB keeps producing life from its last 256 KB', async () => {
  // The old lines are dated after the new ones, so a life ts from any old
  // line would show that the tail was not diffed against the previous tail.
  const old = [];
  for (let index = 0; Buffer.byteLength(old.join('\n')) < 300 * 1024; index += 1) {
    old.push(JSON.stringify({ ts: '2026-09-10T09:00:00Z', run: 'r', kind: 'did', what: `old ${index} ${'é'.repeat(60)}` }));
  }
  const { fabrication, ledger } = await fabricated(`
    day 0 09:00 ade: create T001 tasks "Long trail" {"owner": "${CLAIM}"}
    day 1 09:00 ade: write deaddrop/checkpoints/T001.jsonl ${JSON.stringify(`${old.join('\n')}\n`)}
    day 2 09:00 ade: ckpt T001 did "after the cap" ts="day 2 08:00"
    day 3 09:00 ade: ckpt T001 blocked "still going" ts="day 3 08:00"
  `);
  assert.ok((await lstat(path.join(fabrication.dir, 'deaddrop/checkpoints/T001.jsonl'))).size > 300 * 1024);
  const life = of(ledger, 'T001').filter((transition) => transition.kind === 'life');
  assert.deepEqual(life.map((transition) => transition.ts), ['2026-09-10T09:00:00.000Z', '2026-09-03T07:00:00.000Z', '2026-09-04T07:00:00.000Z']);
  assert.equal(life[2].blocked, 'still going');
  assert.deepEqual(ledger.anomalies, [], 'no oversized_blob, and the partial first line is not an unparseable checkpoint');
  assert.deepEqual(await buildLedger(fabrication.dir, { chunkSize: 997 }), ledger);
});

test('files: a task file over 256 KB is read from its head and its state still moves', async () => {
  const body = 'é日🚀 '.repeat(Math.ceil((300 * 1024) / 10));
  const { fabrication } = await fabricated(`
    day 0 09:00 ade: create T001 backlog "Big" {"body": "${body}"}
    day 1 09:00 ade: move T001 done
  `);
  assert.ok((await lstat(path.join(fabrication.dir, 'deaddrop/tasks/done/T001-big.md'))).size > 300 * 1024);
  const ledger = await buildLedger(fabrication.dir, { chunkSize: 1 });
  assert.deepEqual(of(ledger, 'T001').map(shape), [['created'], ['status', 'backlog', 'done']]);
  assert.equal(ledger.tasks.T001.status, 'done');
  assert.deepEqual(ledger.anomalies, []);
});

test('files: frontmatter that does not close within 256 KB, and an oversized project.json, are oversized_blob', async () => {
  const huge = 'x'.repeat(300 * 1024);
  const { ledger } = await fabricated(`
    day 0 09:00 ade: create T001 backlog "Huge frontmatter" {"milestone": "${huge}"}
    day 0 10:00 ade: project {"name": "P", "notes": "${huge}"}
  `);
  assert.deepEqual(anomalies(ledger, 'oversized_blob').map((anomaly) => [anomaly.seq, anomaly.path]), [[0, 'deaddrop/backlog/T001-huge-frontmatter.md'], [1, 'project.json']]);
  assert.match(anomalies(ledger, 'oversized_blob')[0].detail, /limit 262144/);
  assert.equal(ledger.tasks.T001, undefined);
  assert.equal(ledger.transitions.length, 0);
});

test('files: a task path whose blob is absent from the repository is missing_blob', async () => {
  const dir = path.join(await scratch(), 'repo');
  await mkdir(dir);
  await git(dir, 'init', '--quiet');
  const run = (args, input) => execFileSync('git', args, { cwd: dir, input, env: { ...process.env, GIT_CONFIG_GLOBAL: os.devNull, GIT_CONFIG_NOSYSTEM: '1' } }).toString().trim();
  const ghost = '1'.repeat(40);
  const tasks = run(['mktree', '--missing'], `100644 blob ${ghost}\tT002-ghost.md\n`);
  const deaddrop = run(['mktree', '--missing'], `040000 tree ${tasks}\ttasks\n`);
  const root = run(['mktree', '--missing'], `040000 tree ${deaddrop}\tdeaddrop\n`);
  const commit = run(['-c', 'user.name=ade', '-c', 'user.email=ade@example.invalid', 'commit-tree', root, '-m', 'Ghost']);
  await git(dir, 'update-ref', 'HEAD', commit);
  const ledger = await buildLedger(dir);
  assert.deepEqual(anomalies(ledger, 'missing_blob').map((anomaly) => [anomaly.path, anomaly.detail]), [['deaddrop/tasks/T002-ghost.md', 'deaddrop/tasks/T002-ghost.md could not be read']]);
  assert.deepEqual(ledger.tasks, {});
});

test('fingerprint: a reftable repository changes its fingerprint on every commit', async (t) => {
  const dir = path.join(await scratch(), 'reftable');
  try { await git(await scratch(), 'init', '--quiet', '--ref-format=reftable', dir); }
  catch { t.skip('this git does not support --ref-format=reftable'); return; }
  const commit = (message) => git(dir, '-c', 'user.name=ade', '-c', 'user.email=ade@example.invalid', 'commit', '--quiet', '--allow-empty', '-m', message);
  await commit('one');
  assert.match(await readFile(path.join(dir, '.git', 'HEAD'), 'utf8'), /^ref: refs\/heads\/\.invalid/);
  const first = await fingerprint(dir);
  assert.equal(await fingerprint(dir), first);
  await commit('two');
  assert.notEqual(await fingerprint(dir), first);
});

test('fingerprint changes when only an inode changes', async () => {
  const { fabrication } = await fabricated('day 0 09:00 ade: create T001 backlog "A"');
  let ino = 1n;
  const stat = async () => ({ ino, ctimeNs: 5n, mtimeNs: 5n, size: 5n });
  const first = await fingerprint(fabrication.dir, { stat });
  assert.equal(await fingerprint(fabrication.dir, { stat }), first);
  ino = 2n;
  assert.notEqual(await fingerprint(fabrication.dir, { stat }), first);
});

test('memo: concurrent reads share one build, and an unchanged repository spawns no git at all', async () => {
  const workspace = await openWorkspace();
  const project = await workspace.createProject({ name: 'Memo' });
  await workspace.createTask({ projectId: project.id, title: 'One' });
  const counter = countingSpawn();
  const ledgers = new Ledgers({ workspace, spawn: counter.spawn });
  const [a, b] = await Promise.all([ledgers.get(project.id), ledgers.get(project.id)]);
  assert.equal(a, b);
  assert.equal(counter.calls.filter((call) => call === 'log').length, 1);
  assert.equal(ledgers.building(project.id), null);

  counter.calls.length = 0;
  assert.equal(await ledgers.get(project.id), a);
  assert.deepEqual(counter.calls, [], 'a second read with no ref change spawns zero git processes');

  // A run commit (pipeline/runs/…) moves HEAD but not the ledger: resolve only.
  const dir = workspace._projectDir(project.id);
  await mkdir(path.join(dir, 'pipeline', 'runs', 'R001'), { recursive: true });
  await writeFile(path.join(dir, 'pipeline', 'runs', 'R001', 'events.jsonl'), '{}\n');
  workspace._commit(dir, [path.join(dir, 'pipeline', 'runs', 'R001')], 'Run R001 (T001): started');
  const after = await ledgers.get(project.id);
  assert.deepEqual(counter.calls, ['rev-parse', 'symbolic-ref', 'rev-list']);
  assert.equal(after.ledgerSha, a.ledgerSha);
  assert.notEqual(after.headSha, a.headSha);
  assert.equal(after.transitions, a.transitions, 'no rebuild');
  ledgers.close();
});

test('memo: coarse timestamps — AGE Aris writes invalidate the memo, and raw commits show through a new ref inode', async () => {
  const workspace = await openWorkspace();
  const project = await workspace.createProject({ name: 'Coarse' });
  const task = await workspace.createTask({ projectId: project.id, title: 'Coarse task' });
  const dir = workspace._projectDir(project.id);
  const coarse = (file, options) => lstat(file, options).then((info) => ({ ino: info.ino, ctimeNs: 0n, mtimeNs: 0n, size: 0n }));
  const ledgers = new Ledgers({ workspace, stat: coarse });
  assert.equal((await ledgers.get(project.id)).tasks.T001.status, 'backlog');

  await workspace.updateTask(task.id, { version: task.version, status: 'in_progress' }, { trailers: { 'AGESight-Via': 'ui' } });
  assert.equal((await ledgers.get(project.id)).tasks.T001.status, 'in_progress');

  const file = path.join(dir, 'deaddrop', 'tasks', 'T001-coarse-task.md');
  await writeFile(file, (await readFile(file, 'utf8')).replace(/^priority: .*$/m, 'priority: urgent'));
  await git(dir, 'commit', '--quiet', '-am', 'Raise priority by hand');
  assert.equal((await ledgers.get(project.id)).tasks.T001.priority, 'urgent');
  ledgers.close();

  // With every stat field frozen, only the onCommit invalidation can notice a
  // write; it fires for ledger paths and not for a run commit.
  const frozen = async () => ({ ino: 1n, ctimeNs: 0n, mtimeNs: 0n, size: 0n });
  const counter = countingSpawn();
  const blind = new Ledgers({ workspace, stat: frozen, spawn: counter.spawn });
  const before = await blind.get(project.id);
  await mkdir(path.join(dir, 'pipeline', 'runs', 'R002'), { recursive: true });
  await writeFile(path.join(dir, 'pipeline', 'runs', 'R002', 'events.jsonl'), '{}\n');
  workspace._commit(dir, [path.join(dir, 'pipeline', 'runs', 'R002')], 'Run R002 (T001): started');
  counter.calls.length = 0;
  assert.equal(await blind.get(project.id), before);
  assert.deepEqual(counter.calls, [], 'a run commit does not invalidate the ledger');
  const current = await workspace.getTask(task.id);
  await workspace.updateTask(task.id, { version: current.version, status: 'blocked' });
  assert.equal((await blind.get(project.id)).tasks.T001.status, 'blocked');
  assert.ok(counter.calls.includes('log'));
  blind.close();
});

// A spawner whose first `rev-parse` runs at once (it sees the repository as it
// is now) but whose result is held until `release()`; every other git process
// runs as usual.
function heldRevParse() {
  let release;
  let requested;
  const gate = new Promise((resolve) => { release = resolve; });
  const asked = new Promise((resolve) => { requested = resolve; });
  let held = false;
  return {
    release,
    asked,
    spawn: (command, args, options) => {
      if (held || args[args.indexOf('-C') + 2] !== 'rev-parse') return spawn(command, args, options);
      held = true;
      const stdout = execFileSync(command, args);
      const child = new EventEmitter();
      Object.assign(child, { stdout: new PassThrough(), stderr: new PassThrough(), kill: () => {} });
      gate.then(() => {
        child.stdout.end(stdout);
        child.emit('close', 0);
      });
      requested();
      return child;
    },
  };
}

test('memo: a read that arrives after an invalidation never gets a build that started before it', async () => {
  const workspace = await openWorkspace();
  const project = await workspace.createProject({ name: 'Race' });
  const task = await workspace.createTask({ projectId: project.id, title: 'Racing' });
  // Frozen stat: the fingerprint cannot see the commit, so only the
  // generation check keeps the late read off the early build.
  const frozen = async () => ({ ino: 1n, ctimeNs: 0n, mtimeNs: 0n, size: 0n });
  const held = heldRevParse();
  const ledgers = new Ledgers({ workspace, stat: frozen, spawn: held.spawn });
  const early = ledgers.get(project.id);
  await held.asked;
  await workspace.updateTask(task.id, { version: task.version, status: 'in_progress' });
  const late = ledgers.get(project.id);
  held.release();
  assert.equal((await early).tasks.T001.status, 'backlog', 'the early build resolved HEAD before the commit');
  assert.equal((await late).tasks.T001.status, 'in_progress');
  ledgers.close();
});

test('memo: a commit listing the project root ("" or ".") invalidates the ledger', async () => {
  const workspace = await openWorkspace();
  const project = await workspace.createProject({ name: 'Root' });
  const frozen = async () => ({ ino: 1n, ctimeNs: 0n, mtimeNs: 0n, size: 0n });
  const counter = countingSpawn();
  const ledgers = new Ledgers({ workspace, stat: frozen, spawn: counter.spawn });
  await ledgers.get(project.id);
  for (const root of ['', '.']) {
    counter.calls.length = 0;
    for (const listener of workspace._commitListeners) listener(project.id, { paths: [root] });
    await ledgers.get(project.id);
    assert.deepEqual(counter.calls, ['rev-parse', 'symbolic-ref', 'rev-list'], JSON.stringify(root));
  }
  ledgers.close();
});

test('memo: an invalid or unknown project id leaves no entry behind', async () => {
  const workspace = await openWorkspace();
  const ledgers = new Ledgers({ workspace });
  await assert.rejects(ledgers.get('../escape'), /Project not found/);
  await assert.rejects(ledgers.get('00000000-0000-4000-8000-000000000000'));
  ledgers.invalidate('00000000-0000-4000-8000-000000000001');
  assert.equal(ledgers._entries.size, 0);
  assert.equal(ledgers.building('../escape'), null);
  ledgers.close();
});

test('fabricate: a run that fails leaves the fabrication usable for later runs', async () => {
  const fabrication = await fabricate(path.join(await scratch(), 'repo'), 'day 0 09:00 ade: create T001 backlog "A"');
  await assert.rejects(fabrication.run('day 1 09:00 ade: create T002 backlog "B"\nday 2 09:00 ade: frobnicate T002'), /unknown operation frobnicate/);
  await assert.rejects(fabrication.run('day 1 09:00 ade: create T002 backlog "B" label=lost\nbranch side\nday 2 09:00 ade: set T009 {"priority": "high"}'), /no task T009/);
  await fabrication.run('day 3 09:00 ade: create T003 backlog "C" label=after');
  const ledger = await buildLedger(fabrication.dir);
  assert.deepEqual(Object.keys(ledger.tasks).sort(), ['T001', 'T003']);
  assert.equal(ledger.commits.at(-1).sha, fabrication.sha('after'));
  assert.throws(() => fabrication.sha('lost'));
  assert.equal(fabrication.current, 'main');
});

test('real API: create → in progress → done through Workspace gives the expected transitions', async () => {
  const workspace = await openWorkspace();
  const ui = { trailers: { 'AGESight-Via': 'ui' } };
  const project = await workspace.createProject({ name: 'Real' }, ui);
  let task = await workspace.createTask({ projectId: project.id, title: 'Real task', type: 'feature' }, ui);
  task = await workspace.updateTask(task.id, { version: task.version, status: 'in_progress' }, ui);
  await workspace.updateTask(task.id, { version: task.version, status: 'done' }, ui);
  const ledgers = new Ledgers({ workspace });
  const ledger = await ledgers.get(project.id);
  ledgers.close();

  assert.deepEqual(ledger.transitions.filter((transition) => transition.kind === 'project').map((transition) => [transition.change, transition.to]), [['created', 'Real']]);
  const list = of(ledger, 'T001');
  assert.deepEqual(list.map((transition) => transition.kind === 'field' ? ['field', transition.field, transition.from] : shape(transition)), [
    ['created'],
    ['status', 'backlog', 'in_progress', { operator: 'ade', profile: 'agesight', session: 'web' }],
    ['field', 'owner', ''],
    ['status', 'in_progress', 'done'],
  ]);
  assert.ok(list.every((transition) => transition.via === 'ui' && transition.actor === 'ade'));
  assert.equal(isUiClaim(ledger.tasks.T001.owner), true);
  assert.equal(ledger.tasks.T001.typeKey, 'feature');
  assert.notEqual(ledger.branch, '(detached)');
  assert.deepEqual(ledger.anomalies, [], 'the checkpoint schema file is not an unsafe path');
});

test('the ledger reads no clock: time is always an input', async () => {
  const source = await readFile(new URL('../lib/history.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /Date\.now\(|new Date\(\)/);
});

test('project metadata: creation, renames, WIP limits, other edits, and pipeline saves are project transitions', async () => {
  const { ledger } = await fabricated(`
    day 0 09:00 ade: project {"name": "Atlas", "wipLimit": 3}
    day 1 09:00 ade: project {"name": "Atlas 2"}
    day 2 09:00 ade: project {"wipLimit": 4}
    day 3 09:00 ade: project {"description": "Now with a description"}
    day 4 09:00 ade: write pipeline/pipeline.json "{}"
  `);
  assert.deepEqual(ledger.transitions.filter((transition) => transition.kind === 'project').map((transition) => [transition.change, transition.from ?? null, transition.to ?? null]), [
    ['created', null, 'Atlas'], ['renamed', 'Atlas', 'Atlas 2'], ['wipLimit', 3, 4], ['edited', null, null], ['pipeline', null, null],
  ]);
});

// --- tracked repositories: the board's paths, under either name -------------------

// A tracked repository's ledger, as Ledgers builds it for one: BOARD_PATHS.
async function boardLedger(script) {
  const fabrication = await fabricate(path.join(await scratch(), 'repo'), script);
  return { fabrication, ledger: await buildLedger(fabrication.dir, { paths: BOARD_PATHS, backlogFolder: false }) };
}

// A task file as an agent writes it on a legacy board, as a script string
// for `write`: no backlog/ folder, so unclaimed work waits in tasks/ marked open.
function boardFile(id, title, { status, owner = '—' }) {
  return JSON.stringify(`---\nid: ${id}\ntitle: ${title}\nstatus: ${status}\nowner: ${owner}\ncreated: 2026-09-01\n---\n\n# ${id} — ${title}\n\n## Goal\n\nImport the archive.\n`);
}

test('tracked board: a pm/ → deaddrop/ rename in one commit is a move, so the task keeps one history and is never created twice', async () => {
  const claimed = boardFile('T001', 'Importer', { status: 'claimed', owner: CLAIM });
  const { fabrication, ledger } = await boardLedger(`
    day 0 09:00 ade: write pm/tasks/T001-importer.md ${boardFile('T001', 'Importer', { status: 'open' })} subject="Add T001"
    day 1 09:00 ade: write pm/tasks/T001-importer.md ${claimed} subject="Claim T001" label=claim
    day 2 09:00 ade: write deaddrop/tasks/T001-importer.md ${claimed} subject="migrate: rename pm/ to deaddrop/" label=rename
    + delete pm/tasks/T001-importer.md
    day 3 09:00 ade: write deaddrop/tasks/done/T001-importer.md ${boardFile('T001', 'Importer', { status: 'done', owner: CLAIM })} subject="Finish T001" label=finish
    + delete deaddrop/tasks/T001-importer.md
  `);
  assert.deepEqual(of(ledger, 'T001').map(shape), [
    ['created'],
    ['status', 'backlog', 'in_progress', AGENT],
    ['field', 'owner', '', CLAIM],
    ['status', 'in_progress', 'done'],
  ]);
  assert.deepEqual(Object.keys(ledger.tasks), ['T001']);
  assert.equal(ledger.tasks.T001.present, true);
  assert.deepEqual(ledger.anomalies, []);
  const rename = ledger.commits.find((commit) => commit.sha === fabrication.sha('rename'));
  assert.deepEqual(rename.touched, ['T001'], 'the rename follows the task to its new path');
  assert.equal(of(ledger, 'T001').at(-1).path, 'deaddrop/tasks/done/T001-importer.md');
  const [cycle] = cycles(ledger).T001;
  assert.deepEqual([cycle.start.commit, cycle.end.commit, cycle.excluded], [fabrication.sha('claim'), fabrication.sha('finish'), '']);
});

test('tracked board: a legacy task created status: open in tasks/ starts in backlog, and its cycle starts when it is claimed', async () => {
  const { fabrication, ledger } = await boardLedger(`
    day 0 09:00 ade: write pm/tasks/T001-importer.md ${boardFile('T001', 'Importer', { status: 'open' })} label=create
    day 2 09:00 ade: write pm/tasks/T001-importer.md ${boardFile('T001', 'Importer', { status: 'claimed', owner: CLAIM })} label=claim
    day 5 09:00 ade: write pm/tasks/done/T001-importer.md ${boardFile('T001', 'Importer', { status: 'done', owner: CLAIM })} label=finish
    + delete pm/tasks/T001-importer.md
  `);
  const [created, claim] = of(ledger, 'T001');
  assert.equal(created.snapshot.status, 'backlog');
  assert.equal(created.claimant, undefined, 'nobody claims a task by adding it');
  assert.deepEqual(shape(claim), ['status', 'backlog', 'in_progress', AGENT]);
  const [cycle] = cycles(ledger).T001;
  assert.deepEqual(cycle.begin, { seq: 0, at: '2026-09-01T09:00:00+01:00', commit: fabrication.sha('create'), kind: 'created' });
  assert.deepEqual(cycle.start, { seq: 1, at: '2026-09-03T09:00:00+01:00', commit: fabrication.sha('claim'), source: 'entry' });
  assert.deepEqual(cycle.claimant, AGENT);
  assert.deepEqual([cycle.end.commit, cycle.outcome], [fabrication.sha('finish'), 'done']);
});

test('tracked board: the repository\'s own project.json is not AGE Aris\'s, so its changes never reach the ledger', async () => {
  const fabrication = await fabricate(path.join(await scratch(), 'repo'), `
    day 0 08:00 ade: project {"name": "Their app", "version": "1.0.0"}
    day 1 09:00 ade: create T001 backlog "Importer"
    day 2 09:00 ade: project {"name": "Their app, renamed", "wipLimit": 2} label=manifest
    day 3 09:00 ade: move T001 tasks {"owner": "${CLAIM}"} label=claim
    + project {"version": "1.1.0"}
    day 4 09:00 ade: project {"version": "1.2.0"} label=later
  `);
  const workspace = await openWorkspace();
  const project = await workspace.linkProject({ path: fabrication.dir });
  const ledgers = new Ledgers({ workspace });
  const ledger = await ledgers.get(project.id);
  ledgers.close();

  assert.deepEqual(ledger.transitions.filter((transition) => transition.kind === 'project'), []);
  assert.deepEqual(of(ledger, 'T001').map(shape), [['created'], ['status', 'backlog', 'in_progress', AGENT], ['field', 'owner', '', CLAIM]]);
  assert.ok(!ledger.commits.some((commit) => commit.sha === fabrication.sha('manifest')), 'a commit touching only project.json is not read');
  assert.equal(ledger.ledgerSha, fabrication.sha('claim'), 'the last commit touching the board');
  assert.equal(ledger.headSha, fabrication.sha('later'));
  // Read as an AGE Aris project, the same history has project transitions.
  const own = await buildLedger(fabrication.dir);
  assert.deepEqual(own.transitions.filter((transition) => transition.kind === 'project').map((transition) => transition.change), ['created', 'renamed', 'wipLimit', 'edited', 'edited']);
});
