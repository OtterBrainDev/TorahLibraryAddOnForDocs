// Pins setPreferences (apps-script/server/preferences.gs).
//
// setPreferences, setAccountPreferences and saveSidebarSessionAsAccountDefaults
// are all reachable from google.script.run, so their argument is untrusted.
// Internal state shares the same UserProperties store — most importantly
// `linker_upload_acknowledged`, which is the only thing standing between the
// user and an undisclosed document upload, and `prefs_schema_version`, which
// gates the migrations. Only SETTINGS keys may be written through this path.
//
// Loaded with vm.runInContext; see AGENTS.md hard rule #3.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SERVER = path.resolve(__dirname, '../../apps-script/server');

function load(initial = {}) {
  const store = Object.assign({}, initial);
  const userProperties = {
    getProperty(name) {
      return Object.prototype.hasOwnProperty.call(store, name) ? store[name] : null;
    },
    setProperty(name, value) {
      store[name] = String(value);
      return this;
    },
  };
  const context = {
    console,
    Logger: { log() {} },
    PropertiesService: { getUserProperties: () => userProperties },
  };
  vm.createContext(context);
  ['menu-layout.gs', 'preferences.gs'].forEach((file) => {
    vm.runInContext(fs.readFileSync(path.join(SERVER, file), 'utf8'), context, { filename: file });
  });
  return { context, store };
}

test('stores SETTINGS keys, coercing primitives to strings', () => {
  const { context, store } = load();

  context.setPreferences({ nekudot: true, hebrew_font_size: 14, hebrew_font: 'Frank Ruehl' });

  assert.equal(store.nekudot, 'true');
  assert.equal(store.hebrew_font_size, '14');
  assert.equal(store.hebrew_font, 'Frank Ruehl');
});

test('drops keys outside SETTINGS, including internal state', () => {
  const { context, store } = load({ prefs_schema_version: '10' });

  context.setPreferences({
    linker_upload_acknowledged: 'true',
    prefs_schema_version: '1',
    SL_DIALOG_ACTION: '{"closed":true}',
    arbitrary_junk_key: 'x',
    nekudot: false,
  });

  assert.equal(store.linker_upload_acknowledged, undefined);
  assert.equal(store.prefs_schema_version, '10');
  assert.equal(store.SL_DIALOG_ACTION, undefined);
  assert.equal(store.arbitrary_junk_key, undefined);
  assert.equal(store.nekudot, 'false');
});

test('the same filter applies via setAccountPreferences and session save', () => {
  const { context, store } = load();
  context.CacheService = {
    getUserCache: () => ({
      get: () => JSON.stringify({ linker_upload_acknowledged: 'true', teamim: true }),
      remove() {},
    }),
  };

  context.setAccountPreferences({ linker_upload_acknowledged: 'true' });
  context.saveSidebarSessionAsAccountDefaults('session-1');

  assert.equal(store.linker_upload_acknowledged, undefined);
  assert.equal(store.teamim, 'true');
});

test('rejects non-primitive and oversized values', () => {
  const { context, store } = load();

  context.setPreferences({
    hebrew_font: { toString: () => 'object' },
    translation_font: null,
    transliteration_overrides: 'x'.repeat(9001),
    menu_layout: 'y'.repeat(9000),
  });

  assert.equal(store.hebrew_font, undefined);
  assert.equal(store.translation_font, undefined);
  assert.equal(store.transliteration_overrides, undefined);
  assert.equal(store.menu_layout.length, 9000);
});

test('tolerates a missing or non-object argument', () => {
  const { context } = load();

  assert.doesNotThrow(() => context.setPreferences());
  assert.doesNotThrow(() => context.setPreferences(null));
  assert.doesNotThrow(() => context.setPreferences('nekudot'));
});
