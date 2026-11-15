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
const PROFILES_JS = PREFS_JS.slice(PREFS_JS.indexOf('// ── Settings profiles (Everything)'), PREFS_JS.indexOf('    function _initPreferencesTabs() {'));
const SIDEBAR = readAppScriptFile('sidebar.html');
const STATE_JS = readAppScriptFile('sidebar/js/preferences-state.html');
const MODE_JS = readAppScriptFile('sidebar/js/mode-controller.html');

// A function's source, up to the closing brace at its own indent (Preferences'
// script is indented four spaces; the sidebar's partials are not).
const fn = (source, name) => {
  const indent = source === STATE_JS || source === MODE_JS ? '' : '    ';
  return source.match(new RegExp(`function ${name}\\([^)]*\\) \\{[\\s\\S]*?\\n${indent}\\}`))[0];
};

test('the profiles column is in Everything only, beside the tabs, and the dialog is wider there', () => {
  assert.match(PREFS, /<nav class="pref-profile-rail" id="pref-profile-rail"/);
  assert.ok(PREFS.indexOf('id="pref-profile-rail"') < PREFS.indexOf('<div class="pref-main">'), 'a column before the tabs');
  assert.match(PREFS_CSS, /\.preferences-dialog:not\(\[data-ui-mode="full"\]\) \.pref-profile-rail \{ display: none; \}/);
  assert.match(PREFS_CSS, /\.preferences-dialog\[data-ui-mode="full"\] \.preferences-shell \{\s*display: grid;/);
  assert.match(readAppScriptFile('server/menu.gs'), /\.setWidth\(template\.uiMode === 'full' \? 860 : 600\)/);
  assert.match(fn(PREFS_JS, 'initInterfaceMode'), /google\.script\.host\.setWidth\(current === 'full' \? 860 : 600\)/);
});

test('a profile name is drawn as text', needsDom, () => {
  const rail = PREFS.match(/<nav class="pref-profile-rail"[\s\S]*?<\/nav>/)[0];
  const { document, window } = parseHTML(`<html><body>${rail}</body></html>`);
  const context = vm.createContext({ document, window });
  vm.runInContext(`
    function byId(id) { return document.getElementById(id); }
    var settingsProfiles_ = { active: 'p2', max: 10, profiles: [{ id: 'p1', name: 'My settings' }, { id: 'p2', name: '<img src=x onerror=alert(1)>' }] };
    var profileNameMode_ = null;
    ${fn(PROFILES_JS, 'profileIndex_')}
    ${fn(PROFILES_JS, 'renderSettingsProfiles_')}
    renderSettingsProfiles_();`, context);
  const items = [...document.querySelectorAll('.pref-profile-item')];
  assert.equal(items.length, 2);
  assert.equal(items[1].textContent, '<img src=x onerror=alert(1)>');
  assert.equal(document.querySelectorAll('img').length, 0);
  assert.deepEqual(items.map((b) => b.getAttribute('aria-current')), ['false', 'true']);
  assert.equal(document.getElementById('pref-profile-delete').disabled, false);
  // No HTML sink anywhere in the profile code, here or in the sidebar.
  assert.doesNotMatch(PROFILES_JS, /innerHTML|\.html\(/);
  const picker = STATE_JS.slice(STATE_JS.indexOf('// ── Settings profiles'), STATE_JS.indexOf('function saveSessionAsDefaults'));
  assert.doesNotMatch(picker, /innerHTML|\.html\(/);
  assert.match(picker, /\$\('<option>'\)\.val\(profile\.id\)\.text\(profile\.name\)/);
});

test('a switch or a new profile asks about unsaved changes first; a rename does not', () => {
  assert.match(fn(PROFILES_JS, 'switchToProfile_'), /withUnsavedChangesHandled_\(/);
  assert.match(fn(PROFILES_JS, 'submitProfileName_'), /if \(profileNameMode_ === 'rename'\) \{[\s\S]*?renameSettingsProfile\(id, name\);\s*return;\s*\}\s*withUnsavedChangesHandled_\(/);
  const ask = fn(PROFILES_JS, 'withUnsavedChangesHandled_');
  assert.match(ask, /if \(!formHasUnsavedChanges_\(\)\) \{ proceed\(\); return; \}/);
  assert.match(ask, /ok: 'Save and continue'/);
  assert.match(ask, /onOk: function \(\) \{ saveFormThen_\(proceed\); \}/);
  assert.match(ask, /onAlt: proceed/);
  // Deleting asks its own question, which says unsaved changes are dropped.
  assert.match(fn(PROFILES_JS, 'deleteActiveProfile_'), /Changes not saved here are dropped\./);
  // "Unsaved" is measured against what was last loaded or saved.
  assert.match(fn(PREFS_JS, 'applyPreferencesToForm'), /markFormClean_\(\);/);
  assert.match(PREFS_JS, /markMenuLayoutSaved\(preferenceObject\.menu_layout\);\s*markFormClean_\(preferenceObject\);/);
  assert.match(fn(PROFILES_JS, 'saveFormThen_'), /markFormClean_\(preferenceObject\);/);
});

test('every profile change reloads what it changed and tells an open sidebar', () => {
  const answer = PROFILES_JS.match(/function profileAnswer_\([\s\S]*?\n    \}/)[0];
  assert.match(answer, /if \(reload && result && result\.preferences\) applyPreferencesToForm\(result\.preferences\);\s*markPreferencesSaved\(\);/);
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
  assert.match(sw, /if \(sidebarSessionId\) \{\s*resetSessionOverrides\(announce\);/);
  assert.match(sw, /\.switchSettingsProfile\(id\);/);
  const adopt = fn(STATE_JS, 'adoptSettingsProfiles');
  assert.match(adopt, /settingsProfiles\.active !== before && hasSessionOverrides\(\)\) \{\s*resetSessionOverrides\(\);/);
  // The sidebar re-reads the profiles when it starts and on every Preferences save.
  assert.match(fn(MODE_JS, 'reloadAccountPreferences'), /loadSettingsProfiles\(\);/);
  assert.match(readAppScriptFile('sidebar/js/bootstrap.html'), /loadSettingsProfiles\(\);/);
});
