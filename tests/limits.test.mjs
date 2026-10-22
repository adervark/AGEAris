// lib/limits.mjs and GET /api/limits: each Claude account's session and weekly
// use. Every home folder is temporary and every fetch is stubbed: no network.
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { Limits, parseUsage, USAGE_URL } from '../lib/limits.mjs';
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
// profile to a body, a status number, or an Error to throw.
function stubFetch(replies) {
  const calls = [];
  const fetch = async (url, init) => {
    const auth = init.headers.Authorization;
    const profile = /^Bearer sk-ant-oat01-([^-]+)-/.exec(auth)?.[1];
    calls.push({ url, profile, headers: init.headers });
    const reply = replies[profile];
    if (reply instanceof Error) throw reply;
    if (typeof reply === 'number') return new Response('{"error":"no"}', { status: reply });
    return new Response(JSON.stringify(reply), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  return { fetch, calls };
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
  assert.match(byProfile.x.reason, /^expired: .*never does/);
  assert.match(byProfile.n.reason, /^no token/);
  assert.match(byProfile.bad.reason, /^error: \.credentials\.json could not be read/);
  assert.equal(result.readAt, new Date(NOW).toISOString());

  // Each account's own token, to Claude Code's endpoint; none for the expired one.
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

  // Claude Code has not run in the profile since: the token lapses, and is not renewed.
  now += 2 * 3600_000;
  const calledBefore = calls.length;
  const expired = (await limits.read({ refresh: true })).accounts[0];
  assert.equal(calls.length, calledBefore);
  assert.equal(expired.state, 'expired');
  assert.equal(expired.stale, true);
  assert.deepEqual(expired.windows, good.windows);
  assert.equal(JSON.parse(await readFile(credentials, 'utf8')).claudeAiOauth.refreshToken, 'sk-ant-ort01-k');
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
