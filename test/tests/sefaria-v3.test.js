// The live v3 wire format is different from the add-on's internal payload:
// versions holds fetched texts, available_versions holds the edition catalog.
// These captured responses exercise that boundary before the real preference
// and insertion-formatting helpers run. No network is used by the tests.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');

const ROOT = path.resolve(__dirname, '../..');
const plain = (value) => JSON.parse(JSON.stringify(value));
const fixture = (name) => JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'sefaria-v3-' + name + '.json'), 'utf8'));
const EN_TITLE = 'THE JPS TANAKH: Gender-Sensitive Edition';
const HE_TITLE = 'Miqra according to the Masorah';
const FR_TITLE = 'Bible du Rabbinat 1899 [fr]';

function response(status, payload) {
  return {
    getResponseCode: () => status,
    getContentText: () => typeof payload === 'string' ? payload : JSON.stringify(payload),
  };
}

function apiResponse(rawText, rawRef = fixture('ref-genesis'), status = 200) {
  return (url) => {
    if (url.includes('/api/ref/')) return response(200, rawRef);
    if (url.includes('/api/texts/versions/')) return response(200, rawText.available_versions);
    if (url.includes('/api/v3/texts/')) return response(status, rawText);
    throw new Error('Unexpected Sefaria route');
  };
}

function load(fetchImpl, stored = {}, sessions = {}) {
  const calls = [];
  const logs = [];
  const cache = {};
  const context = {
    console,
    Logger: { log(message) { logs.push(String(message)); } },
    Utilities: {
      DigestAlgorithm: { MD5: 'md5', SHA_256: 'sha256' },
      Charset: { UTF_8: 'utf8' },
      computeDigest: (algorithm, value) => Array.from(crypto.createHash(algorithm).update(value).digest()),
      base64EncodeWebSafe: (bytes) => Buffer.from(bytes).toString('base64url'),
    },
    UrlFetchApp: { fetch(url, options) {
      calls.push({ url, options });
      if (!fetchImpl) throw new Error('Unexpected network request in a pure adapter test');
      return fetchImpl(url, options);
    } },
    PropertiesService: { getUserProperties: () => ({
      getProperties: () => Object.assign({}, stored),
      getProperty: (key) => Object.hasOwn(stored, key) ? stored[key] : null,
    }) },
    CacheService: { getUserCache: () => ({
      get: (key) => Object.hasOwn(sessions, key) ? JSON.stringify(sessions[key]) : (cache[key] || null),
      put: (key, value) => { cache[key] = value; },
    }) },
    expandCitationAbbreviations_: () => [],
  };
  vm.createContext(context);
  for (const file of [
    'apps-script/server/preferences.gs',
    'apps-script/server/text-processing.gs',
    'apps-script/gematriya.gs',
    'apps-script/server/sefaria-fetch.gs',
  ]) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), context, { filename: file });
  }
  return { ctx: context, calls, logs };
}

test('v3 requests both default languages explicitly and preserves the source HTML', () => {
  const { ctx } = load();
  const url = new URL(ctx.sefariaTextsUrl_('Genesis 1:1'));
  assert.equal(url.origin, 'https://www.sefaria.org');
  assert.equal(decodeURIComponent(url.pathname), '/api/v3/texts/Genesis 1:1');
  assert.deepEqual(url.searchParams.getAll('version').sort(), ['primary', 'translation']);
  assert.equal(url.searchParams.get('return_format'), 'default');
  assert.equal(url.searchParams.get('fill_in_missing_segments'), '0');
  for (const obsolete of ['ven', 'vhe', 'commentary', 'context']) {
    assert.equal(url.searchParams.has(obsolete), false, obsolete + ' is a v1-only request parameter');
  }
});

test('v3 version parameters preserve the chosen edition titles and reference punctuation', () => {
  const { ctx } = load();
  const ref = "The Torah: A Women's Commentary, Genesis 1:1";
  const en = 'An edition & its revision [fr]';
  const he = 'A source edition: "quoted"';
  const url = new URL(ctx.sefariaTextsUrl_(ref, { en, he, enLanguage: 'french', heLanguage: 'hebrew' }));
  assert.equal(decodeURIComponent(url.pathname), '/api/v3/texts/' + ref);
  const requests = url.searchParams.getAll('version');
  assert.equal(requests.length, 2);
  assert.ok(requests.some((v) => v.endsWith('|' + en)), 'the translation title is one intact parameter');
  assert.ok(requests.some((v) => v.endsWith('|' + he)), 'the source title is one intact parameter');
  assert.equal(url.searchParams.get('fill_in_missing_segments'), '0', 'one named edition is never silently filled from another');
});

test('exact edition names with significant trailing spaces survive catalog lookup, requests, and responses', () => {
  // This title (including its trailing space) occurs in the live Genesis
  // catalog. The passage below is synthetic; only its exact title matters.
  const title = 'The Philosophical Tanakh ';
  const raw = fixture('genesis');
  raw.versions[1] = {
    versionTitle: title, language: 'en', actualLanguage: 'en', languageFamilyName: 'english',
    isPrimary: false, isSource: false, text: 'Fixture translation',
  };
  raw.available_versions = raw.versions.map(({ text, ...metadata }) => metadata);
  for (const requestTitle of [title, title.trim()]) {
    const { ctx, calls } = load(apiResponse(raw));
    const result = ctx.findReference('Genesis 1:1', { en: requestTitle, he: HE_TITLE });
    assert.equal(result.versionTitle, title);
    assert.equal(result.text, 'Fixture translation');
    const url = new URL(calls.find((c) => c.url.includes('/api/v3/texts/')).url);
    assert.ok(url.searchParams.getAll('version').includes('english|' + title));
    assert.ok(!url.searchParams.getAll('version').includes('english|' + title.trim()));
  }
});

test('the v3 adapter separates selected text from the edition catalog and retains credit', () => {
  const { ctx } = load();
  const raw = fixture('genesis');
  const original = plain(raw);
  const result = ctx.normalizeSefariaV3TextResponse_(raw);
  assert.equal(result.ref, 'Genesis 1:1');
  assert.equal(result.he, raw.versions[0].text);
  assert.equal(result.text, raw.versions[1].text);
  assert.equal(result.heVersionTitle, HE_TITLE);
  assert.equal(result.heVersionSource, raw.versions[0].versionSource);
  assert.equal(result.heLicense, 'CC-BY-SA');
  assert.equal(result.versionTitle, EN_TITLE);
  assert.equal(result.versionSource, raw.versions[1].versionSource);
  assert.equal(result.license, 'CC-BY-NC');
  assert.equal(result.type, 'Tanakh');
  assert.deepEqual(plain(result.categories), ['Tanakh', 'Torah']);
  assert.ok(result.versions.some((v) => v.versionTitle === FR_TITLE), 'a catalog-only edition remains selectable');
  assert.ok(result.versions.every((v) => v.text === undefined), 'the selector catalog does not carry duplicate source text');
  assert.deepEqual(raw, original, 'normalization never mutates the received payload');
});

test('selected v3 versions are identified by their language and title, not response order', () => {
  const { ctx } = load();
  const raw = fixture('genesis');
  raw.versions.reverse();
  const result = ctx.normalizeSefariaV3TextResponse_(raw);
  assert.equal(result.versionTitle, EN_TITLE);
  assert.equal(result.heVersionTitle, HE_TITLE);
  assert.match(result.text, /When God began/);
  assert.match(result.he, /רֵאשִׁ/);
});

test('v3 default formatting preserves semantic footnotes for the later commentary pass', () => {
  const { ctx } = load();
  const raw = fixture('genesis');
  const result = ctx.normalizeSefariaV3TextResponse_(raw);
  assert.equal(result.text, raw.versions.find((v) => v.language === 'en').text);
  assert.match(result.text, /<sup class="footnote-marker">a<\/sup><i class="footnote"><b>/);
});

test('a selected French edition remains in the translation lane with its real language metadata', () => {
  const { ctx } = load();
  const raw = fixture('french');
  const result = ctx.normalizeSefariaV3TextResponse_(raw, { en: FR_TITLE, he: HE_TITLE });
  assert.equal(result.versionTitle, FR_TITLE);
  assert.equal(result.text, 'Au commencement, Dieu créa le ciel et la terre.');
  const edition = result.versions.find((v) => v.versionTitle === FR_TITLE);
  assert.equal(edition.language, 'en', 'Sefaria storage language is not the translation language');
  assert.equal(edition.actualLanguage, 'fr');
  assert.equal(edition.languageFamilyName, 'french');
  assert.equal(result.heVersionTitle, HE_TITLE);
});

test('Talmud metadata and bold/italic text survive v3 adaptation', () => {
  const { ctx } = load();
  const raw = fixture('talmud');
  const result = ctx.normalizeSefariaV3TextResponse_(raw);
  assert.equal(result.ref, 'Berakhot 2a:1');
  assert.equal(result.type, 'Talmud');
  assert.deepEqual(plain(result.sections), ['2a', '1']);
  assert.equal(result.heVersionTitle, 'William Davidson Edition - Vocalized Aramaic');
  assert.equal(result.versionTitle, 'William Davidson Edition - English');
  assert.equal(result.he, raw.versions[0].text);
  assert.equal(result.text, raw.versions[1].text);
});

test('cross-chapter v3 arrays keep their shape and produce correct numbered chapter headings', () => {
  const { ctx } = load();
  const raw = fixture('spanning');
  const result = ctx.normalizeSefariaV3TextResponse_(raw);
  assert.equal(result.isSpanning, true);
  assert.deepEqual(plain(result.sections), ['1', '31']);
  assert.deepEqual(plain(result.toSections), ['2', '1']);
  assert.deepEqual(plain(result.text), raw.versions.find((v) => v.language === 'en').text);
  assert.deepEqual(plain(result.he), raw.versions.find((v) => v.language === 'he').text);
  assert.equal(result.next, raw.next);
  assert.equal(result.prev, raw.prev);
  const lines = ctx.formatDataForPesukim(result, true);
  assert.match(lines.text, /^Chapter 1\n\(31\) And God saw/);
  assert.match(lines.text, /\nChapter 2\n\(1\) The heaven/);
  assert.deepEqual(plain(lines.lineMarkerNumbers), [31, 1]);
});

test('null segments become empty strings without collapsing bilingual or chapter alignment', () => {
  const { ctx } = load();
  const raw = fixture('spanning');
  raw.versions[0].text = [['מקור', null], [null, 'מקור שני']];
  raw.versions[1].text = [[null, 'Translation one'], ['Translation two', null]];
  const result = ctx.normalizeSefariaV3TextResponse_(raw);
  assert.deepEqual(plain(result.he), [['מקור', ''], ['', 'מקור שני']]);
  assert.deepEqual(plain(result.text), [['', 'Translation one'], ['Translation two', '']]);
  assert.equal(raw.versions[0].text[0][1], null, 'the wire payload is unchanged');
  const rows = ctx.buildAlignedLinePairs_(result, false);
  assert.deepEqual(plain(rows.map((row) => [row.he, row.en])), [
    ['מקור', ''], ['', 'Translation one'], ['','Translation two'], ['מקור שני', ''],
  ]);
  const empty = fixture('genesis');
  empty.versions[1].text = null;
  assert.equal(ctx.normalizeSefariaV3TextResponse_(empty).text, '');
});

test('a book lookup requests its first section, never the unbounded v3 book payload', () => {
  const raw = fixture('book-section');
  const refMetadata = fixture('ref-book');
  const { ctx, calls } = load(apiResponse(raw, refMetadata));
  const result = ctx.findReference('Obadiah');
  assert.equal(result.ref, 'Obadiah 1');
  assert.deepEqual(plain(result.sections), ['1']);
  assert.ok(Array.isArray(result.text));
  assert.equal(typeof result.text[0], 'string', 'downstream formatters receive section segments, not nested whole-book chapters');
  const textCalls = calls.filter((c) => c.url.includes('/api/v3/texts/'));
  assert.equal(textCalls.length, 1);
  assert.equal(decodeURIComponent(new URL(textCalls[0].url).pathname), '/api/v3/texts/Obadiah 1');
});

test('a reference preflight keeps an explicitly requested cross-chapter range intact', () => {
  const raw = fixture('spanning');
  const { ctx, calls } = load(apiResponse(raw, fixture('ref-spanning')));
  const result = ctx.findReference('Genesis 1:31-2:1');
  assert.equal(result.ref, 'Genesis 1:31-2:1');
  const textCalls = calls.filter((c) => c.url.includes('/api/v3/texts/'));
  assert.equal(textCalls.length, 1);
  assert.equal(decodeURIComponent(new URL(textCalls[0].url).pathname), '/api/v3/texts/Genesis 1:31-2:1');
});

test('an unresolved heading never triggers a text request', () => {
  const { ctx, calls } = load(() => response(200, fixture('ref-heading')));
  assert.equal(ctx.findReference('Mishneh Torah'), undefined);
  assert.ok(calls.length >= 1);
  assert.ok(calls.every((c) => c.url.includes('/api/ref/')));
});

test('a schema heading without a default text stays structural instead of opening an arbitrary child', () => {
  const raw = fixture('ref-structural');
  const { ctx, calls } = load(() => response(200, raw));
  const result = ctx.findReference('Pesach Haggadah');
  assert.equal(result.ref, 'Pesach Haggadah');
  assert.deepEqual(plain(result.text), []);
  assert.deepEqual(plain(result.he), []);
  assert.equal(calls.length, 1);
  assert.ok(calls[0].url.includes('/api/ref/'));
});

test('a schema default enters the main text before resolving its first section, skipping introductions', () => {
  const rootRef = fixture('ref-default');
  // The root is the live API response. The next response is a focused
  // synthetic section to test traversal without copying a full chapter.
  const sectionRef = {
    is_ref: true, normalized: 'Mesillat Yesharim 1', index_title: 'Mesillat Yesharim',
    node_type: 'JaggedArrayNode', depth: 2, start_labels: ['1'], end_labels: ['1'],
    navigation_refs: { first_available_section_ref: 'Mesillat Yesharim 1' },
  };
  const { ctx, calls } = load((url) => {
    const path = decodeURIComponent(new URL(url).pathname);
    if (path === '/api/ref/Mesillat Yesharim') return response(200, rootRef);
    if (path === '/api/ref/Mesillat Yesharim 1') return response(200, sectionRef);
    throw new Error('A metadata traversal must not read text');
  });
  const plan = ctx.resolveSefariaTextRef_('Mesillat Yesharim');
  assert.equal(plan.textRef, 'Mesillat Yesharim 1');
  assert.equal(plan.indexTitle, 'Mesillat Yesharim');
  assert.equal(calls.length, 2);
  assert.ok(calls.every((c) => !c.url.includes('Introduction')));
});

test('default-node traversal rejects a response that changes to a different book', () => {
  let count = 0;
  const { ctx } = load(() => response(200, count++ === 0 ? fixture('ref-default') : fixture('ref-genesis')));
  assert.throws(() => ctx.resolveSefariaTextRef_('Mesillat Yesharim'), /Sefaria/);
});

test('a malformed default-node loop has a bounded request count and never fetches text', () => {
  const { ctx, calls } = load(() => response(200, fixture('ref-default')));
  assert.throws(() => ctx.resolveSefariaTextRef_('Mesillat Yesharim'), /Sefaria/);
  assert.ok(calls.length <= 4, 'the traversal cannot run until Apps Script times out');
  assert.ok(calls.every((c) => c.url.includes('/api/ref/')));
});

test('a missing requested edition stays empty while the other language remains usable', () => {
  const { ctx } = load();
  const raw = fixture('missing');
  const requested = 'No such edition - migration contract test';
  const result = ctx.normalizeSefariaV3TextResponse_(raw, { en: requested, he: HE_TITLE });
  assert.deepEqual(plain(result.text), []);
  assert.equal(result.versionTitle || '', '', 'never label missing text as the requested edition');
  assert.equal(result.he, raw.versions[0].text);
  assert.equal(result.heVersionTitle, HE_TITLE);
  assert.deepEqual(plain(result.warnings), raw.warnings);
});

test('a valid but empty passage preserves its reference and catalog without inventing text', () => {
  const { ctx } = load();
  const raw = fixture('genesis');
  raw.versions = [];
  const result = ctx.normalizeSefariaV3TextResponse_(raw);
  assert.equal(result.ref, 'Genesis 1:1');
  assert.deepEqual(plain(result.he), []);
  assert.deepEqual(plain(result.text), []);
  assert.equal(result.versionTitle || '', '');
  assert.ok(result.versions.length > 0);
});

test('a response cannot silently substitute another returned edition for an explicit choice', () => {
  const { ctx } = load();
  const raw = fixture('genesis');
  const result = ctx.normalizeSefariaV3TextResponse_(raw, { en: FR_TITLE, he: HE_TITLE });
  assert.deepEqual(plain(result.text), []);
  assert.equal(result.versionTitle || '', '');
  assert.equal(result.heVersionTitle, HE_TITLE);
});

test('source and translation editions with the same title remain separate by storage language', () => {
  const { ctx } = load();
  const raw = fixture('genesis');
  raw.versions.forEach((v) => { v.versionTitle = 'Shared title'; });
  raw.available_versions = raw.versions.map(({ text, ...metadata }) => metadata);
  raw.versions.reverse();
  const result = ctx.normalizeSefariaV3TextResponse_(raw, { en: 'Shared title', he: 'Shared title' });
  assert.match(result.he, /רֵאשִׁ/);
  assert.match(result.text, /When God began/);
});

test('primary/source flags do not put an English original into the Hebrew lane', () => {
  const { ctx } = load();
  const raw = fixture('genesis');
  raw.versions = [Object.assign({}, raw.versions[1], { isPrimary: true, isSource: true })];
  raw.available_versions = raw.versions.map(({ text, ...metadata }) => metadata);
  const result = ctx.normalizeSefariaV3TextResponse_(raw);
  assert.equal(result.versionTitle, EN_TITLE);
  assert.match(result.text, /When God began/);
  assert.deepEqual(plain(result.he), []);
});

test('a Yiddish translation stored under language=he still follows the translation picker choice', () => {
  const { ctx } = load();
  const raw = fixture('yiddish');
  const yiddish = raw.versions.find((v) => v.actualLanguage === 'yi');
  assert.equal(yiddish.language, 'he', 'the fixture exercises the historic storage bucket');
  const result = ctx.normalizeSefariaV3TextResponse_(raw, { en: yiddish.versionTitle, he: HE_TITLE });
  assert.equal(result.versionTitle, yiddish.versionTitle);
  assert.equal(result.text, yiddish.text);
  assert.equal(result.actualLanguage, 'yi');
  assert.equal(result.heVersionTitle, HE_TITLE);
  assert.equal(result.he, raw.versions.find((v) => v.actualLanguage === 'he').text);
});

test('an Aramaic primary source in the Hebrew storage lane stays with the source text', () => {
  const { ctx } = load();
  const raw = fixture('talmud');
  raw.versions[0] = Object.assign({}, raw.versions[0], { actualLanguage: 'arc', languageFamilyName: 'aramaic' });
  raw.available_versions = raw.versions.map(({ text, ...metadata }) => metadata);
  const result = ctx.normalizeSefariaV3TextResponse_(raw);
  assert.equal(result.heVersionTitle, 'William Davidson Edition - Vocalized Aramaic');
  assert.equal(result.he, raw.versions[0].text);
  assert.equal(result.versionTitle, 'William Davidson Edition - English');
});

test('the complete fetch normalizes v3 before applying real Hebrew display preferences', () => {
  const raw = fixture('genesis');
  const { ctx, calls } = load(apiResponse(raw), {
    nekudot: 'false', teamim: 'false', apply_sheimot_on_insertion: 'false',
  });
  const result = ctx.findReference('Genesis 1:1');
  assert.equal(calls.length, 2, 'reference metadata and one bounded text response');
  assert.match(calls[1].url, /\/api\/v3\/texts\//);
  assert.doesNotMatch(result.he, /[\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7]/);
  assert.match(result.heTransliterationSource, /[\u05B0-\u05BD]/, 'transliteration still reads the fetched vowels');
  assert.equal(result.text, raw.versions[1].text);
  assert.equal(result.ref, 'Genesis 1:1');
});

test('v3 sidebar fetches keep session-only vowel overrides and both selected editions', () => {
  const raw = fixture('french');
  const { ctx, calls } = load(apiResponse(raw), {
    nekudot: 'true', teamim: 'true', apply_sheimot_on_insertion: 'false',
  }, { sidebar_session_s1: { nekudot: false, teamim: false } });
  const result = ctx.findReferenceForSidebar('Genesis 1:1', { en: FR_TITLE, he: HE_TITLE }, 's1');
  assert.equal(result.versionTitle, FR_TITLE);
  assert.equal(result.heVersionTitle, HE_TITLE);
  assert.doesNotMatch(result.he, /[\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7]/);
  assert.ok(calls.some((c) => c.url.includes('/api/texts/versions/')), 'resolve exact edition language from the supported Versions API');
  assert.ok(calls.some((c) => c.url.includes('/api/v3/texts/')));
  assert.ok(calls.every((c) => !/\/api\/texts\/(?!versions\/)/.test(c.url)));
});

test('a Yiddish picker selection resolves the Yiddish API family even from the he storage bucket', () => {
  const raw = fixture('yiddish');
  const yiddish = raw.versions.find((v) => v.actualLanguage === 'yi');
  const { ctx, calls } = load(apiResponse(raw));
  const selected = ctx.findReference('Genesis 1:1', { en: yiddish.versionTitle, he: HE_TITLE });
  assert.equal(selected.versionTitle, yiddish.versionTitle);
  assert.equal(selected.text, yiddish.text);
  const textCall = calls.find((c) => c.url.includes('/api/v3/texts/'));
  assert.ok(new URL(textCall.url).searchParams.getAll('version').includes('yiddish|' + yiddish.versionTitle));
});

test('a later fetch for the same passage reuses metadata while still reading fresh text', () => {
  const raw = fixture('genesis');
  const { ctx, calls } = load(apiResponse(raw));
  ctx.findReference('Genesis 1:1');
  ctx.findReference('Genesis 1:1');
  assert.equal(calls.filter((c) => c.url.includes('/api/ref/')).length, 1);
  assert.equal(calls.filter((c) => c.url.includes('/api/v3/texts/')).length, 2);
});

test('selecting an edition uses language-family metadata cached from the initial v3 response', () => {
  const { ctx, calls } = load((url) => {
    if (url.includes('/api/ref/')) return response(200, fixture('ref-genesis'));
    if (url.includes('/api/v3/texts/')) {
      const selectors = new URL(url).searchParams.getAll('version');
      return response(200, fixture(selectors.includes('french|' + FR_TITLE) ? 'french' : 'genesis'));
    }
    throw new Error('A cached version catalog should avoid another metadata request');
  });
  ctx.findReference('Genesis 1:1');
  const selected = ctx.findReference('Genesis 1:1', { en: FR_TITLE, he: HE_TITLE });
  assert.equal(selected.versionTitle, FR_TITLE);
  assert.equal(selected.text, 'Au commencement, Dieu créa le ciel et la terre.');
  assert.equal(calls.filter((c) => c.url.includes('/api/texts/versions/')).length, 0);
  assert.deepEqual(new URL(calls[calls.length - 1].url).searchParams.getAll('version').sort(), [
    'french|' + FR_TITLE, 'hebrew|' + HE_TITLE,
  ]);
});

test('availability asks for every catalog language family with no segment filling', () => {
  const raw = fixture('genesis');
  const french = fixture('french').versions.find((v) => v.actualLanguage === 'fr');
  const { ctx, calls } = load((url) => {
    if (url.includes('/api/ref/')) return response(200, fixture('ref-genesis'));
    if (url.includes('/api/v3/texts/')) {
      const params = new URL(url).searchParams;
      return response(200, params.get('return_format') === 'text_only'
        ? { versions: raw.versions.concat([Object.assign({}, french, { text: '' })]) } : raw);
    }
    throw new Error('Availability should reuse the fetched edition catalog');
  });
  ctx.findReference('Genesis 1:1');
  const availability = ctx.getTranslationAvailability('Genesis 1:1');
  assert.equal(availability.versions[EN_TITLE], true);
  assert.equal(availability.versions[FR_TITLE], false);
  const url = new URL(calls[calls.length - 1].url);
  assert.deepEqual(url.searchParams.getAll('version').sort(), ['english|all', 'french|all', 'hebrew|all']);
  assert.equal(url.searchParams.get('fill_in_missing_segments'), '0');
  assert.equal(url.searchParams.get('return_format'), 'text_only');
  const count = calls.length;
  assert.deepEqual(plain(ctx.getTranslationAvailability('Genesis 1:1')), plain(availability));
  assert.equal(calls.length, count, 'availability itself is cached');
});

test('an API no-match error remains a normal miss, without applying display filters to it', () => {
  const { ctx } = load(() => response(400, { error: 'Could not find title in supplied text' }));
  assert.equal(ctx.findReference('NoSuchBook 99:99'), undefined);
  assert.equal(ctx.normalizeSefariaV3TextResponse_({ error: 'Could not find title' }), undefined);
});

test('malformed v3 success responses fail safely rather than becoming an empty reference', () => {
  for (const body of ['not JSON containing private note', null, [], {}, { ref: 'Genesis 1:1', versions: {} }]) {
    const { ctx, calls, logs } = load(apiResponse(body));
    assert.throws(() => ctx.findReference('private note'), (error) => {
      assert.match(error.message, /Sefaria/i);
      assert.doesNotMatch(error.message, /private note|api\/v3\/texts|not JSON/);
      return true;
    });
    assert.equal(calls.length, 2, 'a malformed text success is not retried as a spelling or legacy-API fallback');
    assert.doesNotMatch(logs.join('\n'), /private note|not JSON/);
  }
});

test('reference metadata with a missing or unknown node type fails instead of appearing structural', () => {
  for (const nodeType of [undefined, null, 'UnknownNode']) {
    const metadata = fixture('ref-genesis');
    metadata.node_type = nodeType;
    const { ctx, calls } = load(() => response(200, metadata));
    assert.throws(() => ctx.findReference('Genesis 1:1'), /Sefaria/);
    assert.equal(calls.length, 1, 'malformed metadata never advances to a text fetch');
    assert.ok(calls[0].url.includes('/api/ref/'));
  }
});

test('a text response for another canonical reference or index is rejected before filtering or catalog caching', () => {
  for (const overrides of [{ ref: 'Genesis 1:2' }, { indexTitle: 'Exodus' }]) {
    const raw = Object.assign(fixture('genesis'), overrides);
    const { ctx, calls } = load(apiResponse(raw));
    let filtered = 0;
    let remembered = 0;
    ctx.attachTransliterationSource_ = (data) => { filtered++; return data; };
    ctx.rememberSefariaVersionCatalog_ = () => { remembered++; };
    assert.throws(() => ctx.findReference('Genesis 1:1'), /Sefaria/);
    assert.equal(calls.length, 2);
    assert.equal(filtered, 0);
    assert.equal(remembered, 0);
  }
});

test('rate limits and server failures never fall back to the deprecated text endpoint', () => {
  for (const status of [429, 500, 503]) {
    const { ctx, calls } = load(apiResponse('private server response', fixture('ref-genesis'), status));
    assert.throws(() => ctx.findReference('Genesis 1:1'), /Sefaria/);
    assert.equal(calls.length, 2);
    assert.match(calls[1].url, /\/api\/v3\/texts\//);
  }
});
