import { execFile } from 'node:child_process';
import { constants } from 'node:fs';
import { lstat, open, readdir, readFile } from 'node:fs/promises';
import { basename, join } from 'node:path';

import { configName, fail, findBoard, gitEnv, GIT_HARDENING } from './workspace.mjs';

// The orient answer, `aa.orient/1`, as docs/ORIENT.md defines it: what an
// agent should do next in one repository, with the rule behind it, what binds
// it, what it holds, what is in flight, what it may take and what is wrong,
// ranked and cut to a byte budget. ORIENT.md is normative; the section named
// beside each part is the one it implements. Orient reads and never writes:
// git runs with --no-optional-locks, and nothing below a top-level symbolic
// link is followed. The server's door is `Cockpit.orient`; `AA/board.sh
// --orient` is the other, and both answer the corpus in tests/orient/ alike.

export const SCHEMA = 'aa.orient/1';
const MiB = 1024 * 1024;
const TASK_MAX = MiB;
const TRAIL_MAX = MiB;
const STATE_MAX = MiB;
const SETTINGS_MAX = 64 * 1024;
const BUDGET = { min: 4096, max: 65536, default: 8192 };
const DEFAULTS = { staleHours: 24, liveMinutes: 30 };
const KINDS = new Set(['open', 'did', 'doing', 'blocked', 'end']);
const PRIORITIES = ['urgent', 'high', 'medium', 'low'];
const FOLDERS = ['backlog', 'tasks', 'tasks/done'];
const WARNING_ORDER = ['older-board', 'no-wip-limit', 'live-minutes-clamped', 'state-stale', 'claim-expired', 'claim-unpushed', 'depends-killed', 'duplicate-id', 'uncommitted-task-change', 'trail-malformed', 'trail-unreadable', 'trail-truncated'];
const CUT_ORDER = ['inFlight', 'warnings', 'notReady', 'you', 'take', 'spend', 'data'];
const CAPS = { repo: 80, spend: 40, now: 1024, title: 160, file: 200, author: 80, next: 240, act: 240, tell: 240, left: 240, blocked: 240, handoff: 480 };
const LIMITS = { you: 10, inFlight: 10, take: 10, warnings: 10, notReady: 20, spend: 10, depends: 20 };
const GIT_TIMEOUT_MS = 30000;
const REMOTE_TIMEOUT_MS = 10000;
const PS_TIMEOUT_MS = 5000;
// No pid is larger on Linux (PID_MAX_LIMIT) or macOS; a larger one in a
// trail names no process, and must not reach ps, which would refuse the list.
const PID_MAX = 4194304;
// ls-remote may reach the upstream over these, and over nothing that runs a
// program: not ext::, and not git://, whose core.gitProxy is a program a
// repository's config can name, with values the command line cannot clear.
// What else that config names to run, an upload-pack, an ssh command, a
// credential helper or an askpass, is replaced.
const REMOTE_PROTOCOLS = ['-c', 'protocol.file.allow=always', '-c', 'protocol.https.allow=always', '-c', 'protocol.http.allow=always', '-c', 'protocol.ssh.allow=always',
  '-c', 'core.sshCommand=ssh', '-c', 'credential.helper=', '-c', 'core.askPass='];

// The inputs' shapes (§1). Each is short and bounded, never task text.
const ID = /^T\d{3,6}$/;
const TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
const WHOLE = /^\d{1,12}$/;

const decoder = new TextDecoder('utf-8', { ignoreBOM: true });
const decode = (buffer) => decoder.decode(buffer);
const iso = (ms) => new Date(ms).toISOString().replace('.000Z', 'Z');

const refuse = fail;

// ---- §1, the call

// Checks a call's inputs and fills its defaults, except the operator's, which
// comes from the repository. A malformed one is refused with a 400.
export function readCall(raw = {}, { now = Date.now() } = {}) {
  const call = {};
  if (raw.operator !== undefined) {
    if (typeof raw.operator !== 'string' || raw.operator === '' || raw.operator.length > 200) refuse(400, 'operator must be a non-empty name');
    call.operator = raw.operator;
  }
  if (raw.run !== undefined) {
    if (!isRunId(raw.run)) refuse(400, 'run must be a run id, such as e857a8c8 or e857a8c8.a4f2');
    call.run = raw.run;
  }
  if (raw.task !== undefined) {
    if (typeof raw.task !== 'string' || !ID.test(raw.task)) refuse(400, 'task must be T and three to six digits');
    call.task = raw.task;
  }
  if (raw.asOf !== undefined) {
    if (typeof raw.asOf !== 'string' || !readsBack(raw.asOf)) refuse(400, 'asOf must be YYYY-MM-DDTHH:MM:SSZ');
    if (Date.parse(raw.asOf) > now) refuse(400, 'asOf cannot be in the future');
    call.asOf = raw.asOf;
  } else call.asOf = iso(Math.floor(now / 1000) * 1000);
  if (raw.budget !== undefined) {
    const text = String(raw.budget);
    const budget = Number(text);
    if (!WHOLE.test(text) || budget < BUDGET.min || budget > BUDGET.max) refuse(400, `budget must be a whole number from ${BUDGET.min} to ${BUDGET.max}`);
    call.budget = budget;
  } else call.budget = BUDGET.default;
  if (raw.remote !== undefined) {
    if (![true, false, '1', '0'].includes(raw.remote)) refuse(400, 'remote must be 1 or 0');
    call.remote = raw.remote === true || raw.remote === '1';
  } else call.remote = false;
  return call;
}

// A run id (§3.2): one to three parts joined by `.`, each 1 to 12 of
// 0-9 A-Z a-z _ -. Read by a scan, since a trail's run is repository text.
export function isRunId(text) {
  if (typeof text !== 'string' || text.length > 38) return false;
  const parts = text.split('.');
  return parts.length <= 3 && parts.every((part) => part.length >= 1 && part.length <= 12 && [...part].every((c) => isLetter(c) || isDigit(c) || c === '_' || c === '-'));
}

// A time `YYYY-MM-DDTHH:MM:SSZ` that reads back the same (§3.2).
function readsBack(text) {
  if (typeof text !== 'string' || !TIME.test(text)) return false;
  const ms = Date.parse(text);
  return !Number.isNaN(ms) && iso(ms) === text;
}

// ---- The process view (§1, §3.3)

// This machine's boot id, and what `ps` says each process started at, asked
// afresh on every call: a process can end, and its pid be reused, between two
// calls. One `ps` answers for every pid a call asks about. Tests inject their
// own view.
export function processView({ boot } = {}) {
  let bootId = boot ?? process.env.AA_BOOT_ID ?? '';
  return {
    async boot() {
      if (bootId === '') bootId = (await readFile('/proc/sys/kernel/random/boot_id', 'utf8').catch(() => '')).trim();
      return bootId;
    },
    // ps exits 1 when none of the pids is alive, quietly. Should it complain,
    // one pid it cannot take must not hide the others: each is asked alone.
    async starts(pids) {
      const asked = pids.filter((pid) => pid <= PID_MAX);
      if (!asked.length) return new Map();
      const { starts, complained } = await ps(asked);
      if (!complained || asked.length === 1) return starts;
      // One at a time: a trail set with hundreds of pids spawns no crowd.
      const each = new Map();
      for (const pid of asked) for (const [key, value] of (await ps([pid])).starts) each.set(key, value);
      return each;
    },
  };
}

function ps(pids) {
  return new Promise((resolve) => {
    execFile('ps', ['-o', 'pid=,lstart=', '-p', pids.join(',')], { env: { ...process.env, TZ: 'UTC', LC_ALL: 'C' }, timeout: PS_TIMEOUT_MS }, (error, stdout, stderr) => {
      const starts = new Map();
      for (const line of String(stdout ?? '').split('\n')) {
        const words = collapse(line).split(' ');
        if (words.length > 1 && /^\d+$/.test(words[0])) starts.set(Number(words[0]), words.slice(1).join(' '));
      }
      resolve({ starts, complained: Boolean(error) && String(stderr ?? '').trim() !== '' });
    });
  });
}

// A view from a fixed list of the processes alive: `[{pid, lstart}]`.
export function fixedView({ boot = '', alive = [] } = {}) {
  const known = new Map(alive.map((item) => [item.pid, collapse(item.lstart)]));
  return { boot: async () => boot, starts: async (pids) => new Map(pids.filter((pid) => known.has(pid)).map((pid) => [pid, known.get(pid)])) };
}

function collapse(text) {
  return String(text).split(/[ \t\n\r\f\v]+/).filter(Boolean).join(' ');
}

// ---- Reading text (§3)

const isSpace = (c) => c === ' ' || c === '\t';
const isLetter = (c) => (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z');
const isDigit = (c) => c >= '0' && c <= '9';
const isWord = (c) => c !== undefined && (isLetter(c) || isDigit(c) || c === '_');

function trim(text) {
  let start = 0;
  let end = text.length;
  while (start < end && isSpace(text[start])) start += 1;
  while (end > start && isSpace(text[end - 1])) end -= 1;
  return text.slice(start, end);
}

function lower(text) {
  let out = '';
  for (const c of text) out += c >= 'A' && c <= 'Z' ? String.fromCharCode(c.charCodeAt(0) + 32) : c;
  return out;
}

function lines(text) {
  return text.split('\n').map((line) => (line.endsWith('\r') ? line.slice(0, -1) : line));
}

const blank = (line) => trim(line) === '';

function wholeNumber(text, low, high) {
  if (text === '' || text.length > 12) return undefined;
  for (const c of text) if (!isDigit(c)) return undefined;
  const value = Number(text);
  return value >= low && value <= high ? value : undefined;
}

// Every string in a parsed JSON value is well-formed: a lone surrogate escape
// makes the line not JSON as the contract reads it.
function wellFormed(value) {
  if (typeof value === 'string') return value.isWellFormed();
  if (Array.isArray(value)) return value.every(wellFormed);
  if (value && typeof value === 'object') return Object.entries(value).every(([key, item]) => key.isWellFormed() && wellFormed(item));
  return true;
}

// §7: repository text, cleaned and capped.
const SPACES = /[\u0009-\u000d\u0085\u2028\u2029]/g;
const REMOVED = /[\u0000-\u0008\u000e-\u001f\u007f-\u0084\u0086-\u009f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/g;

export function clean(text, cap) {
  let value = String(text).replace(SPACES, ' ').replace(REMOVED, '');
  value = value.split(' ').filter(Boolean).join(' ');
  if (cap === undefined || Buffer.byteLength(value) <= cap) return value;
  let out = '';
  let size = 0;
  for (const point of value) {
    const width = Buffer.byteLength(point);
    if (size + width > cap - 3) break;
    out += point;
    size += width;
  }
  while (out.endsWith(' ')) out = out.slice(0, -1);
  return `${out}…`;
}

// ---- §3.1, task files

export function taskIdOf(name) {
  if (name[0] !== 'T') return '';
  let i = 1;
  while (i < name.length && isDigit(name[i])) i += 1;
  const digits = i - 1;
  return digits >= 3 && digits <= 6 && name[i] === '-' ? name.slice(0, i) : '';
}

const isTaskName = (name) => taskIdOf(name) !== '' && name.endsWith('.md');
export const byId = (a, b) => Number(a.slice(1)) - Number(b.slice(1)) || (a < b ? -1 : a > b ? 1 : 0);

function parseValue(raw) {
  const value = trim(raw);
  if (value.length >= 2 && value[0] === '"' && value.at(-1) === '"') {
    try {
      const parsed = JSON.parse(value);
      if (typeof parsed === 'string' && parsed.isWellFormed()) return parsed;
    } catch { /* not a JSON string: the quotes come off */ }
    return value.slice(1, -1);
  }
  return value;
}

// The frontmatter's keys and the body's lines.
export function frontmatter(text) {
  const all = lines(text);
  const keys = {};
  if (all[0] !== '---') return { keys, body: all, head: [] };
  let end = all.indexOf('---', 1);
  if (end === -1) end = all.length;
  const head = all.slice(1, end);
  for (const line of head) {
    if (!isLetter(line[0] ?? '')) continue;
    let i = 1;
    while (i < line.length && (isLetter(line[i]) || isDigit(line[i]) || line[i] === '_' || line[i] === '-')) i += 1;
    if (line[i] !== ':') continue;
    keys[line.slice(0, i)] = parseValue(line.slice(i + 1));
  }
  return { keys, body: all.slice(end + 1), head };
}

export function statusWord(raw) {
  const value = lower(raw ?? '');
  for (const form of ['in progress', 'in_progress', 'in-progress']) if (value.startsWith(form)) return 'in_progress';
  let i = 0;
  while (i < value.length && !isLetter(value[i])) i += 1;
  let j = i;
  while (j < value.length && isLetter(value[j])) j += 1;
  return value.slice(i, j);
}

// `<operator> @<profile>/<session> <date> — <note>`: the operator and the
// session, or none.
export function ownerOf(raw) {
  const value = trim(raw ?? '');
  if (value === '' || value === 'none' || value.startsWith('—')) return null;
  let dashes = 0;
  while (value[dashes] === '-') dashes += 1;
  if (dashes > 0 && (dashes === value.length || value[dashes] === ' ')) return null;
  let end = value.length;
  for (let i = 0; i < value.length; i += 1) {
    if (value[i] !== ' ') continue;
    const rest = value.slice(i + 1);
    if (rest.startsWith('@') || rest.startsWith('—') || rest.startsWith('--') || isDate(rest)) { end = i; break; }
  }
  const operator = trim(value.slice(0, end));
  let session = '';
  for (let i = 0; i < value.length; i += 1) {
    if (value[i] !== '@' || (i > 0 && !isSpace(value[i - 1]))) continue;
    let j = i + 1;
    while (j < value.length && value[j] !== '/' && !isSpace(value[j])) j += 1;
    if (j === i + 1 || value[j] !== '/') continue;
    let k = j + 1;
    while (k < value.length && !isSpace(value[k])) k += 1;
    session = value.slice(j + 1, k);
    break;
  }
  return { operator, session };
}

function isDate(text) {
  if (text.length < 10) return false;
  for (let i = 0; i < 10; i += 1) {
    if (i === 4 || i === 7) { if (text[i] !== '-') return false; } else if (!isDigit(text[i])) return false;
  }
  return true;
}

function dependsOf(raw, own) {
  const value = raw ?? '';
  const ids = [];
  for (let i = 0; i < value.length; i += 1) {
    if (value[i] !== 'T' || isWord(value[i - 1])) continue;
    let j = i + 1;
    while (j < value.length && isDigit(value[j])) j += 1;
    const digits = j - i - 1;
    if (digits < 3 || digits > 6 || isWord(value[j])) continue;
    const id = value.slice(i, j);
    if (id !== own && !ids.includes(id)) ids.push(id);
    i = j - 1;
  }
  return ids.slice(0, LIMITS.depends);
}

// The Definition of Ready: a Decision-rules section with a line that counts.
export function isReady(body) {
  let section = false;
  let placeholder = false;
  let guidance = false;
  for (const raw of body) {
    if (raw.startsWith('## ')) { section = lower(raw).includes('decision rule'); continue; }
    if (!section) continue;
    let line = raw;
    if (placeholder) { if (line.includes('}}')) placeholder = false; continue; }
    if (line.includes('{{') && !line.includes('}}')) { placeholder = true; continue; }
    line = withoutPlaceholders(line);
    line = trim(line);
    if (guidance) { if (line.endsWith('*')) guidance = false; continue; }
    if (line.startsWith('*(')) { if (!line.endsWith('*')) guidance = true; continue; }
    if (line === '') continue;
    return true;
  }
  return false;
}

// Removes each `{{…}}` that holds no `}`, as board.sh's awk does.
function withoutPlaceholders(line) {
  let out = line;
  let from = 0;
  for (;;) {
    const start = out.indexOf('{{', from);
    if (start === -1) return out;
    let j = start + 2;
    while (j < out.length && out[j] !== '}') j += 1;
    if (out[j] === '}' && out[j + 1] === '}') { out = out.slice(0, start) + out.slice(j + 2); from = start; } else from = start + 1;
  }
}

function readTask(path, text) {
  const name = path.slice(path.lastIndexOf('/') + 1);
  const id = taskIdOf(name);
  const { keys, body } = frontmatter(text);
  const title = keys.title || name.slice(id.length + 1, -3).split('-').join(' ');
  const priority = lower(keys.priority ?? '');
  return {
    id, path, title,
    status: statusWord(keys.status),
    owner: ownerOf(keys.owner),
    priority: PRIORITIES.includes(priority) ? priority : '',
    depends: dependsOf(keys.depends, id),
    blockedReason: keys.blockedReason ?? '',
    ready: isReady(body),
  };
}

// ---- Git

function runGit(dir, args, { buffer = false, timeout = GIT_TIMEOUT_MS, input, extra = [] } = {}) {
  return new Promise((resolve, reject) => {
    const child = execFile('git', [...GIT_HARDENING, ...extra, '--no-optional-locks', '--literal-pathspecs', '-c', 'core.quotePath=false', '-C', dir, ...args], {
      encoding: buffer ? 'buffer' : 'utf8', maxBuffer: 512 * MiB, timeout, env: gitEnv({ GIT_OPTIONAL_LOCKS: '0' }), windowsHide: true,
    }, (error, stdout) => (error ? reject(error) : resolve(stdout)));
    if (input !== undefined) child.stdin.end(input);
  });
}
const tryGit = (dir, args, options) => runGit(dir, args, options).catch(() => null);
// What the answer rests on must be read: a git that fails there is a 500, not
// an empty board or a history with no signs of life in it.
const mustGit = (dir, args, options) => runGit(dir, args, options).catch(() => fail(500, `Git could not read the repository (git ${args[0]})`));
// git's one-line answer without its newline, or '' when git fails.
const gitLine = async (dir, args, options) => chomp((await tryGit(dir, args, options)) ?? '');
function chomp(text) {
  let end = text.length;
  while (end > 0 && text[end - 1] === '\n') end -= 1;
  return text.slice(0, end);
}

// Blob contents by sha, through one `git cat-file --batch`.
async function readBlobs(dir, shas) {
  const unique = [...new Set(shas)];
  const out = new Map();
  if (!unique.length) return out;
  const raw = await mustGit(dir, ['cat-file', '--batch'], { buffer: true, input: `${unique.join('\n')}\n` });
  let at = 0;
  for (const sha of unique) {
    const newline = raw.indexOf(10, at);
    const header = raw.subarray(at, newline).toString('latin1').split(' ');
    if (header[1] === 'missing') { at = newline + 1; continue; }
    const size = Number(header[2]);
    out.set(sha, raw.subarray(newline + 1, newline + 1 + size));
    at = newline + 1 + size + 1;
  }
  return out;
}

// The board's files in a tree: `[{mode, sha, size, path}]`. Only the
// upstream's may fail to read, and then it has none.
async function treeOf(dir, ref, board, { strict = true } = {}) {
  const args = ['ls-tree', '-r', '-z', '--long', ref, '--', `${board}/`];
  const raw = strict ? await mustGit(dir, args) : await tryGit(dir, args);
  if (raw === null) return [];
  return raw.split('\0').filter(Boolean).map((record) => {
    const tab = record.indexOf('\t');
    const [mode, , sha, size] = record.slice(0, tab).split(/ +/);
    return { mode, sha, size: Number(size), path: record.slice(tab + 1) };
  });
}

// Task files in a tree, each read; the layout; and the settings file's presence.
async function tasksAt(dir, ref, board, { strict = true } = {}) {
  const files = await treeOf(dir, ref, board, { strict });
  const prefix = `${board}/`;
  const taskFiles = files.filter((item) => {
    if (item.mode !== '100644' && item.mode !== '100755') return false;
    const rest = item.path.slice(prefix.length);
    const slash = rest.lastIndexOf('/');
    return FOLDERS.includes(rest.slice(0, slash)) && isTaskName(rest.slice(slash + 1));
  });
  const blobs = await readBlobs(dir, taskFiles.filter((item) => item.size <= TASK_MAX).map((item) => item.sha));
  const tasks = taskFiles.map((item) => {
    const text = item.size <= TASK_MAX && blobs.has(item.sha) ? decode(blobs.get(item.sha)) : '';
    return { ...readTask(item.path, text), folder: item.path.slice(prefix.length, item.path.lastIndexOf('/')), text };
  });
  return { tasks, older: olderLayout(files.map((item) => item.path), board) };
}

// An older board keeps unclaimed work in tasks/: it has no backlog/ file and
// no settings file. `paths` are the tree's paths.
export function olderLayout(paths, board) {
  const prefix = `${board}/`;
  return !paths.some((path) => path.startsWith(`${prefix}backlog/`)) && !paths.some((path) => path === `${prefix}${configName(board)}`);
}

// A task file's column (§3.1), from its folder and its status word.
export function columnOf(folder, status, older) {
  if (folder === 'backlog') return 'backlog';
  if (folder === 'tasks') return status === 'blocked' ? 'blocked' : older && ['open', 'unclaimed', 'backlog', ''].includes(status) ? 'backlog' : 'in_progress';
  return status === 'killed' ? 'killed' : 'done';
}

// Columns (§3.1): an id with two files is in none.
function columns(tasks, older) {
  const count = new Map();
  for (const task of tasks) count.set(task.id, (count.get(task.id) || 0) + 1);
  const byTask = new Map();
  const duplicates = [];
  for (const task of tasks) {
    if (count.get(task.id) > 1) { if (!duplicates.includes(task.id)) duplicates.push(task.id); continue; }
    byTask.set(task.id, { ...task, column: columnOf(task.folder, task.status, older) });
  }
  return { byTask, duplicates: duplicates.sort(byId), files: count };
}

// Signs of life in history (§3.6): each commit that touches a task's file or
// trail, with its author and author time, merges left out. Every field is
// separated by NUL, which none can hold: a commit is an empty field, then its
// author, time and subject, then its paths up to the next empty field.
async function history(dir, board, head) {
  const raw = await mustGit(dir, ['log', '--no-merges', '--name-only', '-z', '--format=%x00%an%x00%at%x00%s', head, '--', `${board}/backlog`, `${board}/tasks`, `${board}/checkpoints`]);
  const fields = raw.split('\0');
  const commits = [];
  let i = 0;
  while (i < fields.length) {
    if (fields[i] !== '' || i + 3 >= fields.length) { i += 1; continue; }
    const [author, at, subject] = fields.slice(i + 1, i + 4);
    i += 4;
    const ids = new Set();
    for (let first = true; i < fields.length && fields[i] !== ''; i += 1, first = false) {
      const name = first && fields[i][0] === '\n' ? fields[i].slice(1) : fields[i];
      if (!name.startsWith(`${board}/`)) continue;
      const rest = name.slice(board.length + 1);
      const slash = rest.lastIndexOf('/');
      const folder = rest.slice(0, slash);
      const file = rest.slice(slash + 1);
      if (FOLDERS.includes(folder) && isTaskName(file)) ids.add(taskIdOf(file));
      else if (folder === 'checkpoints' && file.endsWith('.jsonl') && ID.test(file.slice(0, -6))) ids.add(file.slice(0, -6));
    }
    commits.push({ author, ms: Number(at) * 1000, subject, ids });
  }
  return commits;
}

// ---- The working tree

async function realDir(path) {
  try { const info = await lstat(path); return info.isDirectory(); } catch { return false; }
}

// A regular file's bytes: null when it is missing, `{unreadable}` when it is
// not a regular file, `{over}` past `max`. With `tail`, a file past `max`
// gives its last `max` bytes and how many line feeds come before them,
// counted a chunk at a time. Opened without following a symbolic link, and
// without blocking on a FIFO, so what is checked is what is read.
async function readRegular(path, { max, tail = false } = {}) {
  let handle;
  try { handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK); } catch (error) {
    return error?.code === 'ENOENT' || error?.code === 'ENOTDIR' ? null : { unreadable: true };
  }
  try {
    const info = await handle.stat();
    if (!info.isFile()) return { unreadable: true };
    if (max === undefined || info.size <= max) return { bytes: await handle.readFile() };
    if (!tail) return { over: true };
    const start = info.size - max;
    const chunk = Buffer.alloc(Math.min(MiB, start));
    let before = 0;
    for (let at = 0; at < start;) {
      const { bytesRead } = await handle.read(chunk, 0, Math.min(chunk.length, start - at), at);
      if (!bytesRead) break;
      for (let i = 0; i < bytesRead; i += 1) if (chunk[i] === 10) before += 1;
      at += bytesRead;
    }
    const bytes = Buffer.alloc(max);
    let got = 0;
    while (got < max) {
      const { bytesRead } = await handle.read(bytes, got, max - got, start + got);
      if (!bytesRead) break;
      got += bytesRead;
    }
    return { bytes: bytes.subarray(0, got), truncated: true, before };
  } finally {
    await handle.close();
  }
}

// §3.2: every trail named by a task id, its entries in file order.
async function readTrails(boardDir) {
  const folder = join(boardDir, 'checkpoints');
  const trails = new Map();
  if (!await realDir(folder)) return trails;
  for (const name of (await readdir(folder)).sort()) {
    if (!name.endsWith('.jsonl') || !ID.test(name.slice(0, -6))) continue;
    const id = name.slice(0, -6);
    const file = await readRegular(join(folder, name), { max: TRAIL_MAX, tail: true });
    if (!file) continue;
    const trail = { id, entries: [], malformed: 0, firstMalformed: 0, unreadable: Boolean(file.unreadable), truncated: Boolean(file.truncated) };
    trails.set(id, trail);
    if (file.unreadable) continue;
    let lineNumber = file.before ?? 0;
    const skipFirst = file.truncated;
    const all = lines(decode(file.bytes));
    for (let index = 0; index < all.length; index += 1) {
      lineNumber += 1;
      if (skipFirst && index === 0) continue;
      const line = all[index];
      if (blank(line)) continue;
      const entry = parseEntry(line);
      if (entry) { trail.entries.push(entry); continue; }
      trail.malformed += 1;
      if (trail.malformed === 1) trail.firstMalformed = lineNumber;
    }
  }
  return trails;
}

// One trail line as an entry, or null when it is not one (§3.2).
export function parseEntry(line) {
  let value;
  try { value = JSON.parse(line); } catch { return null; }
  if (!value || typeof value !== 'object' || Array.isArray(value) || !wellFormed(value)) return null;
  if (!readsBack(value.ts) || !isRunId(value.run) || !KINDS.has(value.kind)) return null;
  return { ts: value.ts, ms: Date.parse(value.ts), run: value.run, kind: value.kind, value };
}

// §3.5: the settings file, as ckpt.sh and board.sh mean to read it.
export function readPolicy(text) {
  const top = {};
  const wip = {};
  const spend = [];
  let block = '';
  for (const line of lines(text ?? '')) {
    if (block && !blank(line) && !isSpace(line[0]) && line[0] !== '#') block = '';
    if (block === 'wip') {
      const words = trim(line).split(/[ \t]+/);
      const key = words[0] === 'in_progress:' ? 'in_progress' : words[0] === 'blocked:' ? 'blocked' : '';
      if (key && !(key in wip)) {
        const rest = trim(line);
        wip[key] = beforeHash(rest.slice(words[0].length));
      }
      continue;
    }
    if (block === 'spend') {
      const item = trim(line);
      if (item.startsWith('- ')) {
        const word = beforeHash(item.slice(2));
        if (word) spend.push(word);
      }
      continue;
    }
    if (line.startsWith('wip:')) { block = 'wip'; continue; }
    if (line.startsWith('spend:')) { block = 'spend'; continue; }
    for (const key of ['stale_hours', 'live_minutes']) {
      if (line.startsWith(`${key}:`) && !(key in top)) top[key] = beforeHash(line.slice(key.length + 1));
    }
  }
  const staleHours = wholeNumber(top.stale_hours ?? '', 1, 8760) ?? DEFAULTS.staleHours;
  let liveMinutes = wholeNumber(top.live_minutes ?? '', 1, 525600) ?? DEFAULTS.liveMinutes;
  let clamped = false;
  if (liveMinutes >= staleHours * 60) { liveMinutes = staleHours * 60 - 1; clamped = true; }
  return {
    staleHours, liveMinutes, clamped, spend,
    limit: wholeNumber(wip.in_progress ?? '', 0, 9999) ?? 0,
    blockedLimit: wholeNumber(wip.blocked ?? '', 0, 9999) ?? 0,
  };
}

function beforeHash(text) {
  const hash = text.indexOf('#');
  return trim(hash === -1 ? text : text.slice(0, hash));
}

// The working tree's task files, each path with its frontmatter's text.
async function workingTasks(boardDir) {
  const found = new Map();
  for (const folder of FOLDERS) {
    const path = join(boardDir, folder);
    if (!await realDir(path) || (folder === 'tasks/done' && !await realDir(join(boardDir, 'tasks')))) continue;
    for (const name of await readdir(path)) {
      if (!isTaskName(name)) continue;
      const file = await readRegular(join(path, name), { max: TASK_MAX });
      if (!file || file.unreadable) continue;
      found.set(`${folder}/${name}`, file.over ? '' : decode(file.bytes));
    }
  }
  return found;
}

const headOf = (text) => frontmatter(text).head.join('\n');

// §5's state-stale: the (column, id) pairs STATE.md's generated region shows
// under IN PROGRESS and BLOCKED, or null without the region.
function statePairs(text, board) {
  const open = `<!-- ${board}:generated -->`;
  const close = `<!-- /${board}:generated -->`;
  const start = text.indexOf(open);
  if (start === -1) return null;
  const end = text.indexOf(close, start + open.length);
  if (end === -1) return null;
  const pairs = new Set();
  let column = '';
  for (const line of lines(text.slice(start + open.length, end))) {
    if (!line.startsWith('|')) continue;
    const cells = line.split('|').slice(1, -1).map(trim);
    const first = cells[0] ?? '';
    if (first.startsWith('**')) {
      const close2 = first.indexOf('**', 2);
      column = close2 === -1 ? '' : first.slice(2, close2);
    } else if (first !== '') column = '';
    if (column && ID.test(cells[1] ?? '')) pairs.add(`${column}\0${cells[1]}`);
  }
  return [...pairs].filter((pair) => pair.startsWith('IN PROGRESS\0') || pair.startsWith('BLOCKED\0')).sort();
}

function nowBlock(text, board) {
  const open = `<!-- ${board}:now -->`;
  const close = `<!-- /${board}:now -->`;
  const start = text.indexOf(open);
  if (start === -1) return '';
  const end = text.indexOf(close, start + open.length);
  if (end === -1) return '';
  return text.slice(start + open.length, end);
}

// The Handoff's `- ` lines, joined by a space.
function handoffOf(text) {
  const all = lines(text);
  const start = all.findIndex((line) => line.startsWith('## Handoff'));
  if (start === -1) return '';
  const items = [];
  for (const line of all.slice(start + 1)) {
    if (line.startsWith('## ')) break;
    if (line.startsWith('- ')) items.push(line.slice(2));
  }
  return items.join(' ');
}

// ---- §3.3, running or closed

function runsOf(trail, policy, asOfMs) {
  const runs = new Map();
  trail.entries.forEach((entry, position) => {
    if (!runs.has(entry.run)) runs.set(entry.run, { task: trail.id, run: entry.run, entries: [] });
    runs.get(entry.run).entries.push({ ...entry, position });
  });
  for (const run of runs.values()) {
    run.newest = run.entries.at(-1);
    run.proc = [...run.entries].reverse().map((entry) => processRecord(entry.value)).find(Boolean) || null;
    run.counted = untilOf(run.newest, policy);
  }
  return [...runs.values()];
}

function untilOf(entry, policy) {
  if (entry.kind !== 'doing' || !readsBack(entry.value.until)) return null;
  return Math.min(Date.parse(entry.value.until), entry.ms + policy.staleHours * 3600000);
}

function processRecord(value) {
  const { boot, pid, pstart } = value;
  if (typeof boot !== 'string' || boot === '' || typeof pstart !== 'string' || pstart === '') return null;
  if (typeof pid !== 'number' || !Number.isInteger(pid) || pid <= 0) return null;
  return { boot, pid, pstart };
}

// Whether the process view decides the run (rule 3), the rules before it
// having not.
const byProcess = (run, asOfMs, boot) => run.newest.kind !== 'end' && !(run.counted !== null && run.counted > asOfMs) && run.proc !== null && run.proc.boot === boot;

function decide(run, { asOfMs, policy, boot, starts }) {
  const { newest } = run;
  if (newest.kind === 'end') return { state: 'closed', by: 'end', until: undefined };
  if (run.counted !== null && run.counted > asOfMs) return { state: 'running', by: 'until', until: run.counted };
  if (byProcess(run, asOfMs, boot)) {
    const alive = starts.get(run.proc.pid) === run.proc.pstart;
    return { state: alive ? 'running' : 'closed', by: 'process', until: undefined };
  }
  const running = asOfMs - newest.ms <= policy.liveMinutes * 60000;
  return { state: running ? 'running' : 'closed', by: 'clock', until: running ? newest.ms + policy.liveMinutes * 60000 : undefined };
}

// ---- The answer

// Orient for the repository at `dir`. `call` is from readCall; `view` is the
// process view, with `gates` ({T: time}) on the server; `door` is "server" or
// "board.sh". Returns the answer as an object in the contract's key order.
export async function orient(dir, call, { view = processView(), gates = {}, door = 'server' } = {}) {
  const board = await findBoard(dir);
  if (!board) refuse(404, 'The repository has no board: no AA/, deaddrop/ or pm/ folder with a tasks/ folder');
  const boardDir = join(dir, board);
  const operator = call.operator ?? await gitLine(dir, ['config', 'user.name']);
  if (!operator) refuse(400, 'operator must be given, or set as the repository\'s git user.name');
  const asOfMs = Date.parse(call.asOf);
  // HEAD once: every read of it below uses this commit, so a claim committed
  // meanwhile cannot split the answer.
  // An unborn branch has no HEAD; a HEAD that names a commit git cannot read
  // is a broken repository, not an empty board.
  const head = await gitLine(dir, ['rev-parse', '--verify', '-q', 'HEAD^{commit}']) || null;
  if (!head && await gitLine(dir, ['rev-parse', '--verify', '-q', 'HEAD'])) refuse(500, 'Git could not read the repository: HEAD names a commit that is missing');

  const [{ tasks, older }, commits, trails, settings, state, working] = await Promise.all([
    head ? tasksAt(dir, head, board) : { tasks: [], older: true },
    head ? history(dir, board, head) : [],
    readTrails(boardDir),
    readRegular(join(boardDir, configName(board)), { max: SETTINGS_MAX }),
    readRegular(join(boardDir, 'STATE.md'), { max: STATE_MAX }),
    workingTasks(boardDir),
  ]);
  const policy = readPolicy(settings?.bytes ? decode(settings.bytes) : '');
  const stateText = state?.bytes ? decode(state.bytes) : '';
  const { byTask, duplicates, files } = columns(tasks, older);
  const boot = await view.boot();

  // Runs, each running or closed; one ps for every pid the process rule asks about.
  const runs = [...trails.values()].flatMap((trail) => runsOf(trail, policy, asOfMs));
  const pids = [...new Set(runs.filter((run) => byProcess(run, asOfMs, boot)).map((run) => run.proc.pid))];
  const starts = pids.length ? await view.starts(pids) : new Map();
  for (const run of runs) Object.assign(run, decide(run, { asOfMs, policy, boot, starts }));
  const byRunTask = new Map();
  for (const run of runs) {
    if (!byRunTask.has(run.task)) byRunTask.set(run.task, []);
    byRunTask.get(run.task).push(run);
  }
  const runsOn = (id) => byRunTask.get(id) ?? [];
  const root = call.run ? call.run.split('.')[0] : null;
  const family = (run) => root !== null && run.run.split('.')[0] === root;
  const holders = new Map();
  const holderOf = (id) => {
    if (!holders.has(id)) holders.set(id, runsOn(id).filter((run) => run.state === 'running' && !family(run)).sort((a, b) => b.newest.position - a.newest.position)[0] || null);
    return holders.get(id);
  };
  const stoppedMidAct = (run) => run.state === 'closed' && run.newest.kind === 'doing';

  const list = [...byTask.values()].sort((a, b) => byId(a.id, b.id));
  const inProgress = list.filter((task) => task.column === 'in_progress');
  const blocked = list.filter((task) => task.column === 'blocked');
  const backlog = list.filter((task) => task.column === 'backlog');
  const held = [...inProgress, ...blocked].filter((task) => task.owner && task.owner.operator === operator).sort((a, b) => byId(a.id, b.id));

  // §3.6, expired claims: each task's signs of life in history, gathered once.
  const commitSigns = new Map();
  for (const commit of commits) {
    if (commit.author === operator || commit.subject.startsWith('ckpt:') || commit.subject.startsWith('migrate:')) continue;
    for (const id of commit.ids) {
      if (!commitSigns.has(id)) commitSigns.set(id, []);
      commitSigns.get(id).push(commit.ms);
    }
  }
  const signsOf = (id) => [...(trails.get(id)?.entries ?? []).map((entry) => entry.ms), ...(commitSigns.get(id) ?? [])];
  const expired = [];
  for (const task of [...inProgress, ...blocked]) {
    if (!task.owner || task.owner.operator === operator) continue;
    if (runsOn(task.id).some((run) => run.state === 'running')) continue;
    const times = signsOf(task.id);
    if (times.some((ms) => asOfMs - ms <= policy.staleHours * 3600000)) continue;
    expired.push({ task, last: times.length ? times.reduce((a, b) => Math.max(a, b)) : null });
  }
  expired.sort((a, b) => (a.last === null ? -Infinity : a.last) - (b.last === null ? -Infinity : b.last) || byId(a.task.id, b.task.id));

  // §3.7, claimable.
  const dependents = new Map();
  for (const task of [...backlog, ...inProgress, ...blocked]) for (const on of task.depends) dependents.set(on, (dependents.get(on) || 0) + 1);
  const unblocks = (id) => dependents.get(id) || 0;
  const met = (id) => byTask.get(id)?.column === 'done';
  const claimable = backlog.filter((task) => task.ready && task.depends.every(met) && !holderOf(task.id))
    .map((task) => ({ task, priority: task.priority, unblocks: unblocks(task.id) }))
    .sort((a, b) => rank(a.priority) - rank(b.priority) || b.unblocks - a.unblocks || byId(a.task.id, b.task.id));

  const used = inProgress.length + blocked.length;
  const runFields = (run) => ({ run: run.run, by: run.by, since: iso(run.newest.ms), ...(run.state === 'running' && run.until !== undefined ? { until: iso(run.until) } : {}) });

  // §4, next.
  let next = null;
  let nextRun = null;
  if (call.task) {
    const T = call.task;
    const task = byTask.get(T);
    const holder = holderOf(T);
    const own = runsOn(T).find((run) => run.run === call.run);
    if (!task || !held.includes(task)) next = { do: 'stop', task: T, reasons: ['not-yours'], rule: [7] };
    else if (holder) { next = { do: 'stop', task: T, ...runFields(holder), reasons: ['held-elsewhere'], rule: [7] }; nextRun = holder; }
    else if (own && stoppedMidAct(own)) { next = { do: 'resume', task: T, ...runFields(own), verify: 'tell', reasons: ['stopped-mid-act'], rule: [7] }; nextRun = own; }
    else next = { do: 'continue', task: T, reasons: ['bound'], rule: [7] };
  }
  const free = held.filter((task) => !holderOf(task.id));
  if (!next) {
    for (const task of free) {
      const stopped = runsOn(task.id).filter(stoppedMidAct).sort((a, b) => b.newest.position - a.newest.position)[0];
      if (stopped) { next = { do: 'resume', task: task.id, ...runFields(stopped), verify: 'tell', reasons: ['stopped-mid-act'], rule: [3, 6, 8] }; nextRun = stopped; break; }
    }
  }
  if (!next) {
    const task = free.find((item) => item.column === 'blocked' || trails.get(item.id)?.entries.at(-1)?.kind === 'blocked');
    if (task) next = { do: 'check-unblock', task: task.id, reasons: ['blocked'], rule: [8] };
  }
  if (!next) {
    const task = free.find((item) => item.column === 'in_progress' && !gates[item.id]);
    if (task) {
      const rewrite = root !== null && root !== (task.owner.session || '');
      next = { do: 'continue', task: task.id, reasons: rewrite ? ['in-progress', 'rewrite-owner'] : ['in-progress'], rule: [3, 8] };
    }
  }
  if (!next) {
    const task = held.find((item) => gates[item.id]);
    if (task) next = { do: 'wait', task: task.id, since: gates[task.id], reasons: ['gate'], rule: [] };
  }
  if (!next) {
    const task = held.find((item) => holderOf(item.id));
    if (task) { const holder = holderOf(task.id); next = { do: 'wait', task: task.id, ...runFields(holder), reasons: ['held-elsewhere'], rule: [3, 6] }; nextRun = holder; }
  }
  if (!next && expired.length) {
    const { task, last } = expired[0];
    next = { do: 'release', task: task.id, ...(last !== null ? { since: iso(last) } : {}), reasons: ['expired'], rule: [4] };
  }
  if (!next && policy.limit > 0 && used >= policy.limit) next = { do: 'stop', reasons: ['wip-full'], rule: [10] };
  if (!next && claimable.length) next = { do: 'claim', task: claimable[0].task.id, reasons: ['ready'], rule: [1, 5, 12] };
  if (!next) next = { do: 'idle', reasons: [backlog.length ? 'none-ready' : 'empty-backlog'], rule: [] };

  const cut = {};
  const capped = (key, items) => {
    if (items.length > LIMITS[key]) cut[key] = items.length - LIMITS[key];
    return items.slice(0, LIMITS[key]);
  };

  // you, inFlight, take
  const you = capped('you', held.map((task) => {
    const holder = holderOf(task.id);
    return { task: task.id, column: task.column, ...(holder ? { heldBy: holder.run } : {}) };
  }));
  const flying = runs.filter((run) => run.newest.kind === 'doing' || (run.state === 'running' && !family(run)))
    .sort((a, b) => (a.state === b.state ? 0 : a.state === 'running' ? -1 : 1) || byId(a.task, b.task) || (a.run < b.run ? -1 : a.run > b.run ? 1 : 0));
  const inFlight = capped('inFlight', flying.map((run) => ({
    task: run.task, run: run.run, kind: run.newest.kind, since: iso(run.newest.ms), state: run.state, by: run.by,
    ...(run.state === 'running' && run.until !== undefined ? { until: iso(run.until) } : {}),
  })));
  const take = capped('take', claimable.map(({ task, priority, unblocks: count }) => ({ task: task.id, ...(priority ? { priority } : {}), unblocks: count })));

  // §5, warnings.
  const warnings = [];
  if (board !== 'AA' || older) warnings.push({ code: 'older-board' });
  if (policy.limit === 0) warnings.push({ code: 'no-wip-limit' });
  if (policy.clamped) warnings.push({ code: 'live-minutes-clamped' });
  const pairs = statePairs(stateText, board);
  if (pairs) {
    const atHead = [...inProgress.map((task) => `IN PROGRESS\0${task.id}`), ...blocked.map((task) => `BLOCKED\0${task.id}`)].sort();
    if (pairs.join('\n') !== atHead.join('\n')) warnings.push({ code: 'state-stale' });
  }
  for (const { task } of [...expired].sort((a, b) => byId(a.task.id, b.task.id))) if (task.id !== next.task) warnings.push({ code: 'claim-expired', task: task.id });
  for (const id of await unpushed(dir, board, held)) warnings.push({ code: 'claim-unpushed', task: id });
  for (const task of backlog) for (const on of [...task.depends].sort(byId)) if (byTask.get(on)?.column === 'killed') warnings.push({ code: 'depends-killed', task: task.id, on });
  for (const id of duplicates) warnings.push({ code: 'duplicate-id', task: id });
  for (const id of uncommitted(tasks, working, board)) warnings.push({ code: 'uncommitted-task-change', task: id });
  const trailList = [...trails.values()].sort((a, b) => byId(a.id, b.id));
  for (const trail of trailList) if (trail.malformed) warnings.push({ code: 'trail-malformed', task: trail.id, line: trail.firstMalformed, n: trail.malformed });
  for (const trail of trailList) if (trail.unreadable) warnings.push({ code: 'trail-unreadable', task: trail.id });
  for (const trail of trailList) if (trail.truncated) warnings.push({ code: 'trail-truncated', task: trail.id });

  // rules
  const notReady = capped('notReady', backlog.filter((task) => !task.ready).map((task) => task.id));
  const rules = { wip: { used, limit: policy.limit, blocked: blocked.length, blockedLimit: policy.blockedLimit }, staleHours: policy.staleHours, liveMinutes: policy.liveMinutes, notReady };

  // data, quoted and capped
  const data = {};
  const name = clean(basename(dir), CAPS.repo);
  if (name) data.repo = { name };
  const spend = policy.spend.map((word) => clean(word, CAPS.spend)).filter(Boolean);
  if (spend.length) data.spend = capped('spend', spend);
  const one = (id) => (files.get(id) === 1 ? tasks.find((task) => task.id === id) : null);
  const authors = new Map();
  const authorOf = async (path) => {
    if (!authors.has(path)) authors.set(path, await gitLine(dir, ['log', '-1', '--format=%an', head, '--', path]));
    return authors.get(path);
  };
  const put = (entry, key, value) => { const text = clean(value ?? '', CAPS[key]); if (text) entry[key] = text; };
  const card = async (id, full) => {
    const entry = {};
    const task = one(id);
    if (task) {
      put(entry, 'title', task.title);
      put(entry, 'file', task.path);
      put(entry, 'author', await authorOf(task.path));
    }
    const trail = trails.get(id);
    put(entry, 'next', newest(trail, (e) => nonEmpty(e.value.next))?.value.next);
    if (!full) return entry;
    if (nextRun && nextRun.newest.kind === 'doing') {
      const value = nextRun.newest.value;
      put(entry, 'act', nonEmpty(value.act) ? value.act : nonEmpty(value.what) ? value.what : '');
      put(entry, 'tell', nonEmpty(value.tell) ? value.tell : '');
    }
    put(entry, 'left', newest(trail, (e) => e.kind === 'end' && nonEmpty(e.value.left))?.value.left);
    if (next.do === 'check-unblock') {
      const last = trail?.entries.at(-1);
      put(entry, 'blocked', last?.kind === 'blocked' && nonEmpty(last.value.unblocks) ? last.value.unblocks : byTask.get(id)?.blockedReason);
    }
    const mine = held.find((item) => item.id === id);
    if (mine) {
      const file = await readRegular(join(dir, mine.path), { max: TASK_MAX });
      if (file?.bytes && await realDir(join(boardDir, mine.folder))) put(entry, 'handoff', handoffOf(decode(file.bytes)));
    }
    return entry;
  };
  if (next.task) data[next.task] = await card(next.task, true);
  const nowText = clean(nowBlock(stateText, board), CAPS.now);
  if (nowText) data.now = { text: nowText, file: `${board}/STATE.md` };
  for (const id of [...you.map((item) => item.task), ...take.map((item) => item.task)]) if (!(id in data)) data[id] = await card(id, false);

  // more
  const nextFile = next.task ? one(next.task) : null;
  const more = {
    ...(next.task ? { trail: `${board}/ckpt.sh live ${next.task}` } : {}),
    ...(nextFile ? { task: `${board}/${nextFile.folder}/${next.task}-*.md` } : {}),
    board: `${board}/board.sh`,
  };

  const shownWarnings = capped('warnings', sortWarnings(warnings));
  const remote = call.remote ? { moved: await moved(dir), checkedAt: call.asOf } : null;
  const answer = {
    schema: SCHEMA, asOf: call.asOf, repo: { head, board: `${board}/`, door },
    ...(remote ? { remote } : {}),
    next, rules, you, inFlight, take, warnings: shownWarnings, data, more,
  };
  return budgeted(answer, cut, call.budget);
}

const rank = (priority) => (priority ? PRIORITIES.indexOf(priority) : PRIORITIES.length);
const nonEmpty = (value) => typeof value === 'string' && value !== '';
const newest = (trail, test) => (trail ? [...trail.entries].reverse().find(test) : undefined);

function sortWarnings(warnings) {
  return warnings.map((warning, index) => ({ warning, index })).sort((a, b) => {
    const x = a.warning;
    const y = b.warning;
    return WARNING_ORDER.indexOf(x.code) - WARNING_ORDER.indexOf(y.code)
      || (x.task && y.task ? byId(x.task, y.task) : 0)
      || (x.on && y.on ? byId(x.on, y.on) : 0)
      || a.index - b.index;
  }).map((item) => item.warning);
}

// The ids whose task files the working tree adds, removes, moves or changes
// the frontmatter of (§5).
function uncommitted(tasks, working, board) {
  const prefix = `${board}/`;
  const atHead = new Map();
  for (const task of tasks) {
    if (!atHead.has(task.id)) atHead.set(task.id, new Map());
    atHead.get(task.id).set(task.path.slice(prefix.length), headOf(task.text));
  }
  const inTree = new Map();
  for (const [path, text] of working) {
    const id = taskIdOf(path.slice(path.lastIndexOf('/') + 1));
    if (!inTree.has(id)) inTree.set(id, new Map());
    inTree.get(id).set(path, headOf(text));
  }
  const changed = [];
  for (const id of new Set([...atHead.keys(), ...inTree.keys()])) {
    const a = atHead.get(id) ?? new Map();
    const b = inTree.get(id) ?? new Map();
    const same = a.size === b.size && [...a].every(([path, head]) => b.has(path) && b.get(path) === head);
    if (!same) changed.push(id);
  }
  return changed.sort(byId);
}

// The tasks the caller holds at HEAD but not at the upstream (§5).
async function unpushed(dir, board, held) {
  if (!held.length) return [];
  const upstream = await tryGit(dir, ['rev-parse', '--verify', '-q', '@{upstream}']);
  if (!upstream) return [];
  const { tasks, older } = await tasksAt(dir, chomp(upstream), board, { strict: false });
  const { byTask } = columns(tasks, older);
  const operator = held[0].owner.operator;
  return held.filter((task) => {
    const there = byTask.get(task.id);
    return !(there && (there.column === 'in_progress' || there.column === 'blocked') && there.owner?.operator === operator);
  }).map((task) => task.id);
}

// Whether the upstream branch has moved since the last fetch (§6, remote).
async function moved(dir) {
  const branch = await gitLine(dir, ['symbolic-ref', '-q', 'HEAD']);
  if (!branch.startsWith('refs/heads/')) return 'unknown';
  const name = branch.slice('refs/heads/'.length);
  const remote = await gitLine(dir, ['config', '--get', `branch.${name}.remote`]);
  const merge = await gitLine(dir, ['config', '--get', `branch.${name}.merge`]);
  const tracking = await gitLine(dir, ['rev-parse', '--verify', '-q', '@{upstream}']);
  if (!remote || !merge || !tracking) return 'unknown';
  const listed = await tryGit(dir, ['ls-remote', '--upload-pack=git-upload-pack', '--', remote, merge], { timeout: REMOTE_TIMEOUT_MS, extra: REMOTE_PROTOCOLS });
  if (listed === null) return 'unknown';
  const line = listed.split('\n').find((item) => item.endsWith(`\t${merge}`));
  if (!line) return 'unknown';
  return line.slice(0, line.indexOf('\t')) === tracking ? 'no' : 'yes';
}

// ---- §7 and §8: the bytes, and the budget

export function serialize(answer) {
  return JSON.stringify(answer);
}

function measure(answer) {
  const wide = { ...answer, repo: { ...answer.repo, door: 'board.sh' } };
  if (answer.remote) wide.remote = { ...answer.remote, moved: 'unknown' };
  return Buffer.byteLength(serialize(wide));
}

function budgeted(answer, cut, budget) {
  const value = { ...answer, data: { ...answer.data }, take: [...answer.take], you: [...answer.you] };
  const counts = { ...cut };
  const settle = () => {
    const kept = CUT_ORDER.filter((key) => counts[key] > 0);
    if (kept.length) value.cut = Object.fromEntries(kept.map((key) => [key, counts[key]]));
    else delete value.cut;
    return value;
  };
  while (measure(settle()) > budget) {
    const keys = Object.keys(value.data);
    if (keys.length) { delete value.data[keys.at(-1)]; counts.data = (counts.data || 0) + 1; continue; }
    if (value.take.length) { value.take.pop(); counts.take = (counts.take || 0) + 1; continue; }
    if (value.you.length) { value.you.pop(); counts.you = (counts.you || 0) + 1; continue; }
    break;
  }
  return settle();
}
