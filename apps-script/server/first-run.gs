/*
Copyright 2026 Austin Swafford
Licensed under the MIT License. See repository LICENSE.md.
*/

// First-run setup and the Simple / Full interface mode.
// Design: docs/first-run-setup-design.md.
//
// Setup is a dialog (first-run-setup.html) shown once to a user whose
// `first_run_setup` preference is "pending": a new install, or a user of the
// original published add-on (which stored no preferences, so the two look the
// same). It writes ordinary preference values; no "tier" is stored anywhere.
//
// The pure helpers (firstRunAnswersFromPreferences_, planFirstRunPreferences_,
// planUiModeSwitch_, getSimpleMenuLayout_) take plain objects so the Node
// tests can load this file with menu-layout.gs alone. Everything that touches
// PropertiesService, HtmlService or DocumentApp is below them.

// The menu in Simple mode: the default layout with everything but Texts,
// Insert Source from Selection, Transform Divine Names and Link Texts hidden.
// Hidden, not removed, so switching an item back on in the Menu Bar tab puts
// it back where it always was.
var SIMPLE_MENU_HIDDEN_ = ['voices', 'lexicon', 'quick_actions_sidebar', 'unlink_sources', 'gematriya_count', 'surprise_me'];

// The divine-name rows setup asks about, in the order the dialog shows them.
var FIRST_RUN_DIVINE_NAMES_ = [
  { id: 'meforash', on: 'meforash_replace', text: 'meforash_replacement' },
  { id: 'elodim', on: 'elodim_replace', text: 'elodim_replacement' },
  { id: 'yaw', on: 'yaw_replace', text: 'yaw_replacement' },
  { id: 'god', on: 'god_replace', text: 'god_replacement' }
];

var FIRST_RUN_SHOW_VALUES_ = ['both', 'he', 'en'];
var FIRST_RUN_ARRANGEMENT_VALUES_ = ['he-right', 'he-left', 'he-top'];
var FIRST_RUN_VOWEL_VALUES_ = ['always', 'tanakh', 'never'];
var FIRST_RUN_UI_MODES_ = ['simple', 'full'];
// Same bound as the Preferences replacement fields' maxlength.
var FIRST_RUN_REPLACEMENT_MAX_CHARS_ = 20;

function getSimpleMenuLayout_() {
  var layout = getDefaultMenuLayout_();
  layout.hidden = SIMPLE_MENU_HIDDEN_.slice();
  return layout;
}

function getSimpleMenuLayoutJson_() {
  return JSON.stringify(getSimpleMenuLayout_());
}

function normalizeUiMode_(value) {
  return value === 'simple' ? 'simple' : 'full';
}

/**
 * The answers setup preselects, read from stored preference values (strings,
 * as UserProperties returns them). A divine name counts as on only when the
 * master switch `apply_sheimot_on_insertion` is on too, because that is what
 * an insert does.
 */
function firstRunAnswersFromPreferences_(prefs) {
  var p = prefs || {};
  var vowels = 'always';
  if (p.nekudot === 'false') vowels = 'never';
  else if (p.nekudot_filter === 'tanakh') vowels = 'tanakh';
  else if (p.nekudot_filter === 'never' || p.nekudot_filter === 'false') vowels = 'never';

  var namesOn = p.apply_sheimot_on_insertion !== 'false';
  var divine = {};
  FIRST_RUN_DIVINE_NAMES_.forEach(function (name) {
    divine[name.id] = {
      on: namesOn && p[name.on] === 'true',
      text: String(p[name.text] == null ? '' : p[name.text])
    };
  });

  return {
    show: FIRST_RUN_SHOW_VALUES_.indexOf(p.output_mode_default) >= 0 ? p.output_mode_default : 'both',
    arrangement: FIRST_RUN_ARRANGEMENT_VALUES_.indexOf(p.bilingual_layout_default) >= 0 ? p.bilingual_layout_default : 'he-right',
    vowels: vowels,
    teamim: p.teamim !== 'false',
    divine: divine,
    language: String(p.preferred_translation_language || 'en'),
    uiMode: normalizeUiMode_(p.ui_mode)
  };
}

/**
 * Turn setup answers into the preference writes they imply, given what is
 * stored now. Only keys whose value would change are returned, so clicking
 * through setup with the preselected answers writes nothing. An answer that is
 * missing or not one the dialog can produce is ignored, never stored.
 *
 * @param {Object} answers  from the dialog (untrusted)
 * @param {Object} prefs    stored preference values (strings)
 * @return {{changes: Object<string,string>, uiMode: ?string}} `uiMode` is
 *   the mode to switch to, or null to leave it; it is applied separately
 *   because switching also moves the menu (planUiModeSwitch_).
 */
function planFirstRunPreferences_(answers, prefs) {
  var a = (answers && typeof answers === 'object') ? answers : {};
  var p = prefs || {};
  var changes = {};
  function set(key, value) {
    if (String(p[key]) !== value) changes[key] = value;
  }

  if (FIRST_RUN_SHOW_VALUES_.indexOf(a.show) >= 0) set('output_mode_default', a.show);
  if (FIRST_RUN_ARRANGEMENT_VALUES_.indexOf(a.arrangement) >= 0) set('bilingual_layout_default', a.arrangement);

  if (FIRST_RUN_VOWEL_VALUES_.indexOf(a.vowels) >= 0) {
    var current = firstRunAnswersFromPreferences_(p).vowels;
    if (a.vowels !== current) {
      // The same pair the Preferences Vowels control writes.
      if (a.vowels === 'never') {
        set('nekudot', 'false');
        set('nekudot_filter', 'false');
      } else {
        set('nekudot', 'true');
        set('nekudot_filter', a.vowels);
      }
    }
  }

  if (typeof a.teamim === 'boolean') set('teamim', a.teamim ? 'true' : 'false');

  if (a.divine && typeof a.divine === 'object') {
    var namesOn = p.apply_sheimot_on_insertion !== 'false';
    FIRST_RUN_DIVINE_NAMES_.forEach(function (name) {
      var answer = a.divine[name.id];
      if (!answer || typeof answer !== 'object') return;
      if (typeof answer.text === 'string') {
        var text = answer.text.trim();
        if (text && text.length <= FIRST_RUN_REPLACEMENT_MAX_CHARS_) set(name.text, text);
      }
      if (typeof answer.on !== 'boolean') return;
      var effective = namesOn && p[name.on] === 'true';
      if (answer.on === effective) return;
      changes[name.on] = answer.on ? 'true' : 'false';
      if (answer.on && !namesOn) changes.apply_sheimot_on_insertion = 'true';
    });
  }

  if (typeof a.language === 'string' && /^[a-z]{2,3}$/.test(a.language)) set('preferred_translation_language', a.language);

  var uiMode = FIRST_RUN_UI_MODES_.indexOf(a.uiMode) >= 0 ? a.uiMode : null;
  return { changes: changes, uiMode: uiMode };
}

function menuLayoutsEqual_(a, b) {
  return JSON.stringify(normalizeMenuLayout_(a)) === JSON.stringify(normalizeMenuLayout_(b));
}

/**
 * What switching the interface mode writes.
 *
 * To Simple: the user's own menu layout (if any) is kept aside in
 * `menu_layout_before_simple` and the Simple layout is written.
 * To Full: if the menu is still the Simple layout, the kept layout comes back
 * (none kept: `menu_layout` is removed, which tracks the code default). If the
 * user rearranged the menu while in Simple mode, their arrangement stays and
 * `menuKept` says so.
 *
 * @param {string} target  "simple" or "full"
 * @param {{ui_mode: ?string, menu_layout: ?string, menu_layout_before_simple: ?string}} stored
 * @return {{set: Object<string,string>, remove: string[], menuKept: boolean}}
 */
function planUiModeSwitch_(target, stored) {
  var s = stored || {};
  var mode = normalizeUiMode_(target);
  var plan = { set: {}, remove: [], menuKept: false };
  if (mode === normalizeUiMode_(s.ui_mode)) return plan;

  plan.set.ui_mode = mode;
  if (mode === 'simple') {
    plan.set.menu_layout_before_simple = s.menu_layout == null ? '' : String(s.menu_layout);
    plan.set.menu_layout = getSimpleMenuLayoutJson_();
    return plan;
  }

  if (s.menu_layout != null && !menuLayoutsEqual_(s.menu_layout, getSimpleMenuLayout_())) {
    plan.menuKept = true;
  } else if (s.menu_layout_before_simple) {
    plan.set.menu_layout = String(s.menu_layout_before_simple);
  } else {
    plan.remove.push('menu_layout');
  }
  plan.set.menu_layout_before_simple = '';
  return plan;
}

// ── Apps Script side ──────────────────────────────────────────────────────

function getUiMode_() {
  try {
    return normalizeUiMode_(PropertiesService.getUserProperties().getProperty('ui_mode'));
  } catch (error) {
    return 'full';
  }
}

/**
 * True while the user has neither finished nor dismissed setup. Runs the
 * migrations first: in a document where onOpen ran without access to
 * preferences, an upgrader's v20 migration (which marks setup done) may not
 * have run yet. A missing value is never "pending".
 */
function isFirstRunSetupPending_() {
  try {
    runUserPreferenceMigrationsIfNeeded_();
  } catch (error) {
    Logger.log(`Preference migration failed before the first-run check: ${error.message}`);
  }
  return PropertiesService.getUserProperties().getProperty('first_run_setup') === 'pending';
}

function readStoredPreferences_(keys) {
  var userProperties = PropertiesService.getUserProperties();
  var out = {};
  keys.forEach(function (key) { out[key] = userProperties.getProperty(key); });
  return out;
}

function firstRunPreferenceKeys_() {
  var keys = ['output_mode_default', 'bilingual_layout_default', 'nekudot', 'nekudot_filter', 'teamim',
    'apply_sheimot_on_insertion', 'preferred_translation_language', 'ui_mode'];
  FIRST_RUN_DIVINE_NAMES_.forEach(function (name) { keys.push(name.on, name.text); });
  return keys;
}

function applyUiModeSwitch_(target) {
  var userProperties = PropertiesService.getUserProperties();
  var plan = planUiModeSwitch_(target, readStoredPreferences_(['ui_mode', 'menu_layout', 'menu_layout_before_simple']));
  Object.keys(plan.set).forEach(function (key) { userProperties.setProperty(key, plan.set[key]); });
  plan.remove.forEach(function (key) { userProperties.deleteProperty(key); });
  return plan;
}

function rebuildMenuQuietly_() {
  try {
    buildAndInstallMenu();
  } catch (error) {
    Logger.log(`Menu rebuild failed after an interface change: ${error.message}`);
  }
}

function showFirstRunSetup_() {
  var template = HtmlService.createTemplateFromFile('first-run-setup');
  template.appConfigJson = toEmbeddedJson_(getUiAppConfig_('first-run-setup', 'setup', {
    answers: firstRunAnswersFromPreferences_(readStoredPreferences_(firstRunPreferenceKeys_()))
  }));
  var output = template.evaluate()
    .setWidth(640)
    .setHeight(680);
  DocumentApp.getUi().showModalDialog(output, 'Welcome to Torah Library');
}

/**
 * Show setup if it is pending, and mark it done once it is on screen. Google's
 * dialog close button gives the page no callback, so closing the dialog cannot
 * be told apart from never answering: either way nothing is changed, the user
 * keeps Full mode, and setup does not come back on its own (Help → "Run setup
 * again" reopens it). Returns whether it was shown.
 */
function maybeShowFirstRunSetup_() {
  if (!isFirstRunSetupPending_()) return false;
  showFirstRunSetup_();
  PropertiesService.getUserProperties().setProperty('first_run_setup', 'done');
  return true;
}

/** Help → "Run setup again". */
function openFirstRunSetup() {
  showFirstRunSetup_();
}

/**
 * Save the answers from the setup dialog and mark setup done.
 * @param {string} answersJson  JSON of the answers (see planFirstRunPreferences_)
 * @return {{uiMode: string}}
 */
function completeFirstRunSetup(answersJson) {
  var answers = {};
  try {
    answers = typeof answersJson === 'string' ? JSON.parse(answersJson) : (answersJson || {});
  } catch (error) {
    answers = {};
  }
  var userProperties = PropertiesService.getUserProperties();
  var plan = planFirstRunPreferences_(answers, readStoredPreferences_(firstRunPreferenceKeys_()));
  Object.keys(plan.changes).forEach(function (key) { userProperties.setProperty(key, plan.changes[key]); });
  if (plan.uiMode) applyUiModeSwitch_(plan.uiMode);
  userProperties.setProperty('first_run_setup', 'done');
  rebuildMenuQuietly_();
  return { uiMode: getUiMode_() };
}

/**
 * The Interface switch in Preferences.
 * @param {string} mode  "simple" or "full"
 * @return {{uiMode: string, menuLayout: string, menuKept: boolean}}
 */
function setUiMode(mode) {
  var plan = applyUiModeSwitch_(FIRST_RUN_UI_MODES_.indexOf(mode) >= 0 ? mode : 'full');
  rebuildMenuQuietly_();
  return {
    uiMode: getUiMode_(),
    menuLayout: PropertiesService.getUserProperties().getProperty('menu_layout') || '',
    menuKept: plan.menuKept
  };
}
