// Pins where the transliteration's Hebrew comes from: the text as Sefaria sent
// it, vowels and punctuation kept, not the Hebrew as displayed. With Vowels
// off, transliterating the displayed Hebrew read bare consonants. The fetch
// keeps a copy (heTransliterationSource, server/text-processing.gs) before the
// display filters run; the divine-name substitutes still apply to it.
// aligned-rows.test.js pins that the insert reads it.
//
// Loaded with vm.runInContext; .gs is not a Node module format.

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

const ROOT = path.resolve(__dirname, '..', '..');
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const plain = (value) => JSON.parse(JSON.stringify(value));

// Vowels, a tipcha (U+0596) and a sof pasuq (U+05C3).
const FETCHED = 'בְּרֵאשִׁ֖ית בָּרָא׃';

function load(stored) {
  const context = {
    console,
    Logger: { log() {} },
    UrlFetchApp: { fetch: () => ({ getResponseCode: () => 200, getContentText: () => JSON.stringify({ ref: 'Genesis 1:1', he: [FETCHED, 'יְהוָה'], text: ['In the beginning', 'God'], type: 'Tanakh' }) }) },
    PropertiesService: { getUserProperties: () => ({ getProperty: (key) => (key in stored ? stored[key] : null) }) },
    expandCitationAbbreviations_: () => [],
    normalizeReferenceInput: (r) => r,
    stripHebrewNumeralMarks_: (r) => r
  };
  vm.createContext(context);
  ['apps-script/server/text-processing.gs', 'apps-script/server/preferences.gs', 'apps-script/server/sefaria-fetch.gs'].forEach((relative) => {
    vm.runInContext(read(relative), context, { filename: relative });
  });
  return context;
}

test('vowels, cantillation and punctuation off: the Hebrew is stripped, the transliteration source is not', () => {
  const data = load({ nekudot: 'false', teamim: 'false', hebrew_punctuation: 'false' }).findReference('Genesis 1:1');
  assert.equal(data.he[0], 'בראשית ברא');
  assert.deepEqual(plain(data.heTransliterationSource), [FETCHED, 'יְהוָה']);
});

test('the divine-name substitutes apply to the transliteration source too', () => {
  const data = load({ apply_sheimot_on_insertion: 'true', meforash_replace: 'true', meforash_replacement: "ה'" }).findReference('Genesis 1:1');
  assert.equal(data.he[1], "ה'");
  assert.equal(data.heTransliterationSource[1], "ה'");
  assert.equal(data.heTransliterationSource[0], FETCHED);
});

test('a payload without a source (an older client) falls back to the Hebrew', () => {
  const ctx = load({});
  assert.equal(ctx.transliterationSourceOf_({ he: 'שלום' }), 'שלום');
  assert.equal(ctx.transliterationSourceOf_({ he: 'שלום', heTransliterationSource: 'שָׁלוֹם' }), 'שָׁלוֹם');
});

test('the sidebar preview transliterates the same source', () => {
  const js = read('apps-script/sidebar/js/preview-render.html');
  assert.match(js, /dataIn\.heTransliterationSource/);
});
