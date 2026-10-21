// Two reading conventions of the transliteration (apps-script/transliteration.gs):
//
//   1. The Name is read "HaShem", not spelled out (yehvah, yy, h'): יהוה and
//      every substitute for it (יי, יקוק, ה', השם), prefixes kept (laHaShem).
//   2. Each sentence starts with a capital, as English is written: the start
//      of a line, and after a sof pasuq or a period. IPA is left alone.
//
// Also: every cantillation mark (and meteg) is dropped from the Latin text;
// only the first one was, and the rest were copied into it.
//
// Loaded with vm.runInContext; see AGENTS.md hard rule #3.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const context = {
  console,
  PropertiesService: { getUserProperties: () => ({ getProperty: () => null }) },
};
vm.createContext(context);
for (const file of ['apps-script/server/utils.gs', 'apps-script/gematriya.gs', 'apps-script/transliteration.gs']) {
  vm.runInContext(fs.readFileSync(file, 'utf8'), context, { filename: file });
}
const tr = (text, scheme = 'simple_english') => context.transliterateHebrewText(text, scheme, { overrideMap: {} });

// Deuteronomy 6:4-5, as Sefaria sends it.
const SHEMA = 'שְׁמַ֖ע יִשְׂרָאֵ֑ל יְהוָ֥ה אֱלֹהֵ֖ינוּ יְהוָ֥ה ׀ אֶחָֽד׃ וְאָ֣הַבְתָּ֔ אֵ֖ת יְהוָ֣ה אֱלֹהֶ֑יךָ';
// Hebrew vowel and cantillation marks; paseq and sof pasuq are punctuation.
const HEBREW_MARK = /[\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7]/;

test('the Name is read HaShem, with or without vowels and cantillation', () => {
  for (const name of ['יְהוָ֥ה', 'יְהֹוָה', 'יהוה']) assert.equal(tr(`כִּי ${name}`), `${tr('כִּי')} HaShem`, name);
  assert.match(tr(SHEMA), /^Shema yisera'el HaShem 'eloheynv HaShem ׀ 'ekhad׃ Ve'ahaveta 'et HaShem /);
});

test('every substitute for the Name is read HaShem too', () => {
  for (const name of ['יי', 'יְיָ֥', 'יקוק', 'יְקוָק', "ה'", 'ה׳', 'השם', 'הַשֵּׁם']) {
    assert.equal(tr(`בָּרוּךְ ${name}`), `${tr('בָּרוּךְ')} HaShem`, name);
  }
});

test('a prefix keeps its own reading', () => {
  assert.equal(tr('לַיהוָה'), 'LaHaShem');
  assert.equal(tr('שִׁירוּ לַיהוָה'), `${tr('שִׁירוּ')} laHaShem`);
  assert.equal(tr('וַיהוָה'), 'VaHaShem');
  assert.equal(tr('לַייָ'), 'LaHaShem');
  assert.match(tr('וּבַיהוָה'), /^[A-Z][a-z]*HaShem$/); // two prefix letters
});

test('words that only contain the letters are not the Name', () => {
  for (const word of ['יְהוּדָה', 'יהודה', 'הַשָּׁמַיִם', 'וַיְהִי', 'הָיָה']) {
    assert.doesNotMatch(tr(word), /HaShem/, word);
  }
});

test('IPA reads the Name in IPA, and is never capitalized', () => {
  assert.equal(tr('כִּי יְהוָה', 'ipa_modern'), `${tr('כִּי', 'ipa_modern')} haʃem`);
  assert.match(tr('כִּי', 'ipa_modern'), /^k/);
  assert.equal(tr('אֶחָד׃ וְאָהַבְתָּ', 'ipa_modern'), 'ʔeχad׃ veʔahaveta');
});

test('each sentence starts with a capital: the line, after a sof pasuq or a period', () => {
  assert.equal(tr('אֶחָד׃ וְאָהַבְתָּ'), "'Ekhad׃ Ve'ahaveta");
  // After a period, and not after an ordinary word.
  assert.match(tr('מֵאֵימָתַי קוֹרִין. מִשָּׁעָה'), /^Me'eymatay [a-z]\S*\. M/);
  // The line marker and the aleph sign are skipped.
  assert.match(tr('(א) בְּרֵאשִׁית בָּרָא'), /^\(\S*\) Bere'shiyt bara'$/);
  assert.equal(tr('אֶחָד'), "'Ekhad");
  // Every scheme with letters that have capitals.
  assert.match(tr('שְׁמַע יִשְׂרָאֵל', 'academic_full'), /^Šəmaʿ /);
  assert.match(tr('שְׁמַע יִשְׂרָאֵל', 'ashkenazi'), /^Shema /);
});

test('no Hebrew vowel or cantillation mark is left in the Latin text', () => {
  for (const scheme of ['simple_english', 'traditional', 'academic_full', 'ipa_modern']) {
    assert.doesNotMatch(tr(SHEMA, scheme), HEBREW_MARK, scheme);
  }
});

test('the insert path (line by line) capitalizes each line', () => {
  const out = context.transliterateHebrewHtmlPreservingBasicBreaks('אֶחָד<br>וְאָהַבְתָּ <b>אֵת</b> יְהוָה', 'simple_english', { overrideMap: {} });
  assert.equal(out, "'Ekhad\nVe'ahaveta 'et HaShem");
});
