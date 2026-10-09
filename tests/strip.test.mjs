import assert from 'node:assert/strict';
import test from 'node:test';

import { MIN_W, ageScale, flowStrip } from '../public/strip.js';

const P = 'p1';
const week = (counts) => counts.map((n, index) => ({ date: `2026-10-0${3 + index}`, n }));

// The task markers a strip draws: [kind, id, cx] in drawing order.
function markers(html) {
  return [...html.matchAll(/<g class="strip-task strip-(\w+)"[^>]*data-id="([^"]*)"[^>]*>(?:<title>[^<]*<\/title>)<circle cx="([\d.-]+)"/g)].map(([, kind, id, x]) => [kind, id, Number(x)]);
}

function svgWidth(html) {
  return Number(html.match(/<svg[^>]* width="(\d+)"/)[1]);
}

test('a strip names each stretch with its count, and says the whole of it in words', () => {
  const html = flowStrip({
    projectId: P, name: 'AGE Aris', wipLimit: 2,
    backlog: [{ taskKey: 'T003', title: 'Track it' }, { taskKey: 'T004', title: 'One copy' }],
    wip: [{ taskKey: 'T044', title: 'Strips', status: 'in_progress', age: 0.2, level: 'ok' }, { taskKey: 'T045', title: 'Stuck', status: 'blocked', age: 1, level: 'aging' }],
    days: week([0, 0, 0, 0, 7, 26, 6]), serviceLevel: 0.009,
  }, { width: 900 });
  for (const name of ['Backlog', 'In progress', 'Blocked', 'Done this week']) assert.match(html, new RegExp(`>${name}<tspan`));
  assert.match(html, />1 of 2<\/tspan>/, 'In progress states its limit');
  assert.match(html, /aria-label="AGE Aris: 2 in the backlog, 1 in progress of a limit of 2, 1 blocked, 39 done this week"/);
  assert.match(html, /85% finish within 13 min/, 'the service level reads in the numbers’ words');
  assert.doesNotMatch(html, /style=/, 'no inline style under the CSP');
  assert.doesNotMatch(html, /·/, 'no middle-dot strings');
  assert.deepEqual(markers(html).map(([kind, id]) => [kind, id]), [['queued', 'p1:T003'], ['queued', 'p1:T004'], ['ok', 'p1:T044'], ['blocked', 'p1:T045']]);
  assert.equal((html.match(/data-action="open-task"/g) || []).length, 4, 'every task marker opens its task');
  assert.equal((html.match(/tabindex="0"/g) || []).length, 4, 'and is reachable by keyboard');
});

test('task text is escaped and a reopened task opens by its file id', () => {
  const html = flowStrip({ projectId: P, name: '<b>x</b>', backlog: [{ taskKey: 'T9', title: '<img src=x onerror=alert(1)>' }], wip: [{ taskKey: 'T120#2', title: '"quoted"', status: 'in_progress', age: 0.5, level: 'ok' }] });
  assert.doesNotMatch(html, /<img|<b>/);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(html, /&quot;quoted&quot;/);
  assert.match(html, /data-id="p1:T120"/);
});

test('work in progress sits at its age: older further along, levels as classes, all inside its stretch', () => {
  const wip = [
    { taskKey: 'A', title: 'a', status: 'in_progress', age: 2 / 1440, level: 'ok' },
    { taskKey: 'B', title: 'b', status: 'in_progress', age: 0.5, level: 'aging' },
    { taskKey: 'C', title: 'c', status: 'in_progress', age: 9, level: 'critical' },
  ];
  const html = flowStrip({ projectId: P, name: 'x', wip, serviceLevel: 0.4 }, { width: 1000 });
  const drawn = markers(html);
  assert.deepEqual(drawn.map(([kind]) => kind), ['ok', 'aging', 'critical']);
  assert.ok(drawn[0][2] < drawn[1][2] && drawn[1][2] < drawn[2][2], JSON.stringify(drawn));
  assert.ok(drawn.every(([, , x]) => x > 200 && x < 540), 'In progress runs from 20% to 54% of the track');
  assert.match(html, /class="strip-level"/);
  assert.match(html, /class="strip-level-twice"/);
  assert.match(html, /aria-label="C c: 9.0 d in progress, past twice the service level"/);
  // The scale: a minute at the gate, the oldest short of the far end.
  const x = ageScale({ from: 0, to: 100, ages: [9], serviceLevel: 0.4 });
  assert.equal(x(1 / 1440), 0);
  assert.ok(x(9) < 100 && x(0.4) < x(0.8));
});

test('over the WIP limit the track turns red; at it, it does not', () => {
  const wip = (n) => Array.from({ length: n }, (_, index) => ({ taskKey: `T${index}`, title: 't', status: index ? 'in_progress' : 'blocked', age: 0.1, level: 'ok' }));
  const over = flowStrip({ projectId: P, name: 'x', wipLimit: 2, wip: wip(3) });
  assert.match(over, /class="strip-track-over"/);
  assert.match(over, /class="strip-count is-over"/);
  const at = flowStrip({ projectId: P, name: 'x', wipLimit: 2, wip: wip(2) });
  assert.doesNotMatch(at, /strip-track-over|is-over/);
  assert.doesNotMatch(flowStrip({ projectId: P, name: 'x', wip: wip(9) }), /strip-track-over/, 'no limit, no red');
});

test('done this week is a column a day, today last; a day with more than fits says how many', () => {
  const html = flowStrip({ projectId: P, name: 'x', days: week([1, 0, 2, 0, 0, 3, 1]) }, { width: 1200 });
  assert.equal((html.match(/<g class="strip-day">/g) || []).length, 7);
  assert.deepEqual([...html.matchAll(/class="strip-weekday"[^>]*>(\w+)</g)].map(([, day]) => day), ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Today']);
  assert.equal((html.match(/<g class="strip-day"><title>[^<]*<\/title>(<circle[^>]*\/>)*/g) || []).join('').split('<circle').length - 1, 7, 'a dot per finish');
  // A busy day shrinks the dots before it gives up and counts.
  const busy = flowStrip({ projectId: P, name: 'x', days: week([0, 0, 0, 0, 7, 26, 6]) }, { width: 740, height: 118 });
  assert.equal(busy.split('<circle').length - 1, 39);
  assert.doesNotMatch(busy, /class="strip-note"[^>]*>26</);
  const full = flowStrip({ projectId: P, name: 'x', days: week([0, 0, 0, 0, 0, 0, 400]) }, { width: 700, height: 110 });
  assert.match(full, /class="strip-note"[^>]*>400</);
  assert.match(full, /<title>Today 2026-10-09: 400 finished<\/title>/);
});

test('an empty board still draws its track and says nothing is in progress', () => {
  const html = flowStrip({ projectId: P, name: 'x' });
  assert.match(html, /Nothing in progress/);
  assert.doesNotMatch(html, /strip-level|strip-task/);
  assert.match(html, /aria-label="x: 0 in the backlog, 0 in progress, 0 blocked, 0 done this week"/);
});

test('a strip is drawn at its width, down to a minimum below which it scrolls', () => {
  assert.equal(svgWidth(flowStrip({ projectId: P, name: 'x' }, { width: 1834 })), 1834);
  assert.equal(svgWidth(flowStrip({ projectId: P, name: 'x' }, { width: 320 })), MIN_W);
  assert.match(flowStrip({ projectId: P, name: 'x' }), /^<div class="strip-scroll">/);
});

test('a backlog longer than its stretch counts the rest', () => {
  const backlog = Array.from({ length: 200 }, (_, index) => ({ taskKey: `T${index}`, title: 't' }));
  const html = flowStrip({ projectId: P, name: 'x', backlog }, { width: 600 });
  const drawn = markers(html).length;
  assert.ok(drawn > 0 && drawn < 200);
  assert.match(html, new RegExp(`>${200 - drawn} more not drawn<`));
  assert.ok(markers(html).every(([, , x]) => x > 0), 'no ring falls off the left edge');
});
