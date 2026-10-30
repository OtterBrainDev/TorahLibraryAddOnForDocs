// Pins three fixes in apps-script/server/text-processing.gs, all reported in
// the 2026-08 pre-upstream review (docs/pre-upstream-review.md §3.8):
//
//   1. The יה replacement matched inside words: יהודה became קהודה. It now
//      matches יה only as a whole word.
//   2. User-entered replacement text went through String.replace as a
//      pattern, so `$&` or `$1` in it expanded instead of appearing literally.
//   3. Stripping niqqud also stripped paseq, sof pasuq and nun hafukha, which
//      are punctuation.
//
// Loaded with vm.runInContext; see AGENTS.md hard rule #3.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, '../../apps-script/server/text-processing.gs'), 'utf8');

function load(props) {
  const userProperties = {
    getProperty: (name) => (Object.prototype.hasOwnProperty.call(props, name) ? props[name] : null),
  };
  const context = { console, Logger: { log() {} } };
  vm.createContext(context);
  vm.runInContext(SOURCE, context, { filename: 'text-processing.gs' });
  return { context, userProperties };
}

function replaceHebrew(he, props) {
  const { context, userProperties } = load(Object.assign({ apply_sheimot_on_insertion: 'true' }, props));
  return context.applyDivineNameReplacements({ he }, userProperties).he;
}

const YAW = { yaw_replace: 'true', yaw_replacement: 'קה' };

test('יה is replaced as a whole word, with or without vowels', () => {
  assert.equal(replaceHebrew('כי יה', YAW), 'כי קה');
  assert.equal(replaceHebrew('בְּיָהּ שְׁמוֹ', YAW), 'בְּיָהּ שְׁמוֹ'); // prefixed: not a whole word
  assert.equal(replaceHebrew('עָזִּי וְזִמְרָת יָהּ', YAW), 'עָזִּי וְזִמְרָת קָהּ');
  assert.equal(replaceHebrew('יָהּ.', YAW), 'קָהּ.');
});

test('יה at the start or end of a longer word is left alone', () => {
  ['יהודה', 'יְהוּדָה', 'יהושע', 'יהי אור', 'היה', 'אליה'].forEach((word) => {
    assert.equal(replaceHebrew(word, YAW), word, word);
  });
});

test('maqaf, paseq and sof pasuq end a word, so הללו־יה still matches', () => {
  assert.equal(replaceHebrew('הַלְלוּ־יָהּ', YAW), 'הַלְלוּ־קָהּ');
  assert.equal(replaceHebrew('יָהּ׃', YAW), 'קָהּ׃');
});

test('replacement text is inserted literally', () => {
  assert.equal(
    replaceHebrew('יְהוָה', { meforash_replace: 'true', meforash_replacement: '$&-$1' }),
    '$&-$1'
  );
  assert.equal(replaceHebrew('יה', { yaw_replace: 'true', yaw_replacement: '$`' }), '$`');
  const { context, userProperties } = load({
    apply_sheimot_on_insertion: 'true', god_replace: 'true', god_replacement: 'G$&d',
  });
  assert.equal(context.applyDivineNameReplacements({ text: 'God' }, userProperties).text, 'G$&d');
});

test('the four-letter names still match with a prefix', () => {
  assert.equal(
    replaceHebrew('לַיהוָה', { meforash_replace: 'true', meforash_replacement: 'יי' }),
    'לַייָ'
  );
});

test('stripping niqqud keeps paseq, sof pasuq and nun hafukha', () => {
  const { context } = load({});
  const filters = { nekudotEnabled: false, teamimEnabled: true, nekudotFilter: 'always', teamimFilter: 'available' };
  const input = 'בְּרֵאשִׁית ׀ בָּרָא׃ ׆';
  const out = context.applyHebrewTextDisplayPreferences(input, 'Tanakh', filters);

  assert.equal(out, 'בראשית ׀ ברא׃ ׆');
  // Shin and sin dots are still vowel-class marks and still go.
  assert.ok(!/[ׁׂ]/.test(out));
});

// ── The substitute keeps the name's vowels and cantillation ───────────────
//
// A substitute used to be inserted bare, so in a pointed verse the Name lost
// its niqqud and its ta'am (יְהוָ֥ה -> יי). markDivineNameSubstitute_ puts
// them on the substitute's letters.

const MEFORASH = (replacement) => ({ meforash_replace: 'true', meforash_replacement: replacement });
const ELODIM = (replacement) => ({ elodim_replace: 'true', elodim_replacement: replacement });

test('יי takes the vowels of the Name\'s first and third letters, and its cantillation', () => {
  assert.equal(replaceHebrew('יְהוָ֥ה', MEFORASH('יי')), 'יְיָ֥');
  assert.equal(replaceHebrew('יְהֹוָ֥ה', MEFORASH('יי')), 'יְיָ֥');
  // Read as Elohim (אֲדֹנָי יֱהֹוִה).
  assert.equal(replaceHebrew('יֱהֹוִה', MEFORASH('יי')), 'יֱיִ');
});

test('a substitute spelled like the name takes its vowels letter for letter', () => {
  assert.equal(replaceHebrew('יְהֹוָ֥ה', MEFORASH('יקוק')), 'יְקֹוָ֥ק');
  assert.equal(replaceHebrew('יָ֑הּ', YAW), 'קָ֑הּ');
  assert.equal(replaceHebrew('אֱלֹהִ֑ים', ELODIM('אלקים')), 'אֱלֹקִ֑ים');
  assert.equal(replaceHebrew('אֱלוֹהִים', ELODIM('אלוקים')), 'אֱלוֹקִים');
});

test('a longer spelling\'s new ו carries the holam: אֱלֹהִים -> אֱלוֹקִים', () => {
  assert.equal(replaceHebrew('אֱלֹהִ֑ים', ELODIM('אלוקים')), 'אֱלוֹקִ֑ים');
  assert.equal(replaceHebrew('וַיֹּ֣אמֶר אֱלֹהִ֔ים', ELODIM('אלודים')), 'וַיֹּ֣אמֶר אֱלוֹדִ֔ים');
});

test('אלהים is replaced without the ו too, as Transform Divine Names does', () => {
  assert.equal(replaceHebrew('בָּרָ֣א אֱלֹהִ֑ים', ELODIM('אלוקים')), 'בָּרָ֣א אֱלוֹקִ֑ים');
  assert.equal(replaceHebrew('האלהים', ELODIM('אלוקים')), 'האלוקים');
  // Not a word that only starts like it.
  assert.equal(replaceHebrew('אֱלֹהֵ֖ינוּ', ELODIM('אלוקים')), 'אֱלֹהֵ֖ינוּ');
});

test('a substitute that is another word keeps the cantillation only', () => {
  assert.equal(replaceHebrew('יְהוָ֥ה', MEFORASH("ה'")), "ה֥'");
  assert.equal(replaceHebrew('יְהוָ֥ה', MEFORASH('השם')), 'הש֥ם');
  // On the letter in the same place: יָ֑הּ's etnahta is on its first letter.
  assert.equal(replaceHebrew('הַלְלוּ־יָ֑הּ', { yaw_replace: 'true', yaw_replacement: 'השם' }), 'הַלְלוּ־ה֑שם');
});

test('only the marks the name has: the display filters\' choices stand', () => {
  assert.equal(replaceHebrew('יהוה', MEFORASH('יי')), 'יי');
  assert.equal(replaceHebrew('יְהוָה', MEFORASH('יי')), 'יְיָ'); // cantillation off
  assert.equal(replaceHebrew('יהו֥ה', MEFORASH('יי')), 'יי֥'); // vowels off
});

test('a substitute typed with its own marks keeps them', () => {
  assert.equal(replaceHebrew('יְהוָ֥ה', MEFORASH('יְיָ')), 'יְיָ֥');
  assert.equal(replaceHebrew('יְהוָ֥ה', MEFORASH('יְיָ֑')), 'יְיָ֑');
  assert.equal(replaceHebrew('יְהוָ֥ה', MEFORASH('HaShem')), 'HaShem');
});

test('dagesh, mapiq and the shin dot stay only on their own letter', () => {
  const { context } = load({});
  // ה's mapiq stays on ה; it is not moved onto a ק.
  assert.equal(context.markDivineNameSubstitute_('יָהּ', 'קה'), 'קָהּ');
  assert.equal(context.markDivineNameSubstitute_('יָהּ', 'יק'), 'יָק');
  assert.equal(context.markDivineNameSubstitute_('שָׁלוֹם', 'סלום'), 'סָלוֹם');
});

test('the punctuation after the Name is kept: sof pasuq and maqaf', () => {
  assert.equal(replaceHebrew('אֶת־יְהוָֽה׃', MEFORASH('יי')), 'אֶת־יְיָֽ׃');
  assert.equal(replaceHebrew('יְהוָה־אֱלֹהִים', MEFORASH('יי')), 'יְיָ־אֱלֹהִים');
});

// Quick Actions -> Transform Divine Names: the same substitute, in the document.
test('Transform Divine Names keeps the vowels and cantillation as well', () => {
  const context = { console, Logger: { log() {} } };
  vm.createContext(context);
  for (const file of ['server/text-processing.gs', 'server/document-actions.gs']) {
    vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../apps-script', file), 'utf8'), context, { filename: file });
  }
  let content = 'וַיְדַבֵּ֥ר יְהוָ֖ה אֶל־מֹשֶׁ֥ה וְאֶת־יְהוָֽה׃ אֱלֹהִ֑ים';
  const textElement = {
    getType: () => 'TEXT',
    asText: () => textElement,
    getText: () => content,
    getAttributes: () => ({}),
    getLinkUrl: () => null,
    deleteText: (s, e) => { content = content.slice(0, s) + content.slice(e + 1); },
    insertText: (s, str) => { content = content.slice(0, s) + str + content.slice(s); },
    setAttributes() {},
    setLinkUrl() {},
  };
  context.DocumentApp = {
    ElementType: { TEXT: 'TEXT' },
    getActiveDocument: () => ({ getBody: () => ({ getType: () => 'BODY', getNumChildren: () => 1, getChild: () => textElement }) }),
    // It asks before changing anything (transform-scope.test.js); answer Yes.
    getUi: () => ({ Button: { YES: 'YES' }, ButtonSet: { YES_NO: 'YES_NO' }, alert: () => 'YES' }),
  };
  context.getPreferences = () => ({
    meforash_replace: 'true', meforash_replacement: 'יי', elodim_replace: 'true', elodim_replacement: 'אלוקים',
  });
  context.transformDivineNames();
  // After a maqaf too (אֶת־יְהוָה), which the Quick Action used to skip, and
  // the sof pasuq after the Name is kept.
  assert.equal(content, 'וַיְדַבֵּ֥ר יְיָ֖ אֶל־מֹשֶׁ֥ה וְאֶת־יְיָֽ׃ אֱלוֹקִ֑ים');
});
