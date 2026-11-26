/*
Copyright 2026 Austin Swafford
Licensed under the MIT License. See repository LICENSE.md.
*/

// Settings profiles: named sets of "how sources look", switched in a click
// from Preferences (the Profiles list, Everything) or the sidebar (Insertion
// Options → Profile). A teacher keeps one for a primary class
// (transliteration on) and one for adults (no vowels or punctuation, the
// commentary dropped) and moves between them mid-lesson.
//
// What a profile holds: the settings file's "Text and layout" and "Fonts,
// colours and titles" parts (settingsFileGroupOf_ 'text' and 'look'). The
// menu, Simple or Everything, the sidebar's controls, search and linking are
// the person's, not the class's: they stay as they are whichever profile is in
// use.
//
// The settings in use are always the ordinary stored preferences, which every
// reader reads as before; a profile is kept aside as a snapshot only while it
// is not in use. Switching stores the live values in the outgoing profile's
// snapshot and writes the incoming one's over them, in one setProperties
// call, so Reset To Defaults, a settings file and the sidebar's "Save as
// defaults" all change the profile in use and nothing else.
//
// Storage (UserProperties; not in SETTINGS, so setPreferences and a settings
// file can never write it):
//   settings_profiles       {"active": "p2", "profiles": [{"id": "p1", "name": "User Profile"}, …]}
//                           "" until the first profile is made, when the
//                           settings in use become "User Profile".
//   settings_profile_<id>   {"schema": "27", "values": {<profile key>: <stored string>}}
//                           for each profile not in use. A snapshot from an
//                           older schema is migrated when it comes back
//                           (migrateProfileValues_), like stored preferences.
//
// The pure helpers take plain objects so the Node tests can load this file with
// preferences.gs, menu-layout.gs, migrations.gs and settings-file.gs. The Apps
// Script side, the functions google.script.run reaches, is at the bottom.
// Logging follows AGENTS.md hard rule 7: error messages only, never a value.

var SETTINGS_PROFILES_KEY_ = 'settings_profiles';
var SETTINGS_PROFILE_PREFIX_ = 'settings_profile_';
var SETTINGS_PROFILES_MAX_ = 10;
var SETTINGS_PROFILE_NAME_MAX_ = 40;
var SETTINGS_PROFILE_FIRST_NAME_ = 'User Profile';
// What the settings in use are called before any profile is made.
var SETTINGS_PROFILE_IMPLICIT_ID_ = 'p1';

/** The keys a profile holds: every setting in the Text and layout, and Fonts, colours and titles parts. */
function settingsProfileKeys_() {
  return settingsFileKeys_().filter(function (key) {
    var group = settingsFileGroupOf_(key);
    return group === 'text' || group === 'look';
  });
}

/** A stored index, cleaned: unknown shapes give "no profiles". */
function readProfileIndex_(raw) {
  var parsed = null;
  try { parsed = raw ? JSON.parse(String(raw)) : null; } catch (error) { parsed = null; }
  var profiles = [];
  var seen = {};
  if (parsed && Array.isArray(parsed.profiles)) {
    parsed.profiles.forEach(function (entry) {
      if (!entry || typeof entry.id !== 'string' || !/^p\d{1,6}$/.test(entry.id) || seen[entry.id]) return;
      var name = cleanProfileName_(entry.name);
      if (!name) return;
      if (entry.id === SETTINGS_PROFILE_IMPLICIT_ID_) name = SETTINGS_PROFILE_FIRST_NAME_;
      seen[entry.id] = true;
      profiles.push({ id: entry.id, name: name });
    });
  }
  if (!profiles.length) return { active: null, profiles: [] };
  var active = parsed.active && seen[parsed.active] ? parsed.active : profiles[0].id;
  // Older builds allowed the built-in profile to be deleted. Restore the reserved slot
  // without replacing any remaining named profiles or their snapshots.
  if (!seen[SETTINGS_PROFILE_IMPLICIT_ID_]) {
    profiles.unshift({ id: SETTINGS_PROFILE_IMPLICIT_ID_, name: SETTINGS_PROFILE_FIRST_NAME_ });
  }
  return { active: active, profiles: profiles };
}

/**
 * What the client is shown: always at least one profile. With none made, the
 * settings in use are listed as "User Profile", marked `implicit`.
 */
function publicProfileIndex_(index) {
  if (!index.profiles.length) {
    return { active: SETTINGS_PROFILE_IMPLICIT_ID_, implicit: true, max: SETTINGS_PROFILES_MAX_,
      profiles: [{ id: SETTINGS_PROFILE_IMPLICIT_ID_, name: SETTINGS_PROFILE_FIRST_NAME_ }] };
  }
  return { active: index.active, implicit: false, max: SETTINGS_PROFILES_MAX_,
    profiles: index.profiles.map(function (p) { return { id: p.id, name: p.name }; }) };
}

function cleanProfileName_(name) {
  return String(name == null ? '' : name).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim()
    .slice(0, SETTINGS_PROFILE_NAME_MAX_);
}

/** A name a new or renamed profile may take; throws a message for the person otherwise. */
function checkProfileName_(name, index, exceptId) {
  var clean = cleanProfileName_(name);
  if (!clean) throw new Error('Give the profile a name.');
  if (/^(account|user profile|this document)$/i.test(clean)) throw new Error('That name is reserved for a built-in profile.');
  var taken = index.profiles.some(function (p) {
    return p.id !== exceptId && p.name.toLowerCase() === clean.toLowerCase();
  });
  if (taken) throw new Error('You already have a profile called “' + clean + '”.');
  return clean;
}

function nextProfileId_(index) {
  var max = 0;
  index.profiles.forEach(function (p) { max = Math.max(max, Number(p.id.slice(1)) || 0); });
  return 'p' + (max + 1);
}

/**
 * The snapshot of the settings in use: every profile key, its stored value or
 * else its default. Throws if it would not fit in one stored value.
 */
function snapshotProfileValues_(stored, defaults) {
  var values = {};
  settingsProfileKeys_().forEach(function (key) {
    var value = stored[key];
    values[key] = value != null ? String(value) : String(defaults[key]);
  });
  var json = JSON.stringify({ schema: PREFS_SCHEMA_CURRENT_, values: values });
  if (json.length > PREFERENCE_VALUE_MAX_CHARS_) {
    throw new Error('These settings are too large to keep as a profile (long transliteration or language overrides). Shorten them and try again.');
  }
  return json;
}

/**
 * A stored snapshot, migrated to the current schema and checked: what the
 * live keys become when its profile comes back. A key missing from it (or a
 * value no setting could hold) takes its default.
 */
function migrateProfileValues_(raw, defaults) {
  var parsed = null;
  try { parsed = raw ? JSON.parse(String(raw)) : null; } catch (error) { parsed = null; }
  var values = (parsed && parsed.values && typeof parsed.values === 'object') ? parsed.values : {};
  var store = {};
  Object.keys(values).forEach(function (key) {
    if (values[key] != null) store[key] = String(values[key]);
  });
  var from = Number(parsed && parsed.schema);
  if (isFinite(from) && from < Number(PREFS_SCHEMA_CURRENT_)) {
    applyMigrationsFrom_({
      getProperty: function (key) { return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null; },
      setProperty: function (key, value) { store[key] = String(value); return this; },
      deleteProperty: function (key) { delete store[key]; return this; }
    }, from);
  }
  var out = {};
  settingsProfileKeys_().forEach(function (key) {
    var value = store[key];
    out[key] = value != null && settingsFileValueOk_(key, value, defaults) ? value : String(defaults[key]);
  });
  return out;
}

/**
 * The writes that make `targetId` the profile in use. `stored` is every stored
 * property (getProperties()). Returns null when it is already in use.
 *
 * @return {?{set: Object<string,string>, remove: string[]}}
 */
function planProfileSwitch_(stored, defaults, targetId) {
  var index = readProfileIndex_(stored[SETTINGS_PROFILES_KEY_]);
  var target = index.profiles.filter(function (p) { return p.id === targetId; })[0];
  if (!target) throw new Error('That profile no longer exists. Close Preferences and open it again.');
  if (index.active === targetId) return null;
  var set = migrateProfileValues_(stored[SETTINGS_PROFILE_PREFIX_ + targetId], defaults);
  set[SETTINGS_PROFILE_PREFIX_ + index.active] = snapshotProfileValues_(stored, defaults);
  index.active = targetId;
  set[SETTINGS_PROFILES_KEY_] = JSON.stringify(index);
  // The profile in use has no snapshot: its values are the live ones.
  return { set: set, remove: [SETTINGS_PROFILE_PREFIX_ + targetId] };
}

/**
 * The writes for a new profile, which starts as a copy of the settings in use
 * and becomes the one in use (so nothing the person sees changes). The first
 * one also turns the settings in use into "User Profile".
 */
function planProfileCreate_(stored, defaults, name) {
  var index = readProfileIndex_(stored[SETTINGS_PROFILES_KEY_]);
  if (!index.profiles.length) {
    index = { active: SETTINGS_PROFILE_IMPLICIT_ID_, profiles: [{ id: SETTINGS_PROFILE_IMPLICIT_ID_, name: SETTINGS_PROFILE_FIRST_NAME_ }] };
  }
  if (index.profiles.length >= SETTINGS_PROFILES_MAX_) {
    throw new Error('You can keep up to ' + SETTINGS_PROFILES_MAX_ + ' profiles. Delete one to make another.');
  }
  var clean = checkProfileName_(name, index, null);
  var id = nextProfileId_(index);
  var set = {};
  set[SETTINGS_PROFILE_PREFIX_ + index.active] = snapshotProfileValues_(stored, defaults);
  index.profiles.push({ id: id, name: clean });
  index.active = id;
  set[SETTINGS_PROFILES_KEY_] = JSON.stringify(index);
  return { set: set, remove: [], id: id };
}

function planProfileRename_(stored, id, name) {
  var index = readProfileIndex_(stored[SETTINGS_PROFILES_KEY_]);
  if (id === SETTINGS_PROFILE_IMPLICIT_ID_) throw new Error('User Profile cannot be renamed.');
  var target = index.profiles.filter(function (p) { return p.id === id; })[0];
  if (!target) throw new Error('That profile no longer exists. Close Preferences and open it again.');
  target.name = checkProfileName_(name, index, id);
  var set = {};
  set[SETTINGS_PROFILES_KEY_] = JSON.stringify(index);
  return { set: set, remove: [] };
}

/**
 * The writes that delete a profile. The one in use is replaced by the first
 * other profile, switched in first. The last profile cannot be deleted.
 */
function planProfileDelete_(stored, defaults, id) {
  var index = readProfileIndex_(stored[SETTINGS_PROFILES_KEY_]);
  if (!index.profiles.some(function (p) { return p.id === id; })) {
    throw new Error('That profile no longer exists. Close Preferences and open it again.');
  }
  if (id === SETTINGS_PROFILE_IMPLICIT_ID_) throw new Error('User Profile cannot be deleted.');
  var set = {};
  var remove = [SETTINGS_PROFILE_PREFIX_ + id];
  if (index.active === id) {
    var next = index.profiles.filter(function (p) { return p.id !== id; })[0];
    set = migrateProfileValues_(stored[SETTINGS_PROFILE_PREFIX_ + next.id], defaults);
    remove.push(SETTINGS_PROFILE_PREFIX_ + next.id);
    index.active = next.id;
  }
  index.profiles = index.profiles.filter(function (p) { return p.id !== id; });
  set[SETTINGS_PROFILES_KEY_] = JSON.stringify(index);
  return { set: set, remove: remove };
}

// ── Apps Script side ──────────────────────────────────────────────────────

function applyProfilePlan_(plan) {
  var props = PropertiesService.getUserProperties();
  if (plan) {
    props.setProperties(plan.set);
    plan.remove.forEach(function (key) { props.deleteProperty(key); });
  }
  return {
    profiles: publicProfileIndex_(readProfileIndex_(props.getProperty(SETTINGS_PROFILES_KEY_))),
    preferences: getAccountPreferences(),
    documentPreferences: getPreferences()
  };
}

function runProfileChange_(name, plan) {
  runUserPreferenceMigrationsIfNeeded_();
  try {
    var stored = PropertiesService.getUserProperties().getProperties() || {};
    return applyProfilePlan_(plan(stored, getDefaultPreferences()));
  } catch (error) {
    Logger.log(name + ': ' + error.message);
    throw error;
  }
}

/** @return {{active: string, implicit: boolean, max: number, profiles: {id: string, name: string}[]}} */
function getSettingsProfiles() {
  return publicProfileIndex_(readProfileIndex_(PropertiesService.getUserProperties().getProperty(SETTINGS_PROFILES_KEY_)));
}

/** A new profile, a copy of the settings in use, now in use. */
function createSettingsProfile(name) {
  return runProfileChange_('createSettingsProfile', function (stored, defaults) {
    return planProfileCreate_(stored, defaults, name);
  });
}

/** Makes `id` the profile in use: its settings become the ones every insert reads. */
function switchSettingsProfile(id) {
  return runProfileChange_('switchSettingsProfile', function (stored, defaults) {
    return planProfileSwitch_(stored, defaults, String(id || ''));
  });
}

function renameSettingsProfile(id, name) {
  return runProfileChange_('renameSettingsProfile', function (stored) {
    return planProfileRename_(stored, String(id || ''), name);
  });
}

function deleteSettingsProfile(id) {
  return runProfileChange_('deleteSettingsProfile', function (stored, defaults) {
    return planProfileDelete_(stored, defaults, String(id || ''));
  });
}
