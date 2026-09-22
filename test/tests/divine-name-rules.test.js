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
  assert.equal(replaceHebrew('עָזִּי וְזִמְרָת יָהּ', YAW), 'עָזִּי וְזִמְרָת קה');
  assert.equal(replaceHebrew('יָהּ.', YAW), 'קה.');
});

test('יה at the start or end of a longer word is left alone', () => {
  ['יהודה', 'יְהוּדָה', 'יהושע', 'יהי אור', 'היה', 'אליה'].forEach((word) => {
    assert.equal(replaceHebrew(word, YAW), word, word);
  });
});

test('maqaf, paseq and sof pasuq end a word, so הללו־יה still matches', () => {
  assert.equal(replaceHebrew('הַלְלוּ־יָהּ', YAW), 'הַלְלוּ־קה');
  assert.equal(replaceHebrew('יָהּ׃', YAW), 'קה׃');
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
    'לַיי'
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
