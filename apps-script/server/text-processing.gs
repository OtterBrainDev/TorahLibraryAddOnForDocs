// Pure text transformations applied before insertion: Hebrew display
// filtering (niqqud / teamim), divine-name replacement, line-marker
// formatting. Every function here should be deterministic and testable
// without DocumentApp.

function normalizeHebrewDisplayFilters_(userProperties) {
  const nekudotEnabled = userProperties.getProperty("nekudot") != "false";
  const rawNekudotFilter = String(userProperties.getProperty("nekudot_filter") || "always").toLowerCase();
  const nekudotFilter = (rawNekudotFilter === "tanakh" || rawNekudotFilter === "never") ? rawNekudotFilter : "always";

  // Cantillation: "available" (wherever Sefaria has it), "tanakh" (Tanakh
  // only) or "torah" (the Five Books only). A "torah" stored before it meant
  // anything of its own read as "tanakh"; schema v24 rewrote it to that.
  const teamimEnabled = userProperties.getProperty("teamim") != "false";
  const rawTeamimFilter = String(userProperties.getProperty("teamim_filter") || "available").toLowerCase();
  const teamimFilter = (rawTeamimFilter === "tanakh" || rawTeamimFilter === "torah") ? rawTeamimFilter : (rawTeamimFilter === "never" ? "never" : "available");

  return {
    nekudotEnabled,
    nekudotFilter,
    teamimEnabled,
    teamimFilter
  };
}

var TORAH_BOOKS_ = ['Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy'];

/**
 * True for a text from the Five Books: Sefaria files them under
 * categories ["Tanakh", "Torah"]; the book name is the fallback.
 */
function isTorahText_(data) {
  if (!data) return false;
  const categories = Array.isArray(data.categories) ? data.categories : [];
  if (categories[0] === 'Tanakh' && categories[1] === 'Torah') return true;
  return TORAH_BOOKS_.indexOf(String(data.book || data.indexTitle || '')) >= 0;
}

/**
 * @param {string} context  the text's category (data.type), e.g. "Tanakh"
 * @param {Object} filters  normalizeHebrewDisplayFilters_; filters.isTorah
 *        says whether the text is one of the Five Books (isTorahText_)
 */
function applyHebrewTextDisplayPreferences(value, context, filters) {
  if (Array.isArray(value)) {
    return value.map(function(item) {
      return applyHebrewTextDisplayPreferences(item, context, filters);
    });
  }
  if (value === null || value === undefined || typeof value !== 'string') {
    return value;
  }

  let output = value;
  const shouldStripNekudot = !filters.nekudotEnabled || (filters.nekudotFilter === 'tanakh' && context !== 'Tanakh');
  const shouldStripTeamim = !filters.teamimEnabled ||
    (filters.teamimFilter === 'tanakh' && context !== 'Tanakh') ||
    (filters.teamimFilter === 'torah' && !filters.isTorah);

  if (shouldStripTeamim) {
    output = output.replace(/[֑-֯]/g, '');
  }
  if (shouldStripNekudot) {
    output = output.replace(/[ְ-ֽ]/g, '');
    // Rafe, shin/sin dots, upper/lower dots and qamats qatan. Not the whole
    // U+05BF-U+05C7 range: paseq (U+05C0), sof pasuq (U+05C3) and nun hafukha
    // (U+05C6) sit inside it but are punctuation, not vowels.
    output = output.replace(/[\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7]/g, '');
  }

  return output;
}

function applyHebrewDisplayPreferences(data, userProperties) {
  if (!data || typeof data !== 'object') {
    return data;
  }

  const filters = normalizeHebrewDisplayFilters_(userProperties);
  filters.isTorah = isTorahText_(data);
  const context = data.type || '';
  const clone = JSON.parse(JSON.stringify(data));

  ['he', 'heRef'].forEach(function(field) {
    if (Object.prototype.hasOwnProperty.call(clone, field)) {
      clone[field] = applyHebrewTextDisplayPreferences(clone[field], context, filters);
    }
  });

  return clone;
}

/**
 * Copies the fetched Hebrew to `heTransliterationSource`, before the vowel and
 * cantillation filters strip it, with the Hebrew punctuation setting and the
 * Hebrew divine-name substitutes applied. The transliteration is read from it,
 * so it follows the vowels Sefaria has whatever the Hebrew shows, and drops
 * the punctuation the Hebrew drops. Same shape as `he` (a string, or arrays
 * of segments).
 */
function attachTransliterationSource_(data, userProperties) {
  if (!data || typeof data !== 'object' || data.he === undefined) return data;
  // Punctuation before the divine names, as for the Hebrew, so a substitute
  // (ה') is never stripped.
  const punctuated = applyPunctuationPreferences({ he: data.he }, userProperties);
  const named = applyDivineNameReplacements({ he: punctuated.he }, userProperties, { hebrew: true, english: false });
  return Object.assign({}, data, { heTransliterationSource: named.he });
}

/** The Hebrew a transliteration is read from: the fetched source, else `he`. */
function transliterationSourceOf_(data) {
  if (!data) return undefined;
  return data.heTransliterationSource !== undefined ? data.heTransliterationSource : data.he;
}

// The marks that belong to a Hebrew letter: cantillation (U+0591-U+05AF) and
// niqqud. Not maqaf (U+05BE), paseq (U+05C0), sof pasuq (U+05C3) or nun
// hafukha (U+05C6): those are punctuation, and a name followed by one keeps it.
const HEBREW_LETTER_MARKS_ = '\\u0591-\\u05BD\\u05BF\\u05C1\\u05C2\\u05C4\\u05C5\\u05C7';
const HEBREW_LETTER_RE_ = /[\u05D0-\u05EA]/;
const HEBREW_TEAMIM_RE_ = /[\u0591-\u05AF]/;
const HEBREW_NIQQUD_RE_ = /[\u05B0-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7]/;
// Dagesh / mapiq, rafe and the shin and sin dots say something about the
// letter they sit on, so they move only onto the same letter.
const HEBREW_LETTER_SPECIFIC_MARK_RE_ = /[\u05BC\u05BF\u05C1\u05C2]/;
const HEBREW_HOLAM_ = '\u05B9';
// Where a substitute's letters take their vowels from, by the name's letters,
// when the two are not spelled alike: יי is printed יְיָ, the vowels of
// the Name's first and third letters (יְהוָה, and יֱיִ for יֱהֹוִה).
const DIVINE_NAME_VOWEL_SOURCES_ = { 'יי': { letters: 4, from: [0, 2] } };

/** A Hebrew word as [{letter, marks}], marks in their order. */
function hebrewLetterClusters_(word) {
  const clusters = [];
  Array.from(String(word || '')).forEach(function (ch) {
    if (HEBREW_LETTER_RE_.test(ch)) clusters.push({ letter: ch, marks: [] });
    else if (clusters.length && (HEBREW_TEAMIM_RE_.test(ch) || HEBREW_NIQQUD_RE_.test(ch))) clusters[clusters.length - 1].marks.push(ch);
  });
  return clusters;
}

/**
 * For each letter of `to`, the index of the letter of `from` it stands for,
 * or -1. Letters line up in order, none of `from` left out, as many alike as
 * possible (אלהים -> אלוקים: the ו is new, the ה became ק). Null when that
 * is not a respelling of the name but another word (השם, ה'), whose vowels
 * would mean nothing on it.
 */
function alignDivineNameLetters_(from, to) {
  const known = DIVINE_NAME_VOWEL_SOURCES_[to.join('')];
  if (known && known.letters === from.length) return known.from.slice();
  const n = from.length;
  const m = to.length;
  if (!n || m < n) return null;
  // best[i][j]: most letters alike placing the first i of `from` among the
  // first j of `to`.
  const NONE = -1;
  const best = [];
  for (let i = 0; i <= n; i++) {
    best.push([]);
    for (let j = 0; j <= m; j++) {
      if (i === 0) best[i][j] = 0;
      else if (j < i) best[i][j] = NONE;
      else best[i][j] = Math.max(best[i][j - 1], best[i - 1][j - 1] + (from[i - 1] === to[j - 1] ? 1 : 0));
    }
  }
  if (best[n][m] * 2 < n) return null;
  // From the end, placing a letter as late as it can go: the new letters of a
  // longer spelling come before the changed one (אלוקים, not אלקוים).
  const source = new Array(m).fill(-1);
  for (let i = n, j = m; i > 0; j--) {
    if (best[i - 1][j - 1] !== NONE && best[i][j] === best[i - 1][j - 1] + (from[i - 1] === to[j - 1] ? 1 : 0)) {
      source[j - 1] = i - 1;
      i--;
    }
  }
  return source;
}

/**
 * The substitute for one occurrence of a divine name, carrying that
 * occurrence's vowels and cantillation (a substitute was inserted bare, so a
 * pointed verse lost both on the Name). The substitute's letters take the
 * vowels of the letters they stand for (alignDivineNameLetters_): יְהוָה ->
 * יְיָ, יְקוָק; אֱלֹהִים -> אֱלוֹקִים; יָהּ -> קָהּ. A substitute that is
 * another word (השם, ה') takes no vowels, but keeps the cantillation, on the
 * letter in the same place (ה֥'). Marks already typed into a substitute win:
 * pointed, it takes no vowels; with cantillation, none is added. Only marks
 * the name has are carried, so whatever the display filters stripped stays
 * stripped.
 */
function markDivineNameSubstitute_(name, substitute) {
  const literal = String(substitute == null ? '' : substitute);
  const from = hebrewLetterClusters_(name);
  const chars = Array.from(literal);
  const letterAt = [];
  chars.forEach(function (ch, k) { if (HEBREW_LETTER_RE_.test(ch)) letterAt.push(k); });
  const n = from.length;
  const m = letterAt.length;
  if (!n || !m || !from.some(function (c) { return c.marks.length; })) return literal;

  const typedNiqqud = chars.some(function (ch) { return HEBREW_NIQQUD_RE_.test(ch); });
  const typedTeamim = chars.some(function (ch) { return HEBREW_TEAMIM_RE_.test(ch); });
  const to = letterAt.map(function (k) { return chars[k]; });
  const source = alignDivineNameLetters_(from.map(function (c) { return c.letter; }), to);
  const added = to.map(function () { return []; });

  if (source && !typedNiqqud) {
    source.forEach(function (i, j) {
      if (i < 0) return;
      from[i].marks.forEach(function (mark) {
        if (!HEBREW_NIQQUD_RE_.test(mark)) return;
        if (HEBREW_LETTER_SPECIFIC_MARK_RE_.test(mark) && from[i].letter !== to[j]) return;
        added[j].push(mark);
      });
    });
    // A new ו after a holam is the holam's own letter: אֱלֹהִים -> אֱלוֹקִים.
    for (let j = 1; j < m; j++) {
      const holam = added[j - 1].indexOf(HEBREW_HOLAM_);
      if (source[j] < 0 && to[j] === 'ו' && holam >= 0) {
        added[j - 1].splice(holam, 1);
        added[j].push(HEBREW_HOLAM_);
      }
    }
  }

  if (!typedTeamim) {
    from.forEach(function (cluster, i) {
      const teamim = cluster.marks.filter(function (mark) { return HEBREW_TEAMIM_RE_.test(mark); });
      if (!teamim.length) return;
      let j = source ? source.indexOf(i) : -1;
      if (j < 0) j = (i === n - 1) ? m - 1 : Math.floor(i * m / n);
      Array.prototype.push.apply(added[j], teamim);
    });
  }

  const out = chars.slice();
  added.forEach(function (marks, j) {
    if (!marks.length) return;
    // After the letter's own marks, if the substitute has any.
    let k = letterAt[j];
    while (k + 1 < chars.length && (HEBREW_TEAMIM_RE_.test(chars[k + 1]) || HEBREW_NIQQUD_RE_.test(chars[k + 1]))) k++;
    out[k] += marks.join('');
  });
  return out.join('');
}

/**
 * Config-driven union of the Hebrew and English divine-name replacement passes.
 * One gate (`apply_sheimot_on_insertion`) covers both. Each rule names the
 * preference that enables it, the preference (or literal) that holds the
 * substitute, the regex pattern, and the data fields it should sweep over.
 * Returns a cloned `data` with all enabled replacements applied. Callers that
 * only want one language can pass `{ hebrew: true, english: false }` (or vice
 * versa) in `options`; default is both.
 */
function applyDivineNameReplacements(data, userProperties, options) {
  if (!data || typeof data !== 'object') return data;
  if (userProperties.getProperty("apply_sheimot_on_insertion") != "true") return data;

  const includeHebrew = !options || options.hebrew !== false;
  const includeEnglish = !options || options.english !== false;

  const allRules = [];
  if (includeHebrew) {
    allRules.push({ enabledBy: "meforash_replace", pattern: new RegExp(`י[${HEBREW_LETTER_MARKS_}]*ה[${HEBREW_LETTER_MARKS_}]*ו[${HEBREW_LETTER_MARKS_}]*ה[${HEBREW_LETTER_MARKS_}]*`, "g"), replacementKey: "meforash_replacement", requireReplacement: true, fields: ["he", "heRef"] });
    // יה only as a whole word. Without the boundaries it matched the start of
    // יהודה, יהושע and friends (יהודה -> קהודה). A word here is Hebrew letters
    // plus their vowel and cantillation marks; maqaf, paseq and sof pasuq end
    // one, so הללו־יה still matches. The 4-letter names above and below stay
    // unbounded on purpose: their prefixed forms (לַיהוָה, וֵאלֹהִים) are
    // common and should be replaced too.
    allRules.push({ enabledBy: "yaw_replace",      pattern: /(^|[^\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7\u05D0-\u05EA])(י[\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7]*ה[\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7]*)(?![\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7\u05D0-\u05EA])/g, keepPrefixGroup: true, replacementKey: "yaw_replacement", requireReplacement: false, fields: ["he", "heRef"] });
    // The ו is optional: the Bible spells it אֱלֹהִים, and Transform Divine
    // Names already matched both spellings.
    allRules.push({ enabledBy: "elodim_replace",   pattern: new RegExp(`א[${HEBREW_LETTER_MARKS_}]*ל[${HEBREW_LETTER_MARKS_}]*(?:ו[${HEBREW_LETTER_MARKS_}]*)?ה[${HEBREW_LETTER_MARKS_}]*י[${HEBREW_LETTER_MARKS_}]*ם[${HEBREW_LETTER_MARKS_}]*`, "g"), replacementKey: "elodim_replacement",   requireReplacement: false, fields: ["he", "heRef"] });
  }
  if (includeEnglish) {
    allRules.push({ enabledBy: "god_replace", pattern: /\bGod\b/g, replacementKey: "god_replacement", defaultReplacement: "G-d", requireReplacement: false, fields: ["text"] });
  }

  const activeRules = [];
  for (const rule of allRules) {
    if (userProperties.getProperty(rule.enabledBy) != "true") continue;
    const replacement = userProperties.getProperty(rule.replacementKey);
    if (rule.requireReplacement && !replacement) continue;
    // A function, not a string: String.replace expands `$&`, `$1` and friends
    // in a replacement string, and this one is user-entered text.
    const literal = replacement || rule.defaultReplacement || "";
    activeRules.push({
      pattern: rule.pattern,
      // Each occurrence keeps its own vowels and cantillation
      // (markDivineNameSubstitute_); "God" has neither.
      replacement: rule.keepPrefixGroup
        ? function (match, prefix, name) { return prefix + markDivineNameSubstitute_(name, literal); }
        : function (match) { return markDivineNameSubstitute_(match, literal); },
      fields: rule.fields,
    });
  }
  if (!activeRules.length) return data;

  const sweep = (node, rules) => {
    if (Array.isArray(node)) return node.map((value) => sweep(value, rules));
    if (typeof node === 'string') {
      return rules.reduce((current, rule) => current.replace(rule.pattern, rule.replacement), node);
    }
    return node;
  };

  const rulesByField = {};
  for (const rule of activeRules) {
    for (const field of rule.fields) {
      (rulesByField[field] = rulesByField[field] || []).push(rule);
    }
  }

  const clone = JSON.parse(JSON.stringify(data));
  for (const field of Object.keys(rulesByField)) {
    if (Object.prototype.hasOwnProperty.call(clone, field)) {
      clone[field] = sweep(clone[field], rulesByField[field]);
    }
  }
  return clone;
}

/**
 * Legacy Hebrew-only wrapper. Retained for the Node unit tests; new server
 * code should call `applyDivineNameReplacements` directly.
 */
function applyHebrewDivineNamePreferences(data, userProperties) {
  return applyDivineNameReplacements(data, userProperties, { hebrew: true, english: false });
}

/**
 * Legacy English-only wrapper. Mutates `data.text` in place to preserve the
 * pre-refactor call-site contract (`apply...(data, userProperties)` with no
 * return-value usage).
 */
function applyEnglishDivineNamePreference(data, userProperties) {
  if (!data) return;
  const replaced = applyDivineNameReplacements(data, userProperties, { hebrew: false, english: true });
  if (replaced !== data && Object.prototype.hasOwnProperty.call(replaced, 'text')) {
    data.text = replaced.text;
  }
}

// Punctuation kept even with punctuation off: symbols a reader relies on
// (percent, footnote asterisk, section and paragraph signs, daggers).
const PUNCTUATION_ALWAYS_KEPT_ = '%#@&*§¶†‡';
const PUNCTUATION_SPLIT_RE_ = /(<[^>]*>|&[#\w]+;)/;
const PUNCTUATION_TAG_OR_ENTITY_RE_ = /^(?:<[^>]*>|&[#\w]+;)$/;
const PUNCTUATION_CHAR_RE_ = /\p{P}/u;
const PUNCTUATION_LETTER_RE_ = /\p{L}/u;
const PUNCTUATION_HEBREW_LETTER_RE_ = /[א-ת]/;
const PUNCTUATION_LATIN_LETTER_RE_ = /[A-Za-zÀ-ɏ]/;
const PUNCTUATION_WORD_RE_ = /[\p{L}\p{N}\p{M}]/u;

/** The base character before index `i`, skipping combining marks (niqqud). */
function punctuationBaseBefore_(chars, i) {
  for (let j = i - 1; j >= 0; j--) {
    if (!/\p{M}/u.test(chars[j])) return chars[j];
  }
  return '';
}

/** Whether the punctuation mark at `i` carries meaning inside a word or number. */
function isPunctuationKeptInContext_(chars, i) {
  const ch = chars[i];
  const before = punctuationBaseBefore_(chars, i);
  const after = chars[i + 1] || '';
  const letterBefore = PUNCTUATION_LETTER_RE_.test(before);
  const letterAfter = PUNCTUATION_LETTER_RE_.test(after);
  // ר' (abbreviation) and don't (contraction).
  if (ch === "'" || ch === '’' || ch === '׳') {
    return letterBefore && (letterAfter || PUNCTUATION_HEBREW_LETTER_RE_.test(before));
  }
  // רש"י
  if (ch === '"' || ch === '״') {
    return letterBefore && letterAfter;
  }
  // G-d
  if (ch === '-') {
    return PUNCTUATION_LATIN_LETTER_RE_.test(before) && PUNCTUATION_LATIN_LETTER_RE_.test(after);
  }
  // 3:16, 1,000, 2.5
  if (ch === '.' || ch === ',' || ch === ':') {
    return /\d/.test(before) && /\d/.test(after);
  }
  return false;
}

/** Strips punctuation from one run of plain text (no tags, no entities). */
function stripPunctuationFromTextSegment_(segment) {
  const chars = Array.from(segment.replace(/\{[פס]\}/g, ''));
  const removed = chars.map(function(ch, i) {
    return PUNCTUATION_CHAR_RE_.test(ch) &&
      PUNCTUATION_ALWAYS_KEPT_.indexOf(ch) < 0 &&
      !isPunctuationKeptInContext_(chars, i);
  });
  let out = '';
  let i = 0;
  while (i < chars.length) {
    if (!removed[i]) {
      out += chars[i];
      i++;
      continue;
    }
    // A run of removed marks ("3:16)—all"): if it joined two words, a space
    // takes its place, so the maqaf in כָל־הָעָם becomes a word break.
    let end = i;
    while (end < chars.length && removed[end]) end++;
    const before = chars[i - 1] || '';
    const after = chars[end] || '';
    if (PUNCTUATION_WORD_RE_.test(before) && PUNCTUATION_WORD_RE_.test(after)) {
      out += ' ';
    }
    i = end;
  }
  return out;
}

/**
 * Removes punctuation from Sefaria text for the "Punctuation: Off" settings.
 * Tags and entities are left alone (insertRichTextFromHTML relies on the
 * tags), as are marks that belong to a word or number: ר', רש"י, don't, G-d,
 * 3:16, 1,000, and the symbols in PUNCTUATION_ALWAYS_KEPT_.
 */
function stripPunctuationFromText(value) {
  if (typeof value !== 'string' || !value) return value;
  const parts = value.split(PUNCTUATION_SPLIT_RE_);
  let out = parts.map(function(part) {
    return PUNCTUATION_TAG_OR_ENTITY_RE_.test(part) ? part : stripPunctuationFromTextSegment_(part);
  }).join('');
  out = out
    .replace(/ {2,}/g, ' ')
    .replace(/ ((?:<[^>]*>)+) /g, ' $1')
    .replace(/ +\n/g, '\n');
  if (!/^ /.test(value)) out = out.replace(/^ +/, '');
  if (!/ $/.test(value)) out = out.replace(/ +$/, '');
  return out;
}

function stripPunctuationDeep_(value) {
  if (Array.isArray(value)) return value.map(stripPunctuationDeep_);
  return stripPunctuationFromText(value);
}

/**
 * Applies `hebrew_punctuation` (to `he`) and `translation_punctuation` (to
 * `text`). Only "false" turns punctuation off. References (`ref`, `heRef`)
 * are never touched. Returns a clone, or `data` itself when nothing applies.
 */
function applyPunctuationPreferences(data, userProperties) {
  if (!data || typeof data !== 'object') return data;
  const stripHebrew = userProperties.getProperty("hebrew_punctuation") == "false";
  const stripTranslation = userProperties.getProperty("translation_punctuation") == "false";
  if (!stripHebrew && !stripTranslation) return data;

  const clone = JSON.parse(JSON.stringify(data));
  if (stripHebrew && Object.prototype.hasOwnProperty.call(clone, 'he')) {
    clone.he = stripPunctuationDeep_(clone.he);
  }
  if (stripTranslation && Object.prototype.hasOwnProperty.call(clone, 'text')) {
    clone.text = stripPunctuationDeep_(clone.text);
  }
  return clone;
}

/**
 * Put Hebrew-numeral line markers back on transliterated text (transliterating
 * "(א)" garbles it). `startingVerse` is the first verse number, counted up one
 * per marker; or an array of the numbers in order (formatDataForPesukim's
 * `lineMarkerNumbers`), which follows a spanning range's restart at each
 * chapter.
 */
function normalizeTransliterationLineMarkersToGematria(text, startingVerse) {
  if (!text) {
    return text;
  }
  const numbers = Array.isArray(startingVerse) ? startingVerse : null;
  let markerIndex = 0;
  let verseNumber = Number(startingVerse) || 1;
  return String(text).split('\n').map(function(line) {
    if (!line || !line.trim()) return line;
    if (/^\s*\([^)]*\)\s*/.test(line)) {
      const number = (numbers && markerIndex < numbers.length) ? numbers[markerIndex] : verseNumber;
      markerIndex += 1;
      verseNumber = number + 1;
      const marker = (typeof gematriya === 'function') ? gematriya(number, { punctuate: false }) : String(number);
      return line.replace(/^\s*\([^)]*\)\s*/, "(" + marker + ") ");
    }
    return line;
  }).join('\n');
}

/**
 * The heading line for one section of a spanning range ("Chapter 2" /
 * "פרק ב", "Daf 2b" / "דף ב ע״ב"). `offset` counts sections from the first
 * one requested. The span is at the level above the last (chapters of a
 * Chapter:Verse text); Talmud dapim are numbered by amud, 3 = 2a.
 */
function spanningSectionHeading_(data, offset, lang) {
  const sections = (data && Array.isArray(data.sections)) ? data.sections : [];
  const level = Math.max(0, sections.length - 2);
  const names = (lang === 'he') ? data.heSectionNames : data.sectionNames;
  const name = (Array.isArray(names) && names[level]) ? String(names[level]) : (lang === 'he' ? 'פרק' : 'Chapter');
  const addressType = Array.isArray(data.addressTypes) ? data.addressTypes[level] : '';
  const start = sections[level];

  let label;
  const daf = /^(\d+)([ab])$/.exec(String(start));
  if (addressType === 'Talmud' || daf) {
    let amud = daf ? (Number(daf[1]) * 2 - (daf[2] === 'a' ? 1 : 0)) : (Number(start) || 1);
    amud += offset;
    const dafNumber = Math.ceil(amud / 2);
    const side = (amud % 2 === 1) ? 'a' : 'b';
    label = (lang === 'he')
      ? gematriya(dafNumber, { punctuate: false }) + ' ' + (side === 'a' ? 'ע״א' : 'ע״ב')
      : dafNumber + side;
  } else {
    const number = (Number(start) || 1) + offset;
    label = (lang === 'he') ? gematriya(number, { punctuate: false }) : String(number);
  }
  return name + ' ' + label;
}

function formatDataForPesukim(data, pesukim) {
  // insertReferenceVersions formats the first version's payload for the
  // Hebrew and again for its translation block. A second pass would find
  // strings where a spanning range has arrays, and throw.
  if (data && data.pesukimFormatted === true) {
    return data;
  }
  const hasLineMarkerableContent = (value) => {
    if (!Array.isArray(value)) {
      return false;
    }
    return value.some((item) => Array.isArray(item) || typeof item === 'string');
  };

  const lineMarkersAvailable = hasLineMarkerableContent(data.he) || hasLineMarkerableContent(data.text);
  data.lineMarkersAvailable = lineMarkersAvailable;
  data.lineMarkersApplied = !!(lineMarkersAvailable && pesukim);

  // `sections` is absent on some resolved payloads (dictionary entries, complex
  // book-level refs). insertion.gs already guards this read; do the same here so
  // a missing `sections` can't throw on the insertion path. Number() also keeps
  // the `fromVerse + index` arithmetic below numeric.
  const rawFromVerse = (data && Array.isArray(data.sections)) ? data.sections[1] : undefined;
  let heTextWrapper = "", enTextWrapper = "", fromVerse = Number(rawFromVerse) || 1;

  function addHebrewVerse(text, wrapper, pesukim, number) {
    // When line markers are on, each verse gets a numbered header and its own
    // line (newline separator). When line markers are off, verses run together
    // as prose with a single space between them — matching the original
    // non-pesukim behavior before the rewrite appended `\n` unconditionally.
    // See docs/regression-log.md.
    if (pesukim) {
      return wrapper + "(" + gematriya(number, { punctuate: false }) + ") " + text + "\n";
    }
    return wrapper + (wrapper ? " " : "") + text;
  }
  function addEnglishVerse(text, wrapper, pesukim, number) {
    if (pesukim) {
      return wrapper + "(" + number + ") " + text + "\n";
    }
    return wrapper + (wrapper ? " " : "") + text;
  }

  // Verse numbers in the order they appear (Hebrew), for the transliteration.
  const lineMarkerNumbers = [];
  // With line markers on, a range across chapters gets a heading line before
  // each chapter's verses: the numbers restart at 1, and "(31) ... (1) ..."
  // alone doesn't say where chapter 2 begins. The headings are ours, not the
  // source's: "keep only bold and italics" must not remove them.
  const sectionHeadingLines = [];
  function addSectionHeading(wrapper, perekNum, lang) {
    const heading = spanningSectionHeading_(data, perekNum, lang);
    sectionHeadingLines.push(heading);
    return wrapper + heading + "\n";
  }

  if(data.isSpanning) {
    // Each language numbers from the requested first verse; every later
    // chapter starts again at 1. The counter is per language: sharing one,
    // reset by the Hebrew pass, numbered the English of Genesis 1:31-2:3 as
    // (1), (1), (2), (3). See docs/regression-log.md.
    let heVerse = fromVerse;
    data.he.forEach(function(perekText, perekNum) {
      if(typeof perekText == "object") {
        if (pesukim && perekText.length) {
          heTextWrapper = addSectionHeading(heTextWrapper, perekNum, 'he');
        }
        perekText.forEach(function(verseText, index) {
         heTextWrapper = addHebrewVerse(verseText, heTextWrapper, pesukim, heVerse+index)
         lineMarkerNumbers.push(heVerse+index);
        });
        heVerse = 1;
      } else {
        heTextWrapper+=perekText;
      }
    });
    let enVerse = fromVerse;
    data.text.forEach(function(perekText, perekNum) {
      if(typeof perekText == "object") {
        if (pesukim && perekText.length) {
          enTextWrapper = addSectionHeading(enTextWrapper, perekNum, 'en');
        }
        perekText.forEach(function(verseText, index) {
         enTextWrapper = addEnglishVerse(verseText, enTextWrapper, pesukim, enVerse+index)
        });
        enVerse = 1;
      } else {
        enTextWrapper+=perekText;
      }
    });
  } else {
    if(typeof data.he == "object") {
      data.he.forEach(function(ele, index) {
        heTextWrapper = addHebrewVerse(ele, heTextWrapper, pesukim, fromVerse+index);
        lineMarkerNumbers.push(fromVerse+index);
      });
    } else {
      heTextWrapper = data.he;
    }
    if(typeof data.text == "object") {
      data.text.forEach(function(ele, index) {
        enTextWrapper = addEnglishVerse(ele, enTextWrapper, pesukim, fromVerse+index);
      });
    } else {
      enTextWrapper = data.text;
    }
  }

  data.he = heTextWrapper;
  data.text = enTextWrapper;
  data.lineMarkerNumbers = lineMarkerNumbers;
  data.sectionHeadingLines = sectionHeadingLines;
  data.pesukimFormatted = true;

  return data;
}

/**
 * For the side-by-side layouts' "one row per line" setting: pairs each Hebrew
 * segment with its translation, so each pair can get its own table row. Call
 * it on the payload as fetched, before formatDataForPesukim joins the
 * segments into one string. Line markers are numbered as formatDataForPesukim
 * numbers them (from the first requested verse; each later chapter of a
 * spanning ref starts at 1), and with line markers on, a spanning ref gets the
 * same chapter heading before each chapter, in a row of its own.
 *
 * Returns null when the payload has no segments to pair (a single string, or
 * segments nested deeper than chapters), so the caller falls back to one row
 * for the whole passage. Segments the other language lacks are left blank.
 *
 * @return {Array<{he: string, en: string, heRaw: string, number: (number|null), heading: boolean}>|null}
 *   he/en carry the line marker; heRaw is the Hebrew without it, as fetched
 *   (heTransliterationSource), for transliteration; empty for a heading;
 *   number is the verse number used
 *   for the marker.
 */
function buildAlignedLinePairs_(data, includeLineMarkers) {
  if (!data || !Array.isArray(data.he) || !Array.isArray(data.text)) return null;
  const rawFromVerse = Array.isArray(data.sections) ? data.sections[1] : undefined;
  const fromVerse = Number(rawFromVerse) || 1;

  const markers = !!includeLineMarkers;

  // [{text, number, heading}] for one language; null when it can't be split
  // into lines.
  function segmentsOf(value, lang) {
    const out = [];
    if (data.isSpanning) {
      let verse = fromVerse;
      for (let c = 0; c < value.length; c++) {
        const chapter = value[c];
        if (Array.isArray(chapter)) {
          if (markers && chapter.length) {
            out.push({ text: spanningSectionHeading_(data, c, lang), number: null, heading: true });
          }
          for (let i = 0; i < chapter.length; i++) {
            if (typeof chapter[i] !== 'string') return null;
            out.push({ text: chapter[i], number: verse + i });
          }
          verse = 1;
        } else if (typeof chapter === 'string') {
          out.push({ text: chapter, number: null });
        } else {
          return null;
        }
      }
      return out;
    }
    for (let i = 0; i < value.length; i++) {
      if (typeof value[i] !== 'string') return null;
      out.push({ text: value[i], number: fromVerse + i });
    }
    return out;
  }

  const he = segmentsOf(data.he, 'he');
  const en = segmentsOf(data.text, 'en');
  if (!he || !en || (!he.length && !en.length)) return null;
  // Each row's transliteration is read from the fetched Hebrew (vowels kept),
  // when it splits into the same lines.
  const source = data.heTransliterationSource;
  const heSource = Array.isArray(source) ? segmentsOf(source, 'he') : null;
  const sourceAligned = !!(heSource && heSource.length === he.length);

  const pairs = [];
  for (let i = 0; i < Math.max(he.length, en.length); i++) {
    const h = he[i];
    const e = en[i];
    const number = h ? h.number : (e ? e.number : null);
    const heRaw = h ? h.text : '';
    const enRaw = e ? e.text : '';
    const heading = !!((h && h.heading) || (e && e.heading));
    const withMarker = markers && number != null;
    pairs.push({
      he: (withMarker && heRaw) ? '(' + gematriya(number, { punctuate: false }) + ') ' + heRaw : heRaw,
      en: (withMarker && enRaw) ? '(' + number + ') ' + enRaw : enRaw,
      heRaw: heading ? '' : (sourceAligned ? heSource[i].text : heRaw),
      number: withMarker ? number : null,
      heading: heading
    });
  }
  return pairs;
}
