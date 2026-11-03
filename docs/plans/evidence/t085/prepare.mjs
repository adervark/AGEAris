#!/usr/bin/env node
// T085 R0d: R0c's ledger in v2.6's form, before linking. Two changes, both
// computed, no subagent:
//
//   - refs from quotes (v2.6 item 2): run `t084/quote-refs.mjs` first; this
//     script takes its output. A bare file name the scan found resolves to
//     its repository path when exactly one tracked path at the fact's commit
//     has that name, and is dropped otherwise. A transcriber's own bare ref
//     is resolved the same way, and kept as written when it does not resolve:
//     the transcriber may add refs, and the scan never removes one;
//   - each fact's commit (v2.6 item 5): `at` becomes `<clause>@<commit>`,
//     the commit its clause was cut at (`t082/r0c/cut/`, `closure-cut.jsonl`).
//
//   node prepare.mjs <r0c-ledger> <scanned-ledger> <r0c-dir> <rsna-repo> <out-ledger>
//
// RSNA is read with `git ls-tree` only, under GIT_OPTIONAL_LOCKS=0. Prints a
// report: refs resolved, dropped and kept, and facts per commit.

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const [origPath, scannedPath, r0c, repo, outPath] = process.argv.slice(2);
if (!outPath) { console.error('usage: node prepare.mjs <r0c-ledger> <scanned-ledger> <r0c-dir> <rsna-repo> <out-ledger>'); process.exit(2); }
const rd = (p) => readFileSync(p, 'utf8').split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l));

const clauses = new Map();
for (const f of readdirSync(join(r0c, 'cut')).filter((n) => n.endsWith('.jsonl'))) for (const c of rd(join(r0c, 'cut', f))) clauses.set(c.id, c);
for (const c of rd(join(r0c, 'closure-cut.jsonl'))) clauses.set(c.id, c);

const trees = new Map();
function byName(commit) {
  if (trees.has(commit)) return trees.get(commit);
  const paths = execFileSync('git', ['-C', repo, 'ls-tree', '-r', '--name-only', commit], {
    encoding: 'utf8', maxBuffer: 64 << 20, env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' },
  }).split('\n').filter(Boolean);
  const m = new Map();
  for (const p of paths) {
    const b = p.slice(p.lastIndexOf('/') + 1);
    if (!m.has(b)) m.set(b, []);
    m.get(b).push(p);
  }
  trees.set(commit, m);
  return m;
}

// quote-refs.mjs's path class: a token ending in a known extension.
const EXT = ['.py', '.sh', '.md', '.json', '.jsonl', '.csv', '.mjs', '.js', '.yml', '.yaml', '.txt', '.log', '.ipynb', '.toml'];
const isPath = (r) => EXT.some((e) => r.endsWith(e) && r.length > e.length);

const orig = new Map(rd(origPath).map((f) => [f.id, new Set(f.refs || [])]));
const report = { facts: 0, resolved: 0, dropped: 0, keptUnresolved: 0, perCommit: {}, droppedRefs: {}, resolvedRefs: {} };
const out = rd(scannedPath).map((f) => {
  if (f.kind !== 'fact') return f;
  report.facts++;
  const c = clauses.get(f.at);
  if (!c) throw new Error(`${f.id}: clause ${f.at} is not in the cut`);
  report.perCommit[c.commit] = (report.perCommit[c.commit] || 0) + 1;
  const refs = [];
  for (const r of f.refs || []) {
    if (!isPath(r) || r.includes('/')) { refs.push(r); continue; }
    const hits = byName(c.commit).get(r) || [];
    if (hits.length === 1) { refs.push(hits[0]); report.resolved++; report.resolvedRefs[`${r} -> ${hits[0]}`] = (report.resolvedRefs[`${r} -> ${hits[0]}`] || 0) + 1; }
    else if (orig.get(f.id).has(r)) { refs.push(r); report.keptUnresolved++; }
    else { report.dropped++; report.droppedRefs[r] = (report.droppedRefs[r] || 0) + 1; }
  }
  return { ...f, at: `${f.at}@${c.commit}`, refs: [...new Set(refs)] };
});
writeFileSync(outPath, out.map((x) => JSON.stringify(x)).join('\n') + '\n');
console.log(JSON.stringify(report, null, 1));
