const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function loadContext() {
  const context = {
    console,
    Logger: { log() {} },
    HtmlService: {},
    DocumentApp: {},
    UrlFetchApp: {},
    Utilities: {},
    PropertiesService: {
      getUserProperties() {
        return { getProperty() { return null; }, setProperty() {} };
      },
    },
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync('apps-script/gematriya.gs', 'utf8'), context, { filename: 'gematriya.gs' });
  vm.runInContext(fs.readFileSync('apps-script/server/text-processing.gs', 'utf8'), context, { filename: 'text-processing.gs' });
  return context;
}

// `formatDataForPesukim` shapes `data.he` / `data.text` before they're passed
// into `insertRichTextFromHTML`. The rewrite branch appended `"\n"` between
// verses in BOTH the pesukim and non-pesukim branches, which turned
// non-line-marker mode into paragraph-break-per-verse display. The pre-rewrite
// behavior joined verses as prose when line markers were off.

test('pesukim=true: verses get numbered and newline-separated', () => {
  const ctx = loadContext();
  const input = {
    isSpanning: false,
    sections: [1, 1],
    he: ['verse-A', 'verse-B'],
    text: ['english-A', 'english-B'],
  };
  const out = ctx.formatDataForPesukim(input, true);
  assert.match(out.he, /^\(א\) verse-A\n\(ב\) verse-B\n$/);
  assert.match(out.text, /^\(1\) english-A\n\(2\) english-B\n$/);
  assert.equal(out.lineMarkersApplied, true);
});

test('pesukim=false: verses are joined as prose with a single space (no trailing newlines)', () => {
  const ctx = loadContext();
  const input = {
    isSpanning: false,
    sections: [1, 1],
    he: ['verse-A', 'verse-B', 'verse-C'],
    text: ['english-A', 'english-B', 'english-C'],
  };
  const out = ctx.formatDataForPesukim(input, false);
  assert.equal(out.he, 'verse-A verse-B verse-C');
  assert.equal(out.text, 'english-A english-B english-C');
  assert.equal(out.lineMarkersApplied, false);
  // Most important: no trailing newline. The rewrite had this wrong and
  // turned non-line-marker output into paragraph-break-per-verse in Google
  // Docs, because insertRichTextFromHTML converts `\n` to a paragraph break.
  assert.equal(/\n/.test(out.he), false, 'Hebrew output must not contain `\\n` when pesukim=false');
  assert.equal(/\n/.test(out.text), false, 'English output must not contain `\\n` when pesukim=false');
});

test('non-array `data.he` (single verse) passes through untouched in both modes', () => {
  const ctx = loadContext();
  const both = [true, false];
  for (const pesukim of both) {
    const out = ctx.formatDataForPesukim({
      isSpanning: false,
      sections: [1, 1],
      he: 'single-verse-he',
      text: 'single-verse-en',
    }, pesukim);
    assert.equal(out.he, 'single-verse-he', `pesukim=${pesukim} single-verse Hebrew passthrough`);
    assert.equal(out.text, 'single-verse-en', `pesukim=${pesukim} single-verse English passthrough`);
  }
});

// A range across a chapter boundary (Genesis 1:31-2:3) numbers from the first
// requested verse in BOTH languages, then restarts at 1. The two passes shared
// one counter that the Hebrew pass reset, so the English read (1), (1), (2), (3).
test('spanning range: each language numbers from the requested verse, then restarts per chapter', () => {
  const ctx = loadContext();
  const out = ctx.formatDataForPesukim({
    isSpanning: true,
    sections: [1, 31],
    sectionNames: ['Chapter', 'Verse'],
    heSectionNames: ['פרק', 'פסוק'],
    he: [['he-1-31'], ['he-2-1', 'he-2-2', 'he-2-3']],
    text: [['en-1-31'], ['en-2-1', 'en-2-2', 'en-2-3']],
  }, true);
  assert.equal(out.text, 'Chapter 1\n(31) en-1-31\nChapter 2\n(1) en-2-1\n(2) en-2-2\n(3) en-2-3\n');
  assert.equal(out.he, 'פרק א\n(לא) he-1-31\nפרק ב\n(א) he-2-1\n(ב) he-2-2\n(ג) he-2-3\n');
  assert.deepEqual(Array.from(out.lineMarkerNumbers), [31, 1, 2, 3]);
  assert.deepEqual(Array.from(out.sectionHeadingLines), ['פרק א', 'פרק ב', 'Chapter 1', 'Chapter 2']);
});

// With line numbers on, a range across chapters says where each chapter
// starts; the numbers alone restart at 1 with nothing to mark the break.
test('spanning range with line markers: a heading named by the text\'s own section names', () => {
  const ctx = loadContext();
  const out = ctx.formatDataForPesukim({
    isSpanning: true,
    sections: [5, 3],
    sectionNames: ['Mishnah', 'Halakhah'],
    heSectionNames: ['משנה', 'הלכה'],
    he: [['a'], [], ['c']],
    text: [['A'], [], ['C']],
  }, true);
  // An empty section gets no heading; the next one is still numbered by position.
  assert.equal(out.text, 'Mishnah 5\n(3) A\nMishnah 7\n(1) C\n');
  assert.equal(out.he, 'משנה ה\n(ג) a\nמשנה ז\n(א) c\n');
});

test('spanning Talmud range: headings name the daf and amud', () => {
  const ctx = loadContext();
  for (const start of [3, '2a']) {
    const out = ctx.formatDataForPesukim({
      isSpanning: true,
      sections: [start, 5],
      addressTypes: ['Talmud', 'Integer'],
      sectionNames: ['Daf', 'Line'],
      heSectionNames: ['דף', 'שורה'],
      he: [['a'], ['b'], ['c']],
      text: [['A'], ['B'], ['C']],
    }, true);
    assert.equal(out.text, 'Daf 2a\n(5) A\nDaf 2b\n(1) B\nDaf 3a\n(1) C\n', `start ${start}`);
    assert.equal(out.he, 'דף ב ע״א\n(ה) a\nדף ב ע״ב\n(א) b\nדף ג ע״א\n(א) c\n', `start ${start}`);
  }
});

test('depth-3 spanning range: the heading is the level above the last', () => {
  const ctx = loadContext();
  const out = ctx.formatDataForPesukim({
    isSpanning: true,
    sections: [1, 4, 2],
    sectionNames: ['Chapter', 'Verse', 'Comment'],
    heSectionNames: ['פרק', 'פסוק', 'דיבור המתחיל'],
    he: [['x'], ['y']],
    text: [['X'], ['Y']],
  }, true);
  assert.match(out.text, /^Verse 4\n.*\nVerse 5\n/);
});

test('formatting the same payload twice is a no-op (multi-version insert)', () => {
  const ctx = loadContext();
  const data = {
    isSpanning: true,
    sections: [1, 31],
    sectionNames: ['Chapter', 'Verse'],
    heSectionNames: ['פרק', 'פסוק'],
    he: [['a'], ['b']],
    text: [['A'], ['B']],
  };
  const first = ctx.formatDataForPesukim(data, true);
  const text = first.text;
  const again = ctx.formatDataForPesukim(first, true);
  assert.equal(again.text, text);
  assert.equal(again.sectionHeadingLines.length, 4);
});

test('transliteration markers follow the restart at each chapter', () => {
  const ctx = loadContext();
  const out = ctx.normalizeTransliterationLineMarkersToGematria(
    'pereq a\n(x) one\npereq b\n(x) two\n(x) three', [31, 1, 2]);
  assert.equal(out, 'pereq a\n(לא) one\npereq b\n(א) two\n(ב) three');
  // A starting number still counts up, as before.
  assert.equal(ctx.normalizeTransliterationLineMarkersToGematria('(x) a\n(x) b', 4), '(ד) a\n(ה) b');
});

test('spanning range without line markers: prose, with a space at the chapter break', () => {
  const ctx = loadContext();
  const out = ctx.formatDataForPesukim({
    isSpanning: true,
    sections: [1, 31],
    he: [['a'], ['b', 'c']],
    text: [['A.'], ['B.', 'C.']],
  }, false);
  assert.equal(out.text, 'A. B. C.');
  assert.equal(out.he, 'a b c');
});
