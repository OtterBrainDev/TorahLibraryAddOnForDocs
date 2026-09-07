// Pins the linker pre-filter: the logic that decides which parts of a user's
// document are allowed to leave their machine, and how offsets in the reduced
// payload map back onto the document.
//
// Two things must hold, and both are load-bearing:
//   1. Prose with no citation shape must NOT be uploaded (the privacy claim).
//   2. Offsets must map back exactly, or "Link Texts with Sefaria" hyperlinks
//      the wrong words — a silent, document-corrupting failure.
//
// Loaded with vm.runInThisContext, not require(); .gs is not a Node module
// format. See AGENTS.md hard rule #3.

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, '../../apps-script/server/linker-prefilter.gs'),
  'utf8'
);

function load() {
  const context = { console };
  vm.createContext(context);
  vm.runInContext(SOURCE, context, { filename: 'linker-prefilter.gs' });
  return context;
}

const TITLES = ['Genesis', 'Berakhot', 'Bava Metzia', 'Mishneh Torah, Shabbat', 'Rashi on Genesis'];

test('keeps a line containing a known book title', () => {
  const { buildLinkerScanPayload_ } = load();
  const doc = 'See Genesis 1:1 for the opening.';
  const result = buildLinkerScanPayload_(doc, TITLES);

  assert.ok(result.payload.includes('Genesis 1:1'));
});

test('does not upload prose that has no citation shape', () => {
  const { buildLinkerScanPayload_ } = load();
  const doc = [
    'These are my private notes about the lesson.',
    'I want to remember that the class went well today.',
    'Nobody should ever see this paragraph.',
  ].join('\n');

  const result = buildLinkerScanPayload_(doc, TITLES);

  assert.equal(result.payload, '');
  assert.equal(result.scannedChars, 0);
  assert.ok(result.totalChars > 0);
});

test('uploads only the candidate window, not the surrounding private prose', () => {
  const { buildLinkerScanPayload_ } = load();
  const filler = 'x'.repeat(4000);
  const doc = `${filler}\nBerakhot 2a is the start.\n${filler}`;

  const result = buildLinkerScanPayload_(doc, TITLES);

  assert.ok(result.payload.includes('Berakhot 2a'));
  // Padding pulls in some neighbouring context by design, but the bulk of the
  // document must stay home.
  assert.ok(
    result.scannedChars < result.totalChars / 4,
    `expected a large reduction, sent ${result.scannedChars} of ${result.totalChars}`
  );
});

test('recognizes citation shapes even without a title match', () => {
  const { lineLooksLikeReference_, buildLinkerTitleIndex_ } = load();
  const index = buildLinkerTitleIndex_(TITLES);

  assert.equal(lineLooksLikeReference_('as it says in 12:4', index), true);   // numeric
  assert.equal(lineLooksLikeReference_('see 59b there', index), true);        // daf
  assert.equal(lineLooksLikeReference_('כדאיתא בב"מ', index), true);          // gershayim
  assert.equal(lineLooksLikeReference_("ר' עקיבא אומר", index), true);        // geresh
  assert.equal(lineLooksLikeReference_('just some ordinary writing', index), false);
});

test('short title tokens do not match ordinary prose', () => {
  const { buildLinkerTitleIndex_ } = load();
  // A hypothetical one/two-letter title must not be indexed, or every document
  // becomes one giant candidate window.
  const index = buildLinkerTitleIndex_(['Ib', 'A', 'Job']);

  assert.equal(index.ib, undefined);
  assert.equal(index.a, undefined);
  assert.equal(index.job, true);
});

test('payload offsets map back to exact document offsets', () => {
  const { buildLinkerScanPayload_, mapPayloadRangeToDocRange_ } = load();
  const prefix = 'private thoughts\n'.repeat(50);
  const doc = `${prefix}Genesis 1:1 says so.`;

  const result = buildLinkerScanPayload_(doc, TITLES);

  const needle = 'Genesis 1:1';
  const payloadStart = result.payload.indexOf(needle);
  assert.ok(payloadStart >= 0, 'expected the citation in the payload');

  const mapped = mapPayloadRangeToDocRange_(
    result.segments,
    payloadStart,
    payloadStart + needle.length
  );

  assert.ok(mapped, 'expected the range to map');
  assert.equal(doc.substring(mapped.startChar, mapped.endChar), needle);
});

test('offsets map correctly across multiple separated windows', () => {
  const { buildLinkerScanPayload_, mapPayloadRangeToDocRange_ } = load();
  const gap = 'nothing to see here\n'.repeat(60);
  const doc = `Berakhot 2a opens.\n${gap}Bava Metzia 59b closes.`;

  const result = buildLinkerScanPayload_(doc, TITLES);
  assert.ok(result.segments.length >= 2, 'expected two distinct windows');

  ['Berakhot 2a', 'Bava Metzia 59b'].forEach((needle) => {
    const payloadStart = result.payload.indexOf(needle);
    assert.ok(payloadStart >= 0, `expected ${needle} in payload`);
    const mapped = mapPayloadRangeToDocRange_(
      result.segments,
      payloadStart,
      payloadStart + needle.length
    );
    assert.ok(mapped, `expected ${needle} to map`);
    assert.equal(doc.substring(mapped.startChar, mapped.endChar), needle);
  });
});

test('a match straddling the separator between windows is discarded', () => {
  const { buildLinkerScanPayload_, mapPayloadRangeToDocRange_ } = load();
  const gap = 'nothing to see here\n'.repeat(60);
  const doc = `Berakhot 2a opens.\n${gap}Bava Metzia 59b closes.`;

  const result = buildLinkerScanPayload_(doc, TITLES);
  const firstSegment = result.segments[0];
  const boundary = firstSegment.payloadStart + firstSegment.length;

  // A range spanning the join must not silently resolve to a document range.
  const mapped = mapPayloadRangeToDocRange_(result.segments, boundary - 2, boundary + 3);
  assert.equal(mapped, null);
});

test('handles empty and missing input without throwing', () => {
  const { buildLinkerScanPayload_, mapPayloadOffsetToDocOffset_ } = load();

  assert.equal(buildLinkerScanPayload_('', TITLES).payload, '');
  assert.equal(buildLinkerScanPayload_(null, null).payload, '');
  assert.equal(mapPayloadOffsetToDocOffset_(null, 5), -1);
  assert.equal(mapPayloadOffsetToDocOffset_([], 5), -1);
});
