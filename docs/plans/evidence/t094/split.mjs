#!/usr/bin/env node
// T094 H2: deals the cut into the transcriber groups. A document goes whole
// to one group, with its earlier versions (`<doc>@<commit>`), so one
// transcriber reads each file's history.
//
//   node split.mjs     (from this folder; writes cut/G1.jsonl .. G4.jsonl)

import { readFileSync, writeFileSync } from 'node:fs';

export const GROUPS = {
  G1: ['T121', 'PROGRESS', 'trail', 'materialise.py', 'profile_vram.py', 'run_bag_384_fold0.sh', 'bag_child.py', 'build_bag_kernels.py'],
  G2: ['coat.py', 'coat_data.py', 'coat_train.py'],
  G3: ['_order.py', 'build_t112_kernel.py', 'Makefile', 'paired_vs_member.py', 'push_arm.py'],
  G4: ['tooling.py', 'cam_viewer.py', 'claims_guard.py', 'coat_gradcam.py', 'gpu_watchdog.sh', 'resample_delta.py', 'gpu_stop.sh', 'g2_precision.py'],
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
