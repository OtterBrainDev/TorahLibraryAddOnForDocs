const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

// Preferences → Fonts → Translation → Advanced: formatting for particular
// translation languages (`translation_language_typography`). Languages not in
// the list, and empty fields of an entry, keep the Translation settings.

function load(props = {}) {
  const context = {
    console,
    Logger: { log() {} },
    DocumentApp: { Attribute: new Proxy({}, { get: (_, k) => String(k) }) },
    PropertiesService: {
      getUserProperties() {
        return { getProperty: (k) => (Object.prototype.hasOwnProperty.call(props, k) ? props[k] : null) };
      },
    },
    readSurroundingTextStyle_: () => null,
  };
  vm.createContext(context);
  for (const file of ['apps-script/server/menu-layout.gs', 'apps-script/server/preferences.gs', 'apps-script/server/insertion.gs']) {
    vm.runInContext(fs.readFileSync(file, 'utf8'), context, { filename: file });
  }
  return context;
}

const plain = (v) => JSON.parse(JSON.stringify(v));

test('defaults to no per-language formatting', () => {
  const ctx = load();
  assert.equal(ctx.getDefaultPreferences().translation_language_typography, '{}');
  assert.ok(vm.runInContext('SETTINGS', ctx).includes('translation_language_typography'));
  assert.deepEqual(plain(ctx.getTypographySettings().translationLanguages), {});
});

test('stored entries are cleaned; malformed ones are dropped', () => {
  const ctx = load();
  assert.deepEqual(plain(ctx.normalizeTranslationLanguageTypography_(JSON.stringify({
    FR: { font: ' Garamond ', size: '13', style: 'italic,bold,italic,blink' },
    de: { font: '', size: '', style: '' },
    he: { font: 'David', size: 12, style: 'bold' }, // the original, not a translation
    'not a code': { font: 'Arial' },
    es: 'Arial',
    ru: { size: 9000 },
  }))), {
    fr: { font: 'Garamond', size: 13, style: 'bold,italic' },
    de: { font: '', size: null, style: 'normal' },
    ru: { font: '', size: null, style: 'normal' },
  });
  assert.deepEqual(plain(ctx.normalizeTranslationLanguageTypography_('not json')), {});
  assert.deepEqual(plain(ctx.normalizeTranslationLanguageTypography_('[1,2]')), {});
  assert.deepEqual(plain(ctx.normalizeTranslationLanguageTypography_(null)), {});
});

test('the translation language comes from actualLanguage, a [xx] title suffix, or the version language', () => {
  const ctx = load();
  assert.equal(ctx.translationLanguageOf_({ versionTitle: 'The Koren Jerusalem Bible', versions: [{ versionTitle: 'The Koren Jerusalem Bible', language: 'en' }] }), 'en');
  assert.equal(ctx.translationLanguageOf_({ versionTitle: 'La Bible du Rabbinat [fr]' }), 'fr');
  assert.equal(ctx.translationLanguageOf_({
    versionTitle: 'Torat Emet', versions: [
      { versionTitle: 'Torat Emet', language: 'he' },
      { versionTitle: 'Torat Emet', language: 'en', actualLanguage: 'de' },
    ],
  }), 'de');
  assert.equal(ctx.translationLanguageOf_({ versionTitle: 'X', versions: [{ versionTitle: 'X', language: 'es' }] }), 'es');
  assert.equal(ctx.translationLanguageOf_({}), 'en');
  assert.equal(ctx.translationLanguageOf_(null), 'en');
});

test('typographyForTranslation_ swaps in the language\'s font, size and style only for that language', () => {
  const ctx = load({
    translation_font: 'Georgia', translation_font_size: '12', translation_font_style: 'normal',
    translation_font_color: '#112233',
    translation_language_typography: JSON.stringify({ fr: { font: '', size: 14, style: 'italic' } }),
  });
  const typography = ctx.getTypographySettings();
  const english = ctx.typographyForTranslation_(typography, { versionTitle: 'JPS' });
  assert.equal(english, typography, 'a language with no entry uses the bag unchanged');

  const french = ctx.typographyForTranslation_(typography, { versionTitle: 'Rabbinat [fr]' });
  assert.deepEqual(plain(french.roles.translation), {
    font: 'Georgia', size: 14, style: 'italic', color: '#112233', background: null,
  });
  assert.equal(typography.roles.translation.size, 12, 'the shared bag is not modified');
  assert.equal(french.roles.hebrew, typography.roles.hebrew);
});

test('a language entry with an empty font still follows "match the document"', () => {
  const ctx = load({
    translation_font: '', translation_font_size: '',
    translation_language_typography: JSON.stringify({ fr: { font: '', size: null, style: 'bold' } }),
  });
  ctx.readSurroundingTextStyle_ = () => ({ font: 'Lora', size: 11 });
  const french = ctx.typographyForTranslation_(ctx.getTypographySettings(), { versionTitle: 'Rabbinat [fr]' });
  assert.equal(french.roles.translation.font, 'Lora');
  assert.equal(french.roles.translation.size, 11);
  assert.equal(french.roles.translation.style, 'bold');
});
