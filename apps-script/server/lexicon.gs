// Lexicon module: Hebrew word/definition lookups and insertion.
// Routes English input to reverse-lookup path via searchWrapperRequest_.

function searchLexicon(query) {
  const safeQuery = String(query || '').trim();
  if (!safeQuery) return [];

  const isEnglish = /[A-Za-z]/.test(safeQuery) && !/[֐-׿]/.test(safeQuery);
  if (isEnglish) return searchLexiconByEnglish_(safeQuery);

  const url = 'https://www.sefaria.org/api/words/' + encodeURIComponent(safeQuery);
  const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });

  const status = response.getResponseCode ? response.getResponseCode() : 200;
  if (status === 404) return [];
  if (status >= 400) throw new Error('Lexicon search is temporarily unavailable.');

  let entries;
  try {
    entries = JSON.parse(response.getContentText() || '[]');
  } catch (e) {
    return [];
  }

  if (!Array.isArray(entries) || entries.length === 0) return [];

  return entries.map(function(entry, index) {
    return normalizeLexiconEntry_(entry, index);
  });
}

function normalizeLexiconEntry_(entry, index) {
  const headWord = String(entry.headword || entry.headWord || '').trim();
  const lexiconName = String(entry.parent_lexicon || '').trim();
  const morphology = String((entry.content && entry.content.morphology) || entry.morphology || '').trim();

  const alternateTexts = Array.isArray(entry.alternateHeadWords)
    ? entry.alternateHeadWords.map(function(a) { return typeof a === 'string' ? a : (a.text || a.word || ''); }).filter(Boolean)
    : [];

  let snippet = extractLexiconSnippet_(entry.content, 180);
  if (!snippet && morphology) snippet = morphology;

  return {
    key: 'lexicon-' + index + '-' + headWord,
    ref: 'lexicon:' + String(entry.rid || index),
    label: headWord,
    subtitle: lexiconName || 'Lexicon',
    snippet: snippet,
    headWord: headWord,
    alternateHeadWords: alternateTexts,
    morphology: morphology,
    lexiconName: lexiconName,
    content: entry.content || {},
    rid: entry.rid || null,
    typeLabel: 'Lexicon',
    clusterLabel: 'Dictionary',
    kind: 'lexicon',
    hasTranslation: true,
    availableLangs: ['en', 'he']
  };
}

function extractLexiconSnippet_(content, maxLen) {
  if (!content) return '';
  var parts = [];

  function collectDefs(node) {
    if (!node) return;
    if (typeof node === 'string') {
      var clean = node.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      if (clean) parts.push(clean);
      return;
    }
    if (typeof node !== 'object') return;
    if (node.definition) collectDefs(node.definition);
    if (Array.isArray(node.senses)) node.senses.forEach(collectDefs);
    if (node.text) collectDefs(node.text);
    if (node.en) collectDefs(node.en);
    if (Array.isArray(node.notes)) node.notes.forEach(collectDefs);
  }

  if (Array.isArray(content)) {
    content.forEach(collectDefs);
  } else {
    collectDefs(content);
  }

  var raw = parts.join(' ').replace(/\s+/g, ' ').trim();
  return raw.length > maxLen ? raw.substring(0, maxLen) + '…' : raw;
}

// Search lexicon definitions by English keyword; returns full entries via /api/words/
function searchLexiconByEnglish_(query) {
  const LEXICON_PATHS = ['Klein Dictionary', 'Jastrow', 'BDB Dictionary', 'BDB Augmented Strong'];

  var payload = {
    aggs: [],
    field: 'exact',
    filters: LEXICON_PATHS,
    filter_fields: LEXICON_PATHS.map(function() { return 'path'; }),
    query: query,
    size: 20,
    slop: 0,
    type: 'text',
    source_proj: true
  };

  var data;
  try {
    data = searchWrapperRequest_(payload);
  } catch (e) {
    return [];
  }

  var hits = (((data || {}).hits || {}).hits || []);
  if (!hits.length) return [];

  var seenHw = {};
  var headwords = [];
  hits.forEach(function(hit) {
    var ref = (hit._source && hit._source.ref) || '';
    var commaIdx = ref.lastIndexOf(',');
    if (commaIdx < 0) return;
    var hw = ref.slice(commaIdx + 1).replace(/\s+\d+\s*$/, '').trim();
    if (!hw || seenHw[hw]) return;
    seenHw[hw] = true;
    headwords.push(hw);
  });

  var results = [];
  var idx = 0;
  headwords.slice(0, 5).forEach(function(hw) {
    try {
      var url = 'https://www.sefaria.org/api/words/' + encodeURIComponent(hw);
      var response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
      if (!response || response.getResponseCode() !== 200) return;
      var entries = JSON.parse(response.getContentText() || '[]');
      if (!Array.isArray(entries)) return;
      entries.forEach(function(entry) {
        results.push(normalizeLexiconEntry_(entry, idx++));
      });
    } catch (e) {
      Logger.log('Lexicon reverse lookup failed for "' + hw + '": ' + e.message);
    }
  });

  return results;
}

// Insert a selected lexicon entry into the active Google Document.
function insertLexiconEntry(lexiconPayload) {
  if (!lexiconPayload || !lexiconPayload.headWord) {
    throw new Error('No lexicon entry is selected.');
  }

  const document = DocumentApp.getActiveDocument();
  if (!document) {
    throw new Error('Open a Google Doc before inserting a lexicon entry.');
  }

  const body = document.getBody();
  const typography = getTypographySettings();
  let index = getInsertionIndex_(document, body);

  const insertMode = String(lexiconPayload.insertMode || 'entry');
  const headWord  = String(lexiconPayload.headWord || '').trim();
  const morphology = String(lexiconPayload.morphology || '').trim();
  const lexiconName = String(lexiconPayload.lexiconName || '').trim();
  const alternates = (lexiconPayload.alternateHeadWords || []).filter(Boolean).join(', ');

  const includeHeadword  = insertMode === 'entry' || insertMode === 'headword';
  const includeMeta      = insertMode === 'entry';
  const includeDefinition = insertMode === 'entry' || insertMode === 'definition';

  if (includeHeadword && headWord) {
    const titleParagraph = body.insertParagraph(index, headWord);
    titleParagraph.setHeading(DocumentApp.ParagraphHeading.HEADING3);
    applyTypographyToParagraph(titleParagraph, typography.hebrewFont, typography.hebrewFontSize, typography.hebrewFontStyle);
    index++;
  }

  if (includeMeta) {
    const metaParts = [alternates, morphology, lexiconName].filter(Boolean);
    if (metaParts.length) {
      const metaParagraph = body.insertParagraph(index, metaParts.join(' · '));
      applyTypographyToParagraph(metaParagraph, typography.translationFont, typography.translationFontSize, 'italic');
      index++;
    }
  } else if (insertMode === 'headword' && lexiconName) {
    const sourceParagraph = body.insertParagraph(index, lexiconName);
    applyTypographyToParagraph(sourceParagraph, typography.translationFont, typography.translationFontSize, 'italic');
    index++;
  }

  if (includeDefinition) {
    const definitionText = extractLexiconSnippet_(lexiconPayload.content, 2000);
    if (definitionText) {
      const defParagraph = body.insertParagraph(index, definitionText);
      applyTypographyToParagraph(defParagraph, typography.translationFont, typography.translationFontSize, typography.translationFontStyle);
      index++;
    }
  }

  return { ok: true };
}
