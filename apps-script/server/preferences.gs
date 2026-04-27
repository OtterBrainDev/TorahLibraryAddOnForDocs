// User preferences: defaults, account-level preferences (PropertiesService),
// and per-session overrides (CacheService). Session state has a 6-hour TTL.
// The `SETTINGS` array is the authoritative list of user-facing preference
// keys; every new key must be paired with a migration entry in migrations.gs.
// See AGENTS.md hard rule #1.

const SETTINGS = [
  "apply_sheimot_on_insertion",
  "elodim_replace",
  "elodim_replacement",
  "extended_gemara",
  "god_replace",
  "god_replacement",
  "hebrew_font",
  "hebrew_font_size",
  "hebrew_font_style",
  "include_translation_source_info",
  "include_transliteration_default",
  "insert_citation_default",
  "insert_sefaria_link_default",
  "link_texts_default",
  "show_line_markers_default",
  "output_mode_default",
  "bilingual_layout_default",
  "last_translation_languages",
  "last_translation_only_filter",
  "last_search_sort_mode",
  "last_search_relevance_sort",
  "meforash_replace",
  "meforash_replacement",
  "nekudot",
  "nekudot_filter",
  "experimental_features_enabled",
  "surprise_me_enabled",
  "teamim",
  "teamim_filter",
  "translation_font",
  "translation_font_size",
  "translation_font_style",
  "preferred_translation_language",
  "transliteration_font",
  "transliteration_font_size",
  "transliteration_font_style",
  "transliteration_scheme",
  "transliteration_overrides",
  "transliteration_is_biblical_hebrew",
  "transliteration_biblical_dagesh_mode",
  "versioning",
  "voices_insert_mode_default",
  "voices_translit_default",
  "lexicon_insert_mode_default",
  "yaw_replace",
  "yaw_replacement",
  "source_title_font",
  "source_title_font_size",
  "source_title_font_style",
  "sefaria_link_font",
  "sefaria_link_font_size",
  "sefaria_link_font_style",
  "search_mode"
];

//returns the user preference w.r.t. displaying the versioning dropdowns in the insertion module
function getVersioningPreference() {
  try {
    const userProperties = PropertiesService.getUserProperties();
    return userProperties.getProperty("versioning");
  } catch (error) {
    Logger.log(`The system has made a mach'ah: ${error.message}`);
    return true;
  }
}

function getDefaultPreferences() {
  return {
    apply_sheimot_on_insertion: false,
    elodim_replace: false,
    elodim_replacement: "אלוקים",
    extended_gemara: false,
    god_replace: false,
    god_replacement: "G-d",
    preferred_translation_language: "en",
    hebrew_font: "Noto Sans Hebrew",
    hebrew_font_size: 18,
    hebrew_font_style: "normal",
    include_translation_source_info: false,
    include_transliteration_default: false,
    insert_citation_default: false,
    insert_sefaria_link_default: true,
    link_texts_default: false,
    show_line_markers_default: true,
    output_mode_default: "both",
    bilingual_layout_default: "he-right",
    last_translation_languages: JSON.stringify(["en"]),
    last_translation_only_filter: false,
    last_search_sort_mode: "relevance",
    last_search_relevance_sort: true,
    meforash_replace: false,
    meforash_replacement: "ה'",
    nekudot: true,
    nekudot_filter: "always",
    surprise_me_enabled: false,
    teamim: true,
    teamim_filter: "available",
    translation_font: "Noto Sans Hebrew",
    translation_font_size: 12,
    translation_font_style: "normal",
    transliteration_font: "Noto Sans Hebrew",
    transliteration_font_size: 12,
    transliteration_font_style: "italic",
    transliteration_scheme: "traditional",
    transliteration_overrides: "{}",
    transliteration_is_biblical_hebrew: true,
    transliteration_biblical_dagesh_mode: "none",
    versioning: true,
    yaw_replace: false,
    yaw_replacement: "קה",
    source_title_font: "Noto Sans Hebrew",
    source_title_font_size: 14,
    source_title_font_style: "normal",
    sefaria_link_font: "Noto Sans Hebrew",
    sefaria_link_font_size: 14,
    sefaria_link_font_style: "underline",
    search_mode: "texts"
  };
}

function readUserPreferenceObject_() {
  const defaults = getDefaultPreferences();
  const preferences = PropertiesService.getUserProperties();
  const out = {};
  for (let i = 0; i < SETTINGS.length; i++) {
    const key = SETTINGS[i];
    const storedValue = preferences.getProperty(key);
    out[key] = (storedValue !== null && storedValue !== undefined) ? storedValue : defaults[key];
  }
  return out;
}

function generateSidebarSessionId_() {
  return Utilities.getUuid();
}

function getSidebarSessionCacheKey_(sessionId) {
  return 'sidebar_session_' + String(sessionId || 'default');
}

function getSidebarSessionState(sessionId) {
  if (!sessionId) return {};
  const raw = CacheService.getUserCache().get(getSidebarSessionCacheKey_(sessionId));
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return (parsed && typeof parsed === 'object') ? parsed : {};
  } catch (error) {
    return {};
  }
}

function setSidebarSessionState(sessionId, payload) {
  if (!sessionId) throw new Error('Missing sidebar session id.');
  const current = getSidebarSessionState(sessionId);
  const merged = Object.assign({}, current, payload || {});
  CacheService.getUserCache().put(getSidebarSessionCacheKey_(sessionId), JSON.stringify(merged), 21600);
  return merged;
}

function clearSidebarSessionState(sessionId) {
  if (sessionId) {
    CacheService.getUserCache().remove(getSidebarSessionCacheKey_(sessionId));
  }
  return true;
}

function getAccountPreferences() {
  return readUserPreferenceObject_();
}

function setAccountPreferences(preferenceObject) {
  setPreferences(preferenceObject || {});
  return getAccountPreferences();
}

function saveSidebarSessionAsAccountDefaults(sessionId) {
  const sessionState = getSidebarSessionState(sessionId);
  setPreferences(sessionState || {});
  clearSidebarSessionState(sessionId);
  return getAccountPreferences();
}

function getPreferences() {
  return getAccountPreferences();
}

function setPreferences(preferenceObject) {
  const userProperties = PropertiesService.getUserProperties();
  for (const property in (preferenceObject || {})) {
    try {
      userProperties.setProperty(property, preferenceObject[property]);
    } catch (error) {
      Logger.log(`The system has made a mach'ah: ${error.message}`);
    }
  }
  return getAccountPreferences();
}

function getTypographySettings() {
  const userProperties = PropertiesService.getUserProperties();
  return {
    hebrewFont: userProperties.getProperty("hebrew_font") || "Noto Sans Hebrew",
    hebrewFontSize: Number(userProperties.getProperty("hebrew_font_size") || 18),
    hebrewFontStyle: userProperties.getProperty("hebrew_font_style") || "normal",
    translationFont: userProperties.getProperty("translation_font") || "Noto Sans Hebrew",
    translationFontSize: Number(userProperties.getProperty("translation_font_size") || 12),
    translationFontStyle: userProperties.getProperty("translation_font_style") || "normal",
    transliterationFont: userProperties.getProperty("transliteration_font") || "Noto Sans Hebrew",
    transliterationFontSize: Number(userProperties.getProperty("transliteration_font_size") || 12),
    transliterationFontStyle: userProperties.getProperty("transliteration_font_style") || "italic",
    sourceTitleFont: userProperties.getProperty("source_title_font") || "Noto Sans Hebrew",
    sourceTitleFontSize: Number(userProperties.getProperty("source_title_font_size") || 14),
    sourceTitleFontStyle: userProperties.getProperty("source_title_font_style") || "normal",
    sefariaLinkFont: userProperties.getProperty("sefaria_link_font") || "Noto Sans Hebrew",
    sefariaLinkFontSize: Number(userProperties.getProperty("sefaria_link_font_size") || 14),
    sefariaLinkFontStyle: userProperties.getProperty("sefaria_link_font_style") || "underline"
  };
}
