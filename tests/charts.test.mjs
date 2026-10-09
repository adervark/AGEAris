import assert from 'node:assert/strict';
import test from 'node:test';

import { forecast } from '../lib/metrics.mjs';
import { agingChart, cycleChart, dateWords, duration, forecastChart, geometry, swarm, timeScale } from '../public/charts.js';

// The circles a chart draws: [cx, cy] of each dot's own circle (not its ring).
function dots(svg) {
  return [...svg.matchAll(/<g class="chart-dot[^>]*>(?:<title>[^<]*<\/title>)?(?:<circle class="dot-ring"[^>]*\/>)?<circle cx="([\d.-]+)" cy="([\d.-]+)"/g)].map(([, x, y]) => [Number(x), Number(y)]);
}

function apart(points, gap) {
  for (let a = 0; a < points.length; a += 1) {
    for (let b = a + 1; b < points.length; b += 1) {
      if (Math.hypot(points[a][0] - points[b][0], points[a][1] - points[b][1]) < gap) return false;
    }
  }
  return true;
}

const bands = { p50: 2, p70: 3, p85: 4, p95: 6, n: 30 };

test('aging dots never cover each other, even thirty at one age (T033)', () => {
  const items = Array.from({ length: 31 }, (_, index) => ({ taskKey: `T${100 + index}`, title: 'Same age', status: 'in_progress', age: 20, level: 'critical', stale: index % 2 === 0 }));
  const svg = agingChart({ bands, items, unstarted: 0, minSample: 5 }, { projectId: 'p' });
  const drawn = dots(svg);
  assert.equal(drawn.length, 31);
  assert.ok(apart(drawn, 12), 'every pair of dots is at least two radii apart');
  // The same data draws the same picture.
  assert.equal(agingChart({ bands, items, unstarted: 0, minSample: 5 }, { projectId: 'p' }), svg);
});

test('swarm keeps a lone dot where it belongs and moves only what would overlap', () => {
  assert.deepEqual(swarm([{ x: 100, y: 50 }], 60), [{ x: 100, y: 50 }]);
  const [first, second, third] = swarm([{ x: 100, y: 50 }, { x: 100, y: 50 }, { x: 100, y: 200 }], 60);
  assert.deepEqual(first, { x: 100, y: 50 });
  assert.notEqual(second.x, 100);
  assert.deepEqual(third, { x: 100, y: 200 }, 'a dot far away stays put');
});

test('the cycle-time axis never repeats a date, and its dots do not cover each other (T033)', () => {
  const items = [
    { taskKey: 'T1', title: 'a', days: 0, at: '2026-10-06T10:00:00Z' },
    { taskKey: 'T2', title: 'b', days: 0, at: '2026-10-06T10:05:00Z' },
    { taskKey: 'T3', title: 'c', days: 0.1, at: '2026-10-06T10:10:00Z' },
  ];
  const svg = cycleChart({ window: { from: '2026-07-10T00:00:00Z', to: '2026-10-08T09:00:00Z' }, bands: null, items, excluded: 0, minSample: 5 }, { projectId: 'p', timezone: 'Europe/London' });
  const ticks = [...svg.matchAll(/<text class="chart-tick" x="[\d.]+" y="\d+" text-anchor="[a-z]+">([^<]+)<\/text>/g)].map(([, text]) => text);
  assert.equal(new Set(ticks).size, ticks.length, `ticks: ${ticks.join(', ')}`);
  assert.ok(apart(dots(svg), 12));
});

test('a crowd of zero-day cycle times stays inside the plot: no dot drops below the bottom line (T033)', () => {
  const items = Array.from({ length: 40 }, (_, index) => ({ taskKey: `T${index}`, title: 'quick', days: 0, at: `2026-09-${String(10 + (index % 3)).padStart(2, '0')}T10:00:00Z` }));
  const svg = cycleChart({ window: { from: '2026-07-10T00:00:00Z', to: '2026-10-08T09:00:00Z' }, bands: { p50: 0, p70: 0.5, p85: 1, p95: 2, n: 40 }, items, excluded: 0, minSample: 5 }, { projectId: 'p' });
  const bottom = Math.max(...[...svg.matchAll(/<line class="chart-grid" x1="\d+" x2="\d+" y1="([\d.]+)"/g)].map(([, y]) => Number(y)));
  assert.ok(dots(svg).every(([, y]) => y <= bottom), 'every dot is at or above the bottom line');
});

test('durations read in minutes under an hour, hours under a day, then days (T038)', () => {
  assert.deepEqual([4 / 1440, 13 / 1440, 0.25, 0.9, 1, 2.44, 33.5].map(duration), ['4 min', '13 min', '6.0 h', '21.6 h', '1.0 d', '2.4 d', '33.5 d']);
});

test('time is drawn on a log scale, so minutes and weeks both spread over the plot (T038)', () => {
  const minutes = [1, 3, 4, 6, 7, 9, 13, 35, 48, 105, 120].map((m) => m / 1440);
  const scale = timeScale(minutes);
  assert.deepEqual(scale.ticks.map(([, label]) => label), ['1 min', '5 min', '15 min', '1 h', '4 h']);
  const ys = minutes.map(scale.y);
  const height = Math.max(...ys) - Math.min(...ys);
  assert.ok(height > 0.8 * (scale.y(scale.bottom) - scale.y(scale.top)), 'the dots use most of the height');
  // A spread from a minute to a month keeps its ticks in order, bottom to top.
  const wide = timeScale([0, 0.02, 1.6, 33.5]);
  assert.deepEqual(wide.ticks.map(([, label]) => label), ['1 min', '5 min', '15 min', '1 h', '4 h', '1 day', '1 week', '30 days', '90 days']);
  assert.ok(wide.ticks.every(([value], index, all) => !index || wide.y(value) < wide.y(all[index - 1][0])));
});

test('a chart is drawn at the width it is shown, so its text stays the page size; narrow, it scrolls (T038)', () => {
  const items = [{ taskKey: 'T1', title: 'a', days: 0.01, at: '2026-10-07T10:00:00Z' }, { taskKey: 'T2', title: 'b', days: 0.2, at: '2026-10-08T10:00:00Z' }];
  const chart = { window: { from: '2026-07-10T00:00:00Z', to: '2026-10-08T12:00:00Z' }, bands: null, items, excluded: 0, minSample: 5 };
  for (const width of [900, 3000]) {
    const svg = cycleChart(chart, { projectId: 'p', width });
    assert.match(svg, new RegExp(`viewBox="0 0 ${width} 260" width="${width}" height="260"`));
  }
  assert.equal(geometry(320).W, 650, 'below 650 px the chart keeps its size and scrolls');
});

test('a chart with nothing to draw is one line saying why, never an empty frame (T038)', () => {
  const aging = agingChart({ bands, items: [], unstarted: 0, minSample: 5 }, { projectId: 'p' });
  assert.match(aging, /^<p class="chart-pending"><strong>Aging work in progress<\/strong> Nothing is in progress or blocked\.<\/p>$/);
  const cycles = cycleChart({ window: { from: '2026-07-10T00:00:00Z', to: '2026-10-08T12:00:00Z' }, bands: null, items: [], excluded: 0, minSample: 5 }, { projectId: 'p' });
  assert.match(cycles, /^<p class="chart-pending">/);
  const young = forecastChart(forecast({ history: [7], open: 5, today: '2026-10-08', from: '2026-10-07', to: '2026-10-07' }));
  assert.match(young, /^<p class="chart-pending"><strong>Forecast<\/strong>/);
  assert.doesNotMatch(aging + cycles + young, /<figure|<svg/);
});

test('a forecast date outside this year says its year, and one inside does not (T033)', () => {
  const now = new Date('2026-10-08T12:00:00');
  assert.doesNotMatch(dateWords('2026-11-04', now), /2026/);
  assert.match(dateWords('2027-09-30', now), /2027/);
});

test('the forecast needs five finishes, as every flow measure does, and never promises "0 or more" (T033)', () => {
  const thin = forecast({ history: [1, ...Array(40).fill(0)], open: 9, today: '2026-10-08', from: '2026-08-28', to: '2026-10-07' });
  assert.deepEqual([thin.status, thin.minSample, thin.basis.finished], ['thin', 5, 1]);
  assert.match(forecastChart(thin), /Too little history to forecast from: 1 task finished in the last 41 days, and a forecast needs 5\./);
  assert.doesNotMatch(forecastChart(thin), /by |or more/);
  // Five finishes in 41 days: a forecast, where an unlucky fortnight says "possibly none".
  const slow = forecast({ history: [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0], open: 3, today: '2026-10-08' });
  assert.equal(slow.status, 'ok');
  const html = forecastChart(slow);
  assert.doesNotMatch(html, /\b0 or more/);
  if (slow.ahead.p95 === 0) assert.match(html, /possibly none/);
});

test('a forecast needs five whole days too: one busy day has no spread to sample (T035)', () => {
  const young = forecast({ history: [7], open: 5, today: '2026-10-08', from: '2026-10-07', to: '2026-10-07' });
  assert.deepEqual([young.status, young.short], ['thin', 'days']);
  const html = forecastChart(young);
  assert.match(html, /the board has one whole day of work behind it, and a forecast needs 5\./);
  assert.doesNotMatch(html, /or more|1 days/);
});

test('a board born today has no whole day to forecast from, and says so plainly (T035)', () => {
  const html = forecastChart(forecast({ history: [], open: 4, today: '2026-10-08' }));
  assert.match(html, /new today/);
  assert.doesNotMatch(html, /0 days|From .* to :/);
});
