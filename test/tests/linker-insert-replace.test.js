// Pins Link Texts' per-source insert (insertLinkedSourceAtPosition in
// server/document-actions.gs) against Preferences -> Insertion -> "Insert from
// Selection replaces the selection".
//
// The bug: with the preference on, Insert from Selection replaced the citation
// with the source (titled with the citation), but Link Texts' insert left the
// citation in place and put the same reference again as the source's title on
// the next line, so every inserted citation appeared twice.
//
// Loaded with vm.runInContext; .gs is not a Node module format.

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

const ROOT = path.resolve(__dirname, '..', '..');
const TYPES = { PARAGRAPH: 'PARAGRAPH', LIST_ITEM: 'LIST_ITEM', TEXT: 'TEXT', BODY_SECTION: 'BODY_SECTION', TABLE: 'TABLE' };

// A body of plain paragraphs, each one Text element. Only what the linker's
// insert path calls.
function makeBody(lines, linkedLines) {
  const body = { children: [] };
  body.getType = () => TYPES.BODY_SECTION;
  body.getNumChildren = () => body.children.length;
  body.getChild = (i) => body.children[i];
  body.getChildIndex = (el) => body.children.indexOf(el);
  body.getParent = () => null;
  body.editAsText = () => ({ getText: () => body.children.map((p) => p.text).join('\n') });
  body.findText = (pattern, after) => {
    const re = new RegExp(pattern);
    let started = !after;
    for (const p of body.children) {
      let from = 0;
      if (!started) {
        if (p !== after.paragraph) continue;
        started = true;
        from = after.end + 1;
      }
      const m = re.exec(p.text.slice(from));
      if (m) {
        const start = from + m.index;
        return { paragraph: p, end: start + m[0].length - 1, getElement: () => p.textElement, getStartOffset: () => start };
      }
    }
    return null;
  };
  lines.forEach((line, i) => {
    const p = { text: line, cleared: false };
    p.getType = () => TYPES.PARAGRAPH;
    p.getText = () => p.text;
    p.getParent = () => body;
    p.clear = () => { p.text = ''; p.cleared = true; };
    p.removeFromParent = () => { body.children.splice(body.children.indexOf(p), 1); };
    p.textElement = {
      getType: () => TYPES.TEXT,
      getParent: () => p,
      asText: () => ({ getLinkUrl: () => ((linkedLines || []).indexOf(i) >= 0 ? 'https://www.sefaria.org/x' : null) })
    };
    body.children.push(p);
  });
  return body;
}

function load(body, prefs) {
  const calls = [];
  const context = {
    console,
    Logger: { log() {} },
    DocumentApp: { ElementType: TYPES, getActiveDocument: () => ({ getBody: () => body }) },
    getPreferences: () => Object.assign({}, prefs),
    findReference: (ref) => ({ ref: ref }),
    insertReference: (resolved, options) => {
      calls.push(options);
      // Stand-in for the inserted source: one paragraph after the anchor.
      const at = body.getChildIndex(options.insertAfterElement) + 1;
      const p = { text: '[source ' + options.preferredTitle + ']' };
      p.getType = () => TYPES.PARAGRAPH;
      p.getText = () => p.text;
      p.getParent = () => body;
      body.children.splice(at, 0, p);
      return { notice: '' };
    }
  };
  vm.createContext(context);
  ['apps-script/server/linker-prefilter.gs', 'apps-script/server/document-actions.gs'].forEach((relative) => {
    vm.runInContext(fs.readFileSync(path.join(ROOT, relative), 'utf8'), context, { filename: relative });
  });
  return { context, calls };
}

function decisionFor(body, text, occurrence) {
  const all = body.editAsText().getText();
  return { startChar: all.indexOf(text), endChar: all.indexOf(text) + text.length, documentText: text, occurrence: occurrence || 0 };
}

const texts = (body) => body.children.map((p) => p.text);

test('replace on: a citation on its own line is replaced by the source, titled with the citation', () => {
  const body = makeBody(['Intro.', 'Gen. 1:1', 'After.'], [1]);
  const { context, calls } = load(body, { insert_from_selection_replace: 'true' });
  const result = context.insertLinkedSourceAtPosition('Genesis 1:1', decisionFor(body, 'Gen. 1:1'));
  assert.equal(result.success, true);
  assert.deepEqual(texts(body), ['Intro.', '[source Gen. 1:1]', 'After.']);
  assert.equal(calls[0].preferredTitle, 'Gen. 1:1');
  // The citation was linked, so the title that replaces it is too.
  assert.equal(calls[0].insertSefariaLink, true);
});

test('replace on is the default when the preference is unset', () => {
  const body = makeBody(['Genesis 1:1', 'After.']);
  const { context, calls } = load(body, {});
  context.insertLinkedSourceAtPosition('Genesis 1:1', decisionFor(body, 'Genesis 1:1'));
  assert.deepEqual(texts(body), ['[source Genesis 1:1]', 'After.']);
  assert.equal(calls[0].insertSefariaLink, false);
});

test('replace on: brackets and a full stop around the citation still count as its own line', () => {
  const body = makeBody(['(Genesis 1:1).', 'After.']);
  const { context } = load(body, { insert_from_selection_replace: true });
  context.insertLinkedSourceAtPosition('Genesis 1:1', decisionFor(body, 'Genesis 1:1'));
  assert.deepEqual(texts(body), ['[source Genesis 1:1]', 'After.']);
});

test('replace on: a citation inside a sentence is kept, and the source goes below', () => {
  const body = makeBody(['As it says in Genesis 1:1, God created.', 'After.']);
  const { context, calls } = load(body, { insert_from_selection_replace: 'true' });
  context.insertLinkedSourceAtPosition('Genesis 1:1', decisionFor(body, 'Genesis 1:1'));
  assert.deepEqual(texts(body), ['As it says in Genesis 1:1, God created.', '[source Genesis 1:1]', 'After.']);
  assert.equal(calls[0].preferredTitle, 'Genesis 1:1');
});

test('replace off: the citation stays and the source is titled with the Sefaria ref', () => {
  const body = makeBody(['Gen. 1:1', 'After.']);
  const { context, calls } = load(body, { insert_from_selection_replace: 'false' });
  context.insertLinkedSourceAtPosition('Genesis 1:1', decisionFor(body, 'Gen. 1:1'));
  assert.deepEqual(texts(body), ['Gen. 1:1', '[source Genesis 1:1]', 'After.']);
  assert.equal(calls[0].preferredTitle, 'Genesis 1:1');
});

test('replace on: the second of two identical citations is the one replaced', () => {
  const body = makeBody(['Genesis 1:1', 'Text.', 'Genesis 1:1']);
  const { context } = load(body, {});
  context.insertLinkedSourceAtPosition('Genesis 1:1', decisionFor(body, 'Genesis 1:1', 1));
  assert.deepEqual(texts(body), ['Genesis 1:1', 'Text.', '[source Genesis 1:1]']);
});
