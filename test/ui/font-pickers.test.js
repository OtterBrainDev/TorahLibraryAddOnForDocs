// The font pickers (shared/fonts) and the composition card's font buttons.
// A beta tester saw empty boxes for every cantillation mark after choosing
// David Libre, which has none; the card now draws its preview in the real
// font, with the missing marks borrowed the way the insert will draw them, and
// the Layout tray, Preferences and Link Texts can each change the Hebrew and
// translation fonts there. See server/hebrew-fonts.gs. The borrowing is a
// design decision explained in Help, not a switch or a note in any font UI.
const test = require('node:test');
const assert = require('node:assert/strict');

const { readAppScriptFile } = require('./test-utils');

const HOSTS = ['sidebar.html', 'preferences.html', 'linker-results.html'];

test('every composition-card host turns on the fonts feature and loads shared/fonts first', () => {
  for (const template of HOSTS) {
    const html = readAppScriptFile(template);
    assert.match(html, /data-cc-features="[^"]*\bfonts\b[^"]*"/, `${template}: no fonts feature`);
    const coverage = html.indexOf("include('shared/fonts/coverage')");
    const fonts = html.indexOf("include('shared/fonts/js')");
    const card = html.indexOf("include('shared/composition-card/shared')");
    assert.ok(coverage >= 0 && fonts > coverage && card > fonts, `${template}: coverage, then fonts js, then the card`);
  }
});

test('every host tells the card how to change a font, and the stored borrowing setting', () => {
  const adapters = {
    'sidebar.html': readAppScriptFile('sidebar/js/composition-controls.html'),
    'preferences.html': readAppScriptFile('preferences/js.html'),
    'linker-results.html': readAppScriptFile('linker-results.html'),
  };
  for (const [host, source] of Object.entries(adapters)) {
    assert.match(source, /onFontChange:/, `${host}: onFontChange`);
    assert.doesNotMatch(source, /onBorrowMarksChange/, `${host}: no borrowing control`);
    assert.match(source, /borrowMarks:/, `${host}: getState().fonts.borrowMarks`);
  }
});

test('the card\'s font fields have no name: Preferences saves every named field', () => {
  const markup = readAppScriptFile('shared/composition-card/markup.html');
  const panel = markup.slice(markup.indexOf('id="cc-font-panel"'));
  const fields = panel.slice(0, panel.indexOf('</div>\n  </div>')).match(/<(select|input)\b[^>]*>/g) || [];
  assert.equal(fields.length, 2, 'font and size fields, and no borrowing checkbox');
  for (const field of fields) assert.doesNotMatch(field, /\bname=/, field);
});

test('Preferences font selects are filled from the one list, and there is no borrowing switch', () => {
  const html = readAppScriptFile('preferences.html');
  for (const id of ['source_title_font', 'sefaria_link_font', 'hebrew_font', 'transliteration_font', 'translation_font', 'emphasis_bold_font', 'emphasis_italic_font']) {
    const select = html.match(new RegExp(`<select name="${id}" id="${id}" data-font-role="(hebrew|latin)">([\\s\\S]*?)</select>`));
    assert.ok(select, `${id}: data-font-role`);
    // Only the empty "match" option is written out; the rest comes from shared/fonts.
    assert.equal((select[2].match(/<option/g) || []).length, 1, `${id}: a private font list`);
  }
  assert.doesNotMatch(html, /hebrew_mark_fallback|Borrow missing marks/);
});

test('fonts Docs does not have are never offered, only kept for whoever chose one', () => {
  const js = readAppScriptFile('shared/fonts/js.html');
  const list = (name) => JSON.parse(js.match(new RegExp(`var ${name} = (\\[[\\s\\S]*?\\]);`))[1].replace(/'/g, '"'));
  const offered = list('FONT_PICKER_HEBREW').concat(list('FONT_PICKER_OTHER'));
  for (const font of list('FONTS_NOT_IN_DOCS')) assert.ok(!offered.includes(font), font);
  for (const font of ['SBL Hebrew', 'Ezra SIL', 'David', 'Taamey Frank CLM']) assert.ok(list('FONTS_NOT_IN_DOCS').includes(font), font);
  // The font from the report is offered.
  assert.ok(list('FONT_PICKER_HEBREW').includes('David Libre'));
});

test('the preview draws only through createElement / textContent', () => {
  const js = readAppScriptFile('shared/fonts/js.html') + readAppScriptFile('shared/composition-card/shared.html');
  assert.doesNotMatch(js, /\.innerHTML\s*=|\.html\(/);
});

test('no font UI talks about borrowed marks; Help does', () => {
  const sources = ['shared/composition-card/markup.html', 'shared/composition-card/shared.html', 'shared/fonts/js.html', 'preferences.html']
    .map((file) => readAppScriptFile(file)).join('\n')
    // Comments may explain the design; only what is shown counts.
    .replace(/<!--[\s\S]*?-->/g, '').replace(/^\s*(\/\/|\*).*$/gm, '');
  assert.doesNotMatch(sources, /['"][^'"\n]*\b(borrow|missing marks|cantillation marks)\b[^'"\n]*['"]/i);
  assert.match(readAppScriptFile('help-modal.html'), /Noto Serif Hebrew/);
});
