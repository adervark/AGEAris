// "Since your last visit": the cursor this browser keeps, and the brief query
// it turns into. Pure functions over an injected storage, so they run in tests;
// every storage access is wrapped, because storage can be missing or throw
// (private windows, blocked site data).

export const CURSOR_KEY = 'agesight.lastSeen';
export const WINDOW_KEY = 'agesight.window';
export const CURSOR_MAX_DAYS = 14;
export const WINDOWS = {
  'last-visit': 'Since your last visit',
  'previous-workday': 'Since the previous working day',
  '24h': 'Last 24 hours',
  '7d': 'Last 7 days',
};
const DAY_MS = 24 * 60 * 60 * 1000;
const SHA = /^[0-9a-f]{40}$/;

function read(storage, key) {
  try { return storage?.getItem(key) ?? null; } catch { return null; }
}

function write(storage, key, value) {
  try { storage?.setItem(key, value); return true; } catch { return false; }
}

// The stored cursor `{at, heads: {projectId: ledgerSha}}`, or null when there
// is none or it cannot be read.
export function readCursor(storage) {
  const raw = read(storage, CURSOR_KEY);
  if (!raw) return null;
  try {
    const cursor = JSON.parse(raw);
    if (!cursor || typeof cursor.at !== 'string' || Number.isNaN(Date.parse(cursor.at))) return null;
    const heads = Object.fromEntries(Object.entries(cursor.heads || {}).filter(([projectId, sha]) => typeof projectId === 'string' && SHA.test(String(sha))));
    return { at: cursor.at, heads };
  } catch {
    return null;
  }
}

// Marks the brief as seen: its time and each ready project's ledger head.
export function cursorFromBrief(brief) {
  const heads = {};
  for (const line of brief?.projects || []) if (line.state === 'ready' && line.build?.ledgerSha) heads[line.projectId] = line.build.ledgerSha;
  return { at: brief.asOf, heads };
}

export function writeCursor(storage, cursor) {
  return write(storage, CURSOR_KEY, JSON.stringify(cursor));
}

export function readWindow(storage) {
  const value = read(storage, WINDOW_KEY);
  return value && Object.hasOwn(WINDOWS, value) ? value : 'last-visit';
}

export function writeWindow(storage, value) {
  return write(storage, WINDOW_KEY, value);
}

// The /api/brief query for a window choice. In last-visit mode without a
// readable cursor the server falls back to its default window and says so; a
// cursor older than 14 days is clamped here as on the server, with a label.
export function briefQuery({ storage, now = Date.now() }) {
  const mode = readWindow(storage);
  const params = new URLSearchParams({ window: mode });
  const result = { mode, params, label: WINDOWS[mode], clamped: false, cursor: null };
  if (mode !== 'last-visit') return result;
  const cursor = readCursor(storage);
  if (!cursor) return { ...result, label: 'Since the previous working day (no last visit recorded)' };
  const floor = now - CURSOR_MAX_DAYS * DAY_MS;
  const clamped = Date.parse(cursor.at) < floor;
  params.set('since', clamped ? new Date(floor).toISOString() : cursor.at);
  const heads = Object.entries(cursor.heads).slice(0, 50);
  if (!clamped && heads.length) params.set('sinceHeads', heads.map(([projectId, sha]) => `${projectId}:${sha}`).join(','));
  return { ...result, cursor, clamped, label: clamped ? `Last ${CURSOR_MAX_DAYS} days (your last visit was earlier)` : 'Since your last visit' };
}
