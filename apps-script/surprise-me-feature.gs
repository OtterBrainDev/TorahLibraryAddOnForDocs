function surpriseMeHTML() {
  if (!DEV_FLAGS.SURPRISE_ME) {
    DocumentApp.getUi().alert('Surprise Me is not available in this version.');
    return;
  }

  const prefs = getPreferences();

  const enabled = prefs.surprise_me_enabled === "true";

  if (!enabled) {
    DocumentApp.getUi().alert(
      'Surprise Me is currently disabled. Enable it from Preferences to use this feature.'
    );
    return;
  }

  const template = HtmlService.createTemplateFromFile('surprise-me');
  template.appConfigJson = JSON.stringify(getUiAppConfig_('surprise-me', 'experimental'));
  const output = template.evaluate()
    .setWidth(430)
    .setHeight(620);

  DocumentApp.getUi().showModalDialog(output, 'Surprise Me');
}

function insertSurpriseMe(options) {
  options = options || {};
  const count = clampSurpriseCount_(options.count);
  const corpuses = normalizeSurpriseCorpuses_(options.corpuses);
  const sortMode = String(options.sortMode || 'relevance') === 'chronological' ? 'chronological' : 'relevance';
  let term = String(options.term || '').trim();

  if (!corpuses.length) {
    throw new Error('Choose at least one corpus.');
  }

  const isBlankTerm = !term;
  const maxAttempts = isBlankTerm ? 5 : 1;
  let candidateRefs = [];

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (isBlankTerm) {
      term = getRandomFrequencyDictWord_();
    }
    const searchResponse = findSearchAdvanced(term, {
      filters: corpuses,
      relevanceSort: sortMode === 'relevance',
      sortMode: sortMode,
      translationOnly: false,
      translationLanguages: []
    });
    const rawHits = Array.isArray(searchResponse)
      ? searchResponse
      : ((((searchResponse || {}).hits || {}).hits) || []);
    candidateRefs = getInsertableRefsFromSearchHits_(rawHits, corpuses);
    if (candidateRefs.length) break;
  }

  if (!candidateRefs.length) {
    throw new Error('No insertable results were found for that term and corpus selection.');
  }

  const pickedRefs = shuffleArray_(candidateRefs).slice(0, count);
  let inserted = 0;

  pickedRefs.forEach(function (ref) {
    try {
      const data = findReference(ref);
      if (!isInsertableResolvedRef_(data)) return;
      insertReference(data);
      inserted++;
    } catch (err) {
      Logger.log('Surprise Me skipped ' + ref + ' because ' + err.message);
    }
  });

  if (!inserted) {
    throw new Error('Search results were found, but none could be inserted directly.');
  }

  return {
    term: term,
    inserted: inserted,
    message: 'Inserted ' + inserted + ' random source' + (inserted === 1 ? '' : 's') + ' for "' + term + '".'
  };
}

function clampSurpriseCount_(value) {
  const numeric = Number(value);
  if (!isFinite(numeric)) return 5;
  return Math.max(1, Math.min(10, Math.round(numeric)));
}

function normalizeSurpriseCorpuses_(corpuses) {
  if (!Array.isArray(corpuses)) return [];
  const seen = {};
  return corpuses.map(function (value) {
    return String(value || '').trim();
  }).filter(function (value) {
    if (!value || seen[value]) return false;
    seen[value] = true;
    return true;
  });
}

function getInsertableRefsFromSearchHits_(hits, allowedCorpuses) {
  const allowed = {};
  allowedCorpuses.forEach(function (value) { allowed[value] = true; });
  const seenRefs = {};
  const refs = [];

  (hits || []).forEach(function (hit) {
    const source = hit && hit._source ? hit._source : {};
    const ref = String(source.ref || '').trim();
    if (!ref || seenRefs[ref]) return;

    const categories = Array.isArray(source.categories) ? source.categories.map(function (value) {
      return String(value || '').trim();
    }).filter(Boolean) : [];
    const primaryCategory = String(source.primary_category || '').trim();
    const matchesCorpus = !!allowed[primaryCategory] || categories.some(function (category) {
      return !!allowed[category];
    });
    if (!matchesCorpus) return;

    if (looksTooBroadForInsertion_(source)) return;

    seenRefs[ref] = true;
    refs.push(ref);
  });

  return refs;
}

function looksTooBroadForInsertion_(source) {
  if (!source) return true;
  if (source.is_section === true || source.isSection === true) return true;

  const sections = Array.isArray(source.sections) ? source.sections.filter(function (value) {
    return value !== null && typeof value !== 'undefined' && value !== '';
  }) : [];
  const toSections = Array.isArray(source.toSections) ? source.toSections.filter(function (value) {
    return value !== null && typeof value !== 'undefined' && value !== '';
  }) : [];

  if (!sections.length && !toSections.length) return true;
  return false;
}

function isInsertableResolvedRef_(data) {
  if (!data || !data.ref) return false;
  if (Array.isArray(data.text) || Array.isArray(data.he)) return true;
  if (data.isSpanning === true) return true;
  if (typeof data.text === 'string' && data.text.trim()) return true;
  if (typeof data.he === 'string' && data.he.trim()) return true;
  return false;
}

function shuffleArray_(items) {
  const copy = (items || []).slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy;
}

// Returns a random Hebrew or English word drawn from the BYU Hebrew Frequency
// Dictionary. These are high-frequency Biblical Hebrew content words guaranteed
// to produce Sefaria search results.
function getRandomFrequencyDictWord_() {
  const entry = FREQ_DICT_WORDS_[Math.floor(Math.random() * FREQ_DICT_WORDS_.length)];
  return Math.random() < 0.5 ? entry[0] : entry[1];
}

// Word pairs from the BYU Hebrew Frequency Dictionary (unvocalized Hebrew, English).
// Covers the most common content words (nouns, verbs, adjectives, proper nouns)
// in the Hebrew Bible, ordered roughly by descending corpus frequency.
var FREQ_DICT_WORDS_ = [
  // Proper nouns
  ['ישראל', 'Israel'],
  ['יהוה', 'LORD'],
  ['משה', 'Moses'],
  ['אברהם', 'Abraham'],
  ['דוד', 'David'],
  ['יצחק', 'Isaac'],
  ['יעקב', 'Jacob'],
  ['ירושלם', 'Jerusalem'],
  ['מצרים', 'Egypt'],
  ['שלמה', 'Solomon'],
  ['ציון', 'Zion'],
  ['אדם', 'Adam'],
  ['יוסף', 'Joseph'],
  ['אהרן', 'Aaron'],
  ['כנען', 'Canaan'],
  ['בבל', 'Babylon'],
  ['ירדן', 'Jordan'],
  ['סיני', 'Sinai'],
  // High-frequency nouns
  ['אלהים', 'God'],
  ['בן', 'son'],
  ['ארץ', 'land'],
  ['יום', 'day'],
  ['איש', 'man'],
  ['עם', 'people'],
  ['פנים', 'face'],
  ['מלך', 'king'],
  ['יד', 'hand'],
  ['עין', 'eye'],
  ['עיר', 'city'],
  ['בית', 'house'],
  ['לב', 'heart'],
  ['נפש', 'soul'],
  ['דבר', 'word'],
  ['שם', 'name'],
  ['ראש', 'head'],
  ['אב', 'father'],
  ['שנה', 'year'],
  ['דרך', 'way'],
  ['כהן', 'priest'],
  ['בת', 'daughter'],
  ['אח', 'brother'],
  ['אם', 'mother'],
  ['אשה', 'woman'],
  ['עבד', 'servant'],
  ['נביא', 'prophet'],
  ['מלאך', 'angel'],
  ['שמים', 'heaven'],
  ['אור', 'light'],
  ['אש', 'fire'],
  ['מים', 'water'],
  ['עץ', 'tree'],
  ['אבן', 'stone'],
  ['זהב', 'gold'],
  ['כסף', 'silver'],
  ['פה', 'mouth'],
  ['בשר', 'flesh'],
  ['דם', 'blood'],
  ['קול', 'voice'],
  ['לחם', 'bread'],
  ['יין', 'wine'],
  ['שמן', 'oil'],
  ['חלב', 'milk'],
  ['דבש', 'honey'],
  ['פרי', 'fruit'],
  ['הר', 'mountain'],
  ['מדבר', 'wilderness'],
  ['ים', 'sea'],
  ['נהר', 'river'],
  ['ענן', 'cloud'],
  ['שמש', 'sun'],
  ['ירח', 'moon'],
  ['לילה', 'night'],
  ['בקר', 'morning'],
  ['ערב', 'evening'],
  ['שדה', 'field'],
  ['אדמה', 'ground'],
  ['זרע', 'seed'],
  ['כנף', 'wing'],
  ['ספר', 'book'],
  ['אהל', 'tent'],
  ['ארון', 'ark'],
  ['מזבח', 'altar'],
  ['מקדש', 'sanctuary'],
  ['שבט', 'tribe'],
  ['נחלה', 'inheritance'],
  ['מחנה', 'camp'],
  ['צבא', 'army'],
  ['חרב', 'sword'],
  ['מגן', 'shield'],
  ['כח', 'strength'],
  ['ילד', 'child'],
  ['נער', 'youth'],
  ['זקן', 'elder'],
  ['גר', 'stranger'],
  ['בכור', 'firstborn'],
  ['אדון', 'lord'],
  ['חיים', 'life'],
  ['רוח', 'spirit'],
  // Theological and legal nouns
  ['תורה', 'Torah'],
  ['שלום', 'peace'],
  ['אמת', 'truth'],
  ['חסד', 'lovingkindness'],
  ['צדק', 'righteousness'],
  ['משפט', 'justice'],
  ['מצוה', 'commandment'],
  ['ברית', 'covenant'],
  ['כבוד', 'glory'],
  ['חק', 'statute'],
  ['גוי', 'nation'],
  ['חכמה', 'wisdom'],
  ['שבת', 'Sabbath'],
  ['עולם', 'eternity'],
  ['תפלה', 'prayer'],
  ['שיר', 'song'],
  ['תהלה', 'praise'],
  ['ישועה', 'salvation'],
  ['קרבן', 'offering'],
  ['עולה', 'burnt offering'],
  ['כפרה', 'atonement'],
  ['נדר', 'vow'],
  ['גאלה', 'redemption'],
  ['תשובה', 'repentance'],
  ['אמונה', 'faith'],
  ['ענוה', 'humility'],
  ['צדקה', 'charity'],
  // Common verbs (root form / infinitive)
  ['אמר', 'say'],
  ['עשה', 'do'],
  ['בוא', 'come'],
  ['הלך', 'walk'],
  ['נתן', 'give'],
  ['שמע', 'hear'],
  ['ידע', 'know'],
  ['ראה', 'see'],
  ['שוב', 'return'],
  ['לקח', 'take'],
  ['קרא', 'call'],
  ['יצא', 'go out'],
  ['עמד', 'stand'],
  ['ישב', 'dwell'],
  ['עלה', 'ascend'],
  ['ירד', 'descend'],
  ['נפל', 'fall'],
  ['שמר', 'keep'],
  ['דבר', 'speak'],
  ['בנה', 'build'],
  ['נשא', 'carry'],
  ['קום', 'rise'],
  ['צוה', 'command'],
  ['עבד', 'serve'],
  ['אכל', 'eat'],
  ['שתה', 'drink'],
  ['מות', 'die'],
  ['ירא', 'fear'],
  ['אהב', 'love'],
  ['כתב', 'write'],
  ['זכר', 'remember'],
  ['ברך', 'bless'],
  ['קדש', 'sanctify'],
  ['חיה', 'live'],
  ['ענה', 'answer'],
  ['שאל', 'ask'],
  ['רדף', 'pursue'],
  ['עזב', 'forsake'],
  ['סלח', 'forgive'],
  ['גאל', 'redeem'],
  // Adjectives
  ['גדול', 'great'],
  ['טוב', 'good'],
  ['רע', 'evil'],
  ['חזק', 'strong'],
  ['קדוש', 'holy'],
  ['ישר', 'upright'],
  ['צדיק', 'righteous'],
  ['רשע', 'wicked'],
  ['חכם', 'wise'],
  ['חי', 'living'],
  ['אחד', 'one'],
  ['חדש', 'new'],
  ['גבור', 'mighty'],
  ['עני', 'poor'],
  ['עשיר', 'rich'],
  ['רחום', 'merciful'],
  ['ברוך', 'blessed'],
  ['אמין', 'faithful'],
];
