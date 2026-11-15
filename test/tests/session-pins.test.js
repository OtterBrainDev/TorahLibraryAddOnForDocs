// Pins work the same in every tab (sidebar/js/search-tabs, session-library):
// a pinned or inserted sheet or word is kept in the Session Library with its
// tab, and reopening it shows that tab, searches what finds it, and selects
// it once the search has answered. Reopening used to search the entry's ref
// in whatever tab was open and look for it 250 ms later; a sheet's ref
// ("sheet:123") found nothing in Texts. The Lexicon's starred words became
// pins, once.
//
// Loaded with vm.runInContext; see AGENTS.md hard rule #3.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadSidebarSearch, ROOT } = require('./helpers/sidebar-search-harness');

const plain = (value) => JSON.parse(JSON.stringify(value));
const LIBRARY_KEY = 'sefariaSidebarSessionLibrary';
const library = (env) => plain(env.get('sessionLibrary'));

const SHEETS = [
  { key: 'sheet-7', ref: 'sheet:7', label: 'Shabbat, Rest and Renewal', owner: 'R. Cohen', summary: 'On rest.', url: 'https://www.sefaria.org/sheets/7', sheetId: 7, topics: ['Shabbat'] },
  { key: 'sheet-8', ref: 'sheet:8', label: 'Candles', url: 'https://www.sefaria.org/sheets/8', sheetId: 8, topics: [] },
];
const WORDS = [
  { key: 'lexicon-word-0', ref: 'lexicon-word:שלום', headWord: 'שָׁלוֹם', label: 'שָׁלוֹם', match: 'direct', entries: [{ id: 'a', rid: 'klein-1', dictionary: 'Klein' }] },
  { key: 'lexicon-word-1', ref: 'lexicon-word:שלם', headWord: 'שָׁלֵם', label: 'שָׁלֵם', match: 'related', entries: [{ id: 'b', rid: 'bdb-9', dictionary: 'BDB' }] },
];

function searched(mode, query, answer) {
  const env = loadSidebarSearch({ mode });
  env.ctx.setSidebarMode(mode, true);
  env.type(query);
  env.ctx.runUnifiedQuery({ fromTyping: true });
  env.last(mode === 'voices' ? 'searchVoices' : 'searchLexicon').ok(plain(answer));
  return env;
}

test('a pinned sheet keeps its tab, the search that found it, and what shows it again; its title whole', () => {
  const env = searched('voices', 'shabbat rest', SHEETS);
  env.ctx.togglePinnedRef('sheet:7', 'Shabbat, Rest and Renewal');
  const [pin] = library(env).pinned;
  assert.equal(pin.mode, 'voices');
  assert.equal(pin.label, 'Shabbat, Rest and Renewal', 'not cut at the comma, as a text’s label is');
  assert.equal(pin.corpusLabel, 'Source Sheets');
  assert.equal(pin.query, 'shabbat rest');
  assert.deepEqual(pin.sheet, { label: 'Shabbat, Rest and Renewal', summary: 'On rest.', owner: 'R. Cohen', url: 'https://www.sefaria.org/sheets/7', sheetId: 7, topics: ['Shabbat'] });
  assert.equal(env.get("isPinnedRef('sheet:7')"), true);
});

test('a pinned word keeps its tab and headword; its row shows the pin', () => {
  const env = searched('lexicon', 'shalom', WORDS);
  env.ctx.togglePinnedRef('lexicon-word:שלום', 'שָׁלוֹם');
  const [pin] = library(env).pinned;
  assert.deepEqual([pin.mode, pin.label, pin.headWord, pin.corpusLabel], ['lexicon', 'שָׁלוֹם', 'שָׁלוֹם', 'Dictionary']);
  assert.match(env.get('renderLexiconWordRow(queryState.searchResults[0], "")'), /result-pin-button lexicon-row-pin is-pinned' data-ref='lexicon-word:שלום'/);
});

test('a pinned text is kept as before: its ref, its corpus, its label cut at the first section', () => {
  const env = loadSidebarSearch({ mode: 'texts' });
  env.ctx.queryState.rawLibraryMatches = [{ key: 'k', ref: 'Rashi on Genesis 1:1:1', label: 'Rashi on Genesis 1:1:1, Beginning', clusterLabel: 'Commentary' }];
  env.ctx.applyResultPostProcessing();
  env.ctx.togglePinnedRef('Rashi on Genesis 1:1:1', 'Rashi on Genesis 1:1:1, Beginning');
  const [pin] = library(env).pinned;
  assert.deepEqual([pin.mode, pin.label, pin.corpusLabel], ['text', 'Rashi on Genesis 1:1:1', 'Commentary']);
});

test('a pinned sheet reopened from Texts: Voices, the search that found it, the sheet selected once it answers', () => {
  const env = searched('voices', 'shabbat rest', SHEETS);
  env.ctx.togglePinnedRef('sheet:7', 'Shabbat, Rest and Renewal');
  const pin = library(env).pinned[0];
  env.ctx.setSidebarMode('texts');
  env.type('Genesis 1:1');

  env.ctx.openSessionEntry(pin);
  assert.equal(env.mode(), 'voices');
  assert.equal(env.box(), 'shabbat rest');
  // Voices still has that search: nothing to search, the sheet is selected.
  assert.equal(env.pending('searchVoices').length, 1);
  assert.equal(env.get('selectedVoiceItem && selectedVoiceItem.ref'), 'sheet:7');
});

test('a pin reopened in its own tab, which has its search but shows other text, is drawn again, not searched', () => {
  const env = searched('voices', 'shabbat rest', SHEETS);
  env.ctx.togglePinnedRef('sheet:8', 'Candles');
  const pin = library(env).pinned[0];
  env.type('something else');
  env.ctx.setSidebarMode('lexicon');
  env.ctx.setSidebarMode('voices');   // the offer to search "something else"
  env.ctx.openSessionEntry(pin);
  assert.equal(env.pending('searchVoices').length, 1);
  assert.equal(env.get('selectedVoiceItem && selectedVoiceItem.ref'), 'sheet:8');
});

test('a reopened sheet is selected when its search answers, and shown from the pin if the search no longer lists it', () => {
  const env = loadSidebarSearch({ mode: 'texts' });
  const pin = { ref: 'sheet:7', label: 'Shabbat, Rest and Renewal', corpusLabel: 'Source Sheets', mode: 'voices', query: 'shabbat rest',
    sheet: { label: 'Shabbat, Rest and Renewal', url: 'https://www.sefaria.org/sheets/7', sheetId: 7, topics: ['Shabbat'] } };
  env.ctx.openSessionEntry(pin);
  assert.equal(env.mode(), 'voices');
  assert.equal(env.last('searchVoices').args[0], 'shabbat rest');
  assert.equal(env.get('selectedVoiceItem'), null, 'nothing selected before the answer');
  env.last('searchVoices').ok(plain(SHEETS));
  assert.equal(env.get('selectedVoiceItem.ref'), 'sheet:7');

  const gone = loadSidebarSearch({ mode: 'texts' });
  gone.ctx.openSessionEntry(pin);
  gone.last('searchVoices').ok([plain(SHEETS[1])]);
  assert.equal(gone.get('selectedVoiceItem.ref'), 'sheet:7');
  assert.equal(gone.get('selectedVoiceItem.url'), 'https://www.sefaria.org/sheets/7');
  assert.deepEqual(gone.shown().sort(), ['sheet:7', 'sheet:8']);
});

test('a reopened word: the Lexicon, its headword looked up, the word selected; older entries by headword or rid', () => {
  const env = loadSidebarSearch({ mode: 'voices' });
  env.ctx.openSessionEntry({ ref: 'lexicon-word:שלם', label: 'שָׁלֵם · BDB', mode: 'lexicon', headWord: 'שָׁלֵם', corpusLabel: 'Dictionary' });
  assert.equal(env.mode(), 'lexicon');
  assert.equal(env.last('searchLexicon').args[0], 'שָׁלֵם');
  env.last('searchLexicon').ok(plain(WORDS));
  assert.equal(env.get('selectedLexiconItem.ref'), 'lexicon-word:שלם');

  // Inserted before words had refs: the ref was the headword.
  const inserted = loadSidebarSearch({ mode: 'texts' });
  inserted.ctx.openSessionEntry({ ref: 'שָׁלֵם', label: 'שָׁלֵם · BDB', mode: 'lexicon', query: 'שָׁלֵם', corpusLabel: 'Dictionary' });
  inserted.last('searchLexicon').ok(plain(WORDS));
  assert.equal(inserted.get('selectedLexiconItem.ref'), 'lexicon-word:שלם');

  // Starred per entry, before 2026-11.
  const star = loadSidebarSearch({ mode: 'texts' });
  star.ctx.openSessionEntry({ ref: 'lexicon:bdb-9', label: 'שָׁלֵם', mode: 'lexicon', headWord: 'שלם', corpusLabel: 'Dictionary' });
  star.last('searchLexicon').ok(plain(WORDS));
  assert.equal(star.get('selectedLexiconItem.ref'), 'lexicon-word:שלם');
});

test('the Session Library dialog’s choice and a row of its sidebar list open in their own tab, with no timer', () => {
  const env = loadSidebarSearch({ mode: 'texts' });
  const pin = { ref: 'sheet:8', label: 'Candles', mode: 'voices', query: 'candles', corpusLabel: 'Source Sheets', url: '' };
  env.ctx._handleSlDialogResult({ sessionData: JSON.stringify({ pinned: [pin], inserted: [] }), selectedRef: 'sheet:8' });
  assert.equal(env.mode(), 'voices');
  env.last('searchVoices').ok(plain(SHEETS));
  assert.equal(env.get('selectedVoiceItem.ref'), 'sheet:8');
  const bindings = fs.readFileSync(path.join(ROOT, 'apps-script/sidebar/js/event-bindings.html'), 'utf8');
  const tray = fs.readFileSync(path.join(ROOT, 'apps-script/sidebar/js/layout-tray.html'), 'utf8');
  [bindings, tray].forEach((source) => assert.doesNotMatch(source, /}, 2[58]0\);/, 'no select-after-a-delay'));
});

test('inserting a sheet or a word records it like a pin, with its tab', () => {
  const env = searched('lexicon', 'shalom', WORDS);
  const entry = plain(env.ctx.lexiconSessionEntry(env.get('queryState.searchResults[0]'), [{ dictionary: 'Klein', ordinal: 'I' }]));
  assert.deepEqual([entry.ref, entry.label, entry.mode, entry.headWord], ['lexicon-word:שלום', 'שָׁלוֹם · Klein I', 'lexicon', 'שָׁלוֹם']);
  const footer = fs.readFileSync(path.join(ROOT, 'apps-script/sidebar/js/footer-actions.html'), 'utf8');
  assert.match(footer, /upsertSessionEntry\('inserted', lexiconSessionEntry\(insertedWord, lexiconPayload\.entries\)\)/);
  assert.match(footer, /upsertSessionEntry\('inserted', voicesSessionEntry\(insertedSheet, insertedFrom\)\)/);
});

test('starred words become pins once, after the pins already there; the stars’ key is removed', () => {
  const stars = [{ ref: 'lexicon-word:שלום', headWord: 'שָׁלוֹם', sourceLabel: 'Klein' }, { ref: 'lexicon:bdb-9', headWord: 'שָׁלֵם' }, { ref: 'sheet:7' }];
  const existing = { pinned: [{ ref: 'sheet:7', label: 'Shabbat', mode: 'voices', corpusLabel: 'voices' }], inserted: [] };
  const env = loadSidebarSearch({ storage: { lexicon_bookmarks: JSON.stringify(stars), [LIBRARY_KEY]: JSON.stringify(existing) } });
  const pinned = library(env).pinned;
  assert.deepEqual(pinned.map((p) => p.ref), ['sheet:7', 'lexicon-word:שלום', 'lexicon:bdb-9'], 'a star already pinned is not pinned twice');
  assert.deepEqual(pinned.slice(1).map((p) => [p.mode, p.label, p.headWord, p.corpusLabel]),
    [['lexicon', 'שָׁלוֹם', 'שָׁלוֹם', 'Dictionary'], ['lexicon', 'שָׁלֵם', 'שָׁלֵם', 'Dictionary']]);
  assert.equal(pinned[0].corpusLabel, 'Source Sheets', 'an inserted sheet’s old "voices" group is Source Sheets');
  assert.equal(env.localStorage.getItem('lexicon_bookmarks'), null);
  assert.deepEqual(JSON.parse(env.localStorage.getItem(LIBRARY_KEY)).pinned.length, 3);

  env.ctx.loadSessionLibrary();
  assert.equal(library(env).pinned.length, 3, 'once');
});

test('the sidebar and the Session Library dialog keep lists of the same length; no Starred words remain', () => {
  const sidebar = fs.readFileSync(path.join(ROOT, 'apps-script/sidebar/js/session-library.html'), 'utf8');
  const dialog = fs.readFileSync(path.join(ROOT, 'apps-script/session-library-modal.html'), 'utf8');
  const max = (source) => source.match(/var SESSION_LIBRARY_MAX = (\{[^}]*\});/)[1];
  assert.equal(max(sidebar), max(dialog));
  ['apps-script/sidebar.html', 'apps-script/sidebar/js/lexicon.html', 'apps-script/css/components/lexicon.html'].forEach((file) => {
    assert.doesNotMatch(fs.readFileSync(path.join(ROOT, file), 'utf8'), /lexicon-bookmark|Starred words/, file);
  });
});

test('Recent, in Texts, lists Texts’ own entries, under their corpus', () => {
  const library = { pinned: [{ ref: 'sheet:7', label: 'Shabbat', mode: 'voices', corpusLabel: 'Source Sheets' }],
    inserted: [{ ref: 'Genesis 1:1', label: 'Genesis 1:1', mode: 'text', corpusLabel: 'Tanakh' }, { ref: 'lexicon-word:שלום', label: 'שָׁלוֹם', mode: 'lexicon', corpusLabel: 'Dictionary' }] };
  const env = loadSidebarSearch({ mode: 'texts', storage: { [LIBRARY_KEY]: JSON.stringify(library) } });
  env.ctx.renderRecentSources();
  const html = env.dom.html['.recent-sources-list'];
  assert.match(html, /data-ref="Genesis 1:1"/);
  assert.match(html, /recent-source-category">Tanakh</);
  assert.doesNotMatch(html, /sheet:7|lexicon-word/);
});
