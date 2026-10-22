#!/usr/bin/env node
// T086 H1: the key's search. For each candidate correction in T112's record,
// every clause of the cut holding one of its terms, case-insensitively, by
// plain substring: no pattern can backtrack. The parent reads the hits and
// pins in `key.json` the clauses that carry the earlier claim or the
// correction; the rest are neither.
//
//   node key-search.mjs > key-search.txt

import { readFileSync } from 'node:fs';

const clauses = readFileSync('cut/clauses.jsonl', 'utf8').split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l));
export const TERMS = {
  K1: ['not legal', 'illegal', '32 x 10.5', '32 × 10.5', 'decode size', 'only res'],
  K2: ['0.9128', '0.9054', 'silently dropped'],
  K3: ['full fidelity', 'condition b', 'resample chain'],
  K4: ['realistic', 'best case', 'stretch'],
  K5: ['9/9', '13/13', 'seven stages', 'all seven', 'expected_stages', 'crashed', 'traceback'],
  K6: ['two sequential', 'read-then-act', 'zero cycles', 'two cycles', 'lane is closed', 'lane closed', 'submission lane'],
  K7: ['not resolved', 'resolved-behind', 'resolved behind', 'edge of the', '−0.02 to −0.04', '-0.02 to -0.04', 'behind'],
  K8: ['quota', 'reset'],
  K9: ['void banner', 'banner prints', 'really did run', 'at import'],
  K10: ['bit-identical', 'end to end', 'could not execute', '0.5', '384 grid', 'img_size', 'load path'],
  K11: ['submission 1', 'withdrawn', 'do not submit', 'swap kernel'],
  K12: ['windows', 'wsl', 'bringup_4090', 'on arrival', 'linux'],
  K13: ['20%', '20 %', 'w = 0.20', 'w=0.20', '0.072', '7.2', 'share of'],
};
for (const [k, terms] of Object.entries(TERMS)) {
  const hits = clauses.filter((x) => terms.some((t) => x.text.toLowerCase().includes(t.toLowerCase())));
  console.log(`\n## ${k}: ${hits.length} clauses (${terms.join(' | ')})`);
  for (const h of hits) console.log(`${h.id} @${h.commit}: ${h.text.replace(/\s+/g, ' ').slice(0, 240)}`);
}
