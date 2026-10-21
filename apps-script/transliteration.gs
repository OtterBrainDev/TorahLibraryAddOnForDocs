/* Hebrew transliteration engine with consolidated scheme support, Biblical Hebrew-aware dagesh handling, and user overrides. */
var TRANSLITERATION_SCHEMES = {
  simple_english: {
    name: "Simple English",
    consonants: {"א":"'","ב":"v","ג":"g","ד":"d","ה":"h","ו":"v","ז":"z","ח":"kh","ט":"t","י":"y","כ":"kh","ך":"kh","ל":"l","מ":"m","ם":"m","נ":"n","ן":"n","ס":"s","ע":"'","פ":"f","ף":"f","צ":"ts","ץ":"ts","ק":"k","ר":"r","ש":"sh","ת":"t"},
    dageshForms: {"ב":"b","ג":"g","ד":"d","כ":"k","ך":"k","פ":"p","ף":"p","ת":"t"},
    sin: "s",
    vowels: {"\u05B0":"e","\u05B1":"e","\u05B2":"a","\u05B3":"o","\u05B4":"i","\u05B5":"e","\u05B6":"e","\u05B7":"a","\u05B8":"a","\u05B9":"o","\u05BB":"u","\u05C7":"a"}
  },
  traditional: {
    name: "Traditional",
    consonants: {"א":"ʾ","ב":"v","ג":"g","ד":"d","ה":"h","ו":"v","ז":"z","ח":"ḥ","ט":"t","י":"y","כ":"kh","ך":"kh","ל":"l","מ":"m","ם":"m","נ":"n","ן":"n","ס":"s","ע":"ʿ","פ":"f","ף":"f","צ":"ts","ץ":"ts","ק":"q","ר":"r","ש":"sh","ת":"t"},
    dageshForms: {"ב":"b","ג":"g","ד":"d","כ":"k","ך":"k","פ":"p","ף":"p","ת":"t"},
    sin: "s",
    vowels: {"\u05B0":"e","\u05B1":"e","\u05B2":"a","\u05B3":"o","\u05B4":"i","\u05B5":"e","\u05B6":"e","\u05B7":"a","\u05B8":"a","\u05B9":"o","\u05BB":"u","\u05C7":"a"}
  },
  modern_israeli: {
    name: "Modern Israeli",
    consonants: {"א":"'","ב":"v","ג":"g","ד":"d","ה":"h","ו":"v","ז":"z","ח":"ch","ט":"t","י":"y","כ":"ch","ך":"ch","ל":"l","מ":"m","ם":"m","נ":"n","ן":"n","ס":"s","ע":"'","פ":"f","ף":"f","צ":"tz","ץ":"tz","ק":"k","ר":"r","ש":"sh","ת":"t"},
    dageshForms: {"ב":"b","ג":"g","ד":"d","כ":"k","ך":"k","פ":"p","ף":"p","ת":"t"},
    sin: "s",
    vowels: {"\u05B0":"e","\u05B1":"e","\u05B2":"a","\u05B3":"o","\u05B4":"i","\u05B5":"e","\u05B6":"e","\u05B7":"a","\u05B8":"a","\u05B9":"o","\u05BB":"u","\u05C7":"a"}
  },
  ashkenazi: {
    name: "Ashkenazi",
    consonants: {"א":"'","ב":"v","ג":"g","ד":"d","ה":"h","ו":"v","ז":"z","ח":"kh","ט":"t","י":"y","כ":"kh","ך":"kh","ל":"l","מ":"m","ם":"m","נ":"n","ן":"n","ס":"s","ע":"'","פ":"f","ף":"f","צ":"ts","ץ":"ts","ק":"k","ר":"r","ש":"sh","ת":"s"},
    dageshForms: {"ב":"b","ג":"g","ד":"d","כ":"k","ך":"k","פ":"p","ף":"p","ת":"t"},
    sin: "s",
    vowels: {"\u05B0":"e","\u05B1":"e","\u05B2":"a","\u05B3":"o","\u05B4":"i","\u05B5":"ei","\u05B6":"e","\u05B7":"a","\u05B8":"o","\u05B9":"o","\u05BB":"u","\u05C7":"o"}
  },
  academic_full: {
    name: "Academic (full)",
    consonants: {"א":"ʾ","ב":"v","ג":"g","ד":"d","ה":"h","ו":"w","ז":"z","ח":"ḥ","ט":"ṭ","י":"y","כ":"ḵ","ך":"ḵ","ל":"l","מ":"m","ם":"m","נ":"n","ן":"n","ס":"s","ע":"ʿ","פ":"f","ף":"f","צ":"ṣ","ץ":"ṣ","ק":"q","ר":"r","ש":"š","ת":"ṯ"},
    dageshForms: {"ב":"b","ג":"g","ד":"d","כ":"k","ך":"k","פ":"p","ף":"p","ת":"t"},
    sin: "ś",
    vowels: {"\u05B0":"ə","\u05B1":"ĕ","\u05B2":"ă","\u05B3":"ŏ","\u05B4":"i","\u05B5":"ē","\u05B6":"e","\u05B7":"a","\u05B8":"ā","\u05B9":"ō","\u05BB":"u","\u05C7":"ā"}
  },
  ipa_modern: {
    name: "IPA (Modern Israeli)",
    consonants: {"א":"ʔ","ב":"v","ג":"ɡ","ד":"d","ה":"h","ו":"v","ז":"z","ח":"χ","ט":"t","י":"j","כ":"χ","ך":"χ","ל":"l","מ":"m","ם":"m","נ":"n","ן":"n","ס":"s","ע":"ʔ","פ":"f","ף":"f","צ":"t͡s","ץ":"t͡s","ק":"k","ר":"ʁ","ש":"ʃ","ת":"t"},
    dageshForms: {"ב":"b","ג":"g","ד":"d","כ":"k","ך":"k","פ":"p","ף":"p","ת":"t"},
    sin: "s",
    vowels: {"\u05B0":"e","\u05B1":"e","\u05B2":"a","\u05B3":"o","\u05B4":"i","\u05B5":"e","\u05B6":"e","\u05B7":"a","\u05B8":"a","\u05B9":"o","\u05BB":"u","\u05C7":"a"}
  },
  ipa_tiberian: {
    name: "IPA (Tiberian-ish)",
    consonants: {"א":"ʔ","ב":"v","ג":"ɡ","ד":"d","ה":"h","ו":"w","ז":"z","ח":"ħ","ט":"tˁ","י":"j","כ":"χ","ך":"χ","ל":"l","מ":"m","ם":"m","נ":"n","ן":"n","ס":"s","ע":"ʕ","פ":"f","ף":"f","צ":"sˁ","ץ":"sˁ","ק":"q","ר":"r","ש":"ʃ","ת":"θ"},
    dageshForms: {"ב":"b","ג":"g","ד":"d","כ":"k","ך":"k","פ":"p","ף":"p","ת":"t"},
    sin: "s",
    vowels: {"\u05B0":"ə","\u05B1":"ɛ̆","\u05B2":"ă","\u05B3":"ɔ̆","\u05B4":"i","\u05B5":"eː","\u05B6":"ɛ","\u05B7":"a","\u05B8":"ɔː","\u05B9":"oː","\u05BB":"u","\u05C7":"aː"}
  }
};

var TRANSLITERATION_SCHEME_OPTIONS = [
  { key: "simple_english", label: "Simple English" },
  { key: "traditional", label: "Traditional" },
  { key: "modern_israeli", label: "Modern Israeli" },
  { key: "ashkenazi", label: "Ashkenazi" },
  { key: "academic_full", label: "Academic (full)" },
  { key: "ipa_modern", label: "IPA (Modern Israeli)" },
  { key: "ipa_tiberian", label: "IPA (Tiberian-ish)" }
];

var HEBREW_LETTER_RE = /[\u05D0-\u05EA\u05DA\u05DD\u05DF\u05E3\u05E5]/;
var NIQQUD_RE = /[\u05B0-\u05BC\u05C7]/;
var BGDKPT_RE = /[בגדכפתךף]/;
var VOWEL_RE = /[\u05B1-\u05BB\u05C7]/;
var SHEVA = "\u05B0";
var DAGESH = "\u05BC";
var SHIN_DOT = "\u05C1";
var SIN_DOT = "\u05C2";

// Every cantillation mark, and the marks the schemes have no reading for:
// meteg, rafe and the upper and lower dots. Without the g flag only the first
// mark went, and the rest were copied into the Latin text (yehva + the mark).
var UNREAD_MARKS_RE = /[\u0591-\u05AF\u05BD\u05BF\u05C4\u05C5]/g;

function stripCantillationMarks_(text) {
  return String(text || "").replace(UNREAD_MARKS_RE, "");
}

function isHebrewLetter_(ch) {
  return HEBREW_LETTER_RE.test(ch);
}

function isNiqqudOrMark_(ch) {
  return NIQQUD_RE.test(ch) || ch === SHIN_DOT || ch === SIN_DOT;
}

function nextBaseIndex_(text, idx) {
  for (var j = idx + 1; j < text.length; j += 1) {
    if (isHebrewLetter_(text.charAt(j))) return j;
    if (!isNiqqudOrMark_(text.charAt(j)) && !/\s/.test(text.charAt(j))) return -1;
  }
  return -1;
}

function prevBaseIndex_(text, idx) {
  for (var j = idx - 1; j >= 0; j -= 1) {
    if (isHebrewLetter_(text.charAt(j))) return j;
    if (!isNiqqudOrMark_(text.charAt(j)) && !/\s/.test(text.charAt(j))) return -1;
  }
  return -1;
}

function collectCluster_(text, startIndex) {
  var base = text.charAt(startIndex);
  var marks = [];
  var i = startIndex + 1;
  while (i < text.length && isNiqqudOrMark_(text.charAt(i))) {
    marks.push(text.charAt(i));
    i += 1;
  }
  return {
    base: base,
    marks: marks,
    nextIndex: i,
    hasDagesh: marks.indexOf(DAGESH) !== -1,
    hasShinDot: marks.indexOf(SHIN_DOT) !== -1,
    hasSinDot: marks.indexOf(SIN_DOT) !== -1,
    hasSheva: marks.indexOf(SHEVA) !== -1,
    hasAnyVowel: marks.some(function(mark) { return VOWEL_RE.test(mark) || mark === SHEVA; }),
    hasFullVowel: marks.some(function(mark) { return VOWEL_RE.test(mark); })
  };
}

function startsNewWord_(text, startIndex) {
  var prev = text.charAt(startIndex - 1);
  return startIndex === 0 || /\s|[־\-.,;:!?()\[\]{}"'“”‘’]/.test(prev);
}

function getPrevCluster_(text, startIndex) {
  var prevBase = prevBaseIndex_(text, startIndex);
  return prevBase === -1 ? null : collectCluster_(text, prevBase);
}

function getTransliterationOverrides_() {
  try {
    var raw = PropertiesService.getUserProperties().getProperty("transliteration_overrides") || "{}";
    var parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (error) {
    return {};
  }
}

function detectDageshType_(text, startIndex, cluster, options) {
  if (!cluster.hasDagesh) return "none";

  if (cluster.base === "ה") {
    var nextBase = nextBaseIndex_(text, startIndex);
    if (nextBase === -1) return "mappiq";
  }

  if (!options.isBiblicalHebrew) {
    if (BGDKPT_RE.test(cluster.base)) return "lene";
    return "forte";
  }

  if (!BGDKPT_RE.test(cluster.base)) return "forte";
  if (startsNewWord_(text, startIndex)) return "lene";

  var prevCluster = getPrevCluster_(text, startIndex);
  if (!prevCluster) return "lene";
  if (prevCluster.hasFullVowel) return "forte";
  if (prevCluster.hasSheva) return "lene";
  if (!prevCluster.hasAnyVowel) return "lene";
  return "lene";
}

function maybeDoubleConsonant_(cons, dageshType, options) {
  if (!options.isBiblicalHebrew) return cons;
  if (dageshType === "mappiq") return cons;
  if (options.dageshMode === "forte" && dageshType === "forte") return cons + cons;
  if (options.dageshMode === "all" && dageshType !== "none") return cons + cons;
  return cons;
}

function transliterateCluster_(cluster, scheme, dageshType, options, overrides) {
  var base = cluster.base;
  var cons;

  if (Object.prototype.hasOwnProperty.call(overrides, base)) {
    cons = String(overrides[base]);
  } else if (base === "ש") {
    if (cluster.hasSinDot) cons = scheme.sin || "s";
    else cons = scheme.consonants[base] || "sh";
  } else if (cluster.hasDagesh && scheme.dageshForms[base]) {
    cons = scheme.dageshForms[base];
  } else {
    cons = scheme.consonants[base] || base;
  }

  if (dageshType === "mappiq" && !Object.prototype.hasOwnProperty.call(overrides, base)) cons = "h";
  cons = maybeDoubleConsonant_(cons, dageshType, options);

  if (options.keepNiqqud === false) return cons;

  var vowels = "";
  for (var i = 0; i < cluster.marks.length; i += 1) {
    var mark = cluster.marks[i];
    if (mark === DAGESH || mark === SHIN_DOT || mark === SIN_DOT) continue;
    if (Object.prototype.hasOwnProperty.call(overrides, mark)) {
      vowels += String(overrides[mark]);
    } else if (Object.prototype.hasOwnProperty.call(scheme.vowels, mark)) {
      vowels += scheme.vowels[mark];
    }
  }
  return cons + vowels;
}

function normalizeBiblicalOptions_(options) {
  options = options || {};
  if (typeof options.keepNiqqud === "undefined") options.keepNiqqud = true;
  if (typeof options.isBiblicalHebrew === "undefined") options.isBiblicalHebrew = !!options.isTanakhText;
  if (typeof options.isTanakhText === "undefined") options.isTanakhText = !!options.isBiblicalHebrew;
  if (!options.dageshMode) options.dageshMode = "none";
  return options;
}

// The Name is read, not spelled out: "HaShem", however the text writes it.
// That is יהוה and the substitutes for it, the add-on's (Preferences ->
// Divine Name Mappings) and those Sefaria's texts already use: יי, יקוק,
// ה' and השם. Up to two prefix letters (וַ, לַ, בַּ, מֵ, שֶׁ) keep their own
// reading: לַיהוָה -> laHaShem. IPA reads it too, in IPA (הַשֵּׁם).
var DIVINE_NAME_TRANSLITERATION = "HaShem";
var DIVINE_NAME_SPELLED = "הַשֵּׁם";
var DIVINE_NAME_WORD_RE = /[\u05D0-\u05EA\u05B0-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7]+['\u05F3]?/g;
var DIVINE_NAME_LETTERS_RE = /^([ובכלמש]{0,2})(?:יהוה|יי|יקוק)$|^()(?:ה['\u05F3]|השם)$/;
// Stands in for the Name while the rest of the text is transliterated.
var DIVINE_NAME_PLACEHOLDER = "\uE000";

/** Replaces each spelling of the Name with DIVINE_NAME_PLACEHOLDER, keeping any prefix. */
function markDivineNamesForTransliteration_(text) {
  return text.replace(DIVINE_NAME_WORD_RE, function (word) {
    var match = DIVINE_NAME_LETTERS_RE.exec(word.replace(/[^\u05D0-\u05EA'\u05F3]/g, ""));
    if (!match) return word;
    var prefixLetters = (match[1] || "").length;
    var end = 0;
    for (var seen = 0; end < word.length; end += 1) {
      if (isHebrewLetter_(word.charAt(end)) && seen++ === prefixLetters) break;
    }
    return word.slice(0, end) + DIVINE_NAME_PLACEHOLDER;
  });
}

// Names of people, places and peoples are capitalized, as English writes
// them: Moshe, Yerushalayim, Mitzrayim, Rabbi 'Akiva'. The spellings are
// server/proper-names.gs, generated from STEPBible's tagged Tanakh and a list
// of Talmud sages and places (tools/proper-names/). A pointed word is looked
// up by its pointing first, which settles most words that are also names
// (עֵשָׂו Esau, עָשׂוּ "they did").
var NAME_MARK = "\uE001";
var NAME_WORD_RE = /[\u05D0-\u05EA\u05B0-\u05BC\u05C1\u05C2\u05C7]+['\u05F3]?/g;
var NAME_NIQQUD_RE = /[\u05B0-\u05BC\u05C1\u05C2\u05C7]/;
var NAME_NIQQUD_SAME = { "\u05C7": "\u05B8", "\u05BA": "\u05B9" };
// A sage's titles, capitalized before a name (ר' is Rabbi abbreviated);
// בן and בר ("son of") are not, but a name after any of them is checked
// against the title-only list too.
var NAME_TITLES = { "רבי": true, "רבן": true, "רב": true, "מר": true, "ר'": true };
var NAME_SON_OF = { "בן": true, "בר": true };
// Up to two prefix letters before a Talmud name (ואביי, דרבא, בפומבדיתא),
// a title (ור') or, for a Tanakh name, the Aramaic ד "of" (דשמואל).
var NAME_PREFIX_RE = /^[ובכלמשהד]{1,2}/;
var ARAMAIC_OF_RE = /^ו?ד/;
var properNameTables_ = null;

/** The letters, each followed by its vowel signs sorted; "" if it has none (generate.py: pointed_key). */
function pointedKey_(word) {
  var out = "";
  var marks = null;
  var pointed = false;
  var flush = function () {
    if (marks) out += Object.keys(marks).sort().join("");
  };
  for (var i = 0; i < word.length; i += 1) {
    var ch = word.charAt(i);
    if (isHebrewLetter_(ch)) {
      flush();
      out += ch;
      marks = {};
    } else if (marks && NAME_NIQQUD_RE.test(ch)) {
      marks[NAME_NIQQUD_SAME[ch] || ch] = true;
      pointed = true;
    }
  }
  flush();
  return pointed ? out : "";
}

function hebrewConsonants_(word) {
  return word.replace(/[^\u05D0-\u05EA]/g, "");
}

/** server/proper-names.gs, split into look-ups on first use; null when it is not loaded. */
function getProperNameTables_() {
  if (properNameTables_) return properNameTables_;
  if (typeof PROPER_NAMES_ === "undefined") return null;
  var withPrefix = function (packed) {
    var out = {};
    String(packed).split(" ").forEach(function (word) {
      if (word) out[word.slice(0, -1)] = Number(word.slice(-1));
    });
    return out;
  };
  var set = function (packed) {
    var out = {};
    String(packed).split(" ").forEach(function (word) { if (word) out[word] = true; });
    return out;
  };
  properNameTables_ = {
    pointed: withPrefix(PROPER_NAMES_POINTED_),
    plain: withPrefix(PROPER_NAMES_),
    sure: set(PROPER_NAMES_SURE_),
    pairs: withPrefix(typeof PROPER_NAMES_PAIRS_ === "undefined" ? "" : PROPER_NAMES_PAIRS_),
    talmud: set(PROPER_NAMES_TALMUD_),
    afterTitle: set(PROPER_NAMES_AFTER_TITLE_)
  };
  return properNameTables_;
}

/**
 * How many prefix letters come before the name in `word`, or -1 if it is
 * not a name. `afterTitle`: the word follows a title or בן / בר.
 */
function properNameStart_(word, tables, afterTitle) {
  var consonants = hebrewConsonants_(word);
  var key = pointedKey_(word);
  var has = Object.prototype.hasOwnProperty;
  if (key && has.call(tables.pointed, key)) return tables.pointed[key];
  // Unpointed text: the consonants. Pointed in a way the Tanakh does not
  // point a name: only consonants that are nearly always one (or, after a
  // title, any name's).
  if (has.call(tables.plain, consonants) && (!key || afterTitle || has.call(tables.sure, consonants))) {
    return tables.plain[consonants];
  }
  var of = ARAMAIC_OF_RE.exec(consonants);
  if (of) {
    var named = consonants.slice(of[0].length);
    if (has.call(tables.sure, named)) return of[0].length + tables.plain[named];
  }
  var prefix = NAME_PREFIX_RE.exec(consonants);
  var lengths = prefix ? [0, 1, prefix[0].length] : [0];
  for (var i = 0; i < lengths.length; i += 1) {
    var stem = consonants.slice(lengths[i]);
    if (has.call(tables.talmud, stem) || (afterTitle && has.call(tables.afterTitle, stem))) return lengths[i];
  }
  return -1;
}

/** The number of prefix letters before the title `plain` is (ור': 1), or -1 if it is none. */
function titlePrefix_(plain) {
  var prefix = NAME_PREFIX_RE.exec(plain);
  var lengths = prefix ? [0, 1, prefix[0].length] : [0];
  for (var i = 0; i < lengths.length; i += 1) {
    if (NAME_TITLES[plain.slice(lengths[i])]) return lengths[i];
  }
  return -1;
}

/** The indices in `text` of the first letter of each name (and each title before one). */
function properNameStarts_(text) {
  var tables = getProperNameTables_();
  if (!tables) return null;
  var words = [];
  var match;
  NAME_WORD_RE.lastIndex = 0;
  while ((match = NAME_WORD_RE.exec(text)) !== null) words.push({ index: match.index, text: match[0] });

  var starts = {};
  var letterIndex = function (word, letters) {
    for (var k = 0, seen = 0; k < word.text.length; k += 1) {
      if (isHebrewLetter_(word.text.charAt(k)) && seen++ === letters) return word.index + k;
    }
    return word.index;
  };
  // The words on either side of a space or a maqaf.
  var adjoins = function (first, second) {
    return /^(?:\s+|\u05BE\s*)$/.test(text.slice(first.index + first.text.length, second.index));
  };
  var has = Object.prototype.hasOwnProperty;
  for (var w = 0; w < words.length; w += 1) {
    var word = words[w];
    // A two-word name whose first word is also a word: בֵּית־אֵל.
    var next = w + 1 < words.length && adjoins(word, words[w + 1]) ? words[w + 1] : null;
    if (next) {
      var pointedPair = pointedKey_(word.text) + "+" + pointedKey_(next.text);
      var plainPair = hebrewConsonants_(word.text) + "+" + hebrewConsonants_(next.text);
      var pair = has.call(tables.pairs, pointedPair) ? pointedPair : (has.call(tables.pairs, plainPair) ? plainPair : null);
      if (pair) {
        starts[letterIndex(word, tables.pairs[pair])] = true;
        starts[next.index] = true;
      }
    }
    var previous = w > 0 && adjoins(words[w - 1], word) && !/\u05BE/.test(text.slice(words[w - 1].index + words[w - 1].text.length, word.index)) ? words[w - 1] : null;
    var previousPlain = previous ? hebrewConsonants_(previous.text) + (/['\u05F3]$/.test(previous.text) ? "'" : "") : "";
    var titleAt = previous ? titlePrefix_(previousPlain) : -1;
    var afterTitle = titleAt >= 0 || !!NAME_SON_OF[previousPlain];
    var start = properNameStart_(word.text, tables, afterTitle);
    if (start < 0) continue;
    starts[letterIndex(word, start)] = true;
    if (titleAt >= 0) starts[letterIndex(previous, titleAt)] = true;
  }
  return starts;
}

/** Capitalizes the first letter after each NAME_MARK, and drops the marks. */
function capitalizeProperNames_(text) {
  return text.replace(/\uE001([^\s\p{L}\uE001]*)(\p{Ll})?/gu, function (all, signs, letter) {
    return signs + (letter ? letter.toUpperCase() : "");
  });
}

function isIpaScheme_(schemeKey) {
  return /^ipa_/.test(String(schemeKey || ""));
}

/**
 * Capitalizes the first word of each sentence: at the start of the text (a
 * line, as transliterateHebrewHtmlPreservingBasicBreaks calls it), and after
 * a sof pasuq, a period, a question mark or an exclamation mark. A line
 * marker ("(1) ") and an aleph or ayin sign (', ʾ, ʿ) before the first
 * letter are skipped. Not for IPA, where case is part of the notation.
 */
function capitalizeTransliteration_(text) {
  return text.replace(/(^|[.?!\u05C3]\s*)(\([^)]*\)\s*)?([^\s\p{L}]*)(\p{Ll})/gu, function (all, before, marker, signs, letter) {
    return before + (marker || "") + signs + letter.toUpperCase();
  });
}

function transliterateLetters_(cleaned, scheme, options, overrides, nameStarts) {
  var out = "";
  for (var i = 0; i < cleaned.length;) {
    var ch = cleaned.charAt(i);
    if (!isHebrewLetter_(ch)) {
      if (!isNiqqudOrMark_(ch)) out += ch;
      i += 1;
      continue;
    }

    var cluster = collectCluster_(cleaned, i);
    var dageshType = detectDageshType_(cleaned, i, cluster, options);
    // In the Latin text, not the Hebrew, so it cannot change how a letter reads.
    if (nameStarts && nameStarts[i]) out += NAME_MARK;
    out += transliterateCluster_(cluster, scheme, dageshType, options, overrides);
    i = cluster.nextIndex;
  }
  return out;
}

function transliterateHebrewText(text, schemeKey, options) {
  options = normalizeBiblicalOptions_(options);
  var cleaned = stripCantillationMarks_(String(text || ""));
  if (!cleaned) return "";

  var scheme = TRANSLITERATION_SCHEMES[schemeKey] || TRANSLITERATION_SCHEMES.simple_english;
  var overrides = options.overrideMap || getTransliterationOverrides_();
  var ipa = isIpaScheme_(schemeKey);
  var marked = markDivineNamesForTransliteration_(cleaned);
  var out = transliterateLetters_(marked, scheme, options, overrides, ipa ? null : properNameStarts_(marked));
  if (out.indexOf(DIVINE_NAME_PLACEHOLDER) >= 0) {
    var name = ipa
      ? transliterateLetters_(DIVINE_NAME_SPELLED, scheme, { keepNiqqud: true, isBiblicalHebrew: false, dageshMode: "none" }, {})
      : DIVINE_NAME_TRANSLITERATION;
    out = out.split(DIVINE_NAME_PLACEHOLDER).join(name);
  }

  out = out.replace(/\s+/g, " ").replace(/['ʾ]\s+/g, " ").trim();
  return ipa ? out : capitalizeTransliteration_(capitalizeProperNames_(out));
}

function transliterateHebrewHtmlPreservingBasicBreaks(html, schemeKey, options) {
  var text = decodeHTMLEntities(
    String(html || "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<[^>]*>/g, "")
  );
  var lines = text.split(/\n+/);
  var out = [];
  for (var i = 0; i < lines.length; i += 1) {
    var line = lines[i].trim();
    if (line) out.push(transliterateHebrewText(line, schemeKey, options));
  }
  return out.join("\n");
}

function previewTransliterationWithOverrides(text, schemeKey) {
  return transliterateHebrewText(text, schemeKey, {
    keepNiqqud: true,
    isBiblicalHebrew: false,
    dageshMode: "none"
  });
}
