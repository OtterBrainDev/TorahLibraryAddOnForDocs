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
    he: [['he-1-31'], ['he-2-1', 'he-2-2', 'he-2-3']],
    text: [['en-1-31'], ['en-2-1', 'en-2-2', 'en-2-3']],
  }, true);
  assert.equal(out.text, '(31) en-1-31\n(1) en-2-1\n(2) en-2-2\n(3) en-2-3\n');
  assert.equal(out.he, '(לא) he-1-31\n(א) he-2-1\n(ב) he-2-2\n(ג) he-2-3\n');
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
