#!/usr/bin/env node
// T085 R0d: the key's search. For each correction, every clause of the cut
// (`t082/r0c/cut/`, `closure-cut.jsonl`) holding one of its numbers or terms,
// case-insensitively, by plain substring: no pattern can backtrack. The
// parent reads the hits and pins in `key.json` the clauses that carry the
// earlier claim or the correction; the rest are not either.
//
//   node key-search.mjs <r0c-dir> > key-search.txt

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const r0c = process.argv[2];
if (!r0c) { console.error('usage: node key-search.mjs <r0c-dir>'); process.exit(2); }
const rd = (p) => readFileSync(p, 'utf8').split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l));
const clauses = [
  ...readdirSync(join(r0c, 'cut')).filter((n) => n.endsWith('.jsonl')).sort().flatMap((f) => rd(join(r0c, 'cut', f))),
  ...rd(join(r0c, 'closure-cut.jsonl')),
];
export const TERMS = {
  C1: ['never passed', 'never once', 'never been passed', 'passed once', 'run_arm.sh', 'never passes', 'not passed'],
  C2: ['too hot', '10×', '10x', 'cannot express', '24 of 48', '1e-6', 'graded decay', 'screen s1'],
  C3: ['budget_minutes', 'upper bound', '24 %', '24%', 'optimistic', '1.329', 'Σ'],
  C4: ['under-predict', 'underpredict', 'layout multiplier', '134 min', '~134', '2× in practice'],
  C5: ['4.4 h', '1.5–4.4', '1.5-4.4', '113 min', '~113'],
  C6: ['id, crop, bright', '2 tta views', 'two tta views', 'two views'],
  C7: ['336', '224–392', '224-392'],
  C8: ['control teams', "winner's curse", 'winner’s curse', 'overfit', '86 teams'],
  C9: ['776', '804', '2,844', '2844', '2,889', '2889', '84 teams', '88 teams'],
  C10: ['--resume', 'atomic', 'no resume'],
  C11: ['175', '200.6', '201 min', '~201', 'slices 24'],
  C12: ['fold?', 'unlock', 'twelve', '12 members', 'ten members'],
};
for (const [c, terms] of Object.entries(TERMS)) {
  const hits = clauses.filter((x) => terms.some((t) => x.text.toLowerCase().includes(t.toLowerCase())));
  console.log(`\n## ${c}: ${hits.length} clauses (${terms.join(' | ')})`);
  for (const h of hits) console.log(`${h.id} @${h.commit}: ${h.text.replace(/\s+/g, ' ').slice(0, 260)}`);
}
