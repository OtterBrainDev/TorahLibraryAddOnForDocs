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

test('every sidebar control Simple mode hides exists, and is hidden only while "More options" is closed', () => {
  const ids = hiddenIds(SIMPLE_CSS, /data-ui-mode="simple"/);
  assert.ok(ids.length >= 5, `expected the hidden controls, found ${ids}`);
  ids.forEach((id) => assert.ok(SIDEBAR.includes(`id="${id}"`), `simple-mode.css hides #${id}, which sidebar.html does not have`));

  SIMPLE_CSS.split('}').forEach((block) => {
    if (!/display:\s*none\s*!important/.test(block)) return;
    block.split('{')[0].split(',').filter((s) => s.trim()).forEach((selector) => {
      assert.match(selector, /:not\(\.is-more-open\)/, `"${selector.trim()}" stays hidden even with More options open`);
    });
  });
  assert.ok(SIDEBAR.includes('id="more-options-toggle"'));
});

test('the Texts tab bar is hidden only in Texts mode, so Voices and Lexicon can always get back', () => {
  assert.match(SIMPLE_CSS, /\[data-ui-mode="simple"\]\[data-mode="texts"\]:not\(\.is-more-open\) \.mode-switch-section/);
  assert.ok(!/\[data-ui-mode="simple"\]:not\(\.is-more-open\) \.mode-switch-section/.test(SIMPLE_CSS));
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

test('collapsed Simple mode hides the Preferences gear with its whole row, and "More options" brings it back', () => {
  assert.match(SIMPLE_CSS, /\[data-ui-mode="simple"\]:not\(\.is-more-open\) \.sidebar-footer \.standard-quick-actions \{\s*display: none !important;/);
  const row = SIDEBAR.match(/<section class="sidebar-footer-tools footer-tool-row standard-quick-actions"[\s\S]*?<\/section>/);
  assert.ok(row && row[0].includes('open-preferences-tool'), 'the gear lives in the row Simple mode hides');
});
