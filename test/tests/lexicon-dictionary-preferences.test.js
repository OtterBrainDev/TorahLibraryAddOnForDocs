// The Lexicon's dictionaries are ordered and hidden like Texts' corpora:
// Preferences → Search saves lexicon_dictionary_order and
// lexicon_dictionary_excluded (schema 27), the sidebar lists a word's entries
// in that order and leaves the hidden dictionaries out, and a dictionary chip
// shows a hidden one for a single search (as Restore Corpus does).
//
// Pinned: defaults, SETTINGS, migration and settings file agree (CLAUDE.md
// hard rules 1 and 2: upgraders keep every dictionary, in an order they can
// change); the normalizers; the sidebar pipeline with saved values.
//
// Loaded with vm.runInContext; see AGENTS.md hard rule #3.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const scriptBody = (relative) => read(relative).replace(/^\s*<script>/, '').replace(/<\/script>\s*$/, '');
const plain = (value) => JSON.parse(JSON.stringify(value));
const SHEM = JSON.parse(read('test/tests/fixtures/lexicon-shem.json')).entries;
const KEYS = ['lexicon_dictionary_order', 'lexicon_dictionary_excluded'];

function loadServer(stored) {
  const store = Object.assign({}, stored);
  const props = {
    getProperty: (name) => (Object.prototype.hasOwnProperty.call(store, name) ? store[name] : null),
    setProperty(name, value) { store[name] = String(value); return props; },
    deleteProperty(name) { delete store[name]; return props; },
    getProperties: () => Object.assign({}, store),
  };
  const context = { console, Logger: { log() {} }, PropertiesService: { getUserProperties: () => props } };
  vm.createContext(context);
  ['server/menu-layout.gs', 'server/preferences.gs', 'migrations.gs', 'server/first-run.gs', 'server/settings-file.gs']
    .forEach((file) => vm.runInContext(read('apps-script/' + file), context, { filename: file }));
  return { ctx: context, store };
}

test('the two keys: defaults "[]", writable from Preferences, in the settings file\'s Search part', () => {
  const { ctx } = loadServer();
  const defaults = ctx.getDefaultPreferences();
  const settings = vm.runInContext('SETTINGS', ctx);   // a const: not a property of the context
  KEYS.forEach((key) => {
    assert.equal(defaults[key], '[]', key);
    assert.ok(settings.includes(key), key + ' must be in SETTINGS');
    assert.equal(ctx.settingsFileGroupOf_(key), 'search', key);
  });
});

test('schema 27 gives an upgrader both keys as "[]" (every dictionary, the built-in order) and keeps a stored value', () => {
  const upgrader = loadServer({ prefs_schema_version: '26', nekudot: 'false' });
  upgrader.ctx.runUserPreferenceMigrationsIfNeeded_();
  assert.equal(upgrader.store.prefs_schema_version, JSON.parse(read('docs/VERSION.json')).prefsSchemaVersion);
  KEYS.forEach((key) => assert.equal(upgrader.store[key], '[]', key));
  assert.equal(upgrader.store.nekudot, 'false');

  const kept = loadServer({ prefs_schema_version: '26', lexicon_dictionary_excluded: '["dictionary-strongs"]' });
  kept.ctx.runUserPreferenceMigrationsIfNeeded_();
  assert.equal(kept.store.lexicon_dictionary_excluded, '["dictionary-strongs"]');
});

function loadState() {
  const context = { console, window: {} };
  vm.createContext(context);
  ['apps-script/shared/ui/core-shared.html', 'apps-script/shared/ui/state.html']
    .forEach((file) => vm.runInContext(scriptBody(file), context, { filename: file }));
  return context;
}

test('a stored order is completed with the catalog; unknown, repeated and malformed values are dropped', () => {
  const state = loadState();
  const builtIn = ['dictionary-klein', 'dictionary-bdb', 'dictionary-bdb-aramaic', 'dictionary-jastrow', 'dictionary-strongs', 'dictionary-ben-yehuda'];
  assert.deepEqual(plain(state.normalizeLexiconDictionaryOrder('[]')), builtIn);
  assert.deepEqual(plain(state.normalizeLexiconDictionaryOrder('not json')), builtIn);
  assert.deepEqual(plain(state.normalizeLexiconDictionaryOrder('["dictionary-jastrow","nope","dictionary-jastrow","dictionary-bdb"]')),
    ['dictionary-jastrow', 'dictionary-bdb', 'dictionary-klein', 'dictionary-bdb-aramaic', 'dictionary-strongs', 'dictionary-ben-yehuda']);
  assert.deepEqual(plain(state.normalizeLexiconDictionaryExcluded('["dictionary-strongs","dictionary-strongs","tanakh",""]')), ['dictionary-strongs']);
});

// The sidebar's results pipeline (results-render + lexicon) on Sefaria's
// answer for שם, with saved preferences.
function loadPipeline(preferences) {
  const html = {};
  const chain = (selector) => {
    const api = new Proxy(function () {}, {
      get(_, prop) {
        if (prop === 'html') return (value) => { if (value === undefined) return html[selector] || ''; html[selector] = value; return api; };
        if (prop === 'length') return 1;
        if (prop === 'val') return () => '';
        return () => api;
      },
      apply: () => api,
    });
    return api;
  };
  const server = { Logger: { log() {} } };
  vm.createContext(server);
  ['apps-script/server/utils.gs', 'apps-script/server/lexicon.gs'].forEach((file) => vm.runInContext(read(file), server, { filename: file }));
  const words = plain(server.groupLexiconEntries_(SHEM, 'שם'));

  const context = { console, $: chain, document: {}, window: {}, localStorage: { getItem: () => null, setItem() {} }, google: { script: { run: {} } }, setTimeout() {} };
  vm.createContext(context);
  ['apps-script/shared/ui/core-shared.html', 'apps-script/shared/ui/dom.html', 'apps-script/shared/ui/state.html',
    'apps-script/sidebar/js/preferences-state.html', 'apps-script/sidebar/js/results-render.html',
    'apps-script/sidebar/js/session-library.html',
    'apps-script/sidebar/js/preview-core.html', 'apps-script/sidebar/js/lexicon.html',
  ].forEach((file) => vm.runInContext(scriptBody(file), context, { filename: file }));
  Object.assign(context, {
    appMode: 'lexicon',
    effectivePreferences: Object.assign({}, preferences),
    selectedLexiconItem: null, selectedResultKey: null, resultsLoading: false,
    sanitizeSourceHtml: (value) => value,
    getSearchParameters: () => ({ sortMode: 'relevance', translationLanguages: [] }),
    setResultsLoading() {}, setFooterButtonStates() {}, updateModeDependentSections() {}, updateLexiconTabBadge() {},
    setInsertButtonState() {}, updateActionabilityUI() {}, clearVersionSelectors() {},
    renderResults() {}, syncRestoreCorpusButton() {}, setResultsHint() {},
  });
  context.resetResultPostProcessState();
  context.queryState = { rawLibraryMatches: [], rawSearchResults: words, libraryMatches: [], searchResults: [] };
  context.applyResultPostProcessing();
  const label = (e) => [e.dictionary, e.ordinal || e.strongNumber].filter(Boolean).join(' ');
  return {
    sidebar: context, html, words,
    entriesOf: (headWord) => Array.from(context.queryState.searchResults.find((w) => w.headWord === headWord).entries, label),
    chips: () => Array.from(context.resultPostProcessState.availableCorpora, (c) => c.label),
  };
}

test('a word\'s entries and the dictionary chips follow the saved order', () => {
  const builtIn = loadPipeline({});
  assert.deepEqual(builtIn.entriesOf('שֵׁם'), ['Klein I', 'Klein II', 'BDB I', 'BDB II', 'Jastrow I', 'Jastrow II', 'Jastrow',
    "Strong's 8034", "Strong's 8035", 'Ben-Yehuda']);

  const saved = loadPipeline({ lexicon_dictionary_order: '["dictionary-jastrow","dictionary-strongs"]' });
  assert.deepEqual(saved.entriesOf('שֵׁם'), ['Jastrow I', 'Jastrow II', 'Jastrow', "Strong's 8034", "Strong's 8035",
    'Klein I', 'Klein II', 'BDB I', 'BDB II', 'Ben-Yehuda']);
  assert.deepEqual(saved.chips(), ['Jastrow', "Strong's", 'Klein', 'BDB', 'BDB Aramaic', 'Ben-Yehuda']);
  // A word opens with the first entry of that order picked.
  saved.sidebar.selectLexiconWord(saved.sidebar.findLexiconWord(saved.words.find((w) => w.headWord === 'שֵׁם').ref));
  assert.equal(saved.sidebar.lexiconEntryLabel(saved.sidebar.selectedLexiconEntries()[0]), 'Jastrow I');
});

test('a dictionary hidden in Preferences is left out; its chip shows it for this search only', () => {
  const { sidebar, html, entriesOf } = loadPipeline({ lexicon_dictionary_excluded: '["dictionary-strongs","dictionary-ben-yehuda"]' });
  assert.deepEqual(entriesOf('שֵׁם'), ['Klein I', 'Klein II', 'BDB I', 'BDB II', 'Jastrow I', 'Jastrow II', 'Jastrow']);
  assert.equal(sidebar.lexiconCountLabel(sidebar.getAllRawResults()), '17 of 25 entries shown');
  // Its chip is there, crossed out, and says why.
  assert.match(html['.result-filter-strip'], /lexicon-dict-chip removed' data-corpus-key='dictionary-strongs' aria-pressed='false' title='Hidden in Preferences\. Show Strong&#39;s \(6 entries\) for this search'/);

  sidebar.toggleCorpusVisibility('dictionary-strongs');
  assert.deepEqual(entriesOf('שֵׁם'), ['Klein I', 'Klein II', 'BDB I', 'BDB II', 'Jastrow I', 'Jastrow II', 'Jastrow', "Strong's 8034", "Strong's 8035"]);
  assert.doesNotMatch(html['.result-filter-strip'], /removed' data-corpus-key='dictionary-strongs'/);

  // A new search starts from the saved choice again.
  sidebar.resetResultPostProcessState();
  sidebar.applyResultPostProcessing();
  assert.equal(entriesOf('שֵׁם').length, 7);
});

test('Preferences has the dictionary list, saved through two hidden fields, refreshed with the rest of the form', () => {
  const page = read('apps-script/preferences.html');
  const js = read('apps-script/preferences/js.html');
  assert.match(page, /id="lexicon-dictionary-order-list"/);
  assert.match(page, /id="lexicon-dictionary-order-reset"/);
  KEYS.forEach((key) => assert.match(page, new RegExp(`<input type="hidden" id="${key}" name="${key}" value="\\[\\]">`)));
  assert.match(js, /createOrderVisibilityEditor\(\{[\s\S]*?catalog: LEXICON_DICTIONARY_CATALOG/);
  // Filled when the stored preferences load, as the corpus list is.
  assert.match(js, /loadCorpusOrderFromFields\(\);\s*voicesTopicOrderEditor\.load\(\);\s*dictionaryOrderEditor\.load\(\);/);
  assert.match(js, /dictionaryOrderEditor\.init\(\);/);
});
