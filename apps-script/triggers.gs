/*
Copyright 2014-2024 Shlomi Helfgot
Modifications copyright 2026 Austin Swafford
Licensed under the MIT License. See repository LICENSE.md.
*/

// Simple triggers MUST live in a top-level .gs file, not a subdirectory.
// Apps Script editor add-ons (manifest: addOns.docs) discover onInstall and
// onOpen reliably only from the project root: pushing them via clasp inside
// server/ produces filenames with a slash (e.g. "server/menu"), which Apps
// Script's editor UI and trigger registration treat as second-class. Keeping
// these two functions at apps-script/triggers.gs guarantees the add-on
// installs and opens cleanly. Domain logic lives in server/menu.gs; these
// are the thinnest possible entry points. See docs/regression-log.md.

function onInstall() {
  const initialPrefs = {
    "apply_sheimot_on_insertion": true,
    "elodim_replace": false,
    "extended_gemara": false,
    "god_replace": false,
    "god_replacement": "G-d",
    "preferred_translation_language": "en",
    "hebrew_font": "Noto Sans Hebrew",
    "hebrew_font_size": 18,
    "hebrew_font_style": "normal",
    "include_translation_source_info": false,
    "include_transliteration_default": false,
    "insert_sefaria_link_default": true,
    "show_line_markers_default": true,
    "output_mode_default": "both",
    "bilingual_layout_default": "he-right",
    "meforash_replace": true,
    "nekudot": true,
    "nekudot_filter": "always",
    "surprise_me_enabled": false,
    "teamim": true,
    "teamim_filter": "available",
    "translation_font": "Noto Sans Hebrew",
    "translation_font_size": 11,
    "translation_font_style": "normal",
    "transliteration_font": "Noto Sans Hebrew",
    "transliteration_font_size": 11,
    "transliteration_font_style": "italic",
    "transliteration_scheme": "traditional",
    "transliteration_overrides": "{}",
    "transliteration_is_biblical_hebrew": true,
    "transliteration_biblical_dagesh_mode": "none",
    "versioning": true,
    "voices_insert_mode_default": "reference",
    "voices_translit_default": "none",
    "lexicon_insert_mode_default": "entry",
    "yaw_replace": false,
    "search_mode": "texts"
  };
  setPreferences(initialPrefs);

  let html = HtmlService.createHtmlOutputFromFile('release-notes')
      .setWidth(720)
      .setHeight(760);
  DocumentApp.getUi().showModalDialog(html, 'Release Notes');
}

function onOpen(e) {
  // Per Google Workspace add-on guidance, avoid reading PropertiesService while
  // the add-on is still in AuthMode.NONE so the menu always renders.
  if (!e || e.authMode !== ScriptApp.AuthMode.NONE) {
    runUserPreferenceMigrationsIfNeeded_();
    buildAndInstallMenu();
  } else {
    // During AuthMode.NONE, create a minimal menu without reading preferences
    const ui = DocumentApp.getUi();
    const addOnMenu = ui.createAddonMenu();
    const quickActionsMenu = ui.createMenu('Quick Actions')
        .addItem('Transform Divine Names', 'transformDivineNames')
        .addItem('Link Texts with Sefaria', 'linkTextsWithSefaria')
        .addSeparator()
        .addItem('Gematriya Count', 'gematriyaCountPopup');

    addOnMenu
        .addItem('Texts', 'textsHTML')
        .addItem('Voices', 'voicesHTML')
        .addItem('Lexicon', 'lexiconHTML')
        .addSubMenu(quickActionsMenu)
        .addSeparator()
        .addItem('Preferences', 'preferencesPopup')
        .addItem('Help & Support', 'openHelpModal')
        .addToUi();
  }
}
