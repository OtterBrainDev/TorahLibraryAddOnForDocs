// Pins the traditional-citation expansion (server/citation-abbreviations.gs).
//
// Readers cite Rambam as "Hil. Shabbat 1:1"; Sefaria indexes that section as
// "Mishneh Torah, Hilchot Shabbat" (with "Rambam, Hilchot Shabbat" registered
// as an alternate). Sefaria carries the `Hilchot X` form for 81 Mishneh Torah
// sections, so this one expansion covers a large, well-defined slice.
//
// The invariant these tests exist to protect: an expansion may only ADD words,
// never drop them. "Hil. Avodah Zarah" must never become "Avodah Zarah",
// because that IS a real Sefaria title — the Talmud tractate — so dropping the
// word would resolve confidently to the wrong work. A wrong answer delivered
// with confidence is worse than no answer.
//
// Loaded with vm.runInContext; .gs is not a Node module format.
// See AGENTS.md hard rule #3.

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, '../../apps-script/server/citation-abbreviations.gs'),
  'utf8'
);

function load() {
  const context = { console };
  vm.createContext(context);
  vm.runInContext(SOURCE, context, { filename: 'citation-abbreviations.gs' });
  return context;
}

test('expands a bare Hilchot abbreviation into the forms Sefaria indexes', () => {
  const { expandCitationAbbreviations_ } = load();

  const out = Array.from(expandCitationAbbreviations_('Hil. Shabbat 1:1'));

  assert.deepEqual(out, [
    'Hilchot Shabbat 1:1',
    'Mishneh Torah, Hilchot Shabbat 1:1',
    'Rambam, Hilchot Shabbat 1:1',
  ]);
});

test('accepts the spelling variants people actually type', () => {
  const { expandCitationAbbreviations_ } = load();

  ['Hil. Shabbat 1:1', 'Hil Shabbat 1:1', 'Hilchos Shabbat 1:1', 'Hilkhot Shabbat 1:1']
    .forEach((input) => {
      const out = Array.from(expandCitationAbbreviations_(input));
      assert.ok(
        out.includes('Mishneh Torah, Hilchot Shabbat 1:1'),
        `${input} did not expand: ${JSON.stringify(out)}`
      );
    });
});

test('only canonicalizes when the reader already named the work', () => {
  const { expandCitationAbbreviations_ } = load();

  // No point offering "Mishneh Torah, ..." when they said "Rambam, ...".
  assert.deepEqual(
    Array.from(expandCitationAbbreviations_('Rambam, Hil. Teshuvah 3:4')),
    ['Rambam, Hilchot Teshuvah 3:4']
  );
  assert.deepEqual(
    Array.from(expandCitationAbbreviations_('Mishneh Torah, Hil. Shabbat 1:1')),
    ['Mishneh Torah, Hilchot Shabbat 1:1']
  );
});

test('never drops a word from the query', () => {
  const { expandCitationAbbreviations_ } = load();

  // The load-bearing case. "Avodah Zarah" alone is the Talmud tractate; Sefaria
  // files the Rambam section under "Hilchot Avodah Kochavim". Silently
  // rewriting the query to the tractate would be a confident wrong answer, so
  // every candidate must still contain every word the reader typed.
  const out = Array.from(expandCitationAbbreviations_('Hil. Avodah Zarah 12:11'));

  assert.ok(out.length > 0, 'expected candidates');
  out.forEach((candidate) => {
    assert.ok(/avodah/i.test(candidate), `dropped "Avodah": ${candidate}`);
    assert.ok(/zarah/i.test(candidate), `dropped "Zarah": ${candidate}`);
    assert.ok(/12:11/.test(candidate), `dropped the section: ${candidate}`);
  });
  assert.ok(
    !out.some((c) => c.toLowerCase() === 'avodah zarah 12:11'),
    'expanded to the Talmud tractate — that is the wrong work'
  );
});

test('leaves ordinary references untouched', () => {
  const { expandCitationAbbreviations_ } = load();

  assert.deepEqual(Array.from(expandCitationAbbreviations_('Genesis 1:1')), []);
  assert.deepEqual(Array.from(expandCitationAbbreviations_('Berakhot 2a')), []);
  assert.deepEqual(Array.from(expandCitationAbbreviations_('בראשית א׳:א׳')), []);
});

test('handles degenerate input without throwing', () => {
  const { expandCitationAbbreviations_ } = load();

  // An abbreviation with nothing after it has no expansion to offer.
  assert.deepEqual(Array.from(expandCitationAbbreviations_('Hil.')), []);
  assert.deepEqual(Array.from(expandCitationAbbreviations_('')), []);
  assert.deepEqual(Array.from(expandCitationAbbreviations_(null)), []);
  assert.deepEqual(Array.from(expandCitationAbbreviations_(undefined)), []);
});

test('canonicalizeCitationAbbreviations_ normalizes spelling without adding a work', () => {
  const { canonicalizeCitationAbbreviations_ } = load();

  assert.equal(canonicalizeCitationAbbreviations_('Hil. Avodah Zarah 12:11'), 'Hilchot Avodah Zarah 12:11');
  assert.equal(canonicalizeCitationAbbreviations_('Hilchos Shabbat 1:1'), 'Hilchot Shabbat 1:1');
  assert.equal(canonicalizeCitationAbbreviations_('Genesis 1:1'), 'Genesis 1:1');
  assert.equal(canonicalizeCitationAbbreviations_(''), '');
});
