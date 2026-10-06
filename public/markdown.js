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
// inside a link's target.
function textWithLinks(text) {
  let html = '';
  let last = 0;
  for (const match of text.matchAll(LINK)) {
    html += emphasis(text.slice(last, match.index));
    const [, label, href] = match;
    html += SAFE_LINK.test(href) ? `<a href="${escape(href)}" target="_blank" rel="noopener noreferrer">${emphasis(label)}</a>` : emphasis(label);
    last = match.index + match[0].length;
  }
  return html + emphasis(text.slice(last));
}

// Inline markup over one line of text that is not yet escaped. Code spans are
// cut out first so nothing inside them is read as emphasis or links.
export function inline(text) {
  const line = String(text);
  if (line.length > MAX_INLINE) return escape(line);
  return line.split(/(`+[^`]*?`+)/).map((part, index) => (index % 2 ? `<code>${escape(part.replace(/^`+|`+$/g, ''))}</code>` : textWithLinks(part))).join('');
}

const LIST_ITEM = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;

function listHtml(lines) {
  // Each item: its indent, ordered or not, and its text. Deeper indents nest.
  const items = lines.map((line) => {
    const [, indent, marker, text] = LIST_ITEM.exec(line);
    return { depth: indent.replace(/\t/g, '  ').length, ordered: /\d/.test(marker), text };
  });
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
    const box = /^\[([ xX])\]\s+(.*)$/.exec(item.text);
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

export function renderMarkdown(source, { shift = 2, depth = 0 } = {}) {
  const lines = String(source ?? '').replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  let paragraph = [];
  const flush = () => { if (paragraph.length) out.push(`<p>${paragraph.map(inline).join('<br>')}</p>`); paragraph = []; };
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const fence = /^\s*(```|~~~)/.exec(line);
    if (fence) {
      flush();
      const code = [];
      for (index += 1; index < lines.length && !lines[index].trim().startsWith(fence[1]); index += 1) code.push(lines[index]);
      out.push(`<pre><code>${escape(code.join('\n'))}</code></pre>`);
      continue;
    }
    if (!line.trim()) { flush(); continue; }
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      flush();
      const level = Math.min(6, heading[1].length + shift);
      // A closing run of #s is decoration (`## Plan ##`).
      const words = heading[2].trimEnd();
      const closed = words.replace(/#+$/, '');
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
        // A wrapped line belongs to the item above it.
        if (LIST_ITEM.test(lines[index])) items.push(lines[index]); else items[items.length - 1] += ` ${lines[index].trim()}`;
      }
      index -= 1;
      out.push(listHtml(items));
      continue;
    }
    if (line.includes('|') && (lines[index + 1] || '').includes('|') && /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/.test(lines[index + 1] || '')) {
      flush();
      const rows = [line, lines[index + 1]];
      for (index += 2; index < lines.length && lines[index].includes('|') && lines[index].trim(); index += 1) rows.push(lines[index]);
      index -= 1;
      out.push(tableHtml(rows));
      continue;
    }
    paragraph.push(line.trim());
  }
  flush();
  return out.join('');
}
