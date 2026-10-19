const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '../..');

function readScriptBody(relativePath) {
  const html = fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
  return html.replace(/^\s*<script>/, '').replace(/<\/script>\s*$/, '');
}

// Loads the shared corpus helpers plus the sidebar results pipeline into a
// sandbox. DOM-touching render helpers are stubbed; everything under test is
// pure state manipulation.
function loadSidebarResults(preferences) {
  const context = {
    console,
    appMode: 'texts',
    effectivePreferences: Object.assign({}, preferences),
    selectedResultKey: null,
    queryState: { rawLibraryMatches: [], rawSearchResults: [], libraryMatches: [], searchResults: [] },
    resultPostProcessState: null,
    getSearchParameters() { return { sortMode: 'relevance', translationOnly: false, translationLanguages: [] }; },
    setResultsLoading() {},
    normalizeOptionText(value) { return String(value || ''); },
  };
  context.window = context;
  vm.createContext(context);
  ['apps-script/shared/ui/core-shared.html', 'apps-script/shared/ui/state.html', 'apps-script/sidebar/js/results-render.html']
    .forEach((file) => vm.runInContext(readScriptBody(file), context, { filename: file }));
  context.renderResultFilterStrip = () => {};
  context.resetResultPostProcessState();
  return context;
}

function item(ref, clusterLabel, extra) {
  return Object.assign({ key: 'k-' + ref, ref, label: ref, clusterLabel }, extra || {});
}

test('default corpus order puts close matches right after the pinned Library group', () => {
  const ctx = loadSidebarResults({ search_corpus_order: '[]' });
  const order = ctx.normalizeSearchCorpusOrder('[]');
  assert.equal(order[0], 'close-matches');
  assert.equal(order.length, ctx.SEARCH_CORPUS_CATALOG.length);
  assert.ok(order.indexOf('library') < 0, 'Library group is pinned, never part of the order');
});

test('stored order drops unknown/duplicate keys and appends missing catalog keys', () => {
  const ctx = loadSidebarResults({});
  const order = ctx.normalizeSearchCorpusOrder('["talmud","bogus","talmud","close-matches"]');
  assert.deepEqual(Array.from(order.slice(0, 3)), ['talmud', 'close-matches', 'tanakh']);
  assert.equal(order.length, ctx.SEARCH_CORPUS_CATALOG.length);
});

test('the Library group can never be excluded', () => {
  const ctx = loadSidebarResults({});
  assert.deepEqual(Array.from(ctx.normalizeSearchCorpusExcluded('["library","kabbalah","kabbalah"]')), ['kabbalah']);
});

test('clusters follow the default order: Library, close matches, library order, then unknown corpora', () => {
  const ctx = loadSidebarResults({ search_corpus_order: '[]' });
  const clusters = ['Talmud', 'Some New Corpus', 'Close matches', 'Library', 'Tanakh'];
  const buckets = {};
  clusters.forEach((label) => { buckets[label] = [item(label, label)]; });
  assert.deepEqual(
    Array.from(ctx.sortClustersByCorpusPreference(clusters, buckets, 'Library matches')),
    ['Library', 'Close matches', 'Tanakh', 'Talmud', 'Some New Corpus']
  );
});

test('close matches are reorderable like any corpus; Library stays first', () => {
  const ctx = loadSidebarResults({ search_corpus_order: '["talmud","tanakh","close-matches"]' });
  const clusters = ['Close matches', 'Tanakh', 'Library', 'Talmud'];
  const buckets = {};
  clusters.forEach((label) => { buckets[label] = [item(label, label)]; });
  assert.deepEqual(
    Array.from(ctx.sortClustersByCorpusPreference(clusters, buckets, 'Library matches')),
    ['Library', 'Talmud', 'Tanakh', 'Close matches']
  );
});

test('excluded corpora are filtered from text results and can be restored for one search', () => {
  const ctx = loadSidebarResults({ search_corpus_excluded: '["kabbalah","close-matches"]' });
  ctx.queryState.rawLibraryMatches = [
    item('Genesis 1:1', 'Library', { key: 'library-ref-Genesis 1:1', subtitle: 'Direct reference lookup' }),
    item('Genesis', 'Close matches', { isFuzzy: true }),
  ];
  ctx.queryState.rawSearchResults = [item('Zohar 1:1', 'Kabbalah'), item('Berakhot 2a', 'Talmud')];

  ctx.applyResultPostProcessing();
  assert.deepEqual(Array.from(ctx.getAllProcessedResults(), (r) => r.ref), ['Genesis 1:1', 'Berakhot 2a']);
  assert.deepEqual(
    Array.from(ctx.getRestorableCorpora(), (c) => c.key).sort(),
    ['close-matches', 'kabbalah']
  );

  ctx.renderResults = () => {};
  ctx.toggleCorpusVisibility('kabbalah');
  assert.deepEqual(Array.from(ctx.getAllProcessedResults(), (r) => r.ref), ['Genesis 1:1', 'Zohar 1:1', 'Berakhot 2a']);

  // A new search starts from the preference again.
  ctx.resetResultPostProcessState();
  ctx.applyResultPostProcessing();
  assert.deepEqual(Array.from(ctx.getAllProcessedResults(), (r) => r.ref), ['Genesis 1:1', 'Berakhot 2a']);
});

test('corpus preferences do not apply outside texts mode', () => {
  const ctx = loadSidebarResults({ search_corpus_excluded: '["source-sheets"]' });
  ctx.appMode = 'voices';
  ctx.queryState.rawSearchResults = [item('sheet:1', 'Source Sheets')];
  ctx.applyResultPostProcessing();
  assert.deepEqual(Array.from(ctx.getAllProcessedResults(), (r) => r.ref), ['sheet:1']);
});

test('server defaults and migration agree on the new corpus preference keys', () => {
  const prefs = fs.readFileSync(path.join(ROOT, 'apps-script/server/preferences.gs'), 'utf8');
  const migrations = fs.readFileSync(path.join(ROOT, 'apps-script/migrations.gs'), 'utf8');
  ['search_corpus_order', 'search_corpus_excluded'].forEach((key) => {
    assert.match(prefs, new RegExp(`"${key}",`), `${key} must be in SETTINGS`);
    assert.match(prefs, new RegExp(`${key}: "\\[\\]"`), `${key} must default to "[]"`);
    assert.match(migrations, new RegExp(`'${key}'`), `${key} must have a migration`);
  });
});
