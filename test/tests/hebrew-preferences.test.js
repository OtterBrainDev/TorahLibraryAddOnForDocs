const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function loadAppsScriptFiles(files, propertyMap = {}) {
  const context = {
    console,
    Logger: { log() {} },
    HtmlService: {},
    DocumentApp: {},
    UrlFetchApp: {},
    Utilities: {},
    PropertiesService: {
      getUserProperties() {
        return {
          getProperty(name) {
            return Object.prototype.hasOwnProperty.call(propertyMap, name) ? propertyMap[name] : null;
          },
        };
      },
    },
  };
  vm.createContext(context);
  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    vm.runInContext(source, context, { filename: file });
  }
  return context;
}

test('applies niqqud and taamim filters only to Hebrew display fields', () => {
  const props = {
    nekudot: 'true',
    nekudot_filter: 'tanakh',
    teamim: 'true',
    teamim_filter: 'tanakh',
  };
  const ctx = loadAppsScriptFiles(['apps-script/server/text-processing.gs'], props);
  const input = {
    type: 'Mishnah',
    he: 'בְּרֵאשִׁ֖ית',
    heRef: 'בְּרֵאשִׁ֖ית א׳:א׳',
    text: 'In the beginning',
  };

  const output = ctx.applyHebrewDisplayPreferences(input, ctx.PropertiesService.getUserProperties());
  assert.equal(output.he, 'בראשית');
  assert.equal(output.heRef, 'בראשית א׳:א׳');
  assert.equal(output.text, 'In the beginning');
  assert.equal(input.he, 'בְּרֵאשִׁ֖ית');
});

test('normalizes legacy teamim filter values and keeps Tanakh text intact when allowed', () => {
  const props = {
    nekudot: 'true',
    nekudot_filter: 'always',
    teamim: 'true',
    teamim_filter: 'torah',
  };
  const ctx = loadAppsScriptFiles(['apps-script/server/text-processing.gs'], props);
  const filters = ctx.normalizeHebrewDisplayFilters_(ctx.PropertiesService.getUserProperties());
  assert.equal(filters.teamimFilter, 'tanakh');

  const input = { type: 'Tanakh', he: 'בְּרֵאשִׁ֖ית' };
  const output = ctx.applyHebrewDisplayPreferences(input, ctx.PropertiesService.getUserProperties());
  assert.equal(output.he, 'בְּרֵאשִׁ֖ית');
});

test('applies Hebrew divine-name replacements after display normalization', () => {
  const props = {
    apply_sheimot_on_insertion: 'true',
    meforash_replace: 'true',
    meforash_replacement: 'יי',
    yaw_replace: 'false',
    elodim_replace: 'false',
  };
  const ctx = loadAppsScriptFiles(['apps-script/server/text-processing.gs'], props);
  const input = { he: 'יְהֹוָה', heRef: 'יְהֹוָה א׳' };
  const output = ctx.applyHebrewDivineNamePreferences(input, ctx.PropertiesService.getUserProperties());
  assert.equal(output.he, 'יי');
  assert.equal(output.heRef, 'יי א׳');
});

test('unified applyDivineNameReplacements handles both languages in one pass', () => {
  const props = {
    apply_sheimot_on_insertion: 'true',
    meforash_replace: 'true',
    meforash_replacement: 'יי',
    god_replace: 'true',
    god_replacement: 'G-d',
  };
  const ctx = loadAppsScriptFiles(['apps-script/server/text-processing.gs'], props);
  const input = {
    he: 'יְהֹוָה',
    heRef: 'יְהֹוָה א׳',
    text: 'Blessed is God in His glory',
  };
  const output = ctx.applyDivineNameReplacements(input, ctx.PropertiesService.getUserProperties());
  assert.equal(output.he, 'יי');
  assert.equal(output.heRef, 'יי א׳');
  assert.equal(output.text, 'Blessed is G-d in His glory');
  // Input was not mutated (clone contract).
  assert.equal(input.he, 'יְהֹוָה');
});

test('applyEnglishDivineNamePreference wrapper still mutates in place', () => {
  const props = {
    apply_sheimot_on_insertion: 'true',
    god_replace: 'true',
    god_replacement: 'G-d',
  };
  const ctx = loadAppsScriptFiles(['apps-script/server/text-processing.gs'], props);
  const input = { text: 'God said: let there be light' };
  ctx.applyEnglishDivineNamePreference(input, ctx.PropertiesService.getUserProperties());
  assert.equal(input.text, 'G-d said: let there be light');
});

test('divine-name replacements are gated by apply_sheimot_on_insertion', () => {
  const props = {
    apply_sheimot_on_insertion: 'false',
    meforash_replace: 'true',
    meforash_replacement: 'יי',
    god_replace: 'true',
    god_replacement: 'G-d',
  };
  const ctx = loadAppsScriptFiles(['apps-script/server/text-processing.gs'], props);
  const input = { he: 'יְהֹוָה', text: 'God' };
  const output = ctx.applyDivineNameReplacements(input, ctx.PropertiesService.getUserProperties());
  assert.equal(output.he, 'יְהֹוָה');
  assert.equal(output.text, 'God');
});

test('transliteration honors explicit override maps during insertion path', () => {
  const ctx = loadAppsScriptFiles(['apps-script/transliteration.gs'], {});
  const text = 'חַג';
  const output = ctx.transliterateHebrewText(text, 'simple_english', {
    keepNiqqud: true,
    isBiblicalHebrew: false,
    dageshMode: 'none',
    overrideMap: { 'ח': 'ch' },
  });
  assert.equal(output, 'chag');
});


test('builds search-wrapper payload from new search configuration object', () => {
  const ctx = loadAppsScriptFiles(['apps-script/server/search.gs'], {});
  const payload = ctx.buildSearchWrapperPayload_('pirkei avot', {
    filters: ['Mishnah', 'Musar'],
    relevanceSort: true,
    translationOnly: true,
  });

  assert.deepEqual(payload.filters, ['Mishnah', 'Musar']);
  assert.deepEqual(Array.from(payload.filter_fields), ['path', 'path']);
  assert.equal(payload.query, 'pirkei avot');
  assert.deepEqual(Array.from(payload.sort_fields), ['pagesheetrank']);
  assert.equal(payload.sort_method, 'score');
});
