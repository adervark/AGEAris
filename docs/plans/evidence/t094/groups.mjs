#!/usr/bin/env node
// T094 H2: what the reconcilers see, under v2.8. H1's groups.mjs
// (t086/groups.mjs, v2.7) with v2.8's units and twin rule
// (docs/plans/evidence/t090/measurements.md):
//
//   - an **edit** unit for each clause a later version of a document dropped
//     (`<doc>@<commit>` in the cut), beside the clause of a later version of
//     the same document most like it: the Dice coefficient over their word
//     sets, at least 0.4 and below 1 (t090/edit-pairs.mjs). Each side shows
//     its clause and the facts written at it (v2.8 item 1);
//   - a **cue** unit for each fact whose quote carries a correction cue,
//     beside the 12 facts recorded before it most like it, in any document
//     (t090/cues.mjs) (v2.8 item 2);
//   - a group twin takes no figure another fact in its group states, at that
//     fact's precision; one-digit figures are passed over (v2.8 item 4,
//     t090/twin-rule.mjs).
//
// v2.7's canaries, unchanged:
//
//   - a check is twinned only when its premises give the figure the twin
//     replaces (v2.7 item 1, t087/canary-fair.mjs's rule), AND the parent has
//     written its refutation from the premises alone in <refutations.json>,
//     `{ "<conclusion fact id>": "<sentence>" }`, before any reconciler runs.
//     Every check the rule admits is listed in <out-dir>/eligible.json for
//     the parent to read;
//   - each reconciler's first group canary goes into its largest decile of
//     groups by size (v2.7 item 2);
//   - a group twin is attributed to a document of the round with 30 facts or
//     more, never an earlier version (`name@commit`) or a cited section.
//
// R0d's description, still true:
//
//   - every fact shows its commit and the commit's time (v2.6 item 5), from
//     `at` (`<clause>@<commit>`), so a reconciler can tell which of two
//     readings is later;
//   - a check canary is a copy of an eligible check, shown beside the real
//     one to a different reconciler (v2.6 item 3). Eligible: the conclusion
//     holds one number in a unit domain, and some premise holds a number in
//     the same domain, so the premises bear on the value. Where it can, the
//     copy goes to a reconciler none of whose units shows the real
//     conclusion. Copies are numbered among the real checks, so a number
//     says nothing;
//   - a group canary's twin is attributed to one of the round's documents
//     (those with 100 facts or more), never to a cited section, whose facts
//     read differently; and it twins a fact whose quote says more than its
//     bare value.
//
//   node groups.mjs <ledger.jsonl> <link-report.json> <rsna-repo> <out-dir> <key.json> <n-reconcilers> <exclude.json> <refutations.json> <cut-dir>
//
// <cut-dir> holds clauses.jsonl and scope.json (the commit order).
//
// <exclude.json> names facts no canary may copy, lend a number from, or
// show as a premise: R0d's key facts, and the conclusions of checks whose
// premises, read by the parent before any reconciler ran, cannot refute a
// changed number.
//
// Groups and checks are formed, dealt and twinned as in R0c otherwise: at
// least 3 or 2% of each reconciler's units are canaries, unmarked. RSNA is
// read with `git show -s` only, for the commit times.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const [ledgerPath, reportPath, repo, outDir, keyPath, nArg, excludePath, refutePath, cutDir] = process.argv.slice(2);
if (!cutDir) { console.error('usage: node groups.mjs <ledger> <link-report> <rsna-repo> <out-dir> <key.json> <n> <exclude.json> <refutations.json> <cut-dir>'); process.exit(2); }
const refutations = refutePath ? JSON.parse(readFileSync(refutePath, 'utf8')) : {};
const N = Number(nArg);
if (!Number.isInteger(N) || N < 2) { console.error('usage: node groups.mjs <ledger> <link-report> <rsna-repo> <out-dir> <key.json> <n-reconcilers, at least 2>'); process.exit(2); }
const facts = readFileSync(ledgerPath, 'utf8').split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l)).filter((o) => o.kind === 'fact');
const byId = new Map(facts.map((f) => [f.id, f]));
const report = JSON.parse(readFileSync(reportPath, 'utf8'));
const docOf = (f) => (f.from && f.from.doc) || '?';
const commitOf = (f) => String(f.at).slice(String(f.at).lastIndexOf('@') + 1);

const when = new Map();
for (const c of new Set(facts.map(commitOf))) {
  when.set(c, execFileSync('git', ['-C', repo, 'show', '-s', '--format=%ci', c], { encoding: 'utf8', env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' } }).trim().slice(0, 16));
}
const docCommit = new Map(facts.map((f) => [docOf(f), commitOf(f)]));

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

// v2.8 item 1: edit units, from the cut's record of what each edit dropped.
const clauses = readFileSync(join(cutDir, 'clauses.jsonl'), 'utf8').split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l));
const commitRank = new Map(JSON.parse(readFileSync(join(cutDir, 'scope.json'), 'utf8')).commits.map((c, i) => [c, i]));
const wordsOf = (text) => new Set(String(text).toLowerCase().match(/[a-z0-9]+(?:[.'][a-z0-9]+)*/g) || []);
const dice = (a, b) => { let n = 0; for (const w of a) if (b.has(w)) n++; return a.size + b.size ? (2 * n) / (a.size + b.size) : 0; };
const baseDoc = (d) => d.split('@')[0];
const clauseBag = new Map(clauses.map((c) => [c.id, wordsOf(c.text)]));
const clauseOf = (f) => String(f.at).slice(0, String(f.at).lastIndexOf('@'));
const factsAtClause = new Map();
for (const f of facts) { const c = clauseOf(f); if (!factsAtClause.has(c)) factsAtClause.set(c, []); factsAtClause.get(c).push(f.id); }
const edits = [];
for (const d of clauses.filter((c) => c.doc.includes('@'))) {
  let best = null;
  for (const c of clauses) {
    if (c === d || baseDoc(c.doc) !== baseDoc(d.doc) || !(commitRank.get(c.commit) > commitRank.get(d.commit))) continue;
    const x = dice(clauseBag.get(d.id), clauseBag.get(c.id));
    if (!best || x > best.x) best = { c, x };
  }
  if (best && best.x >= 0.4 && best.x < 1) edits.push({ earlier: d, later: best.c, ids: [...(factsAtClause.get(d.id) || []), ...(factsAtClause.get(best.c.id) || [])] });
}

// v2.8 item 2: cue units. Bounded patterns only: quotes are untrusted text.
const CUES = [/\bstruck\b|~~/i, /\bsupersed(?:ed|es)\b/i, /\bturned out\b/i,
  /\b(?:was|were|is) (?:wrong|mistaken|incorrect)\b|\bmistakes?\b|\bconfidently wrong\b/i,
  /\bwas undefined\b|\bnever (?:defined|happened|ran)\b/i, /\bassumed\b/i, /\bwithdr[ae]wn?\b|\bretracted\b/i,
  /\bnot (?:\d[\d.,]*|one|two|three|four|five|six|seven|eight|nine|ten|zero)\b/i];
const STOP = new Set('the a an of to and is in it its on at as by for be or was are this that with from not no'.split(' '));
const factBag = new Map(facts.map((f) => [f.id, new Set([...wordsOf(`${f.key} ${f.says}`)].filter((w) => !STOP.has(w)))]));
const rankOf = (f) => commitRank.get(commitOf(f)) ?? -1;
const clauseNo = (f) => Number(clauseOf(f).slice(clauseOf(f).lastIndexOf('#') + 1));
const recordedBefore = (e, f) => rankOf(e) < rankOf(f) || (rankOf(e) === rankOf(f) && baseDoc(clauseOf(e).split('#')[0]) === baseDoc(clauseOf(f).split('#')[0]) && clauseOf(e).split('#')[0] === clauseOf(f).split('#')[0] && clauseNo(e) < clauseNo(f));
const cues = facts.filter((f) => CUES.some((re) => re.test(String(f.says || '')))).map((f) => ({
  fact: f.id,
  before: facts.filter((e) => e !== f && recordedBefore(e, f)).map((e) => [e.id, dice(factBag.get(f.id), factBag.get(e.id))]).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([id]) => id),
}));

let seed = 8506;
const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const pick = (xs) => xs[Math.floor(rnd() * xs.length)];
const shuffle = (xs) => { const a = xs.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// Units, dealt largest first to the reconciler with the fewest lines.
const units = [
  ...groups.map((g, i) => ({ type: 'group', n: i + 1, lines: g.ids.length, g })),
  ...checks.map((c, i) => ({ type: 'check', key: i, lines: 1 + c.premises.length, c })),
  ...edits.map((e) => ({ type: 'edit', lines: 2 + e.ids.length, e })),
  ...cues.map((c) => ({ type: 'cue', lines: 1 + c.before.length, q: c })),
].sort((a, b) => b.lines - a.lines);
const load = Array.from({ length: N }, () => ({ lines: 0, units: [] }));
for (const u of units) { const r = load.reduce((m, x) => (x.lines < m.lines ? x : m)); r.units.push(u); r.lines += u.lines; }
const shows = load.map((r) => new Set(r.units.flatMap((u) => (u.type === 'group' ? u.g.ids : u.type === 'check' ? [u.c.conclusion, ...u.c.premises] : u.type === 'edit' ? u.e.ids : [u.q.fact, ...u.q.before]))));

// R0c's number and domain rules, unchanged (t082/r0c/groups.mjs).
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
  const n = ns[0], unit = f.unit || (UNITS.has(n.word) ? n.word : '');
  if (n.ident || !unit || !n.num || !String(f.says || '').includes(n.text)) return null;
  return { ...n, unit, domain: `${unit}|${shape(n.text)}` };
}
// T084's eligibility (t084/canary-checks.mjs): some premise holds a number in
// the conclusion's unit.
function units_(f) {
  const out = new Set();
  for (const n of numbers(`${f.value ?? ''} ${f.says ?? ''}`)) if (!n.ident && UNITS.has(n.word)) out.add(n.word);
  if (f.unit) out.add(f.unit);
  return out;
}
// v2.7 item 1: the premises give the conclusion's own figure, within its
// rounding (half a unit of its last digit, at most 2%): a premise states it,
// or one step on two premise figures gives it (sum, difference, product,
// ratio, midpoint; for % a ratio or difference read as a percentage). A
// one-digit figure must be stated. Then the parent's refutation.
const figuresOf = (f) => {
  const text = `${f.value ?? ''} ${f.says ?? ''}`;
  let joined = '';
  for (let i = 0; i < text.length; i++) if (!(text[i] === ',' && isDigit(text[i - 1]) && isDigit(text[i + 1]))) joined += text[i];
  return [...new Set(numbers(joined).filter((n) => !n.ident && n.num).map((n) => Math.abs(n.num)))];
};
function givenBy(c) {
  const s = slot(byId.get(c.conclusion));
  if (!s) return null;
  const bare = s.text.replace(/^[-+−]/, ''), d = (bare.split('.')[1] || '').length, target = Math.abs(s.num);
  const tol = Math.min(0.5 * 10 ** -d, target * 0.02), near = (x) => Number.isFinite(x) && Math.abs(x - target) <= tol;
  const prem = c.premises.filter((p) => p !== c.conclusion).map((p) => ({ p, figs: figuresOf(byId.get(p)) }));
  for (const q of prem) for (const a of q.figs) if (near(a)) return `${q.p}: ${a}`;
  if (bare.replace('.', '').replace(/^0+/, '').length < 2) return null;
  const all = prem.flatMap((q) => q.figs.map((a) => ({ p: q.p, a })));
  for (let i = 0; i < all.length; i++) for (let j = 0; j < all.length; j++) {
    if (i === j) continue;
    const a = all[i].a, b = all[j].a;
    const steps = [['+', a + b], ['-', a - b], ['×', a * b], ['/', a / b], ['mid', (a + b) / 2]];
    if (s.unit === '%') steps.push(['/ as %', (100 * a) / b], ['- / as %', (100 * (a - b)) / b]);
    for (const [op, x] of steps) if (near(x)) return `${all[i].p}: ${a} ${op} ${all[j].p}: ${b}`;
  }
  return null;
}
const admitted = (c) => !!givenBy(c);
const eligible = (c) => admitted(c) && typeof refutations[c.conclusion] === 'string' && refutations[c.conclusion].trim().length > 0;

const byDomain = new Map();
for (const f of facts) { const s = slot(f); if (s) { if (!byDomain.has(s.domain)) byDomain.set(s.domain, []); byDomain.get(s.domain).push(f); } }
const excluded = new Set(excludePath ? JSON.parse(readFileSync(excludePath, 'utf8')).facts : []);
const used = new Set(excluded);
function lenderFor(f, far) {
  const s = slot(f);
  if (!s || used.has(f.id)) return null;
  const ok = (byDomain.get(s.domain) || []).filter((g) => {
    const t = slot(g).text;
    return !used.has(g.id) && t !== s.text && !String(f.says || '').includes(t) && !String(f.value).includes(t) &&
      Math.abs(slot(g).num) < Math.abs(s.num) * 10 && Math.abs(slot(g).num) * 10 > Math.abs(s.num) &&
      (!far || Math.abs(slot(g).num - s.num) >= Math.abs(s.num) / 5);
  });
  return ok.length ? { from: s.text, to: slot(pick(ok)).text } : null;
}
const roundDocs = [...new Set(facts.map(docOf))].filter((d) => !d.includes('§') && !d.includes('@') && facts.filter((f) => docOf(f) === d).length >= 30);
let nextId = Math.max(...facts.map((f) => Number(f.id.slice(1)))) + 1;
// The number is swapped once in the value and once in the quote, at the
// token numbers() finds, so a digit inside another number is left alone
// (R0c's split and join turned a 960 into a 360 beside a 9 that became 3).
function swapOnce(text, from, to) {
  const n = numbers(text).find((x) => x.text === from && !x.ident) || numbers(text).find((x) => x.text === from);
  return n ? text.slice(0, n.start) + to + text.slice(n.end) : text;
}
function twin(f, lender, doc) {
  used.add(f.id);
  for (const g of byDomain.get(slot(f).domain)) if (slot(g).text === lender.to) used.add(g.id);
  return { ...f, id: `F${nextId++}`, value: swapOnce(String(f.value), lender.from, lender.to), says: swapOnce(String(f.says || ''), lender.from, lender.to), from: { ...f.from, doc }, at: `canary@${docCommit.get(doc)}`, canaryOf: f.id };
}

// v2.8 item 4: a twin's figure is not one another fact in its group states,
// rounded to the precision that fact writes; one-digit figures are passed over.
function statedInGroup(ids, realId, to) {
  const n = Number(String(to).replace(/^[-+−]/, ''));
  for (const id of ids) {
    if (id === realId) continue;
    const g = byId.get(id);
    for (const t of String(g.value ?? '').match(/\d+(?:\.\d+)?/g) || []) {
      const places = t.includes('.') ? t.length - t.indexOf('.') - 1 : 0;
      if (t.replace('.', '').replace(/^0+/, '').length > 1 && Number(t) === Number(n.toFixed(places))) return true;
    }
  }
  return false;
}

// Each reconciler's canaries: at least 3 or 2% of its units. Check copies
// are dealt in turn, one per reconciler a round, since few checks are
// eligible and have a lender; group canaries make up the rest, at least 1.
const canaries = [];
const copies = load.map(() => []);
const holder = new Map(); // real check -> reconciler index
for (const [k, r] of load.entries()) for (const u of r.units) if (u.type === 'check') holder.set(u.c.conclusion, k);
const want = load.map((r) => Math.max(3, Math.ceil(r.units.length * 0.02)));
const checkQuota = load.map((r, k) => {
  const nGroups = r.units.filter((u) => u.type === 'group').length;
  return Math.max(0, want[k] - Math.max(1, Math.round(want[k] * (nGroups / r.units.length))));
});
function copyCheck(k) {
  // An eligible check held by another reconciler, preferring one whose
  // conclusion this reconciler is not shown anywhere.
  const theirs = load.flatMap((x, j) => (j === k ? [] : x.units.filter((u) => u.type === 'check' && !u.copied && !u.noLender && eligible(u.c) && !u.c.premises.some((p) => excluded.has(p)))));
  const unseen = theirs.filter((u) => !shows[k].has(u.c.conclusion));
  for (const pool of [unseen, theirs]) {
    for (const u of shuffle(pool)) {
      const f = byId.get(u.c.conclusion);
      const lender = lenderFor(f, true);
      if (!lender) { u.noLender = true; continue; } // lenders only ever get fewer
      const c = twin(f, lender, docOf(f));
      c.at = f.at;
      u.copied = true;
      const copy = { type: 'check', lines: u.lines, c: { conclusion: c.id, premises: u.c.premises }, canary: c.id };
      copies[k].push(copy);
      canaries.push({ reconciler: k + 1, type: 'check', real: f.id, realHolder: holder.get(f.id) + 1, twin: c.id, copy });
      byId.set(c.id, c);
      return true;
    }
  }
  return false;
}
for (let progress = true; progress;) {
  progress = false;
  for (const k of load.keys()) if (copies[k].length < checkQuota[k] && copyCheck(k)) progress = true;
}
for (const [k, r] of load.entries()) {
  // A group canary goes only where no excluded fact is, so a twin never
  // draws the eye to a group that holds a key fact.
  const pool = r.units.filter((u) => u.type === 'group' && !u.g.ids.some((id) => excluded.has(id)));
  // v2.7 item 2: the first group canary goes into this reconciler's largest
  // decile of groups, where R0d had none.
  const mineBySize = r.units.filter((u) => u.type === 'group').sort((a, b) => b.g.ids.length - a.g.ids.length);
  const cut10 = mineBySize[Math.max(0, Math.ceil(mineBySize.length / 10) - 1)]?.g.ids.length ?? Infinity;
  const large = pool.filter((u) => u.g.ids.length >= cut10);
  for (let tries = 0, got = 0; got < want[k] - copies[k].length && tries < 5000; tries++) {
    const u = pick(got === 0 && large.length && tries < 2500 ? large : pool);
    if (!u || u.canary) continue;
    const f = byId.get(pick(u.g.ids));
    // A bare number says nothing of what it counts, so its twin could pass
    // for another real reading of something else.
    if (String(f.says || '').length < String(f.value).length + 12) continue;
    const lender = lenderFor(f, false);
    if (!lender) continue;
    if (statedInGroup(u.g.ids, f.id, lender.to)) continue;
    const c = twin(f, lender, pick(roundDocs.filter((d) => d !== docOf(f))));
    u.g = { ...u.g, ids: [...u.g.ids, c.id] };
    u.canary = c.id; canaries.push({ reconciler: k + 1, type: 'group', unit: u.n, real: f.id, twin: c.id }); byId.set(c.id, c); got++;
  }
}
for (const [k, r] of load.entries()) r.units.push(...copies[k]);

// Check numbers: real checks and copies in one shuffled sequence.
const allChecks = load.flatMap((r) => r.units.filter((u) => u.type === 'check'));
for (let i = allChecks.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [allChecks[i], allChecks[j]] = [allChecks[j], allChecks[i]]; }
allChecks.forEach((u, i) => { u.n = i + 1; });
// Edits and cues numbered in one sequence each, across reconcilers.
load.flatMap((r) => r.units.filter((u) => u.type === 'edit')).forEach((u, i) => { u.n = i + 1; });
load.flatMap((r) => r.units.filter((u) => u.type === 'cue')).forEach((u, i) => { u.n = i + 1; });
for (const c of canaries) if (c.type === 'check') { c.unit = c.copy.n; c.realUnit = allChecks.find((u) => !u.canary && u.c.conclusion === c.real).n; delete c.copy; }

// View ids: document order, ledger order within a document; a canary sits
// at a random place among its document's facts.
const docs = [...new Set(facts.map(docOf))];
const order = [];
for (const d of docs) {
  const own = facts.filter((f) => docOf(f) === d).map((f) => f.id);
  for (const c of canaries) { const t = byId.get(c.twin); if (docOf(t) === d) own.splice(Math.floor(rnd() * (own.length + 1)), 0, t.id); }
  order.push(...own);
}
const vid = new Map(order.map((id, i) => [id, `V${i + 1}`]));
const show = (id) => { const f = byId.get(id); const c = commitOf(f); return { id: vid.get(id), doc: docOf(f), commit: `${c} ${when.get(c)}`, key: f.key, value: f.value, unit: f.unit, mark: f.mark, says: f.says }; };

mkdirSync(outDir, { recursive: true });
const summary = {
  groups: groups.length, groupLines: groups.reduce((a, g) => a + g.ids.length, 0), checks: checks.length,
  checkLines: checks.reduce((a, c) => a + 1 + c.premises.length, 0), admittedChecks: checks.filter(admitted).length, eligibleChecks: checks.filter(eligible).length,
  sameDocPairsUnreviewed: sameDocPairs, edits: edits.length, cues: cues.length, canaries: canaries.length, reconcilers: [],
};
for (const [k, r] of load.entries()) {
  const KIND = { group: 0, edit: 1, cue: 2, check: 3 };
  for (const c of [...new Set(r.units.filter((u) => u.type === 'edit').flatMap((u) => [u.e.earlier.commit, u.e.later.commit]))]) {
    if (!when.has(c)) when.set(c, execFileSync('git', ['-C', repo, 'show', '-s', '--format=%ci', c], { encoding: 'utf8', env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' } }).trim().slice(0, 16));
  }
  const side = (c) => ({ clause: c.id, doc: c.doc, commit: `${c.commit} ${when.get(c.commit) || ''}`.trim(), text: c.text, facts: (factsAtClause.get(c.id) || []).map(show) });
  const rows = r.units.sort((a, b) => (a.type === b.type ? a.n - b.n : KIND[a.type] - KIND[b.type])).map((u) => u.type === 'group'
    ? { group: u.n, via: u.g.via, facts: u.g.ids.slice().sort((a, b) => Number(vid.get(a).slice(1)) - Number(vid.get(b).slice(1))).map(show) }
    : u.type === 'edit' ? { edit: u.n, earlier: side(u.e.earlier), later: side(u.e.later) }
    : u.type === 'cue' ? { cue: u.n, fact: show(u.q.fact), before: u.q.before.map(show) }
    : { check: u.n, conclusion: show(u.c.conclusion), premises: u.c.premises.map(show) });
  writeFileSync(join(outDir, `R${k + 1}.jsonl`), rows.map((x) => JSON.stringify(x)).join('\n') + '\n');
  const mine = canaries.filter((c) => c.reconciler === k + 1);
  summary.reconcilers.push({
    file: `R${k + 1}.jsonl`, groups: rows.filter((x) => x.group).length, edits: rows.filter((x) => x.edit).length, cues: rows.filter((x) => x.cue).length, checks: rows.filter((x) => x.check).length,
    lines: rows.reduce((a, x) => a + (x.group ? x.facts.length : x.edit ? 2 + x.earlier.facts.length + x.later.facts.length : x.cue ? 1 + x.before.length : 1 + x.premises.length), 0),
    canaries: mine.length, groupCanaries: mine.filter((c) => c.type === 'group').length, checkCanaries: mine.filter((c) => c.type === 'check').length,
  });
}
writeFileSync(join(outDir, 'summary.json'), JSON.stringify(summary, null, 1) + '\n');
// For the parent: every check the rule admits, free of excluded facts, with
// what gives its figure, to write refutations from. Never shown to anyone else.
writeFileSync(join(outDir, 'eligible.json'), JSON.stringify(checks.filter((c) => admitted(c) && !excluded.has(c.conclusion) && !c.premises.some((p) => excluded.has(p))).map((c) => ({
  conclusion: c.conclusion, value: byId.get(c.conclusion).value, says: byId.get(c.conclusion).says, givenBy: givenBy(c),
  premises: c.premises.map((p) => ({ id: p, value: byId.get(p).value, says: byId.get(p).says })), refuted: !!refutations[c.conclusion],
})), null, 1) + '\n');
writeFileSync(keyPath, JSON.stringify({ canaries: canaries.map((c) => ({ ...c, realView: vid.get(c.real), twinView: vid.get(c.twin), ...(c.type === 'check' ? { refutation: refutations[c.real] } : {}) })), view: Object.fromEntries([...vid].map(([id, v]) => [v, id])) }, null, 1) + '\n');
console.log(JSON.stringify(summary));
