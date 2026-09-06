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
  "link_sources_insert_after_linking",
  "linker_scan_mode",
  "show_line_markers_default",
  "preserve_source_emphasis",
  "hebrew_font_color",
  "hebrew_font_background",
  "translation_font_color",
  "translation_font_background",
  "transliteration_font_color",
  "transliteration_font_background",
  "source_title_font_color",
  "source_title_font_background",
  "sefaria_link_font_color",
  "sefaria_link_font_background",
  "emphasis_bold_style",
  "emphasis_bold_color",
  "emphasis_bold_background",
  "emphasis_bold_font",
  "emphasis_italic_style",
  "emphasis_italic_color",
  "emphasis_italic_background",
  "emphasis_italic_font",
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
  "search_mode",
  "insert_from_selection_at_top"
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
    // "candidates": only windows that look like they could hold a reference
    // are uploaded to /api/find-refs. "full": the entire document body is
    // uploaded, which is what this feature originally did.
    linker_scan_mode: "candidates",
    link_sources_insert_after_linking: false,
    show_line_markers_default: true,
    // Sefaria marks up its own emphasis (the Steinsaltz Talmud bolds the Talmud's
    // words against Steinsaltz's interpolation). Default ON: the source knows
    // what it meant, and the font-style preference still sets the baseline.
    preserve_source_emphasis: true,
    // Colour and background are intentionally EMPTY by default: an empty
    // value means "leave the document's own formatting alone". Defaulting to
    // "#000000" would force black text on every user, including those with a
    // dark or themed document.
    hebrew_font_color: "",
    hebrew_font_background: "",
    translation_font_color: "",
    translation_font_background: "",
    transliteration_font_color: "",
    transliteration_font_background: "",
    source_title_font_color: "",
    source_title_font_background: "",
    sefaria_link_font_color: "",
    sefaria_link_font_background: "",
    // How the source's own emphasis is rendered. Identity by default: bold
    // stays bold, italic stays italic. Changing these lets a user map, say,
    // Steinsaltz's bolding to a colour instead, so the inserted passage
    // matches their own document conventions.
    emphasis_bold_style: "bold",
    emphasis_bold_color: "",
    emphasis_bold_background: "",
    emphasis_bold_font: "",
    emphasis_italic_style: "italic",
    emphasis_italic_color: "",
    emphasis_italic_background: "",
    emphasis_italic_font: "",
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
    experimental_features_enabled: false,
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
    search_mode: "texts",
    insert_from_selection_at_top: false
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

/**
 * Normalize a stored colour preference into something Docs will accept.
 * Empty / malformed values return null, which every caller treats as
 * "don't touch the existing colour".
 */
function normalizeDocsColor_(value) {
  var raw = String(value == null ? '' : value).trim();
  if (!raw) return null;
  if (/^#[0-9a-fA-F]{6}$/.test(raw)) return raw.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(raw)) {
    return ('#' + raw[1] + raw[1] + raw[2] + raw[2] + raw[3] + raw[3]).toLowerCase();
  }
  return null;
}

function readTypographyRole_(userProperties, prefix, fallbackFont, fallbackSize, fallbackStyle) {
  return {
    font: userProperties.getProperty(prefix + "_font") || fallbackFont,
    size: Number(userProperties.getProperty(prefix + "_font_size") || fallbackSize),
    style: userProperties.getProperty(prefix + "_font_style") || fallbackStyle,
    color: normalizeDocsColor_(userProperties.getProperty(prefix + "_font_color")),
    background: normalizeDocsColor_(userProperties.getProperty(prefix + "_font_background"))
  };
}

/**
 * How one channel of the source's own emphasis should be rendered.
 * `style` reuses the comma-separated flag idiom of the other style prefs;
 * "none" means "drop this emphasis entirely".
 */
function readEmphasisMapping_(userProperties, prefix, fallbackStyle) {
  var style = userProperties.getProperty(prefix + "_style");
  return {
    style: (style === null || style === undefined) ? fallbackStyle : style,
    color: normalizeDocsColor_(userProperties.getProperty(prefix + "_color")),
    background: normalizeDocsColor_(userProperties.getProperty(prefix + "_background")),
    font: String(userProperties.getProperty(prefix + "_font") || '').trim()
  };
}

function getTypographySettings() {
  const userProperties = PropertiesService.getUserProperties();

  const roles = {
    hebrew:          readTypographyRole_(userProperties, "hebrew", "Noto Sans Hebrew", 18, "normal"),
    translation:     readTypographyRole_(userProperties, "translation", "Noto Sans Hebrew", 12, "normal"),
    transliteration: readTypographyRole_(userProperties, "transliteration", "Noto Sans Hebrew", 12, "italic"),
    sourceTitle:     readTypographyRole_(userProperties, "source_title", "Noto Sans Hebrew", 14, "normal"),
    sefariaLink:     readTypographyRole_(userProperties, "sefaria_link", "Noto Sans Hebrew", 14, "underline")
  };

  return {
    roles: roles,

    // Flat aliases kept for the existing call sites. `roles` is the shape new
    // code should read; these mirror it so nothing had to change at once.
    hebrewFont: roles.hebrew.font,
    hebrewFontSize: roles.hebrew.size,
    hebrewFontStyle: roles.hebrew.style,
    translationFont: roles.translation.font,
    translationFontSize: roles.translation.size,
    translationFontStyle: roles.translation.style,
    transliterationFont: roles.transliteration.font,
    transliterationFontSize: roles.transliteration.size,
    transliterationFontStyle: roles.transliteration.style,
    sourceTitleFont: roles.sourceTitle.font,
    sourceTitleFontSize: roles.sourceTitle.size,
    sourceTitleFontStyle: roles.sourceTitle.style,
    sefariaLinkFont: roles.sefariaLink.font,
    sefariaLinkFontSize: roles.sefariaLink.size,
    sefariaLinkFontStyle: roles.sefariaLink.style,

    preserveSourceEmphasis: userProperties.getProperty("preserve_source_emphasis") !== "false",
    emphasisMap: {
      bold: readEmphasisMapping_(userProperties, "emphasis_bold", "bold"),
      italic: readEmphasisMapping_(userProperties, "emphasis_italic", "italic")
    }
  };
}

