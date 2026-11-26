const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { v3RefFixture } = require('./helpers/sefaria-v3-fixture');

test('search verifies translation text in the requested language and passage', () => {
  const sources = [
    { ref: 'Genesis 1:1', versions: [{ actualLanguage: 'he', isSource: true, text: 'א' }, { actualLanguage: 'fr', isSource: false, text: ' ' }] },
    { ref: 'Genesis 1:2', versions: [{ actualLanguage: 'fr', isSource: false, text: ['', 'Traduction'] }] },
    { ref: 'Genesis 1:3', versions: [{ actualLanguage: 'es', isSource: false, text: 'Traducción' }, { actualLanguage: 'he', isSource: false, text: 'תרגום' }] },
    { ref: 'Genesis 1:99', versions: [{ actualLanguage: 'fr', isSource: false, text: 'Wrong passage' }] },
    { ref: 'Genesis 1', indexTitle: 'Genesis', versions: [{ actualLanguage: 'fr', isSource: false, text: 'Book opening' }] },
    null
  ];
  const requests = [];
  const context = vm.createContext({
    UrlFetchApp: {
      fetchAll(batch) {
        requests.push(...batch);
        const isMetadata = new URL(batch[0].url).pathname.startsWith('/api/ref/');
        if (isMetadata) {
          return batch.map(({ url }) => {
            const ref = decodeURIComponent(new URL(url).pathname.split('/').at(-1));
            const meta = v3RefFixture({ ref, indexTitle: 'Genesis' });
            if (ref === 'Genesis') {
              meta.depth = 2;
              meta.start_labels = [];
              meta.end_labels = [];
              meta.navigation_refs = { first_available_section_ref: 'Genesis 1' };
            }
            return { getResponseCode: () => 200, getContentText: () => JSON.stringify(meta) };
          });
        }
        return sources.map((payload) => ({
          getResponseCode: () => payload ? 200 : 503,
          getContentText: () => JSON.stringify(payload && { indexTitle: 'Genesis', ...payload })
        }));
      }
    }
  });
  for (const name of ['search.gs', 'sefaria-fetch.gs']) {
    vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../apps-script/server', name), 'utf8'), context);
  }
  const result = context.getSearchTranslationMatches([
    'Genesis 1:1', 'Genesis 1:2', 'Genesis 1:3', 'Genesis 1:4', 'Genesis', 'Genesis 1:5', 'Genesis 1:2'
  ], ['French', 'he']);
  assert.deepEqual(JSON.parse(JSON.stringify(result)), {
    matches: [
      { ref: 'Genesis 1:2', languages: ['fr'] },
      { ref: 'Genesis 1:3', languages: ['he'] },
      { ref: 'Genesis', languages: ['fr'] }
    ],
    incomplete: true
  });
  assert.equal(requests.length, 12);
  assert.match(decodeURIComponent(requests[10].url), /texts\/Genesis 1\?/);
  const url = new URL(requests[6].url);
  assert.deepEqual(url.searchParams.getAll('version'), ['french|all', 'hebrew|all']);
  assert.equal(url.searchParams.get('fill_in_missing_segments'), '0');
  assert.equal(url.searchParams.get('return_format'), 'text_only');
});
