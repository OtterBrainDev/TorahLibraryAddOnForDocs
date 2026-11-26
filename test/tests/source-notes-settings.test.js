// Notes are independent of the translation's Commentary choice. Exercise the
// production preference boundaries and each composition-card adapter, so a
// choice cannot appear saved in one surface yet be ignored by its insertion.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { parseHTML } = require('linkedom');
const { loadSidebarSearch } = require('./helpers/sidebar-search-harness');

const app = path.resolve(__dirname, '../../apps-script');
const read = (file) => fs.readFileSync(path.join(app, file), 'utf8');
const script = (file) => read(file).replace(/^\s*<script>/, '').replace(/<\/script>\s*$/, '');
const plain = (value) => JSON.parse(JSON.stringify(value));

function server(initial = {}) {
  const store = { ...initial }, cache = {}, writes = [];
  const props = {
    getProperty: (key) => Object.hasOwn(store, key) ? store[key] : null,
    getProperties: () => ({ ...store }),
    setProperty(key, value) { writes.push(key); store[key] = String(value); return this; },
    setProperties(values) { Object.keys(values).forEach((key) => this.setProperty(key, values[key])); return this; },
    deleteProperty(key) { writes.push(key); delete store[key]; return this; },
  };
  const ctx = {
    console, Logger: { log() {} }, PropertiesService: { getUserProperties: () => props },
    CacheService: { getUserCache: () => ({ get: (key) => cache[key] || null, put: (key, value) => { cache[key] = value; }, remove: (key) => { delete cache[key]; } }) },
    buildAndInstallMenu() {},
  };
  vm.createContext(ctx);
  ['server/menu-layout.gs', 'server/preferences.gs', 'migrations.gs', 'server/first-run.gs',
    'server/settings-file.gs', 'server/settings-profiles.gs', 'server/source-text.gs', 'server/sefaria-fetch.gs',
    'server/insertion.gs', 'server/document-actions.gs']
    .forEach((file) => vm.runInContext(read(file), ctx, { filename: file }));
  return { ctx, store, cache, writes };
}

function settingsFile(value) {
  return JSON.stringify({ format: 'torah-library-settings', formatVersion: 1, prefsSchemaVersion: '32',
    settings: { source_notes_mode: value } });
}

test('schema 32 keeps existing insertion behavior, preserves a chosen Notes mode, and is idempotent', () => {
  for (const chosen of [undefined, 'inline', 'separate']) {
    const initial = { prefs_schema_version: '31', source_emphasis_mode: 'only' };
    if (chosen !== undefined) initial.source_notes_mode = chosen;
    const env = server(initial);
    assert.equal(env.ctx.getDefaultPreferences().source_notes_mode, 'omit');
    assert.equal(env.ctx.runUserPreferenceMigrationsIfNeeded_(), true);
    assert.equal(env.store.prefs_schema_version, env.ctx.PREFS_SCHEMA_CURRENT_);
    assert.equal(env.store.source_notes_mode, chosen || 'omit');
    assert.equal(env.store.source_emphasis_mode, 'only', 'Commentary is independent');
    const before = env.writes.length;
    assert.equal(env.ctx.runUserPreferenceMigrationsIfNeeded_(), false);
    assert.equal(env.writes.length, before);
  }
});

test('settings files round-trip valid Notes choices in Text and layout, rejecting invalid values', () => {
  for (const mode of ['omit', 'inline', 'separate']) {
    const origin = server({ prefs_schema_version: '32', source_notes_mode: mode });
    const exported = origin.ctx.exportSettingsFile({}, 'Notes');
    assert.equal(JSON.parse(exported.text).settings.source_notes_mode, mode);
    const target = server({ prefs_schema_version: '32', source_notes_mode: 'separate' });
    const preview = target.ctx.previewSettingsImport(exported.text);
    target.ctx.applySettingsImport(exported.text, ['text']);
    assert.equal(target.store.source_notes_mode, mode);
    assert.ok(preview.groups.some((group) => group.id === 'text') || mode === 'separate');
  }
  for (const invalid of ['all', 'INLINE', '', true, null, { mode: 'inline' }]) {
    const env = server({ prefs_schema_version: '32', source_notes_mode: 'separate' });
    const preview = env.ctx.previewSettingsImport(settingsFile(invalid));
    assert.equal(preview.skippedCount, 1, JSON.stringify(invalid));
    env.ctx.applySettingsImport(settingsFile(invalid), ['text']);
    assert.equal(env.store.source_notes_mode, 'separate', 'invalid import cannot replace a real choice');
  }
});

test('profiles retain Notes choices and older schema-31 profiles restore Omit', () => {
  const env = server({ prefs_schema_version: '32', source_notes_mode: 'inline' });
  assert.ok(Array.from(env.ctx.settingsProfileKeys_()).includes('source_notes_mode'));
  env.ctx.createSettingsProfile('With notes');
  env.store.source_notes_mode = 'separate';
  env.ctx.switchSettingsProfile('p1');
  assert.equal(env.store.source_notes_mode, 'inline');
  env.ctx.switchSettingsProfile('p2');
  assert.equal(env.store.source_notes_mode, 'separate');
  const old = server({ prefs_schema_version: '32', source_notes_mode: 'separate',
    settings_profiles: JSON.stringify({ active: 'p1', profiles: [{ id: 'p1', name: 'Now' }, { id: 'p2', name: 'Before notes' }] }),
    settings_profile_p2: JSON.stringify({ schema: '31', values: { source_emphasis_mode: 'discard' } }),
  });
  old.ctx.switchSettingsProfile('p2');
  assert.equal(old.store.source_notes_mode, 'omit');
  assert.equal(old.store.source_emphasis_mode, 'discard');
});

test('sidebar session and Link Texts overrides reach typography without changing saved Notes', () => {
  const env = server({ prefs_schema_version: '32', source_notes_mode: 'omit' });
  env.ctx.setSidebarSessionState('notes-session', { source_notes_mode: 'inline' });
  const session = env.ctx.getTypographySettings(env.ctx.typographyPropertiesFor_({ sessionId: 'notes-session' }));
  assert.equal(session.sourceNotesMode, 'inline');
  const overrides = env.ctx.sanitizeInsertOverrides_({ source_notes_mode: 'separate', unrelated: 'inline' });
  assert.deepEqual(plain(overrides), { source_notes_mode: 'separate' });
  const linked = env.ctx.getTypographySettings(env.ctx.typographyPropertiesFor_({ preferenceOverrides: overrides }));
  assert.equal(linked.sourceNotesMode, 'separate');
  assert.equal(env.ctx.buildLinkSourcesInsertOptions_({ source_notes_mode: 'inline' }).sourceNotesMode, 'inline');
  for (const invalid of ['footnotes', true, null, { mode: 'inline' }]) {
    assert.deepEqual(plain(env.ctx.sanitizeInsertOverrides_({ source_notes_mode: invalid })), {});
  }
  assert.equal(env.store.source_notes_mode, 'omit');
  assert.deepEqual(env.writes, [], 'overrides stay out of UserProperties');
});

// Extract a whole named function using its closing indentation; all nested
// blocks are deeper. This executes the real host adapter without bootstrapping
// unrelated modal networking, rather than asserting its source contains a key.
function namedFunction(source, name, indent) {
  const start = source.indexOf('function ' + name + '(');
  const end = source.indexOf('\n' + ' '.repeat(indent) + '}', start) + indent + 2;
  assert.ok(start >= 0 && end > start, name + ' exists');
  return source.slice(start, end);
}

function hostContext() {
  const nodes = {};
  const byId = (id) => nodes[id] || (nodes[id] = {
    value: '', checked: false, textContent: '', disabled: false, hidden: false,
    classList: { toggle() {} }, addEventListener() {},
  });
  const ctx = { console, byId, _attachCardExtras() {}, initInsertionOptions() {},
    updateInsertionOptions() {}, updateCompositionCard() {},
    document: { querySelectorAll: () => [], querySelector: () => null },
  };
  vm.createContext(ctx);
  vm.runInContext(script('shared/composition-card/shared.html'), ctx);
  ctx.initCompositionCard = (config) => { ctx.card = config; };
  return { ctx, byId };
}

test('Notes has one real labelled radio control whose values match server and client normalization', () => {
  const { document } = parseHTML(read('shared/composition-card/markup.html'));
  const group = document.querySelector('#cc-notes-toggle');
  assert.ok(group, 'the shared Texts composition controls expose Notes, rather than only hidden state');
  assert.equal(group.getAttribute('role'), 'radiogroup');
  const labels = Array.from(group.querySelectorAll('[role="radio"]'), (button) => [button.getAttribute('data-value'), button.textContent.trim()]);
  assert.deepEqual(labels, [['omit', 'Omit'], ['inline', 'Inline'], ['separate', 'Separate']]);
  const { ctx: host } = hostContext(), { ctx: api } = server();
  for (const [mode] of labels) {
    assert.equal(host.ccNormalizeNotesMode(mode), mode);
    assert.equal(api.normalizeSourceNotesMode_(mode), mode);
  }
});

test('Preferences composition Notes choice writes the named form field and reads it back', () => {
  const env = hostContext();
  const source = script('preferences/js.html');
  vm.runInContext(namedFunction(source, 'setPrefButtonGroup', 4), env.ctx);
  vm.runInContext(namedFunction(source, '_initPreferencesCompositionCard', 4), env.ctx);
  env.ctx._initPreferencesCompositionCard();
  for (const mode of ['inline', 'separate', 'omit']) {
    env.ctx.card.onChoice('notes', mode);
    assert.equal(env.byId('source_notes_mode').value, mode);
    assert.equal(env.ctx.card.getState().notesMode, mode);
  }
  const { document } = parseHTML(read('preferences.html'));
  assert.equal(document.querySelector('#source_notes_mode').getAttribute('name'), 'source_notes_mode', 'the ordinary Save/export form includes the choice');
});

test('Link Texts composition Notes choice is included in changed overrides and read back', () => {
  const env = hostContext();
  const source = read('linker-results.html');
  const start = source.indexOf('        var defaults = null;');
  const end = source.indexOf('        // The panel needs the stored defaults', start);
  assert.ok(start >= 0 && end > start);
  vm.runInContext(source.slice(start, end), env.ctx);
  env.ctx.setupCustomize({ source_notes_mode: 'omit' });
  assert.deepEqual(plain(env.ctx.changedInsertPrefs()), {});
  for (const mode of ['inline', 'separate']) {
    env.ctx.card.onChoice('notes', mode);
    assert.deepEqual(plain(env.ctx.changedInsertPrefs()), { source_notes_mode: mode });
    assert.equal(env.ctx.card.getState().notesMode, mode);
  }
  env.ctx.card.onChoice('notes', 'omit');
  assert.deepEqual(plain(env.ctx.changedInsertPrefs()), {});
});

test('the sidebar sends the current Notes choice to single and multiple inserts before a save answers', () => {
  const env = loadSidebarSearch({ stubs: {
    showBusyOverlay() {}, hideBusyOverlay() {}, showInsertNotice() {},
    getSidebarTransliterationScheme: () => 'traditional', refreshSidebarLivePreview() {},
  } });
  vm.runInContext(script('shared/composition-card/shared.html'), env.ctx);
  vm.runInContext(script('sidebar/js/composition-controls.html'), env.ctx);
  env.ctx.sidebarSessionId = 'notes-session';
  env.ctx.hasResolvedReference = true;
  env.ctx.data = { ref: 'Genesis 1:1', versionTitle: 'A', heVersionTitle: 'Source' };
  env.dom.val['.output-mode-selection'] = 'both';
  env.dom.val['.bilingual-layout-selection'] = 'he-top';
  env.ctx._sidebarCompositionOnChoice('notes', 'inline');
  assert.equal(env.ctx._sidebarCompositionGetState().notesMode, 'inline');
  assert.equal(env.last('setSidebarSessionState').args[1].source_notes_mode, 'inline');
  env.click('#insert-source');
  assert.equal(env.last('insertReference').args[1].sourceNotesMode, 'inline');
  assert.equal(env.last('insertReference').args[1].sessionId, 'notes-session');
  env.ctx.orderedTranslationVersions = ['A', 'B'];
  env.dom.prop['.translation-version-select'] = { multiple: true };
  env.ctx._sidebarCompositionOnChoice('notes', 'separate');
  env.click('#insert-source');
  assert.equal(env.last('insertReferenceVersions').args[1].sourceNotesMode, 'separate');
  assert.equal(env.last('insertReferenceVersions').args[1].sessionId, 'notes-session');
  assert.equal(env.ctx.accountPreferences.source_notes_mode, undefined, 'the choice is a session setting');
});


// Check the actual host templates with their shared includes expanded. A
// standalone hidden-state or adapter test cannot catch a misplaced control.
function expandedHost(name) {
  return parseHTML(read(name).replace(/<\?!=\s*include\('([^']+)'\)\s*;?\s*\?>/g,
    (match, partial) => partial === 'shared/insertion-options/markup' || partial === 'shared/composition-card/markup'
      ? read(partial + '.html') : '')).document;
}

test('all three hosts expose exactly one shared Notes choice alongside composition controls', () => {
  for (const host of ['preferences.html', 'sidebar.html', 'linker-results.html']) {
    const doc = expandedHost(host);
    const notes = doc.querySelectorAll('#cc-notes-toggle');
    assert.equal(notes.length, 1, host);
    assert.ok(notes[0].closest('#composition-card-container'), host + ': Notes belongs to the composition card');
    assert.equal(notes[0].closest('.cc-section--source, .cc-section--translation'), null,
      host + ': Notes is not language-specific');
    assert.equal(notes[0].closest('[data-cc-feature]'), null, host + ': no optional feature gate');
    // Link Texts hides its entire Customize panel until review is ready.
    // The Notes row itself and its composition ancestors must not be hidden.
    assert.ok(!notes[0].closest('#composition-card-container').hasAttribute('hidden'), host);
    assert.equal(notes[0].closest('.cc-row').hasAttribute('hidden'), false, host);
    assert.equal(notes[0].hasAttribute('hidden'), false, host);
    if (host === 'preferences.html') {
      assert.ok(notes[0].closest('#pref-workflow-texts'), 'Notes is in the Texts insertion defaults');
      assert.equal(notes[0].closest('#display-defaults'), null, 'not in the separate Layout accordion');
      assert.ok(notes[0].closest('#insertion-preview').hasAttribute('open'));
      assert.equal(doc.querySelectorAll('[name="source_notes_mode"]').length, 1);
    }
  }
});

test('shared insertion controls and their Preferences fields stay in sync', () => {
  const doc = expandedHost('preferences.html');
  const hosts = ['sidebar.html', 'linker-results.html'].map(expandedHost);
  const contract = {
    'cc-vowels-toggle': ['nekudot', 'nekudot_filter'],
    'cc-cantillation-toggle': ['teamim', 'teamim_filter'],
    'cc-hebrew-punct-toggle': ['hebrew_punctuation'],
    'cc-translation-punct-toggle': ['translation_punctuation'],
    'cc-translit-pill': ['include_transliteration_default'],
    'cc-translit-toggle': ['transliteration_scheme'],
    'cc-translit-position-toggle': ['transliteration_position'],
    'cc-emphasis-toggle': ['source_emphasis_mode'],
    'cc-notes-toggle': ['source_notes_mode'],
    'cc-title-toggle': ['insert_sefaria_link_default'],
    'cc-he-title-toggle': ['insert_hebrew_sefaria_link_default'],
    'cc-details-toggle': ['include_translation_source_info'],
    'cc-lines-toggle': ['show_line_markers_default'],
    'layout-rows-toggle': ['bilingual_aligned_rows'],
    'display-choice-label': ['output_mode_default'],
    'layout-choice-label': ['bilingual_layout_default']
  };
  const defaults = server().ctx.getDefaultPreferences();
  for (const [id, keys] of Object.entries(contract)) {
    for (const page of [doc, ...hosts]) assert.equal(page.querySelectorAll('#' + id).length, 1, id);
    for (const key of keys) {
      assert.equal(doc.querySelectorAll('[name="' + key + '"]').length, 1, key);
      assert.ok(Object.hasOwn(defaults, key), key + ' has a central default');
    }
  }
  // The composition radios must all have a mapped setting; future controls
  // cannot silently bypass this audit.
  for (const group of doc.querySelectorAll('#composition-card-container [data-cc-choice]')) {
    assert.ok(Object.hasOwn(contract, group.id), group.id);
  }
});
