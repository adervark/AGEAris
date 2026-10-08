// Task files and a board's own documents, rendered read-only. Agents write
// these files, so the text is escaped before anything else and only a small
// grammar is turned back into markup: headings, paragraphs, lists (with task
// boxes), quotes, rules, fenced code, pipe tables, and inline code, emphasis,
// strike-through and links. Links keep only http(s) and mailto targets; any
// other target shows as its text. No raw HTML survives.

import { escape } from './words.js';

const SAFE_LINK = /^(https?:\/\/|mailto:)/i;
// Agents write these files, so every pattern is bounded: a line past this
// length is shown as escaped text, without inline markup.
const MAX_INLINE = 4000;
const LINK = /\[([^\[\]\n]{1,500})\]\(([^()\s]{1,2048})(?:\s+"[^"\n]{0,200}")?\)/g;

function emphasis(text) {
  let html = escape(text);
  html = html.replace(/\*\*(?=\S)([^*]{1,500}?)\*\*/g, '<strong>$1</strong>').replace(/__(?=\S)([^_]{1,500}?)__/g, '<strong>$1</strong>');
  html = html.replace(/(^|[^*\w])\*(?=\S)([^*]{1,500}?)\*(?!\w)/g, '$1<em>$2</em>').replace(/(^|[^_\w])_(?=\S)([^_]{1,500}?)_(?!\w)/g, '$1<em>$2</em>');
  return html.replace(/~~(?=\S)([^~]{1,500}?)~~/g, '<del>$1</del>');
}

// Plain text with links: links are cut out first, so emphasis never reaches
// inside a link's target. A target holding a code span is no link.
function textWithLinks(text) {
  let html = '';
  let last = 0;
  for (const match of text.matchAll(LINK)) {
    html += emphasis(text.slice(last, match.index));
    const [, label, href] = match;
    html += SAFE_LINK.test(href) && !href.includes(SPAN_OPEN) ? `<a href="${escape(href)}" target="_blank" rel="noopener noreferrer">${emphasis(label)}</a>` : emphasis(label);
    last = match.index + match[0].length;
  }
  return html + emphasis(text.slice(last));
}

// Code spans stand in the text as these private-use marks around their index
// while emphasis and links are read, so bold or a link can hold a span and
// nothing inside a span is read as markup.
const SPAN_OPEN = '\uE000';
const SPAN_CLOSE = '\uE001';

function codeSpan(part) {
  let open = 0;
  while (open < part.length && part[open] === '`') open += 1;
  let close = 0;
  while (close < part.length - open && part[part.length - 1 - close] === '`') close += 1;
  return `<code>${escape(part.slice(open, part.length - close))}</code>`;
}

// Inline markup over one line of text that is not yet escaped.
export function inline(text) {
  const line = String(text);
  if (line.length > MAX_INLINE) return escape(line);
  const parts = line.split(/(`+[^`]*?`+)/);
  // Text that already holds a mark keeps the spans apart, as markup cannot be
  // told from a forged mark.
  if (line.includes(SPAN_OPEN)) return parts.map((part, index) => (index % 2 ? codeSpan(part) : textWithLinks(part))).join('');
  const spans = [];
  const marked = parts.map((part, index) => {
    if (!(index % 2)) return part;
    spans.push(codeSpan(part));
    return `${SPAN_OPEN}${spans.length - 1}${SPAN_CLOSE}`;
  }).join('');
  if (!spans.length) return textWithLinks(line);
  let html = '';
  const rendered = textWithLinks(marked);
  let at = 0;
  for (let open = rendered.indexOf(SPAN_OPEN); open >= 0; open = rendered.indexOf(SPAN_OPEN, at)) {
    const close = rendered.indexOf(SPAN_CLOSE, open);
    html += rendered.slice(at, open) + spans[Number(rendered.slice(open + 1, close))];
    at = close + 1;
  }
  return html + rendered.slice(at);
}

// `[^]*` and no `$`: `.` stops at U+2028, and with `$` after it a long run of
// spaces before one would be retried from every split.
const LIST_ITEM = /^(\s*)([-*+]|\d+[.)])\s+([^]*)/;

// A list item, parsed once when it is collected: its indent, ordered or not,
// its text, and its content column (CommonMark's: the marker's indent, plus its
// width, plus the 1 to 4 spaces after it; with more, just one).
function listItem(match, line) {
  const [, indent, marker, text] = match;
  const start = indent.length + marker.length;
  let gap = 0;
  while (start + gap < line.length && line[start + gap] === ' ') gap += 1;
  return { depth: indent.replace(/\t/g, '  ').length, ordered: /\d/.test(marker), text, column: columns(indent) + marker.length + (gap >= 1 && gap <= 4 ? gap : 1) };
}

// How far a line's leading spaces and tabs reach, tabs stopping every 4
// columns. Other white space, U+00A0 among them, is not indentation.
function columns(line) {
  let column = 0;
  for (const char of line) {
    if (char === ' ') column += 1;
    else if (char === '\t') column += 4 - (column % 4);
    else break;
  }
  return column;
}

function listHtml(items) {
  // Deeper indents nest.
  let html = '';
  const stack = [];
  for (const item of items) {
    const tag = item.ordered ? 'ol' : 'ul';
    while (stack.length && item.depth < stack.at(-1).depth) html += `</li></${stack.pop().tag}>`;
    // A numbered list right after a bulleted one at the same depth is a new list.
    if (stack.length && item.depth === stack.at(-1).depth && stack.at(-1).tag !== tag) html += `</li></${stack.pop().tag}>`;
    if (!stack.length || item.depth > stack.at(-1).depth) {
      stack.push({ depth: item.depth, tag });
      html += `<${tag}><li>`;
    } else html += '</li><li>';
    const box = /^\[([ xX])\]\s+([^]*)/.exec(item.text);
    html += box ? `<input type="checkbox" disabled ${box[1] === ' ' ? '' : 'checked'} aria-label="${box[1] === ' ' ? 'Not done' : 'Done'}">${inline(box[2])}` : inline(item.text);
  }
  while (stack.length) html += `</li></${stack.pop().tag}>`;
  return html;
}

function tableHtml(lines) {
  const cells = (line) => line.trim().replace(/^\||\|$/g, '').split('|').map((cell) => cell.trim());
  const [head, , ...body] = lines;
  return `<table><thead><tr>${cells(head).map((cell) => `<th scope="col">${inline(cell)}</th>`).join('')}</tr></thead><tbody>${body.map((line) => `<tr>${cells(line).map((cell) => `<td>${inline(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}

// `shift` lowers every heading so a document's # sits under the page's own
// headings: in the drawer, # renders as h3.
// Quotes nest at most this deep; deeper markers are text.
const MAX_QUOTE_DEPTH = 8;
// Outside a paragraph, a line indented four spaces or a tab is code.
const INDENTED = /^( {4}|\t)/;

// A table's separator row: cells of dashes, each with an optional colon at
// either end, between optional outer pipes. Read cell by cell, not by a
// pattern, which would retry a long line from every split.
function tableSeparator(line) {
  let row = line.trim();
  if (row.startsWith('|')) row = row.slice(1);
  if (row.endsWith('|')) row = row.slice(0, -1);
  return row.split('|').every((raw) => {
    let cell = raw.trim();
    if (cell.startsWith(':')) cell = cell.slice(1);
    if (cell.endsWith(':')) cell = cell.slice(0, -1);
    return cell.length > 0 && [...cell].every((char) => char === '-');
  });
}

// A line that ends in a backslash, itself not escaped, breaks the line. The
// run is counted by hand: a pattern anchored at the end would backtrack.
function trailingBackslash(line) {
  let run = 0;
  while (run < line.length && line[line.length - 1 - run] === '\\') run += 1;
  return run % 2 === 1;
}

export function renderMarkdown(source, { shift = 2, depth = 0 } = {}) {
  const lines = String(source ?? '').replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  let paragraph = [];
  // A paragraph's lines join as Markdown reads them: a line break is a space,
  // unless the line ends in two spaces or a backslash, another line follows,
  // and the line end is not inside a code span (found as `inline` finds them).
  // Inline markup runs over each stretch between breaks, so emphasis, code and
  // links may wrap; a stretch longer than MAX_INLINE is read line by line.
  const flush = () => {
    if (!paragraph.length) return;
    // Where each line ends in the joined text, and which ends fall inside a
    // span. Spans and ends both run left to right, so one pass finds them.
    const joined = paragraph.map(({ text }) => text).join('\n');
    const ends = [];
    for (const { text } of paragraph) ends.push((ends.at(-1) ?? -1) + text.length + 1);
    const inSpan = new Set();
    let next = 0;
    for (const span of joined.matchAll(/`+[^`]*?`+/g)) {
      while (next < ends.length && ends[next] < span.index) next += 1;
      while (next < ends.length && ends[next] < span.index + span[0].length) inSpan.add(next++);
    }
    const stretches = [[]];
    paragraph.forEach(({ text, hard, slash }, at) => {
      const breaks = hard && at < paragraph.length - 1 && !inSpan.has(at);
      stretches.at(-1).push(breaks && slash ? text.slice(0, -1) : text);
      if (breaks) stretches.push([]);
    });
    out.push(`<p>${stretches.map((lines) => (lines.join(' ').length <= MAX_INLINE ? inline(lines.join(' ')) : lines.map(inline).join(' '))).join('<br>')}</p>`);
    paragraph = [];
  };
  // After a list, indented paragraphs continue its last item and read as
  // text, until a block starts left of that item's content column.
  let afterList = false;
  let listColumn = 0;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!paragraph.length && line.trim() && columns(line) < listColumn) afterList = false;
    const fence = /^\s*(```|~~~)/.exec(line);
    if (fence) {
      flush();
      const code = [];
      for (index += 1; index < lines.length && !lines[index].trim().startsWith(fence[1]); index += 1) code.push(lines[index]);
      out.push(`<pre><code>${escape(code.join('\n'))}</code></pre>`);
      continue;
    }
    if (!line.trim()) { flush(); continue; }
    const heading = /^(#{1,6})\s+([^]*)/.exec(line);
    if (heading) {
      flush();
      const level = Math.min(6, heading[1].length + shift);
      // A closing run of #s is decoration (`## Plan ##`), counted by hand.
      const words = heading[2].trimEnd();
      let hashes = 0;
      while (hashes < words.length && words[words.length - 1 - hashes] === '#') hashes += 1;
      const closed = words.slice(0, words.length - hashes);
      out.push(`<h${level}>${inline((closed === words || /\s$/.test(closed) ? closed : words).trimEnd())}</h${level}>`);
      continue;
    }
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) { flush(); out.push('<hr>'); continue; }
    if (/^\s*>/.test(line) && depth < MAX_QUOTE_DEPTH) {
      flush();
      const quote = [];
      for (; index < lines.length && /^\s*>/.test(lines[index]); index += 1) quote.push(lines[index].replace(/^\s*>\s?/, ''));
      index -= 1;
      out.push(`<blockquote>${renderMarkdown(quote.join('\n'), { shift, depth: depth + 1 })}</blockquote>`);
      continue;
    }
    if (LIST_ITEM.test(line)) {
      flush();
      const items = [];
      for (; index < lines.length && (LIST_ITEM.test(lines[index]) || (/^\s{2,}\S/.test(lines[index]) && items.length)); index += 1) {
        // A wrapped line belongs to the item above it, and joins its parsed
        // text: LIST_ITEM never runs on joined text, where a line separator
        // (U+2028) would stop its `.`.
        const match = LIST_ITEM.exec(lines[index]);
        if (match) items.push(listItem(match, lines[index])); else items.at(-1).text += ` ${lines[index].trim()}`;
      }
      index -= 1;
      out.push(listHtml(items));
      // The hold is the last top-level item's content column.
      const top = Math.min(...items.map((item) => item.depth));
      listColumn = items.findLast((item) => item.depth === top).column;
      afterList = true;
      continue;
    }
    if (line.includes('|') && (lines[index + 1] || '').includes('|') && tableSeparator(lines[index + 1])) {
      flush();
      const rows = [line, lines[index + 1]];
      for (index += 2; index < lines.length && lines[index].includes('|') && lines[index].trim(); index += 1) rows.push(lines[index]);
      index -= 1;
      out.push(tableHtml(rows));
      continue;
    }
    // Indented code, except after a list, where indented lines read as text.
    if (!paragraph.length && INDENTED.test(line) && !afterList) {
      const code = [];
      for (; index < lines.length && (INDENTED.test(lines[index]) || !lines[index].trim()); index += 1) code.push(lines[index].replace(INDENTED, ''));
      while (code.length && !code.at(-1).trim()) code.pop();
      index -= 1;
      out.push(`<pre><code>${escape(code.join('\n'))}</code></pre>`);
      continue;
    }
    const slash = trailingBackslash(line);
    paragraph.push({ text: line.trim(), hard: slash || line.endsWith('  '), slash });
  }
  flush();
  return out.join('');
}
