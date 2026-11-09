// Pins the composition card's Hebrew sample: Vowels and Cantillation are
// separate filters, so the card shows one sample for each of their four
// combinations, and each sample is exactly what the insert's filter
// (applyHebrewTextDisplayPreferences, server/text-processing.gs) makes of the
// full text.
//
// The card had three samples: with Vowels off it always showed the bare
// letters, so Cantillation On looked the same as Off and the switch seemed
// to do nothing, though the insert kept the cantillation.

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

const ROOT = path.resolve(__dirname, '..', '..');
const read = (file) => fs.readFileSync(path.join(ROOT, 'apps-script', file), 'utf8');
const MARKUP = read('shared/composition-card/markup.html');
const CARD = read('shared/composition-card/shared.html');

function sample(variant) {
  const m = MARKUP.match(new RegExp(`<span class="cc-hebrew-text cc-hebrew-text--${variant}"[^>]*>([^<]*)</span>`));
  assert.ok(m, `the card has a ${variant} sample`);
  return m[1];
}

function insertFilter(text, vowelsOn, cantillationOn) {
  const context = {};
  vm.createContext(context);
  vm.runInContext(read('server/text-processing.gs'), context);
  return context.applyHebrewTextDisplayPreferences(text, 'Tanakh', {
    nekudotEnabled: vowelsOn,
    nekudotFilter: 'always',
    teamimEnabled: cantillationOn,
    teamimFilter: 'available',
    isTorah: true
  });
}

// The `hidden` expression updateCompositionCard gives each sample.
function hiddenWhen(variant) {
  const m = CARD.match(new RegExp(`\\$\\('\\.cc-hebrew-text--${variant}'\\)\\.prop\\('hidden', (.+)\\);`));
  assert.ok(m, `updateCompositionCard sets the ${variant} sample's visibility`);
  return (state) => vm.runInNewContext(m[1], { state });
}

const VARIANTS = {
  full: [true, true],
  'no-cantillation': [true, false],
  'cantillation-only': [false, true],
  consonants: [false, false],
};

test('each sample is what the insert makes of the full text', () => {
  const full = sample('full');
  Object.entries(VARIANTS).forEach(([variant, [vowelsOn, cantillationOn]]) => {
    assert.equal(sample(variant), insertFilter(full, vowelsOn, cantillationOn), variant);
  });
});

test('every combination of Vowels and Cantillation shows exactly its own sample', () => {
  Object.entries(VARIANTS).forEach(([expected, [vowelsOn, cantillationOn]]) => {
    const state = { vowelsOn, cantillationOn };
    const shown = Object.keys(VARIANTS).filter((variant) => !hiddenWhen(variant)(state));
    assert.deepEqual(shown, [expected], `Vowels ${vowelsOn ? 'on' : 'off'}, Cantillation ${cantillationOn ? 'on' : 'off'}`);
  });
});
