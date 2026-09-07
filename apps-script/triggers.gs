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

/**
 * Fresh-install preference values that intentionally differ from
 * `getDefaultPreferences()`. Divine-name substitution ships ON for a new
 * install (see AGENTS.md hard rule #1 and docs/regression-log.md); the
 * unset-key fallback in `getDefaultPreferences()` stays `false` so that
 * flipping it here can never silently enable substitution for an existing
 * user who deliberately turned it off.
 */
function getFreshInstallPreferenceOverrides_() {
  return {
    apply_sheimot_on_insertion: true,
    meforash_replace: true
  };
}

function onInstall() {
  // Seed from the single source of truth rather than a second hand-maintained
  // literal. The previous copy had drifted from getDefaultPreferences(): it
  // omitted ~14 keys entirely and disagreed on the translation/transliteration
  // font sizes, so a fresh install and a reset-to-defaults produced different
  // documents.
  const initialPrefs = Object.assign(
    {},
    getDefaultPreferences(),
    getFreshInstallPreferenceOverrides_()
  );
  setPreferences(initialPrefs);

  // Stamp the schema version so a brand-new install does not re-run every
  // historical migration on its first onOpen.
  try {
    PropertiesService.getUserProperties().setProperty(PREFS_SCHEMA_KEY_, PREFS_SCHEMA_CURRENT_);
  } catch (error) {
    Logger.log(`Could not stamp preference schema version: ${error.message}`);
  }

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
        .addItem('Quick Actions Sidebar', 'quickActionsHTML')
        .addSeparator()
        .addItem('Transform Divine Names', 'transformDivineNames')
        .addItem('Link Texts with Sefaria', 'linkTextsWithSefaria')
        .addItem('Unlink Sources', 'unlinkSefariaSources')
        .addItem('Insert Source from Selection', 'insertSourceFromSelection')
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
