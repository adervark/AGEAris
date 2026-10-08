import assert from 'node:assert/strict';
import test from 'node:test';

import { inline, renderMarkdown } from '../public/markdown.js';

// Task files and board documents are written by agents, so the renderer must
// never pass markup through.

test('markdown escapes raw HTML everywhere: text, headings, list items, tables, quotes, and code', () => {
  const html = renderMarkdown('# <img src=x onerror=alert(1)>\n\n<script>alert(1)</script>\n\n- <b>item</b>\n\n> <i>quote</i>\n\n| <a> | b |\n|---|---|\n| <x> | 2 |\n\n```\n<html>\n```\n\n`<code>`');
  assert.doesNotMatch(html, /<(script|img|b|i|a|x|html)[\s>]/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(html, /<pre><code>&lt;html&gt;<\/code><\/pre>/);
});

test('links keep only http(s) and mailto targets, open in a new tab without a referrer, and other targets show as text', () => {
  assert.equal(inline('[docs](https://example.org/a?b=1&c=2)'), '<a href="https://example.org/a?b=1&amp;c=2" target="_blank" rel="noopener noreferrer">docs</a>');
  assert.equal(inline('[mail](mailto:a@example.org)'), '<a href="mailto:a@example.org" target="_blank" rel="noopener noreferrer">mail</a>');
  for (const target of ['javascript:alert(1)', 'data:text/html,x', 'vbscript:x', 'AA/tasks/T001.md', '//evil.example']) {
    assert.doesNotMatch(inline(`[x](${target})`), /<a /, target);
  }
});

test('headings shift under the page\'s own, and lists, task boxes, emphasis, and tables render', () => {
  assert.equal(renderMarkdown('# Why\n## Plan'), '<h3>Why</h3><h4>Plan</h4>');
  assert.equal(renderMarkdown('# Why', { shift: 0 }), '<h1>Why</h1>');
  assert.equal(renderMarkdown('- one\n  - two\n- [x] done\n- [ ] open\n1. first'), '<ul><li>one<ul><li>two</li></ul></li><li><input type="checkbox" disabled checked aria-label="Done">done</li><li><input type="checkbox" disabled  aria-label="Not done">open</li></ul><ol><li>first</li></ol>');
  assert.equal(inline('**bold**, *it*, ~~old~~, snake_case_name'), '<strong>bold</strong>, <em>it</em>, <del>old</del>, snake_case_name');
  assert.equal(renderMarkdown('| a | b |\n|---|:-:|\n| 1 | **2** |'), '<table><thead><tr><th scope="col">a</th><th scope="col">b</th></tr></thead><tbody><tr><td>1</td><td><strong>2</strong></td></tr></tbody></table>');
  // A line break inside a paragraph is a space, as in any Markdown viewer;
  // two trailing spaces or a backslash keep it.
  assert.equal(renderMarkdown('one\ntwo\n\nthree'), '<p>one two</p><p>three</p>');
  assert.equal(renderMarkdown('one  \ntwo\\\nthree'), '<p>one<br>two<br>three</p>');
  // A backslash breaks the line only when it is not escaped and a line follows.
  assert.equal(renderMarkdown('Install to C:\\Program Files\\'), '<p>Install to C:\\Program Files\\</p>');
  assert.equal(renderMarkdown('foo\\ \nbar'), '<p>foo\\ bar</p>');
  assert.equal(renderMarkdown('foo\\\\\nbar'), '<p>foo\\\\ bar</p>');
  // Emphasis and code may wrap across lines.
  assert.equal(renderMarkdown('the join is **not\nindex-bound**, see `a\nb`'), '<p>the join is <strong>not index-bound</strong>, see <code>a b</code></p>');
  // Lines indented four spaces are code, unless they continue a paragraph or
  // follow a list.
  assert.equal(renderMarkdown('Log:\n\n    baseline  GET /a -> 404\n    now       GET /a\\x00 -> 404\n\nAfter.'), '<p>Log:</p><pre><code>baseline  GET /a -&gt; 404\nnow       GET /a\\x00 -&gt; 404</code></pre><p>After.</p>');
  assert.equal(renderMarkdown('one\n    two'), '<p>one two</p>');
  assert.equal(renderMarkdown('- item\n\n    more'), '<ul><li>item</li></ul><p>more</p>');
  assert.equal(renderMarkdown('1. Step one.\n\n    Explanation.\n\n    More explanation.'), '<ol><li>Step one.</li></ol><p>Explanation.</p><p>More explanation.</p>');
  assert.equal(renderMarkdown('- item\n\ntext\n\n    code'), '<ul><li>item</li></ul><p>text</p><pre><code>code</code></pre>');
  // A line end inside a code span is a space, whatever ends the line.
  assert.equal(renderMarkdown('Use `C:\\\nfoo` here'), '<p>Use <code>C:\\ foo</code> here</p>');
  // A stray backtick opens no span, so later breaks still hold.
  assert.equal(renderMarkdown('don`t stop\\\nnext\\\nthird'), '<p>don`t stop<br>next<br>third</p>');
  // Any indent keeps a paragraph inside the list, not only four spaces.
  assert.equal(renderMarkdown('1. Step\n\n   Para A\n\n    Para B'), '<ol><li>Step</li></ol><p>Para A</p><p>Para B</p>');
});

test('hostile input stays fast and bounded: long headings, link runs, emphasis runs, and deep quotes', () => {
  const timed = (label, source) => {
    const start = performance.now();
    const html = renderMarkdown(source);
    assert.ok(performance.now() - start < 250, `${label} took ${Math.round(performance.now() - start)} ms`);
    return html;
  };
  timed('a heading of spaces and hashes', `# a${' '.repeat(4000)}#${' '.repeat(4000)}x`);
  timed('a 240 KB run of link openers', '[a]('.repeat(60000));
  timed('an emphasis run', '**a'.repeat(1300));
  assert.match(timed('6,000 quote markers', `${'>'.repeat(6000)} x`), /^(<blockquote>){8}<p>&gt;/, 'quotes nest at most 8 deep; the rest is text');
});

test('emphasis never reaches inside a link target, and a closing run of #s is dropped from a heading', () => {
  assert.equal(inline('[a](https://x.com/a_b_c) x_ y'), '<a href="https://x.com/a_b_c" target="_blank" rel="noopener noreferrer">a</a> x_ y');
  assert.equal(inline('[**bold** label](https://x.com/**)'), '<a href="https://x.com/**" target="_blank" rel="noopener noreferrer"><strong>bold</strong> label</a>');
  assert.equal(renderMarkdown('## Plan ##\n# C#'), '<h4>Plan</h4><h3>C#</h3>');
});

test('a wrapped list line holding a line or paragraph separator renders instead of throwing (T008)', () => {
  assert.equal(renderMarkdown('- a\n  b\u2028c'), '<ul><li>a b\u2028c</li></ul>');
  assert.equal(renderMarkdown('1. a\n   b\u2029c'), '<ol><li>a b\u2029c</li></ol>');
});

test('a block indented less than the last item\'s content column ends the list\'s hold, as in CommonMark (T010)', () => {
  assert.equal(renderMarkdown('- item\n\n text\n\n    code'), '<ul><li>item</li></ul><p>text</p><pre><code>code</code></pre>');
  assert.equal(renderMarkdown('1. Step\n\n  Para A\n\n    Para B'), '<ol><li>Step</li></ol><p>Para A</p><pre><code>Para B</code></pre>');
  assert.equal(renderMarkdown('- item\n\n ---\n\n    code'), '<ul><li>item</li></ul><hr><pre><code>code</code></pre>');
  assert.equal(renderMarkdown('-   item\n\n  text\n\n    code'), '<ul><li>item</li></ul><p>text</p><pre><code>code</code></pre>');
  // U+00A0 is not indentation.
  assert.match(renderMarkdown('- item\n\n\u00a0text\n\n    code'), /<pre><code>code<\/code><\/pre>$/);
  // Indented to the content column, a block still continues the item.
  assert.equal(renderMarkdown('1. Step\n\n   Para A\n\n    Para B'), '<ol><li>Step</li></ol><p>Para A</p><p>Para B</p>');
});

test('bold and links may hold inline code, and code stays literal (T002)', () => {
  assert.equal(inline('**see `x`**'), '<strong>see <code>x</code></strong>');
  assert.equal(inline('[the `y` docs](https://example.com)'), '<a href="https://example.com" target="_blank" rel="noopener noreferrer">the <code>y</code> docs</a>');
  assert.equal(inline('`**not bold**` and `[not](https://a.b)`'), '<code>**not bold**</code> and <code>[not](https://a.b)</code>');
  assert.equal(inline('*a `b*c` d*'), '<em>a <code>b*c</code> d</em>');
  // Text that already holds a span mark keeps the old reading, and forges nothing.
  assert.equal(inline('\uE0000\uE001 `x` **y**'), '\uE0000\uE001 <code>x</code> <strong>y</strong>');
});

test('block patterns take linear time on one long line (T009)', () => {
  const n = 80000;
  for (const [name, text] of Object.entries({
    'a closing run of #s': `# ${'#'.repeat(n)}x`,
    'a heading of spaces before a line separator': `# ${' '.repeat(n)}a\u2028b`,
    'a list item of spaces before a line separator': `- ${' '.repeat(n)}a\u2028b`,
    'a task box of spaces before a line separator': `- [ ] ${' '.repeat(n)}a\u2028b`,
    'a table separator of spaces': `a|b\n${' '.repeat(n)}x|`,
    'a table separator after dashes': `a|b\n|---${' '.repeat(n)}x|`,
  })) {
    const start = performance.now();
    renderMarkdown(text);
    assert.ok(performance.now() - start < 100, `${name}: ${(performance.now() - start).toFixed(0)} ms`);
  }
  // The same lines still read as before.
  assert.equal(renderMarkdown('## Plan ##'), '<h4>Plan</h4>');
  assert.equal(renderMarkdown('## C#'), '<h4>C#</h4>');
  assert.equal(renderMarkdown('| a | b |\n| :-- | --: |\n| 1 | 2 |'), '<table><thead><tr><th scope="col">a</th><th scope="col">b</th></tr></thead><tbody><tr><td>1</td><td>2</td></tr></tbody></table>');
  assert.equal(renderMarkdown('a | b\n--- | x\nc | d'), '<p>a | b --- | x c | d</p>');
});

test('a paragraph too long to read as one stretch keeps every line\'s hard break (T014)', () => {
  const html = renderMarkdown(`don\`t  \n${'x'.repeat(2100)}  \n${'x'.repeat(2100)}  \nwon\`t`);
  assert.equal(html.match(/<br>/g)?.length, 3);
  assert.doesNotMatch(html, /<code>/);
});

test('a backtick run closes only on a run of the same length, and an opener without one is text (T015)', () => {
  assert.equal(renderMarkdown('don``t stop'), '<p>don``t stop</p>');
  assert.equal(inline('``a`b``'), '<code>a`b</code>');
  assert.equal(inline('``a` b'), '``a` b');
  assert.equal(inline('`a`` b` c'), '<code>a`` b</code> c');
  assert.equal(inline('```x``` and `y`'), '<code>x</code> and <code>y</code>');
  // The same spans decide line breaks: an unclosed run does not hold a break.
  assert.equal(renderMarkdown('one ``two  \nthree'), '<p>one ``two<br>three</p>');
});
