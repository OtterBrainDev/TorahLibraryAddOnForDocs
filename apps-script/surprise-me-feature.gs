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
      term = getRandomTanakhHebrewWord_();
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
    message: 'Inserted ' + inserted + ' random source' + (inserted === 1 ? '' : 's') + ' for “' + term + '”.'
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

function getRandomTanakhHebrewWord_() {
  const seedRefs = [
    'Genesis 1:1',
    'Genesis 12:1',
    'Exodus 3:14',
    'Deuteronomy 6:4',
    'Joshua 1:8',
    'Isaiah 40:1',
    'Psalms 23:1',
    'Proverbs 3:5',
    'Job 1:1',
    'Song of Songs 2:1'
  ];

  for (let attempt = 0; attempt < 12; attempt++) {
    const ref = seedRefs[Math.floor(Math.random() * seedRefs.length)];
    try {
      const response = findReference(ref);
      const rawText = collectHebrewSearchSeedText_(response);
      const words = extractHebrewSeedWords_(rawText);
      if (words.length) return words[Math.floor(Math.random() * words.length)];
    } catch (err) {
      Logger.log('Could not derive seed word from ' + ref + ': ' + err.message);
    }
  }

  return 'שלום';
}

function collectHebrewSearchSeedText_(response) {
  if (!response) return '';
  const raw = Array.isArray(response.he)
    ? response.he.join(' ')
    : (Array.isArray(response.text) ? response.text.join(' ') : (response.he || response.text || ''));
  return String(raw || '');
}

function extractHebrewSeedWords_(text) {
  return String(text || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[\u0591-\u05C7]/g, '')
    .replace(/[^\u05D0-\u05EA\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(function (word) {
      return word && word.length >= 2;
    });
}
