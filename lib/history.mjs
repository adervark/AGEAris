import { lstat, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { agentIdentity, gitStream, isUiClaim, parseOwner, parseTaskMarkdown, taskState } from './workspace.mjs';

export { agentIdentity, isUiClaim, parseOwner };

// The transition ledger: every task's history derived from the project's git
// history (first-parent, committer time clamped so it never decreases). It is
// the record the metrics read; it can always be rebuilt, so it is only kept in
// memory. docs/METRICS.md states the rules; plan §4.4 is the derivation.

const SCHEMA = 1;
// The paths the ledger reads in an AgeAris project; a commit touching none of
// them cannot change it.
export const LEDGER_PATHS = ['deaddrop/backlog', 'deaddrop/tasks', 'deaddrop/checkpoints', 'project.json', 'pipeline/pipeline.json'];
// The paths it reads in a tracked repository: the board only, under its
// current name and its older one (pm/), so a board renamed in history keeps
// its tasks' past. A project.json there belongs to the repository, not AgeAris.
export const BOARD_PATHS = ['deaddrop/backlog', 'deaddrop/tasks', 'deaddrop/checkpoints', 'pm/backlog', 'pm/tasks', 'pm/checkpoints'];
const TASK_PATH = /^(?:deaddrop|pm)\/(backlog|tasks|tasks\/done)\/(T\d{3,})-[^\x00-\x1f/]*\.md$/;
const TRAIL_PATH = /^(?:deaddrop|pm)\/checkpoints\/(T\d{3,})\.jsonl$/;
// Files AgeAris or git conventions put in the tracked folders that hold no task.
const HARMLESS_PATH = /^(?:deaddrop|pm)\/checkpoints\/_SCHEMA\.md$|(^|\/)\.gitkeep$/;
const MAX_BLOB = 256 * 1024;
const YIELD_EVERY = 250;
const SWEEP = /^(migrate|ckpt):/;
const FIELDS = ['title', 'type', 'priority', 'assignee', 'owner', 'dueDate', 'milestone', 'blockedReason'];
const WIP = new Set(['in_progress', 'blocked']);
const CLOSED = new Set(['done', 'dropped']);
const FALLBACK_LABEL = 'start bounded by first non-sweep commit (cycle time may be understated)';
const LOG_FORMAT = '--format=%x01%H%x1f%cI%x1f%aI%x1f%an%x1f%s%x1f%(trailers:key=Run,valueonly,separator=%x2c)%x1f%(trailers:key=AGESight-Via,valueonly,separator=%x2c)';

// The grouping key of a type, as board.sh normalizes it; "" is untyped.
export function typeKey(value) {
  const text = String(value ?? '').toLowerCase().trim();
  if (/[{}]/.test(text)) return '';
  return text.replace(/[^a-z0-9 _-]/g, '').trim();
}

function toMs(asOf) {
  const ms = asOf instanceof Date ? asOf.getTime() : typeof asOf === 'number' ? asOf : Date.parse(asOf);
  if (Number.isNaN(ms)) throw new TypeError('asOf must be a time');
  return ms;
}

async function gitText(dir, args, spawn) {
  const chunks = [];
  for await (const chunk of gitStream(dir, args, { spawn })) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8').trim();
}

// A cheap key for "the refs may have moved", read without running git and
// without following symlinks: HEAD's content, and the inode, change time,
// modification time, and size of HEAD, the ref it names, and packed-refs. git
// replaces a ref file by renaming a lock file over it, so every ref update
// gives it a new inode even where timestamps are coarse.
export async function fingerprint(dir, { stat = lstat, readFile: read = readFile } = {}) {
  const gitDir = join(dir, '.git');
  const describe = async (path) => {
    try {
      const info = await stat(path, { bigint: true });
      const link = typeof info.isSymbolicLink === 'function' && info.isSymbolicLink() ? ':link' : '';
      return `${info.ino}:${info.ctimeNs}:${info.mtimeNs}:${info.size}${link}`;
    } catch (error) {
      if (error?.code === 'ENOENT' || error?.code === 'ENOTDIR') return 'absent';
      throw error;
    }
  };
  const headInfo = await describe(join(gitDir, 'HEAD'));
  const head = headInfo === 'absent' || headInfo.endsWith(':link') ? '' : String(await read(join(gitDir, 'HEAD'), 'utf8')).trim();
  const ref = /^ref: (refs\/\S+)$/.exec(head)?.[1] || '';
  const refInfo = ref && !ref.split('/').includes('..') ? await describe(join(gitDir, ref)) : 'none';
  // A reftable repository keeps every ref in tables; git renames a new
  // tables.list over the old one on each update (HEAD names refs/heads/.invalid).
  const reftable = await describe(join(gitDir, 'reftable', 'tables.list'));
  return JSON.stringify([head, headInfo, ref, refInfo, await describe(join(gitDir, 'packed-refs')), reftable]);
}

// HEAD, its branch, and the last first-parent commit that touches the ledger's
// paths (the ledger's identity: same ledgerSha, same ledger). `paths` is
// LEDGER_PATHS, or BOARD_PATHS for a tracked repository.
export async function resolveHeads(dir, { spawn, paths = LEDGER_PATHS } = {}) {
  const headSha = await gitText(dir, ['rev-parse', '--verify', '--end-of-options', 'HEAD^{commit}'], spawn);
  let branch = '';
  try { branch = await gitText(dir, ['symbolic-ref', '-q', '--short', 'HEAD'], spawn); } catch { /* detached */ }
  const ledgerSha = await gitText(dir, ['rev-list', '-1', '--first-parent', headSha, '--', ...paths], spawn);
  return { headSha, branch: branch || '(detached)', ledgerSha };
}

// Test hook: re-slices a stream into pieces of at most `size` bytes, so parsers
// are exercised across every possible chunk boundary.
async function* rechunk(stream, size) {
  for await (const chunk of stream) {
    if (!size) { yield chunk; continue; }
    for (let offset = 0; offset < chunk.length; offset += size) yield chunk.subarray(offset, offset + size);
  }
}

// Parses `git log -z --name-status` output with the LOG_FORMAT header into
// commit records. Tokens are NUL-separated; a header token starts with \x01,
// and each status token (preceded by a newline after a header) is followed by
// its path, which is taken verbatim.
async function readLog(stream) {
  const records = [];
  let current = null;
  let status = '';
  const take = (raw) => {
    if (status) {
      current.changes.push({ status, path: raw });
      status = '';
      return;
    }
    const token = raw.startsWith('\n') ? raw.slice(1) : raw;
    if (token.startsWith('\x01')) {
      const fields = token.slice(1).split('\x1f');
      const [sha, committedAt, authoredAt, actor] = fields;
      current = { sha, committedAt, authoredAt, actor, subject: fields.slice(4, -2).join('\x1f'), runId: fields.at(-2) || '', via: fields.at(-1) || '', changes: [] };
      records.push(current);
    } else if (token && current) status = token;
  };
  let rest = Buffer.alloc(0);
  for await (const chunk of stream) {
    const data = rest.length ? Buffer.concat([rest, chunk]) : chunk;
    let start = 0;
    for (let nul = data.indexOf(0, start); nul >= 0; nul = data.indexOf(0, start)) {
      take(data.toString('utf8', start, nul));
      start = nul + 1;
    }
    rest = data.subarray(start);
  }
  if (rest.length) take(rest.toString('utf8'));
  return records;
}

// Parses `git cat-file --batch` output by byte length: a `<oid> <type> <size>`
// header line, then exactly <size> bytes and a newline. Yields one response per
// request, in request order. A blob over MAX_BLOB is cut to what its request's
// mode needs: `head` keeps its first MAX_BLOB bytes (a task's frontmatter is at
// the top), `tail` its last MAX_BLOB + 1 (a trail only grows at the end), and
// `all` keeps nothing; `truncated` says which cut was made.
async function* catFileResponses(stream, modes) {
  let rest = Buffer.alloc(0);
  let body = null;
  let index = 0;
  for await (const chunk of stream) {
    const data = rest.length ? Buffer.concat([rest, chunk]) : chunk;
    rest = Buffer.alloc(0);
    let offset = 0;
    while (offset < data.length) {
      if (body) {
        const take = Math.min(data.length - offset, body.remaining);
        // Only the <size> content bytes are kept, never the closing newline.
        const content = data.subarray(offset, offset + Math.min(take, Math.max(0, body.remaining - 1)));
        body.remaining -= take;
        offset += take;
        if (body.mode === 'whole' || (body.mode === 'head' && body.kept < MAX_BLOB)) {
          const part = body.mode === 'head' ? content.subarray(0, MAX_BLOB - body.kept) : content;
          body.parts.push(part);
          body.kept += part.length;
        } else if (body.mode === 'tail' && content.length) {
          body.parts.push(content);
          body.kept += content.length;
          if (body.kept > 2 * (MAX_BLOB + 1)) {
            body.parts = [Buffer.concat(body.parts).subarray(-(MAX_BLOB + 1))];
            body.kept = MAX_BLOB + 1;
          }
        }
        if (body.remaining > 0) break;
        const { type, size, mode, parts } = body;
        body = null;
        if (mode === 'skip') { yield { type, size, content: null }; continue; }
        const joined = Buffer.concat(parts);
        yield { type, size, content: mode === 'tail' ? joined.subarray(-(MAX_BLOB + 1)) : joined, ...(mode === 'whole' ? {} : { truncated: mode }) };
        continue;
      }
      const newline = data.indexOf(10, offset);
      if (newline < 0) { rest = data.subarray(offset); break; }
      const header = data.toString('utf8', offset, newline);
      offset = newline + 1;
      const requested = modes[index] || 'all';
      index += 1;
      const match = /^\S+ (\S+) (\d+)$/.exec(header);
      if (!match) { yield { missing: true, header }; continue; }
      const size = Number(match[2]);
      const mode = size <= MAX_BLOB ? 'whole' : requested === 'all' ? 'skip' : requested;
      // The body is followed by a newline, read and dropped with it.
      body = { type: match[1], size, remaining: size + 1, mode, parts: [], kept: 0 };
    }
  }
}

// The contents of `<sha>:<path>` blobs in one cat-file process, in order: a
// string, or null for a blob that is missing or whose head was cut (files over
// MAX_BLOB are read from their first MAX_BLOB bytes). Paths must match the
// ledger's strict patterns, as cat-file's input is line-based.
export async function readBlobs(dir, specs, { spawn } = {}) {
  if (!specs.length) return [];
  if (specs.some(({ path }) => !TASK_PATH.test(path) && !TRAIL_PATH.test(path))) throw new TypeError('readBlobs reads task files and trails only');
  const input = specs.map(({ sha, path }) => `${sha}:${path}\n`).join('');
  const results = [];
  for await (const blob of catFileResponses(gitStream(dir, ['cat-file', '--batch'], { spawn, input }), specs.map(() => 'head'))) {
    results.push(blob.missing || blob.type !== 'blob' || !blob.content ? null : blob.content.toString('utf8'));
  }
  return results;
}

function classify(path) {
  let match = TASK_PATH.exec(path);
  if (match) return { kind: 'task', id: match[2], dir: match[1] === 'tasks/done' ? 'done' : match[1] };
  match = TRAIL_PATH.exec(path);
  if (match) return { kind: 'trail', id: match[1] };
  if (path === 'project.json') return { kind: 'project' };
  if (path === 'pipeline/pipeline.json') return { kind: 'pipeline' };
  return { kind: HARMLESS_PATH.test(path) ? 'harmless' : 'unsafe' };
}

// A task file version, normalized: absent keys take their defaults, so a file
// that merely gains a key never differs from its previous version.
function snapshotOf(dir, content, { backlogFolder = true } = {}) {
  const { fields } = parseTaskMarkdown(content);
  const text = (key) => (fields[key] === undefined || fields[key] === null || Array.isArray(fields[key]) ? '' : String(fields[key]));
  const assignee = text('assignee').trim();
  return {
    snapshot: {
      status: taskState(dir, text('status').trim().toLowerCase() || 'open', { backlogFolder }),
      title: text('title'),
      type: text('type'),
      priority: text('priority').trim() || 'medium',
      assignee: assignee === '—' ? '' : assignee,
      owner: parseOwner(text('owner')).raw,
      dueDate: text('dueDate'),
      milestone: text('milestone'),
      blockedReason: text('blockedReason'),
    },
    created: text('createdAt') || text('created'),
  };
}

function claimantOf(owner) {
  const { operator, profile, session } = parseOwner(owner);
  return { operator, profile, session };
}

// Builds the ledger of the repository at `dir` (§4.4). `heads` skips the
// resolve step; `spawn` replaces child_process.spawn; `chunkSize` re-slices
// git's output (a test hook); `onProgress(commitsSeen)` reports a cold build;
// `paths` is LEDGER_PATHS, or BOARD_PATHS for a tracked repository.
export async function buildLedger(dir, { projectId = '', heads, spawn, chunkSize = 0, onProgress, paths = LEDGER_PATHS, backlogFolder = true } = {}) {
  const { headSha, branch, ledgerSha } = heads || await resolveHeads(dir, { spawn, paths });
  const ledger = { schema: SCHEMA, projectId, headSha, ledgerSha, branch, commits: [], tasks: {}, transitions: [], anomalies: [] };
  if (!ledgerSha) return ledger;
  const records = await readLog(rechunk(gitStream(dir, ['log', '--reverse', '--first-parent', '-m', '--no-renames', '--no-color', '--no-show-signature', '--name-status', '-z', LOG_FORMAT, ledgerSha, '--', ...paths], { spawn }), chunkSize));

  // Only paths matching the strict patterns reach cat-file's line-based input.
  const requests = [];
  const modes = [];
  const MODES = { task: 'head', trail: 'tail', project: 'all' };
  for (const record of records) {
    for (const change of record.changes) {
      change.info = classify(change.path);
      change.fetch = change.status !== 'D' && change.info.kind in MODES;
      if (change.fetch) {
        requests.push(`${record.sha}:${change.path}\n`);
        modes.push(MODES[change.info.kind]);
      }
    }
  }
  const responses = requests.length
    ? catFileResponses(rechunk(gitStream(dir, ['cat-file', '--batch'], { spawn, input: requests.join('') }), chunkSize), modes)[Symbol.asyncIterator]()
    : null;

  const { commits, transitions, anomalies } = ledger;
  const present = new Map();
  const lastRemoved = new Map();
  const incarnations = new Map();
  // A file carrying the id of a task already present: path → {id, change}, the
  // latest version of it, promoted if the task's own file is deleted.
  const duplicates = new Map();
  const trails = new Map();
  let project = null;
  let previousMs = -Infinity;
  try {
    for (let seq = 0; seq < records.length; seq += 1) {
      if (seq && seq % YIELD_EVERY === 0) {
        onProgress?.(seq);
        await new Promise((resolve) => setImmediate(resolve));
      }
      const record = records[seq];
      for (const change of record.changes) if (change.fetch) change.blob = (await responses.next()).value;

      const committedMs = Date.parse(record.committedAt);
      const clamped = committedMs < previousMs;
      const at = clamped ? commits[seq - 1].at : record.committedAt;
      if (!clamped) previousMs = committedMs;
      const commit = {
        seq, sha: record.sha, at, committedAt: record.committedAt, authoredAt: record.authoredAt, actor: record.actor,
        subject: record.subject, runId: record.runId, via: record.via, sweep: SWEEP.test(record.subject), clamped, touched: [],
      };
      commits.push(commit);
      const touched = new Set();
      const anomaly = (kind, detail, path) => anomalies.push({ seq, commit: record.sha, kind, detail, ...(path ? { path } : {}) });
      const emit = (taskKey, path, fields) => {
        const transition = { seq, commit: record.sha, at, actor: record.actor, runId: record.runId, via: record.via, sweep: commit.sweep, ...(taskKey ? { taskKey, path } : {}), ...fields };
        transitions.push(transition);
        return transition;
      };
      if (clamped) anomaly('out_of_order_time', `committed ${record.committedAt}, before the previous commit's ${commits[seq - 1].at}; counted at that time`);
      const textOf = (change) => {
        const blob = change.blob;
        if (!blob || blob.missing) { anomaly('missing_blob', `${change.path} could not be read`, change.path); return null; }
        if (blob.type !== 'blob') { anomaly('unsafe_path', `${change.path} is a ${blob.type}, not a file`, change.path); return null; }
        const oversized = () => { anomaly('oversized_blob', `${change.path} is ${blob.size} bytes (limit ${MAX_BLOB})`, change.path); return null; };
        if (!blob.content) return oversized();
        const text = blob.content.toString('utf8');
        // The head of a task file serves only if its frontmatter closes in it.
        if (blob.truncated === 'head') return /^---\r?\n[\s\S]*?\r?\n---(\r?\n|$)/.test(text) ? text : oversized();
        // A trail's tail starts mid-line unless the byte before it ended one.
        if (blob.truncated === 'tail') return text.slice(text.indexOf('\n') + 1);
        return text;
      };
      const currentKey = (id) => present.get(id)?.key || lastRemoved.get(id)?.key || id;

      const taskChanges = new Map();
      const trailChanges = [];
      for (const change of record.changes) {
        const { kind, id } = change.info;
        if (kind === 'task') {
          if (!taskChanges.has(id)) taskChanges.set(id, { deleted: new Set(), written: [] });
          if (change.status === 'D') taskChanges.get(id).deleted.add(change.path);
          else taskChanges.get(id).written.push(change);
        } else if (kind === 'trail') trailChanges.push(change);
        else if (kind === 'unsafe') anomaly('unsafe_path', `${change.path} is not a task file, a checkpoint trail, or project metadata; skipped`, change.path);
        else if (kind === 'pipeline') emit('', '', { kind: 'project', change: 'pipeline' });
        else if (kind === 'project') {
          if (change.status === 'D') { project = null; continue; }
          const text = textOf(change);
          if (text === null) continue;
          let next;
          try { next = JSON.parse(text); } catch { anomaly('unparseable_project', 'project.json is not valid JSON', change.path); continue; }
          if (!project) emit('', '', { kind: 'project', change: 'created', to: String(next?.name ?? '') });
          else {
            const renamed = project.name !== next?.name;
            const limited = project.wipLimit !== next?.wipLimit;
            if (renamed) emit('', '', { kind: 'project', change: 'renamed', from: String(project.name ?? ''), to: String(next?.name ?? '') });
            if (limited) emit('', '', { kind: 'project', change: 'wipLimit', from: project.wipLimit ?? null, to: next?.wipLimit ?? null });
            // Any other edit (the description, …) is still a change to show.
            if (!renamed && !limited && JSON.stringify(project) !== JSON.stringify(next)) emit('', '', { kind: 'project', change: 'edited' });
          }
          project = next && typeof next === 'object' ? next : {};
        }
      }

      for (const id of [...taskChanges.keys()].sort()) {
        const { deleted, written } = taskChanges.get(id);
        for (const path of deleted) duplicates.delete(path);
        const writes = [];
        for (const change of written) {
          if (duplicates.has(change.path)) duplicates.set(change.path, { id, change });
          else writes.push(change);
        }
        const current = present.get(id);
        let target = current
          ? writes.find((change) => change.path === current.path) || (deleted.has(current.path) ? writes[0] : undefined)
          : writes[0];
        for (const change of writes) {
          if (change === target) continue;
          duplicates.set(change.path, { id, change });
          anomaly('duplicate_id', `${change.path} has the id ${id} of a task already present; ignored`, change.path);
        }
        if (!target && current && deleted.has(current.path)) {
          // The task's own file is gone but a duplicate survives: follow it.
          const survivor = [...duplicates].find(([, duplicate]) => duplicate.id === id);
          if (survivor) {
            duplicates.delete(survivor[0]);
            target = survivor[1].change;
          }
        }
        if (!target) {
          if (current && deleted.has(current.path)) {
            touched.add(current.key);
            const transition = emit(current.key, current.path, { kind: 'removed' });
            present.delete(id);
            lastRemoved.set(id, { ...current, transition });
          }
          continue;
        }
        let parsed = null;
        const text = textOf(target);
        if (text !== null) {
          try { parsed = snapshotOf(target.info.dir, text, { backlogFolder }); }
          catch (error) { anomaly('unparseable_task', `${target.path}: ${error.message}`, target.path); }
        }
        if (!parsed) {
          // Keep following the file, but its state stays the last one read.
          if (current) { current.path = target.path; touched.add(current.key); }
          continue;
        }
        const diff = (key, from, to) => {
          if (from.status !== to.status) {
            const entersWip = WIP.has(to.status) && !WIP.has(from.status);
            emit(key, target.path, { kind: 'status', from: from.status, to: to.status, ...(entersWip ? { claimant: claimantOf(to.owner) } : {}) });
          }
          for (const field of FIELDS) if (from[field] !== to[field]) emit(key, target.path, { kind: 'field', field, from: from[field], to: to[field] });
        };
        if (current) {
          diff(current.key, current.snapshot, parsed.snapshot);
          Object.assign(current, { path: target.path, snapshot: parsed.snapshot, created: parsed.created });
          touched.add(current.key);
          continue;
        }
        const last = lastRemoved.get(id);
        if (last && parsed.created && last.created === parsed.created && last.snapshot.title === parsed.snapshot.title) {
          // A split move: removed, then re-added unchanged in identity. Neither
          // half is a removal or an addition.
          last.transition.retracted = true;
          emit(last.key, target.path, { kind: 'created', retracted: true, incarnation: last.incarnation, snapshot: parsed.snapshot });
          diff(last.key, last.snapshot, parsed.snapshot);
          present.set(id, { key: last.key, incarnation: last.incarnation, path: target.path, snapshot: parsed.snapshot, created: parsed.created });
        } else {
          const incarnation = (incarnations.get(id) || 0) + 1;
          incarnations.set(id, incarnation);
          const key = incarnation === 1 ? id : `${id}#${incarnation}`;
          if (incarnation > 1) anomaly('id_reused', `${id} was removed earlier; this file is a new task, ${key}`, target.path);
          const claimant = WIP.has(parsed.snapshot.status) ? { claimant: claimantOf(parsed.snapshot.owner) } : {};
          emit(key, target.path, { kind: 'created', incarnation, snapshot: parsed.snapshot, ...claimant });
          present.set(id, { key, incarnation, path: target.path, snapshot: parsed.snapshot, created: parsed.created });
        }
        lastRemoved.delete(id);
        touched.add(present.get(id).key);
      }

      // A trail moved between boards in one commit (pm/ to deaddrop/) is still
      // the same trail: its deletion at the old path keeps what was read.
      const movedTrails = new Set(trailChanges.filter((change) => change.status !== 'D').map((change) => change.info.id));
      for (const change of trailChanges.sort((a, b) => a.path.localeCompare(b.path))) {
        const { id } = change.info;
        const key = currentKey(id);
        touched.add(key);
        if (change.status === 'D') { if (!movedTrails.has(id)) trails.delete(id); continue; }
        const text = textOf(change);
        if (text === null) continue;
        const before = new Set((trails.get(id) || '').split('\n'));
        trails.set(id, text);
        let newest = -Infinity;
        let blocked = null;
        let unreadable = 0;
        for (const line of text.split('\n')) {
          if (!line.trim() || before.has(line)) continue;
          let entry;
          try { entry = JSON.parse(line); } catch { unreadable += 1; continue; }
          const ms = typeof entry?.ts === 'string' ? Date.parse(entry.ts) : NaN;
          if (Number.isNaN(ms)) { unreadable += 1; continue; }
          newest = Math.max(newest, ms);
          if (entry.kind === 'blocked' && typeof entry.what === 'string') blocked = entry.what;
        }
        if (unreadable) anomaly('unparseable_checkpoint', `${unreadable} new line(s) in ${change.path} are not checkpoint entries`, change.path);
        if (newest > -Infinity) emit(key, change.path, { kind: 'life', source: 'checkpoint', ts: new Date(newest).toISOString(), ...(blocked !== null ? { blocked } : {}) });
      }
      commit.touched = [...touched].sort();
    }
  } finally {
    // A build that stops early must not leave cat-file running.
    await responses?.return?.();
  }
  onProgress?.(records.length);
  ledger.tasks = replay(transitions);
  return ledger;
}

// Task state after `transitions` (a seq prefix of a ledger's transitions).
function replay(transitions) {
  const tasks = {};
  for (const transition of transitions) {
    const task = tasks[transition.taskKey];
    switch (transition.kind) {
      case 'created':
        if (transition.retracted && task) { task.present = true; break; }
        tasks[transition.taskKey] = {
          key: transition.taskKey,
          id: transition.taskKey.replace(/#\d+$/, ''),
          incarnation: transition.incarnation,
          ...transition.snapshot,
          typeKey: typeKey(transition.snapshot.type),
          owner: parseOwner(transition.snapshot.owner),
          createdAt: transition.at,
          present: true,
          trailBlocked: '',
        };
        break;
      case 'status':
        task.status = transition.to;
        break;
      case 'field':
        task[transition.field] = transition.field === 'owner' ? parseOwner(transition.to) : transition.to;
        if (transition.field === 'type') task.typeKey = typeKey(transition.to);
        break;
      case 'removed':
        task.present = false;
        break;
      case 'life':
        if (task && transition.blocked !== undefined) task.trailBlocked = transition.blocked;
        break;
      default:
        break;
    }
  }
  return tasks;
}

// The ledger as it stood at `asOf`: the prefix of commits with `at ≤ asOf`
// (a seq prefix, because `at` never decreases), the task state they give,
// `ledgerHeadAtAsOf`, and how many commits the view leaves out because they are
// dated past `asOf` (they, and every commit after them, count from that time).
export function ledgerAt(ledger, asOf) {
  const limit = toMs(asOf);
  const { commits } = ledger;
  let low = 0;
  let high = commits.length;
  while (low < high) {
    const middle = (low + high) >> 1;
    if (Date.parse(commits[middle].at) <= limit) low = middle + 1;
    else high = middle;
  }
  const transitions = ledger.transitions.filter((transition) => transition.seq < low);
  // A split move's removal is retracted by its re-add; before the re-add it
  // is still a removal.
  transitions.forEach((removal, index) => {
    if (removal.kind !== 'removed' || !removal.retracted) return;
    const reAdd = transitions.some((later, at) => at > index && later.taskKey === removal.taskKey && later.kind === 'created' && later.retracted);
    if (reAdd) return;
    const { retracted, ...unretracted } = removal;
    transitions[index] = unretracted;
  });
  return {
    schema: ledger.schema,
    projectId: ledger.projectId,
    headSha: ledger.headSha,
    ledgerSha: ledger.ledgerSha,
    branch: ledger.branch,
    asOf: new Date(limit).toISOString(),
    ledgerHeadAtAsOf: low ? commits[low - 1].sha : '',
    commits: commits.slice(0, low),
    transitions,
    anomalies: ledger.anomalies.filter((anomaly) => anomaly.seq < low),
    tasks: replay(transitions),
    futureCommits: commits.length - low,
  };
}

// Every task's cycles (§3.0 "Cycle start"), keyed by taskKey, from the ledger
// or, given `asOf`, from ledgerAt(ledger, asOf). A cycle begins at creation or
// at a reopen; its start is its first entry into WIP; its end is the latest
// move into done or dropped. A start in a sweep commit falls back to the first
// later non-sweep commit touching the task while it is in WIP, before the end;
// without one the cycle is excluded. Cycle time never falls back to creation.
// A sweep never supplies a finish either: such an end is marked `sweep` and the
// cycle is excluded, unless its start already excluded it.
export function cycles(ledger, asOf) {
  const view = asOf === undefined ? ledger : ledgerAt(ledger, asOf);
  const byTask = new Map();
  for (const transition of view.transitions) {
    if (!transition.taskKey || transition.kind === 'life' || transition.kind === 'field') continue;
    if (!byTask.has(transition.taskKey)) byTask.set(transition.taskKey, []);
    byTask.get(transition.taskKey).push(transition);
  }
  const result = {};
  for (const [taskKey, list] of byTask) result[taskKey] = cyclesOf(taskKey, list, view.commits);
  return result;
}

function cyclesOf(taskKey, transitions, commits) {
  const ref = (transition) => ({ seq: transition.seq, at: transition.at, commit: transition.commit });
  const timeline = [];
  const result = [];
  let cycle = null;
  let status = null;
  const begin = (transition, kind) => {
    cycle = { taskKey, begin: { ...ref(transition), kind }, start: null, excluded: '', claimant: null, end: null, outcome: null, entry: null };
    result.push(cycle);
  };
  const enter = (transition) => {
    cycle.entry ||= transition;
    cycle.claimant = transition.claimant || null;
  };
  for (const transition of transitions) {
    if (transition.kind === 'created' && !transition.retracted) {
      status = transition.snapshot.status;
      begin(transition, 'created');
      if (WIP.has(status)) enter(transition);
      if (CLOSED.has(status)) Object.assign(cycle, { end: ref(transition), outcome: status });
    } else if (transition.kind === 'status' && cycle) {
      const { from, to } = transition;
      status = to;
      if (CLOSED.has(from) && !CLOSED.has(to)) begin(transition, 'reopen');
      if (WIP.has(to) && !WIP.has(from)) enter(transition);
      if (CLOSED.has(to)) Object.assign(cycle, { end: ref(transition), outcome: to });
    }
    timeline.push([transition.seq, status]);
  }
  const statusAt = (seq, inclusive) => {
    let found = null;
    for (const [at, value] of timeline) if (inclusive ? at <= seq : at < seq) found = value;
    return found;
  };
  for (const entry of result) {
    const { entry: first } = entry;
    delete entry.entry;
    if (!first) entry.excluded = entry.end ? 'no start' : '';
    else if (!commits[first.seq]?.sweep) entry.start = { ...ref(first), source: 'entry' };
    else {
      const limit = Math.min(entry.end ? entry.end.seq : Infinity, commits.length);
      let fallback = null;
      for (let seq = first.seq + 1; seq < limit && !fallback; seq += 1) {
        const commit = commits[seq];
        if (commit.sweep || !commit.touched.includes(taskKey)) continue;
        if (WIP.has(statusAt(seq, false)) || WIP.has(statusAt(seq, true))) fallback = commit;
      }
      if (fallback) entry.start = { seq: fallback.seq, at: fallback.at, commit: fallback.sha, source: 'fallback', label: FALLBACK_LABEL };
      else entry.excluded = 'start known only from a sweep commit';
    }
    if (entry.end && commits[entry.end.seq]?.sweep) {
      entry.end.sweep = true;
      entry.excluded ||= 'finish known only from a sweep commit';
    }
  }
  return result;
}

function touchesLedger(path) {
  if (path === '' || path === '.') return true;
  return LEDGER_PATHS.some((tracked) => path === tracked || path.startsWith(`${tracked}/`) || tracked.startsWith(`${path}/`));
}

// The in-memory, single-flight ledger memo for a workspace's projects. A read
// first compares the ref fingerprint and runs no git at all when it matches;
// otherwise it resolves the heads and rebuilds only when ledgerSha moved.
// AgeAris's own commits that touch the ledger's paths invalidate the memo
// directly (onCommit), so they never depend on timestamp resolution.
export class Ledgers {
  constructor({ workspace, spawn, stat = lstat, readFile: read = readFile, chunkSize = 0 }) {
    this.workspace = workspace;
    this.spawn = spawn;
    this.stat = stat;
    this.readFile = read;
    this.chunkSize = chunkSize;
    this._entries = new Map();
    this._unsubscribe = workspace.onCommit((projectId, { paths } = {}) => {
      if (!paths || paths.some(touchesLedger)) this.invalidate(projectId);
    });
  }

  _entry(projectId) {
    if (!this._entries.has(projectId)) {
      this._entries.set(projectId, { generation: 0, validGeneration: -1, ledger: null, fingerprint: '', pending: null, building: null });
    }
    return this._entries.get(projectId);
  }

  // A project that is gone: its ledger is no longer kept.
  forget(projectId) {
    this._entries.delete(projectId);
  }

  // Without an entry nothing is cached, so there is nothing to invalidate.
  invalidate(projectId) {
    const entry = this._entries.get(projectId);
    if (entry) entry.generation += 1;
  }

  // While a cold build runs: `{ commitsSeen }`; otherwise null.
  building(projectId) {
    const building = this._entries.get(projectId)?.building;
    return building ? { ...building } : null;
  }

  // The project's current ledger. Concurrent callers share one refresh; a
  // caller arriving after an invalidation waits for a refresh that saw it.
  async get(projectId) {
    // An entry is made only for a project that exists, so ids from requests
    // cannot grow the memo.
    if (!this._entries.has(projectId)) await this.workspace._verifyProjectRepoAsync((await this.workspace._describe(projectId)).dir);
    const entry = this._entry(projectId);
    while (entry.pending) {
      const { promise, generation } = entry.pending;
      if (generation === entry.generation) return promise;
      await promise.catch(() => {});
    }
    const generation = entry.generation;
    const promise = this._refresh(projectId, entry, generation).finally(() => {
      if (entry.pending?.promise === promise) entry.pending = null;
    });
    entry.pending = { promise, generation };
    return promise;
  }

  async _refresh(projectId, entry, generation) {
    const { dir, linked, backlogFolder } = await this.workspace._describe(projectId);
    const paths = linked ? BOARD_PATHS : LEDGER_PATHS;
    await this.workspace._verifyProjectRepoAsync(dir);
    // The repository is part of the key: a project folder could be relinked.
    // So is the board's layout, which decides how unclaimed work reads.
    const print = `${dir}\0${backlogFolder}\0${await fingerprint(dir, { stat: this.stat, readFile: this.readFile })}`;
    if (entry.ledger && entry.validGeneration === generation && entry.fingerprint === print) return entry.ledger;
    const heads = await resolveHeads(dir, { spawn: this.spawn, paths });
    let ledger;
    if (entry.ledger && entry.ledger.ledgerSha === heads.ledgerSha && entry.backlogFolder === backlogFolder) ledger = { ...entry.ledger, headSha: heads.headSha, branch: heads.branch };
    else {
      entry.building = { commitsSeen: 0 };
      try {
        ledger = await buildLedger(dir, {
          projectId, heads, spawn: this.spawn, chunkSize: this.chunkSize, paths, backlogFolder,
          onProgress: (commitsSeen) => { entry.building = { commitsSeen }; },
        });
      } finally {
        entry.building = null;
      }
    }
    Object.assign(entry, { ledger, fingerprint: print, validGeneration: generation, backlogFolder });
    return ledger;
  }

  close() {
    this._unsubscribe();
  }
}
