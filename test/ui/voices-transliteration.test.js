// Pins the Voices transliteration menu (sidebar; Preferences → Insertion →
// Voices). Its options share the composition card's option class, and the
// card bound its click to every `.cc-translit-option` on the page: choosing a
// Voices transliteration silently changed the Texts transliteration instead,
// and the card then marked its own scheme as selected in the Voices menu. The
// sidebar's own handler listened for a class no option had, so the Voices
// button never changed. The card now reaches only its own menu, and the
// Voices choice is drawn at once: the button, a sample in the inserted form
// (the Hebrew, then its transliteration in parentheses) and the summary line.

const test = require('node:test');
const assert = require('node:assert/strict');

const { readAppScriptFile } = require('./test-utils');

const CARD = readAppScriptFile('shared/composition-card/shared.html');
const SIDEBAR = readAppScriptFile('sidebar.html');
const CONTROLLER = readAppScriptFile('sidebar/js/search-controller.html');
const PREFS_STATE = readAppScriptFile('sidebar/js/preferences-state.html');
const FOOTER = readAppScriptFile('sidebar/js/footer-actions.html');

test('the composition card reaches only its own transliteration menu', () => {
  const bare = CARD.match(/\$\('\.cc-translit-option'\)/g) || [];
  assert.equal(bare.length, 0, "the card must not select every '.cc-translit-option' on the page");
  assert.match(CARD, /\$\('#cc-translit-menu \.cc-translit-option'\)\.off\('click\.cc'\)\.on\('click\.cc'/);
  assert.match(CARD, /\$\('#cc-translit-menu \.cc-translit-option'\)\.each\(/);
});

test('every sidebar Voices option carries the class its handler listens for', () => {
  const menu = SIDEBAR.match(/<div class="cc-translit-menu hidden" id="voices-translit-menu"[\s\S]*?<\/div>/)[0];
  const options = menu.match(/<button [^>]*>/g);
  assert.equal(options.length, 8);
  options.forEach((button) => assert.match(button, /class="cc-translit-option voices-translit-option/, button));
  assert.match(CONTROLLER, /\$\(document\)\.on\('click', '#voices-translit-menu \.voices-translit-option'/);
});

test('a Voices choice is shown at once: button, sample in parentheses, summary', () => {
  assert.match(SIDEBAR, /id="voices-translit-sample"[^>]*hidden/);
  assert.match(SIDEBAR, /id="voices-translit-sample-latin"/);
  const sync = CONTROLLER.match(/function syncVoicesTransliterationUi\(value\) \{[\s\S]*?\n\}/)[0];
  assert.match(sync, /#voices-translit-trigger/);
  assert.match(sync, /'\(' \+ sample \+ '\)'/);
  assert.match(sync, /#voices-translit-sample'\)\.prop\('hidden', !sample\)/);
  assert.match(sync, /\.voices-insertion-summary/);
  // The click, the insert-mode cards and the saved default all draw it.
  const click = CONTROLLER.match(/voices-translit-option', function \(\) \{[\s\S]*?\n\}\);/)[0];
  assert.match(click, /syncVoicesTransliterationUi\(value\);[\s\S]*?setAccountPreferences\(\{ voices_translit_default: value \}\)/);
  // Saving must not redraw the sidebar from the stored defaults: that reset
  // "What to insert" to its saved default as a transliteration was chosen.
  assert.doesNotMatch(click, /saveAccountPreference\(|applyEffectivePreferencesToUI/);
  assert.match(CONTROLLER, /#voices-insert-mode \.icon-mode-card', function \(\) \{[\s\S]*?syncVoicesTransliterationUi\(/);
  assert.match(PREFS_STATE, /syncVoicesTransliterationUi\(preferences\.voices_translit_default \|\| 'none'\)/);
  // The insert sends what the menu shows.
  assert.match(FOOTER, /var transliterationScheme = selectedVoicesTransliteration\(\);/);
});
