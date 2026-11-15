// Voices' topic categories are its corpora (sidebar/js/voices,
// VOICES_TOPIC_CATALOG in shared/ui/state): a sheet is filed under the first
// of its topics that fits a category (by the most specific keyword), the
// results are grouped by category in the saved order, a category can be
// hidden for one search or left out in Preferences → Search
// (voices_topic_order / voices_topic_excluded, schema 28), and a chip shows
// a left-out one for one search.
//
// Loaded with vm.runInContext; see AGENTS.md hard rule #3.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { loadSidebarSearch, ROOT, scriptBody } = require('./helpers/sidebar-search-harness');

const read = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const KEYS = ['voices_topic_order', 'voices_topic_excluded'];

function loadState() {
  const context = { console, window: {} };
  vm.createContext(context);
  ['apps-script/shared/ui/core-shared.html', 'apps-script/shared/ui/state.html']
    .forEach((file) => vm.runInContext(scriptBody(file), context, { filename: file }));
  return context;
}

test('a sheet is filed under the first of its topics that fits, by its most specific keyword', () => {
  const state = loadState();
  const category = (topics, label) => state.voicesTopicCategoryOf({ topics, label }).label;
  assert.equal(category(['Lech Lecha', 'Abraham']), 'Torah Portions');
  assert.equal(category(['Abraham', 'Lech Lecha']), 'People', 'the first topic decides');
  assert.equal(category(['Torah Study']), 'Values & Ethics', 'longer than "Torah"');
  assert.equal(category(['Laws of Shabbat']), 'Halakhah', 'longer than "Shabbat"');
  assert.equal(category(['Rosh Hashanah']), 'Shabbat & Holidays');
  assert.equal(category(['Blessings']), 'Prayer', 'a plural fits');
  assert.equal(category(['Pésach']), 'Shabbat & Holidays', 'accents aside');
  assert.equal(category(['Bob Dylan']), 'Other', 'a word inside a word is no match ("bo")');
  assert.equal(category([], 'A Passover Seder Guide'), 'Shabbat & Holidays', 'no topics: the title');
  assert.equal(category([], 'Untitled'), 'Other');
  assert.equal(state.voicesTopicCategoryOf({ topics: ['Kindness'] }).key, 'topic-values');
});

test('a stored order is completed with the catalog; unknown, repeated and malformed values are dropped', () => {
  const state = loadState();
  const builtIn = Array.from(state.VOICES_TOPIC_CATALOG, (entry) => entry.key);
  assert.equal(builtIn[builtIn.length - 1], 'topic-other', 'Other comes last');
  assert.deepEqual(Array.from(state.normalizeVoicesTopicOrder('[]')), builtIn);
  assert.deepEqual(Array.from(state.normalizeVoicesTopicOrder('nope')), builtIn);
  const ordered = Array.from(state.normalizeVoicesTopicOrder('["topic-prayer","x","topic-prayer","topic-people"]'));
  assert.deepEqual(ordered.slice(0, 2), ['topic-prayer', 'topic-people']);
  assert.equal(ordered.length, builtIn.length);
  assert.deepEqual(Array.from(state.normalizeVoicesTopicExcluded('["topic-people","topic-people","tanakh",""]')), ['topic-people']);
});

const sheet = (id, topics) => ({ key: `sheet-${id}`, ref: `sheet:${id}`, label: `Sheet ${id}`, topics, url: `u${id}`, clusterLabel: 'Source Sheets' });
const ANSWER = [sheet(1, ['Kindness']), sheet(2, ['Passover']), sheet(3, ['Abraham']), sheet(4, ['Seder']), sheet(5, [])];

function searchVoices(preferences) {
  const env = loadSidebarSearch({ mode: 'voices', preferences });
  env.ctx.setSidebarMode('voices', true);
  env.type('love');
  env.ctx.runUnifiedQuery({ fromTyping: true });
  env.last('searchVoices').ok(JSON.parse(JSON.stringify(ANSWER)));
  return env;
}

test('the sheets are grouped by category, in the built-in or the saved order, Sefaria’s order within one', () => {
  const builtIn = searchVoices({});
  assert.deepEqual(builtIn.shown(), ['sheet:2', 'sheet:4', 'sheet:3', 'sheet:1', 'sheet:5']);
  assert.deepEqual(Array.from(builtIn.get('resultPostProcessState.availableCorpora'), (c) => `${c.label} ${c.count}`),
    ['Shabbat & Holidays 2', 'People 1', 'Values & Ethics 1', 'Other 1']);
  assert.match(builtIn.dom.html['.result-filter-strip'], /Topics:/);

  const saved = searchVoices({ voices_topic_order: '["topic-values","topic-people"]' });
  assert.deepEqual(saved.shown(), ['sheet:1', 'sheet:3', 'sheet:2', 'sheet:4', 'sheet:5']);
});

test('a group’s ❌ hides its category for this search; a category left out in Preferences stays out unless its chip shows it', () => {
  const env = searchVoices({});
  env.ctx.toggleCorpusVisibility('topic-holidays');
  assert.deepEqual(env.shown(), ['sheet:3', 'sheet:1', 'sheet:5']);
  assert.equal(env.badge('voices'), '3', 'the badge counts what is shown');
  env.ctx.toggleCorpusVisibility('topic-holidays');
  assert.equal(env.shown().length, 5);

  const saved = searchVoices({ voices_topic_excluded: '["topic-people","topic-other"]' });
  assert.deepEqual(saved.shown(), ['sheet:2', 'sheet:4', 'sheet:1']);
  assert.match(saved.dom.html['.result-filter-strip'],
    /voices-topic-chip removed' data-corpus-key='topic-people' aria-pressed='false' title='Hidden in Preferences\. Show People \(1 sheet\) for this search'/);
  saved.ctx.toggleCorpusVisibility('topic-people');
  assert.deepEqual(saved.shown(), ['sheet:2', 'sheet:4', 'sheet:3', 'sheet:1']);
});

test('a selected sheet whose category is hidden is deselected', () => {
  const env = searchVoices({});
  env.ctx.selectResultItem(env.get("findShownResult('sheet:3')"));
  assert.equal(env.get('selectedVoiceItem.ref'), 'sheet:3');
  env.ctx.toggleCorpusVisibility('topic-people');
  assert.equal(env.get('selectedVoiceItem'), null);
  assert.equal(env.get('selectedResultKey'), null);
});

function loadServer(stored) {
  const store = Object.assign({}, stored);
  const props = {
    getProperty: (name) => (Object.prototype.hasOwnProperty.call(store, name) ? store[name] : null),
    setProperty(name, value) { store[name] = String(value); return props; },
    deleteProperty(name) { delete store[name]; return props; },
    getProperties: () => Object.assign({}, store),
  };
  const context = { console, Logger: { log() {} }, PropertiesService: { getUserProperties: () => props } };
  vm.createContext(context);
  ['server/menu-layout.gs', 'server/preferences.gs', 'migrations.gs', 'server/first-run.gs', 'server/settings-file.gs']
    .forEach((file) => vm.runInContext(read('apps-script/' + file), context, { filename: file }));
  return { ctx: context, store };
}

test('the two keys: defaults "[]", writable from Preferences, in the settings file’s Search part', () => {
  const { ctx } = loadServer();
  const defaults = ctx.getDefaultPreferences();
  const settings = vm.runInContext('SETTINGS', ctx);
  KEYS.forEach((key) => {
    assert.equal(defaults[key], '[]', key);
    assert.ok(settings.includes(key), key + ' must be in SETTINGS');
    assert.equal(ctx.settingsFileGroupOf_(key), 'search', key);
  });
});

test('schema 28 gives an upgrader both keys as "[]" (every topic, the built-in order) and keeps a stored value', () => {
  const upgrader = loadServer({ prefs_schema_version: '27', nekudot: 'false' });
  upgrader.ctx.runUserPreferenceMigrationsIfNeeded_();
  assert.equal(upgrader.store.prefs_schema_version, '28');
  KEYS.forEach((key) => assert.equal(upgrader.store[key], '[]', key));
  assert.equal(upgrader.store.nekudot, 'false');

  const kept = loadServer({ prefs_schema_version: '27', voices_topic_excluded: '["topic-people"]' });
  kept.ctx.runUserPreferenceMigrationsIfNeeded_();
  assert.equal(kept.store.voices_topic_excluded, '["topic-people"]');
});

test('Preferences has the topic list, saved through two hidden fields, refreshed with the rest of the form', () => {
  const page = read('apps-script/preferences.html');
  const js = read('apps-script/preferences/js.html');
  assert.match(page, /id="voices-topic-order-list"/);
  assert.match(page, /id="voices-topic-order-reset"/);
  KEYS.forEach((key) => assert.match(page, new RegExp(`<input type="hidden" id="${key}" name="${key}" value="\\[\\]">`)));
  assert.match(js, /createOrderVisibilityEditor\(\{[\s\S]*?catalog: VOICES_TOPIC_CATALOG/);
  assert.match(js, /voicesTopicOrderEditor\.init\(\);/);
  assert.match(js, /voicesTopicOrderEditor\.load\(\);/);
});
