#!/usr/bin/env node
// T086 H1: deals the cut into the transcriber groups. A document goes whole
// to one group, with its earlier versions (`<doc>@<commit>`), so one
// transcriber reads each file's history.
//
//   node split.mjs     (from this folder; writes cut/G1.jsonl .. G3.jsonl)

import { readFileSync, writeFileSync } from 'node:fs';

export const GROUPS = {
  G1: ['T112', 'PROGRESS'],
  G2: ['trail', 'build_t112_kernel.py', '_order.py', 'dry_run.py', 'Makefile', 'arm_t112.sh', 'resample_delta.py', 'run_224_fold0.sh', 'paired_vs_member.py'],
  G3: ['bringup_4090.sh', 'coat.py', 'coat_data.py', 'coat_export.py', 'coat_curve.py', 'coat_train.py', 'selftest_4090.py', 'setup_4090.cmd', 'push_arm.py'],
};
const rows = readFileSync('cut/clauses.jsonl', 'utf8').split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l));
const base = (doc) => doc.split('@')[0];
const counts = {};
for (const [g, docs] of Object.entries(GROUPS)) {
  const mine = rows.filter((r) => docs.includes(base(r.doc)));
  writeFileSync(`cut/${g}.jsonl`, mine.map((r) => JSON.stringify(r)).join('\n') + '\n');
  counts[g] = mine.length;
}
const dealt = Object.values(GROUPS).flat();
const left = [...new Set(rows.map((r) => base(r.doc)))].filter((d) => !dealt.includes(d));
console.log(JSON.stringify({ ...counts, total: rows.length, undealt: left }));
process.exit(left.length ? 1 : 0);
