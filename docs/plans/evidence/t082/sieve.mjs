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

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { show, normalise, blocks, clauses, isClaim, lineOf } from './clauses.mjs';

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

const facts = ledgerPath
  ? readFileSync(ledgerPath, 'utf8').trim().split('\n').map((l) => JSON.parse(l)).filter((f) => f.kind === 'fact')
  : [];


mkdirSync(outDir, { recursive: true });
const rows = [];
const report = { docs: {}, unanchored: [] };
const anchoredFacts = new Set();
for (const [path, commit, doc] of READ.concat(EARLIER)) {
  const src = show(repo, path, commit);
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
