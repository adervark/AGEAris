#!/usr/bin/env node
// T082 R0c: cuts R0b's eight documents, at R0b's commits, into the four
// transcriber groups fixed in T082's procedure. Every clause gets an id,
// `<doc>#<n>`, and each group's file lists them in order.
//
//   node cut.mjs <rsna-repo> <out-dir>
//
// RSNA is read with `git show` under GIT_OPTIONAL_LOCKS=0. Nothing is written
// there.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { show, cut } from '../clauses.mjs';

const [repo, outDir] = process.argv.slice(2);
if (!repo || !outDir) { console.error('usage: node cut.mjs <rsna-repo> <out-dir>'); process.exit(2); }

const R3 = 'e4e356c', BASE = 'd9c7c6e';
export const GROUPS = {
  G1: [['R1', 'docs/RESEARCH-0902-road-to-0960.md', BASE], ['R2', 'docs/RESEARCH-0902b-round-2.md', BASE],
    ['lane13', 'docs/research/0902c/lane13-submission-budget-and-selection.md', R3]],
  G2: [['lane9', 'docs/research/0902c/lane9-above-the-plateau.md', R3], ['T047brief', 'pm/tasks/T047-research-round-3.md', BASE]],
  G3: [['lane10', 'docs/research/0902c/lane10-capability-audit.md', R3]],
  G4: [['lane11', 'docs/research/0902c/lane11-inference-and-efficiency.md', R3], ['lane12', 'docs/research/0902c/lane12-semisupervised.md', R3]],
};

mkdirSync(outDir, { recursive: true });
const counts = {};
for (const [g, docs] of Object.entries(GROUPS)) {
  const rows = [];
  for (const [doc, path, commit] of docs) {
    for (const c of cut(show(repo, path, commit))) rows.push({ id: `${doc}#${c.n}`, doc, path, commit, line: c.line, kind: c.kind, text: c.text });
  }
  writeFileSync(join(outDir, `${g}.jsonl`), rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
  counts[g] = rows.length;
}
console.log(JSON.stringify(counts));
