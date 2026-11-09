// Pins Simple mode (docs/first-run-setup-design.md §6): it hides with CSS
// only, never removes, so the selector contracts and event bindings hold in
// both modes; everything it hides can be shown again; and every page that
// reads the mode is given it by the server.

const test = require('node:test');
const assert = require('node:assert/strict');

const { readAppScriptFile } = require('./test-utils');

const SIDEBAR = readAppScriptFile('sidebar.html');
const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/<\/?style>/g, '');
const SIMPLE_CSS = stripComments(readAppScriptFile('css/components/simple-mode.html'));
const PREFS = readAppScriptFile('preferences.html');
const PREFS_CSS = stripComments(readAppScriptFile('preferences/css.html'));
const MENU = readAppScriptFile('server/menu.gs');

function hiddenIds(css, scopeRe) {
  const ids = new Set();
  css.split('}').forEach((block) => {
    if (!/display:\s*none\s*!important/.test(block)) return;
    block.split('{')[0].split(',').forEach((selector) => {
      if (!scopeRe.test(selector)) return;
      const id = selector.match(/#([\w-]+)\s*$/);
      if (id) ids.add(id[1]);
    });
  });
  return [...ids];
}

test('the sidebar is told its mode by the server and includes the Simple-mode styles', () => {
  assert.match(SIDEBAR, /<main class="unified-sidebar"[^\n]*data-ui-mode="<\?= uiMode \?>"/);
  assert.ok(SIDEBAR.includes("include('css/components/simple-mode')"));
  assert.match(MENU, /createTemplateFromFile\('sidebar'\);\s*\n\s*template\.initialMode[^\n]*\n\s*template\.uiMode = getUiMode_\(\);/);
  assert.match(MENU, /createTemplateFromFile\('preferences'\);\s*\n\s*template\.uiMode = getUiMode_\(\);/);
});

// Simple mode hides only the search tools (sort, restore corpus); Preferences
// → Interface → Everything shows them. There is no "More options" toggle: the
// footer's buttons and Insertion Options show in both modes.
test('Simple mode hides only the search tools, and every one it hides exists', () => {
  const ids = hiddenIds(SIMPLE_CSS, /data-ui-mode="simple"/);
  assert.deepEqual(ids.sort(), ['restore-corpus-menu-wrap', 'search-sort-mode']);
  ids.forEach((id) => assert.ok(SIDEBAR.includes(`id="${id}"`), `simple-mode.css hides #${id}, which sidebar.html does not have`));
  assert.ok(!SIDEBAR.includes('more-options-toggle'), 'no "More options" toggle');
  assert.ok(!/is-more-open/.test(SIMPLE_CSS + readAppScriptFile('sidebar/js/footer-actions.html') + readAppScriptFile('sidebar/js/bootstrap.html')));
});

test('the Texts tab bar is hidden only in Texts mode, so Voices and Lexicon can always get back', () => {
  assert.match(SIMPLE_CSS, /\[data-ui-mode="simple"\]\[data-mode="texts"\] \.mode-switch-section/);
  assert.ok(!/\[data-ui-mode="simple"\] \.mode-switch-section/.test(SIMPLE_CSS));
});

test('Preferences hides only advanced tabs and sections, and Everything shows them', () => {
  assert.match(PREFS, /<div class="preferences-dialog" data-ui-mode="<\?= uiMode \?>">/);
  const ids = hiddenIds(PREFS_CSS, /data-ui-mode="simple"\]:not\(\.show-advanced\)/);
  assert.deepEqual(ids.sort(), [
    'emphasis-mapping',
    'pref-tab-advanced-btn',
    'pref-tab-experimental-btn',
    'pref-tab-linking-btn',
    'pref-tab-search-btn',
    'translation-language-typography',
  ]);
  ids.filter((id) => id !== 'pref-tab-experimental-btn').forEach((id) => {
    assert.ok(PREFS.includes(`id="${id}"`), `preferences/css.html hides #${id}, which preferences.html does not have`);
  });
  ['insertion', 'menu'].forEach((tab) => {
    assert.ok(!ids.includes(`pref-tab-${tab}-btn`), `the ${tab} tab must stay visible in Simple mode`);
  });
});

// The Interface switch is the one control for what is shown. A "Show
// advanced settings" checkbox used to do in Preferences what Everything does,
// beside it; with two controls for one thing, switching looked like it might
// reset settings or keep two sets of them.
test('one Interface switch, no "Show advanced settings", and Save never sends it', () => {
  assert.ok(!/show_advanced_settings|Show advanced settings|show-advanced-row/.test(PREFS + PREFS_CSS));
  const radios = PREFS.match(/<input type="radio" name="interface_mode_choice" value="(simple|full)">/g) || [];
  assert.equal(radios.length, 2);
  assert.ok(!/type="radio"/.test(readAppScriptFile('preferences/js.html').match(/function collectPreferenceObject\(\)[\s\S]*?\n    }/)[0]),
    'collectPreferenceObject must not start collecting radio inputs');
  // Only a link straight to a hidden tab shows the hidden tabs, for that dialog.
  const js = readAppScriptFile('preferences/js.html');
  assert.equal((js.match(/(?<!function )revealAdvancedTabs_\(\)/g) || []).length, 1, 'revealAdvancedTabs_ is called by the tab hint only');
  assert.match(js, /PREF_ADVANCED_TABS_\.indexOf\(preferredTab\) >= 0 && currentUiMode_\(\) === 'simple'\) revealAdvancedTabs_\(\)/);
});

test('switching the interface changes no setting, keeps unsaved edits and reaches an open sidebar', () => {
  const js = readAppScriptFile('preferences/js.html');
  const init = js.match(/function initInterfaceMode\(\) \{[\s\S]*?\n    \}/)[0];
  // No reload of the form: values not yet saved stay as they are.
  assert.doesNotMatch(init, /applyPreferencesToForm|loadPreferencesIntoForm|getPreferences/);
  // The Menu Bar editor is redrawn from the stored menu only without unsaved edits.
  assert.match(init, /var keptMenuEdits = menuLayoutHasUnsavedChanges\(\);\s*if \(keptMenuEdits\) markMenuLayoutSaved\(storedMenu\);\s*else loadMenuLayoutEditor\(storedMenu\);/);
  // The sidebar follows at once instead of being refreshed (which cleared its session).
  assert.match(init, /announceUiModeToSidebar_\(current\)/);
  assert.doesNotMatch(js, /Refresh the sidebar to see the change/);
  const key = js.match(/var UI_MODE_STORAGE_KEY = '([^']+)'/)[1];
  const sidebar = readAppScriptFile('sidebar/js/mode-controller.html');
  assert.match(sidebar, new RegExp(`var UI_MODE_STORAGE_KEY = '${key}'`));
  assert.match(sidebar, /if \(event\.key === UI_MODE_STORAGE_KEY\) applyUiModeFromStorage\(event\.newValue\);/);
  assert.match(sidebar, /\$\('\.unified-sidebar'\)\.attr\('data-ui-mode', mode\)/);
  // Save marks the menu saved, so a later switch sees no stale "unsaved" edit.
  assert.match(js, /markMenuLayoutSaved\(preferenceObject\.menu_layout\);/);
  // Restore default menu is an edit, not the stored menu.
  assert.match(js, /loadMenuLayoutEditor\('', \{ edit: true \}\);/);
});

test('the footer: Add Source, Insertion Options under it, then Session Library, Quick Actions and Preferences, in both modes', () => {
  const primary = SIDEBAR.match(/<section class="primary-actions"[\s\S]*?<\/section>/)[0];
  assert.ok(primary.indexOf('id="insert-source"') < primary.indexOf('id="open-layout-settings"'));
  assert.match(primary, /id="open-layout-settings"[^>]*>&#x1F4F0; Insertion Options</);
  const row = SIDEBAR.match(/<section class="sidebar-footer-tools footer-tool-row standard-quick-actions"[\s\S]*?<\/section>/)[0];
  for (const control of ['open-session-library', 'open-actions-panel', 'open-preferences-tool']) assert.ok(row.includes(control), control);
  assert.doesNotMatch(SIMPLE_CSS, /standard-quick-actions|open-preferences-tool|open-layout-settings|open-session-library|open-actions-panel|footer-actions-panel/);
});

// Opening Preferences takes a few seconds; the sidebar says so and ignores
// further clicks until the server answers.
test('every way the sidebar opens Preferences goes through openPreferencesDialog', () => {
  const js = ['sidebar/js/footer-actions.html', 'sidebar/js/mode-controller.html', 'sidebar/js/composition-controls.html']
    .map((file) => readAppScriptFile(file)).join('\n');
  const direct = js.match(/google\.script\.run[\s\S]{0,400}?\.preferencesPopup\(\)/g) || [];
  assert.equal(direct.length, 1, 'only openPreferencesDialog calls preferencesPopup');
  const opener = readAppScriptFile('sidebar/js/mode-controller.html').match(/function openPreferencesDialog\(\) \{[\s\S]*?\n\}/)[0];
  assert.match(opener, /if \(preferencesOpening\) return;/);
  assert.match(opener, /showBusyOverlay\('preferences'\)/);
  assert.match(readAppScriptFile('sidebar/js/search-utils.html'), /preferences: 'Opening Preferences…'/);
});
