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
  for (const target of ['javascript:alert(1)', 'data:text/html,x', 'vbscript:x', 'deaddrop/tasks/T001.md', '//evil.example']) {
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
