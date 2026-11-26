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
  const doc = parse('<section class="preview-section"><div class="suggestions"></div></section>' +
    '<section class="voices-preview-section"><div class="suggestions voices-suggestions">Voices</div></section>');
  const target = doc.querySelector('.preview-section .suggestions');
  for (const [key, group] of [['notes', 'cc-notes-toggle'], ['commentary', 'cc-emphasis-toggle']]) {
    const tip = doc.createElement('span');
    tip.id = 'io-' + key + '-tip';
    const box = doc.createElement('div');
    box.id = group;
    box.appendChild(doc.createElement('button'));
    doc.body.append(tip, box);
  }
  const saves = [];
  const run = {
    withSuccessHandler(callback) { return {
      previewTransliterationWithOverrides(text, scheme) { requests.push({ callback, text: Array.from(text), scheme }); }
    }; }
  };
  const ctx = vm.createContext({
    document: doc,
    effectivePreferences: { extended_gemara: 'false', transliteration_position: options.position },
    google: { script: { run } },
    appMode: 'texts', hasResolvedReference: true, selectedResultSummary: null, data: payload(),
    getSidebarTransliterationScheme: () => ctx.effectivePreferences.transliteration_scheme || 'traditional',
    parseInertHtml: parse,
    initInsertionOptions: (adapter) => { state.adapter = adapter; },
    saveSidebarPreference: (change) => {
      saves.push({ ...change });
      Object.assign(ctx.effectivePreferences, change);
    },
    $: (selector) => {
      if (typeof selector !== 'string') return { text: (value) => { selector.textContent = value; } };
      const checkedKey = { '.wants-aligned-rows': 'aligned', '.wants-pesukim': 'lineMarkers',
        '.include-transliteration': 'transliteration' }[selector];
      const nodes = doc.querySelectorAll(selector);
      return {
        val: () => ({ '.output-mode-selection': state.output, '.bilingual-layout-selection': state.layout,
          '.source-emphasis-mode': state.commentary || 'only', '.source-notes-mode': state.notes })[selector],
        prop: (_, value) => value === undefined ? state[checkedKey] : (state[checkedKey] = value),
        is: () => state[checkedKey],
        length: nodes.length,
        each: (fn) => nodes.forEach((node, index) => fn.call(node, index))
      };
    }
  });
  for (const name of ['apps-script/shared/source-text.html', 'apps-script/shared/composition-card/shared.html',
    'apps-script/sidebar/js/preview-core.html', 'apps-script/sidebar/js/preview-render.html',
    'apps-script/sidebar/js/display-controls.html', 'apps-script/sidebar/js/composition-controls.html']) {
    vm.runInContext(script(name), ctx, { filename: name });
  }
  ctx.buildPreviewMeta = (ref) => '<span class="meta">' + String(ref) + '</span>';
  ctx.updateSuggestion = (data, title) => {
    const sources = [];
    target.innerHTML = ctx.renderPreviewHTML(data, title, sources);
    ctx.renderPreviewTransliteration(sources);
  };
  return { ctx, doc, state, requests, saves, target, render(data = payload()) {
    ctx.data = data;
    ctx.refreshSidebarLivePreview();
  }, displayed: () => [...target.querySelectorAll('.preview-transliteration')].map((el) => el.textContent) };
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
  assert.deepEqual(pairs, [{ he: 'א', en: 'A', heRaw: 'א' }, { he: '', en: 'B', heRaw: '' }, { he: 'ג', en: '', heRaw: 'ג' }]);
  const html = ctx.renderPreviewHTML(data, data.ref);
  const lines = [...parse(html).querySelectorAll('.preview-line')].map((el) => el.textContent);
  assert.deepEqual(lines, ['אA', 'B', 'ג']);
});

test('aligned previews preserve chapter gaps and keep the next chapter notes with their own Hebrew', () => {
  for (const layout of ['he-top', 'he-left', 'he-right']) {
    const { ctx } = preview({ layout });
    const data = { ...payload(), isSpanning: true, he: [['h31'], ['h1', 'h2']],
      text: [[], ['e1' + note('e1'), 'e2']] };
    const pairs = JSON.parse(JSON.stringify(ctx.previewAlignedSourcePairs_(data)));
    assert.equal(pairs[0].en, '');
    assert.equal(pairs[1].he, 'h1');
    assert.equal(pairs[1].en, 'e1' + note('e1'));
    assert.deepEqual(pairs[2], { he: 'h2', en: 'e2', heRaw: 'h2' });
    const doc = parse(ctx.renderPreviewHTML(data, data.ref));
    const lines = layout === 'he-top' ? [...doc.querySelectorAll('.preview-line')]
      : [...doc.querySelectorAll('tr')].slice(1);
    assert.equal(lines.length, 3);
    assert.equal(lines[0].textContent, 'h31');
    assert.ok(lines[1].textContent.includes('h1') && lines[1].textContent.includes('e1 note'));
    assert.ok(!lines[1].textContent.includes('h31') && !lines[1].textContent.includes('e2'));
    assert.ok(lines[2].textContent.includes('h2') && lines[2].textContent.includes('e2'));
  }
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
    const { render, requests } = preview({ notes, aligned: false });
    const data = { ...payload(), he: ['שלום'], heTransliterationSource: ['שָׁלוֹם<sup class=footnote-marker>א</sup><i class=footnote>הֶעָרָה</i> עוֹלָם'] };
    render(data);
    assert.equal(requests.length, 1);
    assert.deepEqual(requests[0].text, ['שָׁלוֹם עוֹלָם']);
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

test('Line by line redraws the selected passage in place on both switches', () => {
  const { state, render, target, saves } = preview({ aligned: false, transliteration: false, layout: 'he-right' });
  render();
  assert.equal(target.querySelectorAll('tr').length, 1);
  state.adapter.onToggleAlignedRows();
  assert.deepEqual(saves.at(-1), { bilingual_aligned_rows: true });
  assert.equal(target.querySelectorAll('tr').length, 3);
  state.adapter.onToggleAlignedRows();
  assert.equal(target.querySelectorAll('tr').length, 1);
});

test('transliteration toggle and position update Texts beside the correct Hebrew cell', () => {
  const env = preview({ transliteration: false, aligned: false, layout: 'he-right', position: 'below' });
  env.render();
  assert.equal(env.requests.length, 0);
  env.ctx._sidebarCompositionOnToggle('translit');
  env.requests.at(-1).callback(['Reading']);
  assert.equal(env.target.querySelector('td.preview-he .preview-transliteration').textContent, 'Reading');
  for (const [position, index] of [['left', 1], ['right', 2]]) {
    env.ctx._sidebarCompositionOnChoice('translitPosition', position);
    env.requests.at(-1).callback(['Reading']);
    const cells = env.target.querySelectorAll('td');
    assert.equal(cells.length, 3);
    assert.equal(cells[index].querySelector('.preview-transliteration').textContent, 'Reading');
    assert.ok(cells[position === 'left' ? 2 : 1].matches('.preview-he'));
  }
  env.ctx._sidebarCompositionOnSchemeSelect('simple_english');
  assert.equal(env.requests.at(-1).scheme, 'simple_english');
  env.ctx._sidebarCompositionOnToggle('translit');
  env.requests.at(-1).callback(['Late']);
  assert.deepEqual(env.displayed(), []);
});

test('aligned transliteration keeps pointed Hebrew, source gaps and verse positions', () => {
  const { render, requests, target, displayed } = preview({ layout: 'he-top', position: 'left' });
  render({ ...payload(), isSpanning: true, he: [['א', ''], ['ג']], text: [['A', 'B'], ['C']],
    heTransliterationSource: [['אָ', ''], ['גָ']] });
  assert.deepEqual(requests[0].text, ['אָ', '', 'גָ']);
  requests[0].callback(['First', '', 'Third']);
  assert.deepEqual(displayed(), ['First', '', 'Third']);
  assert.deepEqual([...target.querySelectorAll('.preview-line')].map((line) => line.textContent),
    ['אFirstA', 'B', 'גThirdC']);
});

test('each aligned table row keeps its reading in its own sibling cell', () => {
  const { render, requests, target } = preview({ layout: 'he-left', position: 'right' });
  render();
  requests[0].callback(['First reading', 'Second reading']);
  const rows = [...target.querySelectorAll('tr')].slice(1);
  assert.equal(rows.length, 2);
  for (const [index, expected] of ['First reading', 'Second reading'].entries()) {
    const cells = rows[index].querySelectorAll('td');
    assert.equal(cells.length, 3);
    assert.ok(cells[0].matches('.preview-he'));
    assert.equal(cells[1].querySelector('.preview-transliteration').textContent, expected);
    assert.match(cells[2].textContent, /verse/);
  }
});

test('translation-only previews do not request or show transliteration', () => {
  const { render, requests, displayed } = preview({ output: 'en' });
  render();
  assert.equal(requests.length, 0);
  assert.deepEqual(displayed(), []);
});

test('an older same-reference transliteration cannot overwrite a later source edition or option change', () => {
  const { render, requests, displayed } = preview({ aligned: false });
  render({ ...payload(), heTransliterationSource: ['שָׁלוֹם'] });
  render({ ...payload(), heTransliterationSource: ['עוֹלָם'] });
  requests[1].callback(['Olam']);
  requests[0].callback(['Shalom']);
  assert.deepEqual(displayed(), ['Olam']);
});

test('clearing the preview discards a pending transliteration', () => {
  const { render, requests, displayed, target } = preview();
  render();
  target.textContent = 'Select a result to preview it.';
  requests[0].callback(['Late']);
  assert.deepEqual(displayed(), []);
});


test('preview disables Commentary and Notes independently and keeps them available when several translations need inspection', () => {
  const { ctx, doc, state, render } = preview({ transliteration: false });
  const disabled = (id) => doc.querySelector('#' + id + ' button').disabled;
  render();
  assert.equal(disabled('cc-emphasis-toggle'), true, 'ordinary JPS edition has no commentary rule');
  assert.equal(disabled('cc-notes-toggle'), false, 'JPS translation contains marked notes');
  assert.match(doc.querySelector('#io-commentary-tip').textContent, /No verified inline-commentary rule/);
  state.output = 'he';
  render();
  assert.equal(disabled('cc-notes-toggle'), true, 'undisplayed translation notes do not count');
  assert.match(doc.querySelector('#io-notes-tip').textContent, /no marked footnotes/);
  state.output = 'both';
  ctx.orderedTranslationVersions = ['JPS with no notes previewed', 'Second edition not loaded'];
  render({ ...payload(), text: ['Plain source'] });
  assert.equal(disabled('cc-notes-toggle'), false);
  assert.equal(disabled('cc-emphasis-toggle'), false);
  ctx.orderedTranslationVersions = [];
  render({ ...payload(), versionTitle: 'The Rashi chumash by Rabbi Shraga Silverstein', text: ['Plain [commentary] source'] });
  assert.equal(disabled('cc-emphasis-toggle'), false);
  assert.match(doc.querySelector('#io-commentary-tip').textContent, /Silverstein/);
  assert.equal(disabled('cc-notes-toggle'), true);
});
