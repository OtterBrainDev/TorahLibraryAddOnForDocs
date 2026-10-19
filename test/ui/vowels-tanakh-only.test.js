// Pins "Vowels only in Tanakh" and the Cantillation choices: the composition
// card's three-way Vowels (Off / Tanakh / On) and Cantillation (Off / Tanakh /
// Torah) controls, in every host (sidebar, Preferences, Link Texts).
//
// The server has always honoured nekudot_filter = "tanakh", but Preferences
// once only offered Vowels On/Off, and toggling it wrote "always" or "false",
// so the Tanakh-only look the original add-on had could not be chosen, and was
// wiped by any save that touched Vowels. A separate switch fixed that; the
// three-way control replaces it, so each choice writes the whole pair.

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

const ROOT = path.resolve(__dirname, '..', '..');
const read = (file) => fs.readFileSync(path.join(ROOT, 'apps-script', file), 'utf8');
const MARKUP = read('shared/composition-card/markup.html');
const CARD = read('shared/composition-card/shared.html');
const PREFS_HTML = read('preferences.html');
const PREFS_JS = read('preferences/js.html');

function loadCard() {
  const context = {};
  vm.createContext(context);
  vm.runInContext(CARD.replace(/<\/?script>/g, ''), context);
  return context;
}

function choices(id) {
  const group = MARKUP.match(new RegExp(`<div class="cc-seg" id="${id}"[\\s\\S]*?</div>`));
  assert.ok(group, `${id} is a segmented choice`);
  return [...group[0].matchAll(/data-value="([^"]+)"[^>]*>([^<]+)</g)].map((m) => [m[1], m[2]]);
}

test('Vowels is Off / Tanakh / On, and Cantillation Off / Tanakh / Torah', () => {
  assert.deepEqual(choices('cc-vowels-toggle'), [['never', 'Off'], ['tanakh', 'Tanakh'], ['always', 'On']]);
  assert.deepEqual(choices('cc-cantillation-toggle'), [['never', 'Off'], ['tanakh', 'Tanakh'], ['torah', 'Torah']]);
});

test('each choice stores the whole pair the server reads', () => {
  const card = loadCard();
  assert.deepEqual({ ...card.ccVowelsPrefs('tanakh') }, { nekudot: 'true', nekudot_filter: 'tanakh' });
  assert.deepEqual({ ...card.ccVowelsPrefs('always') }, { nekudot: 'true', nekudot_filter: 'always' });
  assert.deepEqual({ ...card.ccVowelsPrefs('never') }, { nekudot: 'false', nekudot_filter: 'false' });
  assert.deepEqual({ ...card.ccCantillationPrefs('torah') }, { teamim: 'true', teamim_filter: 'torah' });
  assert.deepEqual({ ...card.ccCantillationPrefs('never') }, { teamim: 'false', teamim_filter: 'false' });
});

test('Preferences has no separate Tanakh-only switch; its card writes the hidden pair', () => {
  assert.doesNotMatch(PREFS_HTML, /vowels_tanakh_only|Vowels only in Tanakh/);
  for (const id of ['nekudot', 'nekudot_filter', 'teamim', 'teamim_filter']) {
    assert.match(PREFS_HTML, new RegExp(`<input type="hidden" id="${id}" name="${id}"`), id);
  }
  assert.match(PREFS_JS, /if \(key === 'vowels'\) _prefSetCompositionPair\(ccVowelsPrefs\(value\)\);/);
  assert.match(PREFS_JS, /else if \(key === 'cantillation'\) _prefSetCompositionPair\(ccCantillationPrefs\(value\)\);/);
});

test('every host handles the three-way choices', () => {
  for (const file of ['sidebar/js/composition-controls.html', 'preferences/js.html', 'linker-results.html']) {
    assert.match(read(file), /onChoice:/, `${file}: onChoice`);
  }
});
