const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { ROOT, readAppScriptFile } = require('./test-utils');

// The sidebar's version lists (sidebar/js/preview-core.html). Reported:
// several translations with the source no longer inserted; a multi-selection
// reset itself; picking one translation left none visibly selected; a misclick
// could leave nothing selected, silently. Causes, each pinned below:
// - the source-edition list shares the .translation-version-select class, so
//   writes meant for the translations also filled the source editions with
//   translation titles, and a source-edition click ran the translation handler;
// - a plain click in a multi-select list replaced the selection;
// - every re-render of the same passage dropped the multi-selection;
// - a click could empty a list, and Insert then used whatever was loaded.

const core = readAppScriptFile('sidebar/js/preview-core.html');

function fnBody(source, name) {
  const start = source.indexOf('function ' + name + '(');
  assert.ok(start >= 0, name + ' exists');
  const next = source.indexOf('\nfunction ', start + 1);
  return source.slice(start, next < 0 ? source.length : next);
}

test('no sidebar script reaches the translation list by the class the source editions share', () => {
  const dir = path.join(ROOT, 'apps-script/sidebar/js');
  fs.readdirSync(dir).filter((f) => f.endsWith('.html')).forEach((file) => {
    const js = fs.readFileSync(path.join(dir, file), 'utf8');
    const pattern = /\$\('\.translation-version-select'\)/g;
    let match;
    while ((match = pattern.exec(js))) {
      const after = js.slice(match.index + match[0].length, match.index + match[0].length + 30);
      assert.ok(after.startsWith(".not('.he-version-selection')"),
        file + ': $(\'.translation-version-select\') also matches the source-edition list; use translationVersionSelect()');
    }
  });
});

test('the translation handlers are bound to the translation list only', () => {
  const update = fnBody(core, 'updateSuggestion');
  assert.match(update, /translationVersionSelect\(\)\.off\('change\.translationVersion'\)/);
  assert.match(update, /translationVersionSelect\(\)\.off\('mousedown\.translationToggle'\)/);
});

test('in a multi-select list a click toggles one translation instead of replacing the selection', () => {
  const update = fnBody(core, 'updateSuggestion');
  const handler = update.slice(update.indexOf("'mousedown.translationToggle'"), update.indexOf("'change.translationVersion'"));
  assert.match(handler, /!select\.multiple/, 'single-select lists keep the native click');
  assert.match(handler, /event\.preventDefault\(\)/);
  assert.match(handler, /this\.selected = !this\.selected/);
  assert.match(handler, /trigger\('change'\)/);
});

test('re-rendering the same passage keeps a multi-selection; a new passage starts over', () => {
  const update = fnBody(core, 'updateSuggestion');
  assert.match(update, /orderedTranslationVersionsRef === resolvedRef && orderedTranslationVersions\.length > 1/);
  // A layout that inserts one translation keeps the first one picked.
  assert.match(update, /!allowMulti && keptTranslationVersions\.length > 1[\s\S]{0,80}collapseToVersion = keptTranslationVersions\[0\]/);
});

test('neither list can be left with nothing selected', () => {
  const update = fnBody(core, 'updateSuggestion');
  const translation = update.slice(update.indexOf("'change.translationVersion'"), update.indexOf("'change.heVersion'"));
  assert.match(translation, /if \(!next\.length\) \{\s*selectOptions\(\$select, orderedTranslationVersions\);/);
  const hebrew = update.slice(update.indexOf("'change.heVersion'"));
  assert.match(hebrew, /if \(!selected\) \{[\s\S]{0,200}selectOptions\(\$\(this\), \[currentHeVersion\]\);/);
});

test('the filter box narrows the lists without changing what is selected', () => {
  const update = fnBody(core, 'updateSuggestion');
  const render = update.slice(update.indexOf('function renderTranslationOptions'), update.indexOf('function renderHebrewOptions'));
  assert.match(render, /if \(!query && orderedTranslationVersions\.length <= 1\)/);
  // A version the filter hides can't have been deselected.
  assert.match(update, /selectedArr\.indexOf\(vt\) >= 0 \|\| \(\$select\.prop\('multiple'\) && shown\.indexOf\(vt\) < 0\)/);
});
