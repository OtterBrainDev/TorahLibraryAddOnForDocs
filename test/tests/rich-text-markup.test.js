const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

// Pins insertion of Sefaria markup the old tag parser could not read, and
// sources that have only one language. Link Texts inserting Shulchan Arukh,
// Orach Chayim 669 threw "Cannot read properties of null (reading '1')" after
// the Hebrew heading, leaving a half-inserted source; Siddur Rashi 308 got
// "רש&quot;י" in its title and an empty "(Translation)" block. See
// docs/regression-log.md.

function fakeParagraph(initial) {
  const p = { text: initial || '', bold: [], italic: [] };
  const textApi = {
    editAsText() { return textApi; },
    getText() { return p.text; },
    insertText(offset, t) { p.text = p.text.slice(0, offset) + t + p.text.slice(offset); return textApi; },
    setBold(s, e, v) { if (v) p.bold.push(p.text.slice(s, e + 1)); return textApi; },
    setItalic(s, e, v) { if (v) p.italic.push(p.text.slice(s, e + 1)); return textApi; },
    setLinkUrl() { return textApi; },
  };
  const para = {
    editAsText() { return textApi; },
    asParagraph() { return para; },
    setAttributes() { return para; },
    setLeftToRight() { return para; },
    _state: p,
  };
  return para;
}

function load() {
  const children = [];
  const body = {
    getNumChildren() { return children.length; },
    getChild(i) { return children[i]; },
    insertParagraph(i, text) { const p = fakeParagraph(text); children.splice(i, 0, p); return p; },
    insertTable() { throw new Error('this test drives paragraph layouts only'); },
  };
  const context = {
    console,
    Logger: { log() {} },
    DocumentApp: {
      Attribute: new Proxy({}, { get: (_, k) => String(k) }),
      getActiveDocument() { return { getBody: () => body, getCursor: () => null, getSelection: () => null }; },
    },
    PropertiesService: { getUserProperties() { return { getProperty() { return null; } }; } },
    getPreferences() { return {}; },
    getTypographySettings() { return { roles: {} }; },
    formatDataForPesukim(d) { return d; },
    getEnglishAttributionLines() { return []; },
    getHebrewAttributionLines_() { return []; },
    applyTitleTypography() {},
    applyRoleTypography_() {},
  };
  vm.createContext(context);
  for (const file of ['apps-script/server/utils.gs', 'apps-script/server/insertion-target.gs', 'apps-script/server/insertion.gs']) {
    vm.runInContext(fs.readFileSync(file, 'utf8'), context, { filename: file });
  }
  return { ctx: context, texts: () => children.map((c) => c._state.text) };
}

test('tags with any attribute characters are read by name, not thrown on', () => {
  const { ctx } = load();
  const p = fakeParagraph();
  const html =
    '<a class="refLink" href="/Shulchan_Arukh,_Orach_Chayim.669.1" data-ref="Shulchan Arukh, Orach Chayim 669:1">see</a> ' +
    '<i data-commentator="Be\'er HaGolah" data-label="א" data-order="1"></i>' +
    '<b>bold</b> <small>Rema:</small> <span style="color: #333; font-size: 90%">tail</span>';
  assert.doesNotThrow(() => ctx.insertRichTextFromHTML(p, html));
  assert.equal(p._state.text, 'see bold Rema: tail');
  assert.deepEqual(p._state.bold, ['bold']);
  assert.deepEqual(p._state.italic, [], 'an empty commentary anchor <i></i> must not italicize what follows');
});

test('a literal "<" in the text stays text', () => {
  const { ctx } = load();
  const p = fakeParagraph();
  ctx.insertRichTextFromHTML(p, '1 < 2 and <3 <b>x</b>');
  assert.equal(p._state.text, '1 < 2 and <3 x');
});

test('a source with no translation inserts the Hebrew alone, with entities decoded', () => {
  const { ctx, texts } = load();
  ctx.insertReference(
    { ref: 'Siddur Rashi 308', heRef: 'סידור רש&quot;י ש״ח', heVersionTitle: 'Buber Edition', text: [], he: ['בשמחת תורה'] },
    { bilingualLayout: 'he-top', insertSefariaLink: true }
  );
  const all = texts();
  assert.ok(all.some((t) => t.startsWith('סידור רש"י ש״ח (Hebrew')), all.join(' | '));
  assert.ok(all.includes('בשמחת תורה'));
  assert.ok(!all.some((t) => t.includes('(Translation')), 'no empty translation block: ' + all.join(' | '));
});

test('a source with both languages still inserts both', () => {
  const { ctx, texts } = load();
  ctx.insertReference(
    { ref: 'Genesis 1:1', heRef: 'בראשית א:א', text: ['In the beginning'], he: ['בְּרֵאשִׁית'] },
    { bilingualLayout: 'he-top' }
  );
  const all = texts();
  assert.ok(all.includes('In the beginning') && all.includes('בְּרֵאשִׁית'), all.join(' | '));
});
