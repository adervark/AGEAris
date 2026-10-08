import { createHash, randomUUID } from 'node:crypto';
import { constants as fsConstants, lstatSync } from 'node:fs';
import { access, cp, lstat, mkdir, open, readFile, readdir, realpath, rename, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, parse, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';

// The one definition of the task actions, the one the page uses.
import { columnsFor, labelFor, TASK_ACTIONS, WHY } from '../public/actions.js';
// lib/tracked.mjs is imported where it is used: it imports this module, and a
// static import here would load it before WorkspaceError exists.

const PROJECT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TASK_ID = /^T(\d{3,})$/;
const STATUSES = new Set(['backlog', 'in_progress', 'blocked', 'done']);
const STORED_STATUSES = new Set(['open', 'unclaimed', 'backlog', 'claimed', 'in_progress', 'blocked', 'done', 'killed']);
// Status words that mean nobody has claimed the task.
const UNCLAIMED = new Set(['', 'open', 'unclaimed', 'backlog']);
const PRIORITIES = new Set(['low', 'medium', 'high', 'urgent']);
// The folders a task board can live in: AA/, or the convention's older
// names, deaddrop/ (until 2026-10-07) and pm/ (until 2026-09-02).
const BOARDS = ['AA', 'deaddrop', 'pm'];
// The folder AGE Aris makes a new project's board in.
const NEW_BOARD = 'AA';
// A task file's name: its id, then a slug.
const TASK_FILE = /^T\d{3,}-.*\.md$/;
// The documents a board keeps about its own way of working, shown in a
// project's Method view.
const METHOD_DOCS = ['WORKFLOW.md', 'RULES.md', 'AGENTS.md', 'WHY.md'];
const TEMPLATE_ROOT = fileURLToPath(new URL('../skills/aa-init/template/', import.meta.url));
// Files in a project repository, which agents may write, must never make
// AGE Aris run code or reach the network: no hooks, no fsmonitor, no signature
// checks (log.showSignature would run gpg.program), and no transport at all
// (a partial clone would otherwise fetch the blobs it lacks).
const GIT_HARDENING = ['-c', 'core.hooksPath=/dev/null', '-c', 'core.fsmonitor=false', '-c', 'log.showSignature=false', '-c', 'protocol.allow=never'];
// Inherited variables that would point git at another repository or make it
// run a program are dropped from git's environment.
const GIT_ENV_DROPPED = ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_OBJECT_DIRECTORY', 'GIT_ALTERNATE_OBJECT_DIRECTORIES', 'GIT_COMMON_DIR', 'GIT_NAMESPACE', 'GIT_PREFIX', 'GIT_EXTERNAL_DIFF', 'GIT_SSH', 'GIT_SSH_COMMAND', 'GIT_ASKPASS', 'GIT_PAGER', 'GIT_EDITOR', 'GIT_SEQUENCE_EDITOR', 'GIT_PROXY_COMMAND'];
const TRAILER_KEY = /^[A-Z][A-Za-z0-9-]*$/;
const DELTA_FALLBACKS = new Set(['previous-workday', '24h', '7d']);
// 'UTC' is a valid IANA zone that Intl.supportedValuesOf leaves out.
const TIME_ZONES = new Set([...Intl.supportedValuesOf('timeZone'), 'UTC', 'Etc/UTC']);

// The Handoff boilerplate AGE Aris writes into new tasks; it never counts as a
// reason a task is blocked.
export const DEFAULT_NEXT_DECISION = 'choose the smallest safe action that advances the goal';

// `code` names a refusal (WRONG_BRANCH, CONFIRM, …) and `remedy` says what to
// do about it; `details` go out with it (a confirmation's reasons and token).
export class WorkspaceError extends Error {
  constructor(status, message, code = '', remedy = '', details = undefined) {
    super(message);
    this.name = 'WorkspaceError';
    this.status = status;
    if (code) this.code = code;
    if (remedy) this.remedy = remedy;
    if (details) this.details = details;
  }
}

function fail(status, message) {
  throw new WorkspaceError(status, message);
}

// A refusal with its code and remedy: a 409 unless the code is one of these.
const REFUSAL_STATUS = { BAD_INPUT: 400, NOT_FOUND: 404 };
function refuse(code, message, remedy = '', details = undefined) {
  throw new WorkspaceError(REFUSAL_STATUS[code] || 409, message, code, remedy, details);
}

// The overrides are filtered too: a dropped variable never gets through, from
// the process or from a caller.
function gitEnv(extra = {}) {
  const env = { ...process.env, GIT_NO_LAZY_FETCH: '1', GIT_TERMINAL_PROMPT: '0', ...extra };
  for (const key of GIT_ENV_DROPPED) delete env[key];
  return env;
}

// `input` is written to stdin, which is otherwise closed; after `timeout` ms
// git is killed and the call fails.
function git(cwd, args, { allowFailure = false, env, input, timeout } = {}) {
  const result = spawnSync('git', [...GIT_HARDENING, '-C', cwd, ...args], {
    encoding: 'utf8',
    stdio: [input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'],
    env: gitEnv(env),
    ...(input === undefined ? {} : { input }),
    ...(timeout ? { timeout } : {}),
  });
  if (result.error?.code === 'ETIMEDOUT') fail(500, `Git timed out after ${timeout} ms: git ${args[0]}`);
  if (result.error) fail(500, `Git could not run: ${redactEmails(result.error.message)}`);
  if (result.status !== 0 && !allowFailure) {
    const detail = redactEmails(result.stderr.trim() || result.stdout.trim() || `exit ${result.status}`);
    fail(500, `Git operation failed: ${detail}`);
  }
  return result;
}

function redactEmails(text) {
  return text.replace(/[^\s<>"']+@[^\s<>"']+/g, '[email redacted]');
}

// Git without blocking the event loop or limiting the output: yields stdout as
// Buffer chunks, exactly as git wrote them (decode only after joining them), and
// throws after the last chunk if git failed. `input` is written to stdin.
// `spawn` replaces child_process.spawn (tests count or delay git processes).
async function* gitStream(cwd, args, { input, signal, spawn: spawnProcess = spawn } = {}) {
  const child = spawnProcess('git', [...GIT_HARDENING, '-C', cwd, ...args], {
    stdio: [input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'],
    env: gitEnv(),
    ...(signal ? { signal } : {}),
  });
  const stderr = [];
  let stderrSize = 0;
  child.stderr.on('data', (chunk) => {
    if (stderrSize < 64 * 1024) stderr.push(chunk);
    stderrSize += chunk.length;
  });
  const exited = new Promise((resolve) => {
    child.once('error', (error) => resolve({ error }));
    child.once('close', (code) => resolve({ code }));
  });
  if (input !== undefined) {
    child.stdin.on('error', () => {});
    child.stdin.end(input);
  }
  let finished = false;
  try {
    for await (const chunk of child.stdout) yield chunk;
    finished = true;
  } finally {
    // A consumer that stops early must not leave git running.
    if (!finished) child.kill();
  }
  const { error, code } = await exited;
  if (error?.name === 'AbortError') throw error;
  if (error) fail(500, `Git could not run: ${redactEmails(error.message)}`);
  if (code !== 0) fail(500, `Git operation failed: ${redactEmails(Buffer.concat(stderr).toString('utf8').trim() || `exit ${code}`)}`);
}

async function gitOutput(cwd, args, options) {
  const chunks = [];
  for await (const chunk of gitStream(cwd, args, options)) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

function withTrailers(message, trailers = {}) {
  const lines = Object.entries(trailers).map(([key, value]) => {
    if (!TRAILER_KEY.test(key) || typeof value !== 'string' || !value.trim() || /[\r\n]/.test(value)) fail(500, `Invalid commit trailer ${key}`);
    return `${key}: ${value.trim()}`;
  });
  return lines.length ? `${message}\n\n${lines.join('\n')}` : message;
}

function gitValue(cwd, key) {
  const result = git(cwd, ['config', '--get', key], { allowFailure: true });
  return result.status === 0 ? result.stdout.trim() : '';
}

function cleanText(value, field, { required = false, max = 200 } = {}) {
  if (value === undefined || value === null) {
    if (required) fail(400, `${field} is required`);
    return '';
  }
  if (typeof value !== 'string') fail(400, `${field} must be a string`);
  const text = value.trim();
  if (required && !text) fail(400, `${field} is required`);
  if (text.length > max) fail(400, `${field} must be at most ${max} characters`);
  if (text.includes('\0')) fail(400, `${field} contains an invalid character`);
  return text;
}

function cleanLine(value, field, options) {
  const text = cleanText(value, field, options);
  // U+0085, U+2028 and U+2029 end a line for JavaScript regexes too, so the
  // frontmatter would lose the value.
  if (/[\r\n\u0085\u2028\u2029]/.test(text)) fail(400, `${field} must be a single line`);
  return text;
}

function cleanDate(value) {
  const text = cleanText(value, 'dueDate', { max: 10 });
  if (!text) return '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) fail(400, 'dueDate must use YYYY-MM-DD');
  const [year, month, day] = text.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    fail(400, 'dueDate must be a real calendar date');
  }
  return text;
}

function cleanStatus(value, fallback = 'backlog') {
  const status = value === undefined ? fallback : value;
  if (typeof status !== 'string' || !STATUSES.has(status)) fail(400, 'status is invalid');
  return status;
}

function cleanPriority(value, fallback = 'medium') {
  const priority = value === undefined ? fallback : value;
  if (typeof priority !== 'string' || !PRIORITIES.has(priority)) fail(400, 'priority is invalid');
  return priority;
}

function cleanWipLimit(value, fallback = 6) {
  if (value === undefined) return fallback;
  if (!Number.isInteger(value) || value < 1 || value > 99) fail(400, 'wipLimit must be an integer from 1 to 99');
  return value;
}

function cleanColor(value, fallback = '#6366f1') {
  if (value === undefined || value === '') return fallback;
  if (typeof value !== 'string' || !/^#[0-9a-f]{6}$/i.test(value)) fail(400, 'color must be a six-digit hex color');
  return value.toLowerCase();
}

function yamlScalar(value) {
  if (value === '—') return value;
  return JSON.stringify(String(value));
}

function parseScalar(value) {
  const text = value.trim();
  if (text === '[]') return [];
  if (text === 'true') return true;
  if (text === 'false') return false;
  if (/^-?\d+$/.test(text)) return Number(text);
  if (text.startsWith('"') && text.endsWith('"')) {
    try { return JSON.parse(text); } catch { return text.slice(1, -1); }
  }
  return text;
}

function parseTaskMarkdown(content) {
  if (!content.startsWith('---\n')) fail(500, 'Task file has invalid frontmatter');
  const end = content.indexOf('\n---\n', 4);
  if (end < 0) fail(500, 'Task file has invalid frontmatter');
  const header = content.slice(4, end);
  const fields = {};
  for (const line of header.split('\n')) {
    const match = /^([A-Za-z][A-Za-z0-9_-]*):\s*(.*)$/.exec(line);
    if (match) fields[match[1]] = parseScalar(match[2]);
  }
  return { fields, body: content.slice(end + 5), header };
}

function section(body, heading) {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`(?:^|\\n)## ${escaped}\\n\\n([\\s\\S]*?)(?=\\n## |$)`).exec(body);
  return match ? match[1].trim() : '';
}

// Text that says nothing about why a task is blocked: empty, a template
// placeholder, AGE Aris's own boilerplate, or "nothing".
function informative(text) {
  const value = typeof text === 'string' ? text.trim() : '';
  if (!value || value.includes('{{') || value === DEFAULT_NEXT_DECISION) return '';
  return ['nothing', '—', '-'].includes(value.toLowerCase()) ? '' : value;
}

// Why a blocked task is blocked, and which source said so: its blockedReason,
// else the `what` of the newest `blocked` line in its checkpoint trail (JSONL
// text, committed or live as the caller decides), else the Handoff's Next
// decision line. A source that says nothing informative is skipped.
function blockedReasonOf({ blockedReason = '', trail = '', body = '' } = {}) {
  const field = informative(blockedReason);
  if (field) return { text: field, source: 'blockedReason' };
  let latest = null;
  for (const line of String(trail).split('\n')) {
    let entry;
    try { entry = JSON.parse(line); } catch { continue; }
    if (entry?.kind === 'blocked') latest = entry;
  }
  const checkpoint = informative(latest?.what);
  if (checkpoint) return { text: checkpoint, source: 'checkpoint' };
  const handoff = /(?:^|\n)## Handoff\b[^\n]*\n([\s\S]*?)(?=\n## |$)/.exec(body)?.[1] || '';
  const next = informative(/^\s*[-*]\s*\*\*Next decision:\*\*(.*)$/m.exec(handoff)?.[1]);
  if (next) return { text: next, source: 'handoff' };
  return { text: 'No reason given', source: 'none' };
}

function encodeGoal(value) {
  return value.replace(/^(\\*)## /gm, (_match, slashes) => `\\${slashes}## `);
}

function decodeGoal(value) {
  return value.replace(/^(\\+)## /gm, (_match, slashes) => `${slashes.slice(1)}## `);
}

function replaceSection(body, heading, value) {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`(^|\\n)(## ${escaped}\\n\\n)[\\s\\S]*?(?=\\n## |$)`);
  if (pattern.test(body)) return body.replace(pattern, (_match, prefix, label) => `${prefix}${label}${value.trim()}\n`);
  return `${body.trimEnd()}\n\n## ${heading}\n\n${value.trim()}\n`;
}

function updateFrontmatter(content, updates) {
  const end = content.indexOf('\n---\n', 4);
  let header = content.slice(4, end);
  for (const [key, value] of Object.entries(updates)) {
    const rendered = Array.isArray(value) ? '[]' : (key === 'status' || key === 'priority') ? String(value) : yamlScalar(value);
    const pattern = new RegExp(`^${key}:.*$`, 'm');
    if (pattern.test(header)) header = header.replace(pattern, () => `${key}: ${rendered}`);
    else header += `\n${key}: ${rendered}`;
  }
  return `---\n${header}\n---\n${content.slice(end + 5)}`;
}

function slug(text) {
  return text.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'task';
}

function hash(content) {
  return createHash('sha256').update(content).digest('hex');
}

function isWip(status) {
  return status === 'in_progress' || status === 'blocked';
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function now() {
  return new Date().toISOString();
}

function taskDirectory(projectDir, board, status) {
  if (status === 'backlog') return join(projectDir, board, 'backlog');
  if (status === 'done') return join(projectDir, board, 'tasks', 'done');
  return join(projectDir, board, 'tasks');
}

// The word a `status:` value means, read as board.sh reads it: the first
// lowercase word, so `**claimed**` is claimed and `done — out of memory` is
// done; `in progress` and `in-progress` are in_progress.
function statusWord(value) {
  const text = String(value ?? '').toLowerCase();
  if (/^[^a-z]*in[ _-]progress\b/.test(text)) return 'in_progress';
  return /[a-z]+/.exec(text)?.[0] || '';
}

// The state rule: the directory is the state, refined by the stored status.
// `directory` is the folder holding the task file: backlog, tasks, or done.
// A board made before backlog/ existed keeps unclaimed work in tasks/, marked
// `status: open`; on such a board (`backlogFolder: false`) unclaimed work in
// tasks/ is backlog. Where backlog/ exists, a task in tasks/ is in progress
// unless blocked, as board.sh reads it.
function taskState(directory, storedStatus, { backlogFolder = true } = {}) {
  const status = statusWord(storedStatus);
  if (directory === 'backlog') return 'backlog';
  if (directory === 'done') return status === 'killed' ? 'dropped' : 'done';
  if (status === 'blocked') return 'blocked';
  return !backlogFolder && UNCLAIMED.has(status) ? 'backlog' : 'in_progress';
}

// `owner:` is `<operator> @<profile>/<session> <date> — <note>`. The operator
// follows board.sh (lines 85–88): what comes before the first space that starts
// a handle, a dash or a date. One space is enough to find it and the trim takes
// the rest, so nothing backtracks on a long line. `—`, `-`, `none`, and "" mean
// no owner.
const OPERATOR_END = / (?:@|—|--|\d{4}-\d{2}-\d{2})/;
function parseOwner(raw) {
  const text = raw === undefined || raw === null ? '' : String(raw).trim();
  if (!text || text === 'none' || text.startsWith('—') || /^-+( |$)/.test(text)) return { raw: '', operator: '', profile: '', session: '' };
  const operator = text.slice(0, OPERATOR_END.exec(text)?.index ?? text.length).trim();
  const handle = /(?:^|\s)@([^\s/]+)\/(\S+)/.exec(text);
  return { raw: text, operator: operator === 'none' || operator === '-' ? '' : operator, profile: handle?.[1] || '', session: handle?.[2] || '' };
}

// The note at the end of an owner line, after its dash: what the agent last
// said it was doing ("universe built; fetch next").
function ownerNote(raw) {
  const text = String(raw ?? '').trim();
  const dash = /\s(?:—|--)/.exec(text);
  return dash ? text.slice(dash.index + dash[0].length).trim().slice(0, 400) : '';
}

// An owner line written by the UI or by startRun: bookkeeping, not ownership.
function isUiClaim(owner) {
  return owner?.profile === 'agesight' && owner?.session === 'web';
}

// "<operator> @<profile>/<session>" for an agent's claim, otherwise "".
function agentIdentity(owner) {
  return owner?.profile && !isUiClaim(owner) ? `${owner.operator} @${owner.profile}/${owner.session}` : '';
}

// A task file as the API shows it. `tolerant` reads files AGE Aris did not
// write (a tracked repository): any status word and priority are accepted,
// and a priority it does not know reads as medium, marked not given.
// The tasks a task builds on, from `depends: [T021, T022]` (or one id, or a
// comma list): their ids in the order written, without itself or repeats.
function dependsOf(value, self) {
  const text = Array.isArray(value) ? value.join(',') : String(value ?? '');
  const ids = text.match(/\bT\d{3,}\b/g) || [];
  return [...new Set(ids)].filter((id) => id !== self).slice(0, 20);
}

function taskPublic(projectId, filePath, content, { tolerant = false, backlogFolder = true } = {}) {
  const { fields, body } = parseTaskMarkdown(content);
  const id = String(fields.id || '');
  const storedStatus = statusWord(fields.status) || 'open';
  // The board has no Dropped column; a killed task sits with the done ones.
  const state = taskState(basename(dirname(filePath)), storedStatus, { backlogFolder });
  const status = state === 'dropped' ? 'done' : state;
  const filenameId = /^(T\d{3,})-/.exec(basename(filePath))?.[1];
  if (!TASK_ID.test(id) || id !== filenameId) fail(500, `Task file ${basename(filePath)} has an invalid id`);
  if (!tolerant && !STORED_STATUSES.has(storedStatus)) fail(500, `Task ${id} has an invalid status`);
  const priority = String(fields.priority || '').trim().toLowerCase();
  if (!tolerant && !PRIORITIES.has(priority || 'medium')) fail(500, `Task ${id} has an invalid priority`);
  const owner = String(fields.owner || '—');
  return {
    id: `${projectId}:${id}`,
    projectId,
    title: String(fields.title || ''),
    description: decodeGoal(section(body, 'Goal')),
    status,
    priority: PRIORITIES.has(priority) ? priority : 'medium',
    ...(tolerant ? { priorityGiven: PRIORITIES.has(priority) } : {}),
    assignee: fields.assignee === '—' ? '' : String(fields.assignee || ''),
    // Who the owner line names: operator, profile and session ('' each when
    // nobody holds it). `@agesight/web` is a claim made through AGE Aris.
    holder: (({ operator, profile, session }) => ({ operator, profile, session }))(parseOwner(owner)),
    // The agent session named by the owner line; UI claims name nobody.
    claim: agentIdentity(parseOwner(owner)),
    // What that agent last wrote about it, from the same line.
    claimNote: agentIdentity(parseOwner(owner)) ? ownerNote(owner) : '',
    dueDate: String(fields.dueDate || ''),
    type: String(fields.type ?? ''),
    blockedReason: String(fields.blockedReason ?? ''),
    // What it builds on: the threads the board is organised into.
    depends: dependsOf(fields.depends, id),
    createdAt: String(fields.createdAt || fields.created || ''),
    updatedAt: String(fields.updatedAt || fields.created || ''),
    version: hash(content),
    _filePath: filePath,
    _localId: id,
    _owner: owner,
  };
}

async function exists(path) {
  try { await access(path, fsConstants.F_OK); return true; } catch { return false; }
}

// A folder that is really there, not a symbolic link to one.
async function isRealDirectory(path) {
  try {
    const info = await lstat(path);
    return info.isDirectory() && !info.isSymbolicLink();
  } catch { return false; }
}

// A file that is really there, not a symbolic link to one.
async function isRealFile(path) {
  try { return (await lstat(path)).isFile(); } catch { return false; }
}

// A repository's board: the first of AA/, deaddrop/ and pm/ that is a real
// folder holding a real tasks/ folder and is in use — it has a STATE.md, its
// settings file or a task file. A bare tasks/ folder (a board being set up, or
// a stray mkdir) is taken only when no folder is in use, so it never outranks
// the board that is; '' when there is no tasks/ folder at all.
async function findBoard(repository) {
  let bare = '';
  for (const name of BOARDS) {
    const root = join(repository, name);
    if (!await isRealDirectory(root) || !await isRealDirectory(join(root, 'tasks'))) continue;
    if (await inUse(root, name)) return name;
    bare ||= name;
  }
  return bare;
}

async function inUse(root, board) {
  for (const name of ['STATE.md', configName(board)]) {
    if (await isRealFile(join(root, name))) return true;
  }
  for (const folder of ['tasks', 'backlog', 'tasks/done']) {
    let entries;
    try { entries = await readdir(join(root, folder), { withFileTypes: true }); } catch { continue; }
    if (entries.some((entry) => entry.isFile() && TASK_FILE.test(entry.name))) return true;
  }
  return false;
}

async function assertNotSymlink(path, allowMissing = false) {
  const absolute = resolve(path);
  const root = parse(absolute).root;
  let current = root;
  for (const part of absolute.slice(root.length).split('/').filter(Boolean)) {
    current = join(current, part);
    try {
      const stat = await lstat(current);
      if (stat.isSymbolicLink()) fail(400, 'Symbolic links are not allowed in workspace storage');
    } catch (error) {
      if (error?.code === 'ENOENT' && allowMissing) return;
      throw error;
    }
  }
}

async function snapshot(paths) {
  const result = new Map();
  for (const path of paths) {
    await assertNotSymlink(path, true);
    result.set(path, (await exists(path)) ? await readFile(path) : null);
  }
  return result;
}

async function restore(snapshotMap) {
  for (const [path, data] of snapshotMap) {
    if (data === null) await rm(path, { force: true });
    else {
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, data);
    }
  }
}

function renderTask({ localId, title, description, status, priority, assignee, dueDate, type, blockedReason, createdAt, updatedAt, owner, result = '' }) {
  return `---\nid: ${localId}\ntitle: ${yamlScalar(title)}\nstatus: ${status === 'backlog' ? 'open' : status === 'in_progress' ? 'claimed' : status}\nowner: ${yamlScalar(owner)}\npriority: ${priority}\nassignee: ${yamlScalar(assignee || '—')}\ndueDate: ${yamlScalar(dueDate)}\ntype: ${yamlScalar(type)}\nblockedReason: ${yamlScalar(blockedReason)}\ndepends: []\ncreated: ${createdAt.slice(0, 10)}\ncreatedAt: ${yamlScalar(createdAt)}\nupdatedAt: ${yamlScalar(updatedAt)}\n---\n\n# ${localId} — ${title}\n\n## Goal\n\n${encodeGoal(description || 'No description provided.')}\n\n## Context\n\nCreated and managed by AGE Aris.\n\n## Steps\n\n- [ ] Define the next concrete action.\n\n## Decision rules — fixed in advance\n\nLocal, reversible work may proceed. Stop before external, destructive, credential-gated, or irreversible actions.\n\n## Handoff — state at last stop\n\n- **Last touched:** ${today()}, ${owner}\n- **In flight:** nothing\n- **On disk:** task registered in AGE Aris\n- **Resume with:** review the task goal and choose the next action\n- **Next decision:** ${DEFAULT_NEXT_DECISION}\n\n## Verify\n\nConfirm the stated goal and acceptance conditions are satisfied.\n\n## Result\n\n${result}\n\n## Notes\n\n`;
}

// The settings file a board keeps: AA.yml in AA/, and deaddrop.yml in a
// board older than the name (deaddrop/, or pm/).
function configName(board) {
  return board === 'AA' ? 'AA.yml' : 'deaddrop.yml';
}

function renderBoardConfig(project, board) {
  return `spend:\n  []\nwip:\n  in_progress: ${project.wipLimit}\n  blocked: ${project.wipLimit}\nstale_hours: 24\nlog: ${board}/RESULTS.md\nmap: ${board}/STATE.md\nid_prefix: T\n`;
}

// What a board's settings file sets, read the way board.sh reads it (flat
// `key: value`, one level of nesting): `stale_hours`, 24 when it is unset (rule
// 4), and the in-progress and blocked WIP limits, 0 when unset or still the
// template's placeholder.
function boardPolicy(text = '') {
  const staleHours = /^stale_hours:\s*([0-9]+(?:\.[0-9]+)?)\s*(?:#.*)?$/m.exec(text)?.[1];
  const wip = /^wip:[^\n]*\n((?:[ \t]+[^\n]*(?:\n|$))*)/m.exec(text)?.[1] || '';
  const limit = /^[ \t]+in_progress:\s*(\d{1,4})\s*(?:#.*)?$/m.exec(wip)?.[1];
  const blocked = /^[ \t]+blocked:\s*(\d{1,4})\s*(?:#.*)?$/m.exec(wip)?.[1];
  return { staleHours: staleHours ? Number(staleHours) : 24, wipLimit: limit ? Number(limit) : 0, blockedLimit: blocked ? Number(blocked) : 0 };
}

// A file an agent may change while it is read: opened without following a
// symbolic link, checked on the open handle, and read up to `limit` bytes.
// Returns null when it is missing, not a regular file, or larger than `limit`.
async function readOwnFile(path, limit) {
  let handle;
  try { handle = await open(path, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW); } catch { return null; }
  try {
    const info = await handle.stat();
    if (!info.isFile() || info.size > limit) return null;
    const buffer = Buffer.alloc(Math.min(info.size, limit));
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    return buffer.subarray(0, bytesRead).toString('utf8');
  } finally { await handle.close(); }
}

const METHOD_DOC_LIMIT = 256 * 1024;
const TASK_BODY_LIMIT = 1024 * 1024;

// A board's settings file, or '' when it has none (a legacy board) or it is
// not a small regular file.
async function readBoardConfig(boardDir) {
  const path = join(boardDir, configName(basename(boardDir)));
  try {
    const info = await lstat(path);
    return info.isFile() && info.size <= 64 * 1024 ? await readFile(path, 'utf8') : '';
  } catch (error) {
    if (error?.code === 'ENOENT' || error?.code === 'ENOTDIR') return '';
    throw error;
  }
}

function readOnly(project, dir, board) {
  return `${project.name} is a tracked repository: AGE Aris changes its tasks only through task actions. Make any other change in ${join(dir, board)}, where its agents work.`;
}

// The actions an AA board takes (§4); priority and assign are not AA fields,
// and AA has no reopen.
const AA_ACTIONS = new Set(['start', 'release', 'block', 'unblock', 'done']);
const COLUMN_WORDS = { backlog: 'in the queue', in_progress: 'in progress', blocked: 'blocked', done: 'done', dropped: 'dropped' };
// Why an action does not fit a task's column on an AA board, by action and column.
const NOT_ALLOWED_HINTS = {
  start: { in_progress: 'it is already claimed.', blocked: 'it is already claimed.', done: 'it is finished.' },
  release: { backlog: 'it is not claimed.', done: 'it is finished.' },
  block: { backlog: 'claim it before blocking it.', blocked: 'it is blocked already.', done: 'it is finished.' },
  unblock: { backlog: 'it is not blocked.', in_progress: 'it is not blocked.', done: 'it is finished.' },
  done: { backlog: 'claim it before marking it done.', done: 'it is done already.' },
};

// Trail text is untrusted: one line, at most 120 characters.
function clip(value) {
  const text = String(value ?? '').replace(/[\p{Cc}\p{Zl}\p{Zp}]/gu, ' ').trim();
  return text.length > 120 ? `${text.slice(0, 119)}…` : text;
}

// What a trail line said: `doing: train fold 2`.
function wrote(entry) {
  const said = [entry.act, entry.what, entry.brief, entry.changed].find((value) => typeof value === 'string' && value.trim());
  return clip(said ? `${entry.kind}: ${said}` : entry.kind);
}

// "12 min ago", "3 h ago", "22 days ago".
function ago(ms) {
  const minutes = Math.max(0, Math.round(ms / 60_000));
  if (minutes < 60) return minutes < 1 ? 'just now' : `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} h ago`;
  return `${Math.round(hours / 24)} days ago`;
}

// A run id as it may be shown and pasted into a command: the characters
// ckpt.sh makes them from, anything else as `?`.
function runName(id) {
  return String(id).slice(0, 64).replace(/[^A-Za-z0-9._-]/g, '?');
}

// A live run, as RUN_LIVE and the drawer name it.
function runText(run, localId, at) {
  return `Run ${runName(run.id)} on ${localId} last wrote \`${wrote(run.last)}\` ${ago(at - Date.parse(run.last.ts))} and has not ended.`;
}

// The append rule 2 allows on another run's trail: the `end` that reaps it.
function reapCommand(localId, runId, operator) {
  const who = String(operator || '<operator>').replace(/["$`\\]/g, '');
  return `AA/ckpt.sh log ${localId} end --run ${runName(runId)} --changed "unknown — reaped by ${who}, process gone"`;
}

function ownerFor(operator, title) {
  return `${operator} @agesight/web ${today()} — working on ${title}`;
}

function splitTaskId(globalId) {
  if (typeof globalId !== 'string') fail(404, 'Task not found');
  const split = globalId.lastIndexOf(':');
  const projectId = globalId.slice(0, split);
  const localId = globalId.slice(split + 1);
  if (!PROJECT_ID.test(projectId) || !TASK_ID.test(localId)) fail(404, 'Task not found');
  return { projectId, localId };
}

// Ids of task files and trails ever deleted from the project's history.
function retiredTaskNumbers(dir) {
  const { stdout } = git(dir, ['log', '--no-renames', '--diff-filter=D', '--name-only', '-z', '--format=', '--', ...BOARDS]);
  return stdout.split('\0').map(path => Number(/^T(\d{3,})[-.]/.exec(basename(path.trim()))?.[1] || 0));
}

function cleanSettings(stored) {
  const settings = {
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    workdays: [1, 2, 3, 4, 5],
    personalWipLimit: 3,
    deltaFallback: 'previous-workday',
  };
  if ('timezone' in stored) {
    if (typeof stored.timezone !== 'string' || !TIME_ZONES.has(stored.timezone)) fail(500, 'settings.json: timezone must be an IANA time zone such as Europe/London');
    settings.timezone = stored.timezone;
  }
  if ('workdays' in stored) {
    const { workdays } = stored;
    if (!Array.isArray(workdays) || !workdays.length || !workdays.every(day => Number.isInteger(day) && day >= 1 && day <= 7)) {
      fail(500, 'settings.json: workdays must be a non-empty list of ISO weekdays (1 = Monday to 7 = Sunday)');
    }
    settings.workdays = [...new Set(workdays)].sort((a, b) => a - b);
  }
  if ('personalWipLimit' in stored) {
    if (!Number.isInteger(stored.personalWipLimit) || stored.personalWipLimit < 1 || stored.personalWipLimit > 99) fail(500, 'settings.json: personalWipLimit must be an integer from 1 to 99');
    settings.personalWipLimit = stored.personalWipLimit;
  }
  if ('deltaFallback' in stored) {
    if (!DELTA_FALLBACKS.has(stored.deltaFallback)) fail(500, 'settings.json: deltaFallback must be previous-workday, 24h, or 7d');
    settings.deltaFallback = stored.deltaFallback;
  }
  return settings;
}

export class Workspace {
  // `trackedWrites: false` (AGESIGHT_TRACKED_WRITES=0) turns task actions off
  // on every tracked repository, whatever each project's switch says.
  constructor({ dataDir = join(process.cwd(), '.agesight-data'), operator, email, trackedWrites = process.env.AGESIGHT_TRACKED_WRITES !== '0' } = {}) {
    if (typeof dataDir !== 'string' || !dataDir) fail(400, 'dataDir is required');
    this.dataDir = resolve(dataDir);
    this.trackedWrites = trackedWrites !== false;
    this.projectsDir = join(this.dataDir, 'projects');
    this.operator = cleanLine(operator || gitValue(process.cwd(), 'user.name') || 'AGE Aris', 'operator', { required: true, max: 100 });
    this.email = cleanLine(email || gitValue(process.cwd(), 'user.email') || 'agesight@localhost.invalid', 'email', { required: true, max: 254 });
    this._mutations = Promise.resolve();
    this._commitListeners = new Set();
    this._verifiedRepos = new Map();
  }

  // Calls `listener(projectId, { paths })` after every commit AGE Aris makes in
  // a project, with the committed paths relative to the repository (files or
  // directories), so caches derived from git history (the ledger memo) are
  // invalidated by AGE Aris's own writes without relying on file timestamps.
  // Returns a function that removes the listener.
  onCommit(listener) {
    this._commitListeners.add(listener);
    return () => this._commitListeners.delete(listener);
  }

  // The effective workspace settings: settings.json in the data directory,
  // with defaults for the file or any key that is missing. Not versioned in
  // git; `version` is the file's hash, or 'default' without a file.
  async readSettings() {
    const path = join(this.dataDir, 'settings.json');
    await assertNotSymlink(path, true);
    let raw = null;
    try { raw = await readFile(path, 'utf8'); } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
    let stored = {};
    if (raw !== null) {
      if (Buffer.byteLength(raw) > 64 * 1024) fail(500, 'settings.json is too large');
      try { stored = JSON.parse(raw); } catch { fail(500, 'settings.json is not valid JSON'); }
      if (!stored || typeof stored !== 'object' || Array.isArray(stored)) fail(500, 'settings.json must hold a JSON object');
    }
    return { ...cleanSettings(stored), version: raw === null ? 'default' : hash(raw) };
  }

  async init() {
    await assertNotSymlink(this.dataDir, true);
    await mkdir(this.projectsDir, { recursive: true });
    await assertNotSymlink(this.dataDir);
    await assertNotSymlink(this.projectsDir);
    // A task action a dead process left in flight is settled once, at start
    // (§3 Recovery). The engine repeats it before every action, so a failure
    // here is reported and waits for the next action.
    if (!this._recovered) {
      this._recovered = true;
      try {
        await (await import('./tracked.mjs')).recoverInflight(this.dataDir);
      } catch (error) {
        console.error(redactEmails(`Recovering an interrupted task action failed: ${error?.message}`));
      }
    }
    return this;
  }

  _serialize(operation) {
    const next = this._mutations.then(operation, operation);
    this._mutations = next.catch(() => {});
    return next;
  }

  _projectDir(id) {
    if (!PROJECT_ID.test(id)) fail(404, 'Project not found');
    return join(this.projectsDir, id);
  }

  // A project's metadata and where its repository is, read without running
  // git: `dir` is the repository, `board` the folder holding its tasks.
  // A tracked repository is a project folder with no .git of its own whose
  // project.json names the repository. An AGE Aris project's project.json is
  // in its own repository, where agents write, so a `repository` key there is
  // ignored: files agents write never point AGE Aris somewhere else.
  async _describe(id) {
    const folder = this._projectDir(id);
    await assertNotSymlink(folder, true);
    await assertNotSymlink(join(folder, 'project.json'), true);
    let raw;
    try { raw = await readFile(join(folder, 'project.json'), 'utf8'); }
    catch (error) {
      if (error?.code === 'ENOENT') fail(404, 'Project not found');
      throw error;
    }
    if (Buffer.byteLength(raw) > 64 * 1024) fail(500, 'Project metadata is too large');
    let stored;
    try { stored = JSON.parse(raw); } catch { fail(500, 'Project metadata is invalid'); }
    if (!stored || typeof stored !== 'object' || Array.isArray(stored)) fail(500, 'Project metadata is invalid');
    if (stored.repository === undefined || await exists(join(folder, '.git'))) {
      // A project AGE Aris made before the rename keeps its board in deaddrop/.
      return { stored, raw, folder, dir: folder, board: await findBoard(folder) || NEW_BOARD, linked: false, backlogFolder: true };
    }
    const { repository } = stored;
    if (typeof repository !== 'string' || !isAbsolute(repository) || resolve(repository) !== repository) fail(500, 'The tracked repository path is invalid');
    if (!BOARDS.includes(stored.board)) fail(500, 'The tracked repository\'s board folder is invalid');
    // Found again on every read, so a board renamed from deaddrop/ to AA/ is
    // followed; the folder recorded when it was linked is the fallback.
    const board = await findBoard(repository) || stored.board;
    const backlogFolder = await isRealDirectory(join(repository, board, 'backlog'));
    return { stored, raw, folder, dir: repository, board, linked: true, backlogFolder };
  }

  // The project, verified: { project, dir, board, linked }. A tracked
  // repository's project carries `linked: true` and the WIP limit its board's
  // settings file sets (0 when it sets none).
  async _project(id) {
    const { stored, raw, dir, board, linked, backlogFolder } = await this._describe(id);
    await this._verifyProjectRepo(dir);
    const project = { ...stored, version: hash(raw) };
    // project.json is a file on disk: a WIP limit that is not a whole number is no limit.
    if (!Number.isInteger(project.wipLimit) || project.wipLimit < 0) project.wipLimit = 0;
    if (linked) {
      Object.assign(project, { board, linked: true, wipLimit: boardPolicy(await readBoardConfig(join(dir, board))).wipLimit });
      project.actions = await this._actionsOf(id, project, dir, board);
    }
    return { project, dir, board, linked, backlogFolder };
  }

  // What a tracked repository's header and drawer say about task actions, from
  // cheap checks: { on, branch, reason } (reason is why they are off, '' when
  // on), the repository's operator while they are on, and `interrupted` while
  // an interrupted write waits for the operator.
  async _actionsOf(id, stored, dir, board) {
    const switched = stored.taskActions?.on === true && typeof stored.taskActions.branch === 'string';
    let reason = '';
    if (board !== NEW_BOARD) reason = `This board is in ${board}/, an older folder name. AGE Aris acts only on AA/ boards.`;
    else if (!this.trackedWrites) reason = 'Task actions are off for every tracked repository: AGESIGHT_TRACKED_WRITES=0.';
    else if (!switched) reason = `Task actions are off for ${stored.name}. Switch them on in the project header.`;
    const actions = { on: !reason, branch: switched ? stored.taskActions.branch.slice('refs/heads/'.length) : '', reason };
    if (actions.on) actions.operator = gitValue(dir, 'user.name');
    const marker = join(this.dataDir, 'tracked-inflight', `${id}.json`);
    let left = null;
    try { left = JSON.parse(await readOwnFile(marker, 64 * 1024) ?? 'null'); } catch { left = null; }
    if (left?.phase === 'interrupted') actions.interrupted = { message: String(left.reason || 'A task action was interrupted.'), marker };
    return actions;
  }

  // Refuses the full edit form, new tasks and project edits on a tracked
  // repository; its tasks change only through actOnTask.
  async _writable(id) {
    const location = await this._project(id);
    if (location.linked) fail(409, readOnly(location.project, location.dir, location.board));
    return location;
  }

  async _verifyProjectRepo(dir) {
    const gitDir = join(dir, '.git');
    let info;
    try { info = await lstat(gitDir); }
    catch (error) {
      if (error?.code === 'ENOENT') fail(500, 'Project git repository is missing');
      throw error;
    }
    if (!info.isDirectory() || info.isSymbolicLink()) fail(500, 'Project git repository is invalid');
    const topLevel = git(dir, ['rev-parse', '--show-toplevel']).stdout.trim();
    if (resolve(topLevel) !== resolve(dir)) fail(500, 'Project git repository root does not match its project directory');
  }

  // The repository check for read paths that must not block the event loop.
  // A repository that passed is not checked again until its .git directory
  // changes (a new inode or modification time).
  async _verifyProjectRepoAsync(dir) {
    const gitDir = join(dir, '.git');
    let info;
    try { info = await lstat(gitDir, { bigint: true }); }
    catch (error) {
      if (error?.code === 'ENOENT') fail(500, 'Project git repository is missing');
      throw error;
    }
    if (!info.isDirectory() || info.isSymbolicLink()) fail(500, 'Project git repository is invalid');
    const key = `${info.ino}:${info.mtimeNs}`;
    if (this._verifiedRepos.get(dir) === key) return;
    const topLevel = (await gitOutput(dir, ['rev-parse', '--show-toplevel'])).trim();
    if (resolve(topLevel) !== resolve(dir)) fail(500, 'Project git repository root does not match its project directory');
    this._verifiedRepos.set(dir, key);
  }

  // The project's task files. A tracked repository's board is read as found:
  // a folder it lacks (a legacy board has no backlog/) holds nothing, and a
  // file that cannot be read is skipped and reported in `problems` rather
  // than failing the whole board, since AGE Aris did not write it.
  async _tasksForProject(project, { dir = this._projectDir(project.id), board = NEW_BOARD, linked = false, backlogFolder = true } = {}, problems = []) {
    const root = join(dir, board);
    const tasks = [];
    if (linked && !(await isRealDirectory(root))) {
      if (await lstat(root).then(() => true, () => false)) problems.push({ file: board, error: 'The board folder is a symbolic link or not a folder, so it is not read' });
      return tasks;
    }
    const locations = [join(root, 'backlog'), join(root, 'tasks'), join(root, 'tasks', 'done')];
    const ids = new Set();
    for (const location of locations) {
      let entries;
      if (linked) {
        // Agents move files while AGE Aris reads: whatever vanishes midway is
        // simply not there yet.
        let info;
        try { info = await lstat(location); } catch (error) {
          if (error?.code === 'ENOENT' || error?.code === 'ENOTDIR') continue;
          throw error;
        }
        if (info.isSymbolicLink()) { problems.push({ file: location.slice(dir.length + 1), error: 'Symbolic links are not read' }); continue; }
        if (!info.isDirectory()) continue;
        try { entries = await readdir(location, { withFileTypes: true }); } catch (error) {
          if (error?.code === 'ENOENT' || error?.code === 'ENOTDIR') continue;
          throw error;
        }
      } else {
        await assertNotSymlink(location);
        entries = await readdir(location, { withFileTypes: true });
      }
      for (const entry of entries) {
        const path = join(location, entry.name);
        const file = path.slice(dir.length + 1);
        if (entry.isSymbolicLink()) {
          if (linked) { problems.push({ file, error: 'Symbolic links are not read' }); continue; }
          fail(400, 'Symbolic links are not allowed in workspace storage');
        }
        if (!entry.isFile() || !TASK_FILE.test(entry.name)) continue;
        try {
          const content = await readFile(path, 'utf8');
          if (Buffer.byteLength(content) > 256 * 1024) fail(500, `Task file ${entry.name} is too large`);
          const task = taskPublic(project.id, path, content, { tolerant: linked, backlogFolder });
          if (ids.has(task._localId)) fail(500, `Duplicate task id ${task._localId} in project ${project.name}`);
          ids.add(task._localId);
          // A tracked task names its file, which is where it is changed.
          tasks.push(linked ? { ...task, file } : task);
        } catch (error) {
          if (!linked) throw error;
          if (error?.code === 'ENOENT') continue;
          problems.push({ file, error: error instanceof WorkspaceError ? error.message : 'The file could not be read' });
        }
      }
    }
    return tasks;
  }

  async read() {
    return this._serialize(() => this._readUnlocked());
  }

  async _readUnlocked() {
    await this.init();
    const projects = [];
    const tasks = [];
    const activity = [];
    for (const entry of await readdir(this.projectsDir, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) fail(400, 'Symbolic links are not allowed in workspace storage');
      if (!entry.isDirectory() || !PROJECT_ID.test(entry.name)) continue;
      const described = await this._describe(entry.name);
      try {
        const location = await this._project(entry.name);
        const { project, dir } = location;
        const problems = [];
        const found = await this._tasksForProject(project, location, problems);
        // A tracked repository's activity is its board's; the rest is its code.
        const log = git(dir, ['log', '--format=%H%x1f%aI%x1f%an%x1f%s', '--max-count=200', ...(location.linked ? ['--', location.board] : [])]);
        tasks.push(...found);
        projects.push(location.linked ? { ...project, problems } : project);
        for (const line of log.stdout.trim().split('\n').filter(Boolean)) {
          const [commit, at, actor, message] = line.split('\x1f');
          const localId = /\b(T\d{3,})\b/.exec(message)?.[1] || '';
          let action = 'updated';
          if (/^Create project\b/.test(message)) action = 'project_created';
          else if (/^Update project\b/.test(message)) action = 'project_updated';
          else if (/^Create T\d+\b/.test(message)) action = 'task_created';
          else if (/^Update T\d+\b/.test(message)) action = 'task_updated';
          else if (/^(Run R\d+|Update pipeline)\b/.test(message)) action = 'pipeline';
          activity.push({ id: commit, projectId: project.id, taskId: localId ? `${project.id}:${localId}` : '', actor, action, message, at });
        }
      } catch (error) {
        // A tracked repository that cannot be read (moved, emptied, broken)
        // is listed as unavailable, so the rest of the workspace still loads
        // and the person can stop tracking it.
        if (!described.linked) throw error;
        projects.push({ ...described.stored, board: described.board, version: hash(described.raw), linked: true, wipLimit: 0, problems: [], unavailable: error?.message || 'The repository could not be read' });
      }
    }
    projects.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    tasks.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    activity.sort((a, b) => b.at.localeCompare(a.at));
    return {
      projects,
      tasks: tasks.map(({ _filePath, _localId, _owner, ...task }) => task),
      activity,
      operator: this.operator,
    };
  }

  // One task. `body: true` adds the Markdown below its frontmatter, the task
  // as written, for the task drawer.
  async getTask(globalId, { body = false } = {}) {
    return this._serialize(async () => {
      const { projectId, localId } = splitTaskId(globalId);
      const location = await this._project(projectId);
      const task = (await this._tasksForProject(location.project, location)).find((entry) => entry._localId === localId);
      if (!task) fail(404, 'Task not found');
      const { _filePath, _owner, _localId, ...rest } = task;
      if (!body) return rest;
      // Moved, replaced by a link, or grown past the limit since it was
      // listed: the drawer shows no text.
      const content = await readOwnFile(_filePath, TASK_BODY_LIMIT);
      let text = '';
      if (content !== null) try { text = parseTaskMarkdown(content).body; } catch { text = ''; }
      if (!location.linked) return { ...rest, body: text };
      // What a task action would meet: a Result still to be written, and a
      // run on its trail that is live (which refuses every action).
      const { resultSection } = await import('./tracked.mjs');
      const { staleHours } = boardPolicy(await readBoardConfig(join(location.dir, location.board)));
      const live = (await this._trail(location, localId, staleHours)).runs.find((run) => run.live);
      return { ...rest, body: text, resultPending: resultSection(text).placeholder, liveRun: live ? { id: live.id, text: runText(live, localId, Date.now()) } : null };
    });
  }

  // A task's checkpoint trail, as readTrail reads it; none when the board's
  // checkpoints/ is not a real folder. A trail that cannot be read at all (a
  // symbolic link, not a regular file) is `unreadable`, so actions ask for a
  // confirmation instead of failing.
  async _trail({ dir, board }, localId, staleHours) {
    const { readTrail } = await import('./tracked.mjs');
    const folder = join(dir, board, 'checkpoints');
    if (!await isRealDirectory(folder)) return { runs: [], malformed: [] };
    try {
      return await readTrail(join(folder, `${localId}.jsonl`), { staleHours, now: Date.now() });
    } catch {
      return { runs: [], malformed: [], unreadable: true };
    }
  }

  // A project's written method: the policy its board's settings file sets and
  // the board's own documents (WORKFLOW.md, RULES.md, …), read-only.
  async methodOf(id) {
    return this._serialize(async () => {
      const { project, dir, board, linked } = await this._project(id);
      const root = join(dir, board);
      const policy = boardPolicy(await readBoardConfig(root));
      const docs = [];
      if (await isRealDirectory(root)) {
        for (const name of METHOD_DOCS) {
          const text = await readOwnFile(join(root, name), METHOD_DOC_LIMIT);
          if (text !== null) docs.push({ name, path: `${board}/${name}`, text });
        }
      }
      return {
        projectId: id, linked, board, config: `${board}/${configName(board)}`,
        staleHours: policy.staleHours ?? 24,
        wipLimit: linked ? policy.wipLimit : (Number.isInteger(project.wipLimit) ? project.wipLimit : 0),
        docs,
      };
    });
  }

  async createProject(input = {}, { trailers } = {}) {
    return this._serialize(async () => {
      const name = cleanLine(input.name, 'name', { required: true, max: 100 });
      const project = {
        id: randomUUID(),
        name,
        description: cleanText(input.description, 'description', { max: 5000 }),
        color: cleanColor(input.color),
        createdAt: now(),
        wipLimit: cleanWipLimit(input.wipLimit),
      };
      const dir = this._projectDir(project.id);
      const boardDir = join(dir, NEW_BOARD);
      try {
        await mkdir(join(boardDir, 'backlog'), { recursive: true });
        await mkdir(join(boardDir, 'tasks', 'done'), { recursive: true });
        await mkdir(join(boardDir, 'checkpoints'), { recursive: true });
        await mkdir(join(boardDir, 'templates'), { recursive: true });
        await Promise.all([
          cp(join(TEMPLATE_ROOT, 'RULES.md'), join(boardDir, 'RULES.md')),
          cp(join(TEMPLATE_ROOT, 'WHY.md'), join(boardDir, 'WHY.md')),
          cp(join(TEMPLATE_ROOT, 'TASK.md'), join(boardDir, 'templates', 'TASK.md')),
          cp(join(TEMPLATE_ROOT, 'SCHEMA.md'), join(boardDir, 'checkpoints', '_SCHEMA.md')),
        ]);
        const projectRaw = `${JSON.stringify(project, null, 2)}\n`;
        await writeFile(join(dir, 'project.json'), projectRaw);
        await writeFile(join(boardDir, configName(NEW_BOARD)), renderBoardConfig(project, NEW_BOARD));
        await writeFile(join(boardDir, 'STATE.md'), this._renderState(project, [], '', NEW_BOARD));
        git(dir, ['init', '--quiet']);
        git(dir, ['config', 'user.name', this.operator]);
        git(dir, ['config', 'user.email', this.email]);
        await this._verifyProjectRepo(dir);
        this._commit(dir, [join(dir, 'project.json'), boardDir], `Create project: ${name}`, trailers);
        return { ...project, version: hash(projectRaw) };
      } catch (error) {
        await rm(dir, { recursive: true, force: true });
        throw error;
      }
    });
  }

  // The sample project (lib/sample.mjs): a project like any other, whose six
  // weeks of history are simulated up to `now`, marked `sample: true`.
  async createSampleProject({ now = Date.now(), trailers } = {}) {
    // Imported here: the fabricator itself imports this module.
    const { fabricate } = await import('./fabricate.mjs');
    const { sampleScript, sampleStart, SAMPLE_DESCRIPTION, SAMPLE_NAME } = await import('./sample.mjs');
    return this._serialize(async () => {
      const nowMs = typeof now === 'number' ? now : Date.parse(now);
      if (!Number.isFinite(nowMs)) fail(400, 'now must be a time');
      const project = {
        id: randomUUID(), name: SAMPLE_NAME, description: SAMPLE_DESCRIPTION, color: cleanColor(undefined),
        createdAt: new Date(sampleStart(nowMs)).toISOString(), wipLimit: 8, sample: true,
      };
      const dir = this._projectDir(project.id);
      const template = async (name) => readFile(join(TEMPLATE_ROOT, name), 'utf8');
      const files = {
        'AA/RULES.md': await template('RULES.md'),
        'AA/WHY.md': await template('WHY.md'),
        'AA/templates/TASK.md': await template('TASK.md'),
        'AA/checkpoints/_SCHEMA.md': await template('SCHEMA.md'),
        'AA/AA.yml': renderBoardConfig(project, 'AA'),
      };
      try {
        const { epoch, script } = sampleScript({ project, now: nowMs, operator: this.operator, files });
        const fabrication = await fabricate(dir, script, { operator: this.operator, email: this.email, epoch });
        git(dir, ['config', 'user.name', this.operator]);
        git(dir, ['config', 'user.email', this.email]);
        await this._verifyProjectRepo(dir);
        // The board, rendered from the simulated tasks, in the last simulated commit.
        const { project: stored, board } = await this._project(project.id);
        const state = this._renderState(stored, await this._tasksForProject(stored, { board }), '', board);
        const last = new Date(nowMs - 60 * 1000).toISOString().replace(/\.\d{3}Z$/, 'Z');
        await fabrication.run(`${last} ${this.operator}: write ${board}/STATE.md ${JSON.stringify(state)} subject="Update board"${trailers?.['AGESight-Via'] ? ' via=ui' : ''}`);
        return stored;
      } catch (error) {
        await rm(dir, { recursive: true, force: true });
        throw error;
      }
    });
  }

  // Tracks an existing git repository that keeps an AA/ (or deaddrop/ or pm/) task
  // board: its tasks and history appear like a project's. Only project.json in
  // a new project folder is written; nothing in the repository. Task actions
  // stay off until the operator switches them on (updateProject).
  async linkProject(input = {}) {
    return this._serialize(async () => {
      const given = cleanLine(input.path, 'path', { required: true, max: 4096 });
      if (!isAbsolute(given)) fail(400, 'Give the repository folder\'s full path, such as /home/you/code/project');
      let repository;
      try { repository = await realpath(given); } catch { fail(400, `There is no folder at ${given}`); }
      if (!(await lstat(repository)).isDirectory()) fail(400, `${given} is not a folder`);
      if (repository === this.dataDir || repository.startsWith(`${this.dataDir}${sep}`)) fail(400, 'That folder is inside AGE Aris\'s own data folder');
      // AGE Aris writes its data folder; inside the repository, the agents'
      // commits would pick those files up.
      const dataDir = await realpath(this.dataDir).catch(() => this.dataDir);
      if (dataDir === repository || dataDir.startsWith(`${repository}${sep}`)) fail(400, `AGE Aris's data folder (${dataDir}) is inside that repository, so its files would land in the repository's commits. Start AGE Aris with AGESIGHT_DATA_DIR outside it first.`);
      const gitDir = await lstat(join(repository, '.git')).catch(() => null);
      if (!gitDir) {
        const inside = git(repository, ['rev-parse', '--show-toplevel'], { allowFailure: true });
        if (inside.status === 0) fail(400, `${repository} is inside the repository at ${inside.stdout.trim()}; give that folder instead`);
        fail(400, `${repository} is not a git repository`);
      }
      if (!gitDir.isDirectory()) fail(400, `${repository}/.git is not a folder: worktrees and submodules cannot be tracked yet`);
      await this._verifyProjectRepo(repository);
      if (git(repository, ['rev-parse', '--verify', '--quiet', 'HEAD^{commit}'], { allowFailure: true }).status !== 0) fail(400, `${repository} has no commits yet; AGE Aris reads a board's history from its commits`);
      // A partial clone would have to fetch the files it lacks to be read.
      if (git(repository, ['config', '--get', 'extensions.partialClone'], { allowFailure: true }).stdout.trim()) fail(400, `${repository} is a partial clone; AGE Aris reads every version of the board's files, so it needs a full clone`);
      const board = await findBoard(repository);
      if (!board) fail(400, `${repository} has no task board: AGE Aris reads AA/tasks/ (or deaddrop/tasks/ or pm/tasks/, its older names), and not through a symbolic link`);
      for (const entry of await readdir(this.projectsDir, { withFileTypes: true })) {
        if (!entry.isDirectory() || !PROJECT_ID.test(entry.name)) continue;
        const other = await this._describe(entry.name).catch(() => null);
        if (other?.linked && other.dir === repository) fail(409, `${repository} is already tracked as ${other.stored.name}`);
      }
      const project = {
        id: randomUUID(),
        name: cleanLine(input.name, 'name', { max: 100 }) || basename(repository),
        description: cleanText(input.description, 'description', { max: 5000 }),
        color: cleanColor(input.color),
        createdAt: now(),
        repository,
        board,
      };
      const raw = `${JSON.stringify(project, null, 2)}\n`;
      // Written aside and renamed into place, so a reader never meets a project
      // folder without its project.json.
      const staging = join(this.projectsDir, `.link-${project.id}`);
      try {
        await mkdir(staging);
        await writeFile(join(staging, 'project.json'), raw, { flag: 'wx' });
        await rename(staging, this._projectDir(project.id));
      } catch (error) {
        await rm(staging, { recursive: true, force: true });
        throw error;
      }
      return (await this._project(project.id)).project;
    });
  }

  // Stops tracking a repository: removes AGE Aris's project folder for it,
  // which holds only project.json. The repository is not touched.
  async unlinkProject(id) {
    return this._serialize(async () => {
      const { folder, linked, stored } = await this._describe(id);
      if (!linked) fail(409, `${stored.name} is an AGE Aris project; only a tracked repository can be removed`);
      await rm(folder, { recursive: true, force: true });
      return { id, name: stored.name };
    });
  }

  async updateProject(id, input = {}, { trailers } = {}) {
    return this._serialize(async () => {
      const location = await this._project(id);
      if (location.linked) return this._switchTaskActions(id, location, input);
      const { project, dir, board } = location;
      if (typeof input.version !== 'string' || !input.version) fail(400, 'version is required');
      if (input.version !== project.version) fail(409, 'Project has changed; refresh and try again');
      const { version, ...storedProject } = project;
      const next = { ...storedProject };
      if ('name' in input) next.name = cleanLine(input.name, 'name', { required: true, max: 100 });
      if ('description' in input) next.description = cleanText(input.description, 'description', { max: 5000 });
      if ('color' in input) next.color = cleanColor(input.color);
      if ('wipLimit' in input) {
        next.wipLimit = cleanWipLimit(input.wipLimit);
        const active = (await this._tasksForProject(project, { dir, board })).filter(task => isWip(task.status)).length;
        if (active > next.wipLimit) fail(409, `WIP limit ${next.wipLimit} is below the current WIP of ${active}`);
      }
      if (JSON.stringify(next) === JSON.stringify(storedProject)) return project;
      const paths = [join(dir, 'project.json'), join(dir, board, configName(board)), join(dir, board, 'STATE.md')];
      const before = await snapshot(paths);
      try {
        const nextRaw = `${JSON.stringify(next, null, 2)}\n`;
        await writeFile(paths[0], nextRaw);
        await writeFile(paths[1], renderBoardConfig(next, board));
        await writeFile(paths[2], this._renderState(next, await this._tasksForProject(next, { dir, board }), before.get(paths[2])?.toString('utf8'), board));
        this._commit(dir, paths, `Update project: ${next.name}`, trailers);
        return { ...next, version: hash(nextRaw) };
      } catch (error) {
        await restore(before);
        this._resetPaths(dir, paths);
        throw error;
      }
    });
  }

  // The switch for task actions on a tracked repository, the one change its
  // project takes. Switching on probes the repository (§1 C) and first answers
  // CONFIRM with what it means here: the branch it pins, the identity, the
  // hooks it skips, other worktrees, and STATE.md. The same request with that
  // `confirm` token pins the branch. Switching off clears it. Only project.json
  // in the data folder is written.
  async _switchTaskActions(id, { project, dir, board }, input) {
    if (!('taskActions' in input) || Object.keys(input).some((key) => !['version', 'taskActions', 'confirm'].includes(key))) fail(409, readOnly(project, dir, board));
    if (typeof input.version !== 'string' || !input.version) refuse('BAD_INPUT', 'version is required');
    if (input.version !== project.version) refuse('STALE', 'Project has changed; refresh and try again', 'Refresh, then try again.');
    const on = input.taskActions?.on;
    if (typeof on !== 'boolean') refuse('BAD_INPUT', 'taskActions.on must be true or false');
    const { stored, folder } = await this._describe(id);
    const next = { ...stored };
    delete next.taskActions;
    if (on) {
      if (!this.trackedWrites) refuse('ACTIONS_OFF', 'Task actions are off for every tracked repository: AGESIGHT_TRACKED_WRITES=0.', 'Start AGE Aris without AGESIGHT_TRACKED_WRITES=0 to use them.');
      if (board !== NEW_BOARD) refuse('LEGACY_BOARD', `This board is in ${board}/, an older folder name. AGE Aris acts only on AA/ boards.`, `Rename ${board}/ to AA/ in ${project.name} first.`);
      const { probeRepository } = await import('./tracked.mjs');
      const probe = await probeRepository(dir, { board });
      const operator = gitValue(dir, 'user.name');
      if (!operator) refuse('NO_IDENTITY', `Set git user.name in ${project.name}; AGE Aris commits as you.`, `git -C ${dir} config user.name "Your Name"`);
      const branch = probe.branch.slice('refs/heads/'.length);
      const hooks = [...probe.hooks, ...(probe.hooksPath ? [`core.hooksPath ${probe.hooksPath}`] : [])];
      const worktrees = probe.worktrees.map((path) => (path.startsWith(`${dir}${sep}`) ? relative(dir, path) : path));
      const reasons = [
        { kind: 'branch', text: `Each action is one commit to ${branch}, the branch checked out now. While another branch is checked out, actions are refused.` },
        { kind: 'identity', text: `Commits are authored as ${operator}, this repository's git identity, and are not pushed.` },
        { kind: 'hooks', text: `Commits made here skip this repository's hooks${hooks.length ? ` (${hooks.join(', ')})` : ''}, filters and signing.` },
        ...(worktrees.length ? [{ kind: 'worktrees', text: `Agents in ${worktrees.length === 1 ? '1 other worktree' : `${worktrees.length} other worktrees`} (${worktrees.join(', ')}) will not see these commits until they merge.` }] : []),
        { kind: 'state', text: await isRealFile(join(dir, board, 'board.sh')) ? `${board}/STATE.md is not regenerated: run ${board}/board.sh --write after acting.` : `${board}/STATE.md is kept by hand here: AGE Aris leaves it alone, and each commit names the board line that is behind.` },
      ];
      const confirmToken = hash(JSON.stringify({ reasons, version: project.version })).slice(0, 32);
      if (input.confirm !== confirmToken) refuse('CONFIRM', `Switch task actions on for ${project.name}?`, 'Confirm to switch them on.', { reasons, confirmToken, branch });
      next.taskActions = { on: true, branch: probe.branch, since: now() };
    }
    // Written aside and renamed into place, as linkProject writes it.
    const temporary = join(folder, `.project-${randomUUID()}.json`);
    try {
      await writeFile(temporary, `${JSON.stringify(next, null, 2)}\n`, { flag: 'wx' });
      await rename(temporary, join(folder, 'project.json'));
    } finally {
      await rm(temporary, { force: true });
    }
    return (await this._project(id)).project;
  }

  // One task action (§4). `action` is claim (or start), release, block,
  // unblock or done; an AGE Aris project also takes reopen, priority and
  // assign. With it: the task's `version`, a `reason` (block, required on an
  // AA board), a `result` (done, while the Result is a placeholder), a `value`
  // (priority, assign), and the `confirm` token a CONFIRM refusal handed out.
  // An AGE Aris project's task changes through updateTask, as PATCH changes
  // it; a tracked AA board's is one commit through tracked.mjs. Returns
  // { task, warnings }, and on a tracked board { commit, branch } too.
  async actOnTask(globalId, input = {}, { trailers } = {}) {
    return this._serialize(async () => {
      const { projectId, localId } = splitTaskId(globalId);
      const action = TASK_ACTIONS.find((entry) => entry.id === (input.action === 'claim' ? 'start' : input.action));
      if (typeof input.action !== 'string' || !action) refuse('BAD_INPUT', 'action must be claim, release, block, unblock or done; an AGE Aris project also takes reopen, priority and assign');
      const location = await this._project(projectId);
      if (!location.linked) return this._actOnOwnTask(globalId, location, localId, action, input, trailers);
      try {
        return await this._actOnTrackedTask(location, localId, action, input, trailers);
      } catch (error) {
        // What the server's one-line record of a refused or failed action names.
        if (error && typeof error === 'object') error.tracked = { project: location.project.name, task: localId, action: input.action };
        throw error;
      }
    });
  }

  async _actOnOwnTask(globalId, location, localId, action, input, trailers) {
    const current = (await this._tasksForProject(location.project, location)).find((task) => task._localId === localId);
    if (!current) refuse('NOT_FOUND', 'Task not found');
    if (action.from && !action.from.includes(current.status)) refuse('NOT_ALLOWED', `${localId} is ${COLUMN_WORDS[current.status]}: ${action.label} does not apply.`);
    let change;
    if (action.to) change = { status: action.to, ...(action.id === 'block' ? { blockedReason: input.reason ?? '' } : {}) };
    else if (action.id === 'priority' && typeof input.value !== 'string') refuse('BAD_INPUT', 'Choose low, medium, high or urgent.', '', { field: 'value' });
    else change = { [action.field]: input.value ?? '' };
    return { task: await this._updateTaskUnlocked(globalId, { ...change, version: input.version }, { trailers }), warnings: [] };
  }

  // §4 on a tracked AA board, in either layout. Every check that decides the
  // outcome runs again under git's index lock, against HEAD as it is then:
  // the duplicate id, the holder, the runs, the confirmation, the column, the
  // WIP limit and the version, and last any bad input.
  async _actOnTrackedTask(location, localId, action, input, trailers) {
    const { project, dir, board, backlogFolder } = location;
    if (!this.trackedWrites) refuse('ACTIONS_OFF', `Task actions are off for ${project.name}: AGESIGHT_TRACKED_WRITES=0.`, 'Start AGE Aris without AGESIGHT_TRACKED_WRITES=0 to use them.');
    if (board !== NEW_BOARD) refuse('LEGACY_BOARD', `This board is in ${board}/, an older folder name. AGE Aris acts only on AA/ boards.`, `Rename ${board}/ to AA/ in ${project.name} first.`);
    if (project.taskActions?.on !== true || typeof project.taskActions.branch !== 'string') refuse('ACTIONS_OFF', `Task actions are off for ${project.name}. Switch them on in the project header.`, 'Switch task actions on in the project header.');
    if (!AA_ACTIONS.has(action.id)) refuse('NOT_ALLOWED', action.capability ? `${action.label}: ${WHY[action.capability]}.` : `${action.label} is not an AA action.`);
    if (typeof input.version !== 'string' || !input.version) refuse('BAD_INPUT', 'version is required', '', { field: 'version' });
    const problems = [];
    const task = (await this._tasksForProject(project, location, problems)).find((entry) => entry._localId === localId);
    if (!task) refuse('NOT_FOUND', 'Task not found');
    const name = basename(task._filePath);
    const from = task.file;
    const folder = { start: backlogFolder ? 'tasks' : '', release: backlogFolder ? 'backlog' : '', done: 'tasks/done' }[action.id];
    const to = folder ? `${board}/${folder}/${name}` : from;
    const operator = gitValue(dir, 'user.name');
    const policy = boardPolicy(await readBoardConfig(join(dir, board)));
    const tracked = await import('./tracked.mjs');

    // The new file, from the one on disk (the engine refuses unless it is the
    // one in HEAD and the index). Bad input is held back and refused last.
    const bytes = await readFile(task._filePath);
    const text = bytes.toString('utf8');
    let content = bytes;
    let words = '';
    let badInput = null;
    const single = (value, field, max) => {
      try { return cleanLine(value, field, { required: true, max }); } catch (error) { return refuse('BAD_INPUT', error.message, '', { field }); }
    };
    if (operator) {
      try {
        if (!Buffer.from(text, 'utf8').equals(bytes)) refuse('BAD_INPUT', `${name} is not UTF-8 text.`);
        const end = text.indexOf('\n---\n', 4) + 5;
        let body = text.slice(end);
        let updates;
        if (action.id === 'start') {
          words = input.reason === undefined || input.reason === '' ? `working on ${task.title}` : single(input.reason, 'reason', 120);
          updates = { status: 'claimed', owner: tracked.ownerLine(operator, words) };
        } else if (action.id === 'release') {
          // The old owner line stays readable after the release, without the
          // characters an owner line must not carry.
          const was = parseOwner(task._owner).raw.replace(/[#"'`\r\n\u0085\u2028\u2029\0]/g, '').slice(0, 200).trim();
          updates = { status: 'open', owner: `— (released ${today()}${was ? `; was ${was}` : ''})`, blockedReason: '' };
        } else if (action.id === 'block') {
          words = single(input.reason, 'reason', 200);
          updates = { status: 'blocked', blockedReason: words };
        } else if (action.id === 'unblock') {
          updates = { status: 'claimed', blockedReason: '' };
        } else {
          words = task.title;
          if (tracked.resultSection(body).placeholder) {
            if (input.result === undefined || input.result === '') refuse('BAD_INPUT', `${localId}'s Result is still a placeholder: write one line saying what came of it.`, '', { field: 'result' });
            words = single(input.result, 'result', 200);
            body = tracked.setResult(body, words);
          }
          updates = { status: 'done', blockedReason: '' };
        }
        content = tracked.editFrontmatter(text.slice(0, end) + body, updates);
      } catch (error) {
        if (error?.code !== 'BAD_INPUT') throw error;
        badInput = error;
      }
    }
    const subject = badInput || !operator ? `${localId}` : tracked.commitSubject(action.id === 'start' ? 'claim' : action.id, localId, words || localId);
    const stateLine = await isRealFile(join(dir, board, 'board.sh'))
      ? `${board}/STATE.md was not regenerated: run ${board}/board.sh --write.`
      : `${board}/STATE.md is kept by hand: ${localId}'s board line still says its old status.`;
    const message = withTrailers(`${subject}\n\nMade in AGE Aris by ${operator}.\n${stateLine}`, trailers);
    // Only an own agent's claim shows its last sign of life, so only then is
    // the history walked.
    const holding = parseOwner(task._owner);
    const lastCommit = holding.operator && !isUiClaim(holding) ? this._lastSignInGit(dir, board, name) : 0;

    let trail = { runs: [], malformed: [] };
    const check = async (head) => {
      const listed = [];
      for (const part of ['backlog', 'tasks', 'tasks/done']) listed.push(...await head.list(`${board}/${part}`));
      const copies = listed.filter((entry) => TASK_FILE.test(entry) && entry.startsWith(`${localId}-`)).length;
      if (copies > 1 || problems.some((problem) => basename(problem.file).startsWith(`${localId}-`))) {
        refuse('DUPLICATE_ID', `Two files claim ${localId}. Resolve the duplicate first.`, `Keep one ${localId} file in ${board}/ and commit it.`);
      }
      let fields;
      try { fields = parseTaskMarkdown(head.content).fields; } catch { refuse('DIRTY_FILE', `${name} has uncommitted changes in ${dir}.`, 'Commit or discard them, then try again.'); }
      const owner = parseOwner(fields.owner);
      if (owner.operator && owner.operator !== operator) refuse('HELD_BY_OTHER', `${localId} is claimed by ${owner.operator}. AA rule 2: only its owner changes it.`, 'Ask them to release it.');
      trail = await this._trail(location, localId, policy.staleHours);
      const at = Date.now();
      const live = trail.runs.find((run) => run.live);
      if (live) {
        refuse('RUN_LIVE', runText(live, localId, at), `Wait for it to end, or stop it from its session. If that session is gone (the same operator takes a claim back without waiting, rule 3): ${reapCommand(localId, live.id, operator)}, then try again.`);
      }
      const reasons = [];
      if (owner.operator && !isUiClaim(owner)) {
        const newest = Math.max(lastCommit, ...trail.runs.map((run) => Date.parse(run.last.ts)));
        const session = owner.profile ? `Your agent session @${owner.profile}/${owner.session}` : `Your claim, which names no session,`;
        reasons.push({ kind: 'agent', key: `agent ${owner.raw}`, text: `${session} holds ${localId}; last sign of life ${newest > 0 ? ago(at - newest) : 'unknown'}. Act as the same operator?` });
      }
      for (const run of trail.runs.filter((entry) => !entry.ended)) {
        const next = typeof run.last.next === 'string' && run.last.next ? ` (next: \`${clip(run.last.next)}\`)` : '';
        reasons.push({ kind: 'run', key: `run ${run.id} ${run.last.ts}`, text: `Run ${runName(run.id)} on ${localId} last wrote \`${wrote(run.last)}\`${next} ${ago(at - Date.parse(run.last.ts))} and never ended.` });
      }
      for (const line of trail.malformed) reasons.push({ kind: 'malformed', key: `line ${line}`, text: `Line ${line} of ${board}/checkpoints/${localId}.jsonl cannot be read.` });
      if (trail.unreadable) reasons.push({ kind: 'malformed', key: 'unreadable', text: `${board}/checkpoints/${localId}.jsonl cannot be read: it is not a regular file, so whether a run on ${localId} is live is unknown.` });
      const confirmToken = hash(JSON.stringify({ action: action.id, reasons: reasons.map((reason) => reason.key), version: input.version })).slice(0, 32);
      if (reasons.length && input.confirm !== confirmToken) {
        refuse('CONFIRM', `${localId} needs a confirmation first.`, 'Confirm to go ahead.', { reasons: reasons.map(({ kind, text: said }) => ({ kind, text: said })), confirmToken });
      }
      const column = taskState(basename(dirname(from)), statusWord(fields.status) || 'open', { backlogFolder });
      if (!columnsFor(action, 'aa').includes(column)) refuse('NOT_ALLOWED', `${localId} is ${COLUMN_WORDS[column]}: ${NOT_ALLOWED_HINTS[action.id]?.[column] || `${labelFor(action, 'aa')} does not apply.`}`, 'Refresh to see what it allows now.');
      if (action.id === 'start') {
        const limit = boardPolicy(await head.read(`${board}/${configName(board)}`) ?? '').wipLimit;
        if (limit) {
          let count = 0;
          for (const entry of await head.list(`${board}/tasks`)) {
            if (!TASK_FILE.test(entry)) continue;
            if (backlogFolder) { count += 1; continue; }
            let status = '';
            try { status = statusWord(parseTaskMarkdown(await head.read(`${board}/tasks/${entry}`) ?? '').fields.status); } catch { status = ''; }
            if (!UNCLAIMED.has(status)) count += 1;
          }
          if (count >= limit) refuse('WIP_LIMIT', `WIP is ${count} of ${limit}. Finish or release something before claiming (rule 10).`, 'Finish or release a task, then claim this one.');
        }
      }
      if (hash(head.content) !== input.version) refuse('STALE', `${localId} changed while you acted. It has been refreshed; nothing was changed.`, 'Look at it again, then try again.');
      // The change was built from the working tree's file, read before the
      // lock; it must be HEAD's bytes, or an edit discarded since would be
      // committed with it.
      if (head.content !== text) refuse('DIRTY_FILE', `${name} has uncommitted changes in ${dir}.`, 'Commit or discard them, then try again.');
      if (badInput) throw badInput;
    };
    const result = await tracked.commitTaskChange(dir, { from, to, content, message, branch: project.taskActions.branch, check, dataDir: this.dataDir, projectId: project.id });
    this._announce(project.id, [...new Set([from, to])]);

    const warnings = [...result.warnings];
    for (const run of trail.runs.filter((entry) => !entry.ended)) {
      warnings.push({ code: 'RUN_NOT_ENDED', message: `Run ${runName(run.id)} on ${localId} has not ended.`, remedy: reapCommand(localId, run.id, operator) });
    }
    for (const line of trail.malformed) warnings.push({ code: 'RUN_NOT_ENDED', message: `Line ${line} of ${localId}'s trail cannot be read.`, remedy: `AA/ckpt.sh check ${localId}` });
    if (trail.unreadable) warnings.push({ code: 'RUN_NOT_ENDED', message: `${localId}'s trail is not a regular file and was not read.`, remedy: `Replace ${board}/checkpoints/${localId}.jsonl with the file itself, then run AA/ckpt.sh check ${localId}` });
    if (action.id === 'done' && trail.runs.length && trail.runs.every((run) => run.ended)) {
      warnings.push({ code: 'TRAIL_NOT_RETIRED', message: `${localId}'s checkpoint trail is still in ${board}/checkpoints/.`, remedy: `run AA/ckpt.sh close ${localId} --delete` });
    }
    if (action.id === 'block' && policy.blockedLimit) {
      const blocked = (await this._tasksForProject(project, location)).filter((entry) => entry.status === 'blocked').length;
      if (blocked > policy.blockedLimit) warnings.push({ code: 'BLOCKED_OVER_LIMIT', message: `${blocked} blocked against a limit of ${policy.blockedLimit}: a blocker nobody is clearing is the flow problem.`, remedy: 'Clear a blocker before blocking more.' });
    }
    const fresh = (await this._tasksForProject(project, location)).find((entry) => entry._localId === localId);
    const { _filePath, _localId, _owner, ...shown } = fresh || task;
    return { task: shown, commit: result.commit, branch: result.branch.slice('refs/heads/'.length), warnings };
  }

  // When anyone but AGE Aris last committed a change to this task file (rule
  // 4's fallback sign of life), in ms; 0 when git has none.
  _lastSignInGit(dir, board, name) {
    const log = git(dir, ['log', '-n', '50', '--format=%cI%x1f%(trailers:key=AGESight-Via,valueonly,separator=%x20)%x1e', '--', ...['backlog', 'tasks', 'tasks/done'].map((part) => `${board}/${part}/${name}`)], { allowFailure: true });
    for (const record of log.stdout.split('\x1e')) {
      const [at, via = ''] = record.trim().split('\x1f');
      if (at && !via.trim()) return Date.parse(at) || 0;
    }
    return 0;
  }

  async createTask(input = {}, { trailers } = {}) {
    return this._serialize(async () => {
      const projectId = cleanLine(input.projectId, 'projectId', { required: true, max: 36 });
      const { project, dir, board } = await this._writable(projectId);
      const existing = await this._tasksForProject(project, { dir, board });
      const status = cleanStatus(input.status);
      if (isWip(status) && existing.filter(task => isWip(task.status)).length >= project.wipLimit) {
        fail(409, `WIP limit of ${project.wipLimit} has been reached`);
      }
      // Ids are never reused: a deleted task's id stays taken, so its history
      // and trail are never mixed with a new task's.
      const highest = [...existing.map(task => Number(TASK_ID.exec(task._localId)?.[1] || 0)), ...retiredTaskNumbers(dir)]
        .reduce((max, number) => Math.max(max, number), 0);
      const localId = `T${String(highest + 1).padStart(3, '0')}`;
      const title = cleanLine(input.title, 'title', { required: true, max: 200 });
      const createdAt = now();
      const owner = isWip(status) ? ownerFor(this.operator, title) : '—';
      const content = renderTask({
        localId,
        title,
        description: cleanText(input.description, 'description', { max: 20000 }),
        status,
        priority: cleanPriority(input.priority),
        assignee: cleanLine(input.assignee, 'assignee', { max: 100 }),
        dueDate: cleanDate(input.dueDate),
        type: cleanLine(input.type, 'type', { max: 40 }),
        blockedReason: status === 'blocked' ? cleanLine(input.blockedReason, 'blockedReason', { max: 200 }) : '',
        createdAt,
        updatedAt: createdAt,
        owner,
        result: status === 'done' ? `Completed through AGE Aris on ${today()}.` : '',
      });
      const path = join(taskDirectory(dir, board, status), `${localId}-${slug(title)}.md`);
      const statePath = join(dir, board, 'STATE.md');
      const before = await snapshot([path, statePath]);
      try {
        await writeFile(path, content, { flag: 'wx' });
        const current = [...existing, taskPublic(project.id, path, content)];
        await writeFile(statePath, this._renderState(project, current, before.get(statePath)?.toString('utf8'), board));
        this._commit(dir, [path, statePath], `Create ${localId}: ${title}`, trailers);
        const { _filePath, _localId, _owner, ...task } = taskPublic(project.id, path, content);
        return task;
      } catch (error) {
        await restore(before);
        this._resetPaths(dir, [path, statePath]);
        throw error;
      }
    });
  }

  async updateTask(globalId, input = {}, { trailers } = {}) {
    return this._serialize(() => this._updateTaskUnlocked(globalId, input, { trailers }));
  }

  async _updateTaskUnlocked(globalId, input = {}, { trailers } = {}) {
    const { projectId, localId } = splitTaskId(globalId);
    const { project, dir, board } = await this._writable(projectId);
    const tasks = await this._tasksForProject(project, { dir, board });
    const current = tasks.find(task => task._localId === localId);
    if (!current) fail(404, 'Task not found');
    if (typeof input.version !== 'string' || !input.version) fail(400, 'version is required');
    const oldContent = await readFile(current._filePath, 'utf8');
    if (hash(oldContent) !== input.version) fail(409, 'Task has changed; refresh and try again');

    const title = 'title' in input ? cleanLine(input.title, 'title', { required: true, max: 200 }) : current.title;
    const description = 'description' in input ? cleanText(input.description, 'description', { max: 20000 }) : current.description;
    const status = 'status' in input ? cleanStatus(input.status) : current.status;
    const priority = 'priority' in input ? cleanPriority(input.priority) : current.priority;
    const assignee = 'assignee' in input ? cleanLine(input.assignee, 'assignee', { max: 100 }) : current.assignee;
    const dueDate = 'dueDate' in input ? cleanDate(input.dueDate) : current.dueDate;
    // A stored value is validated only when the request changes it, so a
    // hand-written type (such as a template placeholder) does not block an edit.
    const type = 'type' in input && input.type !== current.type ? cleanLine(input.type, 'type', { max: 40 }) : current.type;
    const reason = 'blockedReason' in input && input.blockedReason !== current.blockedReason
      ? cleanLine(input.blockedReason, 'blockedReason', { max: 200 })
      : current.blockedReason;
    // The reason belongs to the blocked state: leaving it clears the field (git keeps it).
    const blockedReason = status === 'blocked' ? reason : '';
    if (
      title === current.title
      && description === current.description
      && status === current.status
      && priority === current.priority
      && assignee === current.assignee
      && dueDate === current.dueDate
      && type === current.type
      && blockedReason === current.blockedReason
    ) {
      const { _filePath, _localId, _owner, ...task } = current;
      return task;
    }
    if (!isWip(current.status) && isWip(status) && tasks.filter(task => isWip(task.status)).length >= project.wipLimit) {
      fail(409, `WIP limit of ${project.wipLimit} has been reached`);
    }
    let owner = current._owner;
    if (!isWip(current.status) && isWip(status)) owner = ownerFor(this.operator, title);
    if (status === 'backlog') owner = '—';
    const storedStatus = status === 'backlog' ? 'open' : status === 'in_progress' ? 'claimed' : status;
    const updates = { title, status: storedStatus, owner, priority, assignee: assignee || '—', dueDate, updatedAt: now() };
    // Files written before these keys existed gain them on their next edit; an
    // unchanged value is left exactly as written.
    const { fields } = parseTaskMarkdown(oldContent);
    if (!('type' in fields) || type !== current.type) updates.type = type;
    if (!('blockedReason' in fields) || blockedReason !== current.blockedReason) updates.blockedReason = blockedReason;
    let content = updateFrontmatter(oldContent, updates);
    const parsed = parseTaskMarkdown(content);
    let body = parsed.body.replace(/^# T\d{3,} — .*$/m, () => `# ${localId} — ${title}`);
    body = replaceSection(body, 'Goal', encodeGoal(description || 'No description provided.'));
    if (status === 'done' && !section(body, 'Result')) {
      body = replaceSection(body, 'Result', `Completed through AGE Aris on ${today()}.`);
    }
    content = `---\n${parsed.header}\n---\n${body}`;
    // Apply the frontmatter updates again because parsed.header predates body replacement.
    content = updateFrontmatter(content, updates);
    const targetPath = join(taskDirectory(dir, board, status), `${localId}-${slug(title)}.md`);
    const statePath = join(dir, board, 'STATE.md');
    const paths = [...new Set([current._filePath, targetPath, statePath])];
    const before = await snapshot(paths);
    try {
      await mkdir(dirname(targetPath), { recursive: true });
      if (targetPath === current._filePath) await writeFile(targetPath, content);
      else {
        await writeFile(targetPath, content, { flag: 'wx' });
        await rm(current._filePath);
      }
      const updatedInternal = taskPublic(project.id, targetPath, content);
      const nextTasks = tasks.map(task => task._localId === localId ? updatedInternal : task);
      await writeFile(statePath, this._renderState(project, nextTasks, before.get(statePath)?.toString('utf8'), board));
      this._commit(dir, paths, `Update ${localId}: ${title}`, trailers);
      const { _filePath, _localId, _owner, ...task } = updatedInternal;
      return task;
    } catch (error) {
      await restore(before);
      this._resetPaths(dir, paths);
      throw error;
    }
  }

  // `trailers` ({ 'AGESight-Via': 'ui' }, { Run: 'R001' }) are appended as git
  // trailers, which the history ledger reads.
  _commit(projectDir, absolutePaths, message, trailers) {
    this._assertOwnRepository(projectDir);
    const relative = absolutePaths.map(path => path.slice(projectDir.length + 1));
    git(projectDir, ['add', '-A', '--', ...relative]);
    git(projectDir, ['commit', '--quiet', '--only', '-m', withTrailers(message, trailers), '--', ...relative]);
    this._announce(basename(projectDir), relative);
  }

  // Tells the commit listeners which paths a commit AGE Aris made touched.
  _announce(projectId, relative) {
    for (const listener of this._commitListeners) {
      // The commit has landed; a failing listener, sync or async, must not turn
      // it into an error.
      const report = (error) => console.error(`Commit listener failed: ${error?.message}`);
      try { Promise.resolve(listener(projectId, { paths: relative })).catch(report); } catch (error) { report(error); }
    }
  }

  // AGE Aris writes only to the repositories it made: a project folder in its
  // data folder with a .git of its own. A tracked repository's project folder
  // has none, and git would otherwise look for one in the folders above it.
  _assertOwnRepository(projectDir) {
    const dir = resolve(projectDir);
    let own = false;
    try { own = dirname(dir) === this.projectsDir && lstatSync(join(dir, '.git')).isDirectory(); } catch { own = false; }
    if (!own) fail(500, 'AGE Aris writes only to the project repositories in its data folder');
  }

  _resetPaths(projectDir, absolutePaths) {
    this._assertOwnRepository(projectDir);
    const relative = absolutePaths.map(path => path.slice(projectDir.length + 1));
    git(projectDir, ['reset', '--quiet', 'HEAD', '--', ...relative], { allowFailure: true });
  }

  // STATE.md: the NOW block a person writes, and the generated board. The
  // markers carry the board folder's name (<!-- AA:generated -->); a file that
  // has deaddrop's keeps them, since its board.sh looks for those. Replacements
  // are functions, so a `$` in a title or a name is copied as written.
  _renderState(project, tasks, previousState = '', board = NEW_BOARD) {
    const rows = tasks
      .sort((a, b) => a._localId.localeCompare(b._localId))
      .map(task => `| ${task._localId} | ${task.title.replace(/\|/g, '\\|')} | ${task.status} | ${task.priority} | ${(task.assignee || '—').replace(/\|/g, '\\|')} |`)
      .join('\n') || '| — | No tasks yet | — | — | — |';
    const generated = (name) => `<!-- ${name}:generated -->\n| ID | Task | Status | Priority | Assignee |\n|---|---|---|---|---|\n${rows}\n<!-- /${name}:generated -->`;
    if (previousState) {
      const withHeading = previousState.replace(/^# State — .*$/m, () => `# State — ${project.name}`);
      const region = /<!-- (AA|deaddrop):generated -->[\s\S]*?<!-- \/\1:generated -->/.exec(withHeading);
      if (region) return withHeading.replace(region[0], () => generated(region[1]));
      return `${withHeading.trimEnd()}\n\n${generated(board)}\n`;
    }
    const nowBlock = `<!-- ${board}:now -->\n**Standing:** Add the current project situation here.\n\n**Next action:** Name the next task when priorities are clear.\n\n**Watch out for:** WIP includes both in-progress and blocked tasks.\n<!-- /${board}:now -->`;
    return `# State — ${project.name}\n\n${nowBlock}\n\n${generated(board)}\n`;
  }
}

export {
  agentIdentity, assertNotSymlink, blockedReasonOf, boardPolicy, BOARDS, cleanLine, configName, cleanText, fail, git, gitEnv, gitStream, GIT_HARDENING,
  hash, isUiClaim, ownerNote, parseOwner, parseTaskMarkdown, PROJECT_ID, readBoardConfig, redactEmails, statusWord, taskState,
};
