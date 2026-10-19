const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

// The source (Hebrew) title and the translation title are set apart: each has
// its own link switch (`insert_hebrew_sefaria_link_default` beside
// `insert_sefaria_link_default`) and its own fonts (`hebrew_title_*` /
// `hebrew_link_*` beside `source_title_*` / `sefaria_link_*`). Before, one
// switch and one pair of styles governed both titles; schema v23 copies those
// values to the new keys, so nothing an upgrader inserts changes until they
// set the two apart (migrations.test.js).

function fakeParagraph(initial) {
  const p = { text: initial || '', link: null };
  const textApi = {
    editAsText() { return textApi; },
    getText() { return p.text; },
    insertText(offset, t) { p.text = p.text.slice(0, offset) + t + p.text.slice(offset); return textApi; },
    setBold() { return textApi; },
    setItalic() { return textApi; },
    setLinkUrl(url) { p.link = url; return textApi; },
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

function loadInsertion() {
  const children = [];
  const titleCalls = [];
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
    applyRoleTypography_() {},
  };
  vm.createContext(context);
  for (const file of ['apps-script/server/utils.gs', 'apps-script/server/insertion-target.gs', 'apps-script/server/insertion.gs']) {
    vm.runInContext(fs.readFileSync(file, 'utf8'), context, { filename: file });
  }
  // Record which title style each title paragraph is given.
  context.applyTitleTypography = (paragraph, typography, linked, language) => {
    titleCalls.push({ text: paragraph._state.text, role: context.titleRoleName_(linked, language) });
  };
  const paragraphs = () => children.map((c) => c._state);
  return { ctx: context, paragraphs, titleCalls };
}

const GENESIS = { ref: 'Genesis 1:1', heRef: 'בראשית א:א', text: ['In the beginning'], he: ['בְּרֵאשִׁית'] };

test('each title is linked by its own switch', () => {
  const { ctx, paragraphs, titleCalls } = loadInsertion();
  ctx.insertReference(Object.assign({}, GENESIS), { bilingualLayout: 'he-top', insertSefariaLink: true, insertHebrewSefariaLink: false });
  const hebrewTitle = paragraphs().find((p) => p.text.startsWith('בראשית'));
  const translationTitle = paragraphs().find((p) => p.text.startsWith('Genesis'));
  assert.equal(hebrewTitle.text, 'בראשית א:א', 'the unlinked source title is the plain ref');
  assert.equal(hebrewTitle.link, null);
  assert.ok(translationTitle.link && translationTitle.link.includes('sefaria.org'));
  assert.deepEqual(titleCalls.map((c) => c.role), ['hebrewTitle', 'sefariaLink']);

  const second = loadInsertion();
  second.ctx.insertReference(Object.assign({}, GENESIS), { bilingualLayout: 'he-top', insertSefariaLink: false, insertHebrewSefariaLink: true });
  assert.ok(second.paragraphs().find((p) => p.text.startsWith('בראשית')).link);
  assert.equal(second.paragraphs().find((p) => p.text.startsWith('Genesis')).link, null);
  assert.deepEqual(second.titleCalls.map((c) => c.role), ['hebrewLink', 'sourceTitle']);
});

test('a caller that does not know the source title switch links both titles alike, as before', () => {
  for (const linked of [true, false]) {
    const { ctx, titleCalls } = loadInsertion();
    ctx.insertReference(Object.assign({}, GENESIS), { bilingualLayout: 'he-top', insertSefariaLink: linked });
    assert.deepEqual(titleCalls.map((c) => c.role), linked ? ['hebrewLink', 'sefariaLink'] : ['hebrewTitle', 'sourceTitle']);
  }
});

test('a Hebrew-only insert takes the source title switch and style', () => {
  const { ctx, paragraphs, titleCalls } = loadInsertion();
  ctx.insertReference(Object.assign({}, GENESIS), { singleLanguage: 'he', insertSefariaLink: true, insertHebrewSefariaLink: false });
  assert.equal(paragraphs()[0].link, null);
  assert.deepEqual(titleCalls.map((c) => c.role), ['hebrewTitle']);
});

function loadPreferences(stored) {
  const props = { getProperty: (k) => (Object.prototype.hasOwnProperty.call(stored, k) ? stored[k] : null) };
  const context = { console, Logger: { log() {} }, PropertiesService: { getUserProperties: () => props } };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync('apps-script/server/menu-layout.gs', 'utf8'), context);
  vm.runInContext(fs.readFileSync('apps-script/server/preferences.gs', 'utf8'), context);
  return { ctx: context, props };
}

test('the source title has its own fonts, plain and linked', () => {
  const { ctx, props } = loadPreferences({
    source_title_font: 'Lora', source_title_font_size: '14',
    sefaria_link_font: 'Lora', sefaria_link_font_size: '14',
    hebrew_title_font: 'Frank Ruhl Libre', hebrew_title_font_size: '18', hebrew_title_font_style: 'bold',
    hebrew_link_font: 'David Libre', hebrew_link_font_size: '16',
  });
  const t = ctx.getTypographySettings(props);
  assert.equal(t.roles.sourceTitle.font, 'Lora');
  assert.equal(t.roles.hebrewTitle.font, 'Frank Ruhl Libre');
  assert.equal(t.roles.hebrewTitle.size, 18);
  assert.equal(t.roles.hebrewTitle.style, 'bold');
  assert.equal(t.roles.hebrewLink.font, 'David Libre');
  assert.equal(t.roles.hebrewLink.style, 'underline', 'a linked title is underlined unless set otherwise');
  for (const role of ['sourceTitle', 'sefariaLink', 'hebrewTitle', 'hebrewLink']) assert.ok(ctx.isTitleRole_(role), role);
});

test('the new keys are preferences, with defaults equal to the translation title\'s', () => {
  const { ctx } = loadPreferences({});
  const defaults = ctx.getDefaultPreferences();
  const pairs = {
    insert_hebrew_sefaria_link_default: 'insert_sefaria_link_default',
    hebrew_title_font: 'source_title_font', hebrew_title_font_size: 'source_title_font_size',
    hebrew_title_font_style: 'source_title_font_style', hebrew_title_font_color: 'source_title_font_color',
    hebrew_title_font_background: 'source_title_font_background',
    hebrew_link_font: 'sefaria_link_font', hebrew_link_font_size: 'sefaria_link_font_size',
    hebrew_link_font_style: 'sefaria_link_font_style', hebrew_link_font_color: 'sefaria_link_font_color',
    hebrew_link_font_background: 'sefaria_link_font_background',
  };
  for (const [key, from] of Object.entries(pairs)) {
    assert.ok(vm.runInContext('SETTINGS', ctx).includes(key), `${key} is not in SETTINGS`);
    assert.equal(defaults[key], defaults[from], key);
  }
});

test('Link Texts and Insert from Selection pass the source title switch, following the translation\'s when unset', () => {
  const context = { console, Logger: { log() {} } };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync('apps-script/server/document-actions.gs', 'utf8'), context);
  const opts = (prefs) => context.buildLinkSourcesInsertOptions_(prefs);
  assert.equal(opts({ insert_sefaria_link_default: 'true', insert_hebrew_sefaria_link_default: 'false' }).insertHebrewSefariaLink, false);
  assert.equal(opts({ insert_sefaria_link_default: 'false', insert_hebrew_sefaria_link_default: 'true' }).insertHebrewSefariaLink, true);
  assert.equal(opts({ insert_sefaria_link_default: 'true' }).insertHebrewSefariaLink, true);
  assert.equal(opts({ insert_sefaria_link_default: 'false' }).insertHebrewSefariaLink, false);
  assert.ok(Object.prototype.hasOwnProperty.call(context.LINKER_INSERT_OVERRIDE_KEYS_, 'insert_hebrew_sefaria_link_default'));
});

// Each title has its own font, linked or not; the linked style replaces it
// only while that title's "Hyperlink formatting override" is on.
test('a linked title keeps its own font unless its hyperlink formatting override is on', () => {
  const { ctx } = loadInsertion();
  const role = (linked, language, overrides) => ctx.titleRoleName_(linked, language, { linkFormatOverride: overrides });
  assert.equal(role(true, 'en', { en: true, he: true }), 'sefariaLink');
  assert.equal(role(true, 'en', { en: false, he: true }), 'sourceTitle');
  assert.equal(role(true, 'he', { en: true, he: false }), 'hebrewTitle');
  assert.equal(role(true, 'he', { en: false, he: true }), 'hebrewLink');
  assert.equal(role(false, 'he', { en: true, he: true }), 'hebrewTitle', 'an unlinked title never takes the linked style');
  // A caller with no override settings (the Voices sheets path) gets the
  // linked style, as linked titles always had.
  assert.equal(ctx.titleRoleName_(true, 'en'), 'sefariaLink');
});

test('getTypographySettings reads each override, unset meaning on', () => {
  assert.deepEqual({ ...loadPreferences({}).ctx.getTypographySettings().linkFormatOverride }, { en: true, he: true });
  const { ctx, props } = loadPreferences({ sefaria_link_format_override: 'false', hebrew_link_format_override: 'true' });
  assert.deepEqual({ ...ctx.getTypographySettings(props).linkFormatOverride }, { en: false, he: true });
  const defaults = ctx.getDefaultPreferences();
  assert.equal(defaults.sefaria_link_format_override, true);
  assert.equal(defaults.hebrew_link_format_override, true);
  for (const key of ['sefaria_link_format_override', 'hebrew_link_format_override']) {
    assert.ok(vm.runInContext('SETTINGS', ctx).includes(key), key);
  }
});
