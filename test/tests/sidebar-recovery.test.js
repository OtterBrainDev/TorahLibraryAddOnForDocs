// Pins what the sidebar does when a server call it depends on fails (BUG-007).
//
// Observed: Citation and Bold & italics did not respond while Display and
// Arrangement did, the card showed defaults rather than the saved settings, and
// Refresh Sidebar fixed it; separately, Link Texts from the sidebar did nothing,
// twice. Both calls had no failure handler. The Insertion Options card is wired
// up only when getSidebarBootstrapData answers (sidebar/js/bootstrap.html), so a
// failed bootstrap left exactly those switches dead with no word of why; and a
// failed linkerHTML (sidebar/js/footer-actions.html) showed nothing at all. Why
// they failed that day is not established; this pins that a failure is retried
// once and then said, never silent.
//
// Loaded with vm.runInContext; see AGENTS.md hard rule #3.

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

const ROOT = path.resolve(__dirname, '..', '..');
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const scriptBody = (html) => html.replace(/^\s*<script>/, '').replace(/<\/script>\s*$/, '');

function scriptRun(calls) {
  return new Proxy({}, {
    get(_, first) {
      const handlers = {};
      const builder = new Proxy({}, {
        get(__, name) {
          if (name === 'withSuccessHandler') return (fn) => { handlers.ok = fn; return builder; };
          if (name === 'withFailureHandler') return (fn) => { handlers.fail = fn; return builder; };
          return (...args) => calls.push({
            name, args,
            ok: (v) => handlers.ok && handlers.ok(v),
            fail: (e) => handlers.fail && handlers.fail(e || new Error('x')),
          });
        },
      });
      return builder[first];
    },
  });
}

function bootstrapRequestSource() {
  const source = scriptBody(read('apps-script/sidebar/js/bootstrap.html'));
  return source.slice(0, source.indexOf('function initializeSidebar'));
}

function loadBootstrap() {
  const calls = [];
  const timers = [];
  const notices = [];
  const bound = [];
  const context = {
    console,
    window: { INITIAL_SIDEBAR_MODE: 'texts' },
    google: { script: { run: scriptRun(calls) } },
    setTimeout: (fn, ms) => timers.push({ fn, ms }),
    showSidebarNotice: (message, onConfirm) => notices.push({ message, onConfirm }),
    clonePlainObject: (v) => JSON.parse(JSON.stringify(v || {})),
    setSidebarMode() {}, applyEffectivePreferencesToUI() {},
    bindSidebarCompositionCard: () => bound.push(true),
    updateSidebarCompositionCard() {}, loadSessionLibrary() {}, setFooterButtonStates() {},
    adoptSidebarSession: () => false,
  };
  vm.createContext(context);
  // Only the bootstrap request: the rest of the file runs the page.
  vm.runInContext(bootstrapRequestSource(), context);
  const bootstraps = () => calls.filter((c) => c.name === 'getSidebarBootstrapData');
  return { calls, timers, notices, bound, bootstraps };
}

const BOOTSTRAP = {
  mode: 'texts', sessionId: 's', accountPreferences: {}, sessionState: {}, effectivePreferences: {}, preferences: {},
};

test('a bootstrap that answers wires up the Insertion Options card', () => {
  const env = loadBootstrap();
  env.bootstraps()[0].ok(BOOTSTRAP);
  assert.equal(env.bound.length, 1);
  assert.equal(env.notices.length, 0);
});

test('a failed bootstrap is asked for once more before anything is said', () => {
  const env = loadBootstrap();
  env.bootstraps()[0].fail();
  assert.equal(env.notices.length, 0);
  assert.equal(env.timers.length, 1);
  env.timers[0].fn();
  env.bootstraps()[1].ok(BOOTSTRAP);
  assert.equal(env.bound.length, 1);
  assert.equal(env.notices.length, 0);
});

test('a bootstrap that fails again says so, with the reason, and OK tries again', () => {
  const env = loadBootstrap();
  env.bootstraps()[0].fail();
  env.timers[0].fn();
  env.bootstraps()[1].fail(new Error('a server error occurred while reading from storage'));
  assert.equal(env.notices.length, 1);
  assert.match(env.notices[0].message, /couldn.t load your settings/);
  assert.match(env.notices[0].message, /Insertion Options won.t respond/);
  assert.match(env.notices[0].message, /reading from storage/);
  assert.equal(env.bound.length, 0);
  env.notices[0].onConfirm();
  env.bootstraps()[2].ok(BOOTSTRAP);
  assert.equal(env.bound.length, 1);
});

// ---- Link Texts from the sidebar -----------------------------------------

function loadFooterLinker() {
  const html = read('apps-script/sidebar/js/footer-actions.html');
  const source = html.slice(html.indexOf('var linkerOpening'), html.indexOf("$('#open-help-modal')"));
  const calls = [];
  const toasts = [];
  const handlers = {};
  const state = { disabled: false, busy: false };
  const $ = (selector) => {
    const api = {
      on(event, fn) { handlers[selector] = fn; return api; },
      prop(name, value) { if (name === 'disabled') state.disabled = value; return api; },
      attr(name) { if (name === 'aria-busy') state.busy = true; return api; },
      removeAttr(name) { if (name === 'aria-busy') state.busy = false; return api; },
    };
    return api;
  };
  const context = {
    console, $,
    google: { script: { run: scriptRun(calls) } },
    showSidebarToast: (message) => toasts.push(message),
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  return { calls, toasts, state, click: () => handlers['.open-linker-tool']() };
}

test('Link Texts from the sidebar shows it is opening and ignores a second click meanwhile', () => {
  const env = loadFooterLinker();
  env.click();
  env.click();
  assert.equal(env.calls.length, 1);
  assert.equal(env.calls[0].name, 'linkerHTML');
  assert.equal(env.state.disabled, true);
  assert.equal(env.state.busy, true);
  env.calls[0].ok();
  assert.equal(env.state.disabled, false);
  assert.equal(env.state.busy, false);
  assert.equal(env.toasts.length, 0);
});

test('Link Texts that fails to open says so, with the reason, and can be tried again', () => {
  const env = loadFooterLinker();
  env.click();
  env.calls[0].fail(new Error('Exception: storage refused'));
  assert.equal(env.toasts.length, 1);
  assert.match(env.toasts[0], /Link Texts could not be opened: Exception: storage refused/);
  assert.match(env.toasts[0], /Extensions menu/);
  assert.equal(env.state.disabled, false);
  env.click();
  assert.equal(env.calls.length, 2);
});

// BUG-002: the same bootstrap, with the real session queue. A layout chosen
// before it answers stays chosen on screen, and is the one sent.
test('a layout picked before the bootstrap answers survives it', () => {
  const calls = [];
  const drawn = [];
  const context = {
    console,
    window: { INITIAL_SIDEBAR_MODE: 'texts' },
    appMode: 'texts',
    google: { script: { run: scriptRun(calls) } },
    setTimeout() {},
    showSidebarNotice() {}, showSidebarToast() {},
    setSidebarMode() {}, bindSidebarCompositionCard() {}, updateSidebarCompositionCard() {},
    loadSessionLibrary() {}, setFooterButtonStates() {},
  };
  vm.createContext(context);
  vm.runInContext(scriptBody(read('apps-script/shared/ui/core-shared.html')), context);
  vm.runInContext(scriptBody(read('apps-script/sidebar/js/preferences-state.html')), context);
  context.applyEffectivePreferencesToUI = () => drawn.push(vm.runInContext('effectivePreferences.bilingual_layout_default', context));
  vm.runInContext(bootstrapRequestSource(), context);

  context.saveSidebarPreference({ bilingual_layout_default: 'he-top' }); // Stacked, at once
  calls.find((c) => c.name === 'getSidebarBootstrapData').ok({
    mode: 'texts', sessionId: 's1', sessionState: {},
    accountPreferences: { bilingual_layout_default: 'he-right' },
    effectivePreferences: { bilingual_layout_default: 'he-right' }, preferences: {},
  });

  assert.deepEqual(drawn, ['he-top'], 'the switches are drawn with the choice, not the saved default');
  const save = calls.find((c) => c.name === 'setSidebarSessionState');
  assert.ok(save, 'the early choice is sent once there is a session');
  assert.deepEqual(JSON.parse(JSON.stringify(save.args)), ['s1', { bilingual_layout_default: 'he-top' }]);
});
