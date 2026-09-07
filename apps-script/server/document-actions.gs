// Document actions module: Quick Actions menu handlers for in-document text
// transformation (divine names) and reference linking to Sefaria.

function transformDivineNames() {
  const body = DocumentApp.getActiveDocument().getBody();
  const prefs = getPreferences();
  const noTransformsEnabled = [prefs.meforash_replace, prefs.yaw_replace, prefs.elodim_replace, prefs.god_replace]
    .every((value) => value != "true");
  if (noTransformsEnabled) {
    DocumentApp.getUi().alert('No divine-name transforms are enabled. Open Preferences and enable at least one transform before running this action.');
    return;
  }
  const hebrewMarks = "\\u0591-\\u05C7";
  const hebrewChars = "\\u0590-\\u05FF";
  const replaceRangesInTextElement = (textElement, ranges) => {
    if (!ranges || !ranges.length) {
      return;
    }

    for (let i = ranges.length - 1; i >= 0; i--) {
      const range = ranges[i];
      const start = range.start;
      const end = range.end;
      const replacement = range.replacement;
      const originalAttributes = textElement.getAttributes(start);
      const originalLink = textElement.getLinkUrl(start);

      textElement.deleteText(start, end);
      textElement.insertText(start, replacement);

      if (replacement.length > 0) {
        const replacementEnd = start + replacement.length - 1;
        textElement.setAttributes(start, replacementEnd, originalAttributes);
        textElement.setLinkUrl(start, replacementEnd, originalLink);
      }
    }
  };

  const replaceHebrewWordInTextElement = (textElement, tokenPattern, replacement) => {
    const source = textElement.getText();
    if (!source) {
      return;
    }
    const wrappedPattern = new RegExp(`(^|[^${hebrewChars}])(${tokenPattern})(?=$|[^${hebrewChars}])`, 'g');
    const ranges = [];
    let match;

    while ((match = wrappedPattern.exec(source)) !== null) {
      const prefix = match[1] || "";
      const token = match[2] || "";
      const tokenStart = match.index + prefix.length;
      const tokenEnd = tokenStart + token.length - 1;
      if (token.length > 0) {
        ranges.push({ start: tokenStart, end: tokenEnd, replacement });
      }
    }

    replaceRangesInTextElement(textElement, ranges);
  };

  const replaceRegexInTextElement = (textElement, regex, replacement) => {
    const source = textElement.getText();
    if (!source) {
      return;
    }
    const ranges = [];
    let match;

    while ((match = regex.exec(source)) !== null) {
      ranges.push({
        start: match.index,
        end: match.index + match[0].length - 1,
        replacement
      });
    }

    replaceRangesInTextElement(textElement, ranges);
  };

  const collectTextElements = (element, textElements) => {
    if (!element) {
      return;
    }

    if (element.getType && element.getType() === DocumentApp.ElementType.TEXT) {
      textElements.push(element.asText());
      return;
    }

    if (!element.getNumChildren) {
      return;
    }

    const count = element.getNumChildren();
    for (let i = 0; i < count; i++) {
      collectTextElements(element.getChild(i), textElements);
    }
  };

  const textElements = [];
  collectTextElements(body, textElements);

  textElements.forEach((textElement) => {
    if (prefs.meforash_replace == "true") {
      replaceHebrewWordInTextElement(textElement, `י[${hebrewMarks}]*ה[${hebrewMarks}]*ו[${hebrewMarks}]*ה[${hebrewMarks}]*`, prefs.meforash_replacement || "ה'");
    }
    if (prefs.yaw_replace == "true") {
      replaceHebrewWordInTextElement(textElement, `י[${hebrewMarks}]*ה[${hebrewMarks}]*`, prefs.yaw_replacement || "קה");
    }
    if (prefs.elodim_replace == "true") {
      replaceHebrewWordInTextElement(textElement, `א[${hebrewMarks}]*ל[${hebrewMarks}]*(?:ו[${hebrewMarks}]*)?ה[${hebrewMarks}]*י[${hebrewMarks}]*ם[${hebrewMarks}]*`, prefs.elodim_replacement || "אלוקים");
    }
    if (prefs.god_replace == "true") {
      replaceRegexInTextElement(textElement, /\bGod\b/g, prefs.god_replacement || "G-d");
    }
  });
}

/**
 * Resolve the document text that will actually be uploaded to Sefaria, and the
 * mapping needed to place the results back in the document.
 *
 * In `candidates` mode (the default) only windows that could plausibly hold a
 * reference leave the user's machine — see linker-prefilter.gs. In `full` mode
 * the whole body is sent, which is what this feature always used to do.
 *
 * Returns null when the pre-filter found nothing worth sending.
 */
function buildLinkerScanRequest_(docText, prefs) {
  const scanMode = String((prefs && prefs.linker_scan_mode) || 'candidates');

  if (scanMode === 'full') {
    return { payload: docText, segments: null, scannedChars: docText.length, totalChars: docText.length };
  }

  const titles = getSefariaTitlesCached_();
  const scan = buildLinkerScanPayload_(docText, titles);
  if (!scan.payload) {
    return null;
  }
  return scan;
}

/**
 * One-time, up-front disclosure that this command uploads document text.
 *
 * Every other feature sends only what the user typed into the search box. This
 * one reads their document, so they are told before it happens rather than
 * after — and told which mode is active, because the answer to "how much of my
 * document?" differs between them. Returns false if the user declines.
 */
function confirmLinkerUploadOnce_(scanMode) {
  const ACK_KEY = 'linker_upload_acknowledged';
  const userProperties = PropertiesService.getUserProperties();

  if (userProperties.getProperty(ACK_KEY) === 'true') {
    return true;
  }

  const scopeSentence = (scanMode === 'full')
    ? 'Right now it is set to send the ENTIRE text of this document.'
    : 'Right now it is set to send only the passages that look like they contain a citation — the rest of your writing stays in the document.';

  const ui = DocumentApp.getUi();
  const response = ui.alert(
    'Send text to Sefaria?',
    'To find citations, this command sends text from your document to sefaria.org.\n\n' +
    scopeSentence + '\n\n' +
    'You can change this any time in Preferences \u2192 Privacy & Document Scanning. ' +
    'Nothing is stored by this add-on, and this message will not be shown again.\n\n' +
    'Continue?',
    ui.ButtonSet.YES_NO
  );

  if (response !== ui.Button.YES) {
    return false;
  }

  userProperties.setProperty(ACK_KEY, 'true');
  return true;
}

/**
 * Turn Sefaria's raw find-refs results into the rows the review dialog shows.
 *
 * Pure apart from the injected `isAlreadyLinked` probe, so the classification —
 * which is the heart of this feature — is unit-testable without DocumentApp.
 * See test/tests/linker-classify.test.js.
 *
 * Sefaria's classification is binary: `refs` holds exactly one entry when the
 * resolver is confident, and several UNRANKED entries when the citation is
 * genuinely ambiguous. There is no partial-confidence signal to threshold on,
 * which is why "auto-link the confident ones, ask about the ties" is a faithful
 * reading of the API rather than a heuristic of ours.
 *
 * Everything that cannot become a link is counted rather than dropped. The
 * published add-on returned "Linked N references" with no hint that anything
 * else had happened, which is the silence this replaces.
 *
 * @param {Object} input {rawMatches, refData, segments, docText, isAlreadyLinked}
 * @returns {{matches: Array, unresolvedCount: number}}
 */
function classifyLinkerMatches_(input) {
  const rawMatches = (input && input.rawMatches) || [];
  const refData = (input && input.refData) || {};
  const segments = input && input.segments;
  const docText = String((input && input.docText) || '');
  const isAlreadyLinked = (input && input.isAlreadyLinked) || function () { return false; };

  const matches = [];
  let unresolvedCount = 0;
  let unplaceableCount = 0;

  for (let i = 0; i < rawMatches.length; i++) {
    const raw = rawMatches[i];
    if (!raw) continue;

    // Sefaria recognised a citation but could not resolve it.
    if (raw.linkFailed || !Array.isArray(raw.refs) || !raw.refs.length) {
      unresolvedCount++;
      continue;
    }

    const range = segments
      ? mapPayloadRangeToDocRange_(segments, Number(raw.startChar), Number(raw.endChar))
      : { startChar: Number(raw.startChar), endChar: Number(raw.endChar) };
    if (!range) {
      // Sefaria resolved this one, but it was stitched together across two
      // pre-filter windows, so no contiguous span of the document holds it.
      // Distinct from "unresolved": the citation is fine, our upload shape lost
      // it, and the reader has a remedy — scan the whole document. Nothing to
      // put in the review table, because there is no document text to link.
      unplaceableCount++;
      continue;
    }

    const start = range.startChar;
    const endExclusive = range.endChar;
    if (!isFinite(start) || !isFinite(endExclusive) || start < 0 ||
        endExclusive <= start || endExclusive > docText.length) {
      unplaceableCount++;
      continue;
    }

    // Already hyperlinked: leave it alone, and do not report it as a problem.
    if (isAlreadyLinked(start, endExclusive - 1)) {
      continue;
    }

    const candidates = [];
    for (let c = 0; c < raw.refs.length; c++) {
      const candidate = buildLinkerCandidate_(raw.refs[c], refData);
      if (candidate) candidates.push(candidate);
    }
    if (!candidates.length) {
      unresolvedCount++;
      continue;
    }

    matches.push({
      key: 'match-' + i + '-' + start,
      documentText: docText.substring(start, endExclusive),
      snippet: buildLinkerSnippet_(docText, start, endExclusive),
      startChar: start,
      endChar: endExclusive,
      ambiguous: candidates.length > 1,
      candidates: candidates
    });
  }

  return {
    matches: matches,
    unresolvedCount: unresolvedCount,
    unplaceableCount: unplaceableCount
  };
}

/**
 * Scan the document and report what CAN be linked, without changing anything.
 *
 * Split out from the apply step so the dialog can open immediately and show
 * progress while this runs. Previously the whole thing happened inside the menu
 * handler, so the only feedback during a multi-second scan was Google's generic
 * "running script" toast.
 *
 * Sefaria's resolver classifies each citation for us, and the classification is
 * binary — `refs` holds one ref when it is confident and several when it is
 * genuinely ambiguous, with no ranking between them. So "auto-link the
 * confident ones and ask about the rest" is a faithful reading of its output
 * rather than a threshold we invented.
 *
 * @returns {Object} scan report; see linker-results.html for the consumer.
 */
function scanDocumentForReferences() {
  const bodyText = DocumentApp.getActiveDocument().getBody().editAsText();
  const docText = bodyText.getText();
  const prefs = getPreferences();

  const scan = buildLinkerScanRequest_(docText, prefs);
  if (!scan) {
    return {
      matches: [],
      unresolvedCount: 0,
      unplaceableCount: 0,
      reviewMode: getLinkerReviewMode_(prefs),
      insertAfterLinking: linkerInsertsAfterLinking_(prefs),
      nothingToScan: true,
      scannedChars: 0,
      totalChars: docText.length
    };
  }

  const response = findRefsInDocumentText(scan.payload);

  const classified = classifyLinkerMatches_({
    rawMatches: Array.isArray(response.results) ? response.results : [],
    refData: response.refData || {},
    segments: scan.segments,
    docText: docText,
    isAlreadyLinked: function (start, endInclusive) {
      return !!(bodyText.getLinkUrl(start) || bodyText.getLinkUrl(endInclusive));
    }
  });
  const matches = classified.matches;
  const unresolvedCount = classified.unresolvedCount;
  const unplaceableCount = classified.unplaceableCount;

  return {
    matches: matches,
    unresolvedCount: unresolvedCount,
    unplaceableCount: unplaceableCount,
    reviewMode: getLinkerReviewMode_(prefs),
    insertAfterLinking: linkerInsertsAfterLinking_(prefs),
    nothingToScan: false,
    scannedChars: scan.scannedChars,
    totalChars: scan.totalChars
  };
}

function getLinkerReviewMode_(prefs) {
  const mode = String((prefs && prefs.linker_review_mode) || 'summary');
  return (mode === 'full' || mode === 'quiet') ? mode : 'summary';
}

function linkerInsertsAfterLinking_(prefs) {
  return prefs.link_sources_insert_after_linking == 'true' || prefs.link_sources_insert_after_linking === true;
}

/**
 * One selectable destination for an ambiguous citation, with enough text for
 * the reader to tell the candidates apart.
 */
function buildLinkerCandidate_(ref, refData) {
  const safeRef = String(ref || '').trim();
  if (!safeRef) return null;

  const data = (refData && refData[safeRef]) || {};
  // Excerpts arrive as Sefaria markup. Flatten to plain text here rather than
  // in the dialog: linker-results.html builds its DOM with textContent only,
  // and keeping it that way means the dialog has no HTML sink at all.
  const english = htmlToPlainText_(data.en || '', null);
  const hebrew = htmlToPlainText_(data.he || '', null);
  const preview = truncateLinkerPreview_(english || hebrew, 220);

  return {
    ref: safeRef,
    heRef: String(data.heRef || ''),
    preview: preview,
    category: String(data.primaryCategory || '')
  };
}

function truncateLinkerPreview_(text, maxLength) {
  const flat = String(text || '').replace(/\s+/g, ' ').trim();
  if (flat.length <= maxLength) return flat;
  return flat.substring(0, maxLength).replace(/\s\S*$/, '') + '…';
}

function buildLinkerSnippet_(docText, start, endExclusive) {
  const from = Math.max(0, start - 40);
  const to = Math.min(docText.length, endExclusive + 40);
  return docText.substring(from, to).replace(/\s+/g, ' ').trim();
}

/**
 * Apply the reader's decisions. Each decision names a match position and the
 * ref chosen for it.
 *
 * Applied end-to-start so that setLinkUrl on a later position cannot be
 * invalidated by an earlier edit.
 *
 * @param {string} decisionsJson JSON array of {startChar, endChar, ref}
 * @returns {Object} {linked, skipped}
 */
function applyLinkerDecisions(decisionsJson) {
  let decisions;
  try {
    decisions = JSON.parse(decisionsJson || '[]');
  } catch (error) {
    throw new Error('Could not read the link selections.');
  }
  if (!Array.isArray(decisions) || !decisions.length) {
    return { linked: 0, skipped: 0 };
  }

  const bodyText = DocumentApp.getActiveDocument().getBody().editAsText();
  const docLength = bodyText.getText().length;

  decisions.sort(function (a, b) { return Number(b.startChar) - Number(a.startChar); });

  let linked = 0;
  let skipped = 0;

  for (let i = 0; i < decisions.length; i++) {
    const decision = decisions[i] || {};
    const start = Number(decision.startChar);
    const endExclusive = Number(decision.endChar);
    const ref = String(decision.ref || '').trim();

    if (!ref || !isFinite(start) || !isFinite(endExclusive) || start < 0 || endExclusive <= start || endExclusive > docLength) {
      skipped++;
      continue;
    }

    try {
      const url = 'https://www.sefaria.org/' + encodeURIComponent(ref).replace(/%20/g, '_');
      bodyText.setLinkUrl(start, endExclusive - 1, url);
      linked++;
    } catch (error) {
      Logger.log('Could not link ' + ref + ': ' + error.message);
      skipped++;
    }
  }

  return { linked: linked, skipped: skipped };
}

function linkTextsWithSefaria() {
  const prefs = getPreferences();

  if (!confirmLinkerUploadOnce_(String(prefs.linker_scan_mode || 'candidates'))) {
    return;
  }

  // "quiet" keeps the published add-on's behaviour: link what is unambiguous,
  // say how many, and do not interrupt. The only change is that the summary now
  // reports what was skipped instead of staying silent about it.
  if (getLinkerReviewMode_(prefs) === 'quiet') {
    runQuietLinkPass_();
    return;
  }

  const html = HtmlService.createHtmlOutputFromFile('linker-results')
    .setWidth(720)
    .setHeight(560);
  DocumentApp.getUi().showModalDialog(html, 'Link Texts with Sefaria');
}

function runQuietLinkPass_() {
  const ui = DocumentApp.getUi();
  let report;
  try {
    report = scanDocumentForReferences();
  } catch (error) {
    ui.alert(error.message);
    return;
  }

  if (report.nothingToScan) {
    ui.alert('No text in this document looks like a Sefaria reference, so nothing was sent to Sefaria. If you expected a match, switch "Document scanning" to "Whole document" in Preferences.');
    return;
  }

  const decisions = [];
  let ambiguousCount = 0;
  report.matches.forEach(function (match) {
    if (match.ambiguous) {
      ambiguousCount++;
      return;
    }
    decisions.push({ startChar: match.startChar, endChar: match.endChar, ref: match.candidates[0].ref });
  });

  const result = applyLinkerDecisions(JSON.stringify(decisions));

  const parts = ['Linked ' + result.linked + ' reference' + (result.linked === 1 ? '' : 's') + ' to Sefaria.'];
  if (ambiguousCount) {
    parts.push(ambiguousCount + ' citation' + (ambiguousCount === 1 ? ' matched more than one source and was' : 's matched more than one source and were') + ' skipped.');
  }
  if (report.unresolvedCount) {
    parts.push(report.unresolvedCount + ' could not be matched to a Sefaria source.');
  }
  if (report.unplaceableCount) {
    parts.push('\n' + report.unplaceableCount + ' citation' + (report.unplaceableCount === 1 ? ' was' : 's were') +
      ' recognised but fell across a gap in the partial scan. Set "Document scanning" to "Whole document" in Preferences to catch these.');
  }
  if (ambiguousCount || report.unresolvedCount) {
    parts.push('\nTo review these instead of skipping them, change "After linking" in Preferences.');
  }
  ui.alert(parts.join(' '));
}

function insertLinkedSourceAtPosition(ref, startChar) {
  const doc = DocumentApp.getActiveDocument();
  const body = doc.getBody();
  const numChildren = body.getNumChildren();

  // Walk body children to find the paragraph containing startChar
  let charCount = 0;
  let targetChildIndex = numChildren - 1;
  for (let i = 0; i < numChildren; i++) {
    const child = body.getChild(i);
    let childText = '';
    try { childText = child.getText(); } catch (e) {}
    const nextCharCount = charCount + childText.length + 1;
    if (startChar < nextCharCount) {
      targetChildIndex = i;
      break;
    }
    charCount = nextCharCount;
  }

  // Set selection to that paragraph so insertReference inserts after it,
  // mirroring the insertSourceFromSelection path with preserveSelection: true.
  try {
    const targetChild = body.getChild(targetChildIndex);
    const range = doc.newRange().addElement(targetChild).build();
    doc.setSelection(range);
  } catch (e) {
    // Falls back to cursor or end of document
  }

  const resolved = findReference(ref);
  if (!resolved || !resolved.ref) {
    return { success: false, ref };
  }

  const prefs = getPreferences();
  const insertOptions = buildLinkSourcesInsertOptions_(prefs);
  insertReference(resolved, Object.assign({ preferredTitle: ref, preserveSelection: true }, insertOptions));
  return { success: true, ref };
}

function buildLinkSourcesInsertOptions_(prefs) {
  const outputMode = prefs.output_mode_default || 'both';
  const singleLanguage = (outputMode === 'both') ? undefined : outputMode;
  const bilingualLayout = prefs.bilingual_layout_default || 'he-right';
  const pasukPreference = prefs.show_line_markers_default == 'true' || prefs.show_line_markers_default === true;
  const includeTranslationSourceInfo = prefs.include_translation_source_info == 'true' || prefs.include_translation_source_info === true;
  const insertSefariaLink = prefs.insert_sefaria_link_default == 'true' || prefs.insert_sefaria_link_default === true;
  const includeTransliteration = prefs.include_transliteration_default == 'true' || prefs.include_transliteration_default === true;
  const insertCitationOnly = prefs.insert_citation_default == 'true' || prefs.insert_citation_default === true;
  return {
    singleLanguage: singleLanguage,
    pasukPreference: pasukPreference,
    bilingualLayout: bilingualLayout,
    includeTranslationSourceInfo: includeTranslationSourceInfo,
    insertSefariaLink: insertSefariaLink,
    includeTransliteration: includeTransliteration,
    insertCitationOnly: insertCitationOnly
  };
}

function unlinkSefariaSources() {
  const body = DocumentApp.getActiveDocument().getBody();
  const sefariaHostRe = /^https?:\/\/(?:[^/?#]*\.)?sefaria\.org(?:[/?#]|$)/i;
  const textElements = [];
  const collect = (element) => {
    if (!element) return;
    if (element.getType && element.getType() === DocumentApp.ElementType.TEXT) {
      textElements.push(element.asText());
      return;
    }
    if (!element.getNumChildren) return;
    const count = element.getNumChildren();
    for (let i = 0; i < count; i++) collect(element.getChild(i));
  };
  collect(body);

  let unlinkedCount = 0;
  textElements.forEach((textElement) => {
    const text = textElement.getText();
    const len = text.length;
    if (!len) return;
    let i = 0;
    while (i < len) {
      const url = textElement.getLinkUrl(i);
      if (url && sefariaHostRe.test(url)) {
        let j = i + 1;
        while (j < len && textElement.getLinkUrl(j) === url) j++;
        textElement.setLinkUrl(i, j - 1, null);
        unlinkedCount++;
        i = j;
      } else {
        i++;
      }
    }
  });

  DocumentApp.getUi().alert(`Removed ${unlinkedCount} Sefaria hyperlink${unlinkedCount === 1 ? '' : 's'}.`);
}

function insertSourceFromSelection() {
  const ui = DocumentApp.getUi();
  const doc = DocumentApp.getActiveDocument();
  const selection = doc.getSelection();
  if (!selection) {
    ui.alert('Select some text first — the selection is used as the reference to look up.');
    return;
  }

  let selectedText = '';
  const rangeElements = selection.getRangeElements();
  for (let i = 0; i < rangeElements.length; i++) {
    const re = rangeElements[i];
    const el = re.getElement();
    if (el.getType && el.getType() === DocumentApp.ElementType.TEXT) {
      const textEl = el.asText();
      if (re.isPartial()) {
        selectedText += textEl.getText().substring(re.getStartOffset(), re.getEndOffsetInclusive() + 1);
      } else {
        selectedText += textEl.getText();
      }
    }
  }
  selectedText = String(selectedText || '').trim();
  if (!selectedText) {
    ui.alert('Selected text is empty — select a Sefaria reference like "Genesis 1:1" and try again.');
    return;
  }

  let resolved;
  try {
    resolved = findReference(selectedText);
  } catch (error) {
    ui.alert(`Could not resolve "${selectedText}" to a Sefaria source: ${error.message}`);
    return;
  }
  if (!resolved || !resolved.ref) {
    ui.alert(`No Sefaria source matched "${selectedText}".`);
    return;
  }

  const prefs = getPreferences();
  const insertOptions = buildLinkSourcesInsertOptions_(prefs);
  try {
    insertReference(resolved, Object.assign({ preferredTitle: selectedText, preserveSelection: true }, insertOptions));
  } catch (error) {
    ui.alert(`Failed to insert source: ${error.message}`);
  }
}
