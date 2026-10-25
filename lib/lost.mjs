import { lstat, readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { catFileResponses } from './history.mjs';
import { byId, clean, columnOf, frontmatter, olderLayout, ownerOf, parseEntry, readPolicy, statusWord, taskIdOf } from './orient.mjs';
import { BOARDS, configName, findBoard, gitStream } from './workspace.mjs';

// The lost-agent measures (docs/plans/agent-brain.md §8): how often agents get
// lost on a board, counted from its git history and its checkpoint trails.
//
//   (a) repeated acts     a doing that repeats another run's unanswered act
//   (b) overlapping claims two workers on one task at once
//   (c) over-limit claims  a claim made while WIP is at its limit
//   (d) start latency      from a claim commit to the first did on the task
//
// docs/METRICS.md § "The lost-agent measures" pins how each one reads the
// records; this file implements it. `node lib/lost.mjs <repository>…` prints
// them. It reads and never writes: git runs with --no-optional-locks, on the
// board's paths only.

export const SCHEMA = 'aa.lost/1';
const FOLDERS = new Set(['backlog', 'tasks', 'tasks/done']);
const WIP = new Set(['in_progress', 'blocked']);
const REGULAR = new Set(['100644', '100755']);
const ID = /^T\d{3,6}$/;
const TRAIL_MAX = 1024 * 1024;
const ACT_CAP = 240;

// ---- Reading the records

// Every path the history is read on: each board name's task folders, its
// settings file and its trails.
function boardPaths() {
  return BOARDS.flatMap((board) => [`${board}/backlog`, `${board}/tasks`, `${board}/checkpoints`, `${board}/${configName(board)}`]);
}

function classify(path) {
  const slash = path.indexOf('/');
  const board = path.slice(0, slash);
  if (slash < 1 || !BOARDS.includes(board)) return { kind: 'other' };
  const rest = path.slice(slash + 1);
  if (rest === configName(board)) return { kind: 'config', board };
  const last = rest.lastIndexOf('/');
  const folder = rest.slice(0, Math.max(last, 0));
  const name = rest.slice(last + 1);
  if (FOLDERS.has(folder) && name.endsWith('.md') && taskIdOf(name)) return { kind: 'task', board, folder, id: taskIdOf(name) };
  if (folder === 'checkpoints' && name.endsWith('.jsonl') && ID.test(name.slice(0, -6))) return { kind: 'trail', board, id: name.slice(0, -6) };
  return { kind: 'other', board };
}

async function gitBuffer(dir, args, input) {
  const chunks = [];
  for await (const chunk of gitStream(dir, ['--no-optional-locks', '--literal-pathspecs', ...args], input === undefined ? {} : { input })) chunks.push(chunk);
  return Buffer.concat(chunks);
}

// Every commit reachable from HEAD that touches the board, on every branch
// merged into it, parents before children: `{ sha, parents, at, changes }`.
// Parents are rewritten to the nearest such commit, and a merge's changes are
// against its first parent, so each commit's board follows from its parent's.
async function readHistory(dir) {
  const raw = await gitBuffer(dir, [
    '-c', 'log.showRoot=true', 'log', '--full-history', '--topo-order', '--reverse', '--parents', '--diff-merges=first-parent', '--raw', '--no-renames',
    '--no-abbrev', '--no-color', '-z', '--format=%x01%H %P%x1f%cI', 'HEAD', '--', ...boardPaths(),
  ]);
  const commits = [];
  let pending = null;
  for (let token of raw.toString('utf8').split('\0')) {
    if (token.startsWith('\n')) token = token.slice(1);
    if (pending) {
      commits.at(-1).changes.push({ ...pending, path: token });
      pending = null;
    } else if (token.startsWith('\x01')) {
      const [shas, at] = token.slice(1).split('\x1f');
      const [sha, ...parents] = shas.split(' ').filter(Boolean);
      commits.push({ sha, parents, at, ms: Date.parse(at), changes: [] });
    } else if (token.startsWith(':') && commits.length) {
      // `:<old mode> <new mode> <old sha> <new sha> <status>`, then the path.
      const [, mode, , sha, status] = token.slice(1).split(' ');
      pending = { mode, sha, deleted: status === 'D' };
    }
  }
  return commits;
}

// The blobs the history names, read once each: a task file's status and
// owner, a settings file's WIP limit, a trail's lines.
async function readBlobs(dir, wanted) {
  const shas = [...wanted.keys()];
  const read = new Map();
  if (!shas.length) return read;
  const modes = shas.map((sha) => (wanted.get(sha) === 'trail' ? 'tail' : wanted.get(sha) === 'task' ? 'head' : 'all'));
  let index = 0;
  for await (const blob of catFileResponses(gitStream(dir, ['cat-file', '--batch'], { input: `${shas.join('\n')}\n` }), modes)) {
    const sha = shas[index];
    index += 1;
    if (blob.missing || blob.type !== 'blob' || !blob.content) continue;
    let text = blob.content.toString('utf8');
    // A trail's tail starts mid-line unless the byte before it ended one.
    if (blob.truncated === 'tail') text = text.slice(text.indexOf('\n') + 1);
    read.set(sha, { text, truncated: Boolean(blob.truncated) });
  }
  return read;
}

async function realDir(path) {
  try { return (await lstat(path)).isDirectory(); } catch { return false; }
}

// The working tree's trails, which may hold lines not yet committed.
async function workingTrails(dir) {
  const found = [];
  let skipped = 0;
  for (const board of BOARDS) {
    const folder = join(dir, board, 'checkpoints');
    if (!await realDir(join(dir, board)) || !await realDir(folder)) continue;
    for (const name of (await readdir(folder)).sort()) {
      if (!name.endsWith('.jsonl') || !ID.test(name.slice(0, -6))) continue;
      const info = await lstat(join(folder, name)).catch(() => null);
      if (!info?.isFile()) continue;
      if (info.size > TRAIL_MAX) { skipped += 1; continue; }
      found.push({ id: name.slice(0, -6), text: await readFile(join(folder, name), 'utf8') });
    }
  }
  return { found, skipped };
}

// The records a measure reads: the board's history with its blobs, and every
// trail line ever committed or in the working tree, one copy of each.
export async function readRecords(dir) {
  const head = (await gitBuffer(dir, ['rev-parse', '--verify', '--end-of-options', 'HEAD^{commit}'])).toString('utf8').trim();
  const commits = await readHistory(dir);
  const wanted = new Map();
  for (const commit of commits) {
    for (const change of commit.changes) {
      change.info = classify(change.path);
      if (change.deleted || !REGULAR.has(change.mode) || change.info.kind === 'other') continue;
      if (!wanted.has(change.sha)) wanted.set(change.sha, change.info.kind);
    }
  }
  const blobs = await readBlobs(dir, wanted);
  const working = await workingTrails(dir);
  return { dir, head, board: await findBoard(dir), commits, blobs, working };
}

// ---- The trails

// Each task's trail entries, in time order: every line any committed version
// or the working tree holds, once. Lines keep the order they were first seen
// in, oldest commit first, so entries written in the same second stay in file
// order.
function collectTrails({ commits, blobs, working }) {
  const seen = new Map();
  const add = (id, text) => {
    if (!seen.has(id)) seen.set(id, new Map());
    const lines = seen.get(id);
    for (const line of text.split('\n')) {
      const value = line.endsWith('\r') ? line.slice(0, -1) : line;
      if (value.trim() && !lines.has(value)) lines.set(value, lines.size);
    }
  };
  for (const commit of commits) {
    for (const change of commit.changes) {
      if (change.info.kind === 'trail' && !change.deleted && blobs.has(change.sha)) add(change.info.id, blobs.get(change.sha).text);
    }
  }
  for (const { id, text } of working.found) add(id, text);
  const trails = new Map();
  let lines = 0;
  let malformed = 0;
  for (const [id, set] of seen) {
    const entries = [];
    for (const [line, order] of set) {
      lines += 1;
      const entry = parseEntry(line);
      if (entry) entries.push({ ...entry, order, family: entry.run.split('.')[0] });
      else malformed += 1;
    }
    entries.sort((a, b) => a.ms - b.ms || a.order - b.order);
    trails.set(id, entries);
  }
  return { trails, lines, malformed, skipped: working.skipped };
}

// What a doing says it does: its `act`, or its `what` when it has no act, as
// ckpt.sh live reads a line; runs of whitespace are one space.
function actOf(value) {
  for (const field of [value.act, value.what]) {
    if (typeof field === 'string' && field.trim()) return field.replace(/\s+/g, ' ').trim();
  }
  return '';
}

function processKey(value) {
  const { boot, pid, pstart } = value;
  return typeof boot === 'string' && boot && typeof pstart === 'string' && pstart && Number.isInteger(pid) && pid > 0 ? `${boot}\0${pid}\0${pstart}` : '';
}

// ---- The board, commit by commit

// Which tasks are in progress or blocked in one commit's board, and under
// whose owner line; an id with two files is in no column, as orient reads it.
// `read` gives a blob's parsed head or limit, read once however many commits
// hold it.
function boardView(files, read) {
  const paths = [...files.keys()];
  const older = new Map(BOARDS.map((board) => [board, olderLayout(paths, board)]));
  const limits = new Map();
  const count = new Map();
  const tasks = [];
  for (const [path, file] of files) {
    const { info } = file;
    if (!REGULAR.has(file.mode)) continue;
    if (info.kind === 'config') limits.set(info.board, read(file.sha, 'config').limit);
    if (info.kind !== 'task') continue;
    count.set(info.id, (count.get(info.id) || 0) + 1);
    const { status, owner } = read(file.sha, 'task');
    tasks.push({ ...info, path, column: columnOf(info.folder, status, older.get(info.board)), owner });
  }
  const wip = new Map();
  for (const task of tasks) if (count.get(task.id) === 1 && WIP.has(task.column)) wip.set(task.id, task);
  return { wip, limits };
}

// Whose claim an owner line is: its operator, since claims belong to the
// operator and a new session of theirs continues the claim (rule 3); a line
// that names only a session is that session's.
const ownerKey = (owner) => (owner?.operator ? owner.operator : owner?.session ? `@${owner.session}` : '');

// Replays the board along the history: each commit's board is its first
// parent's with the commit's changes. A task is held while it is in progress
// or blocked under an owner line. Returns the claims, the commits where a task
// becomes held; each stay, from a claim until the task is no longer held; and
// each operator's stint holding a task.
function replay({ commits, blobs }) {
  const children = new Map();
  for (const commit of commits) for (const parent of commit.parents) children.set(parent, (children.get(parent) || 0) + 1);
  const parsed = new Map();
  const read = (sha, kind) => {
    if (!parsed.has(sha)) {
      const text = blobs.get(sha)?.text ?? '';
      if (kind === 'config') parsed.set(sha, { limit: readPolicy(text).limit });
      else {
        const { keys } = frontmatter(text);
        parsed.set(sha, { status: statusWord(keys.status), owner: ownerOf(keys.owner) });
      }
    }
    return parsed.get(sha);
  };
  const states = new Map();
  const claims = [];
  const stays = new Map();
  const stints = new Map();
  // A stay or stint ends at the first commit, on any line, that ends it: a
  // line that goes on holding it after that is one nobody worked on, until a
  // merge brings it up to date.
  const end = (map, key, ms) => {
    const item = map.get(key);
    if (item && (item.toMs === null || ms < item.toMs)) item.toMs = ms;
  };
  for (const commit of commits) {
    const parents = commit.parents.map((sha) => states.get(sha)).filter(Boolean);
    const files = new Map(parents[0]?.files || []);
    for (const change of commit.changes) {
      if (change.info.kind === 'trail') continue;
      if (change.deleted) files.delete(change.path);
      else files.set(change.path, { sha: change.sha, mode: change.mode, info: change.info });
    }
    const view = boardView(files, read);
    const entering = [];
    for (const [id, task] of view.wip) {
      task.stay = null;
      task.stint = null;
      const key = ownerKey(task.owner);
      if (!key) continue;
      const before = parents.map((parent) => parent.view.wip.get(id)).filter((was) => was?.stint);
      // A merge that brings the task in held from two lines goes on with the
      // hold that no line has ended.
      const live = before.filter((was) => was.stay.toMs === null);
      const from = live.length ? live : before;
      const same = from.find((was) => was.stint.holder === key);
      if (same) task.stint = same.stint;
      else {
        task.stint = { key: `${commit.sha}\0${id}\0${key}`, holder: key, id, sha: commit.sha, fromMs: commit.ms, toMs: null, operator: task.owner.operator, session: task.owner.session };
        stints.set(task.stint.key, task.stint);
      }
      // A new owner on a held task, another operator's takeover included,
      // goes on with the stay; only a task that was not held is claimed.
      const held = same || from[0];
      if (held) task.stay = held.stay;
      else {
        task.stay = { key: `${commit.sha}\0${id}`, id, sha: commit.sha, fromMs: commit.ms, toMs: null };
        stays.set(task.stay.key, task.stay);
        entering.push(task);
      }
    }
    for (const parent of parents) {
      for (const [id, was] of parent.view.wip) {
        const now = view.wip.get(id);
        if (was.stay && now?.stay !== was.stay) end(stays, was.stay.key, commit.ms);
        if (was.stint && now?.stint !== was.stint) end(stints, was.stint.key, commit.ms);
      }
    }
    // A commit that claims several tasks takes them in id order. The tasks it
    // leaves in progress or blocked, claimed or not, were there before them.
    const kept = view.wip.size - entering.length;
    // The limit in force before the commit. A board renamed in this very
    // commit had its settings under its old name, and keeps them.
    const limits = parents[0]?.view.limits || new Map();
    const renamed = [...limits.keys()].filter((board) => !view.limits.has(board));
    const limitOf = (board) => (limits.has(board) ? limits.get(board) : renamed.length === 1 ? limits.get(renamed[0]) : 0);
    entering.sort((a, b) => byId(a.id, b.id)).forEach((task, index) => {
      claims.push({ id: task.id, sha: commit.sha, ms: commit.ms, merge: commit.parents.length > 1, wipBefore: kept + index, limit: limitOf(task.board), stay: task.stay });
    });
    states.set(commit.sha, { files, view });
    for (const parent of commit.parents) {
      const left = children.get(parent) - 1;
      children.set(parent, left);
      if (left === 0) states.delete(parent);
    }
  }
  return { claims, stays: [...stays.values()], stints: [...stints.values()] };
}

// ---- The measures

function percentile(sorted, p) {
  return sorted.length ? sorted[Math.ceil((p / 100) * sorted.length) - 1] : null;
}

const iso = (ms) => new Date(ms).toISOString().replace('.000Z', 'Z');
const inWindow = (ms, { sinceMs, asOfMs }) => ms >= sinceMs && ms <= asOfMs;

// (a) A doing repeats an act when an earlier doing on the same task, in another
// run, says the same act, and that run wrote no did or end between the two.
function repeatedActs(trails, window) {
  const items = [];
  let noAct = 0;
  for (const [task, entries] of trails) {
    // The doings before each one that say each act, by position.
    const said = new Map();
    entries.forEach((later, at) => {
      if (later.kind !== 'doing') return;
      const act = actOf(later.value);
      if (inWindow(later.ms, window) && !act) noAct += 1;
      if (!act) return;
      if (!said.has(act)) said.set(act, []);
      const before = said.get(act);
      for (let k = before.length - 1; k >= 0 && inWindow(later.ms, window); k -= 1) {
        const earlier = entries[before[k]];
        if (earlier.run === later.run) continue;
        const answered = entries.slice(before[k] + 1, at).some((entry) => entry.run === earlier.run && (entry.kind === 'did' || entry.kind === 'end'));
        if (answered) continue;
        items.push({ task, run: later.run, at: later.ts, act: clean(act, ACT_CAP), earlier: { run: earlier.run, at: earlier.ts }, sameFamily: earlier.family === later.family });
        break;
      }
      before.push(at);
    });
  }
  return { items, noAct };
}

// The runs a window counts: a run is one run id in one task's trail, counted
// where its first entry falls.
function runsIn(trails, window) {
  let runs = 0;
  for (const entries of trails.values()) {
    const first = new Map();
    for (const entry of entries) if (!first.has(entry.run)) first.set(entry.run, entry.ms);
    for (const ms of first.values()) if (inWindow(ms, window)) runs += 1;
  }
  return runs;
}

// Each family's spans of writing on one task, without its ends, since a
// reaping end is written into a dead run by the session that reaps it. A span
// closes when each of the family's runs has ended, and splits where the
// family names a new process (a resumed session), whose old runs died.
function spansOf(entries, asOfMs) {
  const families = new Map();
  for (const entry of entries) {
    if (entry.ms > asOfMs) continue;
    if (!families.has(entry.family)) families.set(entry.family, { family: entry.family, operator: '', process: '', running: new Set(), spans: [], current: null });
    const family = families.get(entry.family);
    if (!family.operator && entry.kind === 'open' && typeof entry.value.operator === 'string') family.operator = clean(entry.value.operator, 80);
    const process = processKey(entry.value);
    if (process && process !== family.process) {
      if (family.process) {
        family.current = null;
        family.running.clear();
      }
      family.process = process;
    }
    if (entry.kind === 'end') {
      family.running.delete(entry.run);
      if (!family.running.size) family.current = null;
      continue;
    }
    family.running.add(entry.run);
    if (!family.current) {
      family.current = { fromMs: entry.ms, toMs: entry.ms };
      family.spans.push(family.current);
    } else family.current.toMs = entry.ms;
  }
  return [...families.values()].filter((family) => family.spans.length);
}

// Two spans overlap when they share time, or one is a single moment strictly
// inside the other.
function overlap(a, b) {
  const from = Math.max(a.fromMs, b.fromMs);
  const to = Math.min(a.toMs, b.toMs);
  if (from < to) return { fromMs: from, toMs: to };
  const inside = (point, span) => point.fromMs === point.toMs && span.fromMs < point.fromMs && point.fromMs < span.toMs;
  if (inside(a, b)) return { fromMs: a.fromMs, toMs: a.fromMs };
  if (inside(b, a)) return { fromMs: b.fromMs, toMs: b.fromMs };
  return null;
}

// (b) Two workers on one task at once: owner lines of different operators held
// at the same time, which only histories that diverged can show, or two run
// families writing at the same time.
function overlappingClaims(stints, trails, window) {
  const items = [];
  const byTask = new Map();
  for (const stint of stints) {
    if (!byTask.has(stint.id)) byTask.set(stint.id, []);
    byTask.get(stint.id).push(stint);
  }
  for (const [task, list] of byTask) {
    for (let i = 0; i < list.length; i += 1) {
      for (let j = i + 1; j < list.length; j += 1) {
        const [a, b] = [list[i], list[j]];
        if (!a.operator || !b.operator || a.operator === b.operator) continue;
        const span = (stint) => ({ fromMs: stint.fromMs, toMs: Math.min(stint.toMs ?? window.asOfMs, window.asOfMs) });
        const shared = overlap(span(a), span(b));
        if (!shared || !inWindow(Math.max(a.fromMs, b.fromMs), window)) continue;
        const side = (stint) => ({ operator: clean(stint.operator, 80), session: clean(stint.session, 80), commit: stint.sha, from: iso(stint.fromMs) });
        items.push({ task, source: 'owner-lines', a: side(a), b: side(b), from: iso(shared.fromMs), to: iso(shared.toMs) });
      }
    }
  }
  for (const [task, entries] of trails) {
    const families = spansOf(entries, window.asOfMs);
    for (let i = 0; i < families.length; i += 1) {
      for (let j = i + 1; j < families.length; j += 1) {
        const [a, b] = [families[i], families[j]];
        let shared = null;
        for (const x of a.spans) for (const y of b.spans) shared ||= overlap(x, y);
        if (!shared || !inWindow(shared.fromMs, window)) continue;
        // The same two workers, already counted from their owner lines: a
        // family is an owner line's when it names its operator or is its session.
        const isSide = (family, side) => (family.operator !== '' && family.operator === side.operator) || (side.session !== '' && family.family.slice(0, 8) === side.session.slice(0, 8));
        const counted = items.some((item) => item.task === task && item.source === 'owner-lines'
          && ((isSide(a, item.a) && isSide(b, item.b)) || (isSide(a, item.b) && isSide(b, item.a))));
        if (counted) continue;
        items.push({ task, source: 'runs', a: { family: a.family, operator: a.operator }, b: { family: b.family, operator: b.operator }, from: iso(shared.fromMs), to: iso(shared.toMs) });
      }
    }
  }
  return { items };
}

// (c) A claim made while the tasks in progress or blocked are already at the
// board's wip.in_progress. Without a limit it cannot be over one.
function overLimitClaims(claims, window) {
  const counted = claims.filter((claim) => inWindow(claim.ms, window));
  const limited = counted.filter((claim) => claim.limit > 0);
  const items = limited.filter((claim) => claim.wipBefore >= claim.limit)
    .map((claim) => ({ task: claim.id, commit: claim.sha, at: iso(claim.ms), wip: claim.wipBefore, limit: claim.limit }));
  // The claims made with no limit set, by the WIP each joined.
  const wips = counted.filter((claim) => !(claim.limit > 0)).map((claim) => claim.wipBefore).sort((x, y) => x - y);
  return { claims: counted.length, limited: limited.length, noLimit: wips.length, items, wipAtClaim: { median: percentile(wips, 50), max: wips.at(-1) ?? null } };
}

// (d) From each claim commit to the first did on the task while it stayed in
// WIP. A claim with no did yet is still open; one that left WIP without a did
// has none.
function startLatency(claims, trails, window) {
  const items = [];
  for (const claim of claims) {
    if (!inWindow(claim.ms, window)) continue;
    const held = claim.stay.toMs === null || claim.stay.toMs > window.asOfMs;
    const endMs = held ? window.asOfMs : claim.stay.toMs;
    const did = (trails.get(claim.id) || []).find((entry) => entry.kind === 'did' && entry.ms >= claim.ms && entry.ms <= endMs);
    const state = did ? 'measured' : held ? 'open' : 'no-did';
    items.push({
      task: claim.id, commit: claim.sha, at: iso(claim.ms), left: held ? null : iso(claim.stay.toMs), state,
      trail: (trails.get(claim.id) || []).some((entry) => entry.ms <= window.asOfMs),
      ...(did ? { did: did.ts, minutes: Math.round((did.ms - claim.ms) / 60000) } : {}),
    });
  }
  const minutes = items.filter((item) => item.state === 'measured').map((item) => item.minutes).sort((x, y) => x - y);
  return {
    claims: items.length, measured: minutes.length, open: items.filter((item) => item.state === 'open').length, noDid: items.filter((item) => item.state === 'no-did').length,
    withTrail: items.filter((item) => item.trail).length, medianMinutes: percentile(minutes, 50), p85Minutes: percentile(minutes, 85), items,
  };
}

// The four measures over `records`, counting what falls between `since` and
// `asOf` (both times; by default all of history, up to now).
export function measure(records, { since, asOf } = {}) {
  const window = { sinceMs: since === undefined ? -Infinity : Date.parse(since), asOfMs: asOf === undefined ? Date.now() : Date.parse(asOf) };
  if (Number.isNaN(window.sinceMs) || Number.isNaN(window.asOfMs)) throw new TypeError('since and asOf must be times');
  const { trails, lines, malformed, skipped } = collectTrails(records);
  const { claims, stints } = replay(records);
  const runs = runsIn(trails, window);
  const a = repeatedActs(trails, window);
  const b = overlappingClaims(stints, trails, window);
  return {
    schema: SCHEMA,
    repo: { head: records.head, board: records.board },
    since: since === undefined ? null : iso(window.sinceMs),
    asOf: iso(window.asOfMs),
    read: { commits: records.commits.length, merges: records.commits.filter((commit) => commit.parents.length > 1).length, trails: trails.size, lines, malformed, skipped, runs },
    a: { repeats: a.items.length, runs, per100Runs: runs ? Math.round((a.items.length / runs) * 10000) / 100 : null, noAct: a.noAct, items: a.items },
    b: { overlaps: b.items.length, ownerLines: b.items.filter((item) => item.source === 'owner-lines').length, runs: b.items.filter((item) => item.source === 'runs').length, items: b.items },
    c: overLimitClaims(claims, window),
    d: startLatency(claims, trails, window),
  };
}

// The measures for the repository at `dir`.
export async function lostAgents(dir, options = {}) {
  return measure(await readRecords(dir), options);
}

// ---- The command

function duration(minutes) {
  if (minutes === null) return '—';
  if (minutes < 60) return `${minutes} min`;
  if (minutes < 1440) return `${(minutes / 60).toFixed(1)} h`;
  return `${(minutes / 1440).toFixed(1)} days`;
}

export function summary(dir, result) {
  const { read, a, b, c, d } = result;
  const lines = [
    `${dir} · ${result.repo.board || 'no board'} · HEAD ${result.repo.head.slice(0, 7)} · ${result.since ? `${result.since} to ` : ''}${result.asOf}`,
    `  read: ${read.commits} commits (${read.merges} merges), ${read.trails} trails, ${read.lines} lines (${read.malformed} malformed${read.skipped ? `, ${read.skipped} too large` : ''}), ${read.runs} runs`,
    `  (a) repeated acts: ${a.repeats} in ${a.runs} runs${a.per100Runs === null ? '' : ` (${a.per100Runs} per 100 runs)`}; ${a.noAct} doing(s) name no act`,
    `  (b) overlapping claims: ${b.overlaps} (owner lines ${b.ownerLines}, runs writing at once ${b.runs})`,
    c.limited
      ? `  (c) over-limit claims: ${c.items.length} of ${c.limited} claims under a limit${c.noLimit ? `; ${c.noLimit} made with no limit set` : ''}`
      : `  (c) over-limit claims: no WIP limit was set for any of ${c.claims} claims (WIP at a claim: median ${c.wipAtClaim.median ?? '—'}, max ${c.wipAtClaim.max ?? '—'})`,
    `  (d) start latency: median ${duration(d.medianMinutes)}, 85th ${duration(d.p85Minutes)} (n=${d.measured} of ${d.claims} claims; ${d.noDid} left WIP with no did, ${d.open} open; ${d.withTrail} have a trail)`,
  ];
  for (const item of a.items) lines.push(`      (a) ${item.task} ${item.earlier.run} → ${item.run} at ${item.at}${item.sameFamily ? ' (one family)' : ''}: ${item.act}`);
  for (const item of b.items) {
    const who = (side) => (item.source === 'runs' ? `${side.family} (${side.operator || 'operator unknown'})` : `${side.operator} @${side.session || '?'}`);
    lines.push(`      (b) ${item.task} ${item.source}: ${who(item.a)} and ${who(item.b)}, ${item.from} to ${item.to}`);
  }
  for (const item of c.items) lines.push(`      (c) ${item.task} claimed at WIP ${item.wip} of ${item.limit}, ${item.commit.slice(0, 7)} ${item.at}`);
  return lines.join('\n');
}

async function main(argv) {
  const options = {};
  const dirs = [];
  let json = false;
  const usage = 'usage: node lib/lost.mjs [--json] [--since <time>] [--as-of <time>] <repository>...';
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--json') json = true;
    else if (argv[i] === '--since' || argv[i] === '--as-of') {
      const value = argv[i + 1];
      if (value === undefined || Number.isNaN(Date.parse(value))) {
        console.error(`${argv[i]} takes a time, such as 2026-10-25T00:00:00Z\n${usage}`);
        return 2;
      }
      // A time still to come would count what is written before it arrives.
      if (argv[i] === '--as-of' && Date.parse(value) > Date.now()) {
        console.error('--as-of cannot be in the future');
        return 2;
      }
      options[argv[i] === '--since' ? 'since' : 'asOf'] = value;
      i += 1;
    } else if (argv[i] === '--help' || argv[i] === '-h') {
      console.log(usage);
      return 0;
    } else dirs.push(argv[i]);
  }
  if (!dirs.length) dirs.push('.');
  const results = [];
  let failed = 0;
  for (const dir of dirs) {
    try {
      const result = await lostAgents(dir, options);
      results.push({ dir, ...result });
      if (!json) console.log(summary(dir, result));
    } catch (error) {
      failed += 1;
      console.error(`${dir}: ${error.message}`);
    }
  }
  if (json) console.log(JSON.stringify(results, null, 2));
  return failed ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = await main(process.argv.slice(2));
