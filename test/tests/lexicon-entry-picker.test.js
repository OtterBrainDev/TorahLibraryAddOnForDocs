// The Lexicon tab's word list and entry list (sidebar/js/lexicon.html). A
// word's dictionary entries are picked the way a text's translations are: the
// first is selected, a click adds or removes one, at least one stays
// selected, and Add Entry sends them in the order picked. Copy gives the same
// lines Add Entry writes (planLexiconInsertion_, server/lexicon.gs).
//
// Loaded with vm.runInContext; see AGENTS.md hard rule #3.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');
const SHEM = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'lexicon-shem.json'), 'utf8')).entries;
const scriptBody = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8')
  .replace(/^\s*<script>/, '').replace(/<\/script>\s*$/, '');

function serverWords(query) {
  const context = { Logger: { log() {} } };
  vm.createContext(context);
  ['apps-script/server/utils.gs', 'apps-script/server/lexicon.gs'].forEach((file) => {
    vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), context, { filename: file });
  });
  return { server: context, words: JSON.parse(JSON.stringify(context.groupLexiconEntries_(SHEM, query))) };
}

function loadSidebar() {
  const html = {};
  const text = {};
  let format = 'entry';
  const chain = (selector) => {
    const api = new Proxy(function () {}, {
      get(_, prop) {
        if (prop === 'html') return (value) => { if (value === undefined) return html[selector] || ''; html[selector] = value; return api; };
        if (prop === 'text') return (value) => { if (value === undefined) return text[selector] || ''; text[selector] = value; return api; };
        if (prop === 'data') return () => (selector === '.lexicon-format-btn[aria-checked="true"]' ? format : undefined);
        if (prop === 'length') return 1;
        return () => api;
      },
      apply: () => api,
    });
    return api;
  };
  const context = {
    console,
    appMode: 'lexicon',
    selectedLexiconItem: null,
    selectedResultKey: null,
    $: chain,
    document: {},
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    google: { script: { run: {} } },
    setTimeout() {},
    setFooterButtonStates() {},
  };
  context.window = context;
  vm.createContext(context);
  ['apps-script/shared/ui/core-shared.html', 'apps-script/shared/ui/dom.html',
    'apps-script/sidebar/js/preview-core.html', 'apps-script/sidebar/js/lexicon.html']
    .forEach((file) => vm.runInContext(scriptBody(file), context, { filename: file }));
  // Node has no DOMParser; sanitize-source-html.test.js covers the sanitizer.
  context.sanitizeSourceHtml = (value) => value;
  return { sidebar: context, html, text, setFormat(value) { format = value; } };
}

// Arrays made inside the VM are compared by value, not realm.
const picked = (sidebar) => Array.from(sidebar.selectedLexiconEntries(), (e) => sidebar.lexiconEntryLabel(e));

test('a word opens with its first entry picked; clicks add and remove, in the order clicked', () => {
  const { words } = serverWords('שם');
  const { sidebar, html } = loadSidebar();
  sidebar.selectLexiconWord(words[0]);
  assert.deepEqual(picked(sidebar), ['Klein I']);
  const [klein, bdb1, bdb2] = words[0].entries;

  sidebar.toggleLexiconEntry(bdb2.id);
  sidebar.toggleLexiconEntry(bdb1.id);
  assert.deepEqual(picked(sidebar), ['Klein I', 'BDB II', 'BDB I']);
  // The list shows each one's place in that order.
  const list = html['#lexicon-entry-list'];
  const checks = [...list.matchAll(/lexicon-entry-check' aria-hidden='true'>([^<]*)</g)].map((m) => m[1]);
  assert.deepEqual(checks, ['1', '3', '2']);

  sidebar.toggleLexiconEntry(klein.id);
  assert.deepEqual(picked(sidebar), ['BDB II', 'BDB I']);

  const payload = JSON.parse(JSON.stringify(sidebar.buildLexiconInsertPayload()));
  assert.equal(payload.headWord, 'שֵׁם');
  assert.equal(payload.insertMode, 'entry');
  assert.deepEqual(payload.entries.map((e) => e.id), [bdb2.id, bdb1.id]);
});

test('the last picked entry stays picked, and the sidebar says why', () => {
  const { words } = serverWords('שם');
  const { sidebar, text } = loadSidebar();
  sidebar.selectLexiconWord(words[0]);
  sidebar.toggleLexiconEntry(words[0].entries[0].id);
  assert.deepEqual(picked(sidebar), ['Klein I']);
  assert.match(text['#lexicon-selected-display'], /At least one entry stays selected/);
});

test('Select all adds the rest after what was already picked', () => {
  const { words } = serverWords('שם');
  const { sidebar } = loadSidebar();
  sidebar.selectLexiconWord(words[0]);
  sidebar.toggleLexiconEntry(words[0].entries[2].id);
  sidebar.selectAllLexiconEntries();
  assert.deepEqual(picked(sidebar), ['Klein I', 'BDB II', 'BDB I']);
});

test('picking another word starts over from its first entry', () => {
  const { words } = serverWords('שם');
  const { sidebar } = loadSidebar();
  sidebar.selectLexiconWord(words[0]);
  sidebar.toggleLexiconEntry(words[0].entries[1].id);
  sidebar.selectLexiconWord(words[1]);
  assert.deepEqual(picked(sidebar), ['BDB I']);
  assert.equal(sidebar.buildLexiconInsertPayload().headWord, 'שׂוּם');
});

test('the word list: Matches, then Related words; Closest words when nothing is spelled as typed', () => {
  const { sidebar } = loadSidebar();
  const capture = () => { let out = ''; return { html(v) { out = v; }, get out() { return out; } }; };
  const labels = (markup) => [...markup.matchAll(/lexicon-word-group-label' role='presentation'>([^<]*)</g)].map((m) => m[1]);
  const rows = (markup) => [...markup.matchAll(/lexicon-row-headword' lang='he' dir='rtl'>([^<]*)</g)].map((m) => m[1]);

  const list = capture();
  sidebar.renderLexiconWordList(list, serverWords('שם').words);
  assert.deepEqual(labels(list.out), ['Matches', 'Related words']);
  assert.deepEqual(rows(list.out), ['שֵׁם', 'שׂוּם', 'שׂוּמָה', 'שִׂים', 'שָׁמֵם']);
  // A row names its dictionaries and its entries' glosses.
  assert.match(list.out, /Klein · BDB ×2/);
  assert.match(list.out, /name, designation; reputation, renown, fame; name, as designation of God · name · first son of Noah/);

  const inflected = capture();
  sidebar.renderLexiconWordList(inflected, serverWords('וישם').words);
  assert.deepEqual(labels(inflected.out), ['Closest words']);

  const hostile = capture();
  sidebar.renderLexiconWordList(hostile, [{ key: 'k', ref: 'r', headWord: '<img src=x onerror=alert(1)>', match: 'direct', entries: [] }]);
  assert.doesNotMatch(hostile.out, /<img/);
});

test('Copy gives the lines Add Entry writes, in every mode', () => {
  const { server, words } = serverWords('שם');
  const { sidebar } = loadSidebar();
  const sum = words[1].entries[0];
  const [klein, bdb1, bdb2] = words[0].entries;
  [[bdb1, klein], [sum], [klein, bdb2]].forEach((entries) => {
    ['entry', 'headword', 'definition'].forEach((mode) => {
      const plan = JSON.parse(JSON.stringify(server.planLexiconInsertion_(entries, mode)));
      const expected = plan.map((p) => '    '.repeat(p.depth || 0) + (p.text !== undefined ? p.text : p.runs.map((r) => r.text).join('')));
      assert.deepEqual(sidebar.lexiconPlainTextForCopy(entries, mode).split('\n'), expected, mode + ': ' + entries.map((e) => e.id).join(', '));
    });
  });
});

test('What to insert is described for the entries picked, in order', () => {
  const { words } = serverWords('שם');
  const { sidebar } = loadSidebar();
  const [klein, bdb1] = words[0].entries;
  assert.equal(sidebar.lexiconInsertSummary([klein], 'entry'), 'Will insert: the full entry');
  assert.equal(sidebar.lexiconInsertSummary([klein, bdb1], 'entry'), 'Will insert: 2 full entries — Klein I, then BDB I');
  assert.equal(sidebar.lexiconInsertSummary([klein, bdb1], 'definition'), 'Will insert: the definitions from Klein I, then BDB I');
  assert.equal(sidebar.lexiconInsertSummary([klein, bdb1], 'headword'), 'Will insert: the word and the dictionaries’ names (Klein I, BDB I)');
});

// Dictionaries are filtered like corpora: the real result pipeline
// (results-render: toggleCorpusVisibility → applyResultPostProcessing) with
// each dictionary as a corpus.
function loadPipeline(words) {
  const html = {};
  const text = {};
  const hints = [];
  const chain = (selector) => {
    const api = new Proxy(function () {}, {
      get(_, prop) {
        if (prop === 'html') return (value) => { if (value === undefined) return html[selector] || ''; html[selector] = value; return api; };
        if (prop === 'text') return (value) => { if (value === undefined) return text[selector] || ''; text[selector] = value; return api; };
        if (prop === 'length') return 1;
        if (prop === 'val') return () => '';
        return () => api;
      },
      apply: () => api,
    });
    return api;
  };
  const context = {
    console, $: chain, document: {}, window: {},
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    google: { script: { run: {} } }, setTimeout() {},
  };
  vm.createContext(context);
  ['apps-script/shared/ui/core-shared.html', 'apps-script/shared/ui/dom.html', 'apps-script/shared/ui/state.html',
    'apps-script/sidebar/js/preferences-state.html', 'apps-script/sidebar/js/results-render.html',
    'apps-script/sidebar/js/preview-core.html', 'apps-script/sidebar/js/lexicon.html',
  ].forEach((file) => vm.runInContext(scriptBody(file), context, { filename: file }));
  Object.assign(context, {
    appMode: 'lexicon',
    effectivePreferences: {},
    selectedLexiconItem: null,
    selectedResultKey: null,
    resultsLoading: false,
    sanitizeSourceHtml: (value) => value,
    getSearchParameters: () => ({ sortMode: 'relevance', translationLanguages: [] }),
    setResultsLoading() {}, setFooterButtonStates() {}, updateModeDependentSections() {}, updateLexiconTabBadge() {},
    setInsertButtonState() {}, updatePesukimAvailability() {}, updateActionabilityUI() {}, clearVersionSelectors() {},
    renderResults() {}, syncRestoreCorpusButton() {},
    setResultsHint: (message) => hints.push(message),
  });
  context.resetResultPostProcessState();
  context.queryState = { rawLibraryMatches: [], rawSearchResults: words, libraryMatches: [], searchResults: [] };
  context.applyResultPostProcessing();
  return { sidebar: context, html, text, hints };
}

const visible = (sidebar) => Array.from(sidebar.queryState.searchResults, (w) => w.headWord + ': ' + w.entries.map((e) => sidebar.lexiconEntryLabel(e)).join(', '));

test('a chip per dictionary, with its entry count, over the word list', () => {
  const { words } = serverWords('שם');
  const { sidebar, html } = loadPipeline(words);
  assert.deepEqual(Array.from(sidebar.resultPostProcessState.availableCorpora, (c) => c.label + ' ' + c.count),
    ['Klein 1', 'BDB 7', 'BDB Aramaic 1']);
  const strip = html['.result-filter-strip'];
  assert.match(strip, /Dictionaries:/);
  assert.deepEqual([...strip.matchAll(/data-corpus-key='([^']+)'/g)].map((m) => m[1]),
    ['dictionary-klein', 'dictionary-bdb', 'dictionary-bdb-aramaic']);
  assert.doesNotMatch(strip, /removed/);
});

test('hiding a dictionary takes its entries out of every word; a word left with none drops out', () => {
  const { words } = serverWords('שם');
  const { sidebar, html } = loadPipeline(words);
  sidebar.toggleCorpusVisibility('dictionary-bdb');
  assert.deepEqual(visible(sidebar), ['שֵׁם: Klein I', 'שׂוּם: BDB Aramaic']);
  assert.equal(sidebar.lexiconCountLabel(words), '2 of 9 entries shown');
  assert.match(html['.result-filter-strip'], /lexicon-dict-chip removed' data-corpus-key='dictionary-bdb' aria-pressed='false'/);
  // The answer itself is untouched: showing BDB again brings every entry back.
  assert.equal(words[0].entries.length, 3);
  sidebar.toggleCorpusVisibility('dictionary-bdb');
  assert.equal(visible(sidebar).length, 5);
  assert.equal(sidebar.lexiconCountLabel(words), '9 entries found');
});

test('the selected word keeps its picks that are still shown, or starts again from its first entry', () => {
  const { words } = serverWords('שם');
  const { sidebar } = loadPipeline(words);
  sidebar.selectLexiconWord(sidebar.findLexiconWord(words[0].ref));
  sidebar.toggleLexiconEntry(words[0].entries[1].id);            // Klein I, BDB I
  sidebar.toggleCorpusVisibility('dictionary-bdb');
  assert.deepEqual(picked(sidebar), ['Klein I']);
  sidebar.toggleCorpusVisibility('dictionary-bdb');
  sidebar.toggleCorpusVisibility('dictionary-klein');
  assert.deepEqual(picked(sidebar), ['BDB I']);                    // nothing picked was left
  assert.equal(sidebar.buildLexiconInsertPayload().entries.length, 1);
});

test('a word whose dictionaries are all hidden is unselected; with every dictionary hidden, the sidebar says so', () => {
  const { words } = serverWords('שם');
  const { sidebar, hints } = loadPipeline(words);
  sidebar.selectLexiconWord(sidebar.findLexiconWord(words[2].ref));   // שׂוּמָה: BDB only
  sidebar.toggleCorpusVisibility('dictionary-bdb');
  assert.equal(sidebar.selectedLexiconItem, null);
  sidebar.toggleCorpusVisibility('dictionary-klein');
  sidebar.toggleCorpusVisibility('dictionary-bdb-aramaic');
  assert.equal(sidebar.queryState.searchResults.length, 0);
  assert.match(hints[hints.length - 1], /Every dictionary is hidden/);
  sidebar.toggleCorpusVisibility('dictionary-klein');
  assert.equal(hints[hints.length - 1], '');
});
