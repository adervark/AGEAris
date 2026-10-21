#!/usr/bin/env node
// T084: which premise checks could carry a fair canary? v2.5 made a check
// canary by replacing a real check's conclusion with a twin, which took the
// real check out of review, and it chose checks whose premises could not
// refute the twin (R0c's reconciler 2, check 158: "~25 lines" on a premise
// with no count). v2.6 shows the canary beside the real check, to another
// reconciler, and only on an eligible check: its conclusion holds exactly one
// number in a unit domain (groups.mjs's `slot`, unchanged), and some premise
// holds a number in the same domain, so the premises bear on the value.
//
//   node canary-checks.mjs <ledger.jsonl> <groups-dir>
//
// Prints the checks in the view, how many are eligible, and how many of
// R0c's 27 check canaries were.

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const [ledgerPath, dir] = process.argv.slice(2);
if (!dir) { console.error('usage: node canary-checks.mjs <ledger> <groups-dir>'); process.exit(2); }
const rd = (p) => readFileSync(p, 'utf8').split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l));
const facts = rd(ledgerPath).filter((x) => x.kind === 'fact');
const byId = new Map(facts.map((f) => [f.id, f]));

// groups.mjs's number and domain rules, copied unchanged.
const UNITS = new Set(('min mins minutes h hours s sec ms px % × x GiB GB MB KB mm lines studies teams submissions ' +
  'members epochs folds slices series views units forwards checkpoints images rows labels days GPU-h').split(' '));
const isLetter = (c) => c !== undefined && c.toLowerCase() !== c.toUpperCase();
const isDigit = (c) => c >= '0' && c <= '9';
function numbers(v) {
  const out = [];
  for (let i = 0; i < v.length; i++) {
    if (!isDigit(v[i])) continue;
    let j = i, dot = false;
    while (j < v.length && (isDigit(v[j]) || (v[j] === '.' && !dot && j + 1 < v.length && isDigit(v[j + 1])))) { if (v[j] === '.') dot = true; j++; }
    const signed = i > 0 && (v[i - 1] === '-' || v[i - 1] === '+' || v[i - 1] === '−');
    const start = signed ? i - 1 : i;
    const ident = isLetter(v[i - 1]) || v[i - 1] === '§' || v[i - 1] === '#' || v[i - 1] === '.' || v[j] === '-' || v[j] === "'" || v[j] === '’' || isLetter(v[j]) && !UNITS.has(v[j]);
    let k = j; while (k < v.length && v[k] === ' ') k++;
    let word = ''; while (k < v.length && word.length < 8 && !' ,;:)/'.includes(v[k]) && !isDigit(v[k])) word += v[k++];
    if (word.endsWith('.')) word = word.slice(0, -1);
    out.push({ start, end: j, text: v.slice(start, j), num: Number(v.slice(i, j)) * (signed && v[i - 1] !== '+' ? -1 : 1), word, ident });
    i = j;
  }
  return out;
}
function slot(f) {
  if (typeof f.value !== 'string') return null;
  const ns = numbers(f.value);
  if (ns.length !== 1) return null;
  const n = ns[0], domain = f.unit || (UNITS.has(n.word) ? n.word : '');
  if (n.ident || !domain || !n.num || !String(f.says || '').includes(n.text)) return null;
  return domain;
}
// A premise bears on the value when any number in it carries the same domain.
function domains(f) {
  const out = new Set();
  for (const n of numbers(`${f.value ?? ''} ${f.says ?? ''}`)) if (!n.ident && UNITS.has(n.word)) out.add(n.word);
  if (f.unit) out.add(f.unit);
  return out;
}

const checks = facts.filter((f) => (f.premises || []).some((p) => byId.has(p)));
const twinable = checks.filter((f) => slot(f));
const eligible = twinable.filter((f) => f.premises.some((p) => byId.has(p) && domains(byId.get(p)).has(slot(f))));
const r0c = JSON.parse(readFileSync(join(dir, '..', 'rec-key.json'), 'utf8')).canaries.filter((c) => c.type === 'check');
const r0cEligible = r0c.filter((c) => eligible.some((f) => f.id === c.real));
console.log(JSON.stringify({
  checks: checks.length, twinable: twinable.length, eligible: eligible.length,
  perReconcilerNeeded: 'at least 3 or 2% of its units (about 9 of 407 checks)',
  r0cCheckCanaries: r0c.length, r0cEligible: r0cEligible.length,
  r0cIneligible: r0c.filter((c) => !r0cEligible.includes(c)).map((c) => `R${c.reconciler} check ${c.unit} (${c.real})`),
}, null, 1));
