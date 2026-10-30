// Pins how much the server asks Google's storage for, and what Link Texts says
// when storage refuses (BUG-012).
//
// A Link Texts rerun failed with "We're sorry, a server error occurred while
// reading from storage. Error code RESOURCE_EXHAUSTED." Every preference reader
// asked UserProperties for one key at a time: the menu command, and the review
// dialog's two parallel calls (getPreferences and the scan), came to ~310
// separate reads, and each Link Texts insert ~170 more. Each reader now reads
// the store once (snapshotProperties_, server/preferences.gs). Which service
// was exhausted is for the Apps Script execution log to say; this pins only
// the volume, and that a failed scan says it changed nothing.
//
// Loaded with vm.runInContext; .gs is not a Node module format.
// See AGENTS.md hard rule #3.

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

const ROOT = path.resolve(__dirname, '..', '..');
const APPS_SCRIPT = path.join(ROOT, 'apps-script');

function response(status, body) {
  return {
    getResponseCode: () => status,
    getContentText: () => (typeof body === 'string' ? body : JSON.stringify(body)),
  };
}

// Every server file in one scope, as Apps Script runs them, over a store that
// counts what is asked of it.
function load({ stored = {}, failReads = null } = {}) {
  const store = Object.assign({}, stored);
  const reads = { getProperty: 0, getProperties: 0, cacheGet: 0 };
  const userProperties = {
    getProperty(key) {
      reads.getProperty++;
      if (failReads) throw failReads;
      return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null;
    },
    getProperties() {
      reads.getProperties++;
      if (failReads) throw failReads;
      return Object.assign({}, store);
    },
    setProperty(key, value) { store[key] = String(value); return this; },
    deleteProperty(key) { delete store[key]; return this; },
  };
  const cache = { get() { reads.cacheGet++; return null; }, put() {}, remove() {} };
  const requests = [];
  const links = [];
  const docText = 'Notes\nGenesis 1:1\nDuplicate A: Genesis 2:1\n';
  const context = {
    console,
    Logger: { log() {} },
    Utilities: { sleep() {}, getUuid: () => 'uuid' },
    PropertiesService: { getUserProperties: () => userProperties },
    CacheService: { getUserCache: () => cache },
    HtmlService: {
      createTemplateFromFile: () => ({ evaluate: () => ({ setWidth() { return this; }, setHeight() { return this; } }) }),
    },
    DocumentApp: {
      getUi: () => ({ showModalDialog() {}, alert() {} }),
      getActiveDocument: () => ({
        getBody: () => ({
          editAsText: () => ({
            getText: () => docText,
            getLinkUrl: () => null,
            setLinkUrl: (s, e, url) => links.push(url),
          }),
        }),
      }),
    },
    UrlFetchApp: {
      fetch(url) {
        requests.push(url);
        if (/index\/titles/.test(url)) return response(200, { books: ['Genesis'] });
        if (/find-refs/.test(url)) return response(200, { task_id: 't' });
        if (/api\/async/.test(url)) {
          return response(200, { ready: true, result: { body: { results: [{ startChar: 6, endChar: 17, refs: ['Genesis 1:1'] }], refData: {} } } });
        }
        return response(200, { ref: 'Genesis 1:1', text: ['In the beginning'], he: [''] });
      },
      fetchAll(list) {
        list.forEach((r) => requests.push(r.url));
        return list.map(() => response(200, { error: 'Could not find title' }));
      },
    },
  };
  vm.createContext(context);
  ['config.gs', 'attribution.gs', 'gematriya.gs', 'transliteration.gs'].forEach((file) => {
    vm.runInContext(fs.readFileSync(path.join(APPS_SCRIPT, file), 'utf8'), context, { filename: file });
  });
  fs.readdirSync(path.join(APPS_SCRIPT, 'server')).filter((f) => f.endsWith('.gs')).forEach((file) => {
    vm.runInContext(fs.readFileSync(path.join(APPS_SCRIPT, 'server', file), 'utf8'), context, { filename: file });
  });
  const total = () => reads.getProperty + reads.getProperties;
  const reset = () => { reads.getProperty = 0; reads.getProperties = 0; reads.cacheGet = 0; };
  return { context, store, reads, total, reset, requests, links };
}

test('getPreferences reads the store once, with the same values and defaults as before', () => {
  const env = load({ stored: { nekudot: 'false', hebrew_font: 'Frank Ruehl' } });
  const prefs = env.context.getPreferences();
  assert.equal(env.total(), 1);
  assert.equal(env.reads.getProperties, 1);
  assert.equal(prefs.nekudot, 'false');
  assert.equal(prefs.hebrew_font, 'Frank Ruehl');
  // An unset key still comes back as its default.
  const defaults = env.context.getDefaultPreferences();
  assert.equal(prefs.output_mode_default, defaults.output_mode_default);
});

test('a value saved in the same call is read back, not a stale snapshot', () => {
  const env = load();
  const after = env.context.setPreferences({ hebrew_font: 'David Libre' });
  assert.equal(after.hebrew_font, 'David Libre');
});

test('getTypographySettings reads the store once', () => {
  const env = load({ stored: { citation_font_size: '9' } });
  const typography = env.context.getTypographySettings();
  assert.equal(env.total(), 1);
  assert.equal(typography.roles.citation.size, 9);
});

test('a preference overlay reads the store at most once, and its overrides win', () => {
  const env = load({ stored: { nekudot: 'true', teamim: 'true', hebrew_font: 'Frank Ruehl' } });
  const overlay = env.context.preferenceOverlay_({ nekudot: 'false' });
  assert.equal(overlay.getProperty('nekudot'), 'false');
  assert.equal(env.total(), 0, 'an overridden key never reaches storage');
  assert.equal(overlay.getProperty('teamim'), 'true');
  assert.equal(overlay.getProperty('hebrew_font'), 'Frank Ruehl');
  assert.equal(overlay.getProperty('never_stored'), null);
  assert.equal(env.total(), 1);
});

test('a Link Texts rerun reads the store once per execution, not once per key', () => {
  const env = load({ stored: { linker_upload_acknowledged: 'true', linker_review_mode: 'full' } });
  env.context.linkTextsWithSefaria();      // the menu command
  env.context.getPreferences();            // the dialog's Customize panel
  const report = env.context.scanDocumentForReferences(); // the dialog's scan
  assert.equal(report.matches.length, 1);
  // One batched read in each of the three executions, plus the menu's check of
  // the one-time upload acknowledgement (not a preference). It was 313.
  assert.equal(env.reads.getProperties, 3);
  assert.equal(env.reads.getProperty, 1);
});

test('a scan whose settings cannot be read says nothing changed, and sends nothing', () => {
  const refusal = new Error("We're sorry, a server error occurred while reading from storage. Error code RESOURCE_EXHAUSTED.");
  const env = load({ failReads: refusal });
  assert.throws(() => env.context.scanDocumentForReferences(), (error) => {
    assert.match(error.message, /nothing in it was changed/);
    assert.match(error.message, /run Link Texts again/);
    assert.match(error.message, /RESOURCE_EXHAUSTED/, "Google's own message is kept for a support report");
    return true;
  });
  assert.deepEqual(env.requests, [], 'no document text is sent to Sefaria');
  assert.deepEqual(env.links, [], 'no link is written');
  assert.equal(env.total(), 1, 'one refused read, not retried');
});
