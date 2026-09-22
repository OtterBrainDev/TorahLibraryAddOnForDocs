const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

// Fonts tab: Hebrew / translation / transliteration default to "match the
// document" (an EMPTY font and size, filled from the text at the insertion
// point), and titles can be given a heading style. Upgraders keep their old
// fixed fonts through migration v13 — see migrations.test.js.

function load(files, props = {}, extra = {}) {
  const context = Object.assign({
    console,
    Logger: { log() {} },
    DocumentApp: {
      ParagraphHeading: { NORMAL: 'NORMAL', HEADING1: 'H1', HEADING2: 'H2', HEADING3: 'H3', HEADING4: 'H4', HEADING5: 'H5', HEADING6: 'H6' },
      Attribute: new Proxy({}, { get: (_, k) => String(k) }),
    },
    PropertiesService: {
      getUserProperties() {
        return { getProperty: (k) => (Object.prototype.hasOwnProperty.call(props, k) ? props[k] : null) };
      },
    },
  }, extra);
  vm.createContext(context);
  for (const file of files) vm.runInContext(fs.readFileSync(file, 'utf8'), context, { filename: file });
  return context;
}

const PREFS = 'apps-script/server/preferences.gs';
const MENU = 'apps-script/server/menu-layout.gs';
const INSERTION = 'apps-script/server/insertion.gs';
const plain = (v) => JSON.parse(JSON.stringify(v));

test('every role defaults to "match the document"; titles are normal text', () => {
  const d = load([MENU, PREFS]).getDefaultPreferences();
  for (const role of ['hebrew', 'translation', 'transliteration', 'source_title', 'sefaria_link']) {
    assert.equal(d[`${role}_font`], '', `${role}_font`);
    assert.equal(d[`${role}_font_size`], '', `${role}_font_size`);
  }
  assert.equal(d.source_title_heading, 'normal');
});

test('a stored empty font/size means "match the document"; a stored value is used as is', () => {
  const ctx = load([PREFS], { hebrew_font: '', hebrew_font_size: '', translation_font: 'Georgia', translation_font_size: '13' });
  const props = ctx.PropertiesService.getUserProperties();
  assert.deepEqual(plain(ctx.readTypographyRole_(props, 'hebrew', '', null, 'normal')).font, '');
  assert.equal(ctx.readTypographyRole_(props, 'hebrew', '', null, 'normal').size, null);
  const tr = ctx.readTypographyRole_(props, 'translation', '', null, 'normal');
  assert.equal(tr.font, 'Georgia');
  assert.equal(tr.size, 13);
  // An unset key falls back to the role default passed in.
  const title = ctx.readTypographyRole_(props, 'source_title', 'Noto Sans Hebrew', 14, 'normal');
  assert.equal(title.font, 'Noto Sans Hebrew');
  assert.equal(title.size, 14);
});

test('"match the document" takes the font and size of the text at the insertion point', () => {
  const ctx = load([PREFS], {
    hebrew_font: '', hebrew_font_size: '',
    translation_font: 'Georgia', translation_font_size: '',
  }, { readSurroundingTextStyle_: () => ({ font: 'Garamond', size: 11 }) });
  const t = ctx.getTypographySettings();
  assert.equal(t.roles.hebrew.font, 'Garamond');
  assert.equal(t.roles.hebrew.size, 11);
  assert.equal(t.roles.translation.font, 'Georgia', 'an explicit font is not overridden');
  assert.equal(t.roles.translation.size, 11);
  assert.equal(t.titleHeading, 'normal');
});

test('with no readable surrounding style, "match the document" leaves font and size unset', () => {
  const ctx = load([PREFS], { hebrew_font: '', hebrew_font_size: '' }, {
    readSurroundingTextStyle_: () => { throw new Error('no document'); },
  });
  const t = ctx.getTypographySettings();
  assert.equal(t.roles.hebrew.font, '');
  assert.equal(t.roles.hebrew.size, null);
});

test('a title with a heading style keeps an empty font/size, so the heading\'s own look shows', () => {
  const ctx = load([PREFS], {
    source_title_heading: 'heading2', source_title_font: '', source_title_font_size: '',
    hebrew_font: '', hebrew_font_size: '',
  }, { readSurroundingTextStyle_: () => ({ font: 'Garamond', size: 11 }) });
  const t = ctx.getTypographySettings();
  assert.equal(t.titleHeading, 'heading2');
  assert.equal(t.roles.sourceTitle.font, '');
  assert.equal(t.roles.sourceTitle.size, null);
  assert.equal(t.roles.hebrew.font, 'Garamond');
});

test('unknown heading values fall back to normal text', () => {
  const ctx = load([PREFS]);
  assert.equal(ctx.normalizeTitleHeading_('HEADING3'), 'heading3');
  assert.equal(ctx.normalizeTitleHeading_('heading9'), 'normal');
  assert.equal(ctx.normalizeTitleHeading_(null), 'normal');
});

test('applyTitleTypography sets the chosen heading, and only then', () => {
  const ctx = load([INSERTION]);
  const make = () => {
    const calls = [];
    const text = {
      getText: () => 'Genesis 1:1', setFontFamily() {}, setFontSize() {}, setBold() {}, setItalic() {},
      setUnderline() {}, setForegroundColor() {}, setBackgroundColor() {},
    };
    return { calls, editAsText: () => text, setHeading: (h) => calls.push(h) };
  };
  const role = { font: '', size: null, style: 'normal' };
  const withHeading = make();
  ctx.applyTitleTypography(withHeading, { roles: { sourceTitle: role }, titleHeading: 'heading3' }, false);
  assert.deepEqual(withHeading.calls, ['H3']);
  const normal = make();
  ctx.applyTitleTypography(normal, { roles: { sourceTitle: role }, titleHeading: 'normal' }, false);
  assert.deepEqual(normal.calls, []);
});

test('readSurroundingTextStyle_ skips headings and empty paragraphs back to body text', () => {
  const T = { PARAGRAPH: 'P', LIST_ITEM: 'L', TEXT: 'T', BODY_SECTION: 'B' };
  const para = (text, heading, font, size, prev) => ({
    getType: () => T.PARAGRAPH,
    getHeading: () => heading,
    getPreviousSibling: () => prev,
    editAsText: () => ({ getText: () => text, getFontFamily: () => font, getFontSize: () => size }),
  });
  const body = para('Body text', 'NORMAL', 'Lora', 12, null);
  const heading = para('A heading', 'H2', 'Arial', 20, body);
  const empty = para('', 'NORMAL', null, null, heading);
  const ctx = load([INSERTION]);
  ctx.DocumentApp.ElementType = T;
  ctx.DocumentApp.getActiveDocument = () => ({ getCursor: () => ({ getElement: () => empty, getOffset: () => 0 }) });
  assert.deepEqual(plain(ctx.readSurroundingTextStyle_()), { font: 'Lora', size: 12 });
});
