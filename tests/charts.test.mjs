import assert from 'node:assert/strict';
import test from 'node:test';

import { forecast } from '../lib/metrics.mjs';
import { agingChart, cycleChart, dateWords, forecastChart, swarm } from '../public/charts.js';

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

test('a crowd of zero-day cycle times stays inside the plot: no dot drops below the zero line (T033)', () => {
  const items = Array.from({ length: 40 }, (_, index) => ({ taskKey: `T${index}`, title: 'quick', days: 0, at: `2026-09-${String(10 + (index % 3)).padStart(2, '0')}T10:00:00Z` }));
  const svg = cycleChart({ window: { from: '2026-07-10T00:00:00Z', to: '2026-10-08T09:00:00Z' }, bands: { p50: 0, p70: 0.5, p85: 1, p95: 2, n: 40 }, items, excluded: 0, minSample: 5 }, { projectId: 'p' });
  const zero = Number(/<line class="chart-grid" x1="\d+" x2="\d+" y1="([\d.]+)" y2="[\d.]+"\/><text class="chart-tick" x="\d+" y="[\d.]+" text-anchor="end">0<\/text>/.exec(svg)[1]);
  assert.ok(dots(svg).every(([, y]) => y <= zero), 'every dot is at or above zero');
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
