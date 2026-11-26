// Pins source attribution: the credit lines under an inserted source.
//
// Many Sefaria texts are CC-BY or CC-BY-NC, so the credit line is on by
// default, and it credits every edition that is actually inserted — the
// Hebrew edition's own license (`heLicense`) included, which used to be read
// nowhere.
//
// Loaded with vm.runInContext; see AGENTS.md hard rule #3.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '../..');

function load() {
  const context = {
    console,
    Logger: { log() {} },
    HtmlService: {},
    DocumentApp: { Attribute: new Proxy({}, { get: (_, k) => String(k) }) },
    PropertiesService: { getUserProperties: () => ({ getProperty: () => null }) },
  };
  vm.createContext(context);
  ['apps-script/attribution.gs', 'apps-script/server/source-text.gs', 'apps-script/server/utils.gs', 'apps-script/server/insertion.gs',
    'apps-script/server/menu-layout.gs', 'apps-script/server/preferences.gs'].forEach((file) => {
    vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), context, { filename: file });
  });
  return context;
}

test('source credit is on by default', () => {
  const { getDefaultPreferences } = load();

  assert.equal(getDefaultPreferences().include_translation_source_info, true);
});

function writeCredits(ctx, lines) {
  const links = [];
  const paragraph = {
    text: '',
    setText(text) { this.text = text; },
    setAttributes() {},
    setLeftToRight() {},
    editAsText() { return { setLinkUrl: (start, end, url) => links.push([this.text.slice(start, end + 1), url]) }; }
  };
  ctx.insertAttributionParagraph(paragraph, lines);
  return { text: paragraph.text, links };
}

test('bilingual credit uses two lines and attaches each license to its edition', () => {
  const ctx = load();
  const data = {
    versionTitle: 'JPS', versionSource: 'https://www.jps.org/edition', versionDigitizedBy: 'Sefaria',
    license: 'CC-BY-NC', heVersionTitle: 'Miqra according to the Masorah', heLicense: 'CC-BY-SA'
  };
  const credits = writeCredits(ctx, [
    ...ctx.getEnglishAttributionLines(data, ctx.translationAttributionLine_),
    ...ctx.getHebrewAttributionLines_(data),
  ]);
  assert.equal(credits.text, 'JPS · Source: jps.org · Digitization: Sefaria · License: CC-BY-NC' +
    '\nHebrew: Miqra according to the Masorah · License: CC-BY-SA');
  assert.deepEqual(credits.links, [
    ['Source: jps.org', 'https://www.jps.org/edition'],
    ['License: CC-BY-NC', 'https://creativecommons.org/licenses/by-nc/4.0/'],
    ['License: CC-BY-SA', 'https://creativecommons.org/licenses/by-sa/3.0/']
  ]);
});

test('edition metadata overrides the license destination and unknown licenses stay plain', () => {
  const ctx = load();
  const data = {
    versionTitle: 'An edition', translationVersion: { license: 'Publisher terms', licenseUrl: 'https://example.com/terms' },
    heVersionTitle: 'Vilna', heLicense: 'Copyright', heLicenseUrl: 'javascript:bad'
  };
  const credits = writeCredits(ctx, [
    ...ctx.getEnglishAttributionLines(data, ctx.translationAttributionLine_),
    ...ctx.getHebrewAttributionLines_(data),
  ]);
  assert.equal(credits.text, 'An edition · License: Publisher terms\nHebrew: Vilna · License: Copyright');
  assert.deepEqual(credits.links, [['License: Publisher terms', 'https://example.com/terms']]);
  assert.equal(writeCredits(ctx, ctx.getHebrewAttributionLines_({ heVersionTitle: 'Vilna' })).text, 'Hebrew: Vilna');
  assert.equal(writeCredits(ctx, ctx.getHebrewAttributionLines_({ heLicense: 'CC0' })).text, '');
});

test('the optional citation block retains distinct license labels on one metadata line', () => {
  const ctx = load();
  const base = { ref: 'Genesis 1:1', versionTitle: 'JPS', heVersionTitle: 'Masorah' };
  const credit = (licenses) => writeCredits(ctx, ctx.buildCitationLines({ ...base, ...licenses }, '', true));
  const differ = credit({ license: 'CC-BY-NC', heLicense: 'CC-BY-SA' });
  assert.equal(differ.text.split('\n').length, 2);
  assert.deepEqual(differ.links.map(([label]) => label), ['Translation license: CC-BY-NC', 'Source edition license: CC-BY-SA']);
  const same = credit({ license: 'CC0', heLicense: 'CC0' });
  assert.deepEqual(same.links, [['License: CC0', 'https://creativecommons.org/publicdomain/zero/1.0/']]);
  assert.match(credit({ heLicense: 'CC-BY' }).text, /License: CC-BY$/);
});
