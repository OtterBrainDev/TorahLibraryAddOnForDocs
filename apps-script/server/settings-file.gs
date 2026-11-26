/*
Copyright 2026 Austin Swafford
Licensed under the MIT License. See repository LICENSE.md.
*/

// Preferences → Advanced → Settings file: export the settings to a file and
// import one someone else exported, so a teacher can give a class the same
// vowels, layout and fonts and an organization can hand out its house style.
//
// The file is JSON, written and read in the browser (no Drive access, so no
// new OAuth scope):
//
//   {
//     "format": "torah-library-settings",
//     "formatVersion": 1,
//     "prefsSchemaVersion": "29",       // PREFS_SCHEMA_CURRENT_ when exported
//     "exportedAt": "2026-11-09T…Z",
//     "name": "Grade 7 Chumash",         // optional, shown on import
//     "interfaceMode": "simple",         // "simple" | "full"
//     "settings": { "<SETTINGS key>": "<value as stored>", … }
//   }
//
// A file is untrusted input (anyone can write one), so an import writes only
// SETTINGS keys, through setPreferences, and only values of the shape that
// key takes (settingsFileValueOk_); anything else is skipped and counted. It
// never writes `ui_mode` directly: a file's interface mode goes through the
// same switch as the Interface control (applyUiModeSwitch_), which keeps the
// menu in step.
//
// The pure helpers take plain objects so the Node tests can load this file
// with preferences.gs, menu-layout.gs, first-run.gs and migrations.gs. The
// Apps Script side is at the bottom.

var SETTINGS_FILE_FORMAT_ = 'torah-library-settings';
var SETTINGS_FILE_FORMAT_VERSION_ = 1;
// A full export is ~6 KB; this leaves room for long override maps.
var SETTINGS_FILE_MAX_CHARS_ = 200000;
var SETTINGS_FILE_NAME_MAX_CHARS_ = 80;

// What one reader did last, not how they want sources to look: never in a
// file, never taken from one.
var SETTINGS_FILE_EXCLUDED_ = [
  'last_translation_languages',
  'last_translation_only_filter',
  'last_search_sort_mode',
  'last_search_relevance_sort',
  'search_mode'
];

// The parts an import offers, in the order the dialog lists them.
var SETTINGS_FILE_GROUPS_ = [
  { id: 'text', label: 'Text and layout', help: 'Vowels, cantillation, punctuation, display and arrangement, citation, commentary, marked notes, transliteration, translation language, divine names' },
  { id: 'look', label: 'Fonts, colours and titles', help: 'Every font, size, style, colour and highlight; title and citation styles; linked-title look' },
  { id: 'search', label: 'Search and linking', help: 'Corpus and dictionary order, hidden languages, Link Texts and Insert from Selection' },
  { id: 'menu', label: 'Menu and interface', help: 'The add-on menu, Simple or Everything, the sidebar\'s tabs, Quick Actions and Insertion Options, experimental features' }
];

function settingsFileGroupOf_(key) {
  if (key === 'menu_layout' || key === 'experimental_features_enabled' || key === 'surprise_me_enabled' || /^show_(voices|lexicon)_tab$|^sidebar_/.test(key)) return 'menu';
  if (/^search_corpus_|^lexicon_dictionary_|^voices_topic_|^hidden_translation_languages$|^show_unavailable_translations$|^link_texts_default$|^link_sources_insert_after_linking$|^linker_|^insert_from_selection_replace$/.test(key)) return 'search';
  if (key === 'auto_scale_hebrew') return 'look';
  if (/_font(_size|_style|_color|_background)?$|^emphasis_(bold|italic)_|_format_override$|_edition_label$|^source_title_heading$|^translation_language_typography$/.test(key)) return 'look';
  return 'text';
}

function settingsFileKeys_() {
  return SETTINGS.filter(function (key) { return SETTINGS_FILE_EXCLUDED_.indexOf(key) < 0; });
}

/**
 * Whether `value` is something `key` can hold: the checks setPreferences
 * makes (a string, boolean or number within PREFERENCE_VALUE_MAX_CHARS_),
 * and the shape of the key's values: true/false for a switch, a size, a
 * #rrggbb colour, JSON for the keys stored as JSON. Empty is allowed wherever
 * the default is empty ("match the document").
 */
function settingsFileValueOk_(key, value, defaults) {
  if (value === null || value === undefined) return false;
  var type = typeof value;
  if (type !== 'string' && type !== 'boolean' && type !== 'number') return false;
  var text = String(value);
  if (text.length > PREFERENCE_VALUE_MAX_CHARS_) return false;
  var fallback = defaults[key];
  if (key === 'source_notes_mode') return ['omit', 'inline', 'separate'].indexOf(text) >= 0;
  // Older profiles could export this generated sentinel because these keys
  // had no canonical defaults. An old settings file must not reintroduce it.
  if (['voices_insert_mode_default', 'voices_translit_default', 'lexicon_insert_mode_default'].indexOf(key) >= 0 && text === 'undefined') return false;
  if (typeof fallback === 'boolean') return text === 'true' || text === 'false';
  if (/_font_size$/.test(key)) {
    return text === '' || (/^\d{1,3}(\.\d{1,2})?$/.test(text) && Number(text) > 0 && Number(text) <= 400);
  }
  if (/_(color|background)$/.test(key)) return text === '' || /^#[0-9a-fA-F]{6}$/.test(text) || /^#[0-9a-fA-F]{3}$/.test(text);
  if (typeof fallback === 'string' && /^[[{]/.test(fallback)) {
    if (text === '') return true;
    try { JSON.parse(text); return true; } catch (error) { return false; }
  }
  return true;
}

/**
 * The file for the stored settings, with `overrides` (the values shown in the
 * Preferences dialog, saved or not) on top.
 *
 * @param {Object} stored     readUserPreferenceObject_(): every SETTINGS key
 * @param {Object} overrides  from the dialog (untrusted); only valid values of
 *                            exported keys are used
 * @param {{name: ?string, uiMode: ?string, exportedAt: string, schemaVersion: string}} meta
 */
function buildSettingsFile_(stored, overrides, defaults, meta) {
  var o = (overrides && typeof overrides === 'object') ? overrides : {};
  var settings = {};
  settingsFileKeys_().forEach(function (key) {
    var value = Object.prototype.hasOwnProperty.call(o, key) && settingsFileValueOk_(key, o[key], defaults)
      ? o[key]
      : stored[key];
    if (value === null || value === undefined) return;
    settings[key] = String(value);
  });
  var file = {
    format: SETTINGS_FILE_FORMAT_,
    formatVersion: SETTINGS_FILE_FORMAT_VERSION_,
    prefsSchemaVersion: String(meta.schemaVersion),
    exportedAt: meta.exportedAt
  };
  var name = String((meta && meta.name) || '').replace(/\s+/g, ' ').trim().slice(0, SETTINGS_FILE_NAME_MAX_CHARS_);
  if (name) file.name = name;
  file.interfaceMode = normalizeUiMode_(meta && meta.uiMode);
  file.settings = settings;
  return file;
}

/** A file name for the export: "sefaria-google-docs-settings[-name].json". */
function settingsFileName_(name) {
  var slug = String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  return 'sefaria-google-docs-settings' + (slug ? '-' + slug : '') + '.json';
}

/**
 * Read a settings file's text. Throws an Error whose message can be shown to
 * the user as it is.
 * @param {string} text
 * @param {number} currentSchema  PREFS_SCHEMA_CURRENT_
 */
function parseSettingsFile_(text, currentSchema) {
  if (typeof text !== 'string' || !text.trim()) throw new Error('The file is empty.');
  if (text.length > SETTINGS_FILE_MAX_CHARS_) throw new Error('That file is too large to be a settings file.');
  var file;
  try {
    file = JSON.parse(text);
  } catch (error) {
    throw new Error('That is not a settings file: it could not be read.');
  }
  if (!file || typeof file !== 'object' || Array.isArray(file) || file.format !== SETTINGS_FILE_FORMAT_) {
    throw new Error('That is not a Sefaria for Google Docs settings file.');
  }
  if (Number(file.formatVersion) > SETTINGS_FILE_FORMAT_VERSION_ || Number(file.prefsSchemaVersion) > Number(currentSchema)) {
    throw new Error('That file was made by a newer version of the add-on. Reload the document to update, then try again.');
  }
  if (!file.settings || typeof file.settings !== 'object' || Array.isArray(file.settings)) {
    throw new Error('That settings file has no settings in it.');
  }
  return file;
}

/**
 * What importing `file` would change, by group.
 *
 * @param {Object} file      parseSettingsFile_()
 * @param {Object} stored    readUserPreferenceObject_()
 * @param {Object} defaults  getDefaultPreferences()
 * @param {string} currentUiMode
 * @param {?string[]} groupIds  the groups to apply; null for all
 * @return {{changes: Object<string,string>, groups: Object[], skipped: string[],
 *           uiMode: ?string, name: string, exportedAt: string}}
 *   `changes` holds only values that differ from what is stored; `uiMode` is
 *   the mode to switch to, or null to leave it.
 */
function planSettingsImport_(file, stored, defaults, currentUiMode, groupIds) {
  var allowed = Array.isArray(groupIds) ? groupIds : null;
  function wanted(group) { return !allowed || allowed.indexOf(group) >= 0; }
  var counts = {};
  SETTINGS_FILE_GROUPS_.forEach(function (group) { counts[group.id] = { inFile: 0, changes: 0 }; });
  var changes = {};
  var skipped = [];
  var exportable = settingsFileKeys_();

  Object.keys(file.settings).forEach(function (key) {
    var value = file.settings[key];
    if (exportable.indexOf(key) < 0 || !settingsFileValueOk_(key, value, defaults)) {
      skipped.push(String(key).slice(0, 60));
      return;
    }
    var group = settingsFileGroupOf_(key);
    counts[group].inFile += 1;
    var text = String(value);
    if (String(stored[key]) === text) return;
    counts[group].changes += 1;
    if (wanted(group)) changes[key] = text;
  });

  var uiMode = null;
  if (file.interfaceMode === 'simple' || file.interfaceMode === 'full') {
    counts.menu.inFile += 1;
    if (file.interfaceMode !== normalizeUiMode_(currentUiMode)) {
      counts.menu.changes += 1;
      if (wanted('menu')) uiMode = file.interfaceMode;
    }
  }

  return {
    changes: changes,
    groups: SETTINGS_FILE_GROUPS_.filter(function (group) { return counts[group.id].inFile > 0; }).map(function (group) {
      return { id: group.id, label: group.label, help: group.help, inFile: counts[group.id].inFile, changes: counts[group.id].changes };
    }),
    skipped: skipped,
    uiMode: uiMode,
    interfaceMode: file.interfaceMode === 'simple' || file.interfaceMode === 'full' ? file.interfaceMode : null,
    name: String(file.name || '').slice(0, SETTINGS_FILE_NAME_MAX_CHARS_),
    exportedAt: String(file.exportedAt || '').slice(0, 40)
  };
}

// ── Apps Script side ──────────────────────────────────────────────────────

function settingsImportContext_() {
  return {
    stored: getAccountPreferences(),
    defaults: getDefaultPreferences(),
    uiMode: getUiMode_()
  };
}

/**
 * Preferences → Advanced → Export settings file.
 * @param {Object} formValues  the dialog's values (collectPreferenceObject), saved or not
 * @param {string} name        an optional name for the file
 * @return {{fileName: string, text: string, count: number}}
 */
function exportSettingsFile(formValues, name) {
  var context = settingsImportContext_();
  var file = buildSettingsFile_(context.stored, formValues, context.defaults, {
    name: name,
    uiMode: context.uiMode,
    exportedAt: new Date().toISOString(),
    schemaVersion: PREFS_SCHEMA_CURRENT_
  });
  return {
    fileName: settingsFileName_(file.name),
    text: JSON.stringify(file, null, 2),
    count: Object.keys(file.settings).length
  };
}

/**
 * What a settings file would change. Changes nothing.
 * @param {string} text  the file's contents
 * @return {Object} planSettingsImport_ without `changes`
 */
function previewSettingsImport(text) {
  var file = parseSettingsFile_(text, PREFS_SCHEMA_CURRENT_);
  var context = settingsImportContext_();
  var plan = planSettingsImport_(file, context.stored, context.defaults, context.uiMode, null);
  delete plan.changes;
  plan.skippedCount = plan.skipped.length;
  delete plan.skipped;
  return plan;
}

/**
 * Apply the chosen parts of a settings file.
 * @param {string} text       the file's contents
 * @param {string[]} groupIds the groups to apply (ids from SETTINGS_FILE_GROUPS_)
 * @return {{preferences: Object, applied: number, uiMode: string, menuLayout: string}}
 */
function applySettingsImport(text, groupIds) {
  var file = parseSettingsFile_(text, PREFS_SCHEMA_CURRENT_);
  var context = settingsImportContext_();
  var groups = (Array.isArray(groupIds) ? groupIds : []).map(String);
  var plan = planSettingsImport_(file, context.stored, context.defaults, context.uiMode, groups);
  // The mode first: switching moves the menu, and a menu in the file is the
  // one the importer gets.
  if (plan.uiMode) applyUiModeSwitch_(plan.uiMode);
  setPreferences(plan.changes);
  rebuildMenuQuietly_();
  return {
    preferences: getAccountPreferences(),
    applied: Object.keys(plan.changes).length + (plan.uiMode ? 1 : 0),
    uiMode: getUiMode_(),
    menuLayout: PropertiesService.getUserProperties().getProperty('menu_layout') || ''
  };
}


// ── Import/Export modal: explicit target, never a profile switch ────────────
// Keep the original RPCs above for already-open older dialogs. New callers
// name the mode and active profile they opened with, plus the selected target.
// Shared settings remain account-wide; named profiles contain text/look only.
function settingsTransferContext_(target) {
  var props = PropertiesService.getUserProperties();
  var all = props.getProperties() || {};
  var mode = normalizeUiMode_(all.ui_mode);
  var index = publicProfileIndex_(readProfileIndex_(all[SETTINGS_PROFILES_KEY_]));
  var t = target && typeof target === 'object' ? target : {};
  if (t.mode !== mode || t.activeId !== index.active) {
    throw new Error('The interface or active profile changed. Close Import/Export and reopen Preferences.');
  }
  var id = String(t.profileId || '');
  var profile = index.profiles.filter(function (p) { return p.id === id; })[0];
  if (!profile || (mode === 'simple' && id !== index.active)) {
    throw new Error('That settings target is no longer available. Reopen Import/Export.');
  }
  var defaults = getDefaultPreferences();
  var values = {};
  settingsFileKeys_().forEach(function (key) {
    values[key] = all[key] == null ? defaults[key] : all[key];
  });
  var active = id === index.active;
  if (!active) {
    var raw = all[SETTINGS_PROFILE_PREFIX_ + id];
    if (!raw) throw new Error('The saved profile could not be read. Nothing was changed.');
    Object.assign(values, migrateProfileValues_(raw, defaults));
  }
  return {
    props: props, defaults: defaults, stored: values, uiMode: mode,
    profile: profile, active: active, includeShared: mode === 'simple' || t.includeShared === true
  };
}

function exportSettingsForTarget(formValues, name, target) {
  var c = settingsTransferContext_(target);
  // Unsaved form values belong only to the active profile. An inactive
  // profile is exported from its saved snapshot, without activating it.
  var file = buildSettingsFile_(c.stored, c.active ? formValues : {}, c.defaults, {
    name: String(name || '').trim() || (c.uiMode === 'full' ? c.profile.name : ''),
    uiMode: c.uiMode, exportedAt: new Date().toISOString(), schemaVersion: PREFS_SCHEMA_CURRENT_
  });
  if (!c.includeShared) {
    var keys = settingsProfileKeys_();
    Object.keys(file.settings).forEach(function (key) {
      if (keys.indexOf(key) < 0) delete file.settings[key];
    });
    delete file.interfaceMode;
  }
  return { fileName: settingsFileName_(file.name), text: JSON.stringify(file, null, 2),
    count: Object.keys(file.settings).length };
}

function planSettingsTransferImport_(text, c, groupIds) {
  var file = parseSettingsFile_(text, PREFS_SCHEMA_CURRENT_);
  var profileKeys = settingsProfileKeys_();
  var known = settingsFileKeys_();
  var ignoredShared = 0;
  if (!c.includeShared) {
    Object.keys(file.settings).forEach(function (key) {
      if (known.indexOf(key) >= 0 && profileKeys.indexOf(key) < 0) {
        ignoredShared++;
        delete file.settings[key];
      }
    });
  }
  // Import never changes the interface mode. This is a separate UI choice.
  delete file.interfaceMode;
  var plan = planSettingsImport_(file, c.stored, c.defaults, c.uiMode, groupIds);
  plan.ignoredShared = ignoredShared;
  plan.targetName = c.profile.name;
  plan.targetActive = c.active;
  plan.includeShared = c.includeShared;
  return plan;
}

function previewSettingsImportForTarget(text, target) {
  var c = settingsTransferContext_(target);
  var plan = planSettingsTransferImport_(text, c, null);
  delete plan.changes;
  plan.skippedCount = plan.skipped.length;
  delete plan.skipped;
  return plan;
}

function applySettingsImportForTarget(text, groupIds, target) {
  var c = settingsTransferContext_(target);
  var groups = (Array.isArray(groupIds) ? groupIds : []).map(String);
  var plan = planSettingsTransferImport_(text, c, groups);
  var profileKeys = settingsProfileKeys_();
  var set = {}, inactiveChanges = {}, sharedChanged = false;
  Object.keys(plan.changes).forEach(function (key) {
    if (profileKeys.indexOf(key) >= 0) {
      if (c.active) set[key] = plan.changes[key];
      else inactiveChanges[key] = plan.changes[key];
    } else if (c.includeShared) {
      set[key] = plan.changes[key];
      sharedChanged = true;
    }
  });
  // Build and size-check the inactive snapshot before making any writes.
  // Import only the checked file groups, retaining other profile values.
  var affectsActive = Object.keys(set).length > 0;
  if (Object.keys(inactiveChanges).length) {
    set[SETTINGS_PROFILE_PREFIX_ + c.profile.id] =
      snapshotProfileValues_(Object.assign({}, c.stored, inactiveChanges), c.defaults);
  }
  if (Object.keys(set).length) c.props.setProperties(set);
  if (sharedChanged) rebuildMenuQuietly_();
  return {
    preferences: affectsActive ? getAccountPreferences() : null,
    applied: Object.keys(plan.changes).length,
    uiMode: c.uiMode, affectsActive: affectsActive, targetName: c.profile.name
  };
}
