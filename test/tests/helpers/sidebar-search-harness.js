// The sidebar's search, results and Session Library code, loaded into a vm
// context with a small stand-in for jQuery and google.script.run, for tests of
// the shared tab workflow (sidebar/js/search-tabs) and the tabs on it.
//
// The jQuery stand-in keeps, per selector string, what was written with
// val / html / text / attr / show / hide, so a test reads back the search box,
// the results list, the hint and the tab badges. Every other call is a no-op
// that chains. google.script.run records each call; a test answers it with
// call.ok(value) or call.fail(error), in any order.
//
// Loaded with vm.runInContext; see AGENTS.md hard rule #3.

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const scriptBody = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8')
  .replace(/^\s*<script>/, '').replace(/<\/script>\s*$/, '');

const FILES = [
  'apps-script/shared/ui/core-shared.html',
  'apps-script/shared/ui/dom.html',
  'apps-script/shared/ui/state.html',
  'apps-script/sidebar/js/results-render.html',
  'apps-script/sidebar/js/session-library.html',
  'apps-script/sidebar/js/preferences-state.html',
  'apps-script/sidebar/js/search-utils.html',
  'apps-script/sidebar/js/footer-actions.html',
  'apps-script/sidebar/js/preview-core.html',
  'apps-script/sidebar/js/search-controller.html',
  'apps-script/sidebar/js/voices.html',
  'apps-script/sidebar/js/lexicon.html',
  'apps-script/sidebar/js/search-tabs.html',
  'apps-script/sidebar/js/mode-controller.html',
  'apps-script/sidebar/js/event-bindings.html',
  'apps-script/sidebar/js/layout-tray.html',
];

function fakeJQuery() {
  const dom = { val: {}, html: {}, text: {}, attr: {}, shown: {} };
  const attrs = (selector) => dom.attr[selector] || (dom.attr[selector] = {});
  function wrap(selector) {
    const self = new Proxy(function () {}, {
      get(_, prop) {
        switch (prop) {
          case 'length': return 1;
          case 'val': return (v) => (v === undefined ? (dom.val[selector] || '') : ((dom.val[selector] = String(v)), self));
          case 'html': return (v) => (v === undefined ? (dom.html[selector] || '') : ((dom.html[selector] = String(v)), self));
          case 'text': return (v) => (v === undefined ? (dom.text[selector] || '') : ((dom.text[selector] = String(v)), self));
          case 'empty': return () => { dom.html[selector] = ''; dom.text[selector] = ''; return self; };
          case 'attr': return (key, v) => (v === undefined ? attrs(selector)[key] : ((attrs(selector)[key] = String(v)), self));
          case 'removeAttr': return (key) => { delete attrs(selector)[key]; return self; };
          case 'show': return () => { dom.shown[selector] = true; return self; };
          case 'hide': return () => { dom.shown[selector] = false; return self; };
          case 'toggle': return (on) => { dom.shown[selector] = on === undefined ? !dom.shown[selector] : !!on; return self; };
          case 'get': return (index) => (index === undefined ? [] : null);
          case 'is': return () => false;
          case 'hasClass': return () => false;
          case 'data': return () => undefined;
          case 'prop': return (key, v) => (v === undefined ? false : self);
          default: return () => self;
        }
      },
      apply: () => self,
    });
    return self;
  }
  const $ = (selector) => wrap(typeof selector === 'string' ? selector : '(element)');
  $.trim = (value) => String(value == null ? '' : value).trim();
  return { $, dom };
}

function fakeScriptRun(calls) {
  return new Proxy({}, {
    get(_, first) {
      const handlers = {};
      const builder = new Proxy({}, {
        get(__, name) {
          if (name === 'withSuccessHandler') return (fn) => { handlers.ok = fn; return builder; };
          if (name === 'withFailureHandler') return (fn) => { handlers.fail = fn; return builder; };
          if (name === 'withUserObject') return () => builder;
          return (...args) => calls.push({
            name, args,
            ok: (value) => handlers.ok && handlers.ok(value),
            fail: (error) => handlers.fail && handlers.fail(error || new Error('failed')),
          });
        },
      });
      return builder[first];
    },
  });
}

function fakeStorage(initial) {
  const store = Object.assign({}, initial);
  return {
    store,
    getItem: (key) => (Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null),
    setItem: (key, value) => { store[key] = String(value); },
    removeItem: (key) => { delete store[key]; },
  };
}

// options: { mode, preferences, storage, stubs }
function loadSidebarSearch(options) {
  options = options || {};
  const calls = [];
  const { $, dom } = fakeJQuery();
  const localStorage = fakeStorage(options.storage);
  const context = {
    console, $, localStorage,
    google: { script: { run: fakeScriptRun(calls), host: { close() {}, editor: { focus() {} } } } },
    document: { documentElement: { addEventListener() {} }, querySelector: () => null },
    navigator: {},
    setTimeout() { return 0; },
    clearTimeout() {},
    requestAnimationFrame() {},
    INITIAL_SIDEBAR_MODE: options.mode || 'texts',
  };
  context.window = context;
  context.addEventListener = () => {};
  vm.createContext(context);
  FILES.forEach((file) => vm.runInContext(scriptBody(file), context, { filename: file }));
  vm.runInContext('effectivePreferences = ' + JSON.stringify(options.preferences || {}) + ';', context);
  // The parts of the page this harness doesn't load: the Insertion Options
  // card, the Layout tray, the preview's rendering of a fetched text.
  Object.assign(context, {
    syncDisplayModeCards() {}, updateSourceCardSefariaState() {},
    sanitizeSourceHtml: (value) => String(value || ''),
  }, options.stubs || {});
  vm.runInContext('loadSessionLibrary();', context);

  const get = (expression) => vm.runInContext(expression, context);
  return {
    ctx: context, calls, dom, localStorage, get,
    type(value) { dom.val['.input'] = value; },
    box: () => dom.val['.input'] || '',
    pending: (name) => calls.filter((call) => call.name === name),
    last: (name) => calls.filter((call) => call.name === name).slice(-1)[0],
    mode: () => get('appMode'),
    hint: () => (dom.shown['.results-hint'] === false ? '' : (dom.text['.results-hint'] || dom.html['.results-hint'] || '')),
    badge: (mode) => (dom.attr['#' + mode + '-tab-badge'] || {}).hidden !== undefined ? '' : (dom.text['#' + mode + '-tab-badge'] || ''),
    // Plain arrays: the context's own fail deepStrictEqual against these.
    raw: () => Array.from(get('getAllRawResults()'), (item) => item.ref),
    shown: () => Array.from(get('getAllProcessedResults()'), (item) => item.ref),
  };
}

module.exports = { loadSidebarSearch, ROOT, scriptBody };
