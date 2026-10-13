// T074 (R0) — throwaway. Applies T074's fixed extraction procedure to RSNA's
// research round 3 as it stood at e4e356c, writes a draft ledger, and runs the
// checks of docs/plans/research-runs.md §5.4 that apply to a round with no spend,
// plus the two extensions under test. Reads RSNA through `git show`; writes
// nothing there.
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const DIR = new URL('.', import.meta.url).pathname;
const RSNA = '/home/ade/Code/RSNA';
const PIN = 'e4e356c';
const git = (...a) => execFileSync('git', ['-C', RSNA, ...a], { encoding: 'utf8', maxBuffer: 1 << 26 });

const LANES = [
  { lane: 9, file: 'lane9-above-the-plateau.md' },
  { lane: 10, file: 'lane10-capability-audit.md' },
  { lane: 11, file: 'lane11-inference-and-efficiency.md' },
  { lane: 12, file: 'lane12-semisupervised.md' },
  { lane: 13, file: 'lane13-submission-budget-and-selection.md' },
];
const REPO_PATH = (f) => `docs/research/0902c/${f}`;
const atPin = (path) => git('show', `${PIN}:${path}`);

// ---- Questions: T047's briefs split into asks (a sentence that asks, or that
// names a target to investigate). Lane 13 had no brief: its asks come from its
// report's own title, dated at its report's commit.
const QUESTIONS = [
  { id: 'L9.Q1', lane: 9, ask: 'Nobody has looked at the ≥0.94 band: 84 teams at ≥0.94, 28 at ≥0.945, 3 at ≥0.95, against our 0.926 at rank 776.' },
  { id: 'L9.Q2', lane: 9, ask: 'What do they do, and what of it is verifiable rather than asserted?' },
  { id: 'L10.Q1', lane: 10, ask: 'This lane looks systematically: every flag, every default, every measured-but-unfixed defect.' },
  { id: 'L11.Q1', lane: 11, ask: 'What can be bought with the remainder at zero training GPU?' },
  { id: 'L11.Q2', lane: 11, ask: 'And the efficiency prize is a separate $18,000 track where we are rank 265 and a cheap config is plausibly top-20.' },
  { id: 'L12.Q1', lane: 12, ask: 'What can be extracted from the 4,349 studies and the ~1,300 test studies we already hold, without a new labeling pass and without touching a standing prohibition?' },
  { id: 'L13.Q1', lane: 13, ask: 'the submission budget', unbriefed: true },
  { id: 'L13.Q2', lane: 13, ask: 'the final-two selection nobody has registered', unbriefed: true },
];

// Rounds 1–2, as T047's "already answered, do not redo" table lists them.
const SETTLED = [
  'rules, prizes, 9 h cap, external data permitted, efficiency formula, LB snapshot',
  'prior RSNA winners, literature, per-pathology AUC levels',
  'architecture headroom, resolution, density',
  'pool correlation, marginal gain, instruments, public/private split risk and the winner\'s curse',
  'labels, teacher quality, the plan',
  'the 0.936 plateau dissected, 23 notebooks',
  'the single-model gap, arm C vs the Raptor, screens S1/S2',
  'public checkpoints as members, licences, the Raptor arm',
  'external truth sets, fastMRI+, MRNet',
];

// ---- Markdown, read line by line. Section headings are H2 and deeper; the H1
// is the document's title (the interpretation pinned before reading content).
function parse(text) {
  const lines = text.split('\n');
  const out = { headings: [], tables: [], items: [] };
  let chain = []; // [{level, text, line}]
  let inFence = false;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (l.startsWith('```')) { inFence = !inFence; continue; }
    if (inFence) continue;
    const h = /^(#{1,6}) (.*)$/.exec(l);
    if (h) {
      const level = h[1].length;
      chain = chain.filter((x) => x.level < level);
      const node = { level, text: h[2].trim(), line: i + 1 };
      chain.push(node);
      out.headings.push(node);
      continue;
    }
    const sections = chain.filter((x) => x.level >= 2);
    if (l.startsWith('|') && i + 1 < lines.length && /^\|[\s:|-]+\|?\s*$/.test(lines[i + 1])) {
      const header = cells(l);
      let j = i + 2;
      while (j < lines.length && lines[j].startsWith('|')) {
        out.tables.push({ header, cells: cells(lines[j]), line: j + 1, sections: [...sections] });
        j++;
      }
      i = j - 1;
      continue;
    }
    const near = sections[sections.length - 1];
    if (near && /conclusion|verdict|finding|\bfinds?\b|result|summary/i.test(near.text) && /^(\d+\.|[-*]) /.test(l)) {
      let body = l, j = i + 1;
      while (j < lines.length && /^\s{2,}\S/.test(lines[j])) { body += ' ' + lines[j].trim(); j++; }
      out.items.push({ text: body, line: i + 1, sections: [...sections] });
      i = j - 1;
    }
  }
  return out;
}
const cells = (l) => l.replace(/^\||\|\s*$/g, '').split('|').map((c) => c.trim());

const STOP = new Set(['which', 'their', 'there', 'about', 'after', 'where', 'these', 'those', 'would', 'could', 'should', 'every', 'other', 'being', 'still', 'first', 'round', 'lanes', 'actually', 'honestly', 'cannot']);
const words = (s) => new Set((s.toLowerCase().match(/[a-z][a-z-]{4,}/g) || []).filter((w) => !STOP.has(w)));

function matchQuestion(lane, sections) {
  const qs = QUESTIONS.filter((q) => q.lane === lane);
  for (let k = sections.length - 1; k >= 0; k--) {
    const hw = words(sections[k].text);
    let best = null, score = 0;
    for (const q of qs) {
      const s = [...words(q.ask)].filter((w) => hw.has(w)).length;
      if (s > score) { score = s; best = q; }
    }
    if (best) return { q: best.id, by: `heading "${sections[k].text.slice(0, 60)}"` };
  }
  return { q: qs[0].id, by: 'first question of the lane' };
}

const MARKS = ['REPRODUCED', 'MEASURED', 'READ', 'INFERRED'];
const markIn = (s) => MARKS.find((m) => new RegExp(`\\b${m}\\b`).test(s)) || '';
function verdictIn(s) {
  if (/RESOLVED NEGATIVE/.test(s)) return 'rejects';
  if (/\bLEVER\b/.test(s)) return 'answers';
  if (/\bNULL\b|\bnull\b|\bdead\b/.test(s)) return 'null';
  if (/\bPARKED\b|\bunresolved\b|\buntested\b/i.test(s)) return 'unresolved';
  return '';
}
const SPELLED = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20 };
function counts(s) {
  const out = [];
  const toks = s.replace(/[*_]/g, '').split(/\s+/);
  for (let k = 0; k + 1 < toks.length; k++) {
    const t = toks[k].toLowerCase().replace(/[(),;:]/g, '');
    const n = /^\d+$/.test(t) ? Number(t) : SPELLED[t];
    if (n === undefined) continue;
    const next = toks.slice(k + 1, k + 3).map((x) => x.toLowerCase().replace(/[`(),.;:]/g, ''));
    if (!/^[a-z?][a-z?-]{2,}$/.test(next[0])) continue;
    const about = next.filter((x) => /^[a-z?][a-z?-]*$/.test(x)).join(' ').replace(/\d/g, '').trim();
    out.push({ value: n, unit: next[0], about });
  }
  return out;
}
const SRC_RE = /([A-Za-z0-9_][A-Za-z0-9_./-]*\.[A-Za-z0-9]+):(\d+)/g;

// ---- Extraction
const ledger = [];
const files = {};
for (const { lane, file } of LANES) {
  const text = atPin(REPO_PATH(file));
  files[lane] = { file, text, parsed: parse(text) };
  let n = 0;
  const add = (text, line, sections, viaTable) => {
    const near = sections[sections.length - 1];
    const sectionText = near ? sectionBody(files[lane].text, near.line) : '';
    const pointer = /§\s?(\d+(?:\.\d+)?)/.exec(text);
    const where = pointer ? `${file}#§${pointer[1]}` : `${file}#${near ? near.text.slice(0, 80) : '(no section)'}`;
    const { q, by } = matchQuestion(lane, sections);
    ledger.push({
      kind: 'claim', id: `l${lane}/${++n}`, run: `orch.l${lane}`, q, qBy: by,
      mark: markIn(text) || markIn(sectionText), verdict: verdictIn(text),
      src: [...text.matchAll(SRC_RE)].map((m) => `${m[1]}:${m[2]}`),
      counts: counts(text), where, pointer: pointer ? pointer[1] : null,
      line, via: viaTable ? 'table row' : 'list item', says: text.slice(0, 240),
    });
  };
  for (const r of files[lane].parsed.tables) add(r.cells.join(' | '), r.line, r.sections, true);
  for (const it of files[lane].parsed.items) add(it.text, it.line, it.sections, false);
}
function sectionBody(text, headingLine) {
  const lines = text.split('\n');
  const out = [];
  for (let i = headingLine; i < lines.length && !/^#{1,6} /.test(lines[i]); i++) out.push(lines[i]);
  return out.join('\n');
}

// ---- Decisions, from the synthesis: rows of its ranked tables, and items under
// its follow-up section. Cites are lane sections it names ("lane 10 §3.5").
const synth = atPin('docs/RESEARCH-0902c-round-3.md');
const sp = parse(synth);
const decisions = [];
const DECISION_SECTIONS = /^7\.2 |^7\.3 |^7\.4 |^11\. /;
for (const r of sp.tables) {
  const sec = r.sections[r.sections.length - 1];
  if (sec && DECISION_SECTIONS.test(sec.text)) decisions.push({ text: r.cells.join(' | '), line: r.line, sec: sec.text });
}
{
  const lines = synth.split('\n');
  let cur = null;
  for (let i = 0; i < lines.length; i++) {
    const h = /^(#{1,6}) (.*)$/.exec(lines[i]);
    if (h) { cur = h[2]; continue; }
    if (cur && /^11\. /.test(cur) && /^(\d+\.|[-*]) /.test(lines[i])) decisions.push({ text: lines[i], line: i + 1, sec: cur });
  }
}
const CITE_RE = /lane\s?(\d{1,2})\s?(?:§\s?(\d+(?:\.\d+)?))?/gi;
for (const d of decisions) {
  d.cites = [...d.text.matchAll(CITE_RE)].map((m) => ({ lane: Number(m[1]), sec: m[2] || null }));
}

// ---- Checks
const W = [];
const warn = (code, v1, detail) => W.push({ code, v1, ...detail });
const claims = ledger;
const headingNumbers = (lane) => new Set(files[lane]?.parsed.headings.map((h) => (/^(\d+(?:\.\d+)?)[. ]/.exec(h.text) || [])[1]).filter(Boolean));

// uncovered (v1): a question with no claim carrying a verdict, and no null
for (const q of QUESTIONS) {
  const cs = claims.filter((c) => c.q === q.id);
  const withVerdict = cs.filter((c) => c.verdict);
  if (!withVerdict.length) warn('uncovered', true, { q: q.id, claims: cs.length, ask: q.ask.slice(0, 90) });
}
// unbacked (v1): a decision that cites nothing, or a lane section with no claim
for (const d of decisions) {
  if (!d.cites.length) { warn('unbacked', true, { decision: d.text.slice(0, 110), line: d.line, why: 'cites no lane' }); continue; }
  for (const c of d.cites) {
    if (!c.sec) continue;
    const hit = claims.some((x) => x.run === `orch.l${c.lane}` && (x.pointer === c.sec || x.where.includes(`#${c.sec}`) || x.where.includes(`#${c.sec} `) || x.where.includes(`#${c.sec}.`)));
    if (!hit) warn('unbacked', true, { decision: d.text.slice(0, 110), line: d.line, why: `lane ${c.lane} §${c.sec}: no extracted claim` });
  }
}
// contradiction (v1): same question, verdicts differ
for (const q of QUESTIONS) {
  const vs = new Set(claims.filter((c) => c.q === q.id && c.verdict).map((c) => c.verdict));
  if (vs.size > 1) warn('contradiction', true, { q: q.id, verdicts: [...vs], claims: claims.filter((c) => c.q === q.id && c.verdict).length });
}
// contradiction by `about` (extension): same subject, different count, across lanes
{
  const byAbout = new Map();
  for (const c of claims) for (const k of c.counts) {
    if (!k.about) continue;
    if (!byAbout.has(k.about)) byAbout.set(k.about, []);
    byAbout.get(k.about).push({ id: c.id, lane: c.run, value: k.value });
  }
  for (const [about, list] of byAbout) {
    const lanes = new Set(list.map((x) => x.lane));
    const values = new Set(list.map((x) => x.value));
    if (lanes.size > 1 && values.size > 1) warn('contradiction-about', false, { about, values: [...values].slice(0, 8), lanes: [...lanes] });
  }
}
// where-missing (extension): a claim points at a § its file does not have
for (const c of claims) {
  if (!c.pointer) continue;
  const lane = Number(c.run.slice(6));
  const nums = headingNumbers(lane);
  const top = c.pointer.split('.')[0];
  if (!nums.has(c.pointer) && !nums.has(top)) warn('where-missing', false, { claim: c.id, where: c.where, says: c.says.slice(0, 90) });
}
// source-missing (v1): each path:line at the pin
const tracked = git('ls-tree', '-r', '--name-only', PIN).split('\n');
const lenCache = new Map();
const srcStats = { verified: 0, lineOutOfRange: 0, ignoredOrUntracked: 0, ambiguous: 0, missing: 0 };
for (const c of claims) for (const s of c.src) {
  const [p, ln] = [s.slice(0, s.lastIndexOf(':')), Number(s.slice(s.lastIndexOf(':') + 1))];
  let path = tracked.includes(p) ? p : null;
  if (!path) {
    const cands = tracked.filter((t) => t.endsWith('/' + p));
    if (cands.length === 1) path = cands[0];
    else if (cands.length > 1) { srcStats.ambiguous++; continue; }
  }
  if (!path) {
    let onDisk = false;
    try { execFileSync('test', ['-e', `${RSNA}/${p}`]); onDisk = true; } catch {}
    if (onDisk) srcStats.ignoredOrUntracked++;
    else { srcStats.missing++; warn('source-missing', true, { claim: c.id, src: s, why: 'no such path at the pin or on disk' }); }
    continue;
  }
  if (!lenCache.has(path)) lenCache.set(path, git('show', `${PIN}:${path}`).split('\n').length);
  if (ln > lenCache.get(path)) { srcStats.lineOutOfRange++; warn('source-missing', true, { claim: c.id, src: s, why: `line ${ln} > ${lenCache.get(path)} lines at the pin` }); }
  else srcStats.verified++;
}
// registered-late (v1, lane level): a lane's questions not committed before its report
const firstCommit = (path) => git('log', '--format=%H %cI', '--diff-filter=A', PIN, '--', path).trim().split('\n').pop();
const briefCommit = git('log', '--format=%H %cI', '-S', 'Lane 9 — above the plateau', PIN, '--', 'pm/tasks', 'deaddrop/tasks').trim().split('\n').pop();
const isAncestor = (a, b) => { try { execFileSync('git', ['-C', RSNA, 'merge-base', '--is-ancestor', a, b]); return a !== b; } catch { return false; } };
for (const { lane, file } of LANES) {
  const rep = firstCommit(REPO_PATH(file));
  const qc = QUESTIONS.find((q) => q.lane === lane && !q.unbriefed) ? briefCommit : rep;
  if (!isAncestor(qc.split(' ')[0], rep.split(' ')[0])) warn('registered-late', true, { lane, questionsAt: qc, reportAt: rep });
}
// reopened-settled (v1): normalised text equal to a settled question
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
for (const q of QUESTIONS) if (SETTLED.some((s) => norm(s) === norm(q.ask))) warn('reopened-settled', true, { q: q.id });

// ---- Output
writeFileSync(`${DIR}ledger.jsonl`, [
  ...QUESTIONS.map((q) => JSON.stringify({ kind: 'question', ...q })),
  ...SETTLED.map((s, i) => JSON.stringify({ kind: 'question', id: `S${i + 1}`, ask: s, settled: true })),
  ...claims.map((c) => JSON.stringify(c)),
  ...decisions.map((d, i) => JSON.stringify({ kind: 'decision', id: `d${i + 1}`, line: d.line, sec: d.sec, cites: d.cites, text: d.text.slice(0, 240) })),
].join('\n') + '\n');
writeFileSync(`${DIR}warnings.json`, JSON.stringify(W, null, 1));
const byCode = {};
for (const w of W) byCode[w.code] = (byCode[w.code] || 0) + 1;
console.log(JSON.stringify({
  questions: QUESTIONS.length, claims: claims.length,
  claimsPerLane: Object.fromEntries(LANES.map(({ lane }) => [lane, claims.filter((c) => c.run === `orch.l${lane}`).length])),
  claimsPerQuestion: Object.fromEntries(QUESTIONS.map((q) => [q.id, claims.filter((c) => c.q === q.id).length])),
  unmarked: claims.filter((c) => !c.mark).length, withVerdict: claims.filter((c) => c.verdict).length,
  decisions: decisions.length, sources: srcStats, warnings: byCode,
}, null, 1));
