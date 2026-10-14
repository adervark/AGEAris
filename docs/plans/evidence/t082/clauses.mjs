// T082: the clause cutter, shared by sieve.mjs and R0c's tools. A document
// is cut into clauses by a linear scan: sentences, semicolon clauses, table
// cells and headings, with fenced code dropped. No judgement goes into it.

import { execFileSync } from 'node:child_process';

// Lower-cased, matched as whole words. Quantity, state, negation, comparison,
// and inference: the shapes of the twelve corrections and of T075's facts.
const CLAIM_WORDS = new Set((
  'never always only every all none no not cannot cant doesnt isnt wasnt ' +
  'arent dont didnt wont nothing nobody without ' +
  'pass passes passed fail fails failed broken wrong false true correct ' +
  'unused unregistered registered blocks block unlocks frees costs cost ' +
  'beats beat loses lose null dead killed falsified confirmed survives ' +
  'refuses refused exists missing bound upper lower faster slower more less ' +
  'fewer larger smaller higher better worse twice half double ' +
  'so therefore thus because hence means implies so-called since ' +
  'measured inferred read reproduced'
).split(' '));
const ARROWS = ['→', '⇒', '=>', '->', '×', '%', '≥', '≤', '>', '<', '~'];

export function show(repo, path, commit) {
  return execFileSync('git', ['-C', repo, 'show', `${commit}:${path}`], {
    env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' },
    encoding: 'utf8',
    maxBuffer: 64 << 20,
  });
}

// Markdown emphasis and code ticks, dropped so that a quote written without
// them still matches; whitespace collapsed. Returns the normalised text and,
// for each of its characters, the source offset it came from.
export function normalise(src) {
  let out = '', map = [], space = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (c === '*' || c === '`' || c === '_' && (src[i + 1] === '_' || src[i - 1] === '_')) continue;
    if (c === ' ' || c === '\n' || c === '\t' || c === '\r') {
      if (!space && out.length) { out += ' '; map.push(i); }
      space = true;
      continue;
    }
    space = false;
    out += c;
    map.push(i);
  }
  return { text: out, map };
}

// Blocks: paragraphs, list items, table rows, headings. Fenced code is
// dropped. Each block keeps its first line number and its source offset.
export function blocks(src) {
  const lines = src.split('\n');
  const out = [];
  let cur = null, fence = false, off = 0;
  const flush = () => { if (cur) out.push(cur); cur = null; };
  for (let n = 0; n < lines.length; n++) {
    const line = lines[n], start = off;
    off += line.length + 1;
    const t = line.trimStart();
    if (t.startsWith('```')) { flush(); fence = !fence; continue; }
    if (fence) continue;
    if (!t) { flush(); continue; }
    const head = t.startsWith('#'), row = t.startsWith('|');
    const item = t.startsWith('- ') || t.startsWith('* ') || t.startsWith('> ') ||
      (t.length > 2 && t[0] >= '0' && t[0] <= '9' && (t.indexOf('. ') > 0 && t.indexOf('. ') < 4));
    if (row && t.replaceAll('|', '').replaceAll('-', '').replaceAll(':', '').trim() === '') { flush(); continue; }
    if (head || row || item || !cur || cur.kind !== 'para') {
      flush();
      cur = { kind: head ? 'head' : row ? 'row' : 'para', line: n + 1, start, end: off - 1 };
      if (head || row) { flush(); }
      continue;
    }
    cur.end = off - 1;
  }
  flush();
  return out;
}

// Clauses: a block cut at sentence ends and at semicolons; a table row cut at
// its cells. The cut is by scanning, not by a regular expression.
export function clauses(src, block) {
  const text = src.slice(block.start, block.end);
  const cuts = [];
  let from = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i], next = text[i + 1];
    let cut = false;
    if (block.kind === 'row' && c === '|') cut = true;
    else if (c === ';') cut = true;
    else if ((c === '.' || c === '?' || c === '!') && (next === ' ' || next === '\n')) {
      const after = text.slice(i + 1).trimStart()[0] || '';
      const before = text.slice(Math.max(0, i - 4), i);
      const abbrev = before.endsWith('e.g') || before.endsWith('i.e') || before.endsWith('vs') ||
        before.endsWith('cf') || before.endsWith('etc') || before.endsWith('al');
      if (!abbrev && (after === '' || (after >= 'A' && after <= 'Z') || '*`("“[|-'.includes(after))) cut = true;
    }
    if (cut) {
      cuts.push([from, block.kind === 'row' && c === '|' ? i : i + 1]);
      from = i + 1;
    }
  }
  cuts.push([from, text.length]);
  return cuts
    .map(([a, b]) => ({ start: block.start + a, end: block.start + b }))
    .filter((c) => src.slice(c.start, c.end).replace(/[\s|*`#>.-]/g, '').length > 2);
}

export function isClaim(text) {
  if (/[0-9]/.test(text)) return 'digit';
  for (const a of ARROWS) if (text.includes(a)) return 'sign';
  const words = text.toLowerCase().replaceAll('’', '').replaceAll("'", '').split(/[^a-z-]+/);
  for (const w of words) if (CLAIM_WORDS.has(w)) return w;
  return '';
}


export function lineOf(src, off) {
  let n = 1;
  for (let i = 0; i < off && i < src.length; i++) if (src[i] === '\n') n++;
  return n;
}

// Every clause of a document, numbered from 1 in order: { n, line, kind, text, start, end }.
export function cut(src) {
  const out = [];
  let n = 0;
  for (const b of blocks(src)) for (const c of clauses(src, b)) {
    out.push({ n: ++n, line: lineOf(src, c.start), kind: b.kind, text: normalise(src.slice(c.start, c.end)).text.trim(), start: c.start, end: c.end });
  }
  return out;
}
