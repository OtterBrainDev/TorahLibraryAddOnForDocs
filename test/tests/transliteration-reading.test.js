// How the transliteration reads a pointed word (apps-script/transliteration.gs,
// readWord_): the rules of Hebrew reading, applied before any letter is
// written. Each of these was wrong once, when every letter and sign was
// written out on its own: וּ was "v" (Eloheynv, Barvkhe), every sh'va "e"
// (Yisera'el), every kamatz "a" (Kal, Khakhemah), a holam's vav "v" (Tvov),
// and a patach under a final ח came after it (Rvkha).
//
// Also: the "Double dagesh chazak" setting (Preferences -> Transliteration
// Mapping) in every text, vowel signs in Transliteration Mapping, and the
// style samples the UI shows, which must be what the engine writes.
//
// Loaded with vm.runInContext; see AGENTS.md hard rule #3.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function load(stored = {}) {
  const reads = [];
  const context = {
    console,
    PropertiesService: {
      getUserProperties: () => ({
        getProperty: (key) => { reads.push(key); return stored[key] === undefined ? null : stored[key]; },
      }),
    },
  };
  vm.createContext(context);
  for (const file of ['apps-script/server/utils.gs', 'apps-script/gematriya.gs', 'apps-script/transliteration.gs']) {
    vm.runInContext(fs.readFileSync(file, 'utf8'), context, { filename: file });
  }
  context.reads = reads;
  return context;
}

const ctx = load();
// One word or phrase, lower case (the capital that starts a sentence aside),
// no overrides, no doubling, read as text that does not mark kamatz katan.
const tr = (text, scheme = 'simple_english', options = {}) => {
  const out = ctx.transliterateHebrewText(text, scheme, Object.assign({ overrideMap: {}, dageshMode: 'none' }, options));
  return out.charAt(0).toLowerCase() + out.slice(1);
};

test('a vowel letter is part of its vowel, not a consonant', () => {
  assert.equal(tr('אֱלֹהֵינוּ'), 'eloheinu'); // tsere + yod, shuruk
  assert.equal(tr('בָּרוּךְ'), 'barukh');
  assert.equal(tr('טוֹב'), 'tov'); // holam male
  assert.equal(tr('הָעוֹלָם'), "ha'olam");
  assert.equal(tr('שִׁירִים'), 'shirim'); // hiriq + yod
  assert.equal(tr('בְּרֵאשִׁית'), 'bereshit'); // an aleph with no vowel is silent
  assert.equal(tr('תּוֹרָה'), 'torah'); // the final he
  assert.equal(tr('וּבָנִים'), 'uvanim'); // a shuruk at the start of a word
  assert.equal(tr('צְבָאוֹת'), "tseva'ot"); // the vav's holam goes to the aleph
  assert.equal(tr('מִצְוֹת'), 'mitsvot'); // after a sh'va the vav is a consonant
  assert.equal(tr('עָלָיו'), 'alav'); // kamatz, silent yod, vav
  assert.equal(tr('אֲדֹנָי'), 'adonai'); // the yod after kamatz
  assert.equal(tr('הַהִוא'), 'hahi');
});

test('a holam the shin or sin dot stands for is read', () => {
  assert.equal(tr('משֶׁה'), tr('מֹשֶׁה'));
  assert.equal(tr('שׂנֵא'), 'sone');
  assert.equal(tr('עָשׂוּ'), 'asu'); // a sin before shuruk has no holam
});

test('a sh\'va is spoken where it opens a syllable, silent where it closes one', () => {
  assert.equal(tr('שְׁמַע'), "shema'"); // at the start of a word
  assert.equal(tr('יִשְׂרָאֵל'), "yisra'el"); // after a short vowel
  assert.equal(tr('שׁוֹמְרִים'), 'shomerim'); // after a long vowel
  assert.equal(tr('יִשְׁמְרוּ'), 'yishmeru'); // the second of two
  assert.equal(tr('קִדְּשָׁנוּ'), 'kideshanu'); // under a doubled letter
  assert.equal(tr('הַלְלוּ'), 'halelu'); // before the same letter
  assert.equal(tr('מֶלֶךְ'), 'melekh'); // at the end of a word
  assert.equal(tr('חֵטְא'), 'khet'); // before a final silent aleph
  assert.equal(tr('וְשָׂבָ֣עְתָּ'), "vesava'ta"); // a hard בגדכפת after it closes the syllable
  assert.equal(tr('וַיְהִי'), 'vayehi'); // vayyiqtol's yod
  assert.equal(tr('לַיְלָה'), 'laylah'); // a diphthong
  assert.equal(tr('הַמְבָרֵךְ'), 'hamevarekh'); // after the article
});

test('a kamatz katan is "o": marked, or by its closed unstressed syllable', () => {
  assert.equal(tr('כׇּל'), 'kol'); // Sefaria's Tanakh marks it
  assert.equal(tr('כָּל'), 'kol');
  assert.equal(tr('בְּכָל־לְבָבְךָ'), 'bekhol-levavekha');
  assert.equal(tr('חָכְמָה'), 'khokhmah');
  assert.equal(tr('קָדְשְׁךָ'), 'kodshekha');
  assert.equal(tr('צָהֳרַיִם'), 'tsohorayim'); // before a hataf kamatz
  // Gadol: open, stressed, or before a diphthong.
  assert.equal(tr('שָׁמְרוּ'), 'shameru');
  assert.equal(tr('הָרְשָׁעִים'), "haresha'im");
  assert.equal(tr('הָיְתָה'), 'haytah');
  assert.equal(tr('שָׁ֣מְרָה'), 'shamerah'); // the accent marks the stress
  assert.equal(tr('שָֽׁמְרָה'), 'shamerah'); // and so does a meteg
});

test('text that marks kamatz katan anywhere is read as marking every one', () => {
  // Rule-based: חָכְמָה is khokhmah. With a ׇ elsewhere, or as Tanakh, its kamatz is gadol.
  assert.equal(tr('חָכְמָה'), 'khokhmah');
  assert.equal(tr('חָכְמָה כׇּל'), 'khakhemah kol');
  assert.equal(tr('חָכְמָה', 'simple_english', { isBiblicalHebrew: true }), 'khakhemah');
  // An HTML passage: one line's ׇ settles the others.
  const html = ctx.transliterateHebrewHtmlPreservingBasicBreaks('כׇּל<br>חָכְמָה', 'simple_english', { overrideMap: {}, dageshMode: 'none' });
  assert.equal(html, 'Kol\nKhakhemah');
});

test('a patach under a final ח, ע or הּ is read before it', () => {
  assert.equal(tr('רוּחַ'), 'ruakh');
  assert.equal(tr('מִזְבֵּחַ'), 'mizbeakh');
  assert.equal(tr('אֱלוֹהַּ'), 'eloah');
  assert.equal(tr('רוּחַ', 'modern_israeli'), 'ruach');
});

test('a dagesh chazak doubles its letter only with "Double dagesh chazak" on', () => {
  assert.equal(tr('שַׁבָּת'), 'shabat');
  assert.equal(tr('שַׁבָּת', 'simple_english', { dageshMode: 'forte' }), 'shabbat');
  assert.equal(tr('תְּפִלָּה', 'simple_english', { dageshMode: 'forte' }), 'tefillah');
  // A dagesh at the start of a word, or after a silent sh'va, only hardens.
  assert.equal(tr('בְּמִדְבַּר', 'simple_english', { dageshMode: 'forte' }), 'bemidbar');
  // Two-letter sounds are written once.
  assert.equal(tr('הַשָּׁמַיִם', 'simple_english', { dageshMode: 'forte' }), 'hashamayim');
  assert.equal(tr('הַשָּׁמַיִם', 'academic_full', { dageshMode: 'forte' }), 'haššāmayim');
  // The old value "all" doubles like "forte".
  assert.equal(tr('שַׁבָּת', 'simple_english', { dageshMode: 'all' }), 'shabbat');
});

test('the stored setting is read when the caller passes none, once a passage', () => {
  const forte = load({ transliteration_biblical_dagesh_mode: 'forte' });
  assert.equal(forte.previewTransliterationWithOverrides('שַׁבָּת', 'simple_english'), 'Shabbat');
  assert.equal(load().previewTransliterationWithOverrides('שַׁבָּת', 'simple_english'), 'Shabat');
  // Voices calls with neither the overrides nor the setting: each is read once.
  forte.reads.length = 0;
  const out = forte.transliterateHebrewHtmlPreservingBasicBreaks('שַׁבָּת<br>תְּפִלָּה<br>חַיִּים', 'simple_english', { keepNiqqud: true });
  assert.equal(out, 'Shabbat\nTefillah\nKhayyim');
  assert.deepEqual(forte.reads.slice().sort(), ['transliteration_biblical_dagesh_mode', 'transliteration_overrides']);
});

test('the insert reads the setting in every text, not only the Tanakh', () => {
  const insertion = fs.readFileSync('apps-script/server/insertion.gs', 'utf8');
  const line = insertion.match(/dageshMode: [^\n]*/)[0];
  assert.match(line, /transliteration_biblical_dagesh_mode/);
  assert.doesNotMatch(line, /isBiblicalHebrewText/);
});

test('Transliteration Mapping: a letter changes without its dagesh; a vowel sign wherever it is pronounced', () => {
  const map = (text, overrideMap, scheme = 'simple_english') => tr(text, scheme, { overrideMap });
  assert.equal(map('כָּל כְּבוֹד מֶלֶךְ', { 'כ': 'ch', 'ך': 'ch' }), 'kol kevod melech');
  // A spoken sh'va only: the silent one stays silent.
  assert.equal(map('בְּמִצְוֹתָיו וְצִוָּנוּ', { 'ְ': "'" }), "b'mitsvotav v'tsivanu");
  // A vowel's sign covers the vowel letter that goes with it.
  assert.equal(map('אֱלֹהֵינוּ', { 'ֵ': 'ay' }), 'elohaynu');
  assert.equal(map('טוֹב חֹל', { 'ֹ': 'oh' }), 'tohv khohl');
  assert.equal(map('בָּרוּךְ', { 'ֻ': 'oo' }), 'barookh');
  assert.equal(map('כׇּל', { 'ׇ': 'aw' }), 'kawl');
  // An aleph or ayin the user maps is written wherever it is pronounced.
  assert.equal(map('עוֹלָם', { 'ע': '`' }), '`Olam');
});

test('each scheme writes the vowel letters and silent letters its own way', () => {
  assert.equal(tr('בָּרוּךְ אַתָּה', 'academic_full'), 'bārûḵ ʾatāh');
  assert.equal(tr('בְּרֵאשִׁית', 'academic_full'), 'bərēʾšîṯ');
  assert.equal(tr('בָּרוּךְ אַתָּה', 'ashkenazi'), 'borukh atoh');
  assert.equal(tr('אֲדֹנָי', 'ashkenazi'), 'adonoi');
  assert.equal(tr('תּוֹרָה', 'ipa_modern'), 'toʁa');
  assert.equal(tr('עוֹלָם', 'traditional'), 'ʿOlam'); // the capital after the sign
});

test('cantillation tells the reader the stress; a prepositive or postpositive accent does not', () => {
  const marks = (word) => ctx.prepareMarksForReading_(word).replace(/[^\uE002\u05BD]/g, '');
  assert.equal(marks('בָּרָ֣א'), '\uE002'); // munach, on the stressed syllable
  assert.equal(marks('שְׁמַע֙'), ''); // pashta on the last letter: postpositive
  assert.equal(marks('אָ֙רֶץ֙'), '\uE002'); // the pashta written twice (on the stress, and postpositive)
  assert.equal(marks('וַֽיְהִי'), 'ֽ'); // meteg is kept
  assert.equal(ctx.stripCantillationMarks_('שָׁ֣מְרָה'), 'שָׁמְרָה');
});

// The style samples the UI shows are what the engine writes.
function readUi(file) {
  return fs.readFileSync(file, 'utf8');
}

test('the composition card\'s samples are the engine\'s הַסֵּפֶר כָל־הָעָם', () => {
  const js = readUi('apps-script/shared/composition-card/shared.html');
  const box = {};
  vm.createContext(box);
  vm.runInContext(js.match(/var CC_TRANSLIT_LABELS = \{[\s\S]*?\n\};/)[0], box);
  const labels = vm.runInContext('CC_TRANSLIT_LABELS', box);
  for (const scheme of Object.keys(labels).filter((key) => key !== 'none')) {
    assert.equal(labels[scheme], tr('הַסֵּפֶר כָל־הָעָם', scheme), scheme);
  }
  // The Style button's text before the script draws it: the default style's.
  const markup = readUi('apps-script/shared/composition-card/markup.html');
  assert.ok(markup.includes('id="cc-translit-toggle" aria-haspopup="listbox" aria-expanded="false">' + labels.simple_english + '</button>'));
});

test('Preferences\' samples are the engine\'s Deuteronomy 11:18', () => {
  const js = readUi('apps-script/preferences/js.html');
  const box = {};
  vm.createContext(box);
  vm.runInContext(js.match(/const transliterationExamples = \{[\s\S]*?\n {4}\};/)[0].replace('const ', 'var '), box);
  const examples = vm.runInContext('transliterationExamples', box);
  const verse = 'וְשַׂמְתֶּם אֶת־דְּבָרַי אֵלֶּה עַל־לְבַבְכֶם';
  for (const scheme of Object.keys(examples)) {
    assert.equal(examples[scheme], ctx.transliterateHebrewText(verse, scheme, { overrideMap: {}, dageshMode: 'none' }), scheme);
  }
  const html = readUi('apps-script/preferences.html');
  assert.ok(html.includes('<span class="label">Preview</span>' + examples.simple_english + '</div>'), 'the static preview is the default style\'s sample');
});

test('Preferences has the "Double dagesh chazak" switch, driving the stored setting', () => {
  const html = readUi('apps-script/preferences.html');
  const js = readUi('apps-script/preferences/js.html');
  // A switch with no name, so the save reads the hidden field it drives.
  assert.match(html, /<input id="transliteration_double_dagesh" type="checkbox">/);
  assert.match(html, /<input type="hidden" id="transliteration_biblical_dagesh_mode" name="transliteration_biblical_dagesh_mode" value="none">/);
  assert.match(js, /byId\('transliteration_biblical_dagesh_mode'\)\.value = this\.checked \? 'forte' : 'none'/);
  // And it shows the stored value once the dialog has loaded it.
  assert.match(js, /renderOverrideList\(\);\n\s*syncDageshSwitchFromField\(\);/);
});

test('Transliteration Mapping offers the vowel signs the engine reads', () => {
  const js = readUi('apps-script/preferences/js.html');
  const marks = [...js.matchAll(/\{ ch: "\\u(05[0-9A-F]{2})"/g)].map((m) => String.fromCharCode(parseInt(m[1], 16)));
  assert.equal(marks.length, 12);
  // Kamatz and its katan, sh'va and every hataf among them.
  for (const mark of ['ָ', 'ׇ', 'ְ', 'ֱ', 'ֲ', 'ֳ']) assert.ok(marks.includes(mark), mark.codePointAt(0).toString(16));
});
