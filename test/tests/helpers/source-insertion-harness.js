// Small DocumentApp stand-ins based on the aligned-rows and multi-version
// insertion tests, with character attributes retained. Content parsing,
// commentary, notes, typography, line formatting and layout are production code.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ROOT = path.resolve(__dirname, '../../..');

function loadSourceInsertion({ preferences = {}, versions = {} } = {}) {
  const paragraphs = [], tables = [], children = [];
  const propertyValues = { source_notes_mode: 'omit', source_emphasis_mode: 'keep', ...preferences };
  const props = { getProperty: (key) => Object.hasOwn(propertyValues, key) ? String(propertyValues[key]) : null,
    getProperties: () => ({ ...propertyValues }) };
  const attrKey = { BOLD: 'bold', ITALIC: 'italic', UNDERLINE: 'underline', FONT_FAMILY: 'font', FONT_SIZE: 'size' };
  function paragraph(initial = '', parent = null) {
    const state = { chars: [], ltr: null, parent, attrs: {} };
    const makeChars = (text) => String(text).split('').map((ch) => ({ ch, bold: false, italic: false, underline: false, script: 'NORMAL' }));
    state.chars = makeChars(initial);
    Object.defineProperty(state, 'text', { get: () => state.chars.map((c) => c.ch).join('') });
    let api;
    const set = (key, start, end, value) => {
      if (value === undefined) { value = start; start = 0; end = state.chars.length - 1; }
      for (let i = start; i <= end; i++) if (state.chars[i]) state.chars[i][key] = value;
      return text;
    };
    const text = {
      editAsText: () => text, getText: () => state.text,
      insertText(at, value) { state.chars.splice(at, 0, ...makeChars(value)); return text; },
      deleteText(start, end) { state.chars.splice(start, end - start + 1); return text; },
      setBold: (s, e, v) => set('bold', s, e, v), setItalic: (s, e, v) => set('italic', s, e, v),
      setUnderline: (s, e, v) => set('underline', s, e, v),
      setFontFamily: (s, e, v) => set('font', s, e, v), setFontSize: (s, e, v) => set('size', s, e, v),
      setForegroundColor: (s, e, v) => set('color', s, e, v), setBackgroundColor: (s, e, v) => set('background', s, e, v),
      setTextAlignment: (s, e, v) => set('script', s, e, v),
      getFontFamily: (offset) => (state.chars[offset || 0] || {}).font || 'Arial',
      getFontSize: () => 12,
      isBold: (offset) => !!(state.chars[offset] || {}).bold, isItalic: (offset) => !!(state.chars[offset] || {}).italic,
      getTextAttributeIndices: () => state.chars.map((_, i) => i),
      setLinkUrl(url) { state.link = url; return text; },
      getParent: () => api,
    };
    api = {
      _state: state, editAsText: () => text, asParagraph: () => api, getText: () => state.text,
      setText(value) { state.chars = makeChars(value); return api; },
      setLeftToRight(value) { state.ltr = value; return api; },
      setAttributes(attrs) { Object.assign(state.attrs, attrs); Object.keys(attrs).forEach((key) => {
        if (attrKey[key]) set(attrKey[key], 0, state.chars.length - 1, attrs[key]);
      }); return api; },
      setHeading: () => api, getHeading: () => 'NORMAL', getType: () => 'PARAGRAPH', getParent: () => parent,
      removeFromParent() { if (parent && parent._paragraphs) parent._paragraphs.splice(parent._paragraphs.indexOf(api), 1); },
    };
    paragraphs.push(api);
    return api;
  }
  function table(cells) {
    const rows = cells.map((row) => row.map((initial) => {
      const cell = { _paragraphs: [] };
      cell._paragraphs.push(paragraph(initial, cell));
      Object.assign(cell, {
        setText(value) { cell._paragraphs = [paragraph(value, cell)]; return cell; },
        getNumChildren: () => cell._paragraphs.length, getChild: (i) => cell._paragraphs[i],
        insertParagraph(i, value) { const p = paragraph(value, cell); cell._paragraphs.splice(i, 0, p); return p; },
      });
      return cell;
    }));
    const api = { rows, setAttributes() {}, getCell: (r, c) => rows[r][c], getNumRows: () => rows.length,
      getRow: (r) => ({ getNumCells: () => rows[r].length, getCell: (c) => rows[r][c] }),
      texts: () => rows.map((row) => row.map((cell) => cell._paragraphs.map((p) => p._state.text).join(' / '))),
    };
    tables.push(api); return api;
  }
  const body = { getNumChildren: () => children.length, getChild: (i) => children[i],
    insertParagraph(i, value) { const p = paragraph(value, body); children.splice(i, 0, p); return p; },
    insertTable(i, cells) { const t = table(cells); children.splice(i, 0, t); return t; },
  };
  const ctx = {
    console, Logger: { log() {} }, PropertiesService: { getUserProperties: () => props },
    DocumentApp: {
      Attribute: new Proxy({}, { get: (_, key) => String(key) }),
      TextAlignment: { NORMAL: 'NORMAL', SUPERSCRIPT: 'SUPERSCRIPT', SUBSCRIPT: 'SUBSCRIPT' },
      ParagraphHeading: { NORMAL: 'NORMAL' },
      getActiveDocument: () => ({ getBody: () => body, getCursor: () => null, getSelection: () => null }),
    },
    getEnglishAttributionLines: () => [], getHebrewAttributionLines_: () => [],
  };
  vm.createContext(ctx);
  for (const file of ['gematriya.gs', 'server/menu-layout.gs', 'server/preferences.gs', 'server/source-text.gs',
    'server/text-processing.gs', 'server/utils.gs', 'server/insertion-target.gs',
    'server/hebrew-font-coverage.gs', 'server/hebrew-fonts.gs', 'server/insertion.gs']) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'apps-script', file), 'utf8'), ctx, { filename: file });
  }
  ctx.findReference = (ref, selected) => {
    const value = versions[selected.en];
    return value ? ctx.applyPunctuationPreferences(JSON.parse(JSON.stringify(value)), props) : null;
  };
  const content = () => children.flatMap((child) => child.rows
    ? child.rows.flatMap((row) => row.flatMap((cell) => cell._paragraphs)) : [child]);
  return { ctx, props, tables, children, paragraphs: content, texts: () => content().map((p) => p._state.text) };
}

module.exports = { loadSourceInsertion };
