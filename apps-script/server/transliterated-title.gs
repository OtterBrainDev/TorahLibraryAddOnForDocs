// The title of the transliteration's own column (side by side, Position Left
// or Right): the Hebrew title, transliterated with the scheme the text uses.
//
// Sefaria's Hebrew titles carry no vowels, and the transliteration of bare
// consonants is unreadable: בראשית א׳:א׳-ב׳ came out "Vrʾshyt ʾ:ʾ-v". So the
// book's title is read in a pointed spelling, Sefaria's own where it has one
// (heTitleVariants: בְּרֵאשִׁית, תְּהִלִּים, בְּרָכוֹת) and otherwise, for the
// books of the Tanakh, the list below; the reference's numbers are written in
// digits, as Sefaria writes them in the Latin reference ("Bereʾshiyt 1:1-2").
// A title with a word whose vowels aren't known is not guessed at: it is
// Sefaria's Latin reference ("Mishnah Berakhot 1:1"), which for a Hebrew
// work is Sefaria's own transliteration of its name.

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
 * What the column's title is read from, or null when it can't be read well
 * (see above): `hebrew`, the book's title pointed; `bookNumber` ("I", "II",
 * or ""); `address`, the reference's numbers as in the Latin reference.
 */
function pointedTitleParts_(data) {
  if (!data) return null;
  const ref = String(data.ref || '');
  const indexTitle = String(data.indexTitle || '');
  const heIndexTitle = String(data.heIndexTitle || '').trim();
  if (!indexTitle || !heIndexTitle || ref.indexOf(indexTitle) !== 0) return null;
  const address = ref.slice(indexTitle.length);
  if (!TITLE_ADDRESS_RE_.test(address)) return null;

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
 * The transliteration column's title. `read` transliterates Hebrew with the
 * text's scheme and settings (transliteratorFor_ in insertion.gs).
 */
function transliteratedTitle_(data, read) {
  const parts = pointedTitleParts_(data);
  if (!parts) return String((data && data.ref) || '').trim();
  return (read(parts.hebrew) + (parts.bookNumber ? ' ' + parts.bookNumber : '') + parts.address).trim();
}
