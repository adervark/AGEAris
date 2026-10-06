import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { Cockpit } from '../lib/brief.mjs';
import { METRIC_DEFINITIONS } from '../lib/metrics.mjs';
import { Workspace } from '../lib/workspace.mjs';
import { escape, renderChanges, renderExplain, renderHealth, renderHistory, renderToday } from '../public/cockpit.js';
import { briefQuery, CURSOR_KEY, cursorFromBrief, readCursor, readWindow, WINDOW_KEY, writeCursor, writeWindow } from '../public/cursor.js';

process.env.GIT_CONFIG_GLOBAL = os.devNull;
process.env.GIT_CONFIG_NOSYSTEM = '1';

const NOW = Date.parse('2026-10-05T09:12:00+01:00');
const SHA = 'a'.repeat(40);
const PROJECT = '00000000-0000-4000-8000-000000000001';

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return { getItem: (key) => (values.has(key) ? values.get(key) : null), setItem: (key, value) => values.set(key, String(value)), values };
}

const broken = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };

test('the last-visit cursor survives missing or failing storage and turns into the brief query', () => {
  assert.equal(readCursor(null), null);
  assert.equal(readCursor(broken), null);
  assert.equal(writeCursor(broken, { at: 'x', heads: {} }), false);
  assert.equal(readWindow(broken), 'last-visit');
  assert.equal(readCursor(memoryStorage({ [CURSOR_KEY]: '{not json' })), null);
  assert.equal(readCursor(memoryStorage({ [CURSOR_KEY]: '{"at": "yesterday"}' })), null);

  // Without a cursor, last-visit asks by time and says why.
  const fresh = briefQuery({ storage: memoryStorage(), now: NOW });
  assert.equal(fresh.params.get('window'), 'last-visit');
  assert.equal(fresh.params.has('since'), false);
  assert.match(fresh.label, /no last visit/);

  const storage = memoryStorage();
  const brief = { asOf: new Date(NOW).toISOString(), projects: [{ projectId: PROJECT, state: 'ready', build: { ledgerSha: SHA } }, { projectId: 'other', state: 'building', build: null }] };
  assert.deepEqual(cursorFromBrief(brief), { at: brief.asOf, heads: { [PROJECT]: SHA } });
  writeCursor(storage, cursorFromBrief(brief));
  // Heads that are not shas are dropped when read back.
  storage.values.set(CURSOR_KEY, JSON.stringify({ at: brief.asOf, heads: { [PROJECT]: SHA, bad: 'nope' } }));
  const query = briefQuery({ storage, now: NOW + 3600000 });
  assert.equal(query.params.get('since'), brief.asOf);
  assert.equal(query.params.get('sinceHeads'), `${PROJECT}:${SHA}`);
  assert.equal(query.clamped, false);

  // A cursor older than 14 days is clamped, and no longer says where it was.
  const old = briefQuery({ storage, now: NOW + 20 * 86400000 });
  assert.equal(old.clamped, true);
  assert.equal(old.params.get('since'), new Date(NOW + 6 * 86400000).toISOString());
  assert.equal(old.params.has('sinceHeads'), false);

  // The window choice is remembered; an unknown one falls back.
  writeWindow(storage, '7d');
  assert.equal(briefQuery({ storage, now: NOW }).params.get('window'), '7d');
  assert.equal(briefQuery({ storage, now: NOW }).params.has('since'), false);
  storage.values.set(WINDOW_KEY, 'forever');
  assert.equal(readWindow(storage), 'last-visit');
});

// Every interpolation is escaped and no inline style is emitted (the CSP
// allows none); every number button names a metric the server knows.
function checkMarkup(html, label) {
  assert.doesNotMatch(html, /style=/, `${label}: no inline style`);
  assert.doesNotMatch(html, /<script|<img/i, `${label}: nothing injected`);
  for (const [, metric] of html.matchAll(/data-metric="([^"]*)"/g)) assert.ok(Object.hasOwn(METRIC_DEFINITIONS, metric), `${label}: ${metric} is a metric`);
}

test('the cockpit views render the sample project, escape what they show, and cite metrics', async (t) => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), 'agesight-ui-'));
  t.after(() => rm(dataDir, { recursive: true, force: true }));
  const workspace = await new Workspace({ dataDir, operator: 'ade', email: 'ade@example.invalid' }).init();
  await writeFile(path.join(dataDir, 'settings.json'), '{"timezone": "Europe/London"}');
  // The sample's history ends now, so a later edit lands after it.
  const project = await workspace.createSampleProject({ now: Date.now() });
  // A hostile title shows as text.
  const task = await workspace.getTask(`${project.id}:T040`);
  await workspace.updateTask(task.id, { title: '<img src=x onerror=alert(1)> Launch', version: task.version });
  const cockpit = new Cockpit({ workspace, engine: null, clock: Date.now });
  t.after(() => cockpit.close());

  const brief = await cockpit.brief({ window: 'previous-workday' });
  const today = renderToday(brief, { mode: 'previous-workday', expanded: new Set(['finished', 'added']) });
  checkMarkup(today, 'Today');
  assert.match(today, /&lt;img src=x onerror=alert\(1\)&gt; Launch/);
  assert.match(today, /Simulated history/);
  assert.match(today, /data-action="mark-seen"/);
  assert.match(today, /<option value="previous-workday" selected>/);
  assert.match(today, /data-metric="overdue"/);
  assert.match(today, /data-metric="health"/);
  assert.match(today, /id="delta-finished"/, 'an expanded delta lists its items');
  assert.doesNotMatch(today, /P50|P85|percentile/i, 'no percentiles on Today');

  const metrics = await cockpit.projectMetrics(project.id, {});
  const health = renderHealth(metrics, { projectId: project.id });
  checkMarkup(health, 'Health');
  for (const id of ['done_7d', 'cycle_time_p85', 'lead_time_p50', 'wip', 'blocked_share']) assert.match(health, new RegExp(`data-metric="${id}"`));
  assert.match(health, /data-metric="due_risk" data-project="[^"]+" data-task="T039"/);
  assert.match(health, /Stale agent claims/);
  assert.match(health, /ledger <code>[0-9a-f]{7}<\/code>/);

  for (const id of ['overdue', 'health', 'cycle_time_p85', 'load']) {
    const value = await cockpit.explain(id, { projectId: project.id });
    const html = renderExplain(value);
    checkMarkup(html, `Explain ${id}`);
    assert.match(html, /id="explain-dialog-title"/);
    assert.match(html, new RegExp(`Metric <code>${id}</code>`));
  }
  const risk = renderExplain(await cockpit.explain('due_risk', { projectId: project.id, taskKey: 'T039' }));
  assert.match(risk, /Finished items compared/);
  assert.match(renderExplain({ error: '<b>gone</b>' }), /&lt;b&gt;gone&lt;\/b&gt;/);

  const feed = await cockpit.changes({ limit: 200 });
  const changes = renderChanges(feed, { kind: '', projectId: '', projects: [project], timezone: 'Europe/London' });
  checkMarkup(changes, 'Changes');
  assert.match(changes, /&lt;img src=x/);
  assert.match(changes, /<code title="[^"]*">[0-9a-f]{7}<\/code>/, 'each change cites its commit');

  const history = renderHistory(await cockpit.taskHistory(`${project.id}:T040`), 'Europe/London');
  checkMarkup(history, 'History');
  assert.match(history, /Created/);
  assert.match(renderHistory({ error: '<x>' }), /&lt;x&gt;/);
  assert.equal(escape(`"'&<>`), '&quot;&#39;&amp;&lt;&gt;');
});
