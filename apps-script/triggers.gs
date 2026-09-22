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
  // Save every default the user does not already have (a reinstall keeps the
  // user's own choices), then bring the schema up to date. Going through the
  // migration driver rather than stamping the current version directly means
  // a reinstall over an older schema still gets its pending migrations. See
  // seedDefaultPreferences_ in migrations.gs.
  try {
    seedDefaultPreferences_(PropertiesService.getUserProperties());
    runUserPreferenceMigrationsIfNeeded_();
  } catch (error) {
    Logger.log(`Could not seed preferences on install: ${error.message}`);
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
    // During AuthMode.NONE, build the default menu without reading preferences.
    // Surprise Me is omitted because whether it is enabled is itself a preference.
    installMenuPlan_(planMenuFromLayout_(getDefaultMenuLayout_(), { surpriseMeEnabled: false }));
  }
}
