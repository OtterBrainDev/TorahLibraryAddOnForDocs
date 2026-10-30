// Pins how the Session Library dialog hands its changes back to the sidebar
// (BUG-009): server/menu.gs (sessionLibraryPopup, saveSessionLibraryAction,
// checkSessionLibraryAction), the sidebar's poll in sidebar/js/event-bindings.html,
// and Done in session-library-modal.html.
//
// Observed: a pin made in the dialog was gone after Done, and Library would
// not reopen until Refresh Sidebar. The dialog's changes reach the sidebar only
// through one stored hand-off that the sidebar polls for. A failed write was
// swallowed, so Done closed as if it had saved; a failed read looked like "not
// closed yet", so the sidebar kept waiting, and while it waited Library refused
// to reopen; and the wait gave up after ten minutes, dropping a later Done.
// Why the hand-off failed that day is not established; these are the ways it
// could fail without anyone being told.
//
// Loaded with vm.runInContext; see AGENTS.md hard rule #3.

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

const ROOT = path.resolve(__dirname, '..', '..');
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');

function between(source, start, end) {
  const from = source.indexOf(start);
  assert.ok(from >= 0, `marker not found: ${start}`);
  const to = source.indexOf(end, from);
  assert.ok(to > from, `marker not found: ${end}`);
  return source.slice(from, to);
}

// A google.script.run whose calls wait until the test answers them.
function scriptRun() {
  const calls = [];
  const run = new Proxy({}, {
    get(_, first) {
      const handlers = {};
      const builder = new Proxy({}, {
        get(__, name) {
          if (name === 'withSuccessHandler') return (fn) => { handlers.ok = fn; return builder; };
          if (name === 'withFailureHandler') return (fn) => { handlers.fail = fn; return builder; };
          return (...args) => {
            calls.push({
              name, args,
              ok: (v) => handlers.ok && handlers.ok(v),
              fail: (e) => handlers.fail && handlers.fail(e || new Error('x')),
            });
          };
        },
      });
      return builder[first];
    },
  });
  return { calls, run };
}

// ---- server -------------------------------------------------------------

function loadServer({ cacheFails = false } = {}) {
  const cache = {};
  const legacyDeleted = [];
  const context = {
    console,
    Logger: { log() {} },
    // The hand-off never reads or writes UserProperties; opening the dialog
    // only deletes the copy versions before 30 October 2026 left there.
    PropertiesService: {
      getUserProperties: () => new Proxy({}, {
        get(_, name) {
          if (name === 'deleteProperty') return (key) => legacyDeleted.push(key);
          throw new Error(`UserProperties.${String(name)} used`);
        },
      }),
    },
    CacheService: {
      getUserCache: () => ({
        get: (k) => (k in cache ? cache[k] : null),
        put: (k, v) => { if (cacheFails) throw new Error('storage refused'); cache[k] = v; },
        remove: (k) => { delete cache[k]; },
      }),
    },
    HtmlService: { createTemplateFromFile: () => ({ evaluate: () => ({ setWidth() { return this; }, setHeight() { return this; } }) }) },
    DocumentApp: { getUi: () => ({ showModalDialog() {} }) },
    toEmbeddedJson_: (v) => JSON.stringify(v),
  };
  vm.createContext(context);
  vm.runInContext(read('apps-script/server/menu.gs'), context, { filename: 'menu.gs' });
  return { context, cache, legacyDeleted };
}

function bigLibrary() {
  const entry = (i) => ({
    ref: `Sheet ${i}`,
    label: `שיעור ${i}: a long source-sheet title with several words in it, and Hebrew תורה`,
    corpusLabel: 'Sheets',
    mode: 'voices',
    url: `https://www.sefaria.org/sheets/${100000 + i}?lang=bi&with=all&lang2=en`,
    query: `Sheet ${i}`,
  });
  return { pinned: Array.from({ length: 12 }, (_, i) => entry(i)), inserted: Array.from({ length: 12 }, (_, i) => entry(i + 12)) };
}

test('a full library (12 pinned, 12 recent) hands back intact, through the cache', () => {
  const { context } = loadServer();
  const action = JSON.stringify({ sessionData: JSON.stringify(bigLibrary()), closed: true });
  context.saveSessionLibraryAction(action);
  const received = context.checkSessionLibraryAction();
  assert.deepEqual(JSON.parse(received.sessionData), bigLibrary());
  assert.equal(context.checkSessionLibraryAction(), null, 'taken once');
});

test('a hand-off that cannot be written fails loudly, so Done can say so', () => {
  const { context } = loadServer({ cacheFails: true });
  assert.throws(() => context.saveSessionLibraryAction('{"closed":true}'), /storage refused/);
});

test('opening the dialog clears an old hand-off; an unfinished one is left, a corrupt one dropped', () => {
  const { context, cache } = loadServer();
  context.saveSessionLibraryAction('{"closed":true,"sessionData":"{}"}');
  context.sessionLibraryPopup('{"pinned":[],"inserted":[]}');
  assert.equal(context.checkSessionLibraryAction(), null);

  context.saveSessionLibraryAction('{"closed":false}');
  assert.equal(context.checkSessionLibraryAction(), null);
  assert.ok(Object.keys(cache).length, 'an unfinished hand-off stays');
  context.saveSessionLibraryAction('not json');
  assert.equal(context.checkSessionLibraryAction(), null);
  assert.deepEqual(cache, {});
});

// ---- sidebar ------------------------------------------------------------

function loadSidebar() {
  const source = between(read('apps-script/sidebar/js/event-bindings.html'),
    'var _slDialogPollTimer', 'function closeSessionLibraryModal');
  const { calls, run } = scriptRun();
  const timers = [];
  let now = 0;
  const toasts = [];
  const storage = {};
  const $stub = () => {
    const chain = new Proxy(function () {}, { get: () => () => chain, apply: () => chain });
    return chain;
  };
  const context = {
    console,
    google: { script: { run } },
    setTimeout: (fn, ms) => { timers.push({ fn, at: now + ms }); return timers.length; },
    clearTimeout: (id) => { if (timers[id - 1]) timers[id - 1].cleared = true; },
    Date: { now: () => now },
    showSidebarToast: (message) => toasts.push(message),
    localStorage: { getItem: (k) => storage[k] || null, setItem: (k, v) => { storage[k] = v; } },
    $: $stub,
    sessionLibrary: { pinned: [], inserted: [] },
    renderSessionLibrary() {}, updateSlFooterBadge() {}, setFooterButtonStates() {}, hideSlConfirmation() {},
    sessionLibrarySearch: '', sessionLibrarySortMode: 'category',
  };
  vm.createContext(context);
  vm.runInContext(source, context, { filename: 'event-bindings.html' });
  // Run every timer due by `until`, in order.
  const advance = (until) => {
    for (;;) {
      const next = timers.filter((t) => !t.cleared && !t.done && t.at <= until).sort((a, b) => a.at - b.at)[0];
      if (!next) break;
      next.done = true;
      now = next.at;
      next.fn();
    }
    now = until;
  };
  const pending = (name) => calls.filter((c) => c.name === name && !c.answered);
  const answer = (call, how, value) => { call.answered = true; call[how](value); };
  return { context, calls, advance, pending, answer, toasts, storage, at: () => now };
}

test('Library reopens while the sidebar is still waiting on the dialog it opened before', () => {
  const env = loadSidebar();
  env.context.openSessionLibraryModal();
  env.answer(env.pending('sessionLibraryPopup')[0], 'ok');
  env.advance(3000);
  env.context.openSessionLibraryModal();
  assert.equal(env.calls.filter((c) => c.name === 'sessionLibraryPopup').length, 2);
});

test('a second click while the dialog is still opening is ignored', () => {
  const env = loadSidebar();
  env.context.openSessionLibraryModal();
  env.context.openSessionLibraryModal();
  assert.equal(env.calls.filter((c) => c.name === 'sessionLibraryPopup').length, 1);
});

test('the sidebar keeps waiting past ten minutes, backing off, and stops after an hour', () => {
  const env = loadSidebar();
  env.context.openSessionLibraryModal();
  env.answer(env.pending('sessionLibraryPopup')[0], 'ok');
  // Answer every poll "not closed yet".
  const drain = (until) => {
    while (env.at() < until) {
      env.advance(Math.min(until, env.at() + 1000));
      env.pending('checkSessionLibraryAction').forEach((c) => env.answer(c, 'ok', null));
    }
  };
  drain(2 * 60 * 1000);
  const fast = env.calls.filter((c) => c.name === 'checkSessionLibraryAction').length;
  assert.ok(fast >= 100 && fast <= 125, `about one poll a second for two minutes (got ${fast})`);
  drain(12 * 60 * 1000);
  const slow = env.calls.filter((c) => c.name === 'checkSessionLibraryAction').length - fast;
  assert.ok(slow >= 110 && slow <= 125, `one every five seconds after that (got ${slow})`);
  drain(61 * 60 * 1000);
  const total = env.calls.filter((c) => c.name === 'checkSessionLibraryAction').length;
  drain(70 * 60 * 1000);
  assert.equal(env.calls.filter((c) => c.name === 'checkSessionLibraryAction').length, total, 'stopped after an hour');
});

test('a closed dialog\'s changes reach the sidebar and its stored library', () => {
  const env = loadSidebar();
  env.context.openSessionLibraryModal();
  env.answer(env.pending('sessionLibraryPopup')[0], 'ok');
  env.advance(1000);
  const library = { pinned: [{ ref: 'Isaiah 40:1-5' }], inserted: [] };
  env.answer(env.pending('checkSessionLibraryAction')[0], 'ok', { closed: true, sessionData: JSON.stringify(library) });
  assert.deepEqual(JSON.parse(env.storage.sefariaSidebarSessionLibrary), library);
  env.advance(10000);
  assert.equal(env.pending('checkSessionLibraryAction').length, 0, 'polling stops once the changes arrive');
});

test('polls that keep failing stop, say so, and leave Library openable', () => {
  const env = loadSidebar();
  env.context.openSessionLibraryModal();
  env.answer(env.pending('sessionLibraryPopup')[0], 'ok');
  for (let i = 0; i < 3; i++) {
    env.advance(env.at() + 1000);
    env.answer(env.pending('checkSessionLibraryAction')[0], 'fail');
  }
  assert.equal(env.toasts.length, 1);
  assert.match(env.toasts[0], /Open it again/);
  env.advance(env.at() + 60000);
  assert.equal(env.pending('checkSessionLibraryAction').length, 0);
  env.context.openSessionLibraryModal();
  assert.equal(env.calls.filter((c) => c.name === 'sessionLibraryPopup').length, 2);
});

// ---- dialog -------------------------------------------------------------

function loadDialog() {
  const source = between(read('apps-script/session-library-modal.html'),
    'var _slHandedBack', '// ============================================================\n// EVENT HANDLERS');
  const { calls, run } = scriptRun();
  const elements = {};
  const el = (selector) => {
    const state = elements[selector] || (elements[selector] = { props: {}, attrs: {}, text: '' });
    const api = {
      prop(name, value) { state.props[name] = value; return api; },
      attr(name, value) { state.attrs[name] = value; return api; },
      removeAttr(name) { delete state.attrs[name]; return api; },
      text(value) { state.text = value; return api; },
    };
    return api;
  };
  const closed = [];
  let unload = null;
  const context = {
    console,
    sessionLibrary: { pinned: [{ ref: 'Isaiah 40:1-5' }], inserted: [] },
    google: { script: { run, host: { close: () => closed.push(true) } } },
    $: el,
    window: { addEventListener: (name, fn) => { if (name === 'beforeunload') unload = fn; } },
  };
  vm.createContext(context);
  vm.runInContext(source, context, { filename: 'session-library-modal.html' });
  return { context, calls, elements, closed, unload: () => unload() };
}

test('Done whose changes could not be saved stays open, says so, and can be tried again', () => {
  const env = loadDialog();
  env.context._slSaveAndClose(null);
  assert.equal(env.elements['#sl-modal-done'].props.disabled, true);
  env.calls[0].fail();
  assert.equal(env.closed.length, 0, 'not closed on unsaved changes');
  assert.equal(env.elements['#sl-modal-done'].props.disabled, false);
  assert.match(env.elements['#sl-save-error'].text, /couldn.t be passed back/);
  assert.equal('hidden' in env.elements['#sl-save-error'].attrs, false);

  env.context._slSaveAndClose(null);
  assert.equal(JSON.parse(JSON.parse(env.calls[1].args[0]).sessionData).pinned[0].ref, 'Isaiah 40:1-5');
  env.calls[1].ok();
  assert.equal(env.closed.length, 1);
});

test('after Done has saved, closing does not write a second copy; closing without Done still tries', () => {
  const done = loadDialog();
  done.context._slSaveAndClose(null);
  done.calls[0].ok();
  done.unload();
  assert.equal(done.calls.length, 1);

  const cross = loadDialog();
  cross.unload();
  assert.equal(cross.calls.length, 1);
  assert.equal(cross.calls[0].name, 'saveSessionLibraryAction');
});

test('opening the dialog deletes a hand-off an earlier version left in UserProperties', () => {
  const { context, legacyDeleted } = loadServer();
  context.sessionLibraryPopup('{"pinned":[],"inserted":[]}');
  assert.deepEqual(legacyDeleted, ['SL_DIALOG_ACTION']);
  context.saveSessionLibraryAction('{"closed":true}');
  context.checkSessionLibraryAction();
  assert.deepEqual(legacyDeleted, ['SL_DIALOG_ACTION'], 'saving and reading never touch UserProperties');
});
