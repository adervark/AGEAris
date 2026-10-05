import { createHash, randomUUID } from 'node:crypto';
import { constants as fsConstants } from 'node:fs';
import { access, cp, lstat, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, join, parse, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';

const PROJECT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TASK_ID = /^T(\d{3,})$/;
const STATUSES = new Set(['backlog', 'in_progress', 'blocked', 'done']);
const STORED_STATUSES = new Set(['open', 'backlog', 'claimed', 'in_progress', 'blocked', 'done', 'killed']);
const PRIORITIES = new Set(['low', 'medium', 'high', 'urgent']);
const TEMPLATE_ROOT = fileURLToPath(new URL('../skills/deaddrop-init/template/', import.meta.url));
const GIT_HARDENING = ['-c', 'core.hooksPath=/dev/null', '-c', 'core.fsmonitor=false'];
const TRAILER_KEY = /^[A-Z][A-Za-z0-9-]*$/;
const DELTA_FALLBACKS = new Set(['previous-workday', '24h', '7d']);
// 'UTC' is a valid IANA zone that Intl.supportedValuesOf leaves out.
const TIME_ZONES = new Set([...Intl.supportedValuesOf('timeZone'), 'UTC', 'Etc/UTC']);

// The Handoff boilerplate AGESight writes into new tasks; it never counts as a
// reason a task is blocked.
export const DEFAULT_NEXT_DECISION = 'choose the smallest safe action that advances the goal';

export class WorkspaceError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'WorkspaceError';
    this.status = status;
  }
}

function fail(status, message) {
  throw new WorkspaceError(status, message);
}

function git(cwd, args, { allowFailure = false, env } = {}) {
  // Hooks and fsmonitor are disabled: files in a project repository, which
  // agents may write, must never make AGESight run code.
  const result = spawnSync('git', [...GIT_HARDENING, '-C', cwd, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...(env ? { env: { ...process.env, ...env } } : {}),
  });
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
async function* gitStream(cwd, args, { input, signal } = {}) {
  const child = spawn('git', [...GIT_HARDENING, '-C', cwd, ...args], {
    stdio: [input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'],
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
  if (/\r|\n/.test(text)) fail(400, `${field} must be a single line`);
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
// placeholder, AGESight's own boilerplate, or "nothing".
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
    if (pattern.test(header)) header = header.replace(pattern, `${key}: ${rendered}`);
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

function taskDirectory(projectDir, status) {
  if (status === 'backlog') return join(projectDir, 'deaddrop', 'backlog');
  if (status === 'done') return join(projectDir, 'deaddrop', 'tasks', 'done');
  return join(projectDir, 'deaddrop', 'tasks');
}

// The state rule: the directory is the state, refined by the stored status.
// `directory` is the folder holding the task file: backlog, tasks, or done.
function taskState(directory, storedStatus) {
  if (directory === 'backlog') return 'backlog';
  if (directory === 'done') return storedStatus === 'killed' ? 'dropped' : 'done';
  return storedStatus === 'blocked' ? 'blocked' : 'in_progress';
}

function taskPublic(projectId, filePath, content) {
  const { fields, body } = parseTaskMarkdown(content);
  const id = String(fields.id || '');
  const storedStatus = String(fields.status || 'open');
  // The board has no Dropped column; a killed task sits with the done ones.
  const state = taskState(basename(dirname(filePath)), storedStatus);
  const status = state === 'dropped' ? 'done' : state;
  const filenameId = /^(T\d{3,})-/.exec(basename(filePath))?.[1];
  if (!TASK_ID.test(id) || id !== filenameId) fail(500, `Task file ${basename(filePath)} has an invalid id`);
  if (!STORED_STATUSES.has(storedStatus)) fail(500, `Task ${id} has an invalid status`);
  if (!PRIORITIES.has(String(fields.priority || 'medium'))) fail(500, `Task ${id} has an invalid priority`);
  return {
    id: `${projectId}:${id}`,
    projectId,
    title: String(fields.title || ''),
    description: decodeGoal(section(body, 'Goal')),
    status,
    priority: String(fields.priority || 'medium'),
    assignee: fields.assignee === '—' ? '' : String(fields.assignee || ''),
    dueDate: String(fields.dueDate || ''),
    type: String(fields.type ?? ''),
    blockedReason: String(fields.blockedReason ?? ''),
    createdAt: String(fields.createdAt || fields.created || ''),
    updatedAt: String(fields.updatedAt || fields.created || ''),
    version: hash(content),
    _filePath: filePath,
    _localId: id,
    _owner: String(fields.owner || '—'),
  };
}

async function exists(path) {
  try { await access(path, fsConstants.F_OK); return true; } catch { return false; }
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
  return `---\nid: ${localId}\ntitle: ${yamlScalar(title)}\nstatus: ${status === 'backlog' ? 'open' : status === 'in_progress' ? 'claimed' : status}\nowner: ${yamlScalar(owner)}\npriority: ${priority}\nassignee: ${yamlScalar(assignee || '—')}\ndueDate: ${yamlScalar(dueDate)}\ntype: ${yamlScalar(type)}\nblockedReason: ${yamlScalar(blockedReason)}\ndepends: []\ncreated: ${createdAt.slice(0, 10)}\ncreatedAt: ${yamlScalar(createdAt)}\nupdatedAt: ${yamlScalar(updatedAt)}\n---\n\n# ${localId} — ${title}\n\n## Goal\n\n${encodeGoal(description || 'No description provided.')}\n\n## Context\n\nCreated and managed by AGESight.\n\n## Steps\n\n- [ ] Define the next concrete action.\n\n## Decision rules — fixed in advance\n\nLocal, reversible work may proceed. Stop before external, destructive, credential-gated, or irreversible actions.\n\n## Handoff — state at last stop\n\n- **Last touched:** ${today()}, ${owner}\n- **In flight:** nothing\n- **On disk:** task registered in AGESight\n- **Resume with:** review the task goal and choose the next action\n- **Next decision:** ${DEFAULT_NEXT_DECISION}\n\n## Verify\n\nConfirm the stated goal and acceptance conditions are satisfied.\n\n## Result\n\n${result}\n\n## Notes\n\n`;
}

function renderDeaddropConfig(project) {
  return `spend:\n  []\nwip:\n  in_progress: ${project.wipLimit}\n  blocked: ${project.wipLimit}\nstale_hours: 24\nlog: deaddrop/RESULTS.md\nmap: deaddrop/STATE.md\nid_prefix: T\n`;
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
  const { stdout } = git(dir, ['log', '--no-renames', '--diff-filter=D', '--name-only', '-z', '--format=', '--', 'deaddrop']);
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
  constructor({ dataDir = join(process.cwd(), '.agesight-data'), operator, email } = {}) {
    if (typeof dataDir !== 'string' || !dataDir) fail(400, 'dataDir is required');
    this.dataDir = resolve(dataDir);
    this.projectsDir = join(this.dataDir, 'projects');
    this.operator = cleanLine(operator || gitValue(process.cwd(), 'user.name') || 'AGESight', 'operator', { required: true, max: 100 });
    this.email = cleanLine(email || gitValue(process.cwd(), 'user.email') || 'agesight@localhost.invalid', 'email', { required: true, max: 254 });
    this._mutations = Promise.resolve();
    this._commitListeners = new Set();
    this._verifiedRepos = new Map();
  }

  // Calls `listener(projectId)` after every commit AGESight makes in a project,
  // so caches derived from git history (the ledger memo) are invalidated by
  // AGESight's own writes without relying on file timestamps. Returns a
  // function that removes the listener.
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

  async _project(id) {
    const dir = this._projectDir(id);
    await assertNotSymlink(dir, true);
    await assertNotSymlink(join(dir, 'project.json'), true);
    await this._verifyProjectRepo(dir);
    let raw;
    try { raw = await readFile(join(dir, 'project.json'), 'utf8'); }
    catch (error) {
      if (error?.code === 'ENOENT') fail(404, 'Project not found');
      throw error;
    }
    if (Buffer.byteLength(raw) > 64 * 1024) fail(500, 'Project metadata is too large');
    let storedProject;
    try { storedProject = JSON.parse(raw); } catch { fail(500, 'Project metadata is invalid'); }
    const project = { ...storedProject, version: hash(raw) };
    return { project, dir };
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

  async _tasksForProject(project) {
    const dir = this._projectDir(project.id);
    const locations = [
      join(dir, 'deaddrop', 'backlog'),
      join(dir, 'deaddrop', 'tasks'),
      join(dir, 'deaddrop', 'tasks', 'done'),
    ];
    const tasks = [];
    const ids = new Set();
    for (const location of locations) {
      await assertNotSymlink(location);
      for (const entry of await readdir(location, { withFileTypes: true })) {
        if (entry.isSymbolicLink()) fail(400, 'Symbolic links are not allowed in workspace storage');
        if (!entry.isFile() || !/^T\d{3,}-.*\.md$/.test(entry.name)) continue;
        const path = join(location, entry.name);
        const content = await readFile(path, 'utf8');
        if (Buffer.byteLength(content) > 256 * 1024) fail(500, `Task file ${entry.name} is too large`);
        const task = taskPublic(project.id, path, content);
        if (ids.has(task._localId)) fail(500, `Duplicate task id ${task._localId} in project ${project.name}`);
        ids.add(task._localId);
        tasks.push(task);
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
      const { project, dir } = await this._project(entry.name);
      projects.push(project);
      tasks.push(...await this._tasksForProject(project));
      const log = git(dir, ['log', '--format=%H%x1f%aI%x1f%an%x1f%s', '--max-count=200']);
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

  async getTask(globalId) {
    return this._serialize(async () => {
      const { projectId, localId } = splitTaskId(globalId);
      const { project } = await this._project(projectId);
      const task = (await this._tasksForProject(project)).find((entry) => entry._localId === localId);
      if (!task) fail(404, 'Task not found');
      const { _filePath, _owner, ...rest } = task;
      return rest;
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
      try {
        await mkdir(join(dir, 'deaddrop', 'backlog'), { recursive: true });
        await mkdir(join(dir, 'deaddrop', 'tasks', 'done'), { recursive: true });
        await mkdir(join(dir, 'deaddrop', 'checkpoints'), { recursive: true });
        await mkdir(join(dir, 'deaddrop', 'templates'), { recursive: true });
        await Promise.all([
          cp(join(TEMPLATE_ROOT, 'RULES.md'), join(dir, 'deaddrop', 'RULES.md')),
          cp(join(TEMPLATE_ROOT, 'WHY.md'), join(dir, 'deaddrop', 'WHY.md')),
          cp(join(TEMPLATE_ROOT, 'TASK.md'), join(dir, 'deaddrop', 'templates', 'TASK.md')),
          cp(join(TEMPLATE_ROOT, 'SCHEMA.md'), join(dir, 'deaddrop', 'checkpoints', '_SCHEMA.md')),
        ]);
        const projectRaw = `${JSON.stringify(project, null, 2)}\n`;
        await writeFile(join(dir, 'project.json'), projectRaw);
        await writeFile(join(dir, 'deaddrop', 'deaddrop.yml'), renderDeaddropConfig(project));
        await writeFile(join(dir, 'deaddrop', 'STATE.md'), this._renderState(project, []));
        git(dir, ['init', '--quiet']);
        git(dir, ['config', 'user.name', this.operator]);
        git(dir, ['config', 'user.email', this.email]);
        await this._verifyProjectRepo(dir);
        this._commit(dir, [join(dir, 'project.json'), join(dir, 'deaddrop')], `Create project: ${name}`, trailers);
        return { ...project, version: hash(projectRaw) };
      } catch (error) {
        await rm(dir, { recursive: true, force: true });
        throw error;
      }
    });
  }

  async updateProject(id, input = {}, { trailers } = {}) {
    return this._serialize(async () => {
      const { project, dir } = await this._project(id);
      if (typeof input.version !== 'string' || !input.version) fail(400, 'version is required');
      if (input.version !== project.version) fail(409, 'Project has changed; refresh and try again');
      const { version, ...storedProject } = project;
      const next = { ...storedProject };
      if ('name' in input) next.name = cleanLine(input.name, 'name', { required: true, max: 100 });
      if ('description' in input) next.description = cleanText(input.description, 'description', { max: 5000 });
      if ('color' in input) next.color = cleanColor(input.color);
      if ('wipLimit' in input) {
        next.wipLimit = cleanWipLimit(input.wipLimit);
        const active = (await this._tasksForProject(project)).filter(task => isWip(task.status)).length;
        if (active > next.wipLimit) fail(409, `WIP limit ${next.wipLimit} is below the current WIP of ${active}`);
      }
      if (JSON.stringify(next) === JSON.stringify(storedProject)) return project;
      const paths = [join(dir, 'project.json'), join(dir, 'deaddrop', 'deaddrop.yml'), join(dir, 'deaddrop', 'STATE.md')];
      const before = await snapshot(paths);
      try {
        const nextRaw = `${JSON.stringify(next, null, 2)}\n`;
        await writeFile(paths[0], nextRaw);
        await writeFile(paths[1], renderDeaddropConfig(next));
        await writeFile(paths[2], this._renderState(next, await this._tasksForProject(next), before.get(paths[2])?.toString('utf8')));
        this._commit(dir, paths, `Update project: ${next.name}`, trailers);
        return { ...next, version: hash(nextRaw) };
      } catch (error) {
        await restore(before);
        this._resetPaths(dir, paths);
        throw error;
      }
    });
  }

  async createTask(input = {}, { trailers } = {}) {
    return this._serialize(async () => {
      const projectId = cleanLine(input.projectId, 'projectId', { required: true, max: 36 });
      const { project, dir } = await this._project(projectId);
      const existing = await this._tasksForProject(project);
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
        result: status === 'done' ? `Completed through AGESight on ${today()}.` : '',
      });
      const path = join(taskDirectory(dir, status), `${localId}-${slug(title)}.md`);
      const statePath = join(dir, 'deaddrop', 'STATE.md');
      const before = await snapshot([path, statePath]);
      try {
        await writeFile(path, content, { flag: 'wx' });
        const current = [...existing, taskPublic(project.id, path, content)];
        await writeFile(statePath, this._renderState(project, current, before.get(statePath)?.toString('utf8')));
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
    return this._serialize(async () => {
      const { projectId, localId } = splitTaskId(globalId);
      const { project, dir } = await this._project(projectId);
      const tasks = await this._tasksForProject(project);
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
      let body = parsed.body.replace(/^# T\d{3,} — .*$/m, `# ${localId} — ${title}`);
      body = replaceSection(body, 'Goal', encodeGoal(description || 'No description provided.'));
      if (status === 'done' && !section(body, 'Result')) {
        body = replaceSection(body, 'Result', `Completed through AGESight on ${today()}.`);
      }
      content = `---\n${parsed.header}\n---\n${body}`;
      // Apply the frontmatter updates again because parsed.header predates body replacement.
      content = updateFrontmatter(content, updates);
      const targetPath = join(taskDirectory(dir, status), `${localId}-${slug(title)}.md`);
      const statePath = join(dir, 'deaddrop', 'STATE.md');
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
        await writeFile(statePath, this._renderState(project, nextTasks, before.get(statePath)?.toString('utf8')));
        this._commit(dir, paths, `Update ${localId}: ${title}`, trailers);
        const { _filePath, _localId, _owner, ...task } = updatedInternal;
        return task;
      } catch (error) {
        await restore(before);
        this._resetPaths(dir, paths);
        throw error;
      }
    });
  }

  // `trailers` ({ 'AGESight-Via': 'ui' }, { Run: 'R001' }) are appended as git
  // trailers, which the history ledger reads.
  _commit(projectDir, absolutePaths, message, trailers) {
    const relative = absolutePaths.map(path => path.slice(projectDir.length + 1));
    git(projectDir, ['add', '-A', '--', ...relative]);
    git(projectDir, ['commit', '--quiet', '--only', '-m', withTrailers(message, trailers), '--', ...relative]);
    const projectId = basename(projectDir);
    for (const listener of this._commitListeners) {
      // The commit has landed; a failing listener must not turn it into an error.
      try { listener(projectId); } catch (error) { console.error(`Commit listener failed: ${error.message}`); }
    }
  }

  _resetPaths(projectDir, absolutePaths) {
    const relative = absolutePaths.map(path => path.slice(projectDir.length + 1));
    git(projectDir, ['reset', '--quiet', 'HEAD', '--', ...relative], { allowFailure: true });
  }

  _renderState(project, tasks, previousState = '') {
    const rows = tasks
      .sort((a, b) => a._localId.localeCompare(b._localId))
      .map(task => `| ${task._localId} | ${task.title.replace(/\|/g, '\\|')} | ${task.status} | ${task.priority} | ${(task.assignee || '—').replace(/\|/g, '\\|')} |`)
      .join('\n') || '| — | No tasks yet | — | — | — |';
    const generated = `<!-- deaddrop:generated -->\n| ID | Task | Status | Priority | Assignee |\n|---|---|---|---|---|\n${rows}\n<!-- /deaddrop:generated -->`;
    if (previousState) {
      const withHeading = previousState.replace(/^# State — .*$/m, `# State — ${project.name}`);
      if (/<!-- deaddrop:generated -->[\s\S]*?<!-- \/deaddrop:generated -->/.test(withHeading)) {
        return withHeading.replace(/<!-- deaddrop:generated -->[\s\S]*?<!-- \/deaddrop:generated -->/, generated);
      }
      return `${withHeading.trimEnd()}\n\n${generated}\n`;
    }
    const nowBlock = `<!-- deaddrop:now -->\n**Standing:** Add the current project situation here.\n\n**Next action:** Name the next task when priorities are clear.\n\n**Watch out for:** WIP includes both in-progress and blocked tasks.\n<!-- /deaddrop:now -->`;
    return `# State — ${project.name}\n\n${nowBlock}\n\n${generated}\n`;
  }
}

export { assertNotSymlink, blockedReasonOf, cleanLine, cleanText, fail, git, gitStream, hash, parseTaskMarkdown, PROJECT_ID, taskState };
