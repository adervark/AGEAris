import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { Cockpit } from '../lib/brief.mjs';
import { METRIC_DEFINITIONS } from '../lib/metrics.mjs';
import { Workspace } from '../lib/workspace.mjs';
import { escape, renderActivity, renderEvidence, renderExplain, renderFlow, renderHome, renderMethod, renderTimeline, signalBadges, signalIndex } from '../public/cockpit.js';
import { agentShort, healthWord } from '../public/words.js';
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
  const { tasks } = await workspace.read();
  const byId = new Map(tasks.map((entry) => [entry.id, entry]));
  const home = renderHome(brief, { mode: 'previous-workday', expanded: new Set(['finished', 'added']), taskOf: (id) => byId.get(id), agentsByProject: new Map(), projects: [project] });
  checkMarkup(home, 'Home');
  assert.match(home, /&lt;img src=x onerror=alert\(1\)&gt; Launch/);
  assert.match(home, /Simulated history/);
  assert.match(home, /data-action="mark-seen"/);
  assert.match(home, /<option value="previous-workday" selected>/);
  assert.match(home, /data-metric="overdue"/);
  assert.match(home, /data-metric="health"/);
  assert.match(home, /id="delta-finished"/, 'an expanded delta lists its items');
  assert.match(home, /Overdue<span class="need-count">/, 'Needs you groups under the method\'s terms');
  assert.match(home, /Past the due date and not done/, 'each term carries its plain meaning');
  assert.match(home, new RegExp(`>${healthWord(brief.projects[0].health)}<`), 'health reads as words');
  assert.match(home, /Service level/);
  assert.doesNotMatch(home.replace(/data-metric="[^"]*"/g, ''), /\bP50\b|\bP85\b|percentile/i, 'the service level is named, not its percentile');
  assert.doesNotMatch(home, /<\/button> \/ \d/, 'WIP states its limit once ("8 of 8"), not again after it');

  // A task shows once, under its most pressing need; a need it also has is
  // not called clear.
  const alsoBlocked = { ...brief, needsYou: brief.needsYou.filter((row) => row.kind !== 'blocked') };
  assert.ok(alsoBlocked.needsYou.some((row) => row.reasons?.includes('blocked')), 'the sample has a blocked task listed under another need');
  const homeAlso = renderHome(alsoBlocked, { mode: 'previous-workday', expanded: new Set(), taskOf: (id) => byId.get(id), agentsByProject: new Map(), projects: [project] });
  assert.match(homeAlso, /also blocked/);
  assert.doesNotMatch(homeAlso, /nothing blocked/);
  // Nor is a check that cannot run yet.
  const young = { ...brief, needsYou: [], projects: brief.projects.map((entry) => ({ ...entry, kpis: { ...entry.kpis, aging: { ...entry.kpis.aging, status: 'insufficient' } } })) };
  const homeYoung = renderHome(young, { mode: 'previous-workday', expanded: new Set(), taskOf: (id) => byId.get(id), agentsByProject: new Map(), projects: [project] });
  assert.match(homeYoung, /Nothing needs you: no decisions waiting/);
  assert.doesNotMatch(homeYoung, /no aging WIP/);

  // One badge vocabulary for every task that needs a person.
  const index = signalIndex(brief);
  const overdueTask = index.get(`${project.id}:T040`);
  assert.ok(overdueTask.reasons.includes('overdue'));
  assert.match(signalBadges(overdueTask), /class="chip tone-fail"[^>]*>Overdue \d+ d</);
  assert.equal(agentShort('agent ade @k/b6192924'), 'k·b619');

  const metrics = await cockpit.projectMetrics(project.id, {});
  // Done this week on the board: every finish in the last 7 days, sweeps included.
  assert.ok(metrics.tables.finishedWeek.length >= metrics.metrics.done_7d.value);
  assert.ok(metrics.tables.finishedWeek.every((row) => typeof row.taskKey === 'string' && typeof row.at === 'string'));
  const flow = renderFlow(metrics, { projectId: project.id, wipLimit: 6 });
  checkMarkup(flow, 'Flow');
  for (const id of ['done_7d', 'cycle_time_p85', 'lead_time_p50', 'wip', 'blocked_share']) assert.match(flow, new RegExp(`data-metric="${id}"`));
  assert.match(flow, /data-metric="due_risk" data-project="[^"]+" data-task="T039"/);
  assert.match(flow, /Stale claims/);
  assert.match(flow, /class="limit-line"/, 'the WIP chart draws its limit');
  assert.doesNotMatch(flow, />weekly mean [\d.]+</, 'the usual week is a number under its label');
  assert.doesNotMatch(flow, /<small class="muted">\/ /, 'WIP states its limit once');
  assert.match(flow, /ledger <code title="[0-9a-f]{40}">[0-9a-f]{7}<\/code>/);

  const line = brief.projects.find((entry) => entry.projectId === project.id);
  const method = renderMethod({ project, method: { linked: false, board: 'deaddrop', staleHours: 24, wipLimit: 6, docs: [{ name: 'WORKFLOW.md', path: 'deaddrop/WORKFLOW.md', text: '# Flow\n\n<script>x</script> [x](javascript:alert(1))' }] }, data: metrics, line, tasks: tasks.filter((entry) => entry.projectId === project.id), pipeline: { stages: [{ name: 'Plan', role: 'plan', gate: true }] } });
  checkMarkup(method, 'Method');
  for (const id of line.health.rules.map((rule) => rule.id)) assert.match(method, new RegExp(`class="check-code"[^>]*>${id}<`), `check ${id} is listed`);
  assert.match(method, /At most 6 at once/);
  assert.match(method, /&lt;script&gt;x&lt;\/script&gt;/);
  assert.doesNotMatch(method, /href="javascript/);
  assert.match(method, /data-action="edit-pipeline"/);

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
  const activity = renderActivity(feed, { kind: '', projectId: '', projects: [project], timezone: 'Europe/London' });
  checkMarkup(activity, 'Activity');
  assert.match(activity, /&lt;img src=x/);
  assert.match(activity, /<code title="[^"]*">[0-9a-f]{7}<\/code>/, 'each change cites its commit');
  assert.ok((activity.match(/class="activity-row"/g) || []).length < feed.changes.length, 'a task\'s changes in a day share a row');
  assert.doesNotMatch(activity, /class="field-change">[^<]*[a-z][A-Z]/, 'changed fields read as words, not field names');

  const history = await cockpit.taskHistory(`${project.id}:T040`);
  const timeline = renderTimeline(history, 'Europe/London');
  checkMarkup(timeline, 'Timeline');
  assert.match(timeline, /Filed/);
  assert.match(renderTimeline({ error: '<x>' }), /&lt;x&gt;/);
  assert.match(renderEvidence(byId.get(`${project.id}:T040`), history), /<code title="[0-9a-f]{40}">[0-9a-f]{7}<\/code>/);
  assert.equal(escape(`"'&<>`), '&quot;&#39;&amp;&lt;&gt;');
});
