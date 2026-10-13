// T075: stands in for `research.sh` stage 1, linking only. It reads a v2.4
// fact ledger, resolves every fact's referents exactly as
// docs/plans/research-runs.md v2.4 §5.2 defines them, links facts from
// different documents that share a referent, and makes canaries from the
// ledger's own facts.
//
//   node link.mjs <ledger.jsonl> <rsna-repo> <out-dir> <canary-key.json>
//
// Writes <out-dir>/pairs.json (what the reconciler sees: real pairs and
// canaries, shuffled, unmarked), <out-dir>/view.jsonl (the ledger with the
// canary lines appended in its id sequence), <out-dir>/link-report.json (the
// referents, warnings and counts), and the canary key to <canary-key.json>,
// which the reconciler never sees until the pass is graded.
//
// RSNA is read with `git show` and, for untracked files, `fs.readFileSync`;
// nothing is written there. No regular expression can backtrack on the
// untrusted text: every match below is a fixed-prefix test or a linear scan.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const [ledgerPath, repo, outDir, keyPath] = process.argv.slice(2);
if (!keyPath) { console.error('usage: node link.mjs <ledger> <repo> <out-dir> <canary-key>'); process.exit(2); }

const lines = [];
const bad = [];
readFileSync(ledgerPath, 'utf8').split('\n').forEach((l, i) => {
  if (!l.trim()) return;
  try { lines.push(JSON.parse(l)); } catch { bad.push(i + 1); }
});
const facts = lines.filter((x) => x.kind === 'fact');
const byId = new Map(facts.map((f) => [f.id, f]));

const cache = new Map();
function fileAt(path, commit) {
  const k = `${commit}:${path}`;
  if (cache.has(k)) return cache.get(k);
  let text = null;
  try {
    text = execFileSync('git', ['-C', repo, 'show', k], {
      encoding: 'utf8', maxBuffer: 64 << 20, env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' }, stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch { text = null; }
  cache.set(k, text);
  return text;
}
function worktreeFile(path) {
  const p = join(repo, path);
  return existsSync(p) ? readFileSync(p, 'utf8') : null;
}

const indentOf = (s) => { let n = 0; while (n < s.length && (s[n] === ' ' || s[n] === '\t')) n++; return n; };
const DEF_WORDS = ['def ', 'async def ', 'class ', 'function ', 'async function '];
function defName(trimmed) {
  for (const w of DEF_WORDS) {
    if (trimmed.startsWith(w)) {
      let i = w.length, name = '';
      while (i < trimmed.length && !'( :{<'.includes(trimmed[i])) name += trimmed[i++];
      return name || null;
    }
  }
  return null;
}
// The enclosing definition (code) or heading (Markdown) of a 1-based line.
function enclosing(text, path, lineNo) {
  const ls = text.split('\n');
  const line = ls[lineNo - 1];
  if (line === undefined) return { error: 'no such line' };
  if (!line.trim()) return { error: 'blank line' };
  if (path.endsWith('.md')) {
    for (let i = lineNo - 1; i >= 0; i--) {
      if (ls[i].startsWith('#')) {
        let j = 0; while (j < ls[i].length && ls[i][j] === '#') j++;
        return { sym: ls[i].slice(j).trim(), line };
      }
    }
    return { sym: null, line };
  }
  const ind = indentOf(line);
  for (let i = lineNo - 2; i >= 0; i--) {
    const l = ls[i];
    if (!l.trim()) continue;
    const li = indentOf(l);
    if (li < ind) {
      const n = defName(l.trim());
      if (n) return { sym: n, line };
    }
  }
  return { sym: null, line };
}

// Parses `path:line@rest` linearly: the last ':' before the '@'.
function parsePathLine(s) {
  const at = s.indexOf('@');
  if (at < 0) return null;
  const head = s.slice(0, at), rest = s.slice(at + 1);
  const colon = head.lastIndexOf(':');
  if (colon < 0) return null;
  let a = head.slice(colon + 1);
  const dash = a.indexOf('-');
  if (dash >= 0) a = a.slice(0, dash);
  const n = Number(a);
  if (!Number.isInteger(n) || n < 1) return null;
  return { path: head.slice(0, colon), line: n, rest };
}

const warnings = [];
function referentsOf(f) {
  const out = new Set();
  for (const r of f.refs || []) out.add(`ref:${r}`);
  for (const s of f.src || []) {
    if (typeof s !== 'string') continue;
    if (s.startsWith('url:') || s.startsWith('submission:')) { out.add(s); continue; }
    if (s.startsWith('cmd:')) { out.add(`cmd:${s.slice(4, s.lastIndexOf('#') > 4 ? s.lastIndexOf('#') : s.length)}`); continue; }
    const hashSym = s.indexOf('#');
    const pl = parsePathLine(s);
    if (!pl) {
      if (hashSym > 0) { // path#symbol@commit
        const at = s.indexOf('@');
        const path = s.slice(0, hashSym), sym = s.slice(hashSym + 1, at > hashSym ? at : s.length);
        out.add(`def:${path}#${sym}`); out.add(`file:${path}`);
      } else warnings.push({ fact: f.id, code: 'unparsed-src', src: s });
      continue;
    }
    let text = null, where = pl.rest;
    if (pl.rest.startsWith('worktree')) { text = worktreeFile(pl.path); out.add(`worktree:${pl.path}`); }
    else if (pl.rest === 'missing') { out.add(`file:${pl.path}`); warnings.push({ fact: f.id, code: 'source-missing', src: s }); continue; }
    else text = fileAt(pl.path, pl.rest);
    if (text === null) { warnings.push({ fact: f.id, code: 'unreadable', src: s }); out.add(`file:${pl.path}`); continue; }
    const e = enclosing(text, pl.path, pl.line);
    if (e.error) { warnings.push({ fact: f.id, code: e.error, src: s }); out.add(`file:${pl.path}`); continue; }
    const refs = f.refs || [];
    if (refs.length === 0) warnings.push({ fact: f.id, code: 'no-refs', src: s });
    else if (!refs.some((r) => e.line.includes(r))) warnings.push({ fact: f.id, code: 'ref-not-on-line', src: s, line: e.line.trim().slice(0, 160) });
    out.add(e.sym ? `def:${pl.path}#${e.sym}` : `file:${pl.path}`);
    out.add(`file:${pl.path}`);
    if (where.startsWith('worktree')) warnings.push({ fact: f.id, code: 'out-of-sight', src: s });
  }
  if ((f.src || []).length === 0 && f.mark !== 'INFERRED') warnings.push({ fact: f.id, code: 'unsourced' });
  if (f.mark === 'INFERRED' && !(f.premises || []).length) warnings.push({ fact: f.id, code: 'inferred-without-premises' });
  return out;
}

const own = new Map(facts.map((f) => [f.id, referentsOf(f)]));
const full = new Map();
function resolve(id, seen = new Set()) {
  if (full.has(id)) return full.get(id);
  if (seen.has(id)) return new Set();
  seen.add(id);
  const f = byId.get(id);
  const set = new Set(own.get(id) || []);
  for (const p of (f && f.premises) || []) for (const r of resolve(p, seen)) set.add(r);
  full.set(id, set);
  return set;
}
facts.forEach((f) => resolve(f.id));

// A `def:` referent matches itself; a `file:` referent matches only when one
// side's citation resolved to no definition, which `file:` alone stands for.
const docOf = (f) => (f.from && f.from.doc) || '?';
function shared(a, b) {
  const A = full.get(a.id), B = full.get(b.id);
  const hit = [];
  const defsA = new Set([...A].filter((r) => r.startsWith('def:')).map((r) => r.slice(4, r.indexOf('#'))));
  const defsB = new Set([...B].filter((r) => r.startsWith('def:')).map((r) => r.slice(4, r.indexOf('#'))));
  for (const r of A) {
    if (r.startsWith('file:')) {
      const p = r.slice(5);
      if (B.has(r) && !(defsA.has(p) && defsB.has(p))) hit.push(r);
    } else if (B.has(r)) hit.push(r);
  }
  return hit;
}
const pairs = [];
for (let i = 0; i < facts.length; i++) for (let j = i + 1; j < facts.length; j++) {
  const a = facts[i], b = facts[j];
  if (docOf(a) === docOf(b)) continue;
  const via = shared(a, b);
  if (via.length) pairs.push({ a: a.id, b: b.id, via });
}
// Same key, different value, different documents: `conflict` by key.
const keyConflicts = [];
for (let i = 0; i < facts.length; i++) for (let j = i + 1; j < facts.length; j++) {
  const a = facts[i], b = facts[j];
  if (a.key && a.key === b.key && docOf(a) !== docOf(b) && JSON.stringify(a.value) !== JSON.stringify(b.value)) keyConflicts.push({ a: a.id, b: b.id, key: a.key });
}
const perRef = {};
for (const p of pairs) for (const v of p.via) perRef[v] = (perRef[v] || 0) + 1;
const hubs = Object.entries(perRef).filter(([, n]) => n > 12).map(([r, n]) => ({ r, n }));

// Canaries: six twins of real facts with a changed value, ids continuing the
// sequence, attributed to a different document. Deterministic seed.
let seed = 75;
const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const numeric = facts.filter((f) => typeof f.value === 'string' && f.value.length && !Number.isNaN(Number(f.value)) && (full.get(f.id) || new Set()).size > 0);
const docs = [...new Set(facts.map(docOf))];
const maxId = Math.max(0, ...facts.map((f) => Number(String(f.id).slice(1)) || 0));
const canaries = [];
const used = new Set();
for (let k = 0; k < 6 && used.size < numeric.length; k++) {
  let f; do { f = numeric[Math.floor(rnd() * numeric.length)]; } while (used.has(f.id));
  used.add(f.id);
  const v = Number(f.value);
  const dec = f.value.includes('.') ? f.value.split('.')[1].length : 0;
  const subset = k >= 4; // the last two: a smaller count, set-inclusion shaped
  const nv = subset ? Math.max(0, Math.round(v) - 2) : (v === 0 ? 1 : v * 1.5);
  const value = subset ? String(nv) : nv.toFixed(dec);
  const otherDocs = docs.filter((d) => d !== docOf(f));
  const doc = otherDocs[Math.floor(rnd() * otherDocs.length)];
  const id = `F${maxId + 1 + k}`;
  const says = String(f.says || '').split(f.value).join(value);
  canaries.push({ ...f, id, value, says, from: { ...f.from, doc }, ts: f.ts });
  pairs.push({ a: f.id, b: id, via: [...(full.get(f.id) || [])].slice(0, 3), canary: true });
}
// Shuffle, then strip the canary mark from what the reconciler sees.
for (let i = pairs.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [pairs[i], pairs[j]] = [pairs[j], pairs[i]]; }
const allFacts = new Map([...facts, ...canaries].map((f) => [f.id, f]));
const forReconciler = pairs.map((p, n) => ({ pair: n + 1, via: p.via, a: allFacts.get(p.a), b: allFacts.get(p.b) }));
writeFileSync(join(outDir, 'pairs.json'), JSON.stringify(forReconciler, null, 1));
writeFileSync(join(outDir, 'view.jsonl'), [...lines, ...canaries].map((x) => JSON.stringify(x)).join('\n') + '\n');
writeFileSync(keyPath, JSON.stringify({ canaries: pairs.map((p, n) => p.canary ? { pair: n + 1, real: p.a, twin: p.b } : null).filter(Boolean) }, null, 1));
const counts = {
  lines: lines.length, unparseable: bad, facts: facts.length,
  perDoc: Object.fromEntries(docs.map((d) => [d, facts.filter((f) => docOf(f) === d).length])),
  pairs: pairs.length - canaries.length, canaries: canaries.length, keyConflicts: keyConflicts.length,
  premisesByTranscriber: facts.filter((f) => f.premises_by === 'transcriber').length,
  unsourced: warnings.filter((w) => w.code === 'unsourced').length,
};
writeFileSync(join(outDir, 'link-report.json'), JSON.stringify({ counts, hubs, keyConflicts, warnings, referents: Object.fromEntries([...full].map(([k, v]) => [k, [...v]])), realPairs: pairs.filter((p) => !p.canary) }, null, 1));
console.log(JSON.stringify(counts));
