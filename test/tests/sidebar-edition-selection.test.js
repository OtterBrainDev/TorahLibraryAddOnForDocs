const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { parseHTML } = require('linkedom');

const app = path.resolve(__dirname, '../../apps-script');
const body = (file) => fs.readFileSync(path.join(app, file), 'utf8')
  .replace(/^\s*<script>/, '').replace(/<\/script>\s*$/, '');

// A small jQuery adapter over real option nodes. The production partials build
// the lists, bind handlers and own request ordering; tests answer each RPC.
// linkedom does not implement a browser's multiple select, so option selection
// is represented explicitly while DOM queries and markup parsing stay real.
function page() {
  const { document } = parseHTML('<html><body>' +
    '<input class="output-mode-selection" value="both"><input class="bilingual-layout-selection" value="he-top">' +
    '<div class="translation-version-control"></div><div class="hebrew-version-control"></div>' +
    '<div class="suggestions"></div><button id="open-on-sefaria"></button></body></html>');
  const handlers = new WeakMap();
  function prepare() {
    document.querySelectorAll('option').forEach((option) => {
      if (option.__testOption) return;
      const selected = option.hasAttribute('selected');
      Object.defineProperty(option, 'selected', { value: selected, writable: true, configurable: true });
      option.__testOption = true;
    });
  }
  function wrap(nodes) {
    const list = Array.from(nodes || []);
    const api = {
      length: list.length, ...list,
      not(selector) { return wrap(list.filter((node) => !node.matches(selector))); },
      find(selector) { return wrap(list.flatMap((node) => Array.from(node.querySelectorAll(selector)))); },
      first() { return wrap(list.slice(0, 1)); },
      get(index) { return index === undefined ? list : list[index]; },
      each(fn) { list.forEach((node, i) => fn.call(node, i, node)); return api; },
      map(fn) { return { get: () => list.map((node, i) => fn.call(node, i, node)) }; },
      val(value) {
        if (value !== undefined) {
          list.forEach((node) => {
            if (node.tagName === 'SELECT') {
              const values = Array.isArray(value) ? value : [value];
              node.querySelectorAll('option').forEach((o) => { o.selected = values.includes(o.value); });
            } else node.value = value;
          });
          return api;
        }
        const node = list[0];
        if (!node) return '';
        if (node.tagName !== 'SELECT') return node.value || '';
        const options = Array.from(node.querySelectorAll('option'));
        const selected = options.filter((o) => o.selected && !o.disabled).map((o) => o.value);
        return node.hasAttribute('multiple') ? selected : selected[0] || '';
      },
      prop(key, value) {
        if (value === undefined) return list[0] && (key === 'multiple' ? list[0].hasAttribute('multiple') : list[0][key]);
        list.forEach((node) => { if (key === 'multiple') node.toggleAttribute('multiple', !!value); else node[key] = value; });
        return api;
      },
      html(value) {
        if (value === undefined) return list[0] ? list[0].innerHTML : '';
        list.forEach((node) => { node.innerHTML = value; }); prepare(); return api;
      },
      text(value) {
        if (value === undefined) return list[0] ? list[0].textContent : '';
        list.forEach((node) => { node.textContent = value; }); return api;
      },
      attr(key, value) { if (value === undefined) return list[0] && list[0].getAttribute(key); list.forEach((node) => node.setAttribute(key, value)); return api; },
      empty() { return api.html(''); },
      append(other) { list.forEach((node) => other.get().forEach((child) => node.appendChild(child))); return api; },
      after(other) { if (list[0]) other.get().forEach((node) => list[0].after(node)); return api; },
      off(events) { list.forEach((node) => { const h = handlers.get(node) || {}; delete h[events]; handlers.set(node, h); }); return api; },
      on(events, selector, fn) { const handler = typeof selector === 'function' ? selector : fn; list.forEach((node) => { const h = handlers.get(node) || {}; h[events] = handler; handlers.set(node, h); }); return api; },
      addClass() { return api; }, removeClass() { return api; }, toggleClass() { return api; }, show() { return api; }, hide() { return api; },
    };
    return api;
  }
  const $ = (selector) => {
    if (typeof selector !== 'string') return wrap([selector]);
    if (selector.startsWith('<')) { const el = document.createElement('div'); el.innerHTML = selector; return wrap(el.children); }
    return wrap(document.querySelectorAll(selector));
  };
  return { document, $, change(selector, value, pointerSelection) {
    const node = document.querySelector(selector);
    $(node).val(value);
    const h = handlers.get(node) || {};
    const key = Object.keys(h).find((event) => event === 'change' || event.startsWith('change.'));
    assert.ok(key, selector + ' has its production change handler');
    h[key].call(node, {}, pointerSelection);
  } };
}

function load() {
  const dom = page(), calls = [], insertStates = [], timers = new Map();
  let nextTimer = 1;
  const ctx = {
    console, document: dom.document, $: dom.$, appMode: 'texts', textsPreviewStale: false,
    setTimeout(fn) { const id = nextTimer++; timers.set(id, fn); return id; },
    clearTimeout(id) { timers.delete(id); },
    TRANSLATION_LANGUAGE_CATALOG: [{ code: 'en', label: 'English' }, { code: 'he', label: 'Hebrew' }],
    normalizeLanguage: (v) => ({ key: v.language, label: v.language === 'he' ? 'Hebrew' : 'English' }),
    extractYear: () => null, normalizeOptionText: (value) => String(value || ''),
    normalizeHiddenTranslationLanguages: () => [], translationLanguageCodesMatching: () => [],
    escapeHTML: (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'),
    buildPreviewLoadingHTML: (s) => '<p>' + s + '</p>',
    setInsertButtonState: (enabled) => insertStates.push(enabled),
    updateResultsVisibility() {}, updateVersionControlsVisibility() {}, updateModeDependentSections() {},
    updateBilingualLayoutVisibility() {}, updateTranslationDetailsVisibility() {},
    updateHebrewOptionsVisibility() {}, updateTransliterationVisibility() {}, syncDisplayModeCards() {},
    showSidebarToast() {},
    google: { script: { run: {
      withSuccessHandler(ok) { return { withFailureHandler(fail) { return {
        findReferenceForSidebar(ref, versions, session) { calls.push({ name: 'fetch', ref, versions, session, ok, fail }); },
        setSidebarSessionState(session, payload) { calls.push({ name: 'save', session, payload, ok, fail }); },
      }; } }; },
    } } },
  };
  vm.createContext(ctx);
  ['shared/ui/core-shared.html', 'sidebar/js/preferences-state.html', 'sidebar/js/preview-core.html', 'sidebar/js/search-controller.html']
    .forEach((file) => vm.runInContext(body(file), ctx, { filename: file }));
  Object.assign(ctx, {
    renderPreviewHTML: (data) => data.versionTitle + ' / ' + data.heVersionTitle,
    requestTranslationAvailability() {}, updateActionabilityUI() {},
    applyEffectivePreferencesToUI() { if (ctx.activeTranslationOptions) ctx.activeTranslationOptions.refresh(); },
    refreshSidebarLivePreview() { if (ctx.hasResolvedReference) ctx.updateSuggestion(ctx.data, ctx.data.ref); },
    sidebarSessionId: 'session-one', selectedRefValue: 'Genesis 1:1',
    selectedResultSummary: { label: 'Genesis 1:1' },
  });
  const schedule = body('sidebar/js/composition-controls.html').match(/var SELECTED_RESULT_REFRESH_DELAY_MS[\s\S]*?\n}\n/)[0];
  vm.runInContext(schedule, ctx);
  const bindings = body('sidebar/js/event-bindings.html');
  const outputStart = bindings.indexOf("$('.output-mode-selection').on('change', function () {");
  const outputEnd = bindings.indexOf('\n});', outputStart) + '\n});'.length;
  vm.runInContext(bindings.slice(outputStart, outputEnd), ctx);
  const fetches = () => calls.filter((c) => c.name === 'fetch');
  return { ctx, ...dom, calls, insertStates, fetches, tick() {
    const entry = timers.entries().next().value;
    assert.ok(entry, 'a refresh timer is pending');
    timers.delete(entry[0]); entry[1]();
  },
    start(data = payload()) { ctx.resolveSelectedResult(data.ref, data.ref); fetches().at(-1).ok(data); },
    answer(data) { fetches().at(-1).ok(data); },
    picks: () => Array.from(ctx.orderedTranslationVersions),
  };
}

function payload(en = 'Default', he = 'Source default', ref = 'Genesis 1:1') {
  return { ref, indexTitle: ref.startsWith('Genesis') ? 'Genesis' : 'Exodus', text: en + ' text', he: 'בראשית',
    versionTitle: en, heVersionTitle: he,
    versions: ['Default', 'Chosen ', 'Third'].map((versionTitle) => ({ language: 'en', versionTitle }))
      .concat(['Source default', 'Source chosen'].map((versionTitle) => ({ language: 'he', versionTitle }))),
  };
}

function choose(env, en = 'Chosen ', he = 'Source chosen') {
  env.change('#translation-version-selection', [en]); env.answer(payload(en, 'Source default'));
  env.change('#he-version-selection', he); env.answer(payload(en, he));
}

test('Insertion Options wait for saves and refetch the exact chosen translation and source', () => {
  const env = load(); env.start(); choose(env);
  env.ctx.saveSessionPreference({ nekudot: 'false' }); env.ctx.scheduleSelectedResultRefresh();
  env.ctx.saveSessionPreference({ teamim: 'false' }); env.ctx.scheduleSelectedResultRefresh();
  const before = env.fetches().length;
  env.tick(); assert.equal(env.fetches().length, before, 'no fetch before the queued saves finish');
  env.calls.find((c) => c.name === 'save').ok({ nekudot: 'false' });
  env.calls.filter((c) => c.name === 'save').at(-1).ok({ nekudot: 'false', teamim: 'false' });
  env.tick();
  const request = env.fetches().at(-1);
  assert.deepEqual({ ...request.versions }, { en: 'Chosen ', he: 'Source chosen' });
  assert.equal(request.session, 'session-one');
  assert.equal(env.insertStates.at(-1), false);
  request.ok(payload('Chosen ', 'Source chosen'));
  assert.deepEqual(env.picks(), ['Chosen ']);
  assert.equal(env.$('#he-version-selection').val(), 'Source chosen');
  assert.equal(env.$('.suggestions').text(), 'Chosen  / Source chosen');
  assert.equal(env.ctx.data.versionTitle, 'Chosen ');
  assert.equal(env.insertStates.at(-1), true);
});

test('a version change and same-passage rebuild keep the translation list viewport', () => {
  const env = load();
  env.start();
  const list = () => env.document.querySelector('#translation-version-selection');
  const filter = () => env.document.querySelector('#translation-version-filter');
  list().scrollTop = 120;
  env.change('#translation-version-selection', ['Third']);
  env.answer(payload('Third'));
  assert.equal(list().scrollTop, 120);

  env.change('#translation-version-selection', ['Third', 'Default'], ['Third', 'Default']);
  filter().value = 'Third';
  list().scrollTop = 65;
  env.ctx.refreshSidebarLivePreview();
  assert.equal(list().scrollTop, 65);
  assert.equal(filter().value, 'Third');
  assert.deepEqual(env.picks(), ['Third', 'Default']);
  assert.deepEqual([...list().querySelectorAll('option')].map((option) => option.value), ['Third']);

  env.start(payload('Default', 'Source default', 'Exodus 1:1'));
  assert.equal(filter().value, '');
  assert.notEqual(list().scrollTop, 65);
});

test('local rebuilds and fetch refreshes keep ordered multiple choices and the range anchor', () => {
  const env = load(); env.start(); choose(env);
  env.change('#translation-version-selection', ['Chosen ', 'Default', 'Third'], ['Chosen ', 'Third', 'Default']);
  env.ctx.translationSelectionAnchor = 'Third';
  env.ctx.refreshSidebarLivePreview();
  assert.deepEqual(env.picks(), ['Chosen ', 'Third', 'Default']);
  assert.equal(env.ctx.translationSelectionAnchor, 'Third');
  env.ctx.refreshSelectedResult();
  assert.deepEqual({ ...env.fetches().at(-1).versions }, { en: 'Chosen ', he: 'Source chosen' });
  env.answer(payload('Chosen ', 'Source chosen'));
  assert.deepEqual(env.picks(), ['Chosen ', 'Third', 'Default']);
  assert.equal(env.ctx.translationSelectionAnchor, 'Third');
  env.$('.bilingual-layout-selection').val('he-right');
  env.ctx.refreshSidebarLivePreview();
  assert.deepEqual(env.picks(), ['Chosen '], 'a one-translation layout keeps the first pick');
  assert.equal(env.$('#he-version-selection').val(), 'Source chosen');
});

test('an options refresh of a newly selected reference cannot revive the previous passage or editions', () => {
  const env = load(); env.start(); choose(env);
  env.ctx.resolveSelectedResult('Exodus 1:1', 'Exodus 1:1');
  const older = env.fetches().at(-1);
  env.ctx.refreshSelectedResult();
  const latest = env.fetches().at(-1);
  assert.equal(latest.ref, 'Exodus 1:1'); assert.equal(latest.versions, null);
  latest.ok(payload('Default', 'Source default', 'Exodus 1:1'));
  older.ok(payload('Chosen ', 'Source chosen', 'Exodus 1:1'));
  assert.equal(env.ctx.data.ref, 'Exodus 1:1');
  assert.equal(env.ctx.data.versionTitle, 'Default');
  assert.deepEqual(env.picks(), ['Default']);
  assert.equal(env.$('#he-version-selection').val(), 'Source default');
});

test('a refresh missing the exact chosen edition retains both pickers and disables insertion', () => {
  const env = load(); env.start(); choose(env);
  env.ctx.refreshSelectedResult();
  env.answer(payload('Default', 'Source chosen'));
  assert.deepEqual(env.picks(), ['Chosen ']);
  assert.equal(env.$('#translation-version-selection').val()[0], 'Chosen ');
  assert.equal(env.$('#he-version-selection').val(), 'Source chosen');
  assert.equal(env.ctx.hasResolvedReference, false);
  assert.equal(env.insertStates.at(-1), false);
  assert.match(env.$('.suggestions').text(), /no text for this passage/);
});

test('a newer edition fetch started by rebuilding the preview owns the disabled insertion state', () => {
  const env = load();
  env.ctx.pendingPreferredVersions = { en: 'Chosen ', he: 'Source chosen' };
  env.start();
  const pending = env.fetches().at(-1);
  assert.deepEqual({ ...pending.versions }, { en: 'Chosen ', he: 'Source chosen' });
  assert.equal(env.ctx.hasResolvedReference, false);
  assert.equal(env.insertStates.at(-1), false);
  assert.equal(env.ctx.data.ref, undefined, 'the outer default reply did not become insertable');
  pending.ok(payload('Chosen ', 'Source chosen'));
  assert.equal(env.ctx.data.versionTitle, 'Chosen ');
  assert.equal(env.ctx.hasResolvedReference, true);
});

test('out-of-order edition and options replies cannot overwrite a later selection', () => {
  const env = load(); env.start();
  env.change('#translation-version-selection', ['Chosen ']);
  const first = env.fetches().at(-1);
  env.ctx.refreshSelectedResult();
  const refresh = env.fetches().at(-1);
  assert.equal(refresh.versions.en, 'Chosen ', 'a pending choice outranks the last loaded edition');
  env.change('#translation-version-selection', ['Third']);
  const latest = env.fetches().at(-1);
  latest.ok(payload('Third'));
  refresh.ok(payload('Chosen ')); first.ok(payload('Chosen '));
  assert.deepEqual(env.picks(), ['Third']);
  assert.equal(env.ctx.data.versionTitle, 'Third');
  assert.equal(env.$('.suggestions').text(), 'Third / Source default');
  assert.equal(env.insertStates.at(-1), true);
});

test('an edition reply while another tab is shown leaves that tab alone and refreshes on return', () => {
  const env = load(); env.start();
  env.change('#translation-version-selection', ['Chosen ']);
  const request = env.fetches().at(-1);
  env.ctx.appMode = 'voices'; env.$('.suggestions').text('Voices preview');
  request.ok(payload('Chosen '));
  assert.equal(env.$('.suggestions').text(), 'Voices preview');
  assert.equal(env.ctx.textsPreviewStale, true);
  env.ctx.appMode = 'texts'; env.ctx.refreshSelectedResult();
  assert.equal(env.fetches().at(-1).versions.en, 'Chosen ');
  env.answer(payload('Chosen '));
  assert.equal(env.ctx.data.versionTitle, 'Chosen ');
});

test('changing fetch-time options invalidates an older edition reply before the saves finish', () => {
  const env = load(); env.start();
  env.change('#translation-version-selection', ['Chosen ']);
  const older = env.fetches().at(-1);
  env.ctx.saveSessionPreference({ nekudot: 'false' }); env.ctx.scheduleSelectedResultRefresh();
  older.ok(payload('Chosen '));
  assert.equal(env.ctx.hasResolvedReference, false);
  assert.equal(env.insertStates.at(-1), false);
  assert.match(env.$('.suggestions').text(), /Updating preview/);
  env.calls.find((c) => c.name === 'save').ok({ nekudot: 'false' }); env.tick();
  const latest = env.fetches().at(-1);
  assert.equal(latest.versions.en, 'Chosen ');
  latest.ok(payload('Chosen '));
  assert.equal(env.ctx.hasResolvedReference, true);
});

test('a transient edition or options-fetch error keeps the exact choices available to retry', () => {
  for (const fromOptions of [false, true]) {
    const env = load(); env.start(); choose(env);
    if (fromOptions) env.ctx.refreshSelectedResult();
    else env.change('#translation-version-selection', ['Chosen ']);
    env.fetches().at(-1).fail(new Error('Sefaria is temporarily unavailable.'));
    assert.equal(env.ctx.hasResolvedReference, false);
    assert.equal(env.insertStates.at(-1), false);
    assert.deepEqual(env.picks(), ['Chosen ']);
    assert.equal(env.$('#he-version-selection').val(), 'Source chosen');
    assert.equal(env.ctx.translationAvailabilityByRef['Genesis 1:1::Chosen '], true,
      'a transport error must not declare the edition empty');
    env.ctx.refreshSelectedResult();
    assert.deepEqual({ ...env.fetches().at(-1).versions }, { en: 'Chosen ', he: 'Source chosen' });
    env.answer(payload('Chosen ', 'Source chosen'));
    assert.equal(env.ctx.hasResolvedReference, true);
  }
});

test('edition picks during a pending options save wait and fetch only the final choices', () => {
  const env = load(); env.start();
  env.ctx.saveSessionPreference({ nekudot: 'false' }); env.ctx.scheduleSelectedResultRefresh();
  const before = env.fetches().length;
  env.change('#translation-version-selection', ['Chosen ']);
  env.change('#he-version-selection', 'Source chosen');
  env.change('#translation-version-selection', ['Third']);
  assert.deepEqual(env.picks(), ['Third'], 'the latest click is selected immediately');
  assert.equal(env.$('#he-version-selection').val(), 'Source chosen');
  assert.equal(env.fetches().length, before, 'no edition request can read the old saved filters');
  assert.equal(env.ctx.hasResolvedReference, false);
  assert.equal(env.insertStates.at(-1), false);
  env.tick();
  assert.equal(env.fetches().length, before, 'the timer still waits for the save');
  env.calls.find((c) => c.name === 'save').ok({ nekudot: 'false' });
  env.tick();
  const request = env.fetches().at(-1);
  assert.deepEqual({ ...request.versions }, { en: 'Third', he: 'Source chosen' });
  assert.equal(env.fetches().length, before + 1);
  assert.equal(env.ctx.hasResolvedReference, false, 'the saved filters still need a matching text response');
  request.ok(payload('Third', 'Source chosen'));
  assert.equal(env.ctx.hasResolvedReference, true);
  assert.equal(env.insertStates.at(-1), true);
});

test('a new reference picked while options are saving cannot bypass the pending refresh', () => {
  const env = load(); env.start(); choose(env);
  env.ctx.resolveSelectedResult('Exodus 1:1', 'Exodus 1:1');
  const older = env.fetches().at(-1);
  env.ctx.saveSessionPreference({ teamim: 'false' }); env.ctx.scheduleSelectedResultRefresh();
  const before = env.fetches().length;
  env.ctx.resolveSelectedResult('Exodus 1:2', 'Exodus 1:2');
  older.ok(payload('Default', 'Source default', 'Exodus 1:1'));
  assert.equal(env.fetches().length, before);
  assert.equal(env.ctx.selectedRefValue, 'Exodus 1:2');
  assert.equal(env.ctx.hasResolvedReference, false);
  assert.equal(env.insertStates.at(-1), false);
  env.calls.find((c) => c.name === 'save').ok({ teamim: 'false' }); env.tick();
  const request = env.fetches().at(-1);
  assert.equal(request.ref, 'Exodus 1:2');
  assert.equal(request.versions, null, 'a new reference does not inherit the previous editions');
  request.ok(payload('Default', 'Source default', 'Exodus 1:2'));
  assert.equal(env.ctx.data.ref, 'Exodus 1:2');
  assert.equal(env.ctx.hasResolvedReference, true);
});

test('fetch-time options changed before the first result still delay that result until saved', () => {
  const env = load(); env.ctx.selectedRefValue = null;
  env.ctx.saveSessionPreference({ translation_punctuation: 'false' }); env.ctx.scheduleSelectedResultRefresh();
  env.ctx.resolveSelectedResult('Genesis 1:1', 'Genesis 1:1');
  assert.equal(env.fetches().length, 0);
  assert.equal(env.ctx.hasResolvedReference, false);
  env.calls.find((c) => c.name === 'save').ok({ translation_punctuation: 'false' }); env.tick();
  assert.equal(env.fetches().length, 1);
  env.answer(payload());
  assert.equal(env.ctx.hasResolvedReference, true);
});

test('an unrelated font save does not delay an edition fetch', () => {
  const env = load(); env.start();
  env.ctx.saveSessionPreference({ translation_font: 'Arial' });
  const before = env.fetches().length;
  env.change('#translation-version-selection', ['Chosen ']);
  assert.equal(env.fetches().length, before + 1);
  assert.equal(env.ctx.sessionSaveQueue.inFlight, true);
  env.answer(payload('Chosen '));
  assert.equal(env.ctx.hasResolvedReference, true);
});

test('a queued options refresh that finishes in another tab is fetched when Texts returns', () => {
  const env = load(); env.start(); choose(env);
  env.ctx.saveSessionPreference({ nekudot: 'false' }); env.ctx.scheduleSelectedResultRefresh();
  env.ctx.appMode = 'voices'; env.$('.suggestions').text('Voices preview');
  const before = env.fetches().length;
  env.calls.find((c) => c.name === 'save').ok({ nekudot: 'false' }); env.tick();
  assert.equal(env.fetches().length, before);
  assert.equal(env.$('.suggestions').text(), 'Voices preview');
  assert.equal(env.ctx.textsPreviewStale, true, 'the restored unresolved Texts selection knows to fetch');
  env.ctx.appMode = 'texts'; env.ctx.refreshSelectedResult();
  assert.deepEqual({ ...env.fetches().at(-1).versions }, { en: 'Chosen ', he: 'Source chosen' });
  env.answer(payload('Chosen ', 'Source chosen'));
  assert.equal(env.ctx.hasResolvedReference, true);
});

for (const mode of ['en', 'he']) {
  test('switching to ' + mode + ' recovers from a missing unused edition and switching back to Both revalidates it', () => {
    const env = load(); env.start(); choose(env);
    const partial = payload('Chosen ', 'Source chosen');
    if (mode === 'en') { partial.heVersionTitle = ''; partial.he = []; }
    else { partial.versionTitle = ''; partial.text = []; }
    env.ctx.refreshSelectedResult();
    env.answer(partial);
    assert.equal(env.ctx.hasResolvedReference, false);
    assert.equal(env.insertStates.at(-1), false);
    const previous = env.ctx.data;
    const before = env.fetches().length;

    env.change('.output-mode-selection', mode);
    assert.equal(env.fetches().length, before + 1);
    assert.equal(env.ctx.data, previous, 'a display switch cannot make stale text insertable');
    assert.equal(env.insertStates.at(-1), false);
    env.answer(partial);
    assert.equal(env.ctx.hasResolvedReference, true);
    assert.equal(env.ctx.data, partial);
    assert.equal(env.insertStates.at(-1), true);

    env.change('.output-mode-selection', 'both');
    assert.equal(env.fetches().length, before + 2);
    assert.equal(env.ctx.hasResolvedReference, false);
    assert.equal(env.insertStates.at(-1), false);
    env.answer(partial);
    assert.equal(env.ctx.hasResolvedReference, false);
    assert.equal(env.insertStates.at(-1), false);
    assert.match(env.$('.suggestions').text(), /Choose another edition/);
  });
}

test('switching display with both selected editions already loaded reuses the valid preview', () => {
  const env = load(); env.start(); choose(env);
  const before = env.fetches().length;
  env.change('.output-mode-selection', 'en');
  env.change('.output-mode-selection', 'both');
  assert.equal(env.fetches().length, before);
  assert.equal(env.ctx.hasResolvedReference, true);
  assert.equal(env.ctx.data.versionTitle, 'Chosen ');
  assert.deepEqual(env.picks(), ['Chosen ']);
});


for (const missingMode of ['en', 'he']) {
  test('a missing default ' + missingMode + ' output blocks Insert and Display can recover to its available language or Both', () => {
    const env = load();
    env.$('.output-mode-selection').val(missingMode);
    const partial = payload(missingMode === 'en' ? '' : 'Default', missingMode === 'he' ? '' : 'Source default');
    if (missingMode === 'en') partial.text = [];
    else partial.he = [];
    partial.versions = partial.versions.filter((version) => version.language !== missingMode);
    env.start(partial);
    assert.equal(env.ctx.hasResolvedReference, false);
    assert.equal(env.insertStates.at(-1), false);
    assert.match(env.$('.suggestions').text(), /No (translation|original) text is available.*or Both in Display/);
    assert.equal(env.ctx.selectedResultSummary.status, 'Choose another Display option');

    const availableMode = missingMode === 'en' ? 'he' : 'en';
    env.change('.output-mode-selection', availableMode);
    env.answer(partial);
    assert.equal(env.ctx.hasResolvedReference, true);
    assert.equal(env.insertStates.at(-1), true);
    assert.equal(env.ctx.data, partial);
    const before = env.fetches().length;
    env.change('.output-mode-selection', 'both');
    assert.equal(env.fetches().length, before, 'Both reuses the available language; no explicit missing edition was chosen');
    assert.equal(env.ctx.hasResolvedReference, true);
    env.change('.output-mode-selection', missingMode);
    env.answer(partial);
    assert.equal(env.ctx.hasResolvedReference, false);
    assert.equal(env.insertStates.at(-1), false);
    assert.match(env.$('.suggestions').text(), /or Both in Display/);
  });
}
