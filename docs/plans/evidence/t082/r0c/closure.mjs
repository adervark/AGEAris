#!/usr/bin/env node
// T082 R0c: v2.5's scope closure, one level deep. Every Markdown section and
// code definition that a fact cites, outside the eight documents already
// cut, is cut in turn: a Markdown section whole, a code definition as its
// docstring and comments only (the code's own claims about itself).
//
//   node closure.mjs <rsna-repo> <cut-dir> <out.jsonl> <ledger.jsonl>...
//
// Clause ids are `<file>§<anchor>#<n>`: the anchor is the heading's line for
// a section, the symbol for a definition. Prints what entered and why.
//
// RSNA is read with `git show` under GIT_OPTIONAL_LOCKS=0. Nothing is written.

import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import { show, cut } from '../clauses.mjs';

const [repo, cutDir, outPath, ...ledgers] = process.argv.slice(2);
if (!ledgers.length) { console.error('usage: node closure.mjs <rsna-repo> <cut-dir> <out.jsonl> <ledger>...'); process.exit(2); }

const inCut = new Set();
for (const f of readdirSync(cutDir)) if (f.endsWith('.jsonl')) {
  for (const l of readFileSync(join(cutDir, f), 'utf8').split('\n')) if (l.trim()) inCut.add(JSON.parse(l).path);
}

const facts = ledgers.flatMap((p) => readFileSync(p, 'utf8').split('\n').filter((l) => l.trim()).map((l) => { try { return JSON.parse(l); } catch { return null; } }))
  .filter((o) => o && o.kind === 'fact');

const text = new Map();
function file(path, commit) {
  const k = `${commit}:${path}`;
  if (!text.has(k)) { try { text.set(k, show(repo, path, commit)); } catch { text.set(k, null); } }
  return text.get(k);
}

// The Markdown section holding a line: from its heading to the next heading
// of the same or a higher level.
function sectionAt(src, line) {
  const lines = src.split('\n');
  let h = -1, level = 0;
  for (let i = Math.min(line, lines.length) - 1; i >= 0; i--) {
    const t = lines[i];
    if (t.startsWith('#')) { h = i; level = t.length - t.replace(/^#+/, '').length; break; }
  }
  if (h < 0) return null;
  let end = lines.length;
  for (let i = h + 1; i < lines.length; i++) {
    const t = lines[i];
    if (t.startsWith('#') && t.length - t.replace(/^#+/, '').length <= level) { end = i; break; }
  }
  return { anchor: String(h + 1), heading: lines[h], body: lines.slice(h, end).join('\n') };
}
function sectionNamed(src, heading) {
  const lines = src.split('\n');
  const want = heading.trim().toLowerCase();
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('#') && lines[i].replace(/^#+/, '').trim().toLowerCase().startsWith(want)) return sectionAt(src, i + 1);
  }
  return null;
}

const indent = (t) => t.length - t.trimStart().length;
// The definition enclosing a line, by indentation, and its docstring and
// comment lines, joined as prose.
function definitionAt(src, line) {
  const lines = src.split('\n');
  for (let i = Math.min(line, lines.length) - 1; i >= 0; i--) {
    const t = lines[i].trimStart();
    if (t.startsWith('def ') || t.startsWith('class ') || t.startsWith('async def ') || t.startsWith('function ')) {
      const d = indent(lines[i]);
      if (i !== line - 1 && indent(lines[line - 1] || '') <= d && (lines[line - 1] || '').trim()) continue;
      let end = lines.length;
      for (let j = i + 1; j < lines.length; j++) if (lines[j].trim() && indent(lines[j]) <= d) { end = j; break; }
      const name = t.replace('async ', '').split(' ')[1].split('(')[0].split(':')[0];
      return { anchor: name, body: lines.slice(i, end) };
    }
  }
  return null;
}
function definitionNamed(src, symbol) {
  const lines = src.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trimStart();
    if (t.startsWith(`def ${symbol}(`) || t.startsWith(`class ${symbol}`) || t.startsWith(`function ${symbol}(`)) return definitionAt(src, i + 1);
  }
  return null;
}
function proseOf(body) {
  const out = [];
  let inDoc = false;
  for (const l of body) {
    const t = l.trim();
    const q = t.includes('"""') ? '"""' : t.includes("'''") ? "'''" : null;
    if (q) {
      const parts = t.split(q);
      if (!inDoc && parts.length >= 3) { out.push(parts[1]); continue; }
      if (!inDoc) { inDoc = true; out.push(parts[1] || ''); continue; }
      out.push(parts[0]); inDoc = false; continue;
    }
    if (inDoc) { out.push(t); continue; }
    const hash = t.startsWith('#') ? 0 : t.indexOf('  # ');
    if (hash >= 0) out.push(t.slice(hash).replace(/^\s*#+\s?/, ''));
    else out.push('');
  }
  return out.join('\n');
}

// The paragraph, list item or table row holding a cited line, with the
// heading above it for context: v2.5's closure grain for a `path:line`.
function blockAt(src, line) {
  // A blockquote's "> " is a prefix, not content: a quoted table or list is
  // cut by row and by item like any other (R0c's first closure ran a quoted
  // table in pm/STATE.md together into one 154-clause block).
  const lines = src.split('\n').map((l) => { let t = l.trimStart(); while (t.startsWith('>')) t = t.slice(1).trimStart(); return t; });
  const blank = (t) => !t.trim();
  const starts = (t) => t.startsWith('#') || t.startsWith('|') || t.startsWith('- ') || t.startsWith('* ') ||
    (t[0] >= '0' && t[0] <= '9' && t.indexOf('. ') > 0 && t.indexOf('. ') < 4);
  let a = line - 1, b = line - 1;
  if (!lines[a] || blank(lines[a])) return null;
  if (!lines[a].startsWith('|')) {
    while (a > 0 && !starts(lines[a]) && !blank(lines[a - 1]) && !lines[a - 1].startsWith('#') && !lines[a - 1].startsWith('|')) a--;
    while (b + 1 < lines.length && !blank(lines[b + 1]) && !starts(lines[b + 1])) b++;
  }
  return { anchor: String(a + 1), body: lines.slice(a, b + 1).join('\n') };
}
const WIDE = 40;
const wide = [];
const units = new Map();
const why = [];
for (const f of facts) for (const s of f.src || []) {
  if (typeof s !== 'string' || s.startsWith('cmd:') || s.startsWith('m:') || s.startsWith('url:') || s.startsWith('submission:')) continue;
  const at = s.lastIndexOf('@');
  if (at < 0) continue;
  const head = s.slice(0, at), commit = s.slice(at + 1);
  if (commit.startsWith('worktree')) continue;
  const hash = head.indexOf('#'), colon = head.lastIndexOf(':');
  const path = hash > 0 ? head.slice(0, hash) : head.slice(0, colon);
  if (inCut.has(path)) continue;
  const src = file(path, commit);
  if (src === null) continue;
  const md = path.endsWith('.md');
  let u = null;
  if (hash > 0) {
    u = md ? sectionNamed(src, head.slice(hash + 1)) : definitionNamed(src, head.slice(hash + 1));
    // A whole section is too wide to close over: R0c measured 2,341 clauses
    // for T075's 232 facts at section grain. A section cited by name enters
    // only when it is short; otherwise the citation is reported as too wide.
    if (u && md && cut(u.body).length > WIDE) { wide.push({ fact: f.id, src: s, clauses: cut(u.body).length }); continue; }
  } else {
    const line = Number(head.slice(colon + 1).split('-')[0]);
    if (!Number.isInteger(line)) continue;
    u = md ? blockAt(src, line) : definitionAt(src, line);
  }
  if (!u) continue;
  const label = `${basename(path)}§${u.anchor}`;
  if (!units.has(label)) units.set(label, { label, path, commit, md, u, by: [] });
  units.get(label).by.push(f.id);
}

const rows = [];
for (const { label, path, commit, md, u, by } of units.values()) {
  const prose = md ? u.body : proseOf(u.body);
  const cs = cut(prose);
  for (const c of cs) rows.push({ id: `${label}#${c.n}`, doc: label, path, commit, line: null, kind: c.kind, text: c.text });
  why.push({ unit: label, clauses: cs.length, citedBy: [...new Set(by)].slice(0, 6) });
}
writeFileSync(outPath, rows.map((r) => JSON.stringify(r)).join('\n') + (rows.length ? '\n' : ''));
console.log(JSON.stringify({ units: units.size, clauses: rows.length, tooWide: wide.length }));
for (const w of wide) console.log('too wide:', JSON.stringify(w));
for (const w of why) console.log(JSON.stringify(w));
