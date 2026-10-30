// Pins that the sidebar preview shows the translation as the insert will write
// it under Bold & italics: Keep, Drop and Bold only (BUG-001).
//
// Observed: with "Bold only", Berakhot 2a:1 (William Davidson) previewed the
// full English, explanatory commentary included, and the insert then kept only
// the bold. The insert filters after the text is in the document
// (insertRichTextFromHTML, then applyTypographyToParagraph in
// server/insertion.gs); the preview never applied the mode at all. For Drop and
// Bold only the preview now reads and filters the markup with mirrors of those
// server functions (sidebar/js/preview-core.html). This runs the real server
// pipeline and the preview on the same markup and requires the same words and
// the same bold — including bold italics, italics alone, footnotes, line
// numbers on and off, and a translation with no bold.
//
// Loaded with vm.runInContext; see AGENTS.md hard rule #3.

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

const ROOT = path.resolve(__dirname, '..', '..');
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const scriptBody = (relative) => read(relative).replace(/^\s*<script>/, '').replace(/<\/script>\s*$/, '');

// ---- the insert ---------------------------------------------------------

function loadServer(props = {}) {
  const context = {
    console,
    Logger: { log() {} },
    PropertiesService: {
      getUserProperties: () => ({ getProperty: (k) => (Object.prototype.hasOwnProperty.call(props, k) ? props[k] : null) }),
    },
  };
  vm.createContext(context);
  ['apps-script/server/utils.gs', 'apps-script/server/menu-layout.gs', 'apps-script/server/preferences.gs',
    'apps-script/server/hebrew-font-coverage.gs', 'apps-script/server/hebrew-fonts.gs',
    'apps-script/server/insertion.gs', 'apps-script/gematriya.gs', 'apps-script/server/text-processing.gs',
  ].forEach((file) => vm.runInContext(read(file), context, { filename: file }));
  return context;
}

// A Docs Text element over per-character bold / italic: what
// insertRichTextFromHTML writes into and applyTypographyToParagraph edits.
function fakeText() {
  const chars = [];
  const setRange = (key) => (s, e, v) => { for (let k = s; k <= e; k++) chars[k][key] = v; };
  const noop = () => {};
  const t = {
    editAsText: () => t,
    getText: () => chars.map((c) => c.ch).join(''),
    insertText: (s, str) => {
      const prev = chars[s - 1] || { bold: false, italic: false };
      chars.splice(s, 0, ...[...str].map((ch) => ({ ch, bold: prev.bold, italic: prev.italic })));
      return t;
    },
    deleteText: (s, e) => { chars.splice(s, e - s + 1); return t; },
    setBold: setRange('bold'),
    setItalic: setRange('italic'),
    getTextAttributeIndices: () => {
      const idx = [];
      chars.forEach((c, k) => {
        const p = chars[k - 1];
        if (k === 0 || p.bold !== c.bold || p.italic !== c.italic) idx.push(k);
      });
      return idx;
    },
    isBold: (k) => chars[k].bold,
    isItalic: (k) => chars[k].italic,
    setUnderline: noop, setFontFamily: noop, setFontSize: noop, setForegroundColor: noop, setBackgroundColor: noop,
  };
  return { t, chars };
}

// The translation paragraph exactly as the insert leaves it.
function inserted(server, text, mode, lineMarkers) {
  const data = server.formatDataForPesukim({ text, he: '', sections: [1, 1] }, lineMarkers);
  const { t, chars } = fakeText();
  server.insertRichTextFromHTML(t, data.text);
  server.applyTypographyToParagraph({ editAsText: () => t }, '', null, 'normal', {
    preserveSourceEmphasis: true, sourceEmphasisMode: mode,
  });
  return describe(chars, lineMarkers);
}

// ---- the preview --------------------------------------------------------

function loadPreview({ mode = 'keep', lineMarkers = false, outputMode = 'both', layout = 'he-top', extendedGemara = false } = {}) {
  const values = {
    '.output-mode-selection': outputMode,
    '.bilingual-layout-selection': layout,
    '.source-emphasis-mode': mode,
  };
  const context = {
    console,
    effectivePreferences: { extended_gemara: extendedGemara ? 'true' : 'false' },
    $: (selector) => ({
      val: () => values[selector],
      prop: () => (selector === '.wants-pesukim' ? lineMarkers : undefined),
    }),
    buildPreviewMeta: (ref) => `<meta:${ref}>`,
  };
  context.window = context;
  vm.createContext(context);
  ['apps-script/shared/ui/core-shared.html', 'apps-script/shared/ui/state.html', 'apps-script/shared/ui/dom.html',
    'apps-script/sidebar/js/preview-core.html', 'apps-script/shared/composition-card/shared.html',
  ].forEach((file) => vm.runInContext(scriptBody(file), context, { filename: file }));
  // Marks what Keep renders (the sanitizer is pinned in sanitize-source-html).
  context.sanitizeSourceHtml = (html) => (html ? `[sanitized:${Array.isArray(html) ? html.join('|') : html}]` : '');
  return context;
}

// Escaped preview HTML (only our <b>, <i>, <br>) back to characters.
function previewChars(html) {
  const chars = [];
  let bold = false;
  let italic = false;
  for (const part of html.split(/(<\/?[bi]>|<br>)/)) {
    if (part === '<b>') bold = true;
    else if (part === '</b>') bold = false;
    else if (part === '<i>') italic = true;
    else if (part === '</i>') italic = false;
    else if (part === '<br>') chars.push({ ch: '\n', bold, italic });
    else {
      const text = part.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
      for (const ch of text) chars.push({ ch, bold, italic });
    }
  }
  return chars;
}

function previewed(text, mode, lineMarkers, extendedGemara) {
  const ctx = loadPreview({ mode, lineMarkers, extendedGemara });
  const html = ctx.previewTranslationEmphasisHtml(text, mode, lineMarkers, extendedGemara);
  return describe(previewChars(html), lineMarkers);
}

// Words, and which words are bold / italic. The preview leaves out the line
// numbers and the line ends the insert writes; compare without them.
function describe(chars, lineMarkers) {
  let text = chars.map((c) => c.ch).join('');
  if (lineMarkers) text = text.replace(/^\(\d+\) /gm, '');
  const strip = (s) => s.replace(/\n+$/, '');
  return {
    text: strip(text),
    bold: chars.filter((c) => c.bold && c.ch !== '\n').map((c) => c.ch).join('').replace(/\(\d+\) /g, ''),
    italic: chars.filter((c) => c.italic && c.ch !== '\n').map((c) => c.ch).join(''),
  };
}

// ---- cases --------------------------------------------------------------

const BERAKHOT = '<b>MISHNA:</b> From when may one recite <i>Shema</i> in the evening? ' +
  '<b>From the time when the priests enter to partake of their teruma.</b> ' +
  'Until when does the time for the recitation of <i>Shema</i> extend?';

const CASES = {
  'bold text with explanatory commentary (Berakhot 2a:1, William Davidson)': [BERAKHOT],
  'bold italics are kept, italics alone are not': ['<b>Rabbi <i>Eliezer</i> says</b> — <i>this is the view of</i> <b>until the end</b>.'],
  'a translation with no bold is kept whole, italics too': ['In the beginning <i>Elohim</i> created the heaven and the earth.'],
  'a footnote is skipped, as at insert': ['<b>He said</b> it plainly<sup>1</sup><i class="footnote">A gloss.</i> and <b>went on</b>.'],
  'entities, a line break and strong': ['<strong>One&nbsp;who</strong> says&thinsp;so,<br><b>&quot;Amen&quot;</b> &amp;c.'],
  'several verses, one without bold': [['<b>First</b> verse words', 'second verse with no bold', '<b>Third</b> and more']],
};

for (const [name, [text]] of Object.entries(CASES)) {
  for (const lineMarkers of [false, true]) {
    for (const mode of ['only', 'discard']) {
      test(`preview = insert, ${mode}, line numbers ${lineMarkers ? 'on' : 'off'}: ${name}`, () => {
        const server = loadServer();
        assert.deepEqual(previewed(text, mode, lineMarkers, false), inserted(server, text, mode, lineMarkers));
      });
    }
  }
}

test('Extended Gemara reads <strong> and <i> the insert\'s way too', () => {
  const text = '<b>Mishna</b> <strong>and gloss</strong> with <i>italic</i> and <b>bold <i>both</i></b>';
  const server = loadServer({ extended_gemara: 'true' });
  assert.deepEqual(previewed(text, 'only', false, true), inserted(server, text, 'only', false));
});

test('the preview\'s planner is the insert\'s, on the insert\'s own rule cases', () => {
  const server = loadServer();
  const ctx = loadPreview();
  const cases = [
    ['From when is the time that one may recite', [{ start: 0, end: 8 }, { start: 29, end: 41 }]],
    ['(1) First line here\n(2) no emphasis\n(3) Third', [{ start: 4, end: 8 }, { start: 40, end: 44 }]],
    ['Heading\nkept\nbold', [{ start: 13, end: 16 }], ['Heading']],
    ['  ', [{ start: 0, end: 1 }]],
    ['a, b — c', [{ start: 0, end: 0 }, { start: 7, end: 7 }]],
    ['wordsjoined', [{ start: 0, end: 4 }, { start: 8, end: 10 }]],
  ];
  for (const [text, runs, keepLines] of cases) {
    assert.deepEqual(
      JSON.parse(JSON.stringify(ctx.planPreviewEmphasisOnlyEdits(text, runs, keepLines))),
      JSON.parse(JSON.stringify(server.planEmphasisOnlyEdits_(text, runs, keepLines))),
      text,
    );
  }
});

test('the preview decodes entities as the insert does', () => {
  const server = loadServer();
  const ctx = loadPreview();
  for (const s of ['&thinsp;&amp;thinsp;&nbsp;&#160;&#x5D0;', '&amp;lt;b&amp;gt;', '&unknown; &mdash; &rlm;', '&#0;&#99999999;']) {
    assert.equal(ctx.decodePreviewEntities(s), server.decodeHTMLEntities(s), s);
  }
});

// ---- renderPreviewHTML -------------------------------------------------

test('Bold only: the preview\'s translation is the bold alone, and the Hebrew is untouched', () => {
  const ctx = loadPreview({ mode: 'only' });
  const html = ctx.renderPreviewHTML({ ref: 'Berakhot 2a:1', heRef: 'ברכות ב א:א', text: BERAKHOT, he: 'מֵאֵימָתַי' }, 'Berakhot 2a:1');
  assert.match(html, /\[sanitized:מֵאֵימָתַי\]/, 'Hebrew rendered as before');
  assert.match(html, /<b>MISHNA:<\/b> <b>From the time when the priests enter to partake of their teruma\.<\/b>/);
  assert.doesNotMatch(html, /From when may one recite/);
  assert.doesNotMatch(html, /Until when/);
});

test('Drop: every word, no bold or italics; Keep: the sanitized markup as before', () => {
  const drop = loadPreview({ mode: 'discard' }).renderPreviewHTML({ ref: 'r', heRef: 'h', text: BERAKHOT, he: 'x' }, 'r');
  assert.match(drop, /MISHNA: From when may one recite Shema in the evening\?/);
  assert.doesNotMatch(drop.split('[sanitized:x]').join(''), /<b>|<i>/);

  const keep = loadPreview({ mode: 'keep' }).renderPreviewHTML({ ref: 'r', heRef: 'h', text: BERAKHOT, he: 'x' }, 'r');
  assert.ok(keep.includes(`[sanitized:${BERAKHOT}]`));
});

test('the filtered preview is escaped text with only its own tags', () => {
  const ctx = loadPreview({ mode: 'only' });
  const html = ctx.previewTranslationEmphasisHtml('<b>a &lt;script&gt;x</b> <img src=x onerror=alert(1)> <b>"q"</b>', 'only', false, false);
  // The two spaces around the dropped <img> have no letters, so they stay, as
  // in the insert.
  assert.equal(html, '<b>a &lt;script&gt;x</b>  <b>&quot;q&quot;</b>');
});
