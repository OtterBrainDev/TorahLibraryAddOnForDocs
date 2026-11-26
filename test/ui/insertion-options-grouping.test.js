// The sidebar moves the shared controls, so verify real nodes and behavior:
// no lost setting, no duplicate control, no change caused by collapsing, and
// no hidden language or user-hidden setting brought back by a redraw.
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { readAppScriptFile } = require('./test-utils');
let parseHTML;
try { parseHTML = require('linkedom').parseHTML; } catch (_) {}
const needsDom = { skip: !parseHTML && 'linkedom not installed' };
const body = (path) => readAppScriptFile(path).replace(/<\/?script>/g, '');

function harness(grouped = true) {
  const { document, window } = parseHTML(`<html><body><main class="unified-sidebar" data-options-hidden="">
    <button id="open-layout-settings">Insertion Options</button><div id="background" inert>Other content</div><aside class="busy-overlay" aria-live="polite">Saving</aside>
    <div id="layout-tray"><button id="layout-tray-close">Close</button><div id="layout-tray-backdrop"></div>
    ${readAppScriptFile('shared/insertion-options/markup.html')}
    <div id="composition-card-container" data-cc-features="linkedTitle,fonts,titleFonts">${readAppScriptFile('shared/composition-card/markup.html')}</div>
    </div></main></body></html>`);
  let focused;
  Object.defineProperty(document, 'activeElement', { get: () => focused });
  window.HTMLElement.prototype.focus = function () { focused = this; };
  function $(value) {
    const nodes = Array.isArray(value) ? value : typeof value === 'string' ? [...document.querySelectorAll(value)] : value ? [value] : [];
    const api = {
      length: nodes.length,
      find: (selector) => $(nodes.flatMap((node) => [...node.querySelectorAll(selector)])),
      each(fn) { nodes.forEach((node, i) => fn.call(node, i, node)); return api; },
      attr(key, val) { if (val === undefined) return nodes[0]?.getAttribute(key); nodes.forEach((node) => node.setAttribute(key, val)); return api; },
      prop(key, val) { if (val === undefined) return nodes[0]?.[key]; nodes.forEach((node) => { node[key] = val; }); return api; },
      toggleClass(key, on) { nodes.forEach((node) => node.classList.toggle(key, on)); return api; },
      addClass(key) { nodes.forEach((node) => node.classList.add(key)); return api; },
      removeClass(key) { nodes.forEach((node) => node.classList.remove(key)); return api; },
      hasClass: (key) => !!nodes[0]?.classList.contains(key),
      toggle(on) { nodes.forEach((node) => { node.style.display = on ? '' : 'none'; }); return api; },
      focus() { nodes[0]?.focus(); return api; },
      off() { return api; },
      on(events, ...args) {
        const fn = args[args.length - 1];
        events.split(/\s+/).forEach((name) => nodes.forEach((node) => node.addEventListener(name.split('.')[0], (event) => fn.call(node, event))));
        return api;
      }
    };
    nodes.forEach((node, i) => { api[i] = node; });
    return api;
  }
  const changes = [];
  const layout = { outputMode: 'both', layout: 'he-right', alignedRows: true, transliterationOn: false };
  const state = { vowelsMode: 'always', cantillationMode: 'tanakh', notesMode: 'omit', emphasisMode: 'keep',
    detailsOn: true, linesOn: true, linkOn: true, hebrewLinkOn: true, fonts: {} };
  const context = vm.createContext({ document, window, $ });
  vm.runInContext(body('shared/insertion-options/js.html'), context);
  context._ccConfig = { getState: () => state };
  context.initInsertionOptions({
    root: '#layout-tray', getState: () => layout,
    onSelectDisplay: (mode) => { layout.outputMode = mode; changes.push(['display', mode]); },
    onSelectLayout: (value) => { layout.layout = value; changes.push(['layout', value]); },
    onToggleAlignedRows: () => { layout.alignedRows = !layout.alignedRows; changes.push(['lines']); }
  });
  // The feature filtering that initCompositionCard performs before grouping.
  document.querySelectorAll('[data-cc-feature]').forEach((node) => {
    if (!['linkedTitle', 'fonts', 'titleFonts'].includes(node.getAttribute('data-cc-feature'))) node.style.display = 'none';
  });
  const controls = [...document.querySelectorAll('#layout-tray button, #layout-tray input, #layout-tray select')];
  if (grouped) context.initGroupedInsertionOptions('#layout-tray');
  context.updateInsertionOptions();
  function key(node, value, extra = {}) {
    const event = new window.Event('keydown', { bubbles: true, cancelable: true });
    Object.assign(event, { key: value }, extra);
    node.dispatchEvent(event);
    return event;
  }
  return { document, window, context, controls, state, layout, changes, key, get: (selector) => document.querySelector(selector) };
}

test('grouping preserves every shared interactive node and keeps Line by line and Transliteration outside details', needsDom, () => {
  const h = harness();
  assert.equal(h.get('#layout-tray').querySelectorAll('button:not(.sidebar-option-help-button), input, select').length, h.controls.length);
  h.controls.forEach((node) => assert.ok(h.get('#layout-tray').contains(node), node.id || node.textContent));
  const ids = [...h.document.querySelectorAll('[id]')].map((node) => node.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ['#layout-rows-toggle', '#cc-translit-pill', '#cc-translit-scheme-row', '#cc-translit-position-row']) {
    assert.equal(h.get(id).closest('details'), null, id);
  }
  assert.equal(h.get('#cc-notes-toggle').closest('details').id, 'io-text-group');
  assert.equal(h.get('#cc-vowels-toggle').closest('.io-text-role').getAttribute('aria-label'), 'Source');
  assert.equal(h.get('#cc-emphasis-toggle').closest('.io-text-role').getAttribute('aria-label'), 'Translation');
  assert.equal(h.get('#cc-notes-toggle').closest('.io-text-role'), null);
  assert.equal(h.get('#cc-lines-toggle').closest('details').id, 'io-references-group');
  assert.equal(h.get('#cc-hebrew-font-chip').closest('details').id, 'io-fonts-group');
  assert.ok(h.get('#cc-font-panel').closest('.cc-surface'));
  h.context.initGroupedInsertionOptions('#layout-tray');
  assert.equal(h.document.querySelectorAll('.io-options-group').length, 3, 'initialization is idempotent');
  assert.equal(harness(false).document.querySelectorAll('.cc-section--source, .cc-section--translation').length, 2, 'other hosts retain detailed editors');
});

test('display changes keep Notes available for either language and preserve the chosen layout and group expansion', needsDom, () => {
  const h = harness();
  h.get('#io-text-group').open = true;
  h.layout.outputMode = 'en';
  h.context.updateInsertionOptions();
  assert.equal(h.get('#layout-rows-toggle').hidden, true);
  assert.equal(h.get('.cc-translit-wrap').classList.contains('io-inapplicable'), true);
  assert.equal(h.get('#cc-he-title-toggle').classList.contains('io-inapplicable'), true);
  assert.equal(h.get('#io-text-group').hidden, false);
  h.layout.outputMode = 'he';
  h.context.updateInsertionOptions();
  assert.equal(h.get('.cc-translit-wrap').classList.contains('io-inapplicable'), false);
  assert.equal(h.get('#cc-emphasis-toggle').closest('.cc-row').classList.contains('io-inapplicable'), true);
  assert.equal(h.get('#cc-notes-toggle').closest('.cc-row').classList.contains('io-inapplicable'), false);
  h.layout.outputMode = 'both';
  h.context.updateInsertionOptions();
  assert.equal(h.get('#layout-rows-toggle').hidden, false);
  assert.equal(h.get('#layout-rows-toggle').getAttribute('aria-pressed'), 'true');
  assert.equal(h.get('#io-text-group').open, true);
  assert.deepEqual(h.changes, []);
});

test('closed groups stay available and expose consequential values without saving or fetching on toggle', needsDom, () => {
  const h = harness();
  Object.assign(h.state, { notesMode: 'separate', emphasisMode: 'only', detailsOn: false, fonts: { hebrew: { font: 'David Libre', size: '14' } } });
  h.context.updateInsertionOptions();
  assert.match(h.get('#io-text-state').textContent, /Notes below text.*Commentary dropped/);
  assert.match(h.get('#io-references-state').textContent, /Credits off/);
  assert.match(h.get('#io-fonts-state').textContent, /David Libre, 14 pt/);
  const before = JSON.stringify({ state: h.state, layout: h.layout });
  h.document.querySelectorAll('.io-options-group').forEach((group) => {
    assert.equal(group.hidden, false);
    group.open = true;
    group.dispatchEvent(new h.window.Event('toggle'));
    group.open = false;
    group.dispatchEvent(new h.window.Event('toggle'));
  });
  assert.equal(JSON.stringify({ state: h.state, layout: h.layout }), before);
  assert.deepEqual(h.changes, []);
});

test('explicitly hidden controls suppress empty groups without hiding an available primary control or changing settings', needsDom, () => {
  const h = harness();
  const hidden = 'display arrangement citation line_by_line line_numbers source_link translation_link vowels cantillation hebrew_punctuation translation_punctuation commentary title_fonts text_fonts';
  h.get('.unified-sidebar').setAttribute('data-options-hidden', hidden);
  h.context.updateInsertionOptions();
  for (const group of h.document.querySelectorAll('.io-options-group')) assert.equal(group.hidden, true, group.id);
  assert.equal(h.get('.io-primary-options').hidden, false, 'Transliteration remains available');
  h.get('.unified-sidebar').setAttribute('data-options-hidden', hidden + ' transliteration');
  h.context.updateInsertionOptions();
  assert.equal(h.get('.io-primary-options').hidden, true);
  h.get('.unified-sidebar').setAttribute('data-options-hidden', '');
  h.context.updateInsertionOptions();
  assert.equal(h.get('#io-text-group').hidden, false);
  assert.equal(h.get('#cc-he-edition-toggle').style.display, 'none', 'feature-hidden controls stay hidden');
  assert.equal(h.state.notesMode, 'omit');
  assert.deepEqual(h.changes, []);
});

test('labeled Display and Arrangement radios use one tab stop and keyboard selection through their shared handlers', needsDom, () => {
  const h = harness();
  h.document.querySelectorAll('.mode-card, .layout-option').forEach((button) => assert.ok(button.querySelector('.io-choice-label').textContent));
  const selected = h.get('.mode-card[aria-checked="true"]');
  assert.equal(h.document.querySelectorAll('.mode-card[tabindex="0"]').length, 1);
  selected.focus();
  assert.equal(h.key(selected, 'ArrowRight', { ctrlKey: true }).defaultPrevented, false);
  assert.equal(h.layout.outputMode, 'both', 'navigation chords do not change the setting');
  assert.equal(h.key(selected, 'ArrowRight').defaultPrevented, true);
  assert.equal(h.layout.outputMode, 'he');
  assert.equal(h.document.activeElement, h.get('.mode-card[data-mode="he"]'));
  h.key(h.document.activeElement, 'Home');
  assert.equal(h.layout.outputMode, 'en');
  h.get('.mode-card[data-mode="both"]').click();
  const arrangement = h.get('.layout-option[aria-checked="true"]');
  h.key(arrangement, 'ArrowLeft');
  assert.equal(h.layout.layout, 'he-top');
  assert.equal(h.document.querySelectorAll('.layout-option[tabindex="0"]').length, 1);
  assert.deepEqual(h.changes, [['display', 'he'], ['display', 'en'], ['display', 'both'], ['layout', 'he-top']]);
});

test('the tray contains keyboard focus and restores background interactivity and opener focus on close', needsDom, () => {
  const h = harness();
  vm.runInContext(body('sidebar/js/layout-tray.html'), h.context);
  const opener = h.get('#open-layout-settings');
  h.get('#background').inert = true;
  h.context.openLayoutTray();
  assert.equal(opener.inert, true);
  assert.notEqual(h.get('.busy-overlay').inert, true, 'progress announcements remain exposed');
  assert.equal(h.document.activeElement, h.get('#layout-tray-close'));
  // Layout measurements are browser-owned; model only which two controls
  // are currently focusable, then run the production keyboard handler.
  const first = h.get('#layout-tray-close');
  const last = h.get('#io-fonts-group > summary');
  h.context.getLayoutTrayFocusable = () => [first, last];
  last.focus();
  assert.equal(h.key(last, 'Tab').defaultPrevented, true);
  assert.equal(h.document.activeElement, first);
  h.key(first, 'Tab', { shiftKey: true });
  assert.equal(h.document.activeElement, last);
  h.key(last, 'Escape');
  assert.equal(opener.inert, false);
  assert.equal(h.get('#background').inert, true, 'preserve an earlier inert state');
  assert.equal(h.document.activeElement, opener);
  assert.equal(h.get('#layout-tray').classList.contains('is-open'), false);
});
