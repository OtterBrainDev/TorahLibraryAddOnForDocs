const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Integration test for the Code.gs -> server/*.gs domain split.
//
// At runtime in Apps Script, every .gs file under apps-script/ is loaded into
// one shared global scope. This test simulates that by loading every .gs file
// we ship (peer helpers at the root + all server/*.gs) into a single vm.createContext
// and asserting that:
//
//   1. Every function in docs/rpc-surface.json is actually defined in the
//      combined global scope (proves the sidebar/dialogs can reach them).
//   2. The two "glue" utilities that HTML templates and insertRichTextFromHTML
//      depend on (`include`, `decodeHTMLEntities`) are defined.
//
// If a function ever gets dropped during a future refactor, this test fails
// immediately — before the sidebar silently 404s on the live
// `google.script.run.<name>` call.

const ROOT = path.resolve(__dirname, '..', '..');
const APPS_SCRIPT = path.join(ROOT, 'apps-script');
const SERVER_DIR = path.join(APPS_SCRIPT, 'server');

// Minimal Apps Script global stubs. Only enough shape for files to LOAD;
// we don't invoke anything (just check function identity).
function makeAppsScriptStubs() {
  const noop = () => {};
  const returnSelf = function () { return this; };
  const emptyObj = () => ({});

  const userPropsStub = {
    getProperty() { return null; },
    setProperty() {},
    deleteProperty() {},
    getProperties() { return {}; },
  };

  const cacheStub = {
    get() { return null; },
    put() {},
    remove() {},
  };

  return {
    console,
    Logger: { log() {} },
    HtmlService: {
      createHtmlOutputFromFile() { return { getContent() { return ''; }, setWidth: returnSelf, setHeight: returnSelf, setTitle: returnSelf, evaluate: returnSelf }; },
      createTemplateFromFile() { return { evaluate() { return { setWidth: returnSelf, setHeight: returnSelf, setTitle: returnSelf }; } }; },
    },
    DocumentApp: {
      Attribute: new Proxy({}, { get: (_, k) => String(k) }),
      ElementType: new Proxy({}, { get: (_, k) => String(k) }),
      ParagraphHeading: new Proxy({}, { get: (_, k) => String(k) }),
      getActiveDocument() { return { getBody: emptyObj, getCursor: () => null, getSelection: () => null }; },
      getUi() { return { alert: noop, createAddonMenu: emptyObj, createMenu: emptyObj, showSidebar: noop, showModalDialog: noop }; },
    },
    SpreadsheetApp: {
      getUi() { return { showModalDialog: noop }; },
    },
    UrlFetchApp: {
      fetch() { return { getContentText: () => '{}', getResponseCode: () => 200 }; },
    },
    Utilities: {
      getUuid() { return 'uuid-test'; },
      sleep() {},
    },
    PropertiesService: {
      getUserProperties() { return userPropsStub; },
      getScriptProperties() { return userPropsStub; },
    },
    CacheService: {
      getUserCache() { return cacheStub; },
      getScriptCache() { return cacheStub; },
    },
    ScriptApp: {
      AuthMode: { NONE: 'NONE', LIMITED: 'LIMITED', FULL: 'FULL' },
    },
  };
}

function listGsFilesRecursive(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listGsFilesRecursive(full));
    else if (full.endsWith('.gs')) out.push(full);
  }
  return out;
}

function loadAllAppsScriptIntoContext() {
  const context = makeAppsScriptStubs();
  // attribution.gs uses an IIFE that assigns to `globalScope` (globalThis).
  // Point globalThis back at the vm context so those assignments land here.
  context.globalThis = context;
  vm.createContext(context);

  // Load order: peer helpers first (provide primitives), then every server/*.gs.
  // File order inside each tier doesn't matter because function declarations
  // are hoisted; only the top-level `var`/IIFE side-effects in attribution.gs
  // and transliteration.gs care about evaluation order.
  const peerHelpers = [
    'config.gs',
    'ui_core.gs',
    'gematriya.gs',
    'transliteration.gs',
    'attribution.gs',
    'migrations.gs',
    'surprise-me-feature.gs',
  ].map((name) => path.join(APPS_SCRIPT, name));

  const serverFiles = listGsFilesRecursive(SERVER_DIR).sort();

  for (const file of [...peerHelpers, ...serverFiles]) {
    const src = fs.readFileSync(file, 'utf8');
    vm.runInContext(src, context, { filename: file });
  }

  return context;
}

test('every rpc-surface function is defined in the combined server scope', () => {
  const surface = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'docs/rpc-surface.json'), 'utf8')
  );
  const ctx = loadAllAppsScriptIntoContext();

  const missing = [];
  for (const entry of surface.functions) {
    if (typeof ctx[entry.name] !== 'function') {
      missing.push(entry.name);
    }
  }
  assert.deepEqual(
    missing,
    [],
    `These RPC-surface functions are not defined after loading every apps-script/**/*.gs file:\n  ${missing.join('\n  ')}\n` +
    `The client sidebar/dialogs call these via google.script.run — a missing definition means a silent no-op in production.`
  );
});

test('template-glue utilities (include, decodeHTMLEntities) are defined', () => {
  const ctx = loadAllAppsScriptIntoContext();
  assert.equal(typeof ctx.include, 'function',
    "include() is missing. Every <?!= include('...') ?> call in the HTML templates will fail, breaking the sidebar and dialogs.");
  assert.equal(typeof ctx.decodeHTMLEntities, 'function',
    'decodeHTMLEntities() is missing. insertRichTextFromHTML will throw when Sefaria text contains HTML entities, corrupting every inserted verse.');
});
