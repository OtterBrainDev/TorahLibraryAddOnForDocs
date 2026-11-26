// Pins the settings-profile controls (the server side is in
// test/tests/settings-profiles.test.js):
//   - Preferences: the profiles column shows in Everything only, beside the
//     tabs; a name is the person's text and is drawn as text; a switch or a
//     new profile asks about unsaved changes first (they belong to the profile
//     in use); every change tells an open sidebar; the dialog is wider in
//     Everything;
//   - the sidebar: the picker shows with two or more profiles, names the one in
//     use on the Insertion Options button, and a switch, made there or in
//     Preferences, drops the session's Insertion Options changes.
// The rail renderer runs in linkedom (skipped, like the sanitizer tests, without it).

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

const PREFS = readAppScriptFile('preferences.html');
const PREFS_CSS = readAppScriptFile('preferences/css.html');
const PREFS_JS = readAppScriptFile('preferences/js.html');
const PROFILES_JS = PREFS_JS.slice(PREFS_JS.indexOf('// ── Settings profiles'), PREFS_JS.indexOf('    function _initPreferencesTabs() {'));
const SIDEBAR = readAppScriptFile('sidebar.html');
const STATE_JS = readAppScriptFile('sidebar/js/preferences-state.html');
const MODE_JS = readAppScriptFile('sidebar/js/mode-controller.html');

// A function's source, up to the closing brace at its own indent (Preferences'
// script is indented four spaces; the sidebar's partials are not).
const fn = (source, name) => {
  const indent = source === STATE_JS || source === MODE_JS ? '' : '    ';
  return source.match(new RegExp(`function ${name}\\([^)]*\\) \\{[\\s\\S]*?\\n${indent}\\}`))[0];
};

test('Details is available in both modes and the footer holds the save actions', needsDom, () => {
  const { document } = parseHTML(PREFS);
  const tab = document.querySelector('#pref-tab-profiles-btn');
  const panel = document.getElementById(tab.getAttribute('aria-controls'));
  assert.ok(document.querySelector('.pref-profile-workspace > #pref-profile-rail'));
  assert.equal(document.querySelector('.pref-tab-bar button'), tab);
  assert.equal(tab.textContent, 'Details');
  assert.equal(panel.querySelector('[data-preset=document]').title, 'Clone Account Settings');
  assert.equal(panel.querySelector('[data-preset=document]').textContent, '👤 → ⚙');
  assert.equal(panel.querySelectorAll('.pref-preset-button').length, 3);
  assert.equal(panel.querySelector('[data-preset=factory]').title, 'Factory applies the 1.0-style preset to the active profile and shared settings, including Simple mode.');
  assert.ok(panel.querySelector('[data-preset=factory]').classList.contains('danger'));
  assert.equal(panel.querySelector('[data-preset=factory]').textContent, '🏭');
  assert.equal(panel.querySelector('[data-preset=factory]').getAttribute('aria-label'), 'Restore Factory preset');
  assert.match(fn(PROFILES_JS, 'askProfileQuestion_'), /ok\.classList\.toggle\('danger', !!question\.danger\)/);
  assert.doesNotMatch(PREFS_CSS, /not\(\[data-ui-mode="full"\]\) \.pref-profile-rail/);
  const footer = document.querySelector('.save-bar');
  assert.equal(footer.querySelectorAll('button').length, 3);
  assert.equal(footer.querySelector('.save-preferences-button').textContent, '💾');
  assert.equal(document.querySelector('#preferences-dismiss').getAttribute('aria-label'), 'Close Preferences');
  assert.equal(footer.querySelector('.apply-sidebar-preferences-button').title, 'Update Sidebar Preview');
  assert.equal(footer.querySelector('.apply-sidebar-preferences-button').textContent, '🡆');
  assert.equal(footer.querySelector('.close-preferences-button.blue').textContent, 'Save & Close');
});

test('a profile name is drawn as text', needsDom, () => {
  const { document, window } = parseHTML(PREFS);
  const context = vm.createContext({ document, window });
  vm.runInContext(`
    function byId(id) { return document.getElementById(id); }
    function $(selector) {
      return { attr: (name, value) => {
        const attributes = typeof name === 'string' ? { [name]: value } : name;
        Object.entries(attributes).forEach(([key, val]) => document.querySelector(selector).setAttribute(key, val));
      } };
    }
    var editingDocument_ = false;
    var documentProfile_ = { key: 'doc' };
    var settingsProfiles_ = { active: 'p2', max: 10, profiles: [{ id: 'p1', name: 'User Profile' }, { id: 'p2', name: '<img src=x onerror=alert(1)>' }] };
    var profileNameMode_ = null;
    ${fn(PROFILES_JS, 'profileIndex_')}
    ${fn(PROFILES_JS, 'profileById_')}
    ${fn(PROFILES_JS, 'activeProfile_')}
    ${fn(PROFILES_JS, 'quoted_')}
    ${fn(PROFILES_JS, 'renderSettingsProfiles_')}
    ${fn(PROFILES_JS, 'renderProfileNameField_')}
    renderSettingsProfiles_();`, context);
  const items = [...document.querySelectorAll('.pref-profile-item')];
  assert.equal(items.length, 3);
  assert.equal(items[0].textContent, 'This Document');
  assert.equal(items[1].textContent, 'User Profile');
  assert.equal(items[2].textContent, '<img src=x onerror=alert(1)>');
  assert.equal(document.querySelectorAll('img').length, 0);
  assert.deepEqual(items.map((b) => b.getAttribute('aria-current')), ['false', 'false', 'true']);
  assert.equal(document.getElementById('pref-profile-delete').disabled, false);
  assert.equal(document.getElementById('pref-profile-name-field').hidden, false);
  assert.equal(document.getElementById('pref-profile-name').value, items[2].textContent);
  vm.runInContext('editingDocument_ = true; renderSettingsProfiles_();', context);
  assert.equal(document.querySelector('.pref-profile-item[aria-current=true]').textContent, 'This Document');
  assert.equal(document.getElementById('pref-profile-delete').disabled, true);
  const save = document.querySelector('.save-preferences-button');
  assert.equal(save.title, 'Save changes to this document');
  vm.runInContext('editingDocument_ = false; settingsProfiles_.active = "p1"; renderSettingsProfiles_();', context);
  assert.equal(document.getElementById('pref-profile-rename').disabled, true);
  assert.equal(document.getElementById('pref-profile-name-field').hidden, true);
  assert.equal(save.title, 'Save changes to “User Profile”');
  assert.equal(save.getAttribute('aria-label'), save.title);
  assert.equal(save.textContent, '💾');
  // No HTML sink anywhere in the profile code, here or in the sidebar.
  assert.doesNotMatch(PROFILES_JS, /innerHTML|\.html\(/);
  const picker = STATE_JS.slice(STATE_JS.indexOf('// ── Settings profiles'), STATE_JS.indexOf('function saveSessionAsDefaults'));
  assert.doesNotMatch(picker, /innerHTML|\.html\(/);
  assert.match(picker, /\$\('<option>'\)\.val\(profile\.id\)\.text\(profile\.name\)/);
});

test('a switch or a new profile asks about unsaved changes first; a rename does not', () => {
  assert.match(fn(PROFILES_JS, 'switchToProfile_'), /withUnsavedChangesHandled_\(/);
  assert.match(fn(PROFILES_JS, 'submitProfileName_'), /if \(profileNameMode_ !== 'create'\) \{[\s\S]*?renameSettingsProfile\(id, name\);\s*return;\s*\}\s*withUnsavedChangesHandled_\(/);
  const ask = fn(PROFILES_JS, 'withUnsavedChangesHandled_');
  assert.match(ask, /if \(!formHasUnsavedChanges_\(\)\) \{ proceed\(\); return; \}/);
  assert.match(ask, /ok: saveAction \? saveAction\.label : 'Save and continue'/);
  assert.match(ask, /onOk: function \(\) \{ saveFormThen_\(saveAction \? saveAction\.onSave : proceed\); \}/);
  assert.match(ask, /onAlt: proceed/);
  // Deleting asks its own question, which says unsaved changes are dropped.
  assert.match(fn(PROFILES_JS, 'deleteActiveProfile_'), /Changes not saved here are dropped\./);
  // "Unsaved" is measured against what was last loaded or saved.
  assert.match(fn(PREFS_JS, 'applyPreferencesToForm'), /markFormClean_\(\);/);
  assert.match(fn(PROFILES_JS, 'saveFormThen_'), /applyPreferencesToForm\(result.preferences\)/);
  assert.match(fn(PROFILES_JS, 'saveFormThen_'), /saveDocumentPreferenceProfile\(preferenceObject, documentProfile_\.key\)/);
  assert.match(fn(PROFILES_JS, 'saveFormThen_'), /savePreferenceDefaults\(preferenceObject, activeProfile_\(\).id\)/);
});

test('closing Preferences offers save, discard and cancel only with unsaved changes', needsDom, () => {
  const { document } = parseHTML(PREFS);
  const calls = [];
  const context = vm.createContext({ document, calls, google: { script: { host: { close: () => calls.push('close') } } } });
  vm.runInContext(`
    function byId(id) { return document.getElementById(id); }
    function $(selector) { return { prop() {} }; }
    function setTimeout(callback) { callback(); }
    function quoted_(name) { return '“' + name + '”'; }
    function formHasUnsavedChanges_() { return dirty; }
    function saveFormThen_(next) { calls.push('save'); completeSave = next; }
    var dirty = true, editingDocument_ = true, preferencesClosing_ = false, completeSave;
    ${fn(PREFS_JS, 'closePreferences_')}
    ${fn(PREFS_JS, 'requestPreferencesClose_')}
    ${fn(PROFILES_JS, 'withUnsavedChangesHandled_')}
    ${fn(PROFILES_JS, 'askProfileQuestion_')}
  `, context);
  const requestClose = () => vm.runInContext('preferencesClosing_ = false; requestPreferencesClose_();', context);
  const modal = document.querySelector('#profile_modal');
  requestClose();
  assert.equal(modal.hidden, false);
  assert.match(document.querySelector('#profile_modal_message').textContent, /This Document/);
  assert.equal(document.querySelector('#profile_modal_ok').textContent, 'Save & Close');
  document.querySelector('#profile_modal_cancel').click();
  assert.equal(modal.hidden, true);
  assert.deepEqual(calls, []);
  requestClose();
  document.querySelector('#profile_modal_ok').click();
  assert.deepEqual(calls, ['save'], 'wait for a successful save before closing');
  vm.runInContext('completeSave();', context);
  assert.deepEqual(calls, ['save', 'close']);
  calls.length = 0;
  requestClose();
  document.querySelector('#profile_modal_alt').click();
  assert.deepEqual(calls, ['close'], 'discard closes without a save');
  calls.length = 0;
  vm.runInContext('dirty = false;', context);
  requestClose();
  assert.equal(modal.hidden, true);
  assert.deepEqual(calls, ['close'], 'a clean form closes without a prompt');
});

test('every profile change reloads what it changed and tells an open sidebar', () => {
  const answer = PROFILES_JS.match(/function profileAnswer_\([\s\S]*?\n    \}/)[0];
  assert.match(answer, /if \(reload && result && result\.preferences\) \{[\s\S]*?applyPreferencesToForm\(result\.preferences\);\s*\}\s*markPreferencesSaved\(\);/);
  assert.match(fn(PROFILES_JS, 'switchToProfile_'), /profileAnswer_\('Switching profile…', true,/);
  assert.match(fn(PROFILES_JS, 'submitProfileName_'), /profileAnswer_\('Renaming…', false,/);
  assert.match(PREFS_JS, /initSidebarControls\(\);\s*initSettingsProfiles\(\);/);
});

test('the sidebar picker shows with two or more profiles and names the one in use', () => {
  assert.match(SIDEBAR, /<div class="tray-profile-bar" id="tray-profile-bar" hidden>\s*<label class="tray-section-label" for="tray-profile-select">Profile<\/label>\s*<select class="tray-profile-select" id="tray-profile-select"><\/select>/);
  assert.match(SIDEBAR, /id="open-layout-settings"[^>]*>&#x1F4F0; Insertion Options<span class="layout-settings-profile" id="layout-settings-profile" hidden><\/span><\/button>/);
  const render = fn(STATE_JS, 'renderProfilePicker');
  assert.match(render, /var several = !!\(index && index\.profiles && index\.profiles\.length > 1\);/);
  assert.match(render, /\$\('#tray-profile-bar'\)\.prop\('hidden', !several\);/);
  assert.match(render, /\$\('#layout-settings-profile'\)\.text\(active \? active\.name : ''\)\.prop\('hidden', !active\);/);
  assert.match(readAppScriptFile('sidebar/js/event-bindings.html'), /\$\(document\)\.on\('change', '#tray-profile-select', function \(\) \{\s*switchProfileFromSidebar\(\$\(this\)\.val\(\)\);/);
});

test('a switch, in the sidebar or in Preferences, drops the session\'s Insertion Options changes', () => {
  const sw = fn(STATE_JS, 'switchProfileFromSidebar');
  assert.match(sw, /accountPreferences = clonePlainObject\(/);
  assert.match(sw, /beginSidebarSessionAction_\('profile'/);
  assert.match(sw, /if \(sidebarSessionId\) \{\s*clearSidebarSessionAfterSaves_\(announce,/);
  assert.match(sw, /\.switchSettingsProfile\(id\);/);
  const adopt = fn(STATE_JS, 'adoptSettingsProfiles');
  assert.match(adopt, /settingsProfiles\.active !== before && hasSessionOverrides\(\)\) \{\s*resetSessionOverrides\(\);/);
  // The sidebar re-reads the profiles when it starts and on every Preferences save.
  assert.match(fn(MODE_JS, 'reloadAccountPreferences'), /loadSettingsProfiles\(\);/);
  assert.match(readAppScriptFile('sidebar/js/bootstrap.html'), /loadSettingsProfiles\(\);/);
});


test('Details groups the pencil, trash, and transfer actions above the rename field', needsDom, () => {
  const { document } = parseHTML(PREFS);
  const rail = document.querySelector('#pref-profile-rail');
  const tools = document.querySelector('#pref-tab-profiles .pref-profile-tools');
  assert.deepEqual([...tools.querySelectorAll('button')].map((button) => button.id),
    ['pref-profile-rename', 'pref-profile-delete', 'settings-transfer-open']);
  assert.equal(tools.querySelector('#pref-profile-delete').textContent, '🗑');
  assert.equal(tools.querySelector('#pref-profile-rename').textContent, '🖉');
  assert.ok(document.querySelector('#pref-tab-profiles #pref-profile-name'));
  assert.equal(rail.querySelector('.pref-profile-tools'), null);
});

test('Import/Export is a modal opened by a labeled icon outside the mode-dependent tabs', () => {
  const panel = PREFS.match(/<section class="pref-profile-defaults[\s\S]*?<\/section>/)[0];
  assert.match(panel, /id="settings-transfer-open"[^>]*title="Import\/Export"[^>]*aria-haspopup="dialog"[^>]*>[\s\S]*?&#x21c5;/);
  assert.doesNotMatch(PREFS, /id="pref-tab-advanced-btn"/);
  assert.match(PREFS, /<dialog class="settings-transfer-dialog" id="settings-transfer-modal"/);
  const js = readAppScriptFile('preferences/settings-file-js.html');
  assert.match(js, /modal\.showModal\(\)/);
  assert.match(js, /el\('settings-transfer-profile-row'\)\.hidden = mode !== 'full'/);
  assert.match(js, /profileId: mode === 'simple' \? profileIndex\.active : el\('settings-transfer-target'\)\.value/);
  assert.match(js, /if \(result\.affectsActive\) \{\s*dialog\.reloadFrom/);
  assert.match(js, /el\('settings-transfer-open'\)\.focus\(\)/);
});

test('menu editor respects disabled tools and does not rewrite other preference baselines on mode switch', () => {
  assert.match(fn(PREFS_JS, 'menuLayoutIsSuppressed'), /byId\('show_' \+ id \+ '_tab'\)/);
  assert.match(fn(PREFS_JS, 'menuLayoutLabel'), /Add Sources with Sefaria/);
  assert.match(fn(PREFS_JS, 'initInterfaceMode'), /syncFormMenuBaseline_\(\)/);
  const context = vm.createContext({});
  vm.runInContext("var preferencesBaseline_ = JSON.stringify({nekudot:false,menu_layout:'old',show_voices_tab:false}); var menuLayoutSavedValue='new';" + fn(PREFS_JS, 'syncFormMenuBaseline_') + "syncFormMenuBaseline_();", context);
  assert.deepEqual(JSON.parse(context.preferencesBaseline_), {nekudot:false,menu_layout:'new',show_voices_tab:false});
});
