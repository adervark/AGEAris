#!/usr/bin/env node
// T082 R0c: what `research.sh fact` and `research.sh --check` would refuse,
// run by each transcriber on its own output until it comes back clean.
//
//   node check.mjs <cut.jsonl> <ledger.jsonl> <measurands.jsonl> <rsna-repo> [--prefix G1]
//
// Checks, per v2.5 §5.2:
//   - every line parses, and is a `fact` or a `skip`;
//   - fact ids carry the group prefix and are unique;
//   - a fact's `at` is a clause in the cut, and its `says` is found verbatim
//     in that clause (Markdown emphasis, code ticks and spacing ignored);
//   - its `value` is found verbatim in its `says`;
//   - its mark is one of the five; an INFERRED fact has premises;
//   - premises are fact ids of this group or clause ids (`<doc>#<n>`);
//   - each `src` has a known form; an `m:` names a registered measurand;
//   - each `path:line@commit` source has a ref found on that line;
//   - a skip names clauses in the cut, a reason from the closed list, and
//     `of` when the reason needs one;
//   - **every clause in the cut is disposed of**, by a fact's `at` or a skip.
// Prints a summary and the first problems; exits 1 while any remain.
//
// RSNA is read with `git show` under GIT_OPTIONAL_LOCKS=0. Nothing is written.

import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { normalise } from '../clauses.mjs';

const args = process.argv.slice(2);
const [cutPath, ledgerPath, measPath, repo] = args;
const prefix = args.includes('--prefix') ? args[args.indexOf('--prefix') + 1] : null;
if (!repo) { console.error('usage: node check.mjs <cut> <ledger> <measurands> <rsna-repo> [--prefix G1]'); process.exit(2); }

const readJsonl = (p) => readFileSync(p, 'utf8').split('\n').map((l, i) => [l, i + 1]).filter(([l]) => l.trim());
const cut = readJsonl(cutPath).map(([l]) => JSON.parse(l));
const byClause = new Map(cut.map((c) => [c.id, c]));
const order = cut.map((c) => c.id);
const measurands = new Set(readJsonl(measPath).map(([l]) => JSON.parse(l)).filter((o) => o.kind === 'object').map((o) => o.name));

const problems = [];
const bad = (line, msg) => problems.push(`line ${line}: ${msg}`);
const MARKS = new Set(['REPRODUCED', 'MEASURED', 'SIMULATED', 'READ', 'INFERRED']);
const WHY = new Set(['no-claim', 'repeat', 'quote']);
const disposed = new Map();
const ids = new Set();
const facts = [];
let skips = 0;

const norm = (t) => normalise(String(t)).text.trim();
const fileCache = new Map();
function lineAt(path, commit, n) {
  const k = `${commit}:${path}`;
  if (!fileCache.has(k)) {
    try {
      fileCache.set(k, execFileSync('git', ['-C', repo, 'show', k], { env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' }, encoding: 'utf8', maxBuffer: 64 << 20, stdio: ['ignore', 'pipe', 'ignore'] }).split('\n'));
    } catch { fileCache.set(k, null); }
  }
  const f = fileCache.get(k);
  return f ? f[n - 1] : undefined;
}

// `doc#a-b` expands to the clause ids between a and b in the cut's order.
function expand(ref) {
  const hash = ref.lastIndexOf('#');
  const dash = ref.indexOf('-', hash);
  if (hash < 0 || dash < 0) return [ref];
  const doc = ref.slice(0, hash), a = Number(ref.slice(hash + 1, dash)), b = Number(ref.slice(dash + 1));
  if (!Number.isInteger(a) || !Number.isInteger(b) || b < a || b - a > 2000) return [ref];
  const out = [];
  for (let n = a; n <= b; n++) out.push(`${doc}#${n}`);
  return out;
}

for (const [raw, n] of readJsonl(ledgerPath)) {
  let o;
  try { o = JSON.parse(raw); } catch { bad(n, 'does not parse'); continue; }
  if (o.kind === 'skip') {
    skips++;
    const list = [].concat(o.clauses || []).flatMap(expand);
    if (!list.length) bad(n, 'skip names no clauses');
    for (const c of list) {
      if (!byClause.has(c)) bad(n, `skip names ${c}, not in the cut`);
      else disposed.set(c, (disposed.get(c) || []).concat('skip'));
    }
    if (!WHY.has(o.why)) bad(n, `skip why "${o.why}" is not no-claim, repeat or quote`);
    if ((o.why === 'repeat' || o.why === 'quote') && !o.of) bad(n, `a ${o.why} skip needs "of"`);
    continue;
  }
  if (o.kind !== 'fact') { bad(n, `kind "${o.kind}" is not fact or skip`); continue; }
  facts.push(o);
  if (!o.id || (prefix && !String(o.id).startsWith(`${prefix}-F`))) bad(n, `id "${o.id}" must be ${prefix || '<group>'}-F<n>`);
  if (ids.has(o.id)) bad(n, `id ${o.id} is used twice`);
  ids.add(o.id);
  const clause = byClause.get(o.at);
  if (!clause) bad(n, `${o.id}: at "${o.at}" is not a clause in the cut`);
  else {
    disposed.set(o.at, (disposed.get(o.at) || []).concat(o.id));
    const says = norm(o.says || '');
    if (!says) bad(n, `${o.id}: says is empty`);
    else if (Buffer.byteLength(o.says) > 240) bad(n, `${o.id}: says is over 240 bytes`);
    else if (!norm(clause.text).includes(says)) bad(n, `${o.id}: says is not verbatim in ${o.at}: "${clause.text.slice(0, 120)}"`);
    if (o.value === undefined || o.value === '') bad(n, `${o.id}: value is empty`);
    else if (!says.includes(norm(o.value))) bad(n, `${o.id}: value "${o.value}" is not verbatim in says`);
  }
  if (!MARKS.has(o.mark)) bad(n, `${o.id}: mark "${o.mark}"`);
  const premises = o.premises || [];
  if (o.mark === 'INFERRED' && !premises.length) bad(n, `${o.id}: INFERRED with no premises`);
  if (premises.length && !['lane', 'transcriber'].includes(o.premises_by)) bad(n, `${o.id}: premises_by must be lane or transcriber`);
  for (const p of premises) {
    const isClause = p.includes('#');
    if (!isClause && prefix && p.startsWith(`${prefix}-F`)) continue; // checked below, once all ids are read
    if (!isClause && !/^G[1-4C]-F[0-9]+$/.test(p)) bad(n, `${o.id}: premise "${p}" is neither a fact id nor a clause id`);
  }
  const refs = o.refs || [];
  for (const s of o.src || []) {
    if (typeof s !== 'string') { bad(n, `${o.id}: a src is not a string`); continue; }
    if (s.startsWith('m:')) { if (!measurands.has(s.slice(2))) bad(n, `${o.id}: ${s} is not a registered measurand`); continue; }
    if (s.startsWith('cmd:') || s.startsWith('url:') || s.startsWith('submission:')) continue;
    const at = s.lastIndexOf('@');
    if (at < 0) { bad(n, `${o.id}: src "${s}" has no @commit or @worktree`); continue; }
    const head = s.slice(0, at), pin = s.slice(at + 1);
    const colon = head.lastIndexOf(':'), hash = head.indexOf('#');
    if (hash > 0 && (colon < 0 || colon < hash)) continue; // path#heading or path#symbol
    if (colon < 0) { bad(n, `${o.id}: src "${s}" is neither path:line nor path#symbol`); continue; }
    const path = head.slice(0, colon), lines = head.slice(colon + 1);
    const first = Number(lines.split('-')[0]);
    if (!Number.isInteger(first) || first < 1) { bad(n, `${o.id}: src "${s}" has no line number`); continue; }
    if (pin.startsWith('worktree')) continue; // read with cat; hashed, not checked here
    if (!refs.length) { bad(n, `${o.id}: src ${s} needs at least one ref found on that line`); continue; }
    const last = Number(lines.split('-')[1] || first);
    let text = '';
    for (let k = first; k <= Math.min(last, first + 20); k++) { const t = lineAt(path, pin, k); if (t === undefined) break; text += t + '\n'; }
    if (!text) bad(n, `${o.id}: src ${s} is not readable at ${pin}`);
    else if (!refs.some((r) => text.includes(r))) bad(n, `${o.id}: none of refs ${JSON.stringify(refs)} is on ${s}`);
  }
}
for (const f of facts) for (const p of f.premises || []) {
  if (prefix && p.startsWith(`${prefix}-F`) && !ids.has(p)) problems.push(`${f.id}: premise ${p} is not a fact in this ledger`);
}
const undisposed = order.filter((c) => !disposed.has(c));
const summary = { clauses: order.length, disposed: order.length - undisposed.length, undisposed: undisposed.length, facts: facts.length, skips, problems: problems.length };
console.log(JSON.stringify(summary));
if (undisposed.length) console.log('undisposed (first 40):', undisposed.slice(0, 40).join(' '));
for (const p of problems.slice(0, 40)) console.log(p);
if (problems.length > 40) console.log(`… and ${problems.length - 40} more`);
process.exit(undisposed.length || problems.length ? 1 : 0);
