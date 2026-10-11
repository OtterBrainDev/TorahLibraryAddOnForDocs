// Pins the "Punctuation: Off" settings (hebrew_punctuation,
// translation_punctuation): stripPunctuationFromText and
// applyPunctuationPreferences in server/text-processing.gs, where findReference
// applies them, and the preference plumbing every new key needs (hard rules 1
// and 2: a default, a migration, seeded on install, on for upgraders).
//
// Loaded with vm.createContext; .gs is not a Node module format.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');

function makeProps(initial = {}) {
  const store = Object.assign({}, initial);
  return {
    store,
    getProperty: (key) => (Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null),
    setProperty(key, value) { store[key] = String(value); return this; },
    deleteProperty(key) { delete store[key]; return this; },
  };
}

function load(files, extra = {}) {
  const context = Object.assign({ console, Logger: { log() {} } }, extra);
  vm.createContext(context);
  files.forEach((relative) => vm.runInContext(read(relative), context, { filename: relative }));
  return context;
}

const ctx = load(['apps-script/server/text-processing.gs']);
const strip = (value) => ctx.stripPunctuationFromText(value);

test('Torah text: sof pasuq, paseq and parasha markers go; maqaf becomes a space', () => {
  assert.equal(strip('אֱלֹהִ֑ים אֵ֥ת הַשָּׁמַ֖יִם וְאֵ֥ת הָאָֽרֶץ׃ {פ}'), 'אֱלֹהִ֑ים אֵ֥ת הַשָּׁמַ֖יִם וְאֵ֥ת הָאָֽרֶץ');
  assert.equal(strip('וַיֹּ֣אמֶר ׀ מֹשֶׁה'), 'וַיֹּ֣אמֶר מֹשֶׁה');
  assert.equal(strip('הַסֵּ֙פֶר֙ כָל־הָעָ֔ם'), 'הַסֵּ֙פֶר֙ כָל הָעָ֔ם');
  assert.equal(strip('וְאֵ֥ת הָאָֽרֶץ׃ {ס} וְהָאָ֗רֶץ'), 'וְאֵ֥ת הָאָֽרֶץ וְהָאָ֗רֶץ');
});

test('Talmud text: abbreviations and the tags rich-text insertion relies on survive', () => {
  assert.equal(strip('אמר ר\' יוחנן: מאי טעמא?'), 'אמר ר\' יוחנן מאי טעמא');
  assert.equal(strip('<b>פירש רש"י,</b> וכו׳.'), '<b>פירש רש"י</b> וכו׳');
  assert.equal(strip('כדתנן ר״ע אומר.'), 'כדתנן ר״ע אומר');
  assert.equal(strip('<b>MISHNA:</b> From when <i>may</i> one recite?'), '<b>MISHNA</b> From when <i>may</i> one recite');
});

test('English: contractions, G-d, numbers, entities and footnote markers are kept', () => {
  assert.equal(strip('Don\'t, said G-d.'), 'Don\'t said G-d');
  assert.equal(strip('All 1,000 people (John 3:16)—all&nbsp;of them.*'), 'All 1,000 people John 3:16 all&nbsp;of them*');
  assert.equal(strip('the scroll, before all the people;'), 'the scroll before all the people');
  assert.equal(strip('“Hello,” he said—‘yes.’'), 'Hello he said yes');
  assert.equal(strip('word<sup class="footnote-marker">*</sup><i class="footnote">A note.</i>'),
    'word<sup class="footnote-marker">*</sup><i class="footnote">A note</i>');
  assert.equal(strip('In 2.5 days, 50% § 3.'), 'In 2.5 days 50% § 3');
});

test('newlines are kept, without a space before them', () => {
  assert.equal(strip('line one.\nline two!\n'), 'line one\nline two\n');
  assert.equal(strip('one; \ntwo'), 'one\ntwo');
});

test('leading and trailing spaces are trimmed only when the original had none', () => {
  assert.equal(strip('— word —'), 'word');
  assert.equal(strip(' word, '), ' word ');
});

test('both toggles on (or unset) leaves the data as it was', () => {
  const data = { he: ['א׃'], text: ['A.'], heRef: 'בראשית א׳:א׳', ref: 'Genesis 1:1' };
  assert.equal(ctx.applyPunctuationPreferences(data, makeProps({})), data);
  assert.equal(ctx.applyPunctuationPreferences(data, makeProps({ hebrew_punctuation: 'true', translation_punctuation: 'true' })), data);
});

test('the two toggles are independent, recurse into nested arrays, and never touch references', () => {
  const data = {
    he: [['בָּרָ֣א׃', 'כָל־הָעָם׃'], 'אֱלֹהִ֑ים׃'],
    text: [['In the beginning,'], 'God created.'],
    heRef: 'בראשית א׳:א׳-ב׳',
    ref: 'Genesis 1:1-2',
  };
  const hebrewOff = ctx.applyPunctuationPreferences(data, makeProps({ hebrew_punctuation: 'false' }));
  assert.deepEqual(JSON.parse(JSON.stringify(hebrewOff.he)), [['בָּרָ֣א', 'כָל הָעָם'], 'אֱלֹהִ֑ים']);
  assert.deepEqual(JSON.parse(JSON.stringify(hebrewOff.text)), data.text);
  assert.equal(hebrewOff.heRef, data.heRef);
  assert.equal(hebrewOff.ref, data.ref);
  assert.notEqual(hebrewOff, data, 'returns a clone');
  assert.equal(data.he[1], 'אֱלֹהִ֑ים׃', 'input is not mutated');

  const translationOff = ctx.applyPunctuationPreferences(data, makeProps({ translation_punctuation: 'false' }));
  assert.deepEqual(JSON.parse(JSON.stringify(translationOff.text)), [['In the beginning'], 'God created']);
  assert.deepEqual(JSON.parse(JSON.stringify(translationOff.he)), data.he);
  assert.equal(translationOff.heRef, data.heRef);
  assert.equal(translationOff.ref, data.ref);
});

test('findReference strips punctuation before the divine-name replacements, so ה\' survives', () => {
  const source = read('apps-script/server/sefaria-fetch.gs');
  const display = source.indexOf('applyHebrewDisplayPreferences(data, userProperties)');
  const punctuation = source.indexOf('applyPunctuationPreferences(data, userProperties)');
  const divine = source.indexOf('applyHebrewDivineNamePreferences(data, userProperties)');
  assert.ok(display >= 0 && display < punctuation && punctuation < divine);

  const props = makeProps({
    hebrew_punctuation: 'false',
    translation_punctuation: 'false',
    apply_sheimot_on_insertion: 'true',
    meforash_replace: 'true',
    meforash_replacement: 'ה\'',
    god_replace: 'true',
    god_replacement: 'G-d',
  });
  const fetchCtx = load(['apps-script/server/text-processing.gs', 'apps-script/server/preferences.gs', 'apps-script/server/sefaria-fetch.gs'], {
    UrlFetchApp: { fetch: () => ({ getResponseCode: () => 200, getContentText: () => JSON.stringify({ ref: 'Exodus 3:15', heRef: 'שמות ג׳:ט״ו', he: ['וַיֹּאמֶר יְהוָה׃'], text: ['God said, “Go.”'], type: 'Tanakh' }) }) },
    PropertiesService: { getUserProperties: () => props },
    expandCitationAbbreviations_: () => [],
    normalizeReferenceInput: (r) => r,
    stripHebrewNumeralMarks_: (r) => r,
  });
  const data = fetchCtx.findReference('Exodus 3:15');
  assert.equal(data.he[0], 'וַיֹּאמֶר ה\'');
  assert.equal(data.text[0], 'G-d said Go');
  assert.equal(data.heRef, 'שמות ג׳:ט״ו');
});

test('both keys are client-writable, default to on, are seeded on install and migrated for upgraders', () => {
  const props = makeProps({});
  const prefCtx = load(['apps-script/server/menu-layout.gs', 'apps-script/server/preferences.gs', 'apps-script/migrations.gs'], {
    PropertiesService: { getUserProperties: () => props },
  });
  const settings = vm.runInContext('SETTINGS', prefCtx);
  const defaults = prefCtx.getDefaultPreferences();
  ['hebrew_punctuation', 'translation_punctuation'].forEach((key) => {
    assert.ok(settings.includes(key), `${key} in SETTINGS`);
    assert.equal(defaults[key], true, `${key} defaults to on`);
  });

  // onInstall seeds every default through seedDefaultPreferences_.
  assert.match(read('apps-script/triggers.gs'), /seedDefaultPreferences_\(/);
  prefCtx.seedDefaultPreferences_(props);
  assert.equal(props.store.hebrew_punctuation, 'true');
  assert.equal(props.store.translation_punctuation, 'true');

  const migrations = read('apps-script/migrations.gs');
  assert.match(migrations, /function migrateToV17_\(/);
  assert.match(migrations, /getProperty\('hebrew_punctuation'\) == null/);
  assert.match(migrations, /getProperty\('translation_punctuation'\) == null/);
});
