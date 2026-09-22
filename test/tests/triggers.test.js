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

const TRIGGERS = fs.readFileSync(path.resolve(__dirname, '../../apps-script/triggers.gs'), 'utf8');

const AuthMode = { NONE: 'NONE', LIMITED: 'LIMITED', FULL: 'FULL' };

function load(overrides = {}) {
  const calls = [];
  const store = {};
  const context = {
    console,
    Logger: { log() {} },
    ScriptApp: { AuthMode },
    PropertiesService: { getUserProperties: () => ({ store }) },
    HtmlService: {
      createHtmlOutputFromFile: () => ({ setWidth() { return this; }, setHeight() { return this; } }),
    },
    DocumentApp: { getUi: () => ({ showModalDialog() { calls.push('releaseNotes'); } }) },
    seedDefaultPreferences_: (props) => { calls.push('seed'); props.store.nekudot = 'true'; },
    runUserPreferenceMigrationsIfNeeded_: () => calls.push('migrate'),
    buildAndInstallMenu: () => calls.push('buildMenu'),
    getDefaultMenuLayout_: () => ['default'],
    planMenuFromLayout_: (layout, availability) => ({ layout, availability }),
    installMenuPlan_: (plan) => calls.push(`defaultMenu:${plan.availability.surpriseMeEnabled}`),
  };
  Object.assign(context, overrides(calls));
  vm.createContext(context);
  vm.runInContext(TRIGGERS, context, { filename: 'triggers.gs' });
  return { context, calls, store };
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

test('onOpen in AuthMode.NONE builds the default menu without touching preferences', () => {
  const { context, calls } = load(noOverrides);

  context.onOpen({ authMode: AuthMode.NONE });

  assert.deepEqual(calls, ['defaultMenu:false']);
});

test('onOpen falls back to the default menu when building the menu throws', () => {
  const { context, calls } = load((log) => ({
    buildAndInstallMenu: () => { log.push('buildMenu'); throw new Error('PropertiesService unavailable'); },
  }));

  assert.doesNotThrow(() => context.onOpen({ authMode: AuthMode.LIMITED }));
  assert.deepEqual(calls, ['migrate', 'buildMenu', 'defaultMenu:false']);
});

test('onOpen still builds the menu when a migration throws', () => {
  const { context, calls } = load(() => ({
    runUserPreferenceMigrationsIfNeeded_: () => { throw new Error('bad stored value'); },
  }));

  assert.doesNotThrow(() => context.onOpen({ authMode: AuthMode.FULL }));
  assert.ok(calls.includes('buildMenu'), `no menu after a migration failure: ${calls}`);
});
