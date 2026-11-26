// Pins settings profiles (apps-script/server/settings-profiles.gs): named sets
// of how sources look, switched from Preferences (Everything) or the sidebar.
//
// What matters:
//   - a profile holds exactly the settings file's "Text and layout" and
//     "Fonts, colours and titles" settings: never the menu, the interface, the
//     sidebar's controls, search, linking, or what one reader did last;
//   - the settings in use are the stored preferences, as every reader expects;
//     switching keeps the outgoing ones and writes the incoming ones in one
//     setProperties, and touches nothing outside a profile;
//   - a profile kept aside is migrated when it comes back, like stored
//     preferences (a schema-23 "torah" cantillation filter comes back "tanakh"),
//     and a value no setting could hold comes back as the default;
//   - nobody without profiles sees anything change; the first new profile turns
//     the settings in use into "My settings";
//   - names are cleaned and unique; there is a limit; the last one stays;
//   - the index is not a setting: setPreferences and a settings file can't write it.
//
// Loaded with vm against stubs; see AGENTS.md hard rule #3.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const APPS_SCRIPT = path.resolve(__dirname, '../../apps-script');
const FILES = ['server/menu-layout.gs', 'server/preferences.gs', 'migrations.gs', 'server/first-run.gs',
  'server/settings-file.gs', 'server/settings-profiles.gs'];

function load(initial = {}) {
  const store = Object.assign({}, initial);
  const writes = [];
  const props = {
    getProperty: (k) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
    getProperties: () => Object.assign({}, store),
    setProperty(k, v) { writes.push(['setProperty', k]); store[k] = String(v); return this; },
    setProperties(o) { writes.push(['setProperties', Object.keys(o).length]); Object.keys(o).forEach((k) => { store[k] = String(o[k]); }); return this; },
    deleteProperty(k) { writes.push(['deleteProperty', k]); delete store[k]; return this; },
  };
  const logged = [];
  const context = {
    console,
    Logger: { log: (m) => logged.push(String(m)) },
    PropertiesService: { getUserProperties: () => props },
  };
  vm.createContext(context);
  FILES.forEach((file) => vm.runInContext(fs.readFileSync(path.join(APPS_SCRIPT, file), 'utf8'), context, { filename: file }));
  // Every reader runs migrations first; start from a migrated store.
  context.runUserPreferenceMigrationsIfNeeded_();
  writes.length = 0;
  return { ctx: context, store, writes, logged };
}

const plain = (value) => JSON.parse(JSON.stringify(value));

test('a profile holds how sources look, and nothing that belongs to the person', () => {
  const { ctx } = load();
  const keys = [...ctx.settingsProfileKeys_()];
  for (const key of ['nekudot', 'nekudot_filter', 'teamim', 'teamim_filter', 'hebrew_punctuation', 'translation_punctuation',
    'include_transliteration_default', 'transliteration_scheme', 'source_emphasis_mode', 'output_mode_default',
    'bilingual_layout_default', 'meforash_replace', 'meforash_replacement', 'hebrew_font', 'translation_font_size',
    'citation_font_style', 'sefaria_link_edition_label', 'preferred_translation_language', 'voices_insert_mode_default']) {
    assert.ok(keys.includes(key), `in a profile: ${key}`);
  }
  for (const key of ['menu_layout', 'ui_mode', 'show_voices_tab', 'show_lexicon_tab', 'sidebar_quick_actions_hidden',
    'sidebar_options_hidden', 'experimental_features_enabled', 'surprise_me_enabled', 'search_corpus_order',
    'hidden_translation_languages', 'linker_review_mode', 'link_texts_default', 'insert_from_selection_replace',
    'search_mode', 'last_translation_languages', 'settings_profiles', 'first_run_setup',
    'lexicon_dictionary_order', 'lexicon_dictionary_excluded', 'voices_topic_order', 'voices_topic_excluded']) {
    assert.ok(!keys.includes(key), `not in a profile: ${key}`);
  }
});

test('with no profiles, the settings in use are shown as "My settings" and nothing is stored', () => {
  const { ctx, store } = load();
  assert.equal(store.settings_profiles, '', 'seeded as none');
  assert.deepEqual(plain(ctx.getSettingsProfiles()),
    { active: 'p1', implicit: true, max: 10, profiles: [{ id: 'p1', name: 'My settings' }] });
});

test('the first new profile turns the settings in use into "My settings", copies them, and is in use', () => {
  const { ctx, store, writes } = load({ nekudot: 'false' });
  const result = ctx.createSettingsProfile('  Grade   3 ');
  assert.deepEqual(plain(result.profiles.profiles), [{ id: 'p1', name: 'My settings' }, { id: 'p2', name: 'Grade 3' }]);
  assert.equal(result.profiles.active, 'p2');
  assert.equal(result.preferences.nekudot, 'false', 'a copy: nothing the person sees changes');
  const kept = JSON.parse(store.settings_profile_p1);
  assert.equal(kept.schema, /var PREFS_SCHEMA_CURRENT_ = '(\d+)'/.exec(fs.readFileSync(path.join(APPS_SCRIPT, 'migrations.gs'), 'utf8'))[1]);
  assert.equal(kept.values.nekudot, 'false');
  assert.deepEqual(Object.keys(kept.values).sort(), [...ctx.settingsProfileKeys_()].sort());
  assert.ok(!('settings_profile_p2' in store), 'the profile in use has no snapshot');
  assert.deepEqual(writes.filter((w) => w[0] !== 'deleteProperty').map((w) => w[0]), ['setProperties'], 'one write');
});

test('switching keeps the outgoing settings, writes the incoming ones, and touches nothing outside a profile', () => {
  const { ctx, store, writes } = load({ nekudot: 'false', menu_layout: '{"x":1}', show_voices_tab: 'false', search_corpus_order: '["a"]' });
  ctx.createSettingsProfile('Adults');
  store.nekudot = 'true';
  store.include_transliteration_default = 'true';
  writes.length = 0;
  const result = ctx.switchSettingsProfile('p1');
  assert.equal(result.profiles.active, 'p1');
  assert.equal(store.nekudot, 'false', 'My settings came back');
  assert.equal(store.include_transliteration_default, 'false');
  assert.equal(result.preferences.nekudot, 'false');
  // Adults was kept, with what it had.
  const adults = JSON.parse(store.settings_profile_p2).values;
  assert.equal(adults.nekudot, 'true');
  assert.equal(adults.include_transliteration_default, 'true');
  assert.ok(!('settings_profile_p1' in store), 'the profile in use has no snapshot');
  // The person's own settings are as they were.
  assert.equal(store.menu_layout, '{"x":1}');
  assert.equal(store.show_voices_tab, 'false');
  assert.equal(store.search_corpus_order, '["a"]');
  assert.deepEqual(writes.map((w) => w[0]), ['setProperties', 'deleteProperty']);
  // Back again.
  ctx.switchSettingsProfile('p2');
  assert.equal(store.nekudot, 'true');
  // Switching to the one in use writes nothing.
  writes.length = 0;
  ctx.switchSettingsProfile('p2');
  assert.deepEqual(writes, []);
  assert.throws(() => ctx.switchSettingsProfile('p9'), /no longer exists/);
});

test('a profile kept aside is migrated when it comes back, and a value no setting could hold is the default', () => {
  const index = JSON.stringify({ active: 'p1', profiles: [{ id: 'p1', name: 'Now' }, { id: 'p2', name: 'Old' }] });
  const old = JSON.stringify({ schema: '23', values: { teamim_filter: 'torah', nekudot: 'false', hebrew_font_size: 'enormous', bogus_key: 'x' } });
  const { ctx, store } = load({ settings_profiles: index, settings_profile_p2: old });
  ctx.switchSettingsProfile('p2');
  assert.equal(store.teamim_filter, 'tanakh', 'v24: a schema-23 "torah" always meant Tanakh');
  assert.equal(store.nekudot, 'false');
  assert.equal(store.hebrew_font_size, ctx.getDefaultPreferences().hebrew_font_size, 'invalid → default');
  assert.ok(!('bogus_key' in store), 'only profile keys are written');
  assert.equal(store.sefaria_link_edition_label, 'true', 'a key the snapshot predates takes its default');
  // A broken snapshot gives the defaults rather than failing the switch.
  const broken = load({ settings_profiles: index, settings_profile_p2: '{not json', nekudot: 'false' });
  broken.ctx.switchSettingsProfile('p2');
  assert.equal(broken.store.nekudot, 'true');
});

test('a never-set workflow snapshots real defaults and survives switching away and back', () => {
  const { ctx, store } = load();
  // Also cover a sparse store that reaches the profile API before these keys
  // were seeded: the snapshot must use the canonical defaults, not undefined.
  const expected = {
    voices_insert_mode_default: 'reference', voices_translit_default: 'none', lexicon_insert_mode_default: 'entry'
  };
  Object.keys(expected).forEach((key) => { delete store[key]; });
  ctx.createSettingsProfile('With text');
  const kept = JSON.parse(store.settings_profile_p1).values;
  Object.entries(expected).forEach(([key, value]) => assert.equal(kept[key], value, key));
  store.voices_insert_mode_default = 'both';
  store.voices_translit_default = 'traditional';
  store.lexicon_insert_mode_default = 'definition';
  ctx.switchSettingsProfile('p1');
  Object.entries(expected).forEach(([key, value]) => assert.equal(store[key], value, key));
  ctx.switchSettingsProfile('p2');
  assert.equal(store.voices_insert_mode_default, 'both');
  assert.equal(store.voices_translit_default, 'traditional');
  assert.equal(store.lexicon_insert_mode_default, 'definition');
});

test('old profiles repair only the generated undefined workflow sentinel and preserve real choices', () => {
  const index = JSON.stringify({ active: 'p1', profiles: [{ id: 'p1', name: 'Now' }, { id: 'p2', name: 'Old' }] });
  const old = JSON.stringify({ schema: '32', values: {
    voices_insert_mode_default: 'undefined', voices_translit_default: 'undefined', lexicon_insert_mode_default: 'undefined',
    source_emphasis_mode: 'only', source_notes_mode: 'inline'
  } });
  const { ctx, store } = load({ settings_profiles: index, settings_profile_p2: old });
  ctx.switchSettingsProfile('p2');
  assert.equal(store.voices_insert_mode_default, 'reference');
  assert.equal(store.voices_translit_default, 'none');
  assert.equal(store.lexicon_insert_mode_default, 'entry');
  assert.equal(store.source_emphasis_mode, 'only');
  assert.equal(store.source_notes_mode, 'inline');
  const chosen = ctx.migrateProfileValues_(JSON.stringify({ schema: '32', values: {
    voices_insert_mode_default: 'contents', voices_translit_default: 'ipa_modern', lexicon_insert_mode_default: 'headword'
  } }), ctx.getDefaultPreferences());
  assert.equal(chosen.voices_insert_mode_default, 'contents');
  assert.equal(chosen.voices_translit_default, 'ipa_modern');
  assert.equal(chosen.lexicon_insert_mode_default, 'headword');
});

test('names are cleaned and unique, there is a limit, and a rename changes no setting', () => {
  const { ctx, store } = load();
  assert.throws(() => ctx.createSettingsProfile('   '), /Give the profile a name/);
  assert.throws(() => ctx.createSettingsProfile('my SETTINGS'), /already have a profile called “my SETTINGS”/);
  ctx.createSettingsProfile('A'.repeat(60) + '\u0007');
  assert.equal(ctx.getSettingsProfiles().profiles[1].name, 'A'.repeat(40));
  const before = Object.assign({}, store);
  ctx.renameSettingsProfile('p1', 'Adult class');
  assert.equal(ctx.getSettingsProfiles().profiles[0].name, 'Adult class');
  Object.keys(before).filter((k) => k !== 'settings_profiles').forEach((k) => assert.equal(store[k], before[k], k));
  assert.throws(() => ctx.renameSettingsProfile('p2', 'adult CLASS'), /already have/);
  for (let i = 3; i <= 10; i++) ctx.createSettingsProfile(`Class ${i}`);
  assert.equal(ctx.getSettingsProfiles().profiles.length, 10);
  assert.throws(() => ctx.createSettingsProfile('One more'), /up to 10 profiles/);
  // Renaming before any profile exists keeps the settings in use as one profile.
  const fresh = load();
  fresh.ctx.renameSettingsProfile('p1', 'Shiur');
  assert.deepEqual(plain(fresh.ctx.getSettingsProfiles().profiles), [{ id: 'p1', name: 'Shiur' }]);
});

test('deleting the profile in use switches to another first; the last one stays', () => {
  const { ctx, store } = load({ nekudot: 'false' });
  ctx.createSettingsProfile('Kids');
  store.nekudot = 'true';
  const result = ctx.deleteSettingsProfile('p2');
  assert.equal(result.profiles.active, 'p1');
  assert.deepEqual(plain(result.profiles.profiles), [{ id: 'p1', name: 'My settings' }]);
  assert.equal(store.nekudot, 'false', 'My settings came back');
  assert.ok(!('settings_profile_p1' in store) && !('settings_profile_p2' in store));
  assert.throws(() => ctx.deleteSettingsProfile('p1'), /at least one profile/);
  // Deleting one not in use changes no setting.
  ctx.createSettingsProfile('Kids');
  ctx.createSettingsProfile('Adults');
  const nekudot = store.nekudot;
  ctx.deleteSettingsProfile('p2');
  assert.equal(store.nekudot, nekudot);
  assert.ok(!('settings_profile_p2' in store));
  assert.deepEqual(plain(ctx.getSettingsProfiles().profiles.map((p) => p.name)), ['My settings', 'Adults']);
});

test('settings too large for one stored value are refused with a plain message, and nothing changes', () => {
  const huge = JSON.stringify(Object.fromEntries(Array.from({ length: 700 }, (_, i) => [`k${i}`, 'value'])));
  const { ctx, store, writes } = load({ transliteration_overrides: huge });
  assert.throws(() => ctx.createSettingsProfile('Big'), /too large to keep as a profile/);
  assert.equal(store.settings_profiles, '');
  assert.deepEqual(writes, []);
});

test('the index is not a setting: setPreferences and a settings file never write it, and junk reads as none', () => {
  const { ctx, store } = load();
  const settings = vm.runInContext('SETTINGS', ctx);
  assert.ok(!settings.includes('settings_profiles'));
  ctx.setPreferences({ settings_profiles: '{"active":"p1","profiles":[]}', settings_profile_p1: 'x' });
  assert.equal(store.settings_profiles, '');
  assert.ok(!('settings_profile_p1' in store));
  for (const junk of ['', 'nope', '{"profiles":"x"}', '{"profiles":[{"id":"../x","name":"a"},{"id":"p1","name":""}]}']) {
    assert.deepEqual(plain(ctx.readProfileIndex_(junk)), { active: null, profiles: [] }, junk);
  }
  assert.deepEqual(plain(ctx.readProfileIndex_('{"active":"p9","profiles":[{"id":"p2","name":"B"},{"id":"p2","name":"C"}]}')),
    { active: 'p2', profiles: [{ id: 'p2', name: 'B' }] }, 'an unknown active falls back; a repeated id is dropped');
});

test('a failure is logged by message only, never with a value', () => {
  const { ctx, logged } = load({ nekudot: 'false' });
  assert.throws(() => ctx.switchSettingsProfile('p7'));
  assert.equal(logged.length, 1);
  assert.match(logged[0], /^switchSettingsProfile: /);
  assert.doesNotMatch(logged[0], /nekudot|false/);
});


// The Import/Export modal can address an inactive profile without switching.
function transferTarget_(ctx, id, includeShared) {
  const index = ctx.getSettingsProfiles();
  return { mode: ctx.getUiMode_(), activeId: index.active, profileId: id || index.active, includeShared: !!includeShared };
}
function transferFile_(settings, mode) {
  return JSON.stringify({ format: 'torah-library-settings', formatVersion: 1, prefsSchemaVersion: '33', interfaceMode: mode || 'full', settings });
}

test('profile export uses the named saved snapshot, not the active form or shared settings', () => {
  const { ctx, store } = load({ ui_mode: 'full', nekudot: 'false', show_voices_tab: 'false' });
  ctx.createSettingsProfile('Grade 3');
  ctx.setPreferences({ nekudot: 'true' });
  const file = JSON.parse(ctx.exportSettingsForTarget({ nekudot: 'true', hebrew_font: 'not the inactive profile' }, '', transferTarget_(ctx, 'p1')).text);
  assert.equal(file.name, 'My settings');
  assert.equal(file.settings.nekudot, 'false');
  assert.notEqual(file.settings.hebrew_font, 'not the inactive profile');
  assert.ok(!('show_voices_tab' in file.settings));
  assert.ok(!('interfaceMode' in file));
  assert.equal(ctx.getSettingsProfiles().active, 'p2');
  assert.equal(store.nekudot, 'true');
  const all = JSON.parse(ctx.exportSettingsForTarget({}, '', transferTarget_(ctx, 'p1', true)).text);
  assert.equal(all.settings.show_voices_tab, 'false');
  assert.equal(all.settings.nekudot, 'false');
});

test('import into an inactive profile changes only its selected settings; active values and interface remain intact', () => {
  const { ctx, store } = load({ ui_mode: 'full', nekudot: 'true', hebrew_font: 'Arial', show_voices_tab: 'false', show_lexicon_tab: 'false' });
  ctx.createSettingsProfile('Adult study');
  ctx.setPreferences({ hebrew_font: 'David Libre' });
  const target = transferTarget_(ctx, 'p1');
  const text = transferFile_({ nekudot: 'false', hebrew_font: 'Times New Roman', show_voices_tab: 'true' }, 'simple');
  const preview = ctx.previewSettingsImportForTarget(text, target);
  assert.equal(preview.targetName, 'My settings');
  assert.equal(preview.targetActive, false);
  assert.equal(preview.ignoredShared, 1);
  assert.ok(!preview.groups.some(g => g.id === 'menu'));
  const result = ctx.applySettingsImportForTarget(text, ['text', 'menu'], target);
  assert.equal(result.affectsActive, false);
  assert.equal(result.preferences, null);
  assert.equal(ctx.getSettingsProfiles().active, 'p2');
  assert.equal(store.nekudot, 'true');
  assert.equal(store.hebrew_font, 'David Libre');
  assert.equal(store.show_voices_tab, 'false');
  assert.equal(store.ui_mode, 'full');
  const saved = JSON.parse(store.settings_profile_p1).values;
  assert.equal(saved.nekudot, 'false');
  assert.equal(saved.hebrew_font, 'Arial');
  ctx.switchSettingsProfile('p1');
  assert.equal(store.nekudot, 'false');
  assert.equal(store.hebrew_font, 'Arial');
  assert.equal(store.show_voices_tab, 'false');
});

test('active profile import changes its values without switching profile, while Simple import can include shared settings', () => {
  const { ctx, store } = load({ ui_mode: 'full', nekudot: 'true', show_voices_tab: 'true' });
  const text = transferFile_({ nekudot: 'false', show_voices_tab: 'false' }, 'simple');
  const active = transferTarget_(ctx);
  const result = ctx.applySettingsImportForTarget(text, ['text', 'menu'], active);
  assert.equal(result.affectsActive, true);
  assert.equal(store.nekudot, 'false');
  assert.equal(store.show_voices_tab, 'true');
  assert.equal(store.ui_mode, 'full');
  ctx.setUiMode('simple');
  const simple = transferTarget_(ctx);
  const imported = ctx.applySettingsImportForTarget(text, ['menu'], simple);
  assert.equal(imported.affectsActive, true);
  assert.equal(store.show_voices_tab, 'false');
  assert.equal(store.ui_mode, 'simple');
});

test('shared import is explicit and never changes mode, even if the file specifies one', () => {
  const { ctx, store } = load({ ui_mode: 'full', show_lexicon_tab: 'true' });
  ctx.createSettingsProfile('Class');
  const t = transferTarget_(ctx, 'p1', true);
  const text = transferFile_({ nekudot: 'false', show_lexicon_tab: 'false' }, 'simple');
  ctx.applySettingsImportForTarget(text, ['text'], t);
  assert.equal(store.show_lexicon_tab, 'true');
  const result = ctx.applySettingsImportForTarget(text, ['menu'], t);
  assert.equal(result.affectsActive, true);
  assert.equal(store.show_lexicon_tab, 'false');
  assert.equal(store.ui_mode, 'full');
  assert.equal(ctx.getSettingsProfiles().active, 'p2');
});

test('a stale mode, active profile or deleted target is rejected before any import writes', () => {
  const { ctx, store, writes } = load({ ui_mode: 'full' });
  ctx.createSettingsProfile('Class');
  const t = transferTarget_(ctx, 'p1');
  ctx.switchSettingsProfile('p1');
  const before = plain(store);
  const count = writes.length;
  assert.throws(() => ctx.applySettingsImportForTarget(transferFile_({ nekudot: 'false' }), ['text'], t), /active profile changed/);
  assert.deepEqual(plain(store), before);
  assert.equal(writes.length, count);
  const missing = transferTarget_(ctx, 'p2');
  ctx.deleteSettingsProfile('p2');
  assert.throws(() => ctx.previewSettingsImportForTarget(transferFile_({ nekudot: 'false' }), missing), /no longer available/);
});
