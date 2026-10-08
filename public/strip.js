// A board as a flow strip: one track running Backlog → In progress → Blocked
// → Done this week, each stretch named above the line. Waiting tasks queue as
// rings at the In progress gate; work in progress sits on the track at its
// age, on a log scale with the service level and twice it marked, and turns
// amber then red as it passes them; blocked work sits in its own stretch;
// finished work stacks up from the track, a column a day. Over the WIP limit,
// the In progress and Blocked stretch of track turns red.
//
// Inline SVG with colour from classes (the CSP allows no inline style). Every
// task marker opens its task, on click and on Enter or Space, like the Flow
// tab's dots. Drawn at the width it is shown at; below MIN_W it scrolls.

import { escape } from './words.js';
import { duration } from './charts.js';

export const MIN_W = 560;
// Each stretch's share of the track.
const SHARE = [0.2, 0.34, 0.12, 0.34];
const LABEL_Y = 14;
const QUEUE_GAP = 14;
const QUEUE_ROWS = 3;
const DONE_STEP = 9;
const DONE_MIN_STEP = 5;
const DONE_ACROSS = 6;
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const LEVEL_WORDS = { ok: 'within the service level', aging: 'past the service level', critical: 'past twice the service level', unknown: 'no service level yet' };

const localId = (key) => String(key || '').split('#')[0];

function marker({ cx, cy, r, kind, label, projectId, taskKey }) {
  return `<g class="strip-task strip-${kind}" role="button" tabindex="0" data-action="open-task" data-id="${escape(`${projectId}:${localId(taskKey)}`)}" aria-label="${escape(label)}"><title>${escape(label)}</title><circle cx="${cx}" cy="${cy}" r="${r}"/></g>`;
}

// Where an age (in days) falls between the In progress gate and the Blocked
// gate: a log scale from a minute to past the oldest task and twice the
// service level.
export function ageScale({ from, to, ages, serviceLevel }) {
  const lo = 1 / 1440;
  const hi = Math.max(1 / 24, serviceLevel ? serviceLevel * 3 : 1, ...ages.map((age) => age * 1.3));
  const span = Math.log(hi / lo);
  return (age) => from + (Math.log(Math.max(age, lo) / lo) / span) * (to - from);
}

// `backlog` is [{ taskKey, title }]; `wip` is [{ taskKey, title, status, age,
// level }] with age in days; `days` is the last seven days' finishes,
// [{ date: 'YYYY-MM-DD', n }], oldest first; `serviceLevel` is in days.
export function flowStrip({ projectId, name, backlog = [], wip = [], days = [], serviceLevel = null, wipLimit = 0 }, { width = 760, height = 120 } = {}) {
  const W = Math.max(MIN_W, Math.round(width));
  const H = Math.max(110, Math.round(height));
  const track = Math.round(H * 0.62);
  const xs = [0];
  SHARE.forEach((share, index) => xs.push(Math.round(xs[index] + share * W)));
  xs[4] = W;
  const running = wip.filter((item) => item.status === 'in_progress');
  const blocked = wip.filter((item) => item.status === 'blocked');
  const finished = days.reduce((sum, day) => sum + day.n, 0);
  const over = wipLimit > 0 && wip.length > wipLimit;

  let svg = `<line class="strip-track" x1="0" x2="${W}" y1="${track}" y2="${track}"/>`;
  if (over) svg += `<line class="strip-track-over" x1="${xs[1]}" x2="${xs[3]}" y1="${track}" y2="${track}"/>`;
  const names = [['Backlog', backlog.length], ['In progress', wipLimit > 0 ? `${running.length} of ${wipLimit}` : running.length], ['Blocked', blocked.length], ['Done this week', finished]];
  names.forEach(([label, count], index) => {
    svg += `<line class="strip-gate" x1="${xs[index]}" x2="${xs[index]}" y1="${track - 7}" y2="${track + 7}"/>`;
    svg += `<text class="strip-name" x="${xs[index] + (index ? 8 : 0)}" y="${LABEL_Y}">${label}<tspan class="strip-count${index === 1 && over ? ' is-over' : ''}" dx="6">${escape(count)}</tspan></text>`;
  });
  svg += `<line class="strip-gate" x1="${W}" x2="${W}" y1="${track - 7}" y2="${track + 7}"/>`;

  // Backlog: rings queued back from the In progress gate, nearest first. The
  // ones that do not fit are counted instead.
  const room = Math.floor((xs[1] - 24) / QUEUE_GAP) * QUEUE_ROWS;
  backlog.slice(0, room).forEach((task, index) => {
    const column = Math.floor(index / QUEUE_ROWS);
    const row = index % QUEUE_ROWS;
    svg += marker({ cx: xs[1] - 12 - column * QUEUE_GAP, cy: track + (row - 1) * QUEUE_GAP, r: 5, kind: 'queued', projectId, taskKey: task.taskKey, label: `${localId(task.taskKey)} ${task.title}: in the backlog` });
  });
  if (backlog.length > room) svg += `<text class="strip-note" x="0" y="${track + 34}">${backlog.length - room} more not drawn</text>`;

  // In progress: by age, the service level and twice it marked.
  const x = ageScale({ from: xs[1] + 26, to: xs[2] - 16, ages: running.map((item) => item.age), serviceLevel });
  if (serviceLevel) {
    const at = x(serviceLevel);
    const twice = x(serviceLevel * 2);
    svg += `<rect class="strip-past" x="${at}" y="${track - 20}" width="${xs[2] - at}" height="40"/><rect class="strip-past-twice" x="${twice}" y="${track - 20}" width="${xs[2] - twice}" height="40"/>`;
    svg += `<line class="strip-level" x1="${at}" x2="${at}" y1="${track - 20}" y2="${track + 20}"/><line class="strip-level-twice" x1="${twice}" x2="${twice}" y1="${track - 20}" y2="${track + 20}"/>`;
    svg += `<text class="strip-note" x="${at - 6}" y="${track + 34}" text-anchor="end">85% finish within ${escape(duration(serviceLevel))}</text>`;
  }
  if (!running.length) svg += `<text class="strip-empty" x="${(xs[1] + xs[2]) / 2}" y="${track - 12}" text-anchor="middle">Nothing in progress</text>`;
  running.forEach((item, index) => {
    svg += marker({ cx: x(item.age), cy: track + ((index % 3) - 1) * 13, r: 6, kind: item.level, projectId, taskKey: item.taskKey, label: `${localId(item.taskKey)} ${item.title}: ${duration(item.age)} in progress, ${LEVEL_WORDS[item.level] || LEVEL_WORDS.unknown}` });
  });

  // Blocked: in rows across its stretch, oldest first.
  const perRow = Math.max(1, Math.floor((xs[3] - xs[2] - 24) / 15));
  [...blocked].sort((a, b) => b.age - a.age).forEach((item, index) => {
    svg += marker({ cx: xs[2] + 18 + (index % perRow) * 15, cy: track - Math.floor(index / perRow) * 15, r: 5.5, kind: 'blocked', projectId, taskKey: item.taskKey, label: `${localId(item.taskKey)} ${item.title}: blocked for ${duration(item.age)}` });
  });

  // Done this week: a column a day, today last, its finishes stacked up from
  // the track. A day with more than fits says how many.
  // The dots shrink, down to DONE_MIN_STEP apart, until the busiest day fits.
  const columnW = (xs[4] - xs[3] - 16) / 7;
  const most = Math.max(0, ...days.slice(-7).map((day) => day.n));
  let step = DONE_STEP;
  // At most DONE_ACROSS a row, so a day reads as a stack, not a line.
  const acrossAt = (gap) => Math.min(DONE_ACROSS, Math.max(1, Math.floor((columnW - 8) / gap)));
  const fit = (gap) => acrossAt(gap) * Math.max(1, Math.floor((track - LABEL_Y - 18) / gap));
  while (step > DONE_MIN_STEP && fit(step) < most) step -= 1;
  const across = acrossAt(step);
  const up = Math.max(1, Math.floor((track - LABEL_Y - 18) / step));
  const r = Math.min(3.4, step * 0.38);
  days.slice(-7).forEach((day, index, shown) => {
    const left = xs[3] + 12 + (7 - shown.length + index) * columnW;
    const last = index === shown.length - 1;
    const weekday = WEEKDAYS[new Date(`${day.date}T12:00:00Z`).getUTCDay()];
    const fits = Math.min(day.n, across * up);
    let dots = '';
    for (let k = 0; k < fits; k += 1) dots += `<circle cx="${left + 4 + (k % across) * step}" cy="${track - 9 - Math.floor(k / across) * step}" r="${r}"/>`;
    const more = day.n > fits ? `<text class="strip-note" x="${left}" y="${track - 13 - up * step}">${day.n}</text>` : '';
    svg += `<g class="strip-day"><title>${escape(`${last ? 'Today' : weekday} ${day.date}: ${day.n} finished`)}</title>${dots}${more}<text class="strip-weekday" x="${left}" y="${track + 20}">${last ? 'Today' : weekday}</text></g>`;
  });

  const label = `${name}: ${backlog.length} in the backlog, ${running.length} in progress${wipLimit > 0 ? ` of a limit of ${wipLimit}` : ''}, ${blocked.length} blocked, ${finished} done this week`;
  return `<div class="strip-scroll"><svg class="flow-strip" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="group" aria-label="${escape(label)}">${svg}</svg></div>`;
}
