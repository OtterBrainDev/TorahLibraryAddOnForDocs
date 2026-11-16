// The Layout controls for "Line by line" and the transliteration's place.
//
// Line by line (bilingual_aligned_rows) pairs each line with its translation
// in every arrangement: side by side a table row per line, Stacked each line
// and then its translation down the page, so its switch shows whenever both
// languages are inserted (it used to show only side by side). The
// transliteration's Position (transliteration_position: below / left / right)
// is a choice in the composition card's Transliteration group, shown side by
// side only (Stacked always puts it under the Hebrew), and the Arrangement
// icons sketch both. The insert side is pinned in test/tests/aligned-rows.test.js.
//
// updateInsertionOptions runs for real, against a stand-in for jQuery that
// records what each selector was last set to.
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

const { readAppScriptFile } = require('./test-utils');

const OPTIONS_MARKUP = readAppScriptFile('shared/insertion-options/markup.html');
const OPTIONS_JS = readAppScriptFile('shared/insertion-options/js.html');
const OPTIONS_CSS = readAppScriptFile('shared/insertion-options/css.html');
const CARD_MARKUP = readAppScriptFile('shared/composition-card/markup.html');
const CARD_JS = readAppScriptFile('shared/composition-card/shared.html');

function recordingJQuery() {
  const state = {};
  const make = (selector) => {
    const record = (state[selector] = state[selector] || { classes: {}, attrs: {}, props: {}, shown: undefined });
    const api = {
      length: 1,
      find: (inner) => make(inner),
      each: () => api,
      off: () => api,
      on: () => api,
      toggle: (on) => { record.shown = on; return api; },
      prop: (key, value) => { record.props[key] = value; return api; },
      attr: (key, value) => { record.attrs[key] = value; return api; },
      toggleClass: (name, on) => { record.classes[name] = on; return api; },
    };
    return api;
  };
  return { $: (selector) => make(typeof selector === 'string' ? selector : '(element)'), state };
}

function runOptions(stateValues, configExtra) {
  const { $, state } = recordingJQuery();
  const context = { $ };
  vm.createContext(context);
  vm.runInContext(CARD_JS.replace(/<\/?script>/g, ''), context);
  vm.runInContext(OPTIONS_JS.replace(/<\/?script>/g, ''), context);
  context.initInsertionOptions(Object.assign({
    root: '#layout-tray',
    getState: () => stateValues,
    onSelectDisplay() {},
    onSelectLayout() {},
    onToggleAlignedRows() {},
  }, configExtra || {}));
  return state;
}

const lineByLineHidden = (state) => state['#layout-rows-toggle'].props.hidden;
const positionInapplicable = (state) => state['#cc-translit-position-row'].classes['is-inapplicable'];

test('Line by line shows for every arrangement of both languages, Stacked included', () => {
  for (const layout of ['he-top', 'he-right', 'he-left']) {
    assert.equal(lineByLineHidden(runOptions({ outputMode: 'both', layout })), false, layout);
  }
  for (const outputMode of ['en', 'he']) {
    assert.equal(lineByLineHidden(runOptions({ outputMode, layout: 'he-top' })), true, `${outputMode}: nothing to pair`);
  }
  // Preferences shows it whatever the display, as a default.
  assert.equal(lineByLineHidden(runOptions({ outputMode: 'en', layout: 'he-top' }, { hideInapplicable: false })), false);
  // A host that can't flip it never shows it.
  assert.equal(lineByLineHidden(runOptions({ outputMode: 'both', layout: 'he-top' }, { onToggleAlignedRows: undefined })), true);
});

test('the transliteration Position applies side by side only (Preferences shows it always)', () => {
  assert.equal(positionInapplicable(runOptions({ outputMode: 'both', layout: 'he-right' })), false);
  assert.equal(positionInapplicable(runOptions({ outputMode: 'both', layout: 'he-left' })), false);
  assert.equal(positionInapplicable(runOptions({ outputMode: 'both', layout: 'he-top' })), true, 'Stacked: always under the Hebrew');
  assert.equal(positionInapplicable(runOptions({ outputMode: 'he', layout: 'he-right' })), true, 'no translation column to sit beside');
  assert.equal(positionInapplicable(runOptions({ outputMode: 'both', layout: 'he-top' }, { hideInapplicable: false })), false);
  // The rule that hides it is the insertion options' own.
  assert.match(OPTIONS_CSS, /\.cc-translit-position-row\.is-inapplicable \{\s*display: none;/);
});

test('the Arrangement icons are told the transliteration\'s place and Line by line', () => {
  const group = (values) => runOptions(Object.assign({ outputMode: 'both', layout: 'he-right' }, values))['.layout-option-group'].attrs;
  assert.deepEqual(group({}), { 'data-translit': 'off', 'data-lines': 'false' });
  assert.deepEqual(group({ transliterationOn: true }), { 'data-translit': 'below', 'data-lines': 'false' });
  assert.deepEqual(group({ transliterationOn: true, transliterationPosition: 'left', alignedRows: true }), { 'data-translit': 'left', 'data-lines': 'true' });
  assert.deepEqual(group({ transliterationOn: true, transliterationPosition: 'sideways' }), { 'data-translit': 'below', 'data-lines': 'false' });
  assert.deepEqual(group({ transliterationOn: false, transliterationPosition: 'right' }), { 'data-translit': 'off', 'data-lines': 'false' });
});

test('each Arrangement icon has the parts its sketch draws', () => {
  const icon = (layout) => OPTIONS_MARKUP.match(new RegExp(`data-layout="${layout}"[\\s\\S]*?</button>`))[0];
  for (const layout of ['he-right', 'he-left']) {
    const cols = [...icon(layout).matchAll(/class="layout-col (\w+)"/g)].map((m) => m[1]).sort();
    assert.deepEqual(cols, ['en', 'he', 'tr'], layout);
  }
  const rows = [...icon('he-top').matchAll(/class="layout-row ([\w -]+)"/g)].map((m) => m[1]);
  assert.deepEqual(rows, ['he', 'tr', 'en', 'he layout-row--next', 'tr layout-row--next', 'en layout-row--next']);
  for (const value of ['off', 'below', 'left', 'right']) {
    if (value !== 'off') assert.ok(OPTIONS_CSS.includes(`[data-translit="${value}"]`), value);
  }
  assert.ok(OPTIONS_CSS.includes('[data-lines="true"]'));
});

test('Position is Below / Left / Right, inside the Transliteration group', () => {
  const group = CARD_MARKUP.match(/<div class="cc-seg" id="cc-translit-position-toggle"[\s\S]*?<\/div>/);
  assert.ok(group, 'a segmented choice');
  assert.match(group[0], /data-cc-choice="translitPosition"/);
  assert.deepEqual([...group[0].matchAll(/data-value="([^"]+)"[^>]*>([^<]+)</g)].map((m) => [m[1], m[2]]),
    [['below', 'Below'], ['left', 'Left'], ['right', 'Right']]);
  // Inside the wrap Preferences → Sidebar hides with the transliteration.
  const wrap = CARD_MARKUP.slice(CARD_MARKUP.indexOf('<div class="cc-translit-wrap" data-sidebar-control="transliteration">'));
  assert.ok(wrap.indexOf('id="cc-translit-position-row"') > 0 && wrap.indexOf('id="cc-translit-position-row"') < wrap.indexOf('id="cc-translit-menu"'));
});

test('the card and the server read a stored position the same way', () => {
  const card = vm.createContext({});
  vm.runInContext(CARD_JS.replace(/<\/?script>/g, ''), card);
  const server = vm.createContext({});
  vm.runInContext(readAppScriptFile('server/insertion.gs').match(/function normalizeTransliterationPosition_[\s\S]*?\n}\n/)[0], server);
  for (const value of ['below', 'left', 'right', 'LEFT', ' right ', '', null, undefined, 'sideways', 'true']) {
    assert.equal(card.ccNormalizeTranslitPosition(value), server.normalizeTransliterationPosition_(value), String(value));
  }
});

test('every host reads and writes the position, and the sidebar sends it with each insert', () => {
  const hosts = {
    'sidebar/js/composition-controls.html': /translitPosition: ccNormalizeTranslitPosition\(effectivePreferences\.transliteration_position\)/,
    'preferences/js.html': /translitPosition: ccNormalizeTranslitPosition\(\(byId\('transliteration_position'\) \|\| \{\}\)\.value\)/,
    'linker-results.html': /translitPosition: custom\.transliteration_position/,
  };
  for (const [file, getState] of Object.entries(hosts)) {
    const source = readAppScriptFile(file);
    assert.match(source, getState, `${file}: the card's getState`);
    assert.match(source, /key === 'translitPosition'/, `${file}: onChoice`);
  }
  for (const file of ['sidebar/js/display-controls.html', 'preferences/js.html', 'linker-results.html']) {
    assert.match(readAppScriptFile(file), /transliterationPosition:/, `${file}: the insertion options' getState`);
  }
  assert.match(readAppScriptFile('preferences.html'), /<input type="hidden" id="transliteration_position" name="transliteration_position" value="below">/);
  assert.match(readAppScriptFile('linker-results.html'), /'transliteration_scheme', 'transliteration_position',/);

  const footer = readAppScriptFile('sidebar/js/footer-actions.html');
  const single = footer.slice(footer.indexOf('.insertReference(data, {'));
  assert.match(single, /transliterationPosition: ccNormalizeTranslitPosition\(effectivePreferences\.transliteration_position\)/);
  const multi = footer.slice(footer.indexOf('.insertReferenceVersions(data.ref, {'), footer.indexOf('.insertReference(data, {'));
  assert.match(multi, /alignedRows: \$\('\.wants-aligned-rows'\)\.is\(':checked'\)/, 'Stacked with several translations reads Line by line too');
  assert.match(multi, /includeTransliteration: \$\('\.include-transliteration'\)\.is\(':checked'\)/, '...and its transliteration');
  assert.match(multi, /transliterationScheme: getSidebarTransliterationScheme\(\)/);
});
