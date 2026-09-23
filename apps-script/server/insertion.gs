// Insertion module: inserting resolved references into Google Docs.
// Handles layout modes (bilingual, single-language), typography application,
// transliteration rendering, and rich-text HTML-to-Docs conversion.
// All functions called from menu.gs or client-side insertReference handlers.

/**
 * Read the emphasis (bold / italic) runs already present in a text element.
 *
 * Uses getTextAttributeIndices() rather than probing every character: it
 * returns only the offsets where formatting changes, so a passage with three
 * bolded phrases costs a handful of Apps Script calls instead of one per
 * character. Only runs that actually carry emphasis are returned — the absence
 * of emphasis is not something we need to restore.
 */
function captureEmphasisRuns_(text, length) {
  const runs = [];
  if (!text || !(length > 0)) {
    return runs;
  }

  let boundaries;
  try {
    boundaries = text.getTextAttributeIndices() || [];
  } catch (error) {
    return runs;
  }

  if (boundaries.indexOf(0) < 0) {
    boundaries = [0].concat(boundaries);
  }

  for (let i = 0; i < boundaries.length; i++) {
    const start = boundaries[i];
    const end = (i + 1 < boundaries.length ? boundaries[i + 1] : length) - 1;
    if (!(start >= 0) || end < start || end >= length) {
      continue;
    }
    let bold = false;
    let italic = false;
    try {
      bold = text.isBold(start) === true;
      italic = text.isItalic(start) === true;
    } catch (error) {
      continue;
    }
    if (bold || italic) {
      runs.push({ start: start, end: end, bold: bold, italic: italic });
    }
  }

  return runs;
}

function sourceEmphasisPreservationEnabled_() {
  // Read at call time, not from a module-scope cache. See the
  // `extendedGemaraPreference` row in docs/regression-log.md.
  try {
    return PropertiesService.getUserProperties().getProperty("preserve_source_emphasis") !== "false";
  } catch (error) {
    return true;
  }
}

/**
 * Apply the user's font family / size / style to a whole paragraph.
 *
 * @param {Paragraph} paragraph
 * @param {string} font
 * @param {number} size
 * @param {string} style               Comma-separated flags, or "normal".
 * @param {Object} [opts]
 * @param {boolean} [opts.preserveSourceEmphasis=false]
 *        Opt in for paragraphs whose text came from Sefaria markup. The style
 *        flags are applied as the BASELINE across the paragraph, then the
 *        bold/italic runs the source specified are re-asserted on top. Without
 *        this, `setBold(0, len - 1, false)` flattened every run that
 *        `insertRichTextFromHTML` had just set — which is why the Steinsaltz
 *        Talmud lost the bolding that distinguishes the Talmud's own words
 *        from Steinsaltz's interpolated explanation. Titles and metadata lines
 *        deliberately do NOT opt in: their emphasis is ours, not the source's,
 *        and the user's style preference must stay authoritative there.
 */
/**
 * Apply one emphasis mapping to a range. Only ever turns formatting ON, so the
 * baseline style applied across the paragraph still governs everywhere the
 * source said nothing.
 */
function applyEmphasisMapping_(text, start, end, mapping) {
  if (!mapping || end < start) {
    return;
  }

  const flags = String(mapping.style || '')
    .split(',')
    .map(function (flag) { return flag.trim().toLowerCase(); })
    .filter(Boolean);

  if (flags.indexOf('bold') >= 0) text.setBold(start, end, true);
  if (flags.indexOf('italic') >= 0) text.setItalic(start, end, true);
  if (flags.indexOf('underline') >= 0) text.setUnderline(start, end, true);

  if (mapping.color) text.setForegroundColor(start, end, mapping.color);
  if (mapping.background) text.setBackgroundColor(start, end, mapping.background);
  if (mapping.font) text.setFontFamily(start, end, mapping.font);
}

/**
 * Apply the user's font family / size / style / colour to a whole paragraph.
 *
 * @param {Paragraph} paragraph
 * @param {string} font
 * @param {number} size
 * @param {string} style               Comma-separated flags, or "normal".
 * @param {Object} [opts]
 * @param {string} [opts.color]        Foreground colour, "#rrggbb". Omitted or
 *                                     null leaves the existing colour alone.
 * @param {string} [opts.background]   Background colour, same convention.
 * @param {boolean} [opts.preserveSourceEmphasis=false]
 *        Opt in for paragraphs whose text came from Sefaria markup. The style
 *        flags are applied as the BASELINE across the paragraph, then the
 *        bold/italic runs the source specified are re-rendered on top via
 *        `opts.emphasisMap`. Without this, `setBold(0, len - 1, false)`
 *        flattened every run that `insertRichTextFromHTML` had just set —
 *        which is why the Steinsaltz Talmud lost the bolding that
 *        distinguishes the Talmud's own words from Steinsaltz's interpolated
 *        explanation. Titles and metadata lines deliberately do NOT opt in:
 *        their emphasis is ours, not the source's, and the user's style
 *        preference must stay authoritative there.
 * @param {Object} [opts.emphasisMap]  {bold: mapping, italic: mapping}. When
 *        absent, source emphasis is re-asserted as itself.
 */
function applyTypographyToParagraph(paragraph, font, size, style, opts) {
  if (!paragraph) {
    return;
  }

  const text = paragraph.editAsText();
  const len = text.getText().length;
  if (len <= 0) {
    return;
  }

  const options = opts || {};
  const preserveEmphasis = !!options.preserveSourceEmphasis && sourceEmphasisPreservationEnabled_();
  const emphasisRuns = preserveEmphasis ? captureEmphasisRuns_(text, len) : [];

  if (font) {
    text.setFontFamily(0, len - 1, font);
  }
  if (!isNaN(size) && size > 0) {
    text.setFontSize(0, len - 1, size);
  }

  const fontStyle = String(style || "normal");
  const flags = fontStyle === "normal" ? [] : fontStyle.split(",");
  text.setBold(0, len - 1, flags.indexOf("bold") >= 0);
  text.setItalic(0, len - 1, flags.indexOf("italic") >= 0);
  text.setUnderline(0, len - 1, flags.indexOf("underline") >= 0);

  if (options.color) {
    text.setForegroundColor(0, len - 1, options.color);
  }
  if (options.background) {
    text.setBackgroundColor(0, len - 1, options.background);
  }

  // Re-render what the source emphasized, through the user's mapping. The
  // default mapping is the identity (bold renders as bold), but a user can map
  // Sefaria's bold to a colour, a different font, or nothing at all.
  const emphasisMap = options.emphasisMap || DEFAULT_EMPHASIS_MAP_;
  for (let i = 0; i < emphasisRuns.length; i++) {
    const run = emphasisRuns[i];
    if (run.bold) {
      applyEmphasisMapping_(text, run.start, run.end, emphasisMap.bold);
    }
    if (run.italic) {
      applyEmphasisMapping_(text, run.start, run.end, emphasisMap.italic);
    }
  }
}

// Identity mapping, used when a caller preserves emphasis without supplying a
// typography bag (keeps old behaviour for any call site that predates the map).
const DEFAULT_EMPHASIS_MAP_ = {
  bold: { style: 'bold', color: null, background: null, font: '' },
  italic: { style: 'italic', color: null, background: null, font: '' }
};

/**
 * Apply a named typography role (hebrew / translation / transliteration /
 * sourceTitle / sefariaLink) to a paragraph.
 *
 * This is the shape new code should use: it carries colour and background,
 * which the positional form cannot, and it keeps role lookup in one place.
 *
 * @param {Object} [overrides] {size, style, preserveSourceEmphasis}
 */
function applyRoleTypography_(paragraph, typography, roleName, overrides) {
  const role = (typography && typography.roles && typography.roles[roleName]) || null;
  if (!role) {
    return;
  }
  const extra = overrides || {};
  applyTypographyToParagraph(
    paragraph,
    role.font,
    extra.size !== undefined ? extra.size : role.size,
    extra.style !== undefined ? extra.style : role.style,
    {
      color: role.color,
      background: role.background,
      preserveSourceEmphasis: extra.preserveSourceEmphasis === true,
      emphasisMap: typography ? typography.emphasisMap : null
    }
  );
}


/**
 * Font family and size of the text where the user is inserting, for the
 * "match the document" typography default. Reads the paragraph holding the
 * cursor (or the start of the selection); if that is a heading or empty, the
 * nearest preceding body-text paragraph. Returns {font, size}, either of which
 * may be null — Docs reports null when the text just follows the Normal text
 * style, and leaving it unset gives the same result.
 */
function readSurroundingTextStyle_() {
  const doc = DocumentApp.getActiveDocument();
  let element = null;
  let offset = 0;
  const cursor = doc.getCursor();
  if (cursor) {
    element = cursor.getElement();
    offset = cursor.getOffset();
  } else {
    const selection = doc.getSelection();
    const ranges = selection ? selection.getRangeElements() : [];
    if (ranges.length) {
      element = ranges[0].getElement();
      offset = ranges[0].isPartial() ? ranges[0].getStartOffset() : 0;
    }
  }
  if (!element) return null;

  const isTextElement = element.getType() === DocumentApp.ElementType.TEXT;
  let paragraph = element;
  while (paragraph && !isBodyTextBlock_(paragraph)) {
    paragraph = paragraph.getParent ? paragraph.getParent() : null;
  }

  // Up to a screenful back; past that the "surrounding" text is not really
  // surrounding any more, and the Normal text style is the better answer.
  let charIndex = isTextElement ? offset - 1 : 0;
  for (let steps = 0; paragraph && steps < 20; steps++) {
    const text = paragraph.editAsText();
    const length = text.getText().length;
    if (length > 0 && isNormalTextParagraph_(paragraph)) {
      const at = Math.max(0, Math.min(length - 1, charIndex));
      return { font: text.getFontFamily(at), size: text.getFontSize(at) };
    }
    charIndex = Infinity; // earlier paragraphs: sample their last character
    do {
      paragraph = paragraph.getPreviousSibling();
    } while (paragraph && !isBodyTextBlock_(paragraph));
  }
  return null;
}

function isBodyTextBlock_(element) {
  const type = element.getType();
  return type === DocumentApp.ElementType.PARAGRAPH || type === DocumentApp.ElementType.LIST_ITEM;
}

function isNormalTextParagraph_(block) {
  try {
    return block.getHeading() === DocumentApp.ParagraphHeading.NORMAL;
  } catch (error) {
    return true;
  }
}

/** "heading1".."heading6" → DocumentApp.ParagraphHeading; anything else → null. */
function titleParagraphHeading_(titleHeading) {
  const match = /^heading([1-6])$/.exec(String(titleHeading || ''));
  return match ? DocumentApp.ParagraphHeading['HEADING' + match[1]] : null;
}

function applyTitleTypography(paragraph, typography, insertSefariaLink) {
  // The heading goes on first, so any font/size the user set explicitly still
  // overrides the heading's look, and an empty one leaves it showing.
  const heading = titleParagraphHeading_(typography && typography.titleHeading);
  if (heading && paragraph && paragraph.setHeading) {
    paragraph.setHeading(heading);
  }
  // Titles deliberately do NOT preserve source emphasis: the bold/underline on
  // a title is applied by this add-on, so the user's title style stays
  // authoritative there.
  applyRoleTypography_(
    paragraph,
    typography,
    insertSefariaLink ? 'sefariaLink' : 'sourceTitle'
  );
}

function insertTransliterationParagraphAfter(doc, index, transliterationText, typography, ltr) {
  if (!transliterationText) {
    return;
  }
  let paragraph = doc.insertParagraph(index, transliterationText);
  paragraph.setLeftToRight(ltr !== false);
  paragraph.setAttributes({});
  applyRoleTypography_(paragraph, typography, 'transliteration');
}

function insertTransliterationIntoCell(cell, transliterationText, typography) {
  if (!cell || !transliterationText) {
    return;
  }
  let paragraph = cell.insertParagraph(cell.getNumChildren(), transliterationText);
  paragraph.setLeftToRight(true);
  paragraph.setAttributes({});
  applyRoleTypography_(paragraph, typography, 'transliteration');
}

function getAttributionParagraphText(attributionLines) {
  if (!attributionLines || !Array.isArray(attributionLines) || attributionLines.length === 0) {
    return "";
  }
  return attributionLines.join("\n");
}

function insertAttributionParagraph(paragraph, attributionLines) {
  const attributionText = getAttributionParagraphText(attributionLines);
  if (!attributionText) {
    return;
  }

  paragraph.setText(attributionText);
  let attributionStyle = {};
      attributionStyle[DocumentApp.Attribute.ITALIC] = true;
      attributionStyle[DocumentApp.Attribute.FONT_SIZE] = 8;
      attributionStyle[DocumentApp.Attribute.BOLD] = false;
      attributionStyle[DocumentApp.Attribute.UNDERLINE] = false;
  paragraph.setAttributes(attributionStyle);
  paragraph.setLeftToRight(true);
}

/**
 * Credit lines for the Hebrew edition, the counterpart of
 * getEnglishAttributionLines (attribution.gs, which stays English-only). The
 * v1 texts API returns the Hebrew version's title and license as
 * heVersionTitle / heLicense; each edition carries its own license, which is
 * the line that matters for reuse.
 */
function getHebrewAttributionLines_(data) {
  const title = String((data && data.heVersionTitle) || '').trim();
  if (!title) return [];
  const lines = ['Hebrew: ' + title];
  const license = String((data && (data.heLicense || data.heVersionLicense)) || '').trim();
  if (license) lines.push('License: ' + license);
  return lines;
}

function buildCitationLines(data, preferredTitle, includeTranslationSourceInfo) {
  const titleLine = String((preferredTitle || (data && data.ref) || '')).trim();
  const lines = [];
  if (titleLine) lines.push(titleLine);

  const englishVersion = String((data && data.versionTitle) || '').trim();
  const englishSource = String((data && data.versionSource) || '').trim();
  const hebrewVersion = String((data && data.heVersionTitle) || '').trim();
  const hebrewSource = String((data && data.heVersionSource) || '').trim();
  const license = String((data && (data.license || data.licenseName || data.licenseString)) || '').trim();
  const hebrewLicense = String((data && (data.heLicense || data.heVersionLicense)) || '').trim();
  const author = String((data && (data.author || data.collectiveTitle || data.authors)) || '').trim();

  if (author) lines.push('Author: ' + author);
  if (includeTranslationSourceInfo && englishVersion) lines.push('Translation: ' + englishVersion);
  if (includeTranslationSourceInfo && englishSource) lines.push('Translation source: ' + englishSource);
  if (hebrewVersion) lines.push('Source edition: ' + hebrewVersion);
  if (hebrewSource) lines.push('Source edition URL: ' + hebrewSource);
  if (license && hebrewLicense && license !== hebrewLicense) {
    lines.push('Translation license: ' + license);
    lines.push('Source edition license: ' + hebrewLicense);
  } else if (license || hebrewLicense) {
    lines.push('License: ' + (license || hebrewLicense));
  }
  return lines.filter(Boolean);
}

function insertCitationParagraph(doc, insertAtIndex, citationLines) {
  if (!citationLines || !citationLines.length) return;
  const paragraph = doc.insertParagraph(insertAtIndex, citationLines.join(''));
  insertAttributionParagraph(paragraph, citationLines);
}

function buildLinkedTitleText(baseTitle, data, singleLanguage) {
  let safeTitle = String(baseTitle || '').trim();
  let modeLabel = singleLanguage === 'he' ? 'Hebrew' : (singleLanguage === 'en' ? 'Translation' : 'Bilingual');
  let versionLabel = '';

  if (singleLanguage === 'he') {
    versionLabel = String((data && data.heVersionTitle) || '').trim();
  } else if (singleLanguage === 'en') {
    versionLabel = String((data && data.versionTitle) || '').trim();
  } else {
    const enVersion = String((data && data.versionTitle) || '').trim();
    const heVersion = String((data && data.heVersionTitle) || '').trim();
    if (enVersion && heVersion) {
      versionLabel = `EN: ${enVersion}; HE: ${heVersion}`;
    } else {
      versionLabel = enVersion || heVersion;
    }
  }

  if (!versionLabel) {
    return `${safeTitle} (${modeLabel})`;
  }
  return `${safeTitle} (${modeLabel} • ${versionLabel})`;
}

/**
 * Insert a resolved Sefaria source into the active Google Doc.
 *
 * Signature is an options bag so callers don't have to remember the order of
 * nine positional booleans. The internal body still uses the same local
 * variable names that the pre-refactor positional signature used, which is
 * why the destructure is so explicit — it keeps the 350-line body stable
 * while fixing the ergonomics at the call site.
 *
 * @param {Object} data          Resolved Sefaria payload (required).
 * @param {Object} [opts]        Per-call display/layout overrides.
 * @param {string} [opts.singleLanguage]                "he" | "en" | undefined (bilingual).
 * @param {boolean|string} [opts.pasukPreference=true]  Include line markers.
 * @param {string|null} [opts.preferredTitle]           Override the title shown (e.g. "Bereishit").
 * @param {boolean} [opts.includeTranslationSourceInfo] Append translation attribution.
 * @param {string} [opts.bilingualLayout="he-right"]    Bilingual layout mode.
 * @param {boolean} [opts.insertSefariaLink]            Hyperlink the title to sefaria.org.
 * @param {boolean} [opts.includeTransliteration]       Include transliteration of the Hebrew.
 * @param {boolean} [opts.insertCitationOnly]           Insert just the citation title, no body.
 */
function insertReference(data, opts) {
  const options = opts || {};
  const singleLanguage = options.singleLanguage;
  const pasukPreference = options.pasukPreference !== undefined ? options.pasukPreference : true;
  const preferredTitle = options.preferredTitle !== undefined ? options.preferredTitle : null;
  const includeTranslationSourceInfo = options.includeTranslationSourceInfo === true;
  const bilingualLayout = options.bilingualLayout || "he-right";
  const insertSefariaLink = options.insertSefariaLink === true;
  const includeTransliteration = options.includeTransliteration === true;
  const insertCitationOnly = options.insertCitationOnly === true;

  if (!data || !data.ref) {
    throw new Error("Unable to insert source: no resolved reference.");
  }

  let title = (preferredTitle) ? preferredTitle : data.ref;
  const includeLineMarkers = pasukPreference === true || pasukPreference === 'true';
  data = formatDataForPesukim(data, includeLineMarkers);

  let doc = DocumentApp.getActiveDocument().getBody();
  let docWrapper = DocumentApp.getActiveDocument();
  let cursor = docWrapper.getCursor();
  let selection = docWrapper.getSelection();
  let index = doc.getNumChildren();

  const resolveSafeSelectionInsertionIndex = (preserveSelection) => {
    if (!selection) return null;

    let rangeElements = selection.getRangeElements();
    if (!rangeElements || rangeElements.length === 0) return null;

    let firstElement = rangeElements[0].getElement();
    let bodyLevelElement = firstElement;
    let foundBodyLevel = false;
    // Use getType() instead of reference equality — Apps Script proxy objects for the same
    // Body returned by getParent() vs getBody() are not === equal, so reference comparison
    // silently walks past the body and always throws for normal paragraph selections.
    try {
      while (bodyLevelElement) {
        if (!bodyLevelElement.getParent) break;
        const parent = bodyLevelElement.getParent();
        if (!parent) break;
        if (parent.getType() === DocumentApp.ElementType.BODY_SECTION) {
          foundBodyLevel = true;
          break;
        }
        bodyLevelElement = parent;
      }
    } catch (e) {
      foundBodyLevel = false;
    }

    if (!foundBodyLevel || bodyLevelElement.getType() === DocumentApp.ElementType.TABLE) {
      throw new Error("Your selection is inside a table, header, or footer, which isn't supported. Click to place your cursor in the main body of the document, then try again.");
    }

    // Walk to the last body-level element in the selection so we insert after it.
    let lastBodyLevelElement = bodyLevelElement;
    if (!preserveSelection) {
      // When deleting we only need the first element's index (deletions adjust it inline).
    } else {
      const lastEl = rangeElements[rangeElements.length - 1].getElement();
      let candidate = lastEl;
      try {
        while (candidate) {
          if (!candidate.getParent) break;
          const parent = candidate.getParent();
          if (!parent) break;
          if (parent.getType() === DocumentApp.ElementType.BODY_SECTION) {
            lastBodyLevelElement = candidate;
            break;
          }
          candidate = parent;
        }
      } catch (e) {}
    }

    let insertionIndex = doc.getChildIndex(preserveSelection ? lastBodyLevelElement : bodyLevelElement) + 1;

    if (!preserveSelection) {
      for (let i = rangeElements.length - 1; i >= 0; i--) {
        let re = rangeElements[i];
        let el = re.getElement();
        try {
          if (re.isPartial()) {
            if (el.getType() === DocumentApp.ElementType.TEXT) {
              let start = re.getStartOffset();
              let end = re.getEndOffsetInclusive();
              if (start >= 0 && end >= start) {
                el.asText().deleteText(start, end);
              }
            }
          } else {
            let type = el.getType();
            if (type === DocumentApp.ElementType.TEXT) {
              let text = el.asText().getText();
              if (text.length > 0) {
                el.asText().deleteText(0, text.length - 1);
              }
            } else if (type === DocumentApp.ElementType.PARAGRAPH || type === DocumentApp.ElementType.LIST_ITEM) {
              const elParent = el.getParent();
              const elParentIsBody = elParent && elParent.getType() === DocumentApp.ElementType.BODY_SECTION;
              if (elParentIsBody && doc.getNumChildren() > 1) {
                let elIndex = doc.getChildIndex(el);
                el.removeFromParent();
                if (elIndex < insertionIndex) {
                  insertionIndex--;
                }
              } else {
                try { el.clear(); } catch (e) {}
              }
            }
          }
        } catch (e) {
          // Skip any element that cannot be deleted
        }
      }
    }

    return insertionIndex;
  };

  if (!cursor && selection) {
    index = resolveSafeSelectionInsertionIndex(options.preserveSelection === true);
  }

  if (cursor) {
    let currentElement = cursor.getElement();
    if (currentElement) {
      let paragraphParent = currentElement.getParent();
      if (paragraphParent) {
        index = paragraphParent.getChildIndex(currentElement) + 1;
      }
    }
  }
  let headerStyle = {};
        headerStyle[DocumentApp.Attribute.BOLD] = true;
        headerStyle[DocumentApp.Attribute.UNDERLINE] = true;
  let nullStyle = {};
        nullStyle[DocumentApp.Attribute.BOLD] = false;
        nullStyle[DocumentApp.Attribute.UNDERLINE] = false;
  let noUnderline = {};
    noUnderline[DocumentApp.Attribute.UNDERLINE] = false;

  // Credit every edition that is actually inserted: the translation unless
  // this is a Hebrew-only insert, the Hebrew edition unless it is
  // translation-only.
  const shouldIncludeEnglishAttribution = includeTranslationSourceInfo && singleLanguage != "he";
  const shouldIncludeHebrewAttribution = includeTranslationSourceInfo && singleLanguage != "en";
  let attributionLines = [].concat(
    shouldIncludeEnglishAttribution ? getEnglishAttributionLines(data) : [],
    shouldIncludeHebrewAttribution ? getHebrewAttributionLines_(data) : []
  );
  const typography = getTypographySettings();
  const currentPrefs = getPreferences();
  const transliterationScheme = currentPrefs.transliteration_scheme || "traditional";
  const transliterationDageshMode = currentPrefs.transliteration_biblical_dagesh_mode || "none";
  const transliterationIsBiblical = currentPrefs.transliteration_is_biblical_hebrew !== "false";
  const isBiblicalHebrewText = transliterationIsBiblical && data.type == "Tanakh";
  const transliterationOverrides = (() => {
    try {
      return JSON.parse(currentPrefs.transliteration_overrides || '{}') || {};
    } catch (error) {
      return {};
    }
  })();
  const transliterationTextRaw = (includeTransliteration && data.he)
    ? transliterateHebrewHtmlPreservingBasicBreaks(data.he, transliterationScheme, {
        keepNiqqud: true,
        isBiblicalHebrew: isBiblicalHebrewText,
        dageshMode: isBiblicalHebrewText ? transliterationDageshMode : "none",
        overrideMap: transliterationOverrides
      })
    : "";
  const transliterationText = (data.lineMarkersApplied && transliterationTextRaw)
    ? normalizeTransliterationLineMarkersToGematria(transliterationTextRaw, (data.sections && data.sections[1]) ? data.sections[1] : 1)
    : transliterationTextRaw;
  const sefariaUrl = `https://www.sefaria.org/${encodeURIComponent(data.ref || '').replace(/%20/g, '_')}`;

  const shouldAppendCitation = (insertCitationOnly === true || insertCitationOnly === "true");
  const citationLines = shouldAppendCitation ? buildCitationLines(data, title, includeTranslationSourceInfo) : [];

  const appendCitationParagraph = (insertAtIndex) => {
    if (!shouldAppendCitation) return;
    insertCitationParagraph(doc, insertAtIndex, citationLines);
  };

  let resolvedBilingualLayout = (singleLanguage) ? null : (bilingualLayout || "he-right");
  if (resolvedBilingualLayout !== "he-left" && resolvedBilingualLayout !== "he-top" && resolvedBilingualLayout !== "he-right") {
    resolvedBilingualLayout = "he-right";
  }

  if (singleLanguage) {
    let ltr = (singleLanguage == "he") ? false : true;
    let titleText = (singleLanguage == "he") ? data.heRef : title;
    if (insertSefariaLink) {
      titleText = buildLinkedTitleText(titleText, data, singleLanguage);
    }
    let mainText = (singleLanguage == "he") ? data.he : data.text;

    doc.insertParagraph(index, titleText)
      .setAttributes(headerStyle)
      .setLeftToRight(ltr);
    let insertedTitle = doc.getChild(index).asParagraph();
    applyTitleTypography(insertedTitle, typography, insertSefariaLink);
    if (insertSefariaLink) {
      insertedTitle.editAsText().setLinkUrl(sefariaUrl);
    }

    let mainTextParagraph = doc.insertParagraph(index+1, "");
    // nullStyle carries BOLD=false, so it has to land on the still-empty
    // paragraph. Applying it after insertRichTextFromHTML flattened the
    // source's own bold runs before they could be preserved.
    if (singleLanguage == "he") {
      mainTextParagraph.setAttributes(nullStyle);
    }
    insertRichTextFromHTML(mainTextParagraph, mainText);
    mainTextParagraph.setAttributes(noUnderline);
    mainTextParagraph.setLeftToRight(ltr);
    applyRoleTypography_(
      mainTextParagraph,
      typography,
      singleLanguage == "he" ? 'hebrew' : 'translation',
      { preserveSourceEmphasis: true }
    );

    if (singleLanguage == "he" && transliterationText) {
      insertTransliterationParagraphAfter(doc, index + 2, transliterationText, typography, true);
    }

    let singleLanguageNextIndex = index + 2;

    if (singleLanguage == "he" && transliterationText) {
      singleLanguageNextIndex += 1;
    }

    if (attributionLines.length > 0) {
      let attributionParagraph = doc.insertParagraph(singleLanguageNextIndex, "");
      insertAttributionParagraph(attributionParagraph, attributionLines);
      singleLanguageNextIndex += 1;
    }

    appendCitationParagraph(singleLanguageNextIndex);
  }
  else {
    if (resolvedBilingualLayout == "he-top") {
      doc.insertParagraph(index, insertSefariaLink ? buildLinkedTitleText(data.heRef, data, 'he') : data.heRef)
        .setAttributes(headerStyle)
        .setLeftToRight(false);
      let hebTitleParagraph = doc.getChild(index).asParagraph();
      applyTitleTypography(hebTitleParagraph, typography, insertSefariaLink);
      if (insertSefariaLink) {
        hebTitleParagraph.editAsText().setLinkUrl(sefariaUrl);
      }

      let hebTextParagraph = doc.insertParagraph(index + 1, "");
      hebTextParagraph.setLeftToRight(false);
      hebTextParagraph.setAttributes(nullStyle);
      insertRichTextFromHTML(hebTextParagraph, data.he);
      hebTextParagraph.setAttributes(noUnderline);
      applyRoleTypography_(hebTextParagraph, typography, 'hebrew', { preserveSourceEmphasis: true });

      if (transliterationText) {
        insertTransliterationParagraphAfter(doc, index + 2, transliterationText, typography, true);
      }

      doc.insertParagraph(index + (transliterationText ? 3 : 2), insertSefariaLink ? buildLinkedTitleText(title, data, 'en') : title)
        .setAttributes(headerStyle)
        .setLeftToRight(true);
      let enTitleParagraph = doc.getChild(index + (transliterationText ? 3 : 2)).asParagraph();
      applyTitleTypography(enTitleParagraph, typography, insertSefariaLink);
      if (insertSefariaLink) {
        enTitleParagraph.editAsText().setLinkUrl(sefariaUrl);
      }

      let engTextParagraph = doc.insertParagraph(index + (transliterationText ? 4 : 3), "");
      engTextParagraph.setLeftToRight(true);
      engTextParagraph.setAttributes(nullStyle);
      insertRichTextFromHTML(engTextParagraph, data.text);
      engTextParagraph.setAttributes(noUnderline);
      applyRoleTypography_(engTextParagraph, typography, 'translation', { preserveSourceEmphasis: true });

      let heTopNextIndex = index + (transliterationText ? 5 : 4);

      if (attributionLines.length > 0) {
        let attributionParagraph = doc.insertParagraph(heTopNextIndex, "");
        insertAttributionParagraph(attributionParagraph, attributionLines);
        heTopNextIndex += 1;
      }

      appendCitationParagraph(heTopNextIndex);
    } else {
      let cells = [
        ["", ""],
        ["", ""]
      ];
      let tableStyle = {};
          tableStyle[DocumentApp.Attribute.BOLD] = false;
      let table = doc.insertTable(index, cells)

      table.setAttributes(tableStyle);

      let englishColumn = (resolvedBilingualLayout == "he-left") ? 1 : 0;
      let hebrewColumn = (resolvedBilingualLayout == "he-left") ? 0 : 1;

      let engTitle = table.getCell(0, englishColumn)
        .setText("")
        .insertParagraph(0, "");
      engTitle.setLeftToRight(true);
      insertRichTextFromHTML(engTitle, insertSefariaLink ? buildLinkedTitleText(title, data, 'en') : title);
      engTitle.setAttributes(headerStyle);
      applyTitleTypography(engTitle, typography, insertSefariaLink);
      if (insertSefariaLink) {
        engTitle.editAsText().setLinkUrl(sefariaUrl);
      }

      let hebTitle = table.getCell(0, hebrewColumn)
        .setText("")
        .insertParagraph(0, "");
      hebTitle.setLeftToRight(false);
      insertRichTextFromHTML(hebTitle, insertSefariaLink ? buildLinkedTitleText(data.heRef, data, 'he') : data.heRef);
      hebTitle.setAttributes(headerStyle);
      applyTitleTypography(hebTitle, typography, insertSefariaLink);
      if (insertSefariaLink) {
        hebTitle.editAsText().setLinkUrl(sefariaUrl);
      }

      let engText = table.getCell(1, englishColumn)
        .setText("")
        .insertParagraph(0, "")
        .setLeftToRight(true);
      engText.setAttributes(nullStyle);
      insertRichTextFromHTML(engText, data.text);
      engText.setAttributes(noUnderline);
      applyRoleTypography_(engText, typography, 'translation', { preserveSourceEmphasis: true });

      let hebText = table.getCell(1, hebrewColumn)
        .setText("")
        .insertParagraph(0, "");
      hebText.setLeftToRight(false);
      hebText.setAttributes(nullStyle);
      insertRichTextFromHTML(hebText, data.he);
      hebText.setAttributes(noUnderline);
      applyRoleTypography_(hebText, typography, 'hebrew', { preserveSourceEmphasis: true });

      let sideBySideNextIndex = index + 1;

      if (attributionLines.length > 0) {
        let attributionParagraph = doc.insertParagraph(index + 1, "");
        insertAttributionParagraph(attributionParagraph, attributionLines);
        sideBySideNextIndex += 1;
      }

      appendCitationParagraph(sideBySideNextIndex);

      for (let r = 0; r < table.getNumRows(); r++) {
        const row = table.getRow(r);
        for (let c = 0; c < row.getNumCells(); c++) {
          const cell = row.getCell(c);
          const n = cell.getNumChildren();
          cell.getChild(n - 1).removeFromParent();
        }
      }

      if (transliterationText) {
        insertTransliterationIntoCell(table.getCell(1, hebrewColumn), transliterationText, typography);
      }
    }
  }
}

/**
 * True when a Sefaria text field (string, or nested array of segments) has
 * something to show once markup and whitespace entities are removed.
 */
function hasInsertableText_(value) {
  if (Array.isArray(value)) {
    return value.some(function (part) { return hasInsertableText_(part); });
  }
  if (value === null || value === undefined) return false;
  const stripped = String(value)
    .replace(/<[^>]*>/g, '')
    .replace(/&(nbsp|thinsp|ensp|emsp|hairsp|zwnj|zwj|lrm|rlm|#160|#8201);/gi, ' ')
    .trim();
  return stripped.length > 0;
}

/**
 * Pair each requested translation with its resolved payload, dropping the ones
 * that must not be inserted:
 *   - duplicates in the request (the same version selected twice);
 *   - payloads that failed to resolve;
 *   - payloads where Sefaria silently substituted a different version (it
 *     falls back to its default when the requested one has no text for the
 *     ref, which inserted the default translation twice);
 *   - versions whose English text is empty for this ref.
 *
 * @param {string[]} versionTitles  Requested titles, in insertion order.
 * @param {Array<Object>} dataList  Resolved payloads, index-aligned with versionTitles.
 * @return {{kept: Array<{versionTitle: string, data: Object}>, skipped: string[]}}
 */
function selectInsertableVersions_(versionTitles, dataList) {
  const kept = [];
  const skipped = [];
  const seen = {};
  for (let i = 0; i < versionTitles.length; i++) {
    const requested = String(versionTitles[i] || '').trim();
    if (!requested || seen[requested]) continue;
    seen[requested] = true;
    const data = dataList[i];
    const resolvedTitle = String((data && data.versionTitle) || '').trim();
    if (!data || resolvedTitle !== requested || !hasInsertableText_(data.text)) {
      skipped.push(requested);
      continue;
    }
    kept.push({ versionTitle: requested, data: data });
  }
  return { kept: kept, skipped: skipped };
}

/**
 * Title for one translation block of a multi-version insert. The linked form
 * already names the version ("Title (Translation • Version)"), so the plain
 * "(Version)" suffix is only added when there is no link — adding both printed
 * the version twice.
 */
function buildVersionBlockTitle_(baseTitle, versionTitle, data, insertSefariaLink, blockCount) {
  if (insertSefariaLink) {
    return buildLinkedTitleText(baseTitle, data, 'en');
  }
  let title = String(baseTitle || '').trim();
  const shortVt = String(versionTitle || '').trim().substring(0, 50);
  if (blockCount > 1 && shortVt) title = title + ' (' + shortVt + ')';
  return title;
}

/**
 * sefaria.org link for a ref, pinned to specific versions when given so each
 * block of a multi-version insert opens the translation it shows.
 */
function buildSefariaVersionUrl_(ref, enVersionTitle, heVersionTitle) {
  const encode = function (value) {
    return encodeURIComponent(String(value || '')).replace(/%20/g, '_');
  };
  const params = [];
  if (enVersionTitle) params.push('ven=' + encode(enVersionTitle));
  if (heVersionTitle) params.push('vhe=' + encode(heVersionTitle));
  return 'https://www.sefaria.org/' + encode(ref) + (params.length ? '?' + params.join('&') : '');
}

/**
 * Insert the same reference in multiple translation versions into the active document.
 * Only valid for "translation only" (singleLanguage="en") and "Hebrew on top" (bilingualLayout="he-top") modes.
 * For he-top: inserts the Hebrew block once, then each translation in sequence.
 * For en: inserts each translation as its own title + body block in sequence.
 * Consecutive translation blocks are separated by an empty paragraph.
 *
 * @param {string} ref           Resolved Sefaria reference string.
 * @param {Object} opts
 * @param {string[]} opts.versionTitles        Array of English version titles to insert.
 * @param {string}  [opts.heVersionTitle]      Hebrew version title.
 * @param {string}  [opts.singleLanguage]      "en" for translation-only mode; omit for he-top.
 * @param {string}  [opts.bilingualLayout]     Expected "he-top" when not singleLanguage.
 * @param {boolean} [opts.pasukPreference]     Include line markers.
 * @param {string}  [opts.preferredTitle]      Override displayed title (e.g. "Bereishit 1:1").
 * @param {boolean} [opts.includeTranslationSourceInfo] Append attribution.
 * @param {boolean} [opts.insertSefariaLink]   Hyperlink title to sefaria.org.
 * @return {{inserted: string[], skipped: string[]}} Version titles inserted, and
 *         those left out because they have no text for this ref.
 */
function insertReferenceVersions(ref, opts) {
  const options = opts || {};
  const versionTitles = Array.isArray(options.versionTitles) ? options.versionTitles.filter(Boolean) : [];
  const heVersionTitle = options.heVersionTitle || '';
  const singleLanguage = options.singleLanguage;
  const pasukPreference = options.pasukPreference !== undefined ? options.pasukPreference : true;
  const preferredTitle = options.preferredTitle || null;
  const includeTranslationSourceInfo = options.includeTranslationSourceInfo === true;
  const insertSefariaLink = options.insertSefariaLink === true;

  if (!ref) throw new Error('insertReferenceVersions: no reference provided.');
  if (!versionTitles.length) throw new Error('insertReferenceVersions: no version titles provided.');

  const resolved = versionTitles.map(function (vt) {
    return findReference(ref, { en: vt, he: heVersionTitle });
  });
  const selection = selectInsertableVersions_(versionTitles, resolved);
  const kept = selection.kept;

  if (!kept.length) {
    throw new Error('None of the selected translations has text for this reference.');
  }

  const includeLineMarkers = pasukPreference === true || pasukPreference === 'true';
  const typography = getTypographySettings();

  let doc = DocumentApp.getActiveDocument().getBody();
  let docWrapper = DocumentApp.getActiveDocument();
  let cursor = docWrapper.getCursor();
  let index = doc.getNumChildren();

  if (cursor) {
    let currentElement = cursor.getElement();
    if (currentElement && currentElement.getParent()) {
      index = currentElement.getParent().getChildIndex(currentElement) + 1;
    }
  }

  let headerStyle = {};
  headerStyle[DocumentApp.Attribute.BOLD] = true;
  headerStyle[DocumentApp.Attribute.UNDERLINE] = true;
  let nullStyle = {};
  nullStyle[DocumentApp.Attribute.BOLD] = false;
  let noUnderline = {};
  noUnderline[DocumentApp.Attribute.UNDERLINE] = false;
  let separatorStyle = {};
  separatorStyle[DocumentApp.Attribute.BOLD] = false;
  separatorStyle[DocumentApp.Attribute.ITALIC] = false;
  separatorStyle[DocumentApp.Attribute.UNDERLINE] = false;

  const insertSeparator = () => {
    doc.insertParagraph(index, '').setAttributes(separatorStyle).setLeftToRight(true);
    index += 1;
  };

  if (singleLanguage !== 'en') {
    // Hebrew on top: insert Hebrew once from the first version, then each translation.
    let firstData = formatDataForPesukim(kept[0].data, includeLineMarkers);
    let heTitle = insertSefariaLink ? buildLinkedTitleText(firstData.heRef, firstData, 'he') : firstData.heRef;
    doc.insertParagraph(index, heTitle).setAttributes(headerStyle).setLeftToRight(false);
    let heTitlePara = doc.getChild(index).asParagraph();
    applyTitleTypography(heTitlePara, typography, insertSefariaLink);
    if (insertSefariaLink) {
      heTitlePara.editAsText().setLinkUrl(buildSefariaVersionUrl_(ref, '', firstData.heVersionTitle || heVersionTitle));
    }

    let heTextPara = doc.insertParagraph(index + 1, '');
    heTextPara.setLeftToRight(false).setAttributes(nullStyle);
    insertRichTextFromHTML(heTextPara, firstData.he);
    heTextPara.setAttributes(noUnderline);
    applyRoleTypography_(heTextPara, typography, 'hebrew', { preserveSourceEmphasis: true });
    index += 2;
  }

  for (let i = 0; i < kept.length; i++) {
    if (i > 0) insertSeparator();

    let d = formatDataForPesukim(kept[i].data, includeLineMarkers);
    let displayTitle = buildVersionBlockTitle_(preferredTitle || d.ref, kept[i].versionTitle, d, insertSefariaLink, kept.length);
    doc.insertParagraph(index, displayTitle).setAttributes(headerStyle).setLeftToRight(true);
    let titlePara = doc.getChild(index).asParagraph();
    applyTitleTypography(titlePara, typography, insertSefariaLink);
    if (insertSefariaLink) {
      titlePara.editAsText().setLinkUrl(buildSefariaVersionUrl_(ref, kept[i].versionTitle, ''));
    }

    let textPara = doc.insertParagraph(index + 1, '');
    textPara.setLeftToRight(true).setAttributes(nullStyle);
    insertRichTextFromHTML(textPara, d.text);
    textPara.setAttributes(noUnderline);
    applyRoleTypography_(textPara, typography, 'translation', { preserveSourceEmphasis: true });
    index += 2;

    if (includeTranslationSourceInfo) {
      let attrLines = getEnglishAttributionLines(d);
      if (attrLines.length) {
        let attrPara = doc.insertParagraph(index, '');
        insertAttributionParagraph(attrPara, attrLines);
        index += 1;
      }
    }
  }

  // Close the run with an empty paragraph too, so whatever follows the insert
  // point (typically the next source) doesn't butt against the last citation.
  insertSeparator();

  return {
    inserted: kept.map(function (entry) { return entry.versionTitle; }),
    skipped: selection.skipped
  };
}

// Converts HTML from Sefaria API to rich-text in Google Docs.
// Handles <b>, <i>, <br>, <sup> (footnotes) tags and escapes HTML entities.
function insertRichTextFromHTML(element, htmlString) {
  const extendedGemaraPreference =
    PropertiesService.getUserProperties().getProperty("extended_gemara") === "true";

  element = element.editAsText();
  let buf = [];
  let index = 0, italicsFnCount = 0, textLength = element.editAsText().getText().length;
  let bolded = false, italicized = false, inFootnote = false;

  if (Array.isArray(htmlString)) {
    htmlString = htmlString.join("");
  }
  let iterableString = htmlString.split(/(<\/?[a-zA-Z]+[^>]*>)/g);

  let inserterFn = (textModification) => {
    let snippet = buf.join("");
    snippet = decodeHTMLEntities(snippet);

    let snippetLength = snippet.length;
    let snippetIndex = snippetLength - 1;

    if (snippet != "") {
      element.insertText(textLength, snippet);

      element.setBold(textLength, textLength+snippetIndex, bolded);
      element.setItalic(textLength, textLength+snippetIndex, italicized);

      textLength += snippetLength;
    }

    switch(textModification) {
      case "bold":
        bolded = !bolded;
        break;
      case "italic":
        italicized = !italicized;
        break;
      case "linebreak":
        element.insertText(textLength, "\n");
        textLength += 1;
        break;
    }
  }

  for (let i = 0; i < iterableString.length; i++) {
    let word = iterableString[i];

    if (inFootnote) {
      if ( word == "<i class=\"footnote\">" || word == "<i>") {
        italicsFnCount++;
      } else if ( word == "</i>") {
        italicsFnCount--;
        if (italicsFnCount == 0) {
          inFootnote = false;
          continue;
        }
      }
    }
    else if (word[0] == "<") {
      let tagName = /<\/?([a-zA-Z]+)([a-zA-Z'"0-9= \-/])*>/.exec(word)[1];

      switch (tagName) {
        case "b":
          inserterFn("bold");
          buf = [];
          index = 0;
          break;
        case "strong":
          if (!extendedGemaraPreference || bolded) {
            inserterFn("bold");
          }
          buf = [];
          index = 0;
          break;
        case "i":
          if (!extendedGemaraPreference || bolded) {
            inserterFn("italic");
          }
          buf = [];
          index = 0;
          break;
        case "br":
          inserterFn("linebreak");
          buf = [];
          index = 0;
          break;
        case "sup":
          inFootnote = true;
          italicsFnCount = 0;
          break;
        default:
          break;
      }
      continue;
    }

    if (!inFootnote) {
      buf[index++] = word;
    }
  }

  let snippet = buf.join("");
  if ( snippet != "" ) {
    snippet = decodeHTMLEntities(snippet);
    element.insertText(textLength, snippet);
    let snippetIndex = snippet.length - 1;
    // Use the live flags, not a hardcoded false: markup that never closes its
    // <b>/<i> would otherwise drop the emphasis on the final run.
    element.setBold(textLength, textLength+snippetIndex, bolded);
    element.setItalic(textLength, textLength+snippetIndex, italicized);
  }
}
