#!/usr/bin/env node
// T082 R0c: merges the transcribers' ledgers into one, in the form T082's
// link.mjs reads, and applies the auditor's measurand assignments.
//
//   node merge.mjs <out-dir> <audit.jsonl|-> <audit-key.json|-> -- <ledger.jsonl>...
//
// - Facts are renumbered F1…Fn in ledger order, so ids say nothing about
//   which transcriber wrote them; `idmap.json` keeps the original ids.
// - `from.doc` is the document of the fact's clause.
// - A premise that is a clause id resolves to the facts written at that
//   clause. A premise clause with no fact is reported as `premise-unwritten`:
//   the inference rests on something nobody wrote down.
// - A measurand is a referent only where the transcriber and the auditor
//   agree. Where they differ, the fact carries both, and the difference is
//   reported as `measurand-disputed` (v2.5 §5.5).
// Writes ledger.jsonl, idmap.json and merge-report.json.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const argv = process.argv.slice(2);
const sep = argv.indexOf('--');
const [outDir, auditPath, keyPath] = argv.slice(0, sep);
const ledgers = argv.slice(sep + 1);
if (sep < 0 || !ledgers.length) { console.error('usage: node merge.mjs <out-dir> <audit|-> <audit-key|-> -- <ledger>...'); process.exit(2); }
const jsonl = (p) => readFileSync(p, 'utf8').split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l));

const facts = ledgers.flatMap(jsonl).filter((o) => o.kind === 'fact');
const idmap = {};
facts.forEach((f, i) => { idmap[f.id] = `F${i + 1}`; });
const atClause = new Map();
for (const f of facts) { if (!atClause.has(f.at)) atClause.set(f.at, []); atClause.get(f.at).push(idmap[f.id]); }

const assigned = new Map();
if (auditPath !== '-') {
  const key = JSON.parse(readFileSync(keyPath, 'utf8'));
  const byItem = new Map(key.items.map((i) => [i.item, i]));
  for (const a of jsonl(auditPath)) if (a.kind === 'assign' && byItem.has(a.item)) assigned.set(byItem.get(a.item).fact, a.measurand);
}

const report = { premiseUnwritten: [], measurandDisputed: [], measurandAgreed: 0 };
const out = facts.map((f) => {
  const doc = String(f.at).slice(0, String(f.at).lastIndexOf('#'));
  const premises = [];
  for (const p of f.premises || []) {
    if (idmap[p]) premises.push(idmap[p]);
    else if (atClause.has(p)) premises.push(...atClause.get(p));
    else report.premiseUnwritten.push({ fact: f.id, premise: p });
  }
  let src = [...(f.src || [])];
  const mine = src.filter((s) => typeof s === 'string' && s.startsWith('m:')).map((s) => s.slice(2));
  if (assigned.has(f.id)) {
    const theirs = assigned.get(f.id);
    const agree = theirs === 'none' ? mine.length === 0 : mine.includes(theirs);
    if (agree) report.measurandAgreed++;
    else {
      report.measurandDisputed.push({ fact: f.id, transcriber: mine, auditor: theirs });
      if (theirs !== 'none') src.push(`m:${theirs}`);
    }
  }
  return { ...f, id: idmap[f.id], premises: [...new Set(premises)], src, from: { doc, round: doc.startsWith('lane') && Number(doc.slice(4)) >= 9 ? 3 : undefined }, orig: f.id };
});

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'ledger.jsonl'), out.map((f) => JSON.stringify(f)).join('\n') + '\n');
writeFileSync(join(outDir, 'idmap.json'), JSON.stringify(idmap, null, 1) + '\n');
writeFileSync(join(outDir, 'merge-report.json'), JSON.stringify(report, null, 1) + '\n');
console.log(JSON.stringify({ facts: out.length, premiseUnwritten: report.premiseUnwritten.length, measurandDisputed: report.measurandDisputed.length, measurandAgreed: report.measurandAgreed }));
