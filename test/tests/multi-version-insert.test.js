const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

// Pins the multi-translation insert (`insertReferenceVersions`): one title per
// block, a blank paragraph between blocks and after the last one, and no block
// for a translation that has no text on the ref. See docs/regression-log.md.

function fakeParagraph(initial) {
  const p = { text: initial || '', link: null, attrs: {} };
  const textApi = {
    editAsText() { return textApi; },
    getText() { return p.text; },
    insertText(offset, t) { p.text = p.text.slice(0, offset) + t + p.text.slice(offset); return textApi; },
    setBold() { return textApi; },
    setItalic() { return textApi; },
    setUnderline() { return textApi; },
    setFontFamily() { return textApi; },
    setFontSize() { return textApi; },
    setForegroundColor() { return textApi; },
    setBackgroundColor() { return textApi; },
    setLinkUrl(url) { p.link = url; return textApi; },
    getTextAttributeIndices() { return [0]; },
    isBold() { return false; },
    isItalic() { return false; },
  };
  const para = {
    editAsText() { return textApi; },
    asParagraph() { return para; },
    setText(t) { p.text = t; return para; },
    setAttributes(a) { Object.assign(p.attrs, a); return para; },
    setLeftToRight() { return para; },
    _state: p,
  };
  return para;
}

function loadInsertion({ resolved }) {
  const children = [];
  const body = {
    getNumChildren() { return children.length; },
    getChild(i) { return children[i]; },
    insertParagraph(i, text) { const p = fakeParagraph(text); children.splice(i, 0, p); return p; },
  };
  const context = {
    console,
    Logger: { log() {} },
    HtmlService: {},
    DocumentApp: {
      Attribute: new Proxy({}, { get: (_, k) => String(k) }),
      getActiveDocument() { return { getBody: () => body, getCursor: () => null }; },
    },
    PropertiesService: { getUserProperties() { return { getProperty() { return null; } }; } },
    findReference(ref, versions) { return resolved[versions.en] || null; },
    getTypographySettings() { return { roles: {} }; },
    formatDataForPesukim(d) { return d; },
    getEnglishAttributionLines(d) { return ['Translation: ' + d.versionTitle]; },
  };
  vm.createContext(context);
  for (const file of ['apps-script/server/utils.gs', 'apps-script/server/insertion.gs']) {
    vm.runInContext(fs.readFileSync(file, 'utf8'), context, { filename: file });
  }
  const texts = () => children.map((c) => c._state.text);
  return { ctx: context, children, texts };
}

const resolved = {
  'Koren': { ref: 'Genesis 1:1', heRef: 'בראשית א:א', versionTitle: 'Koren', text: 'In the beginning', he: 'בְּרֵאשִׁית' },
  'JPS': { ref: 'Genesis 1:1', heRef: 'בראשית א:א', versionTitle: 'JPS', text: 'When God began', he: 'בְּרֵאשִׁית' },
  // Resolves, but the translation has nothing for this ref.
  'Empty': { ref: 'Genesis 1:1', heRef: 'בראשית א:א', versionTitle: 'Empty', text: ['', '&nbsp;'], he: 'בְּרֵאשִׁית' },
  // Sefaria substituted its default version for the one requested.
  'Missing': { ref: 'Genesis 1:1', heRef: 'בראשית א:א', versionTitle: 'Koren', text: 'In the beginning', he: 'בְּרֵאשִׁית' },
};

test('linked multi-version titles name the version once', () => {
  const { ctx, texts } = loadInsertion({ resolved });
  ctx.insertReferenceVersions('Genesis 1:1', {
    versionTitles: ['Koren', 'JPS'], singleLanguage: 'en', insertSefariaLink: true,
  });
  const titles = texts().filter((t) => t.startsWith('Genesis'));
  assert.deepEqual(titles, [
    'Genesis 1:1 (Translation • Koren)',
    'Genesis 1:1 (Translation • JPS)',
  ]);
});

test('each linked title opens its own translation on sefaria.org', () => {
  const { ctx, children } = loadInsertion({ resolved });
  ctx.insertReferenceVersions('Genesis 1:1', {
    versionTitles: ['Koren', 'JPS'], singleLanguage: 'en', insertSefariaLink: true,
  });
  const links = children.map((c) => c._state.link).filter(Boolean);
  assert.deepEqual(links, [
    'https://www.sefaria.org/Genesis_1%3A1?ven=Koren',
    'https://www.sefaria.org/Genesis_1%3A1?ven=JPS',
  ]);
});

test('unlinked multi-version titles still carry the version suffix', () => {
  const { ctx, texts } = loadInsertion({ resolved });
  ctx.insertReferenceVersions('Genesis 1:1', { versionTitles: ['Koren', 'JPS'], singleLanguage: 'en' });
  assert.deepEqual(texts().filter((t) => t.startsWith('Genesis')), ['Genesis 1:1 (Koren)', 'Genesis 1:1 (JPS)']);
});

test('blocks are separated by a blank paragraph, including after the last citation', () => {
  const { ctx, texts } = loadInsertion({ resolved });
  ctx.insertReferenceVersions('Genesis 1:1', {
    versionTitles: ['Koren', 'JPS'], singleLanguage: 'en', includeTranslationSourceInfo: true,
  });
  assert.deepEqual(texts(), [
    'Genesis 1:1 (Koren)', 'In the beginning', 'Translation: Koren',
    '',
    'Genesis 1:1 (JPS)', 'When God began', 'Translation: JPS',
    '',
  ]);
});

test('he-top inserts the Hebrew once, then separated translation blocks', () => {
  const { ctx, texts } = loadInsertion({ resolved });
  ctx.insertReferenceVersions('Genesis 1:1', { versionTitles: ['Koren', 'JPS'], bilingualLayout: 'he-top' });
  assert.deepEqual(texts(), [
    'בראשית א:א', 'בְּרֵאשִׁית',
    'Genesis 1:1 (Koren)', 'In the beginning',
    '',
    'Genesis 1:1 (JPS)', 'When God began',
    '',
  ]);
});

test('empty and substituted translations are skipped and reported, not inserted', () => {
  const { ctx, texts } = loadInsertion({ resolved });
  const result = ctx.insertReferenceVersions('Genesis 1:1', {
    versionTitles: ['Koren', 'Empty', 'Missing', 'JPS', 'Koren'], singleLanguage: 'en',
  });
  assert.deepEqual([...result.inserted], ['Koren', 'JPS']);
  assert.deepEqual([...result.skipped], ['Empty', 'Missing']);
  assert.equal(texts().filter((t) => t === 'In the beginning').length, 1, 'Koren must appear exactly once');
});

test('a request where every translation is empty fails instead of inserting nothing', () => {
  const { ctx, children } = loadInsertion({ resolved });
  assert.throws(
    () => ctx.insertReferenceVersions('Genesis 1:1', { versionTitles: ['Empty', 'Missing'], singleLanguage: 'en' }),
    /no.*text|None of the selected/i
  );
  assert.equal(children.length, 0);
});

test('decodeHTMLEntities handles the typographic spaces Sefaria puts in Hebrew', () => {
  const { ctx } = loadInsertion({ resolved });
  assert.equal(ctx.decodeHTMLEntities('אָמַר&thinsp;רַבִּי'), 'אָמַר רַבִּי');
  assert.equal(ctx.decodeHTMLEntities('a&amp;thinsp;b'), 'a b');
  assert.equal(ctx.decodeHTMLEntities('a&ensp;b&emsp;c&hairsp;d'), 'a b c d');
  assert.equal(ctx.decodeHTMLEntities('x&nbsp;y&#160;z'), 'x y z');
  assert.equal(ctx.decodeHTMLEntities('&rlm;&lrm;&zwj;'), '‏‎‍');
});

test('decodeHTMLEntities decodes each entity exactly once', () => {
  const { ctx } = loadInsertion({ resolved });
  assert.equal(ctx.decodeHTMLEntities('a &amp;lt; b'), 'a &lt; b');
  assert.equal(ctx.decodeHTMLEntities('&#x5D0;&#1489;'), 'אב');
  assert.equal(ctx.decodeHTMLEntities('&unknownentity; stays'), '&unknownentity; stays');
});

test('inserted Hebrew body carries no literal &thinsp;', () => {
  const { ctx, texts } = loadInsertion({
    resolved: { 'Koren': Object.assign({}, resolved.Koren, { he: '<b>אָמַר</b>&thinsp;רַבִּי' }) },
  });
  ctx.insertReferenceVersions('Genesis 1:1', { versionTitles: ['Koren'], bilingualLayout: 'he-top' });
  assert.ok(!texts().some((t) => t.includes('&thinsp;')), texts().join(' | '));
});
