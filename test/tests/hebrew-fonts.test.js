const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

// Borrowed Hebrew marks (apps-script/server/hebrew-fonts.gs). A beta tester on
// a Mac saw empty boxes for every cantillation mark in David Libre, which has
// the letters and vowels but no cantillation at all. Only the marks a font
// lacks are set in Noto Serif / Sans Hebrew; letters and the marks it has stay
// in the user's font. The preview (shared/fonts/js.html) must agree.

const COVERAGE = 'apps-script/server/hebrew-font-coverage.gs';
const FONTS = 'apps-script/server/hebrew-fonts.gs';
const INSERTION = 'apps-script/server/insertion.gs';
const PREFS = 'apps-script/server/preferences.gs';
const plain = (v) => JSON.parse(JSON.stringify(v));

function load(files, extra = {}) {
  const context = Object.assign({ console, Logger: { log() {} } }, extra);
  vm.createContext(context);
  for (const file of files) vm.runInContext(fs.readFileSync(file, 'utf8'), context, { filename: file });
  return context;
}

// בָּרָ֣א: bet, dagesh, qamats, resh, qamats, munach (U+05A3), alef.
const BARA = 'בָּרָ֣א';

test('David Libre: only the cantillation is lent, by Noto Serif Hebrew; vowels and dagesh stay', () => {
  const ctx = load([COVERAGE, FONTS]);
  assert.deepEqual(plain(ctx.planHebrewMarkFallback_(BARA, 'David Libre')), [
    { start: 5, end: 5, font: 'Noto Serif Hebrew' },
  ]);
});

test('a sans font borrows from Noto Sans Hebrew; names match in any case', () => {
  const ctx = load([COVERAGE, FONTS]);
  assert.deepEqual(plain(ctx.planHebrewMarkFallback_(BARA, 'heebo')), [
    { start: 5, end: 5, font: 'Noto Sans Hebrew' },
  ]);
});

test('a font with every mark, an unknown font, or no font: nothing is changed', () => {
  const ctx = load([COVERAGE, FONTS]);
  for (const font of ['Noto Serif Hebrew', 'Noto Rashi Hebrew', 'Arial', 'Times New Roman', 'SBL Hebrew', '']) {
    assert.deepEqual(plain(ctx.planHebrewMarkFallback_(BARA, font)), [], font);
  }
});

test('neighbouring missing marks are one range; text without marks plans nothing', () => {
  const ctx = load([COVERAGE, FONTS]);
  // Two cantillation marks on one letter (pashta + qadma pattern), then sof pasuq.
  const text = 'הָ֙֨ א׃';
  assert.deepEqual(plain(ctx.planHebrewMarkFallback_(text, 'Frank Ruhl Libre')), [
    { start: 2, end: 3, font: 'Noto Serif Hebrew' },
  ]);
  assert.deepEqual(plain(ctx.planHebrewMarkFallback_('In the beginning בראשית', 'David Libre')), []);
});

test('a stretch set in another font (an emphasis mapped to a font) is judged by that font', () => {
  const ctx = load([COVERAGE, FONTS]);
  const text = BARA + ' ' + BARA;
  // The second word (from 8) is in Heebo; its munach is at 13.
  assert.deepEqual(plain(ctx.planHebrewMarkFallback_(text, 'Noto Serif Hebrew', [{ start: 8, end: 14, font: 'Heebo' }])), [
    { start: 13, end: 13, font: 'Noto Sans Hebrew' },
  ]);
});

test('the server table and the preview table are the same data', () => {
  const server = load([COVERAGE]).HEBREW_FONT_COVERAGE_;
  const html = fs.readFileSync('apps-script/shared/fonts/coverage.html', 'utf8');
  const body = html.match(/<script>([\s\S]*)<\/script>/)[1];
  const client = load([]);
  vm.runInContext(body, client);
  assert.deepEqual(plain(client.HEBREW_FONT_COVERAGE), plain(server));
  // The lenders must have every mark, or borrowing from them is pointless.
  assert.equal(server['Noto Serif Hebrew'].missing, '');
  assert.equal(server['Noto Sans Hebrew'].missing, '');
  // The font from the report.
  assert.match(server['David Libre'].missing, /^0591-05AF/);
});

test('the preview plans exactly what the insert does', () => {
  const server = load([COVERAGE, FONTS]);
  const client = load([]);
  for (const file of ['apps-script/shared/fonts/coverage.html', 'apps-script/shared/fonts/js.html']) {
    const html = fs.readFileSync(file, 'utf8');
    for (const m of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) vm.runInContext(m[1], client);
  }
  const samples = [BARA, 'הָ֙֨ א׃', 'וַיֹּ֣אמֶר אֱלֹהִ֑ים׃'];
  for (const font of ['David Libre', 'Heebo', 'Alef', 'Noto Serif Hebrew', 'Arial', 'Cascadia Code']) {
    for (const text of samples) {
      assert.deepEqual(plain(client.planHebrewMarkFallback(text, font)), plain(server.planHebrewMarkFallback_(text, font)), font);
    }
  }
});

// The insert itself: a Docs Text stub that records font changes.
function paragraphStub(text) {
  const calls = [];
  const api = {
    getText: () => text,
    setFontFamily(start, end, font) { calls.push([start, end, font]); return api; },
    setFontSize() { return api; },
    setBold() { return api; },
    setItalic() { return api; },
    setUnderline() { return api; },
    setForegroundColor() { return api; },
    setBackgroundColor() { return api; },
    isBold: () => false,
    isItalic: () => false,
  };
  return { calls, paragraph: { editAsText: () => api } };
}

function insertionContext(documentFont) {
  return load([COVERAGE, FONTS, PREFS, INSERTION], {
    DocumentApp: {
      Attribute: new Proxy({}, { get: (_, k) => String(k) }),
      ParagraphHeading: { NORMAL: 'NORMAL' },
      getActiveDocument: () => ({
        getBody: () => ({ getHeadingAttributes: () => ({ FONT_FAMILY: documentFont }) }),
      }),
    },
  });
}

test('inserting Hebrew in David Libre sets the font, then lends the cantillation', () => {
  const ctx = insertionContext('Arial');
  const { calls, paragraph } = paragraphStub(BARA);
  const typography = { roles: { hebrew: { font: 'David Libre', size: null, style: 'normal' } }, hebrewMarkFallback: true };
  ctx.applyRoleTypography_(paragraph, typography, 'hebrew');
  assert.deepEqual(calls, [[0, 6, 'David Libre'], [5, 5, 'Noto Serif Hebrew']]);
});

test('"Match the document" judges the document\'s Normal text font', () => {
  const ctx = insertionContext('David Libre');
  const { calls, paragraph } = paragraphStub(BARA);
  const typography = { roles: { hebrew: { font: '', size: null, style: 'normal' } }, hebrewMarkFallback: true };
  ctx.applyRoleTypography_(paragraph, typography, 'hebrew');
  assert.deepEqual(calls, [[5, 5, 'Noto Serif Hebrew']]);
});

test('with the setting off, no mark is moved', () => {
  const ctx = insertionContext('Arial');
  const { calls, paragraph } = paragraphStub(BARA);
  const typography = { roles: { hebrew: { font: 'David Libre', size: null, style: 'normal' } }, hebrewMarkFallback: false };
  ctx.applyRoleTypography_(paragraph, typography, 'hebrew');
  assert.deepEqual(calls, [[0, 6, 'David Libre']]);
});

test('hebrew_mark_fallback: on by default, a SETTINGS key, read by getTypographySettings', () => {
  const props = {};
  const ctx = load(['apps-script/server/menu-layout.gs', PREFS], {
    PropertiesService: { getUserProperties: () => ({ getProperty: (k) => (k in props ? props[k] : null) }) },
    readSurroundingTextStyle_: () => null,
  });
  assert.equal(ctx.getDefaultPreferences().hebrew_mark_fallback, true);
  assert.ok(vm.runInContext('SETTINGS', ctx).includes('hebrew_mark_fallback'));
  assert.equal(ctx.getTypographySettings().hebrewMarkFallback, true);
  props.hebrew_mark_fallback = 'false';
  assert.equal(ctx.getTypographySettings().hebrewMarkFallback, false);
  // An override (a sidebar session, Link Texts' customize panel) wins.
  const overlay = { getProperty: (k) => ({ hebrew_mark_fallback: 'true', hebrew_font: 'David Libre' }[k] ?? null) };
  const t = ctx.getTypographySettings(overlay);
  assert.equal(t.hebrewMarkFallback, true);
  assert.equal(t.roles.hebrew.font, 'David Libre');
});

test('Link Texts accepts font overrides of the right shape only', () => {
  const ctx = load(['apps-script/server/document-actions.gs'], { TRANSLITERATION_SCHEMES: {} });
  assert.deepEqual(plain(ctx.sanitizeInsertOverrides_({
    hebrew_font: 'David Libre', translation_font: '', hebrew_font_size: '14', translation_font_size: '',
    hebrew_mark_fallback: 'false',
  })), {
    hebrew_font: 'David Libre', translation_font: '', hebrew_font_size: '14', translation_font_size: '',
    hebrew_mark_fallback: 'false',
  });
  assert.deepEqual(plain(ctx.sanitizeInsertOverrides_({
    hebrew_font: '<b>x</b>', translation_font: 'x'.repeat(101), hebrew_font_size: '-3', translation_font_size: 'big',
    hebrew_mark_fallback: 'maybe',
  })), {});
});

test('the sidebar\'s single insert passes its session, so the tray\'s fonts reach it', () => {
  const footer = fs.readFileSync('apps-script/sidebar/js/footer-actions.html', 'utf8');
  const call = footer.slice(footer.indexOf('.insertReference(data, {'));
  assert.match(call.slice(0, call.indexOf('});')), /sessionId: sidebarSessionId/);
});
