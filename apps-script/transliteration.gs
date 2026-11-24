/* Hebrew transliteration engine: reads each pointed word by the rules of Hebrew reading (vowel letters, spoken and silent sh'va, kamatz katan, dagesh chazak), in any of the schemes, with user overrides. */
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
  // ALA-LC Hebrew romanization (Library of Congress; the table IJMES
  // requires for Hebrew): ʼ alef, ṿ consonantal vav, ḥ, ṭ, ḳ, ś, ʻ ayin; the
  // hard and soft ג ד ת alike.
  ala_lc: {
    name: "ALA-LC (Library of Congress)",
    consonants: {"א":"\u02BC","ב":"v","ג":"g","ד":"d","ה":"h","ו":"\u1E7F","ז":"z","ח":"\u1E25","ט":"\u1E6D","י":"y","כ":"kh","ך":"kh","ל":"l","מ":"m","ם":"m","נ":"n","ן":"n","ס":"s","ע":"\u02BB","פ":"f","ף":"f","צ":"ts","ץ":"ts","ק":"\u1E33","ר":"r","ש":"sh","ת":"t"},
    dageshForms: {"ב":"b","ג":"g","ד":"d","כ":"k","ך":"k","פ":"p","ף":"p","ת":"t"},
    sin: "\u015B",
    vowels: {"\u05B0":"e","\u05B1":"e","\u05B2":"a","\u05B3":"o","\u05B4":"i","\u05B5":"e","\u05B6":"e","\u05B7":"a","\u05B8":"a","\u05B9":"o","\u05BB":"u","\u05C7":"o"}
  },
  // BGN/PCGN 2018 agreement (the Academy of the Hebrew Language's 2006/2011
  // system): ’ alef, ‘ ayin, ẖ, q; v for every vav; no final silent he; a
  // dagesh chazak always doubled.
  bgn_pcgn: {
    name: "BGN/PCGN 2018 (Hebrew Academy)",
    consonants: {"א":"\u2019","ב":"v","ג":"g","ד":"d","ה":"h","ו":"v","ז":"z","ח":"\u1E96","ט":"t","י":"y","כ":"kh","ך":"kh","ל":"l","מ":"m","ם":"m","נ":"n","ן":"n","ס":"s","ע":"\u2018","פ":"f","ף":"f","צ":"ts","ץ":"ts","ק":"q","ר":"r","ש":"sh","ת":"t"},
    dageshForms: {"ב":"b","ג":"g","ד":"d","כ":"k","ך":"k","פ":"p","ף":"p","ת":"t"},
    sin: "s",
    vowels: {"\u05B0":"e","\u05B1":"e","\u05B2":"a","\u05B3":"o","\u05B4":"i","\u05B5":"e","\u05B6":"e","\u05B7":"a","\u05B8":"a","\u05B9":"o","\u05BB":"u","\u05C7":"o"}
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
  { key: "ala_lc", label: "ALA-LC (Library of Congress)" },
  { key: "bgn_pcgn", label: "BGN/PCGN 2018 (Hebrew Academy)" },
  { key: "ipa_modern", label: "IPA (Modern Israeli)" },
  { key: "ipa_tiberian", label: "IPA (Tiberian-ish)" }
];

// How each scheme writes what the letter tables cannot say alone: the vowel
// letters (a yod, vav or he that only lengthens a vowel), a kamatz katan, a
// silent aleph, and a guttural at the start of a word. Read by readWord_.
//   kamatzKatan  the short kamatz (kol, chokhmah)
//   shuruk       וּ;  holamMale  וֹ (and a holam before a plain vav)
//   hiriqYod / tsereYod / segolYod  a vowel and the yod that lengthens it
//   yodGlide     the yod after patach or kamatz (Adonai, chai)
//   initialAlef / initialAyin  the letter at the start of a word
//   quietAlef    an aleph with no vowel of its own (bereshit, rosh)
//   finalHe      the silent he at the end of a word (Torah)
var TRANSLITERATION_READINGS = {
  simple_english: { kamatzKatan: "o", shuruk: "u", holamMale: "o", hiriqYod: "i", tsereYod: "ei", segolYod: "e", yodGlide: "i", initialAlef: "", initialAyin: "", quietAlef: "", finalHe: "h" },
  traditional: { kamatzKatan: "o", shuruk: "u", holamMale: "o", hiriqYod: "i", tsereYod: "ei", segolYod: "e", yodGlide: "i", initialAlef: "", initialAyin: "ʿ", quietAlef: "", finalHe: "h" },
  modern_israeli: { kamatzKatan: "o", shuruk: "u", holamMale: "o", hiriqYod: "i", tsereYod: "ei", segolYod: "e", yodGlide: "i", initialAlef: "", initialAyin: "", quietAlef: "", finalHe: "h" },
  ashkenazi: { kamatzKatan: "o", shuruk: "u", holamMale: "o", hiriqYod: "i", tsereYod: "ei", segolYod: "e", yodGlide: "i", initialAlef: "", initialAyin: "", quietAlef: "", finalHe: "h" },
  academic_full: { kamatzKatan: "o", shuruk: "û", holamMale: "ô", hiriqYod: "î", tsereYod: "ê", segolYod: "ê", yodGlide: "y", initialAlef: "ʾ", initialAyin: "ʿ", quietAlef: "ʾ", finalHe: "h" },
  // ALA-LC also hyphenates the article, the conjunction and the prepositions
  // that take the article (ha-, ṿe-, u-, ba-, mi-, she-), and puts a prime
  // between two letters that would otherwise read as one sound (hisʹhid).
  ala_lc: { kamatzKatan: "o", shuruk: "u", holamMale: "o", hiriqYod: "i", tsereYod: "e", segolYod: "e", yodGlide: "i", initialAlef: "", initialAyin: "\u02BB", quietAlef: "", finalHe: "h", prefixHyphen: true, digraphPrime: "\u02B9" },
  // BGN/PCGN: a dagesh chazak is always doubled (but not sh, ts or kh).
  bgn_pcgn: { kamatzKatan: "o", shuruk: "u", holamMale: "o", hiriqYod: "i", tsereYod: "e", segolYod: "e", yodGlide: "y", initialAlef: "", initialAyin: "\u2018", quietAlef: "", finalHe: "", alwaysDoubleDagesh: true },
  ipa_modern: { kamatzKatan: "o", shuruk: "u", holamMale: "o", hiriqYod: "i", tsereYod: "ej", segolYod: "e", yodGlide: "j", initialAlef: "ʔ", initialAyin: "ʔ", quietAlef: "", finalHe: "" },
  ipa_tiberian: { kamatzKatan: "ɔ", shuruk: "uː", holamMale: "oː", hiriqYod: "iː", tsereYod: "eː", segolYod: "ɛː", yodGlide: "j", initialAlef: "ʔ", initialAyin: "ʕ", quietAlef: "", finalHe: "" }
};

var HEBREW_LETTER_RE = /[א-תךםןףץ]/;
var NIQQUD_RE = /[ְ-ׇּ]/;
var BGDKPT_RE = /[בגדכפתךף]/;
var VOWEL_RE = /[ֱ-ׇֻ]/;
var SHEVA = "ְ";
var HATAF_SEGOL = "ֱ";
var HATAF_PATAH = "ֲ";
var HATAF_QAMATS = "ֳ";
var HIRIQ = "ִ";
var TSERE = "ֵ";
var SEGOL = "ֶ";
var PATAH = "ַ";
var QAMATS = "ָ";
var HOLAM = "ֹ";
var HOLAM_HASER_FOR_VAV = "ֺ";
var QUBUTS = "ֻ";
var DAGESH = "ּ";
var METEG = "ֽ";
var SHIN_DOT = "ׁ";
var SIN_DOT = "ׂ";
var QAMATS_QATAN = "ׇ";
// Stands for a cantillation mark on the stressed syllable while a word is read
// (prepareMarksForReading_); never written out.
var STRESS_MARK = "";

// The marks the schemes have no reading for: rafe, the upper and lower dots
// and the masora circle. Cantillation marks go too, once they have told the
// reader where the stress is (prepareMarksForReading_).
var UNREAD_MARKS_RE = /[ֿׅ֯ׄ]/g;
var CANTILLATION_RE = /[֑-֮]/;
// Accents printed on the first or last letter of a word whatever its stress.
var PREPOSITIVE_ACCENTS = { "֚": true, "֠": true, "֭": true };
var POSTPOSITIVE_ACCENTS = { "֒": true, "֙": true, "֩": true, "֮": true };

/**
 * Keeps what the reader needs of the cantillation: each accent on a stressed
 * syllable becomes STRESS_MARK, a prepositive or postpositive one (on the
 * word's first or last letter whatever the stress) goes, and so do rafe and
 * the dots. Meteg is kept.
 */
function prepareMarksForReading_(text) {
  var source = String(text || "").replace(UNREAD_MARKS_RE, "");
  return source.replace(/[א-ת][֑-ׇא-ת]*/g, function (word) {
    var firstLetter = 0;
    var lastLetter = 0;
    for (var i = 0; i < word.length; i += 1) {
      if (isHebrewLetter_(word.charAt(i))) lastLetter = i;
    }
    var out = "";
    var letter = -1;
    for (var j = 0; j < word.length; j += 1) {
      var ch = word.charAt(j);
      if (isHebrewLetter_(ch)) letter = j;
      if (!CANTILLATION_RE.test(ch)) { out += ch; continue; }
      if (letter === lastLetter && lastLetter !== firstLetter && POSTPOSITIVE_ACCENTS[ch]) continue;
      if (letter === firstLetter && lastLetter !== firstLetter && PREPOSITIVE_ACCENTS[ch]) continue;
      out += STRESS_MARK;
    }
    return out;
  });
}

/** Removes every cantillation mark, meteg and unread dot. */
function stripCantillationMarks_(text) {
  return String(text || "").replace(UNREAD_MARKS_RE, "").replace(/[֑-ֽ֮]/g, "");
}

function isHebrewLetter_(ch) {
  return HEBREW_LETTER_RE.test(ch);
}

function isNiqqudOrMark_(ch) {
  return NIQQUD_RE.test(ch) || ch === SHIN_DOT || ch === SIN_DOT || ch === METEG || ch === STRESS_MARK;
}

function collectCluster_(text, startIndex) {
  var base = text.charAt(startIndex);
  var marks = [];
  var i = startIndex + 1;
  while (i < text.length && isNiqqudOrMark_(text.charAt(i))) {
    marks.push(text.charAt(i));
    i += 1;
  }
  var vowel = "";
  marks.forEach(function (mark) {
    if (!vowel && VOWEL_RE.test(mark)) vowel = mark;
  });
  return {
    base: base,
    marks: marks,
    start: startIndex,
    nextIndex: i,
    vowel: vowel,
    hasDagesh: marks.indexOf(DAGESH) !== -1,
    hasShinDot: marks.indexOf(SHIN_DOT) !== -1,
    hasSinDot: marks.indexOf(SIN_DOT) !== -1,
    hasSheva: marks.indexOf(SHEVA) !== -1,
    hasMeteg: marks.indexOf(METEG) !== -1,
    hasStress: marks.indexOf(STRESS_MARK) !== -1,
    hasAnyVowel: marks.some(function(mark) { return VOWEL_RE.test(mark) || mark === SHEVA; }),
    hasFullVowel: !!vowel
  };
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

/** The stored "Double dagesh chazak" choice: "forte" or "none". */
function getStoredDageshMode_() {
  try {
    return PropertiesService.getUserProperties().getProperty("transliteration_biblical_dagesh_mode") === "forte" ? "forte" : "none";
  } catch (error) {
    return "none";
  }
}

var has_ = Object.prototype.hasOwnProperty;

/** Final letters read as their ordinary forms when two letters are compared. */
var FINAL_LETTER_FORMS_ = { "ך": "כ", "ם": "מ", "ן": "נ", "ף": "פ", "ץ": "צ" };
function plainLetter_(ch) {
  return FINAL_LETTER_FORMS_[ch] || ch;
}

/**
 * A letter's sound: shin or sin, the hard or soft form of בגדכפת, else the
 * scheme's. A Transliteration Mapping override replaces it, for a letter that
 * changes with a dagesh only in its soft form (כ -> "ch" leaves כּ "k").
 */
function consonantSound_(cluster, scheme, overrides) {
  var base = cluster.base;
  var hard = cluster.hasDagesh && scheme.dageshForms[base];
  if (has_.call(overrides, base) && !hard) return String(overrides[base]);
  if (base === "ש") {
    if (cluster.hasSinDot) return scheme.sin || "s";
    return scheme.consonants[base] || "sh";
  }
  if (hard) return scheme.dageshForms[base];
  return scheme.consonants[base] || base;
}

/** A letter and its vowel signs, letter by letter: for words with no vowels, and for "consonants only". */
function transliterateCluster_(cluster, scheme, options, overrides) {
  var cons = consonantSound_(cluster, scheme, overrides);
  if (options.keepNiqqud === false) return cons;
  var vowels = "";
  for (var i = 0; i < cluster.marks.length; i += 1) {
    var mark = cluster.marks[i];
    if (has_.call(overrides, mark)) {
      vowels += String(overrides[mark]);
    } else if (has_.call(scheme.vowels, mark)) {
      vowels += scheme.vowels[mark];
    }
  }
  return cons + vowels;
}

// ── Reading a pointed word ───────────────────────────────────────────────
//
// A word is read as a whole, the way the standard rules of Hebrew reading
// read it, before any letter is written:
//   - a vav with a dagesh and no vowel is shuruk (u), and a vav with a holam
//     after a letter with no vowel is holam male (o): the vav is not a "v";
//   - a yod with no vowel after hiriq, tsere or segol, a he at the end of a
//     word and an aleph with no vowel are silent letters, not consonants;
//   - a sh'va is spoken (e) at the start of a word, under a doubled letter,
//     after another sh'va, before the same letter, after a long vowel or a
//     meteg; otherwise it closes the syllable and is silent;
//   - a kamatz is katan (o) where Sefaria's text marks it (U+05C7), and,
//     in text that never marks it, in a closed unstressed syllable (before a
//     silent sh'va or a hataf kamatz) and in kol; anywhere else it is gadol;
//   - a dagesh after a vowel is chazak, doubling the letter when the "Double
//     dagesh chazak" setting is on; at the start of a word or after a silent
//     sh'va it only hardens בגדכפת;
//   - a patach under a final ח, ע or הּ is read before the letter (ruach).

/** Each letter of `word` (letters and marks only) as a cluster. */
function wordClusters_(text, start, end) {
  var clusters = [];
  for (var i = start; i < end;) {
    if (!isHebrewLetter_(text.charAt(i))) { i += 1; continue; }
    var cluster = collectCluster_(text, i);
    clusters.push(cluster);
    i = cluster.nextIndex;
  }
  return clusters;
}

function isLongVowelCluster_(cluster) {
  if (cluster.male) return true;
  if (cluster.role === "shuruk") return true;
  if (cluster.vowel === TSERE || cluster.vowel === HOLAM || cluster.vowel === HOLAM_HASER_FOR_VAV) return true;
  return cluster.vowel === QAMATS && cluster.kamatz === "gadol";
}

function isBareCluster_(c) {
  return !c.vowel && !c.hasSheva && !c.hasDagesh && !c.male;
}

/**
 * Marks the vowel letters: shuruk, holam male, and a silent yod, he or aleph;
 * and the holam a shin or sin dot stands for (מֹשֶׁה printed משֶׁה, שֹׂנֵא שׂנֵא).
 */
function markVowelLetters_(clusters) {
  var last = clusters.length - 1;
  clusters.forEach(function (c, i) {
    var next = clusters[i + 1];
    if (i === last || !isBareCluster_(c) || /[אהוי]/.test(c.base)) return;
    if (c.base === "ש" && c.hasSinDot && next.base !== "ו") c.vowel = HOLAM;
    else if (next.base === "ש" && next.hasShinDot && (next.vowel || next.hasSheva)) c.vowel = HOLAM;
  });
  clusters.forEach(function (c, i) {
    var prev = i > 0 ? clusters[i - 1] : null;
    var next = clusters[i + 1];
    var prevBare = !!prev && !prev.vowel && !prev.hasSheva && !prev.male && prev.role !== "shuruk";
    if (c.base !== "ו") return;
    var onlyDagesh = c.hasDagesh && !c.vowel && !c.hasSheva;
    if (onlyDagesh && prevBare) {
      prev.male = "u";
      c.role = "mater";
    } else if (onlyDagesh) {
      c.role = "shuruk";
    } else if (c.vowel === HOLAM && !c.hasSheva && prevBare) {
      prev.male = "o";
      c.role = "mater";
    } else if (isBareCluster_(c) && prev && prev.vowel === HOLAM) {
      // The holam written on the letter before its vav.
      c.role = "mater";
    } else if (isBareCluster_(c) && prev && prev.vowel === HIRIQ && next && next.base === "א" && i + 1 === last && isBareCluster_(next)) {
      // הִוא, read as it is pointed: hi.
      c.role = "mater";
    }
  });
  clusters.forEach(function (c, i) {
    var prev = i > 0 ? clusters[i - 1] : null;
    if (c.role) return;
    var bare = isBareCluster_(c);
    if (c.base === "י" && bare && prev) {
      var next = clusters[i + 1];
      var finalVav = next && next.base === "ו" && isBareCluster_(next) && i + 1 === last;
      if (prev.vowel === HIRIQ) { c.role = "mater"; prev.male = "i"; }
      else if (prev.vowel === TSERE) { c.role = "mater"; prev.male = "ei"; }
      else if (prev.vowel === SEGOL) { c.role = "mater"; prev.male = "e"; }
      else if (prev.vowel === QAMATS && finalVav) { c.role = "mater"; }
      else if (prev.vowel === PATAH || prev.vowel === QAMATS) { c.role = "glide"; }
    } else if (c.base === "ה" && i === last && i > 0 && !c.vowel && !c.hasSheva && !c.hasDagesh) {
      c.role = "finalHe";
    } else if (c.base === "א" && !c.vowel && !c.male && !c.hasSheva && i > 0) {
      // With a sh'va the aleph is a consonant (BGN/PCGN note 1: Ne’dar).
      c.role = "quiet";
    }
  });
}

/** Kamatz gadol or katan, for each kamatz (see above). */
function markKamatz_(clusters, explicitKamatz) {
  var prefixLetters = /^[ובכלמשהד]*$/;
  clusters.forEach(function (c, i) {
    if (c.vowel === QAMATS_QATAN || c.vowel === HATAF_QAMATS) { c.kamatz = "katan"; return; }
    if (c.vowel !== QAMATS) return;
    c.kamatz = "gadol";
    if (explicitKamatz || c.hasMeteg || c.hasStress) return;
    var next = clusters[i + 1];
    var last = clusters.length - 1;
    var prefixes = clusters.slice(0, i).map(function (p) { return p.base; }).join("");
    // kol, with any prefixes: כָּל, וְכָל, בְּכָל־
    if (c.base === "כ" && i === last - 1 && next.base === "ל" && !next.vowel && prefixLetters.test(prefixes)) { c.kamatz = "katan"; return; }
    if (!next || i + 1 === last) return;
    if (next.vowel === HATAF_QAMATS) { c.kamatz = "katan"; return; }
    // The article before a guttural or resh: haresha'im.
    if (c.base === "ה" && (prefixes === "" || prefixes === "ו") && /[אהחער]/.test(next.base)) return;
    // A yod or vav with sh'va makes a diphthong (hayta, layla), not a closed syllable.
    if (!next.hasSheva || next.vowel || next.hasDagesh || next.base === "י" || next.base === "ו") return;
    var after = clusters[i + 2];
    if (after && plainLetter_(after.base) === plainLetter_(next.base)) return;
    // A soft בגדכפת after the sh'va shows it is spoken, a hard one that it closes the syllable.
    if (after && BGDKPT_RE.test(after.base)) {
      if (after.hasDagesh) c.kamatz = "katan";
      return;
    }
    // The perfect and imperative plural (shamru, barkhu): C ָ C ְ C וּ.
    var plural = after && i + 3 === last && clusters[i + 3].base === "ו" && clusters[i + 3].hasDagesh && !clusters[i + 3].vowel;
    if (plural) return;
    // Otherwise only in the word's first syllable (chokhmah, kodsh'kha, oznayim).
    if (prefixLetters.test(prefixes)) c.kamatz = "katan";
  });
}

/** Dagesh chazak (the letter is doubled) or lene, for each dagesh. */
function markDagesh_(clusters) {
  clusters.forEach(function (c, i) {
    if (!c.hasDagesh || c.role === "shuruk" || c.role === "mater") return;
    if (c.base === "ה" && i === clusters.length - 1) { c.dagesh = "mappiq"; return; }
    var prev = i > 0 ? clusters[i - 1] : null;
    var afterVowel = !!prev && (!!prev.vowel || !!prev.male || prev.role === "shuruk" || prev.role === "mater" || prev.role === "glide");
    c.dagesh = afterVowel ? "chazak" : "lene";
  });
}

/** Spoken or silent, for each sh'va (see above). */
function markShevas_(clusters) {
  var last = clusters.length - 1;
  clusters.forEach(function (c, i) {
    if (!c.hasSheva || c.vowel) return;
    if (i === last) { c.sheva = "silent"; return; }
    if (i === 0) { c.sheva = "vocal"; return; }
    var prev = clusters[i - 1];
    var next = clusters[i + 1];
    if (c.dagesh === "chazak") { c.sheva = "vocal"; return; }
    if (prev.hasSheva && !prev.vowel) { c.sheva = prev.sheva === "vocal" ? "silent" : "vocal"; return; }
    // The last letter but a silent aleph: chet.
    if (i + 1 === last && next.role === "quiet") { c.sheva = "silent"; return; }
    if (plainLetter_(next.base) === plainLetter_(c.base)) { c.sheva = "vocal"; return; }
    // A yod after patach or kamatz closes a diphthong (layla, chayto), but the
    // yod of vayyiqtol keeps the sh'va of its lost dagesh (vayehi, vayevarekh).
    // After the article a mem or yod keeps the sh'va of its lost dagesh too
    // (ham'varekh, hay'ladim).
    var article = prev.base === "ה" && prev.vowel === PATAH && (i === 1 || i === 2 && clusters[0].base === "ו");
    if (article && (c.base === "מ" || c.base === "י")) { c.sheva = "vocal"; return; }
    if (c.base === "י" && (prev.vowel === PATAH || prev.vowel === QAMATS)) {
      c.sheva = i === 1 && prev.base === "ו" && prev.vowel === PATAH ? "vocal" : "silent";
      return;
    }
    // A hard בגדכפת after it closes the syllable: natata, not nata'eta.
    if (BGDKPT_RE.test(next.base) && next.hasDagesh) { c.sheva = "silent"; return; }
    var vowelCarrier = prev.role === "mater" || prev.role === "quiet" ? clusters[i - 2] : prev;
    c.sheva = vowelCarrier && isLongVowelCluster_(vowelCarrier) ? "vocal" : "silent";
  });
}

/** The vowel a cluster is read with, in `scheme`, with the user's overrides. */
function vowelSound_(c, scheme, reading, overrides) {
  var mark = c.vowel;
  if (c.male === "u") return has_.call(overrides, QUBUTS) ? String(overrides[QUBUTS]) : reading.shuruk;
  if (c.male === "o") return has_.call(overrides, HOLAM) ? String(overrides[HOLAM]) : reading.holamMale;
  if (c.male === "i") return has_.call(overrides, HIRIQ) ? String(overrides[HIRIQ]) : reading.hiriqYod;
  if (c.male === "ei") return has_.call(overrides, TSERE) ? String(overrides[TSERE]) : reading.tsereYod;
  if (c.male === "e") return has_.call(overrides, SEGOL) ? String(overrides[SEGOL]) : reading.segolYod;
  if (!mark) {
    if (c.sheva === "vocal") return has_.call(overrides, SHEVA) ? String(overrides[SHEVA]) : scheme.vowels[SHEVA];
    return "";
  }
  if (mark === QAMATS || mark === QAMATS_QATAN) {
    if (c.kamatz === "katan") return has_.call(overrides, QAMATS_QATAN) ? String(overrides[QAMATS_QATAN]) : reading.kamatzKatan;
    return has_.call(overrides, QAMATS) ? String(overrides[QAMATS]) : scheme.vowels[QAMATS];
  }
  if (mark === HOLAM_HASER_FOR_VAV) mark = HOLAM;
  var out = has_.call(overrides, mark) ? String(overrides[mark]) : (scheme.vowels[mark] || "");
  // Yerushalayim: a hiriq beside the patach stands for a yod and its vowel.
  if (mark === PATAH && c.marks.indexOf(HIRIQ) !== -1) out += scheme.consonants["י"] + (has_.call(overrides, HIRIQ) ? String(overrides[HIRIQ]) : scheme.vowels[HIRIQ]);
  return out;
}

/**
 * The Latin text of one pointed word (`clusters`, from wordClusters_), and the
 * NAME_MARK before any letter that starts a name.
 */
/**
 * For a style that hyphenates prefixes (ALA-LC): the clusters a hyphen
 * follows. Only the prefixes the pointing shows: the conjunction ו, then
 * the article ה (ha-, he-) and the prepositions that take it (ba-, la-, ka-),
 * mi- and she- before a doubled letter. A ב, כ or ל with sh'va (be-, le-,
 * ke-) is left alone: the pointing cannot tell it from the word's own first
 * letter (be-reshit, but levav).
 */
function prefixHyphens_(clusters) {
  var after = {};
  var silent = { mater: true, finalHe: true, quiet: true, glide: true };
  var pronounced = function (from) {
    var count = 0;
    for (var j = from + 1; j < clusters.length; j += 1) if (!silent[clusters[j].role]) count += 1;
    return count;
  };
  var k = 0;
  var first = clusters[0];
  var second = clusters[1];
  if (!second) return after;
  if (first.base === "ו" && pronounced(0) >= 2 && (
    (first.hasSheva && !first.vowel) || first.role === "shuruk" ||
    (first.vowel === PATAH && second.dagesh === "chazak") || first.vowel === QAMATS || first.vowel === SEGOL)) {
    after[0] = true;
    k = 1;
  }
  var c = clusters[k];
  var next = clusters[k + 1];
  if (!c || !next || pronounced(k) < 2) return after;
  var doubled = next.dagesh === "chazak";
  if ((c.base === "ה" && (c.vowel === PATAH && doubled || c.vowel === QAMATS && /[אע]/.test(next.base) || c.vowel === SEGOL && /[הח]/.test(next.base))) ||
      (/[בכל]/.test(c.base) && ((c.vowel === PATAH || c.vowel === QAMATS) && doubled || c.vowel === QAMATS && next.base === "א")) ||
      (c.base === "מ" && (c.vowel === HIRIQ && doubled || c.vowel === TSERE && /[אהחע]/.test(next.base))) ||
      (c.base === "ש" && c.hasShinDot && c.vowel === SEGOL && doubled)) {
    after[k] = true;
  }
  return after;
}

/**
 * The Latin text of one pointed word (`clusters`, from wordClusters_), and the
 * NAME_MARK before any letter that starts a name.
 */
function readWord_(clusters, scheme, reading, options, overrides, nameStarts) {
  markVowelLetters_(clusters);
  markKamatz_(clusters, options.explicitKamatz);
  markDagesh_(clusters);
  markShevas_(clusters);
  var hyphens = reading.prefixHyphen ? prefixHyphens_(clusters) : {};
  var doubling = reading.alwaysDoubleDagesh || options.dageshMode !== "none";
  var out = "";
  var last = clusters.length - 1;
  // ALA-LC's prime: two letters that would read as one sound (s + h, k + h, t + s).
  var append = function (piece) {
    if (reading.digraphPrime && piece) {
      var before = out.replace(/\uE001+$/, "").slice(-1).toLowerCase();
      var start = piece.replace(/^\uE001+/, "").charAt(0).toLowerCase();
      if ((before === "s" || before === "k") && start === "h" || before === "t" && start === "s") out += reading.digraphPrime;
    }
    out += piece;
  };
  clusters.forEach(function (c, i) {
    if (nameStarts && nameStarts[c.start]) out += NAME_MARK;
    var initial = i === 0 || !!hyphens[i - 1];
    if (c.role === "mater") return;
    if (c.role === "glide") { out += has_.call(overrides, "י") ? String(overrides["י"]) : reading.yodGlide; return; }
    if (c.role === "finalHe") { out += reading.finalHe; return; }
    if (c.role === "quiet") { out += reading.quietAlef; return; }
    var vowel = vowelSound_(c, scheme, reading, overrides);
    if (c.role === "shuruk") {
      out += has_.call(overrides, QUBUTS) ? String(overrides[QUBUTS]) : reading.shuruk;
      if (hyphens[i]) out += "-";
      return;
    }
    var cons;
    if (initial && (c.base === "א" || c.base === "ע") && !has_.call(overrides, c.base)) {
      cons = c.base === "א" ? reading.initialAlef : reading.initialAyin;
    } else if (c.dagesh === "mappiq") {
      cons = has_.call(overrides, "ה") ? String(overrides["ה"]) : scheme.consonants["ה"];
    } else {
      cons = consonantSound_(c, scheme, overrides);
    }
    var single = Array.from(cons.normalize("NFC")).length === 1;
    // A name's first letter after a prefix keeps its capital and is not
    // doubled (BGN/PCGN note 4: HaYogev, miMitsrayim).
    var nameStart = !!(nameStarts && nameStarts[c.start]);
    if (c.dagesh === "chazak" && doubling && i !== last && single && !nameStart) cons += cons;
    var furtive = i === last && i > 0 && c.vowel === PATAH && (c.base === "ח" || c.base === "ע" || c.dagesh === "mappiq");
    append(furtive ? vowel + cons : cons + vowel);
    if (hyphens[i]) out += "-";
  });
  return out;
}

function normalizeBiblicalOptions_(options) {
  options = options || {};
  if (typeof options.keepNiqqud === "undefined") options.keepNiqqud = true;
  if (typeof options.isBiblicalHebrew === "undefined") options.isBiblicalHebrew = !!options.isTanakhText;
  if (typeof options.isTanakhText === "undefined") options.isTanakhText = !!options.isBiblicalHebrew;
  // The "Double dagesh chazak" setting, unless the caller passes its own.
  if (!options.dageshMode) options.dageshMode = getStoredDageshMode_();
  if (options.dageshMode === "all") options.dageshMode = "forte";
  return options;
}

// The Name is read, not spelled out, however the text writes it: יהוה and
// the substitutes for it, the add-on's (Preferences -> Divine Name Mappings)
// and those Sefaria's texts already use: יי, יקוק, ה' and השם. It is written
// as the reader chooses, in every style (`transliteration_divine_name`,
// Preferences -> Insertion -> Transliteration Mapping): "HaShem" unless they
// choose another. Up to two prefix letters keep their own reading:
// לַיהוָה -> laHaShem. IPA reads it in IPA: HaShem and Adonai as Hebrew
// (DIVINE_NAME_IPA_SPELLINGS), any other spelling as it is written.
var DIVINE_NAME_TRANSLITERATION = "HaShem";
var DIVINE_NAME_MAX_CHARS = 40;
var DIVINE_NAME_IPA_SPELLINGS = {
  hashem: "\u05D4\u05B7\u05E9\u05BC\u05C1\u05B5\u05DD",
  adonai: "\u05D0\u05B2\u05D3\u05B9\u05E0\u05B8\u05D9"
};
["adonay", "adonoy", "adonoi"].forEach(function (spelling) { DIVINE_NAME_IPA_SPELLINGS[spelling] = DIVINE_NAME_IPA_SPELLINGS.adonai; });

/** A stored or passed spelling of the Name, cleaned: plain text, one line, at most 40 characters; else "HaShem". */
function normalizeDivineName_(value) {
  var text = String(value == null ? "" : value)
    .replace(/[\u0000-\u001F\u007F<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, DIVINE_NAME_MAX_CHARS)
    .trim();
  return text || DIVINE_NAME_TRANSLITERATION;
}

/** The stored spelling of the Name for the transliteration. */
function getStoredDivineName_() {
  try {
    return normalizeDivineName_(PropertiesService.getUserProperties().getProperty("transliteration_divine_name"));
  } catch (error) {
    return DIVINE_NAME_TRANSLITERATION;
  }
}

/** The Name as `scheme` writes it: the reader's spelling; in IPA, read as Hebrew where it is HaShem or Adonai. */
function divineNameFor_(name, scheme, reading, ipa) {
  if (!ipa) return name;
  var spelled = DIVINE_NAME_IPA_SPELLINGS[name.toLowerCase().replace(/[^a-z]/g, "")];
  if (!spelled) return name;
  return transliterateLetters_(spelled, scheme, { keepNiqqud: true, dageshMode: "none" }, {}, null, reading);
}
var DIVINE_NAME_WORD_RE = /[\u05D0-\u05EA\u05B0-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7\uE002]+['\u05F3]?/g;
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
// them: Moshe, Yerushalayim, Mitzrayim, Rabbi Akiva. The spellings are
// server/proper-names.gs, generated from STEPBible's tagged Tanakh and a list
// of Talmud sages and places (tools/proper-names/). A pointed word is looked
// up by its pointing first, which settles most words that are also names
// (עֵשָׂו Esau, עָשׂוּ "they did").
var NAME_MARK = "\uE001";
var NAME_WORD_RE = /[\u05D0-\u05EA\u05B0-\u05BD\u05C1\u05C2\u05C7\uE002]+['\u05F3]?/g;
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
  return text.replace(/\uE001([^\s\p{Lu}\p{Ll}\p{Lt}\p{Lo}\uE001]*)(\p{Ll})?/gu, function (all, signs, letter) {
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
  return text.replace(/(^|[.?!\u05C3]\s*)(\([^)]*\)\s*)?([^\s\p{Lu}\p{Ll}\p{Lt}\p{Lo}]*)(\p{Ll})/gu, function (all, before, marker, signs, letter) {
    return before + (marker || "") + signs + letter.toUpperCase();
  });
}

/**
 * The Latin text of `cleaned` (marks prepared by prepareMarksForReading_). A
 * word with vowels is read as a whole (readWord_); one with none, letter by
 * letter, as are words when options.keepNiqqud is false.
 */
function transliterateLetters_(cleaned, scheme, options, overrides, nameStarts, reading) {
  var out = "";
  for (var i = 0; i < cleaned.length;) {
    var ch = cleaned.charAt(i);
    if (!isHebrewLetter_(ch)) {
      if (!isNiqqudOrMark_(ch)) out += ch;
      i += 1;
      continue;
    }
    var end = i;
    while (end < cleaned.length && (isHebrewLetter_(cleaned.charAt(end)) || isNiqqudOrMark_(cleaned.charAt(end)))) end += 1;
    var clusters = wordClusters_(cleaned, i, end);
    var pointed = clusters.some(function (cluster) { return cluster.hasAnyVowel || cluster.hasDagesh; });
    if (pointed && options.keepNiqqud !== false) {
      out += readWord_(clusters, scheme, reading, options, overrides, nameStarts);
    } else {
      clusters.forEach(function (cluster) {
        // In the Latin text, not the Hebrew, so it cannot change how a letter reads.
        if (nameStarts && nameStarts[cluster.start]) out += NAME_MARK;
        out += transliterateCluster_(cluster, scheme, options, overrides);
      });
    }
    i = end;
  }
  return out;
}

/**
 * The transliteration of `text` in the scheme `schemeKey`. Options:
 *   overrideMap     Transliteration Mapping (letters and vowel signs); else the stored one
 *   dageshMode      "forte" doubles a letter with dagesh chazak; else the stored setting
 *   explicitKamatz  the text marks every kamatz katan (U+05C7), so a plain
 *                   kamatz is gadol: set for Tanakh text (isBiblicalHebrew,
 *                   Sefaria's Miqra according to the Masorah) and for any
 *                   text with a U+05C7 in it
 *   divineName      how the Name is written; else the stored
 *                   `transliteration_divine_name` ("HaShem")
 *   keepNiqqud      false: consonants only
 */
function transliterateHebrewText(text, schemeKey, options) {
  options = normalizeBiblicalOptions_(Object.assign({}, options || {}));
  var source = String(text || "");
  if (!options.explicitKamatz) options.explicitKamatz = !!options.isBiblicalHebrew || source.indexOf(QAMATS_QATAN) !== -1;
  var cleaned = prepareMarksForReading_(source);
  if (!cleaned) return "";

  var scheme = TRANSLITERATION_SCHEMES[schemeKey] || TRANSLITERATION_SCHEMES.simple_english;
  var reading = TRANSLITERATION_READINGS[schemeKey] || TRANSLITERATION_READINGS.simple_english;
  var overrides = options.overrideMap || getTransliterationOverrides_();
  var ipa = isIpaScheme_(schemeKey);
  var marked = markDivineNamesForTransliteration_(cleaned);
  var out = transliterateLetters_(marked, scheme, options, overrides, ipa ? null : properNameStarts_(marked), reading);
  if (out.indexOf(DIVINE_NAME_PLACEHOLDER) >= 0) {
    var name = options.divineName === undefined ? getStoredDivineName_() : normalizeDivineName_(options.divineName);
    if (reading.prefixHyphen) out = out.replace(/([^\s\-\u05BE\uE000])\uE000/g, "$1-\uE000");
    out = out.split(DIVINE_NAME_PLACEHOLDER).join(divineNameFor_(name, scheme, reading, ipa));
  }

  // A maqaf is a plain hyphen in Latin text: kol-ha'am, Beit-El.
  out = out.replace(/\u05BE/g, "-");
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
  // A passage that marks a kamatz katan anywhere marks every one. The stored
  // settings are read once for the passage, not once a line.
  var lineOptions = Object.assign({}, options || {});
  if (text.indexOf(QAMATS_QATAN) !== -1) lineOptions.explicitKamatz = true;
  if (!lineOptions.overrideMap) lineOptions.overrideMap = getTransliterationOverrides_();
  if (!lineOptions.dageshMode) lineOptions.dageshMode = getStoredDageshMode_();
  if (lineOptions.divineName === undefined) lineOptions.divineName = getStoredDivineName_();
  for (var i = 0; i < lines.length; i += 1) {
    var line = lines[i].trim();
    if (line) out.push(transliterateHebrewText(line, schemeKey, lineOptions));
  }
  return out.join("\n");
}

/** The sidebar preview: the stored overrides and "Double dagesh chazak" setting, as an insert reads them. */
function previewTransliterationWithOverrides(text, schemeKey) {
  return transliterateHebrewText(text, schemeKey, {
    keepNiqqud: true,
    isBiblicalHebrew: false
  });
}
