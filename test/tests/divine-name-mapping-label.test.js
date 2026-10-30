// Pins what Preferences → Divine Name Mappings shows for a saved replacement
// after it is reopened (BUG-013), for all four rules.
//
// Observed: God saved as "Other" with TEST$&, and יהוה with a custom pointed
// יְיָ֑, reopened showing the preset label (G-d, יי) beside the custom field,
// while the transform used the custom value. The native <select> is hidden
// behind a custom dropdown whose label is redrawn only by syncCustomSelect;
// loading a saved value (setReplacementSelectValue) set the select and the
// custom field but never redrew the label, so it kept the page's default — for
// another preset as much as for a custom value.
//
// Runs the real functions from preferences/js.html over the real rows from
// preferences.html, in linkedom (skipped, like the sanitizer tests, without it).
// Loaded with vm.runInContext; see AGENTS.md hard rule #3.

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

const ROOT = path.resolve(__dirname, '..', '..');
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');

let parseHTML = null;
try {
  // eslint-disable-next-line global-require
  parseHTML = require('linkedom').parseHTML;
} catch (error) {
  parseHTML = null;
}

// A named function's full source, by brace matching.
function fnSource(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} not found`);
  let depth = 0;
  for (let i = source.indexOf('{', start); i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}' && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`${name}: unbalanced`);
}

const RULES = [
  { id: 'meforash_replacement', preset: "ה'", custom: 'יְיָ֑' },
  { id: 'yaw_replacement', preset: 'השם', custom: 'קָהּ' },
  { id: 'elodim_replacement', preset: 'אלודים', custom: 'אֱלוֹקִים' },
  { id: 'god_replacement', preset: 'HaShem', custom: 'TEST$&' },
];

function load() {
  const page = read('apps-script/preferences.html');
  const rows = RULES.map(({ id }) => {
    const select = page.match(new RegExp(`<select name="${id}"[\\s\\S]*?</select>`))[0];
    const custom = page.match(new RegExp(`<input[^>]*id="${id}_custom"[^>]*>`))[0];
    return `<div class="replacement-row">${select}${custom}</div>`;
  }).join('');
  const { document, window } = parseHTML(`<!doctype html><html><body>${rows}</body></html>`);
  // linkedom keeps no <select> state: no selectedIndex, and assigning .value is
  // ignored. Model the browser's, through the options' `selected` attribute.
  const selectProto = Object.getPrototypeOf(document.querySelector('select'));
  Object.defineProperty(selectProto, 'selectedIndex', {
    configurable: true,
    get() {
      const options = Array.from(this.options);
      const at = options.findIndex((o) => o.hasAttribute('selected'));
      return at >= 0 ? at : (options.length ? 0 : -1);
    },
  });
  Object.defineProperty(selectProto, 'value', {
    configurable: true,
    get() { const o = this.options[this.selectedIndex]; return o ? o.getAttribute('value') : ''; },
    set(value) {
      Array.from(this.options).forEach((o) => {
        if (o.getAttribute('value') === String(value)) o.setAttribute('selected', '');
        else o.removeAttribute('selected');
      });
    },
  });
  const js = read('apps-script/preferences/js.html');
  const source = [
    'byId', 'getCustomField', 'getSelectStoredValue', 'setReplacementSelectValue',
    'toggleCustomReplacementField', 'syncCustomSelect', 'buildCustomSelectMarkupFromSelect', 'enhanceNativeSelect',
  ].map((name) => fnSource(js, name)).join('\n');
  const context = { document, Event: window.Event, console };
  vm.createContext(context);
  vm.runInContext(source, context, { filename: 'preferences/js.html' });
  context.enhanceNativeSelect(RULES.map((r) => `select#${r.id}`).join(','));
  const label = (id) => document.querySelector(`[data-custom-select="${id}"] .custom-select-value`).textContent;
  const customField = (id) => document.getElementById(`${id}_custom`);
  return { context, label, customField };
}

for (const rule of RULES) {
  test(`${rule.id}: the label follows the saved value through preset → custom → preset`, { skip: !parseHTML && 'linkedom not installed' }, () => {
    const { context, label, customField } = load();

    // Reopened with a custom value saved.
    context.setReplacementSelectValue(rule.id, rule.custom);
    assert.equal(label(rule.id), 'Other');
    assert.equal(customField(rule.id).hidden, false);
    assert.equal(customField(rule.id).value, rule.custom);
    assert.equal(context.getSelectStoredValue(rule.id), rule.custom, 'saved back unchanged');

    // Reopened with a preset that is not the page's default.
    context.setReplacementSelectValue(rule.id, rule.preset);
    assert.equal(label(rule.id), rule.preset);
    assert.equal(customField(rule.id).hidden, true);
    assert.equal(context.getSelectStoredValue(rule.id), rule.preset);

    // And back to custom.
    context.setReplacementSelectValue(rule.id, rule.custom);
    assert.equal(label(rule.id), 'Other');
    assert.equal(context.getSelectStoredValue(rule.id), rule.custom);
  });
}

test('a custom value that only differs from a preset by its marks is still custom', { skip: !parseHTML && 'linkedom not installed' }, () => {
  const { context, label } = load();
  context.setReplacementSelectValue('meforash_replacement', 'יְיָ');
  assert.equal(label('meforash_replacement'), 'Other');
  context.setReplacementSelectValue('meforash_replacement', 'יי');
  assert.equal(label('meforash_replacement'), 'יי');
});
