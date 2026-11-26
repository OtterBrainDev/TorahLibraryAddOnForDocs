const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.resolve(__dirname, '../../apps-script/server/document-actions.gs'), 'utf8');

test('Unlink Sources confirms before editing and visits every tab and document section', () => {
  const removals = [];
  const alerts = [];
  let confirmed = false;
  function text(name, starts, urls) {
    const api = {
      getType: () => 'TEXT',
      asText: () => api,
      getText: () => 'abcdefghij',
      getTextAttributeIndices: () => starts,
      getLinkUrl: (start) => urls[start] || null,
      setLinkUrl(start, end, url) {
        assert.equal(url, null);
        removals.push([name, start, end]);
      }
    };
    return api;
  }
  const section = (...children) => ({
    getNumChildren: () => children.length,
    getChild: (i) => children[i]
  });
  const tab = (body, { header = null, footer = null, notes = [], children = [] } = {}) => ({
    asDocumentTab: () => ({
      getBody: () => body,
      getHeader: () => header,
      getFooter: () => footer,
      getFootnotes: () => notes.map((content) => ({ getFootnoteContents: () => content }))
    }),
    getChildTabs: () => children
  });
  const sefaria = 'https://www.sefaria.org/Genesis.1';
  const tabs = [
    tab(section(section(text('body', [0, 2, 4, 6, 8], {
      0: sefaria, 2: sefaria, 4: 'https://example.org', 6: sefaria, 8: 'https://sefaria.org.evil.test'
    }))), {
      header: section(text('header', [0], { 0: sefaria })),
      footer: section(text('footer', [0], { 0: sefaria })),
      notes: [section(text('footnote', [0], { 0: sefaria }))],
      children: [tab(section(text('child', [0], { 0: sefaria })))]
    }),
    tab(section(text('other tab', [0], { 0: 'https://sefaria.org/Psalms.1' })))
  ];
  const context = vm.createContext({
    DocumentApp: {
      ElementType: { TEXT: 'TEXT' },
      getUi: () => ({
        ButtonSet: { YES_NO: 'yes-no' }, Button: { YES: 'yes' },
        alert(...args) { alerts.push(args); return confirmed ? 'yes' : 'no'; }
      }),
      getActiveDocument() {
        assert.equal(confirmed, true);
        return { getTabs: () => tabs };
      }
    }
  });
  vm.runInContext(source, context);
  context.unlinkSefariaSources();
  assert.deepEqual(removals, []);
  assert.match(alerts[0][1], /every tab, header, footer, and footnote/);
  confirmed = true;
  context.unlinkSefariaSources();
  assert.deepEqual(removals, [
    ['body', 0, 3], ['body', 6, 7], ['header', 0, 9], ['footer', 0, 9],
    ['footnote', 0, 9], ['child', 0, 9], ['other tab', 0, 9]
  ]);
  assert.equal(alerts.at(-1)[0], 'Removed 7 Sefaria hyperlinks.');
});
