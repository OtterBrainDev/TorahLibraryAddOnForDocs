const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

// The translation's Commentary choice (`source_emphasis_mode`): Sefaria sets a
// direct translation in bold and its commentary in plain text. "keep"
// (Default) inserts it as marked; "discard" (Combine) drops the bold so the
// two look the same; "only" (Drop) keeps just the bold text, e.g. the
// Talmud's own words out of the Steinsaltz translation. Bold alone decides:
// italics marks foreign and transliterated words in either, is kept on
// whatever text is kept, in every mode, and is never treated as commentary.
// `source_emphasis_mode` replaced the boolean `preserve_source_emphasis` in
// schema v14; see migrations.test.js.
//
// Loaded with vm.runInContext; see AGENTS.md hard rule #3.

const PREFS = 'apps-script/server/preferences.gs';
const MENU = 'apps-script/server/menu-layout.gs';
const INSERTION = 'apps-script/server/insertion.gs';
// Every role paragraph borrows missing Hebrew marks (always on), so the
// insert path needs the font table and its planner.
const FONTS = ['apps-script/server/hebrew-font-coverage.gs', 'apps-script/server/hebrew-fonts.gs'];
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

const ctx = load([MENU, PREFS, ...FONTS, INSERTION]);
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

// The card's three-way Vowels and Cantillation choices read and write the
// same stored pairs the server reads (normalizeHebrewDisplayFilters_).
test('Vowels and Cantillation choices round-trip through their stored pairs', () => {
  const card = loadCardScript();
  for (const mode of ['never', 'tanakh', 'always']) {
    const p = card.ccVowelsPrefs(mode);
    assert.equal(card.ccVowelsMode(p.nekudot, p.nekudot_filter), mode, `vowels ${mode}`);
  }
  for (const mode of ['never', 'tanakh', 'torah']) {
    const p = card.ccCantillationPrefs(mode);
    assert.equal(card.ccCantillationMode(p.teamim, p.teamim_filter), mode, `cantillation ${mode}`);
  }
  // What earlier versions stored.
  assert.equal(card.ccVowelsMode('true', 'always'), 'always');
  assert.equal(card.ccVowelsMode(true, undefined), 'always');
  assert.equal(card.ccVowelsMode('false', 'tanakh'), 'never');
  assert.equal(card.ccCantillationMode('true', 'available'), 'tanakh');
  assert.equal(card.ccCantillationMode(undefined, undefined), 'tanakh');
  assert.equal(card.ccCantillationMode('false', 'torah'), 'never');
});

test('getTypographySettings carries the stored mode, legacy values included', () => {
  assert.equal(load([MENU, PREFS], {}).getTypographySettings().sourceEmphasisMode, 'keep');
  assert.equal(load([MENU, PREFS], { source_emphasis_mode: 'only' }).getTypographySettings().sourceEmphasisMode, 'only');
  assert.equal(load([MENU, PREFS], { source_emphasis_mode: 'false' }).getTypographySettings().sourceEmphasisMode, 'discard');
});

test('Drop (only): the Steinsaltz Talmud keeps the Talmud\'s own words', () => {
  assert.equal(
    only('<b>From when</b> is the time that <b>one may recite <i>Shema</i> in the evening?</b> From the time the priests enter.'),
    'From when one may recite Shema in the evening?'
  );
});

// A spanning range's chapter headings are ours, like the line markers.
test('Drop (only): a spanning range\'s chapter headings stay whole', () => {
  const html = 'Daf 2a\n(1) <b>MISHNA:</b> explanation\nDaf 2b\n(1) no bold here\n(2) intro <b>until dawn.</b>\n';
  const { text, runs } = parse(html);
  assert.equal(
    applyEdits(text, ctx.planEmphasisOnlyEdits_(text, runs, ['Daf 2a', 'Daf 2b'])),
    'Daf 2a\n(1) MISHNA:\nDaf 2b\n(2) until dawn.\n'
  );
});

test('Drop (only): removed text between kept runs becomes exactly one space', () => {
  assert.equal(only('<b>one</b>two<b>three</b>'), 'one three');
  assert.equal(only('<b>one </b>two <b>three</b>'), 'one three');
  assert.equal(only('<b>one</b> two <b>three</b>'), 'one three');
});

test('Drop (only): punctuation and spacing between kept runs are kept', () => {
  assert.equal(only('<b>Rabban Gamliel says</b>, <b>until dawn.</b>'), 'Rabban Gamliel says, until dawn.');
  assert.equal(only('<b>A</b> — <b>B</b>'), 'A — B');
});

test('Drop (only): line markers stay, lines with no bold go with their break', () => {
  assert.equal(
    only('(1) <b>MISHNA:</b> explanation\n(2) An aside with no bold.\n(3) intro <b>until dawn.</b>\n'),
    '(1) MISHNA:\n(3) until dawn.\n'
  );
  // Hebrew markers too, and a last line with no bold takes the break before it.
  assert.equal(only('(א) <b>word</b>\n(ב) nothing here'), '(א) word');
  // Several lines with no bold in a row: at the end, at the start, in the middle.
  assert.equal(only('<b>kept</b>\nno\nnone'), 'kept');
  assert.equal(only('no\nnone\n<b>kept</b>'), 'kept');
  assert.equal(only('<b>a</b>\nno\nnone\n<b>b</b>'), 'a\nb');
});

test('Drop (only): blank lines are left alone', () => {
  assert.equal(only('<b>a</b>\n\n<b>b</b>'), 'a\n\nb');
});

test('Drop (only): a paragraph with no bold at all is left whole', () => {
  // The Hebrew Gemara has no bold; "only" must not wipe it out.
  const text = 'מאימתי קורין את שמע בערבין';
  assert.equal(ctx.planEmphasisOnlyEdits_(text, []).length, 0);
});

test('Drop (only): a bolded bare space does not count as bold', () => {
  assert.equal(only('<b>kept</b>\nexplanation<b> </b>more'), 'kept');
  const text = 'explanation more';
  assert.equal(ctx.planEmphasisOnlyEdits_(text, [{ start: 11, end: 11 }]).length, 0);
});

test('Drop (only): edits come back in descending order', () => {
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
    italicized: () => chars.filter((c) => c.italic).map((c) => c.ch).join(''),
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

test('Drop (only) applies to the translation: the Hebrew keeps all its words and its bold', () => {
  // Berakhot 2a: the Hebrew bolds only the Mishnah's first word. "Keep only"
  // on the Hebrew deleted everything else in it.
  const role = { font: '', size: null, style: 'normal', color: null, background: null };
  const typography = { roles: { hebrew: role, translation: role }, sourceEmphasisMode: 'only', emphasisMap: null };
  const he = fakeParagraph('<b>מֵאֵימָתַי</b> קוֹרִין אֶת שְׁמַע בְּעַרְבִין');
  ctx.applyRoleTypography_(he.paragraph, typography, 'hebrew', { preserveSourceEmphasis: true });
  assert.equal(he.text(), 'מֵאֵימָתַי קוֹרִין אֶת שְׁמַע בְּעַרְבִין');
  assert.equal(he.bolded(), 'מֵאֵימָתַי');
  const en = fakeParagraph(PASSAGE);
  ctx.applyRoleTypography_(en.paragraph, typography, 'translation', { preserveSourceEmphasis: true });
  assert.equal(en.text(), 'From when one may recite');
});

test('Combine (discard) applies to the translation only: the Hebrew keeps its own bold', () => {
  const role = { font: '', size: null, style: 'normal', color: null, background: null };
  const typography = { roles: { hebrew: role, translation: role }, sourceEmphasisMode: 'discard', emphasisMap: null };
  const he = fakeParagraph('<b>מֵאֵימָתַי</b> קוֹרִין אֶת שְׁמַע בְּעַרְבִין');
  ctx.applyRoleTypography_(he.paragraph, typography, 'hebrew', { preserveSourceEmphasis: true });
  assert.equal(he.bolded(), 'מֵאֵימָתַי');
  const en = fakeParagraph(PASSAGE);
  ctx.applyRoleTypography_(en.paragraph, typography, 'translation', { preserveSourceEmphasis: true });
  assert.equal(en.bolded(), '');
});

// Italics is not commentary. Sefaria italicizes a foreign or transliterated
// word (Shema, teruma) in the translation and in its commentary alike, so it
// never decides what goes; bold does. Whatever text stays keeps its italics,
// in every mode.
const withMode = (mode) => (html) => {
  const p = fakeParagraph(html);
  ctx.applyTypographyToParagraph(p.paragraph, '', null, 'normal', { preserveSourceEmphasis: true, sourceEmphasisMode: mode });
  return p;
};
const onlyMode = withMode('only');
const combineMode = withMode('discard');

test('Drop (only): the commentary goes by bold alone, an italic word in it along with it', () => {
  const p = onlyMode('<b>From when</b> does one recite <i>Shema</i>, <b>in the evening?</b>');
  assert.equal(p.text(), 'From when in the evening?');
  assert.equal(p.italicized(), '', 'the italic word was in the commentary, not the bold');
});

test('Drop (only): italics in the bold translation stays, still in italics', () => {
  const p = onlyMode('<b>one may recite <i>Shema</i> in the evening</b> as the priests eat <i>teruma</i>');
  assert.equal(p.text(), 'one may recite Shema in the evening');
  assert.equal(p.bolded(), 'one may recite Shema in the evening');
  assert.equal(p.italicized(), 'Shema');
});

test('Drop (only): a line with no bold goes, whatever its italics; a passage with no bold stays whole, italics too', () => {
  assert.equal(onlyMode('(1) <b>MISHNA:</b> text\n(2) An <i>aside</i>.\n').text(), '(1) MISHNA:\n');
  const p = onlyMode('No bold, but <i>Shema</i> in italics.');
  assert.equal(p.text(), 'No bold, but Shema in italics.');
  assert.equal(p.italicized(), 'Shema');
});

test('Combine (discard): the bold goes and every word stays, with its italics, in the bold or out of it', () => {
  const p = combineMode('<b>From when does one recite <i>Shema</i></b> in the evening? Until the priests eat <i>teruma</i>.');
  assert.equal(p.text(), 'From when does one recite Shema in the evening? Until the priests eat teruma.');
  assert.equal(p.bolded(), '');
  assert.equal(p.italicized(), 'Shemateruma');
});

test('Default (keep): bold and italics as Sefaria marks them', () => {
  const p = withMode('keep')('<b>From when does one recite <i>Shema</i></b> in the evening? Until the priests eat <i>teruma</i>.');
  assert.equal(p.bolded(), 'From when does one recite Shema');
  assert.equal(p.italicized(), 'Shemateruma');
});

test('a title or metadata line (not opted in) gets none of the source\'s italics back either', () => {
  const p = fakeParagraph('<b>Title</b> with <i>Shema</i>');
  ctx.applyTypographyToParagraph(p.paragraph, '', null, 'normal', { sourceEmphasisMode: 'discard' });
  assert.equal(p.bolded(), '');
  assert.equal(p.italicized(), '');
});

// The card's row is "Commentary": Default / Combine / Drop. "Drop" once named
// `discard`; it names `only` now, so each label is pinned to its value.
test('the composition card\'s Commentary row: Default keeps, Combine discards, Drop keeps only the bold', () => {
  const markup = fs.readFileSync('apps-script/shared/composition-card/markup.html', 'utf8');
  assert.match(markup, /id="cc-emphasis-label">Commentary</);
  assert.match(markup, /data-value="keep"[^>]*>Default</);
  assert.match(markup, /data-value="discard"[^>]*>Combine</);
  assert.match(markup, /data-value="only"[^>]*>Drop</);
  assert.deepEqual({ ...loadCardScript().CC_EMPHASIS_SUMMARY }, {
    keep: 'Commentary as marked', discard: 'Commentary combined', only: 'Commentary dropped',
  });
  // Preferences sets it with the card's own control, and has no second copy.
  const prefs = fs.readFileSync('apps-script/preferences.html', 'utf8');
  assert.match(prefs, /<input type="hidden" id="source_emphasis_mode" name="source_emphasis_mode"/);
  assert.doesNotMatch(prefs, /data-pref-group="source_emphasis_mode"/);
});
