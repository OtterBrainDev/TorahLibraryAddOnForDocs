// The translation version list's filter box found a language only by its
// two-letter code ("fr"): "French", "français" or "צרפתית" found only
// versions whose title happened to contain the word. Each catalog language
// now has its names (TRANSLATION_LANGUAGE_CATALOG in shared/ui/state: the
// language's name in each catalog language, from CLDR, plus a few in use),
// and the filter keeps every translation in a language whose name starts
// with what was typed (filterTranslationItems, sidebar/js/preview-core).
//
// Loaded with vm.runInContext; .gs and .html are not Node modules (hard rule #3).

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

const ROOT = path.resolve(__dirname, '..', '..');

function readScriptBody(relativePath) {
  const html = fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
  return html.replace(/^\s*<script>/, '').replace(/<\/script>\s*$/, '');
}

function loadSidebar() {
  const context = { console, effectivePreferences: {}, translationAvailabilityByRef: {} };
  context.window = context;
  vm.createContext(context);
  ['apps-script/shared/ui/core-shared.html', 'apps-script/shared/ui/state.html', 'apps-script/sidebar/js/preview-core.html']
    .forEach((file) => vm.runInContext(readScriptBody(file), context, { filename: file }));
  return context;
}

const ctx = loadSidebar();
const codes = (query) => Array.from(ctx.translationLanguageCodesMatching(query)).sort();

test('a language is found by its name in English, in itself, or in another catalog language', () => {
  const cases = {
    French: 'fr', 'français': 'fr', 'Französisch': 'fr', 'francés': 'fr', 'צרפתית': 'fr', 'французский': 'fr',
    'الفرنسية': 'fr', '프랑스어': 'fr',
    German: 'de', Deutsch: 'de', 'גרמנית': 'de', 'alemán': 'de', 'דײַטש': 'de',
    Spanish: 'es', 'español': 'es', 'ספרדית': 'es', 'испанский': 'es',
    Russian: 'ru', 'русский': 'ru', 'רוסית': 'ru',
    Yiddish: 'yi', 'ייִדיש': 'yi', 'אידיש': 'yi', Jiddisch: 'yi',
    Persian: 'fa', Farsi: 'fa', 'فارسی': 'fa', 'פרסית': 'fa',
    Arabic: 'ar', 'arabe': 'ar',
    Korean: 'ko', '한국어': 'ko',
    Polish: 'pl', polski: 'pl', Portuguese: 'pt', 'português': 'pt', Italian: 'it', italiano: 'it',
    Hungarian: 'hu', magyar: 'hu', Finnish: 'fi', suomi: 'fi', Czech: 'cs', 'čeština': 'cs',
    Esperanto: 'eo', English: 'en', 'אנגלית': 'en',
    Ladino: 'lad', 'Judeo-Spanish': 'lad', Judezmo: 'lad', 'לדינו': 'lad',
    'Judeo-Arabic': 'jrb', 'ערבית יהודית': 'jrb', 'Judeo-Italian': 'itk', Italkian: 'itk',
  };
  Object.keys(cases).forEach((query) => {
    assert.deepEqual(codes(query), [cases[query]], query);
  });
});

test('case, accents, vowel points, apostrophes and punctuation do not matter', () => {
  assert.deepEqual(codes('FRANCAIS'), ['fr']);
  assert.deepEqual(codes('espanol'), ['es']);
  assert.deepEqual(codes('cestina'), ['cs']);
  assert.deepEqual(codes('יידיש'), ['yi'], 'without the hiriq');
  assert.deepEqual(codes('דייטש'), ['de'], 'two yods for the ײ ligature');
  assert.deepEqual(codes("צ'כית"), ['cs'], 'an apostrophe for the geresh');
  assert.deepEqual(codes('wloski'), ['it'], 'l for ł');
  assert.deepEqual(codes('judeo spanish'), ['lad'], 'a space for the hyphen');
  assert.deepEqual(codes('کره‌ای'), ['ko'], 'Persian, with the zero-width non-joiner');
  assert.deepEqual(codes('کرهای'), ['ko'], 'and without it');
  assert.deepEqual(codes('  French  '), ['fr']);
});

test('an Arabic name is found with or without its article and hamza', () => {
  assert.deepEqual(codes('عربية'), ['ar', 'jrb'].sort(), 'العربية, and العربية اليهودية');
  assert.deepEqual(codes('الانجليزية'), ['en']);
  assert.deepEqual(codes('انجليزي'), ['en']);
});

test('as it is typed: every language with a name that starts with the text', () => {
  assert.deepEqual(codes('fre'), ['fr']);
  assert.deepEqual(codes('Fran'), ['fr']);
  assert.deepEqual(codes('po'), ['pl', 'pt']);
  assert.deepEqual(codes('esp'), ['eo', 'es'], 'español and esperanto');
  assert.deepEqual(codes('judeo'), ['itk', 'jrb', 'lad']);
  assert.deepEqual(codes('Spanish'), ['es'], 'Judeo-Spanish does not start with it');
  assert.deepEqual(codes('Arabic'), ['ar']);
  // In Hebrew and Arabic, Judeo-Arabic's name starts with Arabic's.
  assert.deepEqual(codes('ערבית'), ['ar', 'jrb']);
  assert.deepEqual(codes('العربية'), ['ar', 'jrb']);
  assert.deepEqual(codes('ערבית יה'), ['jrb']);
});

test('a code typed exactly is that language alone, as before', () => {
  assert.deepEqual(codes('es'), ['es'], 'not Esperanto too');
  assert.deepEqual(codes('it'), ['it'], 'not Judeo-Italian');
  assert.deepEqual(codes('fr'), ['fr']);
  assert.deepEqual(codes('FR'), ['fr']);
  assert.deepEqual(codes('lad'), ['lad']);
  assert.deepEqual(codes('jrb'), ['jrb']);
});

test('text that names no language finds none', () => {
  ['', '   ', 'xyz', 'Klingon', 'JPS', '1917', '-'].forEach((query) => {
    assert.deepEqual(codes(query), [], JSON.stringify(query));
  });
});

test('every catalog language is found by its code, its label and each of its names, and no name is two languages', () => {
  const owner = {};
  ctx.TRANSLATION_LANGUAGE_CATALOG.forEach((lang) => {
    assert.deepEqual(codes(lang.code), [lang.code], lang.code);
    const names = lang.label.split(/[()]/).concat(lang.names || []).filter((n) => n.trim());
    names.forEach((name) => {
      assert.ok(codes(name).indexOf(lang.code) >= 0, lang.code + ' from ' + name);
      const folded = ctx.foldTranslationLanguageName(name);
      assert.ok(!owner[folded] || owner[folded] === lang.code,
        '"' + name + '" is both ' + owner[folded] + ' and ' + lang.code);
      owner[folded] = lang.code;
    });
  });
});

// ── The sidebar's filter box ────────────────────────────────────────────────

function items() {
  return [
    { value: 'JPS', languageCode: 'en', searchable: 'the contemporary torah, jps, 2006 the contemporary torah, jps, 2006 en' },
    { value: 'Rabbinat', languageCode: 'fr', searchable: 'la bible du rabbinat 1899 [fr] la bible du rabbinat 1899 [fr] fr' },
    { value: 'Yehoash', languageCode: 'yi', searchable: 'yehoash yiddish translation [yi] yehoash yiddish translation [yi] yi' },
    { value: 'Cassuto', languageCode: 'es', searchable: 'biblia cassuto [es] biblia cassuto [es] es' },
    { value: 'Zamenhof', languageCode: 'eo', searchable: 'la malnova testamento [eo] la malnova testamento [eo] eo' },
    { value: 'Ohienko', languageCode: '', searchable: 'ohienko bible [uk] ohienko bible [uk] uk' },
  ];
}
const filtered = (query) => Array.from(ctx.filterTranslationItems(items(), query)).map((item) => item.value);

test('the filter box finds a translation by its language\'s name', () => {
  assert.deepEqual(filtered('French'), ['Rabbinat']);
  assert.deepEqual(filtered('français'), ['Rabbinat']);
  assert.deepEqual(filtered('צרפתית'), ['Rabbinat']);
  assert.deepEqual(filtered('Französisch'), ['Rabbinat']);
  assert.deepEqual(filtered('español'), ['Cassuto']);
  assert.deepEqual(filtered('אנגלית'), ['JPS']);
  assert.deepEqual(filtered('Esperanto'), ['Zamenhof']);
});

test('the filter box still finds a translation by its title or code, and keeps the list order', () => {
  assert.deepEqual(filtered(''), ['JPS', 'Rabbinat', 'Yehoash', 'Cassuto', 'Zamenhof', 'Ohienko']);
  assert.deepEqual(filtered('jps'), ['JPS']);
  assert.deepEqual(filtered('Yiddish'), ['Yehoash']);
  assert.deepEqual(filtered('fr'), ['Rabbinat']);
  assert.deepEqual(filtered('ohienko'), ['Ohienko'], 'a language outside the catalog, by title');
  assert.deepEqual(filtered('uk'), ['Ohienko'], 'and by its tag');
  assert.deepEqual(filtered('Klingon'), []);
  const list = items();
  ctx.filterTranslationItems(list, 'French');
  assert.equal(list.length, 6, 'the list itself is not changed');
});

test('the version list renders through filterTranslationItems', () => {
  const core = fs.readFileSync(path.join(ROOT, 'apps-script/sidebar/js/preview-core.html'), 'utf8');
  const render = core.slice(core.indexOf('function renderTranslationOptions'), core.indexOf('function renderHebrewOptions'));
  assert.match(render, /var filtered = filterTranslationItems\(listed, query\);/);
});
