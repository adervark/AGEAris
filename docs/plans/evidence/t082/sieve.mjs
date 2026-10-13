#!/usr/bin/env node
// T082: the clause sieve, v2.5's answer to "which facts get written down is
// one agent's choice". It cuts every document a round reads into clauses,
// mechanically, so that what was left out is a list anyone can read rather
// than an absence nobody can see.
//
//   node sieve.mjs <rsna-repo> <out-dir> [ledger.jsonl]
//
// Writes <out-dir>/clauses.jsonl, one line per clause:
//   { id, doc, commit, line, text, claim, covered }
// `claim` is true when the clause carries a digit, or one of the words in
// CLAIM_WORDS, or an inference arrow: what v2.5 obliges a transcriber to
// dispose of, as a fact or as a skip with a reason. `covered` is set when a
// ledger is given: some fact's `says`, found verbatim in the document,
// overlaps the clause.
//
// RSNA is read with `git show` under GIT_OPTIONAL_LOCKS=0, and nothing in it
// is written. No dependencies.

import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [repo, outDir, ledgerPath] = process.argv.slice(2);
if (!repo || !outDir) {
  console.error('usage: node sieve.mjs <rsna-repo> <out-dir> [ledger.jsonl]');
  process.exit(2);
}

// What T075's transcriber read, at the commits it read them.
const R3 = 'e4e356c', BASE = 'd9c7c6e';
export const READ = [
  ['docs/RESEARCH-0902-road-to-0960.md', BASE, 'R1'],
  ['docs/RESEARCH-0902b-round-2.md', BASE, 'R2'],
  ['pm/tasks/T047-research-round-3.md', BASE, 'T047brief'],
  ['docs/research/0902c/lane9-above-the-plateau.md', R3, 'lane9'],
  ['docs/research/0902c/lane10-capability-audit.md', R3, 'lane10'],
  ['docs/research/0902c/lane11-inference-and-efficiency.md', R3, 'lane11'],
  ['docs/research/0902c/lane12-semisupervised.md', R3, 'lane12'],
  ['docs/research/0902c/lane13-submission-budget-and-selection.md', R3, 'lane13'],
];
// v2.5's wider scope: every lane report of the rounds the syntheses settle.
export const EARLIER = [
  'lane0-rules-and-leaderboard', 'lane1-winners-and-literature',
  'lane2-architecture-headroom', 'lane3-measurement-and-ensemble',
  'lane4-labels-and-plan', 'lane5-public-notebooks',
].map((n) => [`docs/research/0902/${n}.md`, BASE, n.split('-')[0] + '/R1'])
  .concat(['lane6-single-model-gap', 'lane7-public-members', 'lane8-external-truth-sets']
    .map((n) => [`docs/research/0902b/${n}.md`, BASE, n.split('-')[0] + '/R2']));

// Lower-cased, matched as whole words. Quantity, state, negation, comparison,
// and inference: the shapes of the twelve corrections and of T075's facts.
const CLAIM_WORDS = new Set((
  'never always only every all none no not cannot cant doesnt isnt wasnt ' +
  'arent dont didnt wont nothing nobody without ' +
  'pass passes passed fail fails failed broken wrong false true correct ' +
  'unused unregistered registered blocks block unlocks frees costs cost ' +
  'beats beat loses lose null dead killed falsified confirmed survives ' +
  'refuses refused exists missing bound upper lower faster slower more less ' +
  'fewer larger smaller higher better worse twice half double ' +
  'so therefore thus because hence means implies so-called since ' +
  'measured inferred read reproduced'
).split(' '));
const ARROWS = ['→', '⇒', '=>', '->', '×', '%', '≥', '≤', '>', '<', '~'];

function show(path, commit) {
  return execFileSync('git', ['-C', repo, 'show', `${commit}:${path}`], {
    env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' },
    encoding: 'utf8',
    maxBuffer: 64 << 20,
  });
}

// Markdown emphasis and code ticks, dropped so that a quote written without
// them still matches; whitespace collapsed. Returns the normalised text and,
// for each of its characters, the source offset it came from.
function normalise(src) {
  let out = '', map = [], space = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (c === '*' || c === '`' || c === '_' && (src[i + 1] === '_' || src[i - 1] === '_')) continue;
    if (c === ' ' || c === '\n' || c === '\t' || c === '\r') {
      if (!space && out.length) { out += ' '; map.push(i); }
      space = true;
      continue;
    }
    space = false;
    out += c;
    map.push(i);
  }
  return { text: out, map };
}

// Blocks: paragraphs, list items, table rows, headings. Fenced code is
// dropped. Each block keeps its first line number and its source offset.
function blocks(src) {
  const lines = src.split('\n');
  const out = [];
  let cur = null, fence = false, off = 0;
  const flush = () => { if (cur) out.push(cur); cur = null; };
  for (let n = 0; n < lines.length; n++) {
    const line = lines[n], start = off;
    off += line.length + 1;
    const t = line.trimStart();
    if (t.startsWith('```')) { flush(); fence = !fence; continue; }
    if (fence) continue;
    if (!t) { flush(); continue; }
    const head = t.startsWith('#'), row = t.startsWith('|');
    const item = t.startsWith('- ') || t.startsWith('* ') || t.startsWith('> ') ||
      (t.length > 2 && t[0] >= '0' && t[0] <= '9' && (t.indexOf('. ') > 0 && t.indexOf('. ') < 4));
    if (row && t.replaceAll('|', '').replaceAll('-', '').replaceAll(':', '').trim() === '') { flush(); continue; }
    if (head || row || item || !cur || cur.kind !== 'para') {
      flush();
      cur = { kind: head ? 'head' : row ? 'row' : 'para', line: n + 1, start, end: off - 1 };
      if (head || row) { flush(); }
      continue;
    }
    cur.end = off - 1;
  }
  flush();
  return out;
}

// Clauses: a block cut at sentence ends and at semicolons; a table row cut at
// its cells. The cut is by scanning, not by a regular expression.
function clauses(src, block) {
  const text = src.slice(block.start, block.end);
  const cuts = [];
  let from = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i], next = text[i + 1];
    let cut = false;
    if (block.kind === 'row' && c === '|') cut = true;
    else if (c === ';') cut = true;
    else if ((c === '.' || c === '?' || c === '!') && (next === ' ' || next === '\n')) {
      const after = text.slice(i + 1).trimStart()[0] || '';
      const before = text.slice(Math.max(0, i - 4), i);
      const abbrev = before.endsWith('e.g') || before.endsWith('i.e') || before.endsWith('vs') ||
        before.endsWith('cf') || before.endsWith('etc') || before.endsWith('al');
      if (!abbrev && (after === '' || (after >= 'A' && after <= 'Z') || '*`("“[|-'.includes(after))) cut = true;
    }
    if (cut) {
      cuts.push([from, block.kind === 'row' && c === '|' ? i : i + 1]);
      from = i + 1;
    }
  }
  cuts.push([from, text.length]);
  return cuts
    .map(([a, b]) => ({ start: block.start + a, end: block.start + b }))
    .filter((c) => src.slice(c.start, c.end).replace(/[\s|*`#>.-]/g, '').length > 2);
}

function isClaim(text) {
  if (/[0-9]/.test(text)) return 'digit';
  for (const a of ARROWS) if (text.includes(a)) return 'sign';
  const words = text.toLowerCase().replaceAll('’', '').replaceAll("'", '').split(/[^a-z-]+/);
  for (const w of words) if (CLAIM_WORDS.has(w)) return w;
  return '';
}

const facts = ledgerPath
  ? readFileSync(ledgerPath, 'utf8').trim().split('\n').map((l) => JSON.parse(l)).filter((f) => f.kind === 'fact')
  : [];

function lineOf(src, off) {
  let n = 1;
  for (let i = 0; i < off && i < src.length; i++) if (src[i] === '\n') n++;
  return n;
}

mkdirSync(outDir, { recursive: true });
const rows = [];
const report = { docs: {}, unanchored: [] };
const anchoredFacts = new Set();
for (const [path, commit, doc] of READ.concat(EARLIER)) {
  const src = show(path, commit);
  const norm = normalise(src);
  // Each fact's quote, found in this document: its source span.
  const spans = [];
  for (const f of facts) {
    if (!(f.where || '').startsWith(path) || !f.says) continue;
    const q = normalise(f.says).text.replace(/^[ .…]+|[ .…]+$/g, '');
    const parts = q.split('…').map((p) => p.trim()).filter((p) => p.length > 12);
    for (const p of parts.length ? parts : [q]) {
      const at = norm.text.indexOf(p);
      if (at < 0) continue;
      spans.push({ id: f.id, start: norm.map[at], end: norm.map[at + p.length - 1] + 1 });
      anchoredFacts.add(f.id);
    }
  }
  let n = 0, claims = 0, covered = 0;
  for (const b of blocks(src)) {
    for (const c of clauses(src, b)) {
      const text = normalise(src.slice(c.start, c.end)).text.trim();
      const why = isClaim(text);
      const by = spans.filter((s) => s.start < c.end && s.end > c.start).map((s) => s.id);
      const row = { id: `${doc}#${++n}`, doc: path, commit, line: lineOf(src, c.start), kind: b.kind, text, claim: why || false };
      if (ledgerPath) row.covered = [...new Set(by)];
      rows.push(row);
      if (why) { claims++; if (by.length) covered++; }
    }
  }
  report.docs[doc] = { path, commit, clauses: n, claims, covered };
}
for (const f of facts) if (!anchoredFacts.has(f.id)) report.unanchored.push(f.id);

writeFileSync(join(outDir, 'clauses.jsonl'), rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
writeFileSync(join(outDir, 'sieve-report.json'), JSON.stringify(report, null, 1) + '\n');
console.log(JSON.stringify(report.docs, null, 1));
console.log('facts whose quote was not found verbatim:', report.unanchored.length, 'of', facts.length);
