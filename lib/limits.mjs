// How much of each Claude account's session (5-hour) and weekly limits is used,
// and when each resets: every Claude Code config folder in the home folder
// (~/.claude, ~/.claude-<profile>), read with its own OAuth access token from
// the endpoint Claude Code's /usage reads. These are AGE Aris's only outbound calls.
//
// A lapsed access token is renewed the way Claude Code renews it, and the
// renewed sign-in is written back into that profile's .credentials.json: the
// renewal rotates the refresh token, so not writing it back would sign Claude
// Code out there. That is the one file under ~/.claude* AGE Aris writes, and
// only its token fields. Tokens stay in this module: they go in a request and
// in that file, never in a reading, an error or a log.
import { homedir } from 'node:os';
import { readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export const USAGE_URL = 'https://api.anthropic.com/api/oauth/usage';
const BETA = 'oauth-2025-04-20';
// Where Claude Code renews its sign-in, and its public client id.
export const RENEW_URL = 'https://platform.claude.com/v1/oauth/token';
const CLIENT_ID = '9d1c250a-e61b-44d9-88ed-5944d1962f5e';
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

const lapsed = (oauth, now) => typeof oauth?.expiresAt === 'number' && oauth.expiresAt <= now;

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
    let token = oauth?.accessToken;
    if (typeof token !== 'string' || !token) return last('no token', 'no token: this profile keeps no Claude sign-in that AGE Aris can read');
    if (lapsed(oauth, this.clock())) {
      if (typeof oauth.refreshToken !== 'string' || !oauth.refreshToken) return last('expired', 'expired: this profile keeps no refresh token; sign in again in Claude Code there');
      // A refused renewal is not tried again for a while: the refresh token
      // will not get better by asking each minute.
      if (entry.renewError && this.clock() - entry.renewAt < this.ttlMs) return last('expired', entry.renewError);
      entry.renewing ??= this.renew(dir).then((renewed) => {
        entry.renewError = '';
        return renewed;
      }, (error) => {
        entry.renewError = `expired: ${error.message}`;
        entry.renewAt = this.clock();
        return null;
      }).finally(() => { entry.renewing = null; });
      token = await entry.renewing;
      if (!token) return last('expired', entry.renewError);
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

  // Renews the profile's lapsed sign-in and writes it back; the new access
  // token. The file is read again first and again before writing: when Claude
  // Code has renewed it meanwhile, its sign-in is used and nothing is written.
  async renew(dir) {
    const file = join(dir, '.credentials.json');
    const oauth = (await readJsonFile(file))?.claudeAiOauth;
    if (oauth?.accessToken && !lapsed(oauth, this.clock())) return oauth.accessToken;
    if (typeof oauth?.refreshToken !== 'string' || !oauth.refreshToken) throw new Error('this profile keeps no refresh token; sign in again in Claude Code there');
    const scopes = Array.isArray(oauth.scopes) ? oauth.scopes.filter((scope) => typeof scope === 'string') : [];
    const body = await this.send(RENEW_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ grant_type: 'refresh_token', refresh_token: oauth.refreshToken, client_id: CLIENT_ID, ...(scopes.length ? { scope: scopes.join(' ') } : {}) }),
    }, 'the sign-in could not be renewed (HTTP $status); sign in again in Claude Code there');
    if (typeof body?.access_token !== 'string' || !body.access_token || typeof body.expires_in !== 'number') throw new Error('the renewal reply had no token');
    const now = this.clock();
    const renewed = {
      accessToken: body.access_token,
      refreshToken: typeof body.refresh_token === 'string' && body.refresh_token ? body.refresh_token : oauth.refreshToken,
      expiresAt: now + body.expires_in * 1000,
      ...(typeof body.refresh_token_expires_in === 'number' ? { refreshTokenExpiresAt: now + body.refresh_token_expires_in * 1000 } : {}),
      ...(typeof body.scope === 'string' && body.scope ? { scopes: body.scope.split(' ').filter(Boolean) } : {}),
    };
    const current = await readJsonFile(file);
    if (current?.claudeAiOauth?.refreshToken !== oauth.refreshToken) return renewed.accessToken;
    const temporary = `${file}.agearis-${process.pid}-${now}`;
    try {
      await writeFile(temporary, JSON.stringify({ ...current, claudeAiOauth: { ...current.claudeAiOauth, ...renewed } }), { mode: 0o600, flag: 'wx' });
      await rename(temporary, file);
    } catch {
      await rm(temporary, { force: true });
      throw new Error('the renewed sign-in could not be saved in .credentials.json');
    }
    return renewed.accessToken;
  }

  async request(token) {
    const body = await this.send(USAGE_URL, {
      headers: { Authorization: `Bearer ${token}`, 'anthropic-beta': BETA, Accept: 'application/json' },
    }, 'the token was refused (HTTP $status); sign in again in Claude Code');
    return { at: this.clock(), ...parseUsage(body) };
  }

  // One request; its JSON reply, or an error that names no token. `refused`
  // is the message for HTTP 400, 401 and 403.
  async send(url, init, refused) {
    let response;
    try {
      response = await this.fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
    } catch (error) {
      if (error?.name === 'TimeoutError' || error?.name === 'AbortError') throw new Error('no reply within 10 seconds');
      throw new Error(`could not reach ${new URL(url).host}${error?.cause?.code ? ` (${error.cause.code})` : ''}`);
    }
    if ([400, 401, 403].includes(response.status)) throw new Error(refused.replace('$status', response.status));
    if (response.status === 429) throw new Error('asked too often (HTTP 429); try again in a few minutes');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = await response.text();
    if (text.length > MAX_BODY) throw new Error('the reply was too large');
    try { return JSON.parse(text); } catch { throw new Error('the reply was not JSON'); }
  }
}
