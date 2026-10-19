const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { readAppScriptFile } = require('./test-utils');

// Insertion Options and the previews they drive:
// - the tray scrolls, so the end of a tall tray (the Source section's
//   transliteration Style, the Translation section) can be reached in every
//   Display mode; it was clipped in all but Original;
// - a change the fetch applies shows the preview as updating at once;
// - preferences saved in the Preferences dialog reach an open sidebar;
// - the card's transliteration sample follows the Hebrew punctuation setting.

function cssRule(css, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = css.match(new RegExp('(?:^|\\n)' + escaped + '\\s*\\{([^}]*)\\}'));
  assert.ok(match, selector + ' rule exists');
  return match[1];
}

test('the Insertion Options tray is a flex column whose body scrolls', () => {
  const css = readAppScriptFile('css/components/redesign.html');
  const sheet = cssRule(css, '.tray-sheet');
  assert.match(sheet, /display:\s*flex;/);
  assert.match(sheet, /flex-direction:\s*column;/);
  assert.match(sheet, /max-height:/);
  const body = cssRule(css, '.tray-body');
  assert.match(body, /overflow-y:\s*auto;/);
  assert.match(body, /min-height:\s*0;/);
});

test('a change the fetch applies shows the preview as updating at once', () => {
  const js = readAppScriptFile('sidebar/js/composition-controls.html');
  const fn = js.match(/function scheduleSelectedResultRefresh\(\) \{[\s\S]*?\n\}/)[0];
  assert.match(fn, /\$\('\.suggestions'\)\.html\(buildPreviewLoadingHTML\(/);
  assert.ok(fn.indexOf('buildPreviewLoadingHTML') < fn.indexOf('setTimeout'), 'before the wait, not after it');
});

test('every Preferences save tells an open sidebar, which re-reads them and refreshes the preview', () => {
  const prefs = readAppScriptFile('preferences/js.html');
  const saves = prefs.match(/\.setPreferences\(/g) || [];
  // The helper's definition, plus one call per save.
  const marks = prefs.match(/markPreferencesSaved\(\)/g) || [];
  assert.equal(marks.length, saves.length + 1, 'each setPreferences success marks the save');
  const key = prefs.match(/localStorage\.setItem\('([^']+)'/)[1];

  const sidebar = readAppScriptFile('sidebar/js/mode-controller.html');
  assert.match(sidebar, new RegExp("PREFERENCES_SAVED_STORAGE_KEY = '" + key + "'"));
  assert.match(sidebar, /addEventListener\('storage'/);
  const reload = sidebar.match(/function reloadAccountPreferences\(\) \{[\s\S]*?\n\}/)[0];
  assert.match(reload, /\.getPreferences\(\)/);
  assert.match(reload, /applyEffectivePreferencesToUI\(\)/);
  assert.match(reload, /scheduleSelectedResultRefresh\(\)/);
  // The fallback when no storage event comes: the sidebar's next use after it
  // opened Preferences.
  const opener = sidebar.match(/function openPreferencesDialog\(\) \{[\s\S]*?\n\}/)[0];
  assert.match(opener, /preferencesMayHaveChanged = true/);
  assert.doesNotMatch(prefs, /Refresh the sidebar if you want/);
});

function loadCardSample() {
  const js = readAppScriptFile('shared/composition-card/shared.html');
  const labels = js.match(/var CC_TRANSLIT_LABELS = \{[\s\S]*?\n\};/)[0];
  const re = js.match(/var CC_TRANSLIT_MAQAF_RE = [^\n]*/)[0];
  const fn = js.match(/function ccTranslitSample\([\s\S]*?\n\}/)[0];
  const context = {};
  vm.createContext(context);
  vm.runInContext(labels + '\n' + re + '\n' + fn, context);
  return context;
}

test('the card transliteration sample drops the maqaf with Hebrew punctuation off', () => {
  const ctx = loadCardSample();
  const labels = vm.runInContext('CC_TRANSLIT_LABELS', ctx);
  assert.equal(ctx.ccTranslitSample(labels.simple_english, true), "ha-sefer kol-ha'am");
  assert.equal(ctx.ccTranslitSample(labels.simple_english, false), "ha-sefer kol ha'am");
  assert.equal(ctx.ccTranslitSample(labels.traditional, false), 'ha-sēfer kol hā-ʿam');
  // Preferences' own samples (another verse) go through the same helper.
  assert.equal(ctx.ccTranslitSample('Vəśamtem ʾet-dəvaray ʾēleh ʿal-ləvavḵem', false), 'Vəśamtem ʾet dəvaray ʾēleh ʿal ləvavḵem');
  assert.equal(ctx.ccTranslitSample('Ve-samtem et-devarai', false), 'Ve-samtem et devarai', 'the prefix "Ve-" is not a maqaf');
});

test('every card transliteration sample starts with the article on "sefer"', () => {
  const labels = vm.runInContext('CC_TRANSLIT_LABELS', loadCardSample());
  Object.keys(labels).filter((key) => key !== 'none').forEach((key) => {
    assert.match(labels[key], /^has?\W*s/u, key + ': ' + labels[key]);
  });
});
