// Lexicon: dictionary lookups, grouped into words, and their insertion.
//
// Sefaria's /api/words/<word> answers with one flat list of dictionary
// entries for every headword the word could belong to. For שם that is Klein's
// and BDB's שֵׁם (name), BDB's second שֵׁם (Shem), and the words שם is a form
// of or close to: שׂוּם (put), שָׁמֵם (be desolated), שׂוּמָה. The sidebar used
// to list each entry as a result of its own, so taking Klein's and BDB's שֵׁם
// meant picking, inserting, going back and picking again. Here the entries are
// grouped into words (one per headword spelling), the words the search spelled
// are listed first ("direct") and the rest after them ("related"), and a
// word's entries are chosen the way a text's translations are: one or several,
// inserted in the order picked (sidebar/js/lexicon.html).
//
// Everything above insertLexiconEntry is pure (no Apps Script service except
// UrlFetchApp in the two fetchers), so test/tests/lexicon-words.test.js runs it
// in Node.

function searchLexicon(query) {
  const safeQuery = String(query || '').trim();
  if (!safeQuery) return [];

  const isEnglish = /[A-Za-z]/.test(safeQuery) && !/[\u0590-\u05FF]/.test(safeQuery);
  if (isEnglish) return groupLexiconEntries_(searchLexiconByEnglish_(safeQuery), '');

  return groupLexiconEntries_(fetchLexiconEntries_(safeQuery, true), safeQuery);
}

// The raw entries Sefaria has for a word. strict: a server error throws (the
// sidebar says the lookup is unavailable) instead of reading as "no entries".
function fetchLexiconEntries_(word, strict) {
  const url = 'https://www.sefaria.org/api/words/' + encodeURIComponent(word);
  const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  const status = response.getResponseCode ? response.getResponseCode() : 200;
  if (status === 404) return [];
  if (status >= 400) {
    if (strict) throw new Error('Lexicon search is temporarily unavailable.');
    return [];
  }
  let entries;
  try {
    entries = JSON.parse(response.getContentText() || '[]');
  } catch (e) {
    return [];
  }
  return Array.isArray(entries) ? entries : [];
}

// An English word is looked up in the dictionaries' definitions with
// Sefaria's text search, and the headwords whose definitions match are then
// looked up with /api/words/. That lookup also answers with the words each
// headword is close to; only the headword the search found is kept (by its
// letters), unless none of the answer matches it, in which case all of it is.
//
// The search is filtered by category path, matched from its start ("Tanakh"
// reaches "Tanakh/Torah/Genesis"). Until 2026-11 the filters were the
// dictionaries' titles ("Klein Dictionary", "Jastrow"), which no path starts
// with, so every English lookup found nothing. The dictionaries are under
// Reference/Dictionary; if that finds nothing, all of Reference is searched
// and only the dictionaries' hits kept.
const LEXICON_ENGLISH_SEARCHES_ = [
  { filters: ['Reference/Dictionary'], keep: function () { return true; } },
  { filters: ['Reference'], keep: function (hit) { return lexiconIsDictionaryHit_(hit); } }
];
const LEXICON_ENGLISH_HEADWORDS_ = 6;

function lexiconEnglishSearchPayload_(query, filters) {
  return {
    aggs: [],
    field: 'exact',
    filters: filters,
    filter_fields: filters.map(function () { return 'path'; }),
    query: query,
    size: 40,
    slop: 0,
    type: 'text',
    source_proj: true
  };
}

// A hit from a dictionary: by its categories or path, else by its title.
function lexiconIsDictionaryHit_(hit) {
  const source = (hit && hit._source) || {};
  const categories = Array.isArray(source.categories) ? source.categories.join('/') : '';
  const pathText = Array.isArray(source.path) ? source.path.join('/') : String(source.path || '');
  if (/dictionar/i.test(categories) || /dictionar/i.test(pathText)) return true;
  const title = String(source.ref || '').split(',')[0];
  return /dictionary|jastrow|lexicon/i.test(title);
}

// "Jastrow, שֵׁם I 1" / "Klein Dictionary, שֵׁם 1" → "שֵׁם": the first Hebrew
// word after the title, without the entry's ordinal or segment number.
function lexiconHeadwordFromRef_(ref) {
  const text = String(ref || '');
  const comma = text.indexOf(',');
  if (comma < 0) return '';
  const match = /[\u05B0-\u05EA\u05F0-\u05F4]+(?:[\s\u05BE-][\u05B0-\u05EA\u05F0-\u05F4]+)*/.exec(text.slice(comma + 1));
  return match ? match[0].trim() : '';
}

function searchLexiconByEnglish_(query) {
  let hits = [];
  let answered = false;
  for (let i = 0; i < LEXICON_ENGLISH_SEARCHES_.length && !hits.length; i++) {
    const search = LEXICON_ENGLISH_SEARCHES_[i];
    let data;
    try {
      data = searchWrapperRequest_(lexiconEnglishSearchPayload_(query, search.filters));
    } catch (e) {
      Logger.log('Lexicon English search failed: ' + e.message);
      continue;
    }
    answered = true;
    hits = ((((data || {}).hits || {}).hits) || []).filter(search.keep);
  }
  // Not one answer: say so, rather than "no entries found".
  if (!answered) throw new Error('Lexicon search is temporarily unavailable.');

  const seen = {};
  const headwords = [];
  hits.forEach(function (hit) {
    const headWord = lexiconHeadwordFromRef_((hit && hit._source && hit._source.ref) || '');
    if (!headWord || seen[headWord] || headwords.length >= LEXICON_ENGLISH_HEADWORDS_) return;
    seen[headWord] = true;
    headwords.push(headWord);
  });
  if (!headwords.length) return [];

  const responses = UrlFetchApp.fetchAll(headwords.map(function (headWord) {
    return { url: 'https://www.sefaria.org/api/words/' + encodeURIComponent(headWord), muteHttpExceptions: true };
  }));
  let results = [];
  responses.forEach(function (response, i) {
    try {
      if (!response || response.getResponseCode() !== 200) return;
      const entries = JSON.parse(response.getContentText() || '[]');
      if (Array.isArray(entries)) results = results.concat(keepLexiconHeadword_(entries, headwords[i]));
    } catch (e) {
      Logger.log('Lexicon reverse lookup failed: ' + e.message);
    }
  });
  return results;
}

// The entries spelled as the search's headword: by its vowels when it has
// them (שֵׁם, not שָׁם or שֻׁם), else by its letters; all of them if none is.
function keepLexiconHeadword_(entries, headWord) {
  const spellings = function (entry) {
    return lexiconRawHeadwords_(entry).map(function (hw) { return lexiconSplitHeadword_(hw).word; });
  };
  const tiers = [];
  if (lexiconHasVowels_(headWord)) {
    const pointed = lexiconPointedKey_(headWord);
    tiers.push(function (hw) { return lexiconPointedKey_(hw) === pointed; });
  }
  const letters = lexiconConsonantKey_(headWord);
  if (letters) tiers.push(function (hw) { return lexiconConsonantKey_(hw) === letters; });
  for (let i = 0; i < tiers.length; i++) {
    const kept = entries.filter(function (entry) { return spellings(entry).some(tiers[i]); });
    if (kept.length) return kept;
  }
  return entries;
}

function lexiconRawHeadwords_(entry) {
  const safe = entry || {};
  const alternates = Array.isArray(safe.alt_headwords) ? safe.alt_headwords
    : (Array.isArray(safe.alternateHeadWords) ? safe.alternateHeadWords : []);
  return [safe.headword || safe.headWord || ''].concat(alternates.map(lexiconAlternateText_)).filter(Boolean);
}

function lexiconAlternateText_(alternate) {
  if (typeof alternate === 'string') return alternate.trim();
  if (alternate && typeof alternate === 'object') return String(alternate.word || alternate.text || '').trim();
  return '';
}

// ---- Keys ---------------------------------------------------------------------

const LEXICON_FINAL_LETTERS_ = { '\u05DA': '\u05DB', '\u05DD': '\u05DE', '\u05DF': '\u05E0', '\u05E3': '\u05E4', '\u05E5': '\u05E6' };

// The letters alone, final forms made regular: שֵׁם, שׂוּם → "שמ", "שומ".
function lexiconConsonantKey_(word) {
  return String(word || '')
    .replace(/[^\u05D0-\u05EA]/g, '')
    .replace(/[\u05DA\u05DD\u05DF\u05E3\u05E5]/g, function (ch) { return LEXICON_FINAL_LETTERS_[ch]; });
}

// The spelling with its vowels and shin / sin dots, without cantillation,
// meteg or punctuation, and with the marks in one order (dictionaries store
// them in different orders): what decides that two entries are one word.
function lexiconPointedKey_(word) {
  return String(word || '')
    .normalize('NFD')
    .replace(/\u05C7/g, '\u05B8')   // qamats qatan → qamats
    .replace(/\u05BA/g, '\u05B9')   // holam haser for vav → holam
    .replace(/[^\u05B0-\u05BC\u05C1\u05C2\u05D0-\u05EA]/g, '')
    .normalize('NFD');
}

function lexiconHasVowels_(word) {
  return /[\u05B0-\u05BC\u05C7]/.test(String(word || ''));
}

// ---- One entry -----------------------------------------------------------------
//
// Field names as Sefaria's /api/words/ gives them (checked against its answers
// for שם and שלום, 2026-11; test/tests/fixtures/lexicon-*.json):
// headword ("שֵׁם ᴵ" Klein, "שֵׁם²" BDB, "שֵׁם I" Jastrow: the number is in the
// headword), ordinal ("I." BDB), all_cited, alt_headwords (strings or
// { word }), content.morphology, content.senses[] (definition, num / number,
// grammar { verbal_stem, binyan_form }, form (BDB's stem), plural_form, all_cited,
// senses), content.definition (Ben-Yehuda: one HTML block with footnotes),
// notes, derivatives, strong_number, language_code ("arc"; Jastrow " ch. ")
// and parent_lexicon_details { name, attribution, to_language }.

// Sefaria's dictionaries, as a reader knows them. Checked in order: "BDB
// Aramaic Dictionary" must meet the Aramaic row, and "BDB Augmented Strong"
// the Strong's row, before the BDB one.
const LEXICON_SHORT_NAMES_ = [
  [/aramaic/i, /bdb|brown/i, 'BDB Aramaic'],
  [/strong/i, null, "Strong's"],
  [/bdb|brown.driver.briggs/i, null, 'BDB'],
  [/klein/i, null, 'Klein'],
  [/jastrow/i, null, 'Jastrow'],
  [/ben.?yehuda/i, null, 'Ben-Yehuda'],
  [/sefer hashorashim/i, null, 'Sefer HaShorashim'],
  [/rashi/i, null, 'Rashi’s Foreign Words']
];

function lexiconShortName_(lexiconName) {
  const name = String(lexiconName || '').trim();
  if (!name) return 'Dictionary';
  for (let i = 0; i < LEXICON_SHORT_NAMES_.length; i++) {
    const row = LEXICON_SHORT_NAMES_[i];
    if (row[0].test(name) && (!row[1] || row[1].test(name))) return row[2];
  }
  return name.replace(/\s+(dictionary|lexicon)$/i, '').trim() || name;
}

// The number a dictionary writes after a headword it has more than one of.
const LEXICON_SUPERSCRIPT_ORDINALS_ = { 'ᴵ': 'I', 'ⱽ': 'V', 'ˣ': 'X' };
const LEXICON_SUPERSCRIPT_DIGITS_ = { '¹': 1, '²': 2, '³': 3, '⁴': 4, '⁵': 5, '⁶': 6, '⁷': 7, '⁸': 8, '⁹': 9 };
const LEXICON_ROMAN_ = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'];

// "שֵׁם ᴵ" → { word: "שֵׁם", ordinal: "I" }; "שֵׁם²" → "II"; "שֵׁם I" → "I".
function lexiconSplitHeadword_(headword) {
  const text = String(headword || '').trim();
  let match = /\s*([ᴵⱽˣ]+)\s*$/.exec(text);
  if (match) {
    return { word: text.slice(0, match.index).trim(), ordinal: match[1].split('').map(function (ch) { return LEXICON_SUPERSCRIPT_ORDINALS_[ch]; }).join('') };
  }
  match = /\s*([¹²³⁴-⁹])\s*$/.exec(text);
  if (match) return { word: text.slice(0, match.index).trim(), ordinal: LEXICON_ROMAN_[LEXICON_SUPERSCRIPT_DIGITS_[match[1]]] || '' };
  match = /\s+([IVX]{1,4})\.?\s*$/.exec(text);
  if (match) return { word: text.slice(0, match.index).trim(), ordinal: match[1] };
  return { word: text, ordinal: '' };
}

function lexiconCleanOrdinal_(ordinal) {
  return String(ordinal || '').trim().replace(/\.$/, '').trim();
}

// A line break or block is a space; an inline tag is nothing ("Nö<sup>ZMG").
function lexiconPlainText_(html) {
  const stripped = String(html || '')
    .replace(/<\/?(?:br|p|div|li|ol|ul)\b[^>]*>/gi, ' ')
    .replace(/<[^>]*>/g, '');
  return String(decodeHTMLEntities(stripped) || '').replace(/\s+/g, ' ').trim();
}

// Sefaria's footnotes (Ben-Yehuda's: <sup class="footnote-marker">1</sup>
// <i class="footnote">…</i>, the note's own <i> nested inside) are left out:
// read inline, a note runs into the definition it annotates.
function lexiconStripFootnotes_(html) {
  let text = String(html || '').replace(/<sup class="footnote-marker">[^<]*<\/sup>/g, '');
  const open = /<i class="footnote">/;
  let at = text.search(open);
  while (at >= 0) {
    const tags = /<(\/?)i\b[^>]*>/g;
    tags.lastIndex = at;
    let depth = 0;
    let end = -1;
    let tag;
    while ((tag = tags.exec(text))) {
      depth += tag[1] ? -1 : 1;
      if (depth === 0) { end = tags.lastIndex; break; }
    }
    text = end < 0 ? text.slice(0, at) : text.slice(0, at) + text.slice(end);
    at = text.search(open);
  }
  return text;
}

function lexiconHtmlString_(value) {
  if (Array.isArray(value)) return value.map(lexiconHtmlString_).filter(Boolean).join(' ');
  if (typeof value === 'string') return lexiconStripFootnotes_(value).replace(/\s+/g, ' ').trim();
  return '';
}

// "— Qal" (Klein) → "Qal"; a stem BDB marks as fully cited keeps its †.
function lexiconStemLabel_(sense) {
  const grammar = sense.grammar;
  let label = '';
  if (typeof grammar === 'string') label = grammar;
  else if (grammar && typeof grammar === 'object') label = String(grammar.verbal_stem || grammar.binyan || '');
  if (!label && typeof sense.form === 'string') label = sense.form;
  if (!label && typeof sense.binyan === 'string') label = sense.binyan;
  label = String(label || '').replace(/^[\s—–-]+/, '').trim();
  const forms = grammar && typeof grammar === 'object' && Array.isArray(grammar.binyan_form)
    ? grammar.binyan_form.map(String).filter(Boolean) : [];
  if (label && forms.length) label += ' ' + forms.join(', ');
  if (label && sense.all_cited === true && label.charAt(0) !== '†') label = '†' + label;
  return label;
}

// A sense as the sidebar and the insert read it. Sefaria nests them (BDB:
// 1. › a., b.; a verb's Qal, Hiph. …) and names their parts differently per
// dictionary; unknown fields are ignored.
function normalizeLexiconSense_(sense, depth) {
  if (typeof sense === 'string') return { num: '', label: '', html: lexiconHtmlString_(sense), notes: '', senses: [] };
  const safe = sense || {};
  let children = depth < 6 && Array.isArray(safe.senses)
    ? safe.senses.map(function (child) { return normalizeLexiconSense_(child, depth + 1); }).filter(lexiconSenseHasText_)
    : [];
  const plural = lexiconHtmlString_(safe.plural_form);
  let html = [plural, lexiconHtmlString_(safe.definition)].filter(Boolean).join(' ');
  // BDB wraps a definition in its number ({ num: "a.", senses: [{ definition }] })
  // and a stem's conjugation in the stem ({ form: "Qal", senses: [{ definition:
  // "Pf. 3 ms. …" }, { num: "1." …}] }): the unnumbered first child is the
  // number's or the stem's own text. A list of unnumbered children (Strong's
  // meanings under Qal) stays a list.
  const lead = children[0];
  if (!html && lead && !lead.num && !lead.label && lead.html &&
      children.slice(1).every(function (child) { return child.num || child.label; })) {
    html = lead.html;
    children = lead.senses.concat(children.slice(1));
  }
  return {
    // Jastrow numbers its second sense "—2)".
    num: String(safe.num || safe.number || '').replace(/^[\s—–-]+/, '').trim(),
    label: lexiconStemLabel_(safe),
    html: html,
    notes: lexiconHtmlString_(safe.notes || safe.note),
    senses: children
  };
}

function lexiconSenseHasText_(sense) {
  return !!(sense && (sense.html || sense.notes || sense.label || (sense.senses && sense.senses.length)));
}

function lexiconSensesOf_(content) {
  if (!content) return [];
  if (typeof content === 'string') return [normalizeLexiconSense_(content, 0)];
  if (Array.isArray(content)) return content.map(function (s) { return normalizeLexiconSense_(s, 0); }).filter(lexiconSenseHasText_);
  if (Array.isArray(content.senses)) {
    return content.senses.map(function (s) { return normalizeLexiconSense_(s, 0); }).filter(lexiconSenseHasText_);
  }
  if (content.definition) return [normalizeLexiconSense_({ definition: content.definition }, 0)].filter(lexiconSenseHasText_);
  return [];
}

// A part of speech at the start of a definition (BDB and Jastrow put it there;
// Klein, Jastrow and Strong's also have content.morphology).
const LEXICON_LEADING_POS_ = /^(n\.\s?pr\.\s?(?:m|f|loc|gent|dei)\.|pr\.\s?n\.\s?(?:m|f|pl)\.|n\.\s?[mf]\.(?:\s?(?:pl|du)\.)?|vb\.|adj\.|adv\.|prep\.|conj\.|interj\.|pron\.|subst\.)(?=\s|$)/;
// A citation before the gloss: "2 S 7:9 name".
const LEXICON_LEADING_CITATION_ = /^(?:\d\s)?[A-Z][a-z]{0,3}\.?\s\d+:\d+(?:[,;]\s?\d+(?::\d+)?)*\s+/;

function firstLexiconDefinition_(senses) {
  for (let i = 0; i < senses.length; i++) {
    if (senses[i].html) return senses[i].html;
    const nested = firstLexiconDefinition_(senses[i].senses || []);
    if (nested) return nested;
  }
  return '';
}

// Jastrow sets its English glosses in italics, among citations, abbreviations
// and Hebrew: "(b. h.) <i>there, thither</i>. Macc. II, 7 …". The gloss runs
// from the first italics to the end of that sentence ("<i>Imma</i>
// (<i>Mother</i>) <i>Shalom</i>, wife of R. Eliezer. Y. Shebi. …"); a single
// capital before a period ("R.") doesn't end it.
function lexiconFirstItalicSentence_(html) {
  const source = String(html || '');
  const at = source.search(/<(i|em)\b[^>]*>/i);
  if (at < 0) return '';
  const text = lexiconPlainText_(source.slice(at));
  const end = /[a-z)\u05D0-\u05EA]{2,}\.(\s|$)/.exec(text);
  const sentence = end ? text.slice(0, end.index + end[0].trimEnd().length - 1) : text;
  return sentence.replace(/[\s,.;:]+$/, '').trim();
}

// "vb. put, place, set (cf. NöZMG …" → { pos: "vb.", gloss: "put, place, set" }
function lexiconGlossOf_(html, dictionary) {
  let text = lexiconPlainText_(html).replace(/^[†,\s]+/, '');
  let pos = '';
  text = text.replace(/^\([^)]*\)\s*/, '');
  const posMatch = LEXICON_LEADING_POS_.exec(text);
  if (posMatch) {
    pos = posMatch[1];
    text = text.slice(posMatch[0].length).trim();
  }
  if (dictionary === 'Jastrow') {
    // No italics: a cross-reference or a list of citations, not a gloss.
    return { pos: pos, gloss: lexiconFirstItalicSentence_(html) };
  }
  if (dictionary === 'Ben-Yehuda') {
    // Hebrew: "ש"ז, … — א) מלה המשמשת ציון לסוג …: …"; the first sense.
    const first = /א\)\s*([^:;(]+)/.exec(text);
    if (first) text = first[1];
    // …and without the German, French and English equivalents after it.
    text = text.split(/[;:]/)[0].split(',').filter(function (part) { return /[\u05D0-\u05EA]/.test(part); }).join(',');
  }
  text = text.replace(/^\([^)]*\)\s*/, '').replace(LEXICON_LEADING_CITATION_, '');
  const cut = text.search(/\s?[(\[;—:]|\scf\.\s/);
  if (cut > 0) text = text.slice(0, cut);
  text = text.replace(/[\s,.;:—-]+$/, '').trim();
  return { pos: pos, gloss: text };
}

// One line that tells an entry from its neighbours. A numbered list of short
// senses (Klein's "1. name, designation." "2. reputation, renown, fame.") is
// joined; otherwise (BDB's long first paragraph) the first sense's opening
// words.
function lexiconSummaryGloss_(senses, dictionary) {
  const LIMIT = 80;
  const isShortNumbered = function (sense) {
    return !!(sense && sense.num && !sense.label && sense.html && lexiconPlainText_(sense.html).length <= LIMIT);
  };
  const glossOf = function (sense) {
    return lexiconGlossOf_(sense.html || firstLexiconDefinition_(sense.senses || []), dictionary).gloss;
  };
  // The first sense that has a gloss: Klein's שָׁם opens with a remark in
  // parentheses ("(after verbs of motion שָֽׁמָּה)") before "1. there, thither."
  let i = 0;
  while (i < senses.length && i < 3 && !glossOf(senses[i])) i++;
  if (i >= senses.length || !glossOf(senses[i] || {})) return '';
  const parts = [glossOf(senses[i])];
  if (isShortNumbered(senses[i])) {
    let length = parts[0].length;
    for (let j = i + 1; j < senses.length && parts.length < 3 && isShortNumbered(senses[j]); j++) {
      const gloss = glossOf(senses[j]);
      if (!gloss || length + gloss.length + 2 > LIMIT) break;
      parts.push(gloss);
      length += gloss.length + 2;
    }
  }
  const joined = parts.join('; ');
  return joined.length > LIMIT ? joined.slice(0, LIMIT - 1).replace(/\s+\S*$/, '') + '…' : joined;
}

// A verb's part of speech, where Klein gives it on its stem ("tr. v.").
function lexiconStemMorphology_(content) {
  const senses = (content && Array.isArray(content.senses)) ? content.senses : [];
  for (let i = 0; i < senses.length; i++) {
    const grammar = senses[i] && senses[i].grammar;
    if (grammar && typeof grammar === 'object' && grammar.morphology) return String(grammar.morphology).trim();
  }
  return '';
}

// Aramaic by its code ("arc"), its dictionary (BDB Aramaic), or Jastrow's
// "ch." (Chaldaic, Jastrow's word for Aramaic).
function lexiconLanguageOf_(entry, lexiconName) {
  const code = String((entry && entry.language_code) || '').toLowerCase().trim();
  if (/^(arc|aram)/.test(code) || /aramaic/i.test(lexiconName)) return 'Aramaic';
  if (/jastrow/i.test(lexiconName) && /(^|\W)ch\.(\W|$)/.test(code)) return 'Aramaic';
  return '';
}

function normalizeLexiconEntry_(entry, index) {
  const safe = entry || {};
  const details = (safe.parent_lexicon_details && typeof safe.parent_lexicon_details === 'object') ? safe.parent_lexicon_details : {};
  const content = safe.content || {};
  const split = lexiconSplitHeadword_(safe.headword || safe.headWord || '');
  const headWord = split.word;
  const lexiconName = String(safe.parent_lexicon || safe.lexiconName || details.name || '').trim();
  const dictionary = lexiconShortName_(lexiconName);
  const senses = lexiconSensesOf_(content);
  const first = lexiconGlossOf_(firstLexiconDefinition_(senses), dictionary);
  const statedMorphology = String(content.morphology || safe.morphology || '').trim() || lexiconStemMorphology_(content);
  const morphology = statedMorphology || first.pos;
  const alternates = lexiconRawHeadwords_(safe).slice(1).map(function (alt) { return lexiconSplitHeadword_(alt).word; }).filter(Boolean);
  const ordinal = lexiconCleanOrdinal_(safe.ordinal) || split.ordinal;
  const strongNumber = String(safe.strong_number || '').trim();

  return {
    id: [lexiconName, headWord, ordinal || strongNumber, safe.rid || index].join('|'),
    rid: safe.rid || null,
    lexiconName: lexiconName,
    dictionary: dictionary,
    credit: String(details.attribution || '').trim(),
    headWord: headWord,
    ordinal: ordinal,
    strongNumber: strongNumber,
    allCited: safe.all_cited === true,
    alternateHeadWords: alternates,
    morphology: morphology,
    // BDB and Jastrow open the definition with it ("n.m. …"): shown as a
    // label, it isn't repeated before the definition in the document.
    morphologyInDefinition: !statedMorphology && !!first.pos,
    language: lexiconLanguageOf_(safe, lexiconName),
    // Ben-Yehuda defines in Hebrew: its definitions read right to left.
    definitionsRtl: /^he/i.test(String(details.to_language || '')),
    gloss: lexiconSummaryGloss_(senses, dictionary),
    senses: senses,
    notes: lexiconHtmlString_(safe.notes),
    derivatives: lexiconHtmlString_(safe.derivatives)
  };
}

// ---- Words ---------------------------------------------------------------------

function lexiconQueryMatch_(entry, query) {
  const queryLetters = lexiconConsonantKey_(query);
  if (!queryLetters) return { direct: true, exact: false };
  const pointed = lexiconHasVowels_(query) ? lexiconPointedKey_(query) : '';
  const spellings = [entry.headWord].concat(entry.alternateHeadWords || []);
  let direct = false;
  let exact = false;
  spellings.forEach(function (spelling) {
    if (lexiconConsonantKey_(spelling) === queryLetters) direct = true;
    if (pointed && lexiconPointedKey_(spelling) === pointed) exact = true;
  });
  return { direct: direct || exact, exact: exact };
}

function lexiconEntryFingerprint_(entry) {
  return [entry.lexiconName, entry.ordinal, lexiconPointedKey_(entry.headWord), JSON.stringify(entry.senses).slice(0, 400)].join('|');
}

// Raw entries → words, in the order the sidebar lists them: the word the
// search spelled (its vowels too, when typed), the other spellings of its
// letters, then the related words; each group in Sefaria's order.
function groupLexiconEntries_(rawEntries, query) {
  const groups = [];
  const byKey = {};
  const seen = {};
  (rawEntries || []).forEach(function (raw, index) {
    if (!raw || typeof raw !== 'object') return;
    const entry = normalizeLexiconEntry_(raw, index);
    if (!entry.headWord) return;
    const fingerprint = lexiconEntryFingerprint_(entry);
    if (seen[fingerprint]) return;
    seen[fingerprint] = true;

    const key = lexiconPointedKey_(entry.headWord) || entry.headWord;
    let group = byKey[key];
    if (!group) {
      group = { key: key, order: groups.length, entries: [], direct: false, exact: false };
      byKey[key] = group;
      groups.push(group);
    }
    const match = lexiconQueryMatch_(entry, query);
    group.direct = group.direct || match.direct;
    group.exact = group.exact || match.exact;
    const ids = group.entries.map(function (e) { return e.id; });
    if (ids.indexOf(entry.id) >= 0) entry.id += '#' + group.entries.length;
    group.entries.push(entry);
  });

  groups.sort(function (a, b) {
    const rank = function (g) { return g.exact ? 0 : (g.direct ? 1 : 2); };
    return (rank(a) - rank(b)) || (a.order - b.order);
  });

  return groups.map(function (group, i) {
    const first = group.entries[0];
    return {
      key: 'lexicon-word-' + i,
      ref: 'lexicon-word:' + group.key,
      kind: 'lexicon-word',
      label: first.headWord,
      headWord: first.headWord,
      match: group.direct ? 'direct' : 'related',
      entries: group.entries,
      typeLabel: 'Lexicon',
      clusterLabel: 'Dictionary',
      hasTranslation: true,
      availableLangs: ['en', 'he']
    };
  });
}

// ---- Insertion -------------------------------------------------------------------

// Sefaria's markup as runs of text: bold (<b>, <strong>), italic (<i>, <em>)
// and superscript (<sup>: BDB's "NöZMG", "CISiv. 1"). Other tags keep their
// text; a line break or block is a space (one sense is one paragraph).
function lexiconRichRuns_(html) {
  const parts = String(html || '').split(/(<\/?[a-zA-Z][^>]*>)/g);
  const runs = [];
  let bold = 0;
  let italic = 0;
  let sup = 0;
  function add(text) {
    if (!text) return;
    const last = runs[runs.length - 1];
    const flags = { bold: bold > 0, italic: italic > 0, sup: sup > 0 };
    if (last && last.bold === flags.bold && last.italic === flags.italic && last.sup === flags.sup) {
      last.text += text;
    } else {
      runs.push({ text: text, bold: flags.bold, italic: flags.italic, sup: flags.sup });
    }
  }
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (i % 2 === 1) {
      const m = /^<(\/?)([a-zA-Z]+)/.exec(part);
      const closing = m[1] === '/';
      const tag = m[2].toLowerCase();
      const step = closing ? -1 : 1;
      if (/\/>$/.test(part) && !closing && tag !== 'br') continue;
      if (tag === 'b' || tag === 'strong') bold = Math.max(0, bold + step);
      else if (tag === 'i' || tag === 'em') italic = Math.max(0, italic + step);
      else if (tag === 'sup') sup = Math.max(0, sup + step);
      else if (/^(br|p|div|li|ol|ul)$/.test(tag)) add(' ');
      continue;
    }
    add(String(decodeHTMLEntities(part) || ''));
  }
  // Collapse the whitespace the markup leaves, across runs.
  let previousSpace = true;
  runs.forEach(function (run) {
    let out = '';
    for (let c = 0; c < run.text.length; c++) {
      const ch = /\s/.test(run.text[c]) ? ' ' : run.text[c];
      if (ch === ' ' && previousSpace) continue;
      out += ch;
      previousSpace = ch === ' ';
    }
    run.text = out;
  });
  const kept = runs.filter(function (run) { return run.text; });
  if (kept.length) kept[kept.length - 1].text = kept[kept.length - 1].text.replace(/\s+$/, '');
  return kept.filter(function (run) { return run.text; });
}

function lexiconEntryLabel_(entry) {
  return [entry.lexiconName || entry.dictionary || 'Dictionary', entry.ordinal || entry.strongNumber].filter(Boolean).join(' ');
}

function lexiconSenseNumber_(num) {
  const value = String(num || '').trim();
  if (!value) return '';
  return /[.)]$/.test(value) ? value : value + '.';
}

function planLexiconSenses_(senses, depth, out) {
  (senses || []).forEach(function (sense) {
    const runs = [];
    const number = lexiconSenseNumber_(sense.num);
    if (number) runs.push({ text: number + ' ', bold: false, italic: false, sup: false });
    if (sense.label) runs.push({ text: sense.label + ' ', bold: true, italic: false, sup: false });
    lexiconRichRuns_(sense.html).forEach(function (run) { runs.push(run); });
    if (sense.notes) {
      runs.push({ text: ' ', bold: false, italic: false, sup: false });
      lexiconRichRuns_(sense.notes).forEach(function (run) { runs.push(run); });
    }
    // A bare number over sub-senses ("1." over a., b.) is a paragraph of its
    // own: it heads them, as in the printed dictionary.
    if (runs.length) out.push({ kind: 'sense', depth: depth, runs: trimLexiconRuns_(runs) });
    planLexiconSenses_(sense.senses, runs.length ? depth + 1 : depth, out);
  });
  return out;
}

function trimLexiconRuns_(runs) {
  const out = runs.map(function (run) { return Object.assign({}, run); });
  if (out.length) out[out.length - 1].text = out[out.length - 1].text.replace(/\s+$/, '');
  return out.filter(function (run) { return run.text; });
}

// What the insert writes, paragraph by paragraph. entries: one word's
// entries in the order the reader picked them. mode: 'entry' (Full entry),
// 'headword' (Word + ref) or 'definition'.
function planLexiconInsertion_(entries, mode) {
  const list = (entries || []).filter(function (e) { return e && e.headWord; });
  const paragraphs = [];
  if (!list.length) return paragraphs;
  const insertMode = mode === 'headword' || mode === 'definition' ? mode : 'entry';

  if (insertMode !== 'definition') {
    paragraphs.push({ kind: 'headword', text: list[0].headWord });
  }

  if (insertMode === 'headword') {
    paragraphs.push({ kind: 'meta', text: list.map(lexiconEntryLabel_).join('; ') });
    return paragraphs;
  }

  list.forEach(function (entry, i) {
    if (i > 0) paragraphs.push({ kind: 'blank', text: '' });
    if (insertMode === 'entry') {
      const alternates = (entry.alternateHeadWords || []).filter(Boolean);
      const meta = [lexiconEntryLabel_(entry), entry.morphologyInDefinition ? '' : entry.morphology,
        alternates.length ? 'also ' + alternates.join(', ') : '']
        .filter(Boolean).join(' · ');
      paragraphs.push({ kind: 'meta', text: meta });
    }
    planLexiconSenses_(entry.senses, 0, paragraphs);
    if (insertMode === 'entry') {
      if (entry.notes) paragraphs.push({ kind: 'notes', runs: lexiconRichRuns_(entry.notes) });
      if (entry.derivatives) {
        // Klein's own text starts "Derivatives:" (or "Derivative:").
        const labelled = /^derivatives?:/i.test(lexiconPlainText_(entry.derivatives));
        paragraphs.push({ kind: 'notes', runs: (labelled ? [] : [{ text: 'Derivatives: ', bold: true, italic: false, sup: false }]).concat(lexiconRichRuns_(entry.derivatives)) });
      }
    }
  });
  return paragraphs;
}

// A sense as searchLexicon gave it to the sidebar ({ num, label, html, notes,
// senses }), coming back with Add Entry: kept to that shape and to strings.
function lexiconModelSense_(sense, depth) {
  const safe = sense || {};
  return {
    num: String(safe.num || '').trim(),
    label: String(safe.label || '').trim(),
    html: lexiconHtmlString_(safe.html),
    notes: lexiconHtmlString_(safe.notes),
    senses: depth < 6 && Array.isArray(safe.senses)
      ? safe.senses.map(function (child) { return lexiconModelSense_(child, depth + 1); }).filter(lexiconSenseHasText_)
      : []
  };
}

// What the client sends back is the model searchLexicon gave it; an older
// sidebar sent one Sefaria-shaped entry (headWord, content, lexiconName).
function lexiconEntriesFromPayload_(payload) {
  const safe = payload || {};
  const source = Array.isArray(safe.entries) ? safe.entries : [safe];
  return source.slice(0, 20).map(function (item, index) {
    const value = item || {};
    if (Array.isArray(value.senses)) {
      return {
        headWord: String(value.headWord || '').trim(),
        lexiconName: String(value.lexiconName || '').trim(),
        dictionary: String(value.dictionary || '').trim(),
        ordinal: String(value.ordinal || '').trim(),
        strongNumber: String(value.strongNumber || '').trim(),
        morphology: String(value.morphology || '').trim(),
        morphologyInDefinition: value.morphologyInDefinition === true,
        alternateHeadWords: Array.isArray(value.alternateHeadWords) ? value.alternateHeadWords.map(String) : [],
        senses: value.senses.map(function (s) { return lexiconModelSense_(s, 0); }).filter(lexiconSenseHasText_),
        notes: lexiconHtmlString_(value.notes),
        derivatives: lexiconHtmlString_(value.derivatives)
      };
    }
    return normalizeLexiconEntry_({
      headword: value.headWord,
      parent_lexicon: value.lexiconName,
      content: Object.assign({}, value.content || {}, value.morphology ? { morphology: value.morphology } : {}),
      alt_headwords: value.alternateHeadWords
    }, index);
  }).filter(function (entry) { return entry.headWord; });
}

function lexiconRunsText_(runs) {
  return (runs || []).map(function (run) { return run.text; }).join('');
}

function lexiconRunMarks_(runs) {
  const marks = [];
  let offset = 0;
  (runs || []).forEach(function (run) {
    if (!run.text) return;
    marks.push({ start: offset, end: offset + run.text.length - 1, run: run });
    offset += run.text.length;
  });
  return marks;
}

function applyLexiconRunMarks_(paragraph, marks) {
  const text = paragraph.editAsText();
  marks.forEach(function (mark) {
    if (mark.run.bold) text.setBold(mark.start, mark.end, true);
    if (mark.run.italic) text.setItalic(mark.start, mark.end, true);
    if (mark.run.sup) text.setTextAlignment(mark.start, mark.end, DocumentApp.TextAlignment.SUPERSCRIPT);
  });
}

// Insert one word's chosen entries into the active Google Document.
function insertLexiconEntry(lexiconPayload) {
  const entries = lexiconEntriesFromPayload_(lexiconPayload);
  if (!entries.length) {
    throw new Error('No lexicon entry is selected.');
  }

  const document = DocumentApp.getActiveDocument();
  if (!document) {
    throw new Error('Open a Google Doc before inserting a lexicon entry.');
  }

  const typography = getTypographySettings();
  // The document body, or the table cell holding the cursor. See insertion-target.gs.
  const target = resolveInsertionTarget_({ layout: 'paragraphs', replaceSelection: false });
  const body = target.container;
  let index = target.index;

  const plan = planLexiconInsertion_(entries, String((lexiconPayload && lexiconPayload.insertMode) || 'entry'));
  plan.forEach(function (item) {
    if (item.kind === 'headword') {
      const titleParagraph = body.insertParagraph(index++, item.text);
      titleParagraph.setHeading(DocumentApp.ParagraphHeading.HEADING3);
      applyRoleTypography_(titleParagraph, typography, 'hebrew');
      return;
    }
    if (item.kind === 'meta') {
      const metaParagraph = body.insertParagraph(index++, item.text);
      metaParagraph.setHeading(DocumentApp.ParagraphHeading.NORMAL);
      applyRoleTypography_(metaParagraph, typography, 'translation', { style: 'italic' });
      return;
    }
    const paragraph = body.insertParagraph(index++, item.kind === 'blank' ? '' : lexiconRunsText_(item.runs));
    paragraph.setHeading(DocumentApp.ParagraphHeading.NORMAL);
    if (item.kind === 'blank') return;
    if (item.depth) {
      paragraph.setIndentStart(18 * item.depth);
      paragraph.setIndentFirstLine(18 * item.depth);
    }
    // The role's font, size and colour; then the entry's own bold, italics
    // and superscript. Not preserveSourceEmphasis: that applies the
    // translation's Commentary choice, and "Drop" would delete every word of
    // a definition that isn't bold.
    applyRoleTypography_(paragraph, typography, 'translation');
    applyLexiconRunMarks_(paragraph, lexiconRunMarks_(item.runs));
  });

  return { ok: true, inserted: entries.length };
}
