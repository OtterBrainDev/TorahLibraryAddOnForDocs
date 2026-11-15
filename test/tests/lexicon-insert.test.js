// Add Entry in the Lexicon tab inserts the entries picked for one word, in the
// order they were picked (server/lexicon.gs: planLexiconInsertion_,
// insertLexiconEntry). Before, it inserted one entry at a time, as one
// paragraph of tag-stripped text cut at 2,000 characters. Pinned here: the
// headword once, then each entry's dictionary line, its senses a paragraph
// each with the dictionary's own numbers (sub-senses indented), its notes;
// the entry's bold, italics and superscript kept; and the translation's
// Commentary choice never applied to a definition ("Drop" would delete every
// word that isn't bold).
//
// Loaded with vm.runInContext; see AGENTS.md hard rule #3.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');
const SHEM = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'lexicon-shem.json'), 'utf8')).entries;

// Docs text with real per-character bold and italics, so the emphasis code in
// insertion.gs reads back what was set (a Drop that ran would delete words).
function fakeParagraph(initial) {
  const state = { text: initial || '', heading: null, indentStart: 0, indentFirstLine: 0, bold: [], italic: [], sup: [] };
  const flags = { bold: [], italic: [] };
  const resetFlags = () => { flags.bold = Array.from(state.text, () => false); flags.italic = Array.from(state.text, () => false); };
  resetFlags();
  const mark = (name, s, e, on) => {
    for (let i = s; i <= e; i++) flags[name][i] = !!on;
    if (on) state[name].push(state.text.slice(s, e + 1));
  };
  const text = {
    editAsText() { return text; },
    getText() { return state.text; },
    insertText(offset, t) {
      state.text = state.text.slice(0, offset) + t + state.text.slice(offset);
      ['bold', 'italic'].forEach((name) => flags[name].splice(offset, 0, ...Array.from(t, () => false)));
      return text;
    },
    deleteText(s, e) {
      state.text = state.text.slice(0, s) + state.text.slice(e + 1);
      ['bold', 'italic'].forEach((name) => flags[name].splice(s, e - s + 1));
      return text;
    },
    setBold(s, e, on) { mark('bold', s, e, on); return text; },
    setItalic(s, e, on) { mark('italic', s, e, on); return text; },
    setUnderline() { return text; },
    setFontFamily() { return text; },
    setFontSize() { return text; },
    setForegroundColor() { return text; },
    setBackgroundColor() { return text; },
    setTextAlignment(s, e, alignment) { if (alignment === 'SUPERSCRIPT') state.sup.push(state.text.slice(s, e + 1)); return text; },
    getTextAttributeIndices() {
      const out = [0];
      for (let i = 1; i < state.text.length; i++) {
        if (flags.bold[i] !== flags.bold[i - 1] || flags.italic[i] !== flags.italic[i - 1]) out.push(i);
      }
      return out;
    },
    isBold(i) { return flags.bold[i] === true; },
    isItalic(i) { return flags.italic[i] === true; },
  };
  const paragraph = {
    editAsText() { return text; },
    asParagraph() { return paragraph; },
    setHeading(h) { state.heading = h; return paragraph; },
    setIndentStart(points) { state.indentStart = points; return paragraph; },
    setIndentFirstLine(points) { state.indentFirstLine = points; return paragraph; },
    setAttributes() { return paragraph; },
    setLeftToRight() { return paragraph; },
    _state: state,
  };
  return paragraph;
}

function load({ typography, fetched } = {}) {
  const children = [];
  const body = {
    getNumChildren() { return children.length; },
    getChild(i) { return children[i]; },
    insertParagraph(i, t) { const p = fakeParagraph(t); children.splice(i, 0, p); return p; },
  };
  const context = {
    console,
    Logger: { log() {} },
    DocumentApp: {
      Attribute: new Proxy({}, { get: (_, k) => String(k) }),
      ParagraphHeading: { HEADING3: 'HEADING3', NORMAL: 'NORMAL' },
      TextAlignment: { SUPERSCRIPT: 'SUPERSCRIPT' },
      getActiveDocument() { return { getBody: () => body, getCursor: () => null }; },
    },
    PropertiesService: { getUserProperties() { return { getProperty() { return null; } }; } },
    UrlFetchApp: { fetch: () => ({ getResponseCode: () => 200, getContentText: () => JSON.stringify(fetched || SHEM) }) },
    getTypographySettings() { return JSON.parse(JSON.stringify(typography || { roles: {} })); },
    normalizeSourceEmphasisMode_(mode) { return mode || 'keep'; },
    isTitleRole_() { return false; },
  };
  vm.createContext(context);
  ['apps-script/server/utils.gs', 'apps-script/server/insertion-target.gs',
    'apps-script/server/hebrew-font-coverage.gs', 'apps-script/server/hebrew-fonts.gs',
    'apps-script/server/insertion.gs', 'apps-script/server/lexicon.gs'].forEach((file) => {
    vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), context, { filename: file });
  });
  return { lex: context, children, paragraphs: () => children.map((c) => c._state) };
}

const plain = (value) => JSON.parse(JSON.stringify(value));
const lineOf = (item) => (item.text !== undefined ? item.text : item.runs.map((r) => r.text).join(''));

const label = (e) => [e.dictionary, e.ordinal || e.strongNumber].filter(Boolean).join(' ');
function shemEntries(lex) {
  const words = plain(lex.groupLexiconEntries_(SHEM, 'שם'));
  const pick = (headWord, wanted) => words.find((w) => w.headWord === headWord).entries.find((e) => label(e) === wanted);
  return { klein: pick('שֵׁם', 'Klein I'), bdb1: pick('שֵׁם', 'BDB I'), bdb2: pick('שֵׁם', 'BDB II'),
    strongs: pick('שֵׁם', "Strong's 8034"), sum: pick('שׂוּם', 'BDB I') };
}

test('Full entry: the word once, then each picked entry in the order picked', () => {
  const { lex } = load();
  const { klein, bdb1 } = shemEntries(lex);
  const plan = plain(lex.planLexiconInsertion_([bdb1, klein], 'entry'));
  assert.deepEqual(plan.map((p) => [p.kind, p.depth || 0, lineOf(p)]), [
    ['headword', 0, 'שֵׁם'],
    // BDB's part of speech opens its definition: not repeated on this line.
    ['meta', 0, 'BDB Dictionary I'],
    ['sense', 0, 'n.m. 2 S 7:9 name (√ unknown; Thes שׁמה, cf. BaZMG xii (1887), 635; … Assyrian šumu; …);—abs. שׁ׳ Gn 6:4 +; …;—name:'],
    ['sense', 0, '1. of river Gn 2:11, 13, 14, beasts v 19, 20, city 26:33 (all J) +; …'],
    ['sense', 0, '2.'],
    ['sense', 1, 'a. usually of pers.: Gn 4:17, 19(×2) (J) +; …'],
    ['sense', 1, 'b. = reputation; (1) וַאֲגַדְּלָה שְׁמֶ֑ךָ Gn 12:2 (J), …'],
    ['sense', 0, '3. name, as designation of God, specif. of י׳ (especially Je Ez Is 2, 3 ψψ):— …'],
    ['blank', 0, ''],
    ['meta', 0, 'Klein Dictionary I · m.n.'],
    ['sense', 0, '1. (pl. שֵׁמוֹת) name, designation.'],
    ['sense', 0, '2. reputation, renown, fame.'],
    ['sense', 0, '3. name, as designation of God.'],
    ['notes', 0, '[Related to BAram. שֻׁם, … Ugar. shm, Arab. ism, usm, sim, Ethiop. sem, Akka. shumu (= name). …]'],
    // Klein's text says "Derivatives:" itself.
    ['notes', 0, 'Derivatives: הַשֵּׁם, בְּשֵׁם, …'],
  ]);
});

test('Word + ref is the word and the dictionaries; Definition is the senses alone', () => {
  const { lex } = load();
  const { klein, bdb2, strongs } = shemEntries(lex);
  assert.deepEqual(plain(lex.planLexiconInsertion_([klein, bdb2, strongs], 'headword')).map(lineOf),
    ['שֵׁם', 'Klein Dictionary I; BDB Dictionary II; BDB Augmented Strong 8034']);
  const definition = plain(lex.planLexiconInsertion_([klein, bdb2], 'definition'));
  assert.deepEqual(definition.map((p) => p.kind), ['sense', 'sense', 'sense', 'blank', 'sense']);
  assert.equal(lineOf(definition[4]), 'n.pr.m. first son of Noah;—Gn 5:32; 6:10; 7:13; …; Σημ.');
});

test('a stem heads its sub-senses, which are indented under it', () => {
  const { lex } = load();
  const { sum } = shemEntries(lex);
  const plan = plain(lex.planLexiconInsertion_([sum], 'entry'));
  assert.deepEqual(plan.map((p) => [p.depth || 0, lineOf(p).slice(0, 14)]), [
    [0, 'שׂוּם'],
    [0, 'BDB Dictionary'],
    [0, 'vb. put, place'],
    [0, 'Qal Pf. 3 ms. '],
    [1, '1.'],
    [2, 'a. put, set, i'],
    [2, 'b. put somethi'],
    [1, '2. set, direct'],
    [2, 'a. sword again'],
    [0, '†Hiph. Pf. 1 s'],
    [0, '†Hoph. Impf. 3'],
  ]);
  assert.equal(lineOf(plan[1]), 'BDB Dictionary I · also שִׂים');
  // The stem is bold, as in the printed dictionary.
  assert.deepEqual(plan[3].runs[0], { text: 'Qal ', bold: true, italic: false, sup: false });
});

test('Sefaria\'s markup becomes bold, italic and superscript runs; other tags keep their text', () => {
  const { lex } = load();
  assert.deepEqual(plain(lex.lexiconRichRuns_('<strong>vb.</strong> <em>put,  place</em> (cf. Nö<sup>ZMG xxxvii</sup>; <a class="refLink" href="/Genesis.2.8">Gn 2:8</a> &amp; <span dir="rtl">שָׁם</span><br>end) ')), [
    { text: 'vb.', bold: true, italic: false, sup: false },
    { text: ' ', bold: false, italic: false, sup: false },
    { text: 'put, place', bold: false, italic: true, sup: false },
    { text: ' (cf. Nö', bold: false, italic: false, sup: false },
    { text: 'ZMG xxxvii', bold: false, italic: false, sup: true },
    { text: '; Gn 2:8 & שָׁם end)', bold: false, italic: false, sup: false },
  ]);
});

test('Add Entry writes the plan: heading, indents, and the entry\'s own emphasis', () => {
  const { lex, paragraphs } = load({ typography: { roles: { hebrew: { font: '', size: 14, style: 'normal' }, translation: { font: 'Georgia', size: 11, style: 'normal' } } } });
  const { klein, bdb1, sum } = shemEntries(lex);
  const result = plain(lex.insertLexiconEntry({ insertMode: 'entry', headWord: 'שֵׁם', entries: [klein, bdb1] }));
  assert.deepEqual(result, { ok: true, inserted: 2 });

  const written = paragraphs();
  const plan = plain(lex.planLexiconInsertion_([klein, bdb1], 'entry'));
  assert.deepEqual(written.map((p) => p.text), plan.map(lineOf));
  assert.equal(written[0].heading, 'HEADING3');
  assert.ok(written.slice(1).every((p) => p.heading === 'NORMAL'));
  const reputation = written.find((p) => p.text.startsWith('b. = reputation'));
  assert.equal(reputation.indentStart, 18);
  assert.ok(reputation.italic.includes('reputation;'));
  assert.ok(written.find((p) => p.text.startsWith('n.m.')).bold.includes('n.m.'));

  // Superscript and the stem label, in a second insert.
  const again = load({ typography: { roles: { translation: { font: '', size: 11, style: 'normal' } } } });
  again.lex.insertLexiconEntry({ insertMode: 'entry', entries: [sum] });
  const lines = again.paragraphs();
  assert.ok(lines.find((p) => p.text.startsWith('vb.')).sup.includes('ZMG xxxvii (1883), 532'));
  assert.ok(lines.find((p) => p.text.startsWith('vb.')).bold.includes('vb.'));
  assert.ok(lines.find((p) => p.text.startsWith('Qal')).bold.includes('Qal '));
});

test('the translation\'s Commentary "Drop" never deletes a definition\'s plain words', () => {
  const typography = {
    sourceEmphasisMode: 'only',
    roles: { translation: { font: '', size: 11, style: 'normal' }, hebrew: { font: '', size: 14, style: 'normal' } },
  };
  const { lex, paragraphs } = load({ typography });
  const { bdb2 } = shemEntries(lex);
  // "n.pr.m." is bold; the rest is not.
  lex.insertLexiconEntry({ insertMode: 'definition', entries: [bdb2] });
  assert.deepEqual(paragraphs().map((p) => p.text), ['n.pr.m. first son of Noah;—Gn 5:32; 6:10; 7:13; …; Σημ.']);
  assert.deepEqual(paragraphs()[0].bold, ['n.pr.m.']);
});

test('an older sidebar\'s one Sefaria-shaped entry still inserts', () => {
  const { lex, paragraphs } = load();
  lex.insertLexiconEntry({
    insertMode: 'entry',
    headWord: 'שָׁלוֹם',
    lexiconName: 'Jastrow Dictionary',
    morphology: 'm.',
    content: { senses: [{ definition: '<b>peace</b>, welfare' }] },
  });
  assert.deepEqual(paragraphs().map((p) => p.text), ['שָׁלוֹם', 'Jastrow Dictionary · m.', 'peace, welfare']);
});

test('nothing picked is an error, not an empty insert', () => {
  const { lex, paragraphs } = load();
  assert.throws(() => lex.insertLexiconEntry({ insertMode: 'entry', entries: [] }), /No lexicon entry is selected/);
  assert.throws(() => lex.insertLexiconEntry(null), /No lexicon entry is selected/);
  assert.equal(paragraphs().length, 0);
});
