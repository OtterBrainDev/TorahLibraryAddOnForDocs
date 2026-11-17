// Surprise Me inserts each source with the saved Insertion defaults, as Insert
// from Selection and Link Texts do (buildLinkSourcesInsertOptions_). It called
// insertReference(data) with no options, so every source was numbered line by
// line and set side by side, whatever Preferences said: "Line numbers: off"
// was ignored here too. See docs/regression-log.md.
//
// The real insertSurpriseMe, preference reader and insert-options builder;
// the Sefaria search, the fetch and the insert itself are stand-ins. Loaded
// with vm; see AGENTS.md hard rule #3.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');
const FILES = [
  'apps-script/server/menu-layout.gs',
  'apps-script/server/preferences.gs',
  'apps-script/server/document-actions.gs',
  'apps-script/surprise-me-feature.gs',
];

const hit = (ref) => ({ _source: { ref, categories: ['Tanakh', 'Torah'], primary_category: 'Tanakh' } });
const passage = (ref) => ({
  ref, heRef: ref, indexTitle: 'Genesis', type: 'Tanakh', sections: [1, 1],
  he: ['בְּרֵאשִׁית בָּרָא', 'וְהָאָרֶץ הָיְתָה'], text: ['In the beginning', 'Now the earth'],
});

function loadSurpriseMe(stored) {
  const reads = { count: 0 };
  const properties = {
    getProperties() { reads.count += 1; return Object.assign({}, stored); },
    getProperty: (key) => (Object.prototype.hasOwnProperty.call(stored, key) ? stored[key] : null),
  };
  const inserts = [];
  const context = {
    console, Logger: { log() {} },
    PropertiesService: { getUserProperties: () => properties },
  };
  vm.createContext(context);
  FILES.forEach((file) => vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), context, { filename: file }));
  Object.assign(context, {
    findSearchAdvanced: () => [hit('Genesis 1:1-2'), hit('Exodus 3:1-2'), hit('Psalms 23:1-2')],
    findReference: (ref) => passage(ref),
    insertReference: (data, options) => { inserts.push({ ref: data.ref, options }); return { notice: '' }; },
  });
  return { ctx: context, inserts, reads };
}

// Plain objects: the context's own fail deepStrictEqual against these.
const plain = (value) => JSON.parse(JSON.stringify(value));

test('Surprise Me inserts with the saved Insertion defaults, as Insert from Selection does', () => {
  const stored = {
    show_line_markers_default: 'false',
    output_mode_default: 'he',
    bilingual_layout_default: 'he-top',
    insert_sefaria_link_default: 'false',
    insert_hebrew_sefaria_link_default: 'false',
    include_translation_source_info: 'false',
    insert_citation_default: 'true',
    include_transliteration_default: 'true',
    source_emphasis_mode: 'discard',
  };
  const { ctx, inserts } = loadSurpriseMe(stored);
  const result = ctx.insertSurpriseMe({ term: 'light', count: 2, corpuses: ['Tanakh'] });

  assert.equal(result.inserted, 2);
  assert.equal(inserts.length, 2);
  const expected = plain(ctx.buildLinkSourcesInsertOptions_(ctx.getPreferences()));
  inserts.forEach(({ ref, options }) => {
    assert.ok(options, ref + ' is inserted with options');
    assert.deepEqual(plain(options), expected, ref + ': the options Insert from Selection uses');
    assert.equal(options.pasukPreference, false, ref + ': Line numbers off');
    assert.equal(options.singleLanguage, 'he', ref + ': Hebrew only');
    assert.equal(options.insertSefariaLink, false);
    assert.equal(options.insertHebrewSefariaLink, false);
    assert.equal(options.insertCitationOnly, true, ref + ': the citation under it');
    assert.equal(options.includeTransliteration, true);
    assert.equal(options.sourceEmphasisMode, 'discard');
  });
  assert.notEqual(inserts[0].options, inserts[1].options, 'each insert has its own options object');
});

test('Surprise Me with Line numbers on (the default) still numbers the lines', () => {
  const { ctx, inserts } = loadSurpriseMe({});
  ctx.insertSurpriseMe({ term: 'light', count: 3, corpuses: ['Tanakh'] });
  assert.equal(inserts.length, 3);
  inserts.forEach(({ options }) => assert.equal(options.pasukPreference, true));
});

test('the arrangement and output follow Preferences, not a fixed side by side', () => {
  const { ctx, inserts } = loadSurpriseMe({ output_mode_default: 'both', bilingual_layout_default: 'he-left' });
  ctx.insertSurpriseMe({ term: 'light', count: 1, corpuses: ['Tanakh'] });
  assert.equal(inserts[0].options.singleLanguage, undefined, 'both languages');
  assert.equal(inserts[0].options.bilingualLayout, 'he-left');
});

test('the preferences are read once, however many sources are inserted', () => {
  const { ctx, inserts, reads } = loadSurpriseMe({ show_line_markers_default: 'false' });
  ctx.insertSurpriseMe({ term: 'light', count: 3, corpuses: ['Tanakh'] });
  assert.equal(inserts.length, 3);
  assert.equal(reads.count, 1);
});
