#!/usr/bin/env node
// T085 R0d: what a reconciler's output must satisfy under v2.6, run by the
// reconciler on its own output until it comes back clean. R0c's checker
// (t082/r0c/check-reconcile.mjs) with v2.6's findings:
//
//   node check-reconcile.mjs <view.jsonl> <out.jsonl>
//
// <view.jsonl> is the reconciler's file from groups.mjs (R<k>.jsonl). Checks:
//   - every line of <out.jsonl> parses, and carries the same `run`;
//   - each group has one `ok` line, or one `same` line or more, never both;
//     a `same` line names two different view ids of its group, with
//     `finding` `conflict` or `superseded`, and a `why` of at most 240 bytes;
//   - each check has exactly one `same` line, `finding` `follows`,
//     `contradicted` or `unsupported`, with a `why` of at most 240 bytes;
//   - nothing names a group or a check that is not in the view.
// Prints a summary and the first problems; exits 1 while any remain.

import { readFileSync } from 'node:fs';

const [viewPath, outPath] = process.argv.slice(2);
if (!viewPath || !outPath) { console.error('usage: node check-reconcile.mjs <view.jsonl> <out.jsonl>'); process.exit(2); }
const problems = [];
const jsonl = (p, strict) => readFileSync(p, 'utf8').split('\n').map((l, i) => [l, i + 1]).filter(([l]) => l.trim()).flatMap(([l, n]) => {
  try { return [JSON.parse(l)]; } catch { if (strict) problems.push(`line ${n}: does not parse`); return []; }
});
const view = jsonl(viewPath);
const groups = new Map(view.filter((x) => x.group).map((x) => [x.group, new Set(x.facts.map((f) => f.id))]));
const checks = new Set(view.filter((x) => x.check).map((x) => x.check));
const out = jsonl(outPath, true);

const GROUP = ['conflict', 'superseded'], CHECK = ['follows', 'contradicted', 'unsupported'];
const runs = new Set();
const gOk = new Map(), gSame = new Map(), cSame = new Map();
const tally = { ok: 0, conflict: 0, superseded: 0, follows: 0, contradicted: 0, unsupported: 0 };
const why = (o, what) => {
  if (typeof o.why !== 'string' || !o.why.trim()) problems.push(`${what}: no why`);
  else if (Buffer.byteLength(o.why) > 240) problems.push(`${what}: why over 240 bytes`);
};
for (const o of out) {
  runs.add(o.run);
  if (o.group !== undefined) {
    const g = groups.get(o.group);
    if (!g) { problems.push(`group ${o.group}: not in the view`); continue; }
    if (o.kind === 'ok') { gOk.set(o.group, (gOk.get(o.group) || 0) + 1); tally.ok++; why(o, `group ${o.group}`); continue; }
    if (o.kind !== 'same') { problems.push(`group ${o.group}: kind must be ok or same`); continue; }
    gSame.set(o.group, (gSame.get(o.group) || 0) + 1);
    if (!GROUP.includes(o.finding)) problems.push(`group ${o.group}: a same line's finding is conflict or superseded (write ok for a group with nothing to mark)`);
    else tally[o.finding]++;
    if (!Array.isArray(o.facts) || o.facts.length !== 2 || !o.facts.every((id) => g.has(id)) || o.facts[0] === o.facts[1]) problems.push(`group ${o.group}: facts must be two different view ids of this group`);
    why(o, `group ${o.group}`);
  } else if (o.check !== undefined) {
    if (!checks.has(o.check)) { problems.push(`check ${o.check}: not in the view`); continue; }
    if (o.kind !== 'same') problems.push(`check ${o.check}: kind must be same`);
    cSame.set(o.check, (cSame.get(o.check) || 0) + 1);
    if (!CHECK.includes(o.finding)) problems.push(`check ${o.check}: finding must be follows, contradicted or unsupported`);
    else tally[o.finding]++;
    why(o, `check ${o.check}`);
  } else problems.push(`a line with neither group nor check: ${JSON.stringify(o).slice(0, 80)}`);
}
for (const g of groups.keys()) {
  if (!gOk.has(g) && !gSame.has(g)) problems.push(`group ${g}: no line`);
  if (gOk.has(g) && gSame.has(g)) problems.push(`group ${g}: both ok and a finding`);
  if ((gOk.get(g) || 0) > 1) problems.push(`group ${g}: ok written twice`);
}
for (const c of checks) {
  if (!cSame.has(c)) problems.push(`check ${c}: no line`);
  else if (cSame.get(c) > 1) problems.push(`check ${c}: written twice`);
}
if (runs.size > 1) problems.push(`lines carry ${runs.size} different runs`);
if (runs.has(undefined)) problems.push('a line carries no run');

console.log(JSON.stringify({ groups: groups.size, groupsDone: new Set([...gOk.keys(), ...gSame.keys()]).size, checks: checks.size, checksDone: cSame.size, ...tally, problems: problems.length }));
for (const p of problems.slice(0, 40)) console.log(p);
process.exit(problems.length ? 1 : 0);
