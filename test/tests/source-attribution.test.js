// Pins source attribution: the credit lines under an inserted source.
//
// Many Sefaria texts are CC-BY or CC-BY-NC, so the credit line is on by
// default, and it credits every edition that is actually inserted — the
// Hebrew edition's own license (`heLicense`) included, which used to be read
// nowhere.
//
// Loaded with vm.runInContext; see AGENTS.md hard rule #3.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '../..');

function load() {
  const context = {
    console,
    Logger: { log() {} },
    HtmlService: {},
    DocumentApp: { Attribute: new Proxy({}, { get: (_, k) => String(k) }) },
    PropertiesService: { getUserProperties: () => ({ getProperty: () => null }) },
  };
  vm.createContext(context);
  ['apps-script/server/utils.gs', 'apps-script/server/insertion.gs',
    'apps-script/server/menu-layout.gs', 'apps-script/server/preferences.gs'].forEach((file) => {
    vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), context, { filename: file });
  });
  return context;
}

test('source credit is on by default', () => {
  const { getDefaultPreferences } = load();

  assert.equal(getDefaultPreferences().include_translation_source_info, true);
});

test('the Hebrew edition is credited with its own license', () => {
  const { getHebrewAttributionLines_ } = load();

  assert.deepEqual(
    Array.from(getHebrewAttributionLines_({
      heVersionTitle: 'Miqra according to the Masorah',
      heLicense: 'CC-BY-SA',
    })),
    ['Hebrew: Miqra according to the Masorah', 'License: CC-BY-SA']
  );
  assert.deepEqual(Array.from(getHebrewAttributionLines_({ heVersionTitle: 'Vilna' })), ['Hebrew: Vilna']);
  assert.deepEqual(Array.from(getHebrewAttributionLines_({ heLicense: 'CC0' })), []);
  assert.deepEqual(Array.from(getHebrewAttributionLines_(null)), []);
});

test('citation lines name both licenses when they differ, one when they agree', () => {
  const { buildCitationLines } = load();
  const base = { ref: 'Genesis 1:1', versionTitle: 'JPS', heVersionTitle: 'Masorah' };

  const differ = Array.from(buildCitationLines(Object.assign({ license: 'CC-BY-NC', heLicense: 'CC-BY-SA' }, base), '', true));
  assert.ok(differ.includes('Translation license: CC-BY-NC'), differ.join(' | '));
  assert.ok(differ.includes('Source edition license: CC-BY-SA'), differ.join(' | '));

  const same = Array.from(buildCitationLines(Object.assign({ license: 'CC0', heLicense: 'CC0' }, base), '', true));
  assert.equal(same.filter((l) => /license/i.test(l)).length, 1, same.join(' | '));
  assert.ok(same.includes('License: CC0'));

  const heOnly = Array.from(buildCitationLines(Object.assign({ heLicense: 'CC-BY' }, base), '', true));
  assert.ok(heOnly.includes('License: CC-BY'), heOnly.join(' | '));
});
