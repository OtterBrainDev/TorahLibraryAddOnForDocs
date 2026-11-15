// Pins that a Lexicon or Voices answer to an earlier query never fills the
// sidebar (BUG-005; sidebar/js/search-tabs.html).
//
// Observed: Texts search for Genesis 1:1, then Lexicon, then שלום. The list
// showed שלום's 14 entries under "No lexicon entries found for 'Genesis 1:1'".
// Switching to Lexicon looked up what was still in the search box; that empty
// answer arrived while שלום was being looked up, wrote its hint, and the 14
// entries arrived after it without clearing it. Lexicon and Voices had no
// request guard; Texts already dropped stale answers.
//
// Now a tab switch never searches (search-tabs.test.js), and every search is
// a run: an answer for a run its tab has replaced is dropped, hint and all.
//
// Loaded with vm.runInContext; see AGENTS.md hard rule #3.

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadSidebarSearch } = require('./helpers/sidebar-search-harness');

const entries = (n) => Array.from({ length: n }, (_, i) => ({
  key: `w${i}`, ref: `lexicon-word:שָׁלוֹם${i}`, headWord: 'שָׁלוֹם', label: 'שָׁלוֹם', match: 'direct',
  entries: [{ id: `e${i}`, dictionary: 'Jastrow' }],
}));

function inLexicon() {
  const env = loadSidebarSearch({ mode: 'lexicon' });
  env.ctx.setSidebarMode('lexicon', true);
  return env;
}

test('switching to Lexicon with "Genesis 1:1" in the box looks nothing up', () => {
  const env = loadSidebarSearch({ mode: 'texts' });
  env.type('Genesis 1:1');
  env.ctx.runUnifiedQuery();
  env.ctx.setSidebarMode('lexicon');
  assert.equal(env.pending('searchLexicon').length, 0);
});

test('an empty answer for an earlier query does not land under שלום', () => {
  const env = inLexicon();
  env.type('Genesis');
  env.ctx.runUnifiedQuery();
  env.type('שלום');
  env.ctx.runUnifiedQuery({ fromTyping: true });
  const [genesis, shalom] = env.pending('searchLexicon');
  assert.equal(genesis.args[0], 'Genesis');
  assert.equal(shalom.args[0], 'שלום');

  genesis.ok([]);                         // arrives while שלום is in flight
  shalom.ok(entries(14));

  assert.doesNotMatch(env.hint(), /Genesis/);
  assert.equal(env.raw().length, 14);
  assert.equal(env.dom.text['.lexicon-result-count'], '14 entries found');
});

test('the newer answer stands when the older one arrives last, and a stale failure says nothing', () => {
  const env = inLexicon();
  env.type('Genesis');
  env.ctx.runUnifiedQuery();
  env.type('שלום');
  env.ctx.runUnifiedQuery({ fromTyping: true });
  const [genesis, shalom] = env.pending('searchLexicon');

  shalom.ok(entries(14));
  genesis.ok([]);
  genesis.fail(new Error('Lexicon search is temporarily unavailable.'));

  assert.equal(env.raw().length, 14);
  assert.doesNotMatch(env.hint(), /Genesis|unavailable/);
});

test('a current query with no entries still says so, for that query', () => {
  const env = inLexicon();
  env.type('קקקק');
  env.ctx.runUnifiedQuery();
  env.last('searchLexicon').ok([]);
  assert.match(env.hint(), /No lexicon entries found for “קקקק”/);
});

test('Voices drops an answer to an earlier query too', () => {
  const env = loadSidebarSearch({ mode: 'voices' });
  env.ctx.setSidebarMode('voices', true);
  env.type('shabbat');
  env.ctx.runUnifiedQuery();
  env.type('shabbat candles');
  env.ctx.runUnifiedQuery({ fromTyping: true });
  const [first, second] = env.pending('searchVoices');
  second.ok([{ key: 's1', ref: 'sheet:1', label: 'Sheet 1' }, { key: 's2', ref: 'sheet:2', label: 'Sheet 2' }]);
  first.ok([]);
  assert.equal(env.raw().length, 2);
  assert.doesNotMatch(env.hint(), /No source sheets matched/);
});
