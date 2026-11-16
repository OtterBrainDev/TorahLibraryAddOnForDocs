// Pins the "Line by line" setting (bilingual_aligned_rows):
// buildAlignedLinePairs_ in server/text-processing.gs pairs each Hebrew
// segment with its translation; insertReference in server/insertion.gs gives
// each pair its own table row in the side-by-side layouts, and in Stacked puts
// each line, its transliteration and its translation one after another down
// the page. Off (the default and what upgraders get) keeps the one-row table
// and the one block per language inserts always had. Also the side-by-side
// transliteration's place (transliteration_position): under the Hebrew, or a
// column of its own left or right of it.
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
        setLinkUrl(url) { p.link = url; return text; }, setBold: () => text, setItalic: () => text, setAttributes: () => text,
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
    links: () => plain(rows.map((row) => row.map((cell) => cell.paragraphs.map((p) => p.link || null).filter(Boolean).join(' / ')))),
  };
}

function loadInsert(storedPrefs) {
  const tables = [];
  // Body paragraphs, in order: { text, ltr }. The side-by-side layouts insert
  // only a table (with no citation or credit); Stacked inserts paragraphs.
  const paragraphs = [];
  const fakeParagraph = (p) => {
    const text = {
      insertText(offset, t) { p.text = p.text.slice(0, offset) + t + p.text.slice(offset); return text; },
      getText: () => p.text,
      editAsText: () => text,
      setLinkUrl: () => text, setBold: () => text, setItalic: () => text, setAttributes: () => text,
    };
    const api = {
      setLeftToRight(ltr) { p.ltr = ltr; return api; },
      setAttributes: () => api,
      setText(t) { p.text = t; return api; },
      asParagraph: () => api,
      editAsText: () => text,
    };
    return api;
  };
  const body = {
    getNumChildren: () => paragraphs.length,
    getChild: (i) => fakeParagraph(paragraphs[i]),
    insertTable(i, cells) { const t = fakeTable(cells); tables.push(t); return t; },
    insertParagraph(i, t) { const p = { text: t || '', ltr: null }; paragraphs.splice(i, 0, p); return fakeParagraph(p); },
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
    'apps-script/server/insertion-target.gs', 'apps-script/server/transliterated-title.gs',
    'apps-script/server/insertion.gs'].forEach((file) => {
    vm.runInContext(read(file), context, { filename: file });
  });
  return { context, tables, paragraphs };
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

// The transliteration is read from the Hebrew as fetched (heTransliterationSource,
// vowels kept), not the Hebrew as inserted. See transliteration-source.test.js.
const VOWELED = () => Object.assign(GENESIS(), { heTransliterationSource: ['בְּרֵאשִׁית', 'וְהָאָרֶץ'] });

test('one row: the transliteration reads the voweled Hebrew, with the same line markers', () => {
  const { context } = loadInsert({});
  const read = [];
  context.transliterateHebrewHtmlPreservingBasicBreaks = (html) => { read.push(html); return 'tr'; };
  context.insertReference(VOWELED(), { bilingualLayout: 'he-right', pasukPreference: true, includeTransliteration: true });
  assert.deepEqual(read, ['(א) בְּרֵאשִׁית\n(ב) וְהָאָרֶץ\n']);
});

test('line by line: each row\'s transliteration reads its own voweled Hebrew', () => {
  const { context, tables } = loadInsert({ bilingual_aligned_rows: 'true' });
  context.insertReference(VOWELED(), { bilingualLayout: 'he-right', pasukPreference: false, includeTransliteration: true });
  assert.deepEqual(tables[0].texts().slice(1).map((row) => row[1]), ['בראשית / tr:בְּרֵאשִׁית', 'והארץ / tr:וְהָאָרֶץ']);
});

// ── Stacked ("Hebrew on top") ───────────────────────────────────────────────

const stackedTexts = (paragraphs) => paragraphs.map((p) => p.text);

test('Stacked, off (the default): one block per language, as before', () => {
  const { context, paragraphs, tables } = loadInsert({});
  context.insertReference(GENESIS(), { bilingualLayout: 'he-top', pasukPreference: true });
  assert.equal(tables.length, 0);
  assert.deepEqual(stackedTexts(paragraphs), [
    'בראשית א:א-ב', '(א) בראשית\n(ב) והארץ\n', 'Genesis 1:1-2', '(1) In the beginning\n(2) The earth\n',
  ]);
});

test('Stacked, line by line: the titles, then each line and its translation going down the page', () => {
  const { context, paragraphs, tables } = loadInsert({ bilingual_aligned_rows: 'true' });
  context.insertReference(GENESIS(), { bilingualLayout: 'he-top', pasukPreference: true });
  assert.equal(tables.length, 0, 'no table: Stacked is paragraphs');
  assert.deepEqual(stackedTexts(paragraphs), [
    'בראשית א:א-ב', 'Genesis 1:1-2',
    '(א) בראשית', '(1) In the beginning',
    '(ב) והארץ', '(2) The earth',
  ]);
  // The Hebrew right to left, the translation left to right.
  assert.deepEqual(paragraphs.map((p) => p.ltr), [false, true, false, true, false, true]);
});

test('Stacked, line by line: the caller can turn it on over the stored setting, and off', () => {
  const on = loadInsert({ bilingual_aligned_rows: 'false' });
  on.context.insertReference(GENESIS(), { bilingualLayout: 'he-top', pasukPreference: false, alignedRows: true });
  assert.deepEqual(stackedTexts(on.paragraphs).slice(2), ['בראשית', 'In the beginning', 'והארץ', 'The earth']);
  const off = loadInsert({ bilingual_aligned_rows: 'true' });
  off.context.insertReference(GENESIS(), { bilingualLayout: 'he-top', pasukPreference: false, alignedRows: false });
  assert.equal(off.paragraphs.length, 4, 'one block per language');
});

test('Stacked, line by line: each line\'s transliteration follows its Hebrew, before the translation', () => {
  const { context, paragraphs } = loadInsert({ bilingual_aligned_rows: 'true' });
  context.insertReference(VOWELED(), { bilingualLayout: 'he-top', pasukPreference: true, includeTransliteration: true });
  assert.deepEqual(stackedTexts(paragraphs).slice(2), [
    '(א) בראשית', '(א) tr:בְּרֵאשִׁית', '(1) In the beginning',
    '(ב) והארץ', '(ב) tr:וְהָאָרֶץ', '(2) The earth',
  ]);
  assert.deepEqual(paragraphs.slice(2).map((p) => p.ltr), [false, true, true, false, true, true]);
});

test('Stacked, line by line: the transliteration position never moves it from under the Hebrew', () => {
  const { context, paragraphs } = loadInsert({ bilingual_aligned_rows: 'true', transliteration_position: 'left' });
  context.insertReference(VOWELED(), { bilingualLayout: 'he-top', pasukPreference: false, includeTransliteration: true });
  assert.deepEqual(stackedTexts(paragraphs).slice(2, 5), ['בראשית', 'tr:בְּרֵאשִׁית', 'In the beginning']);
});

test('Stacked, line by line: a spanning ref keeps its chapter headings; a missing line is left out', () => {
  const { context, paragraphs } = loadInsert({ bilingual_aligned_rows: 'true' });
  context.insertReference({
    ref: 'Genesis 1:31-2:1', heRef: 'בראשית א:לא-ב:א', isSpanning: true, sections: [1, 31],
    he: [['a'], ['b']], text: [['A'], []],
  }, { bilingualLayout: 'he-top', pasukPreference: true });
  assert.deepEqual(stackedTexts(paragraphs).slice(2), [
    'פרק א', 'Chapter 1', '(לא) a', '(31) A',
    'פרק ב', '(א) b',
  ]);
});

test('Stacked, line by line: credit and citation follow the last line', () => {
  const { context, paragraphs } = loadInsert({ bilingual_aligned_rows: 'true' });
  context.getEnglishAttributionLines = () => ['Translation: Koren'];
  context.insertReference(GENESIS(), { bilingualLayout: 'he-top', pasukPreference: false, includeTranslationSourceInfo: true });
  assert.deepEqual(stackedTexts(paragraphs).slice(-3), ['והארץ', 'The earth', 'Translation: Koren']);
});

test('Stacked, line by line: a source with no lines to pair keeps one block per language', () => {
  const { context, paragraphs } = loadInsert({ bilingual_aligned_rows: 'true' });
  context.insertReference({ ref: 'Note 1', heRef: 'הערה א', he: 'whole', text: 'Whole' }, { bilingualLayout: 'he-top', pasukPreference: false });
  assert.deepEqual(stackedTexts(paragraphs), ['הערה א', 'whole', 'Note 1', 'Whole']);
});

// ── The side-by-side transliteration column ─────────────────────────────────

test('transliteration left of the Hebrew: a column of its own (Right–Left)', () => {
  // The same transliteration "below" puts under the Hebrew.
  const below = loadInsert({});
  below.context.insertReference(VOWELED(), { bilingualLayout: 'he-right', pasukPreference: true, includeTransliteration: true });
  const transliteration = below.tables[0].texts()[1][1].split(' / ')[1];
  assert.match(transliteration, /^tr:\(א\) בְּרֵאשִׁית/);

  const { context, tables } = loadInsert({});
  context.insertReference(VOWELED(), {
    bilingualLayout: 'he-right', pasukPreference: true, includeTransliteration: true, transliterationPosition: 'left',
  });
  // The payload names no index titles, so the column's title is the Latin
  // reference (see "the transliteration column's title" below).
  assert.deepEqual(tables[0].texts(), [
    ['Genesis 1:1-2', 'Genesis 1:1-2', 'בראשית א:א-ב'],
    ['(1) In the beginning\n(2) The earth\n', transliteration, '(א) בראשית\n(ב) והארץ\n'],
  ]);
});

test('transliteration right of the Hebrew, Left–Right: Hebrew, transliteration, translation', () => {
  const { context, tables } = loadInsert({});
  context.insertReference(VOWELED(), {
    bilingualLayout: 'he-left', pasukPreference: false, includeTransliteration: true, transliterationPosition: 'right',
  });
  const [titles, row] = tables[0].texts();
  assert.deepEqual(titles, ['בראשית א:א-ב', 'Genesis 1:1-2', 'Genesis 1:1-2']);
  assert.equal(row[0], 'בראשית והארץ');
  assert.match(row[1], /^tr:בְּרֵאשִׁית/);
  assert.equal(row[2], 'In the beginning The earth');
});

test('transliteration column, line by line: each row\'s own transliteration, beside its Hebrew', () => {
  const { context, tables } = loadInsert({ bilingual_aligned_rows: 'true', transliteration_position: 'right' });
  context.insertReference(VOWELED(), { bilingualLayout: 'he-right', pasukPreference: true, includeTransliteration: true });
  assert.deepEqual(tables[0].texts(), [
    ['Genesis 1:1-2', 'בראשית א:א-ב', 'Genesis 1:1-2'],
    ['(1) In the beginning', '(א) בראשית', '(א) tr:בְּרֵאשִׁית'],
    ['(2) The earth', '(ב) והארץ', '(ב) tr:וְהָאָרֶץ'],
  ]);
});

test('transliteration column: a chapter heading row has an empty transliteration cell', () => {
  const { context, tables } = loadInsert({ bilingual_aligned_rows: 'true' });
  context.insertReference({
    ref: 'Genesis 1:31-2:1', heRef: 'בראשית א:לא-ב:א', isSpanning: true, sections: [1, 31],
    he: [['a'], ['b']], text: [['A'], ['B']],
  }, { bilingualLayout: 'he-right', pasukPreference: true, includeTransliteration: true, transliterationPosition: 'left' });
  assert.deepEqual(tables[0].texts().map((row) => row[1]), ['Genesis 1:31-2:1', '', '(לא) tr:a', '', '(א) tr:b']);
});

// The column's title: the Hebrew title, transliterated (transliterated-title.gs).
const TITLED = (extra) => Object.assign(VOWELED(), {
  indexTitle: 'Genesis', heIndexTitle: 'בראשית', type: 'Tanakh',
  heTitleVariants: ["ברא'", 'בר׳', 'בְּרֵאשִׁית', 'בראשית'],
}, extra || {});

test('the transliteration column\'s title is the Hebrew title transliterated, numbers as in the Latin reference', () => {
  const { context, tables } = loadInsert({});
  context.insertReference(TITLED(), {
    bilingualLayout: 'he-right', pasukPreference: true, includeTransliteration: true, transliterationPosition: 'left',
  });
  // Read from Sefaria's pointed spelling, through the same transliteration.
  assert.equal(tables[0].texts()[0][1], 'tr:בְּרֵאשִׁית 1:1-2');
});

test('the transliteration column\'s title carries the Hebrew title\'s link, and only when it is linked', () => {
  const linked = loadInsert({});
  linked.context.insertReference(TITLED(), {
    bilingualLayout: 'he-right', pasukPreference: false, includeTransliteration: true, transliterationPosition: 'right',
    insertSefariaLink: false, insertHebrewSefariaLink: true,
  });
  assert.deepEqual(linked.tables[0].links()[0], ['', 'https://www.sefaria.org/Genesis_1%3A1-2', 'https://www.sefaria.org/Genesis_1%3A1-2']);
  const plainTitles = loadInsert({});
  plainTitles.context.insertReference(TITLED(), {
    bilingualLayout: 'he-right', pasukPreference: false, includeTransliteration: true, transliterationPosition: 'right',
    insertSefariaLink: true, insertHebrewSefariaLink: false,
  });
  assert.deepEqual(plainTitles.tables[0].links()[0], ['https://www.sefaria.org/Genesis_1%3A1-2', '', '']);
});

function loadTitle() {
  const context = { console, Logger: { log() {} } };
  vm.createContext(context);
  ['apps-script/server/utils.gs', 'apps-script/gematriya.gs', 'apps-script/transliteration.gs',
    'apps-script/server/transliterated-title.gs'].forEach((file) => {
    vm.runInContext(read(file), context, { filename: file });
  });
  return context;
}

test('the title is read in a pointed spelling: Sefaria\'s, else the Tanakh\'s book names; book numbers as Roman', () => {
  const ctx = loadTitle();
  const parts = (data) => plain(ctx.pointedTitleParts_(data));
  assert.deepEqual(parts(TITLED()), { hebrew: 'בְּרֵאשִׁית', bookNumber: '', address: ' 1:1-2' });
  // Sefaria has no pointed שמות: the built-in list has.
  assert.deepEqual(parts({ ref: 'Exodus 20:2', indexTitle: 'Exodus', heIndexTitle: 'שמות', heTitleVariants: ['שמות'] }),
    { hebrew: 'שְׁמוֹת', bookNumber: '', address: ' 20:2' });
  assert.deepEqual(parts({ ref: 'I Samuel 1:1', indexTitle: 'I Samuel', heIndexTitle: 'שמואל א' }),
    { hebrew: 'שְׁמוּאֵל', bookNumber: 'I', address: ' 1:1' });
  assert.deepEqual(parts({ ref: 'II Chronicles 36:23', indexTitle: 'II Chronicles', heIndexTitle: 'דברי הימים ב' }),
    { hebrew: 'דִּבְרֵי הַיָּמִים', bookNumber: 'II', address: ' 36:23' });
  assert.deepEqual(parts({ ref: 'Song of Songs 1:1-2:3', indexTitle: 'Song of Songs', heIndexTitle: 'שיר השירים' }),
    { hebrew: 'שִׁיר הַשִּׁירִים', bookNumber: '', address: ' 1:1-2:3' });
  assert.deepEqual(parts({ ref: 'Berakhot 2a:1-5', indexTitle: 'Berakhot', heIndexTitle: 'ברכות', heTitleVariants: ['בְּרָכוֹת', 'ברכות'] }),
    { hebrew: 'בְּרָכוֹת', bookNumber: '', address: ' 2a:1-5' });
});

test('a title with a word whose vowels aren\'t known is Sefaria\'s Latin reference, never bare consonants', () => {
  const ctx = loadTitle();
  const title = (data) => ctx.transliteratedTitle_(data, (hebrew) => 'tr:' + hebrew);
  assert.equal(title({ ref: 'Mishnah Berakhot 1:1', indexTitle: 'Mishnah Berakhot', heIndexTitle: 'משנה ברכות', heTitleVariants: ['משנה ברכות'] }), 'Mishnah Berakhot 1:1');
  assert.equal(title({ ref: 'Rashi on Exodus 1:1:1', indexTitle: 'Rashi on Exodus', heIndexTitle: 'רש"י על שמות' }), 'Rashi on Exodus 1:1:1');
  // Not numbers after the book's title: a section of a complex text.
  assert.equal(title({ ref: 'Siddur Ashkenaz, Weekday, Shacharit, Modeh Ani 1', indexTitle: 'Siddur Ashkenaz', heIndexTitle: 'סידור אשכנז' }),
    'Siddur Ashkenaz, Weekday, Shacharit, Modeh Ani 1');
  assert.equal(title({ ref: 'Genesis 1:1' }), 'Genesis 1:1', 'no index titles');
  assert.equal(title({ ref: 'Exodus 20:2', indexTitle: 'Exodus', heIndexTitle: 'שמות' }), 'tr:שְׁמוֹת 20:2');
});

test('with the real transliteration: the title reads like the text, not like its consonants', () => {
  const ctx = loadTitle();
  const read = (hebrew) => ctx.transliterateHebrewHtmlPreservingBasicBreaks(hebrew, 'traditional', {
    keepNiqqud: true, isBiblicalHebrew: true, dageshMode: 'none', overrideMap: {},
  });
  const title = ctx.transliteratedTitle_(TITLED(), read);
  assert.equal(title, read('בְּרֵאשִׁית') + ' 1:1-2');
  // The bare title, as Sefaria sends it, read "Vrʾshyt ʾ:ʾ-v".
  assert.notEqual(title.split(' ')[0], read('בראשית'));
  assert.doesNotMatch(title, /[א-ת]/, 'no Hebrew letters left');
});

test('"below" (the default), and anything unknown, keeps the transliteration under the Hebrew', () => {
  for (const position of [undefined, 'below', 'sideways']) {
    const { context, tables } = loadInsert(position === undefined ? {} : { transliteration_position: position });
    context.insertReference(GENESIS(), { bilingualLayout: 'he-right', pasukPreference: false, includeTransliteration: true });
    assert.equal(tables[0].texts()[0].length, 2, String(position));
    assert.match(tables[0].texts()[1][1], / \/ tr:/, String(position));
  }
});

test('no transliteration, no column, whatever the position', () => {
  const { context, tables } = loadInsert({ transliteration_position: 'left' });
  context.insertReference(GENESIS(), { bilingualLayout: 'he-right', pasukPreference: false });
  assert.deepEqual(tables[0].texts()[0], ['Genesis 1:1-2', 'בראשית א:א-ב']);
});

test('transliteration_position: client-writable, defaults to "below", migrated to "below" for upgraders', () => {
  const store = { prefs_schema_version: '29', transliteration_scheme: 'ashkenazi' };
  const props = { getProperty: (k) => (k in store ? store[k] : null), setProperty(k, v) { store[k] = String(v); return this; }, deleteProperty(k) { delete store[k]; return this; } };
  const context = { console, Logger: { log() {} }, PropertiesService: { getUserProperties: () => props } };
  vm.createContext(context);
  ['apps-script/server/menu-layout.gs', 'apps-script/server/preferences.gs', 'apps-script/migrations.gs'].forEach((file) => {
    vm.runInContext(read(file), context, { filename: file });
  });
  assert.ok(vm.runInContext('SETTINGS', context).includes('transliteration_position'));
  assert.equal(context.getDefaultPreferences().transliteration_position, 'below');
  context.runUserPreferenceMigrationsIfNeeded_();
  assert.equal(store.transliteration_position, 'below');
  store.transliteration_position = 'left';
  store.prefs_schema_version = '29';
  context.runUserPreferenceMigrationsIfNeeded_();
  assert.equal(store.transliteration_position, 'left', 'a stored value is never overwritten');
  assert.match(read('apps-script/server/document-actions.gs'), /transliteration_position: \['below', 'left', 'right'\]/);
});

// ── Stacked with several translations (insertReferenceVersions) ─────────────

const VERSIONS = {
  Koren: { ref: 'Genesis 1:1-2', heRef: 'בראשית א:א-ב', versionTitle: 'Koren', heVersionTitle: 'Miqra', sections: [1, 1], he: ['בראשית', 'והארץ'], text: ['In the beginning', 'The earth'] },
  JPS: { ref: 'Genesis 1:1-2', heRef: 'בראשית א:א-ב', versionTitle: 'JPS', heVersionTitle: 'Miqra', sections: [1, 1], he: ['בראשית', 'והארץ'], text: ['When God began', 'The earth being'] },
};

function loadVersions(storedPrefs) {
  const loaded = loadInsert(storedPrefs);
  loaded.context.findReference = (ref, versions) => JSON.parse(JSON.stringify(VERSIONS[versions.en]));
  loaded.context.getEnglishAttributionLines = (d) => ['Translation: ' + d.versionTitle];
  return loaded;
}

test('Stacked, line by line, two translations: each Hebrew line, then that line of each translation, in the order picked', () => {
  const { context, paragraphs } = loadVersions({ bilingual_aligned_rows: 'true' });
  const result = context.insertReferenceVersions('Genesis 1:1-2', {
    versionTitles: ['JPS', 'Koren'], bilingualLayout: 'he-top', pasukPreference: true, includeTranslationSourceInfo: true,
  });
  assert.deepEqual([...result.inserted], ['JPS', 'Koren']);
  assert.deepEqual(stackedTexts(paragraphs), [
    'בראשית א:א-ב', 'Genesis 1:1-2 (JPS)', 'Genesis 1:1-2 (Koren)',
    '(א) בראשית', '(1) When God began', '(1) In the beginning',
    '(ב) והארץ', '(2) The earth being', '(2) The earth',
    'Hebrew: Miqra\nTranslation: JPS\nTranslation: Koren',
    '',
  ]);
});

test('Stacked, two translations, line by line off (the default): the blocks, as before', () => {
  const { context, paragraphs } = loadVersions({});
  context.insertReferenceVersions('Genesis 1:1-2', { versionTitles: ['JPS', 'Koren'], bilingualLayout: 'he-top', pasukPreference: false });
  assert.deepEqual(stackedTexts(paragraphs), [
    'בראשית א:א-ב', 'בראשית והארץ',
    'Genesis 1:1-2 (JPS)', 'When God began The earth being', '',
    'Genesis 1:1-2 (Koren)', 'In the beginning The earth', '',
  ]);
  // The caller's choice wins over the stored one.
  const on = loadVersions({ bilingual_aligned_rows: 'false' });
  on.context.insertReferenceVersions('Genesis 1:1-2', { versionTitles: ['JPS', 'Koren'], bilingualLayout: 'he-top', pasukPreference: false, alignedRows: true });
  assert.deepEqual(stackedTexts(on.paragraphs).slice(3, 6), ['בראשית', 'When God began', 'In the beginning']);
});

test('translation only ignores line by line: one block per translation', () => {
  const { context, paragraphs } = loadVersions({ bilingual_aligned_rows: 'true' });
  context.insertReferenceVersions('Genesis 1:1-2', { versionTitles: ['JPS', 'Koren'], singleLanguage: 'en', pasukPreference: false });
  assert.deepEqual(stackedTexts(paragraphs), [
    'Genesis 1:1-2 (JPS)', 'When God began The earth being', '',
    'Genesis 1:1-2 (Koren)', 'In the beginning The earth', '',
  ]);
});

test('Stacked, two translations: the transliteration under the Hebrew, then the blocks', () => {
  const { context, paragraphs } = loadVersions({});
  context.findReference = (ref, versions) => Object.assign(JSON.parse(JSON.stringify(VERSIONS[versions.en])),
    { heTransliterationSource: ['בְּרֵאשִׁית', 'וְהָאָרֶץ'] });
  context.insertReferenceVersions('Genesis 1:1-2', {
    versionTitles: ['JPS', 'Koren'], bilingualLayout: 'he-top', pasukPreference: false, includeTransliteration: true,
  });
  assert.deepEqual(stackedTexts(paragraphs), [
    'בראשית א:א-ב', 'בראשית והארץ', 'tr:בְּרֵאשִׁית וְהָאָרֶץ',
    'Genesis 1:1-2 (JPS)', 'When God began The earth being', '',
    'Genesis 1:1-2 (Koren)', 'In the beginning The earth', '',
  ]);
  // Translation only has no Hebrew to transliterate.
  const en = loadVersions({});
  en.context.insertReferenceVersions('Genesis 1:1-2', { versionTitles: ['JPS', 'Koren'], singleLanguage: 'en', pasukPreference: false, includeTransliteration: true });
  assert.ok(!stackedTexts(en.paragraphs).some((t) => t.startsWith('tr:')));
});

test('Stacked, two translations, line by line: each line\'s transliteration under its Hebrew, before the translations', () => {
  const { context, paragraphs } = loadVersions({ bilingual_aligned_rows: 'true' });
  context.findReference = (ref, versions) => Object.assign(JSON.parse(JSON.stringify(VERSIONS[versions.en])),
    { heTransliterationSource: ['בְּרֵאשִׁית', 'וְהָאָרֶץ'] });
  context.insertReferenceVersions('Genesis 1:1-2', {
    versionTitles: ['JPS', 'Koren'], bilingualLayout: 'he-top', pasukPreference: true, includeTransliteration: true,
  });
  assert.deepEqual(stackedTexts(paragraphs).slice(3), [
    '(א) בראשית', '(א) tr:בְּרֵאשִׁית', '(1) When God began', '(1) In the beginning',
    '(ב) והארץ', '(ב) tr:וְהָאָרֶץ', '(2) The earth being', '(2) The earth',
    '',
  ]);
});
