// Pins the sidebar's Voices and Lexicon tabs (Preferences → Sidebar tabs:
// `show_voices_tab`, `show_lexicon_tab`) on the server side:
//   - the tabs show in Simple mode too, and a missing switch counts as on;
//   - the sidebar is told which tabs are on before it paints
//     (data-sidebar-tabs), so a switched-off tab never flashes;
//   - a switched-off tab is never where the sidebar reopens on its own, but a
//     menu item that names it still opens it (the menu is the user's own);
//   - the sidebar's copy of the rule (mode-controller) agrees with the server's.
// The CSS and the Preferences switches are pinned in
// test/ui/sidebar-tabs-controls.test.js.
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
  };
  vm.createContext(context);
  ['apps-script/server/menu-layout.gs', 'apps-script/server/preferences.gs', 'apps-script/ui_core.gs', 'apps-script/server/menu.gs']
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

test('the sidebar is told which tabs are on, in Simple mode too, with one storage read for both', () => {
  for (const ui of ['simple', 'full']) {
    const { context, templates, reads } = loadServer({ ui_mode: ui, show_voices_tab: 'false', show_lexicon_tab: 'true' });
    const before = reads();
    assert.deepEqual([...context.getSidebarTabs_()], ['texts', 'lexicon']);
    assert.equal(reads() - before, 1, 'getSidebarTabs_ reads UserProperties once');
    context.openSharedSidebar_('texts');
    assert.equal(templates[0].name, 'sidebar');
    assert.equal(templates[0].sidebarTabs, 'texts lexicon', ui);
    assert.equal(templates[0].uiMode, ui);
  }
  const all = loadServer({ ui_mode: 'simple' });
  all.context.openSharedSidebar_('texts');
  assert.equal(all.templates[0].sidebarTabs, 'texts voices lexicon', 'an upgrader with no stored switch sees both tabs');
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

test("the sidebar's copy of the rule agrees with the server's", () => {
  const js = read('apps-script/sidebar/js/mode-controller.html');
  const switches = js.match(/var SIDEBAR_TAB_SWITCHES = [^\n]*/)[0];
  const fn = js.match(/function sidebarTabsFromPreferences\(prefs\) \{[\s\S]*?\n\}/)[0];
  const client = vm.createContext({});
  vm.runInContext(`${switches}\n${fn}`, client);
  const { context } = loadServer();
  assert.deepEqual(
    JSON.parse(JSON.stringify(vm.runInContext('SIDEBAR_TAB_SWITCHES', client))),
    JSON.parse(JSON.stringify(vm.runInContext('SIDEBAR_TAB_SWITCHES_', context)))
  );
  const cases = [{}, { show_voices_tab: 'false' }, { show_lexicon_tab: 'false' }, { show_voices_tab: false, show_lexicon_tab: 'false' }, { show_voices_tab: 'true' }];
  cases.forEach((prefs) => {
    assert.deepEqual([...client.sidebarTabsFromPreferences(prefs)], [...context.sidebarTabsFromPreferences_(prefs)], JSON.stringify(prefs));
  });
});

test('the switches are settings: in SETTINGS, defaulted on, and handed out in the "Menu and interface" part of a settings file', () => {
  const { context } = loadServer();
  const settings = vm.runInContext('SETTINGS', context);
  assert.ok(settings.includes('show_voices_tab'));
  assert.ok(settings.includes('show_lexicon_tab'));
  assert.match(read('apps-script/server/settings-file.gs'), /Simple or Everything, the sidebar tabs/);
});
