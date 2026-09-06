// Sefaria API fetching: reference normalization, resolution with fallbacks,
// and the raw text endpoint. Returns payloads that downstream code
// (text-processing.gs, insertion.gs) transforms before showing to the user.

function normalizeReferenceInput(reference) {
  let normalized = String(reference || '').trim();
  if (!normalized) {
    return '';
  }

  normalized = normalized
    .replace(/[־‐-―]/g, '-')
    .replace(/[“”„‟″״]/g, '"')
    .replace(/[‘’‚‛′׳]/g, "'")
    .replace(/[‎‏‪-‮]/g, '')
    .replace(/׃/g, ':')
    .replace(/\s*[:：]\s*/g, ':')
    .replace(/\s*[-–—]\s*/g, '-')
    .replace(/\s+/g, ' ')
    .trim();

  // Normalize common Hebrew numeral punctuation: א׳:א׳-ב׳ => א:א-ב
  normalized = normalized
    .replace(/([֐-׿])['"׳״]+(?=[\s:.-]|$)/g, '$1')
    .replace(/([֐-׿])['"׳״]+(?=[֐-׿])/g, '$1');

  normalized = normalized.replace(/([֐-׿])\s+([֐-׿])/g, '$1 $2');
  return normalized;
}

// Upper bound on what we will upload in one linker request. The endpoint is an
// async task with a bounded poll window below, so an oversized body does not
// fail loudly — it just times out and reports "0 references", which reads like
// a bug. Refuse it explicitly instead.
var FIND_REFS_MAX_CHARS_ = 100000;

function findRefsInDocumentText(documentText) {
  const body = String(documentText || '');
  if (!body.trim()) {
    return [];
  }
  if (body.length > FIND_REFS_MAX_CHARS_) {
    throw new Error(
      'This document is too large to scan in one pass (' + body.length.toLocaleString() +
      ' characters; the limit is ' + FIND_REFS_MAX_CHARS_.toLocaleString() +
      '). Link a section at a time, or turn on candidate-only scanning in Preferences.'
    );
  }

  const payload = {
    text: {
      title: '',
      body: body
    }
  };

  try {
    const enqueueResponse = UrlFetchApp.fetch('https://www.sefaria.org/api/find-refs', {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
    const enqueueData = JSON.parse(enqueueResponse.getContentText() || '{}');
    const taskId = enqueueData.task_id;
    if (!taskId) {
      return [];
    }

    for (let attempt = 0; attempt < 12; attempt++) {
      Utilities.sleep(400);
      const statusResponse = UrlFetchApp.fetch(`https://www.sefaria.org/api/async/${encodeURIComponent(taskId)}`, { muteHttpExceptions: true });
      const statusData = JSON.parse(statusResponse.getContentText() || '{}');
      if (!statusData.ready) {
        continue;
      }
      const body = (((statusData || {}).result || {}).body || {});
      return Array.isArray(body.results) ? body.results : [];
    }
  } catch (error) {
    Logger.log(`Failed to fetch find-refs output: ${error.message}`);
  }

  return [];
}

function resolveReferenceWithFallbacks(reference, versions) {
  const candidates = [];
  const normalized = normalizeReferenceInput(reference);
  if (normalized) {
    candidates.push(normalized);
  }
  const original = String(reference || '').trim();
  if (original && candidates.indexOf(original) < 0) {
    candidates.push(original);
  }

  for (let i = 0; i < candidates.length; i++) {
    const resolved = findReference(candidates[i], versions, true);
    if (resolved && resolved.ref && !resolved.error) {
      return resolved;
    }
  }

  return;
}

function findReference(reference, versions=undefined, skipNormalization=false) {
  // Technical debt: this resolver still fails hard on incomplete/partial refs (e.g. "Shemo" before "Shemot").
  // We should return structured "incomplete reference" states instead of relying on exception flow.
  let safeReference = String(reference || '').trim();
  if (!safeReference) {
    return;
  }
  if (!skipNormalization) {
    return resolveReferenceWithFallbacks(safeReference, versions);
  }

  Logger.log(`Reference: ${safeReference}`);
  let url = 'https://www.sefaria.org/api/texts/'

  let encodedReference = encodeURIComponent(safeReference);

  if (versions) {
    let encodedEnVersion = encodeURIComponent(versions.en || "");
    let encodedHeVersion = encodeURIComponent(versions.he || "");
    let versionedAdditions = `${encodedReference}?ven=${encodedEnVersion}&vhe=${encodedHeVersion}&commentary=0&context=0`;
    url = url + versionedAdditions;
  }
  else {
    let nonVersionedAdditions = `${encodedReference}?commentary=0&context=0`;
    url = url + nonVersionedAdditions;
  }

  // patch for now; triggered when an invalid sefer name is sent
  try {
    let response = UrlFetchApp.fetch(url);
    let data = JSON.parse(response.getContentText());

  /*although it might make more sense to put the filters (orthography, seamus) elsewhere, as it is text processing,
  all representations of this data need to have these applied to them such that the preview is נאמן to what the actual
  ref will look like when inserted*/

  // Technical debt: this try/catch currently wraps both fetch + text normalization + parsing.
  // Narrowing the protected region would make failures easier to reason about.

    const userProperties = PropertiesService.getUserProperties();
    data = applyHebrewDisplayPreferences(data, userProperties);
    data = applyHebrewDivineNamePreferences(data, userProperties);
    applyEnglishDivineNamePreference(data, userProperties);
    return data;

  } catch (error) {
    // return nothing
    Logger.log(`The system has made a macha'ah: ${error.message} from url ${url}`)
    return;
  }

}

/**
 * Cached title list for the linker pre-filter.
 *
 * /api/index/titles is a large, near-static payload. The linker needs it on
 * every run, so cache it per user for 6 hours rather than re-downloading it.
 * CacheService values are capped at 100KB, so the list is chunked; if it does
 * not fit or anything goes wrong we simply fetch fresh — the cache is an
 * optimization, never a correctness dependency.
 */
function getSefariaTitlesCached_() {
  var CACHE_KEY = 'sefaria_titles_v1';
  var CACHE_TTL_SECONDS = 21600;
  var cache = null;

  try {
    cache = CacheService.getUserCache();
    var cached = cache.get(CACHE_KEY);
    if (cached) {
      var parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length) {
        return parsed;
      }
    }
  } catch (error) {
    // Fall through to a fresh fetch.
  }

  var titles;
  try {
    titles = returnTitles();
  } catch (error) {
    Logger.log('Could not load Sefaria titles for the linker pre-filter: ' + error.message);
    return [];
  }

  if (!Array.isArray(titles)) {
    return [];
  }

  if (cache) {
    try {
      var serialized = JSON.stringify(titles);
      if (serialized.length < 95000) {
        cache.put(CACHE_KEY, serialized, CACHE_TTL_SECONDS);
      }
    } catch (error) {
      // A cache write failure is not worth surfacing.
    }
  }

  return titles;
}

function returnTitles() {
    let url = 'https://www.sefaria.org/api/index/titles/';
    let response = UrlFetchApp.fetch(url);
    let json = response.getContentText();
    let data = JSON.parse(json);
    let titleArray = data["books"];
    return titleArray;
}
