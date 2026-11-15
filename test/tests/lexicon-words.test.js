// The Lexicon search answers with words, not a flat list of entries
// (server/lexicon.gs). Reported: a search showed each dictionary entry as if
// it were a source of its own, so taking Klein's and BDB's שֵׁם meant picking,
// inserting, going back and picking again. Pinned here: entries are grouped by
// headword spelling; the words spelled as typed come first ("direct"), then
// the words the search is a form of or close to ("related"); each entry
// carries what the sidebar's entry list and preview show.
//
// The שם fixture is rebuilt by hand from what Sefaria shows for שם; see its
// _note. Loaded with vm.runInContext; see AGENTS.md hard rule #3.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');
const SHEM = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'lexicon-shem.json'), 'utf8')).entries;

function load(overrides) {
  const context = Object.assign({ Logger: { log() {} } }, overrides || {});
  vm.createContext(context);
  ['apps-script/server/utils.gs', 'apps-script/server/lexicon.gs'].forEach((file) => {
    vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), context, { filename: file });
  });
  return context;
}

const plain = (value) => JSON.parse(JSON.stringify(value));
const label = (entry) => [entry.dictionary, entry.ordinal].filter(Boolean).join(' ');
const summary = (words) => words.map((w) => ({ word: w.headWord, match: w.match, entries: w.entries.map(label) }));

test('a search lists words: the one spelled as typed first, with every dictionary\'s entry for it', () => {
  const lex = load();
  const words = plain(lex.groupLexiconEntries_(SHEM, 'שם'));
  assert.deepEqual(summary(words), [
    { word: 'שֵׁם', match: 'direct', entries: ['Klein I', 'BDB I', 'BDB II'] },
    { word: 'שׂוּם', match: 'related', entries: ['BDB I', 'BDB Aramaic'] },
    { word: 'שׂוּמָה', match: 'related', entries: ['BDB'] },
    { word: 'שִׂים', match: 'related', entries: ['BDB I, II'] },
    { word: 'שָׁמֵם', match: 'related', entries: ['BDB', 'BDB'] },
  ]);
  // Sefaria repeated Klein's entry; it is listed once.
  assert.equal(words[0].entries.filter((e) => e.dictionary === 'Klein').length, 1);
  // Each word is a result row with a ref of its own, and its entries have ids
  // the sidebar's entry list can tell apart.
  assert.equal(new Set(words.map((w) => w.ref)).size, words.length);
  words.forEach((w) => assert.equal(new Set(w.entries.map((e) => e.id)).size, w.entries.length));
});

test('a word spelled with the letters typed is direct, by its headword or an alternate', () => {
  const lex = load();
  const words = plain(lex.groupLexiconEntries_(SHEM, 'שים'));
  assert.deepEqual(words.map((w) => [w.headWord, w.match]), [
    ['שׂוּם', 'direct'],   // "I. שׂוּם, שִׂים"
    ['שִׂים', 'direct'],
    ['שֵׁם', 'related'],
    ['שׂוּמָה', 'related'],
    ['שָׁמֵם', 'related'],
  ]);
});

test('with vowels typed, the word spelled exactly so comes before other vowels on the same letters', () => {
  const lex = load();
  const there = { headword: 'שָׁם', parent_lexicon: 'BDB Dictionary', content: { senses: [{ definition: '<strong>adv.</strong> <em>there</em>' }] } };
  const name = { headword: 'שֵׁם', parent_lexicon: 'Klein Dictionary', content: { morphology: 'm.n.', senses: [{ number: '1', definition: 'name.' }] } };
  assert.deepEqual(plain(lex.groupLexiconEntries_([there, name], 'שֵׁם')).map((w) => [w.headWord, w.match]),
    [['שֵׁם', 'direct'], ['שָׁם', 'direct']]);
  // Without vowels both are the letters typed: Sefaria's order stands.
  assert.deepEqual(plain(lex.groupLexiconEntries_([there, name], 'שם')).map((w) => w.headWord), ['שָׁם', 'שֵׁם']);
});

test('cantillation and the order a dictionary stores marks in do not split one word in two', () => {
  const lex = load();
  const entry = (headword, lexicon) => ({ headword, parent_lexicon: lexicon, content: { senses: [{ definition: 'name' }] } });
  // shin dot then tsere; tsere then shin dot; with a tipcha.
  const words = plain(lex.groupLexiconEntries_([
    entry('שֵׁם', 'Klein Dictionary'),
    entry('שֵׁם', 'BDB Dictionary'),
    entry('שֵׁ֖ם', 'Jastrow Dictionary'),
  ], 'שם'));
  assert.equal(words.length, 1);
  assert.deepEqual(words[0].entries.map((e) => e.dictionary), ['Klein', 'BDB', 'Jastrow']);
  // The shin / sin dot is part of the word: שֵׂם would be another.
  assert.equal(plain(lex.groupLexiconEntries_([entry('שֵׂם', 'BDB Dictionary'), entry('שֵׁם', 'BDB Dictionary')], 'שם')).length, 2);
});

test('each entry says which dictionary it is from, its part of speech, a one-line gloss and its credit', () => {
  const lex = load();
  const [shem, sum, , , shamem] = plain(lex.groupLexiconEntries_(SHEM, 'שם'));
  const [klein, bdb1, bdb2] = shem.entries;

  assert.equal(klein.lexiconName, 'Klein Dictionary');
  assert.equal(klein.morphology, 'm.n.');
  assert.equal(klein.morphologyInDefinition, false);
  // Klein's short numbered senses are joined.
  assert.equal(klein.gloss, 'name, designation; reputation, renown, fame; name, as designation of God');
  assert.equal(klein.credit, 'Ezra Klein');
  assert.match(klein.notes, /^\[Related to BAram\./);
  assert.match(klein.derivatives, /הַשֵּׁם/);

  // BDB opens its definition with the part of speech; the gloss is the
  // opening words, without it or the citation before them.
  assert.equal(bdb1.morphology, 'n.m.');
  assert.equal(bdb1.morphologyInDefinition, true);
  assert.equal(bdb1.gloss, 'name');
  assert.equal(bdb2.morphology, 'n.pr.m.');
  assert.equal(bdb2.gloss, 'first son of Noah');
  assert.equal(bdb2.allCited, true);
  assert.equal(bdb1.credit, 'F. Brown, S. Driver & C. Briggs');

  assert.equal(sum.entries[0].gloss, 'put, place, set');
  assert.deepEqual(sum.entries[0].alternateHeadWords, ['שִׂים']);
  assert.equal(sum.entries[1].dictionary, 'BDB Aramaic');
  assert.equal(sum.entries[1].language, 'Aramaic');
  assert.deepEqual(shamem.entries.map((e) => [e.morphology, e.gloss]), [['vb.', 'be desolated, appalled'], ['adj.', 'devastated']]);
});

test('senses keep the dictionary\'s own numbers, stems and nesting', () => {
  const lex = load();
  const sum = plain(lex.groupLexiconEntries_(SHEM, 'שם'))[1].entries[0];
  const qal = sum.senses[1];
  assert.equal(qal.label, 'Qal');
  assert.deepEqual(qal.senses.map((s) => s.num), ['1', '2']);
  assert.equal(qal.senses[0].html, '');            // "1." heads a. and b.
  assert.deepEqual(qal.senses[0].senses.map((s) => s.num), ['a', 'b']);
  assert.equal(sum.senses[2].label, '†Hiph.');
  const klein = plain(lex.groupLexiconEntries_(SHEM, 'שם'))[0].entries[0];
  assert.deepEqual(klein.senses.map((s) => s.num), ['1', '2', '3']);   // Klein calls it "number"
});

test('dictionary names: BDB\'s Aramaic and Strong\'s editions are not plain BDB', () => {
  const lex = load();
  assert.equal(lex.lexiconShortName_('BDB Aramaic Dictionary'), 'BDB Aramaic');
  assert.equal(lex.lexiconShortName_('BDB Augmented Strong'), "BDB (Strong's)");
  assert.equal(lex.lexiconShortName_('BDB Dictionary'), 'BDB');
  assert.equal(lex.lexiconShortName_('Jastrow Dictionary'), 'Jastrow');
  assert.equal(lex.lexiconShortName_('Klein Dictionary'), 'Klein');
  assert.equal(lex.lexiconShortName_('Some New Lexicon'), 'Some New');
});

function fetchStub(answers, calls) {
  return {
    fetch(url) {
      const word = decodeURIComponent(url.split('/api/words/')[1]);
      calls.push(word);
      const answer = answers[word];
      if (typeof answer === 'number') return { getResponseCode: () => answer, getContentText: () => '' };
      return { getResponseCode: () => 200, getContentText: () => JSON.stringify(answer || []) };
    },
  };
}

test('searchLexicon answers with words; a 404 is no entries, a server error says the lookup is unavailable', () => {
  const calls = [];
  const lex = load({ UrlFetchApp: fetchStub({ 'שם': SHEM, 'קקקק': 404, 'שלום': 500 }, calls) });
  assert.deepEqual(plain(lex.searchLexicon('שם')).map((w) => w.headWord), ['שֵׁם', 'שׂוּם', 'שׂוּמָה', 'שִׂים', 'שָׁמֵם']);
  assert.deepEqual(plain(lex.searchLexicon('קקקק')), []);
  assert.throws(() => lex.searchLexicon('שלום'), /temporarily unavailable/);
  assert.deepEqual(plain(lex.searchLexicon('   ')), []);
});

test('an English search keeps the headwords the search found, not the words they are close to', () => {
  const calls = [];
  const lex = load({
    UrlFetchApp: fetchStub({ 'שֵׁם': SHEM }, calls),
    searchWrapperRequest_: () => ({ hits: { hits: [
      { _source: { ref: 'Klein Dictionary, שֵׁם 1' } },
      { _source: { ref: 'BDB Dictionary, שֵׁם 2' } },
    ] } }),
  });
  const words = plain(lex.searchLexicon('name'));
  assert.deepEqual(calls, ['שֵׁם']);
  assert.deepEqual(summary(words), [{ word: 'שֵׁם', match: 'direct', entries: ['Klein I', 'BDB I', 'BDB II'] }]);
  // If nothing in the answer has the headword's letters, all of it is kept.
  assert.equal(plain(lex.keepLexiconHeadword_([{ headword: 'שׂוּם' }], 'שֵׁם')).length, 1);
});
