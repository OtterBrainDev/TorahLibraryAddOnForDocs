// Sefaria API fetching: reference normalization, resolution with fallbacks,
// and the raw text endpoint. Returns payloads that downstream code
// (text-processing.gs, insertion.gs) transforms before showing to the user.

/**
 * Canonicalize the punctuation of a reference WITHOUT discarding meaning.
 *
 * The rule this function follows, learned the hard way from the sheva-apostrophe
 * bug: a normalization applied to raw user input may only make characters
 * CONSISTENT. It may not remove a character that carries meaning — because when
 * that guess is wrong the lookup fails silently, and "no results" reads as
 * "Sefaria doesn't have it" rather than "we mangled your query".
 *
 * Anything genuinely lossy (stripping Hebrew numeral marks) is emitted as an
 * ADDITIONAL candidate by stripHebrewNumeralMarks_ instead, so the un-mangled
 * form is always tried too.
 */
function normalizeReferenceInput(reference) {
  let normalized = String(reference || '').trim();
  if (!normalized) {
    return '';
  }

  normalized = normalized
    // Unify the many dash and quote characters onto one spelling each. Lossless:
    // the character stays, only its codepoint changes.
    .replace(/[־‐-―]/g, '-')
    .replace(/[“”„‟″״]/g, '"')
    .replace(/[‘’‚‛′׳]/g, "'")
    // Invisible bidi controls carry no reference meaning and break exact match.
    .replace(/[‎‏‪-‮]/g, '')
    .replace(/׃/g, ':')
    .replace(/\s+/g, ' ')
    .trim();

  // Collapse spaces around ":" and "-" ONLY between numerals — "Genesis 1:1 - 1:5"
  // is a range and should tighten to "Genesis 1:1-1:5". An unconditional collapse
  // also rewrote titles: "The Torah: A Women's Commentary" became
  // "The Torah:A Women's Commentary", and "Sefer HaChinukh — Introduction" became
  // "Sefer HaChinukh-Introduction". Neither matches anything.
  normalized = normalized
    .replace(/([0-9\u05D0-\u05EA'"])\s*:\s*(?=[0-9\u05D0-\u05EA])/g, '$1:')
    .replace(/([0-9\u05D0-\u05EA'"])\s*-\s*(?=[0-9\u05D0-\u05EA])/g, '$1-');

  return normalized;
}

/**
 * Hebrew numerals are written with a geresh or gershayim — א׳ for 1, ל״ב for 32.
 * Sefaria will also accept them bare, so a stripped form is worth trying.
 *
 * This is NOT part of normalizeReferenceInput, because the same marks are what
 * make a Hebrew ABBREVIATION an abbreviation: רמב״ם (Rambam) and ב״מ (Bava
 * Metzia) become רמבם and במ, which are not words in any catalogue. Nothing
 * distinguishes the two cases by shape — ל״ב and ב״מ are identical in form — so
 * stripping is offered as an extra candidate rather than imposed on the query.
 *
 * @returns {string} the stripped form, or '' when nothing would change.
 */
function stripHebrewNumeralMarks_(reference) {
  const input = String(reference || '');
  if (!input) return '';

  const stripped = input
    .replace(/([֐-׿])['"׳״]+(?=[\s:.-]|$)/g, '$1')
    .replace(/([֐-׿])['"׳״]+(?=[֐-׿])/g, '$1');

  return stripped === input ? '' : stripped;
}


// Upper bound on what we will upload in one linker request. The endpoint is an
// async task with a bounded poll window below, so an oversized body does not
// fail loudly — it just times out and reports "0 references", which reads like
// a bug. Refuse it explicitly instead.
var FIND_REFS_MAX_CHARS_ = 100000;

function findRefsInDocumentText(documentText) {
  const body = String(documentText || '');
  if (!body.trim()) {
    return { results: [], refData: {} };
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

  // with_text gives us `refData`: heRef, url and a short excerpt for every
  // candidate ref, in the SAME request. That is what makes it possible to show
  // the reader what a link points to before applying it, without a second
  // round-trip per candidate. max_segments keeps the payload small.
  //
  // Every failure below throws. This used to catch everything and return an
  // empty result, so a network error, or a long document Sefaria had not
  // finished within ~5 seconds of polling, was reported as "no citations
  // found". Both callers (the review dialog and the quiet pass) show the
  // message.
  let enqueueResponse;
  try {
    enqueueResponse = UrlFetchApp.fetch('https://www.sefaria.org/api/find-refs?with_text=1&max_segments=1', {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
  } catch (error) {
    throw sefariaUnavailableError_();
  }
  const enqueueStatus = enqueueResponse.getResponseCode ? enqueueResponse.getResponseCode() : 200;
  if (enqueueStatus >= 400) {
    throw sefariaUnavailableError_(enqueueStatus);
  }
  const enqueueData = parseJsonOrNull_(enqueueResponse.getContentText());
  const taskId = enqueueData && enqueueData.task_id;
  if (!taskId) {
    throw new Error('Sefaria did not accept the document for scanning. Please try again in a moment.');
  }

  const delays = FIND_REFS_POLL_DELAYS_MS_;
  for (let attempt = 0; attempt < delays.length; attempt++) {
    Utilities.sleep(delays[attempt]);
    let statusResponse;
    try {
      statusResponse = UrlFetchApp.fetch(`https://www.sefaria.org/api/async/${encodeURIComponent(taskId)}`, { muteHttpExceptions: true });
    } catch (error) {
      continue; // one dropped poll is not a failure; the deadline below is
    }
    const statusData = parseJsonOrNull_(statusResponse.getContentText());
    if (!statusData || !statusData.ready) {
      continue;
    }
    const body = (((statusData || {}).result || {}).body || {});
    return {
      results: Array.isArray(body.results) ? body.results : [],
      refData: (body.refData && typeof body.refData === 'object') ? body.refData : {}
    };
  }

  const waitedSeconds = Math.round(delays.reduce(function (sum, d) { return sum + d; }, 0) / 1000);
  throw new Error(
    'Sefaria was still scanning this document after ' + waitedSeconds + ' seconds, so nothing was linked. ' +
    'Try again in a minute, or link a shorter section at a time.'
  );
}

// About 30 seconds in total: quick at first, for the common short document,
// then backing off. Well inside Apps Script's 6-minute execution limit.
var FIND_REFS_POLL_DELAYS_MS_ = [400, 400, 600, 800, 1000, 1000, 1500, 1500, 2000, 2000, 2500, 2500, 3000, 3000, 3000, 3000];

function parseJsonOrNull_(text) {
  try {
    return JSON.parse(text || '');
  } catch (error) {
    return null;
  }
}

/**
 * `properties` (optional) is what the Hebrew display and divine-name filters
 * read instead of the stored preferences; see preferenceOverlay_.
 */
function resolveReferenceWithFallbacks(reference, versions, properties) {
  const candidates = [];
  const normalized = normalizeReferenceInput(reference);
  if (normalized) {
    candidates.push(normalized);
  }
  const original = String(reference || '').trim();
  if (original && candidates.indexOf(original) < 0) {
    candidates.push(original);
  }

  // Hebrew numerals also resolve without their geresh/gershayim. Tried after the
  // faithful forms, never instead of them — see stripHebrewNumeralMarks_.
  const stripped = stripHebrewNumeralMarks_(normalized || original);
  if (stripped && candidates.indexOf(stripped) < 0) {
    candidates.push(stripped);
  }

  // Try traditional abbreviations last, after the literal forms. "Hil. Shabbat
  // 1:1" is indexed by Sefaria as "Mishneh Torah, Hilchot Shabbat 1:1"; these
  // expansions only ever ADD words, so they cannot silently retarget the query
  // at a different work. See citation-abbreviations.gs.
  const expansions = expandCitationAbbreviations_(normalized || original);
  for (let e = 0; e < expansions.length; e++) {
    if (candidates.indexOf(expansions[e]) < 0) {
      candidates.push(expansions[e]);
    }
  }

  for (let i = 0; i < candidates.length; i++) {
    const resolved = fetchReference_(candidates[i], versions, properties);
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
  return fetchReference_(safeReference, versions);
}

/**
 * findReference with some display preferences overridden for this one fetch
 * (Link Texts' "Customize this insertion"). Vowels and cantillation are
 * stripped when the text is fetched, so an override has to be applied here,
 * not after: stripped marks cannot be put back.
 *
 * @param {string} reference
 * @param {Object} overrides  preference keys -> values; nothing is stored.
 */
function findReferenceWithPreferences_(reference, overrides) {
  const safeReference = String(reference || '').trim();
  if (!safeReference) {
    return;
  }
  return resolveReferenceWithFallbacks(safeReference, undefined, preferenceOverlay_(overrides));
}

/** Fetch one exact reference; `properties` defaults to the stored preferences. */
function fetchReference_(safeReference, versions, properties) {
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

  // A reference Sefaria doesn't know is an ordinary outcome ("no match"). Not
  // reaching Sefaria at all is not, and used to be reported the same way:
  // Insert Source from Selection said 'No Sefaria source matched "Genesis
  // 1:1"' when the network was down. That case now throws, so every caller's
  // failure path shows what actually happened.
  let response;
  try {
    response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  } catch (error) {
    throw sefariaUnavailableError_();
  }
  const status = response.getResponseCode ? response.getResponseCode() : 200;
  if (status === 429 || status >= 500) {
    throw sefariaUnavailableError_(status);
  }
  if (status >= 400) {
    return;
  }

  try {
    let data = JSON.parse(response.getContentText());

  /*although it might make more sense to put the filters (orthography, seamus) elsewhere, as it is text processing,
  all representations of this data need to have these applied to them such that the preview is נאמן to what the actual
  ref will look like when inserted*/

    const userProperties = properties || PropertiesService.getUserProperties();
    data = applyHebrewDisplayPreferences(data, userProperties);
    data = applyHebrewDivineNamePreferences(data, userProperties);
    applyEnglishDivineNamePreference(data, userProperties);
    return data;

  } catch (error) {
    // Not the URL: the reference can be raw selected document text (Insert
    // Source from Selection), and hard rule 7 keeps that out of the logs.
    Logger.log(`The system has made a macha'ah in findReference: ${error.message}`)
    return;
  }

}

/**
 * Which versions actually have text for this exact ref.
 *
 * The version list in /api/texts is the whole book's, so a translation that
 * covers only part of it (Yiddish on Deuteronomy 6:4) is listed for every
 * verse. The v3 endpoint with version=all returns each version's text for the
 * ref, which is the only per-ref signal Sefaria offers.
 *
 * Returns { ref, versions: { versionTitle: true|false } }, or null when the
 * answer is unknown (network, unexpected shape) — callers must then treat every
 * version as available, never hide one on a failed lookup. A version Sefaria
 * omits from the response is left out of the map, i.e. unknown.
 *
 * @param {string} ref  a ref Sefaria already resolved (findReference's `ref`).
 */
function getTranslationAvailability(ref) {
  const safeRef = String(ref || '').trim();
  if (!safeRef) return null;

  const CACHE_TTL_SECONDS = 21600;
  const cacheKey = 'version_availability_v1:' + Utilities.base64EncodeWebSafe(
    Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, safeRef, Utilities.Charset.UTF_8));
  let cache = null;
  try {
    cache = CacheService.getUserCache();
    const cached = cache.get(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch (error) {
    cache = null;
  }

  let data;
  try {
    const url = 'https://www.sefaria.org/api/v3/texts/' + encodeURIComponent(safeRef) +
      '?version=all&return_format=text_only';
    const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    const status = response.getResponseCode ? response.getResponseCode() : 200;
    if (status >= 400) return null;
    data = JSON.parse(response.getContentText());
  } catch (error) {
    Logger.log('getTranslationAvailability failed: ' + (error && error.message));
    return null;
  }

  const result = summarizeVersionAvailability_(data);
  if (!result) return null;
  result.ref = safeRef;
  if (cache) {
    try { cache.put(cacheKey, JSON.stringify(result), CACHE_TTL_SECONDS); } catch (error) { /* optimization only */ }
  }
  return result;
}

/** v3 texts payload -> { versions: { versionTitle: hasText } }, or null if unusable. */
function summarizeVersionAvailability_(data) {
  const list = data && Array.isArray(data.versions) ? data.versions : null;
  if (!list || !list.length) return null;
  const versions = {};
  list.forEach(function (version) {
    const title = version && String(version.versionTitle || '').trim();
    if (!title) return;
    // The same title in two languages: available if either has text.
    versions[title] = versions[title] === true || versionHasText_(version.text);
  });
  return { versions: versions };
}

function versionHasText_(value) {
  if (Array.isArray(value)) return value.some(versionHasText_);
  if (value === null || value === undefined) return false;
  return String(value).replace(/<[^>]*>/g, '').replace(/&nbsp;/gi, ' ').trim().length > 0;
}

/**
 * The error for "Sefaria could not be reached or is failing", as opposed to
 * "Sefaria has no such reference". The message never carries the request URL:
 * it can hold document text (hard rule 7).
 */
function sefariaUnavailableError_(status) {
  const detail = status ? ' (it responded with error ' + status + ')' : '';
  const error = new Error(
    'Couldn\u2019t reach Sefaria' + detail + '. Check your internet connection and try again in a moment.'
  );
  error.sefariaUnavailable = true;
  return error;
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
