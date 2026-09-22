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
  "linker_review_mode",
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
  "source_title_heading",
  "sefaria_link_font",
  "sefaria_link_font_size",
  "sefaria_link_font_style",
  "search_mode",
  "menu_layout",
  "insert_from_selection_replace"
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
    // Font and size default to EMPTY for the passage roles (Hebrew,
    // translation, transliteration): "match the document" — take the font and
    // size of the text at the insertion point. Upgraders keep the fixed values
    // they had via migration v13. Titles keep a fixed default.
    hebrew_font: "",
    hebrew_font_size: "",
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
    // What happens after the scan finds citations.
    //   "summary" (default): a count of what will be linked, plus a panel to
    //                        resolve any citation that matched more than one
    //                        source. Nothing is silently skipped.
    //   "full":              every match listed for review before anything is
    //                        applied.
    //   "quiet":             link the unambiguous ones, report counts, skip the
    //                        rest without asking — closest to the published
    //                        add-on's behaviour.
    linker_review_mode: "summary",
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
    meforash_replacement: "יי",
    nekudot: true,
    nekudot_filter: "always",
    experimental_features_enabled: false,
    surprise_me_enabled: false,
    teamim: true,
    teamim_filter: "available",
    translation_font: "",
    translation_font_size: "",
    translation_font_style: "normal",
    transliteration_font: "",
    transliteration_font_size: "",
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
    // Paragraph style for inserted titles: "normal" or "heading1".."heading6".
    // "normal" is what titles have always been.
    source_title_heading: "normal",
    sefaria_link_font: "Noto Sans Hebrew",
    sefaria_link_font_size: 14,
    sefaria_link_font_style: "underline",
    search_mode: "texts",
    // Order and nesting of the add-on menu, edited from the Menu Bar tab. See
    // server/menu-layout.gs for the shape. Replaced `insert_from_selection_at_top`
    // in schema v10; the migration carries a pinned item over.
    menu_layout: getDefaultMenuLayoutJson_(),
    // Insert Source from Selection: true replaces the selected citation with
    // the inserted source (whose title is that same citation text); false
    // keeps the selection and inserts the source below it.
    insert_from_selection_replace: true
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

/**
 * An unset font/size falls back to the role default; a stored EMPTY value
 * means "match the document" and comes back as font "" / size null, which
 * getTypographySettings then fills from the text at the insertion point.
 */
function readTypographyRole_(userProperties, prefix, fallbackFont, fallbackSize, fallbackStyle) {
  const storedFont = userProperties.getProperty(prefix + "_font");
  const storedSize = userProperties.getProperty(prefix + "_font_size");
  const rawSize = storedSize == null ? fallbackSize : storedSize;
  const size = (rawSize == null || String(rawSize).trim() === "") ? NaN : Number(rawSize);
  return {
    font: String(storedFont == null ? fallbackFont : storedFont).trim(),
    size: size > 0 ? size : null,
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

var TITLE_HEADINGS_ = ["normal", "heading1", "heading2", "heading3", "heading4", "heading5", "heading6"];

function normalizeTitleHeading_(value) {
  const v = String(value == null ? "" : value).trim().toLowerCase();
  return TITLE_HEADINGS_.indexOf(v) >= 0 ? v : "normal";
}

function isTitleRole_(roleName) {
  return roleName === "sourceTitle" || roleName === "sefariaLink";
}

/**
 * Roles that "match the document". A title with a heading style is left out:
 * there, an empty font/size means the heading's own look, which the paragraph
 * gets by not having one set at all.
 */
function rolesMatchingDocument_(roles, titleHeading) {
  return Object.keys(roles).filter(function (name) {
    const role = roles[name];
    if (!role || (role.font !== "" && role.size != null)) return false;
    return !(isTitleRole_(name) && titleHeading !== "normal");
  });
}

function typographyNeedsSurroundingText_(roles, titleHeading) {
  return rolesMatchingDocument_(roles, titleHeading).length > 0;
}

/**
 * Fill "match the document" font/size from the text at the insertion point.
 * Pure: `surrounding` is {font, size} (either may be empty/null — Docs reports
 * null when the text just follows the Normal text style). Whatever stays
 * empty is simply not applied, so the paragraph follows the document's
 * Normal text style.
 */
function fillTypographyFromSurroundingText_(roles, surrounding, titleHeading) {
  const font = surrounding && surrounding.font ? String(surrounding.font) : "";
  const size = surrounding && Number(surrounding.size) > 0 ? Number(surrounding.size) : null;
  rolesMatchingDocument_(roles, titleHeading).forEach(function (name) {
    const role = roles[name];
    if (role.font === "" && font) role.font = font;
    if (role.size == null && size) role.size = size;
  });
  return roles;
}

function getTypographySettings() {
  const userProperties = PropertiesService.getUserProperties();

  const roles = {
    hebrew:          readTypographyRole_(userProperties, "hebrew", "", null, "normal"),
    translation:     readTypographyRole_(userProperties, "translation", "", null, "normal"),
    transliteration: readTypographyRole_(userProperties, "transliteration", "", null, "italic"),
    sourceTitle:     readTypographyRole_(userProperties, "source_title", "Noto Sans Hebrew", 14, "normal"),
    sefariaLink:     readTypographyRole_(userProperties, "sefaria_link", "Noto Sans Hebrew", 14, "underline")
  };
  const titleHeading = normalizeTitleHeading_(userProperties.getProperty("source_title_heading"));

  if (typographyNeedsSurroundingText_(roles, titleHeading)) {
    let surrounding = null;
    try {
      surrounding = readSurroundingTextStyle_();
    } catch (error) {
      surrounding = null;
    }
    fillTypographyFromSurroundingText_(roles, surrounding, titleHeading);
  }

  return {
    roles: roles,
    titleHeading: titleHeading,

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

