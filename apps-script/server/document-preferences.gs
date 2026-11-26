// A private, persistent layer for this user's Google Doc. The property key
// uses the document ID hash, so it survives reopening and applies to all tabs
// in the Doc. The sidebar's temporary session overrides still sit above it.
function documentPreferencesKey_() {
  try {
    const doc = DocumentApp.getActiveDocument();
    return doc ? 'document_preferences_' + selectionTextHash_(doc.getId()) : '';
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
  const props = PropertiesService.getUserProperties();
  const values = key ? readDocumentPreferenceValues_(props.getProperty(key)) : {};
  return {
    key: key,
    profiles: getSettingsProfiles(),
    preferences: Object.assign(getAccountPreferences(), values),
    hasOverrides: Object.keys(values).length > 0
  };
}

// An empty edit is a no-op. Null explicitly discards this Doc's overrides.
// Only edited fields are passed by the dialog; other account defaults still
// flow through to this document. Serialize concurrent edits by the same user.
function saveDocumentPreferenceProfile(changes, expectedKey) {
  const key = documentPreferencesKey_();
  if (!key || key !== expectedKey) throw new Error('The document changed. Reopen Preferences before saving.');
  const lock = LockService.getUserLock();
  lock.waitLock(5000);
  try {
    const props = PropertiesService.getUserProperties();
    if (changes === null) {
      props.deleteProperty(key);
    } else {
      const defaults = getDefaultPreferences();
      const values = readDocumentPreferenceValues_(props.getProperty(key));
      settingsFileKeys_().forEach(function (field) {
        if (!changes || !Object.prototype.hasOwnProperty.call(changes, field)) return;
        if (!settingsFileValueOk_(field, changes[field], defaults)) throw new Error('A preference has an invalid value: ' + field);
        values[field] = String(changes[field]);
      });
      const serialized = JSON.stringify({ schema: PREFS_SCHEMA_CURRENT_, values: values });
      if (Utilities.newBlob(serialized).getBytes().length > PREFERENCE_VALUE_MAX_CHARS_) {
        throw new Error('This document has too many settings to save. Shorten custom overrides and try again.');
      }
      if (Object.keys(values).length) props.setProperty(key, serialized);
    }
  } finally {
    lock.releaseLock();
  }
  rebuildMenuQuietly_();
  return getDocumentPreferenceProfile();
}
