// The title of the transliteration's own column (side by side, Position Left
// or Right): the Hebrew title in Latin letters, with the reference's numbers
// in digits, as Sefaria writes them in the Latin reference. In order:
//
// 1. Sefaria's own Latin title for the Hebrew one: "Bereshit 1:1-2",
//    "Shmuel Aleph 1:1", "Berakhot 2a:1". Sefaria lists a work's Latin titles
//    (indexTitle, then titleVariants) without saying which is which:
//    abbreviations, English names and transliterations together ("Gen.",
//    "Genesis", "Bereshit"). The one that spells the Hebrew title's
//    consonants is its transliteration (sefariaLatinTitle_).
// 2. Otherwise the Hebrew title, transliterated with the text's scheme.
//    Sefaria's Hebrew titles carry no vowels, and the transliteration of bare
//    consonants is unreadable (בראשית א׳:א׳-ב׳ came out "Vrʾshyt ʾ:ʾ-v"), so
//    the book's title is read in a pointed spelling, Sefaria's own where it
//    has one (heTitleVariants: בְּרֵאשִׁית, תְּהִלִּים) and otherwise, for
//    the books of the Tanakh, the list below ("Bereʾshiyt 1:1-2").
// 3. Otherwise Sefaria's Latin reference as it is ("Rashi on Genesis 1:1:1"),
//    never bare consonants.

// Each word of the Tanakh's book titles as Sefaria spells them
// (heIndexTitle: שמואל א, שיר השירים, דברי הימים ב), pointed.
var TANAKH_POINTED_TITLE_WORDS_ = {
  'בראשית': 'בְּרֵאשִׁית', 'שמות': 'שְׁמוֹת', 'ויקרא': 'וַיִּקְרָא', 'במדבר': 'בְּמִדְבַּר', 'דברים': 'דְּבָרִים',
  'יהושע': 'יְהוֹשֻׁעַ', 'שופטים': 'שׁוֹפְטִים', 'שמואל': 'שְׁמוּאֵל', 'מלכים': 'מְלָכִים',
  'ישעיהו': 'יְשַׁעְיָהוּ', 'ירמיהו': 'יִרְמְיָהוּ', 'יחזקאל': 'יְחֶזְקֵאל',
  'הושע': 'הוֹשֵׁעַ', 'יואל': 'יוֹאֵל', 'עמוס': 'עָמוֹס', 'עובדיה': 'עֹבַדְיָה', 'יונה': 'יוֹנָה', 'מיכה': 'מִיכָה',
  'נחום': 'נַחוּם', 'חבקוק': 'חֲבַקּוּק', 'צפניה': 'צְפַנְיָה', 'חגי': 'חַגַּי', 'זכריה': 'זְכַרְיָה', 'מלאכי': 'מַלְאָכִי',
  'תהילים': 'תְּהִלִּים', 'תהלים': 'תְּהִלִּים', 'משלי': 'מִשְׁלֵי', 'איוב': 'אִיּוֹב', 'שיר': 'שִׁיר', 'השירים': 'הַשִּׁירִים',
  'רות': 'רוּת', 'איכה': 'אֵיכָה', 'קהלת': 'קֹהֶלֶת', 'אסתר': 'אֶסְתֵּר', 'דניאל': 'דָּנִיֵּאל', 'עזרא': 'עֶזְרָא',
  'נחמיה': 'נְחֶמְיָה', 'דברי': 'דִּבְרֵי', 'הימים': 'הַיָּמִים'
};

// The book number at the end of a title (שמואל א, מלכים ב), as the Latin
// reference numbers it (I Samuel).
var TITLE_BOOK_NUMBERS_ = { 'א': 'I', 'ב': 'II' };

// Vowels, cantillation and the other marks on a Hebrew letter.
var TITLE_HEBREW_MARKS_RE_ = /[֑-ׇֽֿׁׂׅׄ]/g;
var TITLE_HEBREW_NIQQUD_RE_ = /[ְ-ׇּׁׂ]/;

// The reference after the book's title, when it is numbers only:
// " 1:1-2", " 1:31-2:3", " 23", " 2a:1-5", or nothing.
var TITLE_ADDRESS_RE_ = /^(?:\s+\d+[ab]?(?:[:.]\d+[ab]?)*(?:\s*[-–]\s*\d+[ab]?(?:[:.]\d+[ab]?)*)?)?$/;

function titleWordSkeleton_(word) {
  return String(word || '').replace(TITLE_HEBREW_MARKS_RE_, '');
}

/**
 * The reference after the book's title (" 1:1-2"), or null when it is more
 * than numbers (a section of a complex text) or the reference doesn't start
 * with the book's title.
 */
function titleAddress_(data) {
  const ref = String((data && data.ref) || '');
  const indexTitle = String((data && data.indexTitle) || '');
  if (!indexTitle || ref.indexOf(indexTitle) !== 0) return null;
  const address = ref.slice(indexTitle.length);
  return TITLE_ADDRESS_RE_.test(address) ? address : null;
}

// How each Hebrew letter may be spelled in a Latin title, its vowels left
// out. The first pass reads the letter as the scheme does (ש "sh", ח "ch" /
// "kh", ת "t", or "s" in Ashkenazi), so "Shmuel" is chosen over "Samuel" and
// "Bereishis" for Ashkenazi; the second takes any common spelling. א and ע
// are not written; ה, ו and י are letters only where they must be (ה not at
// a word's end, ו and י at its start), else vowels or silent.
var TITLE_LATIN_SPELLINGS_ = {
  'ב': 'b|v|bh|vh', 'ג': 'g|gh', 'ד': 'd|dh', 'ז': 'z', 'ט': 't',
  'כ': 'k|kh|ch|c', 'ך': 'k|kh|ch|c', 'ל': 'l', 'מ': 'm', 'ם': 'm', 'נ': 'n', 'ן': 'n', 'ס': 's',
  'פ': 'p|f|ph', 'ף': 'p|f|ph', 'צ': 'tz|ts|z|c', 'ץ': 'tz|ts|z|c', 'ק': 'k|q|c|ck', 'ר': 'r'
};

// A book number after the title (שמואל א), and how a Latin title writes it.
var TITLE_LATIN_BOOK_NUMBERS_ = {
  'א': ['i', '1', 'first', 'aleph', 'alef'],
  'ב': ['ii', '2', 'second', 'bet', 'beit', 'beth', 'bais']
};

function hebrewTitleLatinPattern_(words, firstPass, ashkenazi) {
  let pattern = '';
  words.forEach(function (word) {
    const letters = titleWordSkeleton_(word).replace(/[^\u05D0-\u05EA]/g, '').split('');
    letters.forEach(function (letter, i) {
      const last = i === letters.length - 1;
      if (letter === 'א' || letter === 'ע') return;
      if (letter === 'ה') { pattern += last ? '(?:h)*' : '(?:h)+'; return; }
      if (letter === 'ו') { pattern += i === 0 ? '(?:v|w)+' : '(?:v|w)*'; return; }
      if (letter === 'י') { pattern += i === 0 ? '(?:y)+' : '(?:y)*'; return; }
      let spellings = TITLE_LATIN_SPELLINGS_[letter];
      if (letter === 'ש') spellings = firstPass ? 'sh' : 'sh|s';
      if (letter === 'ח') spellings = firstPass ? 'ch|kh' : 'ch|kh|h';
      if (letter === 'ת') spellings = firstPass ? (ashkenazi ? 's' : 't|th') : 't|th|s';
      pattern += '(?:' + spellings + ')+';
    });
  });
  return new RegExp('^' + pattern + '$');
}

// A Latin title's letters: lower case, no accents (Oraḥ: orah), no spaces
// or punctuation; and its consonants, those letters without the vowels.
function latinTitleLetters_(text) {
  return String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z]/g, '');
}

function latinTitleConsonants_(text) {
  return latinTitleLetters_(text).replace(/[aeiou]/g, '');
}

/**
 * Sefaria's Latin title for the work's Hebrew title (heIndexTitle): the
 * first of indexTitle and titleVariants, in Sefaria's order, that spells it
 * (see above); "" when none does. For a book of the Tanakh the main title is
 * its English name (Obadiah, Micah), so its variants (Ovadiah, Mikha) come
 * first; elsewhere the main title is Sefaria's transliteration (Berakhot).
 * `scheme` is the transliteration's, so an Ashkenazi one prefers "Bereishis".
 */
function sefariaLatinTitle_(data, scheme) {
  if (!data) return '';
  const words = String(data.heIndexTitle || '').replace(/[\u05F3\u05F4'"״׳]/g, '').trim().split(/[\s,\u05BE-]+/).filter(Boolean);
  if (!words.length) return '';
  let numberTokens = null;
  let otherNumberTokens = [];
  if (words.length > 1 && Object.prototype.hasOwnProperty.call(TITLE_LATIN_BOOK_NUMBERS_, words[words.length - 1])) {
    const number = words.pop();
    numberTokens = TITLE_LATIN_BOOK_NUMBERS_[number];
    Object.keys(TITLE_LATIN_BOOK_NUMBERS_).forEach(function (other) {
      if (other !== number) otherNumberTokens = otherNumberTokens.concat(TITLE_LATIN_BOOK_NUMBERS_[other]);
    });
  }
  const seen = {};
  const variants = Array.isArray(data.titleVariants) ? data.titleVariants : [];
  const candidates = (data.type === 'Tanakh' ? variants.concat([data.indexTitle]) : [data.indexTitle].concat(variants))
    .map(function (title) { return String(title || '').replace(/\s+/g, ' ').trim(); })
    .filter(function (title) {
      // Some variants are marked up (<i>Pirkei Avot</i>): never ours to
      // insert. One with a period is an abbreviation (Ezr., Mic.).
      if (!title || /[<>.]/.test(title) || seen[title]) return false;
      seen[title] = true;
      return true;
    });
  // A title ending in a vowel letter (עזרא, מיכה, מלאכי) ends in a vowel
  // (or a silent h) in Latin too: "Ezr", "Mic" and "Malach" are abbreviations.
  const endsInVowel = /[אהוי]$/.test(titleWordSkeleton_(words[words.length - 1]).replace(/[^\u05D0-\u05EA]/g, ''));
  const ashkenazi = scheme === 'ashkenazi';
  for (let pass = 0; pass < 2; pass++) {
    const pattern = hebrewTitleLatinPattern_(words, pass === 0, ashkenazi);
    for (let i = 0; i < candidates.length; i++) {
      let tokens = candidates[i].toLowerCase().replace(/\./g, '').split(/[\s,]+/).filter(Boolean);
      if (numberTokens) {
        const own = tokens.filter(function (token) { return numberTokens.indexOf(token) >= 0; });
        const other = tokens.filter(function (token) { return otherNumberTokens.indexOf(token) >= 0; });
        if (own.length !== 1 || other.length) continue;
        tokens = tokens.filter(function (token) { return numberTokens.indexOf(token) < 0; });
      }
      if (endsInVowel && !/[aeiouyh]$/.test(latinTitleLetters_(tokens.join(' ')))) continue;
      if (pattern.test(latinTitleConsonants_(tokens.join(' ')))) return candidates[i];
    }
  }
  return '';
}

/**
 * What the column's title is read from, or null when it can't be read well
 * (see above): `hebrew`, the book's title pointed; `bookNumber` ("I", "II",
 * or ""); `address`, the reference's numbers as in the Latin reference.
 */
function pointedTitleParts_(data) {
  if (!data) return null;
  const heIndexTitle = String(data.heIndexTitle || '').trim();
  const address = titleAddress_(data);
  if (!heIndexTitle || address === null) return null;

  // Sefaria's pointed spellings of this title's words, then the Tanakh's.
  const pointed = {};
  (Array.isArray(data.heTitleVariants) ? data.heTitleVariants : []).forEach(function (variant) {
    String(variant || '').split(/\s+/).forEach(function (word) {
      if (TITLE_HEBREW_NIQQUD_RE_.test(word)) pointed[titleWordSkeleton_(word)] = word;
    });
  });

  const words = heIndexTitle.split(/\s+/);
  let bookNumber = '';
  if (words.length > 1 && Object.prototype.hasOwnProperty.call(TITLE_BOOK_NUMBERS_, words[words.length - 1])) {
    bookNumber = TITLE_BOOK_NUMBERS_[words.pop()];
  }
  const hebrew = [];
  for (let i = 0; i < words.length; i++) {
    const skeleton = titleWordSkeleton_(words[i]);
    const spelling = pointed[skeleton] ||
      (Object.prototype.hasOwnProperty.call(TANAKH_POINTED_TITLE_WORDS_, skeleton) ? TANAKH_POINTED_TITLE_WORDS_[skeleton] : '');
    if (!spelling) return null;
    hebrew.push(spelling);
  }
  return { hebrew: hebrew.join(' '), bookNumber: bookNumber, address: address };
}

/**
 * The transliteration column's title (see above). `read` transliterates
 * Hebrew with the text's scheme and settings, `scheme` names that scheme
 * (transliteratorFor_ in insertion.gs).
 */
function transliteratedTitle_(data, read, scheme) {
  const address = titleAddress_(data);
  const latin = address === null ? '' : sefariaLatinTitle_(data, scheme);
  if (latin) return (latin + address).trim();
  const parts = pointedTitleParts_(data);
  if (!parts) return String((data && data.ref) || '').trim();
  return (read(parts.hebrew) + (parts.bookNumber ? ' ' + parts.bookNumber : '') + parts.address).trim();
}
