/*
Copyright 2014-2024 Shlomi Helfgot
Modifications copyright 2026 Austin Swafford
Licensed under the MIT License. See repository LICENSE.md.
כל המביא דבר בשם אומרו מביא גאולה לעולם
*/

// Menu wiring, sidebar/dialog openers, and UI popups. Simple-trigger
// entry points (onInstall, onOpen) live in apps-script/triggers.gs at the
// project root — see that file's header comment for the deployment reason.
// All server functions reachable from the client via google.script.run that
// open a UI surface live here. Pure domain logic lives in sibling files
// under apps-script/server/.

function buildAndInstallMenu() {
  const ui = DocumentApp.getUi();
  const addOnMenu = ui.createAddonMenu();
  const quickActionsMenu = ui.createMenu('Quick Actions')
      .addItem('Transform Divine Names', 'transformDivineNames')
      .addItem('Link Texts with Sefaria', 'linkTextsWithSefaria')
      .addSeparator()
      .addItem('Gematriya Count', 'gematriyaCountPopup');

  const prefs = getPreferences();
  const surpriseEnabled = prefs.surprise_me_enabled == "true";

  addOnMenu
      .addItem('Texts', 'textsHTML')
      .addItem('Voices', 'voicesHTML')
      .addItem('Lexicon', 'lexiconHTML')
      .addSubMenu(quickActionsMenu);

  if (DEV_FLAGS.SURPRISE_ME && surpriseEnabled) {
    addOnMenu.addSeparator().addItem('Surprise Me', 'surpriseMeHTML');
  }

  addOnMenu
      .addSeparator()
      .addItem('Preferences', 'preferencesPopup')
      .addItem('Help & Support', 'openHelpModal')
      .addToUi();
}

function setSearchMode_(mode) {
  const normalizedMode = (mode === 'voices' || mode === 'experimental' || mode === 'lexicon') ? mode : 'texts';
  PropertiesService.getUserProperties().setProperty('search_mode', normalizedMode);
  return normalizedMode;
}

function getSearchMode_() {
  const stored = PropertiesService.getUserProperties().getProperty('search_mode');
  return (stored === 'voices' || stored === 'experimental' || stored === 'lexicon') ? stored : 'texts';
}

function openSharedSidebar_(mode) {
  var resolvedMode = setSearchMode_(mode || getSearchMode_());
  var template = HtmlService.createTemplateFromFile('sidebar');
  template.initialMode = resolvedMode;
  template.appConfigJson = JSON.stringify(getUiAppConfig_('sidebar', resolvedMode));
  var output = template.evaluate()
    .setTitle('Sefaria')
    .setWidth(300);
  DocumentApp.getUi().showSidebar(output);
}

function textsHTML() {
  openSharedSidebar_('texts');
}

/**
 * Re-open the main sidebar after a preference change from the preferences
 * dialog. Reopening (rather than trying to mutate the live sidebar) gives
 * the caller a guaranteed-fresh session: the new sidebar's bootstrap gets
 * a fresh `sessionId`, so any `CacheService`-stored "sidebar-only" session
 * overrides from the previous session become unreachable (they time out on
 * their own TTL). Called from the "Refresh Sidebar" button in
 * apps-script/preferences/js.html. See docs/regression-log.md for the
 * silent-no-op bug this replaces.
 */
function refreshSidebarAfterPreferences() {
  openSharedSidebar_();
  return true;
}

function voicesHTML() {
  openSharedSidebar_('voices');
}

function lexiconHTML() {
  openSharedSidebar_('lexicon');
}

function getSidebarBootstrapData(mode, sessionId) {
  runUserPreferenceMigrationsIfNeeded_();
  const accountPreferences = getAccountPreferences();
  const resolvedMode = (mode === 'voices' || mode === 'experimental' || mode === 'texts' || mode === 'lexicon') ? mode : getSearchMode_();
  const resolvedSessionId = sessionId || generateSidebarSessionId_();
  const sessionState = resolvedMode === 'texts' ? getSidebarSessionState(resolvedSessionId) : {};
  const effectivePreferences = Object.assign({}, accountPreferences, sessionState);
  return {
    mode: resolvedMode,
    sessionId: resolvedSessionId,
    accountPreferences: accountPreferences,
    sessionState: sessionState,
    effectivePreferences: effectivePreferences,
    preferences: effectivePreferences
  };
}

function openHelpModal() {
  const html = HtmlService.createHtmlOutputFromFile('help-modal')
      .setWidth(760)
      .setHeight(860);
  DocumentApp.getUi().showModalDialog(html, 'Help & Support');
}

function openFeedbackModal() {
  const html = HtmlService.createHtmlOutputFromFile('feedback-modal')
      .setWidth(760)
      .setHeight(860);
  DocumentApp.getUi().showModalDialog(html, 'Feedback');
}

function releaseNotesPopup() {
  var html = HtmlService.createHtmlOutputFromFile('release-notes')
    .setWidth(700)
    .setHeight(700);
  SpreadsheetApp.getUi().showModalDialog(html, 'Release Notes');
}

function gematriyaCountPopup() {
  let stats;
  try {
    stats = getGematriyaStats_();
  } catch (error) {
    stats = {
      hasSelection: false,
      totalValue: 0,
      wordCount: 0,
      letterCount: 0,
      words: []
    };
    Logger.log('Error in gematriyaCountPopup: ' + error.message);
  }
  const template = HtmlService.createTemplateFromFile('gematriya-count');
  template.statsJson = JSON.stringify(stats);
  const html = template.evaluate().setWidth(480).setHeight(420);
  DocumentApp.getUi().showModalDialog(html, 'Gematriya Count');
}

function getGematriyaStats_() {
  const FINAL_FORMS = { 'ך': 'כ', 'ם': 'מ', 'ן': 'נ', 'ף': 'פ', 'ץ': 'צ' };
  const LETTER_VALUES = {
    'א':1,'ב':2,'ג':3,'ד':4,'ה':5,'ו':6,'ז':7,'ח':8,'ט':9,
    'י':10,'כ':20,'ל':30,'מ':40,'נ':50,'ס':60,'ע':70,'פ':80,'צ':90,
    'ק':100,'ר':200,'ש':300,'ת':400
  };

  const doc = DocumentApp.getActiveDocument();
  const selection = doc.getSelection();
  let rawText = '';
  let hasSelection = false;

  if (selection) {
    hasSelection = true;
    const elements = selection.getRangeElements();
    for (const elem of elements) {
      const el = elem.getElement();
      if (el.getType() === DocumentApp.ElementType.TEXT) {
        const textEl = el.asText();
        if (elem.isPartial()) {
          rawText += textEl.getText().substring(
            elem.getStartOffset(), elem.getEndOffsetInclusive() + 1
          );
        } else {
          rawText += textEl.getText();
        }
      }
    }
  } else {
    rawText = doc.getBody().getText();
  }

  // Normalize final forms and keep only base letters + whitespace
  let normalized = '';
  for (const char of rawText) {
    const base = FINAL_FORMS[char] || char;
    if (LETTER_VALUES[base] !== undefined) {
      normalized += base;
    } else if (/\s/.test(char)) {
      normalized += ' ';
    }
  }

  const words = normalized.trim().split(/\s+/).filter(w => w.length > 0);
  let totalValue = 0;
  let totalLetters = 0;
  const wordData = [];

  for (const word of words) {
    let wordValue = 0;
    for (const char of word) {
      wordValue += (LETTER_VALUES[char] || 0);
    }
    totalValue += wordValue;
    totalLetters += word.length;
    if (words.length <= 50) {
      wordData.push({ word, value: wordValue });
    }
  }

  return {
    hasSelection,
    totalValue,
    wordCount: words.length,
    letterCount: totalLetters,
    words: wordData
  };
}

function sefariaSearch() {
  textsHTML();
}

function preferencesPopup() {
  const template = HtmlService.createTemplateFromFile('preferences');
  template.appConfigJson = JSON.stringify(getUiAppConfig_('preferences', 'preferences'));
  template.devFlagsJson = JSON.stringify(DEV_FLAGS);
  const output = template.evaluate()
    .setTitle('Preferences')
    .setWidth(600)
    .setHeight(760);
  DocumentApp.getUi().showModalDialog(output, 'Preferences');
}

function sessionLibraryPopup(sessionDataJson) {
  PropertiesService.getUserProperties().deleteProperty('SL_DIALOG_ACTION');
  let parsed;
  try { parsed = JSON.parse(sessionDataJson); } catch(e) { parsed = { pinned: [], inserted: [] }; }
  if (!parsed || typeof parsed !== 'object') parsed = { pinned: [], inserted: [] };
  if (!Array.isArray(parsed.pinned)) parsed.pinned = [];
  if (!Array.isArray(parsed.inserted)) parsed.inserted = [];
  const template = HtmlService.createTemplateFromFile('session-library-modal');
  template.sessionDataJson = JSON.stringify(parsed);
  const html = template.evaluate().setWidth(680).setHeight(640);
  DocumentApp.getUi().showModalDialog(html, 'Session Library');
}

function saveSessionLibraryAction(actionJson) {
  try {
    PropertiesService.getUserProperties().setProperty('SL_DIALOG_ACTION', String(actionJson || ''));
  } catch(e) {}
}

function checkSessionLibraryAction() {
  try {
    const props = PropertiesService.getUserProperties();
    const val = props.getProperty('SL_DIALOG_ACTION');
    if (!val) return null;
    const action = JSON.parse(val);
    if (action && action.closed) {
      props.deleteProperty('SL_DIALOG_ACTION');
      return action;
    }
    return null;
  } catch(e) {
    return null;
  }
}

function divineNamePopup() {
  transformDivineNames();
}

function linkerHTML() {
  linkTextsWithSefaria();
}
