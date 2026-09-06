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

function linkTextsWithSefaria() {
  const bodyText = DocumentApp.getActiveDocument().getBody().editAsText();
  const docText = bodyText.getText();
  const prefs = getPreferences();

  if (!confirmLinkerUploadOnce_(String(prefs.linker_scan_mode || 'candidates'))) {
    return;
  }

  const scan = buildLinkerScanRequest_(docText, prefs);
  if (!scan) {
    DocumentApp.getUi().alert('No text in this document looks like a Sefaria reference, so nothing was sent to Sefaria. If you expected a match, switch "Document scanning" to "Whole document" in Preferences.');
    return;
  }

  const rawMatches = findRefsInDocumentText(scan.payload);

  // Translate offsets from the uploaded payload back onto the document. In
  // `full` mode the payload IS the document, so offsets pass through.
  const linkerMatches = [];
  for (let i = 0; i < rawMatches.length; i++) {
    const match = rawMatches[i];
    if (!match) continue;
    if (!scan.segments) {
      linkerMatches.push(match);
      continue;
    }
    const mapped = mapPayloadRangeToDocRange_(scan.segments, Number(match.startChar), Number(match.endChar));
    if (!mapped) continue;
    linkerMatches.push(Object.assign({}, match, { startChar: mapped.startChar, endChar: mapped.endChar }));
  }

  const insertAfterLinking = prefs.link_sources_insert_after_linking == "true" || prefs.link_sources_insert_after_linking === true;
  const linkedRefItems = [];
  let linkedCount = 0;
  linkerMatches.forEach((match) => {
    if (!match || match.linkFailed || !Array.isArray(match.refs) || !match.refs.length) {
      return;
    }
    const start = Number(match.startChar);
    const endExclusive = Number(match.endChar);
    if (!isFinite(start) || !isFinite(endExclusive)) {
      return;
    }
    const end = endExclusive - 1;
    if (start < 0 || end < start || end >= docText.length) {
      return;
    }
    if (bodyText.getLinkUrl(start) || bodyText.getLinkUrl(end)) {
      return;
    }
    const ref = String(match.refs[0] || '').trim();
    if (!ref) {
      return;
    }
    const url = `https://www.sefaria.org/${encodeURIComponent(ref).replace(/%20/g, '_')}`;
    bodyText.setLinkUrl(start, end, url);
    linkedCount++;

    const snippetStart = Math.max(0, start - 30);
    const snippetEnd = Math.min(docText.length, endExclusive + 30);
    const snippet = docText.substring(snippetStart, snippetEnd).replace(/\n/g, ' ').trim();
    linkedRefItems.push({ ref, startChar: start, endChar: endExclusive, snippet });
  });

  if (insertAfterLinking && linkedRefItems.length > 0) {
    showLinkerResultsDialog_(linkedCount, linkedRefItems);
  } else {
    DocumentApp.getUi().alert(`Linked ${linkedCount} recognizable reference${linkedCount === 1 ? '' : 's'} to Sefaria.`);
  }
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
