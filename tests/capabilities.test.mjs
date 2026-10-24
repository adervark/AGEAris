import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { createServer } from '../server.mjs';
import { AGENT_CLASSES, boardLines, capabilities, CAPABILITIES, CLASSES } from '../lib/capabilities.mjs';

// The capabilities manifest (agent-brain design §5.6): every action the page
// offers and every route the server has is in an entry, no operator-only entry
// is offered to an agent, and board.sh prints the board's part of it as the
// manifest has it.

process.env.GIT_CONFIG_GLOBAL = os.devNull;
process.env.GIT_CONFIG_NOSYSTEM = '1';

const root = new URL('..', import.meta.url);

async function filesUnder(url) {
  const out = [];
  for (const entry of await readdir(url, { withFileTypes: true })) {
    if (entry.isDirectory()) out.push(...await filesUnder(new URL(`${entry.name}/`, url)));
    else if (/\.(?:m?js|html)$/.test(entry.name)) out.push({ name: new URL(entry.name, url).pathname.split('/public/')[1], text: await readFile(new URL(entry.name, url), 'utf8') });
  }
  return out;
}
const pages = await filesUnder(new URL('public/', root));
const server = await readFile(new URL('server.mjs', root), 'utf8');

// Each data-action the page writes, in either quote or none, and where; a CSS
// selector such as [data-action="x"] only finds one. The switch in onAction
// names what the page handles.
function pageActions() {
  const written = new Map();
  for (const { name, text } of pages) {
    for (const match of text.matchAll(/(?<!\[)data-action\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>"'`]+))/g)) {
      const value = match[1] ?? match[2] ?? match[3];
      if (!written.has(value)) written.set(value, name);
    }
  }
  const app = pages.find((page) => page.name === 'app.js').text;
  const start = app.indexOf('function onAction(');
  const body = app.slice(start, app.indexOf('\n}\n', start));
  const handled = new Set([...body.matchAll(/case '([^']+)':/g)].map((match) => match[1]));
  return { written, handled };
}

test('capabilities: every data-action the page writes or handles has one entry, and every entry\'s ui is on the page', () => {
  const { written, handled } = pageActions();
  assert.ok(written.size > 20 && handled.size > 20, 'the scan finds the page\'s actions');
  // A data-action built at run time could not be held to the table.
  for (const [action, name] of written) assert.match(action, /^[a-z]+(?:-[a-z]+)*$/, `data-action="${action}" in ${name} is built, not written`);
  for (const { name, text } of pages) {
    assert.ok(!/dataset\s*(?:\.\s*action|\[\s*['"`]action['"`]\s*\])\s*=(?!=)|setAttribute\(\s*['"`]data-action|Object\.assign\(\s*[\w.]*dataset/.test(text), `${name} sets a data-action at run time`);
  }
  const covered = new Map();
  for (const entry of CAPABILITIES) {
    for (const action of entry.ui) {
      assert.ok(!covered.has(action), `${action} is in both ${covered.get(action)} and ${entry.id}`);
      covered.set(action, entry.id);
    }
  }
  const missing = [...new Set([...written.keys(), ...handled])].filter((action) => !covered.has(action));
  assert.deepEqual(missing, [], `data-actions with no entry in lib/capabilities.mjs: ${missing.join(', ')}`);
  // An action handled but never written is dead code, and its entry with it.
  const stale = [...covered.keys()].filter((action) => !written.has(action));
  assert.deepEqual(stale, [], `entries name data-actions the page no longer writes: ${stale.join(', ')}`);
});

// The server's API routes, read from server.mjs: each `request.method ===`
// test with its literal path, or its matcher and what it asks of group 2.
function serverRoutes() {
  const matchers = new Map();
  for (const match of server.matchAll(/const (\w+Match) = \/(.+)\/\.exec\(pathname\);/g)) matchers.set(match[1], new RegExp(match[2]));
  const routes = [];
  for (const line of server.split('\n')) {
    for (const match of line.matchAll(/request\.method === '([A-Z]+)' && (?:pathname === '(\/api\/[^']*)'|(\w+Match)(\?\.\[2\] === '([^']+)'| && !\w+Match\[2\])?)/g)) {
      const [, method, literal, matcher, condition, suffix] = match;
      if (literal) routes.push({ method, label: `${method} ${literal}`, test: (path) => path === literal });
      else if (matchers.has(matcher)) {
        const regex = matchers.get(matcher);
        const group = (path) => regex.exec(path)?.[2];
        routes.push({
          method, label: `${method} ${regex.source}${suffix ? ` [${suffix}]` : condition ? ' [no group 2]' : ''}`,
          test: (path) => regex.test(path) && (suffix ? group(path) === suffix : condition ? group(path) === undefined : true),
        });
      }
    }
  }
  return routes;
}

const concrete = (route) => {
  const [method, path] = route.split(' ');
  return { method, path: path.replace(/:metric/g, 'cycle_time').replace(/:[a-z]+/g, '0c0c0c0c-0000-4000-8000-000000000009') };
};

test('capabilities: every API route the server has is in an entry, and every route an entry names is one', () => {
  const routes = serverRoutes();
  assert.ok(routes.length >= 30, `the scan finds the server's routes (${routes.length})`);
  const named = CAPABILITIES.flatMap((entry) => entry.routes.map((route) => ({ entry: entry.id, route, ...concrete(route) })));
  const missing = routes.filter((route) => !named.some((item) => item.method === route.method && route.test(item.path)));
  assert.deepEqual(missing.map((route) => route.label), [], 'server routes with no entry in lib/capabilities.mjs');
  const unknown = named.filter((item) => !routes.some((route) => route.method === item.method && route.test(item.path)));
  assert.deepEqual(unknown.map((item) => `${item.entry}: ${item.route}`), [], 'entries name routes the server does not have');
  for (const entry of CAPABILITIES.filter((item) => item.class === 'agent-read' || item.class === 'agent-runner')) assert.ok(entry.routes.length, `${entry.id} names its routes`);
});

test('capabilities: the server answers every route an entry names, so none is a 404 for want of a route', { timeout: 60000 }, async () => {
  const dataDir = await mkdtemp(join(os.tmpdir(), 'agearis-capabilities-'));
  const app = await createServer({ dataDir, registryOptions: { seed: () => [] } });
  try {
    app.listen(0, '127.0.0.1');
    await once(app, 'listening');
    const base = `http://127.0.0.1:${app.address().port}`;
    for (const route of CAPABILITIES.flatMap((entry) => entry.routes)) {
      const { method, path } = concrete(route);
      const response = await fetch(`${base}${path}`, { method, headers: { 'x-agearis-token': app.apiToken, ...(method === 'GET' || method === 'DELETE' ? {} : { 'content-type': 'application/json' }) }, ...(method === 'GET' || method === 'DELETE' ? {} : { body: '{}' }) });
      const body = await response.json();
      assert.notEqual(body.error, 'API endpoint not found', `${route} has no route`);
    }
  } finally {
    app.close();
    await once(app, 'close');
    await rm(dataDir, { recursive: true, force: true, maxRetries: 5 });
  }
});

test('capabilities: each entry has an id, a class, how, inputs and refusals; an operator-only one says what to ask', () => {
  const ids = CAPABILITIES.map((entry) => entry.id);
  assert.equal(new Set(ids).size, ids.length, 'ids are unique');
  for (const entry of CAPABILITIES) {
    assert.match(entry.id, /^[a-z]+(?:-[a-z]+)*$/);
    assert.ok(CLASSES.includes(entry.class), `${entry.id}: class ${entry.class}`);
    assert.ok(typeof entry.how === 'string' && entry.how !== '', `${entry.id}: how`);
    for (const key of ['inputs', 'refuses', 'routes', 'ui']) assert.ok(Array.isArray(entry[key]) && entry[key].every((item) => typeof item === 'string' && item), `${entry.id}: ${key}`);
    assert.equal(Array.isArray(entry.stops), entry.class === 'agent-git', `${entry.id}: stops, exactly on agent-git`);
    assert.equal(typeof entry.ask === 'string' && entry.ask !== '', entry.class === 'operator-only', `${entry.id}: ask, exactly when operator-only`);
    if (entry.instead !== undefined) {
      const other = CAPABILITIES.find((item) => item.id === entry.instead);
      assert.ok(other && AGENT_CLASSES.includes(other.class), `${entry.id}: instead names an agent's own way`);
    }
    // Text for the board's tab-separated lines.
    for (const text of [entry.how, ...entry.inputs, ...entry.refuses, ...(entry.stops || [])]) assert.ok(!/[\t\n]/.test(text), `${entry.id}: no tab or newline`);
  }
  for (const id of ['task-action', 'switch-task-actions', 'stop-tracking', 'track']) {
    assert.equal(CAPABILITIES.find((entry) => entry.id === id)?.class, 'operator-only', `${id} is the operator's`);
  }
});

test('capabilities: an agent is offered only what it may do; what it must ask for is kept apart', () => {
  const agent = capabilities({ for: 'agent' });
  assert.equal(agent.schema, 'aa.capabilities/1');
  for (const entry of agent.may) {
    assert.ok(AGENT_CLASSES.includes(entry.class), `${entry.id} (${entry.class}) is offered to an agent`);
    assert.equal(entry.ask, undefined);
  }
  const operatorOnly = CAPABILITIES.filter((entry) => entry.class === 'operator-only').map((entry) => entry.id);
  assert.deepEqual(agent.askOperator.map((entry) => entry.id), operatorOnly);
  for (const entry of agent.askOperator) assert.deepEqual(Object.keys(entry).filter((key) => !['id', 'ask', 'instead'].includes(key)), [], `${entry.id} carries no how`);
  // The 2026-10-10 incident: removing a repository must be findable.
  assert.match(agent.askOperator.find((entry) => entry.id === 'stop-tracking').ask, /stop tracking/);
  assert.deepEqual(capabilities().capabilities, CAPABILITIES);
});

test('capabilities: board.sh --capabilities prints the agent-git entries, in this repository and the aa-init template', () => {
  for (const path of ['AA/board.sh', 'skills/aa-init/template/board.sh']) {
    const printed = execFileSync('bash', [path, '--capabilities'], { cwd: root, encoding: 'utf8' });
    assert.equal(printed, `${boardLines()}\n`, `${path} --capabilities is out of step with lib/capabilities.mjs`);
  }
  assert.ok(boardLines().split('\n').every((line) => line.split('\t').length === 6 && line.split('\t')[1] === 'agent-git'));
});
