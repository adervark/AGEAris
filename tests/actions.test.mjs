import assert from 'node:assert/strict';
import test from 'node:test';

import { actionFor, actionRequest, availability, CAPABILITIES, holderKind, projectKind, TASK_ACTIONS, WHY } from '../public/actions.js';

const OPERATOR = 'adervark';
const STATUSES = ['backlog', 'in_progress', 'blocked', 'done'];
const NEEDS = new Set([null, 'reason', 'result', 'choice']);

// The four kinds of holder, as the API shows a task's claim.
const HOLDERS = {
  unclaimed: {},
  self: { holder: { operator: OPERATOR, profile: 'agesight', session: 'web' } },
  agent: { claim: `${OPERATOR} @k/b6192924` },
  other: { claim: 'someone-else @k/0f0f0f0f' },
};

const task = (status, holder = 'unclaimed') => ({ id: 'p1:T001', status, version: 'v1', priority: 'medium', assignee: '', ...HOLDERS[holder] });
const NATIVE = { id: 'p1', wipLimit: 3 };
// A tracked AA board, in its two layouts and with the write switch off or on.
const tracked = (trackedWrites, backlogFolder) => ({ id: 'p2', linked: true, trackedWrites, backlogFolder });
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
  assert.equal(holderKind({ claim: `${OPERATOR} @k/1` }, ''), 'agent', 'without a known operator nobody is another');
  assert.equal(holderKind({ holder: { operator: 'someone-else', profile: 'agesight', session: 'web' } }, OPERATOR), 'other');
});

test('tracked boards: every action is disabled with the switch off, in both layouts', () => {
  for (const backlogFolder of [true, false]) {
    for (const status of STATUSES) {
      for (const entry of availability(task(status), tracked(false, backlogFolder), { operator: OPERATOR })) {
        assert.equal(entry.enabled, false, `${entry.id} ${status}`);
        assert.equal(entry.why, entry.relevant ? WHY.tracked : entry.why);
      }
    }
  }
});

test('tracked boards with the switch on: Priority and Assign stay disabled, with the AA reason, in both layouts', () => {
  for (const backlogFolder of [true, false]) {
    const project = tracked(true, backlogFolder);
    for (const status of STATUSES) {
      const entries = ask(task(status), project);
      for (const id of ['priority', 'assign']) {
        assert.equal(entries[id].enabled, false);
        assert.equal(entries[id].why, 'AA is pull-based: claim it or leave it in the queue');
      }
      // The movement actions follow the column, and the layout changes nothing here.
      assert.deepEqual(Object.values(entries).filter((entry) => entry.relevant && entry.enabled).map((entry) => entry.id), Object.values(ask(task(status), NATIVE)).filter((entry) => entry.relevant && !['priority', 'assign'].includes(entry.id)).map((entry) => entry.id));
    }
  }
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
