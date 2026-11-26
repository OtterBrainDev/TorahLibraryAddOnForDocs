const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const context = { DocumentApp: { ElementType: { TEXT: 'TEXT', BODY_SECTION: 'BODY_SECTION' } },
  Utilities: { DigestAlgorithm: { SHA_256: 'SHA256' }, Charset: { UTF_8: 'UTF8' },
    computeDigest: (_, text) => crypto.createHash('sha256').update(text).digest(),
    base64EncodeWebSafe: bytes => bytes.toString('base64url') } };
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../apps-script/server/document-actions.gs'), 'utf8'), context);
const plain = value => JSON.parse(JSON.stringify(value));
function node(type, children, value) {
  const n = { getType: () => type, getNumChildren: () => children.length,
    getChild: i => children[i], getChildIndex: c => children.indexOf(c),
    asText: () => ({ getText: () => value }) };
  children.forEach(c => { c.getParent = () => n; });
  return n;
}
test('a whole selected paragraph is read and the second identical citation is mapped by position', () => {
  const first = node('TEXT', [], 'Genesis 1:1');
  const second = node('TEXT', [], 'Genesis 1:1');
  const para = node('PARAGRAPH', [second]);
  const body = node('BODY_SECTION', [node('PARAGRAPH', [first]), para]);
  const selection = { getRangeElements: () => [{ getElement: () => para, isPartial: () => false }] };
  const pieces = context.selectedTextPieces_(selection);
  assert.equal(context.selectedPlainText_(selection), 'Genesis 1:1');
  assert.deepEqual(plain(context.selectionBodyRanges_(body, 'Genesis 1:1\nGenesis 1:1', pieces)), [{ start: 12, end: 23 }]);
});
test('selected scan uploads only the specified slice and maps its offsets to the body', () => {
  const result = context.buildScopedLinkerScan_('outside Genesis 1:1 outside', {}, { selected: true, insertIntent: true, ranges: [{ start: 8, end: 19 }] });
  assert.equal(result.payload, 'Genesis 1:1');
  assert.deepEqual(plain(result.segments), [{ docStart: 8, payloadStart: 0, length: 11 }]);
});
test('scoped decisions never relocate to another identical occurrence after edits', () => {
  const text = 'Genesis 1:1\nGenesis 1:1';
  const match = { startChar: 12, endChar: 23, documentText: 'Genesis 1:1', occurrence: 1 };
  context.scopedLinkerPlacement_(match, text, { selected: true });
  assert.deepEqual(plain(context.relocateLinkerDecision_(text, match)), { start: 12, end: 23 });
  assert.equal(context.relocateLinkerDecision_('Genesis 1:1\nother text', match), null);
  assert.equal(context.relocateLinkerDecision_('edited prefix\n' + text, match), null);
  assert.deepEqual(plain(context.relocateLinkerDecision_(text + '\nlater edit', match)), { start: 12, end: 23 });
});
