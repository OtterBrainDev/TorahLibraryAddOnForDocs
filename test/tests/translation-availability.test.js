// Translations listed for a book but empty for the passage (Yiddish on
// Deuteronomy 6:4) used to be offered as if they had text. Sefaria's
// /api/texts version list is the whole book's; getTranslationAvailability asks
// the v3 endpoint which versions have text for the exact ref, and the sidebar
// leaves the empty ones out unless "Show unavailable translations" is on.
//
// Loaded with vm.runInContext; .gs is not a Node module format (hard rule #3).

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

const ROOT = path.resolve(__dirname, '..', '..');

function response(status, body) {
  return {
    getResponseCode: () => status,
    getContentText: () => (typeof body === 'string' ? body : JSON.stringify(body)),
  };
}

function loadServer(fetchImpl) {
  const store = {};
  const fetched = [];
  const context = {
    console,
    Logger: { log() {} },
    Utilities: {
      DigestAlgorithm: { MD5: 'md5' },
      Charset: { UTF_8: 'utf8' },
      computeDigest: (alg, value) => Array.from(Buffer.from(require('node:crypto').createHash('md5').update(value).digest())),
      base64EncodeWebSafe: (bytes) => Buffer.from(bytes).toString('base64url'),
    },
    CacheService: {
      getUserCache: () => ({
        get: (k) => (k in store ? store[k] : null),
        put: (k, v) => { store[k] = v; },
      }),
    },
    UrlFetchApp: { fetch: (url, opts) => { fetched.push(url); return fetchImpl(url, opts); } },
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'apps-script/server/sefaria-fetch.gs'), 'utf8'), context);
  context.fetched = fetched;
  context.store = store;
  return context;
}

const DEUT_6_4 = {
  versions: [
    { versionTitle: 'The Contemporary Torah, JPS, 2006', language: 'en', text: 'Hear, O Israel!' },
    { versionTitle: 'Miqra according to the Masorah', language: 'he', text: 'שְׁמַע יִשְׂרָאֵל' },
    { versionTitle: 'Yehoash Yiddish Translation [yi]', language: 'en', text: '' },
    { versionTitle: 'Markup only', language: 'en', text: ['<i></i>', '&nbsp;'] },
  ],
};

test('each version is available exactly when it has text for the ref', () => {
  const ctx = loadServer(() => response(200, DEUT_6_4));
  const result = ctx.getTranslationAvailability('Deuteronomy 6:4');
  assert.equal(result.ref, 'Deuteronomy 6:4');
  assert.deepEqual(JSON.parse(JSON.stringify(result.versions)), {
    'The Contemporary Torah, JPS, 2006': true,
    'Miqra according to the Masorah': true,
    'Yehoash Yiddish Translation [yi]': false,
    'Markup only': false,
  });
  assert.match(ctx.fetched[0], /^https:\/\/www\.sefaria\.org\/api\/v3\/texts\/Deuteronomy%206%3A4\?version=all/);
});

test('the answer is cached per ref, so the list does not refetch it', () => {
  const ctx = loadServer(() => response(200, DEUT_6_4));
  ctx.getTranslationAvailability('Deuteronomy 6:4');
  const again = ctx.getTranslationAvailability('Deuteronomy 6:4');
  assert.equal(ctx.fetched.length, 1);
  assert.equal(again.versions['Yehoash Yiddish Translation [yi]'], false);
});

test('a lookup that fails or returns no versions is "unknown" (null), never "unavailable"', () => {
  assert.equal(loadServer(() => { throw new Error('offline'); }).getTranslationAvailability('Genesis 1:1'), null);
  assert.equal(loadServer(() => response(500, 'oops')).getTranslationAvailability('Genesis 1:1'), null);
  assert.equal(loadServer(() => response(404, { error: 'no' })).getTranslationAvailability('Genesis 1:1'), null);
  assert.equal(loadServer(() => response(200, 'not json')).getTranslationAvailability('Genesis 1:1'), null);
  assert.equal(loadServer(() => response(200, { versions: [] })).getTranslationAvailability('Genesis 1:1'), null);
  assert.equal(loadServer(() => response(200, {})).getTranslationAvailability(''), null);
});

test('a title shared by two languages is available if either has text', () => {
  const ctx = loadServer(() => response(200, {
    versions: [
      { versionTitle: 'Same', language: 'he', text: '' },
      { versionTitle: 'Same', language: 'en', text: 'x' },
    ],
  }));
  assert.equal(ctx.getTranslationAvailability('Genesis 1:1').versions.Same, true);
});

// ── Sidebar list ──────────────────────────────────────────────────────────

function readScriptBody(relativePath) {
  const html = fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
  return html.replace(/^\s*<script>/, '').replace(/<\/script>\s*$/, '');
}

function loadSidebar() {
  const calls = [];
  const context = {
    console,
    effectivePreferences: {},
    translationAvailabilityByRef: {},
    activeTranslationOptions: null,
    translationAvailabilityRequested: {},
  };
  context.window = context;
  context.google = {
    script: {
      run: {
        withSuccessHandler(ok) {
          const runner = {
            withFailureHandler(fail) {
              return { getTranslationAvailability(ref) { calls.push({ ref, ok, fail }); } };
            },
          };
          return runner;
        },
      },
    },
  };
  vm.createContext(context);
  ['apps-script/shared/ui/core-shared.html', 'apps-script/shared/ui/state.html', 'apps-script/sidebar/js/preview-core.html']
    .forEach((file) => vm.runInContext(readScriptBody(file), context, { filename: file }));
  context.calls = calls;
  return context;
}

function items() {
  return [
    { value: 'JPS', languageCode: 'en', availableForRef: true },
    { value: 'Yehoash', languageCode: 'yi', availableForRef: true },
    { value: 'Traduction', languageCode: 'fr', availableForRef: true },
  ];
}

const REF = 'Deuteronomy 6:4';

test('by default a translation with no text for the passage is left out of the list', () => {
  const ctx = loadSidebar();
  ctx.translationAvailabilityByRef[REF + '::Yehoash'] = false;
  const listed = ctx.listTranslationItems(items(), REF, {});
  assert.deepEqual(listed.map((i) => i.value), ['JPS', 'Traduction']);
});

test('"Show unavailable translations" lists it, flagged unavailable (rendered greyed out)', () => {
  const ctx = loadSidebar();
  ctx.translationAvailabilityByRef[REF + '::Yehoash'] = false;
  const listed = ctx.listTranslationItems(items(), REF, { show_unavailable_translations: 'true' });
  assert.deepEqual(listed.map((i) => i.value), ['JPS', 'Yehoash', 'Traduction']);
  assert.equal(listed[1].availableForRef, false);
});

test('languages hidden in Preferences → Search are left out, unless that would empty the list', () => {
  const ctx = loadSidebar();
  assert.deepEqual(
    ctx.listTranslationItems(items(), REF, { hidden_translation_languages: '["fr","yi"]' }).map((i) => i.value),
    ['JPS']
  );
  assert.deepEqual(
    ctx.listTranslationItems(items(), REF, { hidden_translation_languages: '["en","fr","yi"]' }).map((i) => i.value),
    ['JPS', 'Yehoash', 'Traduction']
  );
});

test('the availability answer fills the list in, but never overrides what a fetch found', () => {
  const ctx = loadSidebar();
  ctx.translationAvailabilityByRef[REF + '::JPS'] = false;
  ctx.translationAvailabilityByRef[REF + '::Traduction'] = true;
  let refreshed = 0;
  ctx.activeTranslationOptions = { ref: REF, refresh() { refreshed++; } };
  ctx.requestTranslationAvailability(REF);
  ctx.requestTranslationAvailability(REF);
  assert.equal(ctx.calls.length, 1, 'one lookup per ref');
  ctx.calls[0].ok({ ref: REF, versions: { JPS: true, Yehoash: false, Traduction: false } });
  assert.equal(ctx.translationAvailabilityByRef[REF + '::JPS'], false);
  assert.equal(ctx.translationAvailabilityByRef[REF + '::Traduction'], true, 'the version in the preview stays');
  assert.equal(ctx.translationAvailabilityByRef[REF + '::Yehoash'], false);
  assert.equal(refreshed, 1);
});

test('a failed or unknown lookup hides nothing', () => {
  const ctx = loadSidebar();
  ctx.requestTranslationAvailability(REF);
  ctx.calls[0].ok(null);
  assert.deepEqual(ctx.listTranslationItems(items(), REF, {}).map((i) => i.value), ['JPS', 'Yehoash', 'Traduction']);
  ctx.calls[0].fail(new Error('offline'));
  ctx.requestTranslationAvailability(REF);
  assert.equal(ctx.calls.length, 2, 'a failed lookup can be retried');
});

test('version entries map to the language codes Preferences offers', () => {
  const ctx = loadSidebar();
  assert.equal(ctx.translationEntryLanguageCode({ languageKey: 'en' }), 'en');
  assert.equal(ctx.translationEntryLanguageCode({ languageKey: 'other:yi' }), 'yi');
  assert.equal(ctx.translationEntryLanguageCode({ languageKey: 'other:yiddish' }), 'yi');
  assert.equal(ctx.translationEntryLanguageCode({ languageKey: 'other:zz' }), '');
  assert.deepEqual(
    Array.from(ctx.normalizeHiddenTranslationLanguages('["YI","yi","zz",""]')),
    ['yi']
  );
});
