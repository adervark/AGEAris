import assert from 'node:assert/strict';
import test from 'node:test';

import { buildThreads, visibleRows } from '../public/threads.js';

const task = (id, status, depends = []) => ({ id: `p:${id}`, status, depends, title: id });
const ids = (list) => list.map((entry) => entry.id.slice(2));

test('tasks group into threads by their first dependency; a task with no links stands alone', () => {
  const { threads, alone, place } = buildThreads([
    task('T001', 'done'), task('T002', 'done', ['T001']), task('T003', 'in_progress', ['T002']),
    task('T004', 'backlog', ['T001', 'T009']), task('T009', 'done'), task('T010', 'backlog'), task('T011', 'done', ['T404']),
  ]);
  assert.deepEqual(threads.map((thread) => [thread.root.id, ids(thread.tasks).sort(), ids(thread.open)]), [['p:T001', ['T001', 'T002', 'T003', 'T004'], ['T003', 'T004']]]);
  assert.deepEqual(ids(alone), ['T009', 'T010', 'T011'], 'a dependency not on the board does not make a thread');
  assert.deepEqual(ids(place.get('p:T004').alsoNeeds), ['T009']);
  assert.deepEqual(ids(place.get('p:T003').waitingOn), [], 'its dependency is done');
  assert.equal(place.get('p:T009').thread, null, 'a dependency elsewhere does not pull a task into the thread');
});

test('a chain stays at one depth and only a branch indents; open work shows with what it builds on, the rest folds', () => {
  const tasks = [task('T001', 'done'), task('T002', 'done', ['T001']), task('T003', 'done', ['T002']), task('T004', 'done', ['T003']), task('T005', 'blocked', ['T004']), task('T006', 'done', ['T004'])];
  const { threads, place } = buildThreads(tasks);
  const [thread] = threads;
  assert.deepEqual(thread.rows.map((row) => [row.task.id.slice(2), row.depth, row.link]), [
    ['T001', 0, 'root'], ['T002', 0, 'then'], ['T003', 0, 'then'], ['T004', 0, 'then'], ['T005', 1, 'branch'], ['T006', 1, 'branch'],
  ]);
  assert.deepEqual(visibleRows(thread, place).map((row) => row.fold ? `fold ${row.fold}` : row.task.id.slice(2)), ['T001', 'fold 2', 'T004', 'T005', 'fold 1']);
  assert.equal(visibleRows(thread, place, { expanded: true }).length, 6);
  assert.deepEqual(ids(place.get('p:T005').waitingOn), []);
});

test('open dependencies are waited on, threads with open work come first, and a dependency loop is cut once', () => {
  const { threads, place } = buildThreads([
    task('T001', 'done'), task('T002', 'done', ['T001']),
    task('T010', 'in_progress'), task('T011', 'backlog', ['T010']),
    task('T020', 'backlog', ['T021']), task('T021', 'backlog', ['T020']),
  ]);
  assert.deepEqual(threads.map((thread) => thread.root.id.slice(2)), ['T010', 'T020', 'T001'], 'open work first; the same amount of open work goes by number');
  assert.deepEqual(ids(place.get('p:T011').waitingOn), ['T010']);
  assert.deepEqual(threads[1].rows.map((row) => row.task.id.slice(2)), ['T020', 'T021'], 'the loop starts at its lowest number and each task shows once');
});

test('the Threads view escapes task titles, folds finished steps, and marks work waiting on an open dependency', async () => {
  const { renderThreads } = await import('../public/cockpit.js');
  const tasks = [
    task('T001', 'backlog'), { ...task('T002', 'in_progress', ['T001']), title: '<img src=x onerror=alert(1)>' },
    task('T003', 'done'), task('T004', 'done', ['T003']), task('T005', 'done', ['T004']), task('T006', 'blocked', ['T005']),
    task('T007', 'backlog'),
  ];
  const html = renderThreads(buildThreads(tasks), { signals: new Map(), expanded: new Set(), holder: () => '' });
  assert.doesNotMatch(html, /<img/);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(html, />Waiting on T001</);
  assert.match(html, /data-value="thread:p:T003">1 finished step</);
  assert.match(html, /Threads with open work<\/h2><span>2</);
  assert.match(html, /data-id="p:T007"/, 'an open task on its own is listed');
  assert.doesNotMatch(html, /style=/);
});
