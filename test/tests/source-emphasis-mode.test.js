const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

// The source's bold and italics: "keep" (default), "discard", or "only" — keep
// just the words the source emphasizes, e.g. the Talmud's own words (bold) out
// of the Steinsaltz translation. `source_emphasis_mode` replaced the boolean
// `preserve_source_emphasis` in schema v14; see migrations.test.js.
//
// Loaded with vm.runInContext; see AGENTS.md hard rule #3.

const PREFS = 'apps-script/server/preferences.gs';
const MENU = 'apps-script/server/menu-layout.gs';
const INSERTION = 'apps-script/server/insertion.gs';
const CARD = 'apps-script/shared/composition-card/shared.html';

function load(files, props = {}) {
  const context = {
    console,
    Logger: { log() {} },
    PropertiesService: {
      getUserProperties() {
        return { getProperty: (k) => (Object.prototype.hasOwnProperty.call(props, k) ? props[k] : null) };
      },
    },
  };
  vm.createContext(context);
  for (const file of files) vm.runInContext(fs.readFileSync(file, 'utf8'), context, { filename: file });
  return context;
}

function loadCardScript() {
  const html = fs.readFileSync(CARD, 'utf8');
  const script = html.replace(/^[\s\S]*?<script>/, '').replace(/<\/script>[\s\S]*$/, '');
  const context = { console, $: () => ({}) };
  vm.createContext(context);
  vm.runInContext(script, context, { filename: CARD });
  return context;
}

// Minimal "<b>…</b> / <i>…</i>" reader: plain text plus the emphasized ranges
// (end inclusive), the shape captureEmphasisRuns_ returns.
function parse(html) {
  let text = '';
  const runs = [];
  let depth = 0;
  for (const part of html.split(/(<\/?[bi]>)/)) {
    if (/^<[bi]>$/.test(part)) depth++;
    else if (/^<\/[bi]>$/.test(part)) depth--;
    else if (part) {
      if (depth) runs.push({ start: text.length, end: text.length + part.length - 1 });
      text += part;
    }
  }
  return { text, runs };
}

function applyEdits(text, edits) {
  let out = text;
  for (const e of edits) {
    const cut = e.end >= e.start ? e.end + 1 : e.start;
    out = out.slice(0, e.start) + (e.insert || '') + out.slice(cut);
  }
  return out;
}

const ctx = load([MENU, PREFS, INSERTION]);
const only = (html) => {
  const { text, runs } = parse(html);
  return applyEdits(text, ctx.planEmphasisOnlyEdits_(text, runs));
};

test('source_emphasis_mode defaults to "keep" and is a writable setting', () => {
  assert.equal(ctx.getDefaultPreferences().source_emphasis_mode, 'keep');
  const settings = vm.runInContext('SETTINGS', ctx);
  assert.ok(settings.includes('source_emphasis_mode'));
  // The boolean it replaced is gone from both, so nothing keeps it alive.
  assert.equal(ctx.getDefaultPreferences().preserve_source_emphasis, undefined);
  assert.ok(!settings.includes('preserve_source_emphasis'));
});

test('mode normalization: the three modes, the legacy booleans, and junk', () => {
  const card = loadCardScript();
  const cases = [
    ['keep', 'keep'], ['discard', 'discard'], ['only', 'only'], [' ONLY ', 'only'],
    ['true', 'keep'], ['false', 'discard'], [true, 'keep'], [false, 'discard'],
    [null, 'keep'], [undefined, 'keep'], ['', 'keep'], ['bogus', 'keep'],
  ];
  for (const [input, expected] of cases) {
    assert.equal(ctx.normalizeSourceEmphasisMode_(input), expected, `server: ${input}`);
    assert.equal(card.ccNormalizeEmphasisMode(input), expected, `client: ${input}`);
  }
});

test('the B&I pill cycles keep -> discard -> only -> keep', () => {
  const card = loadCardScript();
  assert.equal(card.ccNextEmphasisMode('keep'), 'discard');
  assert.equal(card.ccNextEmphasisMode('discard'), 'only');
  assert.equal(card.ccNextEmphasisMode('only'), 'keep');
  assert.equal(card.ccNextEmphasisMode(''), 'discard');
});

test('getTypographySettings carries the stored mode, legacy values included', () => {
  assert.equal(load([MENU, PREFS], {}).getTypographySettings().sourceEmphasisMode, 'keep');
  assert.equal(load([MENU, PREFS], { source_emphasis_mode: 'only' }).getTypographySettings().sourceEmphasisMode, 'only');
  assert.equal(load([MENU, PREFS], { source_emphasis_mode: 'false' }).getTypographySettings().sourceEmphasisMode, 'discard');
});

test('keep only: the Steinsaltz Talmud keeps the Talmud\'s own words', () => {
  assert.equal(
    only('<b>From when</b> is the time that <b>one may recite <i>Shema</i> in the evening?</b> From the time the priests enter.'),
    'From when one may recite Shema in the evening?'
  );
});

test('keep only: removed text between kept runs becomes exactly one space', () => {
  assert.equal(only('<b>one</b>two<b>three</b>'), 'one three');
  assert.equal(only('<b>one </b>two <b>three</b>'), 'one three');
  assert.equal(only('<b>one</b> two <b>three</b>'), 'one three');
});

test('keep only: punctuation and spacing between kept runs are kept', () => {
  assert.equal(only('<b>Rabban Gamliel says</b>, <b>until dawn.</b>'), 'Rabban Gamliel says, until dawn.');
  assert.equal(only('<b>A</b> — <b>B</b>'), 'A — B');
});

test('keep only: line markers stay, unemphasized lines go with their break', () => {
  assert.equal(
    only('(1) <b>MISHNA:</b> explanation\n(2) An aside with no bold.\n(3) intro <b>until dawn.</b>\n'),
    '(1) MISHNA:\n(3) until dawn.\n'
  );
  // Hebrew markers too, and a last line with no emphasis takes the break before it.
  assert.equal(only('(א) <b>word</b>\n(ב) nothing here'), '(א) word');
  // Several unemphasized lines in a row: at the end, at the start, in the middle.
  assert.equal(only('<b>kept</b>\nno\nnone'), 'kept');
  assert.equal(only('no\nnone\n<b>kept</b>'), 'kept');
  assert.equal(only('<b>a</b>\nno\nnone\n<b>b</b>'), 'a\nb');
});

test('keep only: blank lines are left alone', () => {
  assert.equal(only('<b>a</b>\n\n<b>b</b>'), 'a\n\nb');
});

test('keep only: a paragraph with no emphasis at all is left whole', () => {
  // The Hebrew Gemara has no bold; "only" must not wipe it out.
  const text = 'מאימתי קורין את שמע בערבין';
  assert.equal(ctx.planEmphasisOnlyEdits_(text, []).length, 0);
});

test('keep only: a bolded bare space is not emphasis', () => {
  assert.equal(only('<b>kept</b>\nexplanation<b> </b>more'), 'kept');
  const text = 'explanation more';
  assert.equal(ctx.planEmphasisOnlyEdits_(text, [{ start: 11, end: 11 }]).length, 0);
});

test('keep only: edits come back in descending order', () => {
  const { text, runs } = parse('x <b>a</b> y <b>b</b> z <b>c</b> w');
  const edits = ctx.planEmphasisOnlyEdits_(text, runs);
  for (let i = 1; i < edits.length; i++) assert.ok(edits[i - 1].start > edits[i].start);
});

// A Docs Text element over per-character bold/italic, enough for
// applyTypographyToParagraph: capture, baseline, delete, re-apply.
function fakeParagraph(html) {
  const chars = [];
  let b = 0;
  let i = 0;
  for (const part of html.split(/(<\/?[bi]>)/)) {
    if (part === '<b>') b++;
    else if (part === '</b>') b--;
    else if (part === '<i>') i++;
    else if (part === '</i>') i--;
    else for (const ch of part) chars.push({ ch, bold: b > 0, italic: i > 0 });
  }
  const setRange = (key) => (s, e, v) => { for (let k = s; k <= e; k++) chars[k][key] = v; };
  const noop = () => {};
  const t = {
    getText: () => chars.map((c) => c.ch).join(''),
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
    setBold: setRange('bold'),
    setItalic: setRange('italic'),
    setUnderline: noop,
    setFontFamily: noop,
    setFontSize: noop,
    setForegroundColor: noop,
    setBackgroundColor: noop,
    deleteText: (s, e) => { chars.splice(s, e - s + 1); },
    insertText: (s, str) => {
      const prev = chars[s - 1] || { bold: false, italic: false };
      chars.splice(s, 0, ...[...str].map((ch) => ({ ch, bold: prev.bold, italic: prev.italic })));
    },
  };
  return {
    paragraph: { editAsText: () => t },
    text: () => t.getText(),
    bolded: () => chars.filter((c) => c.bold).map((c) => c.ch).join(''),
  };
}

const PASSAGE = '<b>From when</b> is the time that <b>one may recite</b> in the evening';

for (const [mode, expectedText, expectedBold] of [
  ['keep', 'From when is the time that one may recite in the evening', 'From whenone may recite'],
  ['discard', 'From when is the time that one may recite in the evening', ''],
  ['only', 'From when one may recite', 'From whenone may recite'],
]) {
  test(`applyTypographyToParagraph honours sourceEmphasisMode "${mode}"`, () => {
    const p = fakeParagraph(PASSAGE);
    ctx.applyTypographyToParagraph(p.paragraph, '', null, 'normal', {
      preserveSourceEmphasis: true,
      sourceEmphasisMode: mode,
    });
    assert.equal(p.text(), expectedText);
    assert.equal(p.bolded(), expectedBold);
  });
}

test('a paragraph that did not opt in never loses text, whatever the mode', () => {
  // Titles and metadata lines do not opt in: their emphasis is ours.
  const p = fakeParagraph(PASSAGE);
  ctx.applyTypographyToParagraph(p.paragraph, '', null, 'normal', { sourceEmphasisMode: 'only' });
  assert.equal(p.text(), 'From when is the time that one may recite in the evening');
  assert.equal(p.bolded(), '');
});

test('applyRoleTypography_ passes the typography bag\'s mode through', () => {
  const p = fakeParagraph(PASSAGE);
  const typography = {
    roles: { translation: { font: '', size: null, style: 'normal', color: null, background: null } },
    sourceEmphasisMode: 'only',
    emphasisMap: null,
  };
  ctx.applyRoleTypography_(p.paragraph, typography, 'translation', { preserveSourceEmphasis: true });
  assert.equal(p.text(), 'From when one may recite');
});
