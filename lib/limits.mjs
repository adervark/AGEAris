// How much of each Claude account's session (5-hour) and weekly limits is used,
// and when each resets: every Claude Code config folder in the home folder
// (~/.claude, ~/.claude-<profile>), read with its own OAuth access token from
// the endpoint Claude Code's /usage reads. This is AGE Aris's one outbound call.
//
// Nothing under ~/.claude* is written. An expired token is never refreshed:
// refreshing rotates the refresh token Claude Code keeps and could sign that
// profile out. The token stays in this module: it goes in the request's
// Authorization header and nowhere else, not in a reading, an error or a log.
import { homedir } from 'node:os';
import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

export const USAGE_URL = 'https://api.anthropic.com/api/oauth/usage';
const BETA = 'oauth-2025-04-20';
const TTL_MS = 5 * 60 * 1000;
const FORCE_MS = 60 * 1000;
const TIMEOUT_MS = 10 * 1000;
const MAX_BODY = 256 * 1024;
const FOLDER = /^\.claude(?:-([A-Za-z0-9_.-]{1,40}))?$/;
// The response's windows, under the names AGE Aris gives them.
const WINDOWS = [['session', 'five_hour'], ['weekly', 'seven_day'], ['weeklyOpus', 'seven_day_opus'], ['weeklySonnet', 'seven_day_sonnet']];

async function readJsonFile(path) {
  try { return JSON.parse(await readFile(path, 'utf8')); } catch (error) {
    if (error?.code === 'ENOENT') return undefined;
    return null;
  }
}

async function isDirectory(path) {
  try { return (await stat(path)).isDirectory(); } catch { return false; }
}

const percent = (value) => (typeof value === 'number' && Number.isFinite(value) ? Math.round(value * 10) / 10 : null);

function instant(value) {
  if (typeof value !== 'string' || value.length > 64) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

// The windows a response carries, each { percent, resetsAt }; a window the plan
// does not have is left out.
export function parseUsage(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('the reply was not a usage object');
  const windows = {};
  for (const [name, key] of WINDOWS) {
    const window = body[key];
    if (!window || typeof window !== 'object') continue;
    const used = percent(window.utilization);
    if (used === null) continue;
    windows[name] = { percent: used, resetsAt: instant(window.resets_at) };
  }
  if (!windows.session && !windows.weekly) throw new Error('the reply had neither a session nor a weekly limit');
  const extra = body.extra_usage;
  return { windows, extraUsage: extra && typeof extra === 'object' ? extra.is_enabled === true : null };
}

// What is left of the tightest limit, in percent.
const leftOf = (windows) => Math.max(0, Math.round((100 - Math.max(...Object.values(windows).map((window) => window.percent))) * 10) / 10);

export class Limits {
  constructor({ home = homedir(), fetch = globalThis.fetch, clock = () => Date.now(), ttlMs = TTL_MS, forceMs = FORCE_MS } = {}) {
    this.home = home;
    this.fetch = fetch;
    this.clock = clock;
    this.ttlMs = ttlMs;
    this.forceMs = forceMs;
    // Per folder: the last attempt's outcome, the last good reading, and the
    // request in flight. Kept in memory only.
    this.cache = new Map();
  }

  // The Claude Code config folders in the home folder that hold credentials or
  // an account, by profile: `.claude` is `default`, `.claude-k` is `k`.
  async accounts() {
    let names;
    try { names = await readdir(this.home); } catch { return []; }
    const found = [];
    for (const name of names.sort()) {
      const match = FOLDER.exec(name);
      const dir = join(this.home, name);
      if (!match || !await isDirectory(dir)) continue;
      const credentials = await readJsonFile(join(dir, '.credentials.json'));
      // Claude Code keeps the default profile's account beside the folder.
      let config = await readJsonFile(join(dir, '.claude.json'));
      if (config === undefined && !match[1]) config = await readJsonFile(join(this.home, '.claude.json'));
      if (credentials === undefined && !config?.oauthAccount) continue;
      found.push({ profile: match[1] || 'default', dir, folder: `~/${name}`, credentials });
    }
    return found;
  }

  async read({ refresh = false } = {}) {
    // One after another: they share one connection, and connections opened
    // together to the same host time out here in Node's dual-stack race.
    const accounts = [];
    for (const account of await this.accounts()) accounts.push(await this.readAccount(account, refresh));
    const usable = accounts.filter((account) => account.state === 'ok');
    const best = usable.reduce((top, account) => (!top || account.left > top.left ? account : top), null);
    return { readAt: new Date(this.clock()).toISOString(), accounts, mostLeft: best?.profile ?? null };
  }

  async readAccount({ profile, dir, folder, credentials }, refresh) {
    const oauth = credentials?.claudeAiOauth;
    const base = { profile, folder, plan: typeof oauth?.subscriptionType === 'string' ? oauth.subscriptionType.slice(0, 40) : null };
    const entry = this.cache.get(dir) || {};
    this.cache.set(dir, entry);
    const last = (state, reason) => ({ ...base, state, reason, ...this.reading(entry.good, true) });
    if (credentials === null) return last('error', 'error: .credentials.json could not be read');
    const token = oauth?.accessToken;
    if (typeof token !== 'string' || !token) return last('no token', 'no token: this profile keeps no Claude sign-in that AGE Aris can read');
    if (typeof oauth.expiresAt === 'number' && oauth.expiresAt <= this.clock()) {
      return last('expired', 'expired: Claude Code renews the token the next time it runs in this profile; AGE Aris never does');
    }
    const age = this.clock() - (entry.at ?? -Infinity);
    if (!entry.inflight && (age >= this.ttlMs || (refresh && age >= this.forceMs))) {
      entry.inflight = this.request(token).then((good) => {
        entry.good = good;
        entry.error = '';
      }, (error) => {
        entry.error = `error: ${error.message}`;
      }).finally(() => {
        entry.at = this.clock();
        entry.inflight = null;
      });
    }
    if (entry.inflight) await entry.inflight;
    if (entry.error) return last('error', entry.error);
    return { ...base, state: 'ok', reason: '', ...this.reading(entry.good, false) };
  }

  reading(good, stale) {
    if (!good) return { readAt: null, stale: false, left: null, windows: null, extraUsage: null };
    return { readAt: new Date(good.at).toISOString(), stale, left: leftOf(good.windows), windows: good.windows, extraUsage: good.extraUsage };
  }

  async request(token) {
    let response;
    try {
      response = await this.fetch(USAGE_URL, {
        headers: { Authorization: `Bearer ${token}`, 'anthropic-beta': BETA, Accept: 'application/json' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (error) {
      if (error?.name === 'TimeoutError' || error?.name === 'AbortError') throw new Error('no reply within 10 seconds');
      throw new Error(`could not reach ${new URL(USAGE_URL).host}${error?.cause?.code ? ` (${error.cause.code})` : ''}`);
    }
    if (response.status === 401 || response.status === 403) throw new Error(`the token was refused (HTTP ${response.status}); sign in again in Claude Code`);
    if (response.status === 429) throw new Error('asked too often (HTTP 429); try again in a few minutes');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = await response.text();
    if (text.length > MAX_BODY) throw new Error('the reply was too large');
    let body;
    try { body = JSON.parse(text); } catch { throw new Error('the reply was not JSON'); }
    return { at: this.clock(), ...parseUsage(body) };
  }
}
