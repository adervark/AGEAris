import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  addDays, addWorkdays, isWorkday, localDate, nonWorkingDaysBetween, previousWorkday, startOfLocalDay, workdaysBetween,
} from '../lib/calendar.mjs';

const HOUR = 60 * 60 * 1000;
const dayLength = (date, timezone) => startOfLocalDay(addDays(date, 1), timezone) - startOfLocalDay(date, timezone);

test('Europe/London: the day the clocks go back on 2026-10-25 starts in BST and lasts 25 hours', () => {
  assert.equal(startOfLocalDay('2026-10-25', 'Europe/London').toISOString(), '2026-10-24T23:00:00.000Z');
  assert.equal(startOfLocalDay('2026-10-26', 'Europe/London').toISOString(), '2026-10-26T00:00:00.000Z');
  assert.equal(dayLength('2026-10-25', 'Europe/London'), 25 * HOUR);
  assert.equal(dayLength('2026-10-24', 'Europe/London'), 24 * HOUR);
  assert.equal(localDate('2026-10-24T23:30:00Z', 'Europe/London'), '2026-10-25', '00:30 BST is already the 25th');
  assert.equal(localDate('2026-10-25T23:30:00Z', 'Europe/London'), '2026-10-25', '23:30 GMT is still the 25th');
  assert.equal(localDate('2026-10-25T00:59:59Z', 'Europe/London'), '2026-10-25', 'the repeated hour stays on the same day');
});

test('Europe/London: the day the clocks go forward lasts 23 hours', () => {
  assert.equal(startOfLocalDay('2026-03-29', 'Europe/London').toISOString(), '2026-03-29T00:00:00.000Z');
  assert.equal(dayLength('2026-03-29', 'Europe/London'), 23 * HOUR);
});

test('America/New_York: the day the clocks go back on 2026-11-01 starts in EDT and lasts 25 hours', () => {
  assert.equal(startOfLocalDay('2026-11-01', 'America/New_York').toISOString(), '2026-11-01T04:00:00.000Z');
  assert.equal(startOfLocalDay('2026-11-02', 'America/New_York').toISOString(), '2026-11-02T05:00:00.000Z');
  assert.equal(dayLength('2026-11-01', 'America/New_York'), 25 * HOUR);
  assert.equal(localDate('2026-11-01T03:59:59Z', 'America/New_York'), '2026-10-31');
  assert.equal(localDate('2026-11-02T04:59:59Z', 'America/New_York'), '2026-11-01');
});

test('a day whose midnight is skipped by the clocks starts at the jump', () => {
  // Chile moves from -04 to -03 at local midnight on 2026-09-06; 00:00 never happens.
  assert.equal(startOfLocalDay('2026-09-06', 'America/Santiago').toISOString(), '2026-09-06T04:00:00.000Z');
  assert.equal(localDate('2026-09-06T04:00:00Z', 'America/Santiago'), '2026-09-06');
  assert.equal(localDate('2026-09-06T03:59:59Z', 'America/Santiago'), '2026-09-05');
});

test('localDate accepts a Date, epoch milliseconds, and an ISO string with an offset', () => {
  const at = '2026-10-05T09:12:00+01:00';
  assert.equal(localDate(at, 'Europe/London'), '2026-10-05');
  assert.equal(localDate(new Date(at), 'Asia/Tokyo'), '2026-10-05');
  assert.equal(localDate(Date.parse(at), 'America/Los_Angeles'), '2026-10-05');
  assert.equal(localDate('2026-10-05T23:30:00Z', 'Asia/Tokyo'), '2026-10-06');
  assert.throws(() => localDate('not a time', 'Europe/London'), RangeError);
  assert.throws(() => addDays('2026-02-30', 1), RangeError);
});

test('previousWorkday steps back over the weekend and never returns the day itself', () => {
  assert.equal(previousWorkday('2026-10-05'), '2026-10-02');
  assert.equal(previousWorkday('2026-10-06'), '2026-10-05');
  assert.equal(previousWorkday('2026-10-04'), '2026-10-02');
  assert.equal(previousWorkday('2026-10-05', [1, 2, 3, 4]), '2026-10-01', 'Friday is not a working day');
});

test('isWorkday follows the configured ISO weekdays', () => {
  assert.equal(isWorkday('2026-10-05'), true);
  assert.equal(isWorkday('2026-10-03'), false);
  assert.equal(isWorkday('2026-10-09', [1, 2, 3, 4]), false);
  assert.equal(isWorkday('2026-10-04', [7]), true);
});

test('addWorkdays (N4): the four worked examples', () => {
  assert.equal(addWorkdays('2026-10-03', 1), '2026-10-05', 'Sat + 1 = Mon');
  assert.equal(addWorkdays('2026-10-05', 5), '2026-10-12', 'Mon + 5 = next Mon');
  assert.equal(addWorkdays('2026-10-03', 6), '2026-10-12', 'Sat + 6 = Mon a week later');
  assert.equal(addWorkdays('2026-10-09', 1), '2026-10-12', 'Fri + 1 = Mon');
});

test('addWorkdays (N4): zero is the date itself and the start day never counts, even on a working day', () => {
  assert.equal(addWorkdays('2026-10-05', 0), '2026-10-05');
  assert.equal(addWorkdays('2026-10-03', 0), '2026-10-03', 'zero keeps a non-working day');
  assert.equal(addWorkdays('2026-10-05', 1), '2026-10-06', 'Monday is a working day but does not count');
  assert.throws(() => addWorkdays('2026-10-05', -1), RangeError);
  assert.throws(() => addWorkdays('2026-10-05', 1.5), RangeError);
});

test('addWorkdays with working days Monday to Thursday', () => {
  const week = [1, 2, 3, 4];
  assert.equal(addWorkdays('2026-10-08', 1, week), '2026-10-12', 'Thu + 1 skips Fri, Sat, Sun');
  assert.equal(addWorkdays('2026-10-09', 1, week), '2026-10-12', 'from a non-working Friday');
  assert.equal(addWorkdays('2026-10-05', 4, week), '2026-10-12');
  assert.equal(addWorkdays('2026-10-05', 8, week), '2026-10-19');
  assert.throws(() => addWorkdays('2026-10-05', 1, []), RangeError);
});

test('the due-soon window from a Saturday and a Monday matches the catalogue examples', () => {
  // [today, addWorkdays(today, 6)): on Sat 3 Oct it is 3–11 Oct, on Mon 5 Oct 5–12 Oct.
  assert.equal(addDays(addWorkdays('2026-10-03', 6), -1), '2026-10-11');
  assert.equal(addDays(addWorkdays('2026-10-05', 6), -1), '2026-10-12');
});

test('workdaysBetween counts working days after the first date up to the second and inverts addWorkdays', () => {
  assert.equal(workdaysBetween('2026-10-02', '2026-10-05'), 1);
  assert.equal(workdaysBetween('2026-10-05', '2026-10-05'), 0);
  assert.equal(workdaysBetween('2026-10-12', '2026-10-05'), 0);
  for (const start of ['2026-10-03', '2026-10-05', '2026-10-09']) {
    for (const n of [0, 1, 5, 6, 23]) assert.equal(workdaysBetween(start, addWorkdays(start, n)), n, `${start} + ${n}`);
  }
});

test('nonWorkingDaysBetween counts only whole non-working local days across a weekend', () => {
  const zone = 'Europe/London';
  assert.equal(nonWorkingDaysBetween('2026-10-02T16:00:00+01:00', '2026-10-05T10:00:00+01:00', zone), 2, 'Friday afternoon to Monday morning');
  assert.equal(nonWorkingDaysBetween('2026-10-03T10:00:00+01:00', '2026-10-05T10:00:00+01:00', zone), 1, 'Saturday is not whole');
  assert.equal(nonWorkingDaysBetween('2026-10-03T00:00:00+01:00', '2026-10-05T00:00:00+01:00', zone), 2, 'the boundaries themselves count');
  assert.equal(nonWorkingDaysBetween('2026-10-05T09:00:00+01:00', '2026-10-09T17:00:00+01:00', zone), 0, 'a working week has none');
  assert.equal(nonWorkingDaysBetween('2026-10-02T16:00:00+01:00', '2026-10-05T10:00:00+01:00', 'America/New_York'), 2);
  assert.equal(nonWorkingDaysBetween('2026-10-02T16:00:00+01:00', '2026-10-05T10:00:00+01:00', zone, [1, 2, 3, 4]), 2, 'Friday is not whole either');
  assert.equal(nonWorkingDaysBetween('2026-10-01T09:00:00+01:00', '2026-10-05T10:00:00+01:00', zone, [1, 2, 3, 4]), 3);
});

test('lib/calendar.mjs never reads the clock', async () => {
  const source = await readFile(new URL('../lib/calendar.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /Date\.now\(/);
  assert.doesNotMatch(source, /new Date\(\s*\)/);
});
