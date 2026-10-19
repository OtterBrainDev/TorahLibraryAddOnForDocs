// Pins that a sidebar insert is titled with the text chosen, not the search.
//
// The bug: the Texts tab's Insert sent the search box's contents as
// preferredTitle, and the server prefers preferredTitle over data.ref. Search
// for "shema", pick Deuteronomy 6:4, and the inserted title read "shema". See
// docs/regression-log.md.

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const ROOT = path.resolve(__dirname, '..', '..');
const source = fs.readFileSync(path.join(ROOT, 'apps-script/sidebar/js/footer-actions.html'), 'utf8');

function callOptions(marker) {
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, marker + ' not found');
  const rest = source.slice(start);
  return rest.slice(0, rest.indexOf('});'));
}

test('the single insert does not title the source with the search query', () => {
  const call = callOptions('.insertReference(data');
  assert.doesNotMatch(call, /preferredTitle/);
});

test('the multi-translation insert does not title the source with the search query', () => {
  const call = callOptions('.insertReferenceVersions(');
  assert.doesNotMatch(call, /preferredTitle/);
});

test('the Texts insert path never reads the search box', () => {
  const texts = source.slice(source.indexOf('// --- Texts mode'));
  const handler = texts.slice(0, texts.indexOf('$(\'#open-on-sefaria\')'));
  assert.doesNotMatch(handler, /\$\(['"]\.input['"]\)/);
});
