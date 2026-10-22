#!/usr/bin/env node
// T086 H1: cuts RSNA T112's committed record into clauses, by T086's
// approved scope. Run from this folder:
//
//   node cut.mjs /home/ade/Code/RSNA cut
//
// The scope, applied mechanically:
//   - commits: from 3ed78d4 to fc0d19e, whose message names T112, less
//     trail-only commits (`ckpt:`) and those of T118 or a later task;
//   - documents: the task file; PROGRESS.md's `## T112` sections; the trail
//     (`T112.jsonl`) at fc0d19e; and the code those commits changed under
//     scripts/, src/ and tests/, and the Makefile (.py, .sh, .cmd);
//   - versions: each document's last in-scope version is cut whole, as
//     `<doc>`. Each earlier in-scope version contributes the clauses its next
//     version no longer has, as `<doc>@<commit>`: what was edited out is what
//     a correction made in place leaves behind.
//   - code is cut as its docstrings, comments and `raise` messages, the
//     code's own claims about itself (R0c's closure rule, plus the messages:
//     T112 calls one of them "confidently wrong").
//
// Every clause gets an id `<doc>#<n>`. Writes <out>/clauses.jsonl and
// <out>/scope.json. RSNA is read with `git` under GIT_OPTIONAL_LOCKS=0;
// nothing is written there.

import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import { cut } from '../t082/clauses.mjs';

const [repo, outDir] = process.argv.slice(2);
if (!repo || !outDir) { console.error('usage: node cut.mjs <rsna-repo> <out-dir>'); process.exit(2); }
const git = (...a) => execFileSync('git', ['-C', repo, ...a], { env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' }, encoding: 'utf8', maxBuffer: 64 << 20 });

const FROM = '3ed78d4', TO = 'fc0d19e';
const TASK = 'deaddrop/tasks/T112-the-4090-first-day.md', TRAIL = 'deaddrop/checkpoints/T112.jsonl';
const later = (s) => s.startsWith('ckpt:') || /^(claim )?T1(1[89]|[2-9]\d)\b/.test(s);
const commits = git('log', '--reverse', '--format=%h%x09%s', `${FROM}^..${TO}`, '--grep=T112')
  .trim().split('\n').map((l) => l.split('\t')).filter(([, s]) => !later(s)).map(([h]) => h);
const changed = (c) => git('show', '--name-only', '--format=', c).trim().split('\n');
const isCode = (p) => (p.startsWith('scripts/') || p.startsWith('src/') || p.startsWith('tests/') || p === 'Makefile') &&
  (p.endsWith('.py') || p.endsWith('.sh') || p.endsWith('.cmd') || p === 'Makefile');

// Code to prose: docstrings, comments and raise messages, one block each.
function codeProse(src, path) {
  const out = [], lines = src.split('\n');
  const py = path.endsWith('.py'), cmd = path.endsWith('.cmd');
  let doc = null, quote = '', raise = null, depth = 0;
  const strings = (s) => { const r = []; let q = '', cur = ''; for (let i = 0; i < s.length; i++) { const c = s[i]; if (!q) { if (c === '"' || c === "'") { q = c; cur = ''; } } else if (c === '\\') { cur += s[i + 1] || ''; i++; } else if (c === q) { r.push(cur); q = ''; } else cur += c; } return r.join(''); };
  for (const raw of lines) {
    const t = raw.trim();
    if (doc !== null) {
      const end = t.indexOf(quote);
      if (end >= 0) { doc.push(t.slice(0, end)); out.push(doc.join('\n')); doc = null; } else doc.push(t);
      continue;
    }
    if (py && (t.startsWith('"""') || t.startsWith("'''") || /^[rRbBuUfF]{1,2}("""|''')/.test(t))) {
      quote = t.includes('"""') ? '"""' : "'''";
      const rest = t.slice(t.indexOf(quote) + 3), end = rest.indexOf(quote);
      if (end >= 0) out.push(rest.slice(0, end)); else doc = [rest];
      continue;
    }
    if (raise !== null) {
      raise.push(strings(t)); for (const c of t) depth += c === '(' ? 1 : c === ')' ? -1 : 0;
      if (depth <= 0) { out.push(raise.join('')); raise = null; }
      continue;
    }
    if (py && t.startsWith('raise ')) {
      depth = 0; for (const c of t) depth += c === '(' ? 1 : c === ')' ? -1 : 0;
      raise = [strings(t)];
      if (depth <= 0) { out.push(raise.join('')); raise = null; }
      continue;
    }
    const lead = cmd ? (t.toUpperCase().startsWith('REM ') ? 4 : t.startsWith('::') ? 2 : -1) : t.startsWith('#') && !t.startsWith('#!') ? 1 : -1;
    if (lead >= 0) {
      const text = t.slice(lead).replace(/^[#:]*\s?/, '');
      if (out.comment) out[out.length - 1] += '\n' + text; else out.push(text);
      out.comment = true;
      continue;
    }
    out.comment = false;
    if (!cmd) { const h = raw.indexOf('  # '); if (h > 0) out.push(raw.slice(h + 4).trim()); }
  }
  return out.filter((b) => b.replace(/[\s#=*-]/g, '').length > 2).join('\n\n') + '\n';
}

// PROGRESS.md: only its `## T112` sections.
function t112Sections(src) {
  const keep = []; let on = false;
  for (const l of src.split('\n')) { if (l.startsWith('## ')) on = l.startsWith('## T112'); if (on) keep.push(l); }
  return keep.join('\n') + '\n';
}

// The trail: each entry's words, one paragraph per field.
function trailProse(src) {
  return src.trim().split('\n').map((l) => JSON.parse(l)).flatMap((o) =>
    ['brief', 'what', 'left', 'next', 'blockedReason'].filter((k) => o[k]).map((k) => `${o.ts} ${o.kind} ${k}: ${o[k]}`)).join('\n\n') + '\n';
}

// Documents and the in-scope versions of each.
const docs = new Map();
const add = (path, c) => { if (!docs.has(path)) docs.set(path, []); if (!docs.get(path).includes(c)) docs.get(path).push(c); };
for (const c of commits) for (const p of changed(c)) if (p === TASK || p === 'PROGRESS.md' || isCode(p)) add(p, c);

const rows = [], scope = { commits, documents: [] };
const norm = (s) => s.replace(/\s+/g, ' ').trim();
for (const [path, versions] of docs) {
  const name = path === TASK ? 'T112' : path === 'PROGRESS.md' ? 'PROGRESS' : basename(path);
  const prose = (c) => { const s = git('show', `${c}:${path}`); return path === 'PROGRESS.md' ? t112Sections(s) : path === TASK ? s : codeProse(s, path); };
  const texts = versions.map(prose);
  if (path === 'PROGRESS.md' && !texts[texts.length - 1].trim()) continue;
  const last = versions.length - 1;
  const emit = (doc, c, cl) => { let n = 0; for (const x of cl) rows.push({ id: `${doc}#${++n}`, doc, path, commit: c, line: path === TASK || path === 'PROGRESS.md' ? x.line : null, kind: x.kind, text: x.text }); return n; };
  const n = emit(name, versions[last], cut(texts[last]));
  const dropped = [];
  for (let i = 0; i < last; i++) {
    const next = new Set(cut(texts[i + 1]).map((x) => norm(x.text)));
    const gone = cut(texts[i]).filter((x) => !next.has(norm(x.text)));
    if (gone.length) dropped.push({ commit: versions[i], clauses: emit(`${name}@${versions[i]}`, versions[i], gone) });
  }
  scope.documents.push({ doc: name, path, versions, clauses: n, dropped });
}
const trail = trailProse(git('show', `${TO}:${TRAIL}`));
const nt = (() => { let n = 0; for (const x of cut(trail)) rows.push({ id: `trail#${++n}`, doc: 'trail', path: TRAIL, commit: TO, line: null, kind: x.kind, text: x.text }); return n; })();
scope.documents.push({ doc: 'trail', path: TRAIL, versions: [TO], clauses: nt, dropped: [] });

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'clauses.jsonl'), rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
writeFileSync(join(outDir, 'scope.json'), JSON.stringify(scope, null, 1) + '\n');
console.log(JSON.stringify({ commits: commits.length, documents: scope.documents.length, clauses: rows.length,
  byDoc: Object.fromEntries(scope.documents.map((d) => [d.doc, d.clauses + d.dropped.reduce((a, x) => a + x.clauses, 0)])) }));
