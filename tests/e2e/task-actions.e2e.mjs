// End to end: the task drawer's action bar in headless Chrome, on an AGE Aris
// project. Run with `npm run e2e`; it is outside `npm test` because it needs a
// browser. Puppeteer is not a dependency: it is loaded from AGESIGHT_PUPPETEER
// (a node_modules folder that holds it) and Chrome from AGESIGHT_CHROME.
//
// The server is the real one, on a free port with a fresh temporary data
// folder. Nothing outside that folder and a temporary tracked repository is read
// or written.
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readdir, readFile, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import test, { after, before } from 'node:test';

import { fabricate } from '../../lib/fabricate.mjs';
import { createServer } from '../../server.mjs';

process.env.GIT_CONFIG_GLOBAL = os.devNull;
process.env.GIT_CONFIG_NOSYSTEM = '1';

const PUPPETEER_DIR = process.env.AGESIGHT_PUPPETEER || path.join(os.homedir(), '.npm/_npx/668c188756b835f3/node_modules/');
const CHROME = process.env.AGESIGHT_CHROME || path.join(os.homedir(), '.cache/puppeteer/chrome/linux-152.0.7977.75/chrome-linux64/chrome');

function loadPuppeteer() {
  try { return createRequire(path.join(PUPPETEER_DIR, '/'))('puppeteer'); } catch (error) {
    throw new Error(`Puppeteer was not found in ${PUPPETEER_DIR} (${error.message}). Set AGESIGHT_PUPPETEER to a node_modules folder that holds it, and AGESIGHT_CHROME to a Chrome binary.`);
  }
}

let root;
let server;
let base;
let browser;
let page;
let projectId;
let trackedProjectId;
const ids = {};
const problems = [];

async function api(method, url, body) {
  const response = await fetch(`${base}/api${url}`, { method, headers: { 'x-agesight-token': server.apiToken, ...(body ? { 'content-type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const value = await response.json();
  assert.ok(response.ok, `${method} ${url}: ${value.error}`);
  return value;
}

const task = (name) => api('GET', `/tasks/${encodeURIComponent(ids[name])}`);
const until = async (check, message) => {
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  assert.fail(message);
};

before(async () => {
  root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'agesight-e2e-')));
  server = await createServer({ dataDir: path.join(root, 'data'), registryOptions: { seed: () => [] }, cockpitOptions: { buildWaitMs: 60_000 } });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  base = `http://127.0.0.1:${server.address().port}`;

  const project = await api('POST', '/projects', { name: 'Drawer actions', wipLimit: 6 });
  projectId = project.id;
  const make = async (name, fields = {}) => { ids[name] = (await api('POST', '/tasks', { projectId, title: name, ...fields })).id; };
  await make('Start me');
  await make('Block me', { status: 'in_progress' });
  await make('Finish me', { status: 'in_progress' });
  await make('Release me', { status: 'in_progress' });
  await make('Block quietly', { status: 'in_progress' });
  await make('Prioritise me');
  await make('Assign me');
  await make('Edit then start');
  await make('Dragged to start');
  await make('Dragged to block');
  await make('Parent');
  await make('Child');
  await make('Double click me');
  await make('Double enter me');
  await make('Edits survive Done');
  // A task builds on another through `depends`, which the API does not set.
  const dir = path.join(server.workspace.projectsDir, projectId, 'AA');
  for (const folder of ['backlog', 'tasks']) {
    for (const file of await readdir(path.join(dir, folder)).catch(() => [])) {
      if (!file.startsWith(ids.Child.split(':')[1])) continue;
      const full = path.join(dir, folder, file);
      await writeFile(full, (await readFile(full, 'utf8')).replace('depends: []', `depends: [${ids.Parent.split(':')[1]}]`));
    }
  }

  // A tracked repository, which AGE Aris only reads.
  const repository = (await fabricate(path.join(root, 'tracked'), 'day 0 09:00 ade: create T001 backlog "Read the archive"\nday 1 10:00 ade: write AA/AA.yml "wip:\\n  in_progress: 3\\n  blocked: 3\\n"')).dir;
  trackedProjectId = (await api('POST', '/projects/link', { path: repository, name: 'Their repo' })).id;

  const puppeteer = loadPuppeteer();
  browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });
  page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  // The refused action below is a 409 on purpose, and the browser logs every failed request.
  page.on('console', (message) => { if (['error', 'warning'].includes(message.type()) && !/status of 409/.test(message.text())) problems.push(`console ${message.type()}: ${message.text()}`); });
  page.on('pageerror', (error) => problems.push(`page error: ${error.message}`));
  await page.goto(`${base}/?token=${server.apiToken}#project/${projectId}`);
  await page.waitForSelector(`[data-action="open-task"][data-id="${ids['Start me']}"]`);
});

after(async () => {
  await browser?.close();
  if (server?.listening) { server.close(); await once(server, 'close'); }
  if (root) await rm(root, { recursive: true, force: true, maxRetries: 5 });
});

const card = (name) => `[data-action="open-task"][data-id="${ids[name]}"]`;
const bar = (act) => `#task-dialog .action-bar [data-act="${act}"]`;

// A refresh can replace a card between finding it and clicking it.
async function clickCard(selector) {
  for (let attempt = 0; ; attempt += 1) {
    try { await page.waitForSelector(selector); await page.click(selector); return; } catch (error) { if (attempt > 3) throw error; }
  }
}

async function openDrawer(name) {
  await clickCard(card(name));
  await page.waitForSelector(`#task-dialog[open] #task-form[data-task="${ids[name]}"]`);
}

const activeAct = () => page.evaluate(() => (document.activeElement?.closest('.action-bar') ? document.activeElement.dataset.act || document.activeElement.className : ''));
const pillIs = (text) => page.waitForFunction((expected) => document.querySelector('#task-dialog .drawer-summary .status-pill')?.textContent.trim() === expected, {}, text);
const summaryHas = (pattern) => page.waitForFunction((source) => new RegExp(source).test(document.querySelector('#task-dialog .drawer-summary')?.textContent || ''), {}, pattern);

async function closeDrawerAndExpectFocusOn(name) {
  await page.keyboard.press('Escape');
  await page.waitForSelector('#task-dialog:not([open])');
  // Focus is restored when the dialog's close event runs, a moment after it closes.
  await page.waitForFunction((id) => document.activeElement?.dataset?.id === id && document.activeElement.dataset.action === 'open-task', {}, ids[name]).catch(() => {});
  const focused = await page.evaluate(() => ({ id: document.activeElement?.dataset?.id, action: document.activeElement?.dataset?.action }));
  assert.deepEqual(focused, { id: ids[name], action: 'open-task' }, `focus is on ${name}'s card`);
}

test('Start takes one click: no Save changes, the drawer follows the task, and focus stays in the bar then returns to the card', async () => {
  await openDrawer('Start me');
  assert.equal(await page.$('#task-dialog .action-bar [data-act="start"]') !== null, true);
  await page.click(bar('start'));
  await until(async () => (await task('Start me')).status === 'in_progress', 'the task was not started');
  await page.waitForFunction(() => document.querySelector('#toast').textContent === 'Task started');
  await pillIs('In progress');
  assert.notEqual(await activeAct(), '', 'focus is still in the action bar');
  assert.equal(await page.$(bar('start')), null, 'Start no longer applies');
  await closeDrawerAndExpectFocusOn('Start me');
});

test('a disabled action says why on hover and on focus, through aria-describedby, and does nothing when pressed', async () => {
  // Fill the project's WIP limit, so no other task can be started.
  const count = (await api('GET', '/workspace')).tasks.filter((entry) => entry.projectId === projectId && ['in_progress', 'blocked'].includes(entry.status)).length;
  const current = (await api('GET', '/workspace')).projects.find((entry) => entry.id === projectId);
  await api('PATCH', `/projects/${projectId}`, { version: current.version, wipLimit: count });
  await page.reload();
  try {
    await openDrawer('Prioritise me');
    const button = bar('start');
    assert.equal(await page.$eval(button, (element) => element.getAttribute('aria-disabled')), 'true');
    const why = await page.$eval(button, (element) => document.getElementById(element.getAttribute('aria-describedby'))?.textContent);
    assert.match(why, new RegExp(`WIP limit of ${count} reached`));
    const visible = () => page.$eval(`${button} + .action-why`, (element) => getComputedStyle(element).visibility);
    await page.mouse.move(0, 0);
    assert.equal(await visible(), 'hidden');
    await page.hover(button);
    assert.equal(await visible(), 'visible', 'shown on hover');
    await page.mouse.move(0, 0);
    await page.focus(button);
    assert.equal(await visible(), 'visible', 'shown on focus');
    await page.click(button);
    assert.equal(await page.$eval('#action-note', (element) => element.textContent), why, 'pressing it repeats the reason');
    assert.equal((await task('Prioritise me')).status, 'backlog');
    await page.keyboard.press('Escape');
    await page.waitForSelector('#task-dialog:not([open])');
  } finally {
    const fresh = (await api('GET', '/workspace')).projects.find((entry) => entry.id === projectId);
    await api('PATCH', `/projects/${projectId}`, { version: fresh.version, wipLimit: 6 });
    await page.reload();
  }
});

test('Block: one click, then Enter, with an optional reason; Escape closes the field and keeps the drawer', async () => {
  await openDrawer('Block me');
  await page.click(bar('block'));
  await page.waitForSelector('#action-slot [data-action-input]');
  assert.equal(await page.evaluate(() => document.activeElement.matches('#action-slot [data-action-input]')), true, 'the field has focus');
  await page.keyboard.press('Escape');
  assert.equal(await page.$('#action-slot [data-action-input]'), null, 'Escape closes the field');
  assert.equal(await page.$('#task-dialog[open]') !== null, true, 'and not the drawer');
  assert.equal(await activeAct(), 'block', 'focus is back on Block');
  await page.click(bar('block'));
  await page.keyboard.type('Waiting on Ops');
  await page.keyboard.press('Enter');
  await until(async () => (await task('Block me')).status === 'blocked', 'the task was not blocked');
  assert.equal((await task('Block me')).blockedReason, 'Waiting on Ops');
  await page.waitForFunction(() => document.querySelector('#toast').textContent === 'Task blocked');
  await pillIs('Blocked');
  assert.equal(await page.$('#task-dialog form[data-task]') !== null, true, 'the full edit form is still below the bar');
  assert.equal(await page.$('#task-dialog [type="submit"]') !== null, true);
  await closeDrawerAndExpectFocusOn('Block me');
});

test('Block with no reason is one click and Enter', async () => {
  await openDrawer('Block quietly');
  await page.click(bar('block'));
  await page.keyboard.press('Enter');
  await until(async () => (await task('Block quietly')).status === 'blocked', 'the task was not blocked');
  assert.equal((await task('Block quietly')).blockedReason, '');
  await page.waitForFunction(() => document.querySelector('#task-dialog .drawer-summary .status-pill')?.textContent.trim() === 'Blocked');
  await page.keyboard.press('Escape');
  await page.waitForSelector('#task-dialog:not([open])');
});

test('Unblock returns a blocked task to In progress in one click', async () => {
  await openDrawer('Block me');
  await page.click(bar('unblock'));
  await until(async () => (await task('Block me')).status === 'in_progress', 'the task was not unblocked');
  assert.equal((await task('Block me')).blockedReason, '');
  await page.keyboard.press('Escape');
  await page.waitForSelector('#task-dialog:not([open])');
});

test('Done takes one click, and focus moves to what is still available', async () => {
  await openDrawer('Finish me');
  await page.click(bar('done'));
  await until(async () => (await task('Finish me')).status === 'done', 'the task was not finished');
  await pillIs('Done');
  assert.notEqual(await activeAct(), '', 'focus is in the action bar');
  assert.equal(await page.$(bar('done')), null);
  await closeDrawerAndExpectFocusOn('Finish me');
});

test('Release takes one click and puts the task back in the queue', async () => {
  await openDrawer('Release me');
  await page.click(bar('release'));
  await until(async () => (await task('Release me')).status === 'backlog', 'the task was not released');
  await pillIs('Backlog');
  await closeDrawerAndExpectFocusOn('Release me');
});

test('Priority: one click, choose, Enter', async () => {
  await openDrawer('Prioritise me');
  await page.click(bar('priority'));
  await page.waitForSelector('#action-slot select[data-action-input]');
  await page.select('#action-slot select[data-action-input]', 'urgent');
  await page.keyboard.press('Enter');
  await until(async () => (await task('Prioritise me')).priority === 'urgent', 'the priority was not set');
  await page.waitForFunction(() => document.querySelector('#toast').textContent === 'Priority set');
  await summaryHas('Urgent');
  await closeDrawerAndExpectFocusOn('Prioritise me');
});

test('Assign: one click, a name, Enter', async () => {
  await openDrawer('Assign me');
  await page.click(bar('assign'));
  await page.keyboard.type('Ada Lovelace');
  await page.keyboard.press('Enter');
  await until(async () => (await task('Assign me')).assignee === 'Ada Lovelace', 'the owner was not set');
  await summaryHas('Ada Lovelace');
  await closeDrawerAndExpectFocusOn('Assign me');
});

test('an action keeps what was typed in the full form, which then saves against the new version', async () => {
  await openDrawer('Edit then start');
  await page.focus('#task-form [name="title"]');
  await page.keyboard.press('End');
  await page.keyboard.type(' (edited)');
  await page.click(bar('start'));
  await until(async () => (await task('Edit then start')).status === 'in_progress', 'the task was not started');
  await page.waitForFunction(() => document.querySelector('#toast').textContent === 'Task started');
  assert.equal(await page.$eval('#task-form [name="title"]', (element) => element.value), 'Edit then start (edited)');
  assert.equal((await task('Edit then start')).title, 'Edit then start', 'nothing was saved by the action');
  await page.click('#task-form [type="submit"]');
  await until(async () => (await task('Edit then start')).title === 'Edit then start (edited)', 'the edit was not saved');
  assert.equal((await task('Edit then start')).status, 'in_progress', 'the form did not undo the action');
});

test('a task named in the drawer swaps in place: the drawer never closes', async () => {
  await openDrawer('Child');
  await page.evaluate(() => { window.closedCount = 0; document.querySelector('#task-dialog').addEventListener('close', () => { window.closedCount += 1; }); });
  await page.click(`#task-dialog .task-link[data-id="${ids.Parent}"]`);
  await page.waitForSelector(`#task-dialog #task-form[data-task="${ids.Parent}"]`);
  assert.equal(await page.evaluate(() => window.closedCount), 0);
  assert.equal(await page.evaluate(() => document.querySelector('#task-dialog').open), true);
  assert.equal(await page.$(bar('start')) !== null, true, 'the bar belongs to the task now shown');
  await page.keyboard.press('Escape');
  await page.waitForSelector('#task-dialog:not([open])');
});

async function drag(name, column) {
  await page.evaluate((selector, status) => {
    const source = document.querySelector(selector);
    const target = document.querySelector(`[data-drop-status="${status}"]`);
    const data = new DataTransfer();
    for (const [type, element] of [['dragstart', source], ['dragover', target], ['drop', target], ['dragend', source]]) element.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: data }));
  }, card(name), column);
}

test('dragging a card to another column goes through the same action', async () => {
  await drag('Dragged to start', 'in_progress');
  await until(async () => (await task('Dragged to start')).status === 'in_progress', 'the drop did not start the task');
  await page.waitForFunction(() => document.querySelector('#toast').textContent === 'Task started');
});

test('dragging a card to Blocked opens its drawer asking for the reason, and Enter blocks it', async () => {
  await drag('Dragged to block', 'blocked');
  await page.waitForSelector(`#task-dialog[open] #task-form[data-task="${ids['Dragged to block']}"] #action-slot [data-action-input]`);
  await page.keyboard.type('Needs a decision');
  await page.keyboard.press('Enter');
  await until(async () => (await task('Dragged to block')).status === 'blocked', 'the task was not blocked');
  assert.equal((await task('Dragged to block')).blockedReason, 'Needs a decision');
  await pillIs('Blocked');
  await closeDrawerAndExpectFocusOn('Dragged to block');
});

test('a refusal is shown in the drawer as an alert, the drawer catches up, and the retry in the same drawer succeeds', async () => {
  await openDrawer('Assign me');
  // Another session changes the task while the drawer is open, so the version is stale.
  const current = await task('Assign me');
  await api('PATCH', `/tasks/${encodeURIComponent(ids['Assign me'])}`, { version: current.version, priority: 'low' });
  await page.click(bar('assign'));
  await page.keyboard.type('Grace Hopper');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.querySelector('#action-error').textContent.length > 0);
  assert.match(await page.$eval('#action-error', (element) => element.textContent), /Task has changed; refresh and try again\. Nothing was changed\./);
  assert.equal(await page.$eval('#action-error', (element) => element.getAttribute('role')), 'alert');
  assert.equal((await task('Assign me')).assignee, 'Ada Lovelace');
  // The drawer caught up with the other change, and kept the answer for a retry.
  await summaryHas('Low');
  assert.equal(await page.$eval('#action-slot [data-action-input]', (element) => element.value), 'Grace Hopper');
  await page.keyboard.press('Enter');
  await until(async () => (await task('Assign me')).assignee === 'Grace Hopper', 'the retry did not go through');
  await summaryHas('Grace Hopper');
  assert.equal(await page.$eval('#action-error', (element) => element.textContent), '', 'a success clears the refusal');
  await page.keyboard.press('Escape');
  await page.waitForSelector('#task-dialog:not([open])');
});

test('a double click is one action, not an action and a false refusal', async () => {
  await openDrawer('Double click me');
  // Two clicks in the same instant, as a fast double click delivers them.
  await page.$eval(bar('done'), (button) => { button.click(); button.click(); });
  await until(async () => (await task('Double click me')).status === 'done', 'the task was not finished');
  await pillIs('Done');
  await new Promise((resolve) => setTimeout(resolve, 400));
  assert.equal(await page.$eval('#action-error', (element) => element.textContent), '');
  await page.keyboard.press('Escape');
  await page.waitForSelector('#task-dialog:not([open])');
});

test('a double Enter is one action, not an action and a false refusal', async () => {
  await openDrawer('Double enter me');
  await page.click(bar('assign'));
  await page.keyboard.type('Ada Lovelace');
  await Promise.all([page.keyboard.press('Enter'), page.keyboard.press('Enter')]);
  await until(async () => (await task('Double enter me')).assignee === 'Ada Lovelace', 'the owner was not set');
  await summaryHas('Ada Lovelace');
  await new Promise((resolve) => setTimeout(resolve, 400));
  assert.equal(await page.$eval('#action-error', (element) => element.textContent), '');
  await page.keyboard.press('Escape');
  await page.waitForSelector('#task-dialog:not([open])');
});

test('unsaved Priority and Owner edits in the full form survive an action, and save afterwards', async () => {
  await openDrawer('Edits survive Done');
  await page.select('#task-form select[name="priority"]', 'high');
  await page.type('#task-form [name="assignee"]', 'Grace Hopper');
  await page.click(bar('done'));
  await until(async () => (await task('Edits survive Done')).status === 'done', 'the task was not finished');
  await pillIs('Done');
  assert.equal(await page.$eval('#task-form select[name="priority"]', (element) => element.value), 'high');
  assert.equal(await page.$eval('#task-form [name="assignee"]', (element) => element.value), 'Grace Hopper');
  assert.equal((await task('Edits survive Done')).priority, 'medium', 'the action saved nothing else');
  await page.click('#task-form [type="submit"]');
  await until(async () => (await task('Edits survive Done')).priority === 'high', 'the edit was not saved');
  const saved = await task('Edits survive Done');
  assert.deepEqual([saved.assignee, saved.status], ['Grace Hopper', 'done']);
});

test('a tracked repository\'s task still opens the read-only viewer, with no action bar', async () => {
  await page.goto(`${base}/#project/${trackedProjectId}`);
  await clickCard(`[data-action="open-task"][data-id="${trackedProjectId}:T001"]`);
  await page.waitForSelector('#task-dialog[open] .task-view');
  assert.equal(await page.$('#task-dialog .action-bar'), null);
  assert.equal(await page.$('#task-dialog #task-form'), null);
  assert.match(await page.$eval('#task-dialog .readonly-note', (element) => element.textContent), /Read-only here/);
  await page.keyboard.press('Escape');
  await page.waitForSelector('#task-dialog:not([open])');
});

test('the page logged no errors or CSP violations', () => {
  assert.deepEqual(problems, []);
});
