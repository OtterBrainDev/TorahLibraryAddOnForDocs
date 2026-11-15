// Pins Preferences → Sidebar and what the sidebar does with it (the server
// side is in test/tests/sidebar-controls.test.js):
//   - the Texts / Voices / Lexicon tabs show in Simple mode as in Everything;
//     a switched-off tab is hidden by CSS only, except while it is the open
//     one, and the bar goes when Texts is left alone (unless 🧪 is beside it);
//   - a hidden Quick Actions button is hidden; with all three hidden the 🏃
//     button goes and its row closes up (unless Surprise Me is in it);
//   - a hidden Insertion Options control is hidden in the sidebar only: the
//     same shared markup in Preferences and the Link Texts dialog is untouched;
//   - one list of ids everywhere: the server's, the sidebar's markup and CSS,
//     and Preferences' Sidebar tab;
//   - Preferences' Sidebar tab shows in both interfaces (its Insertion Options
//     part in Everything only), is saved with Save like every other tab, and
//     a switched-off tab takes its Insertion Defaults sub-tab with it.
// The CSS is checked by matching its real selectors against the real markup
// in linkedom (skipped, like the sanitizer tests, without it).

const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');

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
const CONTROLS_CSS = stripComments(readAppScriptFile('css/components/sidebar-controls.html'));
const SIDEBAR_CSS = stripComments(readAppScriptFile('css/layout.html') + readAppScriptFile('css/components/footer.html') +
  readAppScriptFile('css/components/simple-mode.html')) + CONTROLS_CSS;
const OPTIONS_MARKUP = readAppScriptFile('shared/insertion-options/markup.html') + readAppScriptFile('shared/composition-card/markup.html');
const PREFS = readAppScriptFile('preferences.html');
const PREFS_CSS = stripComments(readAppScriptFile('preferences/css.html'));
const PREFS_JS = readAppScriptFile('preferences/js.html');
const MODE_JS = readAppScriptFile('sidebar/js/mode-controller.html');
const STATE_JS = readAppScriptFile('sidebar/js/preferences-state.html');
const SERVER = readAppScriptFile('server/preferences.gs');

function serverList(name) {
  const context = vm.createContext({});
  vm.runInContext(SERVER.match(new RegExp(`var ${name} = [\\s\\S]*?\\];`))[0], context);
  return vm.runInContext(name, context);
}
const QUICK_ACTIONS = serverList('SIDEBAR_QUICK_ACTIONS_');
const OPTION_CONTROLS = serverList('SIDEBAR_OPTION_CONTROLS_');

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
  for (let node = element; node && node.matches; node = node.parentElement) {
    if (selectors.some((selector) => { try { return node.matches(selector); } catch (e) { return false; } })) return true;
  }
  return false;
}

// The sidebar root, as the server prints it, around some of its markup.
function sidebarDom({ ui = 'simple', tabs = 'texts voices lexicon', mode = 'texts', quick = '', options = '', classes = '' }, inner) {
  const { document } = parseHTML(`<html><body><main class="unified-sidebar ${classes}" data-mode="${mode}" data-ui-mode="${ui}" data-sidebar-tabs="${tabs}" data-quick-actions-hidden="${quick}" data-options-hidden="${options}">${inner}</main></body></html>`);
  return document;
}

// The tab bar as shown. `experimental`: the 🧪 tab is enabled
// (syncExperimentalAvailability shows it and sets .has-experimental-tab).
function visibleTabs({ ui, tabs, mode, experimental = false }) {
  const nav = SIDEBAR.match(/<nav class="mode-switch-section"[\s\S]*?<\/nav>/)[0].replace(/ style="display:none;"/, '');
  const document = sidebarDom({ ui, tabs, mode, classes: experimental ? 'has-experimental-tab' : '' }, nav);
  const selectors = hidingSelectors(SIDEBAR_CSS);
  if (isHidden(document.querySelector('.mode-switch-section'), selectors)) return [];
  return [...document.querySelectorAll('.mode-switch-button')]
    .filter((button) => !isHidden(button, selectors))
    .map((button) => button.getAttribute('data-sidebar-mode'))
    .filter((name) => name !== 'experimental' || experimental);
}

test('the sidebar is told what is switched off before it paints', () => {
  assert.match(SIDEBAR, /<main class="unified-sidebar"[^\n]*data-sidebar-tabs="<\?= sidebarTabs \?>" data-quick-actions-hidden="<\?= quickActionsHidden \?>" data-options-hidden="<\?= optionsHidden \?>"/);
  const menu = readAppScriptFile('server/menu.gs');
  assert.match(menu, /template\.sidebarTabs = controls\.tabs\.join\(' '\);/);
  assert.match(menu, /template\.quickActionsHidden = controls\.quickActionsHidden\.join\(' '\);/);
  assert.match(menu, /template\.optionsHidden = controls\.optionsHidden\.join\(' '\);/);
  assert.ok(SIDEBAR.includes("include('css/components/sidebar-controls')"));
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
  assert.match(MODE_JS, /\.toggleClass\('has-experimental-tab', hasExperimental\)/);
});

test('a hidden Quick Actions button is hidden; with none left the 🏃 button goes and the row closes up', needsDom, () => {
  const footer = SIDEBAR.match(/<section class="sidebar-footer-tools footer-tool-row standard-quick-actions"[\s\S]*?<\/section>/)[0] +
    SIDEBAR.match(/<div class="sidebar-footer-tools footer-actions-panel"[\s\S]*?<\/div>/)[0].replace(/ style="display:none;"/g, '');
  const selectors = hidingSelectors(SIDEBAR_CSS);
  const shown = (quick, classes = '') => {
    const document = sidebarDom({ quick, classes }, `<footer class="sidebar-footer">${footer}</footer>`);
    return {
      runner: !isHidden(document.querySelector('.open-actions-panel'), selectors),
      panel: [...document.querySelectorAll('#footer-actions-panel .footer-tool-button')]
        .filter((b) => !b.classList.contains('open-surprise-tool') && !isHidden(b, selectors)).map((b) => b.className.split(' ')[1]),
    };
  };
  assert.deepEqual(shown(''), { runner: true, panel: ['insert-from-selection-tool', 'open-divine-names-tool', 'open-linker-tool'] });
  assert.deepEqual(shown('link_texts'), { runner: true, panel: ['insert-from-selection-tool', 'open-divine-names-tool'] });
  assert.deepEqual(shown('insert_from_selection transform_divine_names'), { runner: true, panel: ['open-linker-tool'] });
  const all = QUICK_ACTIONS.join(' ');
  assert.equal(shown(all).runner, false);
  assert.equal(shown(all, 'has-surprise-action').runner, true, 'Surprise Me keeps the panel');
  assert.match(CONTROLS_CSS, /:not\(\.has-surprise-action\) \.sidebar-footer \.standard-quick-actions \{\s*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/);
  assert.match(MODE_JS, /\.toggleClass\('has-surprise-action', surpriseEnabled\)/);
});

test('a hidden Insertion Options control is hidden in the sidebar, and only there', needsDom, () => {
  const selectors = hidingSelectors(CONTROLS_CSS);
  for (const id of OPTION_CONTROLS) {
    const document = sidebarDom({ options: id }, OPTIONS_MARKUP);
    const marked = [...document.querySelectorAll('[data-sidebar-control]')];
    const mine = marked.filter((el) => el.getAttribute('data-sidebar-control').split(' ').includes(id));
    assert.ok(mine.length, `${id} marks something`);
    mine.forEach((el) => assert.ok(isHidden(el, selectors), `${id} hides ${el.id || el.className}`));
    marked.filter((el) => !mine.includes(el) && !mine.some((m) => m.contains(el)))
      .forEach((el) => assert.ok(!isHidden(el, selectors), `${id} leaves ${el.getAttribute('data-sidebar-control')}`));
  }
  // The same markup outside the sidebar (Preferences, Link Texts) hides nothing.
  const { document } = parseHTML(`<html><body><div class="preferences-dialog" data-options-hidden="${OPTION_CONTROLS.join(' ')}">${OPTIONS_MARKUP}</div></body></html>`);
  [...document.querySelectorAll('[data-sidebar-control]')].forEach((el) => assert.ok(!isHidden(el, selectors)));
  // The whole Layout section hidden takes its heading with it.
  const tray = SIDEBAR.match(/<div class="tray-section tray-display-layout-section[\s\S]*?\n            <\/div>/)[0];
  const layoutOnly = sidebarDom({ options: 'display arrangement citation line_by_line line_numbers' }, tray);
  assert.ok(isHidden(layoutOnly.querySelector('.tray-display-layout-section'), selectors));
  assert.ok(!isHidden(sidebarDom({ options: 'display arrangement citation line_numbers' }, tray).querySelector('.tray-display-layout-section'), selectors));
});

test('one list of ids: the server, the shared markup, the sidebar CSS and Preferences agree', () => {
  const marked = new Set((OPTIONS_MARKUP.match(/data-sidebar-control="([^"]+)"/g) || [])
    .flatMap((m) => m.slice(22, -1).split(' ')));
  assert.deepEqual([...marked].sort(), [...OPTION_CONTROLS].sort());
  const cssOptions = [...CONTROLS_CSS.matchAll(/\[data-options-hidden~="([a-z_]+)"\] \[data-sidebar-control~="\1"\]/g)].map((m) => m[1]);
  assert.deepEqual(cssOptions.sort(), [...OPTION_CONTROLS].sort());
  const prefsOptions = [...PREFS.matchAll(/data-sidebar-option="([a-z_]+)"/g)].map((m) => m[1]);
  assert.deepEqual(prefsOptions, [...OPTION_CONTROLS], 'Preferences lists them in the server\'s order');
  const prefsQuick = [...PREFS.matchAll(/data-sidebar-quick-action="([a-z_]+)"/g)].map((m) => m[1]);
  assert.deepEqual(prefsQuick, [...QUICK_ACTIONS]);
  QUICK_ACTIONS.forEach((id) => assert.match(CONTROLS_CSS, new RegExp(`\\[data-quick-actions-hidden~="${id}"\\] #footer-actions-panel`)));
});

test('the sidebar follows a Preferences save without a refresh, and keeps the server\'s values until its settings arrive', () => {
  const apply = STATE_JS.match(/function applyEffectivePreferencesToUI\(\) \{[\s\S]*?\n\}/)[0];
  assert.match(apply, /syncSidebarControls\(\);/);
  const sync = MODE_JS.match(/function syncSidebarControls\(\) \{[\s\S]*?\n\}/)[0];
  assert.match(sync, /if \(!loaded\) return;/);
  for (const attr of ['data-sidebar-tabs', 'data-quick-actions-hidden', 'data-options-hidden']) assert.ok(sync.includes(`.attr('${attr}'`), attr);
  // Hidden with CSS only: nothing is removed or re-rendered.
  assert.doesNotMatch(MODE_JS + STATE_JS, /(mode-switch-button|footer-tool-button|data-sidebar-control)[^\n]*\.(remove|detach)\(/);
});

test('Preferences has a Sidebar tab in both interfaces; its Insertion Options part is Everything only', () => {
  assert.match(PREFS, /<button type="button" id="pref-tab-sidebar-btn" class="pref-tab" role="tab" data-pref-tab="sidebar" aria-controls="pref-tab-sidebar" aria-selected="false">Sidebar<\/button>/);
  const panel = PREFS.match(/<div class="pref-tab-panel" id="pref-tab-sidebar"[\s\S]*?\n        <\/div>\n/)[0];
  assert.match(panel, /<input type="checkbox" name="show_voices_tab" id="show_voices_tab" class="sidebar-tab-switch" data-sidebar-tab="voices" checked/);
  assert.match(panel, /<input type="checkbox" name="show_lexicon_tab" id="show_lexicon_tab" class="sidebar-tab-switch" data-sidebar-tab="lexicon" checked/);
  assert.match(panel, /<input type="hidden" id="sidebar_quick_actions_hidden" name="sidebar_quick_actions_hidden" value="\[\]">/);
  assert.match(panel, /<input type="hidden" id="sidebar_options_hidden" name="sidebar_options_hidden" value="\[\]">/);
  // The helper switches have no name, so Save sends only the two lists.
  (panel.match(/<input type="checkbox"[^>]*class="sidebar-(quick-action|option)-switch"[^>]*>/g) || [])
    .forEach((box) => assert.doesNotMatch(box, /\bname=/, box));
  assert.ok(!/show_texts_tab/.test(PREFS), 'Texts has no switch');
  // Nothing about the tabs is left in the dialog's header.
  const head = PREFS.match(/<section class="preferences-toc[\s\S]*?<\/section>/)[0];
  assert.doesNotMatch(head, /sidebar-tab|show_voices_tab/);
  // Simple mode hides the Insertion Options part only, and never the tab.
  const simple = hidingSelectors(PREFS_CSS).filter((s) => /data-ui-mode="simple"/.test(s));
  assert.ok(simple.some((s) => /#sidebar-insertion-options$/.test(s)));
  simple.forEach((s) => assert.doesNotMatch(s, /pref-tab-sidebar|sidebar-search-tabs|sidebar-quick-actions/, s));
});

test('the Sidebar tab is saved with Save, like every other tab', () => {
  const block = PREFS_JS.slice(PREFS_JS.indexOf('// ── Sidebar tab (Preferences → Sidebar)'), PREFS_JS.indexOf('// ── Settings profiles (Everything)'));
  assert.doesNotMatch(block, /google\.script\.run|setPreferences/, 'no save of its own');
  assert.match(block, /field\.value = JSON\.stringify\(hidden\);/);
  assert.match(PREFS_JS, /initInterfaceMode\(\);\s*initSidebarControls\(\);/);
  // applyPreferencesToForm unticks every nameless checkbox; the switches are
  // redrawn from the two lists after it.
  const apply = PREFS_JS.match(/function applyPreferencesToForm\(preferences\) \{[\s\S]*?\n    \}/)[0];
  assert.match(apply, /loadSidebarControlsFromFields_\(\);/);
  assert.ok(apply.indexOf('loadSidebarControlsFromFields_();') > apply.indexOf("document.querySelectorAll('input[type=\"checkbox\"]')"));
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
