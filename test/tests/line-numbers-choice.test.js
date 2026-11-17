// The Line numbers switch (show_line_markers_default) reaches the insert as
// the reader left it. A preview used to force it on for every passage with
// verses to number (any Tanakh verse range) and off for a single block, so
// "Line numbers: off" was ignored on insert while the card still showed it
// off. See docs/regression-log.md.
//
// Runs the real sidebar partials (search, preview, Add Source) through
// helpers/sidebar-search-harness.js. Loaded with vm; see AGENTS.md hard rule #3.

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadSidebarSearch } = require('./helpers/sidebar-search-harness');

const GENESIS_1_1_3 = {
  ref: 'Genesis 1:1-3', heRef: 'בראשית א׳:א׳-ג׳', indexTitle: 'Genesis', type: 'Tanakh',
  sections: [1, 1], toSections: [1, 3],
  he: ['בְּרֵאשִׁית בָּרָא', 'וְהָאָרֶץ הָיְתָה', 'וַיֹּאמֶר אֱלֹהִים'],
  text: ['In the beginning', 'Now the earth', 'And God said'],
};
const GENESIS_1_1 = Object.assign({}, GENESIS_1_1_3, {
  ref: 'Genesis 1:1', heRef: 'בראשית א׳:א׳', toSections: [1, 1],
  he: 'בְּרֵאשִׁית בָּרָא', text: 'In the beginning',
});

// The parts of the page the harness doesn't load (the Insertion Options card,
// the busy overlay, the version lists).
const STUBS = {
  updateSuggestion() {}, updateActionabilityUI() {}, clearVersionSelectors() {},
  showBusyOverlay() {}, hideBusyOverlay() {}, showInsertNotice() {},
  ccNormalizeEmphasisMode: (value) => value || 'keep',
  ccNormalizeTranslitPosition: (value) => value || 'below',
  getSidebarTransliterationScheme: () => 'traditional',
};

function sidebarWithLineNumbers(stored) {
  const preferences = { show_line_markers_default: stored };
  const env = loadSidebarSearch({ mode: 'texts', preferences, stubs: STUBS });
  env.ctx.mergePreferenceDefaults(preferences);
  return env;
}

// Search for `ref`, take its one result, and answer its preview with `payload`.
function preview(env, ref, payload) {
  env.type(ref);
  env.ctx.runUnifiedQuery();
  env.last('findReferenceForSidebar').ok(payload);
  env.last('findSearchAdvanced').ok([]);
  (env.last('getNameCandidates') || { ok() {} }).ok([]);
  env.last('findReferenceForSidebar').ok(payload);
  assert.equal(env.get('hasResolvedReference'), true, ref + ' is ready to insert');
}

function addSource(env) {
  const before = env.pending('insertReference').length;
  env.click('#insert-source');
  const inserts = env.pending('insertReference');
  assert.equal(inserts.length, before + 1, 'Add Source inserts');
  return inserts[inserts.length - 1].args[1];
}

test('Line numbers off: a Tanakh verse range is inserted without them', () => {
  const env = sidebarWithLineNumbers('false');
  preview(env, 'Genesis 1:1-3', GENESIS_1_1_3);
  assert.equal(env.get("$('.wants-pesukim').prop('checked')"), false, 'the preview leaves the choice alone');
  assert.equal(addSource(env).pasukPreference, false);
});

test('Line numbers off stays off from one passage to the next', () => {
  const env = sidebarWithLineNumbers('false');
  preview(env, 'Genesis 1:1', GENESIS_1_1);
  assert.equal(addSource(env).pasukPreference, false);
  preview(env, 'Genesis 1:1-3', GENESIS_1_1_3);
  assert.equal(addSource(env).pasukPreference, false);
});

test('Line numbers on stays on, a single verse in between included', () => {
  const env = sidebarWithLineNumbers('true');
  preview(env, 'Genesis 1:1-3', GENESIS_1_1_3);
  assert.equal(addSource(env).pasukPreference, true);
  preview(env, 'Genesis 1:1', GENESIS_1_1);
  assert.equal(addSource(env).pasukPreference, true, 'a single block no longer switches it off');
  preview(env, 'Genesis 1:1-3', GENESIS_1_1_3);
  assert.equal(addSource(env).pasukPreference, true);
});

test('switching Line numbers off in the card reaches the next insert', () => {
  const env = sidebarWithLineNumbers('true');
  preview(env, 'Genesis 1:1-3', GENESIS_1_1_3);
  // What the card's toggle does to the sidebar's hidden checkbox
  // (composition-controls: _sidebarCompositionOnToggle('lines')).
  env.get("$('.wants-pesukim').prop('checked', false)");
  preview(env, 'Genesis 1:1-3', GENESIS_1_1_3);
  assert.equal(addSource(env).pasukPreference, false);
});
