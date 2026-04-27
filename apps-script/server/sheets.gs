// Sheets module: source sheet insertion, rendering, and content extraction.
// Handles both reference (metadata) and full-content insertion modes.

function insertSheet(sheetPayload, frontendOptions) {
  if (!sheetPayload || !sheetPayload.url) {
    throw new Error('No sheet is selected.');
  }

  const document = DocumentApp.getActiveDocument();
  if (!document) {
    throw new Error('Open a Google Doc before inserting a sheet.');
  }

  const body = document.getBody();
  const typography = getTypographySettings();
  const normalizedOptions = normalizeSheetInsertOptions(sheetPayload, frontendOptions);

  let index = getInsertionIndex_(document, body);

  if (normalizedOptions.includeReference) {
    index = insertSheetReferenceBlock_(body, index, sheetPayload, typography, true);
  }

  if (normalizedOptions.includeContents) {
    const fullSheet = fetchSefariaSheetById_(sheetPayload.sheetId);
    index = insertSheetContentsBlock_(body, index, sheetPayload, fullSheet, typography, normalizedOptions);
  }

  return {
    ok: true,
    insertMode: normalizedOptions.insertMode,
    includedReference: normalizedOptions.includeReference,
    includedContents: normalizedOptions.includeContents,
    sheetId: sheetPayload.sheetId || null
  };
}

function normalizeSheetInsertOptions(sheetPayload, frontendOptions) {
  const opts = frontendOptions || {};
  const payloadMode = String(sheetPayload.insertMode || '').trim().toLowerCase();
  const passedMode = String(opts.insertMode || '').trim().toLowerCase();

  let insertMode = passedMode || payloadMode || 'reference';

  if (insertMode !== 'reference' && insertMode !== 'contents' && insertMode !== 'both') {
    insertMode = 'reference';
  }

  let includeReference = (insertMode === 'reference' || insertMode === 'both');
  let includeContents = (insertMode === 'contents' || insertMode === 'both');

  if (typeof sheetPayload.includeReference === 'boolean') {
    includeReference = sheetPayload.includeReference;
  }
  if (typeof sheetPayload.includeContents === 'boolean') {
    includeContents = sheetPayload.includeContents;
  }

  if (includeReference && includeContents) {
    insertMode = 'both';
  } else if (includeContents) {
    insertMode = 'contents';
  } else {
    insertMode = 'reference';
    includeReference = true;
    includeContents = false;
  }

  const rawScheme = opts.transliterationScheme || sheetPayload.transliterationScheme || null;
  const transliterationScheme = (rawScheme && rawScheme !== 'none') ? rawScheme : null;

  return {
    insertMode: insertMode,
    includeReference: includeReference,
    includeContents: includeContents,
    showMediaLabel: getBooleanOption_(sheetPayload.showMediaLabel, true),
    preserveSheetSpacing: getBooleanOption_(sheetPayload.preserveSheetSpacing, true),
    debugUnknownNodes: getBooleanOption_(sheetPayload.debugUnknownNodes, false),
    transliterationScheme: transliterationScheme
  };
}

function getBooleanOption_(value, fallback) {
  return typeof value === 'boolean' ? value : fallback;
}

function getInsertionIndex_(document, body) {
  let index = body.getNumChildren();
  const cursor = document.getCursor();
  if (cursor) {
    const currentElement = cursor.getElement();
    if (currentElement && currentElement.getParent()) {
      index = currentElement.getParent().getChildIndex(currentElement) + 1;
    }
  }
  return index;
}

function fetchSefariaSheetById_(sheetId) {
  const safeId = String(sheetId || '').trim();
  if (!safeId) {
    throw new Error('This sheet is missing a sheet ID.');
  }

  const response = UrlFetchApp.fetch('https://www.sefaria.org/api/sheets/' + encodeURIComponent(safeId), {
    method: 'get',
    muteHttpExceptions: true
  });

  const status = response.getResponseCode ? response.getResponseCode() : 200;
  if (status >= 400) {
    throw new Error('Unable to fetch the selected sheet contents.');
  }

  return JSON.parse(response.getContentText() || '{}');
}

function insertSheetReferenceBlock_(body, index, sheetPayload, typography, linkedTitle) {
  const title = String(sheetPayload.label || 'Sefaria Source Sheet').trim();
  const summary = String(sheetPayload.summary || '').trim();
  const owner = String(sheetPayload.owner || '').trim();
  const url = String(sheetPayload.url || '').trim();
  const topics = Array.isArray(sheetPayload.topics) ? sheetPayload.topics.filter(Boolean) : [];

  const titleParagraph = body.insertParagraph(index, title);
  titleParagraph.setHeading(DocumentApp.ParagraphHeading.HEADING2);
  if (linkedTitle && url) {
    titleParagraph.editAsText().setLinkUrl(url);
  }
  applyTitleTypography(titleParagraph, typography, true);
  index += 1;

  if (summary) {
    const summaryParagraph = body.insertParagraph(index, summary);
    summaryParagraph.setLeftToRight(true);
    applyTypographyToParagraph(
      summaryParagraph,
      typography.translationFont,
      typography.translationFontSize,
      typography.translationFontStyle
    );
    index += 1;
  }

  const metaBits = [];
  if (owner) metaBits.push('Curated by ' + owner);
  if (topics.length) metaBits.push('Topics: ' + topics.slice(0, 5).join(', '));
  if (url) metaBits.push(url);

  if (metaBits.length) {
    const metaParagraph = body.insertParagraph(index, metaBits.join(' • '));
    metaParagraph.setLeftToRight(true);
    applyTypographyToParagraph(
      metaParagraph,
      typography.sefariaLinkFont,
      Math.max(10, typography.sefariaLinkFontSize - 1),
      typography.sefariaLinkFontStyle
    );
    if (url) {
      metaParagraph.editAsText().setLinkUrl(url);
    }
    index += 1;
  }

  body.insertParagraph(index, '');
  index += 1;

  return index;
}

function insertSheetContentsBlock_(body, index, sheetPayload, fullSheet, typography, normalizedOptions) {
  const title = htmlToPlainText_(fullSheet.title || sheetPayload.label || 'Sefaria Source Sheet', normalizedOptions);
  const owner = String(fullSheet.ownerName || sheetPayload.owner || '').trim();
  const sources = Array.isArray(fullSheet.sources) ? fullSheet.sources : [];

  if (normalizedOptions.includeReference) {
    const spacer = body.insertParagraph(index, '');
    applyTypographyToParagraph(
      spacer,
      typography.translationFont,
      typography.translationFontSize,
      typography.translationFontStyle
    );
    index += 1;
  }

  const heading = body.insertParagraph(index, title);
  heading.setHeading(DocumentApp.ParagraphHeading.HEADING2);
  applyTitleTypography(heading, typography, true);
  index += 1;

  if (owner) {
    const ownerParagraph = body.insertParagraph(index, 'By ' + owner);
    ownerParagraph.setItalic(true);
    ownerParagraph.setLeftToRight(true);
    applyTypographyToParagraph(
      ownerParagraph,
      typography.translationFont,
      Math.max(10, typography.translationFontSize - 1),
      typography.translationFontStyle
    );
    index += 1;
  }

  if (!sources.length) {
    const emptyParagraph = body.insertParagraph(index, 'This sheet does not contain any source blocks.');
    emptyParagraph.setLeftToRight(true);
    applyTypographyToParagraph(
      emptyParagraph,
      typography.translationFont,
      typography.translationFontSize,
      typography.translationFontStyle
    );
    index += 1;
    return index;
  }

  for (var i = 0; i < sources.length; i++) {
    index = renderSheetSource_(body, index, sources[i], i + 1, typography, normalizedOptions);
  }

  return index;
}

function renderSheetSource_(body, index, source, ordinal, typography, normalizedOptions) {
  source = source || {};

  if (isEmptySheetSource_(source)) {
    return index;
  }

  const sourceOptions = normalizeSourceOptions_(source.options);
  const sourcePrefix = sourceOptions.sourcePrefix || '';
  const shouldIndent = sourceOptions.indented;

  if (source.ref || source.heRef || source.text) {
    const refBits = [];
    if (sourcePrefix) refBits.push(sourcePrefix);
    if (source.ref) refBits.push(String(source.ref));
    if (source.heRef) refBits.push(String(source.heRef));

    if (refBits.length) {
      const refParagraph = body.insertParagraph(index, ordinal + '. ' + refBits.join(' / '));
      refParagraph.setBold(true);
      refParagraph.setLeftToRight(true);
      if (shouldIndent) refParagraph.setIndentStart(24);
      applyTypographyToParagraph(
        refParagraph,
        typography.sefariaLinkFont,
        typography.sefariaLinkFontSize,
        typography.sefariaLinkFontStyle
      );
      index += 1;
    }

    if (source.title) {
      const titleParagraph = body.insertParagraph(index, htmlToPlainText_(source.title, normalizedOptions));
      titleParagraph.setItalic(true);
      titleParagraph.setLeftToRight(true);
      if (shouldIndent) titleParagraph.setIndentStart(24);
      applyTypographyToParagraph(
        titleParagraph,
        typography.translationFont,
        typography.translationFontSize,
        typography.translationFontStyle
      );
      index += 1;
    }

    const hebrewText = extractSheetText_(source.text, 'he', normalizedOptions);
    if (hebrewText) {
      index = appendMultilineParagraphs_(body, index, hebrewText, {
        rtl: true,
        indent: shouldIndent ? 24 : 0,
        fontFamily: typography.hebrewFont || typography.translationFont,
        fontSize: typography.hebrewFontSize || typography.translationFontSize,
        fontStyle: typography.hebrewFontStyle || typography.translationFontStyle
      });
      if (normalizedOptions.transliterationScheme) {
        const translitText = transliterateHebrewHtmlPreservingBasicBreaks(hebrewText, normalizedOptions.transliterationScheme, {
          keepNiqqud: true,
          isBiblicalHebrew: false
        });
        if (translitText) {
          index = appendMultilineParagraphs_(body, index, translitText, {
            rtl: false,
            indent: shouldIndent ? 24 : 0,
            fontFamily: typography.transliterationFont,
            fontSize: typography.transliterationFontSize,
            fontStyle: typography.transliterationFontStyle
          });
        }
      }
    }

    const englishText = extractSheetText_(source.text, 'en', normalizedOptions);
    if (englishText) {
      index = appendMultilineParagraphs_(body, index, englishText, {
        rtl: false,
        indent: shouldIndent ? 24 : 0,
        fontFamily: typography.translationFont,
        fontSize: typography.translationFontSize,
        fontStyle: typography.translationFontStyle
      });
    }

    body.insertParagraph(index, '');
    index += 1;
    return index;
  }

  if (source.outsideText) {
    const outsideText = htmlToPlainText_(source.outsideText, normalizedOptions);
    index = appendIndentedBlock_(body, index, outsideText, typography, false, shouldIndent ? 24 : 24, normalizedOptions);
    body.insertParagraph(index, '');
    index += 1;
    return index;
  }

  if (source.outsideBiText) {
    const he = htmlToPlainText_(source.outsideBiText.he || '', normalizedOptions);
    const en = htmlToPlainText_(source.outsideBiText.en || '', normalizedOptions);

    if (he) {
      index = appendIndentedBlock_(body, index, he, typography, true, shouldIndent ? 24 : 24, normalizedOptions);
    }
    if (en) {
      index = appendIndentedBlock_(body, index, en, typography, false, shouldIndent ? 24 : 24, normalizedOptions);
    }

    body.insertParagraph(index, '');
    index += 1;
    return index;
  }

  if (source.comment) {
    const commentText = htmlToPlainText_(source.comment, normalizedOptions);
    const commentParagraph = body.insertParagraph(index, commentText);
    commentParagraph.setLeftToRight(true);
    commentParagraph.setForegroundColor('#666666');
    commentParagraph.setItalic(true);
    commentParagraph.setIndentStart(shouldIndent ? 24 : 24);
    applyTypographyToParagraph(
      commentParagraph,
      typography.translationFont,
      typography.translationFontSize,
      typography.translationFontStyle
    );
    index += 1;

    body.insertParagraph(index, '');
    index += 1;
    return index;
  }

  if (source.media) {
    const mediaUrl = String(source.media).trim();
    const mediaLabel = normalizedOptions.showMediaLabel ? buildMediaLabel_(mediaUrl) : mediaUrl;

    const mediaParagraph = body.insertParagraph(index, mediaLabel);
    mediaParagraph.setLeftToRight(true);
    mediaParagraph.setIndentStart(shouldIndent ? 24 : 0);
    if (mediaUrl) {
      mediaParagraph.editAsText().setLinkUrl(mediaUrl);
    }
    applyTypographyToParagraph(
      mediaParagraph,
      typography.sefariaLinkFont,
      typography.sefariaLinkFontSize,
      typography.sefariaLinkFontStyle
    );
    index += 1;

    body.insertParagraph(index, '');
    index += 1;
    return index;
  }

  logUnknownSheetNode_(source, ordinal, normalizedOptions);
  return index;
}

function isEmptySheetSource_(source) {
  if (!source || typeof source !== 'object') return true;

  return !source.ref &&
    !source.heRef &&
    !source.text &&
    !source.outsideText &&
    !source.outsideBiText &&
    !source.comment &&
    !source.media &&
    !source.title;
}

function normalizeSourceOptions_(options) {
  const raw = options && typeof options === 'object' ? options : {};
  return {
    indented: isTruthySheetOption_(raw.indented),
    sourcePrefix: getNonEmptyString_(raw.sourcePrefix)
  };
}

function isTruthySheetOption_(value) {
  return value === true || value === 1 || value === '1' || value === 'true';
}

function getNonEmptyString_(value) {
  const text = String(value || '').trim();
  return text ? text : '';
}

function logUnknownSheetNode_(source, ordinal, normalizedOptions) {
  if (!normalizedOptions || !normalizedOptions.debugUnknownNodes) {
    return;
  }

  try {
    console.log('Unknown Sefaria sheet node shape at ordinal ' + ordinal + ': ' + JSON.stringify(source));
  } catch (err) {
    console.log('Unknown Sefaria sheet node shape at ordinal ' + ordinal + '.');
  }
}

function buildMediaLabel_(url) {
  const safeUrl = String(url || '').trim();
  if (!safeUrl) return 'Media';

  if (/youtube\.com\/embed\//i.test(safeUrl) || /youtu\.be\//i.test(safeUrl)) {
    return 'Media: YouTube Video';
  }
  if (/vimeo\.com/i.test(safeUrl)) {
    return 'Media: Vimeo Video';
  }
  if (/\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/i.test(safeUrl)) {
    return 'Media: Image';
  }

  return 'Media: ' + safeUrl;
}

function extractSheetText_(textObj, lang, normalizedOptions) {
  if (!textObj) return '';
  if (typeof textObj === 'string') return htmlToPlainText_(textObj, normalizedOptions);

  const raw = textObj[lang];
  if (Array.isArray(raw)) {
    return raw.map(function(item) {
      return htmlToPlainText_(item, normalizedOptions);
    }).filter(Boolean).join('\n');
  }
  return htmlToPlainText_(raw || '', normalizedOptions);
}

function appendMultilineParagraphs_(body, index, text, style) {
  const lines = splitSheetTextIntoLines_(text);

  if (!lines.length) {
    return index;
  }

  lines.forEach(function(line) {
    const paragraph = body.insertParagraph(index, line);
    paragraph.setLeftToRight(!style.rtl);
    if (typeof paragraph.setRightToLeft === 'function') {
      paragraph.setRightToLeft(!!style.rtl);
    }
    if (style.indent) {
      paragraph.setIndentStart(style.indent);
    }
    applyTypographyToParagraph(
      paragraph,
      style.fontFamily,
      style.fontSize,
      style.fontStyle
    );
    index += 1;
  });

  return index;
}

function appendIndentedBlock_(body, index, text, typography, rtl, indentStart, normalizedOptions) {
  const lines = splitSheetTextIntoLines_(text, normalizedOptions);

  lines.forEach(function(line) {
    const paragraph = body.insertParagraph(index, line);
    paragraph.setIndentStart(indentStart || 24);
    paragraph.setLeftToRight(!rtl);
    if (typeof paragraph.setRightToLeft === 'function') {
      paragraph.setRightToLeft(!!rtl);
    }
    applyTypographyToParagraph(
      paragraph,
      rtl ? (typography.hebrewFont || typography.translationFont) : typography.translationFont,
      rtl ? (typography.hebrewFontSize || typography.translationFontSize) : typography.translationFontSize,
      rtl ? (typography.hebrewFontStyle || typography.translationFontStyle) : typography.translationFontStyle
    );
    index += 1;
  });

  return index;
}

function splitSheetTextIntoLines_(text, normalizedOptions) {
  const preserveSpacing = !normalizedOptions || normalizedOptions.preserveSheetSpacing !== false;
  const raw = String(text || '').replace(/\r\n/g, '\n');

  if (!preserveSpacing) {
    return raw
      .split('\n')
      .map(function(line) { return line.trim(); })
      .filter(function(line) { return line !== ''; });
  }

  return raw
    .split('\n')
    .map(function(line) { return line.replace(/[ \t]+$/g, ''); })
    .filter(function(line, idx, arr) {
      if (line !== '') return true;
      return idx > 0 && arr[idx - 1] !== '';
    });
}

// Lightweight HTML-to-text for Sefaria sheet fields.
function htmlToPlainText_(html, normalizedOptions) {
  if (!html) return '';

  const preserveSpacing = !normalizedOptions || normalizedOptions.preserveSheetSpacing !== false;

  let text = String(html)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<li>/gi, '• ')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/<[^>]+>/g, '');

  if (preserveSpacing) {
    text = text
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n[ \t]+\n/g, '\n\n')
      .replace(/\n{4,}/g, '\n\n\n');
  } else {
    text = text
      .replace(/\n{3,}/g, '\n\n');
  }

  return text.trim();
}
