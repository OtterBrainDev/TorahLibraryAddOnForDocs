// Pins the settings file (apps-script/server/settings-file.gs; Preferences →
// Advanced): a teacher exports their settings and a class imports them; an
// organization hands out its house style.
//
// What matters:
//   - an export holds settings only (not what one reader searched last), with
//     the dialog's unsaved values, and a round trip reproduces them;
//   - a file is untrusted: only SETTINGS keys, and only values of the shape
//     that key takes, are ever written; everything else is skipped and
//     counted; a newer or foreign file is refused with a plain message;
//   - an import changes only the parts the reader ticks, and only values
//     that differ; its interface mode goes through the Interface switch;
//   - Reset To Defaults leaves one menu, the one for the interface in use.
//
// Loaded with vm against stubs; see AGENTS.md hard rule #3.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const APPS_SCRIPT = path.resolve(__dirname, '../../apps-script');
const FILES = ['server/menu-layout.gs', 'server/preferences.gs', 'migrations.gs', 'server/first-run.gs', 'server/settings-file.gs', 'server/settings-profiles.gs', 'server/factory-preferences.gs'];

function makeProps(initial = {}) {
  const store = Object.assign({}, initial);
  return {
    store,
    getProperty: (k) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
    getProperties: () => Object.assign({}, store),
    setProperty(k, v) { store[k] = String(v); return this; },
    setProperties(values) { Object.entries(values).forEach(([k, v]) => this.setProperty(k, v)); return this; },
    deleteProperty(k) { delete store[k]; return this; },
  };
}

function load(initial = {}) {
  const props = makeProps(initial);
  const calls = [];
  const context = {
    console,
    Logger: { log() {} },
    PropertiesService: { getUserProperties: () => props },
    buildAndInstallMenu: () => calls.push('buildMenu'),
  };
  vm.createContext(context);
  FILES.forEach((file) => vm.runInContext(fs.readFileSync(path.join(APPS_SCRIPT, file), 'utf8'), context, { filename: file }));
  return { ctx: context, props, calls };
}

const plain = (value) => JSON.parse(JSON.stringify(value));

function exported(initial, formValues, name) {
  const { ctx } = load(initial);
  const result = ctx.exportSettingsFile(formValues || {}, name || '');
  return { result, file: JSON.parse(result.text) };
}

test('an export holds the settings, the dialog\'s unsaved values, and none of one reader\'s search history', () => {
  const { result, file } = exported(
    { nekudot: 'false', hebrew_font: 'Frank Ruhl Libre', last_search_sort_mode: 'chronological', search_mode: 'voices', ui_mode: 'simple' },
    { teamim: false, hebrew_font_color: '#123456', translation_font_size: 'huge', not_a_setting: 'x' },
    '  Grade 7  Chumash  '
  );
  assert.equal(file.format, 'torah-library-settings');
  assert.equal(file.formatVersion, 1);
  // The schema the file was written at: the current one (docs/VERSION.json).
  const schema = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'docs', 'VERSION.json'), 'utf8')).prefsSchemaVersion;
  assert.equal(file.prefsSchemaVersion, schema);
  assert.equal(file.name, 'Grade 7 Chumash');
  assert.equal(file.interfaceMode, 'simple');
  assert.equal(result.fileName, 'sefaria-google-docs-settings-grade-7-chumash.json');
  assert.equal(file.settings.nekudot, 'false', 'stored value');
  assert.equal(file.settings.hebrew_font, 'Frank Ruhl Libre');
  assert.equal(file.settings.teamim, 'false', 'the dialog\'s unsaved value');
  assert.equal(file.settings.hebrew_font_color, '#123456');
  assert.equal(file.settings.translation_font_size, '', 'an invalid dialog value falls back to the stored one');
  for (const key of ['last_search_sort_mode', 'last_translation_languages', 'search_mode', 'ui_mode', 'not_a_setting', 'first_run_setup', 'menu_layout_before_simple']) {
    assert.ok(!(key in file.settings), `${key} is not exported`);
  }
  assert.equal(result.count, Object.keys(file.settings).length);
});

test('importing an export reproduces every exported setting', () => {
  const { file, result } = exported({ nekudot: 'false', nekudot_filter: 'false', transliteration_scheme: 'ashkenazi', god_replace: 'true', god_replacement: 'G-d', hebrew_font: 'Frank Ruhl Libre', menu_layout: JSON.stringify({ top: ['texts', 'quick_actions'], quick_actions: ['link_texts'], hidden: [] }) });
  const target = load({});
  const preview = target.ctx.previewSettingsImport(result.text);
  assert.ok(preview.groups.length >= 3);
  target.ctx.applySettingsImport(result.text, preview.groups.map((g) => g.id));
  const after = target.ctx.readUserPreferenceObject_();
  Object.keys(file.settings).forEach((key) => assert.equal(String(after[key]), file.settings[key], key));
  assert.ok(target.calls.includes('buildMenu'), 'the menu is rebuilt');
});

test('a file is untrusted: only SETTINGS keys with values of the right shape are written', () => {
  const { ctx, props } = load({});
  const text = JSON.stringify({
    format: 'torah-library-settings', formatVersion: 1, prefsSchemaVersion: '26',
    settings: {
      nekudot: 'false',                    // fine
      teamim: 'maybe',                     // not true/false
      hebrew_font_size: '9000',            // not a size
      hebrew_font_color: 'red; x',         // not a colour
      search_corpus_order: '[not json',    // not JSON
      ui_mode: 'simple',                   // not a setting: only the Interface switch writes it
      first_run_setup: 'pending',
      menu_layout_before_simple: 'x',
      last_search_sort_mode: 'chronological',
      hebrew_font: 'x'.repeat(10000),      // too long
    },
  }).replace('"nekudot"', '"__proto__":"x","nekudot"');  // a key JSON.parse makes an own property

  const preview = ctx.previewSettingsImport(text);
  assert.equal(preview.skippedCount, 10);
  ctx.applySettingsImport(text, ['text', 'look', 'search', 'menu']);
  assert.equal(props.store.nekudot, 'false');
  for (const key of ['teamim', 'hebrew_font_size', 'hebrew_font_color', 'search_corpus_order', 'ui_mode', 'first_run_setup', 'menu_layout_before_simple', 'last_search_sort_mode', 'hebrew_font']) {
    assert.ok(!(key in props.store), `${key} must not be written`);
  }
});

test('a foreign, broken, newer or empty file is refused with a plain message, and nothing is written', () => {
  const { ctx, props } = load({});
  const cases = [
    ['', /empty/],
    ['{not json', /could not be read/],
    [JSON.stringify({ format: 'something-else', settings: {} }), /not a Sefaria for Google Docs settings file/],
    [JSON.stringify({ format: 'torah-library-settings', formatVersion: 1, prefsSchemaVersion: '99', settings: {} }), /newer version/],
    [JSON.stringify({ format: 'torah-library-settings', formatVersion: 2, prefsSchemaVersion: '26', settings: {} }), /newer version/],
    [JSON.stringify({ format: 'torah-library-settings', formatVersion: 1, prefsSchemaVersion: '26' }), /no settings/],
    ['x'.repeat(200001), /too large/],
  ];
  cases.forEach(([text, message]) => {
    assert.throws(() => ctx.previewSettingsImport(text), message);
    assert.throws(() => ctx.applySettingsImport(text, ['text']), message);
  });
  assert.deepEqual(props.store, {});
});

test('the preview counts what each part would change; an import applies only the parts ticked', () => {
  const { ctx, props } = load({ nekudot: 'true', hebrew_font: '' });
  const text = JSON.stringify({
    format: 'torah-library-settings', formatVersion: 1, prefsSchemaVersion: '20',
    interfaceMode: 'full',
    settings: { nekudot: 'false', teamim: 'true', hebrew_font: 'Frank Ruhl Libre', hebrew_font_color: '#aa0000', linker_scan_mode: 'candidates' },
  });
  const preview = plain(ctx.previewSettingsImport(text));
  const byId = Object.fromEntries(preview.groups.map((g) => [g.id, g]));
  assert.deepEqual(byId.text, Object.assign({}, byId.text, { inFile: 2, changes: 1 }), 'teamim is already on');
  assert.deepEqual([byId.look.inFile, byId.look.changes], [2, 2]);
  assert.deepEqual([byId.search.inFile, byId.search.changes], [1, 0], 'already the default');
  assert.deepEqual([byId.menu.inFile, byId.menu.changes], [1, 0], 'already Everything');
  assert.equal(preview.skippedCount, 0);
  assert.ok(!('changes' in preview), 'the preview does not hand back values');

  const result = ctx.applySettingsImport(text, ['look']);
  assert.equal(result.applied, 2);
  assert.equal(props.store.hebrew_font, 'Frank Ruhl Libre');
  assert.equal(props.store.hebrew_font_color, '#aa0000');
  assert.equal(props.store.nekudot, 'true', 'Text and layout was not ticked');
  assert.ok(!('teamim' in props.store) && !('linker_scan_mode' in props.store), 'unchanged values are not written');
});

test('a file\'s interface mode switches through the Interface switch, and its menu is the one kept', () => {
  const teacherMenu = JSON.stringify({ top: ['texts', 'link_texts'], quick_actions: [], hidden: [] });
  const text = JSON.stringify({
    format: 'torah-library-settings', formatVersion: 1, prefsSchemaVersion: '26',
    interfaceMode: 'simple',
    settings: { menu_layout: teacherMenu },
  });
  const ownMenu = JSON.stringify({ top: ['voices', 'texts'], quick_actions: [], hidden: [] });
  const { ctx, props } = load({ ui_mode: 'full', menu_layout: ownMenu });
  const result = ctx.applySettingsImport(text, ['menu']);
  assert.equal(result.uiMode, 'simple');
  assert.equal(props.store.ui_mode, 'simple');
  assert.equal(props.store.menu_layout, teacherMenu, 'the file\'s menu, not the Simple default');
  assert.equal(props.store.menu_layout_before_simple, ownMenu, 'the reader\'s own menu is kept for leaving Simple');

  // Without the menu part, neither the mode nor the menu changes.
  const other = load({ ui_mode: 'full', menu_layout: ownMenu });
  other.ctx.applySettingsImport(text, ['text', 'look', 'search']);
  assert.equal(other.props.store.ui_mode, 'full');
  assert.equal(other.props.store.menu_layout, ownMenu);
});

test('Reset To Defaults in Simple mode leaves the Simple menu and no second, kept menu', () => {
  const ownMenu = JSON.stringify({ top: ['voices', 'texts'], quick_actions: [], hidden: [] });
  const simple = load({ ui_mode: 'simple', menu_layout: '{"top":["texts"],"quick_actions":[],"hidden":["voices"]}', menu_layout_before_simple: ownMenu, nekudot: 'false' });
  const stored = simple.ctx.resetPreferencesToDefaults();
  assert.equal(simple.props.store.ui_mode, 'simple', 'the interface is not a setting');
  assert.equal(simple.props.store.menu_layout, simple.ctx.getSimpleMenuLayoutJson_());
  assert.equal(simple.props.store.menu_layout_before_simple, '');
  assert.equal(simple.props.store.nekudot, 'true');
  assert.equal(stored.nekudot, 'true', 'returns the stored settings for the form');
  assert.ok(simple.calls.includes('buildMenu'), 'the menu is rebuilt at once');

  const full = load({ ui_mode: 'full', menu_layout: ownMenu });
  full.ctx.resetPreferencesToDefaults();
  assert.equal(full.props.store.menu_layout, full.ctx.getDefaultMenuLayoutJson_());
  // Back to Everything after a Simple reset: the default menu, not the old one.
  const back = simple.ctx.setUiMode('full');
  assert.equal(simple.props.store.ui_mode, 'full');
  assert.ok(!back.menuKept);
  assert.ok(!('menu_layout' in simple.props.store) || simple.props.store.menu_layout === simple.ctx.getDefaultMenuLayoutJson_());
});

test('Reset To Defaults also resets all workflow modes, Commentary and Notes', () => {
  const { ctx, props } = load({
    voices_insert_mode_default: 'both', voices_translit_default: 'ashkenazi',
    lexicon_insert_mode_default: 'definition', source_emphasis_mode: 'only',
    source_notes_mode: 'omit', ui_mode: 'simple'
  });
  const result = ctx.resetPreferencesToDefaults();
  const expected = {
    voices_insert_mode_default: 'reference', voices_translit_default: 'none',
    lexicon_insert_mode_default: 'entry', source_emphasis_mode: 'keep', source_notes_mode: 'separate'
  };
  Object.entries(expected).forEach(([key, value]) => {
    assert.equal(props.store[key], value, `stored ${key}`);
    assert.equal(result[key], value, `returned ${key}`);
  });
  assert.equal(props.store.ui_mode, 'simple', 'Reset does not change the chosen interface');
  const exported = JSON.parse(ctx.exportSettingsFile({}, '').text);
  Object.entries(expected).forEach(([key, value]) => assert.equal(exported.settings[key], value, `exported ${key}`));
});

test('an old settings file cannot restore the generated undefined workflow modes', () => {
  const chosen = { voices_insert_mode_default: 'both', voices_translit_default: 'ashkenazi', lexicon_insert_mode_default: 'definition' };
  const { ctx, props } = load(chosen);
  const text = JSON.stringify({ format: 'torah-library-settings', formatVersion: 1, prefsSchemaVersion: '32',
    settings: Object.fromEntries(Object.keys(chosen).map((key) => [key, 'undefined']))
  });
  const preview = ctx.previewSettingsImport(text);
  assert.equal(preview.skippedCount, 3);
  ctx.applySettingsImport(text, ['text']);
  Object.entries(chosen).forEach(([key, value]) => assert.equal(props.store[key], value, key));
});

test('every setting belongs to exactly one part, and the excluded keys are real settings', () => {
  const { ctx } = load({});
  const settings = vm.runInContext('SETTINGS', ctx);
  const groups = vm.runInContext('SETTINGS_FILE_GROUPS_', ctx).map((g) => g.id);
  vm.runInContext('SETTINGS_FILE_EXCLUDED_', ctx).forEach((key) => assert.ok(settings.includes(key), key));
  settings.forEach((key) => assert.ok(groups.includes(ctx.settingsFileGroupOf_(key)), key));
  // A spot check of where the parts draw their lines.
  assert.equal(ctx.settingsFileGroupOf_('nekudot'), 'text');
  assert.equal(ctx.settingsFileGroupOf_('god_replacement'), 'text');
  assert.equal(ctx.settingsFileGroupOf_('citation_font_size'), 'look');
  assert.equal(ctx.settingsFileGroupOf_('emphasis_bold_color'), 'look');
  assert.equal(ctx.settingsFileGroupOf_('sefaria_link_edition_label'), 'look');
  assert.equal(ctx.settingsFileGroupOf_('search_corpus_order'), 'search');
  assert.equal(ctx.settingsFileGroupOf_('linker_review_mode'), 'search');
  assert.equal(ctx.settingsFileGroupOf_('menu_layout'), 'menu');
  assert.equal(ctx.settingsFileGroupOf_('show_voices_tab'), 'menu');
  assert.equal(ctx.settingsFileGroupOf_('show_lexicon_tab'), 'menu');
  assert.equal(ctx.settingsFileGroupOf_('sidebar_quick_actions_hidden'), 'menu');
  assert.equal(ctx.settingsFileGroupOf_('sidebar_options_hidden'), 'menu');
});

test('Import/Export modal: nothing Save collects, nothing drawn as HTML, a download that stays in the dialog', () => {
  const prefs = fs.readFileSync(path.join(APPS_SCRIPT, 'preferences.html'), 'utf8');
  const panel = prefs.match(/<dialog class="settings-transfer-dialog" id="settings-transfer-modal"[\s\S]*?<\/dialog>/)[0];
  const fields = panel.match(/<(input|textarea|select)\b[^>]*>/g) || [];
  assert.ok(fields.length >= 4);
  fields.forEach((field) => assert.doesNotMatch(field, /\bname=/, `Save would collect ${field}`));
  const js = fs.readFileSync(path.join(APPS_SCRIPT, 'preferences/settings-file-js.html'), 'utf8');
  // A file's name and contents are untrusted: built with textContent only.
  assert.doesNotMatch(js, /innerHTML|\.html\(|insertAdjacentHTML/);
  // The page's <base target="_top"> must not send the download to the document's window.
  assert.match(js, /link\.target = '_self';/);
  // Nothing is written before Apply, and only the parts ticked are sent.
  assert.match(js, /\.previewSettingsImportForTarget\(text, target\(\)\)/);
  assert.match(js, /input\[type="checkbox"\]:checked[\s\S]*?\.applySettingsImportForTarget\(pendingImportText, groups, target\(\)\)/);
});

test('Factory applies the complete preset while preserving inactive profiles, history and consent', () => {
  const initial = {
    prefs_schema_version: '34', ui_mode: 'full', source_notes_mode: 'inline', auto_scale_hebrew: 'true',
    settings_profiles: JSON.stringify({ active: 'p1', profiles: [{ id: 'p1', name: 'Main' }, { id: 'p2', name: 'Class' }] }),
    settings_profile_p2: JSON.stringify({ values: { source_notes_mode: 'inline' } }),
    linker_upload_acknowledged: 'true', last_search_sort_mode: 'chronological',
  };
  const { ctx, props, calls } = load(initial);
  const preset = vm.runInContext('FACTORY_PREFERENCE_VALUES_', ctx);
  assert.equal(Object.keys(preset).length, 113);
  const result = ctx.restorePreferencePreset('factory', 'p1');
  assert.equal(result.uiMode, 'simple');
  assert.equal(result.preferences.source_notes_mode, 'separate');
  assert.equal(result.preferences.bilingual_layout_default, 'he-right');
  assert.equal(result.preferences.auto_scale_hebrew, 'false');
  assert.equal(result.preferences.linker_review_mode, 'quiet');
  assert.equal(result.preferences.god_replacement, 'G-d');
  assert.deepEqual(JSON.parse(result.preferences.hidden_translation_languages), []);
  const menuPrefs = result.documentPreferences;
  const menu = ctx.planMenuFromLayout_(menuPrefs.menu_layout, {
    voicesEnabled: menuPrefs.show_voices_tab !== 'false',
    lexiconEnabled: menuPrefs.show_lexicon_tab !== 'false',
  });
  assert.deepEqual(Array.from(menu, (entry) => entry.label || entry.type), [
    'Add Sources with Sefaria', 'Link Texts with Sefaria', 'Transform Divine Names',
    'separator', 'Preferences', 'Help',
  ]);
  for (const [key, value] of Object.entries(preset)) assert.equal(props.store[key], value, key);
  for (const key of ['settings_profiles', 'settings_profile_p2', 'prefs_schema_version', 'last_search_sort_mode', 'linker_upload_acknowledged']) {
    assert.equal(props.store[key], initial[key], key);
  }
  assert.deepEqual(calls, ['buildMenu']);
});

test('profile reset affects only profile fields and saves refuse a stale profile', () => {
  const { ctx, props } = load({ prefs_schema_version: '33', ui_mode: 'full', source_notes_mode: 'omit', show_voices_tab: 'false' });
  const result = ctx.restorePreferencePreset('profile', 'p1');
  assert.equal(result.uiMode, 'full');
  assert.equal(result.preferences.source_notes_mode, 'separate');
  assert.equal(result.preferences.show_voices_tab, 'false');
  assert.throws(() => ctx.savePreferenceDefaults({ source_notes_mode: 'inline' }, 'p2'), /active profile changed/);
  assert.equal(props.store.source_notes_mode, 'separate');
  ctx.savePreferenceDefaults({ source_notes_mode: 'inline', show_voices_tab: true, linker_upload_acknowledged: 'false' }, 'p1');
  assert.equal(props.store.source_notes_mode, 'inline');
  assert.equal(props.store.show_voices_tab, 'true');
  assert.equal(props.store.linker_upload_acknowledged, undefined);
});
