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

test('the stored settings are read when the caller passes none, once a passage', () => {
  const forte = load({ transliteration_biblical_dagesh_mode: 'forte' });
  assert.equal(forte.previewTransliterationWithOverrides('שַׁבָּת', 'simple_english'), 'Shabbat');
  assert.equal(load().previewTransliterationWithOverrides('שַׁבָּת', 'simple_english'), 'Shabat');
  // Voices calls with neither the overrides nor the setting: each is read once.
  forte.reads.length = 0;
  const out = forte.transliterateHebrewHtmlPreservingBasicBreaks('שַׁבָּת<br>תְּפִלָּה<br>חַיִּים', 'simple_english', { keepNiqqud: true });
  assert.equal(out, 'Shabbat\nTefillah\nKhayyim');
  assert.deepEqual(forte.reads.slice().sort(), ['transliteration_biblical_dagesh_mode', 'transliteration_divine_name', 'transliteration_overrides']);
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
    assert.equal(labels[scheme].replace(/\u05BE/g, '-'), tr('הַסֵּפֶר כָל־הָעָם', scheme), scheme);
    assert.equal(labels[scheme].split('\u05BE').length, 2, scheme + ': the maqaf is kept as the Hebrew mark');
  }
  // The Style button's text before the script draws it: the default style's.
  const markup = readUi('apps-script/shared/composition-card/markup.html');
  assert.ok(markup.includes('id="cc-translit-toggle" aria-haspopup="listbox" aria-expanded="false">' + labels.simple_english.replace(/\u05BE/g, '-') + '</button>'));
});

test('Preferences\' samples are the engine\'s Deuteronomy 11:18', () => {
  const js = readUi('apps-script/preferences/js.html');
  const box = {};
  vm.createContext(box);
  vm.runInContext(js.match(/const transliterationExamples = \{[\s\S]*?\n {4}\};/)[0].replace('const ', 'var '), box);
  const examples = vm.runInContext('transliterationExamples', box);
  const verse = 'וְשַׂמְתֶּם אֶת־דְּבָרַי אֵלֶּה עַל־לְבַבְכֶם';
  for (const scheme of Object.keys(examples)) {
    assert.equal(examples[scheme].replace(/\u05BE/g, '-'), ctx.transliterateHebrewText(verse, scheme, { overrideMap: {}, dageshMode: 'none' }), scheme);
  }
  const html = readUi('apps-script/preferences.html');
  assert.ok(html.includes('<span class="label">Preview</span>' + examples.simple_english.replace(/\u05BE/g, '-') + '</div>'), 'the static preview is the default style\'s sample');
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

// The Name, as the reader chooses to write it (transliteration_divine_name,
// schema 31), in every style; "HaShem" unless they choose another.
test('the Name is written as the reader chooses, in every style, prefixes kept', () => {
  const name = (text, divineName, scheme = 'simple_english') => ctx.transliterateHebrewText(text, scheme, { overrideMap: {}, dageshMode: 'none', divineName });
  assert.equal(name('בָּרוּךְ אַתָּה יְהוָה', 'Adonai'), 'Barukh atah Adonai');
  assert.equal(name('בָּרוּךְ אַתָּה יְיָ', 'Adonoy', 'ashkenazi'), 'Borukh atoh Adonoy');
  assert.equal(name('שִׁירוּ לַיהוָה', 'Adonai', 'academic_full'), 'Šîrû laAdonai');
  for (const scheme of ['simple_english', 'traditional', 'modern_israeli', 'ashkenazi', 'academic_full']) {
    assert.match(name('כִּי ה׳ טוֹב', 'G-d', scheme), / G-d /, scheme);
  }
  // Cleaned: one line of plain text, at most 40 characters; empty is HaShem.
  assert.equal(name('יְהוָה', '  Ado-nai  '), 'Ado-nai');
  assert.equal(name('יְהוָה', '<b>Lord</b>\n'), 'BLord/b'); // no markup; a sentence's capital
  assert.equal(name('יְהוָה', ''), 'HaShem');
  assert.equal(name('יְהוָה', 'x'.repeat(60)).length, 40);
  // A word that only contains the letters is not the Name.
  assert.equal(name('וַיְהִי', 'Adonai'), 'Vayehi');
});

test('IPA reads HaShem and Adonai as Hebrew; any other spelling as written', () => {
  const ipa = (divineName, scheme = 'ipa_modern') => ctx.transliterateHebrewText('יְהוָה', scheme, { overrideMap: {}, dageshMode: 'none', divineName });
  assert.equal(ipa('HaShem'), 'haʃem');
  assert.equal(ipa('Adonai'), 'ʔadonaj');
  assert.equal(ipa('Adonoy'), 'ʔadonaj');
  assert.equal(ipa('Adonai', 'ipa_tiberian'), 'ʔădoːnɔːj');
  assert.equal(ipa('G-d'), 'G-d');
});

test('the stored spelling is read when the caller passes none, and the insert passes the setting', () => {
  const stored = load({ transliteration_divine_name: 'Adonai' });
  assert.equal(stored.previewTransliterationWithOverrides('בָּרוּךְ אַתָּה יְהוָה', 'simple_english'), 'Barukh atah Adonai');
  assert.equal(stored.transliterateHebrewHtmlPreservingBasicBreaks('יְהוָה<br>לַיהוָה', 'modern_israeli', { overrideMap: {} }), 'Adonai\nLaAdonai');
  assert.equal(load().previewTransliterationWithOverrides('יְהוָה', 'simple_english'), 'HaShem');
  const insertion = fs.readFileSync('apps-script/server/insertion.gs', 'utf8');
  assert.match(insertion, /divineName: settings\.transliteration_divine_name \|\| ""/);
});

test('Preferences offers the Name\'s spelling, with suggestions, saved as transliteration_divine_name', () => {
  const html = readUi('apps-script/preferences.html');
  assert.match(html, /<input id="transliteration_divine_name" name="transliteration_divine_name" type="text" maxlength="40" list="transliteration-divine-name-options"/);
  const list = html.match(/<datalist id="transliteration-divine-name-options">([\s\S]*?)<\/datalist>/)[1];
  for (const value of ['HaShem', 'Hashem', 'Adonai', 'Adonoy', 'Ado-nai', 'G-d']) assert.match(list, new RegExp('<option value="' + value + '">'), value);
});

test('every style menu lists exactly the engine\'s styles', () => {
  // Copied out of the vm context, whose arrays have another prototype.
  const keys = JSON.parse(JSON.stringify(ctx.TRANSLITERATION_SCHEME_OPTIONS.map((option) => option.key)));
  assert.deepEqual(JSON.parse(JSON.stringify(Object.keys(ctx.TRANSLITERATION_SCHEMES))), keys);
  assert.deepEqual(JSON.parse(JSON.stringify(Object.keys(ctx.TRANSLITERATION_READINGS))), keys);
  const menus = {
    'composition card': [readUi('apps-script/shared/composition-card/markup.html'), /class="cc-translit-option" data-value="([a-z_]+)"/g],
    'Voices (sidebar)': [readUi('apps-script/sidebar.html'), /voices-translit-option" data-value="([a-z_]+)"/g],
    'Voices (Preferences)': [readUi('apps-script/preferences.html'), /pref-voices-translit-option" data-value="([a-z_]+)"/g],
    'Preferences select': [readUi('apps-script/preferences.html').match(/<select[^>]*id="transliteration_scheme"[\s\S]*?<\/select>/)[0], /<option value="([a-z_]+)"/g],
  };
  for (const [name, [text, re]] of Object.entries(menus)) {
    assert.deepEqual([...text.matchAll(re)].map((m) => m[1]).filter((key) => key !== 'none'), keys, name);
  }
});

// The academic standards (Help → Transliteration styles → Academic
// standards), checked against the examples the standards print.
const std = (text, scheme, options = {}) => ctx.transliterateHebrewText(text, scheme, Object.assign({ overrideMap: {}, dageshMode: 'none' }, options));

test('BGN/PCGN 2018: the agreement\'s own examples', () => {
  const bgn = (text) => std(text, 'bgn_pcgn');
  assert.equal(bgn('עַכּוֹ'), '\u2018Akko'); // a dagesh chazak doubled (note 2)
  assert.equal(bgn('כַּרְכֹּם'), 'Karkom'); // a weak dagesh is not
  assert.equal(bgn('גְּאֻלִּים'), 'Ge\u2019ullim'); // sh'va na e, medial alef (notes 1, 3)
  assert.equal(bgn('בְּאֵר שֶׁבַע'), 'Be\u2019er sheva\u2018'); // (Sheva's capital is proper-names.gs's, not loaded here)
  assert.equal(bgn('גַּלְאוֹן'), 'Gal\u2019on');
  assert.equal(bgn('נֶאְדָּר'), 'Ne\u2019dar'); // an alef with sh'va is romanized
  assert.equal(bgn('אֵילָה'), 'Ela'); // an initial alef is not, nor a final he
  assert.equal(bgn('סָאסָא'), 'Sasa'); // nor an alef that only marks a vowel
  assert.equal(bgn('רוֹקֵחַ'), 'Roqea\u1E96'); // the furtive patah first (note 5)
  // Doubling is the agreement's, whatever "Double dagesh chazak" says; never sh or ts.
  assert.equal(bgn('שַׁבָּת'), 'Shabbat');
  assert.equal(bgn('הַשָּׁמַיִם'), 'Hashamayim');
  assert.equal(bgn('מִמִּצְרַיִם'), 'Mimmitsrayim');
  // A name's first letter after a prefix is capitalized, not doubled (note 4: HaYogev).
  const named = load();
  vm.runInContext(fs.readFileSync('apps-script/server/proper-names.gs', 'utf8'), named);
  assert.equal(named.transliterateHebrewText('וַיֵּצֵא מִמִּצְרַיִם', 'bgn_pcgn', { overrideMap: {} }), 'Vayyetse miMitsrayim');
});

test('ALA-LC: the Library of Congress table and its rules', () => {
  const lc = (text) => std(text, 'ala_lc');
  assert.equal(lc('הִסְהִיד'), 'His\u02B9hid'); // the prime between two letters, not a digraph
  assert.equal(lc('הַמִּלּוֹן הֶחָדָשׁ'), 'Ha-milon he-\u1E25adash'); // the table's ha-Milon he-ḥadash
  assert.equal(lc('קִרְיַת סֵפֶר'), '\u1E32iryat sefer');
  assert.equal(lc('וְהָאָרֶץ'), '\u1E7Ee-ha-arets'); // conjunction and article; the alef after them disregarded
  assert.equal(lc('הָעוֹלָם'), 'Ha-\u02BBolam');
  assert.equal(lc('וּמִצְוֹתָיו'), 'U-mits\u1E7Fota\u1E7F'); // the conjunction as shuruk
  assert.equal(std('אֶת־יְהוָה', 'ala_lc', { divineName: 'Adonai' }), 'Et-Adonai'); // a maqaf, not a prefix: one hyphen
  assert.equal(lc('מִצְוֹתָיו'), 'Mits\u1E7Fota\u1E7F'); // a consonantal vav is ṿ
  assert.equal(lc('יִשְׂרָאֵל'), 'Yi\u015Bra\u02BCel'); // ś, and a medial alef ʼ
  assert.equal(lc('חָכְמָה'), '\u1E24okhmah'); // kamatz katan o
  // be-, le-, ke- are left alone: the pointing cannot tell them from a word's first letter.
  assert.equal(lc('בְּרֵאשִׁית'), 'Bereshit');
  // Doubling follows "Double dagesh chazak", which the Library of Congress leaves off.
  assert.equal(lc('שַׁבָּת'), 'Shabat');
  assert.equal(std('שַׁבָּת', 'ala_lc', { dageshMode: 'forte' }), 'Shabbat');
  // A prefix before the Name keeps its hyphen.
  assert.equal(std('לַיהוָה', 'ala_lc', { divineName: 'Adonai' }), 'La-Adonai');
});
