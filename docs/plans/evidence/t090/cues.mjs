#!/usr/bin/env node
// T090: v2.8 item 2's cue, measured for free on T086's ledger. A fact whose
// quote carries a correction cue is flagged in the reconciler's view, so a
// reconciler looks in its units for what it corrects. Reports how many facts
// carry a cue (the load), and which of the key's corrections in reach have a
// cue on a correcting fact (the reach). Run from this folder:
//
//   node cues.mjs > cues.json
//
// The cues are words a writer uses when correcting their own record. "not"
// counts only before a figure or a number word ("zero, not two"), since
// "not" alone is in most sentences. "instead of", "rather than", "in fact" and
// "actually" were tried and dropped: 69 flags on T086, none on a correcting
// fact. Bounded patterns only: the quotes are untrusted text.
//
// Each cued fact also gets a cue unit: itself and the K facts recorded before
// it, in any document, most like it by the Dice coefficient over the words of
// key and quote. The report says, per correction, whether an earlier fact is
// among them.

import { readFileSync } from 'node:fs';

const H1 = new URL('../t086/', import.meta.url);
const ledger = readFileSync(new URL('ledger.jsonl', H1), 'utf8').split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l));
const key = JSON.parse(readFileSync(new URL('key.json', H1), 'utf8')).corrections;
const grade = JSON.parse(readFileSync(new URL('grade.json', H1), 'utf8')).corrections;

export const CUES = [
  ['struck', /\bstruck\b|~~/i],
  ['superseded', /\bsupersed(?:ed|es)\b/i],
  ['turned out', /\bturned out\b/i],
  ['was wrong', /\b(?:was|were|is) (?:wrong|mistaken|incorrect)\b|\bmistakes?\b|\bconfidently wrong\b/i],
  ['undefined', /\bwas undefined\b|\bnever (?:defined|happened|ran)\b/i],
  ['assumed', /\bassumed\b/i],
  ['withdrawn', /\bwithdr[ae]wn?\b|\bretracted\b/i],
  ['not a figure', /\bnot (?:\d[\d.,]*|one|two|three|four|five|six|seven|eight|nine|ten|zero)\b/i],
];
const cuesOf = (text) => CUES.filter(([, re]) => re.test(text)).map(([name]) => name);

const flagged = ledger.filter((f) => cuesOf(f.says).length);
const K = Number(process.argv[2] ?? 8);
const words = (f) => new Set(`${f.key} ${f.says}`.toLowerCase().match(/[a-z0-9]+(?:[.'][a-z0-9]+)*/g) || []);
const STOP = new Set('the a an of to and is in it its on at as by for be or was are this that with from not no'.split(' '));
const bags = new Map(ledger.map((f) => [f.id, new Set([...words(f)].filter((w) => !STOP.has(w)))]));
const dice = (a, b) => { let n = 0; for (const w of a) if (b.has(w)) n++; return a.size + b.size ? (2 * n) / (a.size + b.size) : 0; };
const commitOrder = new Map(JSON.parse(readFileSync(new URL('cut/scope.json', H1), 'utf8')).commits.map((c, i) => [c, i]));
const when = (f) => commitOrder.get(f.at.slice(f.at.lastIndexOf('@') + 1)) ?? -1;
const clauseNo = (f) => Number(f.at.slice(f.at.indexOf('#') + 1, f.at.lastIndexOf('@')));
// Recorded before: an earlier commit, or the same commit and document, earlier in it.
const before = (e, f) => when(e) < when(f) || (when(e) === when(f) && e.at.split('#')[0] === f.at.split('#')[0] && clauseNo(e) < clauseNo(f));
const unitOf = (f) => ledger.filter((e) => e !== f && before(e, f)).map((e) => [e.id, dice(bags.get(f.id), bags.get(e.id))]).sort((a, b) => b[1] - a[1]).slice(0, K).map(([id]) => id);
const units = new Map(flagged.map((f) => [f.id, unitOf(f)]));
const byCue = Object.fromEntries(CUES.map(([name]) => [name, ledger.filter((f) => cuesOf(f.says).includes(name)).length]));
const reach = Object.entries(key).filter(([, k]) => k.reach).map(([id]) => {
  const g = grade[id];
  const hits = g.correction.map((fid) => ledger.find((f) => f.id === fid)).filter((f) => f && cuesOf(f.says).length);
  const met = hits.filter((f) => units.get(f.id).some((e) => g.earlier.includes(e)));
  return { key: id, step: g.step.split(':')[0], cued: hits.map((f) => ({ id: f.id, cues: cuesOf(f.says), says: f.says.slice(0, 140), unit: units.get(f.id) })), met: met.map((f) => f.id) };
});

console.log(JSON.stringify({
  facts: ledger.length,
  flagged: flagged.length,
  byCue,
  reached: reach.filter((r) => r.cued.length).map((r) => r.key),
  notReached: reach.filter((r) => !r.cued.length).map((r) => r.key),
  k: K,
  metInCueUnit: reach.filter((r) => r.met.length).map((r) => r.key),
  detail: reach,
}, null, 1));
