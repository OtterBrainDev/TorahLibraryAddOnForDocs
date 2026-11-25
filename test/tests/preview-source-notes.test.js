const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');
const { DOMParser } = require('linkedom');

const ROOT = path.resolve(__dirname, '..', '..');
const read = (name) => fs.readFileSync(path.join(ROOT, name), 'utf8');
const script = (name) => read(name).replace(/^\s*<script>/, '').replace(/<\/script>\s*$/, '');
const note = (text) => '<sup class="footnote-marker">a</sup><i class="footnote"><b>' + text + '</b> note</i>';
const payload = () => ({ ref: 'Genesis 1:1-2', heRef: 'בראשית א:א-ב', indexTitle: 'Genesis', categories: ['Tanakh', 'Torah'],
  versionTitle: 'THE JPS TANAKH: Gender-Sensitive Edition', actualLanguage: 'en',
  he: ['ראשון', 'שני'], text: ['First' + note('First') + ' verse.', 'Second' + note('Second') + ' verse.'] });
const parse = (html) => new DOMParser().parseFromString('<html><body>' + html + '</body></html>', 'text/html');

function preview(options = {}) {
  const state = { layout: 'he-top', output: 'both', aligned: true, lineMarkers: false, notes: 'separate', transliteration: true, ...options };
  const requests = [];
  let displayed = '';
  const run = {
    withSuccessHandler(callback) { this.callback = callback; return this; },
    previewTransliterationWithOverrides(text, scheme) { requests.push({ callback: this.callback, text, scheme }); return this; }
  };
  const ctx = vm.createContext({
    effectivePreferences: { extended_gemara: 'false' },
    google: { script: { run } },
    appMode: 'texts', data: { ref: 'Genesis 1:1-2' },
    getSidebarTransliterationScheme: () => 'traditional',
    parseInertHtml: parse,
    $: (selector) => ({
      val: () => ({ '.output-mode-selection': state.output, '.bilingual-layout-selection': state.layout,
        '.source-emphasis-mode': state.commentary || 'only', '.source-notes-mode': state.notes })[selector],
      prop: () => selector === '.wants-aligned-rows' ? state.aligned : selector === '.wants-pesukim' ? state.lineMarkers : undefined,
      is: () => state.transliteration,
      remove: () => { displayed = ''; },
      length: 1,
      text: (value) => { displayed = value; }
    })
  });
  for (const name of ['apps-script/shared/source-text.html', 'apps-script/shared/composition-card/shared.html',
    'apps-script/sidebar/js/preview-core.html', 'apps-script/sidebar/js/preview-render.html']) vm.runInContext(script(name), ctx, { filename: name });
  ctx.buildPreviewMeta = (ref) => '<span class="meta">' + String(ref) + '</span>';
  return { ctx, state, requests, displayed: () => displayed };
}

for (const layout of ['he-top', 'he-left', 'he-right']) {
  for (const lineMarkers of [false, true]) {
    test(`Separate notes match per-verse insertion grouping: ${layout}, line numbers ${lineMarkers}`, () => {
      const { ctx } = preview({ layout, lineMarkers });
      const html = ctx.renderPreviewHTML(payload(), 'Genesis 1:1-2');
      const doc = parse(html);
      assert.equal(doc.querySelectorAll('b').length, 4, 'one Notes heading and one bold lemma in each verse');
      assert.equal((html.match(/\[a\]/g) || []).length, 4);
      assert.doesNotMatch(html, /\[a-2\]/, 'labels restart in the same independent blocks as insertion');
      const blocks = layout === 'he-top'
        ? [...doc.querySelectorAll('.preview-line')].map((el) => el.textContent)
        : [...doc.querySelectorAll('tr')].slice(1).map((el) => el.textContent);
      assert.equal(blocks.length, 2);
      assert.ok(blocks[0].includes('First[a] verse.') && blocks[0].includes('[a] First note'));
      assert.ok(!blocks[0].includes('Second'));
      assert.ok(blocks[1].includes('Second[a] verse.') && blocks[1].includes('[a] Second note'));
      if (layout === 'he-right') assert.ok(blocks[0].indexOf('First') < blocks[0].indexOf('ראשון'));
      else assert.ok(blocks[0].indexOf('ראשון') < blocks[0].indexOf('First'));
    });
  }
}

test('whole-passage layouts keep their single Notes block and disambiguated labels', () => {
  for (const options of [{ aligned: false }, { output: 'en' }]) {
    const { ctx } = preview(options);
    const html = ctx.renderPreviewHTML(payload(), 'Genesis 1:1-2');
    assert.match(html, /\[a-2\]/);
    assert.equal((html.match(/<b>Notes<\/b>/g) || []).length, 1);
    assert.doesNotMatch(html, /preview-aligned/);
  }
});

test('a string payload falls back to a whole-passage preview exactly as insertion does', () => {
  const data = payload();
  data.he = data.he.join(' ');
  data.text = data.text.join(' ');
  const { ctx } = preview();
  const html = ctx.renderPreviewHTML(data, data.ref);
  assert.match(html, /\[a-2\]/);
  assert.doesNotMatch(html, /preview-aligned/);
});

test('nested chapter arrays retain empty source and translation positions in aligned preview', () => {
  const { ctx } = preview();
  const data = { ...payload(), isSpanning: true, he: [['א', ''], ['ג']], text: [['A', 'B'], ['']] };
  const pairs = JSON.parse(JSON.stringify(ctx.previewAlignedSourcePairs_(data)));
  assert.deepEqual(pairs, [{ he: 'א', en: 'A' }, { he: '', en: 'B' }, { he: 'ג', en: '' }]);
  const html = ctx.renderPreviewHTML(data, data.ref);
  const lines = [...parse(html).querySelectorAll('.preview-line')].map((el) => el.textContent);
  assert.deepEqual(lines, ['אA', 'B', 'ג']);
});

test('aligned inline and omitted notes stay in their own verse without changing main text', () => {
  for (const notes of ['inline', 'omit']) {
    const { ctx } = preview({ notes });
    const html = ctx.renderPreviewHTML(payload(), 'Genesis 1:1-2');
    const lines = [...parse(html).querySelectorAll('.preview-line')].map((el) => el.textContent);
    assert.ok(lines[0].includes(notes === 'inline' ? 'First (First note) verse.' : 'First verse.'));
    assert.ok(lines[1].includes(notes === 'inline' ? 'Second (Second note) verse.' : 'Second verse.'));
    assert.doesNotMatch(html, /<b>Notes<\/b>/);
  }
});

test('the transliteration preview sends only the pointed main Hebrew, regardless of Notes mode', () => {
  for (const notes of ['omit', 'inline', 'separate']) {
    const { ctx, requests } = preview({ notes });
    const data = { ...payload(), he: ['שלום'], heTransliterationSource: ['שָׁלוֹם<sup class=footnote-marker>א</sup><i class=footnote>הֶעָרָה</i> עוֹלָם'] };
    ctx.renderPreviewTransliteration(data);
    assert.equal(requests.length, 1);
    assert.equal(requests[0].text, 'שָׁלוֹם עוֹלָם');
  }
});

test('whole and per-line insertion transliteration exclude note markers and bodies before the engine', () => {
  const calls = [];
  const ctx = vm.createContext({ transliterateHebrewHtmlPreservingBasicBreaks: (html) => { calls.push(html); return html; } });
  for (const name of ['apps-script/server/source-text.gs', 'apps-script/server/insertion.gs', 'apps-script/server/text-processing.gs']) vm.runInContext(read(name), ctx, { filename: name });
  const html = 'שָׁלוֹם<sup class=footnote-marker>א</sup><i class=footnote><b>הֶעָרָה</b></i> עוֹלָם';
  const reader = ctx.transliteratorFor_('traditional', { source_notes_mode: 'inline' }, { type: 'Tanakh' });
  assert.equal(reader.read(html), 'שָׁלוֹם עוֹלָם');
  assert.equal(reader.line({ heRaw: html, number: null }), 'שָׁלוֹם עוֹלָם');
  assert.equal(reader.whole({ he: ['שלום'], text: [], heTransliterationSource: [html] }, { he: 'שלום' }, false), 'שָׁלוֹם עוֹלָם');
  assert.equal(calls.length, 3);
  assert.ok(calls.every((value) => !value.includes('הֶעָרָה')));
});

test('an older same-reference transliteration cannot overwrite a later source edition or option change', () => {
  const { ctx, requests, displayed } = preview();
  ctx.renderPreviewTransliteration({ ...payload(), heTransliterationSource: ['שָׁלוֹם'] });
  ctx.renderPreviewTransliteration({ ...payload(), heTransliterationSource: ['עוֹלָם'] });
  assert.equal(requests.length, 2);
  requests[1].callback('Olam');
  assert.equal(displayed(), 'Olam');
  requests[0].callback('Shalom');
  assert.equal(displayed(), 'Olam');
});

test('clearing the preview invalidates a pending transliteration even for the same reference', () => {
  const { ctx, requests, displayed } = preview();
  ctx.renderPreviewTransliteration(payload());
  ctx.removePreviewTransliteration();
  requests[0].callback('late');
  assert.equal(displayed(), '');
});
