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

  // Sefaria otherwise chooses one model for the whole body. Both models
  // need the same scoped text so each can still resolve contextual citations.
  const mixed = /[א-ת]/.test(body) && /\p{Script=Latin}/u.test(body);
  const languages = mixed ? ['he', 'en'] : [''];
  const tasks = languages.map(function (language) { return enqueueFindRefs_(body, language); });
  const reports = pollFindRefs_(tasks);
  if (!mixed) return reports[0];

  const bySpan = new Map();
  const refData = Object.assign({}, reports[0].refData, reports[1].refData);
  reports.forEach(function (report, i) {
    const ownScript = languages[i] === 'he' ? /[א-ת]/ : /\p{Script=Latin}/u;
    const otherScript = languages[i] === 'he' ? /\p{Script=Latin}/u : /[א-ת]/;
    report.results.forEach(function (row) {
      if (!row) return;
      const citation = body.slice(row.startChar, row.endChar);
      // Keep references containing the model's script and scriptless
      // citations (such as numeric continuations). The other model owns
      // its own single-script citations.
      if (!ownScript.test(citation) && otherScript.test(citation)) return;
      const refs = !row.linkFailed && Array.isArray(row.refs) ? row.refs : [];
      const key = row.startChar + ':' + row.endChar;
      const prior = bySpan.get(key);
      if (!prior) {
        bySpan.set(key, Object.assign({}, row, { refs: refs.slice(), linkFailed: !refs.length }));
      } else if (refs.length) {
        prior.refs = Array.from(new Set(prior.refs.concat(refs)));
        prior.linkFailed = false;
      }
    });
  });
  return { results: Array.from(bySpan.values()), refData: refData };
}

function enqueueFindRefs_(body, language) {
  const payload = { text: { title: '', body: body } };
  if (language) payload.lang = language;

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

  return taskId;
}

function pollFindRefs_(taskIds) {
  const delays = FIND_REFS_POLL_DELAYS_MS_;
  const reports = taskIds.map(function () { return null; });
  for (let attempt = 0; attempt < delays.length; attempt++) {
    Utilities.sleep(delays[attempt]);
    taskIds.forEach(function (taskId, index) {
      if (reports[index]) return;
      let statusResponse;
      try {
        statusResponse = UrlFetchApp.fetch(`https://www.sefaria.org/api/async/${encodeURIComponent(taskId)}`, { muteHttpExceptions: true });
      } catch (error) {
        return; // one dropped poll is not a failure; the deadline below is
      }
      const statusData = parseJsonOrNull_(statusResponse.getContentText());
      if (!statusData || !statusData.ready) return;
      const body = (((statusData || {}).result || {}).body || {});
      reports[index] = {
        results: Array.isArray(body.results) ? body.results : [],
        refData: (body.refData && typeof body.refData === 'object') ? body.refData : {}
      };
    });
    if (reports.every(Boolean)) return reports;
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
 * Every spelling of a reference worth trying, in the order to try them: the
 * normalized form, the text as written, the form without Hebrew numeral marks,
 * then traditional abbreviations expanded. The sidebar search and Link Texts
 * both try exactly this list (resolveReferenceWithFallbacks,
 * recoverUnmatchedCitations_), so a citation one of them finds, the other does
 * too.
 *
 * @returns {Array<string>} deduped, most faithful first
 */
function buildReferenceVariants_(reference) {
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

  return candidates;
}

/**
 * `properties` (optional) is what the Hebrew display and divine-name filters
 * read instead of the stored preferences; see preferenceOverlay_.
 */
function resolveReferenceWithFallbacks(reference, versions, properties) {
  const candidates = buildReferenceVariants_(reference);

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

/**
 * The sidebar's stored preferences with its Texts-tab session overrides on
 * top. The Layout tray's Vowels, Cantillation and Punctuation pills save to
 * the session (setSidebarSessionState), not to UserProperties, and those
 * marks are stripped when the text is fetched; a fetch that read only the
 * stored preferences inserted the text as if the pill had never been
 * toggled. Only SETTINGS keys are read from the session.
 */
function sidebarSessionPreferenceOverlay_(sessionId) {
  const session = sessionId ? getSidebarSessionState(sessionId) : {};
  const overrides = {};
  Object.keys(session || {}).forEach(function (key) {
    const value = session[key];
    if (SETTINGS.indexOf(key) < 0 || value === null || typeof value === 'object') return;
    overrides[key] = value;
  });
  return preferenceOverlay_(overrides);
}

/** findReference as the sidebar sees it: see sidebarSessionPreferenceOverlay_. */
function findReferenceForSidebar(reference, versions, sessionId) {
  const safeReference = String(reference || '').trim();
  if (!safeReference) {
    return;
  }
  return resolveReferenceWithFallbacks(safeReference, versions || undefined, sidebarSessionPreferenceOverlay_(sessionId));
}

/**
 * Texts v3 takes repeated full-language-family|title selectors. `en` and `he`
 * remain our translation/source roles, not API language names: a French
 * translation is stored under Sefaria's historical `language: "en"` too.
 * fetchReference_ supplies enLanguage/heLanguage from the version catalog.
 * No segment filling: an edition's gaps must not be credited to that edition
 * when their words actually came from another one. Keep the original markup;
 * footnote/commentary policy is a separate stage, shared with the preview.
 */
function sefariaTextsUrl_(safeReference, versions) {
  const choices = versions || {};
  const selectors = ['he', 'en'].map(function (role) {
    const title = String(choices[role] || '');
    if (!title.trim()) return role === 'he' ? 'primary' : 'translation';
    const family = String(choices[role + 'Language'] || '').trim().toLowerCase();
    if (!family || family.indexOf('|') >= 0 || title.indexOf('|') >= 0) throw sefariaUnavailableError_();
    return family + '|' + title;
  });
  return sefariaV3TextsUrl_(safeReference, selectors, 'default');
}

function sefariaV3TextsUrl_(reference, selectors, returnFormat) {
  return 'https://www.sefaria.org/api/v3/texts/' + encodeURIComponent(reference) + '?' +
    selectors.map(function (selector) { return 'version=' + encodeURIComponent(selector); }).join('&') +
    '&fill_in_missing_segments=0&return_format=' + encodeURIComponent(returnFormat);
}

function sefariaRefUrl_(reference) {
  return 'https://www.sefaria.org/api/ref/' + encodeURIComponent(reference);
}

/** Small, public metadata only, in the user's ephemeral cache. */
function sefariaMetadataCacheKey_(kind, reference) {
  return 'sefaria_v3_' + kind + ':' + Utilities.base64EncodeWebSafe(
    Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, reference, Utilities.Charset.UTF_8));
}

function readSefariaMetadataCache_(kind, reference) {
  try {
    const value = CacheService.getUserCache().get(sefariaMetadataCacheKey_(kind, reference));
    return value ? JSON.parse(value) : null;
  } catch (error) { return null; }
}

function writeSefariaMetadataCache_(kind, reference, value) {
  try {
    const serialized = JSON.stringify(value);
    if (serialized.length < 95000) {
      CacheService.getUserCache().put(sefariaMetadataCacheKey_(kind, reference), serialized, 21600);
    }
  } catch (error) { /* Cache misses and quota limits never change the answer. */ }
}

/** Shape data is optional. Keep ordinary text lookup when it is unavailable
 * or its addresses can't be verified against Ref metadata. */
function fetchBookContents_(book) {
  const cached = readSefariaMetadataCache_('contents', book.ref);
  if (cached) return cached;
  try {
    const response = UrlFetchApp.fetch('https://www.sefaria.org/api/shape/' + encodeURIComponent(book.ref),
      { muteHttpExceptions: true });
    if (response.getResponseCode && response.getResponseCode() >= 400) return null;
    const contents = buildBookContents_(book, parseJsonOrNull_(response.getContentText()));
    if (contents) writeSefariaMetadataCache_('contents', book.ref, contents);
    return contents;
  } catch (error) {
    return null;
  }
}

function buildBookContents_(book, payload) {
  const shapes = Array.isArray(payload) ? payload : [payload];
  const root = shapes.find(function (shape) {
    return shape && shape.book === book.ref && (book.complex ? shape.isComplex === true : shape.title === book.ref);
  });
  if (!root || !Array.isArray(root.chapters)) return null;
  const sections = [];
  if (book.complex) {
    const prefix = book.ref + ', ';
    const seen = new Set();
    function addNamedSections(children) {
      children.forEach(function (child) {
        if (!child || child.book !== book.ref) return;
        if (child.isComplex && Array.isArray(child.chapters)) {
          addNamedSections(child.chapters);
        } else if (typeof child.title === 'string' && child.title.startsWith(prefix) && !seen.has(child.title) &&
            (Number(child.chapters) > 0 || Array.isArray(child.chapters) && child.chapters.some(Boolean))) {
          seen.add(child.title);
          sections.push({ ref: child.title, label: child.title.slice(prefix.length) });
        }
      });
    }
    addNamedSections(root.chapters);
  } else {
    const prefix = book.ref + ' ';
    const daf = book.addressType === 'Talmud';
    function indexOfAddress(ref) {
      if (!ref || !ref.startsWith(prefix)) return NaN;
      const address = ref.slice(prefix.length);
      if (!daf) return /^\d+$/.test(address) ? Number(address) : NaN;
      const match = /^(\d+)([ab])$/.exec(address);
      return match ? Number(match[1]) * 2 + (match[2] === 'b' ? 1 : 0) : NaN;
    }
    const first = indexOfAddress(book.first);
    const last = indexOfAddress(book.last);
    if (last - first + 1 !== root.chapters.length) return null;
    root.chapters.forEach(function (count, offset) {
      if (!(Number(count) > 0 || Array.isArray(count) && count.some(Boolean))) return;
      const index = first + offset;
      const address = daf ? Math.floor(index / 2) + (index % 2 ? 'b' : 'a') : String(index);
      sections.push({ ref: prefix + address, label: book.sectionName + ' ' + address });
    });
  }
  return sections.length ? { ref: book.ref, heRef: book.heRef, indexTitle: book.ref, bookContents: sections } : null;
}

/** A metadata response, without ever logging a URL or its body. */
function interpretSefariaRefResponse_(response, browseBook) {
  if (!response) return { unavailable: true };
  const status = response.getResponseCode ? response.getResponseCode() : 200;
  if (status >= 400 && status !== 400 && status !== 404) return { unavailable: true, status: status };
  const meta = parseJsonOrNull_(response.getContentText());
  if (status >= 400 || (meta && (meta.is_ref === false || typeof meta.error === 'string'))) {
    return { error: meta && typeof meta.error === 'string' ? meta.error : '' };
  }
  if (!meta || meta.is_ref !== true || typeof meta.normalized !== 'string' || !meta.normalized ||
      typeof meta.index_title !== 'string' || !meta.index_title ||
      ['SchemaNode', 'JaggedArrayNode', 'DictionaryEntryNode', 'DictionaryNode', 'SheetNode'].indexOf(meta.node_type) < 0) {
    return { unavailable: true };
  }
  const structural = {
    ref: meta.normalized, heRef: meta.hebrew || '', indexTitle: meta.index_title,
    sectionNames: meta.section_names || [], he: [], text: [], versions: []
  };
  const base = { indexTitle: meta.index_title };
  if (browseBook && meta.normalized === meta.index_title) {
    const complex = meta.node_type === 'SchemaNode';
    if (complex || meta.node_type === 'JaggedArrayNode' && Number(meta.depth) > 1 &&
        Array.isArray(meta.start_labels) && meta.start_labels.length === 0) {
      const nav = meta.navigation_refs || {};
      base.bookForContents = {
        ref: meta.normalized, heRef: meta.hebrew || '', complex: complex,
        first: nav.first_subref, last: nav.last_subref,
        addressType: (meta.address_types || [])[0], sectionName: (meta.section_names || [])[0] || 'Section'
      };
    }
  }
  if (meta.node_type === 'SchemaNode') {
    const child = meta.default_child_node;
    if (!child || child.node_type !== 'JaggedArrayNode') return Object.assign(base, { resolved: structural });
    if (child.depth === 1) return Object.assign(base, { textRef: meta.normalized });
    // The first available ref on a complex book may be its introduction, not
    // its implicit/default text. Enter the default child, then validate that
    // ref through the metadata API before fetching any text.
    if (Number(child.depth) > 1 && Array.isArray(child.address_types)) {
      const seed = child.address_types[0] === 'Talmud' ? '1a' : '1';
      return Object.assign(base, { nextRef: meta.normalized + ' ' + seed });
    }
    return { unavailable: true };
  }
  if (meta.node_type !== 'JaggedArrayNode' && meta.node_type !== 'DictionaryEntryNode') {
    return Object.assign(base, { resolved: structural });
  }
  const starts = meta.start_labels;
  const ends = meta.end_labels;
  const depth = Number(meta.depth);
  if (!Array.isArray(starts) || !Array.isArray(ends) || !(depth >= 1)) return { unavailable: true };
  const isRange = JSON.stringify(starts) !== JSON.stringify(ends);
  if (!isRange && starts.length < depth - 1) {
    const first = meta.navigation_refs && meta.navigation_refs.first_available_section_ref;
    if (typeof first !== 'string' || !first || first === meta.normalized) return Object.assign(base, { resolved: structural });
    return Object.assign(base, { textRef: first });
  }
  return Object.assign(base, { textRef: meta.normalized });
}

/**
 * v3 does not implement v1's pad=1 despite the older v3 docs' description.
 * Resolve headings before asking for text, so "Genesis" never downloads or
 * inserts the whole book. Explicit sections/ranges keep their exact bounds.
 */
function resolveSefariaTextRef_(reference, browseBook) {
  const cacheKind = browseBook ? 'browse-ref' : 'ref';
  let current = reference;
  let expectedIndex = '';
  for (let hop = 0; hop < 4; hop++) {
    let plan = readSefariaMetadataCache_(cacheKind, current);
    if (!plan) {
      let response;
      try { response = UrlFetchApp.fetch(sefariaRefUrl_(current), { muteHttpExceptions: true }); }
      catch (error) { throw sefariaUnavailableError_(); }
      plan = interpretSefariaRefResponse_(response, browseBook);
      if (plan.textRef || plan.nextRef || plan.resolved) writeSefariaMetadataCache_(cacheKind, current, plan);
    }
    if (plan.unavailable) throw sefariaUnavailableError_(plan.status);
    const indexTitle = plan.indexTitle || (plan.resolved && plan.resolved.indexTitle);
    if (expectedIndex && indexTitle && indexTitle !== expectedIndex) throw sefariaUnavailableError_();
    if (plan.bookForContents) {
      const contents = fetchBookContents_(plan.bookForContents);
      if (contents) return { resolved: contents };
    }
    if (!plan.nextRef) return plan;
    expectedIndex = plan.indexTitle;
    current = plan.nextRef;
  }
  throw sefariaUnavailableError_();
}

/** Resolve a batch's metadata, following complex default nodes at most 4 times. */
function resolveSefariaRefPlansBatch_(refs, fetchAll) {
  const outcomes = refs.map(function () { return { unavailable: true }; });
  let pending = refs.map(function (ref, index) {
    return { ref: ref, index: index, visited: [ref], indexTitle: '' };
  });
  for (let depth = 0; depth < 4 && pending.length; depth++) {
    let responses;
    try {
      responses = fetchAll(pending.map(function (item) {
        return { url: sefariaRefUrl_(item.ref), muteHttpExceptions: true };
      }));
    } catch (error) {
      responses = null;
    }
    if (!Array.isArray(responses)) break;
    const following = [];
    pending.forEach(function (item, i) {
      let plan;
      try {
        plan = interpretSefariaRefResponse_(responses[i]);
      } catch (error) {
        plan = null;
      }
      if (!plan) return;
      const indexTitle = plan.indexTitle || (plan.resolved && plan.resolved.indexTitle) || '';
      if (item.indexTitle && indexTitle && item.indexTitle !== indexTitle) return;
      if (plan.nextRef) {
        if (item.visited.indexOf(plan.nextRef) >= 0) return;
        following.push({
          ref: plan.nextRef, index: item.index,
          visited: item.visited.concat([plan.nextRef]), indexTitle: item.indexTitle || indexTitle
        });
      } else {
        outcomes[item.index] = plan;
      }
    });
    pending = following;
  }
  return outcomes;
}

/** Cache only the catalog fields needed to select exact editions. */
function rememberSefariaVersionCatalog_(reference, list) {
  if (!Array.isArray(list)) return;
  const catalog = list.filter(function (v) { return v && typeof v.versionTitle === 'string'; }).map(function (v) {
    return { versionTitle: v.versionTitle, language: v.language, actualLanguage: v.actualLanguage,
      languageFamilyName: v.languageFamilyName, isPrimary: v.isPrimary, isSource: v.isSource };
  });
  writeSefariaMetadataCache_('versions', reference, catalog);
}

/** Versions is a separate current API, not the deprecated v1 Texts reader. */
function getSefariaVersionCatalog_(reference, indexTitle) {
  const cached = readSefariaMetadataCache_('versions', reference);
  if (Array.isArray(cached)) return cached;
  if (!indexTitle) {
    const plan = resolveSefariaTextRef_(reference);
    indexTitle = plan.indexTitle || (plan.resolved && plan.resolved.indexTitle);
    if (!indexTitle) return [];
  }
  let response;
  try {
    response = UrlFetchApp.fetch('https://www.sefaria.org/api/texts/versions/' + encodeURIComponent(indexTitle),
      { muteHttpExceptions: true });
  } catch (error) { throw sefariaUnavailableError_(); }
  const status = response.getResponseCode ? response.getResponseCode() : 200;
  if (status >= 400) throw sefariaUnavailableError_(status);
  const list = parseJsonOrNull_(response.getContentText());
  if (!Array.isArray(list) || !list.every(function (v) {
    return v && typeof v.versionTitle === 'string' && v.versionTitle.trim() &&
      typeof v.languageFamilyName === 'string' && v.languageFamilyName.trim();
  })) throw sefariaUnavailableError_();
  rememberSefariaVersionCatalog_(reference, list);
  return list;
}

function sefariaVersionRole_(version) {
  const v = version || {};
  const storedHebrew = String(v.language || '').toLowerCase() === 'he';
  const actual = String(v.actualLanguage || '').toLowerCase();
  const family = String(v.languageFamilyName || '').toLowerCase();
  if (actual === 'he' || family === 'hebrew') return 'he';
  // Aramaic/Judeo-Arabic primary texts still use the Hebrew source slot;
  // Yiddish/Persian translations can share that storage bucket but belong in
  // the translation picker. Original English works never become Hebrew.
  if (storedHebrew && (v.isPrimary === true || v.isSource === true)) return 'he';
  if (actual || family) return 'en';
  return storedHebrew ? 'he' : 'en';
}

function resolveSefariaVersionSelectors_(reference, versions, indexTitle) {
  const choices = Object.assign({}, versions || {});
  if (!choices.en && !choices.he) return choices;
  const catalog = getSefariaVersionCatalog_(reference, indexTitle);
  ['he', 'en'].forEach(function (role) {
    if (!choices[role]) return;
    const title = String(choices[role]);
    let matches = catalog.filter(function (v) { return v.versionTitle === title; });
    // Some real catalog titles end in a space. Preserve their exact spelling;
    // accept a trimmed external title only when it identifies one edition.
    if (!matches.length) {
      const aliases = catalog.filter(function (v) { return v.versionTitle.trim() === title.trim(); });
      if (aliases.length === 1) matches = aliases;
    }
    const entry = matches.filter(function (v) { return sefariaVersionRole_(v) === role; })[0] || matches[0];
    if (entry) choices[role] = entry.versionTitle;
    // Request a missing title in its historical role's language; the adapter
    // leaves that slot empty, never substituting a default edition for it.
    choices[role + 'Language'] = entry && entry.languageFamilyName
      ? String(entry.languageFamilyName).toLowerCase() : (role === 'he' ? 'hebrew' : 'english');
  });
  return choices;
}

/** v3's wire format -> the add-on's stable source/translation payload. */
function normalizeSefariaV3TextResponse_(payload, versions) {
  if (payload && typeof payload.error === 'string') return;
  if (!payload || typeof payload !== 'object' || Array.isArray(payload) ||
      typeof payload.ref !== 'string' || !payload.ref || typeof payload.indexTitle !== 'string' || !payload.indexTitle ||
      !Array.isArray(payload.versions) || !Array.isArray(payload.available_versions)) throw sefariaUnavailableError_();
  function normalizedText(value) {
    if (value === null) return '';
    if (typeof value === 'string') return value;
    if (Array.isArray(value)) return value.map(normalizedText);
    throw sefariaUnavailableError_();
  }
  payload.versions.forEach(function (v) {
    if (!v || typeof v.versionTitle !== 'string' || !v.versionTitle) throw sefariaUnavailableError_();
    normalizedText(v.text);
  });
  function metadata(v) { const copy = Object.assign({}, v); delete copy.text; return copy; }
  const catalog = payload.available_versions.map(function (v) {
    if (!v || typeof v.versionTitle !== 'string' || !v.versionTitle) throw sefariaUnavailableError_();
    return metadata(v);
  });
  payload.versions.forEach(function (v) {
    if (!catalog.some(function (entry) { return entry.versionTitle === v.versionTitle && entry.language === v.language; })) {
      catalog.push(metadata(v));
    }
  });
  function select(role) {
    const requested = String((versions && versions[role]) || '');
    if (requested.trim()) {
      const matches = payload.versions.filter(function (v) { return v.versionTitle === requested; });
      return matches.filter(function (v) { return sefariaVersionRole_(v) === role; })[0] || matches[0] || null;
    }
    let candidates = payload.versions.filter(function (v) { return sefariaVersionRole_(v) === role; });
    const otherRole = role === 'he' ? 'en' : 'he';
    const otherTitle = String((versions && versions[otherRole]) || '');
    if (otherTitle.trim()) {
      const otherMatches = payload.versions.filter(function (v) { return v.versionTitle === otherTitle; });
      const otherEdition = otherMatches.filter(function (v) { return sefariaVersionRole_(v) === otherRole; })[0] || otherMatches[0];
      // One bilingual publication can use the same title for its Hebrew and
      // English editions (Rosenbaum/Silbermann's Rashi does). Exclude only the
      // actual edition chosen for the other role, never every matching title.
      candidates = candidates.filter(function (v) { return v !== otherEdition; });
    }
    candidates = candidates.slice().sort(function (a, b) {
      function preferred(v) {
        return role === 'he' ? (v.isPrimary === true ? 1 : 0) :
          (v.actualLanguage === 'en' || v.languageFamilyName === 'english' ? 1 : 0);
      }
      return preferred(b) - preferred(a) || (Number(b.priority) || 0) - (Number(a.priority) || 0);
    });
    return candidates[0] || null;
  }
  const he = select('he');
  const en = select('en');
  const data = Object.assign({}, payload, {
    versions: catalog, he: he ? normalizedText(he.text) : [], text: en ? normalizedText(en.text) : [],
    heVersionTitle: he ? he.versionTitle : '', heVersionSource: he ? he.versionSource || '' : '', heLicense: he ? he.license || '' : '',
    versionTitle: en ? en.versionTitle : '', versionSource: en ? en.versionSource || '' : '', license: en ? en.license || '' : '',
    actualLanguage: en ? en.actualLanguage || '' : '', languageFamilyName: en ? en.languageFamilyName || '' : '',
    type: payload.type || payload.primary_category || (payload.categories || [])[0] || ''
  });
  // Keep selected edition metadata available for rendering and future
  // edition-aware commentary profiles, without copying its raw text again.
  data.sourceVersion = he ? metadata(he) : null;
  data.translationVersion = en ? metadata(en) : null;
  if (he && he.sources) data.heSources = he.sources;
  if (en && en.sources) data.sources = en.sources;
  return data;
}

/** Fetch one exact reference; `properties` defaults to the stored preferences. */
function fetchReference_(safeReference, versions, properties) {
  const plan = resolveSefariaTextRef_(safeReference, versions && versions.browseBook === true);
  if (plan.resolved) return plan.resolved;
  if (!plan.textRef) return;
  const selectedVersions = resolveSefariaVersionSelectors_(plan.textRef, versions, plan.indexTitle);
  const url = sefariaTextsUrl_(plan.textRef, selectedVersions);

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
  if (status === 400 || status === 404) return;
  if (status >= 400) throw sefariaUnavailableError_(status);

  try {
    const payload = parseJsonOrNull_(response.getContentText());
    let data = normalizeSefariaV3TextResponse_(payload, selectedVersions);
    if (!data) return;
    if (data.ref !== plan.textRef || (plan.indexTitle && data.indexTitle !== plan.indexTitle)) {
      throw sefariaUnavailableError_();
    }
    rememberSefariaVersionCatalog_(data.ref, payload.available_versions);
    writeSefariaMetadataCache_('ref', data.ref, { textRef: data.ref, indexTitle: data.indexTitle });

  /*although it might make more sense to put the filters (orthography, seamus) elsewhere, as it is text processing,
  all representations of this data need to have these applied to them such that the preview is נאמן to what the actual
  ref will look like when inserted*/

    const userProperties = snapshotProperties_(properties);
    // The transliteration reads the Hebrew as fetched, vowels included: with
    // Vowels off it read the bare consonants (שמע -> "shm'"). The Hebrew
    // punctuation setting and the divine-name substitutes still apply, as they
    // do to the Hebrew.
    data = attachTransliterationSource_(data, userProperties);
    data = applyHebrewDisplayPreferences(data, userProperties);
    // Before the divine-name replacements, so their substitutes (ה', G-d)
    // are never stripped.
    data = applyPunctuationPreferences(data, userProperties);
    data = applyHebrewDivineNamePreferences(data, userProperties);
    applyEnglishDivineNamePreference(data, userProperties);
    return data;

  } catch (error) {
    if (error && error.sefariaUnavailable) throw error;
    // Not the URL: the reference can be raw selected document text (Insert
    // Source from Selection), and hard rule 7 keeps that out of the logs.
    Logger.log(`Could not prepare the Sefaria response: ${error.message}`);
    throw new Error('Could not prepare the source text. Try again or choose a different edition.');
  }

}

/**
 * Which versions actually have text for this exact ref.
 *
 * A catalog lists candidates; only their returned text establishes passage
 * coverage. v3's available_versions can itself be filtered to a ref, while
 * the Versions API queried by index lists the whole book. Cache either only
 * under the requested ref, never promote a passage catalog to a book catalog.
 * Ask v3 for every known language's editions, with segment filling off.
 * The deployed API requires
 * languageFamilyName|all; a bare version=all returns an empty list/warning.
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
  const cacheKey = 'version_availability_v3:' + Utilities.base64EncodeWebSafe(
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
  let resolvedRef = safeRef;
  try {
    const plan = resolveSefariaTextRef_(safeRef);
    if (!plan.textRef) return null;
    resolvedRef = plan.textRef;
    const catalog = getSefariaVersionCatalog_(resolvedRef, plan.indexTitle);
    const selectors = [];
    catalog.forEach(function (version) {
      const family = String(version.languageFamilyName || '').trim().toLowerCase();
      const selector = family + '|all';
      if (family && family.indexOf('|') < 0 && selectors.indexOf(selector) < 0) selectors.push(selector);
    });
    if (!selectors.length) return null;
    const url = sefariaV3TextsUrl_(resolvedRef, selectors, 'text_only');
    const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    const status = response.getResponseCode ? response.getResponseCode() : 200;
    if (status >= 400) return null;
    data = JSON.parse(response.getContentText());
    if (data.ref && data.ref !== resolvedRef) return null;
  } catch (error) {
    Logger.log('getTranslationAvailability could not obtain an availability response.');
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
    const title = version && String(version.versionTitle || '');
    if (!title || !title.trim()) return;
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
