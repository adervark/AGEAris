import { execFileSync } from 'node:child_process';
import { mkdir, readdir, rm, rmdir, symlink, writeFile, appendFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { fabricate } from '../../lib/fabricate.mjs';

// The orient corpus (docs/ORIENT.md §11): each case is a repository built
// from a short history on a base board, a working tree changed on top, the
// process view of the machine reading it, the inputs of the call, and the
// answer both doors must give. This module builds a case and writes an
// answer out as the contract's bytes (§6, §7); it computes no answer itself.

export const OPERATOR = 'ade';
export const ME = 'aaaa1111';                                         // the caller's session
export const BOOT = '0b0b0b0b-0000-4000-8000-000000000001';           // the reading machine, this boot
export const OTHER_BOOT = '0b0b0b0b-0000-4000-8000-000000000002';     // another machine
export const AS_OF = '2026-10-10T12:00:00Z';
export const BASE_AT = '2026-10-01T09:00:00Z';
export const HEAD = '<HEAD>';                                         // filled from the built repository
export const DOOR = '<DOOR>';                                         // filled by each door's runner

export const BASE_YML = [
  'spend:',
  '  - push        # once others have it, it stays out there',
  '  - gpu-hour',
  'wip:',
  '  in_progress: 2',
  '  blocked: 2',
  'stale_hours: 24',
  'live_minutes: 30',
  '',
].join('\n');
export const NOW_TEXT = '**Next action:** finish what is in progress, then claim.';
export const baseState = (board = 'AA') => `# State — fixture\n\n<!-- ${board}:now -->\n${NOW_TEXT}\n<!-- /${board}:now -->\n`;
export const BASE_NOW = { text: NOW_TEXT, file: 'AA/STATE.md' };
export const BASE_SPEND = ['push', 'gpu-hour'];

// A time on the day of AS_OF, or on another day of October 2026.
export const at = (hhmm, day = 10) => `2026-10-${String(day).padStart(2, '0')}T${hhmm}:00Z`;

const FOLDERS = { backlog: 'backlog', tasks: 'tasks', blocked: 'tasks', done: 'tasks/done', killed: 'tasks/done' };
const STATUS = { backlog: 'open', tasks: 'claimed', blocked: 'blocked', done: 'done', killed: 'killed' };

export function slug(text) {
  return text.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'task';
}

// A task file. `at` is its column: backlog, tasks (in progress), blocked,
// done or killed. `ready: false` leaves the Decision rules section out;
// `rules` replaces its text. `raw` is the whole file, verbatim.
export function task(id, title, { at = 'backlog', board = 'AA', status, owner, priority, depends = [], blockedReason, ready = true, rules, handoff, raw, file } = {}) {
  const path = `${board}/${FOLDERS[at]}/${file || `${id}-${slug(title)}.md`}`;
  if (raw !== undefined) return { op: 'task', id, path, content: raw };
  const head = ['---', `id: ${id}`, `title: ${JSON.stringify(title)}`, `status: ${status || STATUS[at]}`, `owner: ${owner || '—'}`];
  if (priority) head.push(`priority: ${priority}`);
  head.push(`depends: [${depends.join(', ')}]`);
  if (blockedReason !== undefined) head.push(`blockedReason: ${JSON.stringify(blockedReason)}`);
  head.push('created: 2026-10-01', '---');
  const body = ['', `# ${id} — ${title}`, '', '## Goal', '', 'Fixture.', ''];
  if (ready) body.push('## Decision rules — fixed in advance', '', rules ?? '- Done means: the case passes.', '');
  body.push('## Handoff — state at last stop', '', ...(handoff ?? ['- **Last touched:** 2026-10-01, registered', '- **Resume with:** the Steps above']), '');
  return { op: 'task', id, path, content: [...head, ...body].join('\n') };
}

// An owner line: `<operator> @<profile>/<session> 2026-10-10 — <note>`.
export const owner = (session, { operator = OPERATOR, profile = 'b' } = {}) => `${operator} @${profile}/${session} 2026-10-10 — fixture`;
export const file = (path, content) => ({ op: 'file', path, content });
export const gone = (path) => ({ op: 'delete', path });
// A whole trail, committed.
export const trail = (id, entries, board = 'AA') => ({ op: 'file', path: `${board}/checkpoints/${id}.jsonl`, content: entries.map(line).join('') });

// Trail entries, in the order ckpt.sh writes their fields. A subagent's run
// shares its parent's session, so an `open` names the root's.
export function entry(ts, run, kind, fields = {}) {
  return { ts, run, kind, ...fields };
}
export const open = (ts, run, fields = {}) => entry(ts, run, 'open', { operator: OPERATOR, profile: 'b', session: `${run.split('.')[0]}-0000-4000-8000-000000000000`, ...fields });
export const did = (ts, run, fields = {}) => entry(ts, run, 'did', fields);
export const doing = (ts, run, fields = {}) => entry(ts, run, 'doing', fields);
export const blocked = (ts, run, fields = {}) => entry(ts, run, 'blocked', fields);
export const end = (ts, run, fields = {}) => entry(ts, run, 'end', fields);
// A process record: ckpt.sh writes `pstart` with its whitespace collapsed.
export const proc = (pid, pstart, boot = BOOT) => ({ boot, pid, pstart });
export function line(value) {
  return `${typeof value === 'string' ? value : JSON.stringify(value)}\n`;
}

// ---- Building

function script(commits) {
  const lines = [];
  for (const commit of commits) {
    if (typeof commit === 'string') { lines.push(commit); continue; } // a fabricate directive: branch, checkout
    const { at, by = OPERATOR, subject, ops } = commit;
    const head = `${at} ${by}: `;
    const options = subject ? ` subject=${JSON.stringify(subject)}` : '';
    ops.forEach((op, index) => {
      const text = op.op === 'delete' ? `delete ${JSON.stringify(op.path)}` : `write ${JSON.stringify(op.path)} ${JSON.stringify(op.content)}`;
      lines.push(index === 0 ? `${head}${text}${options}` : `+ ${text}`);
    });
  }
  return lines.join('\n');
}

// A task op writes the task's file where its column puts it, and removes the
// file the id had before: a move, as a claim makes one.
function withMoves(commits) {
  const where = new Map();
  return commits.map((commit) => {
    if (typeof commit === 'string') return commit;
    const ops = [];
    for (const op of commit.ops) {
      if (op.op !== 'task') { ops.push(op); continue; }
      const before = where.get(op.id);
      if (before && before !== op.path) ops.push({ op: 'delete', path: before });
      where.set(op.id, op.path);
      ops.push({ op: 'file', path: op.path, content: op.content });
    }
    return { ...commit, ops };
  });
}

// git in a built repository, untouched by the machine's own git settings.
// `env` adds variables, such as the dates of a commit made in `setup`.
function git(dir, args, { input, env } = {}) {
  return execFileSync('git', ['--no-optional-locks', ...args], { cwd: dir, input, encoding: 'utf8', env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1', ...env } }).trim();
}

async function pruneEmpty(dir) {
  let entries;
  try { entries = await readdir(dir, { withFileTypes: true }); } catch { return; }
  for (const entry of entries) if (entry.isDirectory()) await pruneEmpty(join(dir, entry.name));
  if ((await readdir(dir)).length === 0) await rmdir(dir);
}

// Builds case `c` in `root`: the repository is `<root>/<c.repoName || 'fixture'>`.
// The base board is one commit: its settings file (`yml: null` leaves it
// out) and its STATE.md (`state: null` leaves it out). Then come the case's
// commits, then its changes to the working tree, then its `setup`.
// Returns the repository's path and HEAD.
export async function build(c, root) {
  const dir = join(root, c.repoName || 'fixture');
  const board = c.board || 'AA';
  const base = [];
  if (c.yml !== null) base.push(file(`${board}/${board === 'AA' ? 'AA.yml' : 'deaddrop.yml'}`, c.yml ?? BASE_YML));
  if (c.state !== null) base.push(file(`${board}/STATE.md`, c.state ?? baseState(board)));
  const commits = [{ at: BASE_AT, subject: 'board', ops: base }, ...(c.commits || [])].filter((commit) => typeof commit === 'string' || commit.ops.length);
  await fabricate(dir, script(withMoves(commits)), { operator: OPERATOR, email: 'ade@example.invalid' });
  // fabricate leaves AA/backlog, AA/tasks/done and AA/checkpoints in the
  // working tree, as aa-init makes them. Another board has no AA/.
  if (board !== 'AA') await pruneEmpty(join(dir, 'AA'));
  const tree = c.tree || {};
  for (const path of tree.remove || []) await rm(join(dir, path), { recursive: true, force: true });
  for (const [path, content] of Object.entries(tree.files || {})) {
    await mkdir(dirname(join(dir, path)), { recursive: true });
    await writeFile(join(dir, path), content);
  }
  for (const [id, entries] of Object.entries(tree.trails || {})) {
    const path = join(dir, board, 'checkpoints', `${id}.jsonl`);
    await mkdir(dirname(path), { recursive: true });
    await appendFile(path, entries.map(line).join(''));
  }
  for (const [path, target] of Object.entries(tree.links || {})) {
    await mkdir(dirname(join(dir, path)), { recursive: true });
    await symlink(target, join(dir, path));
  }
  if (c.setup) await c.setup({ dir, root, git: (args, options) => git(dir, args, options) });
  const head = (() => { try { return git(dir, ['rev-parse', 'HEAD']); } catch { return null; } })();
  return { dir, head };
}

// ---- The answer

const ORDER = {
  top: ['schema', 'asOf', 'repo', 'remote', 'next', 'rules', 'you', 'inFlight', 'take', 'warnings', 'data', 'more', 'cut'],
  repo: ['head', 'board', 'door'],
  remote: ['moved', 'checkedAt'],
  next: ['do', 'task', 'run', 'by', 'since', 'until', 'verify', 'reasons', 'rule'],
  rules: ['wip', 'staleHours', 'liveMinutes', 'notReady'],
  wip: ['used', 'limit', 'blocked', 'blockedLimit'],
  you: ['task', 'column', 'heldBy'],
  inFlight: ['task', 'run', 'kind', 'since', 'state', 'by', 'until'],
  take: ['task', 'priority', 'unblocks'],
  warnings: ['code', 'task', 'on', 'line', 'n'],
  dataTask: ['title', 'file', 'author', 'next', 'act', 'tell', 'left', 'blocked', 'handoff'],
  dataRepo: ['name'],
  now: ['text', 'file'],
  more: ['trail', 'task', 'board'],
  cut: ['inFlight', 'warnings', 'notReady', 'you', 'take', 'spend', 'data'],
};
const REQUIRED = { top: ['schema', 'asOf', 'repo', 'next', 'rules', 'you', 'inFlight', 'take', 'warnings', 'data', 'more'], next: ['do', 'reasons', 'rule'] };

function ordered(value, kind, where) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${where}: expected an object`);
  for (const key of Object.keys(value)) if (!ORDER[kind].includes(key)) throw new Error(`${where}: unknown key ${key}`);
  for (const key of REQUIRED[kind] || []) if (!(key in value)) throw new Error(`${where}: missing ${key}`);
  const result = {};
  for (const key of ORDER[kind]) if (key in value && value[key] !== undefined) result[key] = value[key];
  return result;
}

// The answer in the contract's order (§6). Throws on a key the contract does
// not have, so a slip in a case cannot pass as a different answer.
export function canonical(answer) {
  const top = ordered(answer, 'top', 'answer');
  top.repo = ordered(top.repo, 'repo', 'repo');
  if (top.remote) top.remote = ordered(top.remote, 'remote', 'remote');
  top.next = ordered(top.next, 'next', 'next');
  top.rules = ordered(top.rules, 'rules', 'rules');
  top.rules.wip = ordered(top.rules.wip, 'wip', 'rules.wip');
  top.you = top.you.map((item, index) => ordered(item, 'you', `you[${index}]`));
  top.inFlight = top.inFlight.map((item, index) => ordered(item, 'inFlight', `inFlight[${index}]`));
  top.take = top.take.map((item, index) => ordered(item, 'take', `take[${index}]`));
  top.warnings = top.warnings.map((item, index) => ordered(item, 'warnings', `warnings[${index}]`));
  const data = {};
  if (top.data.repo) data.repo = ordered(top.data.repo, 'dataRepo', 'data.repo');
  if (top.data.spend) data.spend = top.data.spend;
  for (const [key, value] of Object.entries(top.data)) {
    if (key === 'repo' || key === 'spend' || key === 'now') continue;
    if (!/^T\d{3,}$/.test(key)) throw new Error(`data: unknown key ${key}`);
    data[key] = ordered(value, 'dataTask', `data.${key}`);
  }
  if (top.data.now) data.now = ordered(top.data.now, 'now', 'data.now');
  top.data = data;
  top.more = ordered(top.more, 'more', 'more');
  if (top.cut) top.cut = ordered(top.cut, 'cut', 'cut');
  return top;
}

// The bytes a door must print for this answer, before its newline (§7).
export function bytes(answer, head) {
  const value = canonical(answer);
  value.repo = { ...value.repo, head: value.repo.head === HEAD ? head : value.repo.head };
  return JSON.stringify(value);
}

// §8: while the answer is over budget, remove the last key of `data`, then
// the last entry of `take`, then of `you`, and count each in `cut`. It is
// measured with HEAD's 40 hex digits, `door` as "board.sh" and `moved` as
// "unknown".
export function measure(answer) {
  const wide = { ...answer, repo: { ...answer.repo, head: answer.repo.head === HEAD ? 'f'.repeat(40) : answer.repo.head, door: 'board.sh' } };
  if (answer.remote) wide.remote = { ...answer.remote, moved: 'unknown' };
  return Buffer.byteLength(bytes(wide));
}

export function budgeted(full, budget) {
  const value = structuredClone(full);
  const cut = { ...(value.cut || {}) };
  const settle = () => {
    const kept = Object.fromEntries(Object.entries(cut).filter(([, n]) => n > 0));
    if (Object.keys(kept).length) value.cut = kept; else delete value.cut;
    return value;
  };
  while (measure(settle()) > budget) {
    const keys = Object.keys(value.data);
    if (keys.length) { delete value.data[keys.at(-1)]; cut.data = (cut.data || 0) + 1; continue; }
    if (value.take.length) { value.take.pop(); cut.take = (cut.take || 0) + 1; continue; }
    if (value.you.length) { value.you.pop(); cut.you = (cut.you || 0) + 1; continue; }
    break; // nothing left to cut: the answer is given whole
  }
  return settle();
}

// ---- §7, the cleaning of repository text. Decoding comes before it, and no
// lone surrogate reaches it (§7), so it has no rule for one.

const SPACE = /[\u0009-\u000d\u0085\u2028\u2029]/g;
const REMOVED = /[\u0000-\u0008\u000e-\u001f\u007f-\u0084\u0086-\u009f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/g;

export function clean(text, cap) {
  let value = String(text);
  value = value.replace(SPACE, ' ').replace(REMOVED, '').replace(/ {2,}/g, ' ').replace(/^ | $/g, '');
  if (cap === undefined || Buffer.byteLength(value) <= cap) return value;
  let out = '';
  let size = 0;
  for (const point of value) {
    const width = Buffer.byteLength(point);
    if (size + width > cap - 3) break;
    out += point;
    size += width;
  }
  return `${out.replace(/ +$/, '')}…`;
}

// ---- Shorthand for the answers

export function rules({ used = 0, limit = 2, blocked = 0, blockedLimit = 2, staleHours = 24, liveMinutes = 30, notReady = [] } = {}) {
  return { wip: { used, limit, blocked, blockedLimit }, staleHours, liveMinutes, notReady };
}

// `data` with the base board's repository name, spend words and NOW block
// around the given task entries. `spend: []` and `now: null` leave them out.
export function data(tasks = {}, { name = 'fixture', spend = BASE_SPEND, now = BASE_NOW } = {}) {
  return { repo: { name }, ...(spend?.length ? { spend } : {}), ...tasks, ...(now ? { now } : {}) };
}

// A task's entry in `data`: its title, file and author, then what applies.
// The title is given as the answer has it, already cleaned.
export function card(id, title, { folder = 'tasks', board = 'AA', author = OPERATOR, file: name, ...rest } = {}) {
  return { title, file: `${board}/${folder}/${name || `${id}-${slug(title)}.md`}`, author, ...rest };
}

export const HANDOFF = '**Last touched:** 2026-10-01, registered **Resume with:** the Steps above';

// `folder: null` is a task with no single file at HEAD.
export function more(id, folder = 'tasks', board = 'AA') {
  if (!id) return { board: `${board}/board.sh` };
  return { trail: `${board}/ckpt.sh live ${id}`, ...(folder ? { task: `${board}/${folder}/${id}-*.md` } : {}), board: `${board}/board.sh` };
}

// A whole answer: the case's call fills `asOf`, and anything not given is the
// empty default.
export function answer(parts, { board = 'AA/' } = {}) {
  return {
    schema: 'aa.orient/1',
    asOf: parts.asOf || AS_OF,
    repo: { head: HEAD, board, door: DOOR },
    ...(parts.remote ? { remote: parts.remote } : {}),
    next: parts.next,
    rules: parts.rules || rules(),
    you: parts.you || [],
    inFlight: parts.inFlight || [],
    take: parts.take || [],
    warnings: parts.warnings || [],
    data: parts.data || data(),
    more: parts.more || more(),
    ...(parts.cut ? { cut: parts.cut } : {}),
  };
}

// One case, with the call's defaults. The view is the reading machine's: its
// boot id, the processes `ps` shows (`lstart` as ps prints it), and, for the
// server alone, the tasks that wait on a gate and since when.
export function kase(c) {
  return { ...c, call: { operator: OPERATOR, asOf: AS_OF, budget: 8192, ...c.call }, view: { boot: BOOT, alive: [], ...c.view } };
}
