// Pins the client-side query normalization helpers in
// apps-script/sidebar/js/search-utils.html.
//
// These run on EVERY search: `inputExpanded` feeds the /api/name lookup, the
// direct-reference resolve, and the content search. A normalization bug here
// silently returns zero results for a perfectly valid query rather than
// failing loudly, which is why it earns a pinning test.
//
// Loaded with vm.runInThisContext rather than require() — these are `<script>`
// bodies inside an Apps Script HTML partial, not Node modules. See AGENTS.md
// hard rule #3.

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

const ROOT = path.resolve(__dirname, '..', '..');
const SEARCH_UTILS = path.join(ROOT, 'apps-script/sidebar/js/search-utils.html');

function loadFunction(name) {
  const html = fs.readFileSync(SEARCH_UTILS, 'utf8');
  const match = html.match(new RegExp(`function ${name}\\b[\\s\\S]*?\\n}`));
  assert.ok(match, `Could not find function ${name} in search-utils.html`);
  return vm.runInThisContext(`(${match[0]})`);
}

test('expandShevaApostrophe vocalizes transliterated sheva', () => {
  const expand = loadFunction('expandShevaApostrophe');

  // Word-initial 1-2 consonants + apostrophe is the transliterated sheva.
  assert.equal(expand("P'sukei D'Zimra"), 'Pesukei DeZimra');
  assert.equal(expand("B'reishit"), 'Bereishit');
  assert.equal(expand("Sh'ma"), 'Shema');
  assert.equal(expand("K'tubot"), 'Ketubot');
  assert.equal(expand("Tz'enah"), 'Tzeenah');
});

test('expandShevaApostrophe leaves English possessives and contractions alone', () => {
  const expand = loadFunction('expandShevaApostrophe');

  // Regression: the un-anchored rule turned these into "A Womanes Commentary",
  // "Jacobes Ladder" and "donet", so the query never matched anything.
  assert.equal(expand("A Woman's Commentary"), "A Woman's Commentary");
  assert.equal(expand("The Torah: A Women's Commentary"), "The Torah: A Women's Commentary");
  assert.equal(expand("Jacob's Ladder"), "Jacob's Ladder");
  assert.equal(expand("Israel's kings"), "Israel's kings");
  assert.equal(expand("don't"), "don't");

  // Already unaffected (vowel before the apostrophe), but pin it so a future
  // rewrite of the rule cannot break it either.
  assert.equal(expand("Rashi's commentary"), "Rashi's commentary");
});

test('expandShevaApostrophe handles empty and non-string input', () => {
  const expand = loadFunction('expandShevaApostrophe');

  assert.equal(expand(''), '');
  assert.equal(expand(null), '');
  assert.equal(expand(undefined), '');
});

test('applyConsonantClusterVoweling only touches word-initial clusters', () => {
  const vowel = loadFunction('applyConsonantClusterVoweling');

  assert.equal(vowel('Bshalach'), 'Beshalach');
  // Digraphs are left alone so Shema / Chanukah survive.
  assert.equal(vowel('Shema'), 'Shema');
  assert.equal(vowel('Chanukah'), 'Chanukah');
  // Standard English clusters (second letter r/l) are left alone.
  assert.equal(vowel('Prayer'), 'Prayer');
  assert.equal(vowel('Blessing'), 'Blessing');
});
