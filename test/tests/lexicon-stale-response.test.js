// Pins that a Lexicon or Voices answer to an earlier query never fills the
// sidebar (BUG-005; sidebar/js/search-controller.html).
//
// Observed: Texts search for Genesis 1:1, then Lexicon, then שלום. The list
// showed שלום's 14 entries under "No lexicon entries found for 'Genesis 1:1'".
// Switching to Lexicon looked up what was still in the search box; that empty
// answer arrived while שלום was being looked up, wrote its hint, and the 14
// entries arrived after it without clearing it. Lexicon and Voices had no
// request guard; Texts already dropped stale answers by latestQueryRequestId.
//
// Loaded with vm.runInContext; see AGENTS.md hard rule #3.

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

const ROOT = path.resolve(__dirname, '..', '..');
const scriptBody = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8')
  .replace(/^\s*<script>/, '').replace(/<\/script>\s*$/, '');

function load() {
  const calls = [];
  const hints = [];
  const counts = [];
  let input = '';
  const chain = (selector) => {
    const api = new Proxy(function () {}, {
      get(_, prop) {
        if (prop === 'val') return (value) => { if (value === undefined) return selector === '.input' ? input : ''; return api; };
        if (prop === 'length') return 0;
        if (prop === 'text') return (value) => { if (selector === '.lexicon-result-count') counts.push(value); return api; };
        return () => api;
      },
      apply: () => api,
    });
    return api;
  };
  const run = new Proxy({}, {
    get(_, first) {
      const handlers = {};
      const builder = new Proxy({}, {
        get(__, name) {
          if (name === 'withSuccessHandler') return (fn) => { handlers.ok = fn; return builder; };
          if (name === 'withFailureHandler') return (fn) => { handlers.fail = fn; return builder; };
          return (...args) => calls.push({ name, args, ok: (v) => handlers.ok(v), fail: (e) => handlers.fail(e || new Error('x')) });
        },
      });
      return builder[first];
    },
  });
  const context = {
    console,
    appMode: 'lexicon',
    effectivePreferences: {},
    latestQueryRequestId: 0,
    latestResolveRequestId: 0,
    queryState: { rawLibraryMatches: [], rawSearchResults: [], libraryMatches: [], searchResults: [] },
    $: chain,
    google: { script: { run } },
    document: {},
    setTimeout() {},
  };
  context.window = context;
  vm.createContext(context);
  ['apps-script/shared/ui/core-shared.html', 'apps-script/shared/ui/state.html',
    'apps-script/sidebar/js/search-controller.html',
  ].forEach((file) => vm.runInContext(scriptBody(file), context, { filename: file }));
  Object.assign(context, {
    normalizeUnifiedReferenceInput: (v) => v,
    clearSelectedResult() {}, updateModeDependentSections() {}, setInsertButtonState() {},
    updateLexiconTabBadge() {}, updateVoicesTabBadge() {}, renderLexiconHistory() {}, renderLexiconBookmarks() {},
    announceLexiconStatus() {}, setResultsLoading() {}, reprocessAndRenderResults() {}, saveLexiconHistory() {},
    setResultsHint: (message) => hints.push(message),
  });
  return {
    context, calls, hints, counts,
    type(value) { input = value; },
    pending: (name) => calls.filter((c) => c.name === name),
  };
}

const entries = (n) => Array.from({ length: n }, (_, i) => ({ key: `e${i}`, ref: `Jastrow, שָׁלוֹם ${i}` }));

test('an empty answer for the query still in the box when Lexicon opened does not land under שלום', () => {
  const env = load();
  env.type('Genesis 1:1');
  env.context.runLexiconQuery();          // the mode switch re-runs the box
  env.type('שלום');
  env.context.runLexiconQuery(true);      // typed
  const [genesis, shalom] = env.pending('searchLexicon');
  assert.equal(genesis.args[0], 'Genesis 1:1');
  assert.equal(shalom.args[0], 'שלום');

  genesis.ok([]);                         // arrives while שלום is in flight
  shalom.ok(entries(14));

  assert.equal(env.hints.some((h) => /Genesis 1:1/.test(h)), false, JSON.stringify(env.hints));
  assert.equal(env.context.queryState.rawSearchResults.length, 14);
  assert.deepEqual(env.counts, ['14 entries found']);
});

test('the newer answer stands when the older one arrives last, and a stale failure says nothing', () => {
  const env = load();
  env.type('Genesis 1:1');
  env.context.runLexiconQuery();
  env.type('שלום');
  env.context.runLexiconQuery(true);
  const [genesis, shalom] = env.pending('searchLexicon');

  shalom.ok(entries(14));
  genesis.ok([]);
  genesis.fail(new Error('Lexicon search is temporarily unavailable.'));

  assert.equal(env.context.queryState.rawSearchResults.length, 14);
  assert.equal(env.hints.some((h) => /Genesis 1:1|unavailable/.test(h)), false, JSON.stringify(env.hints));
});

test('a current query with no entries still says so, for that query', () => {
  const env = load();
  env.type('קקקק');
  env.context.runLexiconQuery();
  env.pending('searchLexicon')[0].ok([]);
  assert.match(env.hints[env.hints.length - 1], /No lexicon entries found for “קקקק”/);
});

test('Voices drops an answer to an earlier query too', () => {
  const env = load();
  env.context.appMode = 'voices';
  env.type('shabbat');
  env.context.runVoicesQuery();
  env.type('shabbat candles');
  env.context.runVoicesQuery(true);
  const [first, second] = env.pending('searchVoices');
  second.ok([{ key: 's1', ref: 'Sheet 1' }, { key: 's2', ref: 'Sheet 2' }]);
  first.ok([]);
  assert.equal(env.context.queryState.rawSearchResults.length, 2);
  assert.equal(env.hints.some((h) => /No source sheets matched/.test(h)), false);
});
