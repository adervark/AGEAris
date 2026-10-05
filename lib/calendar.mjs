// Pure calendar arithmetic for the metrics: time zones, working days, and day
// windows. Nothing here reads the clock; every function takes the time it works
// on as an argument, so a value is reproducible for a given asOf.
//
// A *date* is a local calendar day, 'YYYY-MM-DD'. An *instant* is a Date, epoch
// milliseconds, or an ISO 8601 string. Working days are ISO weekdays
// (1 = Monday … 7 = Sunday).

export const DEFAULT_WORKDAYS = Object.freeze([1, 2, 3, 4, 5]);

const DAY_MS = 24 * 60 * 60 * 1000;
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const formatters = new Map();

function formatter(timezone) {
  let format = formatters.get(timezone);
  if (!format) {
    format = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone, hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
    formatters.set(timezone, format);
  }
  return format;
}

function instant(value) {
  const ms = value instanceof Date ? value.getTime() : typeof value === 'number' ? value : Date.parse(value);
  if (!Number.isFinite(ms)) throw new RangeError(`Invalid instant: ${value}`);
  return ms;
}

// Days since 1970-01-01 for a date, so date arithmetic never meets a time zone.
function dayNumber(date) {
  const match = typeof date === 'string' ? DATE.exec(date) : null;
  const ms = match ? Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : NaN;
  if (!Number.isFinite(ms) || new Date(ms).toISOString().slice(0, 10) !== date) throw new RangeError(`Invalid date: ${date}`);
  return ms / DAY_MS;
}

function fromDayNumber(day) {
  return new Date(day * DAY_MS).toISOString().slice(0, 10);
}

function weekday(day) {
  // Day 0 was a Thursday (ISO 4).
  return ((((day + 3) % 7) + 7) % 7) + 1;
}

function workdaySet(workdays) {
  const set = new Set(workdays);
  if (![...set].some((day) => Number.isInteger(day) && day >= 1 && day <= 7)) throw new RangeError('workdays must name at least one ISO weekday');
  return set;
}

function wallClock(ms, timezone) {
  const parts = {};
  for (const { type, value } of formatter(timezone).formatToParts(ms)) parts[type] = Number(value);
  return parts;
}

// The zone's offset from UTC at an instant, in milliseconds.
function offsetAt(ms, timezone) {
  const wall = wallClock(ms, timezone);
  const whole = ms - (((ms % 1000) + 1000) % 1000);
  return Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, wall.second) - whole;
}

export function localDate(at, timezone) {
  const wall = wallClock(instant(at), timezone);
  return `${String(wall.year).padStart(4, '0')}-${String(wall.month).padStart(2, '0')}-${String(wall.day).padStart(2, '0')}`;
}

export function addDays(date, n) {
  return fromDayNumber(dayNumber(date) + n);
}

// The first instant of a local day. Offsets come from formatToParts at the
// instants themselves, so a day that is 23 or 25 hours long starts correctly.
export function startOfLocalDay(date, timezone) {
  const midnight = dayNumber(date) * DAY_MS;
  let start = midnight - offsetAt(midnight, timezone);
  start = midnight - offsetAt(start, timezone);
  // Where the clocks jump forward at midnight, local midnight does not exist and
  // the estimate lands on the previous day; the day starts at the jump instead.
  // The estimate is then before the jump, so its offset is the one in force
  // until midnight, and that gives the jump instant.
  if (localDate(start, timezone) < date) start = midnight - offsetAt(start, timezone);
  return new Date(start);
}

export function isWorkday(date, workdays = DEFAULT_WORKDAYS) {
  return workdaySet(workdays).has(weekday(dayNumber(date)));
}

// The last working day strictly before `date`.
export function previousWorkday(date, workdays = DEFAULT_WORKDAYS) {
  const set = workdaySet(workdays);
  let day = dayNumber(date) - 1;
  while (!set.has(weekday(day))) day -= 1;
  return fromDayNumber(day);
}

// The n-th working day strictly after `date`. `date` itself never counts and
// need not be a working day; addWorkdays(date, 0) is `date`.
export function addWorkdays(date, n, workdays = DEFAULT_WORKDAYS) {
  if (!Number.isInteger(n) || n < 0) throw new RangeError('n must be a whole number of working days, 0 or more');
  const set = workdaySet(workdays);
  let day = dayNumber(date);
  for (let left = n; left > 0;) {
    day += 1;
    if (set.has(weekday(day))) left -= 1;
  }
  return fromDayNumber(day);
}

// Working days after `from`, up to and including `to`; 0 when `to` is not later.
// The inverse of addWorkdays: workdaysBetween(d, addWorkdays(d, n)) === n.
export function workdaysBetween(from, to, workdays = DEFAULT_WORKDAYS) {
  const set = workdaySet(workdays);
  let count = 0;
  for (let day = dayNumber(from) + 1, last = dayNumber(to); day <= last; day += 1) {
    if (set.has(weekday(day))) count += 1;
  }
  return count;
}

// Whole non-working local days that lie entirely between two instants.
export function nonWorkingDaysBetween(from, to, timezone, workdays = DEFAULT_WORKDAYS) {
  const start = instant(from);
  const end = instant(to);
  const set = workdaySet(workdays);
  let count = 0;
  for (let date = localDate(start, timezone); date <= localDate(end, timezone); date = addDays(date, 1)) {
    if (set.has(weekday(dayNumber(date)))) continue;
    if (startOfLocalDay(date, timezone).getTime() >= start && startOfLocalDay(addDays(date, 1), timezone).getTime() <= end) count += 1;
  }
  return count;
}
