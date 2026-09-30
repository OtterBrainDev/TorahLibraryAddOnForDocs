// Pins the Preferences switch "Vowels only in Tanakh" (apps-script/preferences.html,
// preferences/js.html).
//
// The server has always honoured nekudot_filter = "tanakh", but Preferences
// only offered Vowels On/Off, and toggling it wrote "always" or "false", so
// the Tanakh-only look the original add-on had could not be chosen, and was
// wiped by any save that touched Vowels.

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

const ROOT = path.resolve(__dirname, '..', '..');
const JS = fs.readFileSync(path.join(ROOT, 'apps-script/preferences/js.html'), 'utf8');
const HTML = fs.readFileSync(path.join(ROOT, 'apps-script/preferences.html'), 'utf8');

function load(fields) {
  const context = { byId: (id) => fields[id] || null };
  vm.createContext(context);
  ['vowelsTanakhOnly_', '_prefSetCompositionVowels', 'syncVowelsTanakhOnly_'].forEach((name) => {
    const match = JS.match(new RegExp(`function ${name}\\([^)]*\\) \\{[\\s\\S]*?\\n    \\}`));
    assert.ok(match, `Could not find ${name}`);
    vm.runInContext(match[0], context);
  });
  return context;
}

function fields(nekudot, filter, tanakhOnly) {
  return {
    nekudot: { value: nekudot },
    nekudot_filter: { value: filter },
    vowels_tanakh_only: { checked: tanakhOnly },
  };
}

test('the switch exists and has no name, so it is never stored as a preference key', () => {
  const tag = HTML.match(/<input id="vowels_tanakh_only"[^>]*>/);
  assert.ok(tag, 'switch present in Preferences');
  assert.doesNotMatch(tag[0], /\sname=/);
});

test('turning the switch on with Vowels on stores "tanakh"; off stores "always"', () => {
  const f = fields('true', 'always', true);
  load(f).syncVowelsTanakhOnly_();
  assert.equal(f.nekudot_filter.value, 'tanakh');
  f.vowels_tanakh_only.checked = false;
  load(f).syncVowelsTanakhOnly_();
  assert.equal(f.nekudot_filter.value, 'always');
});

test('turning Vowels back on keeps Tanakh-only instead of resetting it to "always"', () => {
  const f = fields('false', 'false', true);
  load(f)._prefSetCompositionVowels(true);
  assert.equal(f.nekudot.value, 'true');
  assert.equal(f.nekudot_filter.value, 'tanakh');
});

test('Vowels off still stores off, whatever the switch says', () => {
  const f = fields('true', 'tanakh', true);
  const ctx = load(f);
  ctx._prefSetCompositionVowels(false);
  assert.equal(f.nekudot.value, 'false');
  ctx.syncVowelsTanakhOnly_();
  assert.equal(f.nekudot_filter.value, 'false', 'the switch has no effect while Vowels is off');
});
