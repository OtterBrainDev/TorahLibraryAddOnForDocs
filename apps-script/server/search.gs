// Search module: text search, voices (source sheets), lexicon queries, and
// name completion. All requests route through Sefaria API endpoints.

function buildSearchWrapperPayload_(input, searchConfig) {
  let normalizedConfig = {};
  if (Array.isArray(searchConfig)) {
    normalizedConfig.filters = searchConfig;
  } else if (typeof searchConfig === 'boolean') {
    normalizedConfig.relevanceSort = searchConfig;
  } else if (searchConfig && typeof searchConfig === 'object') {
    normalizedConfig = searchConfig;
  }

  let safeFilters = Array.isArray(normalizedConfig.filters) ? normalizedConfig.filters.filter(Boolean) : [];
  let usePageRank = normalizedConfig.relevanceSort !== false;
  let searchOptions = {
    'aggs': [],
    'field': 'naive_lemmatizer',
    'filters': safeFilters,
    'filter_fields': Array(safeFilters.length).fill('path'),
    'query': String(input || '').trim(),
    'size': 50,
    'slop': 10,
    'type': 'text',
    'source_proj': true
  };

  if (usePageRank) {
    searchOptions.sort_fields = ['pagesheetrank'];
    searchOptions.sort_method = 'score';
    searchOptions.sort_reverse = false;
    searchOptions.sort_score_missing = 0.04;
  }

  return searchOptions;
}

function searchWrapperRequest_(payload) {
  let url = 'https://www.sefaria.org/api/search-wrapper';
  let postOptions = {
    method: 'post',
    payload: JSON.stringify(payload),
    contentType: 'application/json',
    muteHttpExceptions: true
  };

  let rawResponse = UrlFetchApp.fetch(url, postOptions);
  let statusCode = rawResponse.getResponseCode ? rawResponse.getResponseCode() : 200;
  let responseText = rawResponse.getContentText() || '{}';

  if (statusCode >= 400) {
    throw new Error('Search request failed with status ' + statusCode + '.');
  }

  return JSON.parse(responseText || '{}');
}

function normalizeSearchTranslationLanguages_(languages) {
  const languageLUT = {
    english: 'en', en: 'en', eng: 'en',
    spanish: 'es', es: 'es', spa: 'es',
    french: 'fr', fr: 'fr', fre: 'fr', fra: 'fr',
    german: 'de', de: 'de', ger: 'de', deu: 'de',
    russian: 'ru', ru: 'ru', rus: 'ru',
    arabic: 'ar', ar: 'ar', ara: 'ar',
    hebrew: 'he', he: 'he', heb: 'he'
  };
  return (Array.isArray(languages) ? languages : []).map(function(language) {
    const raw = String(language || '').trim().toLowerCase();
    return languageLUT[raw] || raw;
  }).filter(Boolean);
}

function searchHitHasTranslation_(hit, desiredLanguages) {
  let source = hit && hit._source ? hit._source : {};
  let selectedLanguages = normalizeSearchTranslationLanguages_(desiredLanguages);
  let availableLangs = [];
  if (source && Array.isArray(source.availableLangs)) {
    availableLangs = normalizeSearchTranslationLanguages_(source.availableLangs);
  } else if (source && Array.isArray(source.versions)) {
    availableLangs = normalizeSearchTranslationLanguages_(source.versions.map(function(version) {
      return version && version.language;
    }));
  }
  if (!selectedLanguages.length) {
    if (availableLangs.length) {
      return availableLangs.length > 0;
    }
    if (Object.prototype.hasOwnProperty.call(source, 'hasEn')) {
      return source.hasEn !== false;
    }
    return true;
  }
  if (!availableLangs.length) {
    return selectedLanguages.indexOf('en') >= 0 && source.hasEn !== false;
  }
  return selectedLanguages.some(function(language) {
    return availableLangs.indexOf(language) >= 0;
  });
}

function findSearchAdvanced(input, filters, relevanceSort, translationOnly) {
  let searchConfig = (filters && typeof filters === 'object' && !Array.isArray(filters))
    ? filters
    : { filters: filters, relevanceSort: relevanceSort, translationOnly: translationOnly === true };

  let attempts = [];
  attempts.push(buildSearchWrapperPayload_(input, searchConfig));

  if (Array.isArray(searchConfig.filters) && searchConfig.filters.length > 0) {
    attempts.push(buildSearchWrapperPayload_(input, Object.assign({}, searchConfig, { filters: [] })));
  }

  if (searchConfig.relevanceSort !== false) {
    attempts.push(buildSearchWrapperPayload_(input, Object.assign({}, searchConfig, { relevanceSort: false })));
  }

  attempts.push({
    aggs: [],
    field: 'naive_lemmatizer',
    query: String(input || '').trim(),
    size: 50,
    slop: 10,
    type: 'text',
    source_proj: true
  });

  let lastError = null;
  for (let i = 0; i < attempts.length; i++) {
    try {
      let responseJSON = searchWrapperRequest_(attempts[i]);
      let hits = (((responseJSON || {}).hits || {}).hits || []);
      if (searchConfig.translationOnly) {
        hits = hits.filter(function(hit) {
          return searchHitHasTranslation_(hit, searchConfig.translationLanguages);
        });
      }
      return hits;
    } catch (error) {
      lastError = error;
      Logger.log('Search attempt ' + (i + 1) + ' failed: ' + error.message);
    }
  }

  throw new Error(lastError && lastError.message ? lastError.message : 'Search is temporarily unavailable. Please try again.');
}

function findSearch(input, filters, pageRank) {
  return findSearchAdvanced(input, filters, pageRank, false);
}

function getNameCandidates(query) {
  var safeQuery = String(query || '').trim();
  if (!safeQuery) return [];
  try {
    var url = 'https://www.sefaria.org/api/name/' + encodeURIComponent(safeQuery) + '?limit=6';
    var response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    var statusCode = response.getResponseCode ? response.getResponseCode() : 200;
    if (statusCode >= 400) return [];
    var data = JSON.parse(response.getContentText() || '{}');
    var completions = Array.isArray(data.completions) ? data.completions : [];
    return completions.filter(function(c) { return typeof c === 'string' && c.trim(); }).slice(0, 6);
  } catch (e) {
    Logger.log('getNameCandidates failed: ' + e.message);
    return [];
  }
}

function searchVoices(query, options) {
  const safeQuery = String(query || '').trim();
  if (!safeQuery) {
    return [];
  }

  const payload = {
    from: 0,
    size: 24,
    highlight: {
      pre_tags: ['<b>'],
      post_tags: ['</b>'],
      fields: {
        content: { fragment_size: 180 },
        title: { fragment_size: 120 }
      }
    },
    query: {
      bool: {
        should: [
          { match_phrase: { title: { query: safeQuery, slop: 3 } } },
          { match_phrase: { content: { query: safeQuery, slop: 8 } } }
        ],
        minimum_should_match: 1
      }
    }
  };

  const response = UrlFetchApp.fetch('https://www.sefaria.org/api/search/sheet/_search', {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  const status = response.getResponseCode ? response.getResponseCode() : 200;
  if (status >= 400) {
    throw new Error('Voices search is temporarily unavailable.');
  }

  const json = JSON.parse(response.getContentText() || '{}');
  const hits = (((json || {}).hits || {}).hits || []);
  return hits.map(function(hit, index) {
    const source = (hit && hit._source) || {};
    const highlight = (hit && hit.highlight) || {};
    const snippet = (highlight.content && highlight.content[0]) || source.summary || '';
    const title = source.title || ('Sheet ' + (source.sheetId || index + 1));
    const url = source.sheetId ? ('https://www.sefaria.org/sheets/' + encodeURIComponent(source.sheetId)) : '';
    return {
      key: 'sheet-' + String(source.sheetId || hit._id || index),
      ref: 'sheet:' + String(source.sheetId || hit._id || index),
      label: title,
      subtitle: source.owner_name ? ('By ' + source.owner_name) : 'Source Sheet',
      snippet: snippet,
      summary: source.summary || '',
      owner: source.owner_name || '',
      ownerProfile: source.profile_url || '',
      url: url,
      sheetId: source.sheetId || null,
      topics: source.topics_en || [],
      typeLabel: 'Voices',
      clusterLabel: 'Source Sheets',
      kind: 'sheet',
      hasTranslation: true,
      availableLangs: ['en', 'he'],

      insertMode: 'reference',
      includeReference: true,
      includeContents: false,

      showMediaLabel: true,
      preserveSheetSpacing: true,
      debugUnknownNodes: false
    };
  });
}

// Backward-compatible entry point. Delegates to insertSheet with reference mode.
function insertSheetReference(sheetPayload) {
  return insertSheet(sheetPayload, { insertMode: 'reference' });
}
