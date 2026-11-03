#!/usr/bin/env node
// T094 H2: what a reconciler's output must satisfy under v2.8. H1's checker
// (t086/check-reconcile.mjs, v2.7), with v2.8's two new units: an `edit` and
// a `cue` take the lines a group takes. A resumed output keeps the lines a
// dead run wrote, under that run's id:
//
//   node check-reconcile.mjs <view.jsonl> <out.jsonl>
//
// <view.jsonl> is the reconciler's file from groups.mjs (R<k>.jsonl). Checks:
//   - every line of <out.jsonl> parses and carries a `run`. More than one run
//     is a pass resumed after a death: each run's lines are one unbroken
//     block, and a run that has stopped never writes again. The last block
//     is the pass that finishes;
//   - each group, edit and cue has one `ok` line, or one `same` line or
//     more, never both; a `same` line names two different ids of its unit,
//     with `finding` `conflict` or `superseded`, and a `why` of at most 240
//     bytes. An edit's ids are its facts' view ids, or a side's clause id
//     when that side has no fact;
//   - each check has exactly one `same` line, `finding` `follows`,
//     `contradicted` or `unsupported`, with a `why` of at most 240 bytes;
//   - nothing names a unit that is not in the view.
// Prints a summary and the first problems; exits 1 while any remain.

import { readFileSync } from 'node:fs';

const [viewPath, outPath] = process.argv.slice(2);
if (!viewPath || !outPath) { console.error('usage: node check-reconcile.mjs <view.jsonl> <out.jsonl>'); process.exit(2); }
const problems = [];
const jsonl = (p, strict) => readFileSync(p, 'utf8').split('\n').map((l, i) => [l, i + 1]).filter(([l]) => l.trim()).flatMap(([l, n]) => {
  try { return [JSON.parse(l)]; } catch { if (strict) problems.push(`line ${n}: does not parse`); return []; }
});
const view = jsonl(viewPath);
// Every unit marked like a group, by its kind and number: the ids a line may name.
const sides = (u) => [u.earlier, u.later].flatMap((s) => (s.facts.length ? s.facts.map((f) => f.id) : [s.clause]));
const groups = new Map([
  ...view.filter((x) => x.group).map((x) => [`group ${x.group}`, new Set(x.facts.map((f) => f.id))]),
  ...view.filter((x) => x.edit).map((x) => [`edit ${x.edit}`, new Set(sides(x))]),
  ...view.filter((x) => x.cue).map((x) => [`cue ${x.cue}`, new Set([x.fact.id, ...x.before.map((f) => f.id)])]),
]);
const unitOf = (o) => (o.group !== undefined ? `group ${o.group}` : o.edit !== undefined ? `edit ${o.edit}` : o.cue !== undefined ? `cue ${o.cue}` : null);
const checks = new Set(view.filter((x) => x.check).map((x) => x.check));
const out = jsonl(outPath, true);

const GROUP = ['conflict', 'superseded'], CHECK = ['follows', 'contradicted', 'unsupported'];
const runs = [];
const gOk = new Map(), gSame = new Map(), cSame = new Map();
const tally = { ok: 0, conflict: 0, superseded: 0, follows: 0, contradicted: 0, unsupported: 0 };
const why = (o, what) => {
  if (typeof o.why !== 'string' || !o.why.trim()) problems.push(`${what}: no why`);
  else if (Buffer.byteLength(o.why) > 240) problems.push(`${what}: why over 240 bytes`);
};
for (const o of out) {
  if (o.run === undefined) problems.push('a line carries no run');
  else if (runs[runs.length - 1] !== o.run) {
    if (runs.includes(o.run)) problems.push(`run ${o.run} writes again after ${runs[runs.length - 1]} took over`);
    runs.push(o.run);
  }
  const u = unitOf(o);
  if (u) {
    const g = groups.get(u);
    if (!g) { problems.push(`${u}: not in the view`); continue; }
    if (o.kind === 'ok') { gOk.set(u, (gOk.get(u) || 0) + 1); tally.ok++; why(o, u); continue; }
    if (o.kind !== 'same') { problems.push(`${u}: kind must be ok or same`); continue; }
    gSame.set(u, (gSame.get(u) || 0) + 1);
    if (!GROUP.includes(o.finding)) problems.push(`${u}: a same line's finding is conflict or superseded (write ok for a unit with nothing to mark)`);
    else tally[o.finding]++;
    if (!Array.isArray(o.facts) || o.facts.length !== 2 || !o.facts.every((id) => g.has(id)) || o.facts[0] === o.facts[1]) problems.push(`${u}: facts must be two different ids of this unit`);
    why(o, u);
  } else if (o.check !== undefined) {
    if (!checks.has(o.check)) { problems.push(`check ${o.check}: not in the view`); continue; }
    if (o.kind !== 'same') problems.push(`check ${o.check}: kind must be same`);
    cSame.set(o.check, (cSame.get(o.check) || 0) + 1);
    if (!CHECK.includes(o.finding)) problems.push(`check ${o.check}: finding must be follows, contradicted or unsupported`);
    else tally[o.finding]++;
    why(o, `check ${o.check}`);
  } else problems.push(`a line with no group, edit, cue or check: ${JSON.stringify(o).slice(0, 80)}`);
}
for (const g of groups.keys()) {
  if (!gOk.has(g) && !gSame.has(g)) problems.push(`${g}: no line`);
  if (gOk.has(g) && gSame.has(g)) problems.push(`${g}: both ok and a finding`);
  if ((gOk.get(g) || 0) > 1) problems.push(`${g}: ok written twice`);
}
for (const c of checks) {
  if (!cSame.has(c)) problems.push(`check ${c}: no line`);
  else if (cSame.get(c) > 1) problems.push(`check ${c}: written twice`);
}

const count = (kind) => [...groups.keys()].filter((g) => g.startsWith(kind)).length;
const done = (kind) => [...new Set([...gOk.keys(), ...gSame.keys()])].filter((g) => g.startsWith(kind)).length;
console.log(JSON.stringify({ groups: count('group '), groupsDone: done('group '), edits: count('edit '), editsDone: done('edit '), cues: count('cue '), cuesDone: done('cue '), checks: checks.size, checksDone: cSame.size, runs: [...new Set(runs)], ...tally, problems: problems.length }));
for (const p of problems.slice(0, 40)) console.log(p);
process.exit(problems.length ? 1 : 0);
