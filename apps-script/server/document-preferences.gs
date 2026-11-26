// A private, persistent layer for this user's Google Doc. The property key
// uses the document ID hash, so it survives reopening and applies to all tabs
// in the Doc. The sidebar's temporary session overrides still sit above it.
function documentPreferencesKey_() {
  try {
    const doc = DocumentApp.getActiveDocument();
    const id = doc && doc.getId();
    return id ? 'document_preferences_' + selectionTextHash_(id) : '';
  } catch (error) {
    return '';
  }
}

function readDocumentPreferenceValues_(raw) {
  if (!raw) return {};
  let saved;
  try { saved = JSON.parse(raw); } catch (error) { return {}; }
  if (!saved || !saved.values || typeof saved.values !== 'object') return {};
  let values = saved.values;
  const from = Number(saved.schema);
  if (Number.isFinite(from) && from < Number(PREFS_SCHEMA_CURRENT_)) {
    const inherited = migrateDocumentPreferenceValues_({}, from);
    const migrated = migrateDocumentPreferenceValues_(values, from);
    values = Object.keys(migrated).reduce(function (overrides, key) {
      // Migration defaults for previously unset fields still inherit from the account.
      if (Object.prototype.hasOwnProperty.call(saved.values, key) || migrated[key] !== inherited[key]) {
        overrides[key] = migrated[key];
      }
      return overrides;
    }, Object.create(null));
  }
  const defaults = getDefaultPreferences();
  const result = {};
  settingsFileKeys_().forEach(function (key) {
    if (Object.prototype.hasOwnProperty.call(values, key) &&
        settingsFileValueOk_(key, values[key], defaults)) result[key] = String(values[key]);
  });
  return result;
}

function migrateDocumentPreferenceValues_(values, from) {
  const store = Object.assign(Object.create(null), values);
  applyMigrationsFrom_({
    getProperty: function (key) { return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null; },
    setProperty: function (key, value) { store[key] = String(value); return this; },
    deleteProperty: function (key) { delete store[key]; return this; }
  }, from);
  return store;
}

function getDocumentPreferenceProfile() {
  const key = documentPreferencesKey_();
  const properties = snapshotProperties_(PropertiesService.getUserProperties());
  const values = key ? readDocumentPreferenceValues_(properties.getProperty(key)) : {};
  return {
    key: key,
    profiles: publicProfileIndex_(readProfileIndex_(properties.getProperty(SETTINGS_PROFILES_KEY_))),
    preferences: Object.assign(readUserPreferenceObject_(properties), values),
    hasOverrides: Object.keys(values).length > 0
  };
}

// Merge only edited fields so unset values still inherit. Null clears
// overrides for Preferences clients opened before the clone action existed.
function saveDocumentPreferenceProfile(changes, expectedKey) {
  return updateDocumentPreferences_(expectedKey, function (props, key) {
    if (changes === null) return null;
    const defaults = getDefaultPreferences();
    const values = readDocumentPreferenceValues_(props.getProperty(key));
    settingsFileKeys_().forEach(function (field) {
      if (!changes || !Object.prototype.hasOwnProperty.call(changes, field)) return;
      if (!settingsFileValueOk_(field, changes[field], defaults)) throw new Error('A preference has an invalid value: ' + field);
      values[field] = String(changes[field]);
    });
    return values;
  });
}

// Copy the built-in User Profile even if a different reusable profile is
// in use. Shared values come from the account and recent-use fields stay out.
function cloneAccountSettingsForDocument(expectedKey) {
  return updateDocumentPreferences_(expectedKey, function (props) {
    const all = props.getProperties() || {};
    const defaults = getDefaultPreferences();
    const index = publicProfileIndex_(readProfileIndex_(all[SETTINGS_PROFILES_KEY_]));
    if (index.active !== SETTINGS_PROFILE_IMPLICIT_ID_) {
      const userProfile = all[SETTINGS_PROFILE_PREFIX_ + SETTINGS_PROFILE_IMPLICIT_ID_];
      Object.assign(all, migrateProfileValues_(userProfile, defaults));
    }
    const values = {};
    settingsFileKeys_().forEach(function (key) {
      const value = all[key] == null ? defaults[key] : all[key];
      if (settingsFileValueOk_(key, value, defaults)) values[key] = String(value);
    });
    return values;
  });
}

function updateDocumentPreferences_(expectedKey, nextValues) {
  const key = documentPreferencesKey_();
  if (!key || key !== expectedKey) throw new Error('The document changed. Reopen Preferences before saving.');
  const lock = LockService.getUserLock();
  lock.waitLock(5000);
  try {
    const props = PropertiesService.getUserProperties();
    const values = nextValues(props, key);
    if (values === null) {
      props.deleteProperty(key);
    } else if (Object.keys(values).length) {
      const serialized = JSON.stringify({ schema: PREFS_SCHEMA_CURRENT_, values: values });
      if (Utilities.newBlob(serialized).getBytes().length > PREFERENCE_VALUE_MAX_CHARS_) {
        throw new Error('This document has too many settings to save. Shorten custom overrides and try again.');
      }
      props.setProperty(key, serialized);
    }
  } finally {
    lock.releaseLock();
  }
  rebuildMenuQuietly_();
  return getDocumentPreferenceProfile();
}
