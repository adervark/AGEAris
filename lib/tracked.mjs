// The tracked-write engine: one task-file change committed to a tracked
// repository's pinned branch while git's own index lock is held
// (docs/plans/task-control.md §3). Every write ends committed and consistent,
// unchanged apart from loose objects, or reported as interrupted.
//
// The product reaches it only through Workspace.actOnTask, a task action the
// operator takes on a tracked repository after switching actions on for it.
import { createHash, randomBytes } from 'node:crypto';
import { constants as fsConstants } from 'node:fs';
import { copyFile, link, lstat, mkdir, open, readdir, readFile, realpath, rename, rm, rmdir, unlink, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve, sep } from 'node:path';
import { spawn } from 'node:child_process';

import { GIT_HARDENING, gitEnv, redactEmails, WorkspaceError } from './workspace.mjs';

// Config a tracked write adds to GIT_HARDENING: no signing program, and no
// line-ending conversion. Pathspecs are literal, so a `*` in a name is a `*`.
const TRACKED_CONFIG = ['--literal-pathspecs', '-c', 'commit.gpgSign=false', '-c', 'core.autocrlf=false'];
// Milliseconds. `call` and `hold` include the grace between SIGTERM and
// SIGKILL. The steps under the lock stop `reserve` before the end of the hold,
// so the settle rule always has that long to finish or roll back.
const LIMITS = { outside: 10_000, call: 2_000, hold: 3_000, grace: 500, reserve: 1_000 };
// The variables a tracked git call may set: its own index, under the
// repository's git folder, and the identity it commits as.
const IDENTITY_VARIABLE = /^GIT_(?:AUTHOR|COMMITTER)_(?:NAME|EMAIL|DATE)$/;
// Files under the git folder that mean an operation is half done.
const OPERATIONS = ['MERGE_HEAD', 'rebase-merge', 'rebase-apply', 'CHERRY_PICK_HEAD', 'REVERT_HEAD', 'BISECT_LOG', 'sequencer'];
// The folders of an AA/ board a task file may be in, and so be written to.
const TASK_FOLDERS = new Set(['AA/backlog', 'AA/tasks', 'AA/tasks/done']);
const LEGACY_FOLDERS = ['deaddrop/', 'pm/'];
const TASK_NAME = /^T\d{3,}-/;
const TASK_LIMIT = 1024 * 1024;
const TRAIL_LIMIT = 1024 * 1024;
// How far before the last 1 MB readTrail still counts lines, so a huge trail
// costs at most this much reading.
const TRAIL_COUNT_LIMIT = 8 * 1024 * 1024;
const HOUR_MS = 3_600_000;
// Repositories this process is writing to. Recovery leaves their markers
// alone: the lock they name is live, not left behind.
const active = new Set();

export class TrackedError extends WorkspaceError {
  constructor(status, code, message, remedy = '') {
    super(status, message);
    this.name = 'TrackedError';
    this.code = code;
    this.remedy = remedy;
  }
}

const STATUS = { BAD_INPUT: 400, NOT_FOUND: 404, GIT_FAILED: 500, INTERRUPTED: 500 };

function refuse(code, message, remedy = '') {
  throw new TrackedError(STATUS[code] || 409, code, message, remedy);
}

// A git call that is never left running: SIGTERM at `timeout - grace`, on
// which git removes its own lock files, then SIGKILL at `timeout`. Resolves
// { code, signal, timedOut, stdout (Buffer), stderr }; never rejects. `spawn`
// replaces child_process.spawn (tests slow a call down or make it ignore
// SIGTERM).
export function trackedGit(dir, args, { input, env = {}, timeout = LIMITS.outside, grace = LIMITS.grace, gitDir = join(dir, '.git'), spawn: spawnProcess = spawn } = {}) {
  for (const [key, value] of Object.entries(env)) {
    if (key === 'GIT_INDEX_FILE') {
      if (!resolve(dir, value).startsWith(`${resolve(gitDir)}${sep}`)) throw new Error('GIT_INDEX_FILE must be inside the repository\'s git folder');
    } else if (!IDENTITY_VARIABLE.test(key)) {
      throw new Error(`${key} cannot be set for a tracked git call`);
    }
  }
  if (timeout <= 0) return Promise.resolve({ code: null, signal: null, timedOut: true, stdout: Buffer.alloc(0), stderr: '' });
  return new Promise((settled) => {
    let done = false;
    let timedOut = false;
    const stdout = [];
    const stderr = [];
    let stderrSize = 0;
    const child = spawnProcess('git', [...GIT_HARDENING, ...TRACKED_CONFIG, '-C', dir, ...args], {
      stdio: [input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'],
      // gitEnv drops GIT_INDEX_FILE; the one checked above is meant. Replace
      // refs, which the repository controls, must not change what an object
      // id reads as.
      env: { ...gitEnv(), GIT_NO_REPLACE_OBJECTS: '1', ...env },
    });
    const finish = ({ code = null, signal = null, error } = {}) => {
      if (done) return;
      done = true;
      clearTimeout(term);
      clearTimeout(kill);
      if (timedOut) { child.stdout?.destroy(); child.stderr?.destroy(); }
      settled({ code, signal, timedOut, error, stdout: Buffer.concat(stdout), stderr: Buffer.concat(stderr).toString('utf8') });
    };
    const term = setTimeout(() => { timedOut = true; child.kill('SIGTERM'); }, Math.max(0, timeout - grace));
    const kill = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, timeout);
    child.stdout.on('data', (chunk) => stdout.push(chunk));
    child.stderr.on('data', (chunk) => {
      if (stderrSize < 64 * 1024) stderr.push(chunk);
      stderrSize += chunk.length;
    });
    child.once('error', (error) => finish({ error }));
    child.once('close', (code, signal) => finish({ code, signal }));
    // A killed child's output no longer matters, and a grandchild may still
    // hold its pipes open, so its exit is enough.
    child.once('exit', (code, signal) => { if (timedOut) finish({ code, signal }); });
    if (input !== undefined) {
      child.stdin.on('error', () => {});
      child.stdin.end(input);
    }
  });
}

// trackedGit bound to one repository and one deadline (`clock.deadline`, read
// on every call, so the settle rule can extend it). A call that runs out of
// time throws an error marked `timedOut`; a failed one throws GIT_FAILED unless
// `allowFailure`.
function gitRunner(dir, gitDir, clock, { limits = LIMITS, spawn: spawnProcess, config = [] } = {}) {
  return async (args, { input, env, allowFailure = false } = {}) => {
    const limit = clock.deadline === Infinity ? limits.outside : limits.call;
    const timeout = Math.min(limit, clock.deadline - Date.now());
    const result = await trackedGit(dir, [...config, ...args], { input, env, timeout, grace: Math.min(limits.grace, Math.max(0, timeout - 1)), gitDir, spawn: spawnProcess });
    if (result.timedOut) throw Object.assign(new Error(`git ${args[0]} did not finish in time`), { timedOut: true });
    if (result.error) throw new TrackedError(500, 'GIT_FAILED', `Git could not run: ${redactEmails(result.error.message)}`);
    if (result.code !== 0 && !allowFailure) {
      throw new TrackedError(500, 'GIT_FAILED', `Git operation failed: ${redactEmails(result.stderr.trim() || `exit ${result.code}`)}`);
    }
    return result;
  };
}

// Config that blanks every filter driver the repository configures. Writing an
// index re-checks racily clean entries against the working tree, through the
// file's clean filter; a driver without commands runs nothing.
async function filterOff(run) {
  const keys = text(await run(['config', '--name-only', '--get-regexp', '^filter\\.'], { allowFailure: true })).split('\n');
  const drivers = new Set(keys.filter((key) => key.lastIndexOf('.') > 7 && !key.includes('=')).map((key) => key.slice(7, key.lastIndexOf('.'))));
  return [...drivers].flatMap((name) => ['clean', 'smudge', 'process'].flatMap((command) => ['-c', `filter.${name}.${command}=`]).concat(['-c', `filter.${name}.required=false`]));
}

function text(result) {
  return result.stdout.toString('utf8').trim();
}

// A git object id for these bytes as a blob, computed here rather than by git.
function blobId(bytes, format = 'sha1') {
  return createHash(format === 'sha256' ? 'sha256' : 'sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
}

// Where a repository keeps its git data, and in what object format.
async function repoInfo(dir, run) {
  const lines = text(await run(['rev-parse', '--show-object-format', '--absolute-git-dir', '--git-common-dir', '--show-toplevel', '--shared-index-path'])).split('\n');
  if (!lines[3] || await realpath(lines[3]) !== await realpath(dir)) refuse('UNSUPPORTED_REPO', `${dir} is not the top of a git working tree.`);
  return { format: lines[0], gitDir: lines[1], commonDir: resolve(dir, lines[2]), sharedIndex: lines[4] || '' };
}

function configTrue(value) {
  const word = String(value ?? '').trim().toLowerCase();
  return ['', 'true', 'yes', 'on'].includes(word) || (/^-?\d+$/.test(word) && Number(word) !== 0);
}

async function present(path) {
  try { await lstat(path); return true; } catch (error) {
    if (error?.code === 'ENOENT' || error?.code === 'ENOTDIR') return false;
    throw error;
  }
}

// The first bytes of a file, without following a symbolic link; '' if absent.
async function readHead(path, size = 64) {
  let handle;
  try { handle = await open(path, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW); } catch { return ''; }
  try {
    const buffer = Buffer.alloc(size);
    const { bytesRead } = await handle.read(buffer, 0, size, 0);
    return buffer.subarray(0, bytesRead).toString('utf8');
  } finally { await handle.close(); }
}

// A file's blob id, or null when it is absent; 'not-a-file' for anything that
// is not a regular file.
async function fileBlob(path, format) {
  let handle;
  try { handle = await open(path, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW); } catch (error) {
    if (error?.code === 'ENOENT' || error?.code === 'ENOTDIR') return null;
    if (error?.code === 'ELOOP') return 'not-a-file';
    throw error;
  }
  try {
    const info = await handle.stat();
    if (!info.isFile() || info.size > TASK_LIMIT) return 'not-a-file';
    return blobId(await handle.readFile(), format);
  } finally { await handle.close(); }
}

// Whether a repository can take tracked writes, and what switching them on
// should disclose. Refuses with UNSUPPORTED_REPO: reftable, sparse checkout,
// a sparse or split index, no index, a detached HEAD, or a task folder where
// link() fails (some FUSE and vfat filesystems). `quick` is the check every
// action repeats: the config and the index only.
export async function probeRepository(dir, { board = 'AA', quick = false, link: linkFile = link, spawn: spawnProcess } = {}) {
  const run = gitRunner(dir, join(dir, '.git'), { deadline: Infinity }, { spawn: spawnProcess });
  const info = await repoInfo(dir, run);
  const config = new Map();
  // The repository's own values: AGE Aris's `-c core.hooksPath=/dev/null` is
  // scope `command`, and would otherwise read as the repository's.
  const listed = await run(['config', '--show-scope', '--get-regexp', '^(extensions\\.refstorage|core\\.sparsecheckout|index\\.sparse|core\\.splitindex|core\\.hookspath)$'], { allowFailure: true });
  for (const scoped of text(listed).split('\n').filter(Boolean)) {
    const tab = scoped.indexOf('\t');
    if (scoped.slice(0, tab) === 'command') continue;
    const line = scoped.slice(tab + 1);
    const space = line.indexOf(' ');
    config.set((space < 0 ? line : line.slice(0, space)).toLowerCase(), space < 0 ? '' : line.slice(space + 1));
  }
  const problems = [];
  if (String(config.get('extensions.refstorage') || '').toLowerCase() === 'reftable') problems.push('it stores refs in reftable');
  if (config.has('core.sparsecheckout') && configTrue(config.get('core.sparsecheckout'))) problems.push('it has a sparse checkout');
  if (config.has('index.sparse') && configTrue(config.get('index.sparse'))) problems.push('its index is sparse');
  if ((config.has('core.splitindex') && configTrue(config.get('core.splitindex'))) || info.sharedIndex) problems.push('its index is split');
  if ((await readHead(join(info.gitDir, 'index'), 4)) !== 'DIRC') problems.push('it has no index');
  const result = { ...info, branch: '', hooks: [], hooksPath: config.get('core.hookspath') || '', worktrees: [] };
  if (!quick) {
    result.branch = text(await run(['symbolic-ref', '-q', 'HEAD'], { allowFailure: true }));
    if (!result.branch) problems.push('its HEAD is detached');
    // The task folders must be real folders before anything is written in one.
    let real = true;
    for (const folder of ['backlog', 'tasks', 'tasks/done']) {
      try { await assertRealFolders(dir, `${board}/${folder}/T000-probe.md`); } catch (error) {
        problems.push(error.message.replace(/\.$/, ''));
        real = false;
        break;
      }
    }
    const folder = join(dir, board, 'tasks');
    const probe = join(folder, `.agesight-probe-${randomBytes(8).toString('hex')}`);
    if (real) {
      try {
        await writeFile(probe, '', { flag: 'wx' });
        await linkFile(probe, `${probe}.link`);
      } catch (error) {
        problems.push(`a file in ${board}/tasks cannot be hard-linked (${error?.code || error?.message})`);
      } finally {
        await rm(probe, { force: true });
        await rm(`${probe}.link`, { force: true });
      }
    }
    try {
      result.hooks = (await readdir(join(info.commonDir, 'hooks'))).filter((name) => !name.endsWith('.sample')).sort();
    } catch { result.hooks = []; }
    const worktrees = text(await run(['worktree', 'list', '--porcelain']));
    result.worktrees = worktrees.split('\n').filter((line) => line.startsWith('worktree ')).map((line) => line.slice(9)).filter((path) => resolve(path) !== resolve(dir));
  }
  if (problems.length) refuse('UNSUPPORTED_REPO', `Task actions cannot write to ${dir}: ${problems.join('; ')}.`);
  return result;
}

// The checked-out branch ('' when HEAD is detached), an operation in progress
// ('' when none), and whether git's index lock is held.
export async function repoState(dir, { run = gitRunner(dir, join(dir, '.git'), { deadline: Infinity }), gitDir } = {}) {
  const folder = gitDir || text(await run(['rev-parse', '--absolute-git-dir']));
  const branch = text(await run(['symbolic-ref', '-q', 'HEAD'], { allowFailure: true }));
  return { branch, operation: await operationIn(folder), locked: await present(join(folder, 'index.lock')), gitDir: folder };
}

// The first operation in progress under a git folder, or ''.
async function operationIn(gitDir) {
  for (const name of OPERATIONS) if (await present(join(gitDir, name))) return name;
  return '';
}

const OPERATION_WORDS = {
  MERGE_HEAD: 'a merge', 'rebase-merge': 'a rebase', 'rebase-apply': 'a rebase', CHERRY_PICK_HEAD: 'a cherry-pick',
  REVERT_HEAD: 'a revert', BISECT_LOG: 'a bisect', sequencer: 'a cherry-pick or revert sequence',
};

// ---- Task-file text: line scanners, no regex over the file.

const LINE_BREAKS = ['\r', '\n', '\u0085', '\u2028', '\u2029', '\0'];
const FRONTMATTER_KEY = /^[A-Za-z][A-Za-z0-9_-]*$/;
// Keys AA writes bare (`status: claimed`, `owner: —`); any other new key is
// written double-quoted, as the template writes `blockedReason: ""`.
const BARE_KEYS = new Set(['status', 'owner']);

function singleLine(value, field) {
  if (typeof value !== 'string') throw new TypeError(`${field} must be a string`);
  if (LINE_BREAKS.some((character) => value.includes(character))) throw new TypeError(`${field} must be a single line`);
  return value;
}

function renderValue(key, value, old) {
  const quoted = old === null ? !BARE_KEYS.has(key) : old.startsWith('"') || old.startsWith('\'');
  const plain = value !== '' && !value.startsWith('"') && !value.startsWith('\'') && !value.includes('#');
  return quoted || !plain ? JSON.stringify(value) : value;
}

// A YAML comment after a value (`open  # the AA word`), with the space before
// it, or ''. A quoted value is skipped first, so a `#` inside it is not one.
function trailingComment(old) {
  let from = 0;
  if (old.startsWith('"')) {
    let index = 1;
    while (index < old.length && old[index] !== '"') index += old[index] === '\\' ? 2 : 1;
    from = index + 1;
  } else if (old.startsWith('\'')) {
    let index = 1;
    while (index < old.length && !(old[index] === '\'' && old[index + 1] !== '\'')) index += old[index] === '\'' ? 2 : 1;
    from = index + 1;
  }
  for (let index = from; index < old.length; index += 1) {
    // At 0 the value is empty and the comment is all there is (`key: # note`).
    if (old[index] === '#' && (index === 0 || old[index - 1] === ' ' || old[index - 1] === '\t')) {
      let start = index;
      while (start > from && (old[start - 1] === ' ' || old[start - 1] === '\t')) start -= 1;
      return start === index ? ` ${old.slice(index)}` : old.slice(start);
    }
  }
  return '';
}

// The frontmatter with each key in `updates` set to its value; every other
// byte is kept (comments, unknown keys, order, quoting, CRLF). A key written
// twice is set both times; a missing key is added at the end of the block. A
// replaced value keeps its line's quoting and its trailing `# comment`.
export function editFrontmatter(content, updates) {
  const source = String(content);
  const firstBreak = source.indexOf('\n');
  const opening = firstBreak < 0 ? '' : source.slice(0, firstBreak);
  if ((opening.endsWith('\r') ? opening.slice(0, -1) : opening) !== '---') throw new Error('Task file has no frontmatter');
  const eol = opening.endsWith('\r') ? '\r\n' : '\n';
  const entries = Object.entries(updates).map(([key, value]) => {
    if (!FRONTMATTER_KEY.test(key)) throw new TypeError(`${key} is not a frontmatter key`);
    return [key, singleLine(value, key)];
  });
  const wanted = new Map(entries);
  const written = new Set();
  let out = source.slice(0, firstBreak + 1);
  let position = firstBreak + 1;
  let closing = -1;
  while (position < source.length) {
    const lineBreak = source.indexOf('\n', position);
    const end = lineBreak < 0 ? source.length : lineBreak;
    const raw = source.slice(position, end);
    const cr = raw.endsWith('\r');
    const line = cr ? raw.slice(0, -1) : raw;
    if (line === '---') { closing = position; break; }
    const colon = line.indexOf(':');
    const key = colon > 0 ? line.slice(0, colon) : '';
    if (key && wanted.has(key)) {
      const old = line.slice(colon + 1).trimStart();
      out += `${key}: ${renderValue(key, wanted.get(key), old)}${trailingComment(old)}${cr ? '\r' : ''}${lineBreak < 0 ? '' : '\n'}`;
      written.add(key);
    } else {
      out += source.slice(position, lineBreak < 0 ? end : lineBreak + 1);
    }
    position = lineBreak < 0 ? source.length : lineBreak + 1;
  }
  if (closing < 0) throw new Error('Task file frontmatter is not closed');
  for (const [key, value] of entries) if (!written.has(key)) out += `${key}: ${renderValue(key, value, null)}${eol}`;
  return out + source.slice(closing);
}

function isPlaceholder(section) {
  return !section || section === '*(pending)*' || (section.startsWith('*(') && section.endsWith(')*')) || section.includes('{{');
}

// The `## Result` section, read by a line scan: from its heading to the next
// line starting `## `. `start` and `end` are offsets in `body` (-1 when there
// is no section); `placeholder` is true for nothing, `*(pending)*`, the
// template's italic instruction, or a `{{…}}` placeholder.
export function resultSection(body) {
  const source = String(body);
  let position = 0;
  let start = -1;
  let end = source.length;
  while (position < source.length) {
    const lineBreak = source.indexOf('\n', position);
    const next = lineBreak < 0 ? source.length : lineBreak + 1;
    const raw = source.slice(position, lineBreak < 0 ? source.length : lineBreak);
    const line = raw.endsWith('\r') ? raw.slice(0, -1) : raw;
    if (start < 0) {
      if (line.trimEnd() === '## Result') start = next;
    } else if (line.startsWith('## ')) {
      end = position;
      break;
    }
    position = next;
  }
  if (start < 0) return { found: false, text: '', placeholder: true, start: -1, end: -1 };
  const section = source.slice(start, end).trim();
  return { found: true, text: section, placeholder: isPlaceholder(section), start, end };
}

// `body` with a placeholder Result replaced by `line`, or a Result section
// added when there is none. Real content is kept: the body comes back as it
// was.
export function setResult(body, line) {
  const value = singleLine(line, 'Result').trim();
  if (!value) throw new TypeError('Result must not be empty');
  const source = String(body);
  const section = resultSection(source);
  if (section.found && !section.placeholder) return source;
  const eol = source.includes('\r\n') ? '\r\n' : '\n';
  if (!section.found) return `${source.trimEnd()}${eol}${eol}## Result${eol}${eol}${value}${eol}`;
  const after = section.end < source.length ? eol : '';
  return `${source.slice(0, section.start)}${eol}${value}${eol}${after}${source.slice(section.end)}`;
}

// Free text made safe for an owner line or a subject: no `#`, quotes or
// control characters, one line, at most `max` characters.
function plainText(value, max) {
  const cleaned = String(value ?? '').replace(/[#"'`“”‘’]/g, '').replace(/[\p{Cc}\p{Zl}\p{Zp}]/gu, ' ').replace(/\s+/g, ' ').trim();
  return [...cleaned].slice(0, max).join('').trim();
}

// `<operator> @agesight/web <UTC date> — <note>`, which parseOwner and board.sh
// read as the operator's own claim made through AGE Aris.
export function ownerLine(operator, note = '', date = new Date()) {
  const who = plainText(operator, 80);
  if (!who) throw new TypeError('operator is required');
  const words = plainText(note, 120);
  return `${who} @agesight/web ${date.toISOString().slice(0, 10)}${words ? ` — ${words}` : ''}`;
}

const SUBJECTS = {
  claim: (id, words) => `claim ${id}: ${words}`,
  release: (id) => `release ${id}: back to the queue`,
  block: (id, words) => `block ${id}: ${words}`,
  unblock: (id) => `unblock ${id}`,
  done: (id, words) => `${id} done: ${words}`,
};
const SUBJECT_NEEDS_TEXT = new Set(['claim', 'block', 'done']);
const SUBJECT_LIMIT = 72;

// The commit subject for an action on an AA board: one line of at most 72
// characters, in AA's words. It starts with the action or the id, so never
// with a sweep prefix (`migrate:`, `ckpt:`).
export function commitSubject(action, id, words = '') {
  if (!Object.hasOwn(SUBJECTS, action)) throw new TypeError(`${action} has no commit subject`);
  if (!/^T\d{3,12}$/.test(String(id))) throw new TypeError('id must be a task id');
  const detail = plainText(words, 400);
  if (SUBJECT_NEEDS_TEXT.has(action) && !detail) throw new TypeError(`${action} needs text for its subject`);
  const subject = [...SUBJECTS[action](id, detail)];
  return subject.length <= SUBJECT_LIMIT ? subject.join('') : `${subject.slice(0, SUBJECT_LIMIT - 1).join('').trimEnd()}…`;
}

// A task's checkpoint trail, read line by line: its runs, grouped by run id,
// each as its newest line (the trail is append-only). A run has ended when that
// line is an `end`; one that has not is live when the line is within
// `staleHours`, dead otherwise. A line that does not parse, or lacks `run`,
// `kind` or `ts`, is malformed and reported by line number. Only the last 1 MB
// is read (`truncated`); its line numbers are true unless more than 8 MB came
// before it (`numbered` false: they count from the start of the window).
export async function readTrail(path, { staleHours = 24, now = Date.now() } = {}) {
  let handle;
  try { handle = await open(path, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW); } catch (error) {
    if (error?.code === 'ENOENT' || error?.code === 'ENOTDIR') return { runs: [], malformed: [], truncated: false, numbered: true };
    throw error;
  }
  let source;
  let firstLine = 1;
  let truncated = false;
  let numbered = true;
  try {
    const info = await handle.stat();
    if (!info.isFile()) throw new Error(`${basename(path)} is not a regular file`);
    const start = Math.max(0, info.size - TRAIL_LIMIT);
    const buffer = Buffer.alloc(info.size - start);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, start);
    source = buffer.subarray(0, bytesRead).toString('utf8');
    if (start > 0) {
      truncated = true;
      // Count the lines skipped, a chunk at a time, so line numbers stay true;
      // past COUNT_LIMIT the count stops, and numbers start at the window.
      if (start <= TRAIL_COUNT_LIMIT) {
        const chunk = Buffer.alloc(64 * 1024);
        for (let offset = 0; offset < start; offset += chunk.length) {
          const { bytesRead: read } = await handle.read(chunk, 0, Math.min(chunk.length, start - offset), offset);
          for (let index = 0; index < read; index += 1) if (chunk[index] === 10) firstLine += 1;
        }
      } else {
        numbered = false;
      }
      // The window starts inside a line unless the byte before it ends one.
      const before = Buffer.alloc(1);
      await handle.read(before, 0, 1, start - 1);
      if (before[0] !== 10) {
        const lineBreak = source.indexOf('\n');
        source = lineBreak < 0 ? '' : source.slice(lineBreak + 1);
        firstLine += 1;
      }
    }
  } finally { await handle.close(); }
  const at = now instanceof Date ? now.getTime() : Number(now);
  const newest = new Map();
  const malformed = [];
  source.split('\n').forEach((line, index) => {
    if (!line.trim()) return;
    let entry;
    try { entry = JSON.parse(line); } catch { malformed.push(firstLine + index); return; }
    const valid = entry && typeof entry === 'object' && !Array.isArray(entry)
      && typeof entry.run === 'string' && entry.run && typeof entry.kind === 'string' && entry.kind
      && typeof entry.ts === 'string' && !Number.isNaN(Date.parse(entry.ts));
    if (!valid) { malformed.push(firstLine + index); return; }
    newest.set(entry.run, entry);
  });
  const runs = [...newest].map(([id, last]) => {
    const ended = last.kind === 'end';
    return { id, ended, live: !ended && at - Date.parse(last.ts) <= staleHours * HOUR_MS, last };
  });
  return { runs, malformed, truncated, numbered };
}

// ---- The write (§3).

function taskPath(value, field) {
  if (typeof value !== 'string' || value.includes('\\') || value.includes('\0')) refuse('BAD_INPUT', `${field} must be a task file path`);
  if (LEGACY_FOLDERS.some((folder) => value.startsWith(folder))) {
    refuse('LEGACY_BOARD', `This board is in ${value.slice(0, value.indexOf('/'))}/, an older folder name. AGE Aris acts only on AA/ boards.`);
  }
  const name = value.slice(value.lastIndexOf('/') + 1);
  if (!TASK_FOLDERS.has(value.slice(0, value.lastIndexOf('/'))) || !TASK_NAME.test(name) || !name.endsWith('.md')) {
    refuse('BAD_INPUT', `${field} must be a task file in AA/backlog, AA/tasks or AA/tasks/done`);
  }
  return value;
}

function markerFile(dataDir, projectId) {
  if (typeof dataDir !== 'string' || !dataDir) throw new TypeError('dataDir is required');
  if (typeof projectId !== 'string' || !/^[0-9A-Za-z-]{1,64}$/.test(projectId)) throw new TypeError('projectId is invalid');
  return join(dataDir, 'tracked-inflight', `${projectId}.json`);
}

// The fields of a write that survive a crash.
const MARKER_FIELDS = ['phase', 'dir', 'gitDir', 'commonDir', 'format', 'branch', 'from', 'to', 'mode', 'H', 'C', 'B', 'Hb', 'nonce', 'lockIno', 'aside', 'temp', 'S', 'N', 'madeDirs', 'startedAt', 'reason'];

async function writeMarker(write) {
  const marker = Object.fromEntries(MARKER_FIELDS.filter((key) => write[key] !== undefined).map((key) => [key, write[key]]));
  await mkdir(dirname(write.markerPath), { recursive: true });
  const temporary = `${write.markerPath}.${randomBytes(6).toString('hex')}.tmp`;
  await writeFile(temporary, `${JSON.stringify(marker, null, 2)}\n`, { flag: 'wx' });
  await rename(temporary, write.markerPath);
}

function lockPath(write) {
  return join(write.gitDir, 'index.lock');
}

// Whether git's index lock is still the one this write took: the same inode
// as the open descriptor, still starting with its nonce.
async function lockIsOurs(write) {
  if (!write.handle) return false;
  try {
    const [own, current] = await Promise.all([write.handle.stat(), lstat(lockPath(write))]);
    if (own.ino !== current.ino) return false;
  } catch { return false; }
  return (await readHead(lockPath(write))).startsWith(`agesight ${write.nonce}\n`);
}

// `index.lock`, if its inode and nonce are this write's (or the marker's,
// after a crash).
async function lockMatches(write) {
  try {
    if ((await lstat(lockPath(write))).ino !== write.lockIno) return false;
  } catch { return false; }
  return (await readHead(lockPath(write))).startsWith(`agesight ${write.nonce}\n`);
}

async function takeLock(write) {
  let handle;
  try {
    handle = await open(lockPath(write), fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_WRONLY | fsConstants.O_NOFOLLOW, 0o644);
  } catch (error) {
    if (error?.code === 'EEXIST') return false;
    throw error;
  }
  // A lock without its nonce could never be told apart from someone else's,
  // so a failure before it is complete takes it away again.
  try {
    const nonce = randomBytes(16).toString('hex');
    await write.seams?.lockOpened?.();
    await handle.write(`agesight ${nonce}\n`);
    const { ino } = await handle.stat();
    Object.assign(write, { handle, nonce, lockIno: ino, lockedAt: Date.now() });
    return true;
  } catch (error) {
    // Only the file this descriptor opened: someone may have taken the lock
    // since.
    try {
      const [own, current] = await Promise.all([handle.stat(), lstat(lockPath(write))]);
      if (own.ino === current.ino) await unlink(lockPath(write));
    } catch { /* already gone, or not ours */ }
    await handle.close().catch(() => {});
    throw error;
  }
}

// Adopt a lock this write left behind when it died: same inode, same nonce.
async function adoptLock(write) {
  if (!await lockMatches(write)) return false;
  let handle;
  try { handle = await open(lockPath(write), fsConstants.O_RDWR | fsConstants.O_NOFOLLOW); } catch { return false; }
  if ((await handle.stat()).ino !== write.lockIno) {
    await handle.close();
    return false;
  }
  write.handle = handle;
  write.lockedAt = Date.now();
  return true;
}

function repoPath(write, relative) {
  return join(write.dir, ...relative.split('/'));
}

// Every folder from the repository's top down to `relative`'s folder must be a
// real folder: rename, link, mkdir and writeFile follow a symbolic link in any
// component but the last, so a linked AA/ or AA/tasks/ (committed by a hostile
// repository, or made in its working tree) would let a write land outside the
// repository. A folder that does not exist yet is allowed; mkdir makes real
// ones, and only below folders checked here.
async function assertRealFolders(dir, relative) {
  const parts = relative.split('/').slice(0, -1);
  let current = dir;
  for (let index = 0; index < parts.length; index += 1) {
    current = join(current, parts[index]);
    let info;
    try { info = await lstat(current); } catch (error) {
      if (error?.code === 'ENOENT') return;
      throw error;
    }
    if (!info.isDirectory()) {
      refuse('UNSUPPORTED_REPO', `${parts.slice(0, index + 1).join('/')} in ${dir} is not a real folder (a symbolic link?); AGE Aris writes only inside the repository.`);
    }
  }
}

function indexInfo(write) {
  const zero = '0'.repeat(write.format === 'sha256' ? 64 : 40);
  const lines = [`${write.mode} ${write.B}\t${write.to}\0`];
  if (write.from !== write.to) lines.push(`0 ${zero}\t${write.from}\0`);
  return lines.join('');
}

// An index file holding `base` (HEAD's tree, or a copy of the real index) with
// this write's change applied: the new blob at <to>, and <from> removed on a
// move.
async function buildIndex(write, file, base) {
  await rm(`${file}.lock`, { force: true });
  await rm(file, { force: true });
  const env = { GIT_INDEX_FILE: file };
  if (base === 'head') await write.run(['read-tree', write.H], { env });
  else await copyFile(join(write.gitDir, 'index'), file);
  await write.run(['update-index', '-z', '--index-info'], { env, input: indexInfo(write) });
}

function stale(write, why) {
  return new TrackedError(409, 'STALE', `${basename(write.to)} changed while AGE Aris acted (${why}); nothing was changed.`, 'Refresh the task, then try again.');
}

// Step 6, idempotent: the old file renamed aside and checked, then the new one
// created with link(), which fails if anything is at <to>. Called again by the
// settle rule, and by recovery after a crash, from wherever it stopped.
async function finishWorktree(write) {
  const from = repoPath(write, write.from);
  const to = repoPath(write, write.to);
  const moving = write.from !== write.to;
  if (await fileBlob(to, write.format) === write.B) {
    if (moving && await present(from)) throw stale(write, `${write.from} is back`);
    return;
  }
  await assertRealFolders(write.dir, write.from);
  if (await present(from)) {
    // An aside already there is never overwritten: it may be the only copy.
    if (await present(write.aside)) throw stale(write, `${write.from} was written meanwhile`);
    await rename(from, write.aside);
  }
  if (await fileBlob(write.aside, write.format) !== write.Hb) throw stale(write, `${write.from} was written meanwhile`);
  write.content ??= (await write.run(['cat-file', 'blob', write.B])).stdout;
  await assertRealFolders(write.dir, write.to);
  let folder = dirname(to);
  const missing = [];
  while (!await present(folder)) { missing.unshift(folder); folder = dirname(folder); }
  for (const path of missing) {
    await mkdir(path);
    write.madeDirs = [...(write.madeDirs || []), path];
  }
  await assertRealFolders(write.dir, write.to);
  await writeFile(write.temp, write.content, { flag: 'wx', mode: write.mode === '100755' ? 0o755 : 0o644 });
  try {
    await link(write.temp, to);
  } catch (error) {
    if (error?.code === 'EEXIST') throw stale(write, `${write.to} was created meanwhile`);
    throw error;
  } finally {
    await rm(write.temp, { force: true });
  }
  if (moving && await present(from)) throw stale(write, `${write.from} was created meanwhile`);
}

// Put the renamed-aside file back at <from> if nothing is there now.
async function putBack(write) {
  await rm(write.temp, { force: true });
  if (!await present(write.aside)) return;
  await assertRealFolders(write.dir, write.from);
  try {
    await link(write.aside, repoPath(write, write.from));
    await unlink(write.aside);
  } catch (error) {
    if (error?.code !== 'EEXIST') throw error;
  }
}

// Undo step 6: remove a <to> holding the new blob, then put <from> back.
async function restoreWorktree(write) {
  const to = repoPath(write, write.to);
  const moving = write.from !== write.to;
  await assertRealFolders(write.dir, write.to);
  if (await fileBlob(to, write.format) === write.B && (moving || await present(write.aside))) await unlink(to);
  await putBack(write);
  for (const path of [...(write.madeDirs || [])].reverse()) await rmdir(path).catch(() => {});
}

// Step 7: a fresh index from the real one, renamed over .git/index while the
// lock is ours, and then the lock released. A crash between the two leaves the
// lock with this write's inode and nonce, which recovery removes.
async function installIndex(write) {
  if (!write.nReady) await buildIndex(write, write.N, 'index');
  write.nReady = false;
  if (!await lockIsOurs(write)) throw new TrackedError(409, 'GIT_BUSY', 'Another process took git\'s index lock; nothing was changed.', 'Try again once the other git command has finished.');
  await rename(write.N, join(write.gitDir, 'index'));
  write.installed = true;
  await write.seams.installed?.(seamInfo(write));
  // The write is in; a lock that will not go is left to release() and recovery.
  if (await lockIsOurs(write)) await unlink(lockPath(write)).catch(() => {});
}

async function readRef(write) {
  return text(await write.run(['rev-parse', '--verify', '-q', write.branch], { allowFailure: true }));
}

function refLockPath(write) {
  return join(write.commonDir, ...write.branch.split('/')) + '.lock';
}

// The third outcome: AGE Aris stops, keeps the marker for the operator, and
// touches nothing but its own renamed file: put back when the new file was
// never written (so the task does not vanish from the working tree), kept
// aside and named otherwise.
async function interrupted(write, why) {
  const written = await fileBlob(repoPath(write, write.to), write.format).catch(() => null) === write.B;
  if (!written) await putBack(write).catch(() => {});
  const notes = [];
  if (written && await present(write.aside)) notes.push(`AGE Aris's copy of the old file is ${write.aside}`);
  if (await present(refLockPath(write))) notes.push(`${refLockPath(write)} was left by a timed-out git call; delete it once no git command is running there`);
  if (await present(lockPath(write)) && !await lockIsOurs(write)) notes.push(`${lockPath(write)} is not AGE Aris's`);
  // Without C nothing can have been committed, even before H was read.
  const ref = write.C ? await readRef(write).catch(() => '') : null;
  const head = !write.C || ref === write.H ? `Nothing was committed, but ${why}`
    : !ref ? `AGE Aris may have committed ${write.C.slice(0, 7)} (the branch could not be read), but ${why}`
      : `Committed ${write.C.slice(0, 7)}, but ${why}`;
  write.phase = 'interrupted';
  write.reason = `${head}. Check git status for ${basename(write.to)} in ${write.dir}.${notes.length ? ` ${notes.join('. ')}.` : ''}`;
  await writeMarker(write);
  return { outcome: 'interrupted', error: new TrackedError(500, 'INTERRUPTED', write.reason, notes.join('. ')) };
}

// The settle rule (§3, R4): after any failure past the CAS, and in recovery,
// the ref's value decides. At H nothing was published: undo the working tree.
// At C: finish the write if the lock is still ours and the working tree can be
// finished, else roll the ref back by CAS and undo. Anywhere else, or when the
// CAS back is lost twice, the write is interrupted. Returns { outcome,
// error? } with outcome 'committed', 'unchanged' or 'interrupted'.
export async function settle(write, cause) {
  write.deadline = (write.lockedAt ?? Date.now()) + write.limits.hold;
  // N is rebuilt from the index as it is now; an earlier one may be partial.
  write.nReady = false;
  try {
    if (cause?.timedOut && await present(refLockPath(write))) return interrupted(write, 'a git call timed out');
    for (let round = 0; round < 2; round += 1) {
      const ref = await readRef(write);
      if (ref === write.H) {
        await restoreWorktree(write);
        return { outcome: 'unchanged' };
      }
      if (ref !== write.C || !write.C) return interrupted(write, `${write.branch.slice(11)} moved before AGE Aris finished`);
      if (await lockIsOurs(write)) {
        try {
          await finishWorktree(write);
          await installIndex(write);
          return { outcome: 'committed' };
        } catch (error) {
          if (error?.crash) throw error;
          if (error?.timedOut) return interrupted(write, 'a git call timed out');
        }
      }
      await write.seams.beforeRollback?.(seamInfo(write));
      const back = await write.run(['update-ref', '-m', 'AGE Aris: roll back', write.branch, write.H, write.C], { allowFailure: true });
      if (back.code === 0) {
        await restoreWorktree(write);
        return { outcome: 'unchanged' };
      }
    }
    return interrupted(write, `${write.branch.slice(11)} moved before AGE Aris could roll back`);
  } catch (error) {
    if (error?.crash) throw error;
    return interrupted(write, error?.timedOut ? 'a git call timed out' : `settling failed (${error?.message})`);
  }
}

function seamInfo(write) {
  return { dir: write.dir, gitDir: write.gitDir, branch: write.branch, H: write.H, C: write.C, B: write.B, lock: lockPath(write) };
}

// Step 8: whatever the outcome, scratch files go; the renamed file goes once
// the outcome is settled; the lock goes only if it is still ours; the marker
// goes unless the write was interrupted.
async function release(write, outcome) {
  await write.seams?.beforeRelease?.();
  for (const file of [write.S, write.N]) {
    if (!file) continue;
    await rm(file, { force: true });
    await rm(`${file}.lock`, { force: true });
  }
  await rm(write.temp, { force: true });
  if (outcome !== 'interrupted') await rm(write.aside, { force: true });
  if (write.handle && await lockIsOurs(write)) await unlink(lockPath(write)).catch(() => {});
  else if (!write.handle && await lockMatches(write)) await unlink(lockPath(write)).catch(() => {});
  if (outcome !== 'interrupted') await rm(write.markerPath, { force: true });
}

// The caller's check, raced against the hold: one that does not settle in time
// counts as a timed-out call.
async function withinDeadline(write, promise) {
  let timer;
  const expired = new Promise((_resolve, reject) => {
    timer = setTimeout(() => reject(Object.assign(new Error('the checks did not finish in time'), { timedOut: true })), Math.max(0, write.deadline - Date.now()));
  });
  // A check that fails after it lost the race has nobody left to tell.
  Promise.resolve(promise).catch(() => {});
  try {
    return await Promise.race([promise, expired]);
  } finally {
    clearTimeout(timer);
  }
}

// What a git ls-tree or ls-files -s line says, by path.
function entries(output, { stage = false } = {}) {
  const found = new Map();
  for (const record of output.toString('utf8').split('\0')) {
    const tab = record.indexOf('\t');
    if (tab < 0) continue;
    const fields = record.slice(0, tab).split(' ');
    const path = record.slice(tab + 1);
    const entry = stage ? { mode: fields[0], id: fields[1], stage: fields[2] } : { mode: fields[0], type: fields[1], id: fields[2] };
    found.set(path, [...(found.get(path) || []), entry]);
  }
  return found;
}

// Step 3, against HEAD as it is now, under the lock: the branch, the file in
// HEAD, the caller's checks (§4), then the file identical in the working tree,
// the index and HEAD, and <to> free.
async function checkUnderLock(write, attempt, check) {
  await assertRealFolders(write.dir, write.from);
  await assertRealFolders(write.dir, write.to);
  const branch = text(await write.run(['symbolic-ref', '-q', 'HEAD'], { allowFailure: true }));
  if (branch !== write.branch) {
    if (!branch) refuse('GIT_BUSY', `${write.dir} has a detached HEAD.`, 'Check out the pinned branch, then try again.');
    refuse('WRONG_BRANCH', `${write.dir} is on ${branch.slice(11)}; task actions commit to ${write.branch.slice(11)}.`, 'Switch back, or switch actions off and on to pin this branch.');
  }
  const operation = await operationIn(write.gitDir);
  if (operation) refuse('GIT_BUSY', `${write.dir} is in the middle of ${OPERATION_WORDS[operation]}.`, 'Finish it, then try again.');
  write.H = text(await write.run(['rev-parse', '--verify', 'HEAD^{commit}']));
  const moving = write.from !== write.to;
  const tree = entries((await write.run(['ls-tree', '-z', write.H, '--', write.from, ...(moving ? [write.to] : [])])).stdout);
  const inHead = tree.get(write.from)?.[0];
  if (!inHead) refuse('NOT_COMMITTED', `${basename(write.from)} is not committed yet.`, 'Commit it, then try again.');
  if (inHead.type !== 'blob' || !['100644', '100755'].includes(inHead.mode)) refuse('DIRTY_FILE', `${write.from} is not a regular file in ${write.dir}.`);
  write.mode = inHead.mode;
  write.Hb = inHead.id;
  const content = (await write.run(['cat-file', 'blob', write.Hb])).stdout;
  if (check) await withinDeadline(write, check({
    head: write.H,
    branch: write.branch,
    attempt,
    blob: write.Hb,
    content: content.toString('utf8'),
    // A file at HEAD, or null.
    read: async (path) => {
      const result = await write.run(['cat-file', 'blob', `${write.H}:${path}`], { allowFailure: true });
      return result.code === 0 ? result.stdout.toString('utf8') : null;
    },
    // The names directly in a folder at HEAD.
    list: async (folder) => {
      const result = await write.run(['ls-tree', '-z', '--name-only', write.H, '--', `${folder.replace(/\/+$/, '')}/`]);
      return result.stdout.toString('utf8').split('\0').filter(Boolean).map((path) => path.slice(path.lastIndexOf('/') + 1));
    },
  }));
  if (write.firstHb && write.firstHb !== write.Hb) throw stale(write, 'it changed in a new commit');
  write.firstHb = write.Hb;
  const dirty = () => refuse('DIRTY_FILE', `${basename(write.from)} has uncommitted changes in ${write.dir}.`, 'Commit or discard them, then try again.');
  if (moving && tree.has(write.to)) dirty();
  const index = entries((await write.run(['ls-files', '-s', '-z', '--', write.from, ...(moving ? [write.to] : [])])).stdout, { stage: true });
  const staged = index.get(write.from) || [];
  if (staged.length !== 1 || staged[0].stage !== '0' || staged[0].id !== write.Hb || staged[0].mode !== write.mode) dirty();
  if (moving && index.has(write.to)) dirty();
  if (await fileBlob(repoPath(write, write.from), write.format) !== write.Hb) dirty();
  if (moving && await present(repoPath(write, write.to))) dirty();
}

// Commit one task-file change (§3 steps 1–8). `from` and `to` are paths in the
// repository (`AA/tasks/T012-x.md`), equal for an in-place change; `content`
// is the new file; `message` the whole commit message; `branch` the pinned ref
// (`refs/heads/main`); `identity` { name, email }, else the repository's own.
// `check(head)` runs the §4 checks under the lock on every attempt and refuses
// by throwing. `dataDir` and `projectId` name the in-flight marker.
// Returns { commit, branch, warnings } or throws a TrackedError.
//
// `seams` are for tests: `locked`, `beforeCas`, `afterCas`, `afterWorktree`
// and `beforeRollback` are awaited at those points (an error with `crash: true`
// stops the write as a dead process would, with no cleanup); `spawn` replaces
// git's spawn; `timeouts` overrides LIMITS.
export async function commitTaskChange(dir, { from, to = from, content, message, identity, branch, check, dataDir, projectId, seams = {} } = {}) {
  if (process.env.AGESIGHT_TRACKED_WRITES === '0') refuse('ACTIONS_OFF', 'Task actions are off: AGESIGHT_TRACKED_WRITES=0.');
  taskPath(from, 'from');
  taskPath(to, 'to');
  if (basename(from) !== basename(to)) refuse('BAD_INPUT', 'A task file keeps its name when it moves.');
  if (typeof branch !== 'string' || !branch.startsWith('refs/heads/') || branch.length <= 11) refuse('BAD_INPUT', 'branch must be a refs/heads/ ref');
  if (typeof message !== 'string' || !message.trim() || message.includes('\0')) refuse('BAD_INPUT', 'message is required');
  const bytes = Buffer.isBuffer(content) ? content : typeof content === 'string' ? Buffer.from(content, 'utf8') : null;
  if (!bytes || bytes.length > TASK_LIMIT) refuse('BAD_INPUT', 'content must be a task file of at most 1 MB');
  const root = resolve(dir);
  const markerPath = markerFile(dataDir, projectId);
  if (active.has(root)) refuse('GIT_BUSY', `AGE Aris is already writing to ${root}.`, 'Try again in a moment.');
  active.add(root);
  const limits = { ...LIMITS, ...seams.timeouts };
  const clock = { deadline: Infinity };
  const write = { dir: root, branch, from, to, content: bytes, limits, seams, markerPath };
  let outcome = 'refused';
  let crashed = false;
  const warnings = [];
  try {
    // 1. Preflight, outside the lock (advisory).
    for (const earlier of await recover(dataDir, root, { includeActive: true, seams })) {
      if (earlier.outcome === 'interrupted') throw new TrackedError(409, 'INTERRUPTED_PENDING', `An earlier task action in ${root} was interrupted: ${earlier.message}`, `Check it, then remove ${earlier.marker}.`);
      if (earlier.outcome === 'pending') refuse('GIT_BUSY', `An earlier task action in ${root} is not settled yet: git's index lock is held.`, 'Try again once the other git command has finished.');
      warnings.push({ code: 'INTERRUPTED_RECOVERED', message: `An earlier task action was settled first (${earlier.outcome}).` });
    }
    const outside = gitRunner(root, join(root, '.git'), clock, { spawn: seams.spawn });
    const info = await probeRepository(root, { quick: true, spawn: seams.spawn });
    Object.assign(write, { gitDir: info.gitDir, commonDir: info.commonDir, format: info.format });
    const state = await repoState(root, { run: outside, gitDir: info.gitDir });
    if (!state.branch) refuse('GIT_BUSY', `${root} has a detached HEAD.`, 'Check out the pinned branch, then try again.');
    if (state.branch !== branch) refuse('WRONG_BRANCH', `${root} is on ${state.branch.slice(11)}; task actions commit to ${branch.slice(11)}, the branch pinned when they were switched on.`, 'Switch back, or switch actions off and on to pin this branch.');
    if (state.operation) refuse('GIT_BUSY', `${root} is in the middle of ${OPERATION_WORDS[state.operation]}.`, 'Finish it, then try again.');
    if (state.locked) refuse('GIT_BUSY', `Git's index lock is held in ${root}.`, 'Try again once the other git command has finished.');
    const name = identity?.name ?? text(await outside(['config', 'user.name'], { allowFailure: true }));
    const email = identity?.email ?? text(await outside(['config', 'user.email'], { allowFailure: true }));
    if (!name) refuse('NO_IDENTITY', `Set git user.name in ${root}; AGE Aris commits as you.`);
    const filtersOff = await filterOff(outside);
    const env = { GIT_AUTHOR_NAME: name, GIT_AUTHOR_EMAIL: email, GIT_COMMITTER_NAME: name, GIT_COMMITTER_EMAIL: email };

    // 2. Lock, then marker.
    if (!await takeLock(write)) refuse('GIT_BUSY', `Git's index lock is held in ${root}.`, 'Try again once the other git command has finished.');
    clock.deadline = write.lockedAt + limits.hold - limits.reserve;
    write.run = gitRunner(root, write.gitDir, clock, { limits, spawn: seams.spawn, config: filtersOff });
    Object.defineProperty(write, 'deadline', { get: () => clock.deadline, set: (value) => { clock.deadline = value; } });
    const at = (name) => join(write.gitDir, `agesight-${name}-${write.nonce}`);
    Object.assign(write, {
      phase: 'locked', startedAt: new Date().toISOString(), S: at('S'), N: at('N'),
      aside: join(dirname(repoPath(write, from)), `.${basename(from)}.agesight-${write.nonce}`),
      temp: join(dirname(repoPath(write, to)), `.${basename(to)}.agesight-${write.nonce}.tmp`),
    });
    await writeMarker(write);
    await seams.locked?.(seamInfo(write));

    // 3–5. Check, build, publish; a lost CAS re-runs every check.
    const subject = message.split('\n')[0].trim();
    let published = false;
    try {
      for (let attempt = 1; ; attempt += 1) {
        await checkUnderLock(write, attempt, check);
        write.B = text(await write.run(['hash-object', '-w', '--no-filters', '--stdin'], { input: bytes }));
        if (write.B !== blobId(bytes, write.format)) throw new TrackedError(500, 'GIT_FAILED', 'Git stored different bytes than AGE Aris gave it.');
        if (from === to && write.B === write.Hb) refuse('BAD_INPUT', `The change leaves ${basename(from)} as it is.`);
        await buildIndex(write, write.S, 'head');
        const tree = text(await write.run(['write-tree'], { env: { GIT_INDEX_FILE: write.S } }));
        await buildIndex(write, write.N, 'index');
        write.nReady = true;
        write.C = text(await write.run(['commit-tree', '--no-gpg-sign', tree, '-p', write.H], { env, input: message.endsWith('\n') ? message : `${message}\n` }));
        await seams.beforeCas?.(seamInfo(write));
        write.phase = 'publishing';
        await writeMarker(write);
        published = true;
        const result = await write.run(['update-ref', '-m', `AGE Aris: ${subject}`, branch, write.C, write.H], { allowFailure: true });
        if (result.code === 0) break;
        const ref = await readRef(write);
        if (ref === write.C) break;
        published = false;
        write.phase = 'locked';
        write.nReady = false;
        delete write.C;
        await writeMarker(write);
        if (ref === write.H) refuse('GIT_BUSY', `${branch.slice(11)} could not be updated in ${root}: ${redactEmails(result.stderr.trim())}`, 'Try again once the other git command has finished.');
        if (attempt >= 3) throw stale(write, `${branch.slice(11)} kept moving`);
      }
      await seams.afterCas?.(seamInfo(write));
      if (await readRef(write) !== write.C) throw new Error('the branch moved');
      // 6. The working tree.
      await finishWorktree(write);
      write.phase = 'worktree';
      await writeMarker(write);
      await seams.afterWorktree?.(seamInfo(write));
      // 7. The index, if the lock and the branch are still as AGE Aris left them.
      if (await readRef(write) !== write.C) throw new Error('the branch moved');
      await installIndex(write);
      outcome = 'committed';
      return { commit: write.C, branch, warnings };
    } catch (error) {
      if (error?.crash) throw error;
      if (!published) {
        if (error?.timedOut) {
          if (await present(refLockPath(write))) {
            const result = await interrupted(write, 'a git call timed out');
            outcome = result.outcome;
            throw result.error;
          }
          refuse('GIT_BUSY', `Git did not answer in time in ${root}; nothing was changed.`, 'Try again.');
        }
        throw error;
      }
      const settled = await settle(write, error);
      outcome = settled.outcome;
      if (settled.outcome === 'committed') return { commit: write.C, branch, warnings };
      if (settled.error) throw settled.error;
      if (error instanceof TrackedError) throw error;
      if (error?.timedOut) refuse('GIT_BUSY', `Git did not answer in time in ${root}; nothing was changed.`, 'Try again.');
      throw stale(write, error?.message || 'the write could not finish');
    }
  } catch (error) {
    if (error?.crash) crashed = true;
    throw error;
  } finally {
    try {
      if (!crashed && write.lockIno !== undefined) await release(write, outcome);
    } catch (error) {
      if (outcome !== 'committed') throw error;
      // The commit stands; the result it is about to return says so, and
      // carries this warning in the same `warnings` array.
      warnings.push({ code: 'CLEANUP_FAILED', message: `Committed ${write.C.slice(0, 7)}, but cleaning up after it failed (${error?.message}); the next action in ${root} finishes it.` });
    } finally {
      await write.handle?.close().catch(() => {});
      active.delete(root);
    }
  }
}

// ---- Recovery: idempotent, run at start and before every action.

async function recoverOne(markerPath, marker, { seams = {} } = {}) {
  const limits = { ...LIMITS, ...seams.timeouts };
  const clock = { deadline: Infinity };
  const config = await filterOff(gitRunner(marker.dir, marker.gitDir, { deadline: Infinity }, { spawn: seams.spawn }));
  const write = { ...marker, markerPath, limits, seams, run: gitRunner(marker.dir, marker.gitDir, clock, { limits, spawn: seams.spawn, config }) };
  Object.defineProperty(write, 'deadline', { get: () => clock.deadline, set: (value) => { clock.deadline = value; } });
  if (marker.phase === 'locked') {
    // Nothing was published: remove the lock if it is the one this write left
    // (inode and nonce), put back a renamed file, and forget the write.
    await putBack(write);
    await release(write, 'unchanged');
    return { outcome: 'unchanged' };
  }
  const moving = write.from !== write.to;
  const index = entries((await write.run(['ls-files', '-s', '-z', '--', write.to, ...(moving ? [write.from] : [])])).stdout, { stage: true });
  const finished = await readRef(write) === write.C
    && index.get(write.to)?.length === 1 && index.get(write.to)[0].id === write.B && !(moving && index.has(write.from))
    && await fileBlob(repoPath(write, write.to), write.format) === write.B && !(moving && await present(repoPath(write, write.from)));
  if (finished) {
    await release(write, 'committed');
    return { outcome: 'committed' };
  }
  if (!await adoptLock(write)) {
    if (!await takeLock(write)) return { outcome: 'pending' };
    await writeMarker(write);
  }
  clock.deadline = write.lockedAt + limits.hold;
  let outcome = 'interrupted';
  try {
    const result = await settle(write, null);
    outcome = result.outcome;
    return result.error ? { outcome, message: result.error.message } : { outcome };
  } finally {
    try {
      await release(write, outcome);
    } finally {
      await write.handle?.close().catch(() => {});
    }
  }
}

async function recover(dataDir, dir, { includeActive = false, seams } = {}) {
  const folder = join(dataDir, 'tracked-inflight');
  let names;
  try { names = await readdir(folder); } catch (error) {
    if (error?.code === 'ENOENT') return [];
    throw error;
  }
  const results = [];
  for (const name of names.filter((entry) => entry.endsWith('.json')).sort()) {
    const markerPath = join(folder, name);
    let marker;
    try { marker = JSON.parse(await readFile(markerPath, 'utf8')); } catch { continue; }
    if (!marker || typeof marker.dir !== 'string') continue;
    if (dir && resolve(marker.dir) !== resolve(dir)) continue;
    if (!includeActive && active.has(resolve(marker.dir))) continue;
    if (marker.phase === 'interrupted') {
      results.push({ marker: markerPath, dir: marker.dir, outcome: 'interrupted', message: marker.reason || '' });
      continue;
    }
    results.push({ marker: markerPath, dir: marker.dir, ...await recoverOne(markerPath, marker, { seams }) });
  }
  return results;
}

// Settle every write a dead process left in flight (for one repository when
// `dir` is given). Returns [{ marker, dir, outcome, message? }]: 'committed'
// or 'unchanged' (settled; the marker is gone), 'interrupted' (left for the
// operator), or 'pending' (someone else holds git's index lock; retried next
// time). Running it twice leaves the same state.
export async function recoverInflight(dataDir, dir) {
  return recover(dataDir, dir);
}
