#!/usr/bin/env node
// T082 R0c: `search-flipped` (v2.5 §5.2, 7). Every `cmd:` source in the
// ledger is re-run at the round's head, and a changed output fires on the
// fact.
//
//   node searchflip.mjs <ledger.jsonl> <rsna-repo> <head> <out.json>
//
// Only `git grep`, `git show` and `git log` are re-run: the command is split
// into words (single and double quotes honoured, no shell), and the commit
// it names is swapped for <head>. A command with a pipe, a redirection or
// no commit in it, `git log` (it reads a commit, not a tree), or any other
// program, is reported as `not-rerun` with why. A changed output fires as
// `flipped` when its line count changed (a match appeared or went), and as
// `drifted` when only the matched lines' text or numbers moved. Both runs are read-only, under GIT_OPTIONAL_LOCKS=0, and an exit
// status of 1 from `git grep` (no match) is an empty result, not an error.

import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const [ledgerPath, repo, head, outPath] = process.argv.slice(2);
if (!outPath) { console.error('usage: node searchflip.mjs <ledger> <rsna-repo> <head> <out.json>'); process.exit(2); }
const facts = readFileSync(ledgerPath, 'utf8').split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l)).filter((o) => o.kind === 'fact');

function words(s) {
  const out = []; let cur = '', q = null, any = false;
  for (const c of s) {
    if (q) { if (c === q) q = null; else cur += c; continue; }
    if (c === '"' || c === "'") { q = c; any = true; continue; }
    if (c === ' ' || c === '\t') { if (cur || any) out.push(cur); cur = ''; any = false; continue; }
    if (c === '|' || c === '>' || c === '<' || c === ';' || c === '&' || c === '`' || c === '$') return { error: `shell syntax ${c}` };
    cur += c;
  }
  if (q) return { error: 'unclosed quote' };
  if (cur || any) out.push(cur);
  return { argv: out };
}
const isHex = (w) => w.length >= 7 && w.length <= 40 && [...w].every((c) => '0123456789abcdef'.includes(c));
function run(argv) {
  try {
    return execFileSync('git', ['-C', repo, ...argv], { encoding: 'utf8', maxBuffer: 64 << 20, env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' }, stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    if (argv[0] === 'grep' && e.status === 1) return '';
    return { error: String(e.stderr || e.message).trim().slice(0, 200) };
  }
}
const lines = (s) => s.split('\n').filter(Boolean).length;
const hash = (s) => createHash('sha256').update(s).digest('hex').slice(0, 12);

const seen = new Map();
const results = [];
for (const f of facts) for (const s of f.src || []) {
  if (typeof s !== 'string' || !s.startsWith('cmd:')) continue;
  const cmd = s.slice(4);
  if (!seen.has(cmd)) {
    const w = words(cmd);
    let r;
    if (w.error) r = { status: 'not-rerun', why: w.error };
    else if (w.argv[0] !== 'git' || !['grep', 'show', 'log'].includes(w.argv[1])) r = { status: 'not-rerun', why: `not a git search: ${w.argv[0]}` };
    else if (w.argv[1] === 'log') r = { status: 'not-rerun', why: 'git log reads a commit, not a tree at a commit' };
    else {
      const argv = w.argv.slice(1);
      // The revision: a bare hex word, or the part of `<rev>:<path>` before the colon.
      const at = argv.findIndex((x) => isHex(x) || (x.includes(':') && isHex(x.slice(0, x.indexOf(':')))));
      if (at < 0) r = { status: 'not-rerun', why: 'names no commit' };
      else {
        const was = argv[at].includes(':') ? argv[at].slice(0, argv[at].indexOf(':')) : argv[at];
        const then = run(argv);
        const now = run(argv.map((x, i) => (i === at ? head + x.slice(was.length) : x)));
        if (typeof then !== 'string' || typeof now !== 'string') r = { status: 'error', was, then: typeof then === 'string' ? hash(then) : then.error, now: typeof now === 'string' ? hash(now) : now.error };
        else r = { status: then === now ? 'same' : lines(then) === lines(now) ? 'drifted' : 'flipped', was, then: hash(then), now: hash(now), thenLines: then ? then.split('\n').filter(Boolean).length : 0, nowLines: now ? now.split('\n').filter(Boolean).length : 0, nowHead: now.split('\n').filter(Boolean).slice(0, 3) };
      }
    }
    seen.set(cmd, r);
  }
  results.push({ fact: f.id, orig: f.orig, cmd, ...seen.get(cmd) });
}
const count = (st) => results.filter((r) => r.status === st).length;
const summary = { head, commands: seen.size, sources: results.length, same: count('same'), flipped: count('flipped'), drifted: count('drifted'), notRerun: count('not-rerun'), error: count('error') };
writeFileSync(outPath, JSON.stringify({ summary, flipped: results.filter((r) => r.status === 'flipped'), drifted: results.filter((r) => r.status === 'drifted'), results }, null, 1) + '\n');
console.log(JSON.stringify(summary));
for (const r of results.filter((x) => x.status === 'flipped')) console.log(`flipped ${r.fact} (${r.orig}): ${r.cmd} — ${r.thenLines} → ${r.nowLines} lines`);
