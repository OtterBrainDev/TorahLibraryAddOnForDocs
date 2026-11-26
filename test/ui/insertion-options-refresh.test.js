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
  // Explicit persistent writes from the Profiles tab.
  const saves = prefs.match(/\.(savePreferenceDefaults|restorePreferencePreset|saveDocumentPreferenceProfile|cloneAccountSettingsForDocument)\(/g) || [];
  assert.equal(saves.length, 4);
  // The helper's definition, plus one call per save, plus one in
  // profileAnswer_, the success handler every settings-profile change uses
  // (a switch, a new profile or a delete rewrites the saved settings).
  const marks = prefs.match(/markPreferencesSaved\(\)/g) || [];
  assert.equal(marks.length, saves.length + 1, 'each save\'s success marks the save');
  const answer = prefs.match(/function profileAnswer_\([\s\S]*?\n    \}/)[0];
  assert.match(answer, /ok: function \(result\) \{[\s\S]*?markPreferencesSaved\(\);/);
  for (const rpc of ['switchSettingsProfile', 'createSettingsProfile', 'renameSettingsProfile', 'deleteSettingsProfile']) {
    assert.match(prefs, new RegExp(`withSuccessHandler\\((answer|created|renamed)\\.ok\\)\\.withFailureHandler\\(\\1\\.fail\\)\\.${rpc}\\(`), rpc);
  }
  // A settings-file import writes too (preferences/settings-file-js).
  const importJs = readAppScriptFile('preferences/settings-file-js.html');
  assert.match(importJs, /withSuccessHandler\(function \(result\) \{[\s\S]*?if \(result\.affectsActive\) \{\s*dialog\.reloadFrom\(result\.preferences\);\s*dialog\.markSaved\(\);\s*\}[\s\S]*?\.applySettingsImportForTarget\(/);
  assert.match(prefs, /markSaved: markPreferencesSaved/);
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
  assert.equal(ctx.ccTranslitSample(labels.simple_english, true), "hasefer khol-ha'am");
  assert.equal(ctx.ccTranslitSample(labels.simple_english, false), "hasefer khol ha'am");
  assert.equal(ctx.ccTranslitSample(labels.traditional, false), 'hasefer khol haʿam');
  // Preferences' own samples (another verse) go through the same helper.
  assert.equal(ctx.ccTranslitSample('Wəśamtem ʾeṯ\u05BEdəvāray ʾēleh ʿal\u05BEləvavḵem', true), 'Wəśamtem ʾeṯ-dəvāray ʾēleh ʿal-ləvavḵem');
  assert.equal(ctx.ccTranslitSample('Wəśamtem ʾeṯ\u05BEdəvāray ʾēleh ʿal\u05BEləvavḵem', false), 'Wəśamtem ʾeṯ dəvāray ʾēleh ʿal ləvavḵem');
  assert.equal(ctx.ccTranslitSample(labels.ipa_modern, false), 'hasefeʁ χol haʔam');
  // The samples keep the maqaf as the Hebrew mark, so a prefix's hyphen
  // (ALA-LC's ha-) is never taken for one.
  assert.equal(ctx.ccTranslitSample(labels.ala_lc, true), 'ha-sefer khol-ha-ʻam');
  assert.equal(ctx.ccTranslitSample(labels.ala_lc, false), 'ha-sefer khol ha-ʻam');
});

test('every card transliteration sample starts with the article on "sefer"', () => {
  const labels = vm.runInContext('CC_TRANSLIT_LABELS', loadCardSample());
  Object.keys(labels).filter((key) => key !== 'none').forEach((key) => {
    assert.match(labels[key], /^has?\W*s/u, key + ': ' + labels[key]);
  });
});


test('applying preferences reaches only the matching sidebar preview and acknowledges the temporary write', () => {
  const sidebar = readAppScriptFile('sidebar/js/mode-controller.html');
  const handler = sidebar.match(/function applyPreferencesToCurrentPreview\(event\) \{[\s\S]*?\n\}/)[0];
  const reported = [], saved = [], refreshed = [];
  const ctx = vm.createContext({
    sidebarPreferenceChannel: () => 'doc-and-tab',
    appMode: 'texts', hasResolvedReference: true, sidebarSessionId: 's1', sessionSaveQueue: {},
    getAppConfig: () => ({ sidebarPreferenceKeys: ['source_notes_mode'] }),
    activeSettingsProfile: () => ({ id: 'p2' }),
    localStorage: { setItem: (key, val) => reported.push([key, JSON.parse(val)]), removeItem() {} },
    saveSessionPreference(changes, done) { saved.push({ ...changes }); ctx.done = done; },
    scheduleSelectedResultRefresh() { refreshed.push(true); },
  });
  vm.runInContext(handler, ctx);
  const send = (key, profile) => ctx.applyPreferencesToCurrentPreview({
    key, newValue: JSON.stringify({ id: '123', profile, values: { source_notes_mode: 'inline', menu_layout: 'shared' } }),
  });
  send('other-document', 'p2');
  assert.equal(saved.length, 0);
  send('doc-and-tab', 'p1');
  assert.match(reported.at(-1)[1].message, /different profile/);
  assert.equal(saved.length, 0);
  ctx.hasResolvedReference = false;
  send('doc-and-tab', 'p2');
  assert.match(reported.at(-1)[1].message, /Preview a source/);
  assert.equal(saved.length, 0);
  ctx.hasResolvedReference = true;
  send('doc-and-tab', 'p2');
  assert.deepEqual(saved, [{ source_notes_mode: 'inline' }]);
  assert.equal(refreshed.length, 1);
  assert.equal(reported.length, 2, 'no acknowledgement before the queued session write lands');
  ctx.done();
  assert.deepEqual(reported.at(-1), ['doc-and-tab:ack', { id: '123', message: 'Applied for this sidebar session. The preview will refresh.' }]);
});
