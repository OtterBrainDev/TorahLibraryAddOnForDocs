const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

// Pins where an insert goes (apps-script/server/insertion-target.gs).
//
// Every insert path used to take `cursor.getElement().getParent().getChildIndex(el) + 1`
// and insert into the BODY at that index. The index was relative to whatever
// the parent happened to be — a table cell, a header, the paragraph holding a
// Text element — so an insert from inside a table landed at an unrelated place
// in the body without a word. See docs/regression-log.md.

const TYPES = {
  BODY_SECTION: 'BODY_SECTION', HEADER_SECTION: 'HEADER_SECTION', FOOTNOTE_SECTION: 'FOOTNOTE_SECTION',
  PARAGRAPH: 'PARAGRAPH', LIST_ITEM: 'LIST_ITEM', TEXT: 'TEXT',
  TABLE: 'TABLE', TABLE_ROW: 'TABLE_ROW', TABLE_CELL: 'TABLE_CELL',
};

// A minimal element tree. Each call to getParent() returns the SAME object
// here; sameElement_ also copes with Apps Script's fresh proxies.
function el(type, children, text) {
  const node = { type, children: children || [], parent: null, text: text || '' };
  node.children.forEach((c) => { c.parent = node; });
  node.getType = () => node.type;
  node.getParent = () => node.parent;
  node.getChildIndex = (child) => {
    const i = node.children.indexOf(child);
    if (i < 0) throw new Error('not a child');
    return i;
  };
  node.getNumChildren = () => node.children.length;
  node.getChild = (i) => node.children[i];
  node.removeFromParent = () => {
    const p = node.parent;
    p.children.splice(p.children.indexOf(node), 1);
    node.parent = null;
  };
  node.clear = () => { node.children = []; node.cleared = true; };
  node.asText = () => ({
    getText: () => node.text,
    deleteText: (s, e) => { node.text = node.text.slice(0, s) + node.text.slice(e + 1); },
  });
  return node;
}
const para = (text) => el(TYPES.PARAGRAPH, [el(TYPES.TEXT, [], text)]);
const textOf = (p) => p.children[0];

function buildDoc() {
  const inner = el(TYPES.TABLE, [el(TYPES.TABLE_ROW, [el(TYPES.TABLE_CELL, [para('nested')])])]);
  const cellA = el(TYPES.TABLE_CELL, [para('Isaiah 40:1'), para('second line in cell')]);
  const cellB = el(TYPES.TABLE_CELL, [para('other cell')]);
  const cellC = el(TYPES.TABLE_CELL, [para('outer'), inner]);
  const table = el(TYPES.TABLE, [el(TYPES.TABLE_ROW, [cellA, cellB, cellC])]);
  const body = el(TYPES.BODY_SECTION, [para('Title'), para('Genesis 1:1 here'), table, para('after')]);
  const header = el(TYPES.HEADER_SECTION, [para('Ruth 1:16')]);
  return { body, table, cellA, cellB, cellC, inner, header };
}

function load(state) {
  const context = {
    DocumentApp: {
      ElementType: TYPES,
      getActiveDocument: () => ({
        getBody: () => state.body,
        getCursor: () => state.cursor || null,
        getSelection: () => state.selection || null,
      }),
    },
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync('apps-script/server/insertion-target.gs', 'utf8'), context);
  return context;
}

const cursorAt = (element, offset) => ({ getElement: () => element, getOffset: () => offset || 0 });
const rangeOf = (element, partial) => ({
  getElement: () => element,
  isPartial: () => !!partial,
  getStartOffset: () => (partial ? partial[0] : -1),
  getEndOffsetInclusive: () => (partial ? partial[1] : -1),
});
const selectionOf = (...ranges) => ({ getRangeElements: () => ranges });

test('a cursor inside body text inserts after that paragraph, not after body child 1', () => {
  const doc = buildDoc();
  // getElement() on a cursor inside text returns the TEXT element; its parent
  // is the paragraph, whose child index is 0 — the old code inserted at 1.
  const ctx = load({ body: doc.body, cursor: cursorAt(textOf(doc.body.children[3])) });
  const target = ctx.resolveInsertionTarget_({ layout: 'paragraphs' });
  assert.equal(target.container, doc.body);
  assert.equal(target.index, 4);
  assert.equal(target.notice, '');
});

test('a paragraph layout from inside a table cell goes inside the cell, after the cursor paragraph', () => {
  const doc = buildDoc();
  const ctx = load({ body: doc.body, cursor: cursorAt(textOf(doc.cellA.children[0])) });
  const target = ctx.resolveInsertionTarget_({ layout: 'paragraphs' });
  assert.equal(target.container, doc.cellA);
  assert.equal(target.index, 1);
  assert.equal(target.notice, '');
});

test('a side-by-side layout from inside a table cell goes directly below the table, with a notice', () => {
  const doc = buildDoc();
  const ctx = load({ body: doc.body, cursor: cursorAt(textOf(doc.cellA.children[1])) });
  const target = ctx.resolveInsertionTarget_({ layout: 'table' });
  assert.equal(target.container, doc.body);
  assert.equal(target.index, 3, 'right after the table (body child 2)');
  assert.match(target.notice, /below the table/);
});

test('a nested table: paragraphs go in the innermost cell; a table goes below the outermost table', () => {
  const doc = buildDoc();
  const innerCell = doc.inner.children[0].children[0];
  const ctx = load({ body: doc.body, cursor: cursorAt(textOf(innerCell.children[0])) });
  const inside = ctx.resolveInsertionTarget_({ layout: 'paragraphs' });
  assert.equal(inside.container, innerCell);
  const below = ctx.resolveInsertionTarget_({ layout: 'table' });
  assert.equal(below.container, doc.body);
  assert.equal(below.index, 3);
});

test('a header, footer or footnote is refused with a message, never redirected into the body', () => {
  const doc = buildDoc();
  const ctx = load({ body: doc.body, cursor: cursorAt(textOf(doc.header.children[0])) });
  assert.throws(() => ctx.resolveInsertionTarget_({ layout: 'paragraphs' }), /header, footer or footnote/);
});

test('no cursor and no selection appends to the end of the body', () => {
  const doc = buildDoc();
  const ctx = load({ body: doc.body });
  const target = ctx.resolveInsertionTarget_({});
  assert.equal(target.container, doc.body);
  assert.equal(target.index, 4);
});

test('an empty body reporting the body itself as the cursor element uses the offset', () => {
  const body = el(TYPES.BODY_SECTION, [para('')]);
  const ctx = load({ body, cursor: cursorAt(body, 0) });
  const target = ctx.resolveInsertionTarget_({});
  assert.equal(target.container, body);
  assert.equal(target.index, 0);
});

test('an explicit anchor wins over the cursor (the linker\'s per-row insert)', () => {
  const doc = buildDoc();
  const ctx = load({ body: doc.body, cursor: cursorAt(textOf(doc.body.children[0])) });
  const target = ctx.resolveInsertionTarget_({ layout: 'paragraphs', anchor: doc.cellA.children[0] });
  assert.equal(target.container, doc.cellA);
  assert.equal(target.index, 1);
});

test('replacing a partial selection inside one cell deletes just that text and inserts in the cell', () => {
  const doc = buildDoc();
  const text = textOf(doc.cellA.children[0]);
  const ctx = load({ body: doc.body, selection: selectionOf(rangeOf(text, [0, 5])) });
  const target = ctx.resolveInsertionTarget_({ layout: 'paragraphs', replaceSelection: true });
  assert.equal(text.text, ' 40:1');
  assert.equal(target.container, doc.cellA);
  assert.equal(target.index, 1);
});

test('replacing a selection that spans cells deletes nothing and inserts below the table, with a notice', () => {
  const doc = buildDoc();
  const a = textOf(doc.cellA.children[0]);
  const b = textOf(doc.cellB.children[0]);
  const ctx = load({ body: doc.body, selection: selectionOf(rangeOf(a), rangeOf(b)) });
  const target = ctx.resolveInsertionTarget_({ layout: 'paragraphs', replaceSelection: true });
  assert.equal(a.text, 'Isaiah 40:1');
  assert.equal(b.text, 'other cell');
  assert.equal(target.container, doc.body);
  assert.equal(target.index, 3);
  assert.match(target.notice, /spans more than one table cell/);
});

test('replacing a body selection deletes it and inserts where it was', () => {
  const doc = buildDoc();
  const text = textOf(doc.body.children[1]);
  const ctx = load({ body: doc.body, selection: selectionOf(rangeOf(text, [0, 10])) });
  const target = ctx.resolveInsertionTarget_({ layout: 'table', replaceSelection: true });
  assert.equal(text.text, ' here');
  assert.equal(target.container, doc.body);
  assert.equal(target.index, 2);
  assert.equal(target.notice, '');
});

test('a kept selection inserts after its last block', () => {
  const doc = buildDoc();
  const ctx = load({
    body: doc.body,
    selection: selectionOf(rangeOf(textOf(doc.body.children[0])), rangeOf(textOf(doc.body.children[1]))),
  });
  const target = ctx.resolveInsertionTarget_({ layout: 'paragraphs', replaceSelection: false });
  assert.equal(target.index, 2);
  assert.equal(textOf(doc.body.children[0]).text, 'Title', 'nothing deleted');
});
