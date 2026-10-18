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

test('Preferences hides only advanced tabs and sections, and "Show advanced settings" brings them back', () => {
  assert.match(PREFS, /<div class="preferences-dialog" data-ui-mode="<\?= uiMode \?>">/);
  const ids = hiddenIds(PREFS_CSS, /data-ui-mode="simple"\]:not\(\.show-advanced\)/);
  assert.deepEqual(ids.sort(), [
    'emphasis-mapping',
    'pref-tab-experimental-btn',
    'pref-tab-linking-btn',
    'pref-tab-search-btn',
    'translation-language-typography',
  ]);
  ids.filter((id) => id !== 'pref-tab-experimental-btn').forEach((id) => {
    assert.ok(PREFS.includes(`id="${id}"`), `preferences/css.html hides #${id}, which preferences.html does not have`);
  });
  ['fonts', 'insertion', 'menu'].forEach((tab) => {
    assert.ok(!ids.includes(`pref-tab-${tab}-btn`), `the ${tab} tab must stay visible in Simple mode`);
  });
});

test('the Interface and advanced switches are not preferences, so Save never sends them', () => {
  const advanced = PREFS.match(/<input type="checkbox" id="show_advanced_settings"[^>]*>/);
  assert.ok(advanced && !/\bname=/.test(advanced[0]), 'Show advanced settings must have no name');
  assert.ok(/name="interface_mode_choice"/.test(PREFS));
  assert.ok(!/type="radio"/.test(readAppScriptFile('preferences/js.html').match(/function collectPreferenceObject\(\)[\s\S]*?\n    }/)[0]),
    'collectPreferenceObject must not start collecting radio inputs');
});

test('the footer: Add Source, Insertion Options under it, then Session Library, Quick Actions and Preferences, in both modes', () => {
  const primary = SIDEBAR.match(/<section class="primary-actions"[\s\S]*?<\/section>/)[0];
  assert.ok(primary.indexOf('id="insert-source"') < primary.indexOf('id="open-layout-settings"'));
  assert.match(primary, /id="open-layout-settings"[^>]*>&#x1F4F0; Insertion Options</);
  const row = SIDEBAR.match(/<section class="sidebar-footer-tools footer-tool-row standard-quick-actions"[\s\S]*?<\/section>/)[0];
  for (const control of ['open-session-library', 'open-actions-panel', 'open-preferences-tool']) assert.ok(row.includes(control), control);
  assert.doesNotMatch(SIMPLE_CSS, /standard-quick-actions|open-preferences-tool|open-layout-settings|open-session-library|open-actions-panel|footer-actions-panel/);
});
