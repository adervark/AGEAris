import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readdir, readFile } from 'node:fs/promises';
import { test } from 'node:test';

import { boardLines, capabilities, CAPABILITIES, CLASSES } from '../lib/capabilities.mjs';

// The capabilities manifest (agent-brain design §5.6): every action the page
// offers has an entry, no operator-only entry is offered to an agent, and
// board.sh prints the board's part of it as the manifest has it.

const publicDir = new URL('../public/', import.meta.url);
const pages = await Promise.all((await readdir(publicDir)).filter((name) => name.endsWith('.js') || name.endsWith('.html')).map(async (name) => ({ name, text: await readFile(new URL(name, publicDir), 'utf8') })));

// Each `data-action="…"` the page writes, and where.
function pageActions() {
  const found = new Map();
  for (const { name, text } of pages) {
    for (const match of text.matchAll(/data-action="([^"]*)"/g)) {
      if (!found.has(match[1])) found.set(match[1], name);
    }
  }
  return found;
}

test('capabilities: every data-action on the page has one entry, and every entry\'s ui is on the page', () => {
  const actions = pageActions();
  // A data-action built at run time could not be held to the table.
  for (const action of actions.keys()) assert.match(action, /^[a-z]+(?:-[a-z]+)*$/, `data-action="${action}" in ${actions.get(action)} is built, not written`);
  for (const { name, text } of pages) {
    assert.ok(!/dataset\.action\s*=|setAttribute\(\s*['"]data-action/.test(text), `${name} sets a data-action at run time`);
  }
  const covered = new Map();
  for (const entry of CAPABILITIES) {
    for (const action of entry.ui) {
      assert.ok(!covered.has(action), `${action} is in both ${covered.get(action)} and ${entry.id}`);
      covered.set(action, entry.id);
    }
  }
  const missing = [...actions.keys()].filter((action) => !covered.has(action));
  assert.deepEqual(missing, [], `data-actions with no entry in lib/capabilities.mjs: ${missing.map((action) => `${action} (${actions.get(action)})`).join(', ')}`);
  const stale = [...covered.keys()].filter((action) => !actions.has(action));
  assert.deepEqual(stale, [], `entries name data-actions the page no longer has: ${stale.join(', ')}`);
});

test('capabilities: each entry has an id, a class, how, inputs and refusals; an operator-only one says what to ask', () => {
  const ids = CAPABILITIES.map((entry) => entry.id);
  assert.equal(new Set(ids).size, ids.length, 'ids are unique');
  for (const entry of CAPABILITIES) {
    assert.match(entry.id, /^[a-z]+(?:-[a-z]+)*$/);
    assert.ok(CLASSES.includes(entry.class), `${entry.id}: class ${entry.class}`);
    assert.ok(typeof entry.how === 'string' && entry.how !== '', `${entry.id}: how`);
    assert.ok(Array.isArray(entry.inputs) && entry.inputs.every((item) => typeof item === 'string' && item), `${entry.id}: inputs`);
    assert.ok(Array.isArray(entry.refuses) && entry.refuses.every((item) => typeof item === 'string' && item), `${entry.id}: refuses`);
    assert.ok(Array.isArray(entry.ui), `${entry.id}: ui`);
    assert.equal(typeof entry.ask === 'string' && entry.ask !== '', entry.class === 'operator-only', `${entry.id}: ask, exactly when operator-only`);
    if (entry.instead !== undefined) {
      const other = CAPABILITIES.find((item) => item.id === entry.instead);
      assert.ok(other && (other.class === 'agent-git' || other.class === 'agent-read'), `${entry.id}: instead names an agent's own way`);
    }
    // Text for the board's tab-separated lines.
    for (const text of [entry.how, ...entry.inputs, ...entry.refuses]) assert.ok(!/[\t\n]/.test(text), `${entry.id}: no tab or newline`);
  }
  for (const id of ['task-action', 'switch-task-actions', 'stop-tracking', 'track']) {
    assert.equal(CAPABILITIES.find((entry) => entry.id === id)?.class, 'operator-only', `${id} is the operator's`);
  }
});

test('capabilities: an agent is offered only what it may do; what it must ask for is kept apart', () => {
  const agent = capabilities({ for: 'agent' });
  assert.equal(agent.schema, 'aa.capabilities/1');
  for (const entry of agent.may) {
    assert.ok(entry.class === 'agent-git' || entry.class === 'agent-read', `${entry.id} (${entry.class}) is offered to an agent`);
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
    const printed = execFileSync('bash', [path, '--capabilities'], { cwd: new URL('..', import.meta.url), encoding: 'utf8' });
    assert.equal(printed, `${boardLines()}\n`, `${path} --capabilities is out of step with lib/capabilities.mjs`);
  }
  assert.ok(boardLines().split('\n').every((line) => line.split('\t').length === 5 && line.split('\t')[1] === 'agent-git'));
});
