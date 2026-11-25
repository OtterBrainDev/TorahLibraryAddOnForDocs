const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { ROOT, readAppScriptFile } = require('./test-utils');

// The sidebar's version lists (sidebar/js/preview-core.html). Reported:
// several translations with the source no longer inserted; a multi-selection
// reset itself; picking one translation left none visibly selected; a misclick
// could leave nothing selected, silently. Causes, each pinned below:
// - the source-edition list shares the .translation-version-select class, so
//   writes meant for the translations also filled the source editions with
//   translation titles, and a source-edition click ran the translation handler;
// - ordinary clicks should replace the selection; modifier clicks extend it,
//   including after the preview rebuilds the list;
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

test('translation clicks replace, toggle or extend a range according to modifiers', () => {
  const update = fnBody(core, 'updateSuggestion');
  const handler = update.slice(update.indexOf("'mousedown.translationToggle'"), update.indexOf("'change.translationVersion'"));
  assert.match(handler, /!select\.multiple/, 'single-select lists keep the native click');
  assert.match(handler, /event\.ctrlKey \|\| event\.metaKey, event\.shiftKey/);
  assert.match(handler, /option:not\(:disabled\)/);
  assert.match(handler, /translationSelectionAnchor \|\| orderedTranslationVersions\[0\]/);
  assert.match(handler, /trigger\('change', \[next\]\)/);
  assert.match(update, /if \(orderedTranslationVersionsRef !== resolvedRef \|\| pendingPreferredVersions \|\| !allowMulti\) \{\s*translationSelectionAnchor = '';/);
  assert.match(update, /if \(Array\.isArray\(pointerSelection\)\) \{\s*next = pointerSelection;/);

  const choose = vm.runInNewContext(fnBody(core, 'translationSelectionForClick') + '\ntranslationSelectionForClick');
  const visible = ['A', 'B', 'D', 'E']; // C is unavailable; hidden versions are not in the list.
  const check = (previous, anchor, clicked, additive, range, expected) => {
    assert.deepEqual(Array.from(choose(previous, visible, anchor, clicked, additive, range)), expected);
  };
  check(['A', 'D'], 'A', 'B', false, false, ['B']);
  check(['hidden', 'A'], 'A', 'B', false, false, ['B']);
  check(['A'], 'A', 'D', true, false, ['A', 'D']);
  check(['A', 'D'], 'D', 'A', true, false, ['D']);
  check(['A'], 'A', 'E', false, true, ['A', 'B', 'D', 'E']);
  check(['E'], 'E', 'B', false, true, ['E', 'B', 'D']);
  check(['hidden', 'A'], 'A', 'D', true, true, ['hidden', 'A', 'B', 'D']);
  check(['hidden', 'A'], 'A', 'D', false, true, ['A', 'B', 'D']);
  check(['hidden'], 'hidden', 'D', false, true, ['D']);
  check(['A'], 'A', 'A', true, false, []); // change handler restores the last pick.
  check(['A'], 'A', 'C', false, true, ['A']); // unavailable option is never added.
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

test('a list box shows its chosen option when it is not focused', () => {
  // `select option { background-color }` also covers the browser's highlight
  // of a chosen option in an unfocused list box, so clicking a translation
  // made the Source editions list look deselected, and the reverse.
  const css = readAppScriptFile('shared/css/native-controls.html');
  const rule = css.match(/select\[multiple\] option:checked,\s*select\[size\]:not\(\[size="1"\]\) option:checked \{([^}]*)\}/);
  assert.ok(rule, 'native-controls styles a list box\'s checked option');
  assert.match(rule[1], /background-color:\s*var\(--option-selected-bg\)/);
  assert.match(css, /--option-selected-bg:\s*#[0-9a-f]{3,6};/i);
});
