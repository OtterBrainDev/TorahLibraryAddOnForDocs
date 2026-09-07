// Pins classifyLinkerMatches_ (server/document-actions.gs) — the step that
// decides, for every citation Sefaria found, whether it becomes an automatic
// link, a question for the reader, or a counted failure.
//
// The behaviour this replaces: the published add-on linked `refs[0]` for every
// match, so an ambiguous citation silently became one arbitrary destination,
// and anything unresolvable vanished without a word. "Linked 4 references" was
// the whole report, whether 4 or 40 citations had been found.
//
// Sefaria's own signal is binary — `refs` holds one entry when the resolver is
// confident and several UNRANKED entries when it is not — so these tests also
// pin that we never invent a ranking among ambiguous candidates.
//
// Loaded with vm.runInContext; .gs is not a Node module format.
// See AGENTS.md hard rule #3.

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

const ROOT = path.resolve(__dirname, '..', '..');

function load() {
  const context = {
    console,
    // Only the helpers the classifier reaches into.
    Logger: { log() {} },
  };
  vm.createContext(context);

  ['apps-script/server/linker-prefilter.gs', 'apps-script/server/document-actions.gs']
    .forEach((relative) => {
      vm.runInContext(
        fs.readFileSync(path.join(ROOT, relative), 'utf8'),
        context,
        { filename: relative }
      );
    });

  // htmlToPlainText_ lives in sheets.gs; the classifier uses it to flatten
  // Sefaria's excerpt markup into text the dialog can render with textContent.
  vm.runInContext(
    fs.readFileSync(path.join(ROOT, 'apps-script/server/sheets.gs'), 'utf8'),
    context,
    { filename: 'sheets.gs' }
  );

  return context;
}

const DOC = 'See Genesis 1:1 and also Avodah Zarah 2a in the notes.';

function raw(overrides) {
  return Object.assign({
    startChar: DOC.indexOf('Genesis 1:1'),
    endChar: DOC.indexOf('Genesis 1:1') + 'Genesis 1:1'.length,
    linkFailed: false,
    refs: ['Genesis 1:1'],
  }, overrides);
}

function classify(context, rawMatches, options) {
  return context.classifyLinkerMatches_(Object.assign({
    rawMatches,
    refData: {},
    segments: null,
    docText: DOC,
    isAlreadyLinked: () => false,
  }, options || {}));
}

test('a single resolved ref becomes an unambiguous match', () => {
  const context = load();
  const result = classify(context, [raw()]);

  assert.equal(result.matches.length, 1);
  assert.equal(result.unresolvedCount, 0);
  assert.equal(result.matches[0].ambiguous, false);
  assert.equal(result.matches[0].documentText, 'Genesis 1:1');
  assert.equal(result.matches[0].candidates.length, 1);
});

test('several refs become one ambiguous match, in Sefaria\'s order', () => {
  const context = load();
  const refs = ['Avodah Zarah 2a', 'Rashi on Avodah Zarah 2a', 'Tosafot on Avodah Zarah 2a'];
  const result = classify(context, [raw({
    startChar: DOC.indexOf('Avodah Zarah 2a'),
    endChar: DOC.indexOf('Avodah Zarah 2a') + 'Avodah Zarah 2a'.length,
    refs,
  })]);

  assert.equal(result.matches.length, 1);
  const match = result.matches[0];
  assert.equal(match.ambiguous, true);

  // Sefaria returns these unranked. Re-ordering them would be inventing a
  // confidence signal the API does not provide.
  assert.deepEqual(Array.from(match.candidates.map((c) => c.ref)), refs);
});

test('an unresolvable citation is counted, never silently dropped', () => {
  const context = load();
  const result = classify(context, [
    raw({ linkFailed: true, refs: null }),
    raw({ linkFailed: false, refs: [] }),
  ]);

  assert.equal(result.matches.length, 0);
  assert.equal(result.unresolvedCount, 2, 'both failure shapes must be counted');
});

test('an already-linked range is skipped without being reported as a failure', () => {
  const context = load();
  const result = classify(context, [raw()], { isAlreadyLinked: () => true });

  // Nothing to do, and nothing wrong — it must not inflate the failure count.
  assert.equal(result.matches.length, 0);
  assert.equal(result.unresolvedCount, 0);
});

test('an out-of-range offset is counted rather than corrupting the document', () => {
  const context = load();
  const result = classify(context, [
    raw({ startChar: -5, endChar: 3 }),
    raw({ startChar: 10, endChar: DOC.length + 99 }),
    raw({ startChar: 12, endChar: 12 }),
  ]);

  assert.equal(result.matches.length, 0);
  // "Unplaceable", not "unresolved": Sefaria identified the source fine — we
  // could not put it anywhere. The two get reported differently because only
  // one of them has a remedy the reader can act on.
  assert.equal(result.unplaceableCount, 3);
  assert.equal(result.unresolvedCount, 0);
});

test('offsets are mapped back through pre-filter segments', () => {
  const context = load();
  // Payload holds only the citation; it sat 100 chars into the real document.
  const segments = [{ docStart: 100, payloadStart: 0, length: 11 }];
  const docText = 'x'.repeat(100) + 'Genesis 1:1' + ' trailing';

  const result = context.classifyLinkerMatches_({
    rawMatches: [{ startChar: 0, endChar: 11, linkFailed: false, refs: ['Genesis 1:1'] }],
    refData: {},
    segments,
    docText,
    isAlreadyLinked: () => false,
  });

  assert.equal(result.matches.length, 1);
  assert.equal(result.matches[0].startChar, 100);
  assert.equal(result.matches[0].documentText, 'Genesis 1:1');
});

test('a match straddling two pre-filter windows is counted, not mis-placed', () => {
  const context = load();
  const segments = [
    { docStart: 0, payloadStart: 0, length: 10 },
    { docStart: 500, payloadStart: 12, length: 10 },
  ];

  const result = context.classifyLinkerMatches_({
    rawMatches: [{ startChar: 8, endChar: 15, linkFailed: false, refs: ['Genesis 1:1'] }],
    refData: {},
    segments,
    docText: 'y'.repeat(600),
    isAlreadyLinked: () => false,
  });

  // Placing this link would hyperlink the wrong words — a silent document
  // corruption. Counting it is the only safe outcome, and there is nothing to
  // offer the reader in the review table: no contiguous span of the document
  // contains this text at all.
  assert.equal(result.matches.length, 0);
  assert.equal(result.unplaceableCount, 1);
  assert.equal(result.unresolvedCount, 0);
});

test('a match that overruns only into the separator is placed, not discarded', () => {
  const context = load();
  // Sefaria routinely includes trailing whitespace in a citation's character
  // range. The separator IS whitespace, so the citation sits entirely inside
  // the first window — dropping it would lose a link we can place exactly.
  const segments = [
    { docStart: 0, payloadStart: 0, length: 11 },
    { docStart: 500, payloadStart: 13, length: 10 },
  ];
  const docText = 'Genesis 1:1' + ' '.repeat(489) + 'z'.repeat(10);

  const result = context.classifyLinkerMatches_({
    rawMatches: [{ startChar: 0, endChar: 12, linkFailed: false, refs: ['Genesis 1:1'] }],
    refData: {},
    segments,
    docText,
    isAlreadyLinked: () => false,
  });

  assert.equal(result.unplaceableCount, 0);
  assert.equal(result.matches.length, 1);
  assert.equal(result.matches[0].startChar, 0);
  assert.equal(result.matches[0].endChar, 11, 'clamped to the window, losing only the separator');
  assert.equal(result.matches[0].documentText, 'Genesis 1:1');
});

test('unresolved and unplaceable are counted in separate buckets', () => {
  const context = load();
  const segments = [
    { docStart: 0, payloadStart: 0, length: 10 },
    { docStart: 500, payloadStart: 12, length: 10 },
  ];

  const result = context.classifyLinkerMatches_({
    rawMatches: [
      { startChar: 0, endChar: 5, linkFailed: true, refs: null },
      { startChar: 8, endChar: 15, linkFailed: false, refs: ['Genesis 1:1'] },
    ],
    refData: {},
    segments,
    docText: 'q'.repeat(600),
    isAlreadyLinked: () => false,
  });

  assert.equal(result.unresolvedCount, 1, 'Sefaria could not identify this one');
  assert.equal(result.unplaceableCount, 1, 'this one we could not position');
});

test('candidate previews are flattened to plain text', () => {
  const context = load();
  const refData = {
    'Genesis 1:1': {
      heRef: 'בראשית א׳:א׳',
      en: '<b>In the beginning</b> God created<i class="footnote">note</i>',
      primaryCategory: 'Tanakh',
    },
  };

  const result = classify(context, [raw()], { refData });
  const candidate = result.matches[0].candidates[0];

  assert.equal(candidate.heRef, 'בראשית א׳:א׳');
  assert.ok(!/[<>]/.test(candidate.preview), `markup survived: ${candidate.preview}`);
  assert.ok(candidate.preview.includes('In the beginning'));
  assert.equal(candidate.category, 'Tanakh');
});

test('a missing refData entry still yields a usable candidate', () => {
  const context = load();
  const result = classify(context, [raw()]);
  const candidate = result.matches[0].candidates[0];

  // No excerpt is fine; a row with no ref at all is not.
  assert.equal(candidate.ref, 'Genesis 1:1');
  assert.equal(candidate.preview, '');
});

test('review mode falls back to summary for unknown values', () => {
  const { getLinkerReviewMode_ } = load();

  assert.equal(getLinkerReviewMode_({ linker_review_mode: 'full' }), 'full');
  assert.equal(getLinkerReviewMode_({ linker_review_mode: 'quiet' }), 'quiet');
  assert.equal(getLinkerReviewMode_({ linker_review_mode: 'summary' }), 'summary');
  assert.equal(getLinkerReviewMode_({ linker_review_mode: 'nonsense' }), 'summary');
  assert.equal(getLinkerReviewMode_({}), 'summary');
  assert.equal(getLinkerReviewMode_(null), 'summary');
});

test('preview truncation cuts on a word boundary', () => {
  const { truncateLinkerPreview_ } = load();

  const long = 'alpha beta gamma delta epsilon zeta eta theta iota kappa';
  const out = truncateLinkerPreview_(long, 20);

  assert.ok(out.length <= 21, out);
  assert.ok(out.endsWith('…'), out);
  assert.ok(!out.includes('  '), out);
  assert.equal(truncateLinkerPreview_('short', 20), 'short');
  assert.equal(truncateLinkerPreview_(null, 20), '');
});
