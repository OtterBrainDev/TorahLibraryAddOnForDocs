// Pins Preferences → Sidebar on the server side: the result tabs
// (`show_voices_tab`, `show_lexicon_tab`), and the Quick Actions buttons and
// Insertion Options controls the person hid (`sidebar_quick_actions_hidden`,
// `sidebar_options_hidden`):
//   - the tabs show in Simple mode too, a missing switch counts as on, and
//     nothing is hidden until the person hides it; junk hides nothing;
//   - the sidebar is told all of it before it paints (data attributes), so
//     nothing switched off ever flashes;
//   - a switched-off tab is never where the sidebar reopens on its own, but a
//     menu item that names it still opens it (the menu is the user's own);
//   - the sidebar's copy of the rules (mode-controller) agrees with the server's.
// The CSS and the Preferences tab are pinned in test/ui/sidebar-controls-ui.test.js.
//
// Loaded with vm against stubs; see AGENTS.md hard rule #3.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');

function loadServer(stored = {}) {
  const store = Object.assign({}, stored);
  let reads = 0;
  const shown = [];
  const templates = [];
  const props = {
    getProperty: (k) => { reads++; return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
    getProperties: () => { reads++; return Object.assign({}, store); },
    setProperty(k, v) { store[k] = String(v); return this; },
  };
  const context = {
    console,
    Logger: { log() {} },
    PropertiesService: { getUserProperties: () => props },
    HtmlService: {
      createTemplateFromFile: (name) => {
        const template = { name, evaluate() { return { setTitle() { return this; }, setWidth() { return this; } }; } };
        templates.push(template);
        return template;
      },
    },
    DocumentApp: { getUi: () => ({ showSidebar: (output) => shown.push(output) }) },
    getUiMode_: () => store.ui_mode || 'full',
    maybeShowFirstRunSetup_: () => false,
    runUserPreferenceMigrationsIfNeeded_() {},
    Utilities: { getUuid: () => 'session' },
    CacheService: { getUserCache: () => ({ get: () => null }) },
  };
  vm.createContext(context);
  ['apps-script/server/menu-layout.gs', 'apps-script/server/preferences.gs', 'apps-script/server/settings-file.gs', 'apps-script/server/settings-profiles.gs', 'apps-script/ui_core.gs', 'apps-script/server/menu.gs']
    .forEach((file) => vm.runInContext(read(file), context, { filename: file }));
  return { context, store, templates, shown, reads: () => reads };
}

test('both tabs are on by default and a missing or unreadable switch counts as on', () => {
  const { context } = loadServer();
  assert.deepEqual([...context.sidebarTabsFromPreferences_({})], ['texts', 'voices', 'lexicon']);
  assert.deepEqual([...context.sidebarTabsFromPreferences_(null)], ['texts', 'voices', 'lexicon']);
  assert.deepEqual([...context.sidebarTabsFromPreferences_({ show_voices_tab: 'false' })], ['texts', 'lexicon']);
  assert.deepEqual([...context.sidebarTabsFromPreferences_({ show_lexicon_tab: false })], ['texts', 'voices']);
  assert.deepEqual([...context.sidebarTabsFromPreferences_({ show_voices_tab: 'false', show_lexicon_tab: 'false' })], ['texts']);
  // Only "false" turns a tab off: junk never hides one.
  assert.deepEqual([...context.sidebarTabsFromPreferences_({ show_voices_tab: '', show_lexicon_tab: 'no' })], ['texts', 'voices', 'lexicon']);
  // Texts has no switch.
  assert.ok(!/show_texts_tab/.test(read('apps-script/server/preferences.gs')));
});

test('hidden Quick Actions and Insertion Options are known ids, in catalog order; anything else hides nothing', () => {
  const { context } = loadServer();
  const none = context.sidebarControlsFromPreferences_({});
  assert.deepEqual([...none.quickActionsHidden], []);
  assert.deepEqual([...none.optionsHidden], []);
  const some = context.sidebarControlsFromPreferences_({
    sidebar_quick_actions_hidden: '["link_texts","nonsense","insert_from_selection"]',
    sidebar_options_hidden: '["text_fonts","vowels","vowels","<b>"]',
  });
  assert.deepEqual([...some.quickActionsHidden], ['insert_from_selection', 'link_texts']);
  assert.deepEqual([...some.optionsHidden], ['vowels', 'text_fonts']);
  for (const junk of ['', 'not json', '{"a":1}', '"vowels"', null]) {
    const parsed = context.sidebarControlsFromPreferences_({ sidebar_options_hidden: junk, sidebar_quick_actions_hidden: junk });
    assert.deepEqual([...parsed.optionsHidden], [], String(junk));
    assert.deepEqual([...parsed.quickActionsHidden], [], String(junk));
  }
});

test('the sidebar is told all of it before it paints, in Simple mode too, with one storage read', () => {
  for (const ui of ['simple', 'full']) {
    const { context, templates, reads } = loadServer({
      ui_mode: ui, show_voices_tab: 'false', show_lexicon_tab: 'true',
      sidebar_quick_actions_hidden: '["link_texts"]', sidebar_options_hidden: '["cantillation","title_fonts"]',
    });
    const before = reads();
    const controls = context.getSidebarControls_();
    assert.equal(reads() - before, 1, 'getSidebarControls_ reads UserProperties once');
    assert.deepEqual([...controls.tabs], ['texts', 'lexicon']);
    context.openSharedSidebar_('texts');
    assert.equal(templates[0].name, 'sidebar');
    assert.equal(templates[0].sidebarTabs, 'texts lexicon', ui);
    assert.equal(templates[0].quickActionsHidden, 'link_texts', ui);
    assert.equal(templates[0].optionsHidden, 'cantillation title_fonts', ui);
    assert.equal(templates[0].uiMode, ui);
  }
  const all = loadServer({ ui_mode: 'simple' });
  all.context.openSharedSidebar_('texts');
  assert.equal(all.templates[0].sidebarTabs, 'texts voices lexicon', 'an upgrader with no stored switch sees both tabs');
  assert.equal(all.templates[0].quickActionsHidden, '');
  assert.equal(all.templates[0].optionsHidden, '');
});

test('the sidebar never reopens on a switched-off tab by itself, but a menu item that names one opens it', () => {
  // Reopened with no mode named (Texts menu item's fallback, Refresh Sidebar):
  // the last search comes back only while its tab is on.
  const off = loadServer({ search_mode: 'voices', show_voices_tab: 'false' });
  off.context.openSharedSidebar_();
  assert.equal(off.templates[0].initialMode, 'texts');
  assert.equal(off.store.search_mode, 'texts');

  const on = loadServer({ search_mode: 'lexicon' });
  on.context.openSharedSidebar_();
  assert.equal(on.templates[0].initialMode, 'lexicon');

  // The Voices / Lexicon menu items name their mode: honoured, tab off or not.
  const named = loadServer({ show_voices_tab: 'false', show_lexicon_tab: 'false' });
  named.context.voicesHTML();
  assert.equal(named.templates[0].initialMode, 'voices');
  named.context.lexiconHTML();
  assert.equal(named.templates[1].initialMode, 'lexicon');
  assert.equal(named.templates[1].sidebarTabs, 'texts', 'the tab shows only while it is open (css/layout)');

  // Only the switchable tabs fall back; anything else resolves as before.
  assert.equal(off.context.resolveSidebarOpenMode_(null, 'experimental', ['texts']), 'experimental');
  assert.equal(off.context.resolveSidebarOpenMode_(null, 'texts', ['texts']), 'texts');
  assert.equal(off.context.resolveSidebarOpenMode_('voices', 'texts', ['texts']), 'voices');
});

test("the sidebar's copy of the rules agrees with the server's", () => {
  const js = read('apps-script/sidebar/js/mode-controller.html');
  const from = js.indexOf('var SIDEBAR_TAB_SWITCHES = ');
  const to = js.indexOf('function syncSidebarControls()');
  const client = vm.createContext({});
  vm.runInContext(js.slice(from, to), client);
  const { context } = loadServer();
  const same = (clientName, serverName) => assert.deepEqual(
    JSON.parse(JSON.stringify(vm.runInContext(clientName, client))),
    JSON.parse(JSON.stringify(vm.runInContext(serverName, context))), clientName);
  same('SIDEBAR_TAB_SWITCHES', 'SIDEBAR_TAB_SWITCHES_');
  same('SIDEBAR_QUICK_ACTIONS', 'SIDEBAR_QUICK_ACTIONS_');
  same('SIDEBAR_OPTION_CONTROLS', 'SIDEBAR_OPTION_CONTROLS_');
  same('SIDEBAR_CONTROL_KEYS', 'SIDEBAR_CONTROL_KEYS_');
  const cases = [{}, { show_voices_tab: 'false' }, { show_lexicon_tab: 'false' }, { show_voices_tab: false, show_lexicon_tab: 'false' },
    { sidebar_quick_actions_hidden: '["link_texts","x"]', sidebar_options_hidden: '["commentary","display"]' }, { sidebar_options_hidden: 'junk' }];
  cases.forEach((prefs) => {
    assert.deepEqual(JSON.parse(JSON.stringify(client.sidebarControlsFromPreferences(prefs))),
      JSON.parse(JSON.stringify(context.sidebarControlsFromPreferences_(prefs))), JSON.stringify(prefs));
  });
});

test('they are settings: in SETTINGS, defaulted to show everything, and in the "Menu and interface" part of a settings file, never a profile', () => {
  const { context } = loadServer();
  const settings = vm.runInContext('SETTINGS', context);
  const defaults = context.getDefaultPreferences();
  for (const key of vm.runInContext('SIDEBAR_CONTROL_KEYS_', context)) assert.ok(settings.includes(key), key);
  assert.equal(defaults.show_voices_tab, true);
  assert.equal(defaults.show_lexicon_tab, true);
  assert.equal(defaults.sidebar_quick_actions_hidden, '[]');
  assert.equal(defaults.sidebar_options_hidden, '[]');
  // Their settings-file part, and that no profile holds them: settings-file and settings-profiles tests.
});
