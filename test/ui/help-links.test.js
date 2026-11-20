// Help & Support is one page with three tabs. Its links into Help topics are
// `href="#id"` anchors (and `data-jump-to` cards) that the dialog's script turns
// into "switch to the Help tab and scroll there"; a link whose topic was renamed
// or removed does nothing at all, silently. About → New in 2.0 links into Help
// (Coming from version 1.0, Keyboard shortcuts), so it is pinned
// here with every other link.

const test = require('node:test');
const assert = require('node:assert/strict');

const { readAppScriptFile } = require('./test-utils');

const html = readAppScriptFile('help-modal.html');
const ids = new Set(Array.from(html.matchAll(/\bid="([^"]+)"/g), (m) => m[1]));

test('every link inside Help lands on a topic that exists', () => {
  const targets = [
    ...Array.from(html.matchAll(/href="#([^"]+)"/g), (m) => m[1]),
    ...Array.from(html.matchAll(/data-jump-to="([^"]+)"/g), (m) => m[1]),
  ];
  assert.ok(targets.length > 0, 'no in-Help links found');
  const missing = targets.filter((id) => !ids.has(id));
  assert.deepEqual(missing, [], `links to missing topics: ${missing.join(', ')}`);
});

test('About → New in 2.0 tags every item and says where to find it', () => {
  const start = html.indexOf('id="whats-new"');
  assert.ok(start !== -1, 'About has no #whats-new section');
  const section = html.slice(start, html.indexOf('</section>', start));

  assert.match(section, /href="#coming-from-sefaria"/, 'it points readers from Sefaria for Google Docs to their Help topic');

  const items = Array.from(section.matchAll(/<li>([\s\S]*?)<\/li>/g), (m) => m[1]);
  assert.ok(items.length >= 50, `only ${items.length} items`);
  items.forEach((item) => {
    const tags = item.match(/class="tag tag-(new|improved)"/g) || [];
    assert.equal(tags.length, 1, `one New or Improved tag per item: ${item.slice(0, 80)}`);
    assert.match(item, /<span class="where">[^<]/, `no "where to find it" line: ${item.slice(0, 80)}`);
  });
});
