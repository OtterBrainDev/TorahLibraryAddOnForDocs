// Pins the simple triggers in apps-script/triggers.gs.
//
// Two Marketplace-review failure modes live here:
//   1. onInstall that does not build the menu. onOpen does not fire for the
//      document the add-on was installed from, so the menu only appeared after
//      a reload.
//   2. onOpen that throws. An exception while migrating or reading preferences
//      left the document with no add-on menu at all.
//
// Loaded with vm.runInContext against stubs; see AGENTS.md hard rule #3.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const read = (file) => fs.readFileSync(path.resolve(__dirname, '../../apps-script', file), 'utf8');

const AuthMode = { NONE: 'NONE', LIMITED: 'LIMITED', FULL: 'FULL' };

function load(overrides = {}) {
  const calls = [];
  const store = {};
  const menus = [];
  const context = {
    console,
    Logger: { log() {} },
    ScriptApp: {
      AuthMode,
      AuthorizationStatus: { NOT_REQUIRED: 'NOT_REQUIRED', REQUIRED: 'REQUIRED' },
      getAuthorizationInfo(mode) {
        assert.equal(mode, AuthMode.FULL);
        return { getAuthorizationStatus: () => 'NOT_REQUIRED' };
      },
    },
    PropertiesService: { getUserProperties: () => ({ store }) },
    HtmlService: {
      createHtmlOutputFromFile: () => ({ setWidth() { return this; }, setHeight() { return this; } }),
    },
    DocumentApp: { getUi: () => ({ showModalDialog() { calls.push('releaseNotes'); } }) },
    seedDefaultPreferences_: (props) => { calls.push('seed'); props.store.nekudot = 'true'; },
    runUserPreferenceMigrationsIfNeeded_: () => calls.push('migrate'),
    buildAndInstallMenu: () => calls.push('buildMenu'),
    installMenuPlan_: (plan) => { menus.push(Array.from(plan, (entry) => entry.label || entry.type)); calls.push('starterMenu'); },
    // Setup already done: the reinstall case, which keeps the release notes.
    maybeShowFirstRunSetup_: () => false,
  };
  Object.assign(context, overrides(calls));
  vm.createContext(context);
  for (const file of ['server/menu-layout.gs', 'server/factory-preferences.gs', 'triggers.gs']) {
    vm.runInContext(read(file), context, { filename: file });
  }
  return { context, calls, store, menus };
}

const noOverrides = () => ({});

test('onInstall seeds preferences and migrates, then builds the menu, then shows release notes', () => {
  const { context, calls, store } = load(noOverrides);

  context.onInstall({ authMode: AuthMode.FULL });

  const seeded = calls.indexOf('seed');
  const migrated = calls.indexOf('migrate');
  const menu = calls.indexOf('buildMenu');
  const notes = calls.indexOf('releaseNotes');
  assert.ok(seeded >= 0 && migrated > seeded, `preferences not seeded then migrated: ${calls}`);
  assert.ok(menu > migrated, `menu must be built after seeding: ${calls}`);
  assert.ok(notes > menu, `release notes must come after the menu: ${calls}`);
  assert.equal(store.nekudot, 'true');
});

test('onInstall still builds the menu if seeding preferences fails', () => {
  const { context, calls } = load(() => ({
    seedDefaultPreferences_: () => { throw new Error('quota'); },
  }));

  context.onInstall({ authMode: AuthMode.FULL });

  assert.ok(calls.includes('buildMenu'), `no menu after a seeding failure: ${calls}`);
});

const STARTER_MENU = [
  'Add Sources with Sefaria', 'Link Texts with Sefaria', 'Transform Divine Names',
  'separator', 'Preferences', 'Help',
];

test('onOpen in AuthMode.NONE builds the starter menu without checking authorization or preferences', () => {
  const { context, calls, menus } = load(() => ({
    PropertiesService: { getUserProperties() { assert.fail('preference access before authorization'); } },
  }));
  context.ScriptApp.getAuthorizationInfo = () => assert.fail('authorization check in NONE');
  context.onOpen({ authMode: AuthMode.NONE });
  assert.deepEqual(calls, ['starterMenu']);
  assert.deepEqual(menus, [STARTER_MENU]);
});

test('an editor in LIMITED who still needs to authorize sees the starter menu', () => {
  const { context, calls, menus } = load(noOverrides);
  context.ScriptApp.getAuthorizationInfo = () => ({ getAuthorizationStatus: () => 'REQUIRED' });
  context.onOpen({ authMode: AuthMode.LIMITED });
  assert.deepEqual(calls, ['starterMenu']);
  assert.deepEqual(menus, [STARTER_MENU]);
});

test('the starter menu still appears when Google cannot report consent', () => {
  const { context, calls, menus } = load(noOverrides);
  context.ScriptApp.getAuthorizationInfo = () => { throw new Error('Unavailable'); };
  context.onOpen({ authMode: AuthMode.LIMITED });
  assert.deepEqual(calls, ['starterMenu']);
  assert.deepEqual(menus, [STARTER_MENU]);
});

test('an authorized editor in LIMITED gets their saved menu', () => {
  const { context, calls } = load(noOverrides);
  context.onOpen({ authMode: AuthMode.LIMITED });
  assert.deepEqual(calls, ['migrate', 'buildMenu']);
});

test('onOpen falls back to the starter menu when building the saved menu throws', () => {
  const { context, calls, menus } = load((log) => ({
    buildAndInstallMenu: () => { log.push('buildMenu'); throw new Error('PropertiesService unavailable'); },
  }));

  assert.doesNotThrow(() => context.onOpen({ authMode: AuthMode.LIMITED }));
  assert.deepEqual(calls, ['migrate', 'buildMenu', 'starterMenu']);
  assert.deepEqual(menus, [STARTER_MENU]);
});

test('onOpen still builds the menu when a migration throws', () => {
  const { context, calls } = load(() => ({
    runUserPreferenceMigrationsIfNeeded_: () => { throw new Error('bad stored value'); },
  }));

  assert.doesNotThrow(() => context.onOpen({ authMode: AuthMode.FULL }));
  assert.ok(calls.includes('buildMenu'), `no menu after a migration failure: ${calls}`);
});

test('onInstall shows first-run setup instead of the release notes for a new user, after the menu', () => {
  const { context, calls } = load((calls) => ({
    maybeShowFirstRunSetup_: () => { calls.push('setup'); return true; },
  }));

  context.onInstall({ authMode: AuthMode.FULL });

  assert.ok(calls.indexOf('setup') > calls.indexOf('buildMenu'), `setup must come after the menu: ${calls}`);
  assert.ok(!calls.includes('releaseNotes'), `release notes shown over setup: ${calls}`);
});

test('onInstall still shows the release notes if first-run setup fails', () => {
  const { context, calls } = load(() => ({
    maybeShowFirstRunSetup_: () => { throw new Error('quota'); },
  }));

  context.onInstall({ authMode: AuthMode.FULL });

  assert.ok(calls.includes('releaseNotes'), `no dialog at all after a setup failure: ${calls}`);
});
