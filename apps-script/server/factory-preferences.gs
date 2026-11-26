// Factory preset from the supplied schema-33 export. Auto-Scale Hebrew
// was added in schema 34 and stays off in this preset.
const FACTORY_PREFERENCE_MODE_ = "simple";
const FACTORY_PREFERENCE_VALUES_ = Object.freeze({
  "apply_sheimot_on_insertion": "false",
  "elodim_replace": "false",
  "elodim_replacement": "אלוקים",
  "extended_gemara": "false",
  "god_replace": "false",
  "god_replacement": "G-d",
  "hebrew_font": "",
  "hebrew_font_size": "",
  "hebrew_font_style": "normal",
  "include_translation_source_info": "false",
  "include_transliteration_default": "false",
  "insert_citation_default": "false",
  "insert_sefaria_link_default": "false",
  "link_texts_default": "false",
  "link_sources_insert_after_linking": "false",
  "linker_scan_mode": "candidates",
  "linker_review_mode": "quiet",
  "show_line_markers_default": "false",
  "source_emphasis_mode": "keep",
  "source_notes_mode": "separate",
  "hebrew_font_color": "",
  "hebrew_font_background": "",
  "translation_font_color": "",
  "translation_font_background": "",
  "transliteration_font_color": "",
  "transliteration_font_background": "",
  "source_title_font_color": "",
  "source_title_font_background": "",
  "sefaria_link_font_color": "",
  "sefaria_link_font_background": "",
  "emphasis_bold_style": "bold",
  "emphasis_bold_color": "",
  "emphasis_bold_background": "",
  "emphasis_bold_font": "",
  "emphasis_italic_style": "italic",
  "emphasis_italic_color": "",
  "emphasis_italic_background": "",
  "emphasis_italic_font": "",
  "output_mode_default": "both",
  "bilingual_layout_default": "he-right",
  "bilingual_aligned_rows": "false",
  "search_corpus_order": "[\"close-matches\",\"tanakh\",\"mishnah\",\"talmud\",\"midrash\",\"halakhah\",\"kabbalah\",\"liturgy\",\"jewish-thought\",\"tosefta\",\"chasidut\",\"musar\",\"responsa\",\"second-temple\",\"commentary\",\"targum\",\"reference\"]",
  "search_corpus_excluded": "[]",
  "lexicon_dictionary_order": "[\"dictionary-klein\",\"dictionary-bdb\",\"dictionary-bdb-aramaic\",\"dictionary-jastrow\",\"dictionary-strongs\",\"dictionary-ben-yehuda\"]",
  "lexicon_dictionary_excluded": "[]",
  "voices_topic_order": "[\"topic-torah-portions\",\"topic-holidays\",\"topic-prayer\",\"topic-life-cycle\",\"topic-halakhah\",\"topic-tanakh\",\"topic-talmud\",\"topic-people\",\"topic-thought\",\"topic-values\",\"topic-israel\",\"topic-other\"]",
  "voices_topic_excluded": "[]",
  "hidden_translation_languages": "[]",
  "show_unavailable_translations": "false",
  "meforash_replace": "true",
  "meforash_replacement": "יי",
  "nekudot": "true",
  "nekudot_filter": "always",
  "experimental_features_enabled": "false",
  "surprise_me_enabled": "false",
  "teamim": "true",
  "teamim_filter": "available",
  "hebrew_punctuation": "true",
  "translation_punctuation": "true",
  "translation_font": "",
  "translation_font_size": "",
  "translation_font_style": "normal",
  "preferred_translation_language": "en",
  "translation_language_typography": "{}",
  "transliteration_font": "",
  "transliteration_font_size": "",
  "transliteration_font_style": "italic",
  "transliteration_scheme": "traditional",
  "transliteration_position": "below",
  "transliteration_overrides": "{}",
  "transliteration_is_biblical_hebrew": "true",
  "transliteration_biblical_dagesh_mode": "none",
  "transliteration_divine_name": "HaShem",
  "versioning": "true",
  "voices_insert_mode_default": "reference",
  "voices_translit_default": "none",
  "lexicon_insert_mode_default": "entry",
  "yaw_replace": "false",
  "yaw_replacement": "קה",
  "source_title_font": "",
  "source_title_font_size": "",
  "source_title_font_style": "normal",
  "source_title_heading": "normal",
  "sefaria_link_font": "",
  "sefaria_link_font_size": "",
  "sefaria_link_font_style": "underline",
  "insert_hebrew_sefaria_link_default": "false",
  "hebrew_title_font": "",
  "hebrew_title_font_size": "",
  "hebrew_title_font_style": "normal",
  "hebrew_title_font_color": "",
  "hebrew_title_font_background": "",
  "hebrew_link_font": "",
  "hebrew_link_font_size": "",
  "hebrew_link_font_style": "underline",
  "hebrew_link_font_color": "",
  "hebrew_link_font_background": "",
  "sefaria_link_format_override": "true",
  "hebrew_link_format_override": "true",
  "sefaria_link_edition_label": "true",
  "hebrew_link_edition_label": "true",
  "citation_font": "",
  "citation_font_size": "10",
  "citation_font_style": "italic",
  "citation_font_color": "",
  "citation_font_background": "",
  "show_voices_tab": "false",
  "show_lexicon_tab": "false",
  "sidebar_quick_actions_hidden": "[]",
  "sidebar_options_hidden": "[]",
  "menu_layout": "{\"top\":[\"texts\",\"voices\",\"lexicon\",\"insert_from_selection\",\"quick_actions\",\"-\",\"surprise_me\"],\"quick_actions\":[\"quick_actions_sidebar\",\"-\",\"transform_divine_names\",\"link_texts\",\"unlink_sources\",\"-\",\"gematriya_count\"],\"hidden\":[\"voices\",\"lexicon\",\"quick_actions_sidebar\",\"unlink_sources\",\"gematriya_count\",\"surprise_me\"]}",
  "insert_from_selection_replace": "true",
  "auto_scale_hebrew": "false"
});

function writeActiveProfileDefaults_(expectedProfile, values, preset) {
  const props = PropertiesService.getUserProperties();
  const active = publicProfileIndex_(readProfileIndex_(props.getProperty(SETTINGS_PROFILES_KEY_))).active;
  if (expectedProfile !== active) throw new Error('The active profile changed. Reopen Preferences before saving.');
  const defaults = getDefaultPreferences();
  const changes = {};
  const keys = preset === 'profile' ? settingsProfileKeys_() : settingsFileKeys_();
  const input = preset === 'profile' ? defaults : preset === 'factory' ? FACTORY_PREFERENCE_VALUES_ : values || {};
  keys.forEach(function (key) {
    if (!Object.prototype.hasOwnProperty.call(input, key)) return;
    if (!settingsFileValueOk_(key, input[key], defaults)) throw new Error('A preference has an invalid value: ' + key);
    changes[key] = String(input[key]);
  });
  if (preset === 'factory') {
    changes.ui_mode = FACTORY_PREFERENCE_MODE_;
    changes.menu_layout_before_simple = '';
  }
  props.setProperties(changes);
  rebuildMenuQuietly_();
  return { preferences: getAccountPreferences(), documentPreferences: getPreferences(), uiMode: getUiMode_() };
}

function savePreferenceDefaults(preferences, expectedProfile) {
  return writeActiveProfileDefaults_(expectedProfile, preferences, '');
}

function restorePreferencePreset(preset, expectedProfile) {
  if (preset !== 'profile' && preset !== 'factory') throw new Error('Unknown settings preset.');
  return writeActiveProfileDefaults_(expectedProfile, null, preset);
}
