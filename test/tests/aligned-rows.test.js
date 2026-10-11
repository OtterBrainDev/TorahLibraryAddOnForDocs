// Pins the side-by-side layouts' "Line by line" setting
// (bilingual_aligned_rows): buildAlignedLinePairs_ in server/text-processing.gs
// pairs each Hebrew segment with its translation, and insertReference in
// server/insertion.gs gives each pair its own table row. Off (the default and
// what upgraders get) keeps the one-row table side-by-side inserts always had.
//
// Loaded with vm.createContext; .gs is not a Node module format.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const plain = (value) => JSON.parse(JSON.stringify(value));

function loadPure() {
  const context = { console, Logger: { log() {} } };
  vm.createContext(context);
  ['apps-script/gematriya.gs', 'apps-script/server/text-processing.gs'].forEach((file) => {
    vm.runInContext(read(file), context, { filename: file });
  });
  return context;
}

test('pairs each verse with its translation, numbered like formatDataForPesukim', () => {
  const ctx = loadPure();
  const pairs = ctx.buildAlignedLinePairs_({ he: ['א1', 'א2'], text: ['e1', 'e2'], sections: [1, 5] }, true);
  assert.deepEqual(plain(pairs), [
    { he: '(ה) א1', en: '(5) e1', heRaw: 'א1', number: 5, heading: false },
    { he: '(ו) א2', en: '(6) e2', heRaw: 'א2', number: 6, heading: false },
  ]);
  const unmarked = ctx.buildAlignedLinePairs_({ he: ['א1'], text: ['e1'], sections: [1, 5] }, false);
  assert.deepEqual(plain(unmarked), [{ he: 'א1', en: 'e1', heRaw: 'א1', number: null, heading: false }]);
});

test('a spanning ref gets a heading row per chapter and restarts the numbering', () => {
  const ctx = loadPure();
  const data = { isSpanning: true, sections: [1, 31], he: [['a'], ['b', 'c']], text: [['A'], ['B', 'C']] };
  const pairs = plain(ctx.buildAlignedLinePairs_(data, true));
  // The same headings formatDataForPesukim puts in the one-row layout.
  assert.deepEqual(pairs.map((p) => [p.he, p.en]), [
    ['פרק א', 'Chapter 1'], ['(לא) a', '(31) A'],
    ['פרק ב', 'Chapter 2'], ['(א) b', '(1) B'], ['(ב) c', '(2) C'],
  ]);
  assert.deepEqual(pairs.map((p) => p.heading), [true, false, true, false, false]);
  assert.equal(pairs[0].heRaw, '', 'a heading is not transliterated');
  // Without line markers there are no headings, as in the one-row layout.
  const unmarked = plain(ctx.buildAlignedLinePairs_(data, false));
  assert.deepEqual(unmarked.map((p) => p.en), ['A', 'B', 'C']);
});

test('a language missing a segment leaves its cell blank', () => {
  const ctx = loadPure();
  const pairs = ctx.buildAlignedLinePairs_({ he: ['a', 'b'], text: ['A'] }, true);
  assert.deepEqual(plain(pairs).map((p) => [p.he, p.en]), [['(א) a', '(1) A'], ['(ב) b', '']]);
});

test('nothing to pair falls back (null): a single string, or deeper nesting', () => {
  const ctx = loadPure();
  assert.equal(ctx.buildAlignedLinePairs_({ he: 'whole', text: ['A'] }, true), null);
  assert.equal(ctx.buildAlignedLinePairs_({ he: [['nested']], text: [['N']] }, true), null);
  assert.equal(ctx.buildAlignedLinePairs_({ he: [], text: [] }, true), null);
});

// A table of fake cells, enough for insertReference's side-by-side branch.
function fakeTable(cells) {
  const rows = cells.map((row) => row.map(() => {
    const cell = { paragraphs: [{ text: '' }] };
    const para = (p) => {
      const text = {
        insertText(offset, t) { p.text = p.text.slice(0, offset) + t + p.text.slice(offset); return text; },
        getText: () => p.text,
        editAsText: () => text,
        setLinkUrl: () => text, setBold: () => text, setItalic: () => text, setAttributes: () => text,
      };
      const api = {
        setLeftToRight: () => api, setAttributes: () => api, asParagraph: () => api,
        editAsText: () => text,
        removeFromParent: () => { cell.paragraphs.splice(cell.paragraphs.indexOf(p), 1); },
      };
      return api;
    };
    cell.setText = () => { cell.paragraphs = [{ text: '' }]; return cell; };
    cell.insertParagraph = (i, t) => { const p = { text: t || '' }; cell.paragraphs.splice(i, 0, p); return para(p); };
    cell.getNumChildren = () => cell.paragraphs.length;
    cell.getChild = (i) => para(cell.paragraphs[i]);
    return cell;
  }));
  return {
    rows,
    setAttributes() {},
    getCell: (r, c) => rows[r][c],
    getNumRows: () => rows.length,
    getRow: (r) => ({ getNumCells: () => rows[r].length, getCell: (c) => rows[r][c] }),
    texts: () => plain(rows.map((row) => row.map((cell) => cell.paragraphs.map((p) => p.text).join(' / ')))),
  };
}

function loadInsert(storedPrefs) {
  const tables = [];
  const body = {
    getNumChildren: () => 0,
    insertTable(i, cells) { const t = fakeTable(cells); tables.push(t); return t; },
    insertParagraph() { throw new Error('no paragraphs expected'); },
  };
  const context = {
    console,
    Logger: { log() {} },
    DocumentApp: {
      Attribute: new Proxy({}, { get: (_, k) => String(k) }),
      getActiveDocument() { return { getBody: () => body, getCursor: () => null, getSelection: () => null }; },
    },
    PropertiesService: { getUserProperties() { return { getProperty() { return null; } }; } },
    getPreferences() { return storedPrefs || {}; },
    getTypographySettings() { return { roles: {} }; },
    getEnglishAttributionLines() { return []; },
    getHebrewAttributionLines_() { return []; },
    applyTitleTypography() {},
    applyRoleTypography_() {},
    transliterateHebrewHtmlPreservingBasicBreaks: (html) => 'tr:' + html,
  };
  vm.createContext(context);
  ['apps-script/gematriya.gs', 'apps-script/server/text-processing.gs', 'apps-script/server/utils.gs',
    'apps-script/server/insertion-target.gs', 'apps-script/server/insertion.gs'].forEach((file) => {
    vm.runInContext(read(file), context, { filename: file });
  });
  return { context, tables };
}

const GENESIS = () => ({ ref: 'Genesis 1:1-2', heRef: 'בראשית א:א-ב', sections: [1, 1], he: ['בראשית', 'והארץ'], text: ['In the beginning', 'The earth'] });

test('off (the default) keeps the whole passage in one row', () => {
  const { context, tables } = loadInsert({});
  context.insertReference(GENESIS(), { bilingualLayout: 'he-right', pasukPreference: true });
  assert.deepEqual(tables[0].texts(), [
    ['Genesis 1:1-2', 'בראשית א:א-ב'],
    ['(1) In the beginning\n(2) The earth\n', '(א) בראשית\n(ב) והארץ\n'],
  ]);
});

test('on, each verse gets its own row beside its translation', () => {
  const { context, tables } = loadInsert({ bilingual_aligned_rows: 'true' });
  context.insertReference(GENESIS(), { bilingualLayout: 'he-right', pasukPreference: true });
  assert.deepEqual(tables[0].texts(), [
    ['Genesis 1:1-2', 'בראשית א:א-ב'],
    ['(1) In the beginning', '(א) בראשית'],
    ['(2) The earth', '(ב) והארץ'],
  ]);
});

test('the caller can override the stored setting; Left–Right puts the Hebrew first', () => {
  const { context, tables } = loadInsert({ bilingual_aligned_rows: 'false' });
  context.insertReference(GENESIS(), { bilingualLayout: 'he-left', pasukPreference: false, alignedRows: true });
  assert.deepEqual(tables[0].texts().slice(1), [['בראשית', 'In the beginning'], ['והארץ', 'The earth']]);
});

test('transliteration goes under each row\'s own Hebrew', () => {
  const { context, tables } = loadInsert({ bilingual_aligned_rows: 'true' });
  context.insertReference(GENESIS(), { bilingualLayout: 'he-right', pasukPreference: true, includeTransliteration: true });
  assert.deepEqual(tables[0].texts().slice(1).map((row) => row[1]), ['(א) בראשית / (א) tr:בראשית', '(ב) והארץ / (ב) tr:והארץ']);
});

test('the key is client-writable, defaults to off, and is migrated to off for upgraders', () => {
  const store = {};
  const props = { getProperty: (k) => (k in store ? store[k] : null), setProperty(k, v) { store[k] = String(v); return this; }, deleteProperty(k) { delete store[k]; return this; } };
  const context = { console, Logger: { log() {} }, PropertiesService: { getUserProperties: () => props } };
  vm.createContext(context);
  ['apps-script/server/menu-layout.gs', 'apps-script/server/preferences.gs', 'apps-script/migrations.gs'].forEach((file) => {
    vm.runInContext(read(file), context, { filename: file });
  });
  assert.ok(vm.runInContext('SETTINGS', context).includes('bilingual_aligned_rows'));
  assert.equal(context.getDefaultPreferences().bilingual_aligned_rows, false);
  assert.match(read('apps-script/server/document-actions.gs'), /bilingual_aligned_rows: 'boolean'/);
});
