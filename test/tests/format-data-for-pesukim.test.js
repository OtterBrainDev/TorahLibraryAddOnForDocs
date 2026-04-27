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
