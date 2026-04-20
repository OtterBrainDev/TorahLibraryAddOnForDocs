const test = require('node:test');
const assert = require('node:assert/strict');
const {
  getEnglishAttributionDetails,
  getEnglishAttributionLines,
  getEnglishAttribution,
} = require('../apps-script/attribution.gs');

test('returns empty string when version title is missing', () => {
  assert.equal(getEnglishAttribution({}), '');
  assert.equal(getEnglishAttribution(null), '');
});

test('formats attribution with version and direct source', () => {
  const data = {
    versionTitle: 'JPS 1917',
    versionSource: 'https://example.com/jps-1917',
  };

  assert.equal(
    getEnglishAttribution(data),
    'JPS 1917\nSource: example.com'
  );
});

test('falls back to matching source from versions list', () => {
  const data = {
    versionTitle: 'Steinsaltz',
    versions: [
      { language: 'he', versionTitle: 'Hebrew Base', versionSource: 'https://example.com/he' },
      { language: 'en', versionTitle: 'Steinsaltz', versionSource: 'https://example.com/stein' },
    ],
  };

  assert.equal(
    getEnglishAttribution(data),
    'Steinsaltz\nSource: example.com'
  );
});

test('uses translation-only fallback when no source is available', () => {
  const data = {
    versionTitle: 'No Source Translation',
    versions: [{ language: 'en', versionTitle: 'No Source Translation' }],
  };

  assert.equal(getEnglishAttribution(data), 'No Source Translation');
});

test('includes digitization and license metadata when present', () => {
  const data = {
    versionTitle: 'JPS 1917',
    versionSource: 'https://example.com/jps-1917',
    versionDigitizedBy: 'Sefaria',
    versionLicense: 'CC-BY-NC',
  };

  assert.deepEqual(getEnglishAttributionLines(data), [
    'JPS 1917',
    'Source: example.com',
    'Digitization: Sefaria',
    'License: CC-BY-NC',
  ]);
});

test('returns structured attribution details', () => {
  const data = {
    versionTitle: 'JPS 1917',
    versionSource: 'https://example.com/jps-1917',
  };

  assert.deepEqual(getEnglishAttributionDetails(data), {
    versionTitle: 'JPS 1917',
    source: 'https://example.com/jps-1917',
    sourceDisplay: 'example.com',
    digitization: '',
    license: '',
  });
});
