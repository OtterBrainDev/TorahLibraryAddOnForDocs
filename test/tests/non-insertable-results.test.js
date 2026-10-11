const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '../..');

function readScriptBody(relativePath) {
  const html = fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
  return html.replace(/^\s*<script>/, '').replace(/<\/script>\s*$/, '');
}

// A jQuery stand-in: every call returns the same chainable object, and the
// calls that matter here (hint text, focus) are recorded.
function fakeJQuery(calls) {
  const chain = new Proxy(function () {}, {
    get(_target, prop) {
      if (prop === 'get') return () => null;
      if (prop === 'val') return () => 'Mishneh Torah';
      if (prop === 'length') return 0;
      return (...args) => { calls.push([prop].concat(args)); return chain; };
    },
    apply() { return chain; },
  });
  return function $() { return chain; };
}

// The sidebar's results pipeline plus the search controller, with the DOM and
// google.script.run stubbed. Timers are captured so a test can fire them.
function loadSidebar() {
  const calls = [];
  const timers = [];
  const context = {
    console,
    appMode: 'texts',
    effectivePreferences: {},
    selectedResultKey: null,
    selectedResultSummary: null,
    selectedRefValue: null,
    latestResolveRequestId: 0,
    queryState: { rawLibraryMatches: [], rawSearchResults: [], libraryMatches: [], searchResults: [] },
    resultPostProcessState: null,
    getSearchParameters() { return { sortMode: 'relevance', translationOnly: false, translationLanguages: [] }; },
    setResultsLoading() {},
    normalizeOptionText(value) { return String(value || ''); },
    setTimeout(fn, ms) { timers.push({ fn, ms }); return timers.length; },
    document: {},
  };
  context.$ = fakeJQuery(calls);
  context.window = context;
  vm.createContext(context);
  [
    'apps-script/shared/ui/core-shared.html',
    'apps-script/shared/ui/state.html',
    'apps-script/sidebar/js/results-render.html',
    'apps-script/sidebar/js/search-controller.html',
  ].forEach((file) => vm.runInContext(readScriptBody(file), context, { filename: file }));
  const hints = [];
  context.renderResultFilterStrip = () => {};
  context.renderResults = () => {};
  context.resetSelectedResultView = () => {
    context.selectedResultKey = null;
    context.selectedResultSummary = null;
    context.selectedRefValue = null;
  };
  context.setResultsHint = (message) => hints.push(message);
  context.resetResultPostProcessState();
  return { ctx: context, calls, timers, hints };
}

function item(ref, extra) {
  return Object.assign({ key: 'k-' + ref, ref, label: ref, clusterLabel: 'Library' }, extra || {});
}

test('a ref marked non-insertable is dropped from every result group, whatever its case or spacing', () => {
  const { ctx } = loadSidebar();
  ctx.queryState.rawLibraryMatches = [
    item('Mishneh Torah', { subtitle: 'Direct reference lookup' }),
    item('mishneh  torah', { key: 'title', subtitle: 'Title match' }),
    item('Mishneh Torah, Sabbath 1:1'),
  ];
  ctx.queryState.rawSearchResults = [item('Mishneh Torah', { key: 'hit', clusterLabel: 'Halakhah' })];

  ctx.markResultRefNonInsertable('Mishneh Torah');
  ctx.applyResultPostProcessing();

  assert.deepEqual(Array.from(ctx.getAllProcessedResults(), (r) => r.ref), ['Mishneh Torah, Sabbath 1:1']);
});

test('a new search forgets which refs were non-insertable', () => {
  const { ctx } = loadSidebar();
  ctx.markResultRefNonInsertable('Mishneh Torah');
  assert.equal(ctx.isNonInsertableResultRef('Mishneh Torah'), true);
  ctx.resetResultPostProcessState();
  assert.equal(ctx.isNonInsertableResultRef('Mishneh Torah'), false);
});

test('selecting a section heading returns to the results after a short notice, with nothing selected', () => {
  const { ctx, calls, timers, hints } = loadSidebar();
  ctx.queryState.rawLibraryMatches = [item('Mishneh Torah'), item('Mishneh Torah, Sabbath 1:1')];
  ctx.applyResultPostProcessing();
  ctx.selectedResultKey = 'k-Mishneh Torah';
  ctx.selectedRefValue = 'Mishneh Torah';
  ctx.latestResolveRequestId = 7;

  ctx.scheduleReturnToResults(7, 'Mishneh Torah', 'Mishneh Torah', 'Enter Chapter.');
  assert.equal(timers.length, 1);
  assert.ok(timers[0].ms >= 1000 && timers[0].ms <= 5000, 'a short, readable delay');
  assert.equal(ctx.selectedRefValue, 'Mishneh Torah', 'nothing happens until the timer fires');

  timers[0].fn();

  assert.equal(ctx.selectedResultKey, null);
  assert.equal(ctx.selectedRefValue, null);
  assert.deepEqual(Array.from(ctx.getAllProcessedResults(), (r) => r.ref), ['Mishneh Torah, Sabbath 1:1']);
  assert.match(hints[hints.length - 1], /Mishneh Torah.*whole book or section.*Enter Chapter\./);
  assert.ok(calls.some((c) => c[0] === 'trigger' && c[1] === 'focus'), 'the search box gets the cursor back');
});

test('the return is skipped when the reader has already moved on', () => {
  const { ctx, timers, hints } = loadSidebar();
  ctx.queryState.rawLibraryMatches = [item('Mishneh Torah'), item('Genesis 1:1')];
  ctx.applyResultPostProcessing();

  // Picked another result before the timer fired.
  ctx.selectedRefValue = 'Mishneh Torah';
  ctx.latestResolveRequestId = 1;
  ctx.scheduleReturnToResults(1, 'Mishneh Torah', 'Mishneh Torah', '');
  ctx.latestResolveRequestId = 2;
  ctx.selectedRefValue = 'Genesis 1:1';
  timers[0].fn();

  // Started a new search (which clears the selection).
  ctx.latestResolveRequestId = 3;
  ctx.selectedRefValue = 'Mishneh Torah';
  ctx.scheduleReturnToResults(3, 'Mishneh Torah', 'Mishneh Torah', '');
  ctx.selectedRefValue = null;
  timers[1].fn();

  assert.equal(hints.length, 0);
  assert.equal(ctx.isNonInsertableResultRef('Mishneh Torah'), false);
});

test('the direct lookup lists only refs that can be inserted, and the dead-end notice says it is returning', () => {
  const controller = readScriptBody('apps-script/sidebar/js/search-controller.html');
  assert.match(controller, /directRefState\.isStructural[\s\S]{0,1000}markResultRefNonInsertable\(directLookupInput\)/);
  assert.match(controller, /else if \(directRefState\.isInsertable\)/);
  assert.match(controller, /buildNonInsertableMessage\(response, true\)\);\s*scheduleReturnToResults\(/);
  const utils = readScriptBody('apps-script/sidebar/js/search-utils.html');
  assert.match(utils, /Returning to your results/);
});
