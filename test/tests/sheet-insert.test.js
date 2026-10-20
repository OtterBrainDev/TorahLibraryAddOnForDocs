const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

// Pins what a Voices (source sheet) insert puts in the document
// (apps-script/server/sheets.gs).
//
// "Both" used to insert the whole Citation block (title, summary, "Curated
// by … • Topics … • URL") and then the Text block under it, so the title
// appeared three times: once linked, once as the author's summary (which is
// often the title again, in lower case), and once as the text's heading. Both
// is now the text with its heading linked to the sheet, and Citation drops a
// summary that only repeats the title.

const SHEET_URL = 'https://www.sefaria.org/sheets/749516';

function payload(extra) {
  return Object.assign({
    url: SHEET_URL,
    sheetId: 749516,
    label: 'Why do we read Kohelet on Sukkot?',
    summary: 'why do we read Kohelet on Sukkot',
    owner: 'Talya Sandor',
    topics: ['Sukkah'],
  }, extra || {});
}

const FULL_SHEET = {
  title: 'Why do we read Kohelet on Sukkot?',
  ownerName: 'Talya Sandor',
  sources: [{ outsideText: '<p>Some words.</p>' }],
};

function fakeBody() {
  const paragraphs = [];
  return {
    paragraphs,
    insertParagraph(index, text) {
      const p = {
        text, link: null, heading: null,
        setHeading(h) { p.heading = h; },
        editAsText: () => ({ setLinkUrl(url) { p.link = url; } }),
        setLeftToRight() {}, setRightToLeft() {}, setItalic() {}, setBold() {},
        setIndentStart() {}, setForegroundColor() {},
      };
      paragraphs.splice(index, 0, p);
      return p;
    },
  };
}

function insert(sheetPayload, insertMode) {
  const body = fakeBody();
  const context = {
    DocumentApp: {
      getActiveDocument: () => ({}),
      ParagraphHeading: { HEADING2: 'HEADING2' },
    },
    UrlFetchApp: {
      fetch: () => ({ getResponseCode: () => 200, getContentText: () => JSON.stringify(FULL_SHEET) }),
    },
    getTypographySettings: () => ({}),
    resolveInsertionTarget_: () => ({ container: body, index: 0 }),
    applyTitleTypography: () => {},
    applyRoleTypography_: () => {},
    decodeHTMLEntities: (s) => s,
    transliterateHebrewHtmlPreservingBasicBreaks: (s) => s,
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync('apps-script/server/sheets.gs', 'utf8'), context);
  context.insertSheet(sheetPayload, { insertMode });
  return body.paragraphs;
}

const texts = (paragraphs) => paragraphs.map((p) => p.text).filter(Boolean);

test('Both inserts the text once, under a title linked to the sheet', () => {
  const paragraphs = insert(payload(), 'both');
  assert.deepEqual(texts(paragraphs), [
    'Why do we read Kohelet on Sukkot?',
    'By Talya Sandor',
    'Some words.',
  ]);
  assert.equal(paragraphs[0].heading, 'HEADING2');
  assert.equal(paragraphs[0].link, SHEET_URL);
  assert.equal(paragraphs.filter((p) => p.link).length, 1, 'only the title is linked');
});

test('Text alone keeps an unlinked title', () => {
  const paragraphs = insert(payload(), 'contents');
  assert.deepEqual(texts(paragraphs), [
    'Why do we read Kohelet on Sukkot?',
    'By Talya Sandor',
    'Some words.',
  ]);
  assert.equal(paragraphs[0].link, null);
});

test('Citation drops a summary that only repeats the title', () => {
  const paragraphs = insert(payload(), 'reference');
  assert.deepEqual(texts(paragraphs), [
    'Why do we read Kohelet on Sukkot?',
    'Curated by Talya Sandor • Topics: Sukkah • ' + SHEET_URL,
  ]);
  assert.equal(paragraphs[0].link, SHEET_URL);
});

test('Citation keeps a summary that says something the title does not', () => {
  const paragraphs = insert(payload({ summary: 'Sources on joy and impermanence.' }), 'reference');
  assert.deepEqual(texts(paragraphs), [
    'Why do we read Kohelet on Sukkot?',
    'Sources on joy and impermanence.',
    'Curated by Talya Sandor • Topics: Sukkah • ' + SHEET_URL,
  ]);
});

test('a sheet URL that is not http(s) never becomes the title link', () => {
  const paragraphs = insert(payload({ url: 'javascript:alert(1)' }), 'both');
  assert.equal(paragraphs[0].link, null);
});
