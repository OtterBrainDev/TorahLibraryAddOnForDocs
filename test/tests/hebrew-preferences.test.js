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
  const ctx = loadAppsScriptFiles(['apps-script/Code.gs'], props);
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
  const ctx = loadAppsScriptFiles(['apps-script/Code.gs'], props);
  const filters = ctx.normalizeHebrewDisplayFilters_(ctx.PropertiesService.getUserProperties());
  assert.equal(filters.teamimFilter, 'tanakh');

  const input = { type: 'Tanakh', he: 'בְּרֵאשִׁ֖ית' };
  const output = ctx.applyHebrewDisplayPreferences(input, ctx.PropertiesService.getUserProperties());
  assert.equal(output.he, 'בְּרֵאשִׁ֖ית');
});

test('applies Hebrew divine-name replacements after display normalization', () => {
  const props = {
    meforash_replace: 'true',
    meforash_replacement: 'יי',
    yaw_replace: 'false',
    elodim_replace: 'false',
  };
  const ctx = loadAppsScriptFiles(['apps-script/Code.gs'], props);
  const input = { he: 'יְהֹוָה', heRef: 'יְהֹוָה א׳' };
  const output = ctx.applyHebrewDivineNamePreferences(input, ctx.PropertiesService.getUserProperties());
  assert.equal(output.he, 'יי');
  assert.equal(output.heRef, 'יי א׳');
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
  const ctx = loadAppsScriptFiles(['apps-script/Code.gs'], {});
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
