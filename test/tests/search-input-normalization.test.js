// Pins the client-side query normalization helpers in
// apps-script/sidebar/js/search-utils.html.
//
// These run on EVERY search: `inputExpanded` feeds the /api/name lookup, the
// direct-reference resolve, and the content search. A normalization bug here
// silently returns zero results for a perfectly valid query rather than
// failing loudly, which is why it earns a pinning test.
//
// Loaded with vm.runInThisContext rather than require() — these are `<script>`
// bodies inside an Apps Script HTML partial, not Node modules. See AGENTS.md
// hard rule #3.

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

const ROOT = path.resolve(__dirname, '..', '..');
const SEARCH_UTILS = path.join(ROOT, 'apps-script/sidebar/js/search-utils.html');

function loadFunction(name) {
  const html = fs.readFileSync(SEARCH_UTILS, 'utf8');
  const match = html.match(new RegExp(`function ${name}\\b[\\s\\S]*?\\n}`));
  assert.ok(match, `Could not find function ${name} in search-utils.html`);
  return vm.runInThisContext(`(${match[0]})`);
}

test('expandShevaApostrophe vocalizes transliterated sheva', () => {
  const expand = loadFunction('expandShevaApostrophe');

  // Word-initial 1-2 consonants + apostrophe is the transliterated sheva.
  assert.equal(expand("P'sukei D'Zimra"), 'Pesukei DeZimra');
  assert.equal(expand("B'reishit"), 'Bereishit');
  assert.equal(expand("Sh'ma"), 'Shema');
  assert.equal(expand("K'tubot"), 'Ketubot');
  assert.equal(expand("Tz'enah"), 'Tzeenah');
});

test('expandShevaApostrophe leaves English possessives and contractions alone', () => {
  const expand = loadFunction('expandShevaApostrophe');

  // Regression: the un-anchored rule turned these into "A Womanes Commentary",
  // "Jacobes Ladder" and "donet", so the query never matched anything.
  assert.equal(expand("A Woman's Commentary"), "A Woman's Commentary");
  assert.equal(expand("The Torah: A Women's Commentary"), "The Torah: A Women's Commentary");
  assert.equal(expand("Jacob's Ladder"), "Jacob's Ladder");
  assert.equal(expand("Israel's kings"), "Israel's kings");
  assert.equal(expand("don't"), "don't");

  // Already unaffected (vowel before the apostrophe), but pin it so a future
  // rewrite of the rule cannot break it either.
  assert.equal(expand("Rashi's commentary"), "Rashi's commentary");
});

test('expandShevaApostrophe handles empty and non-string input', () => {
  const expand = loadFunction('expandShevaApostrophe');

  assert.equal(expand(''), '');
  assert.equal(expand(null), '');
  assert.equal(expand(undefined), '');
});

test('applyConsonantClusterVoweling only touches word-initial clusters', () => {
  const vowel = loadFunction('applyConsonantClusterVoweling');

  assert.equal(vowel('Bshalach'), 'Beshalach');
  // Digraphs are left alone so Shema / Chanukah survive.
  assert.equal(vowel('Shema'), 'Shema');
  assert.equal(vowel('Chanukah'), 'Chanukah');
  // Standard English clusters (second letter r/l) are left alone.
  assert.equal(vowel('Prayer'), 'Prayer');
  assert.equal(vowel('Blessing'), 'Blessing');
});

// ---------------------------------------------------------------------------
// Zero-results suggestions
// ---------------------------------------------------------------------------
//
// When a search returns nothing, the sidebar offers "Did you mean" titles. The
// original pass only considered titles beginning with the same letter as the
// query, so a fragment from the middle of a title produced a dead end. These
// tests pin the fragment case without letting the suggester become so loose it
// guesses at the user's intent.

function loadSuggester(titles) {
  const html = fs.readFileSync(SEARCH_UTILS, 'utf8');
  const context = { console, titles, MAX_FUZZY_SUGGESTIONS: 5 };
  vm.createContext(context);

  // Module-level constants the functions close over.
  [/var FUZZY_STOPWORDS_ = \{[^}]*\};/, /var HILCHOT_ABBREVIATIONS_CLIENT_ = \[[^\]]*\];/]
    .forEach((pattern) => {
      const match = html.match(pattern);
      assert.ok(match, `expected ${pattern} in search-utils.html`);
      vm.runInContext(match[0], context);
    });

  [
    'normalizeFuzzyText', 'splitReferenceForFuzzy', 'levenshteinDistance',
    'isLikelyHebrewScriptInput', 'canonicalizeCitationAbbreviation',
    'fuzzyTokens_', 'fuzzyTokenMatches_', 'getTokenOverlapSuggestions_',
    'getPartialOverlapSuggestions_', 'getFuzzyReferenceSuggestions',
  ].forEach((name) => {
    const match = html.match(new RegExp(`function ${name}\\b[\\s\\S]*?\\n}`));
    assert.ok(match, `Could not find function ${name}`);
    vm.runInContext(match[0], context);
  });
  return context;
}

const CATALOGUE = [
  'Genesis',
  'Exodus',
  'The Torah: A Women’s Commentary',
  'Rashi on Genesis',
  'Berakhot',
  'Bava Metzia',
  'Mishneh Torah, Shabbat',
];

test('a fragment from the middle of a title is suggested, not a dead end', () => {
  const { getFuzzyReferenceSuggestions } = loadSuggester(CATALOGUE);

  // The regression: singular "Woman's" vs the catalogue's plural "Women's",
  // and a query that is not the START of the title.
  const suggestions = getFuzzyReferenceSuggestions("A Woman's Commentary");

  assert.ok(
    suggestions.some((s) => s.indexOf('Women’s Commentary') >= 0),
    `expected the Women's Commentary title, got ${JSON.stringify(suggestions)}`
  );
});

test('suggestions stay bounded and never echo the query back', () => {
  const { getFuzzyReferenceSuggestions } = loadSuggester(CATALOGUE);

  const suggestions = getFuzzyReferenceSuggestions('Genesis');
  assert.ok(suggestions.length <= 5);
  assert.ok(!suggestions.some((s) => s.toLowerCase() === 'genesis'));
});

test('a chapter/verse suffix is carried onto each suggestion', () => {
  const { getFuzzyReferenceSuggestions } = loadSuggester(CATALOGUE);

  const suggestions = getFuzzyReferenceSuggestions('Genesys 1:1');
  assert.ok(suggestions.length > 0, 'expected a typo suggestion');
  assert.ok(
    suggestions.every((s) => s.endsWith(' 1:1')),
    `expected the 1:1 suffix preserved, got ${JSON.stringify(suggestions)}`
  );
});

test('unrelated prose does not produce suggestions', () => {
  const { getFuzzyReferenceSuggestions } = loadSuggester(CATALOGUE);

  // Over-suggesting is its own failure: it guesses at intent the user did not
  // express. Nothing in the catalogue shares tokens with this.
  assert.deepEqual(Array.from(getFuzzyReferenceSuggestions('qqqq zzzz')), []);
});

test('stopwords alone never match a title', () => {
  const { fuzzyTokens_ } = loadSuggester(CATALOGUE);

  // Array.from: values built inside the vm context have that realm's Array
  // prototype, which strict deepEqual treats as a different type.
  assert.deepEqual(Array.from(fuzzyTokens_('the a of on')), []);
  assert.deepEqual(Array.from(fuzzyTokens_('a womans commentary')), ['womans', 'commentary']);
});

// ---------------------------------------------------------------------------
// Traditional citation forms in the suggester
// ---------------------------------------------------------------------------
//
// "Hil. Avodah Zarah 12:11" is a different failure from a typo or a fragment:
// it is a whole different naming convention. Sefaria files that section as
// "Mishneh Torah, Hilchot Avodah Kochavim" — so "Hil." has to be canonicalized
// before any token can match, and "Zarah" will never match "Kochavim", which is
// why a partial-overlap pass is needed and an all-tokens pass is not enough.

const RAMBAM_CATALOGUE = [
  'Genesis',
  'Avodah Zarah',                            // the Talmud tractate — a real title
  'Mishna Avodah Zarah',
  'Mishneh Torah, Hilchot Avodah Kochavim',  // what the reader actually wants
  'Rambam, Hilchot Avodah Kochavim',         // same section, alternate name
  'Mishneh Torah, Hilchot Shabbat',
  'Rambam, Hilchot Shabbat',
  'Berakhot',
];

function loadRambamSuggester() {
  return loadSuggester(RAMBAM_CATALOGUE);
}

test('an abbreviated Rambam citation suggests the right section first', () => {
  const { getFuzzyReferenceSuggestions } = loadRambamSuggester();

  const suggestions = Array.from(getFuzzyReferenceSuggestions('Hil. Avodah Zarah 12:11'));

  assert.equal(
    suggestions[0],
    'Mishneh Torah, Hilchot Avodah Kochavim 12:11',
    `expected the Rambam section ranked first, got ${JSON.stringify(suggestions)}`
  );
});

test('the Talmud tractate is still offered, just not first', () => {
  const { getFuzzyReferenceSuggestions } = loadRambamSuggester();

  // "Avodah Zarah" is a legitimate reading of the query — the reader might mean
  // the tractate. Suppressing it would be assuming intent just as surely as
  // ranking it first would.
  const suggestions = Array.from(getFuzzyReferenceSuggestions('Hil. Avodah Zarah 12:11'));

  assert.ok(
    suggestions.includes('Avodah Zarah 12:11'),
    `expected the tractate to still be offered: ${JSON.stringify(suggestions)}`
  );
});

test('one section is never offered twice under two work names', () => {
  const { getFuzzyReferenceSuggestions } = loadRambamSuggester();

  const suggestions = Array.from(getFuzzyReferenceSuggestions('Hil. Shabbat 1:1'));

  assert.deepEqual(suggestions, ['Mishneh Torah, Hilchot Shabbat 1:1']);
});

test('the partial pass does not fire when a tighter pass already matched', () => {
  const { getFuzzyReferenceSuggestions } = loadRambamSuggester();

  // "Berakhot" matches exactly, so the loose pass must stay out of the way
  // rather than padding the list with weakly-related titles.
  const suggestions = Array.from(getFuzzyReferenceSuggestions('Berakhos'));

  assert.ok(suggestions.includes('Berakhot'), JSON.stringify(suggestions));
  assert.ok(suggestions.length <= 2, `too loose: ${JSON.stringify(suggestions)}`);
});

test('a single shared token is not enough to suggest a title', () => {
  const { getPartialOverlapSuggestions_ } = loadRambamSuggester();

  // Otherwise every "Mishneh Torah, Hilchot ..." section surfaces for any
  // Rambam query, which is noise dressed up as help.
  const results = Array.from(getPartialOverlapSuggestions_('hilchot', false));
  assert.equal(results.length, 0, JSON.stringify(results));
});
