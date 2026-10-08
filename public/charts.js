// The Flow tab's shapes: aging WIP and cycle times. Each is inline SVG (no
// library, and no inline styles under the page's CSP: colour comes from
// classes). Every dot is a task: it opens the task drawer on click, and on
// Enter or Space, since it is focusable with the role of a button.

import { escape } from './words.js';

const W = 760;
const H = 260;
const PAD = { top: 12, right: 132, bottom: 30, left: 44 };
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;
const R = 6;

const localId = (taskKey) => String(taskKey || '').split('#')[0];
const days = (value) => `${value} ${value === 1 ? 'day' : 'days'}`;

// The top of the y axis: a round number above the largest value shown.
function ceiling(values) {
  const max = Math.max(1, ...values);
  const step = max <= 5 ? 1 : max <= 20 ? 5 : max <= 60 ? 10 : 30;
  return Math.ceil((max * 1.08) / step) * step;
}

function ticks(top) {
  const step = top <= 5 ? 1 : top <= 20 ? 5 : top <= 60 ? 10 : 30;
  const out = [];
  for (let value = 0; value <= top; value += step) out.push(value);
  return out;
}

const yOf = (value, top) => PAD.top + PLOT_H - (Math.min(value, top) / top) * PLOT_H;

function yAxis(top) {
  return ticks(top).map((value) => {
    const y = yOf(value, top);
    return `<line class="chart-grid" x1="${PAD.left}" x2="${PAD.left + PLOT_W}" y1="${y}" y2="${y}"/><text class="chart-tick" x="${PAD.left - 8}" y="${y + 4}" text-anchor="end">${value}</text>`;
  }).join('');
}

// The 50th, 85th and 95th percentile lines across the plot, labelled in the
// right margin. Labels close together are pushed apart, keeping their order.
const LABEL_GAP = 18;

function percentileLines(bands, top) {
  const lines = [['p50', bands.p50], ['p85', bands.p85], ['p95', bands.p95]].map(([kind, value]) => ({ kind, value, y: yOf(value, top), at: yOf(value, top) }));
  // From the bottom (largest y) up: each label sits at least LABEL_GAP above the one below.
  for (let index = 1; index < lines.length; index += 1) lines[index].at = Math.min(lines[index].at, lines[index - 1].at - LABEL_GAP);
  const overTop = PAD.top + 4 - Math.min(...lines.map((line) => line.at));
  if (overTop > 0) for (const line of lines) line.at += overTop;
  return lines.map(({ kind, value, y, at }) => `<line class="chart-line chart-line-${kind}" x1="${PAD.left}" x2="${PAD.left + PLOT_W}" y1="${y}" y2="${y}"/><text class="chart-line-label chart-line-label-${kind}" x="${PAD.left + PLOT_W + 8}" y="${at + 5}">${escape(`${kind.slice(1)}% · ${days(value)}`)}</text>`).join('');
}

function dot({ x, y, kind, label, projectId, taskKey, ring = false }) {
  return `<g class="chart-dot dot-${kind}${ring ? ' dot-stale' : ''}" role="button" tabindex="0" data-action="open-task" data-id="${escape(`${projectId}:${localId(taskKey)}`)}" aria-label="${escape(label)}"><title>${escape(label)}</title>${ring ? `<circle class="dot-ring" cx="${x}" cy="${y}" r="${R + 4}"/>` : ''}<circle cx="${x}" cy="${y}" r="${R}"/></g>`;
}

// Places dots so none covers another: each moves sideways from where it
// belongs, nearest free spot first, within `room` of it (a beeswarm). Only
// when a whole row is taken does a dot move up or down a row; its label still
// says its exact value, and no row leaves the plot, so nothing reads as below
// zero. The order is fixed by the input, so the same data always draws the
// same picture.
export function swarm(points, room, { top = PAD.top + R, bottom = PAD.top + PLOT_H - R } = {}) {
  const placed = [];
  const gap = 2 * R + 2;
  const sideways = Math.floor(room / gap);
  const free = (x, y) => placed.every((other) => Math.hypot(other.x - x, other.y - y) >= gap);
  return points.map(({ x, y }) => {
    let spot = { x, y };
    search: for (let row = 0; row <= 6; row += 1) {
      const dy = (row % 2 ? -1 : 1) * Math.ceil(row / 2) * gap;
      if (row && (y + dy < top || y + dy > bottom)) continue;
      for (let step = 0; step <= sideways * 2; step += 1) {
        const dx = (step % 2 ? 1 : -1) * Math.ceil(step / 2) * gap;
        if (free(x + dx, y + dy)) { spot = { x: x + dx, y: y + dy }; break search; }
      }
    }
    placed.push(spot);
    return spot;
  });
}

function frame({ title, meaning, svg, label, note }) {
  return `<figure class="flow-chart"><figcaption>${escape(title)}<small>${escape(meaning)}</small></figcaption><div class="chart-scroll"><svg viewBox="0 0 ${W} ${H}" role="group" aria-label="${escape(label)}">${svg}</svg></div>${note ? `<p class="chart-note">${note}</p>` : ''}</figure>`;
}

const LEVEL_WORDS = { ok: 'within the service level', aging: 'past the service level', critical: 'past twice the service level', unknown: 'no service level yet' };
const COLUMN_WORDS = { in_progress: 'in progress', blocked: 'blocked' };

// Aging WIP: what is not moving. Columns are In progress and Blocked; height
// is the age since the cycle started; bands are past cycle times.
export function agingChart(chart, { projectId }) {
  if (!chart) return '';
  const title = 'Aging work in progress';
  const meaning = 'Each dot is an open task, by how long since it was claimed. Higher than the 85% line, it is older than most finished work ever got.';
  if (!chart.items.length) return frame({ title, meaning, svg: '', label: `${title}: nothing is in progress`, note: 'Nothing is in progress or blocked.' });
  const { bands } = chart;
  const top = ceiling([...chart.items.map((item) => item.age), ...(bands ? [bands.p95] : [])]);
  const columns = ['in_progress', 'blocked'];
  const columnW = PLOT_W / columns.length;
  let svg = '';
  if (bands) {
    // Zones under each percentile: the higher, the further past usual.
    const edges = [[0, bands.p50, 'zone-50'], [bands.p50, bands.p70, 'zone-70'], [bands.p70, bands.p85, 'zone-85'], [bands.p85, bands.p95, 'zone-95'], [bands.p95, top, 'zone-over']];
    svg += edges.filter(([from, to]) => to > from).map(([from, to, kind]) => `<rect class="chart-zone ${kind}" x="${PAD.left}" y="${yOf(to, top)}" width="${PLOT_W}" height="${yOf(from, top) - yOf(to, top)}"/>`).join('');
  }
  svg += yAxis(top);
  if (bands) svg += percentileLines(bands, top);
  svg += columns.map((column, index) => {
    const x = PAD.left + columnW * index + columnW / 2;
    const items = chart.items.filter((item) => item.status === column);
    const spots = swarm(items.map((item) => ({ x, y: yOf(item.age, top) })), columnW / 2 - R - 6);
    const header = `<text class="chart-column" x="${x}" y="${H - 8}" text-anchor="middle">${escape(`${column === 'blocked' ? 'Blocked' : 'In progress'} · ${items.length}`)}</text>`;
    return `${index ? `<line class="chart-divider" x1="${PAD.left + columnW * index}" x2="${PAD.left + columnW * index}" y1="${PAD.top}" y2="${PAD.top + PLOT_H}"/>` : ''}${header}${items.map((item, at) => dot({
      x: spots[at].x, y: spots[at].y, kind: item.level, ring: item.stale, projectId, taskKey: item.taskKey,
      label: `${localId(item.taskKey)} ${item.title}: ${days(item.age)} ${COLUMN_WORDS[column]}, ${LEVEL_WORDS[item.level]}${item.stale ? '; agent claim is stale' : ''}`,
    })).join('')}`;
  }).join('');
  svg += `<text class="chart-axis-title" x="12" y="${PAD.top + PLOT_H / 2}" transform="rotate(-90 12 ${PAD.top + PLOT_H / 2})" text-anchor="middle">days since claimed</text>`;
  const notes = [];
  if (!bands) notes.push(`Bands appear once ${chart.minSample} tasks have finished in the last 90 days.`);
  if (chart.items.some((item) => item.stale)) notes.push('A ring marks an agent claim with no recent sign of life.');
  if (chart.unstarted) notes.push(`${chart.unstarted} more ${chart.unstarted === 1 ? 'task has' : 'tasks have'} no recorded start and ${chart.unstarted === 1 ? 'is' : 'are'} not drawn.`);
  const late = chart.items.filter((item) => item.level === 'aging' || item.level === 'critical').length;
  return frame({ title, meaning, svg, label: `${title}: ${chart.items.length} open, ${late} past the service level`, note: escape(notes.join(' ')) });
}

// Cycle times: how long finished work took, over the last 90 days, with the
// percentile lines; the 85% line is the service level.
export function cycleChart(chart, { projectId, timezone }) {
  if (!chart) return '';
  const title = 'Cycle times';
  const meaning = 'Each dot is a finished task: when it finished, and how long it took from the claim. 85% of dots sit under the service level line.';
  if (!chart.items.length) return frame({ title, meaning, svg: '', label: `${title}: nothing finished`, note: 'Nothing with a recorded start finished in the last 90 days.' });
  const { bands } = chart;
  // The axis starts a day before the first finish, not at the window's edge,
  // so a young project's dots are not squeezed to one side.
  const to = Date.parse(chart.window.to);
  const from = Math.max(Date.parse(chart.window.from), Math.min(...chart.items.map((item) => Date.parse(item.at))) - 86_400_000);
  const span = Math.max(1, to - from);
  const xOf = (at) => PAD.left + ((Date.parse(at) - from) / span) * PLOT_W;
  const top = ceiling([...chart.items.map((item) => item.days), ...(bands ? [bands.p95] : [])]);
  let svg = yAxis(top);
  // Up to four date ticks across the axis, none repeated on a short span.
  let previous = '';
  for (let index = 0; index <= 3; index += 1) {
    const at = new Date(from + (span * index) / 3);
    const x = PAD.left + (PLOT_W * index) / 3;
    const text = at.toLocaleDateString(undefined, { month: 'short', day: 'numeric', ...(timezone ? { timeZone: timezone } : {}) });
    if (text === previous) continue;
    previous = text;
    svg += `<text class="chart-tick" x="${x}" y="${H - 8}" text-anchor="${index === 0 ? 'start' : index === 3 ? 'end' : 'middle'}">${escape(text)}</text>`;
  }
  if (bands) svg += percentileLines(bands, top);
  const spots = swarm(chart.items.map((item) => ({ x: xOf(item.at), y: yOf(item.days, top) })), 3 * (2 * R + 2));
  svg += chart.items.map((item, at) => dot({
    x: spots[at].x, y: spots[at].y, kind: bands && item.days > bands.p85 ? 'slow' : 'done', projectId, taskKey: item.taskKey,
    label: `${localId(item.taskKey)} ${item.title}: took ${days(item.days)}, finished ${new Date(item.at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', ...(timezone ? { timeZone: timezone } : {}) })}${bands && item.days > bands.p85 ? ', longer than the service level' : ''}`,
  })).join('');
  svg += `<text class="chart-axis-title" x="12" y="${PAD.top + PLOT_H / 2}" transform="rotate(-90 12 ${PAD.top + PLOT_H / 2})" text-anchor="middle">days from claim to done</text>`;
  const notes = [];
  if (!bands) notes.push(`Lines appear once ${chart.minSample} tasks have finished.`);
  if (chart.excluded) notes.push(`${chart.excluded} finished or dropped ${chart.excluded === 1 ? 'task is' : 'tasks are'} left out: no recorded start, a board sweep, or dropped.`);
  return frame({ title, meaning, svg, label: `${title}: ${chart.items.length} finished in the last 90 days${bands ? `, service level ${days(bands.p85)}` : ''}`, note: escape(notes.join(' ')) });
}

// A date as a person reads it; the year only when it is not this one.
export function dateWords(date, now = new Date()) {
  const day = new Date(`${date}T12:00:00`);
  return day.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', ...(day.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' }) });
}

// The forecast: when everything open is likely done, and how many are likely
// to finish in the next two weeks, from the project's own throughput. The
// sentences carry the answer; the bars show the spread of simulated finishes.
export function forecastChart(chart, { explain = '' } = {}) {
  if (!chart) return '';
  const title = 'Forecast';
  const meaning = 'No estimates: each simulated day finishes as many tasks as a random past day did, 10,000 times over.';
  const { basis } = chart;
  const source = `From ${days(basis.days)} of throughput, ${basis.from ? escape(dateWords(basis.from)) : ''} to ${basis.to ? escape(dateWords(basis.to)) : ''}: ${basis.finished} finished.${explain ? ` ${explain}` : ''}`;
  if (chart.status === 'nothing-open') return `<figure class="flow-chart forecast"><figcaption>${title}<small>${escape(meaning)}</small></figcaption><p class="forecast-line">Nothing is open, so there is nothing to forecast.</p></figure>`;
  if (chart.status === 'thin') return `<figure class="flow-chart forecast"><figcaption>${title}<small>${escape(meaning)}</small></figcaption><p class="forecast-line">Too little history to forecast from: ${chart.short === 'days' ? `the board has ${basis.days === 1 ? 'one whole day' : `${basis.days} whole days`} of work behind it, and a forecast needs ${chart.minSample}` : `${basis.finished} ${basis.finished === 1 ? 'task' : 'tasks'} finished in the last ${days(basis.days)}, and a forecast needs ${chart.minSample}`}.</p><p class="chart-note">${source}</p></figure>`;
  if (chart.status === 'no-history' && !basis.days) return `<figure class="flow-chart forecast"><figcaption>${title}<small>${escape(meaning)}</small></figcaption><p class="forecast-line">The board is new today, so there is no whole day of work to forecast from yet.</p></figure>`;
  if (chart.status === 'no-history') return `<figure class="flow-chart forecast"><figcaption>${title}<small>${escape(meaning)}</small></figcaption><p class="forecast-line">No task finished in the last ${days(basis.days)}, so there is no pace to forecast ${chart.open} open ${chart.open === 1 ? 'task' : 'tasks'} from.</p><p class="chart-note">${source}</p></figure>`;
  const { when, ahead, histogram } = chart;
  const atLeast = (n) => (n ? `${n} or more` : 'possibly none');
  const by = (point) => (point.days === null ? `not within ${when.horizonDays} days` : `by ${dateWords(point.date)}`);
  const open = `${chart.open} open ${chart.open === 1 ? 'task' : 'tasks'}`;
  const sentences = `<dl class="forecast-answers">
    <div><dt>When will the ${escape(open)} be done?</dt><dd><span class="forecast-p">50%</span> ${escape(by(when.p50))}</dd><dd class="forecast-main"><span class="forecast-p">85%</span> ${escape(by(when.p85))}</dd><dd><span class="forecast-p">95%</span> ${escape(by(when.p95))}</dd></div>
    <div><dt>How many will finish in the next ${ahead.days} days, by ${escape(dateWords(ahead.date))}?</dt><dd><span class="forecast-p">50%</span> ${atLeast(ahead.p50)}</dd><dd class="forecast-main"><span class="forecast-p">85%</span> ${atLeast(ahead.p85)}</dd><dd><span class="forecast-p">95%</span> ${atLeast(ahead.p95)}</dd></div>
  </dl>`;
  // The spread of simulated finish days, with the three percentiles marked.
  const last = Math.max(...histogram.map((bar) => bar.days), when.p95.days || 0);
  const peak = Math.max(1, ...histogram.map((bar) => bar.n));
  const h = 96;
  // Day d (1 = tomorrow) occupies one equal slot across the plot.
  const slot = PLOT_W / Math.max(1, last);
  const xOf = (day) => PAD.left + (day - 0.5) * slot;
  let svg = histogram.map((bar) => `<rect class="forecast-bar" x="${xOf(bar.days) - slot / 2 + 0.5}" y="${12 + h - (bar.n / peak) * (h - 10)}" width="${Math.max(1, slot - 1)}" height="${(bar.n / peak) * (h - 10)}"/>`).join('');
  for (const [kind, point] of [['p50', when.p50], ['p85', when.p85], ['p95', when.p95]]) {
    if (point.days === null) continue;
    const x = xOf(point.days);
    svg += `<line class="chart-line chart-line-${kind}" x1="${x}" x2="${x}" y1="18" y2="${12 + h}"/>`;
  }
  // Their labels sit above the bars, pushed apart when the days are close.
  let right = -Infinity;
  for (const [kind, point] of [['p50', when.p50], ['p85', when.p85], ['p95', when.p95]]) {
    if (point.days === null) continue;
    const x = Math.max(xOf(point.days), right + 44);
    right = x;
    svg += `<text class="chart-line-label chart-line-label-${kind}" x="${x}" y="13" text-anchor="middle">${kind.slice(1)}%</text>`;
  }
  svg += `<text class="chart-tick" x="${PAD.left}" y="${12 + h + 22}">today</text><text class="chart-tick" x="${PAD.left + PLOT_W}" y="${12 + h + 22}" text-anchor="end">${escape(days(last))}</text>`;
  const spread = `<div class="chart-scroll"><svg class="forecast-spread" viewBox="0 0 ${W} ${h + 40}" role="img" aria-label="${escape(`Simulated finish days for the ${open}: half by day ${when.p50.days ?? 'none'}, 85% by day ${when.p85.days ?? 'none'}`)}">${svg}</svg></div>`;
  const beyond = when.beyondHorizon ? ` In ${when.beyondHorizon} of ${basis.trials} runs the work was not done within ${when.horizonDays} days.` : '';
  return `<figure class="flow-chart forecast"><figcaption>${title}<small>${escape(meaning)}</small></figcaption>${sentences}${spread}<p class="chart-note">${source}${escape(beyond)} The pace assumes the coming weeks look like those days; new work added changes the answer.</p></figure>`;
}
