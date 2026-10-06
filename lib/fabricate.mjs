import { mkdir, readdir, readFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import { gitStream } from './workspace.mjs';

// Builds dated git repositories from a small script, through `git fast-import`,
// so tests, the perf suite, and the sample project share one way of writing
// history with exact author and committer dates, merges, rebases, and
// fast-forwards. Every commit is what raw git would make: AGESight's ledger
// cannot tell a fabricated history from a real one.
//
// One line is one commit:
//
//   day 3 09:00 Ana: create T001 backlog "Importer" {"type": "bug"}
//   2026-10-01T09:00:00+01:00 ade: move T001 tasks {"owner": "ade @k/e857a8c8 2026-10-01 — importer"}
//   + set T002 {"priority": "high"}          (a continuation: same commit)
//
// The time is `day <n> <HH:MM>` (days after the epoch, in the epoch's UTC
// offset) or an ISO time with an offset. The name before the colon is the
// author, and also the committer unless `committer=` says otherwise.
//
// Operations (`<state>` is backlog, tasks, blocked, or done):
//   create <id> <state> "<title>" {fields}   a new task file; fields go into the
//                                            frontmatter (null leaves a key out),
//                                            except `body` and `next`, which fill
//                                            the Notes and the Handoff's Next decision
//   move <id> <state> {fields}               moves the file and rewrites `status:`
//                                            (open, claimed, blocked, done)
//   set <id> {fields}                        edits the frontmatter; a new title
//                                            renames the file, as AGESight does
//   kill <id> {fields}                       moves the file to done/ as `killed`
//   remove <id>                              deletes the task file
//   ckpt <id> <kind> "<what>"                appends a checkpoint line (kind `raw`
//                                            appends the text verbatim); `ts=` dates it
//   project {fields}                         merges fields into project.json
//   write <path> "<content>" | delete <path> any file, verbatim
//   merge <branch>                           a merge commit: first parent is the
//                                            current branch, second the other
//   rebase <branch>                          replays <branch>'s commits since it
//                                            forked onto the current branch, keeping
//                                            author dates, then lands them there
// Directives (no commit): `branch <name>` (fork from the current branch and
// switch to it), `checkout <name>`, `ff <branch>` (fast-forward the current
// branch to <branch>).
// Commit options anywhere on a line: `via=ui` (AGESight-Via trailer),
// `run=R001` (Run trailer), `authored=<time>`, `committer=<name>`,
// `subject="…"`, `label=<name>` (look the sha up later with `sha(name)`);
// for ckpt, `ts=<time>` and `session=<run id>`, which apply to that one line.

const STATES = {
  backlog: { dir: 'deaddrop/backlog', status: 'open' },
  tasks: { dir: 'deaddrop/tasks', status: 'claimed' },
  in_progress: { dir: 'deaddrop/tasks', status: 'claimed' },
  blocked: { dir: 'deaddrop/tasks', status: 'blocked' },
  done: { dir: 'deaddrop/tasks/done', status: 'done' },
  killed: { dir: 'deaddrop/tasks/done', status: 'killed' },
};
const TASK_FILE = /^deaddrop\/(?:backlog|tasks|tasks\/done)\/(T\d{3,})-[^/]*\.md$/;
const BARE_KEYS = new Set(['id', 'status', 'priority']);
const BODY_KEYS = new Set(['body', 'next']);

class ScriptError extends Error {
  constructor(lineNumber, message) {
    super(`fabricate line ${lineNumber}: ${message}`);
    this.name = 'ScriptError';
  }
}

function slug(text) {
  return text.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'task';
}

function offsetMinutes(text) {
  if (text === 'Z') return 0;
  const [, sign, hours, minutes] = /^([+-])(\d{2}):?(\d{2})$/.exec(text);
  return (sign === '-' ? -1 : 1) * (Number(hours) * 60 + Number(minutes));
}

function gitOffset(minutes) {
  const absolute = Math.abs(minutes);
  return `${minutes < 0 ? '-' : '+'}${String(Math.floor(absolute / 60)).padStart(2, '0')}${String(absolute % 60).padStart(2, '0')}`;
}

// The ISO time a fabricated date stands for, in its own offset.
function isoAt({ ms, offset }) {
  const local = new Date(ms + offset * 60000).toISOString().slice(0, 19);
  const absolute = Math.abs(offset);
  return `${local}${offset < 0 ? '-' : '+'}${String(Math.floor(absolute / 60)).padStart(2, '0')}:${String(absolute % 60).padStart(2, '0')}`;
}

function utcSeconds(ms) {
  return new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

// Splits the arguments of an operation: words, "JSON strings", one {JSON
// object}, and key=value options (the value a word or a "JSON string").
function tokenize(text, lineNumber) {
  const tokens = [];
  let index = 0;
  const readString = () => {
    let end = index + 1;
    while (end < text.length && text[end] !== '"') end += text[end] === '\\' ? 2 : 1;
    if (end >= text.length) throw new ScriptError(lineNumber, 'unterminated string');
    const value = JSON.parse(text.slice(index, end + 1));
    index = end + 1;
    return value;
  };
  while (index < text.length) {
    if (/\s/.test(text[index])) { index += 1; continue; }
    if (text[index] === '"') { tokens.push({ type: 'string', value: readString() }); continue; }
    if (text[index] === '{') {
      let depth = 0;
      let end = index;
      for (; end < text.length; end += 1) {
        if (text[end] === '"') {
          end += 1;
          while (end < text.length && text[end] !== '"') end += text[end] === '\\' ? 2 : 1;
        } else if (text[end] === '{') depth += 1;
        else if (text[end] === '}' && --depth === 0) break;
      }
      if (depth !== 0) throw new ScriptError(lineNumber, 'unterminated {…}');
      try { tokens.push({ type: 'json', value: JSON.parse(text.slice(index, end + 1)) }); }
      catch (error) { throw new ScriptError(lineNumber, `invalid JSON: ${error.message}`); }
      index = end + 1;
      continue;
    }
    const option = /^([a-z]+)=/.exec(text.slice(index));
    if (option) {
      index += option[0].length;
      if (text[index] === '"') tokens.push({ type: 'option', key: option[1], value: readString() });
      else {
        const word = /^\S*/.exec(text.slice(index))[0];
        index += word.length;
        tokens.push({ type: 'option', key: option[1], value: word });
      }
      continue;
    }
    const word = /^\S+/.exec(text.slice(index))[0];
    index += word.length;
    tokens.push({ type: 'word', value: word });
  }
  return tokens;
}

function renderValue(key, value) {
  if (Array.isArray(value)) return '[]';
  if (BARE_KEYS.has(key) || (key === 'owner' && value === '—') || (key === 'assignee' && value === '—')) return String(value);
  return JSON.stringify(String(value));
}

// Applies frontmatter updates line by line: replace, append, or (null) remove.
function editFrontmatter(content, updates) {
  const end = content.indexOf('\n---\n', 4);
  let lines = content.slice(4, end).split('\n');
  for (const [key, value] of Object.entries(updates)) {
    if (BODY_KEYS.has(key)) continue;
    const index = lines.findIndex(line => line.startsWith(`${key}:`));
    if (value === null) {
      if (index >= 0) lines = lines.filter((_line, i) => i !== index);
    } else if (index >= 0) lines[index] = `${key}: ${renderValue(key, value)}`;
    else lines.push(`${key}: ${renderValue(key, value)}`);
  }
  return `---\n${lines.join('\n')}\n---\n${content.slice(end + 5)}`;
}

function frontmatterValue(content, key) {
  const match = new RegExp(`^${key}: (.*)$`, 'm').exec(content.slice(0, content.indexOf('\n---\n', 4)));
  if (!match) return '';
  try { return String(JSON.parse(match[1])); } catch { return match[1]; }
}

function renderTask(id, title, status, fields, time) {
  const defaults = {
    id, title, status, owner: '—', priority: 'medium', assignee: '—', dueDate: '', type: '', blockedReason: '', depends: [],
    created: isoAt(time).slice(0, 10), createdAt: isoAt(time),
  };
  const ordered = { ...defaults, ...fields, id, status };
  const header = Object.entries(ordered)
    .filter(([key, value]) => value !== null && !BODY_KEYS.has(key))
    .map(([key, value]) => `${key}: ${renderValue(key, value)}`)
    .join('\n');
  const next = fields.next ?? 'choose the smallest safe action that advances the goal';
  return `---\n${header}\n---\n\n# ${id} — ${ordered.title}\n\n## Goal\n\nFabricated task.\n\n## Handoff — state at last stop\n\n- **Next decision:** ${next}\n\n## Notes\n\n${fields.body ?? ''}\n`;
}

function emailFor(name) {
  return `${name.toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '') || 'user'}@example.invalid`;
}

function quotePath(path) {
  if (/[\x00-\x1f]/.test(path)) throw new Error(`fabricate: path ${JSON.stringify(path)} has a control character`);
  return /^"|[\\"]/.test(path) ? `"${path.replace(/[\\"]/g, '\\$&')}"` : path;
}

export class Fabrication {
  constructor(dir, { operator = 'ade', email = 'ade@example.invalid', epoch = '2026-09-01T00:00:00+01:00' } = {}) {
    const match = /^(\d{4}-\d{2}-\d{2})T.*?(Z|[+-]\d{2}:\d{2})$/.exec(epoch);
    if (!match || Number.isNaN(Date.parse(epoch))) throw new Error('fabricate: epoch must be an ISO time with an offset');
    this.dir = resolve(dir);
    this.operator = operator;
    this.email = email;
    this.epochDate = match[1];
    this.epochOffset = offsetMinutes(match[2]);
    this.branches = new Map([['main', { head: null, files: new Map(), fork: new Map(), log: [] }]]);
    this.current = 'main';
    this.nextMark = 1;
    this.marks = new Map();
    this.labels = new Map();
    this.shas = {};
  }

  // The sha of a commit given `label=<name>`.
  sha(label) {
    if (!(label in this.shas)) throw new Error(`fabricate: no commit labelled ${label}`);
    return this.shas[label];
  }

  _time(text, lineNumber) {
    const day = /^day\s+(-?\d+)\s+(\d{1,2}):(\d{2})$/.exec(text.trim());
    if (day) {
      const base = Date.parse(`${this.epochDate}T00:00:00Z`) + Number(day[1]) * 86400000;
      const ms = base + (Number(day[2]) * 60 + Number(day[3])) * 60000 - this.epochOffset * 60000;
      return { ms, offset: this.epochOffset };
    }
    const iso = /^\d{4}-\d{2}-\d{2}T[\d:.]+(Z|[+-]\d{2}:\d{2})$/.exec(text.trim());
    if (!iso || Number.isNaN(Date.parse(text))) throw new ScriptError(lineNumber, `invalid time ${JSON.stringify(text)}`);
    return { ms: Date.parse(text), offset: offsetMinutes(iso[1]) };
  }

  _person(name) {
    return `${name} <${name === this.operator ? this.email : emailFor(name)}>`;
  }

  // Appends commits described by `script` to the repository.
  async run(script) {
    const stream = [];
    const pendingLabels = [];
    let commit = null;
    const flush = () => {
      if (!commit) return;
      this._commit(commit, stream, pendingLabels);
      commit = null;
    };
    const lines = String(script).split('\n');
    for (let number = 1; number <= lines.length; number += 1) {
      const line = lines[number - 1].trim();
      if (!line || line.startsWith('#')) continue;
      if (line.startsWith('+ ')) {
        if (!commit) throw new ScriptError(number, 'a continuation line needs a commit line before it');
        commit.ops.push(this._op(line.slice(2), number, commit));
        continue;
      }
      flush();
      const directive = /^(branch|checkout|ff)\s+(\S+)$/.exec(line);
      if (directive) {
        this._directive(directive[1], directive[2], number, stream);
        continue;
      }
      const match = /^(day\s+-?\d+\s+\d{1,2}:\d{2}|\d{4}-\d{2}-\d{2}T\S+)\s+([^:]+?):\s+(\S.*)$/.exec(line);
      if (!match) throw new ScriptError(number, `cannot read ${JSON.stringify(line)}`);
      commit = { time: this._time(match[1], number), actor: match[2].trim(), options: {}, ops: [], number };
      commit.ops.push(this._op(match[3], number, commit));
    }
    flush();
    if (stream.length) await this._import(stream, pendingLabels);
    return this;
  }

  _op(text, number, commit) {
    const tokens = tokenize(text, number);
    const options = {};
    for (const token of tokens.filter(entry => entry.type === 'option')) options[token.key] = commit.options[token.key] = token.value;
    const words = tokens.filter(entry => entry.type !== 'option');
    const [name, ...args] = words;
    if (!name || name.type !== 'word') throw new ScriptError(number, 'missing operation');
    return { name: name.value, args, number, options };
  }

  _directive(kind, name, number, stream) {
    const current = this.branches.get(this.current);
    if (kind === 'branch') {
      if (this.branches.has(name)) throw new ScriptError(number, `branch ${name} exists`);
      this.branches.set(name, { head: current.head, files: new Map(current.files), fork: new Map(current.files), log: [] });
      this.current = name;
    } else if (kind === 'checkout') {
      if (!this.branches.has(name)) throw new ScriptError(number, `no branch ${name}`);
      this.current = name;
    } else {
      const other = this.branches.get(name);
      if (!other) throw new ScriptError(number, `no branch ${name}`);
      current.head = other.head;
      current.files = new Map(other.files);
      stream.push(`reset refs/heads/${this.current}\nfrom :${current.head}\n\n`);
    }
  }

  _commit(commit, stream, pendingLabels) {
    const branch = this.branches.get(this.current);
    const { options } = commit;
    const author = options.authored ? this._time(options.authored, commit.number) : commit.time;
    const committer = options.committer || commit.actor;
    const [first] = commit.ops;
    if (first.name === 'merge' || first.name === 'rebase') {
      const other = this.branches.get(first.args[0]?.value);
      if (!other || commit.ops.length > 1) throw new ScriptError(commit.number, `${first.name} needs one existing branch and no other operation`);
      if (first.name === 'merge') {
        const merged = new Map(branch.files);
        for (const path of new Set([...other.fork.keys(), ...other.files.keys()])) {
          if (other.files.get(path) === other.fork.get(path)) continue;
          if (other.files.has(path)) merged.set(path, other.files.get(path));
          else merged.delete(path);
        }
        const changes = diff(branch.files, merged);
        const message = this._message(options.subject || `Merge branch '${first.args[0].value}'`, options);
        this._emit(stream, branch, { author: commit.actor, authorTime: author, committer, committerTime: commit.time, message, changes, merge: other.head, label: options.label }, pendingLabels);
        branch.files = merged;
      } else {
        for (const entry of other.log) {
          for (const [path, content] of entry.changes) {
            if (content === null) branch.files.delete(path);
            else branch.files.set(path, content);
          }
          this._emit(stream, branch, { ...entry, committer, committerTime: commit.time, label: null }, pendingLabels);
        }
        if (options.label) pendingLabels.push([options.label, branch.head]);
        other.head = branch.head;
        other.files = new Map(branch.files);
        other.fork = new Map(branch.files);
        other.log = [];
      }
      return;
    }
    const before = new Map(branch.files);
    let subject = '';
    for (const op of commit.ops) {
      const opSubject = this._apply(branch.files, op, commit);
      subject ||= opSubject;
    }
    const changes = diff(before, branch.files);
    const message = this._message(options.subject || subject, options);
    const record = { author: commit.actor, authorTime: author, committer, committerTime: commit.time, message, changes, label: options.label };
    this._emit(stream, branch, record, pendingLabels);
    branch.log.push(record);
  }

  _message(subject, options) {
    const trailers = [];
    if (options.run) trailers.push(`Run: ${options.run}`);
    if (options.via) trailers.push(`AGESight-Via: ${options.via}`);
    return trailers.length ? `${subject}\n\n${trailers.join('\n')}\n` : `${subject}\n`;
  }

  _emit(stream, branch, { author, authorTime, committer, committerTime, message, changes, merge, label }, pendingLabels) {
    const mark = this.nextMark++;
    const parts = [
      `commit refs/heads/${this.current}\nmark :${mark}\n`,
      `author ${this._person(author)} ${Math.floor(authorTime.ms / 1000)} ${gitOffset(authorTime.offset)}\n`,
      `committer ${this._person(committer)} ${Math.floor(committerTime.ms / 1000)} ${gitOffset(committerTime.offset)}\n`,
      `data ${Buffer.byteLength(message)}\n${message}\n`,
    ];
    if (branch.head) parts.push(`from :${branch.head}\n`);
    if (merge) parts.push(`merge :${merge}\n`);
    for (const [path, content] of changes) {
      if (content === null) parts.push(`D ${quotePath(path)}\n`);
      else parts.push(`M 100644 inline ${quotePath(path)}\ndata ${Buffer.byteLength(content)}\n${content}\n`);
    }
    stream.push(parts.join(''), '\n');
    branch.head = mark;
    if (label) pendingLabels.push([label, mark]);
  }

  // Applies one file operation to a branch's files; returns its default subject.
  _apply(files, { name, args, number, options }, commit) {
    const word = (index) => {
      const token = args[index];
      if (!token || token.type === 'json') throw new ScriptError(number, `${name}: argument ${index + 1} is missing`);
      return token.value;
    };
    const fields = args.find(token => token.type === 'json')?.value || {};
    const findTask = (id) => {
      for (const path of files.keys()) if (TASK_FILE.exec(path)?.[1] === id) return path;
      throw new ScriptError(number, `${name}: no task ${id}`);
    };
    const place = (state) => {
      if (!STATES[state]) throw new ScriptError(number, `${name}: unknown state ${state}`);
      return STATES[state];
    };
    const relocate = (id, path, content) => {
      const target = `${place(commit.targetState).dir}/${id}-${slug(frontmatterValue(content, 'title'))}.md`;
      if (target !== path) files.delete(path);
      files.set(target, content);
    };
    switch (name) {
      case 'create': {
        const id = word(0);
        const { dir, status } = place(word(1));
        const title = word(2);
        if (!/^T\d{3,}$/.test(id)) throw new ScriptError(number, `invalid task id ${id}`);
        files.set(`${dir}/${id}-${slug(title)}.md`, renderTask(id, title, status, fields, commit.time));
        return `Create ${id}: ${title}`;
      }
      case 'move':
      case 'kill':
      case 'set': {
        const id = word(0);
        const path = findTask(id);
        const state = name === 'move' ? word(1) : name === 'kill' ? 'killed' : null;
        const updates = { ...fields };
        if (state) updates.status = place(state).status;
        let content = editFrontmatter(files.get(path), updates);
        if ('title' in fields) content = content.replace(/^# T\d{3,} — .*$/m, `# ${id} — ${fields.title}`);
        const directory = state ? state : path.startsWith('deaddrop/backlog/') ? 'backlog' : path.startsWith('deaddrop/tasks/done/') ? 'done' : 'tasks';
        commit.targetState = directory;
        relocate(id, path, content);
        return `Update ${id}: ${frontmatterValue(content, 'title')}`;
      }
      case 'remove': {
        const id = word(0);
        files.delete(findTask(id));
        return `Remove ${id}`;
      }
      case 'ckpt': {
        const id = word(0);
        const kind = word(1);
        const what = word(2);
        const path = `deaddrop/checkpoints/${id}.jsonl`;
        const ts = options.ts ? this._time(options.ts, number) : commit.time;
        const line = kind === 'raw'
          ? what
          : JSON.stringify({ ts: utcSeconds(ts.ms), run: options.session || 'fabricated', kind, what, next: 'resume' });
        files.set(path, `${files.get(path) || ''}${line}\n`);
        return `ckpt: ${id}`;
      }
      case 'project': {
        const current = files.has('project.json') ? JSON.parse(files.get('project.json')) : {};
        files.set('project.json', `${JSON.stringify({ ...current, ...fields }, null, 2)}\n`);
        return 'Update project';
      }
      case 'write': {
        files.set(word(0), word(1));
        return `Write ${word(0)}`;
      }
      case 'delete': {
        files.delete(word(0));
        return `Delete ${word(0)}`;
      }
      default:
        throw new ScriptError(number, `unknown operation ${name}`);
    }
  }

  async _import(stream, pendingLabels) {
    const marks = join(this.dir, '.git', 'fabricate.marks');
    stream.push('done\n');
    await drain(gitStream(this.dir, ['fast-import', '--quiet', '--done', `--import-marks-if-exists=${marks}`, `--export-marks=${marks}`], { input: stream.join('') }));
    for (const line of (await readFile(marks, 'utf8')).split('\n')) {
      const [mark, sha] = line.split(' ');
      if (sha) this.marks.set(Number(mark.slice(1)), sha);
    }
    for (const [label, mark] of pendingLabels) this.shas[label] = this.marks.get(mark);
    // The working tree follows HEAD, so the repository reads like a checkout.
    await drain(gitStream(this.dir, ['reset', '--hard', '--quiet']));
    for (const dir of ['deaddrop/backlog', 'deaddrop/tasks/done', 'deaddrop/checkpoints']) await mkdir(join(this.dir, dir), { recursive: true });
  }
}

function diff(before, after) {
  const changes = new Map();
  for (const [path, content] of after) if (before.get(path) !== content) changes.set(path, content);
  for (const path of before.keys()) if (!after.has(path)) changes.set(path, null);
  return changes;
}

async function drain(stream) {
  for await (const _chunk of stream);
}

// Creates a git repository in `dir`, which must be new or empty, and runs
// `script` in it. Returns the Fabrication, whose `run(script)` appends more.
export async function fabricate(dir, script, options = {}) {
  await mkdir(dir, { recursive: true });
  if ((await readdir(dir)).length) throw new Error(`fabricate: ${dir} is not empty`);
  const fabrication = new Fabrication(dir, options);
  try {
    await drain(gitStream(dir, ['init', '--quiet', '--initial-branch=main']));
    await drain(gitStream(dir, ['config', 'user.name', fabrication.operator]));
    await drain(gitStream(dir, ['config', 'user.email', fabrication.email]));
    await fabrication.run(script);
  } catch (error) {
    await rm(dir, { recursive: true, force: true });
    throw error;
  }
  return fabrication;
}
