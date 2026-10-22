#!/usr/bin/env node
// T086 H1: what the auditor's output must satisfy, run by the auditor on
// its own output until it comes back clean. R0c's checker, with v2.7 item 4:
// a pass resumed after a death keeps the dead run's lines under its id.
//
//   node check-audit.mjs <audit-dir> <measurands.jsonl>
//
// Reads <audit-dir>/skips.jsonl, assign.jsonl and audit.jsonl. Checks:
//   - every line of audit.jsonl parses, and is an `audit` or an `assign`;
//   - each skip in the view has exactly one `audit` line, by `clause`, with
//     `finding` `ok` or `missed` and a `why` of at most 240 bytes;
//   - each item in assign.jsonl has exactly one `assign` line, by `item`,
//     whose `measurand` is a registered name (without `m:`) or `none`;
//   - every line carries a `run`; more than one is a resumed pass, each run's
//     lines one unbroken block, and a run that stopped never writes again.
// Prints a summary and the first problems; exits 1 while any remain.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const [dir, measPath] = process.argv.slice(2);
if (!dir || !measPath) { console.error('usage: node check-audit.mjs <audit-dir> <measurands.jsonl>'); process.exit(2); }
const problems = [];
const jsonl = (p, strict) => readFileSync(p, 'utf8').split('\n').map((l, i) => [l, i + 1]).filter(([l]) => l.trim()).flatMap(([l, n]) => {
  try { return [JSON.parse(l)]; } catch { if (strict) problems.push(`${p}:${n}: does not parse`); return []; }
});

const skips = jsonl(join(dir, 'skips.jsonl'));
const items = jsonl(join(dir, 'assign.jsonl'));
const names = new Set(jsonl(measPath).map((m) => m.name));
const out = jsonl(join(dir, 'audit.jsonl'), true);

const audits = new Map(), assigns = new Map(), runs = [];
const findings = { ok: 0, missed: 0 }, measurands = { named: 0, none: 0 };
for (const o of out) {
  if (o.run === undefined) problems.push('a line carries no run');
  else if (runs[runs.length - 1] !== o.run) {
    if (runs.includes(o.run)) problems.push(`run ${o.run} writes again after ${runs[runs.length - 1]} took over`);
    runs.push(o.run);
  }
  if (o.kind === 'audit') {
    if (audits.has(o.clause)) problems.push(`audit ${o.clause}: written twice`);
    audits.set(o.clause, o);
    if (o.finding !== 'ok' && o.finding !== 'missed') problems.push(`audit ${o.clause}: finding must be ok or missed`);
    else findings[o.finding]++;
    if (typeof o.why !== 'string' || !o.why.trim()) problems.push(`audit ${o.clause}: no why`);
    else if (Buffer.byteLength(o.why) > 240) problems.push(`audit ${o.clause}: why over 240 bytes`);
  } else if (o.kind === 'assign') {
    if (assigns.has(o.item)) problems.push(`assign ${o.item}: written twice`);
    assigns.set(o.item, o);
    if (o.measurand === 'none') measurands.none++;
    else if (names.has(o.measurand)) measurands.named++;
    else problems.push(`assign ${o.item}: ${JSON.stringify(o.measurand)} is not a registered measurand (write the bare name, or none)`);
  } else problems.push(`a line of kind ${JSON.stringify(o.kind)}: only audit and assign`);
}
const want = new Set(skips.map((s) => s.clause));
for (const c of want) if (!audits.has(c)) problems.push(`skip ${c}: no audit line`);
for (const c of audits.keys()) if (!want.has(c)) problems.push(`audit ${c}: not a skip in the view`);
for (const i of items) if (!assigns.has(i.item)) problems.push(`item ${i.item}: no assign line`);
for (const i of assigns.keys()) if (!items.some((x) => x.item === i)) problems.push(`assign ${i}: not an item`);

console.log(JSON.stringify({ skips: want.size, audited: audits.size, ...findings, items: items.length, assigned: assigns.size, ...measurands, problems: problems.length }));
for (const p of problems.slice(0, 40)) console.log(p);
process.exit(problems.length ? 1 : 0);
