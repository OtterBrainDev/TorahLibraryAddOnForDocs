const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.resolve(__dirname, '../../apps-script/sidebar/js/preview-core.html'), 'utf8')
  .replace(/^\s*<script>/, '').replace(/<\/script>\s*$/, '');

// Execute the real nested getVersions function with its closure values made
// explicit. The RPC callback is answered by the test, including out of order;
// rendering a new list is recorded, so a wrong edition cannot pass unnoticed.
function load(en = 'Chosen translation', he = 'Chosen source') {
  const calls = [];
  const writes = [];
  const dom = {};
  const controls = {
    '.translation-version-select': { value: en },
    '.he-version-selection': { value: he },
    '.output-mode-selection': { value: 'both' },
  };
  function collection(key) {
    const state = controls[key] || (dom[key] || (dom[key] = { text: '', html: '', props: {} }));
    const item = {
      state,
      not() { return item; },
      val(value) { if (value === undefined) return state.value || ''; state.value = value; return item; },
      prop(name, value) { state.props = state.props || {}; if (value === undefined) return state.props[name]; state.props[name] = value; return item; },
      text(value) { if (value === undefined) return state.text || ''; state.text = String(value); writes.push({ kind: 'text', key, value: String(value) }); return item; },
      html(value) { state.html = String(value); writes.push({ kind: 'html', key, value: String(value) }); return item; },
      empty() { state.text = ''; state.html = ''; return item; },
      append(child) { state.text = (state.text || '') + child.state.text; return item; },
    };
    return item;
  }
  const rendered = [];
  const availability = [];
  const actions = [];
  let cleared = 0;
  const context = {
    console, $: collection,
    currentEnVersion: en, currentHeVersion: he, enSelectedVersionTitle: en, heSelectedVersionTitle: he,
    latestResolveRequestId: 0, hasResolvedReference: true, appMode: 'texts', textsPreviewStale: false,
    selectedResultSummary: { status: 'Ready to insert' },
    resolvedRef: 'Genesis 1:1', inputTitle: 'Genesis 1:1', sidebarSessionId: 's1',
    data: { ref: 'Genesis 1:1', versionTitle: 'Previously loaded', text: 'Old preview' },
    buildPreviewLoadingHTML: () => '<p>Refreshing preview…</p>',
    setInsertButtonState: (enabled) => actions.push(enabled),
    updateActionabilityUI() {},
    markTranslationAvailability: (resolved, attempted) => availability.push({ resolved, attempted }),
    renderTranslationOptions() { throw new Error('An unavailable edition must not silently move the picker'); },
    clearVersionSelectors() { cleared++; },
    google: { script: { run: {
      withSuccessHandler(ok) {
        return { withFailureHandler(fail) {
          return { findReferenceForSidebar(ref, versions, session) { calls.push({ ref, versions, session, ok, fail }); } };
        } };
      },
    } } },
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  context.updateSuggestion = (data) => rendered.push(data);
  const start = source.indexOf('  function getVersions(');
  const end = source.indexOf('\n  // Seed selection-order tracking:', start);
  assert.ok(start >= 0 && end > start, 'the actual callback under test exists');
  vm.runInContext(source.slice(start, end), context);
  return { ctx: context, calls, controls, dom, writes, rendered, availability, actions, cleared: () => cleared };
}

function payload(overrides = {}) {
  return Object.assign({
    ref: 'Genesis 1:1', indexTitle: 'Genesis',
    versionTitle: 'Chosen translation', text: 'Selected words',
    heVersionTitle: 'Chosen source', he: 'בראשית',
  }, overrides);
}

test('a source-only v3 response keeps the requested translation visible and blocks insertion', () => {
  const env = load();
  const before = env.ctx.data;
  env.ctx.getVersions();
  env.calls[0].ok(payload({ versionTitle: '', text: [] }));
  assert.equal(env.ctx.hasResolvedReference, false);
  assert.equal(env.actions.at(-1), false);
  assert.equal(env.dom['#open-on-sefaria'].props.disabled, true);
  assert.equal(env.controls['.translation-version-select'].value, 'Chosen translation');
  assert.equal(env.controls['.he-version-selection'].value, 'Chosen source');
  assert.equal(env.cleared(), 0);
  assert.equal(env.rendered.length, 0, 'no new list can choose an unrelated edition');
  assert.equal(env.ctx.data, before, 'the old payload cannot become a newly resolved insertion');
  assert.equal(env.ctx.selectedResultSummary.status, 'Choose another edition');
  assert.match(env.dom['.suggestions'].text, /Chosen translation.*no text.*Choose another edition/);
  assert.deepEqual(env.availability, [{ resolved: '', attempted: 'Chosen translation' }]);
});

test('a mismatched edition or an edition with only empty markup cannot enable Insert', () => {
  for (const overrides of [
    { versionTitle: 'Different translation', text: 'Wrong words' },
    { text: ['', ['<i></i>', '&nbsp;']] },
    { heVersionTitle: 'Different source' },
    { he: [null, ''] },
    { versionTitle: '', text: [], heVersionTitle: '', he: [] },
  ]) {
    const env = load();
    env.ctx.getVersions();
    env.calls[0].ok(payload(overrides));
    assert.equal(env.ctx.hasResolvedReference, false);
    assert.equal(env.actions.at(-1), false);
    assert.equal(env.rendered.length, 0);
    assert.equal(env.cleared(), 0, 'even when both editions are missing, keep the pickers');
    assert.match(env.dom['.suggestions'].text, /no text for this passage/);
  }
});

test('the unavailable-edition message treats an edition title as plain text', () => {
  const title = '<img src=x onerror=alert(1)>';
  const env = load(title);
  env.ctx.getVersions();
  env.calls[0].ok(payload({ versionTitle: '', text: [] }));
  assert.ok(env.dom['.suggestions'].text.includes(title));
  assert.equal(env.dom['.suggestions'].html, '');
  assert.ok(env.writes.some((w) => w.kind === 'text' && w.value.includes(title)));
  assert.ok(env.writes.filter((w) => w.kind === 'html').every((w) => !w.value.includes(title)));
});

test('choosing another available edition after a missing one restores the preview and insertion', () => {
  const env = load();
  env.ctx.getVersions();
  env.calls[0].ok(payload({ versionTitle: '', text: [] }));
  env.ctx.currentEnVersion = 'Available alternative';
  env.controls['.translation-version-select'].value = 'Available alternative';
  env.ctx.getVersions('Available alternative');
  const next = payload({ versionTitle: 'Available alternative', text: 'Alternative words' });
  env.calls[1].ok(next);
  assert.equal(env.ctx.hasResolvedReference, true);
  assert.equal(env.actions.at(-1), true);
  assert.equal(env.dom['#open-on-sefaria'].props.disabled, false);
  assert.equal(env.rendered.at(-1), next);
  assert.equal(env.ctx.data, next);
});

test('a stale unavailable-edition answer cannot replace a later successful preview', () => {
  const env = load();
  env.ctx.getVersions();
  env.ctx.getVersions();
  const latest = payload();
  env.calls[1].ok(latest);
  env.calls[0].ok(payload({ versionTitle: '', text: [] }));
  assert.equal(env.ctx.hasResolvedReference, true);
  assert.equal(env.actions.at(-1), true);
  assert.equal(env.ctx.data, latest);
  assert.equal(env.availability.length, 1, 'only the current answer updates availability');
});

test('exact edition titles retain significant trailing spaces in requests and success checks', () => {
  const title = 'The Philosophical Tanakh ';
  const env = load(title);
  env.ctx.getVersions();
  assert.equal(env.calls[0].versions.en, title);
  env.calls[0].ok(payload({ versionTitle: title }));
  assert.equal(env.ctx.hasResolvedReference, true);
  assert.equal(env.actions.at(-1), true);
  assert.deepEqual(env.availability, [{ resolved: title, attempted: title }]);
});

test('single-language edition replies ignore the unused missing role but still require the chosen output', () => {
  for (const mode of ['en', 'he']) {
    const env = load();
    env.controls['.output-mode-selection'].value = mode;
    env.ctx.getVersions();
    const usable = payload(mode === 'en' ? { heVersionTitle: '', he: [] } : { versionTitle: '', text: [] });
    env.calls[0].ok(usable);
    assert.equal(env.ctx.hasResolvedReference, true);
    assert.equal(env.actions.at(-1), true);
    assert.equal(env.ctx.data, usable);

    env.ctx.getVersions();
    env.calls[1].ok(payload(mode === 'en' ? { versionTitle: '', text: [] } : { heVersionTitle: '', he: [] }));
    assert.equal(env.ctx.hasResolvedReference, false);
    assert.equal(env.actions.at(-1), false);
    assert.equal(env.ctx.data, usable, 'a failed chosen role never replaces the last successful payload');
  }
});

test('an edition callback cannot enable an older response when rebuilding starts another fetch', () => {
  const env = load();
  const before = env.ctx.data;
  env.ctx.updateSuggestion = () => {
    env.ctx.latestResolveRequestId++;
    env.ctx.hasResolvedReference = false;
  };
  env.ctx.getVersions();
  env.calls[0].ok(payload());
  assert.equal(env.ctx.hasResolvedReference, false);
  assert.equal(env.actions.at(-1), false);
  assert.equal(env.ctx.data, before);
  assert.equal(env.dom['#open-on-sefaria'].props.disabled, true);
});
