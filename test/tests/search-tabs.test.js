// The sidebar's one search workflow (sidebar/js/search-tabs): each tab keeps
// its own search, switching tabs never searches, Enter also searches the
// other tabs that suit the text, and a tab's badge counts its results.
//
// Pinned: typing searches the shown tab only; Enter (or the search button)
// searches the others in the background, skipping a tab the text doesn't
// suit ("Genesis 1:1" is no dictionary word) or one that has results for it
// already; an answer lands in its own tab, never the one shown; switching
// back shows a tab's results and its selection as they were, without a
// search, the search box keeping its text; a tab with nothing for the text
// offers "Search Lexicon for “…”"; a hint stays with its tab.
//
// Loaded with vm.runInContext; see AGENTS.md hard rule #3.

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadSidebarSearch } = require('./helpers/sidebar-search-harness');

const sheets = (n) => Array.from({ length: n }, (_, i) => ({
  key: `sheet-${i + 1}`, ref: `sheet:${i + 1}`, label: `Sheet ${i + 1}`, url: `https://www.sefaria.org/sheets/${i + 1}`,
  topics: i % 2 ? ['Shabbat'] : ['Kindness'], typeLabel: 'Voices', clusterLabel: 'Source Sheets',
}));
const words = (...heads) => heads.map((headWord, i) => ({
  key: `lexicon-word-${i}`, ref: `lexicon-word:${headWord}`, kind: 'lexicon-word', label: headWord, headWord,
  match: i ? 'related' : 'direct', typeLabel: 'Lexicon', clusterLabel: 'Dictionary',
  entries: [{ id: `${headWord}-klein`, dictionary: 'Klein', gloss: 'a gloss' }, { id: `${headWord}-bdb`, dictionary: 'BDB', gloss: 'another' }],
}));

function inVoices() {
  const env = loadSidebarSearch({ mode: 'voices' });
  env.ctx.setSidebarMode('voices', true);
  return env;
}

test('typing searches the shown tab only', () => {
  const env = inVoices();
  env.type('shalom');
  env.ctx.runUnifiedQuery({ fromTyping: true });
  assert.deepEqual(env.calls.map((c) => c.name), ['searchVoices']);
});

test('the pause after Enter does not search the same text again', () => {
  const env = inVoices();
  env.type('shalom');
  env.ctx.runUnifiedQuery();
  env.last('searchVoices').ok([]);
  env.ctx.runUnifiedQuery({ fromTyping: true });
  assert.equal(env.pending('searchVoices').length, 1);
  env.type('shalom aleichem');
  env.ctx.runUnifiedQuery({ fromTyping: true });
  assert.equal(env.pending('searchVoices').length, 2, 'new text is searched');
  // A failed search is tried again.
  env.last('searchVoices').fail(new Error('Voices search is temporarily unavailable.'));
  env.ctx.runUnifiedQuery({ fromTyping: true });
  assert.equal(env.pending('searchVoices').length, 3);
});

test('Enter searches the shown tab, then in the background every other tab the text suits', () => {
  const env = inVoices();
  env.type('shalom');
  env.ctx.runUnifiedQuery();
  assert.equal(env.last('searchVoices').args[0], 'shalom');
  assert.equal(env.last('searchLexicon').args[0], 'shalom');
  assert.equal(env.last('findSearchAdvanced').args[0], 'shalom');

  // A reference is no dictionary word; a link is for Texts alone.
  const ref = inVoices();
  ref.type('Genesis 1:1');
  ref.ctx.runUnifiedQuery();
  assert.equal(ref.pending('searchLexicon').length, 0);
  assert.equal(ref.pending('findSearchAdvanced').length, 1);
  assert.equal(ref.ctx.lexiconSuitsQuery('https://www.sefaria.org/Genesis.1'), false);
  assert.equal(ref.ctx.voicesSuitsQuery('https://www.sefaria.org/Genesis.1'), false);
  assert.equal(ref.ctx.lexiconSuitsQuery('שלום'), true);
  assert.equal(ref.ctx.lexiconSuitsQuery('loving kindness'), true);
  assert.equal(ref.ctx.lexiconSuitsQuery('the laws of shabbat candles'), false);
});

// Preferences → Sidebar: a switched-off tab is never searched in the
// background. Its search would be a Sefaria request nobody can see.
test('Enter leaves out a tab switched off in Preferences → Sidebar', () => {
  const env = loadSidebarSearch({ mode: 'texts' });
  env.ctx.setSidebarMode('texts', true);
  env.dom.attr['.unified-sidebar'] = { 'data-sidebar-tabs': 'texts lexicon' };
  env.type('shalom');
  env.ctx.runUnifiedQuery();
  assert.equal(env.pending('searchVoices').length, 0, 'Voices is off');
  assert.equal(env.last('searchLexicon').args[0], 'shalom');

  const none = loadSidebarSearch({ mode: 'texts' });
  none.ctx.setSidebarMode('texts', true);
  none.dom.attr['.unified-sidebar'] = { 'data-sidebar-tabs': 'texts' };
  none.type('shalom');
  none.ctx.runUnifiedQuery();
  assert.equal(none.pending('searchVoices').length + none.pending('searchLexicon').length, 0);
  assert.equal(none.ctx.sidebarTabIsOn('texts'), true, 'Texts has no switch');

  // Opened from the Voices menu item with Voices off: Enter there searches
  // Voices (the tab shows while it is open) and leaves Lexicon out if it's off too.
  const opened = loadSidebarSearch({ mode: 'voices' });
  opened.ctx.setSidebarMode('voices', true);
  opened.dom.attr['.unified-sidebar'] = { 'data-sidebar-tabs': 'texts' };
  opened.type('shalom');
  opened.ctx.runUnifiedQuery();
  assert.equal(opened.last('searchVoices').args[0], 'shalom');
  assert.equal(opened.pending('searchLexicon').length, 0);
});

test('an answer lands in its own tab, never the one shown, and its badge counts it', () => {
  const env = inVoices();
  env.type('shalom');
  env.ctx.runUnifiedQuery();
  env.last('searchLexicon').ok(words('שָׁלוֹם', 'שָׁלֵם'));
  assert.deepEqual(env.raw(), [], 'Voices shows none of the Lexicon’s words');
  assert.equal(env.badge('lexicon'), '2');
  assert.equal(env.badge('voices'), '', 'no badge until Voices answers');

  env.last('searchVoices').ok(sheets(3));
  assert.deepEqual(env.shown().length, 3);
  assert.equal(env.badge('voices'), '3');
});

test('switching tabs never searches: the tab’s results come back, and the box keeps its text', () => {
  const env = inVoices();
  env.type('shalom');
  env.ctx.runUnifiedQuery();
  env.last('searchVoices').ok(sheets(3));
  env.last('searchLexicon').ok(words('שָׁלוֹם', 'שָׁלֵם'));
  const before = env.calls.length;

  env.ctx.setSidebarMode('lexicon');
  assert.equal(env.mode(), 'lexicon');
  assert.deepEqual(env.raw(), ['lexicon-word:שָׁלוֹם', 'lexicon-word:שָׁלֵם']);
  assert.equal(env.box(), 'shalom');

  env.ctx.setSidebarMode('voices');
  assert.equal(env.shown().length, 3);
  assert.equal(env.calls.slice(before).filter((c) => /^(search|find)/.test(c.name)).length, 0, 'no search on a switch');
});

test('what was selected in a tab is selected again when it is shown', () => {
  const env = inVoices();
  env.type('shalom');
  env.ctx.runUnifiedQuery();
  env.last('searchVoices').ok(sheets(3));
  env.last('searchLexicon').ok(words('שָׁלוֹם', 'שָׁלֵם'));
  env.ctx.selectResultItem(env.get("findShownResult('sheet:2')"));
  assert.equal(env.get('selectedVoiceItem && selectedVoiceItem.ref'), 'sheet:2');

  env.ctx.setSidebarMode('lexicon');
  assert.equal(env.get('selectedResultKey'), null, 'the Lexicon has its own selection');
  env.ctx.selectResultItem(env.get("findLexiconWord('lexicon-word:שָׁלוֹם')"));
  env.ctx.toggleLexiconEntry('שָׁלוֹם-bdb');
  assert.deepEqual(Array.from(env.get('lexiconSelectedEntryIds')), ['שָׁלוֹם-klein', 'שָׁלוֹם-bdb']);

  env.ctx.setSidebarMode('voices');
  assert.equal(env.get('selectedResultKey'), 'sheet-2');
  assert.equal(env.get('selectedVoiceItem && selectedVoiceItem.ref'), 'sheet:2');

  env.ctx.setSidebarMode('lexicon');
  assert.equal(env.get('selectedLexiconItem && selectedLexiconItem.ref'), 'lexicon-word:שָׁלוֹם');
  assert.deepEqual(Array.from(env.get('lexiconSelectedEntryIds')), ['שָׁלוֹם-klein', 'שָׁלוֹם-bdb'], 'the entries picked, in order');
});

test('a tab with nothing for the text in the box offers to search it, and the offer searches', () => {
  const env = inVoices();
  env.type('shabbat');
  env.ctx.runUnifiedQuery({ fromTyping: true });
  env.last('searchVoices').ok(sheets(2));

  env.ctx.setSidebarMode('lexicon');
  assert.equal(env.pending('searchLexicon').length, 0);
  assert.match(env.dom.html['.search-tab-prompt'], /search-tab-prompt-button'>Search Lexicon for “shabbat”</);
  assert.equal((env.dom.attr['.search-tab-prompt'] || {}).hidden, undefined, 'shown');
  assert.equal(env.badge('lexicon'), '');

  env.ctx.runUnifiedQuery();   // the offer's click
  assert.equal(env.last('searchLexicon').args[0], 'shabbat');
  assert.equal(env.pending('searchVoices').length, 1, 'Voices has results for it already');
});

test('results for other text are not shown: a tab shows its search only while the box says it', () => {
  const env = inVoices();
  env.type('shalom');
  env.ctx.runUnifiedQuery();
  env.last('searchVoices').ok(sheets(3));
  env.last('searchLexicon').ok(words('שָׁלוֹם'));
  env.type('shabbat');
  env.ctx.runUnifiedQuery({ fromTyping: true });
  assert.equal(env.badge('lexicon'), '', 'the Lexicon’s count was for “shalom”');
  env.ctx.setSidebarMode('lexicon');
  assert.deepEqual(env.raw(), []);
  assert.match(env.dom.html['.search-tab-prompt'], /Search Lexicon for “shabbat”/);
});

test('a hint stays with its tab', () => {
  const env = inVoices();
  env.type('qqqq');
  env.ctx.runUnifiedQuery();
  env.last('searchVoices').ok(sheets(1));
  env.last('searchLexicon').ok([]);
  assert.equal(env.hint(), '', 'Voices found a sheet');
  env.ctx.setSidebarMode('lexicon');
  assert.match(env.hint(), /No dictionary definition matched “qqqq”/);
  env.ctx.setSidebarMode('voices');
  assert.equal(env.hint(), '');
});

test('a Texts preview answer that lands while another tab is shown is fetched again on return', () => {
  const env = loadSidebarSearch({ mode: 'texts', stubs: { updateSuggestion() {}, updateActionabilityUI() {}, clearVersionSelectors() {} } });
  env.type('Genesis 1:1');
  env.ctx.runUnifiedQuery();
  env.last('findReferenceForSidebar').ok({ ref: 'Genesis 1:1', text: ['In the beginning'], he: ['בְּרֵאשִׁית'], sections: [1], indexTitle: 'Genesis' });
  env.last('findSearchAdvanced').ok([]);
  (env.last('getNameCandidates') || { ok() {} }).ok([]);
  const resolve = env.last('findReferenceForSidebar');   // the auto-selected single result's preview
  assert.equal(env.get('selectedResultKey'), 'library-ref-Genesis 1:1');

  env.ctx.setSidebarMode('voices');
  resolve.ok({ ref: 'Genesis 1:1', text: ['In the beginning'], he: ['x'], sections: [1], indexTitle: 'Genesis' });
  assert.equal(env.get('hasResolvedReference'), false, 'Add Source in Voices is not enabled by a Texts preview');

  const fetches = env.pending('findReferenceForSidebar').length;
  env.ctx.setSidebarMode('texts');
  assert.equal(env.get('selectedResultKey'), 'library-ref-Genesis 1:1');
  assert.equal(env.pending('findReferenceForSidebar').length, fetches + 1, 'the preview is fetched again');
});

test('a Texts selection whose preview had loaded comes back without a fetch', () => {
  const env = loadSidebarSearch({ mode: 'texts', stubs: { updateSuggestion() {}, updateActionabilityUI() {}, clearVersionSelectors() {} } });
  env.type('Genesis 1:1');
  env.ctx.runUnifiedQuery();
  env.last('findReferenceForSidebar').ok({ ref: 'Genesis 1:1', text: ['x'], he: ['x'], sections: [1], indexTitle: 'Genesis' });
  env.last('findSearchAdvanced').ok([]);
  (env.last('getNameCandidates') || { ok() {} }).ok([]);
  env.last('findReferenceForSidebar').ok({ ref: 'Genesis 1:1', text: ['x'], he: ['x'], sections: [1], indexTitle: 'Genesis' });
  assert.equal(env.get('hasResolvedReference'), true);

  env.ctx.setSidebarMode('voices');
  const before = env.calls.length;
  env.ctx.setSidebarMode('texts');
  assert.deepEqual(env.calls.slice(before).map((c) => c.name), ['setAccountPreferences'], 'the tab is remembered; nothing fetched');
  assert.equal(env.get('hasResolvedReference'), true);
  assert.equal(env.get('data.ref'), 'Genesis 1:1', 'Add Source inserts what was previewed');
});

test('the language filter holds title and content results until verified and rechecks when changed', () => {
  const env = loadSidebarSearch({ mode: 'texts' });
  let languages = ['fr'];
  env.ctx.getSearchParameters = () => ({ sortMode: 'relevance', translationOnly: !!languages.length, translationLanguages: languages });
  env.type('Genesis 1:1');
  const run = env.ctx.startSearchRun('texts', 'Genesis 1:1');
  env.last('findReferenceForSidebar').ok({ ref: 'Genesis 1:1', text: ['English'], he: ['א'], sections: [1], indexTitle: 'Genesis' });
  env.last('findSearchAdvanced').ok([
    { _source: { ref: 'Genesis 1:2', hasEn: true } }, { _source: { ref: 'Genesis 1:3' } }
  ]);
  const titles = env.last('getNameCandidates');
  if (titles) titles.ok([]);
  assert.equal(run.queryState.libraryMatches.length + run.queryState.searchResults.length, 0);
  const check = env.last('getSearchTranslationMatches');
  assert.ok(check.args[0].includes('Genesis 1:1'));
  assert.ok(check.args[0].includes('Genesis 1:2'));
  check.ok({ matches: [{ ref: 'Genesis 1:2', languages: ['fr'] }, { ref: 'Genesis 1:3', languages: ['fr'] }], incomplete: false });
  assert.deepEqual(Array.from(run.queryState.searchResults, (item) => item.ref), ['Genesis 1:2', 'Genesis 1:3']);
  assert.equal(run.queryState.libraryMatches.length, 0);
  languages = [];
  env.ctx.refreshTextSearchForLanguageFilter_();
  assert.equal(env.pending('findSearchAdvanced').length, 2);
});
