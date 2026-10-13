// Pins that the sidebar's Layout tray pills reach the inserted text.
//
// The bug: in the Texts tab, toggling Cantillation (or Vowels, or either
// Punctuation pill) in the Layout tray saves a sidebar *session* override
// (setSidebarSessionState), not a stored preference. Those marks are stripped
// when the text is fetched, and the sidebar fetched with findReference, which
// reads only UserProperties, so the preview and the insert kept the marks the
// pill said were off. See docs/regression-log.md.
//
// Loaded with vm.runInContext; .gs is not a Node module format.

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

const ROOT = path.resolve(__dirname, '..', '..');
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');

// Vowels plus a tipcha (U+0596), the cantillation mark.
const WITH_TEAMIM = 'בְּרֵאשִׁ֖ית';
const NO_TEAMIM = 'בְּרֵאשִׁית';
const CONSONANTS = 'בראשית';

function load(stored, sessions) {
  const writes = [];
  const context = {
    console,
    Logger: { log() {} },
    UrlFetchApp: { fetch: () => ({ getResponseCode: () => 200, getContentText: () => JSON.stringify({ ref: 'Genesis 1:1', he: [WITH_TEAMIM], text: ['In the beginning'], type: 'Tanakh' }) }) },
    PropertiesService: { getUserProperties: () => ({
      getProperty: (key) => (key in stored ? stored[key] : null),
      setProperty: (key, value) => writes.push([key, value])
    }) },
    CacheService: { getUserCache: () => ({
      get: (key) => (key in sessions ? JSON.stringify(sessions[key]) : null),
      put: (key, value) => writes.push([key, value])
    }) },
    applyHebrewDivineNamePreferences: (d) => d,
    applyEnglishDivineNamePreference: () => {},
    expandCitationAbbreviations_: () => [],
    normalizeReferenceInput: (r) => r,
    stripHebrewNumeralMarks_: (r) => r
  };
  vm.createContext(context);
  ['apps-script/server/text-processing.gs', 'apps-script/server/preferences.gs', 'apps-script/server/sefaria-fetch.gs'].forEach((relative) => {
    vm.runInContext(read(relative), context, { filename: relative });
  });
  context.writes = writes;
  return context;
}

test('the session\'s Cantillation: Off strips cantillation even when the stored preference is on', () => {
  const ctx = load({ teamim: 'true', nekudot: 'true' }, { sidebar_session_s1: { teamim: false } });
  assert.equal(ctx.findReferenceForSidebar('Genesis 1:1', null, 's1').he[0], NO_TEAMIM);
  // findReference itself still reads only the stored preferences.
  assert.equal(ctx.findReference('Genesis 1:1').he[0], WITH_TEAMIM);
  assert.deepEqual(ctx.writes, []);
});

test('the session\'s Cantillation: On keeps cantillation the stored preference turns off', () => {
  const ctx = load({ teamim: 'false' }, { sidebar_session_s1: { teamim: true } });
  assert.equal(ctx.findReferenceForSidebar('Genesis 1:1', null, 's1').he[0], WITH_TEAMIM);
});

test('the session\'s Vowels: Off strips vowels', () => {
  const ctx = load({}, { sidebar_session_s1: { nekudot: false, teamim: false } });
  assert.equal(ctx.findReferenceForSidebar('Genesis 1:1', null, 's1').he[0], CONSONANTS);
});

test('no session (or an empty one) fetches with the stored preferences', () => {
  const ctx = load({ teamim: 'false' }, {});
  assert.equal(ctx.findReferenceForSidebar('Genesis 1:1', null, null).he[0], NO_TEAMIM);
  assert.equal(ctx.findReferenceForSidebar('Genesis 1:1', null, 'unknown').he[0], NO_TEAMIM);
});

test('only SETTINGS keys are read from the session', () => {
  const ctx = load({}, { sidebar_session_s1: { teamim: { nested: true }, not_a_setting: 'x' } });
  assert.equal(ctx.findReferenceForSidebar('Genesis 1:1', null, 's1').he[0], WITH_TEAMIM);
  const overlay = ctx.sidebarSessionPreferenceOverlay_('s1');
  assert.equal(overlay.getProperty('not_a_setting'), null);
});

test('every sidebar fetch goes through the session-aware findReferenceForSidebar', () => {
  const dir = path.join(ROOT, 'apps-script/sidebar/js');
  fs.readdirSync(dir).forEach((name) => {
    const source = read(path.join('apps-script/sidebar/js', name));
    assert.doesNotMatch(source, /\.findReference\(/, name + ' calls findReference, which ignores the session');
    (source.match(/\.findReferenceForSidebar\([^)]*\)/g) || []).forEach((call) => {
      assert.match(call, /sidebarSessionId\)$/, name + ': ' + call + ' does not pass the session');
    });
  });
});

test('the sidebar\'s inserts carry the session: multi-version re-fetch and transliteration scheme', () => {
  const source = read('apps-script/sidebar/js/footer-actions.html');
  const multi = source.slice(source.indexOf('.insertReferenceVersions('));
  assert.match(multi.slice(0, multi.indexOf('});')), /sessionId: sidebarSessionId/);
  const single = source.slice(source.indexOf('.insertReference(data'));
  assert.match(single.slice(0, single.indexOf('});')), /transliterationScheme: getSidebarTransliterationScheme\(\)/);
});
