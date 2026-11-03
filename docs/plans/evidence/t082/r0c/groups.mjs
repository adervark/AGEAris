#!/usr/bin/env node
// T082 R0c: what the reconcilers see. Pairwise review does not scale: 4,033
// facts make ~59,000 linked pairs. So review is by group (T082's amended
// spend rule):
//
//   - a **group** is every fact, from two documents or more, linked through
//     one shared referent (link.mjs's cross-document pairs, premise pairs
//     aside). Referents with the same members are one group. Same-document
//     groups are recorded as unreviewed;
//   - a **check** is one INFERRED fact with all of its premises: does the
//     conclusion follow?
//
//   node groups.mjs <ledger.jsonl> <link-report.json> <out-dir> <key.json> <n-reconcilers>
//
// Canaries, at least 3 or 2% of each reconciler's units, unmarked:
//   - in a group, the twin of one of its facts, carrying another real fact's
//     value of the same unit and shape (v2.5 §8), attributed to another
//     document. A reconciler that reads the group finds a conflict;
//   - in a check, the conclusion with its value so replaced, the lender's
//     value differing by at least a fifth, so it no longer follows.
// Every fact is shown under a view id (V1…), assigned in document order with
// the canaries placed among their document's facts, so an id says nothing.
// Units are dealt to reconcilers in turn, largest first, so their line counts
// stay level. Writes <out-dir>/R<k>.jsonl and <out-dir>/summary.json; the
// key maps view ids to fact ids and names the canaries.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const [ledgerPath, reportPath, outDir, keyPath, nArg] = process.argv.slice(2);
const N = Number(nArg);
if (!Number.isInteger(N) || N < 1) { console.error('usage: node groups.mjs <ledger> <link-report> <out-dir> <key.json> <n-reconcilers>'); process.exit(2); }
const facts = readFileSync(ledgerPath, 'utf8').split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l)).filter((o) => o.kind === 'fact');
const byId = new Map(facts.map((f) => [f.id, f]));
const report = JSON.parse(readFileSync(reportPath, 'utf8'));
const docOf = (f) => (f.from && f.from.doc) || '?';

// Groups: referent -> members, over cross-document non-premise pairs.
const byRef = new Map();
let sameDocPairs = 0;
for (const p of report.realPairs) {
  if (p.kind === 'premise') continue;
  if (p.sameDoc) { sameDocPairs++; continue; }
  for (const v of p.via) {
    if (!byRef.has(v)) byRef.set(v, new Set());
    byRef.get(v).add(p.a).add(p.b);
  }
}
const merged = new Map();
for (const [ref, set] of byRef) {
  const ids = [...set].sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));
  const k = ids.join(',');
  if (!merged.has(k)) merged.set(k, { via: [], ids });
  merged.get(k).via.push(ref);
}
const groups = [...merged.values()].sort((a, b) => b.ids.length - a.ids.length);

// Checks: each INFERRED conclusion with all its premises that are facts.
const checks = facts.filter((f) => (f.premises || []).some((p) => byId.has(p)))
  .map((f) => ({ conclusion: f.id, premises: f.premises.filter((p) => byId.has(p)) }));

let seed = 8203;
const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const pick = (xs) => xs[Math.floor(rnd() * xs.length)];

// Units, dealt largest first to the reconciler with the fewest lines.
const units = [
  ...groups.map((g, i) => ({ type: 'group', n: i + 1, lines: g.ids.length, g })),
  ...checks.map((c, i) => ({ type: 'check', n: i + 1, lines: 1 + c.premises.length, c })),
].sort((a, b) => b.lines - a.lines);
const load = Array.from({ length: N }, () => ({ lines: 0, units: [] }));
for (const u of units) { const r = load.reduce((m, x) => (x.lines < m.lines ? x : m)); r.units.push(u); r.lines += u.lines; }

// Canary lenders. A value lends a number when it holds exactly one quantity:
// a run of digits with at most one point, an optional sign before it, not
// part of an identifier (no letter, `§` or `#` just before it, no `-` or `'`
// just after: W1, §1.2, 8-epoch, lane 4's). Its domain is the fact's unit,
// or else a unit word right after the number, from a fixed list; a number
// with neither never lends or twins. A lender also matches the number's
// shape (sign, digits before and after the point, v2.5 §8) and its order of
// magnitude (a 0.024 gap never becomes 0.937). Linear scans only: the text
// is untrusted.
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
const shape = (t) => { const sign = '+-−'.includes(t[0]) ? t[0] : ''; const [i, d = ''] = t.slice(sign.length).split('.'); return `${sign}:${i.length}:${d.length}`; };
function slot(f) {
  if (typeof f.value !== 'string') return null;
  const ns = numbers(f.value);
  if (ns.length !== 1) return null;
  const n = ns[0], domain = f.unit || (UNITS.has(n.word) ? n.word : '');
  if (n.ident || !domain || !n.num || !String(f.says || '').includes(n.text)) return null;
  return { ...n, domain: `${domain}|${shape(n.text)}` };
}
const byDomain = new Map();
for (const f of facts) { const s = slot(f); if (s) { if (!byDomain.has(s.domain)) byDomain.set(s.domain, []); byDomain.get(s.domain).push(f); } }
const used = new Set();
function lenderFor(f, far) {
  const s = slot(f);
  if (!s || used.has(f.id)) return null;
  const ok = (byDomain.get(s.domain) || []).filter((g) => {
    const t = slot(g).text;
    return !used.has(g.id) && t !== s.text && !String(f.says || '').includes(t) && !String(f.value).includes(t) &&
      Math.abs(slot(g).num) < Math.abs(s.num) * 10 && Math.abs(slot(g).num) * 10 > Math.abs(s.num) &&
      (!far || Math.abs(slot(g).num - s.num) >= Math.abs(s.num) / 5);
  });
  return ok.length ? { from: s.text, to: slot(pick(ok)).text, id: null } : null;
}
const docs = [...new Set(facts.map(docOf))];
let nextId = Math.max(...facts.map((f) => Number(f.id.slice(1)))) + 1;
function twin(f, lender, doc) {
  used.add(f.id);
  for (const g of byDomain.get(slot(f).domain)) if (slot(g).text === lender.to) used.add(g.id);
  return { ...f, id: `F${nextId++}`, value: String(f.value).split(lender.from).join(lender.to), says: String(f.says || '').split(lender.from).join(lender.to), from: { ...f.from, doc }, canaryOf: f.id };
}

const canaries = [];
for (const [k, r] of load.entries()) {
  const want = Math.max(3, Math.ceil(r.units.length * 0.02));
  const nGroups = r.units.filter((u) => u.type === 'group').length;
  const share = Math.round(want * (nGroups / r.units.length));
  const quota = { group: Math.max(nGroups ? 1 : 0, share), check: 0 };
  quota.check = Math.max(0, want - quota.group);
  for (const type of ['group', 'check']) {
    const pool = r.units.filter((u) => u.type === type && !u.canary);
    for (let tries = 0, got = 0; got < quota[type] && tries < 5000; tries++) {
      const u = pick(pool);
      if (!u || u.canary) continue;
      if (type === 'group') {
        const f = byId.get(pick(u.g.ids));
        const lender = lenderFor(f, false);
        if (!lender) continue;
        const c = twin(f, lender, pick(docs.filter((d) => d !== docOf(f))));
        u.g = { ...u.g, ids: [...u.g.ids, c.id] };
        u.canary = c.id; canaries.push({ reconciler: k + 1, type, unit: u.n, real: f.id, twin: c.id }); byId.set(c.id, c); got++;
      } else {
        const f = byId.get(u.c.conclusion);
        const lender = lenderFor(f, true);
        if (!lender) continue;
        const c = twin(f, lender, docOf(f));
        u.c = { ...u.c, conclusion: c.id };
        u.canary = c.id; canaries.push({ reconciler: k + 1, type, unit: u.n, real: f.id, twin: c.id }); byId.set(c.id, c); got++;
      }
    }
  }
}

// View ids: document order, ledger order within a document; a canary sits
// at a random place among its document's facts.
const order = [];
for (const d of docs) {
  const own = facts.filter((f) => docOf(f) === d).map((f) => f.id);
  for (const c of canaries) { const t = byId.get(c.twin); if (docOf(t) === d) own.splice(Math.floor(rnd() * (own.length + 1)), 0, t.id); }
  order.push(...own);
}
const vid = new Map(order.map((id, i) => [id, `V${i + 1}`]));
const show = (id) => { const f = byId.get(id); return { id: vid.get(id), doc: docOf(f), key: f.key, value: f.value, unit: f.unit, mark: f.mark, says: f.says }; };

mkdirSync(outDir, { recursive: true });
const summary = { groups: groups.length, groupLines: groups.reduce((a, g) => a + g.ids.length, 0), checks: checks.length, checkLines: checks.reduce((a, c) => a + 1 + c.premises.length, 0), sameDocPairsUnreviewed: sameDocPairs, canaries: canaries.length, reconcilers: [] };
for (const [k, r] of load.entries()) {
  const rows = r.units.sort((a, b) => (a.type === b.type ? a.n - b.n : a.type === 'group' ? -1 : 1)).map((u) => u.type === 'group'
    ? { group: u.n, via: u.g.via, facts: u.g.ids.slice().sort((a, b) => Number(vid.get(a).slice(1)) - Number(vid.get(b).slice(1))).map(show) }
    : { check: u.n, conclusion: show(u.c.conclusion), premises: u.c.premises.map(show) });
  writeFileSync(join(outDir, `R${k + 1}.jsonl`), rows.map((x) => JSON.stringify(x)).join('\n') + '\n');
  summary.reconcilers.push({ file: `R${k + 1}.jsonl`, groups: rows.filter((x) => x.group).length, checks: rows.filter((x) => x.check).length, lines: r.lines + canaries.filter((c) => c.reconciler === k + 1).length, canaries: canaries.filter((c) => c.reconciler === k + 1).length });
}
writeFileSync(join(outDir, 'summary.json'), JSON.stringify(summary, null, 1) + '\n');
writeFileSync(keyPath, JSON.stringify({ canaries: canaries.map((c) => ({ ...c, realView: vid.get(c.real), twinView: vid.get(c.twin) })), view: Object.fromEntries([...vid].map(([id, v]) => [v, id])) }, null, 1) + '\n');
console.log(JSON.stringify(summary));
