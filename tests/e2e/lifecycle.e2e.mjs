// End to end: deprecating, archiving and restoring a project (T068) in
// headless Chrome. Run with `npm run e2e`; it is outside `npm test` because it
// needs a browser. Puppeteer is not a dependency: it is loaded from
// AGEARIS_PUPPETEER (a node_modules folder that holds it) and Chrome from
// AGEARIS_CHROME.
//
// The server is the real one, on a free port with a fresh temporary data
// folder. Nothing outside that folder and the temporary tracked repository is
// read or written.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import test, { after, before } from 'node:test';

import { createServer } from '../../server.mjs';

process.env.GIT_CONFIG_GLOBAL = os.devNull;
process.env.GIT_CONFIG_NOSYSTEM = '1';

const PUPPETEER_DIR = process.env.AGEARIS_PUPPETEER || path.join(os.homedir(), '.npm/_npx/668c188756b835f3/node_modules/');
const CHROME = process.env.AGEARIS_CHROME || path.join(os.homedir(), '.cache/puppeteer/chrome/linux-152.0.7977.75/chrome-linux64/chrome');
const HOSTILE = '<img src=x data-injected="1"> & "quotes"';

let root;
let server;
let base;
let browser;
let page;
let repository;
const projects = {};
const problems = [];
const exec = promisify(execFile);
const git = async (dir, ...args) => (await exec('git', args, { cwd: dir, env: process.env })).stdout.trim();

async function api(method, url, body) {
  const response = await fetch(`${base}/api${url}`, { method, headers: { 'x-agearis-token': server.apiToken, ...(body ? { 'content-type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const value = await response.json();
  return { ok: response.ok, value };
}

const current = async (id) => (await api('GET', '/workspace')).value.projects.find((project) => project.id === id);

// A lifecycle change through the API, confirmed as the page confirms it.
async function lifecycle(id, change) {
  const version = (await current(id)).version;
  const asked = await api('PATCH', `/projects/${id}`, { version, lifecycle: change });
  assert.equal(asked.value.code, 'CONFIRM', asked.value.error);
  const done = await api('PATCH', `/projects/${id}`, { version, lifecycle: change, confirm: asked.value.confirmToken });
  assert.ok(done.ok, done.value.error);
}

async function visit(route) {
  await page.goto('about:blank');
  await page.goto(`${base}/#${route}`);
  await page.waitForSelector('#main .page-heading, #main .project-header', { timeout: 15_000 });
}

before(async () => {
  root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'agearis-e2e-lifecycle-')));
  server = await createServer({ dataDir: path.join(root, 'data'), registryOptions: { seed: () => [] }, cockpitOptions: { buildWaitMs: 60_000 } });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  base = `http://127.0.0.1:${server.address().port}`;

  for (const name of ['Old', 'Gone', 'Next']) {
    projects[name] = (await api('POST', '/projects', { name, wipLimit: 4 })).value.id;
    assert.ok(projects[name]);
    await api('POST', '/tasks', { projectId: projects[name], title: `${name} work`, status: 'in_progress' });
  }
  repository = path.join(root, 'tracked');
  await mkdir(path.join(repository, 'AA', 'backlog'), { recursive: true });
  await mkdir(path.join(repository, 'AA', 'tasks'));
  await writeFile(path.join(repository, 'AA', 'tasks', '.gitkeep'), '');
  await writeFile(path.join(repository, 'AA', 'backlog', 'T001-one.md'), '---\nid: T001\ntitle: "Tracked work"\nstatus: open\nowner: —\n---\n\n# T001 — Tracked work\n');
  await writeFile(path.join(repository, 'AA', 'STATE.md'), '# State\n');
  await git(repository, 'init', '--quiet', '--initial-branch=main');
  await git(repository, 'config', 'user.name', 'ade');
  await git(repository, 'config', 'user.email', 'ade@example.invalid');
  await git(repository, 'add', '-A');
  await git(repository, 'commit', '--quiet', '-m', 'fixture');
  const linked = await api('POST', '/projects/link', { path: repository, name: 'Tracked' });
  assert.ok(linked.ok, linked.value.error);
  projects.Tracked = linked.value.id;

  await lifecycle(projects.Old, { state: 'deprecated', reason: HOSTILE, successor: projects.Next });
  await lifecycle(projects.Gone, { state: 'archived' });

  const puppeteer = createRequire(path.join(PUPPETEER_DIR, '/'))('puppeteer');
  browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });
  page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  // A CONFIRM answer is a 409 on purpose, and the browser logs every failed request.
  page.on('console', (message) => { if (['error', 'warning'].includes(message.type()) && !/status of 409/.test(message.text())) problems.push(`console ${message.type()}: ${message.text()}`); });
  page.on('pageerror', (error) => problems.push(`page error: ${error.message}`));
  await page.goto(`${base}/?token=${server.apiToken}#home`);
});

after(async () => {
  await browser?.close();
  if (server?.listening) { server.close(); await once(server, 'close'); }
  if (root) await rm(root, { recursive: true, force: true, maxRetries: 5 });
});

test('the sidebar leaves an archived project out and marks a deprecated one; Working and All tasks leave out the archived project\'s work', async () => {
  await visit('working');
  const sidebar = await page.$$eval('#project-navigation .project-nav', (links) => links.map((link) => [link.textContent.trim(), link.classList.contains('is-deprecated')]));
  assert.deepEqual(sidebar.sort(), [['Next', false], ['Old', true], ['Tracked', false]]);
  const working = await page.$eval('#main', (main) => main.textContent);
  assert.match(working, /Old work/);
  assert.doesNotMatch(working, /Gone work/);
  await visit('work');
  assert.doesNotMatch(await page.$eval('#main', (main) => main.textContent), /Gone work/);
});

test('a deprecated project\'s page is read-only, names its successor, and shows its reason as text', async () => {
  await visit(`project/${projects.Old}`);
  assert.equal(await page.$eval('#create-button', (button) => button.textContent.trim()), 'Add project', 'no New task on a deprecated project');
  assert.equal(await page.$('#main [data-action="edit-project"]'), null);
  assert.equal(await page.$('[data-injected]'), null, 'the reason is not markup');
  const note = await page.$eval('#main .lifecycle-note', (element) => element.textContent);
  assert.ok(note.includes(HOSTILE), note);
  assert.match(note, /Work goes on in Next\./);
});

test('archiving through the page asks for a confirmation, moves the project to Archived, and Restore brings it back with the repository untouched', async () => {
  await visit(`project/${projects.Tracked}`);
  await page.click('[data-action="archive-project"]');
  await page.waitForSelector('#lifecycle-form', { visible: true });
  await page.type('#lifecycle-form input[name="reason"]', 'Retired');
  await page.click('#lifecycle-form [type="submit"]');
  await page.waitForSelector('#confirm-form', { visible: true });
  assert.match(await page.$eval('#confirm-form', (form) => form.textContent), /Nothing in .+ changes/);
  await page.click('#confirm-form [type="submit"]');
  await page.waitForFunction(() => /is archived/.test(document.querySelector('#toast')?.textContent || ''));
  assert.equal((await current(projects.Tracked)).lifecycle.state, 'archived');

  await visit('projects');
  const archived = await page.$$eval('.archived-list li', (rows) => rows.map((row) => row.querySelector('.board-name').textContent));
  assert.deepEqual(archived.sort(), ['Gone', 'Tracked']);
  await page.evaluate(() => { document.querySelector('.archived-projects').open = true; });
  await page.click(`.archived-list [data-action="restore-project"][data-id="${projects.Tracked}"]`);
  await page.waitForFunction(() => /active again/.test(document.querySelector('#toast')?.textContent || ''));
  assert.equal('lifecycle' in await current(projects.Tracked), false);
  assert.equal(await git(repository, 'status', '--porcelain'), '', 'the repository is untouched');
  assert.equal(await git(repository, 'rev-list', '--count', 'HEAD'), '1');
  assert.deepEqual(problems, []);
});
