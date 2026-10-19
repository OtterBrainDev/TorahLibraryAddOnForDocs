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
  [
    /var FUZZY_STOPWORDS_ = \{[^}]*\};/,
    /var HILCHOT_ABBREVIATIONS_CLIENT_ = \[[^\]]*\];/,
    /var fuzzyTitleIndexCache_ = [^\n]*;/,
  ]
    .forEach((pattern) => {
      const match = html.match(pattern);
      assert.ok(match, `expected ${pattern} in search-utils.html`);
      vm.runInContext(match[0], context);
    });

  [
    'normalizeFuzzyText', 'splitReferenceForFuzzy', 'levenshteinDistance', 'levenshteinWithin_',
    'getFuzzyTitleIndex_', 'buildQueryTokenMatchSets_', 'titleHasTokenIn_',
    'fuzzyCharHistogram_', 'fuzzyHistogramLowerBound_',
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

// ---------------------------------------------------------------------------
// Consonant-cluster voweling
// ---------------------------------------------------------------------------
//
// "Bshalach" -> "Beshalach" is the point. But nothing distinguishes a
// transliterated sheva from an ordinary English onset cluster by shape, so the
// same rule produces "Pesalms" and "Setone Edition". It is therefore used as a
// FALLBACK for the title lookup, never as the query — see the comment at its
// call site in search-controller.html.

test('consonant voweling expands transliterated sheva', () => {
  const vowel = loadFunction('applyConsonantClusterVoweling');

  assert.equal(vowel('Bshalach'), 'Beshalach');
  assert.equal(vowel('Ktubot'), 'Ketubot');
  assert.equal(vowel('Dvarim'), 'Devarim');
  assert.equal(vowel('Bmidbar'), 'Bemidbar');
});

test('consonant voweling is known to over-fire on English words', () => {
  const vowel = loadFunction('applyConsonantClusterVoweling');

  // Pinned as a KNOWN LIMITATION rather than a bug: "Psalms" is one of the most
  // searched titles in the library, and this rule mangles it. That is safe only
  // because the lookup tries the reader's own spelling first and reaches for
  // this form only when that returns nothing. If anyone ever makes this the
  // primary query again, these assertions are the reason not to.
  assert.equal(vowel('Psalms'), 'Pesalms');
  assert.equal(vowel('Stone Edition'), 'Setone Edition');

  // Digraphs and r/l clusters are already excluded.
  assert.equal(vowel('Shema'), 'Shema');
  assert.equal(vowel('Chanukah'), 'Chanukah');
  assert.equal(vowel('Prayer'), 'Prayer');
  assert.equal(vowel('Blessing'), 'Blessing');
});

// ---------------------------------------------------------------------------
// Punctuation-blind title matching
// ---------------------------------------------------------------------------
//
// Sefaria's title is "The Torah; A Women's Commentary" — a SEMICOLON. The direct
// lookup used to match titles case-insensitively but punctuation-exactly, so the
// only query that reached Deuteronomy 29:9-14 was the one with the semicolon
// typed exactly; a comma, a colon, or no punctuation at all found nothing.

const WOMENS_COMMENTARY_CATALOGUE = [
  'Genesis',
  'Deuteronomy',
  'The Torah; A Women\'s Commentary',
  'The Torah; A Women\'s Commentary, Genesis',
  'The Torah; A Women\'s Commentary, Deuteronomy',
  'Rashi on Deuteronomy',
  'Berakhot',
  'Pirkei Avot',
];

function loadTitleMatcher(titles) {
  const html = fs.readFileSync(SEARCH_UTILS, 'utf8');
  const context = loadSuggester(titles);
  [
    /var LOOSE_KEY_DROP_RE_ = [^\n]*;/,
    /var LOOSE_KEY_WORD_RE_ = [^\n]*;/,
    /var LOOSE_KEY_DROP_ALL_RE_ = [^\n]*;/,
    /var LOOSE_KEY_BREAK_ALL_RE_ = [^\n]*;/,
    /var looseTitleIndexCache_ = [^\n]*;/,
  ].forEach((pattern) => {
    const match = html.match(pattern);
    assert.ok(match, `expected ${pattern} in search-utils.html`);
    vm.runInContext(match[0], context);
  });
  [
    'expandShevaApostrophe', 'buildLooseTitleKey_', 'looseTitleKey_', 'getLooseTitleIndex_',
    'getLoosePrefixTitleMatches', 'normalizeLatinLookupTitleCase',
    'buildFuzzyLibraryMatches', 'mergeLibraryMatchesWithFuzzy',
  ].forEach((name) => {
    const match = html.match(new RegExp(`function ${name}\\b[\\s\\S]*?\\n}`));
    assert.ok(match, `Could not find function ${name}`);
    vm.runInContext(match[0], context);
  });
  return context;
}

test('the loose key ignores case, apostrophes and punctuation', () => {
  const { buildLooseTitleKey_ } = loadTitleMatcher(WOMENS_COMMENTARY_CATALOGUE);

  const expected = 'the torah a womens commentary deuteronomy';
  [
    "The Torah; A Women's Commentary, Deuteronomy",
    'The Torah, A Women’s Commentary, Deuteronomy',
    'the torah: a womens commentary deuteronomy',
    '  The   Torah -- A Women\'s Commentary; Deuteronomy.  ',
  ].forEach((input) => assert.equal(buildLooseTitleKey_(input).key, expected, input));
});

test('the fast title key agrees with the offset-mapping one', () => {
  const { buildLooseTitleKey_, looseTitleKey_ } = loadTitleMatcher(WOMENS_COMMENTARY_CATALOGUE);

  [
    "The Torah; A Women's Commentary, Deuteronomy",
    '  a \' b -- c.d  ',
    "Rashi's commentary: 1:1-2:3",
    'Café Élite',
    'בְּרֵאשִׁית א׳:ב״',
    'Mishneh Torah, Hilchot Shabbat',
    '',
    ' ;; ',
  ].forEach((input) => assert.equal(looseTitleKey_(input), buildLooseTitleKey_(input).key, JSON.stringify(input)));
});

test('the direct lookup rewrites any punctuation of the title to the catalogue spelling', () => {
  const { normalizeLatinLookupTitleCase } = loadTitleMatcher(WOMENS_COMMENTARY_CATALOGUE);

  const canonical = "The Torah; A Women's Commentary, Deuteronomy";
  [
    ["The Torah; A Women's Commentary, Deuteronomy 29 9-14", `${canonical} 29 9-14`],
    ["The Torah, A Women's Commentary, Deuteronomy 29 9-14", `${canonical} 29 9-14`],
    ["The Torah A Women's Commentary, Deuteronomy 29 9-14", `${canonical} 29 9-14`],
    ['the torah a womens commentary deuteronomy 29:9-14', `${canonical} 29:9-14`],
    ['The Torah: A Women’s Commentary, Deuteronomy 29:9', `${canonical} 29:9`],
  ].forEach(([input, expected]) => assert.equal(normalizeLatinLookupTitleCase(input), expected, input));
});

test('the direct lookup keeps its existing behavior for plain titles', () => {
  const { normalizeLatinLookupTitleCase } = loadTitleMatcher(WOMENS_COMMENTARY_CATALOGUE);

  assert.equal(normalizeLatinLookupTitleCase('genesis 1:1'), 'Genesis 1:1');
  assert.equal(normalizeLatinLookupTitleCase('Genesis'), 'Genesis');
  assert.equal(normalizeLatinLookupTitleCase('pirkei avot 1:1'), 'Pirkei Avot 1:1');
  // A title must end on a word boundary: "Genesisx" is not "Genesis" + "x".
  assert.equal(normalizeLatinLookupTitleCase('Genesisx 1:1'), 'Genesisx 1:1');
  // Nothing in the catalogue: left exactly as typed.
  assert.equal(normalizeLatinLookupTitleCase('love your neighbor'), 'love your neighbor');
  // Hebrew is out of scope for this rewrite.
  assert.equal(normalizeLatinLookupTitleCase('בראשית א:א'), 'בראשית א:א');
});

test('as-you-type title matches ignore punctuation', () => {
  const { getLoosePrefixTitleMatches } = loadTitleMatcher(WOMENS_COMMENTARY_CATALOGUE);

  const matches = Array.from(getLoosePrefixTitleMatches(['The Torah A Womens Comm'], 6));
  assert.ok(matches.includes("The Torah; A Women's Commentary"), JSON.stringify(matches));
  assert.ok(matches.includes("The Torah; A Women's Commentary, Deuteronomy"), JSON.stringify(matches));
  assert.equal(Array.from(getLoosePrefixTitleMatches(['The Torah A Womens Comm'], 2)).length, 2);
  assert.deepEqual(Array.from(getLoosePrefixTitleMatches(['', '  ;  '], 6)), []);
});

test('a misspelled title is offered as a close-match row with its section kept', () => {
  const { buildFuzzyLibraryMatches } = loadTitleMatcher(WOMENS_COMMENTARY_CATALOGUE);

  const rows = Array.from(buildFuzzyLibraryMatches('The Torah A Womans Comentary, Deuteronomy 29:9-14'));
  assert.ok(rows.length > 0, 'expected a close match');
  assert.equal(rows[0].ref, "The Torah; A Women's Commentary, Deuteronomy 29:9-14");
  assert.ok(rows.every((row) => row.isFuzzy && row.clusterLabel === 'Close matches'));
  assert.deepEqual(Array.from(buildFuzzyLibraryMatches('Ge')), []);
});

test('close matches stay behind the exact results and never duplicate them', () => {
  const { mergeLibraryMatchesWithFuzzy } = loadTitleMatcher(WOMENS_COMMENTARY_CATALOGUE);

  const exact = [{ ref: 'Genesis 1:1' }, { ref: 'Genesis' }, { ref: 'Genesis Rabbah' }];
  const fuzzy = [
    { ref: 'genesis 1:1', isFuzzy: true },
    { ref: 'Genesys', isFuzzy: true },
  ];
  // A previous merge's close matches are dropped from the input and re-added
  // at the end, so repeated merges do not accumulate them.
  const merged = Array.from(mergeLibraryMatchesWithFuzzy(exact.concat(fuzzy), fuzzy, 2));
  assert.deepEqual(merged.map((item) => item.ref), ['Genesis 1:1', 'Genesis', 'Genesys']);
});

// ---------------------------------------------------------------------------
// The field is not rewritten while the reader types
// ---------------------------------------------------------------------------

test('the as-you-type search does not write the normalized query back into the field', () => {
  const bindings = fs.readFileSync(path.join(ROOT, 'apps-script/sidebar/js/event-bindings.html'), 'utf8');
  const controller = fs.readFileSync(path.join(ROOT, 'apps-script/sidebar/js/search-controller.html'), 'utf8');

  // The debounced input handler marks its query as typing-driven...
  assert.match(bindings, /setTimeout\(function \(\) \{\s*if \(\(value \|\| ''\)\.trim\(\)\.length >= 2\) runUnifiedQuery\(\{ fromTyping: true \}\);/);
  // ...and every mode's query function skips the write-back for it. An
  // unconditional $('.input').val(input) trimmed the space the reader had just
  // typed and moved the caret to the end mid-edit.
  const writeBacks = controller.match(/^\s*(?:if \([^)]*\) )?\$\('\.input'\)\.val\(input\);/gm) || [];
  assert.equal(writeBacks.length, 3, JSON.stringify(writeBacks));
  writeBacks.forEach((line) => assert.match(line, /if \((?:!fromTyping|fromTyping !== true)\)/, line));
});

test('the bounded edit distance and the histogram bound agree with the full distance', () => {
  const { levenshteinDistance, levenshteinWithin_, fuzzyCharHistogram_, fuzzyHistogramLowerBound_ } = loadSuggester(CATALOGUE);

  const words = ['', 'a', 'genesis', 'genesys', 'bereshit', 'bereishit', 'the torah a womens commentary', 'the torah a womans comentary', 'kitten', 'sitting'];
  for (const a of words) {
    for (const b of words) {
      const full = levenshteinDistance(a, b);
      const bound = fuzzyHistogramLowerBound_(fuzzyCharHistogram_(a), fuzzyCharHistogram_(b));
      assert.ok(bound <= full, `histogram bound ${bound} exceeds distance ${full} for ${a} / ${b}`);
      for (let max = 0; max <= 8; max++) {
        const bounded = levenshteinWithin_(a, b, max);
        if (full <= max) assert.equal(bounded, full, `${a} / ${b} within ${max}`);
        else assert.ok(bounded > max, `${a} / ${b}: ${bounded} should exceed ${max}`);
      }
    }
  }
});
