// The Lexicon search answers with words, not a flat list of entries
// (server/lexicon.gs). Reported: a search showed each dictionary entry as if
// it were a source of its own, so taking Klein's and BDB's שֵׁם meant picking,
// inserting, going back and picking again. Pinned here: entries are grouped by
// headword spelling; the words spelled as typed come first ("direct"), then
// the words the search is a form of or close to ("related"); each entry
// carries what the sidebar's entry list and preview show.
//
// The fixtures are Sefaria's own answers for שם and שלום (2026-11), shortened;
// see their _note. Loaded with vm.runInContext; see AGENTS.md hard rule #3.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');
const fixture = (name) => JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'lexicon-' + name + '.json'), 'utf8')).entries;
const SHEM = fixture('shem');
const SHALOM = fixture('shalom');

function load(overrides) {
  const context = Object.assign({ Logger: { log() {} } }, overrides || {});
  vm.createContext(context);
  ['apps-script/server/utils.gs', 'apps-script/server/lexicon.gs'].forEach((file) => {
    vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), context, { filename: file });
  });
  return context;
}

const plain = (value) => JSON.parse(JSON.stringify(value));
const label = (entry) => [entry.dictionary, entry.ordinal || entry.strongNumber].filter(Boolean).join(' ');
const summary = (words) => words.map((w) => ({ word: w.headWord, match: w.match, entries: w.entries.map(label) }));
const word = (words, headWord) => words.find((w) => w.headWord === headWord);
const entry = (w, wanted) => w.entries.find((e) => label(e) === wanted);

test('a search lists words: the ones spelled as typed first, each with every dictionary\'s entries for it', () => {
  const lex = load();
  const words = plain(lex.groupLexiconEntries_(SHEM, 'שם'));
  assert.deepEqual(summary(words), [
    { word: 'שָׁם', match: 'direct', entries: ['Klein', "Strong's 8033", 'Jastrow', 'BDB', 'Ben-Yehuda'] },
    { word: 'שֵׁם', match: 'direct', entries: ["Strong's 8034", "Strong's 8035", 'Jastrow I', 'Jastrow II', 'Jastrow',
      'Klein I', 'Klein II', 'BDB I', 'BDB II', 'Ben-Yehuda'] },
    { word: 'שֻׁם', match: 'direct', entries: ["Strong's 8036", 'BDB Aramaic'] },
    { word: 'שׂוּם', match: 'related', entries: ["Strong's 7760", "Strong's 7761", 'BDB I', 'BDB Aramaic'] },
    { word: 'שׁום', match: 'related', entries: ['Klein'] },
    { word: 'שׂים', match: 'related', entries: ['Klein'] },
    { word: 'שׂוּמָה', match: 'related', entries: ['BDB'] },
    { word: 'שִׂים', match: 'related', entries: ['BDB I, II'] },
  ]);
  // Each word is a result row with a ref of its own, and its entries have ids
  // the sidebar's entry list can tell apart.
  assert.equal(new Set(words.map((w) => w.ref)).size, words.length);
  words.forEach((w) => assert.equal(new Set(w.entries.map((e) => e.id)).size, w.entries.length));
});

test('a headword\'s number is not part of the word: "שֵׁם ᴵ" (Klein), "שֵׁם²" (BDB), "שֵׁם I" (Jastrow)', () => {
  const lex = load();
  assert.deepEqual(plain(lex.lexiconSplitHeadword_('שֵׁם ᴵ')), { word: 'שֵׁם', ordinal: 'I' });
  assert.deepEqual(plain(lex.lexiconSplitHeadword_('שֵׁם ᴵᴵ')), { word: 'שֵׁם', ordinal: 'II' });
  assert.deepEqual(plain(lex.lexiconSplitHeadword_('שֵׁם²')), { word: 'שֵׁם', ordinal: 'II' });
  assert.deepEqual(plain(lex.lexiconSplitHeadword_('שָׁלוֹם II')), { word: 'שָׁלוֹם', ordinal: 'II' });
  assert.deepEqual(plain(lex.lexiconSplitHeadword_('שָׁם')), { word: 'שָׁם', ordinal: '' });
  // BDB's own field: "I." and "I, II." without the period.
  const shem = word(plain(lex.groupLexiconEntries_(SHEM, 'שם')), 'שֵׁם');
  assert.deepEqual(shem.entries.filter((e) => e.dictionary === 'BDB').map((e) => e.ordinal), ['I', 'II']);
  assert.ok(shem.entries.every((e) => e.headWord === 'שֵׁם'));
});

test('a word spelled with the letters typed is direct, by its headword or an alternate', () => {
  const lex = load();
  const words = plain(lex.groupLexiconEntries_(SHEM, 'שים'));
  assert.deepEqual(words.filter((w) => w.match === 'direct').map((w) => w.headWord),
    ['שׂוּם', 'שׂים', 'שִׂים']);   // "I. שׂוּם" has the alternate שִׂים; Klein's שׂים is spelled so
  assert.equal(word(words, 'שֵׁם').match, 'related');
});

test('with vowels typed, the word spelled exactly so comes before other vowels on the same letters', () => {
  const lex = load();
  const words = plain(lex.groupLexiconEntries_(SHEM, 'שֵׁם'));
  assert.deepEqual(words.slice(0, 3).map((w) => [w.headWord, w.match]), [['שֵׁם', 'direct'], ['שָׁם', 'direct'], ['שֻׁם', 'direct']]);
  // Without vowels all three are the letters typed: Sefaria's order stands.
  assert.deepEqual(plain(lex.groupLexiconEntries_(SHEM, 'שם')).slice(0, 3).map((w) => w.headWord), ['שָׁם', 'שֵׁם', 'שֻׁם']);
});

test('cantillation and the order a dictionary stores marks in do not split one word in two', () => {
  const lex = load();
  const make = (headword, lexicon) => ({ headword, parent_lexicon: lexicon, content: { senses: [{ definition: 'name' }] } });
  // shin dot then tsere; tsere then shin dot; with a tipcha.
  const words = plain(lex.groupLexiconEntries_([
    make('שֵׁם', 'Klein Dictionary'),
    make('שֵׁם', 'BDB Dictionary'),
    make('שֵׁ֖ם', 'Jastrow Dictionary'),
  ], 'שם'));
  assert.equal(words.length, 1);
  assert.deepEqual(words[0].entries.map((e) => e.dictionary), ['Klein', 'BDB', 'Jastrow']);
  // The shin / sin dot is part of the word: שֵׂם would be another.
  assert.equal(plain(lex.groupLexiconEntries_([make('שֵׂם', 'BDB Dictionary'), make('שֵׁם', 'BDB Dictionary')], 'שם')).length, 2);
});

test('each entry\'s one-line gloss, read the way its dictionary writes', () => {
  const lex = load();
  const words = plain(lex.groupLexiconEntries_(SHEM, 'שם'));
  const shem = word(words, 'שֵׁם');
  const glosses = Object.fromEntries(shem.entries.map((e) => [label(e), e.gloss]));
  assert.deepEqual(glosses, {
    "Strong's 8034": 'name',
    "Strong's 8035": 'Shem = "name"',
    // Jastrow: from its italics to the end of that sentence; none, no gloss.
    'Jastrow I': 'Shem, son of Noah',
    'Jastrow II': 'mark, name, title, nature, denomination',
    Jastrow: '',
    // Klein: its short numbered senses, joined.
    'Klein I': 'name, designation; reputation, renown, fame; name, as designation of God',
    'Klein II': 'PN Shem',
    // BDB: after the part of speech and the citation.
    'BDB I': 'name',
    'BDB II': 'first son of Noah',
    // Ben-Yehuda (Hebrew): its first sense, without the footnote or the
    // German / French / English equivalents.
    'Ben-Yehuda': 'מלה המשמשת ציון לסוג מסוגי הדברים והמֻשגים',
  });
  // Klein's שָׁם opens with a remark in parentheses; the gloss starts after it.
  assert.equal(entry(word(words, 'שָׁם'), 'Klein').gloss, 'there, thither; existing, in existence');
  assert.equal(entry(word(words, 'שׂוּם'), 'BDB I').gloss, 'put, place, set');
  const shalom = word(plain(lex.groupLexiconEntries_(SHALOM, 'שלום')), 'שָׁלוֹם');
  assert.equal(entry(shalom, 'Jastrow II').gloss, 'Imma (Mother) Shalom, wife of R. Eliezer');
  assert.equal(entry(shalom, 'Ben-Yehuda').gloss, 'מצב טוב ובטוח ללא נגע וסבל');
});

test('each entry says its dictionary, part of speech, language and credit', () => {
  const lex = load();
  const words = plain(lex.groupLexiconEntries_(SHEM, 'שם'));
  const shem = word(words, 'שֵׁם');
  const klein = entry(shem, 'Klein I');
  assert.equal(klein.lexiconName, 'Klein Dictionary');
  assert.equal(klein.morphology, 'm.n.');
  assert.equal(klein.morphologyInDefinition, false);
  assert.equal(klein.credit, 'Ezra Klein');
  assert.match(klein.notes, /^\[Related to BAram\./);
  assert.match(klein.derivatives, /הַשֵּׁם/);
  // BDB opens its definition with the part of speech.
  assert.equal(entry(shem, 'BDB I').morphology, 'n.m.');
  assert.equal(entry(shem, 'BDB I').morphologyInDefinition, true);
  assert.equal(entry(shem, 'BDB II').allCited, true);
  // Strong's: its number; Jastrow "ch." and code "arc" are Aramaic.
  assert.equal(entry(shem, "Strong's 8034").strongNumber, '8034');
  assert.equal(entry(shem, 'Jastrow').language, 'Aramaic');
  assert.equal(entry(shem, 'Jastrow II').language, '');
  assert.equal(entry(word(words, 'שֻׁם'), "Strong's 8036").language, 'Aramaic');
  assert.equal(entry(word(words, 'שׂוּם'), 'BDB Aramaic').language, 'Aramaic');
  // Klein gives a verb's part of speech on its stem.
  assert.equal(word(words, 'שׂים').entries[0].morphology, 'tr. v.');
  // Alternates: strings or { word }, the empty one left out.
  assert.deepEqual(entry(word(words, 'שׂוּם'), 'BDB I').alternateHeadWords, ['שִׂים']);
  assert.deepEqual(entry(shem, 'Jastrow').alternateHeadWords, ['שְׁמָא']);
  // Ben-Yehuda defines in Hebrew; its footnotes are left out.
  const by = entry(shem, 'Ben-Yehuda');
  assert.equal(by.definitionsRtl, true);
  assert.doesNotMatch(by.senses[0].html, /footnote|המלה משֻתפת/);
  assert.match(by.senses[0].html, /מלה המשמשת ציון/);
  assert.equal(klein.definitionsRtl, false);
});

test('senses keep the dictionary\'s own numbers and stems; a wrapper takes its only text', () => {
  const lex = load();
  const words = plain(lex.groupLexiconEntries_(SHEM, 'שם'));
  const sum = entry(word(words, 'שׂוּם'), 'BDB I');
  assert.deepEqual(sum.senses.map((s) => s.label), ['', 'Qal', '†Hiph.', '†Hoph.']);
  const qal = sum.senses[1];
  // BDB's Qal wraps its conjugation paragraph: it becomes the stem's text.
  assert.match(qal.html, /^Pf\. 3 ms\./);
  assert.deepEqual(qal.senses.map((s) => s.num), ['1.', '2.']);
  assert.equal(qal.senses[0].html, '');                    // "1." heads a. and b.
  assert.deepEqual(qal.senses[0].senses.map((s) => s.num), ['a.', 'b.']);
  assert.match(qal.senses[0].senses[0].html, /^<em>put, set<\/em>, in a place/);   // "a." took its text
  assert.match(qal.senses[1].html, /set, direct:/);
  // Klein: "— Qal" and its forms; a stem's only sense is its text.
  const klein = word(words, 'שׁום').entries[0];
  assert.deepEqual(klein.senses.map((s) => [s.label, s.html]), [
    ['', 'to assess, value, evaluate, estimate, appraise.'],
    ['Qal שָׁם', 'he assessed, valued, evaluated, estimated.'],
    ['Niph. נִשּׁוֹם', 'was assessed, was valued, was evaluated, estimated.'],
  ]);
  // Strong's meanings under Qal stay a list.
  assert.equal(entry(word(words, 'שׂוּם'), "Strong's 7760").senses[0].senses[0].senses.length, 3);
  // Klein's plural goes before its definition; Jastrow's "—2)" is "2)".
  assert.match(entry(word(words, 'שֵׁם'), 'Klein I').senses[0].html, /^\(pl\. .*שֵׁמוֹת.*\) name, designation\.$/);
  const shalom = word(plain(lex.groupLexiconEntries_(SHALOM, 'שלום')), 'שָׁלוֹם');
  assert.deepEqual(entry(shalom, 'Jastrow I').senses.map((s) => s.num), ['1)', '2)']);
});

test('dictionary names: BDB\'s Aramaic and Strong\'s editions are not plain BDB', () => {
  const lex = load();
  assert.equal(lex.lexiconShortName_('BDB Aramaic Dictionary'), 'BDB Aramaic');
  assert.equal(lex.lexiconShortName_('BDB Augmented Strong'), "Strong's");
  assert.equal(lex.lexiconShortName_('BDB Dictionary'), 'BDB');
  assert.equal(lex.lexiconShortName_('Jastrow Dictionary'), 'Jastrow');
  assert.equal(lex.lexiconShortName_('Klein Dictionary'), 'Klein');
  assert.equal(lex.lexiconShortName_('Ben Yehuda Dictionary'), 'Ben-Yehuda');
  assert.equal(lex.lexiconShortName_('Some New Lexicon'), 'Some New');
});

function fetchStub(answers, calls) {
  const answer = (url) => {
    const word = decodeURIComponent(url.split('/api/words/')[1]);
    calls.push(word);
    const value = answers[word];
    if (typeof value === 'number') return { getResponseCode: () => value, getContentText: () => '' };
    return { getResponseCode: () => 200, getContentText: () => JSON.stringify(value || []) };
  };
  return {
    fetch: (url) => answer(url),
    fetchAll: (requests) => requests.map((request) => answer(request.url)),
  };
}

test('searchLexicon answers with words; a 404 is no entries, a server error says the lookup is unavailable', () => {
  const calls = [];
  const lex = load({ UrlFetchApp: fetchStub({ 'שם': SHEM, 'קקקק': 404, 'שלום': 500 }, calls) });
  assert.deepEqual(plain(lex.searchLexicon('שם')).map((w) => w.headWord), ['שָׁם', 'שֵׁם', 'שֻׁם', 'שׂוּם', 'שׁום', 'שׂים', 'שׂוּמָה', 'שִׂים']);
  assert.deepEqual(plain(lex.searchLexicon('קקקק')), []);
  assert.throws(() => lex.searchLexicon('שלום'), /temporarily unavailable/);
  assert.deepEqual(plain(lex.searchLexicon('   ')), []);
});

// Reported: an English word never found anything. The search was filtered by
// the dictionaries' titles; Sefaria matches a path filter from the start of
// the category path ("Tanakh" reaches "Tanakh/Torah/Genesis"), and every
// dictionary's path starts "Reference/".
const hit = (ref, path) => ({ _source: Object.assign({ ref }, path ? { path, categories: path.split('/').slice(0, -1) } : {}) });

test('an English search is filtered to the dictionaries\' category path, not their titles', () => {
  const calls = [];
  const payloads = [];
  const lex = load({
    UrlFetchApp: fetchStub({ 'שֵׁם': SHEM }, calls),
    searchWrapperRequest_: (payload) => {
      payloads.push(plain(payload));
      return { hits: { hits: [hit('Klein Dictionary, שֵׁם 1'), hit('Jastrow, שֵׁם I 1')] } };
    },
  });
  const words = plain(lex.searchLexicon('name'));
  assert.deepEqual(payloads.map((p) => p.filters), [['Reference/Dictionary']]);
  assert.deepEqual(payloads[0].filter_fields, ['path']);
  payloads[0].filters.forEach((filter) => assert.match(filter, /^Reference\//));
  // One lookup per headword; the words it is close to are left out.
  assert.deepEqual(calls, ['שֵׁם']);
  // שֵׁם's entries only: not שָׁם or שֻׁם, though Sefaria answers with them.
  assert.deepEqual(summary(words), [{ word: 'שֵׁם', match: 'direct', entries: ["Strong's 8034", "Strong's 8035",
    'Jastrow I', 'Jastrow II', 'Jastrow', 'Klein I', 'Klein II', 'BDB I', 'BDB II', 'Ben-Yehuda'] }]);
  // If nothing in the answer has the headword's letters, all of it is kept.
  assert.equal(plain(lex.keepLexiconHeadword_([{ headword: 'שׂוּם' }], 'שֵׁם')).length, 1);
});

test('if the dictionaries\' path finds nothing, all of Reference is searched and only dictionary hits kept', () => {
  const calls = [];
  const payloads = [];
  const lex = load({
    UrlFetchApp: fetchStub({ 'שֵׁם': SHEM, 'שָׁמֵם': SHEM }, calls),
    searchWrapperRequest_: (payload) => {
      payloads.push(payload.filters[0]);
      if (payload.filters[0] !== 'Reference') return { hits: { hits: [] } };
      return { hits: { hits: [
        hit('Encyclopedia Judaica, Names 3', 'Reference/Encyclopedic Works/Encyclopedia Judaica'),
        hit('BDB Dictionary, שָׁמֵם 2', 'Reference/Dictionary/BDB Dictionary'),
        hit('Jastrow, שֵׁם I 1'),
      ] } };
    },
  });
  plain(lex.searchLexicon('desolate'));
  assert.deepEqual(payloads, ['Reference/Dictionary', 'Reference']);
  assert.deepEqual(calls, ['שָׁמֵם', 'שֵׁם']);
});

test('an English search that Sefaria never answers says the lookup is unavailable, not "no entries"', () => {
  const lex = load({
    UrlFetchApp: fetchStub({}, []),
    searchWrapperRequest_: () => { throw new Error('Search request failed with status 502.'); },
  });
  assert.throws(() => lex.searchLexicon('name'), /temporarily unavailable/);
  // Answered, with nothing: no entries.
  const empty = load({ UrlFetchApp: fetchStub({}, []), searchWrapperRequest_: () => ({ hits: { hits: [] } }) });
  assert.deepEqual(plain(empty.searchLexicon('zzzz')), []);
});

test('a headword is read from a dictionary ref without its ordinal or segment number', () => {
  const lex = load();
  assert.equal(lex.lexiconHeadwordFromRef_('Jastrow, שֵׁם I 1'), 'שֵׁם');
  assert.equal(lex.lexiconHeadwordFromRef_('Klein Dictionary, שֵׁם 1'), 'שֵׁם');
  assert.equal(lex.lexiconHeadwordFromRef_('BDB Dictionary, שׂוּם, שִׂים 2'), 'שׂוּם');
  assert.equal(lex.lexiconHeadwordFromRef_('Klein Dictionary, אַ◌ 1'), 'אַ');
  assert.equal(lex.lexiconHeadwordFromRef_('Genesis 1:1'), '');
});
