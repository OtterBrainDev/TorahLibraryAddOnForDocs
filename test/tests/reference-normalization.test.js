// Pins normalizeReferenceInput and stripHebrewNumeralMarks_ (sefaria-fetch.gs).
//
// This file exists because of a recurring bug SHAPE, not a single bug. Three
// times now, a normalization applied to raw user input has been over-broad and
// destroyed something meaningful:
//
//   - expandShevaApostrophe rewrote "A Woman's Commentary" as "A Womanes
//     Commentary" (fixed; see search-input-normalization.test.js)
//   - normalizeReferenceInput stripped the gershayim out of רמב״ם, leaving
//     רמבם, which is not a word in any catalogue
//   - applyConsonantClusterVoweling turned "Psalms" into "Pesalms"
//
// Each failed SILENTLY: the query simply returned nothing, which reads to the
// user as "Sefaria doesn't have it" rather than "we mangled your query".
//
// The rule these tests enforce: a normalization may make characters CONSISTENT,
// but anything lossy must be offered as an ADDITIONAL candidate, never
// substituted for what the reader typed.
//
// Loaded with vm.runInContext; .gs is not a Node module format.
// See AGENTS.md hard rule #3.

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, '../../apps-script/server/sefaria-fetch.gs'),
  'utf8'
);

function load() {
  const context = { console, Logger: { log() {} } };
  vm.createContext(context);
  ['normalizeReferenceInput', 'stripHebrewNumeralMarks_'].forEach((name) => {
    const match = SOURCE.match(new RegExp(`function ${name}\\b[\\s\\S]*?\\n}`));
    assert.ok(match, `Could not find ${name}`);
    vm.runInContext(match[0], context);
  });
  return context;
}

test('a Hebrew abbreviation keeps its gershayim', () => {
  const { normalizeReferenceInput } = load();

  // רמב״ם is Rambam and ב״מ is Bava Metzia. The gershayim IS the abbreviation;
  // removing it leaves רמבם and במ, which match nothing. Sefaria registers the
  // straight-quote spelling, so unifying the character is right — deleting it
  // is not.
  assert.equal(normalizeReferenceInput('רמב״ם'), 'רמב"ם');
  assert.equal(normalizeReferenceInput('ב״מ 59b'), 'ב"מ 59b');
  assert.equal(normalizeReferenceInput('רמב״ם, הלכות שבת'), 'רמב"ם, הלכות שבת');
});

test('an English title keeps the space after its colon', () => {
  const { normalizeReferenceInput } = load();

  // An unconditional collapse rewrote this as "The Torah:A Women's Commentary".
  assert.equal(
    normalizeReferenceInput('The Torah: A Women’s Commentary'),
    "The Torah: A Women's Commentary"
  );
  assert.equal(
    normalizeReferenceInput('Sefer HaChinukh — Introduction'),
    'Sefer HaChinukh - Introduction'
  );
});

test('a numeric range still tightens', () => {
  const { normalizeReferenceInput } = load();

  // The collapse has a real job; it just has to be confined to numerals.
  assert.equal(normalizeReferenceInput('Genesis 1:1 - 1:5'), 'Genesis 1:1-1:5');
  assert.equal(normalizeReferenceInput('Genesis 1 : 1'), 'Genesis 1:1');
});

test('ordinary references pass through untouched', () => {
  const { normalizeReferenceInput } = load();

  ['Genesis 1:1', 'Rashi on Genesis 1:1', 'Mishneh Torah, Hilchot Shabbat 1:1', 'Berakhot 2a']
    .forEach((reference) => {
      assert.equal(normalizeReferenceInput(reference), reference);
    });
});

test('invisible bidi controls are removed', () => {
  const { normalizeReferenceInput } = load();

  // These carry no reference meaning and break exact matching.
  assert.equal(normalizeReferenceInput('‎Genesis‏ 1:1'), 'Genesis 1:1');
});

test('stripping numeral marks is offered separately, not imposed', () => {
  const { normalizeReferenceInput, stripHebrewNumeralMarks_ } = load();

  // ל״ב is the numeral 32 and resolves bare; ב״מ is an abbreviation and does
  // not. Nothing distinguishes them by shape, which is exactly why the stripped
  // form is an extra candidate rather than the query.
  assert.equal(stripHebrewNumeralMarks_(normalizeReferenceInput('בראשית ל״ב:ד׳')), 'בראשית לב:ד');
  assert.equal(stripHebrewNumeralMarks_(normalizeReferenceInput('בראשית א׳:א׳')), 'בראשית א:א');

  // Returns '' when it would change nothing, so callers can skip a duplicate
  // lookup rather than issuing the same request twice.
  assert.equal(stripHebrewNumeralMarks_('Genesis 1:1'), '');
  assert.equal(stripHebrewNumeralMarks_(''), '');
});

test('handles empty and non-string input', () => {
  const { normalizeReferenceInput } = load();

  assert.equal(normalizeReferenceInput(''), '');
  assert.equal(normalizeReferenceInput(null), '');
  assert.equal(normalizeReferenceInput(undefined), '');
  assert.equal(normalizeReferenceInput('   '), '');
});
