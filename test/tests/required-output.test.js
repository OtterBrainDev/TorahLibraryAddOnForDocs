// Missing Display languages must fail before document target resolution can
// replace a selection. Both retains its one-language fallback. Run the actual
// insertion and menu/Link Texts entry points with small document stand-ins.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { loadSourceInsertion } = require('./helpers/source-insertion-harness');
const { loadSidebarSearch } = require('./helpers/sidebar-search-harness');
const app = path.resolve(__dirname, '../../apps-script');
const payload = (extra = {}) => ({ ref: 'Genesis 1:1', heRef: 'בראשית א:א', indexTitle: 'Genesis',
  sections: [1, 1], heVersionTitle: 'Source', versionTitle: 'Translation', he: ['בראשית'], text: ['In the beginning'], ...extra });
const note = '<sup class="footnote-marker">a</sup><i class="footnote">A note alone</i>';

function watchTarget(env) {
  let resolved = false;
  env.ctx.resolveInsertionTarget_ = () => { resolved = true; throw new Error('Document target must not be touched'); };
  return () => resolved;
}

test('explicit missing Display languages fail before target resolution or document writes, even with numbering', () => {
  for (const language of ['he', 'en']) {
    const env = loadSourceInsertion();
    const touched = watchTarget(env);
    const missing = payload(language === 'he' ? { he: ['', '<b></b>'], heVersionTitle: '' } : { text: ['', '<b></b>'], versionTitle: '' });
    assert.throws(() => env.ctx.insertReference(missing, { singleLanguage: language, pasukPreference: true }),
      language === 'he' ? /No original text.*Translation or Both in Display/ : /No translation text.*Original or Both in Display/);
    assert.equal(touched(), false);
    assert.deepEqual(env.texts(), []);
  }
});

test('Both inserts the available language alone and refuses a wholly empty or policy-empty source', () => {
  for (const available of ['he', 'en']) {
    const env = loadSourceInsertion();
    const data = payload(available === 'he' ? { text: [], versionTitle: '' } : { he: [], heVersionTitle: '' });
    env.ctx.insertReference(data, { bilingualLayout: 'he-right', pasukPreference: false });
    assert.equal(env.tables.length, 0);
    assert.deepEqual(env.texts(), available === 'he' ? ['בראשית א:א', 'בראשית'] : ['Genesis 1:1', 'In the beginning']);
  }
  const describedImage = loadSourceInsertion();
  describedImage.ctx.insertReference(payload({ he: [], text: ['<img alt="Diagram description" src="https://example.com/image.png">'] }), { pasukPreference: false });
  assert.deepEqual(describedImage.texts(), ['Genesis 1:1', 'Diagram description'], 'a supplied image description is actual insertable content');
  for (const data of [payload({ he: [], text: [] }), payload({ he: [], text: [note] })]) {
    const env = loadSourceInsertion();
    const touched = watchTarget(env);
    assert.throws(() => env.ctx.insertReference(data, { sourceNotesMode: 'omit', pasukPreference: true }), /No text is available/);
    assert.equal(touched(), false);
  }
});

function loadDocumentActions(env) {
  for (const file of ['server/sefaria-fetch.gs', 'server/document-actions.gs']) {
    vm.runInContext(fs.readFileSync(path.join(app, file), 'utf8'), env.ctx, { filename: file });
  }
  env.ctx.DocumentApp.ElementType = { TEXT: 'TEXT', PARAGRAPH: 'PARAGRAPH', LIST_ITEM: 'LIST_ITEM' };
}

test('Insert from Selection opens review without writing the document, even in quiet mode', () => {
  const env = loadSourceInsertion({ preferences: { linker_review_mode: 'quiet' } });
  loadDocumentActions(env);
  const touched = watchTarget(env);
  const scope = { selected: true, insertIntent: true };
  let opened;
  env.ctx.captureLinkerScope_ = () => scope;
  env.ctx.confirmLinkerUploadOnce_ = () => true;
  env.ctx.openLinkerReview_ = (value) => { opened = value; };
  env.ctx.insertSourceFromSelection();
  assert.equal(opened, scope);
  assert.equal(touched(), false);
  assert.deepEqual(env.texts(), []);
});

test('Link Texts retains its citation when the requested Display language has no content', () => {
  const env = loadSourceInsertion({ preferences: { output_mode_default: 'en', insert_from_selection_replace: 'true' } });
  loadDocumentActions(env);
  const touched = watchTarget(env);
  let removed = false;
  const anchor = { getType: () => 'PARAGRAPH', getText: () => 'Genesis 1:1' };
  env.ctx.findLinkerCitation_ = () => ({ block: anchor, citation: 'Genesis 1:1', linked: true });
  env.ctx.findReferenceWithPreferences_ = () => payload({ text: [], versionTitle: '' });
  env.ctx.removeLinkerCitationBlock_ = () => { removed = true; };
  assert.throws(() => env.ctx.insertLinkedSourceAtPosition('Genesis 1:1', {}, {}), /No translation text.*Original or Both/);
  assert.equal(touched(), false);
  assert.equal(removed, false);
  assert.deepEqual(env.texts(), []);
});

test('multi-translation Both falls back to translations when no original exists and rejects Original-only calls', () => {
  const versions = { One: payload({ he: [], heVersionTitle: '', versionTitle: 'One', text: ['First'] }),
    Two: payload({ he: [], heVersionTitle: '', versionTitle: 'Two', text: ['Second'] }) };
  const env = loadSourceInsertion({ versions });
  const result = env.ctx.insertReferenceVersions('Genesis 1:1', { versionTitles: ['One', 'Two'], bilingualLayout: 'he-top', alignedRows: true, pasukPreference: false });
  assert.deepEqual(Array.from(result.inserted), ['One', 'Two']);
  assert.ok(env.texts().includes('First') && env.texts().includes('Second'));
  assert.ok(!env.texts().includes('בראשית א:א'), 'there is no empty original block');
  const invalid = loadSourceInsertion({ versions });
  const touched = watchTarget(invalid);
  assert.throws(() => invalid.ctx.insertReferenceVersions('Genesis 1:1', { versionTitles: ['One', 'Two'], singleLanguage: 'he' }), /Multiple translations require Translation or Both/);
  assert.equal(touched(), false);
});

test('multi-translation policy omissions stay distinct from unavailable editions and never create empty blocks', () => {
  const versions = { Notes: payload({ versionTitle: 'Notes', text: [note] }),
    Empty: payload({ versionTitle: 'Empty', text: [] }), Main: payload({ versionTitle: 'Main' }) };
  for (const alignedRows of [false, true]) {
    const env = loadSourceInsertion({ versions });
    const result = env.ctx.insertReferenceVersions('Genesis 1:1', { versionTitles: ['Notes', 'Empty', 'Main'],
      bilingualLayout: 'he-top', alignedRows, sourceNotesMode: 'omit', pasukPreference: false });
    assert.deepEqual(Array.from(result.inserted), ['Main']);
    assert.deepEqual(Array.from(result.skipped), ['Empty']);
    assert.deepEqual(Array.from(result.filtered), ['Notes']);
    assert.ok(!env.texts().some((text) => text.includes('(Notes)') || text.includes('(Empty)')));
    assert.ok(env.texts().includes('In the beginning'));
  }
  const none = loadSourceInsertion({ versions });
  const touched = watchTarget(none);
  assert.throws(() => none.ctx.insertReferenceVersions('Genesis 1:1', { versionTitles: ['Notes', 'Empty'], sourceNotesMode: 'omit' }),
    /None of the selected translations has text.*with these options/);
  assert.equal(touched(), false);
});

test('sidebar reports policy omissions without marking those editions unavailable', () => {
  const warnings = [];
  const env = loadSidebarSearch({ stubs: {
    showBusyOverlay() {}, hideBusyOverlay() {}, showInsertNotice() {}, upsertSessionEntry() {},
    buildSessionEntry() { return {}; }, getCurrentCorpusForRef() { return ''; }, showInsertWarning(message) { warnings.push(message); },
    ccNormalizeEmphasisMode: (value) => value || 'keep', ccNormalizeNotesMode: (value) => value || 'omit',
    ccNormalizeTranslitPosition: () => 'below', getSidebarTransliterationScheme: () => 'traditional',
  } });
  env.ctx.hasResolvedReference = true;
  env.ctx.data = payload();
  env.ctx.orderedTranslationVersions = ['Notes', 'Main'];
  env.dom.val['.output-mode-selection'] = 'en';
  env.dom.prop['.translation-version-select'] = { multiple: true };
  env.click('#insert-source');
  env.last('insertReferenceVersions').ok({ inserted: ['Main'], skipped: [], filtered: ['Notes'] });
  assert.equal(env.ctx.translationAvailabilityByRef['Genesis 1:1::Notes'], undefined);
  assert.deepEqual(Array.from(env.ctx.orderedTranslationVersions), ['Notes', 'Main']);
  assert.match(warnings.at(-1), /no text remained.*Commentary and Notes.*Notes.*Change those options/);
  env.click('#insert-source');
  env.last('insertReferenceVersions').ok({ inserted: ['Main'], skipped: ['Notes'], filtered: [] });
  assert.equal(env.ctx.translationAvailabilityByRef['Genesis 1:1::Notes'], false, 'actually unavailable editions still update availability');
  assert.deepEqual(Array.from(env.ctx.orderedTranslationVersions), ['Main']);
});


test('insertion failures appear by Add Source, clear the busy state and leave retry available', () => {
  let busy = false;
  const env = loadSidebarSearch({ stubs: {
    showBusyOverlay() { busy = true; }, hideBusyOverlay() { busy = false; },
    ccNormalizeEmphasisMode: () => 'keep', ccNormalizeNotesMode: () => 'omit',
    ccNormalizeTranslitPosition: () => 'below', getSidebarTransliterationScheme: () => 'traditional',
  } });
  const warning = '#sidebar-insert-warning';
  env.ctx.hasResolvedReference = true;
  env.ctx.data = payload();
  env.dom.val['.output-mode-selection'] = 'en';
  env.click('#insert-source');
  assert.equal(busy, true);
  env.last('insertReference').fail({ message: 'Couldn’t reach Sefaria. Try again in a moment.' });
  assert.equal(busy, false);
  assert.equal(env.dom.prop[warning].hidden, false);
  assert.match(env.dom.text[warning], /Could not insert.*reach Sefaria.*Try again/);
  assert.equal(env.ctx.hasResolvedReference, true);

  env.ctx.orderedTranslationVersions = ['Notes', 'Main'];
  env.dom.prop['.translation-version-select'] = { multiple: true };
  env.click('#insert-source');
  assert.equal(env.dom.prop[warning].hidden, true);
  env.last('insertReferenceVersions').fail({});
  assert.equal(busy, false);
  assert.equal(env.dom.prop[warning].hidden, false);
  assert.match(env.dom.text[warning], /Check the document and your connection before trying again/);
});
