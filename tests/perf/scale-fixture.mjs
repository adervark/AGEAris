import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { fabricate } from '../../lib/fabricate.mjs';
import { git } from '../../lib/workspace.mjs';

// The scale fixture of docs/plans/agent-brain.md §5.5: 300 tracked AA
// repositories of about 200 commits each, plus 3 of about 5,000, written
// through lib/fabricate.mjs. Each repository is one developer's board work and
// code: tasks registered, claimed, checkpointed, worked on, delivered (their
// trails retired), a few killed, one in progress and one blocked at the end.
//
// It is built once, into a cache outside the repository and outside any data
// folder (AGEARIS_PERF_CACHE, else ~/.cache/agearis/perf), and reused while
// this file and the shape are unchanged. Nothing reads it but the perf suite,
// and nothing writes it once it is built.

export const SHAPE = Object.freeze({ small: 300, smallCommits: 200, large: 3, largeCommits: 5000 });
export const BUILD_BUDGET_MS = 5 * 60 * 1000;

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const EPOCH = '2026-01-01T00:00:00+00:00';
const EPOCH_MS = Date.parse(EPOCH);
const DAY_MINUTES = 24 * 60;

// mulberry32, so repository n is always the same history.
function random(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

const NOUNS = ['importer', 'export', 'parser', 'ledger', 'cache', 'drawer', 'forecast', 'scheduler', 'index', 'report', 'sync', 'router', 'session', 'budget', 'trail', 'review', 'search', 'settings', 'archive', 'signup'];
const VERBS = ['Fix', 'Add', 'Speed up', 'Document', 'Measure', 'Split', 'Retire', 'Rename', 'Test', 'Harden'];
const QUALIFIERS = ['on a long line', 'for a new board', 'when the clock moves', 'across branches', 'under load', 'for a second operator', 'at the WIP limit', 'after a restart', 'in the drawer', 'on Windows'];
const PROSE = ['the', 'board', 'reads', 'each', 'task', 'file', 'once', 'and', 'an', 'agent', 'claims', 'work', 'before', 'it', 'spends', 'so', 'a', 'dead', 'run', 'still', 'says', 'what', 'was', 'in', 'flight', 'measured', 'not', 'guessed', 'history', 'stays', 'in', 'git'];
const AA_YML = 'spend:\n  - deploy\n  - migration\nwip:\n  in_progress: 2\n  blocked: 2\nstale_hours: 24\nlive_minutes: 30\nlog: PROGRESS.md\nmap: README.md\nid_prefix: T\n';
const RULES = '# The rules\n\nClaim before working, and the claim is a commit. One owner per task.\nCheckpoint before you spend. Work in progress is limited by AA.yml.\n';

const quote = (text) => JSON.stringify(text);

// One repository's history as fabricator lines; `index` seeds it and
// `commits` is about how many commits it makes.
export function repoScript(index, commits) {
  const rand = random(index * 7919 + 17);
  const int = (low, high) => low + Math.floor(rand() * (high - low + 1));
  const pick = (list) => list[Math.floor(rand() * list.length)];
  const large = commits > 1000;
  // Small repositories start in late July and run about a month; the large
  // ones run from January, a few minutes between commits.
  let minute = (large ? int(0, 5) : 200 + (index % 30)) * DAY_MINUTES + 8 * 60;
  const gap = large ? () => int(3, 60) : () => int(10, 180);
  const lines = [];
  let count = 0;
  let stamp = '';
  const tick = () => {
    minute += gap();
    if (minute % DAY_MINUTES > 19 * 60) minute += DAY_MINUTES - (minute % DAY_MINUTES) + 8 * 60 + int(0, 60);
    const day = Math.floor(minute / DAY_MINUTES);
    const clock = minute % DAY_MINUTES;
    stamp = new Date(EPOCH_MS + minute * 60000).toISOString().replace(/\.\d{3}Z$/, 'Z');
    return `day ${day} ${String(Math.floor(clock / 60)).padStart(2, '0')}:${String(clock % 60).padStart(2, '0')}`;
  };
  const commit = (operation, ...more) => {
    lines.push(`${tick()} dev: ${operation}`, ...more.map((line) => `+ ${line}`));
    count += 1;
  };
  const date = () => stamp.slice(0, 10);
  const words = (n) => Array.from({ length: n }, () => pick(PROSE)).join(' ');
  const session = () => Math.floor(rand() * 0xffffffff).toString(16).padStart(8, '0');
  const state = (delivered) => `<!-- AA:now -->\n**Standing:** ${words(18)}.\n\n**Next action:** ${words(12)}.\n<!-- /AA:now -->\n\n<!-- AA:generated -->\nboard · ${stamp} · ${delivered} delivered\n<!-- /AA:generated -->\n`;

  const backlog = [];
  const titles = new Map();
  let next = 1;
  let delivered = 0;
  const keep = large ? 25 : 3;
  // About a sixth of a small board is still in its backlog at the end, as on
  // the real boards (62 of 374 tasks on 2026-11-01).
  const leftover = large ? 0 : int(2, 5);

  commit(`write AA/AA.yml ${quote(AA_YML)} subject="adopt the AA board"`, `write AA/RULES.md ${quote(RULES)}`, `write AA/STATE.md ${quote(state(0))}`, `write README.md ${quote(`# Repository ${index}\n\n${words(40)}.\n`)}`);

  const register = () => {
    const id = `T${String(next).padStart(3, '0')}`;
    next += 1;
    const title = `${pick(VERBS)} the ${pick(NOUNS)} ${pick(QUALIFIERS)}`;
    titles.set(id, title);
    const fields = { type: rand() < 0.3 ? 'bug' : 'feature', goal: `${words(int(25, 40))}.`, body: `${words(int(60, 120))}.`, next: words(8) };
    commit(`create ${id} backlog ${quote(title)} ${JSON.stringify(fields)} subject=${quote(`register ${id}: ${title}`)}`);
    backlog.push(id);
  };
  const claim = (id) => {
    const run = session();
    commit(`move ${id} tasks ${JSON.stringify({ owner: `dev @k/${run} ${date()} — ${titles.get(id)}` })} subject=${quote(`claim ${id}: ${titles.get(id)}`)}`);
    const open = { ts: stamp, run, kind: 'open', operator: 'dev', profile: 'k', session: `${run}-0000-4000-8000-000000000000`, agent: 'session', model: 'opus', brief: titles.get(id), budget: 'none', may_touch: 'src/' };
    commit(`ckpt ${id} raw ${quote(JSON.stringify(open))} subject=${quote(`ckpt: ${id} opened`)}`);
    return run;
  };
  const work = (id, run) => {
    for (let step = int(1, 3); step > 0; step -= 1) {
      const module = pick(NOUNS);
      const code = Array.from({ length: int(4, 12) }, (_, n) => `export const ${module}${n} = ${int(0, 9999)};`).join('\n');
      commit(`write src/${module}.js ${quote(`${code}\n`)} subject=${quote(`${id}: ${words(5)}`)}`);
      if (rand() < 0.6) commit(`ckpt ${id} did ${quote(words(7))} session=${run} subject=${quote(`ckpt: ${id} ${words(3)}`)}`);
    }
  };

  // Each pass registers when the backlog runs short, else takes its oldest task
  // through to delivery. A few commits are left for the end state.
  while (count < commits - 8 - leftover) {
    if (backlog.length < keep) { register(); continue; }
    const id = backlog.shift();
    const run = claim(id);
    work(id, run);
    if (rand() < 0.05) {
      commit(`kill ${id} {} subject=${quote(`${id} killed: ${words(5)}`)}`, `delete AA/checkpoints/${id}.jsonl`);
      continue;
    }
    delivered += 1;
    commit(`move ${id} done {} subject=${quote(`${id} done: ${titles.get(id)}`)}`, `delete AA/checkpoints/${id}.jsonl`, `write AA/STATE.md ${quote(state(delivered))}`);
  }
  // The end state: one task in progress, its run ended; one blocked.
  while (backlog.length < 3) register();
  const doing = backlog.shift();
  const run = claim(doing);
  work(doing, run);
  commit(`ckpt ${doing} raw ${quote(JSON.stringify({ ts: stamp, run, kind: 'end', changed: words(4), cost: 'none', left: 'nothing', next: words(6) }))} subject=${quote(`ckpt: ${doing} ended`)}`);
  const stuck = backlog.shift();
  claim(stuck);
  commit(`move ${stuck} blocked {"blockedReason": "waiting on the review"} subject=${quote(`${stuck} blocked: waiting on the review`)}`);
  for (let n = 0; n < leftover; n += 1) register();
  return lines.join('\n');
}

// The cache folder: outside this repository and outside the data folder.
export function cacheRoot() {
  const root = path.resolve(process.env.AGEARIS_PERF_CACHE || path.join(process.env.XDG_CACHE_HOME || path.join(os.homedir(), '.cache'), 'agearis', 'perf'));
  const inside = (outer) => root === outer || root.startsWith(`${outer}${path.sep}`);
  if (inside(REPO_ROOT)) throw new Error(`The perf cache ${root} is inside the repository; set AGEARIS_PERF_CACHE outside it`);
  for (const data of [path.join(os.homedir(), '.agearis-data'), path.join(os.homedir(), '.agesight-data')]) {
    if (inside(data)) throw new Error(`The perf cache ${root} is inside the data folder ${data}`);
  }
  return root;
}

async function fixtureKey() {
  const hash = createHash('sha256');
  hash.update(await readFile(fileURLToPath(import.meta.url)));
  hash.update(await readFile(path.join(REPO_ROOT, 'lib', 'fabricate.mjs')));
  hash.update(JSON.stringify(SHAPE));
  return hash.digest('hex').slice(0, 16);
}

async function pool(items, size, work) {
  let next = 0;
  const lane = async () => { while (next < items.length) { const item = items[next++]; await work(item); } };
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, lane));
}

// The fixture: { dir, repos: [{ name, path, commits, large }], built, buildMs }.
// A built fixture is reused; otherwise it is built aside and renamed into place,
// and older builds are removed.
export async function scaleFixture({ log = () => {} } = {}) {
  const root = cacheRoot();
  const key = await fixtureKey();
  const dir = path.join(root, `scale-${key}`);
  const manifest = await readFile(path.join(dir, 'fixture.json'), 'utf8').then(JSON.parse, () => null);
  if (manifest?.key === key) return { dir, repos: manifest.repos.map((repo) => ({ ...repo, path: path.join(dir, repo.name) })), built: false, buildMs: manifest.buildMs };

  // A folder without its manifest is a build that did not finish: it goes.
  await rm(dir, { recursive: true, force: true });
  await mkdir(root, { recursive: true });
  const staging = path.join(root, `.building-${key}-${process.pid}`);
  await rm(staging, { recursive: true, force: true });
  await mkdir(staging);
  const specs = [
    ...Array.from({ length: SHAPE.small }, (_, n) => ({ name: `small-${String(n + 1).padStart(3, '0')}`, index: n + 1, target: SHAPE.smallCommits, large: false })),
    ...Array.from({ length: SHAPE.large }, (_, n) => ({ name: `large-${n + 1}`, index: 1000 + n, target: SHAPE.largeCommits, large: true })),
  ];
  log(`building the scale fixture in ${dir}: ${specs.length} repositories`);
  const started = performance.now();
  const repos = [];
  try {
    await pool(specs, Math.max(2, os.availableParallelism()), async (spec) => {
      const repo = path.join(staging, spec.name);
      await fabricate(repo, repoScript(spec.index, spec.target), { operator: 'dev', email: 'dev@example.invalid', epoch: EPOCH });
      await rm(path.join(repo, '.git', 'fabricate.marks'), { force: true });
      const commits = Number(git(repo, ['rev-list', '--count', 'HEAD']).stdout.trim());
      repos.push({ name: spec.name, commits, large: spec.large });
    });
  } catch (error) {
    await rm(staging, { recursive: true, force: true });
    throw error;
  }
  const buildMs = performance.now() - started;
  repos.sort((a, b) => a.name.localeCompare(b.name));
  await writeFile(path.join(staging, 'fixture.json'), `${JSON.stringify({ key, shape: SHAPE, builtAt: new Date().toISOString(), buildMs, repos }, null, 2)}\n`);
  try { await rename(staging, dir); } catch (error) {
    // Another run built it first.
    await rm(staging, { recursive: true, force: true });
    if (!['ENOTEMPTY', 'EEXIST'].includes(error?.code)) throw error;
  }
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (entry.isDirectory() && /^scale-[0-9a-f]{16}$/.test(entry.name) && entry.name !== `scale-${key}`) await rm(path.join(root, entry.name), { recursive: true, force: true });
  }
  return { dir, repos: repos.map((repo) => ({ ...repo, path: path.join(dir, repo.name) })), built: true, buildMs };
}

// The bytes of /api/workspace by what they carry: delivered tasks (done and
// dropped), work in progress (in progress and blocked), the backlog, the
// activity rows, and the rest. `descriptions` is the share of the task bytes
// that is description text.
export function payloadSplit(workspace) {
  const bytes = (value) => Buffer.byteLength(JSON.stringify(value));
  const total = bytes(workspace);
  const groups = { delivered: { tasks: 0, bytes: 0, descriptions: 0 }, wip: { tasks: 0, bytes: 0, descriptions: 0 }, backlog: { tasks: 0, bytes: 0, descriptions: 0 } };
  for (const task of workspace.tasks) {
    const group = groups[['done', 'dropped'].includes(task.status) ? 'delivered' : task.status === 'backlog' ? 'backlog' : 'wip'];
    group.tasks += 1;
    group.bytes += bytes(task) + 1;
    group.descriptions += bytes(task.description);
  }
  const activity = { rows: workspace.activity.length, bytes: bytes(workspace.activity) };
  const history = groups.delivered.bytes + activity.bytes;
  return { total, ...groups, activity, other: total - groups.delivered.bytes - groups.wip.bytes - groups.backlog.bytes - activity.bytes, historyShare: history / total, wipShare: groups.wip.bytes / total };
}
