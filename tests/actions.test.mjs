import assert from 'node:assert/strict';
import test from 'node:test';

import { actionFor, actionRequest, availability, CAPABILITIES, holderKind, inputFor, projectKind, TASK_ACTIONS, WHY } from '../public/actions.js';

const OPERATOR = 'adervark';
const STATUSES = ['backlog', 'in_progress', 'blocked', 'done'];
const NEEDS = new Set([null, 'reason', 'result', 'choice']);

// The four kinds of holder, as the API shows them: `holder` is the owner line's
// operator, profile and session, and `claim` names an agent session.
const HOLDERS = {
  unclaimed: { holder: { operator: '', profile: '', session: '' }, claim: '' },
  self: { holder: { operator: OPERATOR, profile: 'agesight', session: 'web' }, claim: '' },
  agent: { holder: { operator: OPERATOR, profile: 'k', session: 'b6192924' }, claim: `${OPERATOR} @k/b6192924` },
  other: { holder: { operator: 'someone-else', profile: 'k', session: '0f0f0f0f' }, claim: 'someone-else @k/0f0f0f0f' },
};

const task = (status, holder = 'unclaimed', extra = {}) => ({ id: 'p1:T001', status, version: 'v1', priority: 'medium', assignee: '', ...HOLDERS[holder], ...extra });
const NATIVE = { id: 'p1', wipLimit: 3 };
// A tracked AA board, in its two layouts and with task actions off or on, as
// the API sends it.
const OFF = 'Task actions are off for Theirs. Switch them on in the project header.';
const tracked = (on, backlogFolder, wipLimit = 0) => ({
  id: 'p2', linked: true, backlogFolder, wipLimit,
  actions: on ? { on: true, branch: 'main', reason: '', operator: OPERATOR } : { on: false, branch: '', reason: OFF },
});
const byId = (entries) => Object.fromEntries(entries.map((entry) => [entry.id, entry]));
const ask = (t, project, options = {}) => byId(availability(t, project, { operator: OPERATOR, ...options }));

test('the registry has no duplicate ids or keys, and every input an action needs is named', () => {
  assert.equal(new Set(TASK_ACTIONS.map((action) => action.id)).size, TASK_ACTIONS.length);
  assert.equal(new Set(TASK_ACTIONS.map((action) => action.key)).size, TASK_ACTIONS.length);
  for (const action of TASK_ACTIONS) {
    assert.ok(action.label && action.icon && action.key.length === 1, action.id);
    assert.ok(NEEDS.has(action.needs), action.id);
    if (action.needs) assert.ok(action.field, `${action.id} asks for input but names no field`);
    if (action.capability) assert.ok('fields' in CAPABILITIES.native, action.id);
  }
});

test('project kind × column × holder: native projects allow what the column allows, except for another operator\'s task', () => {
  const expected = {
    backlog: ['start', 'block', 'done', 'priority', 'assign'],
    in_progress: ['block', 'done', 'release', 'priority', 'assign'],
    blocked: ['unblock', 'done', 'release', 'priority', 'assign'],
    done: ['reopen', 'block', 'release', 'priority', 'assign'],
  };
  for (const status of STATUSES) {
    for (const holder of Object.keys(HOLDERS)) {
      const entries = ask(task(status, holder), NATIVE);
      assert.deepEqual(Object.values(entries).filter((entry) => entry.relevant).map((entry) => entry.id), expected[status], `${status} ${holder}`);
      for (const entry of Object.values(entries)) {
        assert.equal(entry.enabled, !entry.why, `${entry.id} enabled exactly when it has no reason`);
        if (!entry.relevant) assert.equal(entry.enabled, false, `${entry.id} is not offered in ${status}`);
        else if (holder === 'other') {
          assert.equal(entry.enabled, false, `${entry.id} on ${status} held by another operator`);
          assert.match(entry.why, /someone-else holds this task/);
        } else assert.equal(entry.enabled, true, `${entry.id} on ${status} ${holder}`);
      }
    }
  }
});

test('the four kinds of holder are told apart', () => {
  for (const [kind, fields] of Object.entries(HOLDERS)) assert.equal(holderKind({ status: 'backlog', ...fields }, OPERATOR), kind);
  assert.equal(holderKind(HOLDERS.agent, ''), 'agent', 'without a known operator nobody is another');
  assert.equal(holderKind({ holder: { operator: OPERATOR, profile: '', session: '' } }, OPERATOR), 'agent', 'a claim of the operator\'s that names no session');
  assert.equal(holderKind({ holder: { operator: 'someone-else', profile: 'agesight', session: 'web' } }, OPERATOR), 'other');
  assert.equal(holderKind({}, OPERATOR), 'unclaimed');
});

test('tracked boards: every action is disabled with the switch off, in both layouts, with the reason the API gives', () => {
  for (const backlogFolder of [true, false]) {
    for (const status of STATUSES) {
      for (const entry of availability(task(status), tracked(false, backlogFolder), { operator: OPERATOR })) {
        assert.equal(entry.enabled, false, `${entry.id} ${status}`);
        if (entry.relevant) assert.equal(entry.why, OFF);
      }
    }
  }
  // A project read without its actions (unavailable) falls back to the plain reason.
  assert.equal(ask(task('backlog'), { id: 'p3', linked: true }).start.why, WHY.tracked);
});

test('tracked boards with the switch on: AA\'s actions by column (§4), Claim for Start, and Priority, Assign and Reopen disabled with their reasons, in both layouts and for every holder but another operator', () => {
  const expected = { backlog: ['start'], in_progress: ['block', 'done', 'release'], blocked: ['unblock', 'done', 'release'], done: [] };
  for (const backlogFolder of [true, false]) {
    const project = tracked(true, backlogFolder);
    for (const status of STATUSES) {
      for (const holder of ['unclaimed', 'self', 'agent']) {
        const entries = ask(task(status, holder), project);
        assert.deepEqual(Object.values(entries).filter((entry) => entry.relevant && entry.enabled).map((entry) => entry.id), expected[status], `${status} ${holder}`);
        for (const id of ['priority', 'assign']) assert.deepEqual([entries[id].enabled, entries[id].why], [false, 'AA is pull-based: claim it or leave it in the queue']);
        assert.equal(entries.start.label, 'Claim');
      }
      const reopen = ask(task('done'), project).reopen;
      assert.deepEqual([reopen.relevant, reopen.enabled, reopen.why], [true, false, WHY.reopen]);
      for (const entry of availability(task(status, 'other'), project, { operator: OPERATOR })) assert.equal(entry.enabled, false);
    }
  }
  assert.equal(ask(task('backlog'), NATIVE).start.label, 'Start');
});

test('tracked boards: a live run disables every action with its own words, and a claim waits for the WIP limit', () => {
  const liveRun = { id: '2e8b687e', text: 'Run 2e8b687e on T001 last wrote `doing: fold 0` 12 min ago and has not ended.' };
  for (const entry of availability(task('in_progress', 'agent', { liveRun }), tracked(true, true), { operator: OPERATOR }).filter((candidate) => candidate.relevant)) {
    assert.equal(entry.enabled, false);
    if (!['priority', 'assign'].includes(entry.id)) assert.equal(entry.why, `${liveRun.text} Every action waits for it to end.`);
  }
  const full = ask(task('backlog'), tracked(true, true, 2), { wipCount: 2 });
  assert.match(full.start.why, /WIP limit of 2 reached/);
  assert.equal(ask(task('backlog'), tracked(true, true, 2), { wipCount: 1 }).start.enabled, true);
});

test('what an action asks for: Block\'s reason is optional on AGE Aris projects and required on AA boards; Done asks for a Result line only while it is a placeholder', () => {
  assert.deepEqual(inputFor('block', task('in_progress'), NATIVE), { needs: 'reason', field: 'blockedReason', required: false });
  assert.deepEqual(inputFor('block', task('in_progress'), tracked(true, true)), { needs: 'reason', field: 'blockedReason', required: true });
  assert.equal(inputFor('done', task('in_progress'), NATIVE), null);
  assert.equal(inputFor('done', task('in_progress', 'self', { resultPending: false }), tracked(true, true)), null);
  assert.deepEqual(inputFor('done', task('in_progress', 'self', { resultPending: true }), tracked(true, true)), { needs: 'result', field: 'result', required: true });
  assert.equal(inputFor('start', task('backlog'), tracked(true, true)), null);
  assert.deepEqual(inputFor('priority', task('backlog'), NATIVE), { needs: 'choice', field: 'priority', required: false });
});

test('allowing Priority and Assign on AA boards is a data change', () => {
  const saved = CAPABILITIES.aa.fields;
  CAPABILITIES.aa.fields = true;
  try {
    const entries = ask(task('backlog'), tracked(true, true));
    assert.equal(entries.priority.enabled, true);
    assert.equal(entries.assign.enabled, true);
  } finally { CAPABILITIES.aa.fields = saved; }
});

test('the WIP limit disables the actions that take a task into progress or blocked', () => {
  const full = { wipCount: 3 };
  const backlog = ask(task('backlog'), NATIVE, full);
  for (const id of ['start', 'block']) {
    assert.equal(backlog[id].enabled, false, id);
    assert.match(backlog[id].why, /WIP limit of 3 reached/);
  }
  assert.equal(backlog.done.enabled, true);
  // A task already in progress or blocked does not add to the count.
  assert.equal(ask(task('blocked'), NATIVE, full).unblock.enabled, true);
  assert.equal(ask(task('in_progress'), NATIVE, full).block.enabled, true);
  assert.equal(ask(task('backlog'), NATIVE, { wipCount: 2 }).start.enabled, true);
  assert.equal(ask(task('backlog'), { id: 'p1', wipLimit: 0 }, full).start.enabled, true, 'no limit set');
});

test('project kind', () => {
  assert.equal(projectKind(NATIVE), 'native');
  assert.equal(projectKind(tracked(false, true)), 'aa');
  assert.equal(projectKind(undefined), 'native');
});

test('a column change maps to the one action that makes it', () => {
  for (const from of STATUSES) {
    for (const to of STATUSES) {
      const action = actionFor(from, to);
      if (from === to || (from === 'done' && to === 'done')) { assert.equal(action, null); continue; }
      assert.ok(action, `${from} to ${to}`);
      assert.equal(action.to, to);
    }
  }
  assert.equal(actionFor('backlog', 'in_progress').id, 'start');
  assert.equal(actionFor('blocked', 'in_progress').id, 'unblock');
  assert.equal(actionFor('in_progress', 'backlog').id, 'release');
  assert.equal(actionFor('done', 'blocked').id, 'block');
  // On an AA board only §4's moves exist: no reopen, and no block from the queue or done/.
  assert.equal(actionFor('backlog', 'in_progress', 'aa').id, 'start');
  assert.equal(actionFor('in_progress', 'blocked', 'aa').id, 'block');
  assert.equal(actionFor('blocked', 'done', 'aa').id, 'done');
  for (const [from, to] of [['done', 'in_progress'], ['backlog', 'blocked'], ['backlog', 'done'], ['done', 'backlog']]) assert.equal(actionFor(from, to, 'aa'), null, `${from} to ${to}`);
});

test('requests on an AA board: POST /tasks/:id/actions with the AA action, its line, the version and a confirmation token', () => {
  const t = { ...task('in_progress'), id: 'p2:T012' };
  const project = tracked(true, false);
  const post = (id, input, options) => {
    const request = actionRequest(id, t, input, project, options);
    assert.deepEqual([request.method, request.path], ['POST', '/tasks/p2%3AT012/actions']);
    return request.body;
  };
  assert.deepEqual(post('start'), { action: 'claim', version: 'v1' });
  assert.deepEqual(post('block', ' waiting on keys '), { action: 'block', version: 'v1', reason: 'waiting on keys' });
  assert.deepEqual(post('done', 'shipped'), { action: 'done', version: 'v1', result: 'shipped' });
  assert.deepEqual(post('done', ''), { action: 'done', version: 'v1' });
  assert.deepEqual(post('release', undefined, { confirm: 'abc' }), { action: 'release', version: 'v1', confirm: 'abc' });
});

test('requests: PATCH /tasks/:id with the task\'s version and only the fields the action sets', () => {
  const t = { ...task('backlog'), id: 'p1:T007' };
  const expectBody = (id, input, body) => {
    const request = actionRequest(id, t, input);
    assert.equal(request.method, 'PATCH');
    assert.equal(request.path, '/tasks/p1%3AT007');
    assert.deepEqual(request.body, { ...body, version: 'v1' });
  };
  expectBody('start', undefined, { status: 'in_progress' });
  expectBody('unblock', undefined, { status: 'in_progress' });
  expectBody('reopen', undefined, { status: 'in_progress' });
  expectBody('done', undefined, { status: 'done' });
  expectBody('release', undefined, { status: 'backlog' });
  expectBody('block', '  waiting on Ops  ', { status: 'blocked', blockedReason: 'waiting on Ops' });
  expectBody('block', '', { status: 'blocked', blockedReason: '' });
  expectBody('block', undefined, { status: 'blocked', blockedReason: '' });
  expectBody('priority', 'urgent', { priority: 'urgent' });
  expectBody('assign', ' Ada ', { assignee: 'Ada' });
  expectBody('assign', '', { assignee: '' });
});

test('requests refuse an unknown action and a priority that is not one', () => {
  assert.throws(() => actionRequest('delete', task('backlog')), /Unknown action/);
  assert.throws(() => actionRequest('priority', task('backlog'), 'critical'), /Choose low, medium, high or urgent/);
  assert.throws(() => actionRequest('priority', task('backlog')), /Choose/);
});
