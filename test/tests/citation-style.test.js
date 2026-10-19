const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

// The citation under an inserted source (editions and licenses) has its own
// style, Preferences → Fonts → Citation (`citation_*`). Until now it was a
// fixed 8 pt italic in the font of the text above it; the defaults, and schema
// v25 for upgraders, keep exactly that look.

function loadPreferences(stored) {
  const props = { getProperty: (k) => (Object.prototype.hasOwnProperty.call(stored, k) ? stored[k] : null) };
  const context = { console, Logger: { log() {} }, PropertiesService: { getUserProperties: () => props } };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync('apps-script/server/menu-layout.gs', 'utf8'), context);
  vm.runInContext(fs.readFileSync('apps-script/server/preferences.gs', 'utf8'), context);
  return { ctx: context, props };
}

test('the defaults are the citation\'s old look: 8 pt italic, in the font of the text above', () => {
  const { ctx } = loadPreferences({});
  const d = ctx.getDefaultPreferences();
  assert.equal(d.citation_font, '');
  assert.equal(d.citation_font_size, '8');
  assert.equal(d.citation_font_style, 'italic');
  for (const key of ['citation_font', 'citation_font_size', 'citation_font_style', 'citation_font_color', 'citation_font_background']) {
    assert.ok(vm.runInContext('SETTINGS', ctx).includes(key), key);
  }
  const role = ctx.getTypographySettings().roles.citation;
  assert.equal(role.size, 8, 'unset is 8 pt too');
  assert.equal(role.style, 'italic');
});

test('an empty citation font is never filled from the text at the cursor', () => {
  const { ctx } = loadPreferences({});
  const roles = { citation: { font: '', size: null }, translation: { font: '', size: null } };
  ctx.fillTypographyFromSurroundingText_(roles, { font: 'Lora', size: 14 }, 'normal');
  assert.equal(roles.citation.font, '', 'the paragraph keeps the font of the text above it');
  assert.equal(roles.translation.font, 'Lora');
});

test('the citation paragraph takes the citation style', () => {
  const context = {
    console,
    DocumentApp: { Attribute: new Proxy({}, { get: (_, k) => String(k) }) },
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync('apps-script/server/insertion.gs', 'utf8'), context);
  context.applyRoleTypography_ = (paragraph, typography, role) => { paragraph.roles.push(role); };
  const paragraph = {
    roles: [], text: '',
    setText(t) { this.text = t; return this; }, setAttributes() { return this; }, setLeftToRight() { return this; },
  };
  context.insertAttributionParagraph(paragraph, ['Translation: JPS', 'License: CC-BY'], { roles: {} });
  assert.deepEqual(paragraph.roles, ['citation']);
  // Without a typography bag (an older caller) it keeps the fixed look.
  const plain = Object.assign({}, paragraph, { roles: [] });
  context.insertAttributionParagraph(plain, ['Translation: JPS'], undefined);
  assert.deepEqual(plain.roles, []);
});

test('every citation the inserts write is given the typography', () => {
  const source = fs.readFileSync('apps-script/server/insertion.gs', 'utf8');
  const calls = source.match(/^\s+insertAttributionParagraph\([^)]*\);/gm);
  assert.ok(calls.length >= 4);
  for (const call of calls) assert.match(call, /, typography\);$/, call.trim());
});

test('Preferences has a Citation section with every citation field', () => {
  const html = fs.readFileSync('apps-script/preferences.html', 'utf8');
  assert.match(html, /<details class="section-card section-accordion" id="citation-typography"/);
  for (const name of ['citation_font', 'citation_font_size', 'citation_font_style', 'citation_font_color', 'citation_font_background']) {
    assert.match(html, new RegExp(`name="${name}"`), name);
  }
});
