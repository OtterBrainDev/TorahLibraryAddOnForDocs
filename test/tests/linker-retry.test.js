// Pins what Link Texts does with a citation Sefaria's linker could not match
// (recoverUnmatchedCitations_, server/document-actions.gs):
//
//   - it is looked up again with exactly the spellings the sidebar search
//     tries (buildReferenceVariants_, server/sefaria-fetch.gs), in the same
//     order, so a citation one of them finds, the other does too;
//   - one found that way becomes an ordinary single-source match;
//   - one that is not is reported with its words, its context, every spelling
//     tried, and why it failed — the "Not matched" list in the review dialog.
//     The dialog used to say only "N citations could not be matched".
//
// Loaded with vm.runInContext; .gs is not a Node module format.
// See AGENTS.md hard rule #3.

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

const ROOT = path.resolve(__dirname, '..', '..');

function response(status, body) {
  return {
    getResponseCode: () => status,
    getContentText: () => (typeof body === 'string' ? body : JSON.stringify(body)),
  };
}

function refFromUrl(url) {
  const match = /\/api\/texts\/([^?]+)/.exec(url);
  return match ? decodeURIComponent(match[1]) : null;
}

// A texts API that knows the refs in `known` ({ref: payload}) and answers
// everything else with `errors[ref]` or a generic "could not find title".
function textsApi(known, errors) {
  return function (ref) {
    if (known[ref]) return response(200, Object.assign({ ref }, known[ref]));
    return response(200, { error: (errors && errors[ref]) || `Could not find title in reference: ${ref}` });
  };
}

function load(extra) {
  const context = Object.assign({
    console,
    Logger: { log() {} },
    Utilities: { sleep() {} },
    PropertiesService: { getUserProperties() { return { getProperty() { return null; } }; } },
    attachTransliterationSource_: (d) => d,
    applyHebrewDisplayPreferences: (d) => d,
    applyPunctuationPreferences: (d) => d,
    applyHebrewDivineNamePreferences: (d) => d,
    applyEnglishDivineNamePreference: () => {},
  }, extra || {});
  vm.createContext(context);
  [
    'apps-script/server/utils.gs',
    'apps-script/server/sheets.gs',
    'apps-script/server/citation-abbreviations.gs',
    'apps-script/server/sefaria-fetch.gs',
    'apps-script/server/linker-prefilter.gs',
    'apps-script/server/document-actions.gs',
  ].forEach((relative) => {
    vm.runInContext(fs.readFileSync(path.join(ROOT, relative), 'utf8'), context, { filename: relative });
  });
  return context;
}

// A fetchAll over `api` that records every request, round by round.
function recordingFetchAll(api) {
  const rounds = [];
  const fetchAll = (requests) => {
    rounds.push(requests.map((r) => refFromUrl(r.url)));
    return requests.map((r) => api(refFromUrl(r.url)));
  };
  fetchAll.rounds = rounds;
  return fetchAll;
}

function unmatchedEntry(docText, text) {
  const start = docText.indexOf(text);
  return { documentText: text, occurrence: 0, snippet: docText, startChar: start, endChar: start + text.length };
}

test('the retries are exactly the sidebar search\'s spellings, in its order', () => {
  // The sidebar: resolveReferenceWithFallbacks, one fetch per spelling.
  const sidebarTried = [];
  const ctx = load({
    UrlFetchApp: {
      fetch(url) { sidebarTried.push(refFromUrl(url)); return response(200, { error: 'nope' }); },
    },
  });
  ctx.resolveReferenceWithFallbacks('Hil. Shabbat 1:1');

  const fetchAll = recordingFetchAll(() => response(200, { error: 'nope' }));
  const result = ctx.recoverUnmatchedCitations_([unmatchedEntry('Hil. Shabbat 1:1', 'Hil. Shabbat 1:1')], fetchAll);

  assert.deepEqual(sidebarTried, Array.from(ctx.buildReferenceVariants_('Hil. Shabbat 1:1')));
  assert.deepEqual(fetchAll.rounds.flat(), sidebarTried);
  assert.deepEqual(Array.from(result.unmatched[0].variants), sidebarTried);
});

test('a citation found by another spelling becomes an ordinary single-source match', () => {
  const DOC = 'As the Rambam rules in Hil. Shabbat 1:1, work is forbidden.';
  const ctx = load();
  const fetchAll = recordingFetchAll(textsApi({
    'Mishneh Torah, Hilchot Shabbat 1:1': {
      heRef: 'משנה תורה, הלכות שבת א׳:א׳',
      text: ['<b>Resting</b> from work on the seventh day is a positive commandment.'],
      he: ['שביתה ממלאכה'],
      primary_category: 'Halakhah',
    },
  }));
  const result = ctx.recoverUnmatchedCitations_([unmatchedEntry(DOC, 'Hil. Shabbat 1:1')], fetchAll);

  assert.equal(result.unmatched.length, 0);
  assert.equal(result.recovered.length, 1);
  const match = result.recovered[0];
  assert.equal(match.ambiguous, false);
  assert.equal(match.documentText, 'Hil. Shabbat 1:1', 'the document\'s own words are what gets linked');
  assert.equal(match.startChar, DOC.indexOf('Hil. Shabbat 1:1'));
  assert.equal(match.occurrence, 0);
  assert.equal(match.recoveredFrom, 'Mishneh Torah, Hilchot Shabbat 1:1');
  assert.equal(match.candidates.length, 1);
  assert.equal(match.candidates[0].ref, 'Mishneh Torah, Hilchot Shabbat 1:1');
  assert.equal(match.candidates[0].heRef, 'משנה תורה, הלכות שבת א׳:א׳');
  assert.equal(match.candidates[0].category, 'Halakhah');
  assert.ok(!/[<>]/.test(match.candidates[0].preview), 'preview is plain text');
  assert.ok(match.candidates[0].preview.startsWith('Resting from work'));
});

test('the first spelling that resolves wins, as in the sidebar; later ones are not tried', () => {
  const ctx = load();
  const fetchAll = recordingFetchAll(textsApi({
    'Hilchot Shabbat 1:1': { text: ['a'] },
    'Mishneh Torah, Hilchot Shabbat 1:1': { text: ['b'] },
  }));
  const result = ctx.recoverUnmatchedCitations_([unmatchedEntry('Hil. Shabbat 1:1', 'Hil. Shabbat 1:1')], fetchAll);

  assert.equal(result.recovered[0].recoveredFrom, 'Hilchot Shabbat 1:1');
  assert.deepEqual(fetchAll.rounds.flat(), ['Hil. Shabbat 1:1', 'Hilchot Shabbat 1:1']);
});

test('every citation\'s first spelling is tried before any second one, in parallel rounds', () => {
  const DOC = 'Hil. Shabbat 1:1 and Genesis 51:3 and Hil. Teshuvah 3:4';
  const ctx = load();
  const fetchAll = recordingFetchAll(textsApi({}));
  ctx.recoverUnmatchedCitations_([
    unmatchedEntry(DOC, 'Hil. Shabbat 1:1'),
    unmatchedEntry(DOC, 'Genesis 51:3'),
    unmatchedEntry(DOC, 'Hil. Teshuvah 3:4'),
  ], fetchAll);

  assert.deepEqual(fetchAll.rounds[0], ['Hil. Shabbat 1:1', 'Genesis 51:3', 'Hil. Teshuvah 3:4']);
  // Genesis 51:3 has one spelling; it drops out after round one.
  assert.deepEqual(fetchAll.rounds[1], ['Hilchot Shabbat 1:1', 'Hilchot Teshuvah 3:4']);
});

test('an unmatched citation says what was searched and why it failed', () => {
  const DOC = 'Compare Genesis 51:3, Ibid. 2:3, Shmendrik 4:5 and Hil. Shabbat 40:1.';
  const ctx = load();
  const fetchAll = recordingFetchAll(textsApi({}, {
    'Genesis 51:3': 'Genesis ends at Chapter 50.',
    'Mishneh Torah, Hilchot Shabbat 40:1': 'Mishneh Torah, Sabbath ends at Chapter 30.',
  }));
  const result = ctx.recoverUnmatchedCitations_([
    unmatchedEntry(DOC, 'Genesis 51:3'),
    unmatchedEntry(DOC, 'Ibid. 2:3'),
    unmatchedEntry(DOC, 'Shmendrik 4:5'),
    unmatchedEntry(DOC, 'Hil. Shabbat 40:1'),
  ], fetchAll);

  assert.equal(result.recovered.length, 0);
  const byText = Object.fromEntries(result.unmatched.map((u) => [u.documentText, u]));

  const genesis = byText['Genesis 51:3'];
  assert.equal(genesis.reason, 'out-of-range');
  assert.equal(genesis.detail, 'Genesis ends at Chapter 50.');
  assert.deepEqual(Array.from(genesis.variants), ['Genesis 51:3']);
  assert.equal(genesis.snippet, DOC, 'context travels with it, so the reader can find it');
  assert.equal(genesis.startChar, DOC.indexOf('Genesis 51:3'));

  assert.equal(byText['Ibid. 2:3'].reason, 'refers-back');
  assert.equal(byText['Shmendrik 4:5'].reason, 'unknown-title');
  assert.match(byText['Shmendrik 4:5'].detail, /Could not find title/);

  // The expansion found the book, so its message wins over the literal
  // spelling's "could not find title".
  const shabbat = byText['Hil. Shabbat 40:1'];
  assert.equal(shabbat.reason, 'out-of-range');
  assert.match(shabbat.detail, /ends at Chapter 30/);
  assert.equal(shabbat.variants.length, 4);

  result.unmatched.forEach((u) => assert.ok(u.reasonText, `${u.documentText} has no reason text`));
});

test('a Hebrew "שם" citation is reported as pointing back, but שמות is not', () => {
  const ctx = load();
  const fetchAll = recordingFetchAll(textsApi({}));
  const result = ctx.recoverUnmatchedCitations_([
    unmatchedEntry('רש"י שם', 'רש"י שם'),
    unmatchedEntry('שמות פרק קכ', 'שמות פרק קכ'),
  ], fetchAll);

  assert.equal(result.unmatched[0].reason, 'refers-back');
  assert.notEqual(result.unmatched[1].reason, 'refers-back');
});

test('no network while retrying is reported per citation and never fails the scan', () => {
  const ctx = load();
  const fetchAll = () => { throw new Error('Address unavailable: https://www.sefaria.org/api/texts/x'); };
  const result = ctx.recoverUnmatchedCitations_([unmatchedEntry('Genesis 51:3', 'Genesis 51:3')], fetchAll);

  assert.equal(result.recovered.length, 0);
  assert.equal(result.unmatched.length, 1);
  assert.equal(result.unmatched[0].reason, 'unavailable');
});

test('a 503 for one citation leaves the others\' retries alone', () => {
  const DOC = 'Hil. Shabbat 1:1 and Genesis 1:1';
  const ctx = load();
  const known = textsApi({ 'Mishneh Torah, Hilchot Shabbat 1:1': { text: ['x'] } });
  const fetchAll = recordingFetchAll((ref) => (ref === 'Genesis 1:1' ? response(503, 'busy') : known(ref)));
  const result = ctx.recoverUnmatchedCitations_([
    unmatchedEntry(DOC, 'Hil. Shabbat 1:1'),
    unmatchedEntry(DOC, 'Genesis 1:1'),
  ], fetchAll);

  assert.equal(result.recovered.length, 1);
  assert.equal(result.unmatched.length, 1);
  assert.equal(result.unmatched[0].documentText, 'Genesis 1:1');
  assert.equal(result.unmatched[0].reason, 'unavailable');
});

test('past the cap, citations are listed as not looked up, and cost no requests', () => {
  const ctx = load();
  const cap = ctx.LINKER_RETRY_MAX_CITATIONS_;
  const entries = [];
  for (let i = 0; i <= cap; i++) entries.push(unmatchedEntry(`Book${i} 1:1`, `Book${i} 1:1`));
  const fetchAll = recordingFetchAll(textsApi({}));
  const result = ctx.recoverUnmatchedCitations_(entries, fetchAll);

  assert.equal(result.unmatched.length, cap + 1);
  const last = result.unmatched[cap];
  assert.equal(last.reason, 'not-checked');
  assert.deepEqual(Array.from(last.variants), []);
  assert.ok(!fetchAll.rounds.flat().includes(`Book${cap} 1:1`));
});

test('scanDocumentForReferences: the report lists what stayed unmatched and links what was recovered', () => {
  const DOC = 'See Genesis 1:1, then Hil. Shabbat 1:1, and Genesis 51:3.';
  const at = (text) => ({ startChar: DOC.indexOf(text), endChar: DOC.indexOf(text) + text.length });
  const findRefs = {
    results: [
      Object.assign(at('Genesis 1:1'), { linkFailed: false, refs: ['Genesis 1:1'] }),
      Object.assign(at('Hil. Shabbat 1:1'), { linkFailed: true, refs: null }),
      Object.assign(at('Genesis 51:3'), { linkFailed: true, refs: null }),
    ],
    refData: {},
  };
  const api = textsApi({ 'Mishneh Torah, Hilchot Shabbat 1:1': { text: ['x'] } }, { 'Genesis 51:3': 'Genesis ends at Chapter 50.' });
  const ctx = load({
    DocumentApp: {
      getActiveDocument: () => ({ getBody: () => ({ editAsText: () => ({ getText: () => DOC, getLinkUrl: () => null }) }) }),
    },
    UrlFetchApp: {
      fetch(url) {
        if (/find-refs/.test(url)) return response(200, { task_id: 't1' });
        return response(200, { ready: true, result: { body: findRefs } });
      },
      fetchAll: (requests) => requests.map((r) => api(refFromUrl(r.url))),
    },
  });
  ctx.getPreferences = () => ({ linker_scan_mode: 'full' });

  const report = ctx.scanDocumentForReferences();

  assert.deepEqual(Array.from(report.matches, (m) => m.documentText), ['Genesis 1:1', 'Hil. Shabbat 1:1'], 'in document order');
  assert.equal(report.matches[1].recoveredFrom, 'Mishneh Torah, Hilchot Shabbat 1:1');
  assert.equal(report.unresolvedCount, 1);
  assert.equal(report.unmatched.length, 1);
  assert.equal(report.unmatched[0].documentText, 'Genesis 51:3');
  assert.equal(report.unmatched[0].reason, 'out-of-range');
});

// BUG-010 (T07, 30 October 2026): "Duplicate A: Genesis 2:1" and "Duplicate B:
// Genesis 2:1" each came back from Sefaria's linker as one unmatched citation,
// label included, and every spelling of that failed with a book-name error.
// The words after the label are tried as well, and linked on their own.
const T07 = [
  'Rough notes — synthetic material only',
  'Traditional citation: Hil. Shabbat 1:1',
  'Invalid candidate: Fakebook 99:99',
  'Duplicate A: Genesis 2:1',
  'Duplicate B: Genesis 2:1',
  'Inline citation: Compare Exodus 20:1 and Deuteronomy 5:6 before discussing wording.',
].join('\n');

test('a label taken into the citation is left out, and each duplicate is linked at its own place', () => {
  const ctx = load();
  const fetchAll = recordingFetchAll(textsApi({ 'Genesis 2:1': { text: ['The heaven and the earth were finished'] } }));
  const result = ctx.recoverUnmatchedCitations_([
    unmatchedEntry(T07, 'Duplicate A: Genesis 2:1'),
    unmatchedEntry(T07, 'Duplicate B: Genesis 2:1'),
  ], fetchAll, T07);

  assert.equal(result.unmatched.length, 0);
  assert.equal(result.recovered.length, 2);
  const [a, b] = result.recovered;
  assert.equal(a.documentText, 'Genesis 2:1');
  assert.equal(b.documentText, 'Genesis 2:1');
  assert.equal(a.startChar, T07.indexOf('Duplicate A: ') + 'Duplicate A: '.length);
  assert.equal(b.startChar, T07.indexOf('Duplicate B: ') + 'Duplicate B: '.length);
  assert.equal(a.endChar - a.startChar, 'Genesis 2:1'.length);
  assert.deepEqual([a.occurrence, b.occurrence], [0, 1]);
  assert.notEqual(a.key, b.key);
  assert.equal(a.recoveredFrom, 'Genesis 2:1');
  assert.equal(a.candidates[0].ref, 'Genesis 2:1');
  // The citation as written was tried first; the label-free words after it.
  assert.deepEqual(fetchAll.rounds[0], ['Duplicate A: Genesis 2:1', 'Duplicate B: Genesis 2:1']);
  assert.deepEqual(fetchAll.rounds[1], ['Genesis 2:1', 'Genesis 2:1']);

  // Apply re-finds each by its occurrence: the link goes on that line's words
  // and the labels stay plain prose.
  const placeA = ctx.relocateLinkerDecision_(T07, a);
  const placeB = ctx.relocateLinkerDecision_(T07, b);
  assert.equal(placeA.start, a.startChar);
  assert.equal(placeB.start, b.startChar);
  assert.equal(T07.slice(placeA.start, placeA.end), 'Genesis 2:1');
  assert.ok(T07.slice(0, placeB.start).endsWith('Duplicate B: '));
});

test('a labelled citation that still fails stays as written; nothing is made up', () => {
  const ctx = load();
  const fetchAll = recordingFetchAll(textsApi({}));
  const result = ctx.recoverUnmatchedCitations_([unmatchedEntry(T07, 'Invalid candidate: Fakebook 99:99')], fetchAll, T07);

  assert.equal(result.recovered.length, 0);
  const row = result.unmatched[0];
  assert.equal(row.documentText, 'Invalid candidate: Fakebook 99:99');
  assert.equal(row.startChar, T07.indexOf('Invalid candidate'));
  assert.deepEqual(Array.from(row.variants), ['Invalid candidate: Fakebook 99:99', 'Fakebook 99:99']);
  assert.equal(row.reason, 'unknown-title');
});

test('only a reference after the colon is split off: never prose, never a verse number', () => {
  const ctx = load();
  for (const text of ['Genesis 2: In the beginning', 'Genesis 2: 3', 'Note: see the next page']) {
    const doc = `x ${text} y`;
    const fetchAll = recordingFetchAll(textsApi({}));
    ctx.recoverUnmatchedCitations_([unmatchedEntry(doc, text)], fetchAll, doc);
    assert.ok(fetchAll.rounds.flat().every((spelling) => spelling.includes(text.split(':')[0])),
      `${text}: tried ${JSON.stringify(fetchAll.rounds.flat())}`);
  }
});

test('a Hebrew label is left out the same way', () => {
  const DOC = 'הערות\nכפילות א: בראשית ב:א\n';
  const ctx = load();
  const fetchAll = recordingFetchAll(textsApi({ 'בראשית ב:א': { text: ['x'] } }));
  const result = ctx.recoverUnmatchedCitations_([unmatchedEntry(DOC, 'כפילות א: בראשית ב:א')], fetchAll, DOC);
  assert.equal(result.recovered.length, 1);
  assert.equal(result.recovered[0].documentText, 'בראשית ב:א');
  assert.equal(result.recovered[0].startChar, DOC.indexOf('בראשית ב:א'));
});

test('without the document text no label is split off (older callers)', () => {
  const ctx = load();
  const fetchAll = recordingFetchAll(textsApi({ 'Genesis 2:1': { text: ['x'] } }));
  const result = ctx.recoverUnmatchedCitations_([unmatchedEntry(T07, 'Duplicate A: Genesis 2:1')], fetchAll);
  assert.equal(result.recovered.length, 0);
  assert.deepEqual(fetchAll.rounds.flat(), ['Duplicate A: Genesis 2:1']);
});

// BUG-011 (T07): "Hil. Shabbat 1:1" stayed unmatched after its Hilchot,
// Mishneh Torah and Rambam spellings, and the row gave one book-name reason.
// That reason is the most telling of the spellings' answers, not all of them;
// each spelling now carries Sefaria's own answer, so a live run shows what
// each expansion was told.
test('each spelling tried keeps Sefaria\'s own answer to it', () => {
  const ctx = load();
  const fetchAll = recordingFetchAll(textsApi({}, {
    'Hil. Shabbat 1:1': 'Could not find title in reference: Hil. Shabbat 1:1',
    'Hilchot Shabbat 1:1': 'Could not find title in reference: Hilchot Shabbat 1:1',
    'Mishneh Torah, Hilchot Shabbat 1:1': 'Something else entirely',
    'Rambam, Hilchot Shabbat 1:1': 'And a third answer',
  }));
  const result = ctx.recoverUnmatchedCitations_([unmatchedEntry(T07, 'Hil. Shabbat 1:1')], fetchAll, T07);
  const row = result.unmatched[0];
  assert.equal(row.reason, 'unknown-title');
  assert.deepEqual(Array.from(row.attempts, (a) => [a.spelling, a.error]), [
    ['Hil. Shabbat 1:1', 'Could not find title in reference: Hil. Shabbat 1:1'],
    ['Hilchot Shabbat 1:1', 'Could not find title in reference: Hilchot Shabbat 1:1'],
    ['Mishneh Torah, Hilchot Shabbat 1:1', 'Something else entirely'],
    ['Rambam, Hilchot Shabbat 1:1', 'And a third answer'],
  ]);
});
