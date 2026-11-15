// Pins Preferences → Sidebar tabs and what the sidebar does with it
// (`show_voices_tab`, `show_lexicon_tab`; the server side is in
// test/tests/sidebar-tabs.test.js):
//   - the Texts / Voices / Lexicon tabs show in Simple mode as in Everything;
//   - a switched-off tab is hidden by CSS only, except while it is the open
//     one, and the bar goes when Texts is left alone (unless 🧪 is beside it);
//   - Preferences shows the switches in both interfaces, beside the Interface
//     switch, and like it saves at once and reaches an open sidebar;
//   - a switched-off tab takes its Insertion Defaults sub-tab with it.
// The CSS is checked by matching its real selectors against the real markup
// in linkedom (skipped, like the sanitizer tests, without it).

const test = require('node:test');
const assert = require('node:assert/strict');

const { readAppScriptFile } = require('./test-utils');

let parseHTML = null;
try {
  parseHTML = require('linkedom').parseHTML;
} catch (error) {
  parseHTML = null;
}
const needsDom = { skip: !parseHTML && 'linkedom not installed' };

const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/<\/?style>/g, '');
const SIDEBAR = readAppScriptFile('sidebar.html');
const SIDEBAR_CSS = stripComments(readAppScriptFile('css/layout.html') + readAppScriptFile('css/components/simple-mode.html'));
const PREFS = readAppScriptFile('preferences.html');
const PREFS_CSS = stripComments(readAppScriptFile('preferences/css.html'));
const PREFS_JS = readAppScriptFile('preferences/js.html');
const MODE_JS = readAppScriptFile('sidebar/js/mode-controller.html');
const STATE_JS = readAppScriptFile('sidebar/js/preferences-state.html');

// Every selector of a `display: none !important` rule.
function hidingSelectors(css) {
  const selectors = [];
  css.split('}').forEach((block) => {
    if (!/display:\s*none\s*!important/.test(block)) return;
    block.split('{')[0].split(',').map((s) => s.trim()).filter(Boolean).forEach((s) => selectors.push(s));
  });
  return selectors;
}

function isHidden(element, selectors) {
  return selectors.some((selector) => {
    try { return element.matches(selector); } catch (error) { return false; }
  });
}

// The sidebar's tab bar as it is shown in a given state. `experimental` is
// whether the 🧪 tab is enabled (syncExperimentalAvailability shows it and
// sets .has-experimental-tab).
function visibleTabs({ ui, tabs, mode, experimental = false }) {
  const nav = SIDEBAR.match(/<nav class="mode-switch-section"[\s\S]*?<\/nav>/)[0].replace(/ style="display:none;"/, '');
  const { document } = parseHTML(`<html><body><main class="unified-sidebar${experimental ? ' has-experimental-tab' : ''}" data-mode="${mode}" data-ui-mode="${ui}" data-sidebar-tabs="${tabs}">${nav}</main></body></html>`);
  const selectors = hidingSelectors(SIDEBAR_CSS);
  if (isHidden(document.querySelector('.mode-switch-section'), selectors)) return [];
  return [...document.querySelectorAll('.mode-switch-button')]
    .filter((button) => !isHidden(button, selectors))
    .map((button) => button.getAttribute('data-sidebar-mode'))
    .filter((name) => name !== 'experimental' || experimental);
}

test('the sidebar is told which tabs are on before it paints', () => {
  assert.match(SIDEBAR, /<main class="unified-sidebar"[^\n]*data-sidebar-tabs="<\?= sidebarTabs \?>"/);
  assert.match(readAppScriptFile('server/menu.gs'), /template\.sidebarTabs = sidebarTabs\.join\(' '\);/);
});

test('Simple mode shows the Texts / Voices / Lexicon tabs, as Everything does', needsDom, () => {
  for (const ui of ['simple', 'full']) {
    for (const mode of ['texts', 'voices', 'lexicon']) {
      assert.deepEqual(visibleTabs({ ui, tabs: 'texts voices lexicon', mode }), ['texts', 'voices', 'lexicon'], `${ui}, in ${mode}`);
    }
  }
});

test('a switched-off tab is hidden, in either interface, except while it is the open one', needsDom, () => {
  for (const ui of ['simple', 'full']) {
    assert.deepEqual(visibleTabs({ ui, tabs: 'texts lexicon', mode: 'texts' }), ['texts', 'lexicon'], ui);
    assert.deepEqual(visibleTabs({ ui, tabs: 'texts voices', mode: 'texts' }), ['texts', 'voices'], ui);
    // Opened from the Voices menu item with Voices off: the tab shows where
    // you are and leads back to Texts.
    assert.deepEqual(visibleTabs({ ui, tabs: 'texts lexicon', mode: 'voices' }), ['texts', 'voices', 'lexicon'], ui);
    assert.deepEqual(visibleTabs({ ui, tabs: 'texts', mode: 'lexicon' }), ['texts', 'lexicon'], ui);
  }
});

test('with Texts alone the bar goes, unless the 🧪 tab sits beside it, which Simple mode hides', needsDom, () => {
  assert.deepEqual(visibleTabs({ ui: 'simple', tabs: 'texts', mode: 'texts' }), []);
  assert.deepEqual(visibleTabs({ ui: 'full', tabs: 'texts', mode: 'texts' }), []);
  assert.deepEqual(visibleTabs({ ui: 'full', tabs: 'texts', mode: 'texts', experimental: true }), ['texts', 'experimental']);
  assert.deepEqual(visibleTabs({ ui: 'simple', tabs: 'texts', mode: 'texts', experimental: true }), []);
  assert.deepEqual(visibleTabs({ ui: 'simple', tabs: 'texts voices lexicon', mode: 'texts', experimental: true }), ['texts', 'voices', 'lexicon']);
  assert.deepEqual(visibleTabs({ ui: 'full', tabs: 'texts voices lexicon', mode: 'texts', experimental: true }), ['texts', 'voices', 'lexicon', 'experimental']);
  assert.match(MODE_JS, /\$\('\.unified-sidebar'\)\.toggleClass\('has-experimental-tab', hasExperimental\);/);
});

test('the sidebar follows a Preferences save without a refresh, and keeps the server\'s value until its settings arrive', () => {
  const apply = STATE_JS.match(/function applyEffectivePreferencesToUI\(\) \{[\s\S]*?\n\}/)[0];
  assert.match(apply, /syncSidebarTabs\(\);/);
  const sync = MODE_JS.match(/function syncSidebarTabs\(\) \{[\s\S]*?\n\}/)[0];
  assert.match(sync, /if \(!loaded\) return;/);
  assert.match(sync, /\$\('\.unified-sidebar'\)\.attr\('data-sidebar-tabs', sidebarTabsFromPreferences\(prefs\)\.join\(' '\)\);/);
  // Hidden with CSS only: no tab is removed or re-rendered.
  assert.doesNotMatch(MODE_JS, /mode-switch-button[^\n]*\.(remove|detach)\(/);
});

test('Preferences shows the two switches beside the Interface switch, in both interfaces', () => {
  const head = PREFS.match(/<section class="preferences-toc[\s\S]*?<\/section>/)[0];
  const row = head.match(/<div class="interface-mode-row sidebar-tabs-row"[\s\S]*?<\/div>/)[0];
  assert.match(row, /<span class="interface-mode-label" id="sidebar-tabs-label">Sidebar tabs<\/span>/);
  assert.match(row, /<input type="checkbox" name="show_voices_tab" id="show_voices_tab" class="sidebar-tab-switch" data-sidebar-tab="voices" checked> Voices/);
  assert.match(row, /<input type="checkbox" name="show_lexicon_tab" id="show_lexicon_tab" class="sidebar-tab-switch" data-sidebar-tab="lexicon" checked> Lexicon/);
  assert.ok(!/show_texts_tab/.test(PREFS), 'Texts has no switch');
  // Nothing Simple mode hides in Preferences touches them.
  hidingSelectors(PREFS_CSS).filter((s) => /data-ui-mode="simple"/.test(s)).forEach((selector) => {
    assert.doesNotMatch(selector, /sidebar-tab|preferences-toc|interface-mode/, selector);
  });
});

test('a switch saves at once, only its own key, tells an open sidebar, and waits for its save', () => {
  const init = PREFS_JS.match(/function initSidebarTabSwitches\(\) \{[\s\S]*?\n    \}/)[0];
  assert.match(init, /change\[box\.name\] = on;/);
  assert.match(init, /box\.disabled = true;/);
  assert.match(init, /withSuccessHandler\(function \(\) \{\s*box\.disabled = false;\s*markPreferencesSaved\(\);/);
  assert.match(init, /withFailureHandler\(function \(\) \{\s*box\.disabled = false;\s*box\.checked = !on;/);
  assert.match(init, /\}\)\.setPreferences\(change\);/);
  assert.match(PREFS_JS, /initInterfaceMode\(\);\s*initSidebarTabSwitches\(\);/);
  // Loading, Reset To Defaults and a settings file all go through
  // applyPreferencesToForm, which redraws the dialog for the switches.
  const apply = PREFS_JS.match(/function applyPreferencesToForm\(preferences\) \{[\s\S]*?\n    \}/)[0];
  assert.match(apply, /syncSidebarTabsUi_\(\);/);
  // markPreferencesSaved writes the key the sidebar listens for.
  const key = PREFS_JS.match(/function markPreferencesSaved\(\) \{\s*try \{ localStorage\.setItem\('([^']+)'/)[1];
  assert.match(MODE_JS, new RegExp(`var PREFERENCES_SAVED_STORAGE_KEY = '${key}';`));
});

test('a switched-off tab takes its Insertion Defaults sub-tab with it', needsDom, () => {
  const nav = PREFS.match(/<nav class="pref-workflow-tabs"[\s\S]*?<\/nav>/)[0];
  const selectors = hidingSelectors(PREFS_CSS);
  const shown = (tabs) => {
    const { document } = parseHTML(`<html><body><div class="preferences-dialog" data-ui-mode="simple" data-sidebar-tabs="${tabs}">${nav}</div></body></html>`);
    if (isHidden(document.querySelector('.pref-workflow-tabs'), selectors)) return [];
    return [...document.querySelectorAll('.pref-workflow-tab')].filter((t) => !isHidden(t, selectors)).map((t) => t.getAttribute('data-workflow'));
  };
  assert.deepEqual(shown('texts voices lexicon'), ['texts', 'voices', 'lexicon']);
  assert.deepEqual(shown('texts lexicon'), ['texts', 'lexicon']);
  assert.deepEqual(shown('texts voices'), ['texts', 'voices']);
  assert.deepEqual(shown('texts'), []);
  // The page starts with both on (the overlay covers it until the settings load).
  assert.match(PREFS, /<div class="preferences-dialog" data-ui-mode="<\?= uiMode \?>" data-sidebar-tabs="texts voices lexicon">/);
  // A hidden sub-tab that was open gives way to Texts; arrow keys skip hidden ones.
  const sync = PREFS_JS.match(/function syncSidebarTabsUi_\(\) \{[\s\S]*?\n    \}/)[0];
  assert.match(sync, /data-workflow="texts"/);
  assert.match(PREFS_JS.match(/function initWorkflowTabs\(\) \{[\s\S]*?\n    \}/)[0], /getComputedStyle\(t\)\.display !== 'none'/);
});
