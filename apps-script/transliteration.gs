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
var CANTILLATION_RE = /[\u0591-\u05AF]/;
var BGDKPT_RE = /[בגדכפתךף]/;
var VOWEL_RE = /[\u05B1-\u05BB\u05C7]/;
var SHEVA = "\u05B0";
var DAGESH = "\u05BC";
var SHIN_DOT = "\u05C1";
var SIN_DOT = "\u05C2";

function stripCantillationMarks_(text) {
  return String(text || "").replace(CANTILLATION_RE, "");
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

function transliterateHebrewText(text, schemeKey, options) {
  options = normalizeBiblicalOptions_(options);
  var cleaned = stripCantillationMarks_(String(text || ""));
  if (!cleaned) return "";

  var scheme = TRANSLITERATION_SCHEMES[schemeKey] || TRANSLITERATION_SCHEMES.simple_english;
  var overrides = options.overrideMap || getTransliterationOverrides_();
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
    out += transliterateCluster_(cluster, scheme, dageshType, options, overrides);
    i = cluster.nextIndex;
  }

  return out.replace(/\s+/g, " ").replace(/['ʾ]\s+/g, " ").trim();
}

function transliterateHebrewHtmlPreservingBasicBreaks(html, schemeKey, options) {
  var text = String(html || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]*>/g, "");
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
