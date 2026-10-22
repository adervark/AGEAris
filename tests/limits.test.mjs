// lib/limits.mjs and GET /api/limits: each Claude account's session and weekly
// use. Every home folder is temporary and every fetch is stubbed: no network.
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { Limits, parseUsage, RENEW_URL, USAGE_URL } from '../lib/limits.mjs';
import { createServer } from '../server.mjs';

const NOW = Date.parse('2026-10-22T12:00:00Z');
const temporary = new Set();

test.after(async () => {
  await Promise.all([...temporary].map((directory) => rm(directory, { recursive: true, force: true })));
});

async function scratch() {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'agearis-limits-'));
  temporary.add(directory);
  return directory;
}

const token = (profile) => `sk-ant-oat01-${profile}-${'x'.repeat(20)}`;

function oauth(profile, { expiresAt = NOW + 3600_000, plan = 'pro' } = {}) {
  return { claudeAiOauth: { accessToken: token(profile), refreshToken: `sk-ant-ort01-${profile}`, expiresAt, subscriptionType: plan } };
}

// A home folder: the default profile with its account beside it, `k` and `b`
// signed in, `x` expired, `n` with an account and no credentials, `bad` with
// unreadable credentials, and two folders that are not accounts.
async function home() {
  const dir = await scratch();
  const profile = async (name, files) => {
    await mkdir(path.join(dir, name));
    for (const [file, value] of Object.entries(files)) await writeFile(path.join(dir, name, file), typeof value === 'string' ? value : JSON.stringify(value));
  };
  await profile('.claude', { '.credentials.json': oauth('default', { plan: 'max' }) });
  await writeFile(path.join(dir, '.claude.json'), JSON.stringify({ oauthAccount: { emailAddress: 'default@example.invalid' } }));
  await profile('.claude-k', { '.credentials.json': oauth('k'), '.claude.json': { oauthAccount: {} } });
  await profile('.claude-b', { '.credentials.json': oauth('b') });
  await profile('.claude-x', { '.credentials.json': oauth('x', { expiresAt: NOW - 1000 }) });
  await profile('.claude-n', { '.claude.json': { oauthAccount: {} } });
  await profile('.claude-bad', { '.credentials.json': '{not json' });
  await profile('.claude-backup', { 'notes.txt': 'not an account' });
  await profile('.claude-with space', { '.credentials.json': oauth('space') });
  return dir;
}

function usage(session, weekly, extra = {}) {
  return {
    five_hour: { utilization: session, resets_at: session ? '2026-10-22T14:30:00.123456+00:00' : null },
    seven_day: { utilization: weekly, resets_at: '2026-10-24T03:00:00.420026+00:00' },
    seven_day_opus: null,
    seven_day_sonnet: null,
    extra_usage: { is_enabled: false },
    ...extra,
  };
}

// A fetch that answers per token and records every call; `replies` maps a
// profile to a body, a status number, or an Error to throw. Usage reads go in
// `calls`; renewals, answered from `replies.renew` by the profile in the
// refresh token (400 when it has none), go in `renewals`.
function stubFetch(replies) {
  const calls = [];
  const renewals = [];
  const answer = (reply) => {
    if (reply instanceof Error) throw reply;
    if (typeof reply === 'number') return new Response('{"error":"no"}', { status: reply });
    return new Response(JSON.stringify(reply), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  const fetch = async (url, init) => {
    if (url === RENEW_URL) {
      const body = JSON.parse(init.body);
      const profile = /^sk-ant-ort01-(.+)$/.exec(body.refresh_token)?.[1];
      renewals.push({ profile, body, headers: init.headers, method: init.method });
      const reply = replies.renew?.[profile] ?? 400;
      return answer(typeof reply === 'function' ? await reply() : reply);
    }
    const auth = init.headers.Authorization;
    const profile = /^Bearer sk-ant-oat01-([^-]+)-/.exec(auth)?.[1];
    calls.push({ url, profile, headers: init.headers });
    return answer(replies[profile]);
  };
  return { fetch, calls, renewals };
}

async function snapshot(dir) {
  const entries = await readdir(dir, { recursive: true });
  return Promise.all(entries.sort().map(async (entry) => {
    const file = path.join(dir, entry);
    const info = await stat(file);
    return [entry, info.mtimeMs, info.isFile() ? await readFile(file, 'utf8') : ''];
  }));
}

test('reads every account with its own token, says why one cannot be read, and writes nothing', async () => {
  const dir = await home();
  const before = await snapshot(dir);
  const { fetch, calls } = stubFetch({ default: usage(40, 10), k: usage(0, 66), b: usage(12, 30) });
  const result = await new Limits({ home: dir, fetch, clock: () => NOW }).read();

  assert.deepEqual(result.accounts.map((account) => [account.profile, account.folder, account.state]), [
    ['default', '~/.claude', 'ok'],
    ['b', '~/.claude-b', 'ok'],
    ['bad', '~/.claude-bad', 'error'],
    ['k', '~/.claude-k', 'ok'],
    ['n', '~/.claude-n', 'no token'],
    ['x', '~/.claude-x', 'expired'],
  ]);
  const byProfile = Object.fromEntries(result.accounts.map((account) => [account.profile, account]));
  assert.deepEqual(byProfile.default.windows, {
    session: { percent: 40, resetsAt: '2026-10-22T14:30:00.123Z' },
    weekly: { percent: 10, resetsAt: '2026-10-24T03:00:00.420Z' },
  });
  assert.equal(byProfile.default.plan, 'max');
  assert.equal(byProfile.default.left, 60);
  assert.equal(byProfile.k.windows.session.resetsAt, null);
  assert.equal(byProfile.k.left, 34);
  assert.equal(byProfile.b.left, 70);
  assert.equal(result.mostLeft, 'b');
  assert.match(byProfile.x.reason, /^expired: the sign-in could not be renewed \(HTTP 400\); sign in again in Claude Code there$/);
  assert.match(byProfile.n.reason, /^no token/);
  assert.match(byProfile.bad.reason, /^error: \.credentials\.json could not be read/);
  assert.equal(result.readAt, new Date(NOW).toISOString());

  // Each account's own token, to Claude Code's endpoint; none for the one
  // whose renewal was refused.
  assert.deepEqual(calls.map((call) => call.profile), ['default', 'b', 'k']);
  for (const call of calls) {
    assert.equal(call.url, USAGE_URL);
    assert.equal(call.headers.Authorization, `Bearer ${token(call.profile)}`);
    assert.equal(call.headers['anthropic-beta'], 'oauth-2025-04-20');
  }
  // No token and no email reaches the reading.
  const text = JSON.stringify(result);
  assert.doesNotMatch(text, /sk-ant-/);
  assert.doesNotMatch(text, /@example\.invalid/);
  assert.deepEqual(await snapshot(dir), before);
});

test('a reading is held for 5 minutes, and a forced read for a minute', async () => {
  const dir = await scratch();
  await mkdir(path.join(dir, '.claude-k'));
  await writeFile(path.join(dir, '.claude-k', '.credentials.json'), JSON.stringify(oauth('k', { expiresAt: NOW + 86400_000 })));
  let now = NOW;
  const { fetch, calls } = stubFetch({ k: usage(5, 50) });
  const limits = new Limits({ home: dir, fetch, clock: () => now });

  await limits.read();
  now += 30_000;
  await limits.read();
  await limits.read({ refresh: true });
  assert.equal(calls.length, 1, 'within a minute neither a read nor a forced one asks again');
  now += 31_000;
  await limits.read();
  assert.equal(calls.length, 1, 'a plain read waits out the 5 minutes');
  await limits.read({ refresh: true });
  assert.equal(calls.length, 2, 'a forced read after a minute asks again');
  now += 5 * 60_000;
  const result = await limits.read();
  assert.equal(calls.length, 3);
  assert.equal(result.accounts[0].readAt, new Date(now).toISOString());

  // Reads that arrive together share one request.
  now += 5 * 60_000;
  await Promise.all([limits.read(), limits.read(), limits.read({ refresh: true })]);
  assert.equal(calls.length, 4);
});

test('a failed read, and a token that has since expired, show the last good reading as stale', async () => {
  const dir = await scratch();
  await mkdir(path.join(dir, '.claude-k'));
  const credentials = path.join(dir, '.claude-k', '.credentials.json');
  await writeFile(credentials, JSON.stringify(oauth('k')));
  let now = NOW;
  const replies = { k: usage(20, 70) };
  const { fetch, calls } = stubFetch(replies);
  const limits = new Limits({ home: dir, fetch, clock: () => now });
  const good = (await limits.read()).accounts[0];
  assert.equal(good.stale, false);

  replies.k = 429;
  now += 5 * 60_000;
  const limited = await limits.read();
  assert.equal(limited.accounts[0].state, 'error');
  assert.match(limited.accounts[0].reason, /^error: asked too often \(HTTP 429\)/);
  assert.equal(limited.accounts[0].stale, true);
  assert.deepEqual(limited.accounts[0].windows, good.windows);
  assert.equal(limited.accounts[0].readAt, good.readAt);
  assert.equal(limited.mostLeft, null, 'a stale reading is never the one to choose');

  replies.k = 401;
  now += 5 * 60_000;
  assert.match((await limits.read()).accounts[0].reason, /the token was refused \(HTTP 401\); sign in again in Claude Code/);

  // The token lapses and its renewal is refused: the last good reading, and
  // the file as it was.
  now += 2 * 3600_000;
  const before = await readFile(credentials, 'utf8');
  const calledBefore = calls.length;
  const expired = (await limits.read({ refresh: true })).accounts[0];
  assert.equal(calls.length, calledBefore);
  assert.equal(expired.state, 'expired');
  assert.equal(expired.stale, true);
  assert.deepEqual(expired.windows, good.windows);
  assert.equal(await readFile(credentials, 'utf8'), before);
});

// A profile signed in as Claude Code leaves it, its access token lapsed.
async function lapsedProfile(dir, name) {
  await mkdir(path.join(dir, `.claude-${name}`));
  const file = path.join(dir, `.claude-${name}`, '.credentials.json');
  const signIn = oauth(name, { expiresAt: NOW - 60_000 });
  Object.assign(signIn.claudeAiOauth, { scopes: ['user:inference', 'user:profile'], rateLimitTier: 'default_claude_max_5x', refreshTokenExpiresAt: NOW + 86400_000 });
  await writeFile(file, JSON.stringify({ ...signIn, mcpOAuth: { server: { token: 'kept' } } }), { mode: 0o600 });
  return file;
}

test('a lapsed token is renewed as Claude Code renews it, and the renewed sign-in written back', async () => {
  const dir = await scratch();
  const file = await lapsedProfile(dir, 'k');
  const { fetch, calls, renewals } = stubFetch({
    kk: usage(25, 40),
    renew: { k: { access_token: token('kk'), refresh_token: 'sk-ant-ort01-kk', expires_in: 28800, refresh_token_expires_in: 864000, scope: 'user:inference user:profile', token_type: 'Bearer' } },
  });
  let now = NOW;
  const limits = new Limits({ home: dir, fetch, clock: () => now });
  const result = await limits.read();
  const account = result.accounts[0];
  assert.equal(account.state, 'ok');
  assert.equal(account.left, 60);
  assert.equal(result.mostLeft, 'k');

  assert.equal(renewals.length, 1);
  assert.equal(renewals[0].method, 'POST');
  assert.equal(renewals[0].headers['Content-Type'], 'application/json');
  assert.deepEqual(renewals[0].body, { grant_type: 'refresh_token', refresh_token: 'sk-ant-ort01-k', client_id: '9d1c250a-e61b-44d9-88ed-5944d1962f5e', scope: 'user:inference user:profile' });
  assert.deepEqual(calls.map((call) => call.headers.Authorization), [`Bearer ${token('kk')}`]);

  // Only the token fields change; the rest of the file, and its mode, stay.
  const saved = JSON.parse(await readFile(file, 'utf8'));
  assert.deepEqual(saved, {
    claudeAiOauth: {
      accessToken: token('kk'),
      refreshToken: 'sk-ant-ort01-kk',
      expiresAt: NOW + 28800_000,
      subscriptionType: 'pro',
      scopes: ['user:inference', 'user:profile'],
      rateLimitTier: 'default_claude_max_5x',
      refreshTokenExpiresAt: NOW + 864000_000,
    },
    mcpOAuth: { server: { token: 'kept' } },
  });
  assert.equal((await stat(file)).mode & 0o777, 0o600);
  assert.deepEqual(await readdir(path.dirname(file)), ['.credentials.json']);
  assert.doesNotMatch(JSON.stringify(result), /sk-ant-/);

  // The renewed token is good: no second renewal.
  now += 5 * 60_000;
  assert.equal((await limits.read()).accounts[0].state, 'ok');
  assert.equal(renewals.length, 1);
  assert.equal(calls.length, 2);
});

test('when Claude Code renews the sign-in first, its sign-in stays and AGE Aris writes nothing', async () => {
  const dir = await scratch();
  const file = await lapsedProfile(dir, 'k');
  const theirs = JSON.stringify({ claudeAiOauth: { accessToken: token('cc'), refreshToken: 'sk-ant-ort01-cc', expiresAt: NOW + 28800_000, subscriptionType: 'pro' } });
  const { fetch, calls } = stubFetch({
    kk: usage(10, 10),
    renew: { k: async () => { await writeFile(file, theirs); return { access_token: token('kk'), refresh_token: 'sk-ant-ort01-kk', expires_in: 28800 }; } },
  });
  const account = (await new Limits({ home: dir, fetch, clock: () => NOW }).read()).accounts[0];
  assert.equal(account.state, 'ok');
  assert.equal(calls.length, 1);
  assert.equal(await readFile(file, 'utf8'), theirs);
});

test('a refused renewal leaves the file alone, says to sign in again, and is not asked again each minute', async () => {
  const dir = await scratch();
  const file = await lapsedProfile(dir, 'k');
  const before = await readFile(file, 'utf8');
  await mkdir(path.join(dir, '.claude-r'));
  await writeFile(path.join(dir, '.claude-r', '.credentials.json'), JSON.stringify({ claudeAiOauth: { accessToken: token('r'), expiresAt: NOW - 1 } }));
  const replies = { renew: { k: 400 } };
  const { fetch, calls, renewals } = stubFetch(replies);
  let now = NOW;
  const limits = new Limits({ home: dir, fetch, clock: () => now });
  const [k, r] = (await limits.read()).accounts;
  assert.equal(k.state, 'expired');
  assert.equal(k.reason, 'expired: the sign-in could not be renewed (HTTP 400); sign in again in Claude Code there');
  assert.equal(r.state, 'expired');
  assert.equal(r.reason, 'expired: this profile keeps no refresh token; sign in again in Claude Code there');
  assert.equal(await readFile(file, 'utf8'), before);
  assert.deepEqual(renewals.map((renewal) => renewal.profile), ['k']);

  now += 60_000;
  await limits.read({ refresh: true });
  assert.equal(renewals.length, 1, 'a refused renewal waits out the 5 minutes');
  replies.renew.k = Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNRESET' } });
  now += 5 * 60_000;
  assert.equal((await limits.read()).accounts[0].reason, 'expired: could not reach platform.claude.com (ECONNRESET)');
  assert.equal(renewals.length, 2);
  assert.equal(calls.length, 0);
});

test('a network failure or a bad reply is named without the token', async () => {
  const dir = await scratch();
  for (const name of ['a', 'b', 'c', 'd']) {
    await mkdir(path.join(dir, `.claude-${name}`));
    await writeFile(path.join(dir, `.claude-${name}`, '.credentials.json'), JSON.stringify(oauth(name)));
  }
  const unreachable = Object.assign(new TypeError(`fetch failed ${token('a')}`), { cause: { code: 'ENOTFOUND' } });
  const timeout = Object.assign(new Error('timed out'), { name: 'TimeoutError' });
  const { fetch } = stubFetch({ a: unreachable, b: timeout, c: { five_hour: null, seven_day: null }, d: 500 });
  const result = await new Limits({ home: dir, fetch, clock: () => NOW }).read();
  assert.deepEqual(result.accounts.map((account) => account.reason), [
    'error: could not reach api.anthropic.com (ENOTFOUND)',
    'error: no reply within 10 seconds',
    'error: the reply had neither a session nor a weekly limit',
    'error: HTTP 500',
  ]);
  assert.doesNotMatch(JSON.stringify(result), /sk-ant-/);
});

test('parseUsage keeps the windows the plan has, and only numbers and instants from them', () => {
  assert.deepEqual(parseUsage(usage(1.234, 99.96, {
    seven_day_opus: { utilization: 12, resets_at: 'not a date' },
    seven_day_sonnet: { utilization: '50', resets_at: '2026-10-24T03:00:00Z' },
    extra_usage: { is_enabled: true },
  })), {
    windows: {
      session: { percent: 1.2, resetsAt: '2026-10-22T14:30:00.123Z' },
      weekly: { percent: 100, resetsAt: '2026-10-24T03:00:00.420Z' },
      weeklyOpus: { percent: 12, resetsAt: null },
    },
    extraUsage: true,
  });
  assert.throws(() => parseUsage([]), /not a usage object/);
  assert.throws(() => parseUsage(null), /not a usage object/);
});

test('a home folder with no Claude account reads as none', async () => {
  const { fetch, calls } = stubFetch({});
  assert.deepEqual(await new Limits({ home: await scratch(), fetch, clock: () => NOW }).read(), { readAt: new Date(NOW).toISOString(), accounts: [], mostLeft: null });
  assert.deepEqual(await new Limits({ home: path.join(await scratch(), 'missing'), fetch, clock: () => NOW }).read(), { readAt: new Date(NOW).toISOString(), accounts: [], mostLeft: null });
  assert.equal(calls.length, 0);
});

test('GET /api/limits is behind the API token, and ?refresh=1 reads past the cache', async (t) => {
  const data = await scratch();
  let now = NOW;
  const { fetch, calls } = stubFetch({ default: usage(40, 10), k: usage(0, 66), b: usage(12, 30) });
  const server = await createServer({ dataDir: data, clock: () => now, limitsOptions: { home: await home(), fetch } });
  t.after(async () => {
    if (server.listening) {
      server.close();
      await once(server, 'close');
    }
  });
  server.listen(0, '127.0.0.1');
  try { await once(server, 'listening'); } catch (error) {
    if (error?.code === 'EPERM') return t.skip('This environment does not permit binding a loopback test server');
    throw error;
  }
  const base = `http://127.0.0.1:${server.address().port}/api/limits`;
  const headers = { 'X-AGEAris-Token': server.apiToken };

  assert.equal((await globalThis.fetch(base)).status, 401);
  const first = await (await globalThis.fetch(base, { headers })).json();
  assert.equal(first.mostLeft, 'b');
  assert.deepEqual(first.accounts.map((account) => account.profile), ['default', 'b', 'bad', 'k', 'n', 'x']);
  assert.equal(calls.length, 3);
  now += 61_000;
  await (await globalThis.fetch(base, { headers })).json();
  assert.equal(calls.length, 3);
  const forced = await (await globalThis.fetch(`${base}?refresh=1`, { headers })).json();
  assert.equal(calls.length, 6);
  assert.equal(forced.accounts[0].readAt, new Date(now).toISOString());
  assert.doesNotMatch(JSON.stringify(forced), /sk-ant-/);
});
