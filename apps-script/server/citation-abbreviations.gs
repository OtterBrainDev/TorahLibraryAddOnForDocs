// Traditional citation abbreviations -> the title forms Sefaria actually indexes.
//
// Why this exists: people cite Rambam as "Hil. Shabbat 1:1", but Sefaria indexes
// that section as "Mishneh Torah, Hilchot Shabbat" (with "Rambam, Hilchot
// Shabbat" as a registered alternate). The literal string a reader types
// resolves to nothing, and the failure looks like "Sefaria doesn't have it"
// rather than "we didn't recognise the abbreviation". Sefaria registers the
// `Hilchot X` form for 81 Mishneh Torah sections, so this one expansion covers a
// large, well-defined slice of the library.
//
// THE RULE THAT KEEPS THIS HONEST: an expansion may only ADD words, never drop
// them. "Hil. Avodah Zarah" must not become "Avodah Zarah", because that IS a
// real Sefaria title — the Talmud tractate — so dropping the word would resolve
// confidently to the wrong work. Guessing wrong is worse than finding nothing;
// queries we cannot expand safely fall through to the suggestion path instead.
//
// Pure functions, no Apps Script services, so they are unit-testable in Node.
// See test/tests/citation-abbreviations.test.js.

// Spellings of "Hilchot" seen in the wild, mapped to the one Sefaria indexes.
// Sefaria uses "Hilchot" exclusively (0 occurrences of "Hilkhot" in its title
// map), so every variant collapses to that.
var HILCHOT_ABBREVIATIONS_ = [
  'hil', 'hil.', 'hilc', 'hilch', 'hilch.', 'hilchos', 'hilchot',
  'hilkhot', 'hilkhos', 'hilchoth', 'hilchote'
];

// Works whose sections Sefaria registers under a "<work>, Hilchot X" title.
var HILCHOT_PARENT_WORKS_ = ['Mishneh Torah', 'Rambam'];

/**
 * Additional reference strings worth trying for a citation the user typed.
 * Never includes the input itself, and never returns a candidate with fewer
 * meaningful words than the input.
 *
 * @param {string} reference
 * @returns {Array<string>} candidates, most specific first, deduped
 */
function expandCitationAbbreviations_(reference) {
  var input = String(reference || '').trim();
  if (!input) {
    return [];
  }

  var candidates = [];
  var seen = Object.create(null);
  seen[input.toLowerCase()] = true;

  function offer(candidate) {
    var value = String(candidate || '').replace(/\s+/g, ' ').trim();
    if (!value) return;
    var key = value.toLowerCase();
    if (seen[key]) return;
    seen[key] = true;
    candidates.push(value);
  }

  // Split off a leading "<work>, " so "Rambam, Hil. Shabbat 1:1" is handled the
  // same way as "Hil. Shabbat 1:1".
  var prefix = '';
  var body = input;
  var commaIndex = input.indexOf(',');
  if (commaIndex > 0) {
    prefix = input.slice(0, commaIndex).trim();
    body = input.slice(commaIndex + 1).trim();
  }

  var firstSpace = body.search(/\s/);
  if (firstSpace < 0) {
    return candidates;
  }

  var firstWord = body.slice(0, firstSpace);
  var remainder = body.slice(firstSpace + 1).trim();
  if (!remainder) {
    return candidates;
  }

  if (HILCHOT_ABBREVIATIONS_.indexOf(firstWord.toLowerCase()) < 0) {
    return candidates;
  }

  var canonical = 'Hilchot ' + remainder;

  if (prefix) {
    // The user already named a work; just canonicalize the abbreviation.
    offer(prefix + ', ' + canonical);
    return candidates;
  }

  // No work named. Offer the bare form first (it may itself be a registered
  // alternate title), then each parent work that indexes "Hilchot X" sections.
  offer(canonical);
  for (var i = 0; i < HILCHOT_PARENT_WORKS_.length; i++) {
    offer(HILCHOT_PARENT_WORKS_[i] + ', ' + canonical);
  }

  return candidates;
}

/**
 * Client-facing counterpart used for suggestion matching: collapse a leading
 * Hilchot abbreviation to the canonical spelling, in place, without adding a
 * work prefix. Used where we want to COMPARE against title tokens rather than
 * resolve a reference.
 */
function canonicalizeCitationAbbreviations_(reference) {
  var input = String(reference || '').trim();
  if (!input) return '';

  return input.replace(/(^|,\s*)([A-Za-z.]+)(\s+)/, function (match, boundary, word, space) {
    if (HILCHOT_ABBREVIATIONS_.indexOf(word.toLowerCase()) < 0) {
      return match;
    }
    return boundary + 'Hilchot' + space;
  });
}
