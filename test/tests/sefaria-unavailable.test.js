// Pins how the two Sefaria calls with the widest reach report failure
// (server/sefaria-fetch.gs).
//
// Both used to swallow every error:
//   - findReference returned nothing when the network was down, so Insert
//     Source from Selection said 'No Sefaria source matched "Genesis 1:1"'.
//   - findRefsInDocumentText polled Sefaria's async task for about 5 seconds
//     and then returned an empty result, so a long document, or no network,
//     was reported by Link Texts as "no citations found".
// "No such reference" and "no citations" are real outcomes; "could not ask"
// has to look different. See docs/regression-log.md.
//
// Loaded with vm.runInContext; .gs is not a Node module format.
// See AGENTS.md hard rule #3.

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

function load(fetchImpl) {
  const slept = [];
  const context = {
    console,
    Logger: { log() {} },
    Utilities: { sleep(ms) { slept.push(ms); } },
    UrlFetchApp: { fetch: fetchImpl },
    PropertiesService: { getUserProperties() { return { getProperty() { return null; } }; } },
    // The display and divine-name filters are pinned elsewhere; identity here.
    applyHebrewDisplayPreferences: (d) => d,
    applyHebrewDivineNamePreferences: (d) => d,
    applyEnglishDivineNamePreference: () => {},
    expandCitationAbbreviations_: () => [],
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'apps-script/server/sefaria-fetch.gs'), 'utf8'), context);
  context.slept = slept;
  return context;
}

test('findReference: an unknown reference is "no match", not an error', () => {
  const ctx = load(() => response(404, { error: 'Could not find title' }));
  assert.equal(ctx.findReference('Fakebook 99:99'), undefined);
});

test('findReference: no network throws a message that says so, without the URL', () => {
  const ctx = load(() => { throw new Error('Address unavailable: https://www.sefaria.org/api/texts/Private%20note'); });
  assert.throws(() => ctx.findReference('Genesis 1:1'), (error) => {
    assert.match(error.message, /Couldn.t reach Sefaria/);
    assert.doesNotMatch(error.message, /api\/texts|Private/, 'the URL can carry document text (hard rule 7)');
    return true;
  });
});

test('findReference: a server error or rate limit throws, with the status', () => {
  for (const status of [500, 503, 429]) {
    const ctx = load(() => response(status, 'oops'));
    assert.throws(() => ctx.findReference('Genesis 1:1'), new RegExp('error ' + status));
  }
});

test('findReference: a good response still resolves', () => {
  const ctx = load(() => response(200, { ref: 'Genesis 1:1', text: 'In the beginning', he: 'בראשית' }));
  assert.equal(ctx.findReference('Genesis 1:1').ref, 'Genesis 1:1');
});

test('find-refs: a task that never finishes throws a timeout message instead of "nothing found"', () => {
  const ctx = load((url) => (url.indexOf('/api/find-refs') >= 0
    ? response(202, { task_id: 'abc' })
    : response(200, { ready: false })));
  assert.throws(() => ctx.findRefsInDocumentText('See Genesis 1:1.'), /still scanning this document after \d+ seconds/);
  const waited = ctx.slept.reduce((a, b) => a + b, 0);
  assert.ok(waited >= 20000 && waited <= 60000, 'waits long enough for a long document, well under the 6-minute limit: ' + waited);
});

test('find-refs: a slow task that finishes within the window returns its results', () => {
  let polls = 0;
  const ctx = load((url) => {
    if (url.indexOf('/api/find-refs') >= 0) return response(202, { task_id: 'abc' });
    polls++;
    return polls < 10
      ? response(200, { ready: false })
      : response(200, { ready: true, result: { body: { results: [{ refs: ['Genesis 1:1'] }], refData: {} } } });
  });
  const out = ctx.findRefsInDocumentText('See Genesis 1:1.');
  assert.equal(out.results.length, 1);
});

test('find-refs: no network on the upload throws, rather than reporting no citations', () => {
  const ctx = load(() => { throw new Error('DNS error'); });
  assert.throws(() => ctx.findRefsInDocumentText('See Genesis 1:1.'), /Couldn.t reach Sefaria/);
});

test('find-refs: one dropped poll is retried, not fatal', () => {
  let polls = 0;
  const ctx = load((url) => {
    if (url.indexOf('/api/find-refs') >= 0) return response(202, { task_id: 'abc' });
    polls++;
    if (polls === 1) throw new Error('transient');
    return response(200, { ready: true, result: { body: { results: [], refData: {} } } });
  });
  assert.equal(ctx.findRefsInDocumentText('See Genesis 1:1.').results.length, 0);
});
